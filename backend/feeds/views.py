import hashlib

from django.conf import settings
from django.core.cache import cache
from google.genai.errors import APIError
from httpx import HTTPError
from pydantic import ValidationError as SchemaValidationError
from redis.exceptions import RedisError
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .cache import read_feed
from .freenews import article_text_key
from .summarizer import ArticleError, SummaryUnavailable, UnsafeArticleURL, scrape_article, summarize_text


class CacheAPIView(APIView):
    def handle_exception(self, exc):
        if isinstance(exc, RedisError):
            return Response({"detail": "The cache is temporarily unavailable. Please try again."}, status=503)
        return super().handle_exception(exc)


class GitHubTrendingView(CacheAPIView):
    def get(self, request):
        payload = read_feed("github")
        if payload is None:
            return Response({"detail": "Repository data is warming up. The background worker will refresh it."}, status=503, headers={"Retry-After": "60"})
        return Response(payload)


class NewsView(CacheAPIView):
    def get(self, request, category=None):
        category = category or request.query_params.get("category", "tech")
        if category not in ("tech", "india", "global"):
            return Response({"detail": "Choose tech, india, or global."}, status=400)
        payload = read_feed(f"news:{category}")
        if payload is None:
            return Response({"detail": "News is not available yet. Check FREENEWS_API_KEY and the background worker."}, status=503, headers={"Retry-After": "60"})
        return Response(payload)


class SummaryInputSerializer(serializers.Serializer):
    article_url = serializers.URLField(max_length=2048)


class SummarizeView(CacheAPIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "summarize"

    def post(self, request):
        serializer = SummaryInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        url = serializer.validated_data["article_url"]
        key = "summary:" + hashlib.sha256(f"{request.user.pk}:{settings.GEMINI_MODEL}:{url}".encode()).hexdigest()
        previous = cache.get(key)
        if previous is not None:
            return Response({"bullet_points": previous, "cached": True})
        if not settings.GEMINI_API_KEY:
            return Response({"detail": "Article summaries have not been configured yet."}, status=503)
        if not cache.add(f"{key}:lock", True, 120):
            return Response({"detail": "This article is already being summarized. Please try again shortly."}, status=409, headers={"Retry-After": "5"})
        try:
            text = cache.get(article_text_key(url)) or scrape_article(url)
            points = summarize_text(text)
            cache.set(key, points, 3600)
            return Response({"bullet_points": points, "cached": False})
        except UnsafeArticleURL as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except ArticleError as exc:
            return Response({"detail": str(exc)}, status=422)
        except SummaryUnavailable as exc:
            return Response({"detail": str(exc)}, status=503)
        except (APIError, HTTPError, SchemaValidationError):
            return Response({"detail": "The summary provider is temporarily unavailable. Please try again."}, status=502)
        finally:
            cache.delete(f"{key}:lock")
