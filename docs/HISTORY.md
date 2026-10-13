# Engineering history

Only observable decisions are recorded; earlier conversation details not evidenced by code are not reconstructed.

## 2026-10-11 — foundation and full dashboard
- **Request:** Django/DRF foundation, then explicitly authorized Phases2–6.
- **Change:** Owner-scoped CRUD, PostgreSQL, Redis/Celery hourly feeds, protected article scraper, structured summaries, Next dashboard and interactions.
- **Rationale:** Centralize external calls/secrets, avoid rate exhaustion, keep second-monitor UI calm and accessible. Use recent-repository star ranking because REST has no exact Trending endpoint.
- **Evidence:** 27 tests including native PostgreSQL/Redis, live GitHub worker/TTL and scraper checks; frontend lint/build and four mocked browser tests.
- **Remaining:** Provider keys and production deployment absent.

## 2026-10-11 — free providers
- **Request:** All-free services, Gemini Free tier.
- **Change:** OpenAI → google-genai; NewsAPI → GNews; env, tests and docs updated.
- **Rationale:** Free personal/non-commercial news use; accept 12h delay/100 daily request limit. Summary schema still exactly3 points; quota failures actionable.
- **Evidence:** 28 backend tests; dependency consistency check. Official provider docs checked.
- **Remaining:** Live GNews/Gemini calls require user keys. Free quotas are not unlimited.

## 2026-10-11 — developer experience and durable context
- **Request:** Admin registration; TS→JS; full-stack Compose; README environment/deployment guide; memory/rules/connected graph.
- **Change:** Custom model admins; source/tests/config converted via TS compiler's syntax removal; direct TS dependencies removed; six-service development Compose and Dockerfiles; root agent rulebook, memory, history and source/architecture maps.
- **Rationale:** Match explicit JavaScript preference, preserve existing behavior including discovered Lightfall, make startup reproducible and handoffs compact. Admin manages records, migrations manage schema.
- **Evidence:** JS lint/build and all4 browser tests pass. Six Docker services running; 28 integration tests on container PostgreSQL/Redis pass; frontend/admin HTTP200; live GitHub cache5 fresh repos. Archify9/9 checks plus automated browser evidence pass; dark desktop image visually reviewed. Colima started; missing Compose/Buildx plugins installed and registered. Local `.env` generated without provider keys.
- **Remaining:** Keys, admin account/token, repository destination and deployment choices remain user-owned setup.

## 2026-10-11 — FreeNewsApi.io as sole news provider
- **Request:** Replace GNews; use only FreeNewsApi.io for news.
- **Change:** Latest-news listing plus UUID details; English tech/India/world filters; shared Redis1/sec gate, detail caching, cache namespace isolation, cached article text for Gemini. Env uses FREENEWS_API_KEY; no old-provider fallback.
- **Rationale:** Listing omits original URL, so details are necessary. Full bodies stay server-side. ~432 requests/day normally, up to792 candidate lookups before retries, under advertised5,000/day. Coverage and live response quality still need a real key.
- **Evidence:**35 backend tests pass on local-memory/SQLite and container PostgreSQL/Redis. Six services running after Python rebuild. Graph9/9 checks and automated browser evidence pass; dark screenshot reviewed.
- **Remaining:** FREENEWS_API_KEY is blank; Gemini key exists. Live authenticated news and Gemini verification not performed.

## 2026-10-11 — reload saved news credential
- **Request:** News widget unavailable after user setup.
- **Change:** Recreated Python services to load the updated root environment; no code change.
- **Rationale:** Local FreeNewsApi key was configured, running worker's value was empty.
- **Evidence:** All three real provider jobs succeeded; tech/India/global each have5 non-stale cached articles. Keys were not displayed.
- **Remaining:** Live Gemini summary verification; user can click widget Retry without losing tab authentication.

## 2026-10-12 — readable text and three palettes
- **Request:** Larger text, Light theme and warm Eye Comfort theme.
- **Change:** Main text15–18px, labels at least12px; shared palette tokens, header selector and locally saved preference. Dark retains Lightfall; lighter palettes retain gradients. Updated memory, rulebook, map and appearance guide.
- **Rationale:** Improve reading and contrast across widgets, controls and dialogs while preserving workspace authentication and reduced-motion behavior.
- **Evidence:** ESLint and production build pass; all5 mocked-API browser tests pass, including automated WCAG AA checks for every palette/dialog, theme persistence and mobile overflow. Desktop screenshots reviewed. Early checks caught a dark background variable and low-contrast controls, both corrected; modal checks now await entrance/exit animations.
- **Remaining:** Live Gemini verification and existing deployment/setup work unchanged.

