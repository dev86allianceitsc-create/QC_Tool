# AnD API — Group 6 Comparison và Group 7 Result/Classification

**Version:** 0.2 · **Date:** 2026-09-24 · **Status:** Reviewed design proposal, chưa contract freeze  
**Standard:** `API_Design_Standard_v2.0(6).docx` · **Requirements:** REQ-CMP-001–018, REQ-ENV-004, REQ-OUT-002.  
**DB companion:** `AnD_Database_Group_6_7_Comparison_v0.3.md`. CMP-013–018 là BA Proposed, đã được BA duyệt, còn Client Confirmation theo quy trình dự án; CMP-002 Priority Should.

**Ghi chú nguồn chuẩn:** file đính kèm mang tên/tiêu đề v2.0, nhưng bảng metadata ghi v2.1 trong khi change log ghi v2.0 Active. Bản AnD này dùng các quy tắc nội dung chung của file; cần thống nhất số version tài liệu khi lưu vào repo, không tự coi bảng metadata là một chuẩn khác.

## 1. Trách nhiệm API và ranh giới

- **Frontend** yêu cầu so cặp/chuỗi, đọc Summary/Detail/history, gửi đánh giá Expected/Unexpected. Không gửi Result, processing status, reason, finding, rule manifest, Project/API/Environment authoritative của Comparison hoặc actor ID.
- **Backend** kiểm tra session/quyền trước khi lộ Snapshot/Comparison; chốt Snapshot ID và chiều; tạo tác vụ, gọi engine, lưu status/Result/Detail nhất quán; trả lịch sử đúng dữ liệu đã ghi. Engine so **actual input trước**, chỉ khi compatible mới so toàn bộ actual output. SAME/DIFFERENT không được suy từ preview, latency/version hay input mismatch.
- **Run orchestration nội bộ** chốt baseline ngay trước dispatch của từng Execution và gọi Comparison sau khi target Snapshot đủ điều kiện. Đây không phải public frontend endpoint mới; hợp đồng hiện hữu của Run/Execution cần bổ sung availability, baseline ID và liên kết Comparison khi có cặp.
- **Snapshot/AUTH** cung cấp immutable actual bytes, headers, representation, Project/API/Environment/auth context lịch sử và invalidation hiện hành. API Comparison không gọi lại target API, không sửa Snapshot, không dùng cấu hình hiện tại để dựng lại dữ liệu.

### 1.1 Danh mục operation

| API ID / operationId | Method + path | Purpose | Requirement | Status |
| --- | --- | --- | --- | --- |
| API-CMP-001 `createComparison` | POST `/api/v1/projects/{projectId}/comparisons` | Yêu cầu so một cặp tự chọn hoặc baseline vs latest | CMP-004/005/013/014/016; ENV-004 | DESIGN PROPOSAL |
| API-CMP-002 `createComparisonChain` | POST `/api/v1/projects/{projectId}/comparison-chains` | Chốt dãy Snapshot và tạo từng cặp kề nhau | CMP-004/005/016 | DESIGN PROPOSAL |
| API-CMP-003 `listComparisons` | GET `/api/v1/projects/{projectId}/comparisons` | History/Summary theo Project, filter API/Snapshot/Execution | CMP-016; OUT-002 | DESIGN PROPOSAL |
| API-CMP-004 `getComparison` | GET `/api/v1/comparisons/{comparisonId}` | Summary, bối cảnh và trạng thái cặp | CMP-001/011/012/014/016; OUT-002 | DESIGN PROPOSAL |
| API-CMP-005 `listComparisonFindings` | GET `/api/v1/comparisons/{comparisonId}/findings` | Difference Detail hoặc chẩn đoán input phân trang | CMP-006/015/017/018; OUT-002 | DESIGN PROPOSAL |
| API-CMP-006 `listComparisonAttempts` | GET `/api/v1/comparisons/{comparisonId}/attempts` | Lịch sử thử lại và reason | CMP-014/016 | DESIGN PROPOSAL |
| API-CMP-007 `retryComparison` | POST `/api/v1/comparisons/{comparisonId}/attempts` | Tạo lần thử mới khi có thể khắc phục | CMP-014/016 | DESIGN PROPOSAL |
| API-CMP-008 `getComparisonChain` | GET `/api/v1/comparison-chains/{comparisonChainId}` | Xem danh sách cặp và kết quả từng cặp | CMP-004/016; OUT-002 | DESIGN PROPOSAL |
| API-CMP-009 `createClassificationEvent` | POST `/api/v1/comparisons/{comparisonId}/classification-events` | Đánh dấu/đổi Expected hoặc Unexpected có revision | CMP-002 | DESIGN PROPOSAL, Should |
| API-CMP-010 `listClassificationEvents` | GET `/api/v1/comparisons/{comparisonId}/classification-events` | Xem lịch sử đánh giá | CMP-002 | DESIGN PROPOSAL, Should |

