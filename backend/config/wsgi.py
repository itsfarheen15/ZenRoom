"""
WSGI config for Developer Zen Room backend.

Exposes the WSGI callable as a module-level variable named `application`
for production web servers such as Gunicorn or uWSGI.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()
