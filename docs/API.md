# API and data behavior

[Setup](../README.md) · [User guide](USER_GUIDE.md)


Browser requests use Django's database-backed session (`zen_session`, HttpOnly, SameSite=Lax, seven days). `GET /api/session/` returns the current user and masked CSRF token with no-store headers; `POST` exchanges the existing Django access token, rotates the session and CSRF token; `DELETE` logs out and invalidates the session. Both unsafe methods enforce CSRF even when unauthenticated; failed exchanges are capped at 20/minute per client IP. Browser writes send `X-CSRFToken` with `credentials: include`. Exact CORS and CSRF trusted origins permit only `http://localhost:3000`; wildcard origins are disabled. Cookies are Secure when `DJANGO_DEBUG=false` and HTTP-compatible for local development.

Private SWR caches and in-flight requests are discarded on logout, expiry or identity changes; other open tabs are notified. No long-lived credential is stored in localStorage/sessionStorage. Task/link ownership remains server-enforced. DRF TokenAuthentication remains available for CLI clients; browser sessions take precedence and require CSRF. Admin uses the same Django login session plus staff authorization, so disconnect also signs out that browser's admin session. Expired/invalid sessions prompt reconnection.

| Endpoint | Behavior |
|---|---|
| `/api/tasks/`, `/api/tasks/<id>/` | CRUD; `?group=today`, `upcoming`, `pending`; IST date boundaries |
| `/api/links/`, `/api/links/<id>/` | CRUD, HTTP(S) URLs, position ordering |
| `/api/github-trending/` | Cached repositories |
| `/api/news/tech/`, `/api/news/india/`, `/api/news/global/` | Cached English-language latest articles |
| `/api/news/?category=tech` | Category alias; defaults to tech |
| `POST /api/summarize/` | `{ "article_url": "https://…" }` → `{ "bullet_points": ["…", "…", "…"], "cached": false }` |

FreeNewsApi uses `/v1/news` with `language=en`, `order_by=recent`, `topic=technology` for tech, subject searches for India, and `topic=world` for global. `/v1/details` supplies publisher URLs, introductions and article bodies. These are latest stories, not a popularity ranking. Details and summary-source text are cached for one hour; news cache keys are provider-specific, so old GNews data cannot reappear. India uses `in_title` searches for India/Indian/Delhi/Mumbai/Bengaluru/Modi plus recent global headlines, without any publisher-country filter. Only story title/incipit evidence qualifies; country and publisher metadata never count as relevance. Results must have valid timestamps within 72 hours, are sorted newest first, and deduplicated by canonical URL and headline similarity. At most twenty candidate details are inspected. There is no documented credible popularity signal, so this is not called trending.

On 2026-10-12 the documented title search returned HTTP 500. A bounded fallback scans up to seven global pages from the same provider, filtering locally and disclosing limited coverage in the widget. Other provider errors retain the last-good feed; a successful search with no relevant matches returns a truthful empty state. Search terms and lexical matching can miss local stories, mistake ambiguous names, or miss differently worded duplicate coverage. The five newest distinct matches are selected **within the searched pool**, not guaranteed across all published news; fewer than five is valid. No LLM filtering or other provider is used. India has a new cache namespace so old country-filtered articles cannot reappear.

Only `FREENEWS_API_KEY` is read; there is no GNews/NewsData fallback. See the [provider API reference](https://www.freenewsapi.io/docs/).

Hourly Celery jobs write fresh Redis entries for 3,600 seconds and last-good copies for 24 hours. Feed GETs only read cache; empty cache returns 503, stale data is labeled. Locks suppress overlapping jobs; bounded retries handle transient provider failures.

Summaries first use server-cached FreeNewsApi article text, then fall back to the existing public-HTML scraper when text is unavailable. Gemini returns exactly three validated points. Full article bodies are never included in news API responses. SSRF safeguards validate every redirect and resolved IP, pin connections, verify TLS hostnames and disable environment proxies. Limits: 2 MB, three redirects, bounded timeouts, 24,000 text characters, 10 summary requests/user/hour; successful results cached per user/model/URL for one hour. No paywall bypass or JavaScript rendering. Quota failures return an actionable error.

