# School API retirement and scientific input checks

School invitation, management, assignment, submission and school assessment-generation routes have been removed from API routing and OpenAPI. Archived stores are still included in persistence; no account or historical record is deleted. Supported registration/admin-assignment/request roles exclude school_student and school_teacher. Pending historical requests cannot approve these roles. Unsupported registrations now return HTTP 400 rather than silently becoming university students. University academic approvals exclude historical school accounts.

Existing school account migration requires explicit administrator reassignment. No automatic reassignment or destructive migration was introduced. Historical fields/models remain for compatibility and archival handling.

Translation now rejects non-nucleotide symbols. Single-sequence FASTA input rejects multiple records rather than treating headers as sequence content; internal whitespace is normalized. Empty RDKit molecule graphs are rejected by batch descriptor analysis. Deterministic reference tests cover translation, RNA equivalence, ambiguous codons, reverse complements, ORF coordinates, gapped alignment and ethanol descriptors/identity similarity. This is limited algorithm verification, not validation of every scientific module or any medical claim.

The HTML CSP now permits the already-loaded 3Dmol origin, matching nginx. A static regression checks that both policies permit all external script origins used in index.html. This verifies policy compatibility, not actual WebGL rendering.

No production deploy or new upload package was created. The user requested completion before uploading. Outstanding release gates in RELEASE-GATES-2026-10-18.md still apply.

## Verification after changes
- Full backend suite: 92 passed, 2 skipped (PostgreSQL unavailable), 4 warnings.
- Learning Hub DOM interactions/save retry: passed.
- Registration roles, 11 dashboard renders and school UI removal DOM checks: passed.
- Cloudflare proxy and page/server script-policy checks: passed.
- Four JavaScript syntax checks, Python compilation and git diff whitespace check: passed.
- Browser E2E, PostgreSQL integration, Docker build and production deployment: not verified in this iteration.

## Runnable handoff
The isolated preview server and real Chromium desktop/mobile login test are now checked in. A new GitHub Actions workflow installs Chromium and runs registration, UI login, dashboard visibility and authenticated identity checks on localhost. It is authored and syntax-checked, not locally browser-validated. Docker builds now also run on pull requests, so the source can be reviewed on a branch before main/Render changes.

A local Uvicorn process was actually started: HTTP GET /, /app.js, /api/v1/health/live, registration, login and authenticated /auth/me all returned 200. This is a real HTTP smoke test using disposable process-memory data, not PostgreSQL or browser verification.
