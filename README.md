# AIBourse - Per-Cell Provenance Tooltip

This repository was initialized with a minimal implementation for price-cell provenance metadata.

## Added
- Provenance model attached to normalized price records
- Client-side provenance cache helpers
- Tooltip model carrying source URL, fetched time, confidence, parser version, raw snippet
- Quick-open action for source verification
- Accessibility hints for hover/focus and expanded panel label
- Mandatory price normalization layer (`src/price-normalization.ts`) converting mixed token price units into:
  - USD per 1M input tokens
  - USD per 1M output tokens
  - USD per 1M cached input/cached output (optional)
- `PriceNormalizedSchema` (Zod) for required schema validation before persistence/upsert
- Unit alias converter support for common formats (`usd/1m`, `usd/1k`, `usd/token`, `cents/...`)
- Currency validation (currently strict USD whitelist)
- Statistical outlier guard (`baselineMedianUsdPer1M` with max-multiple threshold) to block abnormal values before upsert
