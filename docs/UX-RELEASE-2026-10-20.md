# MedGen AI usability release — 2026-10-20

This release includes the scientific workflow fixes from bbd68d8 and updates on top of production PR #16 (c7f7350). Not deployed by this work session.

## Implemented
- Logout immediately clears the local session and calls the existing showLogin boundary to reverse hidden properties and important inline styles. Server revocation is attempted independently with a five-second abort.
- Consent-granted GPS coordinates save through the authenticated location endpoint independently of the rest of the profile. Zero latitude/longitude are preserved. Failed saves restore profile/audit state. No reverse-geocoder dependency or mandatory precise location.
- Larger multiline assistant/community inputs; readable message layouts. Assistant retains input on errors, prevents duplicate sends, ignores responses after logout, and renders text and source links safely.
- Light, dark and system theme choices persisted locally; main cabinet and workbench use shared tokens. Legacy duplicate dashboard suppressed.
- Uzbek/English/Russian translations for main login/registration/cabinet/navigation controls, theme choices, selected scientific controls and assistant guidance. User messages, scientific data and original publication titles are not silently translated.
- Existing four language mini-lessons gain meaning reveal/hide and browser speech playback. Device speech support/voices vary. They are not complete language courses.
- Beginner example insertion for sequence, molecule and protein fields. Visual workbench lives inside the authenticated workspace.
- Existing AlphaFold DB model retrieval by UniProt accession, bounded response size, fixed provider/model URLs, actual 3D rendering and mean pLDDT display. This retrieves existing predictions, not new folding jobs or experimental validation.
- Assistant optionally retrieves up to five PubMed records. It returns the original question and explicit search query. Uzbek OIV variants, HIV and ВИЧ map to an explicit HIV review query. This is source retrieval and platform guidance, not a general-purpose language model or a validated drug ranking system.
- Scholarship/opportunity board: professors submit title, eligibility, deadline and official HTTPS URL. Administrator reviews; learners see published unexpired entries. Failed writes are rolled back. External links to USMLE, IELTS, DAAD and Campus France are provided as official resources, not claimed integrations or guaranteed awards.

- Follow-up: authored UZ/EN/RU quick-quiz and molecule-matching text. Questions and answers remain at stable server-graded indices. Dynamic quiz counts are isolated from translated text. User messages remain protected.

## Verification
- Follow-up DOM regression: all 12 quiz answers, all three UI languages, mid-attempt language changes and untouched user messages passed. Existing Learning Hub and language speech/recall regressions passed again.
- Backend: 123 passed, 2 skipped (real PostgreSQL integration requires CI), 6 warnings.
- Desktop/mobile real Chromium UX checks: registration language switches, cabinet UZ/EN/RU, persistent light/dark preferences, GPS permission and zero-coordinate storage, assistant, community, visual lab and offline logout.
- Real workspace tests: student, biotech and company at 1440 and 390 px.
- Professor scholarship creation tested through real mobile browser; access and admin approval tested at HTTP layer.
- Existing cabinet, Learning Hub, script policy and scientific-workflow regressions passed; language practice test verifies reveal control and German speech locale.
- Actual public AlphaFold P69905 fetched: AF-P69905-F1, model date 2025-08-01, mean pLDDT 98.06, 1077 atoms. Captured payload rendered through the new viewer function with real 3Dmol/WebGL. This is one reference integration, not all-protein coverage.
- Screenshots reviewed internally; not included in this source package.

## Explicit remaining work
- Full multilingual authored lesson/question/explanation content; legacy dynamic status/error strings still include mixed languages. Main UI translation coverage is not a full-platform translation claim.
- Complete English/Russian/German/French curricula and official exam preparation curricula; current materials remain mini-lessons and practice.
- Full natural-language research synthesis needs a selected/configured language-model provider, retrieval/evaluation design and scientifically reviewed outputs. No model credentials were supplied or deployed.
- No engine here predicts clinical cure, drug efficacy, organ effects or complete cellular/molecular dynamics from a question. AlphaFold confidence is not efficacy confidence.
- Larger visual laboratory exercises, role-specific product depth, accessibility/localization audit and external scientific validation remain ongoing requirements.
- PostgreSQL integration must pass CI; global snapshot persistence is still single-process and requires architectural work before multi-worker scaling.
- No claim of guaranteed scholarship, certification, clinical readiness or a fault-free complete platform.

