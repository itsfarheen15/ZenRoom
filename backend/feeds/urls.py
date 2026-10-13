from django.urls import path

from .views import GitHubTrendingView, NewsView, SummarizeView
from .weather import WeatherView

urlpatterns = [
    # On-demand WMO weather via Open-Meteo with 15-minute grid caching and rate limits.
    path("weather/", WeatherView.as_view(), name="weather"),
    # Hourly-cached GitHub trending repository list (past 7-day stars approximation).
    path("github-trending/", GitHubTrendingView.as_view(), name="github-trending"),
    # Read-only cached news digest (query param or path-based category routing).
    path("news/", NewsView.as_view(), name="news"),
    path("news/<str:category>/", NewsView.as_view(), name="news-category"),
    # Gemini AI article summarization with strict SSRF protection and quota gating.
    path("summarize/", SummarizeView.as_view(), name="summarize"),
]
