import { UnifiedSnapshot } from "./model-snapshot-contract";

export type TimelineSeriesPoint = {
  t: string;
  value: number;
  sourceUrl: string;
};

export type ModelDetailViewModel = {
  modelId: string;
  timeline: {
    priceInput: TimelineSeriesPoint[];
    priceOutput: TimelineSeriesPoint[];
    throughput: TimelineSeriesPoint[];
    contextWindow: TimelineSeriesPoint[];
    intelligencePerDollar: TimelineSeriesPoint[];
  };
  benchmarks: {
    coding: TimelineSeriesPoint[];
    reasoning: TimelineSeriesPoint[];
    context: TimelineSeriesPoint[];
  };
  majorChanges: Array<{
    t: string;
    kind: string;
    message: string;
    sourceUrl: string;
  }>;
};

export function toModelDetailViewModel(modelId: string, snapshots: UnifiedSnapshot[]): ModelDetailViewModel {
  const sorted = [...snapshots].sort((a, b) => Date.parse(a.timestampIso) - Date.parse(b.timestampIso));

  const view: ModelDetailViewModel = {
    modelId,
    timeline: {
      priceInput: [],
      priceOutput: [],
      throughput: [],
      contextWindow: [],
      intelligencePerDollar: [],
    },
    benchmarks: {
      coding: [],
      reasoning: [],
      context: [],
    },
    majorChanges: [],
  };

  for (const s of sorted) {
    view.timeline.priceInput.push({
      t: s.timestampIso,
      value: s.price.inputUsdPer1M,
      sourceUrl: s.price.source.sourceUrl,
    });
    view.timeline.priceOutput.push({
      t: s.timestampIso,
      value: s.price.outputUsdPer1M,
      sourceUrl: s.price.source.sourceUrl,
    });
    view.timeline.throughput.push({
      t: s.timestampIso,
      value: s.throughput.tokensPerSecond,
      sourceUrl: s.throughput.source.sourceUrl,
    });
    view.timeline.contextWindow.push({
      t: s.timestampIso,
      value: s.contextWindow.contextWindowTokens,
      sourceUrl: s.contextWindow.source.sourceUrl,
    });
    view.timeline.intelligencePerDollar.push({
      t: s.timestampIso,
      value: s.intelligencePerDollar.score,
      sourceUrl: s.price.source.sourceUrl,
    });

    view.benchmarks.coding.push({
      t: s.timestampIso,
      value: s.benchmarks.coding.scoreNormalized100,
      sourceUrl: s.benchmarks.coding.source.sourceUrl,
    });
    view.benchmarks.reasoning.push({
      t: s.timestampIso,
      value: s.benchmarks.reasoning.scoreNormalized100,
      sourceUrl: s.benchmarks.reasoning.source.sourceUrl,
    });
    view.benchmarks.context.push({
      t: s.timestampIso,
      value: s.benchmarks.context.scoreNormalized100,
      sourceUrl: s.benchmarks.context.source.sourceUrl,
    });

    for (const annotation of s.annotations) {
      view.majorChanges.push({
        t: s.timestampIso,
        kind: annotation.kind,
        message: annotation.message,
        sourceUrl: annotation.sourceUrl,
      });
    }
  }

  return view;
}
