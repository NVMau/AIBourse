# AIBourse - Price Safety & Provenance Foundations

This repository contains minimal TypeScript foundations for pricing integrity flows.

## Added (existing)
- Provenance model attached to normalized price records
- Client-side provenance cache helpers
- Tooltip model carrying source URL, fetched time, confidence, parser version, raw snippet
- Quick-open action for source verification
- Accessibility hints for hover/focus and expanded panel label

## Added (task 10be69b1-a90b-4668-bdcd-ab359d859ec5)
- Rule-engine driven abnormal price detection by provider/model
- Short-term history median baseline comparison
- `suspicious_change` flagging for records beyond threshold (default ±30%)
- Moderation queue item model for internal review before public publish
- Admin review transitions: approve / reject / publish gating
- Ops alert message builder for fast verification handoff

## Core file
- `src/anomaly-moderation.ts`

## Flow summary
1. Resolve threshold rule by provider/model (with wildcard fallback)
2. Compare incoming price against short-term median baseline
3. If threshold exceeded, move record to `pending_review` (not auto-publish)
4. Trigger ops alert payload/message for internal verification
5. Admin approves/rejects in panel, then approved item can be published
