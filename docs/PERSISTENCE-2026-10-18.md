# Persistence failure reporting — 2026-10-18

## Changes
- backend/main.py: database save failures now raise HTTP 503 rather than returning apparent success.
- Startup aborts if configured PostgreSQL cannot be restored or its driver is missing.
- All recognized snapshot container types are checked before applying any restored data.
- Removed redundant import-time restore; the startup handler restores after definitions are complete.
- backend/tests/test_persistence_failures.py: six regression tests, including HTTP failure behavior and in-place snapshot restoration.

## Validation
39 backend tests passed locally. Database behavior uses controlled connection doubles; no production PostgreSQL restart or durable round-trip was performed. Existing framework deprecation warnings remain.

## Boundaries
This is failure reporting and startup validation, not a transactional persistence redesign. Handlers mutate process-local stores before saving; on failure those mutations are NOT rolled back and may be saved by a later request. Whole-store snapshots, concurrent requests, multiple processes, and missing save calls remain to be addressed. No claim of reliable multi-worker persistence is made.

## Release
Not pushed or deployed. Production remains at 06d4f6d. For this runtime change only backend/main.py needs replacement; tests and this report should also be committed for reproducibility. A configured database outage now deliberately prevents startup instead of serving empty state. Next step: transactional per-record storage and real database integration tests before scaling.
