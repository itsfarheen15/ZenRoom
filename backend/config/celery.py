"""Celery configuration for background feed harvesting and scheduled jobs."""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
app = Celery("zen_room")
# Reads settings with CELERY_ prefix from Django settings.
app.config_from_object("django.conf:settings", namespace="CELERY")
# Auto-discovers task definitions in installed apps (e.g. feeds/tasks.py).
app.autodiscover_tasks()
