REQ-CMP-010  •  BA Approved | Pending Client Confirmation

**Strict Data Type Comparison Requirement**

REQ-CMP-010  Strict Types and Numeric Representations

QC Tool  |  Group 6 Comparison Engine  |  BA FINAL  |  Priority Must

Tài liệu xác định quy tắc so sánh strict đối với kiểu dữ liệu và biểu diễn raw của giá trị trong Snapshot. Mười ba clarification đã được Quỳnh duyệt ở cấp BA. Hệ thống không ép kiểu hoặc làm tròn để tạo sự bằng nhau; đặc biệt số 1, số 1.0 và chuỗi "1" khác nhau. Khác biệt ở input dừng trước output, còn khác biệt ở output chỉ tạo DIFFERENT sau khi input tương thích và phép so hoàn tất.
# **1 Requirement Information and Original Statement**
Requirement gốc: “Kiểu dữ liệu phải được so sánh strict; số 1, số 1.0 và chuỗi "1" không được xem là giống nhau.”

|**Field**|**Value**|
| :- | :- |
|Requirement ID and name|REQ-CMP-010 — Strict Types and Numeric Representations|
|Type and priority|Functional / Must|
|Primary actor|QC Tool System|
|Related actor|Người dùng có quyền yêu cầu hoặc xem Comparison trong Project|
|Analysis status|Clarification completed — BA Approved (13/13); Detail Requirement BA FINAL; Client Confirmation pending where BA detail extends baseline|
|Dependencies|CMP-001/005/006/007/008/009/014/015/016/017/018; SNP-003/004; AUTH/SEC|

# **2 Business Objective and Requirement Statements**
Hai giá trị có thể bằng nhau sau ép kiểu hoặc tính toán số học nhưng khác trong actual request/response đã quan sát. Hệ thống phải giữ loại giá trị và biểu diễn raw, tránh làm mất khác biệt khi parse, lưu trữ hoặc hiển thị. Quy tắc này bổ sung cho raw strict của CMP-007 và các trạng thái missing/null/empty của CMP-009.

RS-CMP-010-01 — Hệ thống phải áp dụng so sánh strict cho mọi giá trị thuộc actual input/output trong phạm vi so, kể cả field và phần tử array lồng nhau.

RS-CMP-010-02 — String, number, boolean, null, object và array là các loại khác nhau; không tự chuyển đổi để so. Missing là trạng thái field không tồn tại theo CMP-009, không phải một kiểu giá trị.

RS-CMP-010-03 — Số 1, số 1.0 và chuỗi "1" là ba biểu diễn khác nhau; Snapshot phải giữ đủ thông tin raw để phân biệt 1 với 1.0, không chỉ lưu giá trị số đã parse.

RS-CMP-010-04 — Theo CMP-007, các biểu diễn số raw 1, 1.00, 1e0, 1E+0 và 0/-0 khác nhau nếu bytes khác, dù giá trị số học có thể bằng nhau.

RS-CMP-010-05 — Hệ thống không được chuyển qua kiểu số gây làm tròn hoặc mất chữ số rồi dùng giá trị đã biến đổi để quyết định SAME/DIFFERENT; phải bảo toàn biểu diễn raw của số.

RS-CMP-010-06 — Boolean true khác số 1 và chuỗi "true"; null khác chuỗi "null" và missing. Không áp dụng ép kiểu hoặc truthy/falsy.

RS-CMP-010-07 — String được so theo actual value và biểu diễn raw của CMP-007; không tự trim, đổi chữ hoa/thường hoặc parse chuỗi số thành number.

RS-CMP-010-08 — Object và array không được tự chuyển thành chuỗi hoặc cấu trúc khác; {} khác []. Array order theo CMP-008 và missing/null/empty theo CMP-009.

RS-CMP-010-09 — Hệ thống phải so actual value đã ghi trong Snapshot; schema hoặc cấu hình API hiện tại không được dùng để ép kiểu cho hai phía bằng nhau.

RS-CMP-010-10 — Nếu khác kiểu hoặc biểu diễn raw ở input thuộc phạm vi, CMP-006 phải ghi input mismatch, dừng trước output và không tạo SAME/DIFFERENT.

RS-CMP-010-11 — Nếu input compatible và khác kiểu hoặc biểu diễn raw ở output thuộc phạm vi, CMP-001 phải kết luận DIFFERENT sau khi output được so đầy đủ.

RS-CMP-010-12 — Số hoặc payload không được lưu đầy đủ, format không hỗ trợ hoặc không đọc được không được ép thành giá trị gần đúng; dừng với reason theo CMP-014/017/018 và không có Result.

RS-CMP-010-13 — Difference Detail cần thể hiện path, kiểu và biểu diễn A→B an toàn, ví dụ number 1 → string "1"; định dạng chi tiết thuộc CMP-015.
# **3 Scope and Boundaries**

