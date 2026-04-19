import test from "node:test";
import assert from "node:assert/strict";
import { WatchlistRuleEngine } from "./rule-engine.ts";

const baseEvent = {
  model: "gpt-5.3-codex",
  previousPrice: 100,
  currentPrice: 100,
  currency: "USD",
  occurredAtIso: "2026-04-19T10:00:00.000Z",
  monthlyAccumulatedCost: 0,
};

test("triggers drop alert when decrease exceeds threshold", () => {
  const engine = new WatchlistRuleEngine();
  const rule = { id: "r1", model: "gpt-5.3-codex", dropPercent: 10 };

  const alert = engine.evaluateRule(rule, { ...baseEvent, currentPrice: 85 });
  assert.ok(alert);
  assert.equal(alert.reasons[0]?.kind, "drop");
});

test("triggers rise alert when increase exceeds threshold", () => {
  const engine = new WatchlistRuleEngine();
  const rule = { id: "r2", model: "gpt-5.3-codex", risePercent: 15 };

  const alert = engine.evaluateRule(rule, { ...baseEvent, currentPrice: 120 });
  assert.ok(alert);
  assert.equal(alert.reasons[0]?.kind, "rise");
});

test("triggers monthly cap alert when accumulated cost exceeds cap", () => {
  const engine = new WatchlistRuleEngine();
  const rule = { id: "r3", model: "gpt-5.3-codex", monthlyCostCap: 500 };

  const alert = engine.evaluateRule(rule, { ...baseEvent, monthlyAccumulatedCost: 650 });
  assert.ok(alert);
  assert.equal(alert.reasons[0]?.kind, "monthly_cap");
});
