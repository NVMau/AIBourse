# Model Detail Timeline + Unified Benchmark Spec

Task ID: 4c489bef-223c-43e8-90dc-9f281b808df8

## Mục tiêu

Xây dựng kiến trúc dữ liệu + metric + UI view-model cho trang chi tiết model, theo nguyên tắc:

- Snapshot chỉ được ghi khi **đủ price + benchmark(3 nhóm) + throughput + context window**.
- Benchmark hiển thị tách riêng theo nhóm `coding`, `reasoning`, `context`.
- Intelligence-per-dollar tính trên cùng snapshot, có trace công thức và versioning.
- Các biến động lớn có annotation + source links.

## 1) Data Contract Snapshot

Kiểu trung tâm: `SnapshotDataContract` (src/model-detail.ts)

Bắt buộc có:

- `price`: input/output USD per 1M + % change + source
- `benchmarks`: đủ 3 nhóm với điểm raw + normalized + source
- `throughput`: tokens/s + trend + source
- `contextWindow`: tokens + version + source
- `intelligencePerDollar`: score + formulaVersion + trace
- `aggregateAuxScore`: chỉ số tổng phụ trợ
- `sources`: gom nguồn của toàn snapshot

## 2) Ingest/Normalize + Timestamp Alignment

`buildConsistentSnapshots()` + `validateTimelineConsistency()`:

- Dedupe/kiểm tra singleton theo timestamp (`price`, `throughput`, `context`)
- Kiểm tra benchmark đủ nhóm
- Kiểm tra scale hợp lệ (`maxScale > minScale`)
- Policy fallback: **drop timestamp thiếu dữ liệu** (`droppedTimestamps`), không ghi snapshot thiếu

Normalization benchmark:

- Công thức: `(raw - min) / (max - min) * 100`
- Clamp về [0,100]

## 3) Metric Engine

### 3.1 Giá và biến động

- `pctChangeInput`, `pctChangeOutput`: tính theo snapshot trước đó

### 3.2 Throughput trend

- `trendPct`: % thay đổi tokens/s so với snapshot trước

### 3.3 Context window theo version

- Lưu cả `contextTokens` và `version` để theo dõi nâng cấp model/runtime

### 3.4 Intelligence-per-dollar (v1)

- Trọng số benchmark:
  - coding: 0.45
  - reasoning: 0.40
  - context: 0.15
- Blended price: `0.6 * input + 0.4 * output`
- Throughput/context boost:
  - throughputWeight = 0.2
  - contextWeight = 0.1

Công thức:

`IPD = weightedBenchmark * (1 + throughputWeight * throughputNorm + contextWeight * contextNorm) / blendedPrice`

Trong đó throughputNorm/contextNorm đã scale về [0,1].

Truy vết:

- Lưu `trace` chứa weightedBenchmark, blendedPrice, weight map.
- Gắn `formulaVersion: v1` để hỗ trợ thay đổi công thức trong tương lai.

### 3.5 Aggregate auxiliary score

- Chỉ số phụ trợ để đọc nhanh, không thay benchmark tách nhóm.

## 4) Annotation Engine + Trust UX

`detectMajorChanges()` tạo chú giải tự động:

- `price-spike`: |% change giá input| >= 15%
- `benchmark-jump`: lệch lớn giữa nhóm benchmark và mặt bằng tổng phụ trợ
- `throughput-jump`: |trend throughput| >= 20%
- `context-upgrade`: đổi version hoặc tăng context đáng kể

Mỗi annotation có:

- `title`, `detail`
- `sources[]` click được

## 5) UI Layout/View Model

`toModelDetailPageViewModel()` + `buildModelDetailLayout()`

- Timeline đa trục đồng bộ theo timestamp:
  - price input/output
  - benchmark coding/reasoning/context
  - throughput
  - context tokens
  - intelligence-per-dollar
- Panel benchmark tách riêng từng nhóm + trend
- Trust panel gom source links theo sự kiện
- Ghi chú rõ: điểm tổng là phụ trợ

## 6) Data Quality Rules (Gate trước khi publish)

Gate lỗi cứng:

- MISSING_PRICE
- MISSING_BENCHMARK
- MISSING_GROUP
- MISSING_THROUGHPUT
- MISSING_CONTEXT

Gate cảnh báo kỹ thuật:

- DUPLICATE_TIMESTAMP
- INVALID_SCALE

Khuyến nghị CI:

- Fail build nếu có lỗi cứng ở snapshot mới
- Cảnh báo cho duplicate/scale để data team xử lý

## 7) Mở rộng nguồn benchmark/price mới

Khi thêm nguồn mới:

1. Chuẩn hóa timestamp về ISO UTC
2. Map score raw + min/max scale
3. Bắt buộc source link cho từng point
4. Chạy `validateTimelineConsistency()` trước khi merge
5. Nếu đổi công thức, bump `formulaVersion`

## 8) Rủi ro và trade-off

- Việc drop snapshot thiếu dữ liệu làm giảm mật độ timeline nhưng tăng độ tin cậy.
- IPD phụ thuộc normalization quality; cần quản lý tốt source scale metadata.
- Ngưỡng annotation hiện heuristic; nên hiệu chỉnh bằng dữ liệu thực tế sản phẩm.