|**In scope of CMP-010**|**Owned by related requirement**|
| :- | :- |
|Phân biệt loại giá trị, không ép kiểu và bảo toàn biểu diễn số raw, kể cả số lớn/độ chính xác.|CMP-007 chốt raw strict; SNP-003/004 và CMP-017/018 chốt cách ghi, giải mã và khôi phục payload đầy đủ.|
|Áp dụng theo gate input/output, không dùng schema hiện tại để lấp dữ liệu và dừng khi dữ liệu không đủ.|CMP-006 sở hữu input compatibility; CMP-001 sở hữu Result; CMP-009 sở hữu missing/null/empty; CMP-014/015/016 sở hữu reason, Detail và dấu vết rule.|

# **4 Actor Trigger Preconditions and Postconditions**

|**Field**|**Rule**|
| :- | :- |
|Actor|QC Tool System thực hiện; người dùng có quyền Project yêu cầu hoặc xem Comparison.|
|Trigger|Bước input theo CMP-006 hoặc output theo CMP-007 đối chiếu giá trị có kiểu/biểu diễn raw thuộc phạm vi.|
|Preconditions|Cặp đạt CMP-005; actual data lưu đầy đủ và format đọc được; output chỉ xét khi input compatible.|
|Input mismatch|Khác kiểu hoặc raw ở input: ghi mismatch, không so output, Result rỗng.|
|Output difference|Khác kiểu hoặc raw ở output: DIFFERENT khi input compatible và output so hoàn tất.|
|Unavailable|Dữ liệu thiếu/truncate/không đọc được: không ép gần đúng, không Result; reason theo CMP-014/017/018.|

# **5 Business Rules**

|**ID**|**Business rule**|
| :- | :- |
|BR-CMP-010-01|Giữ riêng loại JSON string, number, boolean, null, object và array; missing được biểu diễn là trạng thái không có path theo CMP-009.|
|BR-CMP-010-02|Không coercion: number 1 khác string "1"; boolean true khác number 1/string "true"; null khác string "null".|
|BR-CMP-010-03|Cùng loại number vẫn có thể khác vì raw lexeme: 1 khác 1.0, 1.00 hoặc 1e0; 0 khác -0 nếu raw bytes khác.|
|BR-CMP-010-04|Không parse/serialize lại hoặc dùng floating point đã làm tròn làm nguồn quyết định; Snapshot/engine phải giữ raw để phân biệt giá trị lớn và cách viết.|
|BR-CMP-010-05|String giữ nguyên chữ hoa/thường, whitespace và biểu diễn raw theo CMP-007; không trim hoặc parse số từ chuỗi.|
|BR-CMP-010-06|{} khác []; không chuyển object/array sang chuỗi. Giá trị trong cấu trúc lồng nhau tiếp tục theo cùng rule.|
|BR-CMP-010-07|Schema type/default hoặc cấu hình hiện tại không thay actual value; giá trị không phù hợp schema vẫn là dữ liệu quan sát được nếu format hỗ trợ.|
|BR-CMP-010-08|Khác kiểu/raw ở input là input mismatch; không so output, không DIFFERENT và không chọn baseline khác.|
|BR-CMP-010-09|Khác kiểu/raw ở output sau input compatible là output diff; chỉ kết luận DIFFERENT khi mọi thành phần thuộc phạm vi so hoàn tất.|
|BR-CMP-010-10|Không đủ dữ liệu hoặc format không hỗ trợ không được diễn giải thành một kiểu/value gần đúng hoặc thành mismatch; reason theo CMP-014/017/018.|
|BR-CMP-010-11|Difference Detail nêu đúng kiểu và biểu diễn A→B theo quyền; không lộ raw secret.|
|BR-CMP-010-12|Các cặp trong chuỗi độc lập theo CMP-004; type mismatch ở một cặp không dừng cặp khác.|

# **6 Main Flow**
1. Hệ thống nhận cặp Snapshot đã qua CMP-005 và lấy actual input đầy đủ cùng biểu diễn raw đã lưu.
1. Hệ thống kiểm tra dữ liệu có thể đánh giá, xác định trạng thái tồn tại/path và kiểu/biểu diễn raw của các giá trị thuộc phạm vi.
1. Hệ thống so input mà không ép kiểu, làm tròn, trim hoặc điền schema default; nếu khác, ghi input mismatch và dừng trước output.
1. Nếu input compatible, hệ thống so output đầy đủ theo CMP-007/008/009 và quy tắc kiểu/biểu diễn raw của CMP-010.
1. Sau khi output so hoàn tất, CMP-001 tạo SAME nếu không có khác biệt thuộc phạm vi hoặc DIFFERENT nếu có; CMP-015 thể hiện type/raw A→B an toàn.
# **7 Alternative and Exception Flows**

