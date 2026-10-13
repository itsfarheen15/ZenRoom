from .settings import *  # noqa: F403

# Unit test configuration: fast in-memory execution.
# Normal local and staging development always uses PostgreSQL.
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}

# Accelerates test authentication runs by using MD5 rather than PBKDF2/Argon2.
# Invariant: Strictly prohibited in production settings.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# In-memory cache isolated to the test runner process.
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# Execute Celery tasks synchronously in-process without requiring a running worker daemon.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
