# AnD UI — Comparison, Result và Detail

**Version:** 0.1 · **Date:** 2026-09-24 · **Status:** UI design proposal, chưa UI freeze  
**Scope:** REQ-CMP-001–018, REQ-ENV-004, REQ-OUT-002; tham chiếu AnD Database v0.3, AnD API v0.2.  
**Prototype:** `Comparison_UI_Prototype_v0.1.html` là dữ liệu minh họa, không kết nối backend. CMP-002 (classification) Priority Should; CMP-013–018 là BA Proposed và còn Client Confirmation theo quy trình dự án.

## 1. Mục tiêu và nguyên tắc trình bày

Người dùng cần trả lời nhanh: **đã so cặp nào, phép so đang ở bước nào, có Result chưa, và output A→B khác ở đâu**. UI không tự tính Result từ dữ liệu hiển thị. Luôn tách bốn khái niệm:

| Khái niệm | Nguồn | UI |
| --- | --- | --- |
| Availability | Execution hoặc phản hồi chọn baseline-latest không dựng được cặp | Thông báo “chưa có đủ hai Snapshot”; không tạo dòng Comparison giả |
| Processing status/reason | Comparison attempt | Đang xử lý / Không đủ điều kiện / So sánh thất bại, kèm reason an toàn |
| Result | Completed attempt | Badge SAME hoặc DIFFERENT **chỉ khi COMPLETED** |
| Classification | Event người dùng, chỉ DIFFERENT | Chưa đánh dấu / Expected / Unexpected, hiển thị riêng Result |

**SAME** nghĩa cặp hợp lệ, actual input tương thích, toàn bộ output thuộc phạm vi đã so và không có output difference. Latency/API Version/Database Version có thể khác; chúng là metadata riêng. **DIFFERENT** nghĩa output khác sau khi input compatible và so output đầy đủ; không tự là bug hay Unexpected. Input mismatch dừng trước output, Result rỗng.

## 2. Kiến trúc màn hình

| UI ID | Vị trí | Mục đích | API |
| --- | --- | --- | --- |
| UI-CMP-01 | Project → Comparisons | Danh sách lịch sử, filter/sort, status và Result riêng | API-CMP-003 |
| UI-CMP-02 | “Tạo Comparison” drawer | Chọn baseline vs latest, hai Snapshot bất kỳ, hoặc chuỗi liên tiếp | API-CMP-001/002 |
| UI-CMP-03 | Comparison Detail | Summary A→B, input gate, output Detail, metadata, attempt/classification | API-CMP-004/005/006/009/010 |
| UI-CMP-04 | Chain Detail | Danh sách cặp theo ordinal, từng Result/status độc lập | API-CMP-008 |
| UI-CMP-05 | Run/Execution context | Baseline ID, target Snapshot và availability; link Comparison khi có | Run/Execution API hiện hữu + auto Comparison |

Điều hướng bằng `comparisonId`/`comparisonChainId`, không dùng vị trí dòng. Project context vẫn rõ khi vào deep link. Nếu người dùng mất quyền, trang chuyển Access Denied/Not Found an toàn, xóa dữ liệu Detail đang giữ ở client; không dùng cache ngoài phạm vi quyền.

## 3. UI-CMP-01 — Comparison History

### 3.1 Bố cục

Header gồm breadcrumb `Project / Comparisons`, tiêu đề, mô tả ngắn “Lịch sử đối chiếu Snapshot”, nút **Tạo Comparison** nếu có quyền. Thanh filter: API, Snapshot ID, Execution ID, nguồn, processing status, Result; dùng `page/pageSize` theo API. Bảng desktop:

| Cột | Nội dung |
| --- | --- |
| Cặp Snapshot | A → B rút gọn ID nhưng có copy ID; tooltip/full ID khi cần; chiều không đảo |
| API / Environment | Tên dễ đọc kèm ID lịch sử khi cần; không suy Environment từ tên hiện tại |
| Nguồn | Automatic / Hai Snapshot / Baseline vs latest / Chuỗi #n |
| Thời điểm | Thời điểm tạo Comparison, thời điểm Snapshot A/B ở Detail |
| Trạng thái xử lý | QUEUED/RUNNING/BLOCKED/FAILED/COMPLETED bằng nhãn chữ |
| Result | SAME/DIFFERENT chỉ với COMPLETED; còn lại “—” |
| Đánh giá | Chưa đánh dấu/Expected/Unexpected chỉ với DIFFERENT; có thể ẩn khi CMP-002 chưa triển khai |
| Thao tác | “Xem chi tiết”; không có nút kết luận SAME/DIFFERENT thủ công |