|**ID**|**Situation**|**Expected behavior**|
| :- | :- | :- |
|ALT-01|Number 1 so với number 1.0|Khác raw dù cùng loại number; gate input/output tương ứng.|
|ALT-02|Number 1 so với string "1"|Khác kiểu và biểu diễn; không ép string thành number.|
|ALT-03|Number 1e0 so với number 1E+0|Khác raw theo CMP-007 dù cùng giá trị toán học.|
|ALT-04|Number 0 so với -0|Khác khi biểu diễn raw khác.|
|ALT-05|Boolean true so với number 1 hoặc string "true"|Khác kiểu; không dùng truthy/falsy.|
|ALT-06|Object {} so với array []|Khác cấu trúc/kiểu; empty không làm hai phía bằng nhau.|
|ALT-07|String " 1 " so với "1"|Khác; không trim hoặc parse thành số.|
|EXC-01|Giá trị số lớn bị mất chữ số khi parse|Không dùng kết quả parse đã mất mát; so từ raw đầy đủ hoặc dừng với reason.|
|EXC-02|Snapshot thiếu raw nhưng chỉ còn số đã làm tròn|Không kết luận SAME/DIFFERENT từ giá trị gần đúng.|
|EXC-03|Schema hiện tại khai báo string nhưng Snapshot có number|So actual number; không ép theo schema hiện tại.|

# **8 Acceptance Criteria**

|**ID**|**Given**|**When**|**Then**|
| :- | :- | :- | :- |
|AC-CMP-010-01|Input number 1 so với number 1.0|So input|Mismatch; không so output, Result rỗng.|
|AC-CMP-010-02|Input compatible; output number 1 so với number 1.0|So output hoàn tất|DIFFERENT theo raw strict.|
|AC-CMP-010-03|Output number 1 so với string "1"|So output hoàn tất|DIFFERENT; không ép kiểu.|
|AC-CMP-010-04|Output number 1.00 so với 1e0|So output hoàn tất|DIFFERENT dù cùng giá trị số học.|
|AC-CMP-010-05|Output number 1e0 so với 1E+0|So output hoàn tất|DIFFERENT do raw lexeme khác.|
|AC-CMP-010-06|Output number 0 so với -0|So output hoàn tất|DIFFERENT nếu raw bytes khác.|
|AC-CMP-010-07|Input boolean true so với number 1|So input|Mismatch; không dùng truthy/falsy.|
|AC-CMP-010-08|Output boolean true so với string "true"|So output hoàn tất|DIFFERENT; khác kiểu.|
|AC-CMP-010-09|Output null so với string "null"|So output hoàn tất|DIFFERENT; null khác string.|
|AC-CMP-010-10|Output {} so với []|So output hoàn tất|DIFFERENT; object khác array.|
|AC-CMP-010-11|Input string " 1 " so với "1"|So input|Mismatch; không trim hoặc parse string thành number.|
|AC-CMP-010-12|Giá trị số lớn có raw đầy đủ nhưng parse float làm tròn|So input/output|Quyết định dựa raw, không dùng giá trị đã làm tròn.|
|AC-CMP-010-13|Snapshot chỉ còn giá trị số đã mất chữ số, thiếu raw cần so|Bắt đầu Comparison|Không SAME/DIFFERENT; reason dữ liệu không đủ.|
|AC-CMP-010-14|Schema hiện tại khai báo string, Snapshot ghi number|So actual Snapshot|Không ép number thành string.|
|AC-CMP-010-15|Output number 1→string "1" theo A→B|Xem Difference Detail|Hiển thị path, type và biểu diễn theo chiều A→B an toàn.|
|AC-CMP-010-16|Output khác kiểu nhưng engine dừng trước khi so xong|So output|Không tạo DIFFERENT từ phép so dở theo CMP-014.|

# **9 Clarification and Decision Log**

|**CL-CMP-010**|**Decision approved by BA**|**Status**|
| :- | :- | :- |
|01|Áp dụng mọi giá trị input/output trong phạm vi, kể cả lồng nhau.|BA Approved|
|02|String/number/boolean/null/object/array khác; missing thuộc CMP-009.|BA Approved|
|03|Number 1, number 1.0 và string "1" khác; phải giữ raw.|BA Approved|
|04|1/1.00/1e0/1E+0 và 0/-0 khác khi raw khác.|BA Approved|
|05|Không làm tròn/mất chữ số rồi dùng để quyết định Result.|BA Approved|
|06|True khác 1/"true"; null khác "null"/missing; không coercion.|BA Approved|
|07|String so raw, không trim/case fold/parse số.|BA Approved|
|08|{} khác []; array order CMP-008, missing/null/empty CMP-009.|BA Approved|
|09|So actual Snapshot, không ép kiểu theo schema/config hiện tại.|BA Approved|
|10|Khác ở input là mismatch, dừng output, không Result.|BA Approved|
|11|Khác ở output sau input compatible là DIFFERENT khi so đầy đủ.|BA Approved|
|12|Thiếu/truncate/unsupported không ép gần đúng, không Result.|BA Approved|
|13|Detail thể hiện path, type và raw A→B an toàn.|BA Approved|

# **10 Dependencies and Handoff**

|**Reference**|**Ownership and handoff**|
| :- | :- |
|CMP-001/005/006/007|Gate cặp, input trước output, raw strict và Result sau so đầy đủ.|
|CMP-008/009/017/018|Array order, missing/null/empty, encoding/format và raw payload đầy đủ.|
|CMP-014/015/016|Reason/status, Difference Detail A→B và dấu vết rule/policy.|
|SNP-003/004; AUTH/SEC|Lưu actual data không mất biểu diễn số và bảo vệ nội dung nhạy cảm.|

QC Tool  |  Group 6 Comparison Engine  |  
