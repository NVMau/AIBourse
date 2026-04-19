import {
  BenchmarkEvent,
  BenchmarkGroup,
  BuildPolicy,
  CandidateSnapshot,
  ContextWindowEvent,
  DEFAULT_POLICY,
  PriceEvent,
  ThroughputEvent,
  UnifiedSnapshot,
  ValidationIssue,
  alignToBucket,
  computeIntelligencePerDollar,
  dedupKey,
  validateCandidate,
} from "./model-snapshot-contract";

type SnapshotBuildResult = {
  snapshots: UnifiedSnapshot[];
  pendingByBucket: Record<string, CandidateSnapshot>;
  rejected: Array<{ bucket: string; reason: ValidationIssue[] }>;
};

function pctChange(current: number, prev: number | undefined): number | undefined {
  if (prev === undefined || prev === 0) return undefined;
  return Number((((current - prev) / prev) * 100).toFixed(2));
}

function addAnnotationIfMajorChange(
  policy: BuildPolicy,
  prev: UnifiedSnapshot | undefined,
  next: UnifiedSnapshot,
): UnifiedSnapshot {
  if (!prev) return next;
  const annotations = [...next.annotations];

  const inputDelta = pctChange(next.price.inputUsdPer1M, prev.price.inputUsdPer1M);
  if (inputDelta !== undefined && Math.abs(inputDelta) >= policy.majorChangeThresholds.pricePct) {
    annotations.push({
      kind: "price_spike",
      message: `Input price changed ${inputDelta}%`,
      sourceUrl: next.price.source.sourceUrl,
    });
  }

  const throughputDelta = pctChange(next.throughput.tokensPerSecond, prev.throughput.tokensPerSecond);
  if (
    throughputDelta !== undefined &&
    throughputDelta <= -Math.abs(policy.majorChangeThresholds.throughputDropPct)
  ) {
    annotations.push({
      kind: "throughput_drop",
      message: `Throughput dropped ${Math.abs(throughputDelta)}%`,
      sourceUrl: next.throughput.source.sourceUrl,
    });
  }

  const benchmarkGroups: BenchmarkGroup[] = ["coding", "reasoning", "context"];
  for (const group of benchmarkGroups) {
    const delta =
      next.benchmarks[group].scoreNormalized100 - prev.benchmarks[group].scoreNormalized100;
    if (Math.abs(delta) >= policy.majorChangeThresholds.benchmarkDelta) {
      annotations.push({
        kind: "benchmark_jump",
        message: `${group} benchmark changed ${delta.toFixed(2)} points`,
        sourceUrl: next.benchmarks[group].source.sourceUrl,
      });
    }
  }

  if (next.contextWindow.contextWindowTokens !== prev.contextWindow.contextWindowTokens) {
    annotations.push({
      kind: "context_change",
      message: `Context window changed from ${prev.contextWindow.contextWindowTokens} to ${next.contextWindow.contextWindowTokens}`,
      sourceUrl: next.contextWindow.source.sourceUrl,
    });
  }

  return { ...next, annotations };
}

function mergeEventsByBucket(
  modelId: string,
  policy: BuildPolicy,
  events: {
    prices: PriceEvent[];
    benchmarks: BenchmarkEvent[];
    throughputs: ThroughputEvent[];
    contexts: ContextWindowEvent[];
  },
): Record<string, CandidateSnapshot> {
  const byBucket: Record<string, CandidateSnapshot> = {};

  const ensure = (bucket: string): CandidateSnapshot => {
    const existing = byBucket[bucket];
    if (existing) return existing;
    const created: CandidateSnapshot = {
      modelId,
      timestampIso: bucket,
      benchmarks: {},
    };
    byBucket[bucket] = created;
    return created;
  };

  const seen = new Set<string>();
  const scopedDedupKey = (scope: "price" | "benchmark" | "throughput" | "context", baseKey: string) =>
    `${scope}:${baseKey}`;

  for (const event of events.prices) {
    const k = scopedDedupKey(
      "price",
      dedupKey({
        modelId: event.modelId,
        capturedAtIso: event.capturedAtIso,
        sourceId: event.source.sourceId,
      }),
    );
    if (seen.has(k)) continue;
    seen.add(k);

    const bucket = alignToBucket(event.capturedAtIso, policy.timeBucketMs);
    const slot = ensure(bucket);
    slot.price = event;
  }

  for (const event of events.benchmarks) {
    const k = scopedDedupKey(
      "benchmark",
      dedupKey({
        modelId: event.modelId,
        group: event.group,
        capturedAtIso: event.capturedAtIso,
        sourceId: event.source.sourceId,
      }),
    );
    if (seen.has(k)) continue;
    seen.add(k);

    const bucket = alignToBucket(event.capturedAtIso, policy.timeBucketMs);
    const slot = ensure(bucket);
    slot.benchmarks[event.group] = event;
  }

  for (const event of events.throughputs) {
    const k = scopedDedupKey(
      "throughput",
      dedupKey({
        modelId: event.modelId,
        capturedAtIso: event.capturedAtIso,
        sourceId: event.source.sourceId,
      }),
    );
    if (seen.has(k)) continue;
    seen.add(k);

    const bucket = alignToBucket(event.capturedAtIso, policy.timeBucketMs);
    const slot = ensure(bucket);
    slot.throughput = event;
  }

  for (const event of events.contexts) {
    const k = scopedDedupKey(
      "context",
      dedupKey({
        modelId: event.modelId,
        capturedAtIso: event.capturedAtIso,
        sourceId: event.source.sourceId,
      }),
    );
    if (seen.has(k)) continue;
    seen.add(k);

    const bucket = alignToBucket(event.capturedAtIso, policy.timeBucketMs);
    const slot = ensure(bucket);
    slot.contextWindow = event;
  }

  return byBucket;
}

