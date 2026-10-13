# Developer Zen Room — project memory

Updated: 2026-10-13. Read `AGENTS.md` first. This book captures observable engineering decisions and verified state, not private reasoning. Follow `docs/MAP.md` for code; `docs/HISTORY.md` for chronology; `README.md` for commands.

## Goal and user constraints
Personal, minimalist developer second-monitor dashboard: deep dark neon accents, slowly moving gradient/static grid, clock/ticker, tech/world/India news, article summaries, rising GitHub repos, Today/Upcoming/Pending tasks and custom links. User authorized Phases 2–6 together after initially requiring phase pauses. User requested larger text and Dark/Light/warm Eye Comfort themes. User wants all-free local operation, Gemini Free tier, standard React JavaScript, one-command Docker startup, useful Django Admin, compact agent memory and public reuse with each user’s own credentials.

## Current implementation
- Frontend: Next.js16.4/React19.3, JS/JSX, Tailwind4, Framer Motion, Lucide, SWR, Geist, original Canvas 2D galaxy (no graphics dependency). Three palettes and larger text preserved. Responsive CSS grid restored at user request; resize library, controls, compactor and layout persistence removed. Old `zen-desktop-layout-v1` browser entries are ignored.
- Django5.2/DRF owns GitHub, FreeNewsApi.io, scraping and Gemini; PostgreSQL records/sessions; Celery hourly jobs; Redis0 broker/1 cache. No browser provider secrets/calls.
- Browser authentication: existing Django token exchanged once for HttpOnly session cookie. Automatic bootstrap on reload, CSRF on writes, user-scoped SWR caches discarded and in-flight requests aborted on logout/expiry/identity change. Cross-tab session notifications. Theme storage holds no credentials.
- Six-service Compose: db/redis health → backend migrations → worker/Beat/frontend. Worker startup warms feeds. Persistent postgres/redis/beat volumes and loopback ports. Admin registers Task/QuickLink with owner/search/filters. Schema changes use migrations.
- Open-source handoff: setup/user/API/deployment guides, contribution/security policies, publication checklist, GitHub templates and secret-free Checks CI (hosted run pending). MIT covers original code, including the galaxy background. Old Lightfall source/CSS and OGL removed; legacy Git history still needs review. Fixture hero included.

## Contracts and invariants
- SessionAuthentication first, TokenAuthentication for CLI compatibility; IsAuthenticated and owner-scoped task/link querysets. `/api/session/`: GET user + masked CSRF, POST token exchange, DELETE logout, no-store. POST/DELETE always enforce CSRF; exchange20/min/IP. `zen_session`: HttpOnly, SameSite=Lax,7days; Secure outside DEBUG. Admin shares session with staff authorization.
- CRUD `/api/tasks/`, `/api/links/`; pagination 50. Task status pending/in_progress/completed; IST `scheduled_date`. Today includes completed; upcoming/pending exclude completed and compare future/past dates. Clock uses browser timezone.
- Feed endpoints `/api/github-trending/`, `/api/news/{tech,india,global}/`; `/api/news/?category=tech` alias. JSON `{items,fetched_at,stale,...}`. GETs read cache only. Four hourly jobs; fresh TTL 3600, last-good TTL 86400; cold cache/outage 503. Overlap locks and bounded retries.
- News: English tech=technology/global=world. India uses title searches and title/incipit relevance, never publisher/country evidence. Valid dates within72h; newest distinct matches by URL/headline similarity, max5. Eight listing calls + twenty details maximum; search5xx falls back to bounded global pages. Coverage limitations shown. India cache namespace v2 excludes old country-filtered entries. Bodies stay server-side for summaries.
- Summary POST `/api/summarize/` accepts `{article_url}`; returns exactly three `bullet_points` plus `cached`. Gemini structured Pydantic output, 35s SDK timeout, no SDK retries/paid fallback. Per-user/model/URL TTL 3600, throttle 10/hour, duplicate lock409, scrape422, unsafe URL400, quota503.
- Scraper: only public HTTP(S)/default ports; rejects credentials/private/reserved IPs, rechecks redirects, pins IP/TLS hostname, ignores environment proxies. Max2MB, three redirects, bounded timeouts, 24k text chars; no paywall bypass/JS rendering.
- Exact credentialed CORS + CSRF trusted origin localhost:3000; no wildcard. Production requires HTTPS and same-site frontend/API domains with configured hosts/origins. Compose is development-only.