## Primary references checked
- https://alphafold.ebi.ac.uk/faq
- https://alphafold.ebi.ac.uk/api/prediction/P69905
- https://www.ncbi.nlm.nih.gov/sites/books/NBK25500/?report=printable
- https://www.usmle.org/prepare-your-exam
- https://ielts.org/take-a-test/preparation-resources
- https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/
- https://www.campusfrance.org/en/faq/where-can-i-apply-for-a-scholarship

## Follow-up implementation — not packaged for upload yet

User requested to wait for a complete release before uploading. This follow-up is committed locally and is not deployed or included in the previously linked ZIP.

- Five theory lesson bodies, questions, answers and explanations translated into English/Russian alongside Uzbek.
- Five theory and five clinical practice questions and explanations translated; server-graded indices preserved.
- Organ placement labels, feedback, score and end state localized. Timer pauses when the page/workspace is hidden.
- Learning history, save status and mini-lesson meanings localized; target-language vocabulary is preserved.
- Schematic 3D cell gains touch-friendly zoom/reset/pause buttons, arrow-key rotation and reduced-motion default. Hidden workspaces skip drawing, dimensions respond to resizing, disconnected viewers release geometries/materials/context.
- Tests: existing Learning Hub regression, three-language quiz, lesson/exam/organ/history localization and isolated Three.js control/lifecycle checks passed. The control test uses a controlled Three.js implementation; it is not a clinical model validation or a real GPU rendering test.
- Real local Chromium workspace tests passed for student, biotech and company at 390/1440 px. These tests deliberately block external providers, so external 3D CDN availability is not covered.

Remaining: complete curricula, all legacy screen translations, authenticated live-provider research synthesis, deeper laboratory simulation, broader role tools and real PostgreSQL integration gates. These are not declared finished by this commit.

## Guided virtual laboratory follow-up

- Added simple sequence/SMILES/PDB fields and explicit example buttons; expert JSON input remains available. Guided input requests only the supplied analysis steps and report preparation.
- Fixed a root backend defect: created pipeline step results were never appended to the experiment. Empty legacy experiments now return 409 rather than reporting successful execution.
- Added readable formula, molar mass, sequence length and GC summaries; full JSON remains available. History now includes owned virtual laboratory experiments in addition to generic workflow records.
- Invalid/empty input is rejected before creation. Duplicate frontend submissions are blocked; logout prevents later execute/report calls and stale result rendering.
- Database-save failures roll back newly created experiments/reports and their audit events; execution restores the prior experiment on failed persistence.
- Backend suite: 130 passed, 2 skipped (real PostgreSQL integration), 6 warnings. Tests include actual RDKit ethanol mass/formula, DNA GC, owner isolation, each save-failure stage and empty legacy records.
- Frontend controlled API regression covers exact requested steps, empty and invalid JSON inputs, duplicate prevention, summary/history and logout guards.
- This remains computational analysis, not a physical laboratory experiment or a validated clinical prediction. Existing deployment is unchanged; no new upload package requested from the user.

- Real local Chromium: student, biotech and company workspaces passed at 390/1440 px; company lab completed DNA/ethanol analysis, displayed actual values and reloaded saved history at both sizes. External provider requests were blocked in this test.

## Session isolation final check

- Shared API rejects late responses after the session token changes, before either returning private data or opening consent/profile prompts for a different user.
- Logout clears private results and editable dashboard/profile inputs, removes learning/clinical workspaces and closes the legal modal. Reports independently guard against rendering results for an old session.
- Controlled regression verifies stale success/403 rejection and private-data cleanup. Real Chromium UX passed at 390 and 1440 px, including offline logout. Learning, translated lessons, scientific workflow and guided lab regressions passed again.
- This verification completes these code changes, not the entire requested global platform. No new ZIP or live deployment was produced: user requested to wait for whole-product completion. Full curricula, general AI synthesis/provider configuration, deeper simulation and broader role features remain open; local real PostgreSQL tests are still skipped and must pass in CI.