Resource `comparisons`, `comparison-chains`, `attempts`, `findings`, `classification-events` có identity/lifecycle hoặc là sub-resource lịch sử; không dùng `/cmp` làm namespace. Project ở path create/list vì scope ownership; item GET/attempts/findings resolve Project từ Comparison và kiểm tra quyền. Public API không có `POST /compare-engine/run` hay `PATCH result`. Base path `/api/v1`, JSON camelCase, UTC ISO 8601 `Z`; API Version trong Snapshot là business metadata, không phải `v1` của contract.

## 2. Quy ước dùng chung và field dictionary

### 2.1 Auth, transport, error, paging

| Field | Location | Type | Required | Nullable | Source | Validation/meaning | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Authorization` | Header | `Bearer <opaque-session-id>` | Y | N | Auth context | Session QC Tool còn hiệu lực; không gửi token ở query | CONFIRMED architecture |
| `Content-Type` | Header POST | `application/json` | Y | N | Client | JSON body | Standard |
| `projectId` | Path create/list | UUID | Y | N | Client | Backend kiểm tra quyền Project; khi PAIR, phải bằng Project ID lịch sử của Snapshot A. Scope của B được kiểm tra riêng tại gate | Standard/CMP-016; AnD |
| `comparisonId` | Path item | UUID | Y | N | Client | Resolve Comparison rồi check quyền trước khi trả reason/Detail | CMP-016 |
| `comparisonChainId` | Path item | UUID | Y | N | Client | Resolve chain rồi check quyền | CMP-004/016 |
| `page` | Query list | integer | N | N | Client | Mặc định 1, ≥1 | Standard; DESIGN PROPOSAL default |
| `pageSize` | Query list | integer | N | N | Client | Mặc định 20, 1–100 | Standard; DESIGN PROPOSAL limit |

**Authorization:** đọc danh sách/Detail/attempt/chain/classification đòi quyền xem Comparison thuộc Project; create/retry đòi quyền so; đánh dấu đòi quyền đánh giá. Quyền role cụ thể thuộc permission matrix USR/AUTH, chưa được CMP quyết định. Backend đọc membership/role hiện hành, kiểm tra cả Snapshot A/B trước khi xác nhận chúng tồn tại; cross-project không lộ thông tin qua reason. Raw payload/file download **không được mặc nhiên cấp** theo quyền xem Summary; nếu có API đọc raw riêng, phải theo AUTH/SEC và Snapshot contract, không nằm trong 10 operation này. Không ghi token/raw secret vào log/error/audit.

**Error envelope** áp dụng đúng Standard: `{errorCode, message, details?, requestId?}`; `details[] = {field, code, message}` khi có field lỗi. Dùng 400 syntax/UUID/missing field, 401 session, 403 quyền, 404 không thấy/ẩn existence, 409 xung đột state/revision, 422 business selection không hợp lệ, 500 unexpected. `requestId` phản chiếu `x-request-id` nếu tracing hiện hành. Domain `reasonCode` của Comparison là **dữ liệu trạng thái**, không phải `errorCode` HTTP. Cặp A/B đã chốt nhưng gate mismatch thường trả 201 cho Comparison đã tạo, rồi lưu BLOCKED/reason; không đổi thành HTTP 422 chỉ vì Result rỗng.

**Pagination:** `{items: [...], page, pageSize, totalItems, hasMore}`. Sort mặc định ổn định: comparisons `createdAt DESC, comparisonId DESC`; findings `phase ASC, findingOrdinal ASC, findingId ASC`; attempts `attemptNumber ASC`; classification events `revision DESC`. Chỉ filter/sort theo allowlist; không nhận tên cột DB tự do. Nếu lượng findings rất lớn, giới hạn `pageSize` và vẫn trả `hasMore`; không để preview quyết định Result.

### 2.2 Schema chung cho Summary

| Response field | Type | Nullable | Source/meaning | Status |
| --- | --- | --- | --- | --- |
| `comparisonId`, `projectId`, `apiId`, `environmentId` | UUID | N | Identity/scope lịch sử của cặp | CMP-016 |
| `baselineSnapshotId`, `targetSnapshotId` | UUID | N | A→B, không đảo theo thời gian | CMP-004/016 |
| `sourceKind` | enum: AUTO_EXECUTION, MANUAL_PAIR, BASELINE_LATEST, CHAIN_PAIR | N | Nguồn request; code AnD | CMP-004/013/016 |
| `sourceExecutionId`, `comparisonChainId`, `pairOrdinal` | UUID/UUID/integer | Y | Có theo source tương ứng | CMP-013/016 |
| `processingStatus` | enum: QUEUED, RUNNING, BLOCKED, FAILED, COMPLETED | N | Latest attempt nếu chưa completion; completion có hiệu lực nếu đã hoàn tất | CMP-014/016; AnD |
| `stoppedAtGate`, `reasonCode`, `reasonDetailSafe` | string | Y | Gate/lý do đầu tiên; không lộ secret | CMP-014/016 |
| `inputCheckOutcome` | enum: COMPATIBLE, MISMATCH | Y | NULL khi chưa kiểm tra được | CMP-006/014 |
| `result` | enum: SAME, DIFFERENT | Y | Chỉ có khi COMPLETED sau input compatible và output so đủ | CMP-001/016 |
| `outputDifferenceCount` | integer | Y | 0 khi SAME, ≥1 khi DIFFERENT; NULL nếu chưa hoàn tất | CMP-015/016; AnD |
| `classification` | enum: EXPECTED, UNEXPECTED | Y | NULL = chưa đánh dấu, độc lập Result | CMP-002 |
| `classificationRevision`, `classifiedBy`, `classifiedAt` | integer/UUID/datetime | Y | NULL cùng nhau nếu chưa đánh dấu | CMP-002 |
| `baselineSnapshot`, `targetSnapshot` | `SnapshotSummary` | N | Mỗi phía: `projectId`, `apiId`, `environmentId`, `executionCompletedAt`, `latencyMs`, `apiVersion`, `databaseVersion`, `isInvalidatedNow`; chỉ sau khi đã kiểm tra quyền cả hai Snapshot | CMP-005/011/012/016; ENV-004/OUT-002 |
| `latencyDeltaMs`, `apiVersionChanged`, `databaseVersionChanged` | number/boolean/boolean | Y/Y/Y | Delta = B−A nếu đủ latency; changed là null khi một phía UNKNOWN/thiếu, true khi hai giá trị xác định khác nhau, false khi bằng nhau | CMP-011/012 |
| `createdAt`, `endedAt` | datetime | N/Y | UTC; `endedAt` NULL khi chưa terminal | CMP-016 |

`SnapshotSummary.latencyMs` nullable, đơn vị ms, giữ độ chính xác nguồn; không thay thiếu bằng 0. `apiVersion`/`databaseVersion` giữ `UNKNOWN` nếu đó là giá trị lịch sử và có thể nullable nếu dữ liệu lịch sử hỏng; changed flag null khi một phía UNKNOWN/thiếu. Delta chỉ tính khi cả hai latency hợp lệ. Latency/version không làm đổi Result; trường mang tên latency/version **nằm trong actual response** vẫn thuộc output strict. `isInvalidatedNow` là trạng thái hiện hành tách khỏi Result lịch sử. `reasonDetailSafe` phải redacted theo quyền.

## 3. Write operations

### API-CMP-001 — `createComparison`

**Actor:** user có quyền so trong Project. **AuthN:** Required. **AuthZ:** compare permission trong Project, đồng thời quyền truy cập cả Snapshot được resolve. **Request:** `POST /api/v1/projects/{projectId}/comparisons`. `selectionMode` là discriminator, server chỉ nhận một nhánh; không nhận `result/status/reason/policy` từ client.

| Body field | Type | Required | Nullable | Source | Validation/meaning | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `selectionMode` | enum: PAIR, BASELINE_LATEST | Y | N | Client | Chọn một trong hai cách; sourceKind do server suy ra | CMP-004; AnD code |
| `baselineSnapshotId` | UUID | Y nếu PAIR | N | Client | Snapshot A; giữ đúng chiều kể cả A mới hơn B | CMP-004-05/06 |
| `targetSnapshotId` | UUID | Y nếu PAIR | N | Client | Snapshot B, khác A | CMP-004/005 |
| `apiId` | UUID | Y nếu BASELINE_LATEST | N | Client | Scope latest | CMP-004-02 |
| `environmentId` | UUID | Y nếu BASELINE_LATEST | N | Client | Scope latest theo ID | CMP-004/ENV-004 |
| `authContextRef` | opaque string/UUID | Y nếu BASELINE_LATEST | N | Client selection | Tham chiếu stable historical context được backend resolve, không phải raw token; tên/type thực phụ thuộc AUTH/Snapshot | DESIGN PROPOSAL; DB-VERIFY |

**Processing:** auth → validate union/path → resolve scope (Project/API/Environment/auth context) → PAIR giữ đúng A/B hoặc BASELINE_LATEST tìm latest hoàn tất, chưa invalidated theo `executionCompletedAt DESC, snapshotId DESC`, đọc baseline ID **đã chốt trên Execution nguồn**; không tính lại/đổi baseline. PAIR đòi path `projectId` bằng A.projectId; sau khi có quyền với cả A/B, B khác Project/API/Environment/auth context **không bị gạt bằng HTTP 422** mà vẫn persist Comparison/attempt rồi BLOCKED với reason CMP-005/ENV-004. Nếu không có latest/baseline hoặc baseline đã invalidated, không tạo Comparison. Nếu có A/B, persist Comparison và attempt QUEUED, xử lý CMP-005 → CMP-006 → CMP-007/008/009/010/017/018. Cặp có scope/eligibility không đạt được lưu BLOCKED và reason; không tự chọn cặp khác. `selectionMode` chỉ điều khiển cách lấy cặp, không cho client tự loại trừ input hoặc gửi policy.

**Success:** 201 Created `{comparisonId, baselineSnapshotId, targetSnapshotId, processingStatus:"QUEUED", result:null}` và `Location: /api/v1/comparisons/{comparisonId}`. Khi BASELINE_LATEST không dựng được cặp: 200 OK `{comparisonId:null, availabilityReasonCode:"NO_LATEST_SNAPSHOT"|"NO_BASELINE"|"BASELINE_INVALIDATED", latestSnapshotId:UUID|null}`; không tạo Comparison. Đây là availability của **yêu cầu chọn cặp thủ công**, không viết vào Execution và không đồng nhất `NO_LATEST_SNAPSHOT` với `NO_NEW_SNAPSHOT` của Run. Trạng thái tức thời có thể đã chuyển khi client GET; response create là trạng thái resource tại thời điểm tạo.

**DB/side effect:** read Project access, Snapshots, Execution baseline; write Comparison + attempt; enqueue nội bộ. Transaction chốt lựa chọn latest/A-B và cặp, tránh race; recheck eligibility khi attempt xử lý. Không sửa baseline/Snapshot. **Idempotency:** mỗi yêu cầu thủ công hợp lệ tạo identity riêng; double-click có thể tạo hai request riêng. Optional `Idempotency-Key` nếu contract chung đã có sẽ cần thiết kế riêng trước freeze; không tự gộp vào automatic.

### API-CMP-002 — `createComparisonChain`

**Actor/Auth:** user có quyền compare Project. `POST /api/v1/projects/{projectId}/comparison-chains`.

| Body field | Type | Required | Nullable | Source | Validation/meaning | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `startSnapshotId` | UUID | Y | N | Client | Điểm đầu chuỗi | CMP-004-07 |
| `endSnapshotId` | UUID | Y | N | Client | Điểm cuối khác điểm đầu; cùng Project/API/Environment/auth context | CMP-004-07/10 |

Server kiểm tra quyền cả hai đầu, lấy **toàn bộ** Snapshot hoàn tất trong khoảng bao gồm hai đầu cùng bốn chiều, sắp `executionCompletedAt ASC, snapshotId ASC`, chốt danh sách và từng cặp kề nhau atomically. Snapshot invalidated ở giữa vẫn giữ vị trí; cặp chạm nó BLOCKED, không nối tắt; các cặp khác xử lý độc lập. Không cho client gửi danh sách cặp đã chọn để làm nguồn authoritative. Ít hơn hai Snapshot hoặc hai đầu khác scope: 422 business validation, không tạo chain. **Success:** 201 Created `{comparisonChainId, selectedSnapshotCount, pairCount}`, `Location` tới chain; GET chain trả từng cặp phân trang, không có Result tổng hợp. **DB:** read Snapshots/access; write Chain, N Comparison, N attempt trong transaction; queue sau commit. Không đổi baseline Execution.

### API-CMP-007 — `retryComparison`

**Actor/Auth:** user có quyền compare Project. `POST /api/v1/comparisons/{comparisonId}/attempts`, body rỗng; không nhận A/B, status, Result hay reason. Backend khóa Comparison, xác minh chưa có COMPLETED và attempt cuối terminal với nguyên nhân có thể khắc phục; kiểm tra lại quyền, Snapshot, context, input và payload theo các gate hiện hành, giữ rule manifest riêng của attempt mới. Nếu attempt đang QUEUED/RUNNING hoặc Comparison đã COMPLETED → 409. Nếu nguyên nhân không thể khắc phục trong dữ liệu hiện có → 409 với lỗi an toàn; chính sách reason retryable nằm trong engine/AnD, không để client tự đánh dấu. **Success:** 201 Created `{comparisonId, comparisonAttemptId, attemptNumber, processingStatus:"QUEUED", result:null}`. **DB:** read Comparison/attempt/Snapshot, insert attempt mới; terminal attempt trước immutable; unique attempt number và transaction lock chống retry trùng. Không sửa Result đã hoàn tất.

### API-CMP-009 — `createClassificationEvent`

**Actor/Auth:** user có quyền đánh giá trong Project; Priority Should. `POST /api/v1/comparisons/{comparisonId}/classification-events`.

| Body field | Type | Required | Nullable | Source | Validation/meaning | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `classification` | enum: EXPECTED, UNEXPECTED | Y | N | Client | Chỉ với Comparison COMPLETED/DIFFERENT | CMP-002 |
| `note` | string | N | Y | Client | Omitted hoặc null = không có note cho event mới; max length do API/DB convention sau mapping | CMP-002; limit DESIGN PROPOSAL |
| `expectedRevision` | integer | Y | Y | Client | null khi chưa có event; số revision đang thấy nếu cập nhật; conflict detection | CMP-002-08; AnD |

Backend kiểm tra quyền, lock Comparison, kiểm tra DIFFERENT, so expectedRevision với revision hiện tại rồi insert event append-only với actor từ session. 409 nếu revision lệch hoặc Result/state không cho đánh giá; không ghi đè event. Không có CLEAR; không sửa Snapshot/Result/Detail. **Success:** 201 `{classificationEventId, comparisonId, revision, classification, note, classifiedBy, classifiedAt}`. **DB:** read Comparison/current classification, insert event transactionally. Audit provenance nằm ở event; thêm audit log riêng chỉ nếu policy SEC yêu cầu.

## 4. Read operations và response contract

### API-CMP-003 — `listComparisons`

`GET /api/v1/projects/{projectId}/comparisons`. AuthN Required, AuthZ view Comparison Project. Query allowlist:

| Query | Type | Required | Nullable | Meaning | Status |
| --- | --- | --- | --- | --- | --- |
| `apiId`, `snapshotId`, `executionId` | UUID | N | N | Filter đúng API; Snapshot ở A **hoặc** B; Execution là source tự động **hoặc** Execution nguồn của A/B, tránh mất Comparison thủ công liên quan | CMP-016-14; execution matching là AnD |
| `sourceKind`, `processingStatus`, `result` | fixed code | N | N | Filter status riêng Result; `result` SAME/DIFFERENT không lấy NULL giả | CMP-016/OUT-002 |
| `page`, `pageSize` | integer | N | N | §2.1 | Standard |

200 `{items: ComparisonSummary[], page, pageSize, totalItems, hasMore}`; empty list hợp lệ. Không trả raw input/output hoặc full findings. DB read Comparisons + authoritative attempt/Classification + Snapshot metadata. Sort như §2.1; 400 cho filter syntax sai, 403/404 theo policy Project, 401 session.

### API-CMP-004 — `getComparison`

`GET /api/v1/comparisons/{comparisonId}`. 200 `ComparisonSummary` §2.2 cộng `{appliedRuleSummary, latestAttemptNumber, findingsLink, attemptsLink}`. `appliedRuleSummary` nullable trước khi rule được chốt; sau terminal là version/representation/policy identifiers an toàn của attempt có hiệu lực, không trả secret/exclusion raw. Khi BLOCKED input mismatch, Result NULL và input outcome MISMATCH; `findingsLink` cho phase INPUT, không có output Detail. Khi SAME outputDifferenceCount=0. Khi FAILED/BLOCKED chưa có Result, không trả output findings đã xử lý dở. Read Comparison, attempts, Snapshot metadata, classification; GET không chạy lại engine. 401/403/404.

### API-CMP-005 — `listComparisonFindings`

`GET /api/v1/comparisons/{comparisonId}/findings?phase=OUTPUT&page=1&pageSize=20`. `phase=INPUT|OUTPUT` optional nhưng nên gửi để phân biệt; nếu không gửi, trả cả hai theo sort ổn định. 200 `{comparisonId, phase, result, processingStatus, items: Finding[], page, pageSize, totalItems, hasMore}`. `result` nullable. OUTPUT chỉ công bố khi COMPLETED/DIFFERENT; SAME trả empty OUTPUT; blocked/failed/processing trả empty OUTPUT. INPUT diagnosis chỉ công bố khi gate input đã kết thúc an toàn; không trình bày như output difference.

| Finding field | Type | Nullable | Meaning/source | Status |
| --- | --- | --- | --- | --- |
| `findingId`, `phase`, `component`, `differenceKind`, `findingOrdinal` | UUID/codes/int | N | Vị trí/loại khác biệt theo A→B; INPUT hay OUTPUT riêng | CMP-006/015 |
| `location` | object | Y | JSON path/array index/header name + occurrence, hoặc A/B byte offset/length/part nếu raw/binary; không dựng path giả | CMP-015/017/018 |
| `a`, `b` | `{presenceKind, displayKind, safeText?, hexPreview?, isRedacted, hasMore}` | N | Phân biệt ABSENT/NULL/EMPTY/giá trị; chỉ render safe preview theo quyền | CMP-009/010/015 |
| `ruleCode`, `ruleVersion`, `safeSummary` | string | N/N/Y | Rule đã áp dụng lúc so; summary không lộ secret | CMP-015/016 |

Preview có thể che hoặc rút gọn nhưng `hasMore` của trang và từng preview phải phản ánh phần chưa hiển thị. **Không hứa một endpoint download raw** khi permission/policy chưa chốt; nếu Detail đầy đủ không thể truy cập theo quyền từ Snapshot API hiện hữu, phải bổ sung contract đọc vùng nội dung an toàn trước khi tuyên bố hoàn thành CMP-015-10. 401/403/404; 400 query sai. DB read published findings/immutable Snapshot theo quyền, không recompute Result.

### API-CMP-006 — `listComparisonAttempts`

`GET /api/v1/comparisons/{comparisonId}/attempts?page=1&pageSize=20`. 200 collection `{items:[{comparisonAttemptId,attemptNumber,processingStatus,stoppedAtGate,reasonCode,reasonDetailSafe,inputCheckOutcome,result,startedAt,endedAt}],page,pageSize,totalItems,hasMore}`. Result của terminal failed/blocked NULL; rule manifest chỉ đưa safe identifiers nếu cần giải thích. 401/403/404. Read attempts; no side effect.

### API-CMP-008 — `getComparisonChain`

`GET /api/v1/comparison-chains/{comparisonChainId}?page=1&pageSize=20`. 200 `{comparisonChainId,projectId,apiId,environmentId,requestedAt,selectedSnapshotCount,pairs:[{pairOrdinal,comparison:ComparisonSummary}],page,pageSize,totalItems,hasMore}`; từng cặp có status/Result/classification riêng, không có Result của chain. Mỗi cặp A/B đủ tái dựng dãy đã chốt; không trả toàn bộ `snapshotIds` khi chain dài. 401/403/404. DB read chain, comparisons, attempts; no side effect.

### API-CMP-010 — `listClassificationEvents`

`GET /api/v1/comparisons/{comparisonId}/classification-events?page=1&pageSize=20`. AuthZ view classification/history, có thể hẹp hơn view Comparison theo AUTH. 200 collection `{items:[{classificationEventId,revision,classification,note,classifiedBy,classifiedAt}],page,pageSize,totalItems,hasMore}`. Empty = chưa đánh dấu. Note theo quyền; không trả note ngoài Project. 401/403/404. DB read events; no side effect.

## 5. Error Dictionary và semantic boundary

| HTTP | errorCode | Condition | Client behavior | Source/status |
| --- | --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | JSON/UUID/enum/page sai, thiếu field nhánh, field cấm, cả hai nhánh trộn | Sửa request | Standard; AnD |
| 401 | UNAUTHORIZED | Thiếu/hết hạn/revoked session | Xóa token, login lại | USR core |
| 403 | FORBIDDEN | Không có quyền Project/compare/classify | Không hiển thị nội dung | CMP-002/016; AUTH |
| 404 | NOT_FOUND | Item không tồn tại hoặc policy ẩn existence ngoài quyền | Điều hướng/list lại | Standard/AUTH |
| 409 | CONFLICT | Retry khi đang xử lý/đã completed; expectedRevision cũ; state không thể classify | Refresh item/revision | CMP-002/014/016; AnD |
| 422 | BUSINESS_RULE_VIOLATION | Hai ID trùng, `projectId` path khác A.projectId, chain đầu/cuối khác scope, ít hơn hai Snapshot, request không thể tạo cặp theo mode | Chọn lại | CMP-004/005; code DESIGN PROPOSAL |
| 500 | INTERNAL_ERROR | Lỗi unexpected trước khi tạo operation hoặc đọc tài nguyên | Retry an toàn theo UI | Standard |

Không có quyền thì xử lý 401/403/404 **trước** reason của Comparison. Sau khi cặp được tạo, `CONTEXT_MISMATCH`, `ENVIRONMENT_MISMATCH`, `SNAPSHOT_INVALIDATED`, `INPUT_MISMATCH`, `UNSUPPORTED_FORMAT`, `PAYLOAD_UNAVAILABLE`, `ENGINE_ERROR`... là `reasonCode` ở persisted attempt với `result:null`, không phải HTTP error của GET. Lỗi engine async sau 201 chuyển attempt FAILED. Lỗi khi persist Result/Detail không được công bố COMPLETED; transaction rollback/staging bảo đảm consistency. Log/audit chỉ actor, target, status, timestamp và metadata an toàn; audit policy độc lập phải đối chiếu SEC.

## 6. Luồng nội bộ, DB interaction và consistency

| Flow | Reads | Writes/side effects | Atomicity/failure |
| --- | --- | --- | --- |
| Pre-dispatch từng Execution | Scope, Snapshot hoàn tất/chưa invalidated | Execution.baselineSnapshotId + selectedAt, hoặc NO_BASELINE | Chốt trước target call, không chọn lại; không thêm public endpoint |
| Target Snapshot hoàn tất | Execution + baseline ID + target Snapshot | AUTO Comparison + attempt khi đủ hai ID; nếu thiếu target ghi NO_NEW_SNAPSHOT ở Execution | Idempotent theo Execution+cặp; không một-Snapshot Comparison |
| Manual pair/latest/chain | quyền, Snapshot, Execution baseline | Comparison/chain/attempt | Transaction chốt IDs và queue; chain all-or-nothing identity, per-pair outcomes độc lập |
| Engine attempt | Snapshot raw/headers/auth context/invalidation + versioned rules | Gate/status/reason/input outcome, published findings/Result | Order CMP-005 → CMP-006 → output; completion publish atomic; no partial DIFFERENT |
| Retry | Comparison/last attempt + current Snapshot eligibility | New attempt only | Lock, unique attemptNumber; không ghi đè terminal |
| Classification | Project permission + COMPLETED/DIFFERENT + revision | Event append-only | Lock + revision guard; không sửa Result |

**Timeout/retry:** public create trả 201 với resource QUEUED, UI poll GET theo interval có backoff do client UX chốt; không cho frontend tự kết luận timeout là FAILED. Queue delivery được phép retry theo idempotency key nội bộ; timeout target API thuộc Run contract, không thuộc Comparison. Engine/DB unexpected failure phải persist FAILED nếu có Comparison và có thể ghi an toàn; nếu transaction thất bại hoàn toàn, vận hành/reconciliation xử lý queue task mà không phát hành Result giả. Không đưa SQL/schema vật lý vào response.

**Retryability decision (AnD):** `ENGINE_ERROR`/`PERSISTENCE_ERROR` được phép tạo attempt mới sau khi attempt cũ terminal; `PAYLOAD_UNAVAILABLE`, `UNSUPPORTED_FORMAT` hoặc `UNSUPPORTED_ENCODING` chỉ được retry khi backend hiện có khả năng đọc/so đầy đủ dữ liệu cũ với rule/version mới được ghi ở attempt mới. `INPUT_MISMATCH`, khác context/Environment, Snapshot invalidated hoặc đã COMPLETED không tự trở thành retryable; muốn so lại do lựa chọn cặp/chính sách thay đổi thì gửi request mới, không viết lại Result cũ. Trước retry backend kiểm tra lại điều kiện hiện hành; nếu chưa khắc phục trả 409, không tạo attempt rỗng.

**Operation error mapping:** mọi operation có thể trả 400 (path/query/body sai), 401, 403/404 theo quyền và 500; riêng create pair/chain có 422 khi selection invalid, retry có 409 state conflict, classification có 409 state/revision conflict. GET resource không trả 422 chỉ vì Comparison đang BLOCKED hoặc FAILED; đó là dữ liệu 200 với `result:null`. Các condition và client behavior cụ thể ở §5.

## 7. Traceability Matrix

| Requirement | API/contract rule |
| --- | --- |
| CMP-001 | Summary `result` nullable; input compatible + output đầy đủ mới SAME/DIFFERENT; 001/004/005 |
| CMP-002 | 009/010, classification nullable, actor/time/revision, quyền và history |
| CMP-003 | Internal Execution baseline trước dispatch; 001 BASELINE_LATEST chỉ đọc ID đã chốt |
| CMP-004 | 001 modes; 002 chain freeze A→B; 008 từng cặp |
| CMP-005 | Backend gate mỗi cặp cùng Project/API/Environment/auth context, Snapshot complete/not invalidated |
| CMP-006 | Input outcome/gate; INPUT finding; mismatch Result NULL; no output |
| CMP-007 | Engine strict actual output status/headers/body; 005 Detail; no auto exclusions |
| CMP-008 | Array positional/raw findings giữ index/order |
| CMP-009 | PresenceKind ABSENT/NULL/EMPTY phân biệt; không nhầm missing payload |
| CMP-010 | Raw/type/value, không ép `1`/`1.0`/`"1"` |
| CMP-011 | Snapshot latency A/B/delta ở Summary; không ảnh hưởng Result |
| CMP-012 | API/DB Version A→B, changed flag riêng; không ảnh hưởng Result |
| CMP-013 | Internal auto trigger, idempotent, không public endpoint tạo Result |
| CMP-014 | availability ở Execution, attempt status/reason, retry 007, NULL Result khi chưa kết luận |
| CMP-015 | 005 finding A→B, raw offset/part/path, redaction và phân trang |
| CMP-016 | identity/source/status/attempt/Result/history; 003–008; project scope |
| CMP-017 | Snapshot representation/rule version; unsupported/incomplete reason, no recompute |
| CMP-018 | Full binary/multipart input/output, safe byte location, no metadata-only conclusion |
| ENV-004 | Backend Environment ID gate trước input, reason không lộ cross-project |
| OUT-002 | 003/004/005/008 Summary/Detail và metadata riêng, no false badge |

## 8. Những điểm cần đối chiếu trước contract freeze

| ID | Cần đối chiếu | Ảnh hưởng/cách xử lý |
| --- | --- | --- |
| API-VERIFY-01 | Path và schema Run/Execution/Snapshot API hiện hữu; contract availability/baseline/Comparison link | Extend contract hiện hữu backward-compatible, không tạo endpoint Run trùng; mapping tên/field thực |
| API-VERIFY-02 | AUTH/Snapshot có stable `authContextRef` để client chọn scope baseline-latest và backend resolve không? | Nếu không, thiết kế selection bằng resource/context hiện hữu; **chưa freeze body BASELINE_LATEST** |
| API-VERIFY-03 | Snapshot raw bytes/headers/representation và API đọc safe vùng Detail theo quyền đủ cho CMP-015/017/018? | Nếu thiếu, bổ sung Snapshot storage/read contract trước khi freeze Detail/download |
| API-VERIFY-04 | Permission matrix cụ thể: view, compare, retry, classify, xem raw/note | AUTH/USR; không suy Admin/User được quyền nào từ CMP |
| API-VERIFY-05 | Error code catalog/OpenAPI hiện hữu: `BUSINESS_RULE_VIOLATION`, source/status naming, limit page, x-request-id | Mapping nhất quán toàn dự án; các code mới là Design Proposal |
| API-VERIFY-06 | Rule/policy exclusion/version đã duyệt và nơi lưu manifest | Chỉ áp dụng policy có nguồn/vết, không nhận arbitrary exclusions từ client |

**Handoff:** có thể giao Claude đọc bản này cùng toàn bộ requirement và repo để đối chiếu API-VERIFY-01–06, cập nhật AnD/OpenAPI, test positive/negative, rồi implement. Các body/error code Design Proposal phải review trước freeze; đặc biệt BASELINE_LATEST selection, quyền cụ thể và safe Detail. Không tự đổi behavior đã chốt để phù hợp implementation hiện tại.

## 9. Change log

| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 2026-09-24 | Initial API AnD, trace CMP-001–018/ENV-004/OUT-002, chưa freeze |
| 0.2 | 2026-09-24 | Review chéo DB v0.3: 201 Created, persist ineligible pair, manual no-pair, scope A/B và status/detail |