## Decision index
- D01: Django-only provider access and hourly caching protect keys/quotas; frontend SWR shares feeds.
- D02: GitHub REST search of last-seven-day repositories ranked by stars approximates “rising”; exact website Trending unavailable. Public API works without token; token optional.
- D03: OpenAI replaced by Gemini SDK; NewsAPI → GNews → FreeNewsApi.io (user selected the sole current news provider). Default model `gemini-3.5-flash-lite`. FreeNewsApi advertises5,000 requests/day and2/sec, no imposed delay. Shared Redis1/sec gate; hourly list+details at most1,200/day for scheduled news before retries/manual refreshes; details cached1h. Confirm current limits before changes. Gemini Free content may improve Google's products.
- D04: Accessible native dialog plus Framer Motion; reduced-motion hydration handling and pause apply to ambient effects; empty/error states are truthful, tests alone use fixtures.
- D05: Webpack production build retained after environment-specific Turbopack restrictions; dev uses Turbopack. JavaScript migration is user-requested; no direct TS/@types dependencies. Transitive tooling may still include TS.
- D06: Docker Compose replaces multiple terminals; root `.env` addresses native hosts, Compose overrides internal db/redis hostnames. Browser API URL remains localhost, never `backend`.
- D07: Memory is a stable compact index; history and graph carry details. Update existing sections, not append-only conversational dumps.
- D08: Browser token storage replaced by server sessions at user request; exact credentialed CORS/CSRF and logout cache isolation are mandatory.
- D09: Desktop resizing rolled back by user request; original responsive CSS grid restored. Supersedes the grid-library/compactor decision.

- D10: Original code/docs MIT; unverified Lightfall replaced from scratch with MIT Canvas 2D. Latest variation uses nebulae, scattered stars, continuous falling meteors and eased parallax (8px/6px); cursor repulsion removed by request. Pause/reduced motion stops animation and pointer response; hidden tabs suspend frames. User-owned provider credentials stay outside Git/images.

## Verification
- Galaxy variation 2026-10-13: lint/build and7 mocked browser tests pass; real-session test skipped. Pixel checks cover animation, no direct cursor warp, pause, hidden-tab suspension, reduced motion and mobile resizing. Updated screenshot visually reviewed; frontend restarted. Backend/provider tests not rerun for that UI change.
- Publication fixes 2026-10-13: audit0 after scoped lint glob override; compatibility test passes on host/Node22 container; lint/build and7 mocked browser tests pass. Earlier46 backend tests/migration check pass. CI adds audit/tooling checks; hosted run pending. Receipts redact machine paths. GitHub WRITE access cannot enable private reporting (404); owner/admin required.
- Historical:35 backend integration tests; real GitHub5 repos without token; tech/India/global initially5 cached news items; provider migration and three palettes verified. See HISTORY for superseded behavior.
- Current:46 backend tests pass on Docker PostgreSQL + dedicated Redis15; mocked provider coverage includes international India stories, unrelated Indian publishers, recency/dedup, bounds and search-outage fallback. Session checks cover CSRF, invalid credentials, owner isolation, expiry and server logout invalidation.
- Rollback verified: lint/build and all7 browser tests pass (6 mocked UI cases including responsive grid/no resize controls, themes and session UI;1 real Django session integration). Frontend image rebuilt/running. Backend unchanged;46-test result above is prior verification. Dev-only braces chain subsequently removed with a scoped tinyglobby alias; audit0 and compatibility/lint/build pass.
- Live FreeNewsApi documented `in_title` returns500; bounded global fallback verified, currently1 relevant recent story with publisher/time and coverage disclosure. No padded/fake items. Live Gemini still unverified.
- Updated graph delivery9/9 and automated browser checks passed; new dark graph screenshot visually reviewed. Frontend/worker restarted with current source.

## Remaining work / setup
- Local Gemini/FreeNewsApi keys configured; GitHub token optional. Provider title-search outage limits India coverage; lexical matching can miss local stories or confuse ambiguous names/duplicates. Five newest matches are only within bounded searched coverage.
- Stack runs at localhost:3000; admin localhost:8000/admin/. Existing token can establish the new persistent session once.
- Origin is `https://github.com/itsfarheen15/ZenRoom.git`; GitHub API confirms PUBLIC/default main (2026-10-13). No push performed in this preparation. Review removed Lightfall in legacy history before publication; enable private vulnerability reporting and review legacy licensing in published history. Limited credential scan found no matches. Clean source archive excludes legacy history; published-history replacement awaits explicit approval.
- Live Gemini and production deployment remain unverified. Hero uses fictional test fixtures, not live feeds. Deployment requires Gunicorn/WhiteNoise setup, actual hosts/CORS/HTTPS, backups and persistent worker/Beat hosting.
