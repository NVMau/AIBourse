import { ModelDetailPageViewModel, SnapshotEventAnnotation } from "./model-detail";

export type TimelineAxis = "price" | "benchmark" | "throughput" | "context" | "intelligence_per_dollar";

export type TimelineSeries = {
  key: string;
  label: string;
  axis: TimelineAxis;
  color: string;
  points: { x: string; y: number }[];
};

export type AnnotationItem = {
  ts: string;
  title: string;
  detail: string;
  sourceLinks: { label: string; url: string }[];
  severity: "info" | "major";
};

export type ModelDetailLayout = {
  header: {
    title: string;
    subtitle: string;
  };
  timeline: {
    syncBy: "timestamp";
    series: TimelineSeries[];
    annotationLayer: AnnotationItem[];
  };
  benchmarkPanels: {
    coding: { title: string; latest: string; trend: string };
    reasoning: { title: string; latest: string; trend: string };
    context: { title: string; latest: string; trend: string };
    note: string;
  };
  trustPanel: {
    title: string;
    items: { event: string; sourceLinks: { label: string; url: string }[] }[];
  };
};

const toTrendText = (trend: number | null) => {
  if (trend === null) return "N/A";
  const sign = trend >= 0 ? "+" : "";
  return `${sign}${trend.toFixed(1)}%`;
};

const toAnnotationSeverity = (a: SnapshotEventAnnotation): "info" | "major" => {
  if (a.kind === "price-spike" || a.kind === "benchmark-jump") return "major";
  return "info";
};

export function buildModelDetailLayout(vm: ModelDetailPageViewModel): ModelDetailLayout {
  const series: TimelineSeries[] = [
    {
      key: "price_input",
      label: "Input price (USD/1M)",
      axis: "price",
      color: "#c0392b",
      points: vm.timeline.map((p) => ({ x: p.timestampIso, y: p.inputUsdPer1M })),
    },
    {
      key: "price_output",
      label: "Output price (USD/1M)",
      axis: "price",
      color: "#e67e22",
      points: vm.timeline.map((p) => ({ x: p.timestampIso, y: p.outputUsdPer1M })),
    },
    {
      key: "benchmark_coding",
      label: "Benchmark Coding",
      axis: "benchmark",
      color: "#2980b9",
      points: vm.timeline.map((p) => ({ x: p.timestampIso, y: p.benchmark.coding })),
    },
    {
      key: "benchmark_reasoning",
      label: "Benchmark Reasoning",
      axis: "benchmark",
      color: "#8e44ad",
      points: vm.timeline.map((p) => ({ x: p.timestampIso, y: p.benchmark.reasoning })),
    },
    {
      key: "benchmark_context",
      label: "Benchmark Context",
      axis: "benchmark",
      color: "#16a085",
      points: vm.timeline.map((p) => ({ x: p.timestampIso, y: p.benchmark.context })),
    },
    {
      key: "throughput",
      label: "Throughput (tokens/s)",
      axis: "throughput",
      color: "#2c3e50",
      points: vm.timeline.map((p) => ({ x: p.timestampIso, y: p.throughputTokensPerSecond })),
    },
    {
      key: "context_tokens",
      label: "Context window (tokens)",
      axis: "context",
      color: "#27ae60",
      points: vm.timeline.map((p) => ({ x: p.timestampIso, y: p.contextTokens })),
    },
    {
      key: "ipd",
      label: "Intelligence per dollar",
      axis: "intelligence_per_dollar",
      color: "#f1c40f",
      points: vm.timeline.map((p) => ({ x: p.timestampIso, y: p.intelligencePerDollar })),
    },
  ];

  const annotationLayer: AnnotationItem[] = vm.annotations.map((a) => ({
    ts: a.timestampIso,
    title: a.title,
    detail: a.detail,
    sourceLinks: a.sources,
    severity: toAnnotationSeverity(a),
  }));

  return {
    header: {
      title: `Model detail: ${vm.modelId}`,
      subtitle: "Timeline giá + benchmark + throughput + context + intelligence-per-dollar (snapshot nhất quán)",
    },
    timeline: {
      syncBy: "timestamp",
      series,
      annotationLayer,
    },
    benchmarkPanels: {
      coding: {
        title: "Coding benchmark",
        latest: vm.benchmarkPanels.coding.latest.toFixed(1),
        trend: toTrendText(vm.benchmarkPanels.coding.trend),
      },
      reasoning: {
        title: "Reasoning benchmark",
        latest: vm.benchmarkPanels.reasoning.latest.toFixed(1),
        trend: toTrendText(vm.benchmarkPanels.reasoning.trend),
      },
      context: {
        title: "Context benchmark",
        latest: vm.benchmarkPanels.context.latest.toFixed(1),
        trend: toTrendText(vm.benchmarkPanels.context.trend),
      },
      note: "Điểm tổng chỉ là chỉ số phụ trợ; ưu tiên đọc từng nhóm benchmark riêng để ra quyết định.",
    },
    trustPanel: {
      title: "Nguồn tham chiếu theo sự kiện",
      items: vm.annotations.map((a) => ({ event: `${a.timestampIso} — ${a.title}`, sourceLinks: a.sources })),
    },
  };
}
