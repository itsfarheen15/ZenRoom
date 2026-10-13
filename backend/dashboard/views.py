from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.viewsets import ModelViewSet

from .models import QuickLink, Task
from .serializers import QuickLinkSerializer, TaskSerializer


class TaskViewSet(ModelViewSet):
    serializer_class = TaskSerializer

    def get_queryset(self):
        # Strict owner scoping ensures users can never access or modify another tenant's tasks.
        queryset = Task.objects.filter(owner=self.request.user)
        # Apply group filtering only to list actions; detail actions (retrieve/update/delete)
        # must resolve regardless of whether date or status changes alter group membership.
        if self.action != "list":
            return queryset

        group = self.request.query_params.get("group")
        today = timezone.localdate()
        # Today includes completed tasks so the user sees all achievements for the current day.
        if group == "today":
            return queryset.filter(scheduled_date=today)
        # Upcoming and pending exclude completed items to display remaining future work and overdue backlog.
        if group == "upcoming":
            return queryset.filter(scheduled_date__gt=today).exclude(status=Task.Status.COMPLETED)
        if group == "pending":
            return queryset.filter(scheduled_date__lt=today).exclude(status=Task.Status.COMPLETED)
        if group is not None:
            raise ValidationError({"group": "Use today, upcoming, or pending."})
        return queryset

    def perform_create(self, serializer):
        # Server-side owner pinning prevents client from spoofing task ownership.
        serializer.save(owner=self.request.user)


class QuickLinkViewSet(ModelViewSet):
    serializer_class = QuickLinkSerializer

    def get_queryset(self):
        # Enforce owner-only access for personal bookmarks.
        return QuickLink.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        # Pin owner server-side.
        serializer.save(owner=self.request.user)
