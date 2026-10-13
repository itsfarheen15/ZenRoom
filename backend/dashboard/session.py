"""Workspace token exchange; credentials never need browser storage."""
import json

from django.conf import settings
from django.contrib.auth import login, logout
from django.core.cache import cache
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods
from rest_framework.authentication import SessionAuthentication
from rest_framework.authtoken.models import Token


class WorkspaceSessionAuthentication(SessionAuthentication):
    def authenticate_header(self, request):
        return "Session"


def session_payload(request):
    return {"user": {"id": request.user.pk, "username": request.user.get_username()}
            if request.user.is_authenticated else None, "csrf_token": get_token(request),
            "expired": not request.user.is_authenticated and settings.SESSION_COOKIE_NAME in request.COOKIES}


@never_cache
@csrf_protect
@require_http_methods(["GET", "POST", "DELETE"])
def workspace_session(request):
    if request.method == "POST":
        key = "session-exchange:" + request.META.get("REMOTE_ADDR", "unknown")
        if cache.add(key, 1, timeout=60):
            attempts = 1
        else:
            try:
                attempts = cache.incr(key)
            except ValueError:
                return JsonResponse({"detail": "Please retry connecting."}, status=429)
        if attempts > 20:
            return JsonResponse({"detail": "Too many connection attempts. Try again in a minute."}, status=429)
        try:
            payload = json.loads(request.body)
            value = payload.get("token", "") if isinstance(payload, dict) else ""
        except (ValueError, UnicodeDecodeError):
            value = ""
        token = Token.objects.select_related("user").filter(key=value).first() if isinstance(value, str) and len(value) == 40 else None
        if token is None or not token.user.is_active:
            return JsonResponse({"detail": "Invalid workspace token. Please reconnect."}, status=401)
        login(request, token.user, backend="django.contrib.auth.backends.ModelBackend")
    elif request.method == "DELETE":
        logout(request)
    return JsonResponse(session_payload(request))
