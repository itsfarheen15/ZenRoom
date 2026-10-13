# Publication checklist

Use this before making the repository public or publishing a release. Creating these documents does not publish code or enable GitHub settings.

- The current tree uses an original MIT light-tunnel effect. Old commits may retain the removed Lightfall source with unresolved provenance; review that history before publication. Preserve dependency notices and exclude obsolete snapshots from release archives. History has not been rewritten.
- Review the intended commit and all reachable Git history for credentials, private user data, database dumps and personal paths. A clean `.gitignore` only protects future untracked files. Rotate exposed credentials before any history cleanup.
- Keep `.env.example` placeholders and the user-owned-key instructions current. Confirm the actual repository URL and default branch. The configured origin at this handoff is `https://github.com/itsfarheen15/ZenRoom.git`; GitHub API confirmed PUBLIC visibility and default branch `main` on 2026-10-13.
- Run the checks in [Contributing](../CONTRIBUTING.md). Record fixture tests separately from live provider checks. Verify a fresh setup using your own account and test credentials; do not distribute your database volumes.
- Enable GitHub private vulnerability reporting, choose a maintainer contact/process, and review repository permissions. The current account has WRITE, not ADMIN, permission. Its enable-reporting request returned404; an owner/admin must enable it in repository settings. A local Checks workflow is prepared for pull requests/main pushes; its first GitHub run remains pending. Configure branch protection and dependency alerts in repository settings as needed.
- Review generated graph receipts for local machine paths and screenshots for private data. The README hero uses fictional browser-test data; label replacement screenshots truthfully.
- Tag releases with notes about migrations, setup changes, provider limits and known issues. Back up data before migrations and document recovery steps for changes that need them.

Contributors grant the project's MIT license for their original contributions. Dependencies and external content keep their own terms; see [third-party notices](../THIRD_PARTY_NOTICES.md). Keep claims about hosting costs and free tiers tied to current provider terms.

## Preparation report (2026-10-13)

- GitHub API: repository is already public; default branch main. This preparation did not push or change visibility/settings.
- Local scan:98 candidate paths and77 unique reachable history blobs checked with credential patterns (GitHub/Google/AWS keys, private keys and long literal credential assignments); no matches. No private env/database/key files appeared in candidate paths. This is a limited pattern scan, not a full secrets or license audit.
- Legacy source exists in the initial commit `6af4b97`; removing it from the current tree did not erase history. Review that published history separately. No force-push or rewrite performed.
- Current graph receipts now use redacted local path metadata; original hashes/results remain unchanged. Historical copies remain in the old commit.
- CI workflow prepared with immutable official action revisions and no provider secrets. First hosted run and clean-clone onboarding remain unverified.
- Frontend advisory chain resolved with a scoped lint-only glob replacement; npm audit reports0 known vulnerabilities. Tooling compatibility, lint and build pass.

## Fixes prepared (2026-10-13)

The five dev-only audit findings shared one unpatched braces dependency. A scoped alias replaces the Next16.4 lint plugin's glob dependency with tinyglobby0.2.17, preserving the plugin and rules. The lockfile removes the vulnerable chain; online npm audit and a fresh Docker install report0 known vulnerabilities. Compatibility tests cover the plugin's actual directory-discovery API; host/container tests, lint/build and7 mocked browser checks pass. CI now enforces tooling tests and an audit threshold.

A local source-only snapshot at `out/zenroom-mit-source.zip` excludes Git history, the removed legacy component, private env files and build/dependency output. It is a review artifact, not a published release. Replacing public main with a fresh root based on this snapshot requires explicit approval and a lease against `6af4b97f21a16bdfeab968fbcc9c0b0ea7e55650`; existing clones must resynchronize. A force-push cannot guarantee removal of old copies, forks or cached commit URLs.

GitHub private reporting remains disabled: the current account has WRITE access, and enabling reporting returned404. A repository owner/admin must enable it at the repository security settings. No push or history rewrite performed during preparation.
