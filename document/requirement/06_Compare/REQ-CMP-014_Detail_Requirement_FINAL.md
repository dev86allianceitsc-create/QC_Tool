REQ-CMP-014  •  BA Approved | Pending Client Confirmation

**Detail Requirement**

REQ-CMP-014  Unavailable and Ineligible Comparison Handling

QC Tool  |  Group 6 Comparison Engine  |  BA FINAL  |  Priority Must

Tài liệu quy định cách ghi nhận khi QC Tool chưa thể bắt đầu Comparison, cặp Snapshot không đủ điều kiện, hoặc phép so gặp lỗi. Mười một clarification đã được Quỳnh duyệt ở cấp BA. Requirement này tách trạng thái xử lý khỏi Result SAME/DIFFERENT và không biến lỗi Run, input mismatch hay dữ liệu thiếu thành khác biệt output.
# **1 Requirement Information and Proposed Statement**
Requirement bổ sung ở mức BA Proposed: “Hệ thống phải phân biệt trường hợp chưa có cặp Snapshot để so, cặp không đủ điều kiện và lỗi trong quá trình Comparison; ghi nhận lý do phù hợp mà không tạo SAME/DIFFERENT khi phép so hợp lệ chưa hoàn tất.”

|**Field**|**Value**|
| :- | :- |
|Requirement ID and name|REQ-CMP-014 — Unavailable and Ineligible Comparison Handling|
|Type and priority|Functional / Must — new requirement proposed for client confirmation|
|Primary actor|QC Tool System|
|Related actor|Người dùng có quyền Project truy xuất Run/Snapshot/Comparison hoặc yêu cầu Compare|
|Analysis status|Clarification completed — BA Approved (11/11); Detail Requirement BA FINAL; Pending Client Confirmation|
|Dependencies|CMP-001/003/004/005/006/007/009/013/016/017/018; SNP-001 đến SNP-008; RUN-002/003/007/008; AUTH/SEC|

# **2 Business Objective and Requirement Statements**
Người dùng cần hiểu tại sao chưa có SAME/DIFFERENT và hệ thống đã đi đến bước nào. “Chưa so”, “không đủ điều kiện” và “so thất bại” là ba tình huống khác nhau. Tên trạng thái dưới đây mô tả ngữ nghĩa nghiệp vụ; enum API/DB chính thức thuộc AnD sau khi CMP-016 xác định cách lưu.

|**Business meaning**|**Result**|**Handling**|
| :- | :- | :- |
|Chưa có cặp để bắt đầu|Không có|Không tạo Comparison giả; thể hiện availability và lý do trong ngữ cảnh Run/Execution/Snapshot.|
|Đã có cặp nhưng không đủ điều kiện|Rỗng|Dừng ở gate tương ứng, nêu lý do; persistence của attempt theo CMP-016.|
|Phép so đang thực hiện gặp lỗi|Rỗng|Ghi lỗi xử lý; không kết luận từ phần dữ liệu đã so.|
|Phép so hợp lệ hoàn tất|SAME hoặc DIFFERENT|Result theo CMP-001; lưu và truy xuất theo CMP-016.|

RS-CMP-014-01 — Comparison Result chỉ có SAME/DIFFERENT khi phép so hợp lệ hoàn tất. Trạng thái xử lý hoặc khả năng thực hiện phải được thể hiện riêng; Result rỗng trong mọi tình huống chưa thể kết luận.

RS-CMP-014-02 — Run đầu tiên không có baseline phải thể hiện lý do chưa thể Compare trong ngữ cảnh Execution/Snapshot; nếu tạo S1 thành công thì giữ S1, không tạo Comparison chỉ có một Snapshot.

RS-CMP-014-03 — Run lỗi hoặc lưu Snapshot mới thất bại phải thể hiện việc không có bản mới để so; HTTP status, Execution Outcome và lỗi lưu giữ đúng nơi nguồn, không quy thành DIFFERENT hay FAILED của Comparison.

RS-CMP-014-04 — Khi một cặp đã xác định không đạt CMP-005 vì khác ngữ cảnh, invalidated hoặc thiếu điều kiện Snapshot, hệ thống dừng trước input/output và nêu lý do cặp không đủ điều kiện.

RS-CMP-014-05 — Khi cặp đạt CMP-005 nhưng CMP-006 xác định input mismatch, hệ thống ghi kết quả kiểm tra input, dừng trước output và không có SAME/DIFFERENT; không chọn baseline cũ thay.

RS-CMP-014-06 — Format chưa hỗ trợ hoặc dữ liệu cần để so thiếu/hỏng phải được phân biệt với lỗi thuật toán; không dùng Run Result truncate hay cấu hình hiện tại để thay dữ liệu Snapshot.

