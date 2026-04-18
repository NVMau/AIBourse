import type { NormalizedPriceRecord } from "./provenance.ts";

export type ProviderModelRule = {
  provider: string;
  model: string;
  changeThresholdPct: number;
  minHistoryPoints: number;
};

export type ShortTermHistoryPoint = {
  price: number;
  atIso: string;
};

export type ChangeEvaluation = {
  baselineMedian: number | null;
  changeRatio: number | null;
  changePct: number | null;
  exceedsThreshold: boolean;
  reason: "insufficient_history" | "no_baseline" | "within_threshold" | "threshold_exceeded";
};

export type ModerationStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "published";

export type SuspiciousPriceRecord = {
  record: NormalizedPriceRecord;
  provider: string;
  model: string;
  suspicious_change: boolean;
  ruleUsed: ProviderModelRule;
  evaluation: ChangeEvaluation;
  queuedAtIso: string;
};

export type ModerationQueueItem = {
  id: string;
  status: ModerationStatus;
  payload: SuspiciousPriceRecord;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAtIso?: string;
};

export const DEFAULT_RULE: ProviderModelRule = {
  provider: "*",
  model: "*",
  changeThresholdPct: 30,
  minHistoryPoints: 5,
};

export const resolveRule = (
  rules: ProviderModelRule[],
  provider: string,
  model: string,
): ProviderModelRule => {
  return (
    rules.find((r) => r.provider === provider && r.model === model) ??
    rules.find((r) => r.provider === provider && r.model === "*") ??
    rules.find((r) => r.provider === "*" && r.model === model) ??
    DEFAULT_RULE
  );
};

export const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

export const evaluateAgainstHistory = (
  currentPrice: number,
  history: ShortTermHistoryPoint[],
  thresholdPct: number,
  minHistoryPoints: number,
): ChangeEvaluation => {
  if (history.length < minHistoryPoints) {
    return {
      baselineMedian: null,
      changeRatio: null,
      changePct: null,
      exceedsThreshold: false,
      reason: "insufficient_history",
    };
  }

  const baselineMedian = median(history.map((x) => x.price));
  if (baselineMedian === null || baselineMedian === 0) {
    return {
      baselineMedian,
      changeRatio: null,
      changePct: null,
      exceedsThreshold: false,
      reason: "no_baseline",
    };
  }

  const changeRatio = (currentPrice - baselineMedian) / baselineMedian;
  const changePct = changeRatio * 100;
  const exceedsThreshold = Math.abs(changePct) >= thresholdPct;

  return {
    baselineMedian,
    changeRatio,
    changePct,
    exceedsThreshold,
    reason: exceedsThreshold ? "threshold_exceeded" : "within_threshold",
  };
};

export const createModerationQueueItem = (input: {
  id: string;
  record: NormalizedPriceRecord;
  provider: string;
  model: string;
  history: ShortTermHistoryPoint[];
  rules: ProviderModelRule[];
  queuedAtIso?: string;
}): ModerationQueueItem => {
  const ruleUsed = resolveRule(input.rules, input.provider, input.model);
  const evaluation = evaluateAgainstHistory(
    input.record.price,
    input.history,
    ruleUsed.changeThresholdPct,
    ruleUsed.minHistoryPoints,
  );

  return {
    id: input.id,
    status: evaluation.exceedsThreshold ? "pending_review" : "published",
    payload: {
      record: input.record,
      provider: input.provider,
      model: input.model,
      suspicious_change: evaluation.exceedsThreshold,
      ruleUsed,
      evaluation,
      queuedAtIso: input.queuedAtIso ?? new Date().toISOString(),
    },
  };
};

export const approveQueueItem = (
  item: ModerationQueueItem,
  reviewer: string,
  note?: string,
): ModerationQueueItem => {
  return {
    ...item,
    status: "approved",
    reviewedBy: reviewer,
    reviewNotes: note,
    reviewedAtIso: new Date().toISOString(),
  };
};

export const rejectQueueItem = (
  item: ModerationQueueItem,
  reviewer: string,
  note: string,
): ModerationQueueItem => {
  return {
    ...item,
    status: "rejected",
    reviewedBy: reviewer,
    reviewNotes: note,
    reviewedAtIso: new Date().toISOString(),
  };
};

export const markPublished = (item: ModerationQueueItem): ModerationQueueItem => {
  if (item.status !== "approved" && item.status !== "published") {
    throw new Error("Only approved items can be published");
  }

  return {
    ...item,
    status: "published",
  };
};

export const buildOpsAlertMessage = (item: ModerationQueueItem): string => {
  const { payload } = item;
  const change = payload.evaluation.changePct;
  const changeText =
    change === null ? "N/A" : `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;

  return [
    "🚨 Suspicious price change detected",
    `Symbol: ${payload.record.symbol}`,
    `Provider/Model: ${payload.provider}/${payload.model}`,
    `Current: ${payload.record.price} ${payload.record.currency}`,
    `Median baseline: ${payload.evaluation.baselineMedian ?? "N/A"}`,
    `Change: ${changeText} (threshold ±${payload.ruleUsed.changeThresholdPct}%)`,
    `Queue item: ${item.id}`,
    "Action required: review in admin panel (approve/reject)",
  ].join("\n");
};
