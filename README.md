# AIBourse - Per-Cell Provenance + Cost Watchlist Alerts

This repository includes provenance metadata helpers and watchlist-based cost alerting capabilities.

## Added (existing baseline)
- Provenance model attached to normalized price records
- Client-side provenance cache helpers
- Tooltip model carrying source URL, fetched time, confidence, parser version, raw snippet
- Quick-open action for source verification
- Accessibility hints for hover/focus and expanded panel label

## Added (watchlist + alerts)
- Workspace-scoped watchlist model with tracked models and rule set.
- Rule engine for:
  - price change increase/decrease thresholds (e.g. +15%, -10%),
  - monthly total-cost budget threshold.
- Support for alerting modes:
  - `instant`: evaluate on `price_change` stream events,
  - `scheduled`: evaluate in periodic batches (cron-driven by caller).
- Notification adapters:
  - Slack incoming webhook
  - Discord webhook
  - generic outbound webhook with HMAC signature.
- Alert orchestration service to evaluate rules and dispatch alerts.
- Unit tests for threshold logic, webhook signing, and dispatch flow.

## Key files
- `src/provenance.ts`: provenance metadata model.
- `src/provenance-ui.ts`: tooltip rendering + in-memory cache.
- Existing split implementation:
  - `src/watchlist.ts`
  - `src/watchlist-store.ts`
  - `src/rule-engine.ts`
  - `src/notifier.ts`
  - `src/alert-message.ts`
  - `src/watchlist-service.ts`
- Added consolidated module:
  - `src/watchlist-alerts.ts`
  - `src/watchlist-alerts.test.ts`
