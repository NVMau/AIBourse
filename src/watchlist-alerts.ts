import crypto from "node:crypto";

export type Direction = "increase" | "decrease";

export type PriceChangeEvent = {
  model: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  changedAtIso: string;
};

export type MonthlySpendSnapshot = {
  monthKey: string;
  totalCost: number;
  currency: string;
  updatedAtIso: string;
};

export type WatchRule =
  | {
      id: string;
      type: "price_change";
      direction: Direction;
      percent: number;
      enabled?: boolean;
      channels: NotificationChannel[];
    }
  | {
      id: string;
      type: "monthly_budget";
      threshold: number;
      enabled?: boolean;
      channels: NotificationChannel[];
    };

export type Watchlist = {
  workspaceId: string;
  models: string[];
  rules: WatchRule[];
  mode: "instant" | "scheduled";
  scheduleCron?: string;
  updatedAtIso: string;
};

export type Alert = {
  id: string;
  workspaceId: string;
  model?: string;
  ruleId: string;
  triggeredAtIso: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
};

export type NotificationChannel =
  | {
      type: "slack";
      webhookUrl: string;
    }
  | {
      type: "discord";
      webhookUrl: string;
    }
  | {
      type: "webhook";
      url: string;
      secret: string;
    };

export interface WatchlistStore {
  get(workspaceId: string): Promise<Watchlist | null>;
  upsert(watchlist: Watchlist): Promise<void>;
  list(): Promise<Watchlist[]>;
}

export class InMemoryWatchlistStore implements WatchlistStore {
  private readonly db = new Map<string, Watchlist>();

  async get(workspaceId: string): Promise<Watchlist | null> {
    return this.db.get(workspaceId) ?? null;
  }

  async upsert(watchlist: Watchlist): Promise<void> {
    this.db.set(watchlist.workspaceId, watchlist);
  }

  async list(): Promise<Watchlist[]> {
    return [...this.db.values()];
  }
}

export class RuleEngine {
  evaluatePriceChange(watchlist: Watchlist, event: PriceChangeEvent): Alert[] {
    if (!watchlist.models.includes(event.model)) return [];

    const deltaPct = computePercentDelta(event.oldPrice, event.newPrice);
    const now = new Date().toISOString();

    return watchlist.rules
      .filter((r): r is Extract<WatchRule, { type: "price_change" }> => r.type === "price_change")
      .filter((r) => r.enabled !== false)
      .filter((r) => {
        if (r.direction === "increase") return deltaPct >= r.percent;
        return deltaPct <= -Math.abs(r.percent);
      })
      .map((rule) => ({
        id: crypto.randomUUID(),
        workspaceId: watchlist.workspaceId,
        model: event.model,
        ruleId: rule.id,
        triggeredAtIso: now,
        title: `Cost ${rule.direction === "increase" ? "increased" : "decreased"} for ${event.model}`,
        message: `Model ${event.model} moved ${deltaPct.toFixed(2)}% (${event.oldPrice} -> ${event.newPrice} ${event.currency})`,
        payload: { event, deltaPct, rule },
      }));
  }

  evaluateMonthlyBudget(watchlist: Watchlist, snapshot: MonthlySpendSnapshot): Alert[] {
    const now = new Date().toISOString();

    return watchlist.rules
      .filter((r): r is Extract<WatchRule, { type: "monthly_budget" }> => r.type === "monthly_budget")
      .filter((r) => r.enabled !== false)
      .filter((r) => snapshot.totalCost >= r.threshold)
      .map((rule) => ({
        id: crypto.randomUUID(),
        workspaceId: watchlist.workspaceId,
        ruleId: rule.id,
        triggeredAtIso: now,
        title: `Monthly budget threshold exceeded (${snapshot.monthKey})`,
        message: `Total monthly spend ${snapshot.totalCost} ${snapshot.currency} exceeded ${rule.threshold} ${snapshot.currency}`,
        payload: { snapshot, rule },
      }));
  }
}

export function computePercentDelta(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    if (newValue === 0) return 0;
    return 100;
  }
  return ((newValue - oldValue) / oldValue) * 100;
}

export class Notifier {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  async deliver(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    for (const c of channels) {
      if (c.type === "slack") {
        await this.fetchImpl(c.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: `🚨 ${alert.title}\n${alert.message}` }),
        });
      } else if (c.type === "discord") {
        await this.fetchImpl(c.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: `🚨 **${alert.title}**\n${alert.message}` }),
        });
      } else {
        const rawBody = JSON.stringify({ alert });
        const signature = signWebhook(rawBody, c.secret);
        await this.fetchImpl(c.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-aibourse-signature": signature,
          },
          body: rawBody,
        });
      }
    }
  }
}

export function signWebhook(body: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

export class AlertService {
  private readonly store: WatchlistStore;
  private readonly ruleEngine: RuleEngine;
  private readonly notifier: Notifier;

  constructor(store: WatchlistStore, ruleEngine: RuleEngine, notifier: Notifier) {
    this.store = store;
    this.ruleEngine = ruleEngine;
    this.notifier = notifier;
  }

  async onPriceChange(event: PriceChangeEvent): Promise<Alert[]> {
    const watchlists = await this.store.list();
    const allAlerts: Alert[] = [];

    for (const wl of watchlists) {
      if (wl.mode !== "instant") continue;
      const alerts = this.ruleEngine.evaluatePriceChange(wl, event);
      for (const alert of alerts) {
        const rule = wl.rules.find((r) => r.id === alert.ruleId);
        if (!rule) continue;
        await this.notifier.deliver(alert, rule.channels);
        allAlerts.push(alert);
      }
    }

    return allAlerts;
  }

  async runScheduledEvaluation(snapshotByWorkspace: Record<string, MonthlySpendSnapshot>): Promise<Alert[]> {
    const watchlists = await this.store.list();
    const allAlerts: Alert[] = [];

    for (const wl of watchlists) {
      if (wl.mode !== "scheduled") continue;
      const snapshot = snapshotByWorkspace[wl.workspaceId];
      if (!snapshot) continue;

      const alerts = this.ruleEngine.evaluateMonthlyBudget(wl, snapshot);
      for (const alert of alerts) {
        const rule = wl.rules.find((r) => r.id === alert.ruleId);
        if (!rule) continue;
        await this.notifier.deliver(alert, rule.channels);
        allAlerts.push(alert);
      }
    }

    return allAlerts;
  }
}