RS-CMP-014-07 — Lỗi kỹ thuật trong quá trình so phải là Comparison failed, Result rỗng ngay cả khi một phần phạm vi đã phát hiện khác biệt.

RS-CMP-014-08 — Baseline bị invalidated sau khi CMP-003 chốt ID và trước khi Compare phải làm cặp không đủ điều kiện hiện hành; giữ baseline ID đã chốt, không tự chọn bản khác.

RS-CMP-014-09 — Hệ thống có thể thử Comparison lại khi nguyên nhân có thể khắc phục; mỗi lần thử phải kiểm tra điều kiện hiện hành và không ghi đè một Comparison đã hoàn tất. Lịch sử lần thử do CMP-016 quyết định.

RS-CMP-014-10 — Hệ thống phải trả một lý do chính theo bước dừng đầu tiên và chi tiết an toàn nếu cần; không tiết lộ secret, token hoặc payload ngoài quyền.

RS-CMP-014-11 — Body thực sự absent, ví dụ response 204 hợp lệ, không mặc nhiên là dữ liệu thiếu; cách so absent/empty/null thuộc CMP-007/009/017.

RS-CMP-014-12 — Yêu cầu không có quyền Project phải được xử lý bởi lớp AUTH/SEC trước khi lộ thông tin về Snapshot/Comparison; không biến truy cập bị từ chối thành lý do Comparison thông thường.
# **3 Scope and Boundaries**

|**In scope of CMP-014**|**Owned by related requirement**|
| :- | :- |
|Ngữ nghĩa của chưa bắt đầu, không đủ điều kiện, thất bại và hoàn tất; Result rỗng khi không thể kết luận.|CMP-001 định nghĩa SAME/DIFFERENT; CMP-016 quyết định cấu trúc lưu attempt, status, reason và history.|
|Lý do khi không có baseline/bản mới, cặp không tương thích, input mismatch, format/data không đủ và lỗi engine.|CMP-003/005/006/017/018 quyết định điều kiện chi tiết; RUN/SNP giữ outcome và lỗi nguồn.|
|Không kết luận từ phép so dở, nguyên tắc thử lại và thứ tự lý do chính.|CMP-013 tự động kích hoạt; CMP-016 lưu lần thử; AnD API chốt mã enum và response contract.|
|Không tiết lộ dữ liệu qua reason; absent body có thể là dữ liệu hợp lệ.|AUTH/SEC chốt quyền và bảo vệ dữ liệu; CMP-007/009/017 chốt phép so body.|

# **4 Actor Trigger Preconditions and Postconditions**

|**Field**|**Rule**|
| :- | :- |
|Actor|QC Tool System đánh giá và nêu lý do; người dùng có quyền Project truy xuất hoặc yêu cầu Compare.|
|Trigger|Run/Execution kết thúc, Snapshot mới hoàn tất, hoặc người dùng yêu cầu Compare thủ công; chỉ kiểm tra thông tin được phép truy cập.|
|Preconditions|Có ngữ cảnh Run/Execution hoặc cặp Snapshot được chọn; hệ thống kiểm tra quyền trước khi tiết lộ cặp/lý do.|
|Success|Tình huống được phân loại đúng; nếu chưa so hợp lệ hoàn tất thì Result rỗng và lý do chính phản ánh gate đã dừng.|
|Failure|Nếu chính việc ghi nhận xử lý lỗi gặp sự cố, không tạo SAME/DIFFERENT giả; chi tiết khôi phục và monitoring thuộc AnD vận hành.|

# **5 Business Rules**

