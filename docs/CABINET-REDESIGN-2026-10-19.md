# Unified cabinet and workspaces — 2026-10-19

## Implemented

The primary dashboard now has six sections: education, bioinformatics, molecules and structures, research, laboratory workflows, and management. It uses the existing role module lists; restricted sections are clearly marked. Administration remains visible only to the administrator role. Existing server authorization is unchanged.

Workspaces share a light frame, labelled input fields, three-step orientation and responsive layout. Molecular and nucleotide results show summaries of actual API measurements, with the original result retained. Advanced molecular and sequence operations are expandable. Learning Hub has a direct history navigation control.

Fixed navigation defects: a denied opening no longer hides the cabinet; old delayed dashboard renderers cannot close a newly opened workspace; closing returns to one dashboard. Fixed mobile topbar overflow and literal backslash-n text in HTML. The prior readiness/CORS fix remains included in backend/main.py.

## Verification performed

- Backend: 95 passed, 2 PostgreSQL integration tests skipped, 4 warnings.
- DOM: all 11 roles, six sections, permitted/denied navigation and administrator separation.
- Existing Learning Hub interaction, school-removal, script-origin policy and JavaScript syntax checks passed.
- Real Chromium browser at 1440px and 390px, using disposable localhost accounts and no production writes: student, biotech and company login; six section dashboard; Learning Hub completion, saved history and history focus; ethanol analysis (46.069 g/mol); ATGC nucleotide analysis (50% GC); PDB, research, laboratory and organization workspace navigation; return home; no horizontal page overflow.
- Desktop and mobile screenshots inspected. Browser tests are included in GitHub CI.

External services are deliberately blocked in this local browser test. It does not verify the 3D library CDN, live literature providers or docking services. Organization/workflow screens are checked for navigation and layout; all administrative operations have not been exercised in a real browser.

## Remaining release boundaries

This change completes the unified cabinet/workspace UI pass, not every capability illustrated in the concept images. The new cabinet and guidance copy are Uzbek; existing tools retain their previous multilingual coverage. Scientific validation, external integrations, official certificates and comprehensive transactional persistence remain outside this UI change. See RELEASE-GATES-2026-10-18.md for snapshot persistence limitations.

No GitHub push or Render deployment was performed. The screenshots reflect local test data, not a production account. New CI and deployed-version smoke checks remain required before calling the deployed update ready. Do not overwrite the existing deployed repository with an older ZIP.

## Follow-up integration verification

Read-only live probes on 2026-10-19 confirmed PubMed search plus article metadata, RCSB 1CRN structure parsing (46 residues, 327 atoms), and a real 3Dmol WebGL render of that PDB in Chromium. The JavaScript and PDB bytes were fetched from their upstream hosts, then rendered locally. This is not a deployed authenticated workflow test.

Render reports both services live on `732cabc`; frontend returned HTTP 200 with the previous UI. The backend health probe timed out initially and returned HTTP 200 on retry. No restart, deploy or configuration change was made.

Docking review found and corrected:
- Vina `energies()` energy-component columns were incorrectly labelled as RMSD. They now retain energy names and kcal/mol units, per https://autodock-vina.readthedocs.io/en/stable/vina.html.
- Completed docking jobs were not persisted; the save is now required, with the new job/event removed if saving fails.
- The UI hardcoded one search-box center for every target. It now requires explicit center coordinates and prepared PDBQT inputs, validates bounds, and re-enables the action after failure.
- Engine CPU use is limited to one worker; backend box inputs reject nonfinite numbers.

These docking tests use an engine double to verify adapter semantics, cleanup and failure handling. A full scientific Vina benchmark was not run. Previously stored results with the old RMSD labels were not rewritten.

Final local regression run after docking fixes: 101 backend tests passed, 2 PostgreSQL tests skipped, 4 warnings. Frontend docking contract, syntax, existing role tests and script policy passed. The desktop/mobile browser suite also includes Drug Discovery form navigation and overflow checks.
