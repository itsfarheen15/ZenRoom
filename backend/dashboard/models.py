from django.conf import settings
from django.core.validators import URLValidator
from django.db import models
from django.utils import timezone


class Task(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    # Records belong to a user; owner-filtered viewsets enforce API isolation.
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    # Default uses IST local date (TIME_ZONE) rather than UTC to match the user's working day.
    scheduled_date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Break ordering ties by ID; concurrent writes can still shift page boundaries.
        ordering = ["scheduled_date", "-created_at", "id"]
        # Composite index accelerates TaskBoard queries filtering by owner, date, and status.
        indexes = [models.Index(fields=["owner", "scheduled_date", "status"])]

    def __str__(self):
        return self.title


class QuickLink(models.Model):
    # Bookmark owner used by the viewset to restrict access.
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    # Restrict scheme strictly to http/https; prevents javascript: and data: URI injection.
    url = models.URLField(max_length=2048, validators=[URLValidator(schemes=["http", "https"])])
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "title", "id"]

    def __str__(self):
        return self.title
