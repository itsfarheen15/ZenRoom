# User guide

[Installation and environment variables](../README.md) · [API behavior](API.md) · [Deployment](DEPLOYMENT.md)

## Your workspace

Connect once using your Django access token. Refresh restores your session while it remains valid. Disconnect on a shared computer; this clears private UI data and also signs that browser out of Django Admin. An expired-session message means you need to reconnect. Provider accounts belong to the installation operator; each workspace account owns its own tasks and links.

Add tasks with a title and date, then use the checkbox to mark them complete. Today includes completed tasks. Upcoming contains future unfinished tasks; Pending contains past unfinished tasks. Dates use Asia/Kolkata, while the clock uses your browser's timezone. Edit or delete your quick links through their controls; Admin provides additional record management for trusted staff.

Select Dark, Light or Eye Comfort in the header. Eye Comfort uses warm colors and is a visual preference, not a medical feature. The browser saves theme choice locally. Use the motion pause button or your operating system's reduced-motion setting. Cards adapt to the viewport; desktop resizing is not available.

Tech headlines open a three-point summary dialog with the original article link. A summary needs your installation's Gemini key and usable article text. Some sites block scraping or require JavaScript/paywall access; the application does not bypass these restrictions. Read the original article for context.

## Start, stop and update

Run commands at the repository root:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 backend worker beat
# Stop services while retaining stored data
docker compose down
```

Do not use `docker compose down -v` unless you intend to delete stored data. Keep the same Compose project name/directory to reuse existing volumes. A different project name can make an installation look empty by attaching new volumes.

Before updating, back up the database, preserve your private `.env`, and review release notes/migrations. Commit or stash your local code changes, pull the intended revision, then run `docker compose up -d --build`. Do not replace `.env` with the example during updates. Restart worker/Beat after task-code changes; rebuild images after dependency changes.

## Back up and restore

Store backups outside the repository in a private directory. This example writes only to a new backup file through your shell; choose a unique filename and restrictive filesystem permissions:

```bash
umask 077
mkdir -p ../zenroom-backups
(set -C; docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > ../zenroom-backups/zenroom.dump)
```

Check the command succeeded and the file is nonempty. Keep a separate secure copy of `.env`; a database backup is not a key backup. PostgreSQL contains tasks, links, accounts and sessions. News cache can be rebuilt.

Test restore into a separate disposable installation/database first. The following restores into the database of the Compose project you run it from; use it only against an empty target you intend to populate:

```bash
docker compose exec -T db sh -c 'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < ../zenroom-backups/zenroom.dump
```

Do not restore over your working database without a recovery plan. Check accounts and records after restore before switching users to that installation.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `user zen does not exist` | Run `createsuperuser` first, or pass the username you actually created to `drf_create_token`. |
| All widgets ask to connect | Use a Django token, not a GitHub/provider key. Open `http://localhost:3000` consistently; `127.0.0.1` is a different browser origin. |
| Session disappears after refresh | Check cookies are allowed, local `DJANGO_DEBUG=true`, and frontend/API use the documented hosts. HTTPS is required for production Secure cookies. |
| CSRF or CORS failure | Use the exact configured frontend origin. Reconnect for fresh CSRF state. Do not disable CSRF or add wildcard credentialed CORS. |
| News unavailable | Check your own `FREENEWS_API_KEY`, account quota and worker/Beat logs. Recreate services after key edits. Wait for initial cache population. |
| India shows fewer than five stories | Relevance and deduplication may leave fewer results. The provider title-search outage limits coverage; unrelated stories are not used to fill slots. |
| News marked stale | The last refresh failed. The UI can retain last-good data up to 24 hours. Inspect worker errors before forcing more calls. |
| Summary fails | Check Gemini key/model/account quota; the article may lack scrapeable text. No paid fallback runs. |
| GitHub unavailable | Check worker/network/rate limits. An optional backend GitHub token raises quota; no private repo scope is needed. |
| Database login fails after editing `.env` | Existing volumes retain their original database password. Restore the matching env value or rotate the database role password. |
| Port already allocated | Stop the older local server or conflicting container. Changing frontend origin also requires backend CORS/CSRF configuration. |

For a single diagnostic refresh after correcting configuration:

```bash
docker compose exec backend python manage.py refresh_feeds
```

Avoid repeated manual refreshes; they consume provider quota. Redact keys, cookies and private content before sharing logs. See [Security](../SECURITY.md) for exposed-token recovery.
