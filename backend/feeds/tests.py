"""
Unit tests for external feeds, caching tiers, SSRF mitigations, and Gemini summarization.

Covers:
- Dual-tier feed cache (1h fresh vs 24h stale fallback).
- GitHub trending query formatting and payload normalization.
- Strict SSRF protections: IP validation, private ranges, DNS rebinding TOCTOU defense.
- Article scraping, body sanitization, and plain-text extraction.
- Gemini client responses, structured validation, and quota/error handling.
"""

import socket
from unittest.mock import patch

import requests
from google.genai import types
from google.genai.errors import ClientError
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from pydantic import ValidationError
from redis.exceptions import ConnectionError as RedisConnectionError
from rest_framework.test import APITestCase

from .cache import read_feed, store_feed
from .summarizer import ArticleError, ArticleSummary, PinnedHTTPSAdapter, SummaryUnavailable, UnsafeArticleURL, resolve_public_url, scrape_article, summarize_text
from .tasks import fetch_github_trending, fetch_news
from .freenews import article_text_key, request_data



def dns(address):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))]


class FeedTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_cache_fresh_stale_and_missing(self):
        self.assertIsNone(read_feed("github"))
        with patch("feeds.cache.cache.set", wraps=cache.set) as setter:
            store_feed("github", [{"name": "example"}])
            self.assertEqual(setter.call_args_list[0].args[2], 3600)
        self.assertFalse(read_feed("github")["stale"])
        cache.delete("feed:github")
        self.assertTrue(read_feed("github")["stale"])

    @patch("feeds.tasks.requests.get")
    def test_github_query_and_normalization(self, get):
        get.return_value.json.return_value = {"items": [{
            "id": n, "full_name": f"owner/repo{n}", "html_url": f"https://github.com/owner/repo{n}",
            "language": None, "description": None, "stargazers_count": n,
        } for n in range(1, 7)]}
        self.assertEqual(fetch_github_trending.run()["count"], 5)
        self.assertIn("created:>=", get.call_args.kwargs["params"]["q"])
        self.assertEqual(get.call_args.kwargs["params"]["sort"], "stars")
        self.assertEqual(read_feed("github")["items"][0]["language"], "Not specified")

    @override_settings(FREENEWS_API_KEY="test-key")
    @patch("feeds.tasks.request_data")
    def test_news_categories_details_and_body_privacy(self, request):
        ids = [f"00000000-0000-4000-8000-{n:012d}" for n in range(1, 7)]
        def provider(endpoint, params, deadline):
            if endpoint == "news":
                return [{"uuid": "invalid"}] + [{"uuid": i} for i in ids]
            return {"uuid": params["uuid"], "title": "Headline", "original_url": f"https://example.com/{params['uuid']}", "publisher": "Source", "incipit": "Intro", "body": "Useful article content. " * 30, "published_at": "2026-10-11T10:00:00Z"}
        request.side_effect = provider
        for category in ("tech", "global"):
            self.assertEqual(fetch_news.run(category)["count"], 5)
        listing = [c.args[1] for c in request.call_args_list if c.args[0] == "news"]
        self.assertEqual(listing[0], {"topic": "technology", "language": "en", "order_by": "recent"})
        self.assertEqual(listing[1]["topic"], "world")
        self.assertEqual(sum(c.args[0] == "details" for c in request.call_args_list), 5)
        payload = read_feed("news:tech")
        self.assertEqual(payload["source"], "FreeNewsApi.io")
        self.assertNotIn("body", payload["items"][0])
        self.assertTrue(cache.get(article_text_key(payload["items"][0]["url"])))

    @override_settings(FREENEWS_API_KEY="test-key")
    @patch("feeds.tasks.request_data")
    def test_unsafe_urls_and_duplicates_are_filtered(self, request):
        ids = [f"00000000-0000-4000-8000-{n:012d}" for n in range(1, 5)]
        request.side_effect = [
            [{"uuid": i} for i in [ids[0], ids[0], *ids[1:]]],
            {"uuid": ids[0], "title": "Unsafe", "original_url": "javascript:alert(1)"},
            {"uuid": ids[1], "title": "Good", "original_url": "https://example.com/story"},
            {"uuid": ids[2], "title": "Duplicate", "original_url": "https://example.com/story"},
            {"uuid": ids[3], "title": "Missing URL"},
        ]
        self.assertEqual(fetch_news.run("tech")["count"], 1)
        self.assertEqual(request.call_count, 5)

    @override_settings(FREENEWS_API_KEY="")
    @patch("feeds.tasks.request_data")
    def test_missing_key_does_not_call_provider(self, request):
        self.assertEqual(fetch_news.run("tech")["status"], "not_configured")
        request.assert_not_called()

    @override_settings(FREENEWS_API_KEY="test-key")
    @patch("feeds.tasks.request_data", return_value={"error": "bad"})
    def test_bad_payload_preserves_last_good(self, request):
        store_feed("news:tech", [{"title": "Previous"}])
        self.assertEqual(fetch_news.run("tech")["status"], "invalid_payload")
        self.assertEqual(read_feed("news:tech")["items"][0]["title"], "Previous")

    def test_previous_provider_cache_is_not_returned(self):
        cache.set("feed:news:tech", {"items": [{"title": "Old provider"}]})
        cache.set("feed:news:tech:last-good", {"items": []})
        self.assertIsNone(read_feed("news:tech"))

    @override_settings(FREENEWS_API_KEY="test-key")
    @patch("feeds.tasks.request_data")
    def test_news_rate_error_retries_without_replacing_cache(self, request):
        store_feed("news:tech", [{"title": "Previous"}])
        response = requests.Response()
        response.status_code = 429
        response.headers["Retry-After"] = "300"
        request.side_effect = requests.HTTPError(response=response)
        with patch.object(fetch_news, "retry", side_effect=RuntimeError("retry")) as retry:
            with self.assertRaises(RuntimeError):
                fetch_news.run("tech")
            self.assertEqual(retry.call_args.kwargs["countdown"], 300)
        self.assertIsNone(cache.get("feed:news:tech:lock"))
        self.assertEqual(read_feed("news:tech")["items"][0]["title"], "Previous")

    @patch("feeds.tasks.requests.get")
    def test_duplicate_job_is_skipped(self, get):
        cache.add("feed:github:lock", True)
        self.assertEqual(fetch_github_trending.run()["status"], "already_running")
        get.assert_not_called()

    @patch("feeds.tasks.requests.get")
    def test_retry_respects_provider_delay_and_releases_lock(self, get):
        response = requests.Response()
        response.status_code = 429
        response.headers["Retry-After"] = "300"
        get.side_effect = requests.HTTPError(response=response)
        with patch.object(fetch_github_trending, "retry", side_effect=RuntimeError("retry")) as retry:
            with self.assertRaises(RuntimeError):
                fetch_github_trending.run()
            self.assertEqual(retry.call_args.kwargs["countdown"], 300)
        self.assertIsNone(cache.get("feed:github:lock"))


class FreeNewsTransportTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    @override_settings(FREENEWS_API_KEY="test-key")
    @patch("feeds.freenews.time.monotonic", return_value=0)
    @patch("feeds.freenews.requests.get")
    def test_auth_and_shared_rate_gate(self, get, clock):
        get.return_value.is_redirect = False
        get.return_value.json.return_value = {"data": []}
        with patch("feeds.freenews.cache.add", side_effect=[False, True]) as gate, patch("feeds.freenews.time.sleep") as sleep:
            self.assertEqual(request_data("news", {"language": "en"}, 55), [])
            sleep.assert_called_once_with(0.1)
            self.assertEqual(gate.call_args.kwargs["timeout"], 1)
        self.assertEqual(get.call_args.args[0], "https://api.freenewsapi.io/v1/news")
        self.assertEqual(get.call_args.kwargs["headers"], {"x-api-key": "test-key"})
        self.assertFalse(get.call_args.kwargs["allow_redirects"])

    @patch("feeds.freenews.time.monotonic", return_value=60)
    @patch("feeds.freenews.requests.get")
    def test_gate_wait_is_bounded(self, get, clock):
        cache.add("freenews:request-gate", True, 60)
        with self.assertRaises(requests.Timeout):
            request_data("news", {}, 55)
        get.assert_not_called()

    @patch("feeds.freenews.time.monotonic", return_value=0)
    @patch("feeds.freenews.requests.get")
    def test_invalid_payload_and_redirect_rejected(self, get, clock):
        get.return_value.is_redirect = False
        get.return_value.json.return_value = {"error": "Bad"}
        with self.assertRaises(ValueError):
            request_data("news", {}, 55)
        cache.clear()
        get.return_value.is_redirect = True
        with self.assertRaises(ValueError):
            request_data("news", {}, 55)


