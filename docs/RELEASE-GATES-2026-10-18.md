# Persistence and release gates — 2026-10-18

## Changes
- PostgreSQL snapshots now include a reserved `__revision` JSON integer row.
- Startup creates the revision row for legacy data without replacing existing state, restores all stores, and validates revision/type information.
- Saves serialize within a process, copy the stores, lock the database revision row with SELECT FOR UPDATE, reject stale revisions, and update all store rows plus the revision in the same transaction.
- Local revision advances only after a successful commit. A stale process must restart/reload; it cannot silently overwrite a newer snapshot.
- Shared store registry prevents load/save lists drifting apart.
- Frontend Docker image copies an explicit static-file allowlist. Backend source, tests, and repository metadata are no longer copied to the nginx web root.
- Backend GitHub CI provisions an isolated PostgreSQL 16 test service and supplies a test-only localhost URL to integration tests. Frontend CI runs syntax, DOM and proxy tests.

## Actual validation
80 backend tests passed; 2 real PostgreSQL integration tests skipped because no test database was available. Existing deprecation warnings: 4. New unit tests cover stale/missing/invalid revisions, successful commit advancement, write failure and commit failure. These use connection doubles, not a PostgreSQL engine.

The two opt-in integration tests use a unique temporary schema on an explicitly local database and clean it up. They test save/restore, stale-writer rejection and database rollback after a mid-snapshot constraint failure. They were authored but NOT executed locally. CI has not been pushed or run.

PostgreSQL installation failed because this runtime disallows the uid/gid changes required by apt. Docker/Podman are absent. Playwright is available, but Chromium is absent; browser installation returned an invalid/truncated ZIP. Therefore PostgreSQL durability, Docker build and browser E2E remain unverified.

## Important limitations / rollout
This is conflict detection, not automatic multi-worker state synchronization. Do not scale the snapshot implementation. All writers must run the new version; older versions ignore the revision and can bypass the conflict check. Quiesce old writers during the eventual rollout; no production migration or deploy was performed in this task.

Handlers still mutate process-local stores outside a global transaction. This change does not roll back every endpoint on failure or provide a consistent cross-store snapshot under concurrent mutation. Learning Hub has its own lock/rollback, but other handlers can still alter shared profiles. Full per-record transactional persistence remains required.

## Run locally when an isolated PostgreSQL instance is available
Set MEDGEN_TEST_DATABASE_URL to a localhost-only test database. Do not use production DATABASE_URL. Install backend requirements plus pytest and httpx, then run:

    pytest -q backend/tests

Without MEDGEN_TEST_DATABASE_URL the two integration tests explicitly skip. GitHub workflow backend-tests.yml sets the variable for its disposable PostgreSQL service. Docker build remains in .github/workflows/main.yml. An actual green CI run is required before calling these gates complete.

## Consolidated delivery
User wants a single consolidated delivery after preparation, not repeated individual uploads. Preserve commits and tests; do not ask for intermediate deployment. Previously generated ZIP files are outdated. Platform-wide medical/scientific validation, authenticated mobile/desktop E2E and full module completion are still separate unfinished work.
