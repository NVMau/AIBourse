import { PriceHistoryStore, TimeWindow } from "./price-history";

export type ChangesQuery = {
  period?: "7d" | "30d" | "90d";
  provider?: string;
  model?: string;
  nowIso?: string;
};

export type HttpLikeRequest = {
  query: ChangesQuery;
};

export type HttpLikeResponse = {
  status: number;
  body: unknown;
};

const ALLOWED_PERIODS: TimeWindow[] = ["7d", "30d", "90d"];

export function getChangesHandler(store: PriceHistoryStore, req: HttpLikeRequest): HttpLikeResponse {
  const period = req.query.period ?? "7d";

  if (!ALLOWED_PERIODS.includes(period)) {
    return {
      status: 400,
      body: {
        error: "Invalid period. Use one of: 7d, 30d, 90d",
      },
    };
  }

  const changes = store.getChanges({
    window: period,
    nowIso: req.query.nowIso,
    provider: req.query.provider,
    model: req.query.model,
  });

  return {
    status: 200,
    body: {
      period,
      count: changes.length,
      changes,
    },
  };
}
