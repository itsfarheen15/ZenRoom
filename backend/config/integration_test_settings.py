import os

from .settings import *  # noqa: F403

# Integration test settings: uses a real Redis instance for atomic rate limiting tests.
# Redis DB 15 segregation:
# The integration suite flushes its cache between test runs. Using DB 15 ensures that
# tests never touch or clear the local development cache (DB 1) or Celery broker (DB 0).
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.environ.get("REDIS_TEST_CACHE_URL", "redis://127.0.0.1:6379/15"),
        "KEY_PREFIX": "zen-tests",
        "TIMEOUT": 3600,
    }
}
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
