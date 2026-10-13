from django.core.validators import URLValidator
from rest_framework import serializers

from .models import QuickLink, Task


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ["id", "title", "description", "status", "scheduled_date", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class QuickLinkSerializer(serializers.ModelSerializer):
    url = serializers.URLField(
        max_length=2048, validators=[URLValidator(schemes=["http", "https"])]
    )

    class Meta:
        model = QuickLink
        fields = ["id", "title", "url", "position", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