Default sort `createdAt DESC, comparisonId DESC`; giữ filter khi quay lại từ Detail. Empty state “Chưa có Comparison trong Project này” và CTA theo quyền. Loading skeleton không hiển thị badge kết quả giả. Error state có retry tải danh sách; 401 điều hướng Session Expired, 403/404 không lộ dữ liệu.

### 3.2 Badge và ngôn ngữ

| Dữ liệu API | Nhãn UI | Result cell | Màu + icon (không chỉ dựa màu) |
| --- | --- | --- | --- |
| QUEUED/RUNNING | Chờ xử lý / Đang so sánh | — | Neutral/blue + spinner |
| BLOCKED + INPUT_MISMATCH | Input không tương thích | — | Amber + cảnh báo |
| BLOCKED + ENVIRONMENT_MISMATCH/CONTEXT_MISMATCH | Cặp không đủ điều kiện | — | Amber + cảnh báo |
| BLOCKED + SNAPSHOT_INCOMPLETE/UNSUPPORTED_FORMAT/... | Không thể so đầy đủ | — | Amber + cảnh báo |
| FAILED | So sánh thất bại | — | Red + lỗi |
| COMPLETED + SAME | Hoàn tất | SAME | Green + dấu kiểm |
| COMPLETED + DIFFERENT | Hoàn tất | DIFFERENT | Red/rose + dấu khác biệt |

Reason detail chỉ hiển thị thông điệp backend đã làm an toàn; không render raw token/credential. Status “không đủ điều kiện” khác lỗi target Run. Không badge SAME/DIFFERENT trên dòng Execution chưa có cặp.

## 4. UI-CMP-02 — Tạo Comparison

Drawer hoặc trang con với 3 tab; chỉ hiển thị cho người có quyền Compare. Project là context hiện tại, backend vẫn kiểm tra. Nút chính “Bắt đầu so sánh” hoặc “Tạo chuỗi so sánh”; sau 201 mở Detail/Chain theo Location. Nếu baseline-latest trả 200 no-pair, giữ drawer và nêu availability; không mở Detail giả.

| Tab | Controls | Validation và giải thích |
| --- | --- | --- |
| Baseline vs latest | API, Environment ID, auth context ổn định (label an toàn, không raw token) | Backend chọn latest và đọc baseline đã chốt của Execution nguồn; UI không tự tính lại hay cho thay bằng bản cũ nếu baseline invalidated/format unsupported. Selector auth context phụ thuộc API-VERIFY-02. |
| Hai Snapshot bất kỳ | Snapshot A (mốc), Snapshot B (đối chiếu) | ID khác nhau; A có thể mới hơn B. Hiển thị A→B rõ, không auto swap. UI lọc cùng scope để giảm lỗi nhưng backend vẫn kiểm tra và ghi BLOCKED/reason khi cặp đã xác định không đạt gate. |
| Snapshot liên tiếp | Điểm đầu, điểm cuối trong cùng Project/API/Environment/auth context | Backend chốt toàn bộ Snapshot trong khoảng theo executionCompletedAt/ID; UI giải thích invalidated ở giữa vẫn giữ vị trí, không nối tắt. Từng cặp độc lập, không có Result toàn chuỗi. |

UI không nhận `result`, `status`, `reason`, rule/policy arbitrary hoặc raw credential từ người dùng. Nút disabled trong lúc gửi để tránh double click cùng UI session; nếu request timeout, GET/list lại trước khi người dùng cố gửi lại vì manual create không mặc nhiên idempotent. Field error 400/422 hiển thị cạnh control; 401/403 xử lý ở cấp trang. Auth context và quyền role cụ thể cần mapping với AUTH/USR trước UI freeze.

**No-pair message:** “Chưa có Snapshot latest trong phạm vi đã chọn”, “Execution của latest chưa có baseline”, hoặc “Baseline đã bị vô hiệu hóa; hệ thống không tự chọn bản khác.” Đây là availability của thao tác manual, không ghi đè trạng thái Execution.

