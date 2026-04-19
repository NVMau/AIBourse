export type PricingType = "input" | "output" | "cached_input" | "fine_tuning";

export type PriceKey = {
  model: string;
  provider: string;
  region: string;
  pricingType: PricingType;
  currency: string;
};

export type PriceSnapshot = PriceKey & {
  unitPrice: number;
  effectiveFrom: string;
  detectedAt: string;
  sourceUrl: string;
  parserVersion: string;
  checksum: string;
};

export type PriceHistoryRecord = PriceSnapshot & {
  version: number;
  previousVersion: number | null;
  previousUnitPrice: number | null;
  deltaAbsolute: number;
  deltaPercent: number | null;
  trend: "up" | "down" | "stable";
};

export type TimeWindow = "7d" | "30d" | "90d";

export type PriceChange = {
  key: PriceKey;
  latest: PriceHistoryRecord;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function keyOf(snapshot: PriceKey): string {
  return [
    snapshot.model,
    snapshot.provider,
    snapshot.region,
    snapshot.pricingType,
    snapshot.currency,
  ].join("::");
}

function byDetectedAtAsc(a: PriceHistoryRecord, b: PriceHistoryRecord) {
  return Date.parse(a.detectedAt) - Date.parse(b.detectedAt);
}

function computeTrend(prev: number | null, next: number): "up" | "down" | "stable" {
  if (prev === null) return "stable";
  if (next > prev) return "up";
  if (next < prev) return "down";
  return "stable";
}

export class PriceHistoryStore {
  private readonly records: PriceHistoryRecord[] = [];

  appendVersion(snapshot: PriceSnapshot): PriceHistoryRecord {
    const compositeKey = keyOf(snapshot);

    const previous = this.records
      .filter((r) => keyOf(r) === compositeKey)
      .sort((a, b) => b.version - a.version)[0] ?? null;

    const previousUnitPrice = previous?.unitPrice ?? null;
    const deltaAbsolute = previousUnitPrice === null ? 0 : snapshot.unitPrice - previousUnitPrice;
    const deltaPercent =
      previousUnitPrice === null || previousUnitPrice === 0
        ? null
        : (deltaAbsolute / previousUnitPrice) * 100;

    const next: PriceHistoryRecord = {
      ...snapshot,
      version: (previous?.version ?? 0) + 1,
      previousVersion: previous?.version ?? null,
      previousUnitPrice,
      deltaAbsolute,
      deltaPercent,
      trend: computeTrend(previousUnitPrice, snapshot.unitPrice),
    };

    this.records.push(next);
    return next;
  }

  getAll(): PriceHistoryRecord[] {
    return [...this.records].sort(byDetectedAtAsc);
  }

  getChanges(params: {
    window: TimeWindow;
    nowIso?: string;
    provider?: string;
    model?: string;
  }): PriceChange[] {
    const now = Date.parse(params.nowIso ?? new Date().toISOString());
    const days = params.window === "7d" ? 7 : params.window === "30d" ? 30 : 90;
    const threshold = now - days * MS_PER_DAY;

    const filtered = this.records.filter((r) => {
      const ts = Date.parse(r.detectedAt);
      if (Number.isNaN(ts) || ts < threshold) return false;
      if (params.provider && r.provider !== params.provider) return false;
      if (params.model && r.model !== params.model) return false;
      return true;
    });

    const latestByKey = new Map<string, PriceHistoryRecord>();
    for (const row of filtered) {
      const compositeKey = keyOf(row);
      const current = latestByKey.get(compositeKey);
      if (!current || Date.parse(row.detectedAt) > Date.parse(current.detectedAt)) {
        latestByKey.set(compositeKey, row);
      }
    }

    return [...latestByKey.values()]
      .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt))
      .map((latest) => ({
        key: {
          model: latest.model,
          provider: latest.provider,
          region: latest.region,
          pricingType: latest.pricingType,
          currency: latest.currency,
        },
        latest,
      }));
  }
}
