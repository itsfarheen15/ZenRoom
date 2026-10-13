# Deployment

[Local setup](../README.md) · [Security policy](../SECURITY.md)


The supplied Compose stack runs **development servers**. For production:

- Django: install Gunicorn and WhiteNoise, add WhiteNoise middleware after SecurityMiddleware, configure `STATIC_ROOT` and static storage, run `collectstatic`, then start `gunicorn config.wsgi:application --bind 0.0.0.0:8000` from `backend`. These production dependencies/settings are not installed by this development setup. See [Django/Gunicorn](https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/gunicorn/) and [WhiteNoise](https://whitenoise.readthedocs.io/en/stable/django.html).
- Configure actual `ALLOWED_HOSTS`, exact credentialed CORS origins and CSRF trusted origins, HTTPS, secret storage, `DJANGO_DEBUG=false`, database backups and private Redis connectivity. Use frontend/API on the same site (for example app.example.com and api.example.com) for SameSite=Lax cookies; unrelated hosting domains require a same-site proxy/domain configuration. Keep Secure and HttpOnly enabled in production and schedule Django `clearsessions`. Current settings intentionally allow localhost only.
- Run a persistent Celery worker and exactly one Beat separately from web requests. Vercel frontend hosting does not run this Python worker stack.
- Next.js: deploy `frontend` to Vercel or a Node server with `npm ci`, `npm run build`, `npm start`. Set `NEXT_PUBLIC_DJANGO_API_URL` to the public HTTPS Django API **before building**. Provider keys stay with Django.

Local use requires no hosting account. No always-free hosted production stack is promised; check current provider limits before deploying.

Before release, review [third-party notices](../THIRD_PARTY_NOTICES.md), including the legacy Git-history note. Test production cookies, CSRF, logout, user isolation and database restore on your actual domains. The development Compose file is not a hardened production template.

### Weather

Allow backend HTTPS egress to `api.open-meteo.com`. Browser geolocation requires HTTPS (localhost is exempt) and user permission; do not block `geolocation` for the frontend with a Permissions-Policy header. Location POST bodies must not be recorded by request logging/APM. No new environment variables or database migrations are needed. The free endpoint supports non-commercial deployments only; review [Open-Meteo terms](https://open-meteo.com/en/terms) before public/commercial hosting. There is no automatic paid fallback. Redis is required for shared cache/rate limits.

### Browser policy and HTTPS

Next.js `src/proxy.js` generates a fresh CSP script nonce for each HTML response; the root layout renders dynamically and responses use `private, no-store`. Do not cache/reuse HTML nonces at a CDN or statically export this application. Script policy uses nonce + strict-dynamic; only development permits unsafe-eval. Inline styles remain permitted for Framer Motion and CSS particle positions. Provider connections remain blocked from the browser: connect-src permits self and the configured Django API origin (plus same-origin development WebSocket). Rebuild when changing `NEXT_PUBLIC_DJANGO_API_URL`.

Terminate TLS at a trusted reverse proxy, redirect HTTP to HTTPS, and configure HSTS after HTTPS works on the intended domains. Start with a short HSTS duration, then increase it; enable includeSubDomains/preload only after verifying all subdomains. Forward trusted scheme/client-IP headers only from that proxy, prevent direct public access to the application server, and test cookies/CSRF on real domains. Development Compose intentionally does not redirect localhost HTTP or set HSTS. CSP is defense-in-depth, not a replacement for safe rendering.
