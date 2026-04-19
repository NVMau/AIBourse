import { PriceChangeEvent, TriggeredAlert, TriggeredAlertReason, WatchRule } from "./watchlist";

function percentageChange(previousPrice: number, currentPrice: number) {
  if (previousPrice === 0) {
    return 0;
  }
  return ((currentPrice - previousPrice) / previousPrice) * 100;
}

export class WatchlistRuleEngine {
  evaluateRule(rule: WatchRule, event: PriceChangeEvent): TriggeredAlert | null {
    if (rule.model !== event.model) {
      return null;
    }

    const deltaPercent = percentageChange(event.previousPrice, event.currentPrice);
    const reasons: TriggeredAlertReason[] = [];

    if (typeof rule.dropPercent === "number" && deltaPercent <= -Math.abs(rule.dropPercent)) {
      reasons.push({ kind: "drop", percent: Math.abs(deltaPercent), threshold: Math.abs(rule.dropPercent) });
    }

    if (typeof rule.risePercent === "number" && deltaPercent >= Math.abs(rule.risePercent)) {
      reasons.push({ kind: "rise", percent: deltaPercent, threshold: Math.abs(rule.risePercent) });
    }

    if (
      typeof rule.monthlyCostCap === "number" &&
      event.monthlyAccumulatedCost >= Math.abs(rule.monthlyCostCap)
    ) {
      reasons.push({
        kind: "monthly_cap",
        total: event.monthlyAccumulatedCost,
        threshold: Math.abs(rule.monthlyCostCap),
      });
    }

    if (!reasons.length) {
      return null;
    }

    return {
      watchRuleId: rule.id,
      model: rule.model,
      event,
      reasons,
    };
  }

  evaluateAll(rules: WatchRule[], event: PriceChangeEvent): TriggeredAlert[] {
    return rules
      .map((rule) => this.evaluateRule(rule, event))
      .filter((result): result is TriggeredAlert => result !== null);
  }
}
