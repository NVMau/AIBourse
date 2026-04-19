export type BenchmarkGroup = "coding" | "reasoning" | "context";

export type SourceLink = {
  label: string;
  url: string;
};

export type PriceHistoryPoint = {
  modelId: string;
  timestampIso: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  source: SourceLink;
};

export type BenchmarkRawPoint = {
  modelId: string;
  timestampIso: string;
  group: BenchmarkGroup;
  score: number;
  minScale: number;
  maxScale: number;
  source: SourceLink;
};

export type ThroughputPoint = {
  modelId: string;
  timestampIso: string;
  tokensPerSecond: number;
  source: SourceLink;
};

export type ContextWindowPoint = {
  modelId: string;
  timestampIso: string;
  contextTokens: number;
  version: string;
  source: SourceLink;
};

export type NormalizedBenchmark = {
  group: BenchmarkGroup;
  rawScore: number;
  normalizedScore: number; // 0..100
  scale: { min: number; max: number };
  source: SourceLink;
};

export type SnapshotDataContract = {
  modelId: string;
  timestampIso: string;
  price: {
    inputUsdPer1M: number;
    outputUsdPer1M: number;
    pctChangeInput: number | null;
    pctChangeOutput: number | null;
    source: SourceLink;
  };
  benchmarks: Record<BenchmarkGroup, NormalizedBenchmark>;
  throughput: {
    tokensPerSecond: number;
    trendPct: number | null;
    source: SourceLink;
  };
  contextWindow: {
    contextTokens: number;
    version: string;
    source: SourceLink;
  };
  intelligencePerDollar: {
    score: number;
    formulaVersion: "v1";
    trace: {
      weightedBenchmark: number;
      blendedPriceUsdPer1M: number;
      throughputWeight: number;
      contextWeight: number;
      benchmarkWeights: Record<BenchmarkGroup, number>;
    };
  };
  aggregateAuxScore: {
    score: number;
    formulaVersion: "v1";
  };
  sources: SourceLink[];
};

export type SnapshotEventAnnotation = {
  kind: "price-spike" | "benchmark-jump" | "throughput-jump" | "context-upgrade";
  timestampIso: string;
  title: string;
  detail: string;
  sources: SourceLink[];
};

export type TimelineValidationIssue = {
  code:
    | "MISSING_PRICE"
    | "MISSING_BENCHMARK"
    | "MISSING_GROUP"
    | "MISSING_THROUGHPUT"
    | "MISSING_CONTEXT"
    | "DUPLICATE_TIMESTAMP"
    | "INVALID_SCALE";
  timestampIso: string;
  message: string;
};

export type BuildSnapshotsResult = {
  snapshots: SnapshotDataContract[];
  annotations: SnapshotEventAnnotation[];
  droppedTimestamps: string[];
  issues: TimelineValidationIssue[];
};

const BENCHMARK_WEIGHTS: Record<BenchmarkGroup, number> = {
  coding: 0.45,
  reasoning: 0.4,
  context: 0.15,
};

const THROUGHPUT_WEIGHT = 0.2;
const CONTEXT_WEIGHT = 0.1;

const byTimestamp = <T extends { timestampIso: string }>(rows: T[]) => {
  return rows.reduce<Map<string, T[]>>((acc, row) => {
    const list = acc.get(row.timestampIso) ?? [];
    list.push(row);
    acc.set(row.timestampIso, list);
    return acc;
  }, new Map());
};

const pctChange = (prev: number | null, next: number) => {
  if (prev === null || prev === 0) return null;
  return ((next - prev) / prev) * 100;
};

const normalizeBenchmarkScore = (raw: BenchmarkRawPoint): number => {
  const span = raw.maxScale - raw.minScale;
  if (span <= 0) return 0;
  const normalized = ((raw.score - raw.minScale) / span) * 100;
  return Math.max(0, Math.min(100, normalized));
};

const weightedBenchmark = (bench: Record<BenchmarkGroup, NormalizedBenchmark>) => {
  return (
    bench.coding.normalizedScore * BENCHMARK_WEIGHTS.coding +
    bench.reasoning.normalizedScore * BENCHMARK_WEIGHTS.reasoning +
    bench.context.normalizedScore * BENCHMARK_WEIGHTS.context
  );
};

