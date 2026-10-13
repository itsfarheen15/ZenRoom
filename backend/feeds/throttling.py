"""Atomic fixed-window quotas, anchored to each user's first request."""
import threading
import time

from django.core.cache import cache, caches
from django.core.cache.backends.locmem import LocMemCache
from django.core.cache.backends.redis import RedisCache
from rest_framework.throttling import ScopedRateThrottle

# Counting and expiry must be one operation: an interrupted client must never
# leave a counter without an expiry or admit concurrent requests past the cap.
# Lua script executes atomically within Redis, eliminating race conditions under burst traffic.
WINDOW = """
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then
    return {0, redis.call('PTTL', KEYS[1])}
end
count = redis.call('INCR', KEYS[1])
-- Set TTL only on the first request to anchor the fixed window duration.
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return {1, redis.call('PTTL', KEYS[1])}
"""
_test_lock = threading.Lock()


def consume_quota(key, limit, duration):
    """
    Consumes one quota slot atomically.
    Returns (allowed: bool, remaining_seconds_until_reset: float).
    """
    backend = caches["default"]
    if isinstance(backend, RedisCache):
        # Directly evaluate Lua script against raw Redis connection.
        client = backend._cache.get_client(key, write=True)
        allowed, milliseconds = client.eval(WINDOW, 1, backend.make_key(key), limit, duration * 1000)
        return bool(allowed), max(1, milliseconds / 1000)
    if isinstance(backend, LocMemCache):
        # Thread-safe emulation exclusively for SQLite unit tests.
        with _test_lock:
            count, deadline = cache.get(key, (0, 0))
            now = time.monotonic()
            if deadline <= now:
                count, deadline = 0, now + duration
            allowed = count < limit
            if allowed:
                cache.set(key, (count + 1, deadline), max(1, deadline - now))
            return allowed, max(1, deadline - now)
    raise RuntimeError("Atomic quotas require RedisCache.")


class AtomicScopedThrottle(ScopedRateThrottle):
    """
    Scoped rate throttle backed by atomic Redis Lua execution.
    For authenticated users, cache key is derived from user.pk, preventing XFF IP spoofing.
    """
    def allow_request(self, request, view):
        self.scope = getattr(view, self.scope_attr, None)
        if not self.scope:
            return True
        limit, duration = self.parse_rate(self.get_rate())
        key = "atomic-quota:v1:" + self.get_cache_key(request, view)
        allowed, self.remaining = consume_quota(key, limit, duration)
        return allowed

    def wait(self):
        # Populates DRF's Retry-After HTTP response header on 429 status.
        return self.remaining