## Report browser and export

- Replaced the JSON-only history screen with report/experiment cards, name/ID/target search, type filtering and 20-record pagination.
- Users can open a selected saved record and download its exact data as JSON, including record kind and export time. JSON is not labelled as a certified or experimentally validated report.
- Record titles are rendered with textContent and protected from interface translation. Downloads and record selection verify the original session; logout clears the list/detail and disables export.
- Controlled frontend tests passed for pagination, type/search filters, empty results, unsafe-looking titles, selection, download and account-switch guards. These changes require no new database fields.
- Real local Chromium verified the entire create-lab → saved report search → open → JSON download flow at both 390 and 1440 px. Downloaded JSON was parsed and matched to the saved experiment title. Existing student/biotech/company navigation and computation checks passed in the same run.

## Scientific source retrieval follow-up

- Research screen now shows original and normalized queries, source titles/journals/dates, original-language excerpts and numeric-PMID-only PubMed links. Technical JSON is expandable; text is safely rendered and authored content is not translated.
- Both search controls share one guarded request flow. Duplicate sends are blocked, input survives failures, previous results clear on retry, and late responses cannot enter a changed session.
- Research request sizes and result limits are bounded. Both research endpoints explicitly persist generated reports and graph additions; a failed save removes only objects created by that operation, preserving unrelated writes.
- Backend suite: 138 passed, 2 PostgreSQL integration skips, 6 warnings. New tests cover persistence, isolated rollback and request limits with controlled article fixtures.
- DOM tests cover links/text, empty results, retries, duplicate clicks and session isolation. Real Chromium desktop/mobile source-card checks used a controlled API response, not a live PubMed query. Existing laboratory/report download/navigation flows passed at 390/1440 px.
- This is PubMed retrieval and deterministic extraction. No general-purpose language model was configured in this change; no clinical synthesis or efficacy validation is claimed. No production deployment or new upload package performed.


## Scientific job submission — 2026-10-21

- Docking job inputs now use the same Pydantic validation as the direct docking route; invalid numbers, non-finite coordinates, box sizes and execution limits return 422 before execution.
- Failed job persistence removes only the newly inserted job, preserving unrelated records. Legacy ownerless records are skipped in job lists.
- Job creation prevents repeated clicks, clears obsolete results, preserves input for retry, and ignores responses/errors from an old session. Job list/status views also guard session changes.
- Added eight backend cases and a DOM regression covering invalid input, persistence rollback, retry, ownership, duplicate clicks and stale responses.
- This is inline execution, not a durable background queue. Docking still has a separate persisted docking record; a later generic-job save failure may leave the successfully saved docking record available in docking history. No general server-side idempotency is claimed.


## Follow-up: opportunity sessions and consistent docking persistence

- Opportunity submission/review captures the session; old responses, detached forms and previous-account controls cannot submit or reopen a different account's board.
- Duplicate form submission and simultaneous publish/reject actions are locked until completion; errors preserve editable form values.
- Docking via the generic job endpoint now computes before a single save of its job, docking result and audit record. Save failure rolls back only these records. This supersedes the separate-save limitation described above; no durable queue or server idempotency is claimed.
- Full backend suite: 148 passed, 2 PostgreSQL integration skips, 6 warnings. New persistence tests use a controlled docking computation fixture and do not validate scientific docking performance. Opportunity DOM tests cover duplicate submission, review locking, session switches and closed panels.
- Production remains unchanged. Full curricula, general AI provider configuration, full role tools and deeper scientifically validated simulations remain unfinished.

## Academy persistence and release verification

Both academy assessment APIs now share a save helper that restores the previous grade/attempt count after storage failure, removes empty newly-created containers, and preserves unrelated progress writes. Five regression cases cover both routes, first/existing grades, retry and unrelated updates. Access checks remain unchanged; HTTP tests use approved academic test accounts.

All 23 frontend CI commands passed. Real Chromium workspace checks passed for student, biotech and company at 390/1440 px; UX checks passed at both widths for language/theme/GPS/chat/community/visual panel/offline logout. See HOLAT-2026-10-21.md for explicit product limits and deployment gates.
