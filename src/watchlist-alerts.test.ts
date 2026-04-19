import assert from "node:assert/strict";
import test from "node:test";
import {
  AlertService,
  InMemoryWatchlistStore,
  Notifier,
  RuleEngine,
  computePercentDelta,
  signWebhook,
  type MonthlySpendSnapshot,
  type PriceChangeEvent,
  type Watchlist,
} from "./watchlist-alerts.ts";

class FakeNotifier extends Notifier {
  delivered: Array<{ title: string; message: string; channels: number }> = [];

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super((async () => ({ ok: true })) as any);
  }

  // @ts-ignore override for testing
  async deliver(alert, channels) {
    this.delivered.push({ title: alert.title, message: alert.message, channels: channels.length });
  }
}

test("computePercentDelta supports increase and decrease", () => {
  assert.equal(computePercentDelta(100, 115), 15);
  assert.equal(computePercentDelta(100, 90), -10);
});

test("signWebhook generates stable hmac header format", () => {
  const sig = signWebhook('{"ok":true}', "secret");
  assert.match(sig, /^sha256=[a-f0-9]{64}$/);
});

test("instant mode emits price alerts for tracked model", async () => {
  const store = new InMemoryWatchlistStore();
  const notifier = new FakeNotifier();
  const service = new AlertService(store, new RuleEngine(), notifier);

  const watchlist: Watchlist = {
    workspaceId: "ws-1",
    models: ["gpt-5"],
    mode: "instant",
    updatedAtIso: new Date().toISOString(),
    rules: [
      {
        id: "r1",
        type: "price_change",
        direction: "increase",
        percent: 15,
        channels: [{ type: "slack", webhookUrl: "https://hooks.slack.test/abc" }],
      },
      {
        id: "r2",
        type: "price_change",
        direction: "decrease",
        percent: 10,
        channels: [{ type: "discord", webhookUrl: "https://discord.test/hook" }],
      },
    ],
  };

  await store.upsert(watchlist);

  const event: PriceChangeEvent = {
    model: "gpt-5",
    oldPrice: 1,
    newPrice: 1.2,
    currency: "USD",
    changedAtIso: new Date().toISOString(),
  };

  const alerts = await service.onPriceChange(event);
  assert.equal(alerts.length, 1);
  assert.equal(notifier.delivered.length, 1);
  assert.match(notifier.delivered[0].title, /increased/i);
});

test("scheduled mode emits monthly budget alert", async () => {
  const store = new InMemoryWatchlistStore();
  const notifier = new FakeNotifier();
  const service = new AlertService(store, new RuleEngine(), notifier);

  const watchlist: Watchlist = {
    workspaceId: "ws-2",
    models: ["claude-4"],
    mode: "scheduled",
    scheduleCron: "0 */6 * * *",
    updatedAtIso: new Date().toISOString(),
    rules: [
      {
        id: "m1",
        type: "monthly_budget",
        threshold: 500,
        channels: [{ type: "webhook", url: "https://example.com/webhook", secret: "k" }],
      },
    ],
  };
  await store.upsert(watchlist);

  const snapshots: Record<string, MonthlySpendSnapshot> = {
    "ws-2": {
      monthKey: "2026-04",
      totalCost: 700,
      currency: "USD",
      updatedAtIso: new Date().toISOString(),
    },
  };

  const alerts = await service.runScheduledEvaluation(snapshots);
  assert.equal(alerts.length, 1);
  assert.equal(notifier.delivered.length, 1);
  assert.match(notifier.delivered[0].title, /threshold exceeded/i);
});
