REQ-CMP-009  •  BA Approved | Pending Client Confirmation

**Missing Null and Empty Values Requirement**

REQ-CMP-009  Distinct Missing Null and Empty States

QC Tool  |  Group 6 Comparison Engine  |  BA FINAL  |  Priority Must

Tài liệu xác định các trạng thái missing, null và empty phải được phân biệt trong actual input/output của Snapshot. Mười hai clarification đã được Quỳnh duyệt ở cấp BA. Hệ thống không tự điền giá trị mặc định, không gộp các trạng thái thành “empty”, và giữ trình tự input trước output: khác ở input dừng Comparison; khác ở output có thể tạo DIFFERENT sau khi so đầy đủ.
# **1 Requirement Information and Original Statement**
Requirement gốc: “Missing field, null, empty string và empty array phải được xem là các giá trị khác nhau.”

|**Field**|**Value**|
| :- | :- |
|Requirement ID and name|REQ-CMP-009 — Distinct Missing Null and Empty States|
|Type and priority|Functional / Must|
|Primary actor|QC Tool System|
|Related actor|Người dùng có quyền yêu cầu hoặc xem Comparison trong Project|
|Analysis status|Clarification completed — BA Approved (12/12); Detail Requirement BA FINAL; Client Confirmation pending where BA detail extends baseline|
|Dependencies|CMP-001/005/006/007/008/010/014/015/016/017/018; SNP-003/004; AUTH/SEC|

# **2 Business Objective and Requirement Statements**
Sự vắng mặt của field, một giá trị null và các dạng empty là bằng chứng khác nhau của request/response. Hệ thống phải giữ đúng trạng thái actual đã lưu để tránh kết luận SAME sai, đồng thời không gán missing cho dữ liệu Snapshot bị thiếu hoặc không đọc được.

RS-CMP-009-01 — Hệ thống phải phân biệt missing, null và empty đối với field ở mọi cấp trong actual input/output thuộc phạm vi so, kể cả object hoặc array lồng nhau.

RS-CMP-009-02 — Field không tồn tại khác field tồn tại với giá trị null, kể cả khi schema khai báo field optional.

RS-CMP-009-03 — Giá trị null, empty string (""), empty array ([]) và empty object ({}) khác nhau; hệ thống không gộp chúng vào một trạng thái empty.

RS-CMP-009-04 — Ở cấp body, không có body, body 0 byte, JSON null, JSON empty string, JSON empty array và JSON empty object là các trường hợp riêng; không tự chuyển đổi chúng.

RS-CMP-009-05 — Chuỗi chỉ có khoảng trắng, số 0 và boolean false không phải empty string, null hoặc missing; hệ thống không trim hay áp điều kiện truthy/falsy để quyết định bằng nhau.

RS-CMP-009-06 — Empty array khác array có phần tử như [null] hoặc [""]; hệ thống không tạo missing element giả cho vị trí không tồn tại. Độ dài/vị trí array thuộc CMP-008.

RS-CMP-009-07 — Hệ thống không điền default từ schema hoặc cấu hình hiện tại để biến missing thành null/empty hay ngược lại; chỉ actual data đã lưu được đối chiếu.

RS-CMP-009-08 — Nếu trạng thái missing/null/empty khác nhau ở input thuộc phạm vi so, CMP-006 phải kết luận input mismatch, dừng trước output và không tạo SAME/DIFFERENT.

RS-CMP-009-09 — Nếu input compatible và khác biệt trạng thái missing/null/empty ở output thuộc phạm vi được so đầy đủ, CMP-001 phải kết luận DIFFERENT.

RS-CMP-009-10 — Không tự bỏ qua field optional hoặc coi các trạng thái trên tương đương. Loại trừ chỉ theo policy được duyệt, xác định phạm vi và có dấu vết như CMP-006/007.

RS-CMP-009-11 — Difference Detail của output phải thể hiện rõ field không tồn tại hoặc field tồn tại với giá trị cụ thể, theo đường dẫn và chiều A→B; không dùng nhãn “empty” chung cho mọi trường hợp.

RS-CMP-009-12 — Snapshot thiếu, truncate hoặc format không đọc được không được suy là missing/empty; hệ thống dừng với reason theo CMP-014/017/018 và không tạo Result.
# **3 Scope and Boundaries**

|**In scope of CMP-009**|**Owned by related requirement**|
| :- | :- |
|Phân biệt field missing, null, empty string/array/object và các trường hợp body ở cấp gốc.|CMP-007 xác định raw strict; CMP-017/018 xác định body/format, encoding và khả năng đọc dữ liệu.|
|Áp dụng đúng gate input hoặc output, không điền default và không tự loại field optional.|CMP-006 sở hữu input mismatch; CMP-001 sở hữu Result sau output; CMP-016 lưu policy/rule.|
|Thể hiện trạng thái khác biệt và từ chối suy diễn từ dữ liệu thiếu.|CMP-015 sở hữu Difference Detail; CMP-014 sở hữu reason/status; CMP-008/010 sở hữu array order và kiểu dữ liệu.|

