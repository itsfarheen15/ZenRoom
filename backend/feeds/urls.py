from django.urls import path

from .views import GitHubTrendingView, NewsView, SummarizeView

urlpatterns = [
    path("github-trending/", GitHubTrendingView.as_view(), name="github-trending"),
    path("news/", NewsView.as_view(), name="news"),
    path("news/<str:category>/", NewsView.as_view(), name="news-category"),
    path("summarize/", SummarizeView.as_view(), name="summarize"),
]
