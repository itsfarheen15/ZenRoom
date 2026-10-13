# Deployment

[Local setup](../README.md) · [Security policy](../SECURITY.md)


The supplied Compose stack runs **development servers**. For production:

- Django: install Gunicorn and WhiteNoise, add WhiteNoise middleware after SecurityMiddleware, configure `STATIC_ROOT` and static storage, run `collectstatic`, then start `gunicorn config.wsgi:application --bind 0.0.0.0:8000` from `backend`. These production dependencies/settings are not installed by this development setup. See [Django/Gunicorn](https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/gunicorn/) and [WhiteNoise](https://whitenoise.readthedocs.io/en/stable/django.html).
- Configure actual `ALLOWED_HOSTS`, exact credentialed CORS origins and CSRF trusted origins, HTTPS, secret storage, `DJANGO_DEBUG=false`, database backups and private Redis connectivity. Use frontend/API on the same site (for example app.example.com and api.example.com) for SameSite=Lax cookies; unrelated hosting domains require a same-site proxy/domain configuration. Keep Secure and HttpOnly enabled in production and schedule Django `clearsessions`. Current settings intentionally allow localhost only.
- Run a persistent Celery worker and exactly one Beat separately from web requests. Vercel frontend hosting does not run this Python worker stack.
- Next.js: deploy `frontend` to Vercel or a Node server with `npm ci`, `npm run build`, `npm start`. Set `NEXT_PUBLIC_DJANGO_API_URL` to the public HTTPS Django API **before building**. Provider keys stay with Django.

Local use requires no hosting account. No always-free hosted production stack is promised; check current provider limits before deploying.

Before release, review [third-party notices](../THIRD_PARTY_NOTICES.md), including the legacy Git-history note. Test production cookies, CSRF, logout, user isolation and database restore on your actual domains. The development Compose file is not a hardened production template.
