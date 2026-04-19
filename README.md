# AIBourse - Per-Cell Provenance + Cost Watchlist Alerts

This repository includes baseline provenance metadata plus watchlist-based cost alerting.

## Added (existing)
- Provenance model attached to normalized price records
- Client-side provenance cache helpers
- Tooltip model carrying source URL, fetched time, confidence, parser version, raw snippet
- Quick-open action for source verification
- Accessibility hints for hover/focus and expanded panel label

## Added (this task: watchlist + alerts)
- Workspace-scoped watchlist model (`src/watchlist.ts`)
- File-based workspace watchlist persistence (`src/watchlist-store.ts`)
- Rule engine for thresholds on price drop / price rise / monthly cost cap (`src/rule-engine.ts`)
- Alert message builder for operator-friendly notifications (`src/alert-message.ts`)
- Multi-channel notifier adapters:
  - Slack webhook
  - Discord webhook
  - Generic outbound webhook with `x-signature-sha256` HMAC signing (`src/notifier.ts`)
- Orchestration service for:
  - instant alerts on `price_change` stream
  - scheduled alert flushing (`src/watchlist-service.ts`)

## Rule semantics
For each watched model, alerts can trigger on:
- `dropPercent`: fires when price decreases by at least threshold (e.g. 10%)
- `risePercent`: fires when price increases by at least threshold (e.g. 15%)
- `monthlyCostCap`: fires when monthly accumulated cost reaches/exceeds cap

## Modes
- `instant`: send immediately when a matching event arrives
- `scheduled`: collect alerts and send on scheduler tick (via `flushScheduledAlerts`)

## Security notes
- Outbound generic webhooks are signed with HMAC SHA-256 over JSON body.
- Signature header: `x-signature-sha256`
