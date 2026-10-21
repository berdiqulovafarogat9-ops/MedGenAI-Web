# Learning Hub readiness error visibility

Observed Render app logs on 2026-10-18 show GET /api/v1/learning-hub/progress and POST /api/v1/learning-hub/attempts returning 403 while auth/me and admin endpoints return 200. Status-only logs do not identify which account-readiness condition failed. The database is not accessible through the connector; its networking rules were not changed.

Reproduced both PROFILE_INCOMPLETE and LEGAL_CONSENT_REQUIRED responses lacking Access-Control-Allow-Origin for the production frontend origin. Readiness middleware was outside CORSMiddleware, making browsers hide the response body as a network error.

Registered CORS after readiness so it wraps early error responses. Authentication, profile, consent and academic gates remain in place. Untrusted origins still receive no allow-origin header. The Learning Hub now displays the error message using textContent and ignores stale-session failures.

Before: 2 failing CORS regressions, 1 passing untrusted-origin check.
After: 32 tests passed across readiness CORS, Learning Hub and core regressions. JavaScript syntax and git diff whitespace checks passed.

No production deployment performed for this patch. A browser with an incomplete profile or missing consent must still complete those steps; this patch makes their existing UI prompts and reason readable. Rejected attempts were not accepted by the server.
