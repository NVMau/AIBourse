import { PriceProvenance } from "./provenance";

const cache = new Map<string, PriceProvenance>();

export type AuditDrawerView = {
  title: string;
  subtitle: string;
  sections: Array<{
    title: string;
    rows: Array<{ label: string; value: string }>;
  }>;
  actions: Array<{ kind: "link"; label: string; href: string }>;
};

export function cacheProvenance(cellKey: string, data: PriceProvenance) {
  cache.set(cellKey, data);
}

export function getProvenance(cellKey: string) {
  return cache.get(cellKey) ?? null;
}

export function buildProvenanceRecordId(modelId: string, metric: PriceProvenance["metric"], atIso: string) {
  return `${modelId}:${metric}:${new Date(atIso).toISOString()}`;
}

export function renderProvenanceTooltip(p: PriceProvenance) {
  return {
    title: "Audit provenance",
    items: [
      { label: "Record ID", value: p.recordId },
      { label: "Model", value: p.modelId },
      { label: "Metric", value: p.metric },
      { label: "Source", value: p.sourceUrl },
      { label: "Crawled at", value: p.crawl.crawledAtIso },
      { label: "Parser", value: `${p.parser.name}@${p.parser.version}` },
      { label: "Checksum", value: p.checksum },
    ],
    actions: [{ kind: "link", label: "Open source", href: p.sourceUrl }],
    accessibility: {
      trigger: ["hover", "focus"],
      expandedPanelLabel: "Expanded audit provenance details",
    },
  };
}

export function renderAuditDrawer(p: PriceProvenance): AuditDrawerView {
  return {
    title: "Audit mode",
    subtitle: `Record ${p.recordId}`,
    sections: [
      {
        title: "Source",
        rows: [
          { label: "URL", value: p.sourceUrl },
          { label: "Title", value: p.sourceTitle ?? "-" },
          { label: "Captured", value: p.sourceCapturedAtIso ?? "-" },
        ],
      },
      {
        title: "Collection",
        rows: [
          { label: "Crawled at", value: p.crawl.crawledAtIso },
          { label: "Fetched at", value: p.crawl.fetchedAtIso },
          { label: "Crawler job", value: p.crawl.crawlerJobId ?? "-" },
          { label: "User-Agent", value: p.crawl.userAgent ?? "-" },
        ],
      },
      {
        title: "Parser",
        rows: [
          { label: "Name", value: p.parser.name },
          { label: "Version", value: p.parser.version },
          { label: "Config version", value: p.parser.configVersion ?? "-" },
          { label: "Confidence", value: `${Math.round(p.parseConfidence * 100)}%` },
        ],
      },
      {
        title: "Raw snapshot",
        rows: [
          { label: "Object URL", value: p.rawSnapshot.objectUrl },
          { label: "MIME", value: p.rawSnapshot.mimeType },
          { label: "Bytes", value: String(p.rawSnapshot.byteSize) },
          { label: "SHA-256", value: p.rawSnapshot.sha256 },
          { label: "Snippet", value: p.rawSnippet || "-" },
        ],
      },
      {
        title: "Integrity",
        rows: [
          { label: "Record checksum", value: p.checksum },
          { label: "Notes", value: p.notes ?? "-" },
        ],
      },
    ],
    actions: [
      { kind: "link", label: "Open source page", href: p.sourceUrl },
      { kind: "link", label: "Open raw snapshot", href: p.rawSnapshot.objectUrl },
    ],
  };
}
