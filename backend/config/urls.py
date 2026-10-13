from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from dashboard.session import workspace_session
from dashboard.views import QuickLinkViewSet, TaskViewSet

# REST router registering owner-isolated CRUD viewsets for tasks and bookmarks.
router = DefaultRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("links", QuickLinkViewSet, basename="link")

urlpatterns = [
    # Session bootstrap, token-to-session exchange, and logout with CSRF protection.
    path("api/session/", workspace_session),
    # Built-in Django admin interface for staff operators.
    path("admin/", admin.site.urls),
    # Cached news/GitHub reads and on-demand weather/summary POST endpoints.
    path("api/", include("feeds.urls")),
    # Multi-tenant user resource endpoints (/api/tasks/ and /api/links/).
    path("api/", include(router.urls)),
]
