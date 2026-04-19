# AIBourse - Price Intelligence Core

This repository now includes a versioned `price_history` domain model and `/changes` API logic to support trend tracking.

## Added
- Versioned `price_history` model (`src/price-history.ts`) with fields:
  - `effectiveFrom`
  - `detectedAt`
  - `sourceUrl`
  - `parserVersion`
  - `checksum`
- Composite key normalization on `model + provider + region + pricingType + currency`
- Diff-aware append flow that computes:
  - `deltaAbsolute`
  - `deltaPercent`
  - `trend` (`up` | `down` | `stable`)
- `/changes` API handler (`src/changes-api.ts`) supporting:
  - periods `7d`, `30d`, `90d`
  - optional filters `provider`, `model`

## Existing
- Provenance model attached to normalized price records
- Client-side provenance cache helpers
- Tooltip model carrying source URL, fetched time, confidence, parser version, raw snippet