const blendedPrice = (inputUsdPer1M: number, outputUsdPer1M: number) => inputUsdPer1M * 0.6 + outputUsdPer1M * 0.4;

export function validateTimelineConsistency(args: {
  priceRows: PriceHistoryPoint[];
  benchmarkRows: BenchmarkRawPoint[];
  throughputRows: ThroughputPoint[];
  contextRows: ContextWindowPoint[];
}): TimelineValidationIssue[] {
  const issues: TimelineValidationIssue[] = [];

  const priceMap = byTimestamp(args.priceRows);
  const benchMap = byTimestamp(args.benchmarkRows);
  const throughputMap = byTimestamp(args.throughputRows);
  const contextMap = byTimestamp(args.contextRows);

  const allTimestamps = new Set<string>([
    ...priceMap.keys(),
    ...benchMap.keys(),
    ...throughputMap.keys(),
    ...contextMap.keys(),
  ]);

  for (const timestampIso of allTimestamps) {
    const prices = priceMap.get(timestampIso) ?? [];
    const benchmarks = benchMap.get(timestampIso) ?? [];
    const throughputs = throughputMap.get(timestampIso) ?? [];
    const contexts = contextMap.get(timestampIso) ?? [];

    if (prices.length === 0) {
      issues.push({ code: "MISSING_PRICE", timestampIso, message: "No price row for snapshot timestamp." });
    }
    if (benchmarks.length === 0) {
      issues.push({ code: "MISSING_BENCHMARK", timestampIso, message: "No benchmark rows for snapshot timestamp." });
    }
    if (throughputs.length === 0) {
      issues.push({ code: "MISSING_THROUGHPUT", timestampIso, message: "No throughput row for snapshot timestamp." });
    }
    if (contexts.length === 0) {
      issues.push({ code: "MISSING_CONTEXT", timestampIso, message: "No context-window row for snapshot timestamp." });
    }

    if (prices.length > 1 || throughputs.length > 1 || contexts.length > 1) {
      issues.push({
        code: "DUPLICATE_TIMESTAMP",
        timestampIso,
        message: "Duplicate rows exist at this timestamp for one or more singleton datasets.",
      });
    }

    const groups = new Set(benchmarks.map((b) => b.group));
    for (const g of ["coding", "reasoning", "context"] as BenchmarkGroup[]) {
      if (!groups.has(g)) {
        issues.push({ code: "MISSING_GROUP", timestampIso, message: `Missing benchmark group: ${g}.` });
      }
    }

    for (const b of benchmarks) {
      if (b.maxScale <= b.minScale) {
        issues.push({ code: "INVALID_SCALE", timestampIso, message: `Invalid benchmark scale for ${b.group}.` });
      }
    }
  }

  return issues;
}

