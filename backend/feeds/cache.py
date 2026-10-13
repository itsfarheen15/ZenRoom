"""Dual-tier Redis feed caching: 1-hour primary freshness with 24-hour last-good fallback."""
from django.core.cache import cache
from django.utils import timezone

# Primary cache duration (1 hour) matches Celery Beat scheduled intervals.
FEED_TTL = 3600
# Resilient fallback duration (24 hours) preserves UI availability during provider outages.
STALE_TTL = 86400


def feed_key(name):
    # Isolated namespace for India topic filtering prevents contamination from older country-tag caches.
    if name == "news:india":
        return "feed:freenews:india-subject:v2"
    # Provider namespace prevents old GNews entries resurfacing after migration.
    return f"feed:freenews:v1:{name}" if name.startswith("news:") else f"feed:{name}"


def store_feed(name, items, **metadata):
    """Stores newly fetched feed data under both primary TTL and resilient last-good key."""
    payload = {"items": items, "fetched_at": timezone.now().isoformat(), **metadata}
    cache.set(feed_key(name), payload, FEED_TTL)
    cache.set(f"{feed_key(name)}:last-good", payload, STALE_TTL)
    return payload


def read_feed(name):
    """
    Reads feed from cache. If primary 1-hour key expired, returns last-good with stale=True.
    Returns None if cache is completely cold (triggers 503 Retry-After in API views).
    """
    payload = cache.get(feed_key(name))
    if payload is not None:
        return {**payload, "stale": False}
    payload = cache.get(f"{feed_key(name)}:last-good")
    if payload is not None:
        return {**payload, "stale": True}
    return None
