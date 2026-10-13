from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from dashboard.session import workspace_session
from dashboard.views import QuickLinkViewSet, TaskViewSet

router = DefaultRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("links", QuickLinkViewSet, basename="link")

urlpatterns = [
    path("api/session/", workspace_session),
    path("admin/", admin.site.urls),
    path("api/", include("feeds.urls")),
    path("api/", include(router.urls)),
]
