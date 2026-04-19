# Model Snapshot Contract & Pipeline Spec

Task ID: `4c489bef-223c-43e8-90dc-9f281b808df8`

## Goal
Thiết kế data contract + validation để **chỉ ghi snapshot khi đủ price + benchmark + throughput + context window** theo cùng mốc thời gian đã align bucket.

## 1) Data contract bắt buộc

`UnifiedSnapshot` yêu cầu đầy đủ:
- `price` (input/output USD per 1M + source)
- `benchmarks.coding/reasoning/context` (normalized /100 + source)
- `throughput.tokensPerSecond` + source
- `contextWindow.contextWindowTokens` + source
- `intelligencePerDollar` + formula + weights

Mỗi thành phần đều có `source` (`sourceId`, `sourceUrl`, `fetchedAtIso`) để truy vết và hiển thị source link.

## 2) Validation rules

`validateCandidate(candidate)` enforce:
- Không có `price` => reject (`MISSING_PRICE`)
- Thiếu 1 trong 3 benchmark group => reject (`MISSING_BENCHMARK`)
- Thiếu throughput => reject (`MISSING_THROUGHPUT`)
- Thiếu contextWindow => reject (`MISSING_CONTEXT`)
- Timestamp không parse được => reject (`INVALID_TIMESTAMP`)
- Number âm/NaN/Infinity => reject (`INVALID_VALUE`)

> Nguyên tắc cứng: **không ghi snapshot thiếu**.

## 3) Dedup strategy

Sử dụng `dedupKey(modelId|group|capturedAtIso|sourceId)` để loại duplicate event ở bước merge trước khi build snapshot.

- Price/throughput/context dedup theo `(modelId, capturedAtIso, sourceId)`
- Benchmark dedup theo `(modelId, group, capturedAtIso, sourceId)`

## 4) Timestamp alignment

Dùng `alignToBucket(iso, bucketMs)` để normalize mọi event về cùng bucket (mặc định 1h):

- Convert ISO -> epoch ms
- Floor theo `bucketMs`
- Convert lại ISO

Việc align giúp so sánh price/benchmark/throughput/context trên cùng mốc timeline.

## 5) Fallback policy (không ghi thiếu)

`fallback.mode = "hold_only"`:
- Bucket thiếu dữ liệu được đưa vào `pendingByBucket`
- **Không upsert snapshot partial**
- Giữ pending theo giới hạn `maxPendingBuckets` (mặc định 24)
- Khi quá giới hạn thì drop bucket pending cũ nhất (chỉ drop pending, không ảnh hưởng snapshot đã hợp lệ)

## 6) Metric calculation

`intelligencePerDollar`:

- `weightedBenchmarks = coding*0.4 + reasoning*0.4 + context*0.2`
- `blendedPrice = (inputUsdPer1M + outputUsdPer1M) / 2`
- `score = weightedBenchmarks / blendedPrice`

Weights có thể override qua policy, nhưng luôn được serialize vào snapshot để audit.

## 7) Major-change annotations + source links

Sau khi có snapshot hợp lệ, engine tạo annotation khi vượt ngưỡng:
- Price spike: `|pctChange| >= 10%`
- Benchmark jump: `|delta| >= 8`
- Throughput drop: `<= -15%`
- Context change: value thay đổi

Mỗi annotation giữ `sourceUrl` để UI link trực tiếp.

## 8) UI model mapping

`toModelDetailViewModel()` map snapshots thành:
- Timeline series: price input/output, throughput, context window, intelligence-per-dollar
- Benchmark panels riêng: coding/reasoning/context
- Major changes feed: timestamp + message + sourceUrl

Phù hợp yêu cầu “benchmark tách nhóm, điểm tổng chỉ phụ trợ”.

## 9) Extension guide

Để thêm nguồn benchmark/price mới:
1. Parse về event chuẩn (`PriceEvent`, `BenchmarkEvent`, ...)
2. Chuẩn hóa đơn vị trước khi emit event
3. Bắt buộc gắn `source` metadata
4. Feed vào `buildUnifiedSnapshots`
5. Quan sát `rejected` + `pendingByBucket` để xử lý thiếu dữ liệu upstream

## 10) Handoff checklist (test-ready)

- [x] Contract định nghĩa rõ mandatory fields
- [x] Validation reject partial snapshot
- [x] Dedup key deterministic
- [x] Timestamp alignment nhất quán bucket
- [x] Fallback policy documented (hold-only)
- [x] Metric formula traceable
- [x] Annotation có source links
- [x] UI mapping tách benchmark theo nhóm
