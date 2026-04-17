export type PriceProvenance = {
  sourceUrl: string;
  fetchedAtIso: string;
  parseConfidence: number;
  parserVersion: string;
  rawSnippet: string;
};

export type NormalizedPriceRecord = {
  symbol: string;
  provider: string;
  price: number;
  currency: string;
  provenance: PriceProvenance;
};

export const toProvenance = (input: Partial<PriceProvenance>): PriceProvenance => ({
  sourceUrl: input.sourceUrl ?? "",
  fetchedAtIso: input.fetchedAtIso ?? new Date(0).toISOString(),
  parseConfidence: Math.max(0, Math.min(1, input.parseConfidence ?? 0)),
  parserVersion: input.parserVersion ?? "unknown",
  rawSnippet: input.rawSnippet ?? "",
});
