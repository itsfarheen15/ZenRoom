from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.viewsets import ModelViewSet

from .models import QuickLink, Task
from .serializers import QuickLinkSerializer, TaskSerializer


class TaskViewSet(ModelViewSet):
    serializer_class = TaskSerializer

    def get_queryset(self):
        queryset = Task.objects.filter(owner=self.request.user)
        if self.action != "list":
            return queryset

        group = self.request.query_params.get("group")
        today = timezone.localdate()
        if group == "today":
            return queryset.filter(scheduled_date=today)
        if group == "upcoming":
            return queryset.filter(scheduled_date__gt=today).exclude(status=Task.Status.COMPLETED)
        if group == "pending":
            return queryset.filter(scheduled_date__lt=today).exclude(status=Task.Status.COMPLETED)
        if group is not None:
            raise ValidationError({"group": "Use today, upcoming, or pending."})
        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class QuickLinkViewSet(ModelViewSet):
    serializer_class = QuickLinkSerializer

    def get_queryset(self):
        return QuickLink.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
