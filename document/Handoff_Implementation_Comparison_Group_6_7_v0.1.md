# Handoff cho Claude — Comparison Group 6/7

**Date:** 2026-09-24 · **Review scope:** REQ-CMP-001–018, REQ-ENV-004, REQ-OUT-002; Database Standard v2.0; API Design Standard file `API_Design_Standard_v2.0(6).docx`; AnD Database v0.3; AnD API v0.2.  
**Review result:** Không còn mâu thuẫn **đã phát hiện giữa hai bản AnD và bộ requirement trong phạm vi file được cung cấp** sau các chỉnh sửa dưới đây. Chưa kiểm tra repo Prisma/NestJS/OpenAPI thực tế, nên chưa thể xác nhận tương thích implementation hoặc gọi contract là Frozen. CMP-013–018 vẫn BA Proposed/Client Confirmation pending theo tài liệu nguồn; CMP-002 Priority Should.

## 1. Nguồn và thứ tự ưu tiên

1. Requirement đã duyệt của CMP-001–018, ENV-004, OUT-002 và các requirement RUN/SNP/AUTH có liên quan trong repo.
2. Database Standard v2.0 và API Design Standard đính kèm.
3. `AnD_Database_Group_6_7_Comparison_v0.3.md` và `AnD_API_Group_6_7_Comparison_v0.2.md`.
4. Schema/migration/API hiện hữu để **mapping kỹ thuật**, không dùng code hiện tại để thay đổi meaning đã chốt. Nếu có xung đột, ghi rõ source/impact và cập nhật AnD trước khi sửa behavior.

## 2. Findings đã sửa trong review

| ID | Phát hiện | Sửa trong tài liệu | Requirement |
| --- | --- | --- | --- |
| RV-01 | DB từng viết “A/B cùng scope” như invariant khi insert, làm mất record cặp đã xác định nhưng bị chặn | Persist hai Snapshot ID và attempt trước gate; A/B khác scope/invalidated có BLOCKED + reason; chỉ COMPLETED đòi gate đạt | CMP-005, CMP-014-04/08, CMP-016-09, ENV-004 |
| RV-02 | Cột Project/API/Environment của Comparison từng mô tả lấy từ cả A/B dù cặp mismatch | Cột lấy từ A để định tuyến quyền/lịch sử; B vẫn giữ ID lịch sử ở Snapshot riêng và được gate kiểm tra. Backend kiểm tra quyền với cả hai trước khi lộ reason | CMP-005, CMP-016-01, ENV-004 |
| RV-03 | ERD Execution→automatic Comparison thể hiện 0..N, trái với auto idempotency mỗi Execution/cặp | Chỉnh 0..1 AUTO/Execution và partial unique source Execution; manual có identity riêng | CMP-013-09, CMP-016-08 |
| RV-04 | Manual BASELINE_LATEST no-pair có nguy cơ lẫn availability của Run/Execution | Manual trả availability trong response, không ghi vào Execution; Run chỉ dùng NO_BASELINE/NO_NEW_SNAPSHOT | CMP-003/004, CMP-014-02/03, CMP-016-09 |
| RV-05 | API dùng 202 trong khi Standard chỉ định 201 cho create resource và Comparison/Chain/Attempt được tạo ngay | Đổi 201 Created + Location và status QUEUED; background engine cập nhật trạng thái sau đó; manual no-pair không tạo resource trả 200 | API Standard §14/16; CMP-013-07 |
| RV-06 | Summary version change chưa phân biệt UNKNOWN/thiếu với false | Changed flag nullable: true khi cả hai xác định và khác; false khi cả hai xác định và bằng; null khi không xác định | CMP-012-08/09 |
| RV-07 | API filter Execution chỉ xem source AUTO, có thể bỏ sót manual cặp dùng Snapshot từ Execution | Filter theo sourceExecution hoặc Execution của A/B; giữ permission Project | CMP-016-14 |
| RV-08 | Retryability được nói chung chung | Ghi rõ lỗi kỹ thuật retry; lỗi dữ liệu/format chỉ retry khi backend nay xử lý được; input mismatch/context/invalidation/completion không tự retry | CMP-014-09, CMP-016-07 |
| RV-09 | Chain create trả toàn bộ danh sách cặp, dễ không phù hợp khi chuỗi dài | Create trả ID/count; GET chain trả cặp phân trang, giữ A/B/ordinal và kết quả riêng | CMP-004-07/09/11, OUT-002-10/11 |