## 2026-10-12 — India relevance, desktop layout and persistent sessions
- **Request:** India stories by subject, desktop-only resizable/reflowing cards, secure refresh persistence.
- **Change:** FreeNewsApi title searches with bounded text relevance, 72-hour recency, URL/headline dedupe, publisher/time display and isolated India cache. Provider search5xx falls back to a bounded global scan with visible coverage disclosure. React Grid Layout handles all edge/corner resizing above1150px; first-fit compaction, local validated layout/reset, keyboard sizes and internal scrolling. Django token exchange establishes a7-day HttpOnly session, CSRF-protected writes, exact credentialed CORS, bootstrap/expiry state and private cache isolation.
- **Rationale:** Country metadata does not establish subject location. No documented popularity signal, so ranking is recency within searched coverage. A maintained grid dependency provides constraints/collision handling; small dense compactor fills holes for five cards. Existing user tokens remain usable once without storing credentials in browser storage; CLI token auth remains supported.
- **Evidence:**46 backend tests pass on Docker PostgreSQL/Redis15, including mocked provider outage/relevance/dedup and session CSRF/ownership/logout. Real Chrome→Django session test passed refresh, HttpOnly, missing-CSRF rejection, logout, expiry and two-user isolation. All8 browser tests passed, including7 mocked-API UI cases (edge/corner resize, dense-gap assertions, keyboard/persistence/mobile and all3 palette accessibility) and1 real session integration. Desktop/warm screenshots reviewed; corrected inherited handle rotations to keep hit areas on edges, then2 affected browser checks and rebuild passed. Production build/lint and production dependency audit pass. Graph regenerated9/9, automated browser passed and dark screenshot reviewed. Live title searches returned500; fallback cached1 genuinely India-related recent article. Earlier Redis test hostname and transition timing failures were corrected, not bypassed.
- **Remaining:** Search outage narrows live India coverage; fewer than5 matches is truthful. Lexical relevance/dedupe is approximate. Dense packing is greedy, with gaps where dimensions cannot fit. Same-site HTTPS domains/origin configuration needed for deployment; live Gemini remains unverified. Hero placeholder and GitHub publication remain user-owned setup.

## 2026-10-12 — desktop resizing rollback
- **Request:** Roll back desktop resizing only.
- **Change:** Restored responsive CSS grid and natural card heights; removed resize controls, layout storage/compaction modules, library/CSS and resize-specific tests. Kept India filtering, sessions and appearance features. Old saved layout entries are ignored.
- **Rationale:** Follow the user's revised layout preference without reverting unrelated work.
- **Evidence:** Lint, production build and all7 browser tests pass (6 mocked UI +1 real Django session). Frontend container rebuilt/running. Graph9/9 and automated browser checks pass; map and rulebook updated.
- **Remaining:** Existing news-provider search limitation and deployment/Gemini setup remain unchanged.

## 2026-10-13 — public reuse documentation and license scope
- **Request:** Update documents for open-source reuse with each user's own credentials.
- **Change:** Reworked README setup; added user/API/deployment guides, contribution/security/publication policies, original-code MIT license, third-party notices, issue/PR templates and a fixture-labeled hero. Expanded env/backup ignores; updated rulebook/memory/map and frontend guide. Corrected remote to itsfarheen15/ZenRoom; no push.
- **Rationale:** Separate account setup from provider credentials; document session persistence, operational limits and safe updates. User has no Lightfall source/license; current React Bits upstream adds Commons Clause, so original-code MIT explicitly excludes the unresolved component. Preserve the existing UI pending provenance or replacement.
- **Evidence:** Local Markdown links, all example-env variables, ignore exceptions, shell syntax and temp-directory env generation/refusal to overwrite passed. Compose config and token-reset help verified against Docker. Limited tracked-working-file credential-pattern scan found no matches; no private env tracked. Existing screenshot visually inspected. App/test code untouched this handoff; runtime suites not rerun.
- **Remaining:** Resolve/replace Lightfall before unrestricted open-source release; full Git-history/dependency-license audit, clean-clone onboarding, public repository access and private vulnerability reporting remain unverified. Live Gemini/production checks remain outstanding. Runtime graph topology unchanged.