export function buildUnifiedSnapshots(
  modelId: string,
  events: {
    prices: PriceEvent[];
    benchmarks: BenchmarkEvent[];
    throughputs: ThroughputEvent[];
    contexts: ContextWindowEvent[];
  },
  policy: BuildPolicy = DEFAULT_POLICY,
): SnapshotBuildResult {
  const byBucket = mergeEventsByBucket(modelId, policy, events);
  const buckets = Object.keys(byBucket).sort();

  const snapshots: UnifiedSnapshot[] = [];
  const rejected: Array<{ bucket: string; reason: ValidationIssue[] }> = [];
  const pendingByBucket: Record<string, CandidateSnapshot> = {};

  let prevSnapshot: UnifiedSnapshot | undefined;

  for (const bucket of buckets) {
    const candidate = byBucket[bucket];
    const issues = validateCandidate(candidate);
    if (issues.length > 0) {
      pendingByBucket[bucket] = candidate;
      rejected.push({ bucket, reason: issues });
      continue;
    }

    const price = candidate.price!;
    const throughput = candidate.throughput!;
    const contextWindow = candidate.contextWindow!;
    const benchmarks = {
      coding: candidate.benchmarks.coding!,
      reasoning: candidate.benchmarks.reasoning!,
      context: candidate.benchmarks.context!,
    };

    const snapshot: UnifiedSnapshot = {
      snapshotId: `${modelId}@${bucket}`,
      modelId,
      timestampIso: bucket,
      price: {
        inputUsdPer1M: price.inputUsdPer1M,
        outputUsdPer1M: price.outputUsdPer1M,
        pctChangeInput: pctChange(price.inputUsdPer1M, prevSnapshot?.price.inputUsdPer1M),
        pctChangeOutput: pctChange(price.outputUsdPer1M, prevSnapshot?.price.outputUsdPer1M),
        source: price.source,
      },
      benchmarks: {
        coding: {
          scoreNormalized100: benchmarks.coding.scoreNormalized100,
          source: benchmarks.coding.source,
        },
        reasoning: {
          scoreNormalized100: benchmarks.reasoning.scoreNormalized100,
          source: benchmarks.reasoning.source,
        },
        context: {
          scoreNormalized100: benchmarks.context.scoreNormalized100,
          source: benchmarks.context.source,
        },
      },
      throughput: {
        tokensPerSecond: throughput.tokensPerSecond,
        trendPct: pctChange(throughput.tokensPerSecond, prevSnapshot?.throughput.tokensPerSecond),
        source: throughput.source,
      },
      contextWindow: {
        contextWindowTokens: contextWindow.contextWindowTokens,
        source: contextWindow.source,
      },
      intelligencePerDollar: {
        score: computeIntelligencePerDollar(
          {
            coding: { scoreNormalized100: benchmarks.coding.scoreNormalized100 },
            reasoning: { scoreNormalized100: benchmarks.reasoning.scoreNormalized100 },
            context: { scoreNormalized100: benchmarks.context.scoreNormalized100 },
          },
          {
            inputUsdPer1M: price.inputUsdPer1M,
            outputUsdPer1M: price.outputUsdPer1M,
          },
          policy.weights,
        ),
        formula: "weightedBenchmarks / blendedPrice",
        weights: policy.weights,
      },
      annotations: [],
    };

    const annotated = addAnnotationIfMajorChange(policy, prevSnapshot, snapshot);
    snapshots.push(annotated);
    prevSnapshot = annotated;
  }

  // Fallback policy: do not write missing snapshots; hold pending limited by policy.fallback.maxPendingBuckets
  const pendingBuckets = Object.keys(pendingByBucket).sort();
  if (pendingBuckets.length > policy.fallback.maxPendingBuckets) {
    const toDrop = pendingBuckets.length - policy.fallback.maxPendingBuckets;
    for (let i = 0; i < toDrop; i += 1) {
      const bucket = pendingBuckets[i];
      delete pendingByBucket[bucket];
    }
  }

  return {
    snapshots,
    pendingByBucket,
    rejected,
  };
}