## 3. Invariants phải giữ khi implement

| Trường hợp | Persist/response đúng |
| --- | --- |
| Execution đầu không baseline, hoặc không tạo target Snapshot | Availability trên Execution, không Comparison một phía. Run/Snapshot outcome giữ riêng. |
| PAIR có hai Snapshot ID khác nhau, caller có quyền cả hai, nhưng gate context/Environment/invalidation không đạt | Comparison + attempt BLOCKED, Result NULL, reason gate; không output findings. Project/API/Environment trên Comparison là scope A; B lấy từ Snapshot. |
| Input actual khác theo rule áp dụng | Input outcome MISMATCH, BLOCKED, Result NULL; INPUT diagnosis theo quyền, không so output/không output Detail. |
| Input compatible, output so đầy đủ | Không output difference → SAME; có ít nhất một output difference → DIFFERENT; Result và published findings atomic. |
| Lỗi engine/payload dở sau khi phát hiện một số khác biệt | FAILED/BLOCKED với Result NULL; không publish output findings như Detail hoàn chỉnh. |
| Latest/baseline invalidated hoặc format unsupported | Không lùi baseline/latest sang Snapshot cũ. Khi đã có cặp, ghi gate reason; riêng manual latest không đủ cặp thì trả availability và không tạo Comparison. |
| Chain chứa Snapshot invalidated ở giữa | Giữ vị trí lịch sử; hai cặp chạm nó BLOCKED, không nối tắt; cặp khác tiếp tục, không Result tổng hợp. |
| Retry/duplicate auto event | Terminal attempt immutable; retry là attempt mới, không retry sau COMPLETED; một AUTO Comparison tối đa cho Execution. |
| Classification | Chỉ COMPLETED/DIFFERENT; absent khác UNEXPECTED; append event + revision guard; không sửa Result/Detail. CMP-002 Should có thể triển khai sau core. |
| Latency/versions | Metadata từ Snapshot, delta B−A khi đủ dữ liệu, UNKNOWN không suy changed; actual field trong response body/header vẫn so strict. |
| Binary/multipart | So full bytes cùng representation boundary; không từ filename/hash/preview; input khác dừng trước output. |

## 4. Contract/physical mapping cần đọc trong repo

Các mục dưới đây là **kiểm chứng thực trạng**, không phải mâu thuẫn requirement. Claude cần tìm bằng chứng ở file/code/migration và ghi mapping vào báo cáo trước khi freeze hoặc thay đổi contract:

| Gate | Kiểm chứng và quyết định cần ghi |
| --- | --- |
| G1 — Schema | Model/tên PK/FK/unique của Execution, Snapshot, payload, invalidation, Project/API/Environment/User; cardinality Execution–Snapshot; migration Group 5 đã chạy. Ánh xạ logical table/cột DB v0.3; migration mới, không sửa migration đã áp dụng. |
| G2 — Raw evidence | Snapshot hiện có lưu đủ actual request/response headers (kể cả repeated value order), raw bytes, body absent/0 byte, metadata encoding/representation, binary/multipart và auth context lịch sử không? Nếu thiếu, bổ sung capture/persistence trước khi cho engine trả Result. |
| G3 — Policy | Nguồn policy loại trừ secret/header/field, version, representation manifest và quyền truy xuất. Không tự skip Date/timestamp/nonce/boundary, không so token raw như identity. |
| G4 — API/Auth | Path/DTO/OpenAPI của Run/Snapshot hiện có; stable auth context selector cho BASELINE_LATEST; permission matrix view/compare/retry/classify/raw/note; errorCode catalog. Mapping nếu tên hiện hữu khác, giữ semantics. |
| G5 — Full Detail | API hiện hữu có cách phân trang/đọc an toàn phần raw/byte segment chưa? Chỉ `safe preview` không đủ để tuyên bố cung cấp toàn bộ Detail theo CMP-015/OUT-002. Thiết kế quyền và contract đọc tiếp trước khi freeze phần này. |
| G6 — Operations | Retention/archive/anonymize do data owner quyết định; hiện AnD chọn không xóa tự động/RESTRICT. DB smoke test cần Postgres chạy thực, khác với unit/integration test mock. |

**Blocking để kết luận SAME/DIFFERENT:** G1–G3, đặc biệt đầy đủ Snapshot raw/representation và rule/policy. **Blocking để freeze API cho baseline-latest/Detail:** G4–G5. Không cần chờ G6 mới dựng logical model/test core, nhưng phải giải quyết trước vận hành chính thức nếu chính sách tổ chức yêu cầu.

