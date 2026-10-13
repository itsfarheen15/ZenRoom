# Agent rulebook

## Read order and authority
1. Read this file, then `MEMORY.md` (compact current context).
2. Follow links in `docs/MAP.md` only for the subsystem being changed; read the actual source/tests before editing.
3. `README.md` owns setup commands, `.env.example` owns variable names, source owns behavior. Read graph Markdown/JSON instead of the large generated HTML to save context. Memory is an index, never proof that code still behaves that way.
4. Follow applicable nested `AGENTS.md`. Explicit user instructions supersede project preferences. Do not invent missing history or claim access to earlier agents' private reasoning.

## Working contract
- Plan nontrivial changes; use small patches and preserve unrelated user edits.
- Frontend is standard JavaScript/JSX. Do not reintroduce TypeScript or a typecheck script without user approval.
- Django owns external calls and secrets. Use the Django HttpOnly session with CSRF for browser authentication; never store API tokens in browser storage. Retain owner isolation, exact credentialed CORS, scraper SSRF checks and bounded provider calls.
- Preserve the readable dashboard and all three palettes (Dark, Light, warm Eye Comfort), accessibility, reduced-motion/pause behavior and original dark-theme Canvas 2D galaxy background. No fake live data in the application; fixtures belong in tests.
- Keep the responsive CSS grid; desktop resizing was rolled back at user request. India relevance comes from story text, never publisher country.
- Default to local/free services. Explain provider restrictions when changing integrations. No silent paid-model fallback.
- Compose owns local startup: six services, healthy dependencies, migrations before workers, one Beat, persistent data. Never delete volumes or push/deploy without authorization.
- Preserve MIT notices for original code and third-party license boundaries. The original light tunnel replaces the unverified Lightfall source; older Git history may still contain that removed component. Record source/revision/license for copied code and assets. See `THIRD_PARTY_NOTICES.md` and `docs/MAINTAINERS.md`.
- Keep dependencies and lockfiles synchronized. Generated/dependency files in `node_modules`, `.next`, virtualenvs are not application source.
- Run checks appropriate to the change. Record exactly what ran and what failed/was unavailable; distinguish mocked tests from live/provider/container checks.

## Memory update protocol (required at each meaningful handoff)
1. Patch existing sections of `MEMORY.md` in place; keep its headings/order and stable decision IDs. Aim for <=1,200 words; never paste conversations, tool logs, secrets or hidden reasoning.
2. Update the date, current state, verification and open work. Remove resolved blockers and obsolete commands. Keep implementation facts separate from plans.
3. Add a short dated entry to `docs/HISTORY.md`: **Request → Change → Rationale → Evidence → Remaining**. Record observable decisions and tradeoffs, not speculative authorship or private thoughts. Compress older repetitive entries.
4. When behavior, paths, services or contracts change, update `docs/MAP.md`, affected README sections and graph sources in the same change. When graph topology changes, regenerate `docs/architecture.html` from `docs/architecture.json` using Archify if available; otherwise mark the HTML stale explicitly in MAP/MEMORY. Never hand-edit generated HTML.
5. Verify links/paths, variable names and claims against source. Report remaining setup honestly. New agents begin with the latest state, not a replay of history.

## Ownership of documents
- `MEMORY.md`: concise handoff state and decision index.
- `docs/HISTORY.md`: compact engineering history and superseded decisions.
- `docs/MAP.md`: source ownership, dependencies, change-impact map and complete logical graph.
- `docs/architecture.json` / `.html`: generated interactive runtime overview, not a production deployment promise.
- `README.md`: canonical setup commands and environment variables; `docs/USER_GUIDE.md`, `docs/API.md`, `docs/DEPLOYMENT.md`: usage, API contracts and production requirements.
- `CONTRIBUTING.md`, `SECURITY.md`, `docs/MAINTAINERS.md`: contributor checks, private reporting and publication procedure. `LICENSE` and `THIRD_PARTY_NOTICES.md`: original-code license and third-party boundaries.
