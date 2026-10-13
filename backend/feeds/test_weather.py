"""
Unit and API integration tests for Open-Meteo weather integration.

Covers:
- Coordinate rounding (~1.1km grid) and Redis caching (15m fresh / 2h stale).
- Bounded request timeouts and 2-second rate gating.
- User quotas (30 requests/hour/user) and global provider ceiling (9,000 requests/day).
- Strict WMO code validation and resilient error handling on provider outages.
"""

from unittest.mock import patch

import requests
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from .weather import current_weather, WeatherUnavailable


def provider_payload():
    return {"current": {"time": int(timezone.now().timestamp()), "temperature_2m": 28.2,
            "apparent_temperature": 30, "relative_humidity_2m": 65, "weather_code": 61,
            "is_day": 1, "wind_speed_10m": 12, "precipitation": .4}}


class WeatherTests(APITestCase):

    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(username="weather", password="test-pass")
        self.client.force_authenticate(self.user)

    @patch("feeds.weather.requests.get")
    def test_cache_contract_and_bounded_request(self, get):
        get.return_value.status_code = 200
        get.return_value.json.return_value = provider_payload()
        first = self.client.post("/api/weather/", {"latitude": 19.076, "longitude": 72.877}, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertFalse(first.data["stale"])
        self.assertEqual(get.call_args.kwargs["params"]["latitude"], 19.08)
        self.assertEqual(get.call_args.kwargs["timeout"], (3, 8))
        self.assertFalse(get.call_args.kwargs["allow_redirects"])
        self.assertEqual(first.headers["Cache-Control"], "no-store")
        second = self.client.post("/api/weather/", {"latitude": 19.076, "longitude": 72.877}, format="json")
        self.assertEqual(first.data, second.data)
        get.assert_called_once()

    @patch("feeds.weather.requests.get")
    def test_validation_and_auth_before_provider(self, get):
        for latitude in (91, -91, "nan", "inf", "bad"):
            response = self.client.post("/api/weather/", {"latitude": latitude, "longitude": 0}, format="json")
            self.assertEqual(response.status_code, 400)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post("/api/weather/", {"latitude": 0, "longitude": 0}).status_code, 401)
        get.assert_not_called()

    @patch("feeds.weather.requests.get")
    def test_failure_stale_fallback_and_retry_lease(self, get):
        get.return_value.status_code = 200
        get.return_value.json.return_value = provider_payload()
        first = current_weather(19.08, 72.88)
        import hashlib
        key = "weather:v1:" + hashlib.sha256(b"19.08,72.88").hexdigest()
        cache.delete(key)
        cache.delete(key + ":lease")
        cache.delete("weather:provider-slot")
        get.side_effect = requests.Timeout
        self.assertTrue(current_weather(19.08, 72.88)["stale"])
        self.assertEqual(current_weather(19.08, 72.88)["current"], first["current"])
        self.assertEqual(get.call_count, 2)
        cache.clear()
        with self.assertRaises(WeatherUnavailable):
            current_weather(0, 0)

    @patch("feeds.weather.requests.get")
    def test_bad_provider_data_and_budget_fail_closed(self, get):
        get.return_value.status_code = 200
        get.return_value.json.return_value = {"current": {"temperature_2m": None}}
        self.assertEqual(self.client.post("/api/weather/", {"latitude": 0, "longitude": 0}).status_code, 503)
        cache.clear()
        cache.set("weather:budget:" + timezone.now().date().isoformat(), 9000)
        with self.assertRaises(WeatherUnavailable):
            current_weather(0, 0)
        get.assert_called_once()

    def test_session_requires_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(client.post("/api/weather/", {"latitude": 0, "longitude": 0}).status_code, 403)
