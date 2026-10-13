import os

from .settings import *  # noqa: F403

# Use a dedicated Redis database: the test suite clears its cache.
CACHES = {"default": {
    "BACKEND": "django.core.cache.backends.redis.RedisCache",
    "LOCATION": os.environ.get("REDIS_TEST_CACHE_URL", "redis://127.0.0.1:6379/15"),
    "KEY_PREFIX": "zen-tests",
    "TIMEOUT": 3600,
}}
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