export function buildConsistentSnapshots(args: {
  modelId: string;
  priceRows: PriceHistoryPoint[];
  benchmarkRows: BenchmarkRawPoint[];
  throughputRows: ThroughputPoint[];
  contextRows: ContextWindowPoint[];
}): BuildSnapshotsResult {
  const issues = validateTimelineConsistency(args);

  const hardIssueAtTimestamp = new Set(
    issues
      .filter((i) => ["MISSING_PRICE", "MISSING_BENCHMARK", "MISSING_GROUP", "MISSING_THROUGHPUT", "MISSING_CONTEXT"].includes(i.code))
      .map((i) => i.timestampIso),
  );

  const priceMap = byTimestamp(args.priceRows);
  const benchMap = byTimestamp(args.benchmarkRows);
  const throughputMap = byTimestamp(args.throughputRows);
  const contextMap = byTimestamp(args.contextRows);

  const timestamps = [...new Set(args.priceRows.map((r) => r.timestampIso))].sort();

  const snapshots: SnapshotDataContract[] = [];
  const droppedTimestamps: string[] = [];

  let prevInput: number | null = null;
  let prevOutput: number | null = null;
  let prevThroughput: number | null = null;

  for (const timestampIso of timestamps) {
    if (hardIssueAtTimestamp.has(timestampIso)) {
      droppedTimestamps.push(timestampIso);
      continue;
    }

    const price = priceMap.get(timestampIso)?.[0];
    const throughput = throughputMap.get(timestampIso)?.[0];
    const context = contextMap.get(timestampIso)?.[0];
    const benchRows = benchMap.get(timestampIso) ?? [];

    if (!price || !throughput || !context || benchRows.length < 3) {
      droppedTimestamps.push(timestampIso);
      continue;
    }

    const benchByGroup = Object.fromEntries(
      benchRows.map((row) => [
        row.group,
        {
          group: row.group,
          rawScore: row.score,
          normalizedScore: normalizeBenchmarkScore(row),
          scale: { min: row.minScale, max: row.maxScale },
          source: row.source,
        } satisfies NormalizedBenchmark,
      ]),
    ) as Record<BenchmarkGroup, NormalizedBenchmark>;

    const weightedBench = weightedBenchmark(benchByGroup);
    const blended = blendedPrice(price.inputUsdPer1M, price.outputUsdPer1M);
    const throughputNorm = Math.min(100, Math.max(0, throughput.tokensPerSecond / 5));
    const contextNorm = Math.min(100, Math.max(0, context.contextTokens / 2048));

    const intelligencePerDollarScore = (weightedBench * (1 + THROUGHPUT_WEIGHT * (throughputNorm / 100) + CONTEXT_WEIGHT * (contextNorm / 100))) / Math.max(blended, 0.0001);

    const auxScore = weightedBench * 0.8 + throughputNorm * 0.15 + contextNorm * 0.05;

    snapshots.push({
      modelId: args.modelId,
      timestampIso,
      price: {
        inputUsdPer1M: price.inputUsdPer1M,
        outputUsdPer1M: price.outputUsdPer1M,
        pctChangeInput: pctChange(prevInput, price.inputUsdPer1M),
        pctChangeOutput: pctChange(prevOutput, price.outputUsdPer1M),
        source: price.source,
      },
      benchmarks: benchByGroup,
      throughput: {
        tokensPerSecond: throughput.tokensPerSecond,
        trendPct: pctChange(prevThroughput, throughput.tokensPerSecond),
        source: throughput.source,
      },
      contextWindow: {
        contextTokens: context.contextTokens,
        version: context.version,
        source: context.source,
      },
      intelligencePerDollar: {
        score: intelligencePerDollarScore,
        formulaVersion: "v1",
        trace: {
          weightedBenchmark: weightedBench,
          blendedPriceUsdPer1M: blended,
          throughputWeight: THROUGHPUT_WEIGHT,
          contextWeight: CONTEXT_WEIGHT,
          benchmarkWeights: BENCHMARK_WEIGHTS,
        },
      },
      aggregateAuxScore: {
        score: auxScore,
        formulaVersion: "v1",
      },
      sources: [price.source, throughput.source, context.source, ...benchRows.map((b) => b.source)],
    });

    prevInput = price.inputUsdPer1M;
    prevOutput = price.outputUsdPer1M;
    prevThroughput = throughput.tokensPerSecond;
  }

  const annotations = detectMajorChanges(snapshots);

  return { snapshots, annotations, droppedTimestamps, issues };
}

