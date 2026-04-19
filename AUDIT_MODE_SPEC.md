# Audit Mode Spec (Compare + Model Detail)

Task ID: e5935902-3c90-421a-a212-e8bfe40b581f

## Goal
Bổ sung chế độ audit để mọi con số giá/throughput/context/benchmark có thể truy xuất nguồn gốc đầy đủ và kiểm chứng được.

## Data Contract
Mỗi record hiển thị trên UI phải có provenance tối thiểu:

- `recordId` (duy nhất)
- `modelId`
- `metric` (`input_price` | `output_price` | `throughput` | `context_window` | `benchmark`)
- `sourceUrl`, `sourceTitle`, `sourceCapturedAtIso`
- `crawl.crawledAtIso`, `crawl.fetchedAtIso`, `crawl.crawlerJobId`, `crawl.userAgent`
- `parser.name`, `parser.version`, `parser.configVersion`
- `parseConfidence` (0..1)
- `rawSnippet`
- `rawSnapshot.objectUrl`, `rawSnapshot.mimeType`, `rawSnapshot.byteSize`, `rawSnapshot.sha256`
- `checksum` (sha256 của canonical record)
- `notes`

## Validation Rules
- Bắt buộc: `recordId`, `modelId`, `sourceUrl`, `rawSnapshot.objectUrl`, `rawSnapshot.sha256`, `checksum`.
- `rawSnapshot.sha256` và `checksum` phải là chuỗi hex SHA-256 64 ký tự.
- `crawl.fetchedAtIso` không được nhỏ hơn `crawl.crawledAtIso`.
- `parser.name` và `parser.version` bắt buộc có.

## Storage & API
- DB lưu metadata provenance theo `recordId`.
- Object storage lưu raw snapshot file.
- API metadata:
  - `GET /api/provenance/:recordId`
  - `GET /api/models/:modelId/provenance`

## UI/UX
- Compare page: mỗi cell hiển thị tooltip audit nhanh + action mở drawer.
- Model detail page: drawer audit hiển thị đầy đủ:
  - Source URL
  - Crawl/fetch time
  - Parser version/config
  - Raw snapshot URL + checksum
  - Record checksum

## Fallback policy
- Nếu thiếu provenance bắt buộc => không render audit payload, trả lỗi validation ở ingest.
- Không phát sinh record "partial provenance" để tránh số liệu không kiểm chứng được.

## Risks / Trade-offs
- Tăng chi phí lưu object storage do snapshot raw.
- Tăng latency nhẹ khi fetch metadata provenance.
- Bù lại: truy xuất nguồn gốc đầy đủ, hỗ trợ xử lý tranh chấp dữ liệu.