## 5. UI-CMP-03 — Comparison Detail

### 5.1 Header và Summary

Breadcrumb `Comparisons / {comparisonId}`; header hiển thị API, Project, Environment lịch sử, source, A → B với full IDs/copy và thời điểm. Ngay dưới là **hai ô riêng**: Processing status (và gate/reason nếu dừng) và Result (SAME/DIFFERENT hoặc “Chưa có kết luận”). Classification chỉ xuất hiện bên cạnh khi Result DIFFERENT. Snapshot bị invalidated **sau** completion có banner “Trạng thái hiện tại của Snapshot”, không sửa Result lịch sử.

**Tab nội dung:**

1. **Tổng quan:** input check outcome, phạm vi output đã so, số output findings, nguồn và rule/policy version đã áp dụng.
2. **Khác biệt output:** chỉ dùng published OUTPUT findings sau COMPLETED/DIFFERENT. Chia nhóm HTTP status, response headers, response body; mỗi item có location, A→B safe view, difference kind, rule. SAME hiển thị “Không có khác biệt output trong phạm vi đã so”, không khẳng định mọi metadata giống nhau.
3. **Chẩn đoán input:** khi INPUT_MISMATCH hiển thị method/URL/header/body component, gate dừng, A→B an toàn; không đặt trong tab output hoặc gọi là DIFFERENT.
4. **Lịch sử xử lý:** attempts theo số thứ tự, status/gate/reason/time, nút “Thử lại” chỉ khi API cho phép và người dùng có quyền; không sửa attempt cũ.
5. **Lịch sử đánh giá:** chỉ khi CMP-002 triển khai và người dùng có quyền; revision, actor/time, note theo quyền.

Khi QUEUED/RUNNING: Summary có status, Result rỗng, không dựng output Detail. Poll GET có backoff; dừng poll khi terminal, khi rời trang hoặc mất quyền. Khi BLOCKED/FAILED: nêu reason chính và link attempt; không công bố findings output dở. Nếu retry trả 409, refresh Detail và nêu trạng thái mới thay vì ghi đè view cũ.

### 5.2 Difference Detail và bảo vệ dữ liệu

| Dạng | Cách trình bày |
| --- | --- |
| HTTP status | Code A → B; một finding khi khác |
| Header | Tên header không phân biệt hoa/thường, thứ tự giá trị lặp được giữ; show occurrence/index, giá trị safe A→B |
| JSON/text raw | Path nếu có chỉ là vị trí; với khác raw key order/whitespace/escape/số, hiển thị byte range/hex hoặc safe excerpt để không ngụ ý parse equivalence |
| Array | Index từng cấp và chiều A→B; không sắp xếp hay ghép theo ID |
| Absent/null/empty/type | Nhãn tách biệt “Không tồn tại”, “JSON null”, “Chuỗi rỗng”, “Mảng rỗng”, “Kiểu khác”; không dùng cùng ký hiệu “—” |
| Binary/multipart | Part nếu xác định được, byte offset/length, safe hex preview; filename/size/hash chỉ là metadata, không là bằng chứng SAME |
| Secret/restricted | Redacted view nhưng giữ component/location và chỉ dấu có khác biệt; không cho copy raw nếu không có quyền |

Trang findings có `x–y / totalItems`, nút Trang trước/Tiếp, `hasMore`, và dấu “Preview đã rút gọn — còn nội dung” theo từng finding. **Không thêm nút download/raw range khi API-VERIFY-03/G5 chưa giải quyết**; nếu chưa có cách truy xuất phần bị rút gọn theo quyền, UI không được tuyên bố Detail đã đầy đủ và feature chưa đạt OUT-002-10/CMP-015-10. View raw phải có contract và permission riêng.

### 5.3 Metadata tách Result

Khối “Bối cảnh hai lần chạy” có Latency A, B, Δ = B−A (ms); một phía thiếu thì “Không có dữ liệu”, Δ rỗng, không dùng 0. API Version và Database Version có hai hàng A→B; badge “Version changed” chỉ khi cả hai phía của loại đó xác định và khác chuỗi; UNKNOWN/thiếu → “Chưa xác định”, không dùng changed=false như chắc chắn bằng nhau. Metadata không làm đổi SAME/DIFFERENT. Actual body/header có field `durationMs`/`version` vẫn là output strict theo engine.