## 2026-10-13 — original MIT light tunnel
- **Request:** Write the falling tunnel/cursor-bending effect from scratch without looking at or copying React Bits; grant MIT.
- **Change:** Added original `light-tunnel.jsx` with SPDX/copyright header, Canvas 2D projected trails, pointer repulsion, bounded DPR/30fps, mobile density, hidden-tab suspension and cleanup. Preserved pause/reduced motion and Dark-only integration. Deleted old Lightfall source/CSS without inspecting them for this implementation; removed OGL and synchronized the lockfile. Updated notices, rules, memory, source map, guides and fixture hero.
- **Rationale:** Own the implementation with no graphics dependency or inherited component-license ambiguity. No React Bits source was opened or copied during this replacement. Earlier turns had inspected a brief legacy header; it was not used as the implementation basis.
- **Evidence:** Lint and production build passed. Seven mocked Chrome UI tests passed; one real Django session test skipped. New pixel tests cover time progression, pointer deformation at fixed phase, pause, simulated hidden visibility, reduced motion, theme remount and mobile sizing. Initial run caught stale served code; frontend rebuilt/restarted. Visual review corrected correlated trail phases and confirmed the final screenshot. Documentation links and diff whitespace pass.
- **Remaining:** Earlier Git history can still contain the removed unverified source; no history rewrite/push. Docker npm ci reports5 high dependency advisories (no forced upgrades); live provider/backend tests not rerun for this UI change. Runtime graph services/edges unchanged.

## 2026-10-13 — calmer galaxy variation
- **Request:** Replace the unpleasant cursor distortion with a beautiful galaxy feel and continuous falling stars.
- **Change:** Replaced tunnel geometry/repulsion with 260 scattered stars (130 mobile), cached violet/teal nebula glows, slow shimmer and9 staggered straight meteors (5 mobile). Pointer input drives eased parallax capped at8px horizontal/6px vertical, without distorting trails. Preserved the original MIT grant, pause/reduced motion, hidden-tab suspension and the existing integration/export. Updated guides/memory and fixture hero.
- **Rationale:** Keep motion continuous and atmospheric without pulling shapes around the cursor. Cached nebula rendering and existing30fps/DPR caps bound work; no dependency added.
- **Evidence:** Lint/build,7 mocked Chrome tests and screenshot review passed. Tests check no immediate pointer warp, animation, pause/reduced motion, hidden visibility, themes and mobile layout. One real-session test skipped; frontend restarted. No provider calls or backend changes.
- **Remaining:** Visual preference is subjective; legacy Git-history license review and existing dependency advisories remain. Runtime graph topology unchanged.

## 2026-10-13 — GitHub publication preparation
- **Request:** Proceed with preparing the project for GitHub publication.
- **Change:** Added a secret-free Checks workflow for main pushes/PRs/manual dispatch: Python3.12 SQLite/mocked-provider tests and migration checks; Node22 lint/build/mocked Chrome tests. Pinned official action revisions and read-only repository permissions. Updated contribution/setup/map/publication notes.
- **Rationale:** Give contributors reproducible checks without personal provider accounts. GitHub API confirmed the repository is already PUBLIC with default main. No commit, push, visibility change or history rewrite performed.
- **Evidence:**46 backend tests and migration check passed. Workflow parsed with existing js-yaml; events, action pins and permissions validated; links/diff checks passed. Python PyYAML and Node yaml were unavailable; no dependencies added. Earlier frontend lint/build/7 UI tests remain latest frontend evidence. Limited credential-pattern scan:98 candidate paths/77 reachable blobs, no matches/private candidate files. Legacy Lightfall confirmed in initial commit; generated graph receipts include machine paths.
- **Remaining:** First hosted CI run, clean-clone onboarding, full security/license audit and legacy published-history decision. Existing frontend advisories remain. No claim that limited scanning guarantees absence of secrets.

## 2026-10-13 — release issue fixes
- **Request:** Fix the remaining publication issues.
- **Change:** Scoped Next16.4 lint glob dependency to tinyglobby0.2.17, removed vulnerable braces chain and added actual-plugin compatibility coverage plus CI tooling/audit steps. Redacted machine paths in graph receipt metadata while preserving hashes/results; generated HTML unchanged. Rebuilt frontend and prepared a source-only archive without legacy history or secrets.
- **Rationale:** Upstream braces has no patched release; npm's suggested Next downgrade would lose current tooling. The sole globSync/onlyDirectories call supports the replacement and has regression coverage. Published-history replacement is destructive and awaits explicit approval.
- **Evidence:** Online npm audit0; clean Docker npm ci audit0; tooling tests on host and Node22 container, lint/build,7 mocked Chrome tests passed. Real-session test skipped; prior46 backend tests stand. Private-reporting enable returned404; API confirms current account WRITE/no ADMIN and reporting still false.
- **Remaining:** Owner/admin must enable private reporting. First hosted CI requires pushing; fresh-root force-push requires approval. No history rewrite or push performed.
