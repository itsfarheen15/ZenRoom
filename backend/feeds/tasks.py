import logging
import time
from uuid import UUID
from datetime import timedelta
from urllib.parse import urlsplit

import requests
from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .india import fetch_india
from .cache import store_feed
from .freenews import request_data, store_article_text

logger = logging.getLogger(__name__)
NEWS_CATEGORIES = {
    "tech": {"topic": "technology"},
    "india": {},
    "global": {"topic": "world"},
}


def safe_url(value):
    if not isinstance(value, str):
        return ""
    try:
        parsed = urlsplit(value)
        return value if parsed.scheme in ("http", "https") and parsed.hostname and not parsed.username else ""
    except ValueError:
        return ""


def retry_provider(task, exc):
    response = getattr(exc, "response", None)
    code = response.status_code if response is not None else None
    if code is not None and code not in (403, 429) and code < 500:
        logger.warning("Feed provider rejected request (HTTP %s).", code)
        return {"status": "provider_error"}
    delay = min(60 * (2 ** task.request.retries), 900)
    if response is not None:
        try:
            delay = max(delay, min(int(response.headers.get("Retry-After", 0)), 3600))
        except (ValueError, TypeError):
            pass
    raise task.retry(exc=RuntimeError("Feed provider temporarily unavailable."), countdown=delay)


@shared_task(bind=True, max_retries=3)
def fetch_github_trending(self):
    lock = "feed:github:lock"
    if not cache.add(lock, True, 180):
        return {"status": "already_running"}
    try:
        since = (timezone.now() - timedelta(days=7)).date().isoformat()
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        if settings.GITHUB_TOKEN:
            headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
        response = requests.get(
            "https://api.github.com/search/repositories",
            params={"q": f"created:>={since} stars:>0 fork:false archived:false", "sort": "stars", "order": "desc", "per_page": 5},
            headers=headers, timeout=(5, 20),
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict) or not isinstance(data.get("items"), list):
            raise ValueError("Invalid GitHub response.")
        items = [{
            "id": repo["id"], "name": repo["full_name"], "url": safe_url(repo.get("html_url")),
            "description": repo.get("description") or "No description provided.",
            "language": repo.get("language") or "Not specified", "stars": repo.get("stargazers_count", 0),
        } for repo in data["items"][:5] if isinstance(repo, dict) and repo.get("id") and repo.get("full_name") and safe_url(repo.get("html_url"))]
        store_feed("github", items, ranking="Most-starred repositories created in the last 7 days", source="GitHub REST API")
        return {"status": "updated", "count": len(items)}
    except requests.RequestException as exc:
        return retry_provider(self, exc)
    except (ValueError, KeyError, TypeError):
        logger.warning("GitHub returned an invalid payload; preserving the previous feed.")
        return {"status": "invalid_payload"}
    finally:
        cache.delete(lock)


@shared_task(bind=True, max_retries=3)
def fetch_news(self, category):
    if category not in NEWS_CATEGORIES:
        raise ValueError("Unknown news category.")
    if not settings.FREENEWS_API_KEY:
        logger.warning("FREENEWS_API_KEY is not configured; skipping news refresh.")
        return {"status": "not_configured"}
    lock = f"feed:news:{category}:lock"
    if not cache.add(lock, True, 180):
        return {"status": "already_running"}
    try:
        deadline = time.monotonic() + 55
        if category == "india":
            items, coverage = fetch_india(deadline, safe_url)
            store_feed("news:india", items, category="india", source="FreeNewsApi.io",
                       ranking="Latest distinct India stories in the searched coverage (past 72 hours)",
                       coverage=coverage)
            return {"status": "updated", "count": len(items)}
        articles = request_data("news", {**NEWS_CATEGORIES[category], "language": "en", "order_by": "recent"}, deadline)
        if not isinstance(articles, list):
            raise ValueError("Invalid news list.")
        items, seen, seen_ids = [], set(), set()
        for article in articles[:10]:
            if not isinstance(article, dict):
                continue
            try:
                article_id = str(UUID(article.get("uuid", "")))
            except (ValueError, TypeError, AttributeError):
                continue
            if article_id in seen_ids:
                continue
            seen_ids.add(article_id)
            detail_key = f"freenews:details:{article_id}"
            detail = cache.get(detail_key)
            if detail is None:
                try:
                    detail = request_data("details", {"uuid": article_id}, deadline)
                except requests.HTTPError as exc:
                    if exc.response is not None and exc.response.status_code == 404:
                        continue
                    raise
                if not isinstance(detail, dict) or detail.get("uuid") != article_id:
                    raise ValueError("Invalid news detail.")
                cache.set(detail_key, detail, 3600)
            url = safe_url(detail.get("original_url"))
            title = detail.get("title")
            if not url or url in seen or not isinstance(title, str) or not title.strip():
                continue
            seen.add(url)
            intro = detail.get("incipit")
            publisher = detail.get("publisher")
            items.append({
                "title": title.strip(), "url": url,
                "description": intro[:500] if isinstance(intro, str) else "",
                "source": publisher if isinstance(publisher, str) and publisher else "Unknown source",
                "published_at": detail.get("published_at"),
            })
            store_article_text(url, detail.get("body"))
            if len(items) == 5:
                break
        if articles and not items:
            raise ValueError("No usable news articles returned.")
        store_feed(f"news:{category}", items, category=category, source="FreeNewsApi.io", ranking="Latest articles by publication time")
        return {"status": "updated", "count": len(items)}
    except requests.RequestException as exc:
        if exc.response is not None and exc.response.status_code == 403:
            return {"status": "provider_error"}
        return retry_provider(self, exc)
    except (ValueError, KeyError, TypeError, AttributeError):
        logger.warning("News provider returned an invalid payload; preserving the previous feed.")
        return {"status": "invalid_payload"}
    finally:
        cache.delete(lock)
