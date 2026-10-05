# MedGen AI — Private Web Phase 2

Phase 2 keeps the Phase 1 private login/dashboard and adds real backend integration points.

## Connected
- `/api/v1/auth/login`
- `/api/v1/auth/me`
- `/api/v1/health/live`
- `/api/v1/molecules/analyze`
- `/api/v1/jobs`
- `/api/v1/reports`

## Security
This development shell uses `sessionStorage` for the access token so the token is cleared when the browser session ends. It is still a development client; production should use HTTPS and the server's secure refresh/session architecture.

## Run locally
Serve this directory with any static HTTP server. Configure `window.MEDGEN_API_BASE` before `app.js` if the API is hosted elsewhere.

This is still a private development frontend. It is not public deployment.

## Phase 3 additions
- PDB structure lookup
- Drug Discovery session creation
- Virtual Laboratory workflow listing

## Phase 4 additions
- Bioinformatics workflow submission
- Research search integration
- Scientific job creation from Web UI

## Phase 5 — Private security hardening
- Content Security Policy added to the frontend shell.
- Private-development banner added.
- API paths are constrained to `/...` application routes.
- Public registration remains disabled.
- Production deployment must use HTTPS.
- Server-side RBAC remains authoritative; frontend controls are not security boundaries.

## Phase 6 — Private Web deployment package

This package is ready to serve as a private static Web frontend.

### Local test
Run:

```bash
docker compose up --build -d
```

Then open:

`http://localhost:8080`

Health:

`http://localhost:8080/health`

### Production
Put the frontend behind HTTPS and an access-controlled domain/reverse proxy.
Do NOT expose the development API or database directly to the Internet.
Keep public registration disabled until the platform is intentionally opened.

The frontend expects the backend under `/api/v1` by default, so a production reverse proxy can route:

`/api/v1/*` → MedGen API

while serving the frontend from `/`.

This package does not claim that an Internet deployment has already been performed; it is the deployment-ready artifact.
