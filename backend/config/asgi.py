"""
ASGI config for Developer Zen Room backend.

Exposes the ASGI callable as a module-level variable named `application`
for ASGI servers such as Uvicorn or Daphne.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_asgi_application()