### 5.4 Classification (Should)

DIFFERENT mới xuất hiện control “Đánh dấu thay đổi”. Mặc định “Chưa đánh dấu”; chọn Expected/Unexpected, note tùy chọn; không có CLEAR. UI gửi `expectedRevision` hiện thấy. 409 conflict → tải revision mới và cho người dùng quyết định gửi lại, không tự ghi đè. Hiển thị Result DIFFERENT cạnh classification riêng; đánh dấu không chạy lại Comparison. Khi tính năng Should chưa triển khai, Result/Detail Must vẫn hoạt động đầy đủ.

## 6. UI-CMP-04/05 — Chain và Execution

**Chain Detail:** header Project/API/Environment, số Snapshot và số cặp, danh sách cặp phân trang theo ordinal. Mỗi dòng A→B, status, Result, classification (nếu có), reason an toàn; click mở đúng comparisonId. Không hiển thị một badge SAME/DIFFERENT tổng hợp. Một cặp mismatch/failed không làm mất các cặp còn lại.

**Execution context:** baseline được chốt trước dispatch (ID hoặc “Không có baseline”), target Snapshot ID nếu tạo được, availability NO_BASELINE/NO_NEW_SNAPSHOT và link tới Comparison tự động khi có cặp. Nếu Run lỗi, hiển thị Run outcome/error của nguồn riêng; không biến thành Comparison FAILED. Snapshot sau Run đầu vẫn có thể lưu làm mốc cho lần sau. Comparison tự động có thể tiếp tục xử lý sau khi Snapshot đã hoàn tất, UI hiển thị QUEUED/RUNNING rồi cập nhật terminal.

## 7. Responsive, accessibility và visual tokens

- Desktop: sidebar Project, content tối đa khoảng 1440px; Detail dùng Summary full width và findings table/cards. Tablet/mobile: filter trong panel, mỗi Comparison là card; A→B và status/Result không bị ẩn. Drawer tạo Comparison chuyển thành full-screen sheet trên mobile.
- Primary `#C41230` theo prototype dự án; nền light, chữ đậm dễ đọc, border phân cấp rõ. Màu trạng thái chỉ là tín hiệu phụ; luôn có nhãn và icon.
- Font ưu tiên Plus Jakarta Sans/Inter với fallback hệ thống; body 14–16px, heading 24–28px, spacing 8px grid, focus ring rõ. Contrast trạng thái/text đạt WCAG AA khi implement; prototype cần kiểm tra bằng công cụ.
- Tab/row/button dùng keyboard; mỗi card có tên accessible chứa cặp A→B, status và Result. Loading/poll dùng `aria-live=polite` ở status, không đọc lại cả trang mỗi lần cập nhật. Bảng header có scope, pagination thông báo số trang.
- No export/email/chat/webhook/CI button trong MVP. Không dùng ngôn ngữ “PASS/FAIL”, “bug” hoặc “đúng/sai” cho SAME/DIFFERENT.

## 8. UI state → API mapping

| State/interaction | API/field | UI contract |
| --- | --- | --- |
| History loading/empty/error | GET comparisons | Skeleton/empty/retry, không badge Result tạm |
| Create pair/chain | POST comparisons/chain | 201 mở resource; manual no-pair 200 giữ form và thông báo |
| Comparison processing | GET comparison `processingStatus` | Poll, Result placeholder, không output Detail |
| Ineligible/input mismatch/failed | `stoppedAtGate`, `reasonCode`, `inputCheckOutcome` | Reason/gate riêng; output findings rỗng |
| SAME/DIFFERENT | `result`, `outputDifferenceCount` | Badge chỉ khi COMPLETED; khác biệt output riêng |
| Findings dài | GET findings `page/pageSize/hasMore` | Phân trang và chỉ dấu preview rút gọn |
| Retry | POST attempts | 201 thêm attempt; 409 refresh status |
| Classification | POST/GET events `expectedRevision` | 201 cập nhật; 409 xử lý xung đột |
| No baseline/target Execution | Existing Run/Execution contract | Availability ở Execution, không tạo Comparison card |

## 9. Traceability và review gate

