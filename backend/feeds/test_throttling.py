"""
Concurrency and integration tests for atomic Redis quota gating and throttling.

Covers:
- Thread-safe admission under high concurrency (80 simultaneous threads, exactly limit admitted).
- TTL expiry and quota replenishment.
- User-scoped keying preventing X-Forwarded-For IP spoofing bypass.
- Graceful HTTP 503 response on Redis cache outage.
"""

from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4
import time

from redis.exceptions import ConnectionError as RedisConnectionError

from django.core.cache import cache
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from .throttling import consume_quota
from .weather import WeatherView
from .views import SummarizeView


class AtomicQuotaTests(SimpleTestCase):

    def test_concurrent_admission_and_expiry(self):
        key = "quota-test:" + uuid4().hex
        try:
            with ThreadPoolExecutor(max_workers=16) as pool:
                results = list(pool.map(lambda _: consume_quota(key, 10, 60)[0], range(80)))
            self.assertEqual(sum(results), 10)
            self.assertGreater(consume_quota(key, 10, 60)[1], 0)
            cache.delete(key)  # Expired windows admit a new request.
            self.assertTrue(consume_quota(key, 10, 60)[0])
        finally:
            cache.delete(key)

    def test_window_expires(self):
        key = "quota-test:" + uuid4().hex
        try:
            self.assertTrue(consume_quota(key, 1, 1)[0])
            self.assertFalse(consume_quota(key, 1, 1)[0])
            time.sleep(1.1)
            self.assertTrue(consume_quota(key, 1, 1)[0])
        finally:
            cache.delete(key)

    @patch("feeds.throttling.consume_quota", side_effect=RedisConnectionError)
    @patch("feeds.weather.current_weather")
    def test_cache_outage_fails_closed(self, weather, quota):
        req = APIRequestFactory().post("/api/weather/", {"latitude": 0, "longitude": 0})
        force_authenticate(req, user=SimpleNamespace(pk="outage", is_authenticated=True))
        self.assertEqual(WeatherView.as_view()(req).status_code, 503)
        weather.assert_not_called()

    @patch("feeds.weather.current_weather", return_value={"stale": False})
    def test_user_isolation_and_forwarded_headers(self, weather):
        factory = APIRequestFactory()
        for view, scope, limit, body in [
            (WeatherView, "weather", 30, {"latitude": 0, "longitude": 0}),
            (SummarizeView, "summarize", 10, {"article_url": "https://example.com/a"}),
        ]:
            user_id = uuid4().hex
            key = f"atomic-quota:v1:throttle_{scope}_{user_id}"
            other_key = f"atomic-quota:v1:throttle_{scope}_{user_id}-other"
            try:
                with patch("feeds.views.settings.GEMINI_API_KEY", ""):
                    for index in range(limit + 1):
                        req = factory.post("/api/", body, format="json", HTTP_X_FORWARDED_FOR=f"192.0.2.{index}")
                        force_authenticate(req, user=SimpleNamespace(pk=user_id, is_authenticated=True))
                        response = view.as_view()(req)
                        self.assertEqual(response.status_code == 429, index == limit)
                    self.assertGreater(int(response.headers["Retry-After"]), 0)
                    req = factory.post("/api/", body, format="json")
                    force_authenticate(req, user=SimpleNamespace(pk=user_id + "-other", is_authenticated=True))
                    self.assertNotEqual(view.as_view()(req).status_code, 429)
            finally:
                cache.delete_many([key, other_key])