export function detectMajorChanges(snapshots: SnapshotDataContract[]): SnapshotEventAnnotation[] {
  const annotations: SnapshotEventAnnotation[] = [];

  for (const s of snapshots) {
    const inputChg = s.price.pctChangeInput ?? 0;
    if (Math.abs(inputChg) >= 15) {
      annotations.push({
        kind: "price-spike",
        timestampIso: s.timestampIso,
        title: `Biến động giá input ${inputChg > 0 ? "tăng" : "giảm"} mạnh`,
        detail: `Giá input thay đổi ${inputChg.toFixed(1)}% tại mốc ${s.timestampIso}.`,
        sources: [s.price.source],
      });
    }

    const benchJump = Math.max(
      Math.abs((s.benchmarks.coding.normalizedScore || 0) - s.aggregateAuxScore.score),
      Math.abs((s.benchmarks.reasoning.normalizedScore || 0) - s.aggregateAuxScore.score),
      Math.abs((s.benchmarks.context.normalizedScore || 0) - s.aggregateAuxScore.score),
    );
    if (benchJump >= 20) {
      annotations.push({
        kind: "benchmark-jump",
        timestampIso: s.timestampIso,
        title: "Đột biến benchmark theo nhóm",
        detail: "Một hoặc nhiều nhóm benchmark lệch mạnh so với mặt bằng tổng phụ trợ.",
        sources: [s.benchmarks.coding.source, s.benchmarks.reasoning.source, s.benchmarks.context.source],
      });
    }

    const throughputTrend = s.throughput.trendPct ?? 0;
    if (Math.abs(throughputTrend) >= 20) {
      annotations.push({
        kind: "throughput-jump",
        timestampIso: s.timestampIso,
        title: `Throughput ${throughputTrend > 0 ? "tăng" : "giảm"} mạnh`,
        detail: `Thông lượng thay đổi ${throughputTrend.toFixed(1)}%.`,
        sources: [s.throughput.source],
      });
    }
  }

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const cur = snapshots[i];
    if (cur.contextWindow.version !== prev.contextWindow.version || cur.contextWindow.contextTokens > prev.contextWindow.contextTokens * 1.25) {
      annotations.push({
        kind: "context-upgrade",
        timestampIso: cur.timestampIso,
        title: "Nâng cấp context window",
        detail: `Context window chuyển từ ${prev.contextWindow.contextTokens} lên ${cur.contextWindow.contextTokens} tokens (version ${cur.contextWindow.version}).`,
        sources: [cur.contextWindow.source],
      });
    }
  }

  return annotations;
}

export type ModelDetailTimelinePoint = {
  timestampIso: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  pctChangeInput: number | null;
  throughputTokensPerSecond: number;
  contextTokens: number;
  benchmark: {
    coding: number;
    reasoning: number;
    context: number;
  };
  intelligencePerDollar: number;
  aggregateAuxScore: number;
};

export type ModelDetailPageViewModel = {
  modelId: string;
  timeline: ModelDetailTimelinePoint[];
  benchmarkPanels: {
    coding: { latest: number; trend: number | null };
    reasoning: { latest: number; trend: number | null };
    context: { latest: number; trend: number | null };
  };
  annotations: SnapshotEventAnnotation[];
};

export function toModelDetailPageViewModel(result: BuildSnapshotsResult): ModelDetailPageViewModel {
  const timeline: ModelDetailTimelinePoint[] = result.snapshots.map((s) => ({
    timestampIso: s.timestampIso,
    inputUsdPer1M: s.price.inputUsdPer1M,
    outputUsdPer1M: s.price.outputUsdPer1M,
    pctChangeInput: s.price.pctChangeInput,
    throughputTokensPerSecond: s.throughput.tokensPerSecond,
    contextTokens: s.contextWindow.contextTokens,
    benchmark: {
      coding: s.benchmarks.coding.normalizedScore,
      reasoning: s.benchmarks.reasoning.normalizedScore,
      context: s.benchmarks.context.normalizedScore,
    },
    intelligencePerDollar: s.intelligencePerDollar.score,
    aggregateAuxScore: s.aggregateAuxScore.score,
  }));

  const latest = timeline[timeline.length - 1];
  const first = timeline[0];

  const trend = (now: number, then?: number) => (then === undefined || then === 0 ? null : ((now - then) / then) * 100);

  return {
    modelId: result.snapshots[0]?.modelId ?? "unknown",
    timeline,
    benchmarkPanels: {
      coding: { latest: latest?.benchmark.coding ?? 0, trend: trend(latest?.benchmark.coding ?? 0, first?.benchmark.coding) },
      reasoning: { latest: latest?.benchmark.reasoning ?? 0, trend: trend(latest?.benchmark.reasoning ?? 0, first?.benchmark.reasoning) },
      context: { latest: latest?.benchmark.context ?? 0, trend: trend(latest?.benchmark.context ?? 0, first?.benchmark.context) },
    },
    annotations: result.annotations,
  };
}
