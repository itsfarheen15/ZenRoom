from django.contrib import admin

from .models import QuickLink, Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "scheduled_date", "owner")
    list_filter = ("status", "scheduled_date")
    search_fields = ("title", "description", "owner__username")
    list_select_related = ("owner",)
    autocomplete_fields = ("owner",)
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "scheduled_date"


@admin.register(QuickLink)
class QuickLinkAdmin(admin.ModelAdmin):
    list_display = ("title", "url", "position", "owner")
    search_fields = ("title", "url", "owner__username")
    list_select_related = ("owner",)
    autocomplete_fields = ("owner",)
    readonly_fields = ("created_at", "updated_at")
