# Knowledge Graph ownership — 2026-10-18

## Implemented
Server assigns owner to entity/relation creation, imports and both research generators. Graph, search, neighborhood, evidence, paths, validation, statistics and export use only the authenticated owner's records. Deleting an entity removes only that owner's entity and attached relations. Identical entity IDs can coexist across owners. Import payloads cannot assign another owner. API-key statistics use the key creator's graph, not global or organization-wide data.

Username changes transfer graph ownership, API-key creator references and legal consent, avoiding accidental loss of access or ownership inheritance through the old username.

## Compatibility
Legacy graph records without owner remain in storage but are hidden from these endpoints, including for administrators. No ownership is inferred. A reviewed migration with verified owner mappings is required to restore their visibility. Project/organization sharing is not implemented; this is private per-user access.

## Verification
52 backend tests passed (4 existing deprecation warnings). Thirteen added cases cover read isolation, foreign deletion, matching IDs, import spoofing, legacy preservation, rename, API-key scope and research-generated ownership. The previous paths regression now supplies owned data. Git diff whitespace validation passed.

No real PostgreSQL integration or authenticated production/browser test was performed. Snapshot concurrency/rollback limitations documented in PERSISTENCE-2026-10-18.md remain.

## Release
Local only; production was last verified at 48f3301. Runtime change is backend/main.py; tests and reports also belong in source control. No frontend upload is required. Next work: transactional persistence, legacy ownership migration, server-backed Learning Hub progress and authenticated UI regression.
