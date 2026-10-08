# MedGen AI — Phase 1: Foundation & Architecture

## Goal
Phase 1 establishes a stable foundation before feature work.

## Non-negotiable architecture
- Web frontend is a client, not the scientific authority.
- Backend API is the authoritative application boundary.
- Scientific results must preserve provenance and distinguish calculated, predicted, experimental, and sourced facts.
- Authentication and authorization are enforced server-side.
- UI navigation must have one source of truth.
- API base URL must be configurable; frontend must not require Android-specific architecture.
- Future clients (Web, Android, iOS, Desktop, API) must consume the same backend contracts.

## Phase 1 workstreams
1. Repository structure and ownership
2. Runtime configuration
3. API boundary and versioning
4. Data model and migration strategy
5. Logging and error model
6. Scientific provenance model
7. Navigation and shell boundary
8. Environment separation
9. Deployment contract
10. Regression gate

## Current audit findings
- Frontend currently has a very large monolithic app.js with multiple appended shell/navigation blocks.
- Login/dashboard visibility is not isolated cleanly.
- Navigation behavior is duplicated and can overwrite earlier handlers.
- The frontend directly contains many feature implementations that should eventually be separated behind stable module boundaries.
- API_BASE is hard-coded to the Render backend when no runtime override is provided.
- nginx already provides an /api/ proxy, so the production API contract should be standardized in Phase 1 instead of maintaining two competing access paths.

## Phase 1 acceptance criteria
- One login shell and one authenticated application shell.
- One navigation controller.
- One dashboard state controller.
- No feature may render over the login screen.
- Runtime API configuration is environment-aware.
- API errors have a consistent structure.
- Scientific result records include provenance/status metadata.
- Changes are tested before Phase 2 begins.

## Scientific result status vocabulary
- source_fact
- calculated
- predicted
- experimental
- clinical
- unverified

AI output must never be silently promoted to experimental or clinical evidence.

## Phase 1 rule
Do not add new feature code to compensate for broken architecture. Fix the foundation first, then build Phase 2 on top of it.