| Requirement | UI |
| --- | --- |
| CMP-001 | SAME/DIFFERENT chỉ sau cặp hợp lệ, input compatible, output so đầy đủ |
| CMP-002 | Classification độc lập, role/revision/history, Should |
| CMP-003 | Baseline của Execution chốt trước dispatch; latest đọc ID đã chốt |
| CMP-004 | Ba cách chọn cặp, giữ chiều manual A→B và chain frozen/per-pair |
| CMP-005 | Gate context/eligibility, BLOCKED reason; không dùng tên Environment để ghép |
| CMP-006 | Actual input outcome, diagnosis riêng, mismatch dừng trước output |
| CMP-007 | Output strict theo status/header/body, Result không suy từ preview |
| CMP-008 | Array index và thứ tự từng cấp ở Difference Detail |
| CMP-009 | Absent/null/empty tách nhãn và không nhầm dữ liệu hỏng |
| CMP-010 | Kiểu/biểu diễn số raw khác nhau thể hiện rõ A→B |
| CMP-011 | Latency A/B/Δ ms riêng, thiếu một phía không thay bằng 0 |
| CMP-012 | API/DB Version A→B, UNKNOWN/thiếu → changed chưa xác định |
| CMP-013 | Auto processing per Execution, Snapshot thành công vẫn có thể chờ Comparison |
| CMP-014 | No-pair availability, blocked/failed/status/reason/retry tách Result |
| CMP-015 | Findings A→B an toàn, phân trang, chỉ dấu còn nội dung |
| CMP-016 | History identity/source/attempt/rule và truy xuất theo đúng cặp |
| CMP-017 | Representation boundary/raw bytes và safe preview/unsupported |
| CMP-018 | Binary/multipart part/byte location; metadata file không là kết luận |
| ENV-004 | Environment ID lịch sử, mismatched pair blocked trước input |
| OUT-002 | Summary/Detail/status/Result/chain theo đúng quyền |

**Cần đối chiếu trước UI freeze:**

1. API-VERIFY-02: selector auth context ổn định cho baseline-latest; không hiển thị raw credential.
2. API-VERIFY-03/G5: cách xem tiếp raw/binary Detail sau preview, theo quyền; nếu thiếu thì OUT-002-10/CMP-015-10 chưa hoàn tất.
3. API-VERIFY-04: quyền view/compare/retry/classify/raw/note từ USR/AUTH.
4. Mapping UI route, Project navigation và component tokens với `apps/web` thực tế; prototype hiện tại không phải nguồn nghiệp vụ.
5. OpenAPI/DB field thực sau mapping repo; cập nhật UI spec nếu contract đổi, không đổi nghĩa requirement.

## 10. Acceptance scenarios trọng yếu

| ID | Given/When | Then |
| --- | --- | --- |
| UI-AC-01 | First Run có S1 nhưng không baseline | Execution hiển thị NO_BASELINE; History không có Comparison một Snapshot |
| UI-AC-02 | Cặp đang xử lý | Status QUEUED/RUNNING, Result “—”, output tab không dựng khác biệt |
| UI-AC-03 | Input mismatch | Chẩn đoán input và gate; Result rỗng, không DIFFERENT/output Detail |
| UI-AC-04 | SAME, latency/version khác | SAME và “0 output difference”; metadata A/B/Δ/Version changed riêng |
| UI-AC-05 | DIFFERENT ở status/header/body | Detail đúng A→B, nhóm thành phần, location/rule và pagination |
| UI-AC-06 | Chain có invalidated ở giữa | Cặp chạm nó BLOCKED, cặp khác vẫn có Result riêng, không nối tắt |
| UI-AC-07 | Engine lỗi sau partial difference | FAILED, Result rỗng, không output Detail hoàn chỉnh |
| UI-AC-08 | Version UNKNOWN hoặc latency thiếu | Changed “Chưa xác định”; Δ rỗng, không tự dùng 0 |
| UI-AC-09 | Classification revision conflict | 409, refresh và yêu cầu người dùng xác nhận giá trị mới |
| UI-AC-10 | Mất quyền khi đang xem | Request tiếp theo bị từ chối, UI xóa Detail/secret đang giữ |

## 11. Change log

| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 2026-09-24 | UI AnD và prototype cho Group 6/7, trace requirement/API, chưa freeze |