|**ID**|**Business rule**|
| :- | :- |
|BR-CMP-014-01|Chưa có cặp để bắt đầu không phải Comparison COMPLETED/NOT\_COMPARABLE/FAILED; không tạo bản Comparison chỉ gắn một Snapshot.|
|BR-CMP-014-02|Có cặp nhưng gate Snapshot/context/input/data không đạt thì Result rỗng và lý do thể hiện đúng gate; tên status chính thức thuộc CMP-016/AnD.|
|BR-CMP-014-03|Lỗi engine xảy ra trong khi so khác với cặp không đủ điều kiện; không trả DIFFERENT từ phần output đã xử lý.|
|BR-CMP-014-04|NO\_BASELINE và NO\_NEW\_SNAPSHOT là thông tin availability của Run/Execution, không là kết quả SAME/DIFFERENT hoặc lỗi target giả.|
|BR-CMP-014-05|Context mismatch/invalidated chặn trước so input; input mismatch chặn trước so output; thiếu dữ liệu cần cho bước nào thì dừng an toàn trước hoặc tại bước đó.|
|BR-CMP-014-06|Snapshot gần nhất format chưa hỗ trợ không làm chọn baseline cũ; reason thuộc phạm vi CMP-017/018. Snapshot lưu thiếu/hỏng không được bù bằng Run Result truncate.|
|BR-CMP-014-07|Nếu baseline invalidated sau chọn trước Compare, baseline ID vẫn truy vết được; cặp bị chặn theo CMP-005, không âm thầm thay.|
|BR-CMP-014-08|Thử lại chỉ áp dụng khi nguyên nhân có thể khắc phục; kiểm tra lại quyền, Snapshot, context, input và dữ liệu. Không ghi đè Result của Comparison đã hoàn tất.|
|BR-CMP-014-09|Một lý do chính là gate dừng đầu tiên theo trình tự quyền → khả năng có cặp → eligibility/context → input và dữ liệu cần cho input → output format/data → engine; có thể ghi thêm chi tiết an toàn.|
|BR-CMP-014-10|Authorization failure được trả theo AUTH/SEC, không xác nhận với người không có quyền rằng Snapshot hoặc Comparison tồn tại.|
|BR-CMP-014-11|Body absent đúng nguồn không là payload missing. Trường hợp 204 có Snapshot hợp lệ vẫn được xét theo CMP-007/009/017.|
|BR-CMP-014-12|Lý do không thể so và trạng thái Run/Snapshot/Comparison phải được truy xuất đúng quyền; không sửa nội dung Snapshot bất biến.|

# **6 Main Flow**
1. Hệ thống kiểm tra quyền truy cập Project trước khi trả bất kỳ thông tin Snapshot/Comparison nào.
1. Hệ thống xác định có đủ hai Snapshot cụ thể hay không. Nếu không có baseline hoặc bản mới, ghi availability trong ngữ cảnh Run/Execution, dừng và không tạo Comparison giả.
1. Nếu có cặp, hệ thống kiểm tra eligibility và ngữ cảnh theo CMP-005; nếu không đạt, dừng với lý do chính và Result rỗng.
1. Hệ thống kiểm tra dữ liệu cần cho input và thực hiện CMP-006; input mismatch dừng trước output với Result rỗng.
1. Hệ thống kiểm tra dữ liệu/format output được hỗ trợ theo CMP-017/018, rồi thực hiện so output; lỗi kỹ thuật hoặc dữ liệu không đủ dừng với Result rỗng.
1. Chỉ khi phép so hoàn tất, CMP-001 xác định SAME/DIFFERENT. Hệ thống giữ cặp, trạng thái/lý do và lịch sử theo CMP-016 mà không sửa Snapshot.
# **7 Alternative and Exception Flows**

|**ID**|**Situation**|**Expected behavior**|
| :- | :- | :- |
|ALT-01|Run đầu tiên tạo S1, chưa có baseline|S1 được lưu; availability = no baseline; không tạo Comparison một Snapshot.|
|ALT-02|Run 500/timeout không tạo Snapshot mới|Giữ lỗi/status/outcome ở Run Result; no new Snapshot, không tạo Result Comparison.|
|ALT-03|Hai Snapshot khác Environment/auth context|Dừng ở CMP-005; reason context mismatch; không so input/output.|
|ALT-04|Input mismatch ở cặp cùng context|Dừng sau CMP-006; không so output, không DIFFERENT, không đổi baseline.|
|ALT-05|HTTP 204 có body absent hợp lệ|Không mặc nhiên không thể so; xét theo quy tắc output.|
|EXC-01|Baseline invalidated sau khi đã chốt|Giữ ID đã chốt; dừng ở CMP-005, không chọn bản cũ thay.|
|EXC-02|File/binary chưa được CMP-017 hỗ trợ hoặc payload thiếu|Dừng với reason tương ứng, Result rỗng, không lấy bản đã truncate bù.|
|EXC-03|Engine lỗi sau khi phát hiện một difference|FAILED/Result rỗng; không phát hành DIFFERENT chưa hoàn tất.|
|EXC-04|Người dùng không có quyền Project|Xử lý AUTH/SEC, không tiết lộ cặp, reason hoặc payload.|
|EXC-05|Retry sau sự cố tạm thời|Kiểm tra lại điều kiện; giữ lần thử/các Comparison đã hoàn tất theo CMP-016.|

# **8 Acceptance Criteria**

