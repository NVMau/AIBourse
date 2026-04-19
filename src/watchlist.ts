export type AlertMode = "instant" | "scheduled";

export type DeliveryTarget =
  | { kind: "slack"; webhookUrl: string }
  | { kind: "discord"; webhookUrl: string }
  | { kind: "webhook"; url: string; secret: string };

export type WatchRule = {
  id: string;
  model: string;
  dropPercent?: number;
  risePercent?: number;
  monthlyCostCap?: number;
};

export type Watchlist = {
  workspaceId: string;
  alertMode: AlertMode;
  scheduleCron?: string;
  rules: WatchRule[];
  delivery: DeliveryTarget[];
  createdAtIso: string;
  updatedAtIso: string;
};

export type PriceChangeEvent = {
  model: string;
  previousPrice: number;
  currentPrice: number;
  currency: string;
  occurredAtIso: string;
  monthlyAccumulatedCost: number;
};

export type TriggeredAlertReason =
  | { kind: "drop"; percent: number; threshold: number }
  | { kind: "rise"; percent: number; threshold: number }
  | { kind: "monthly_cap"; total: number; threshold: number };

export type TriggeredAlert = {
  watchRuleId: string;
  model: string;
  event: PriceChangeEvent;
  reasons: TriggeredAlertReason[];
};
