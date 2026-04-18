import {
  DEFAULT_RULE,
  createModerationQueueItem,
  evaluateAgainstHistory,
  median,
  resolveRule,
} from "./anomaly-moderation.ts";
import type { ProviderModelRule } from "./anomaly-moderation.ts";
import { toProvenance } from "./provenance.ts";

const sampleRecord = {
  symbol: "BTCUSDT",
  provider: "provider-a",
  price: 140,
  currency: "USD",
  provenance: toProvenance({ sourceUrl: "https://example.com/prices" }),
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

(() => {
  assert(median([1, 3, 2]) === 2, "median odd set");
  assert(median([1, 2, 3, 4]) === 2.5, "median even set");

  const rules: ProviderModelRule[] = [
    { provider: "provider-a", model: "m1", changeThresholdPct: 20, minHistoryPoints: 3 },
    { provider: "provider-a", model: "*", changeThresholdPct: 25, minHistoryPoints: 3 },
  ];

  const r1 = resolveRule(rules, "provider-a", "m1");
  assert(r1.changeThresholdPct === 20, "exact rule resolution");

  const r2 = resolveRule(rules, "provider-a", "m2");
  assert(r2.changeThresholdPct === 25, "provider wildcard rule resolution");

  const r3 = resolveRule([], "x", "y");
  assert(r3.changeThresholdPct === DEFAULT_RULE.changeThresholdPct, "default fallback");

  const evalResult = evaluateAgainstHistory(
    140,
    [
      { price: 100, atIso: new Date().toISOString() },
      { price: 101, atIso: new Date().toISOString() },
      { price: 99, atIso: new Date().toISOString() },
      { price: 102, atIso: new Date().toISOString() },
      { price: 100, atIso: new Date().toISOString() },
    ],
    30,
    5,
  );

  assert(evalResult.exceedsThreshold === true, "should flag suspicious change");

  const queueItem = createModerationQueueItem({
    id: "q-1",
    record: sampleRecord,
    provider: "provider-a",
    model: "m1",
    history: [
      { price: 100, atIso: new Date().toISOString() },
      { price: 101, atIso: new Date().toISOString() },
      { price: 99, atIso: new Date().toISOString() },
      { price: 102, atIso: new Date().toISOString() },
      { price: 100, atIso: new Date().toISOString() },
    ],
    rules,
  });

  assert(queueItem.status === "pending_review", "pending review when threshold exceeded");
  assert(queueItem.payload.suspicious_change === true, "suspicious_change flag set");

  const safeItem = createModerationQueueItem({
    id: "q-2",
    record: { ...sampleRecord, price: 105 },
    provider: "provider-a",
    model: "m1",
    history: [
      { price: 100, atIso: new Date().toISOString() },
      { price: 101, atIso: new Date().toISOString() },
      { price: 99, atIso: new Date().toISOString() },
      { price: 102, atIso: new Date().toISOString() },
      { price: 100, atIso: new Date().toISOString() },
    ],
    rules,
  });

  assert(safeItem.status === "published", "auto-publish when within threshold");

  console.log("anomaly-moderation tests passed");
})();
