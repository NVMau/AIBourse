import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { AlertNotifier } from "./notifier.ts";

const alert = {
  watchRuleId: "r1",
  model: "gpt-5.3-codex",
  event: {
    model: "gpt-5.3-codex",
    previousPrice: 1,
    currentPrice: 2,
    currency: "USD",
    occurredAtIso: "2026-04-19T10:00:00.000Z",
    monthlyAccumulatedCost: 42,
  },
  reasons: [{ kind: "rise", percent: 100, threshold: 15 }],
} as const;

test("maps Slack payload to text field", async () => {
  const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
  const notifier = new AlertNotifier(async (url, init) => {
    calls.push({ url, body: init.body, headers: init.headers });
  });

  await notifier.send(alert as never, [{ kind: "slack", webhookUrl: "https://slack.example" }]);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].body).text !== undefined, true);
});

test("maps Discord payload to content field", async () => {
  const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
  const notifier = new AlertNotifier(async (url, init) => {
    calls.push({ url, body: init.body, headers: init.headers });
  });

  await notifier.send(alert as never, [{ kind: "discord", webhookUrl: "https://discord.example" }]);
  assert.equal(calls.length, 1);
  const payload = JSON.parse(calls[0].body);
  assert.equal(typeof payload.content, "string");
  assert.equal(payload.text, undefined);
});

test("signs generic webhook payload with HMAC SHA-256", async () => {
  const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
  const secret = "super-secret";
  const notifier = new AlertNotifier(async (url, init) => {
    calls.push({ url, body: init.body, headers: init.headers });
  });

  await notifier.send(alert as never, [{ kind: "webhook", url: "https://hook.example", secret }]);

  assert.equal(calls.length, 1);
  const call = calls[0];
  const expected = createHmac("sha256", secret).update(call.body).digest("hex");
  assert.equal(call.headers["x-signature-sha256"], expected);
});