class ScraperTests(SimpleTestCase):
    @patch("feeds.summarizer.socket.getaddrinfo")
    def test_private_and_reserved_addresses_are_rejected(self, lookup):
        for address in ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "::ffff:127.0.0.1", "192.168.1.1", "224.0.0.1"]:
            lookup.return_value = dns(address)
            with self.subTest(address=address), self.assertRaises(UnsafeArticleURL):
                resolve_public_url("https://example.com/article")

    def test_bad_url_schemes_credentials_and_ports(self):
        for url in ["file:///etc/passwd", "ftp://example.com", "http://name:pass@example.com", "https://example.com:8000", "http://example.com\\@localhost"]:
            with self.subTest(url=url), self.assertRaises(UnsafeArticleURL):
                resolve_public_url(url)

    @patch("feeds.summarizer.socket.getaddrinfo", return_value=dns("93.184.216.34"))
    def test_ip_is_pinned_and_tls_checks_hostname(self, lookup):
        parsed, url = resolve_public_url("https://example.com/article?q=1")
        self.assertEqual(url, "https://93.184.216.34/article?q=1")
        adapter = PinnedHTTPSAdapter(parsed.hostname)
        self.assertEqual(adapter.poolmanager.connection_pool_kw["assert_hostname"], "example.com")
        self.assertEqual(adapter.poolmanager.connection_pool_kw["server_hostname"], "example.com")

    @patch("feeds.summarizer.requests.Session")
    @patch("feeds.summarizer.socket.getaddrinfo", side_effect=[dns("93.184.216.34"), dns("127.0.0.1")])
    def test_redirect_to_private_host_is_blocked(self, lookup, session):
        response = session.return_value.__enter__.return_value.get.return_value.__enter__.return_value
        response.status_code = 302
        response.headers = {"Location": "http://localhost/private"}
        with self.assertRaises(UnsafeArticleURL):
            scrape_article("https://example.com")
        self.assertEqual(session.return_value.__enter__.return_value.get.call_count, 1)

    @patch("feeds.summarizer.requests.Session")
    @patch("feeds.summarizer.socket.getaddrinfo", return_value=dns("93.184.216.34"))
    def test_scrape_main_paragraphs_only_and_size_limit(self, lookup, session):
        response = session.return_value.__enter__.return_value.get.return_value.__enter__.return_value
        response.status_code = 200
        response.headers = {"Content-Type": "text/html; charset=utf-8"}
        paragraph = "A useful sentence about software development and thoughtful tools. " * 5
        response.iter_content.return_value = [f"<nav><p>navigation</p></nav><article><p>{paragraph}</p></article>".encode()]
        self.assertEqual(scrape_article("https://example.com"), paragraph.strip())
        self.assertNotIn("navigation", scrape_article("https://example.com"))
        response.iter_content.return_value = [b"x" * 2_000_001]
        with self.assertRaises(ArticleError):
            scrape_article("https://example.com")

    def test_summary_schema_requires_three_nonempty_points(self):
        for points in [["one"], ["one", "two", ""], ["one"] * 4]:
            with self.assertRaises(ValidationError):
                ArticleSummary(bullet_points=points)

    @override_settings(GEMINI_API_KEY="test-key")
    @patch("feeds.summarizer.genai.Client")
    def test_sdk_structured_response(self, sdk):
        client = sdk.return_value.__enter__.return_value
        client.models.generate_content.return_value.candidates = [types.Candidate(finish_reason=types.FinishReason.STOP)]
        client.models.generate_content.return_value.parsed = ArticleSummary(bullet_points=["One", "Two", "Three"])
        self.assertEqual(summarize_text("article"), ["One", "Two", "Three"])
        self.assertEqual(client.models.generate_content.call_args.kwargs["config"].response_schema, ArticleSummary)
        client.models.generate_content.return_value.parsed = None
        with self.assertRaises(SummaryUnavailable):
            summarize_text("article")

    @override_settings(GEMINI_API_KEY="test-key")
    @patch("feeds.summarizer.genai.Client")
    def test_gemini_quota_error_is_actionable(self, sdk):
        sdk.return_value.__enter__.return_value.models.generate_content.side_effect = ClientError(429, {"error": {"message": "Quota exhausted"}})
        with self.assertRaisesMessage(SummaryUnavailable, "quota is exhausted"):
            summarize_text("article")


class FeedAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(username="reader")
        self.client.force_authenticate(self.user)

    @patch("feeds.tasks.requests.get")
    def test_feed_endpoints_only_read_cache(self, get):
        self.assertEqual(self.client.get("/api/github-trending/").status_code, 503)
        store_feed("github", [])
        store_feed("news:tech", [{"title": "Cached news"}])
        self.assertEqual(self.client.get("/api/github-trending/").status_code, 200)
        self.assertEqual(self.client.get("/api/news/tech/").data["items"][0]["title"], "Cached news")
        self.assertEqual(self.client.get("/api/news/?category=tech").status_code, 200)
        self.assertEqual(self.client.get("/api/news/invalid/").status_code, 400)
        get.assert_not_called()

    def test_all_endpoints_require_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/news/").status_code, 401)
        self.assertEqual(self.client.get("/api/github-trending/").status_code, 401)
        self.assertEqual(self.client.post("/api/summarize/", {}).status_code, 401)

    @override_settings(GEMINI_API_KEY="test-key")
    @patch("feeds.views.summarize_text", return_value=["One", "Two", "Three"])
    @patch("feeds.views.scrape_article", return_value="Article text")
    def test_summary_cached_per_user_and_input_validation(self, scrape, summarize):
        payload = {"article_url": "https://example.com/article"}
        first = self.client.post("/api/summarize/", payload)
        second = self.client.post("/api/summarize/", payload)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(len(first.data["bullet_points"]), 3)
        self.assertTrue(second.data["cached"])
        scrape.assert_called_once()
        summarize.assert_called_once()
        self.assertEqual(self.client.post("/api/summarize/", {}).status_code, 400)

    @override_settings(GEMINI_API_KEY="test-key")
    @patch("feeds.views.summarize_text", return_value=["One", "Two", "Three"])
    @patch("feeds.views.scrape_article")
    def test_summary_uses_cached_provider_text(self, scrape, summarize):
        url = "https://example.com/article"
        cache.set(article_text_key(url), "Cached article content")
        response = self.client.post("/api/summarize/", {"article_url": url})
        self.assertEqual(response.status_code, 200)
        summarize.assert_called_once_with("Cached article content")
        scrape.assert_not_called()

    @override_settings(GEMINI_API_KEY="test-key")
    @patch("feeds.views.scrape_article", side_effect=UnsafeArticleURL("Private address"))
    def test_unsafe_summary_url_returns_400(self, scrape):
        self.assertEqual(self.client.post("/api/summarize/", {"article_url": "http://127.0.0.1/"}).status_code, 400)

    @override_settings(GEMINI_API_KEY="")
    def test_summary_rate_limit_and_missing_configuration(self):
        for _ in range(10):
            self.assertEqual(self.client.post("/api/summarize/", {"article_url": "https://example.com/"}).status_code, 503)
        self.assertEqual(self.client.post("/api/summarize/", {"article_url": "https://example.com/"}).status_code, 429)

    @patch("feeds.views.read_feed", side_effect=RedisConnectionError())
    def test_redis_outage_is_explicit(self, read):
        self.assertEqual(self.client.get("/api/github-trending/").status_code, 503)
