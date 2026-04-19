export type BenchmarkGroup = "coding" | "reasoning" | "context";

export type SourceRef = {
  sourceId: string;
  sourceUrl: string;
  fetchedAtIso: string;
};

export type PriceEvent = {
  modelId: string;
  capturedAtIso: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  currency: "USD";
  source: SourceRef;
};

export type ThroughputEvent = {
  modelId: string;
  capturedAtIso: string;
  tokensPerSecond: number;
  source: SourceRef;
};

export type ContextWindowEvent = {
  modelId: string;
  capturedAtIso: string;
  contextWindowTokens: number;
  source: SourceRef;
};

export type BenchmarkEvent = {
  modelId: string;
  group: BenchmarkGroup;
  capturedAtIso: string;
  scoreNormalized100: number;
  source: SourceRef;
};

export type UnifiedSnapshot = {
  snapshotId: string;
  modelId: string;
  timestampIso: string;
  price: {
    inputUsdPer1M: number;
    outputUsdPer1M: number;
    pctChangeInput?: number;
    pctChangeOutput?: number;
    source: SourceRef;
  };
  benchmarks: Record<BenchmarkGroup, { scoreNormalized100: number; source: SourceRef }>;
  throughput: {
    tokensPerSecond: number;
    trendPct?: number;
    source: SourceRef;
  };
  contextWindow: {
    contextWindowTokens: number;
    source: SourceRef;
  };
  intelligencePerDollar: {
    score: number;
    formula: "weightedBenchmarks / blendedPrice";
    weights: Record<BenchmarkGroup, number>;
  };
  annotations: SnapshotAnnotation[];
};

export type SnapshotAnnotation = {
  kind: "price_spike" | "benchmark_jump" | "throughput_drop" | "context_change";
  message: string;
  sourceUrl: string;
};

export type ValidationIssue = {
  code:
    | "MISSING_PRICE"
    | "MISSING_BENCHMARK"
    | "MISSING_THROUGHPUT"
    | "MISSING_CONTEXT"
    | "INVALID_VALUE"
    | "INVALID_TIMESTAMP";
  message: string;
};

export type CandidateSnapshot = {
  modelId: string;
  timestampIso: string;
  price?: PriceEvent;
  benchmarks: Partial<Record<BenchmarkGroup, BenchmarkEvent>>;
  throughput?: ThroughputEvent;
  contextWindow?: ContextWindowEvent;
};

export type BuildPolicy = {
  timeBucketMs: number;
  weights: Record<BenchmarkGroup, number>;
  majorChangeThresholds: {
    pricePct: number;
    benchmarkDelta: number;
    throughputDropPct: number;
  };
  fallback: {
    mode: "hold_only";
    maxPendingBuckets: number;
  };
};

export const DEFAULT_POLICY: BuildPolicy = {
  timeBucketMs: 60 * 60 * 1000,
  weights: { coding: 0.4, reasoning: 0.4, context: 0.2 },
  majorChangeThresholds: {
    pricePct: 10,
    benchmarkDelta: 8,
    throughputDropPct: 15,
  },
  fallback: {
    mode: "hold_only",
    maxPendingBuckets: 24,
  },
};

export function alignToBucket(iso: string, bucketMs: number): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp: ${iso}`);
  const aligned = Math.floor(ms / bucketMs) * bucketMs;
  return new Date(aligned).toISOString();
}

export function validateCandidate(candidate: CandidateSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!candidate.price) {
    issues.push({ code: "MISSING_PRICE", message: "Price is required to write snapshot" });
  }

  const benchmarkGroups: BenchmarkGroup[] = ["coding", "reasoning", "context"];
  for (const group of benchmarkGroups) {
    if (!candidate.benchmarks[group]) {
      issues.push({ code: "MISSING_BENCHMARK", message: `Missing benchmark group: ${group}` });
    }
  }

  if (!candidate.throughput) {
    issues.push({ code: "MISSING_THROUGHPUT", message: "Throughput is required" });
  }

  if (!candidate.contextWindow) {
    issues.push({ code: "MISSING_CONTEXT", message: "Context window is required" });
  }

  if (Number.isNaN(Date.parse(candidate.timestampIso))) {
    issues.push({ code: "INVALID_TIMESTAMP", message: `Invalid timestamp: ${candidate.timestampIso}` });
  }

  const numericChecks: Array<[number | undefined, string]> = [
    [candidate.price?.inputUsdPer1M, "price.inputUsdPer1M"],
    [candidate.price?.outputUsdPer1M, "price.outputUsdPer1M"],
    [candidate.throughput?.tokensPerSecond, "throughput.tokensPerSecond"],
    [candidate.contextWindow?.contextWindowTokens, "contextWindow.contextWindowTokens"],
    [candidate.benchmarks.coding?.scoreNormalized100, "benchmarks.coding"],
    [candidate.benchmarks.reasoning?.scoreNormalized100, "benchmarks.reasoning"],
    [candidate.benchmarks.context?.scoreNormalized100, "benchmarks.context"],
  ];

  for (const [value, path] of numericChecks) {
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) {
      issues.push({ code: "INVALID_VALUE", message: `${path} must be a non-negative finite number` });
    }
  }

  return issues;
}

export function dedupKey(input: {
  modelId: string;
  group?: BenchmarkGroup;
  capturedAtIso: string;
  sourceId: string;
}): string {
  return `${input.modelId}|${input.group ?? "all"}|${input.capturedAtIso}|${input.sourceId}`;
}

export function computeIntelligencePerDollar(
  benchmarks: Record<BenchmarkGroup, { scoreNormalized100: number }>,
  price: { inputUsdPer1M: number; outputUsdPer1M: number },
  weights: Record<BenchmarkGroup, number>,
): number {
  const weighted =
    benchmarks.coding.scoreNormalized100 * weights.coding +
    benchmarks.reasoning.scoreNormalized100 * weights.reasoning +
    benchmarks.context.scoreNormalized100 * weights.context;
  const blendedPrice = (price.inputUsdPer1M + price.outputUsdPer1M) / 2;
  if (blendedPrice <= 0) return 0;
  return Number((weighted / blendedPrice).toFixed(4));
}
