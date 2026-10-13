# Contributing

Start with the [README](README.md) to run a local installation with your own credentials. Use issues for reproducible bugs or focused proposals; use the [security policy](SECURITY.md) for vulnerabilities.

## Make a focused change

1. Fork the repository, clone your fork and create a branch for one change.
2. Keep application code in JavaScript/JSX. Match existing Django and React conventions.
3. Keep provider calls and secrets in Django. Preserve owner isolation, HttpOnly sessions, CSRF, exact CORS, scraper protections and bounded provider requests.
4. Preserve the three palettes, readable typography, keyboard access, mobile layout, reduced motion and ambient pause. Cards use the responsive CSS grid; do not reintroduce resizing as an incidental change.
5. Update dependencies and lockfiles together. Add migrations for schema changes and tests for meaningful behavior changes. Use fixtures for tests; do not fabricate live application data.
6. Update the user documentation affected by your change. Do not include credentials, private user data or tool transcripts.

## Run checks

From the repository root, with Compose running:

```bash
# Isolated SQLite / memory-cache backend tests; provider responses are mocked
docker compose exec backend python manage.py test dashboard feeds --settings=config.test_settings

# Real PostgreSQL / dedicated Redis15; external providers remain mocked
docker compose exec -e REDIS_TEST_CACHE_URL=redis://redis:6379/15 backend python manage.py test dashboard feeds --settings=config.integration_test_settings

docker compose exec frontend npm run test:tooling
docker compose exec frontend npm run lint
# Use a separate container so the build does not replace the dev server's .next output
docker compose run --rm --no-deps frontend npm run build
```

Integration tests clear Redis database 15. Use a development database server and a dedicated test cache, never production data. Django creates a test database and needs permission to do so.

Browser checks require host Node.js 22, npm, and Google Chrome. Keep the Compose frontend running for the real-session test:

```bash
npm --prefix frontend ci
npm --prefix frontend run test:e2e -- --workers=1
# Opt in to the local Docker-backed session test, which creates/removes temporary users
ZEN_LIVE=1 npm --prefix frontend run test:e2e -- --workers=1
```

By default the real-session test is skipped; other UI tests mock API responses. They do not establish live provider availability. On Windows, set `ZEN_LIVE=1` using your shell's environment syntax. Inspect screenshots and exercise affected flows; report what you tested and what you could not verify. There is no TypeScript typecheck script.

For host-side frontend development, stop the Compose frontend first to free port 3000, copy `frontend/.env.example` to `frontend/.env.local` if you need a different API URL, then run `npm --prefix frontend run dev`. Restart worker and Beat after editing Python jobs. Rebuild the relevant image after dependency or configuration changes.

## GitHub checks

The [Checks workflow](.github/workflows/checks.yml) runs on pull requests, pushes to main and manual dispatch. It uses pinned official action revisions, read-only repository permissions, Python3.12 and Node22. Backend checks use SQLite/memory cache and mocked providers; browser checks use mocked API data and skip the opt-in Docker session test. No provider credentials or repository secrets are needed. Local PostgreSQL/Redis and real-session checks remain separate.

## Temporary lint dependency override

`@next/eslint-plugin-next@16.4.0` pulls in unpatched `braces` through `fast-glob`. A scoped npm override aliases only that plugin's `fast-glob` to `tinyglobby@0.2.17`; runtime dependencies and Next lint rules stay intact. The plugin uses `globSync` with `onlyDirectories`, which the replacement supports. `npm run test:tooling` exercises the actual plugin with default roots, wildcards, brace patterns, arrays and missing directories. Keep this test with the override and re-evaluate when upgrading the pinned plugin.

References: [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [tinyglobby](https://github.com/SuperchupuDev/tinyglobby). Do not use `npm audit fix --force` to downgrade Next tooling.

## Submit a pull request

Describe the problem, resulting behavior, validation and remaining limitations. Include before/after screenshots for visible changes using fixture data. Keep unrelated edits out of your patch. Do not attach `.env`, access tokens, cookies, database dumps or unredacted network traces.

Submit original contributions under the project's [MIT license](LICENSE), retaining attribution for any third-party material. Include the exact source revision and license when adding copied code or assets. See [third-party notices](THIRD_PARTY_NOTICES.md) for dependency licenses and the replacement of the former Lightfall component.

Treat contributors respectfully. Discuss code and observable behavior; avoid personal attacks. Maintainers may close abusive discussions or requests outside the project's scope.
