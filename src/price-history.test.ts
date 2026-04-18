import assert from "node:assert/strict";
import { PriceHistoryStore } from "./price-history";

const store = new PriceHistoryStore();

store.appendVersion({
  model: "gpt-5",
  provider: "openai",
  region: "global",
  pricingType: "input",
  currency: "USD",
  unitPrice: 10,
  effectiveFrom: "2026-04-10T00:00:00.000Z",
  detectedAt: "2026-04-10T01:00:00.000Z",
  sourceUrl: "https://example.com/pricing/v1",
  parserVersion: "p1",
  checksum: "a1",
});

const v2 = store.appendVersion({
  model: "gpt-5",
  provider: "openai",
  region: "global",
  pricingType: "input",
  currency: "USD",
  unitPrice: 8,
  effectiveFrom: "2026-04-12T00:00:00.000Z",
  detectedAt: "2026-04-12T01:00:00.000Z",
  sourceUrl: "https://example.com/pricing/v2",
  parserVersion: "p2",
  checksum: "a2",
});

assert.equal(v2.version, 2);
assert.equal(v2.previousVersion, 1);
assert.equal(v2.trend, "down");
assert.equal(Math.round((v2.deltaPercent ?? 0) * 100) / 100, -20);

const changes = store.getChanges({
  window: "7d",
  nowIso: "2026-04-13T00:00:00.000Z",
  provider: "openai",
});

assert.equal(changes.length, 1);
assert.equal(changes[0].latest.trend, "down");
assert.equal(changes[0].latest.version, 2);

console.log("price-history tests passed");
