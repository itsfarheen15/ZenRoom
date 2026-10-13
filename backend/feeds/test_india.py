from datetime import timedelta
from unittest.mock import patch
from uuid import UUID

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from django.utils import timezone

from .cache import read_feed
from .india import about_india, same_story
from .tasks import fetch_news


@override_settings(FREENEWS_API_KEY="test")
class IndiaSubjectTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_subject_not_publisher(self):
        for story in [
            {"title": "India approves new digital policy", "publisher": "BBC", "countries": ["GB"]},
            {"title": "Satellite launch succeeds", "incipit": "ISRO launches from India's spaceport", "publisher": "Reuters"},
            {"title": "Mumbai opens new metro line", "publisher": "AP"},
        ]:
            self.assertTrue(about_india(story))
        for title in ["US election results", "Indian Ocean storm reaches Madagascar", "Indiana wins basketball final", "Indian Wells tennis results", "American Indian museum opens"]:
            self.assertFalse(about_india({"title": title, "publisher": "Times of India", "countries": ["IN"]}))

    def test_overlap(self):
        self.assertTrue(same_story("India approves major semiconductor plant investment", "Major semiconductor plant investment approved in India"))
        self.assertFalse(same_story("India approves semiconductor plant", "India wins cricket series"))

    @patch("feeds.india.request_data")
    def test_recent_subject_coverage_dedup_and_bounds(self, request):
        now = timezone.now()
        titles = ["India approves major semiconductor plant investment", "Major semiconductor plant investment approved in India",
                  "Mumbai opens coastal metro railway", "India signs trade deal with Europe", "Delhi schools announce pollution closures",
                  "ISRO launches lunar science mission", "India wins cricket series", "US election results"]
        rows = [{"uuid": str(UUID(int=i+1)), "title": title, "published_at": (now - timedelta(minutes=i)).isoformat(),
                 "original_url": f"https://example.com/{i}", "publisher": "BBC" if i < 7 else "Times of India",
                 "countries": ["GB"] if i < 7 else ["IN"]} for i, title in enumerate(titles)]
        rows += [{**rows[0], "uuid": str(UUID(int=50)), "published_at": (now - timedelta(days=5)).isoformat()}]
        def provider(endpoint, params, deadline):
            if endpoint == "news":
                self.assertNotIn("country", params)
                self.assertEqual(params["order_by"], "recent")
                self.assertIn("published_after", params)
                return list(reversed(rows))
            return next(row for row in rows if row["uuid"] == params["uuid"])
        request.side_effect = provider
        self.assertEqual(fetch_news.run("india")["count"], 5)
        payload = read_feed("news:india")
        self.assertEqual([item["title"] for item in payload["items"]], [titles[i] for i in [0, 2, 3, 4, 5]])
        self.assertTrue(all(item["source"] == "BBC" for item in payload["items"]))
        self.assertLessEqual(request.call_count, 27)
        self.assertFalse(payload["stale"])
        self.assertNotIn("trending", payload["ranking"].lower())

    @patch("feeds.india.request_data", return_value=[])
    def test_no_relevant_results_is_truthful_empty(self, request):
        cache.set("feed:freenews:v1:news:india", {"items": [{"title": "Old country filtered news"}]})
        self.assertIsNone(read_feed("news:india"))
        self.assertEqual(fetch_news.run("india")["count"], 0)
        self.assertEqual(read_feed("news:india")["items"], [])

    @patch("feeds.india.request_data", return_value={"bad": "payload"})
    def test_invalid_payload_preserves_stale(self, request):
        from .cache import store_feed, feed_key
        store_feed("news:india", [{"title": "Previous India story"}])
        cache.delete(feed_key("news:india"))
        self.assertEqual(fetch_news.run("india")["status"], "invalid_payload")
        self.assertTrue(read_feed("news:india")["stale"])

    @patch("feeds.india.request_data")
    def test_title_search_outage_falls_back_to_bounded_global_scan(self, request):
        import requests
        response = requests.Response()
        response.status_code = 500
        row = {"uuid": str(UUID(int=100)), "title": "India announces solar energy investment", "published_at": timezone.now().isoformat(),
               "original_url": "https://bbc.example/india", "publisher": "BBC"}
        def provider(endpoint, params, deadline):
            if "in_title" in params:
                raise requests.HTTPError(response=response)
            if endpoint == "details":
                return row
            self.assertNotIn("country", params)
            return [row] * 10
        request.side_effect = provider
        self.assertEqual(fetch_news.run("india")["count"], 1)
        self.assertEqual(request.call_count, 9)
        self.assertIn("unavailable", read_feed("news:india")["coverage"])

    @patch("feeds.india.request_data")
    def test_removed_article_does_not_discard_other_matches(self, request):
        import requests
        rows = [{"uuid": str(UUID(int=i)), "title": "India announces energy policy", "published_at": timezone.now().isoformat()}
                for i in (200, 201)]
        def provider(endpoint, params, deadline):
            if endpoint == "news":
                return rows
            if params["uuid"] == rows[0]["uuid"]:
                response = requests.Response()
                response.status_code = 404
                raise requests.HTTPError(response=response)
            return {**rows[1], "original_url": "https://example.com/india", "publisher": {"invalid": "shape"}}
        request.side_effect = provider
        self.assertEqual(fetch_news.run("india")["count"], 1)
        self.assertEqual(read_feed("news:india")["items"][0]["source"], "Unknown source")
