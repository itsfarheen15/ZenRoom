# Security policy

## Report privately

Use this repository's **Security → Report a vulnerability** flow when available. Repository maintainers must enable private vulnerability reporting in GitHub settings; this documentation does not enable it. If the option is missing, ask a maintainer for a private reporting channel without disclosing exploit details in a public issue. No response-time guarantee or dedicated security contact is established yet.

Include the affected revision, reproduction steps, impact and a minimal redacted example. Do not send live tokens, passwords, session cookies, private articles or database dumps. Maintainers assess the current default branch; there is no supported-release matrix yet.

## Credential handling

Keep root `.env` private and use your own provider accounts. `.env` variants are ignored by Git, while `.env.example` files contain placeholders. Provider keys belong in Django, never in `NEXT_PUBLIC_*` values, screenshots or issue attachments. Docker build contexts exclude environment files. Ignore rules do not remove files already tracked or secrets from Git history.

A Django API token can establish a browser session and can authenticate CLI requests. Disconnect ends the browser session; it does **not** revoke the underlying API token. If exposed, rotate the token with `docker compose exec backend python manage.py drf_create_token -r YOUR_USERNAME`, invalidate affected Django sessions server-side, and reconnect with the replacement. Replace `YOUR_USERNAME` with the real account name. Rotate exposed provider keys with their providers. Remove exposed material from public artifacts/history only after revoking it.

## Security boundaries

Browser authentication uses a seven-day HttpOnly, SameSite=Lax Django session, masked CSRF tokens and exact allowed origins. HTTPS enables Secure cookies when debug is off. Task/link queries enforce ownership; disconnect and expiry clear private UI caches. Redis feed caches are shared, and summary caches are user-scoped. Admin grants broad access to trusted staff and shares the browser session; it is not a tenant-scoped dashboard.

The article scraper checks public addresses, redirects and response bounds. Keep these protections when changing networking code. Development servers, debug output and local Compose configuration are not suitable for public deployment. See [deployment requirements](docs/DEPLOYMENT.md), review dependency advisories and run Django's deployment checks after configuring a production environment.

Logs, Playwright traces and screenshots can contain account information. Inspect and redact them before sharing. The repository does not promise a formal security audit.
