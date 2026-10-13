from django.core.management.base import BaseCommand

from feeds.tasks import fetch_github_trending, fetch_news


class Command(BaseCommand):
    help = "Queue the four feed refreshes without waiting for the hourly Beat schedule."

    def handle(self, *args, **options):
        fetch_github_trending.delay()
        for category in ("tech", "india", "global"):
            fetch_news.delay(category)
        self.stdout.write(self.style.SUCCESS("Queued GitHub, tech, India, and global feed refreshes."))
