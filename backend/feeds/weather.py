"""On-demand weather for opt-in, approximate locations; no location registry."""
import hashlib
import math
from datetime import datetime, timezone as dt_timezone

import requests
from django.core.cache import cache
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from .throttling import AtomicScopedThrottle

from .views import CacheAPIView

FIELDS = ("temperature_2m", "apparent_temperature", "relative_humidity_2m",
          "weather_code", "is_day", "wind_speed_10m", "precipitation")


class LocationInput(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)

    def validate(self, attrs):
        if not all(math.isfinite(value) for value in attrs.values()):
            raise serializers.ValidationError("Coordinates must be finite numbers.")
        # Round coordinates to 2 decimal places (~1.1 km precision) to maximize Redis cache
        # hits across nearby users and protect exact user location privacy.
        return {name: round(value, 2) for name, value in attrs.items()}


class WeatherUnavailable(Exception):
    pass


def current_weather(latitude, longitude):
    """
    Retrieves current model-based weather for approximate coordinates from Open-Meteo.
    Uses 15-minute primary caching with 2-hour fallback, protected by multi-tier rate limiting.
    """
    key = "weather:v1:" + hashlib.sha256(f"{latitude:.2f},{longitude:.2f}".encode()).hexdigest()
    fresh = cache.get(key)
    if fresh:
        return {**fresh, "stale": False}
    previous = cache.get(key + ":last-good")

    def unavailable():
        if previous:
            return {**previous, "stale": True}
        raise WeatherUnavailable

    # Short 30s lease lock prevents thundering-herd stampedes on identical coordinates.
    # Retain this lease even on failure to avoid retry storms against Open-Meteo.
    if not cache.add(key + ":lease", True, 30):
        return unavailable()
    # Shared 2s rate gate spaces requests across worker processes.
    if not cache.add("weather:provider-slot", True, 2):
        return unavailable()
    # Daily deployment budget ceiling (9,000/day) stays comfortably below Open-Meteo's 10k free limit.
    day_key = "weather:budget:" + timezone.now().date().isoformat()
    cache.add(day_key, 0, 172800)
    if cache.incr(day_key) > 9000:
        return unavailable()
    try:
        response = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": latitude, "longitude": longitude,
                    "current": ",".join(FIELDS), "timeformat": "unixtime",
                    "timezone": "auto", "forecast_days": 1,
                    "temperature_unit": "celsius", "wind_speed_unit": "kmh"},
            timeout=(3, 8), allow_redirects=False,
        )
        response.raise_for_status()
        if response.status_code != 200:
            raise ValueError("Unexpected weather response")
        data = response.json()["current"]
        values = {field: data[field] for field in FIELDS}
        # Verify all expected meteorological fields exist and are finite numbers (not booleans).
        if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in values.values()):
            raise ValueError("Incomplete weather")
        observed = datetime.fromtimestamp(data["time"], dt_timezone.utc)
        age = (timezone.now() - observed).total_seconds()
        # Reject data if observation timestamp is older than 2 hours or more than 15 minutes in the future.
        if not -900 <= age <= 7200:
            raise ValueError("Outdated weather")
        payload = {"current": values, "observed_at": observed.isoformat(),
                   "fetched_at": timezone.now().isoformat(), "source": "Open-Meteo"}
        cache.set(key, payload, 900)
        cache.set(key + ":last-good", payload, 7200)
        return {**payload, "stale": False}
    except (requests.RequestException, ValueError, KeyError, TypeError, OverflowError):
        return unavailable()


class WeatherView(CacheAPIView):
    """
    On-demand weather endpoint.
    - Rate limited to 30/hour/user via AtomicScopedThrottle.
    - Disables HTTP caching (no-store) so client responses reflect real-time Redis cache state.
    """
    throttle_classes = [AtomicScopedThrottle]
    throttle_scope = "weather"

    def post(self, request):
        serializer = LocationInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return Response(current_weather(**serializer.validated_data), headers={"Cache-Control": "no-store"})
        except WeatherUnavailable:
            return Response({"detail": "Weather is temporarily unavailable. Try again in a minute."},
                            status=503, headers={"Retry-After": "60", "Cache-Control": "no-store"})