## 5. Thứ tự triển khai được đề nghị

1. Claude đọc requirement, hai Standard, AnD v0.3/v0.2 và repo; lập bảng `requirement → existing source → schema/API change → test`. Nếu bản AnD khác repo, phân loại “mapping tên” và “xung đột semantics” riêng.
2. Xác minh G1–G3; sửa nguồn Snapshot nếu thiếu bytes/headers/representation/auth context. Chỉ khi so đủ mới cho Result.
3. Thêm migration Comparison/attempt/finding/chain và Execution baseline/availability theo DB v0.3. Ràng buộc unique AUTO và completed attempt, FK/RESTRICT, transaction publish. Không backfill baseline từ lịch sử hiện tại.
4. Engine: gate pair → input actual → output actual; lưu reason đầu tiên; atomic Result/Detail; xử lý chunked binary và lỗi giữa chừng.
5. API core: manual pair, chain, list/detail/findings/attempts/retry, auto orchestration; cập nhật OpenAPI và test. Đối chiếu G4/G5 trước khi freeze BASELINE_LATEST và Detail đầy đủ.
6. Classification Should sau core, với revision conflict và quyền. UI chỉ gắn vào contract đã kiểm thử; không tự suy business rule từ prototype.

### Kiểm chứng tối thiểu

- First Run không baseline, Run lỗi/không Snapshot, target Snapshot hoàn tất nhưng Comparison lỗi: ba status khác nhau, không Result giả.
- Tie `executionCompletedAt` bằng Snapshot ID; concurrent Executions chốt baseline trước dispatch; invalidation trước/sau chọn.
- Same Project/API nhưng khác Environment ID; trùng tên Environment; khác auth context; cross-project không lộ existence.
- Input khác method/URL/query/header/body, secret exclusion có policy, array order, missing/null/empty, JSON raw key/whitespace/number; không output Result.
- Input compatible, output status/header/body giống/khác; header name case-insensitive, repeated value order strict; response actual timing/version fields vẫn so.
- Bytes binary/multipart full, boundary strict, 0 byte vs absent, corrupt/truncate/unsupported, chunk read lỗi sau partial difference.
- Chain invalidated ở giữa không nối tắt; manual A mới hơn B không đảo chiều; duplicate AUTO delivery; retry failure; classification concurrent revisions.
- Detail phân trang không bỏ findings, safe redaction không xóa dấu vết khác biệt, GET lịch sử sau policy/Environment/invalidation đổi không recompute.
- Migration trên DB trống và DB có dữ liệu Group 5, DB smoke khi Postgres sẵn sàng; OpenAPI schema/HTTP error/nullable khớp AnD.

## 6. Prompt giao Claude

> Hãy implement Group 6/7 Comparison theo toàn bộ REQ-CMP-001–018, REQ-ENV-004, REQ-OUT-002, Database Standard và API Design Standard trong repo. Dùng `AnD_Database_Group_6_7_Comparison_v0.3.md`, `AnD_API_Group_6_7_Comparison_v0.2.md` và handoff này làm thiết kế đầu vào. Trước khi sửa code, đọc schema/migration Group 5 và API/DTO/OpenAPI hiện hữu, báo mapping G1–G5 với đường dẫn file cụ thể; nêu xung đột semantics nếu có. Không suy Result từ preview/truncated data; input phải compatible trước output; chỉ publish SAME/DIFFERENT sau khi output so đầy đủ và Result/Detail được lưu nhất quán. Implement từng bước với migration mới, test các invariant ở mục 5 và báo rõ test nào chạy/chưa chạy. Nếu thiếu raw bytes/representation/auth context hoặc full Detail access, sửa/đề xuất thiết kế nguồn tương ứng và cập nhật AnD/OpenAPI trước khi freeze phần đó; không tự tạo policy loại trừ hoặc quyền role mới.

## 7. Giới hạn của review

Review này dựa trên **tài liệu đã cung cấp trong workspace**, không có checkout QC_Tool, Prisma schema, API code hay database đang chạy trong phiên này. Vì vậy “không còn mâu thuẫn” chỉ là giữa requirement–AnD Database–AnD API sau khi sửa RV-01–09. Tính khả thi vật lý, tên field, khả năng lưu raw và quyền cụ thể vẫn cần Claude xác minh G1–G6 trên repo. Nếu phát hiện xung đột mới, cập nhật hai AnD và trace trước khi coi implementation là hoàn tất.
