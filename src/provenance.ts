export type Sha256 = string;

export type ParserInfo = {
  name: string;
  version: string;
  configVersion?: string;
};

export type CrawlInfo = {
  crawledAtIso: string;
  fetchedAtIso: string;
  crawlerJobId?: string;
  userAgent?: string;
};

export type RawSnapshotRef = {
  objectUrl: string;
  mimeType: string;
  byteSize: number;
  sha256: Sha256;
};

export type PriceProvenance = {
  recordId: string;
  modelId: string;
  metric: "input_price" | "output_price" | "throughput" | "context_window" | "benchmark";
  sourceUrl: string;
  sourceTitle?: string;
  sourceCapturedAtIso?: string;
  crawl: CrawlInfo;
  parser: ParserInfo;
  parseConfidence: number;
  rawSnippet: string;
  rawSnapshot: RawSnapshotRef;
  checksum: Sha256;
  notes?: string;
};

export type NormalizedPriceRecord = {
  recordId: string;
  symbol: string;
  provider: string;
  metric: PriceProvenance["metric"];
  value: number;
  unit: string;
  currency?: string;
  snapshotAtIso: string;
  provenance: PriceProvenance;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function normalizeIso(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString();
}

function normalizeSha(input: string | undefined): Sha256 {
  const value = (input ?? "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(value) ? value : "";
}

export const toProvenance = (input: Partial<PriceProvenance>): PriceProvenance => {
  const now = new Date(0).toISOString();
  const crawledAtIso = normalizeIso(input.crawl?.crawledAtIso, now);
  const fetchedAtIso = normalizeIso(input.crawl?.fetchedAtIso, crawledAtIso);

  return {
    recordId: input.recordId ?? "",
    modelId: input.modelId ?? "",
    metric: input.metric ?? "input_price",
    sourceUrl: input.sourceUrl ?? "",
    sourceTitle: input.sourceTitle,
    sourceCapturedAtIso: normalizeIso(input.sourceCapturedAtIso, fetchedAtIso),
    crawl: {
      crawledAtIso,
      fetchedAtIso,
      crawlerJobId: input.crawl?.crawlerJobId,
      userAgent: input.crawl?.userAgent,
    },
    parser: {
      name: input.parser?.name ?? "unknown",
      version: input.parser?.version ?? "unknown",
      configVersion: input.parser?.configVersion,
    },
    parseConfidence: clamp01(input.parseConfidence ?? 0),
    rawSnippet: input.rawSnippet ?? "",
    rawSnapshot: {
      objectUrl: input.rawSnapshot?.objectUrl ?? "",
      mimeType: input.rawSnapshot?.mimeType ?? "application/octet-stream",
      byteSize: Math.max(0, input.rawSnapshot?.byteSize ?? 0),
      sha256: normalizeSha(input.rawSnapshot?.sha256),
    },
    checksum: normalizeSha(input.checksum),
    notes: input.notes,
  };
};

export function validateProvenance(p: PriceProvenance): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (!p.recordId) errors.push("recordId is required");
  if (!p.modelId) errors.push("modelId is required");
  if (!p.sourceUrl) errors.push("sourceUrl is required");
  if (!p.rawSnapshot.objectUrl) errors.push("rawSnapshot.objectUrl is required");
  if (!p.rawSnapshot.sha256) errors.push("rawSnapshot.sha256 must be a valid sha256 hex");
  if (!p.checksum) errors.push("checksum must be a valid sha256 hex");

  const crawlTs = new Date(p.crawl.crawledAtIso).getTime();
  const fetchTs = new Date(p.crawl.fetchedAtIso).getTime();
  if (Number.isNaN(crawlTs)) errors.push("crawl.crawledAtIso is invalid");
  if (Number.isNaN(fetchTs)) errors.push("crawl.fetchedAtIso is invalid");
  if (!Number.isNaN(crawlTs) && !Number.isNaN(fetchTs) && fetchTs < crawlTs) {
    errors.push("crawl.fetchedAtIso cannot be older than crawl.crawledAtIso");
  }

  if (!p.parser.name || !p.parser.version) {
    errors.push("parser.name and parser.version are required");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}
