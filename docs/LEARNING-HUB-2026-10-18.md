# Learning Hub server integration — local checkpoint

## Implemented
- GET /api/v1/learning-hub/progress returns only the caller's retained practice attempts.
- POST /api/v1/learning-hub/attempts validates version, activity, complete unique question IDs and answer indices. Server calculates scores for quick quiz, theory, clinical practice and shuffled molecule matching.
- UUID attempt IDs prevent duplicate retries within the retained 100 attempts; changed payloads return 409.
- Attempts are stored within existing user profiles, using the existing PostgreSQL snapshot mechanism. Without configured persistence the API and save UI explicitly identify process-memory storage.
- A process-local lock serializes Learning Hub writes and reads. On failed save, the attempt list is restored so a retry cannot falsely claim successful persistence. This is NOT a global persistence transaction or multi-process fix.
- UI displays recent results, loading/empty/error states and retry. Retry preserves the attempt ID; session changes prevent a stale retry under another account.
- Both HTML and nginx CSP allow the jsDelivr origin already used by the schematic Three.js cell. Detached organ timers stop after workspace replacement.

## Validation
73 backend tests pass, with four existing deprecation warnings. DOM tests execute the actual Learning Hub block: complete four activities, check shuffled molecule answer IDs, simulate failed save and retry. School-removal DOM suite passes for 10 registration roles and 11 dashboards. Cloudflare proxy suite passes. JavaScript syntax and git diff whitespace checks pass.

These are local HTTP and DOM tests, not authenticated production E2E, clinical validation, browser WebGL rendering or real PostgreSQL durability tests.

## Remaining release gates
- Snapshot writes are still whole-state writes. Global concurrent mutation, rollback and multiple-worker coordination require a persistence redesign and real PostgreSQL integration tests.
- Organ placements (including timeout/unplaced items) and five theory self-checks now save server-scored results. Language mini-lessons save a separate ungraded, self-reported reading flag; they are not proof of language proficiency. Organ placement completion score is separate from local penalty-based game points.
- Old ownerless graph records need a reviewed migration; they are preserved but hidden.
- Clinical/academic content remains a small practice set, not a university curriculum, accredited assessment or validated clinical system.
- Authenticated mobile/desktop E2E, 3D browser checks, docking validation and Docker build remain unverified.
- School UI has been removed but legacy school backend endpoints still exist.

## Delivery preference
User requests consolidated delivery after preparation. Do not ask for a manual upload after each change. No deployment was performed for this checkpoint. Final source/frontend archives must be regenerated from the tested final revision, with remaining limitations stated. The earlier ZIP files predate this checkpoint.

## Consolidation checkpoint
No deployment or per-file upload requested. Runtime changes include backend/main.py, app.js, index.html and nginx.conf. Local environment has no PostgreSQL server tools or Docker executable, so restart/concurrency durability and container build gates could not be executed here. Do not mark these gates complete.
