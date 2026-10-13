from django.core.cache import cache
from django.utils import timezone

FEED_TTL = 3600
STALE_TTL = 86400


def feed_key(name):
    if name == "news:india":
        return "feed:freenews:india-subject:v2"
    # Provider namespace prevents old GNews entries resurfacing after migration.
    return f"feed:freenews:v1:{name}" if name.startswith("news:") else f"feed:{name}"


def store_feed(name, items, **metadata):
    payload = {"items": items, "fetched_at": timezone.now().isoformat(), **metadata}
    cache.set(feed_key(name), payload, FEED_TTL)
    cache.set(f"{feed_key(name)}:last-good", payload, STALE_TTL)
    return payload


def read_feed(name):
    payload = cache.get(feed_key(name))
    if payload is not None:
        return {**payload, "stale": False}
    payload = cache.get(f"{feed_key(name)}:last-good")
    if payload is not None:
        return {**payload, "stale": True}
    return None
