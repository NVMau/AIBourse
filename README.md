# AIBourse - Data Contracts & UI Models

This workspace now contains foundational contracts for model detail timeline snapshots and provenance metadata.

## Existing
- Provenance model attached to normalized price records
- Client-side provenance cache helpers
- Tooltip model carrying source URL, fetched time, confidence, parser version, raw snippet

## Added for task 4c489bef-223c-43e8-90dc-9f281b808df8
- `src/model-snapshot-contract.ts`: strict contract requiring full `price + benchmark + throughput + context` before snapshot write
- `src/model-snapshot-pipeline.ts`: validation, dedup, timestamp alignment, hold-only fallback policy, annotation generation
- `src/model-detail-ui.ts`: mapping unified snapshots to timeline series + separated benchmark panels
- `docs/model-snapshot-spec.md`: implementation spec and extension guidance
