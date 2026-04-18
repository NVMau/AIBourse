import type { PriceProvenance } from "./provenance.ts";

const cache = new Map<string, PriceProvenance>();

export function cacheProvenance(cellKey: string, data: PriceProvenance) {
  cache.set(cellKey, data);
}

export function getProvenance(cellKey: string) {
  return cache.get(cellKey) ?? null;
}

export function renderProvenanceTooltip(p: PriceProvenance) {
  return {
    title: "Price provenance",
    items: [
      { label: "Source", value: p.sourceUrl },
      { label: "Last fetched", value: p.fetchedAtIso },
      { label: "Parse confidence", value: `${Math.round(p.parseConfidence * 100)}%` },
      { label: "Parser version", value: p.parserVersion },
      { label: "Raw snippet", value: p.rawSnippet },
    ],
    actions: [{ kind: "link", label: "Open pricing source", href: p.sourceUrl }],
    accessibility: {
      trigger: ["hover", "focus"],
      expandedPanelLabel: "Expanded provenance details",
    },
  };
}