# **4 Actor Trigger Preconditions and Postconditions**

|**Field**|**Rule**|
| :- | :- |
|Actor|QC Tool System so dữ liệu; người dùng có quyền Project yêu cầu hoặc xem Comparison.|
|Trigger|Gate input theo CMP-006 hoặc bước output theo CMP-007 gặp trạng thái missing/null/empty trong phạm vi.|
|Preconditions|Cặp đạt CMP-005; Snapshot có dữ liệu actual đầy đủ và định dạng xử lý được. Output chỉ xét sau input compatible.|
|Input mismatch|Khác trạng thái ở input: ghi mismatch, không so output, Result rỗng.|
|Output difference|Khác trạng thái ở output sau input compatible: DIFFERENT khi toàn bộ output so hoàn tất.|
|Unavailable|Không đủ dữ liệu hoặc không đọc được: reason phù hợp, không đồng nhất với missing/empty và không có Result.|

# **5 Business Rules**

|**ID**|**Business rule**|
| :- | :- |
|BR-CMP-009-01|Missing nghĩa là field/path không tồn tại trong actual data hợp lệ; null, "", [], {} đều là giá trị tồn tại với kiểu/biểu diễn riêng.|
|BR-CMP-009-02|Body absent là không có body; body 0 byte là body tồn tại nhưng rỗng. JSON null/""/[]/{} là payload có biểu diễn raw riêng.|
|BR-CMP-009-03|Không gộp missing và null dù field optional; không lấy schema default hoặc cấu hình hiện tại lấp giá trị thiếu.|
|BR-CMP-009-04|Không trim whitespace để biến " " thành ""; không dùng truthy/falsy biến 0 hoặc false thành missing/empty.|
|BR-CMP-009-05|[] khác [null], [""] và array có phần tử khác. Vị trí vượt độ dài array không phải một phần tử missing giả.|
|BR-CMP-009-06|Quy tắc phân biệt áp dụng đệ quy cho field của object và array. Raw strict và kiểu tiếp tục theo CMP-007/010.|
|BR-CMP-009-07|Nếu khác biệt ở input, ghi input mismatch theo CMP-006, không so output, không tạo DIFFERENT và không chọn baseline khác.|
|BR-CMP-009-08|Nếu khác biệt ở output sau input compatible, chỉ tạo DIFFERENT sau khi phép so output thuộc phạm vi hoàn tất.|
|BR-CMP-009-09|Không bỏ qua field optional hoặc gộp các trạng thái theo mặc định; policy loại trừ phải được duyệt, có phạm vi/phiên bản và truy vết.|
|BR-CMP-009-10|Difference Detail phải phân biệt path absent với giá trị null/empty; thể hiện A→B và bảo vệ dữ liệu nhạy cảm theo CMP-015/AUTH.|
|BR-CMP-009-11|Không đọc được một field vì Snapshot thiếu/truncate không chứng minh field đó missing. Không kết luận SAME/DIFFERENT từ dữ liệu không đầy đủ.|
|BR-CMP-009-12|Response 204 với body thực sự absent có thể là dữ liệu hợp lệ; absent không đồng nghĩa Snapshot thiếu dữ liệu theo CMP-014.|

# **6 Main Flow**
1. Hệ thống nhận cặp Snapshot đã đạt CMP-005 và lấy actual input đầy đủ theo CMP-006/007.
1. Hệ thống xác định tại mỗi path liệu field tồn tại, giá trị cụ thể của nó là gì, hoặc body absent/0 byte; kiểm tra dữ liệu có thể đánh giá đầy đủ.
1. Hệ thống so input mà không điền default, trim, ép truthy/falsy hay gộp missing/null/empty. Khác biệt thuộc phạm vi là input mismatch và dừng trước output.
1. Khi input compatible, hệ thống so output đầy đủ theo cùng các trạng thái và các quy tắc raw/array/type liên quan.
1. Sau khi output so hoàn tất, CMP-001 kết luận SAME nếu không có khác biệt, hoặc DIFFERENT nếu có ít nhất một khác biệt thuộc phạm vi; CMP-015 nêu đúng trạng thái A→B.
# **7 Alternative and Exception Flows**

|**ID**|**Situation**|**Expected behavior**|
| :- | :- | :- |
|ALT-01|{} so với {"name":null}|Field missing khác null; input mismatch hoặc output diff theo bước.|
|ALT-02|{"name":""} so với {"name":[]}|Empty string khác empty array.|
|ALT-03|Body absent so với body 0 byte|Không coi bằng nhau; phân biệt cả với JSON null.|
|ALT-04|Field chứa " " so với ""|Khác; không trim whitespace.|
|ALT-05|Field 0 hoặc false so với null/missing|Khác; không dùng truthy/falsy.|
|ALT-06|[] so với [null] hoặc [""]|Khác độ dài/phần tử; không sinh missing element giả.|
|ALT-07|Field optional missing nhưng schema có default|Không điền default; vẫn khác field tồn tại.|
|EXC-01|Snapshot truncate làm không đọc được field|Không suy field missing; reason dữ liệu không đủ.|
|EXC-02|Format không đọc được nên không xác định path|Không suy null/empty; reason theo CMP-014/017/018.|
|EXC-03|Response 204 body absent hợp lệ|Giữ trạng thái absent thực tế, không coi là Snapshot bị thiếu.|

