from django.core.validators import URLValidator
from rest_framework import serializers

from .models import QuickLink, Task


class TaskSerializer(serializers.ModelSerializer):
    """
    Serializes Task objects for workspace board operations.

    Owner isolation invariant:
    `owner` is intentionally excluded from `fields` to prevent clients from
    spoofing task ownership during creation or updates. The active user is
    pinned server-side in `TaskViewSet.perform_create`.
    """

    class Meta:
        model = Task
        fields = ["id", "title", "description", "status", "scheduled_date", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class QuickLinkSerializer(serializers.ModelSerializer):
    """
    Serializes QuickLink bookmarks.

    Security constraint:
    `url` explicitly validates schemes to allow only 'http' and 'https',
    rejecting dangerous pseudo-schemes like 'javascript:', 'data:', or 'file:'
    that could lead to stored cross-site scripting when rendered in the browser.
    """

    url = serializers.URLField(
        max_length=2048, validators=[URLValidator(schemes=["http", "https"])]
    )

    class Meta:
        model = QuickLink
        fields = ["id", "title", "url", "position", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
