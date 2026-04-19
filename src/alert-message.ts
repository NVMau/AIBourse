import { TriggeredAlert, TriggeredAlertReason } from "./watchlist";

function renderReason(reason: TriggeredAlertReason) {
  if (reason.kind === "drop") {
    return `Giảm ${reason.percent.toFixed(2)}% (ngưỡng ${reason.threshold}%)`;
  }
  if (reason.kind === "rise") {
    return `Tăng ${reason.percent.toFixed(2)}% (ngưỡng ${reason.threshold}%)`;
  }
  return `Tổng chi phí tháng ${reason.total.toFixed(2)} vượt ngưỡng ${reason.threshold.toFixed(2)}`;
}

export function buildAlertMessage(alert: TriggeredAlert): string {
  const reasons = alert.reasons.map(renderReason).join("; ");
  return [
    "🚨 Cost Watchlist Alert",
    `Model: ${alert.model}`,
    `Price: ${alert.event.previousPrice} -> ${alert.event.currentPrice} ${alert.event.currency}`,
    `Monthly accumulated: ${alert.event.monthlyAccumulatedCost.toFixed(2)} ${alert.event.currency}`,
    `Reasons: ${reasons}`,
    `Occurred at: ${alert.event.occurredAtIso}`,
  ].join("\n");
}