# **8 Acceptance Criteria**

|**ID**|**Given**|**When**|**Then**|
| :- | :- | :- | :- |
|AC-CMP-009-01|Input {} so với {"name":null}|So input|Mismatch; không so output; Result rỗng.|
|AC-CMP-009-02|Input compatible; output {} so với {"name":null}|So output hoàn tất|DIFFERENT; Detail nêu missing→null.|
|AC-CMP-009-03|Output {"name":null} so với {"name":""}|So output hoàn tất|DIFFERENT; null khác empty string.|
|AC-CMP-009-04|Output {"name":""} so với {"name":[]}|So output hoàn tất|DIFFERENT; empty string khác empty array.|
|AC-CMP-009-05|Output {"name":[]} so với {"name":{}}|So output hoàn tất|DIFFERENT; empty array khác empty object.|
|AC-CMP-009-06|Một response body absent, bên kia 0 byte|So output hoàn tất|Không coi bằng nhau; khác với JSON null.|
|AC-CMP-009-07|Một response body 0 byte, bên kia JSON null|So output hoàn tất|DIFFERENT nếu format xử lý được.|
|AC-CMP-009-08|Input field " " so với ""|So input|Mismatch; không tự trim.|
|AC-CMP-009-09|Output field 0 so với null|So output hoàn tất|DIFFERENT; không dùng truthy/falsy.|
|AC-CMP-009-10|Output field false so với missing|So output hoàn tất|DIFFERENT; false là giá trị tồn tại.|
|AC-CMP-009-11|Output [] so với [null]|So output hoàn tất|DIFFERENT; không tạo phần tử missing giả.|
|AC-CMP-009-12|Field optional thiếu, schema có default null|So actual Snapshot|Không tự điền null; missing vẫn khác field null.|
|AC-CMP-009-13|Snapshot bị truncate trước field cần đối chiếu|Bắt đầu Comparison|Không coi field missing; không SAME/DIFFERENT.|
|AC-CMP-009-14|Response 204 có body absent hợp lệ ở cả hai Snapshot|So output đầy đủ|Absence thực tế không bị phân loại là dữ liệu Snapshot thiếu.|
|AC-CMP-009-15|Output missing→empty string theo chiều A→B|Xem Difference Detail|Thể hiện đúng path, trạng thái và chiều; không chỉ ghi “empty”.|
|AC-CMP-009-16|Khác biệt output được phát hiện nhưng engine lỗi trước khi hoàn tất|So output|Không tạo DIFFERENT từ phép so dở theo CMP-014.|

# **9 Clarification and Decision Log**

|**CL-CMP-009**|**Decision approved by BA**|**Status**|
| :- | :- | :- |
|01|Áp dụng mọi cấp field input/output, gồm object và array lồng nhau.|BA Approved|
|02|Missing field khác field tồn tại null dù schema optional.|BA Approved|
|03|Null, empty string, empty array và empty object khác nhau.|BA Approved|
|04|Body absent, 0 byte, JSON null/""/[]/{} là các trạng thái riêng.|BA Approved|
|05|Whitespace string, 0, false không là empty/null/missing; không trim/truthy.|BA Approved|
|06|[] khác [null]/[""]; không tạo missing element giả.|BA Approved|
|07|Không điền schema/config default vào actual data.|BA Approved|
|08|Khác ở input là mismatch, dừng output, không Result.|BA Approved|
|09|Khác ở output sau input compatible là DIFFERENT khi so đầy đủ.|BA Approved|
|10|Không mặc định bỏ field optional hoặc gộp trạng thái; policy phải duyệt.|BA Approved|
|11|Detail phân biệt absent/value, path và chiều A→B.|BA Approved|
|12|Thiếu/truncate/unreadable không suy missing/empty, không Result.|BA Approved|

# **10 Dependencies and Handoff**

|**Reference**|**Ownership and handoff**|
| :- | :- |
|CMP-001/005/006/007|Gate cặp, input trước output, raw strict và SAME/DIFFERENT chỉ sau so đầy đủ.|
|CMP-008/010/017/018|Array order, kiểu, format và phân biệt body absent/0 byte với dữ liệu không đọc được.|
|CMP-014/015/016|Reason/status, Difference Detail theo path A→B và policy/rule version.|
|SNP-003/004; AUTH/SEC|Actual request/response đầy đủ trong Snapshot và bảo vệ nội dung nhạy cảm.|

Handoff gate: biểu diễn trạng thái field phải tách “không tồn tại” khỏi “có giá trị null/empty”; body absent là dữ liệu thực hợp lệ nếu nguồn ghi như vậy. Không dùng default, trim hay truthy/falsy để quyết định bằng nhau. Khác ở input dừng output; dữ liệu Snapshot không đủ phải có reason riêng, không biến thành missing.
QC Tool  |  Group 6 Comparison Engine  |  
