# AIBourse - Audit Mode Provenance

This workspace implements the core building blocks for **Audit Mode** on compare + model detail views.

## Added

- Extended provenance contract for each numeric metric (price, throughput, context window, benchmark)
- Validation rules for required provenance fields and checksum integrity
- In-memory provenance API store + REST contract documentation
- UI structures for:
  - compact audit tooltip
  - full audit drawer with source/crawl/parser/raw snapshot/checksum
- Technical spec document (`AUDIT_MODE_SPEC.md`)

## Files

- `src/provenance.ts`: Data contract + normalization + validation
- `src/provenance-api.ts`: Provenance endpoint contract helpers
- `src/provenance-ui.ts`: Compare/detail audit mode UI models
- `AUDIT_MODE_SPEC.md`: Delivery spec and fallback policy

## Why

Competitor research suggests most dashboards lack verifiable per-number provenance. Audit mode makes AIBourse data defensible during disputes and increases trust in reported metrics.
