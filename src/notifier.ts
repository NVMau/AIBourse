import { createHmac } from "node:crypto";
import { buildAlertMessage } from "./alert-message.ts";
import type { DeliveryTarget, TriggeredAlert } from "./watchlist.ts";

export type WebhookClient = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<void>;

export class AlertNotifier {
  private readonly post: WebhookClient;

  constructor(post: WebhookClient) {
    this.post = post;
  }

  async send(alert: TriggeredAlert, targets: DeliveryTarget[]): Promise<void> {
    const message = buildAlertMessage(alert);

    for (const target of targets) {
      if (target.kind === "slack") {
        await this.post(target.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: message }),
        });
        continue;
      }

      if (target.kind === "discord") {
        await this.post(target.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: message }),
        });
        continue;
      }

      const payload = {
        type: "cost.watchlist.alert",
        sentAtIso: new Date().toISOString(),
        alert,
      };
      const raw = JSON.stringify(payload);
      const signature = createHmac("sha256", target.secret).update(raw).digest("hex");

      await this.post(target.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature-sha256": signature,
        },
        body: raw,
      });
    }
  }
}
