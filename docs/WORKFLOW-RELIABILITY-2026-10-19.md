# Scientific workflow reliability update

Production baseline verified: PR #16, c7f7350, live on both Render services.
This update has not yet been uploaded to GitHub or deployed.

Changes:
- Reject workflows with no scientific inputs instead of creating empty completed experiments.
- Validate single-record FASTA without stripping invalid characters or treating header text as sequence.
- Return actual sequence analysis and explicit sequence display truncation metadata.
- Return actionable 400 errors for invalid reference or candidate SMILES.
- Require reference ligand for requested similarity; reject libraries over 200 rather than silently truncating.
- Preserve every valid comparison in the response.
- Remove the newly created experiment on save failure, preserving existing records.
- Block duplicate workflow submissions while pending and restore the button after errors.
- Display structured API errors readably.

Verification: 111 backend tests passed, 2 PostgreSQL integration tests skipped locally.
New frontend regression covers empty inputs, duplicate submit, structured errors, retry and network errors.
Existing cabinet, docking and Learning Hub DOM regressions passed.

Limits: not a full-platform completion claim. Real PostgreSQL integration requires CI.
Global snapshot persistence still needs broader transactional redesign before multi-worker scaling.
External scientific results require scientific validation; this update does not establish clinical validity.
The workflow save rollback covers only its own new experiment, not other legacy mutation routes.