|**ID**|**Given**|**When**|**Then**|
| :- | :- | :- | :- |
|AC-CMP-014-01|S1 là Snapshot đầu tiên, chưa có baseline|Run tạo S1 thành công|Có thông tin no baseline; không có Comparison giả hoặc SAME.|
|AC-CMP-014-02|S1 có sẵn; T2 trả HTTP 500, không tạo S2|T2 kết thúc|Run giữ HTTP 500/outcome; no new Snapshot; không có Result Comparison.|
|AC-CMP-014-03|S1/S2 khác Environment ID|Yêu cầu Compare|Reason không tương thích theo CMP-005, Result rỗng; không so input/output.|
|AC-CMP-014-04|S1 invalidated trước Compare thủ công với S2|Yêu cầu Compare|Không tạo SAME/DIFFERENT; reason invalidated, giữ S1 để truy vết.|
|AC-CMP-014-05|Cặp đạt CMP-005 nhưng input id=1 và id=2 không tương thích|CMP-006 kiểm tra|Ghi input mismatch; output không so; Result rỗng.|
|AC-CMP-014-06|Baseline S2 đã chốt rồi S2 invalidated trước khi S3 được so|Bắt đầu Comparison|Không chọn S1 thay; reason invalidated; giữ baseline ID S2.|
|AC-CMP-014-07|S2 là baseline gần nhất và format output chưa hỗ trợ|S3 hoàn tất|Không nhảy baseline cũ; Result rỗng và reason unsupported format.|
|AC-CMP-014-08|Snapshot cần so thiếu byte bắt buộc; Run Result có preview|Thử Compare|Không dùng preview bù, không kết luận SAME/DIFFERENT.|
|AC-CMP-014-09|Output có difference ở phần đầu, engine lỗi trước khi so xong|Comparison dừng|Status failed theo ngữ nghĩa; Result rỗng, không DIFFERENT.|
|AC-CMP-014-10|Response 204 có body absent hợp lệ ở cả hai Snapshot|Thực hiện Compare|Không bị gắn thiếu dữ liệu chỉ vì body absent; áp dụng CMP-007/009/017.|
|AC-CMP-014-11|Lần thử C1 thất bại do lỗi tạm thời, nguyên nhân đã khắc phục|Yêu cầu thử lại|Kiểm tra lại điều kiện; không ghi đè C1 hoặc Comparison đã hoàn tất.|
|AC-CMP-014-12|Cặp đồng thời có context mismatch và input khác|Bắt đầu gate|Reason chính ở CMP-005; không thực hiện CMP-006.|
|AC-CMP-014-13|User không có quyền Project đoán Snapshot ID|Yêu cầu Compare|AUTH/SEC từ chối; không lộ sự tồn tại hoặc reason của cặp.|
|AC-CMP-014-14|Cặp hợp lệ, input tương thích, output so đầy đủ|Comparison hoàn tất|Result chỉ SAME hoặc DIFFERENT theo CMP-001.|

# **9 Clarification and Decision Log**

|**CL-CMP-014**|**Decision approved by BA**|**Status**|
| :- | :- | :- |
|01|Tách status/availability khỏi Result; Result chỉ SAME/DIFFERENT khi hoàn tất.|BA Approved|
|02|No baseline: availability trong Run/Execution; không có Comparison một Snapshot.|BA Approved|
|03|No new Snapshot vì Run/lưu thất bại: giữ outcome/lỗi nguồn, không Comparison giả.|BA Approved|
|04|Cặp không đạt context/eligibility/invalidation: reason theo CMP-005, không so input/output.|BA Approved|
|05|Input mismatch: không so output, không Result, không chọn baseline khác.|BA Approved|
|06|Format chưa hỗ trợ/dữ liệu thiếu hỏng là không thể so, không bù bằng Run Result.|BA Approved|
|07|Engine lỗi trong lúc so: failed, Result rỗng kể cả khi đã thấy khác biệt một phần.|BA Approved|
|08|Baseline invalidated sau chọn: giữ ID, chặn Comparison mới, không chuyển cặp.|BA Approved|
|09|Có thể retry khi khắc phục, kiểm tra lại; không ghi đè Comparison hoàn tất.|BA Approved|
|10|Một lý do chính theo gate đầu tiên, chi tiết an toàn; quyền kiểm tra trước.|BA Approved|
|11|Body absent đúng nguồn, như 204, không mặc nhiên là payload thiếu.|BA Approved|

# **10 Dependencies and Handoff**

|**Reference**|**Ownership and handoff**|
| :- | :- |
|CMP-001/003/005/006|Result, baseline đã chốt, eligibility và input compatibility; CMP-014 không thay kết luận các gate.|
|CMP-013/016|Thời điểm so tự động, persistence của attempt/status/reason/retry và truy vết cặp.|
|CMP-007/009/017/018|Output scope, absent/empty/null, format, completeness và security boundary.|
|SNP-001–008; RUN-002/003/007/008|Điều kiện Snapshot hoàn tất, invalidation, dữ liệu lịch sử, HTTP/outcome/lỗi Run; không giả lập Comparison từ lỗi nguồn.|
|AUTH/SEC; AnD API/DB|Quyền trước reason; enum, response contract và schema vật lý được thiết kế sau khi các requirement liên quan chốt.|

QC Tool  |  Group 6 Comparison Engine  |  
