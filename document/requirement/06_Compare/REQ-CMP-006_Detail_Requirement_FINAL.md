REQ-CMP-006  •  BA Approved | Pending Client Confirmation

**Input Compatibility Requirement**

REQ-CMP-006  Input Compatibility Before Output Comparison

QC Tool  |  Group 6 Comparison Engine  |  BA FINAL  |  Priority Must

Tài liệu xác định bước đối chiếu actual request input của hai Snapshot trước khi so output. Mười một clarification đã được Quỳnh duyệt ở cấp BA. Chỉ cặp vượt qua CMP-005 và có input tương thích theo các quy tắc được áp dụng mới đi tiếp đến output; input mismatch hoặc thiếu dữ liệu không tạo SAME/DIFFERENT. Các thuật toán strict và xử lý từng định dạng thuộc các requirement chuyên trách.
# **1 Requirement Information and Original Statement**
Requirement gốc: “Comparison phải so input trước; chỉ khi input tương thích mới tiếp tục so output.”

|**Field**|**Value**|
| :- | :- |
|Requirement ID and name|REQ-CMP-006 — Input Compatibility Before Output Comparison|
|Type and priority|Functional / Must|
|Primary actor|QC Tool System|
|Related actor|Người dùng có quyền yêu cầu hoặc xem Comparison trong Project|
|Analysis status|Clarification completed — BA Approved (11/11); Detail Requirement BA FINAL; Client Confirmation pending where BA detail extends baseline|
|Dependencies|CMP-001/003/004/005/007/008/009/010/014/015/016/017/018; SNP-003/004; RUN Request Assembly; AUTH/SEC|

# **2 Business Objective and Requirement Statements**
Hai output chỉ có ý nghĩa đối chiếu như cùng một trường hợp đầu vào khi actual request input của hai lần thực thi đạt quy tắc tương thích. Hệ thống phải kiểm tra bản ghi lịch sử của request thực gửi, phân biệt mismatch với dữ liệu không thể đánh giá, và giữ riêng kết luận input với Comparison Result của output.

RS-CMP-006-01 — Sau khi cặp Snapshot đạt CMP-005, hệ thống phải đối chiếu input đã được lưu của actual request thực sự gửi trong từng Snapshot; không lấy cấu hình API hoặc giá trị hiện tại thay cho dữ liệu lịch sử.

RS-CMP-006-02 — Phạm vi input gồm HTTP method, actual URL, path/query params, request headers và request body nếu tồn tại; authentication context được kiểm tra ở CMP-005, không kiểm tra lại bằng raw token.

RS-CMP-006-03 — Input chỉ tương thích khi mọi phần thuộc phạm vi so sánh bằng nhau theo quy tắc strict áp dụng; khác một phần được đánh dấu input mismatch. Cùng schema nhưng giá trị khác không tự được coi là tương thích.

RS-CMP-006-04 — URL/path và query phải phản ánh actual request. Cách đánh giá các biểu diễn tương đương, thứ tự query và encoding thuộc quy tắc strict/format; CMP-006 không tự chuẩn hóa ngầm.

RS-CMP-006-05 — Header có ý nghĩa request được so theo quy tắc HTTP đối với tên và strict đối với giá trị. Chỉ loại trừ header kỹ thuật bằng chính sách cấu hình rõ phạm vi và có truy vết; không tự bỏ qua do giá trị biến động.

RS-CMP-006-06 — Raw token/password/secret tạm thời không được so như định danh input; auth context lịch sử thuộc CMP-005. Nếu header/cookie gồm cả secret và dữ liệu nghiệp vụ, chỉ loại phần secret theo quy tắc có thể kiểm tra, không bỏ toàn bộ phần nghiệp vụ.

RS-CMP-006-07 — Actual request body được so đầy đủ theo quy tắc format/strict tương ứng; absent, empty và JSON null khác nhau, không ép kiểu hoặc tự bỏ field động.

RS-CMP-006-08 — Timestamp, nonce, request ID và trường động khác vẫn nằm trong phạm vi nếu có trong input, trừ khi chính sách loại trừ được cấu hình rõ và ghi nhận phiên bản/phạm vi áp dụng; hệ thống không tự suy đoán.

RS-CMP-006-09 — Input thiếu, bị cắt hoặc không thể giải mã/đọc đầy đủ không được kết luận compatible hay mismatch. Hệ thống dừng an toàn với lý do phù hợp theo CMP-014/017/018 và Result rỗng.

RS-CMP-006-10 — Hệ thống ghi nhận kết luận kiểm tra input gắn đúng cặp Snapshot và quy tắc áp dụng. Input mismatch dừng trước output, không tạo SAME/DIFFERENT và không chọn baseline cũ thay.

RS-CMP-006-11 — Trong so chuỗi, bước input được thực hiện riêng cho từng cặp; mismatch hoặc lỗi ở một cặp không dừng việc xét các cặp còn lại theo CMP-004.
# **3 Scope and Boundaries**

|**In scope of CMP-006**|**Owned by related requirement**|
| :- | :- |
|Lấy actual request input lịch sử, xác định thành phần cần đối chiếu và gate compatible/mismatch/không đủ dữ liệu.|SNP-003/004 và RUN Request Assembly lưu chứng cứ request; CMP-005 kiểm tra cặp Snapshot và auth context trước bước này.|
|Áp dụng chính sách loại trừ rõ ràng cho secret và thành phần kỹ thuật/động; giữ dấu vết quy tắc đã dùng.|AUTH/SEC sở hữu phân loại/masking secret; CMP-007 đến CMP-010, CMP-017/018 sở hữu thuật toán, format, thứ tự, missing/null/empty, type.|
|Chặn output khi input mismatch hoặc không đánh giá được, cung cấp kết luận input đúng cặp.|CMP-001 sở hữu SAME/DIFFERENT sau so output; CMP-014/016 sở hữu status, reason, attempt và persistence; CMP-015 sở hữu Difference Detail.|

# **4 Actor Trigger Preconditions and Postconditions**

|**Field**|**Rule**|
| :- | :- |
|Actor|QC Tool System thực hiện đối chiếu; người dùng có quyền Project yêu cầu hoặc xem Comparison.|
|Trigger|Cặp Snapshot từ so tự động, baseline vs latest, chọn thủ công hoặc chuỗi đã vượt qua CMP-005.|
|Preconditions|Hai Snapshot khác ID, hoàn tất, đủ điều kiện, cùng ngữ cảnh theo CMP-005; actual request input lịch sử có thể truy xuất theo quyền.|
|Success|Input compatible được ghi nhận theo đúng cặp và quy tắc; cặp đi tiếp đến so output. CMP-006 tự nó chưa tạo Result SAME/DIFFERENT.|
|Mismatch|Ghi nhận input mismatch và chi tiết an toàn; không so output; Result rỗng và không đổi baseline.|
|Unavailable|Dữ liệu input thiếu/truncate hoặc format không hỗ trợ: không suy ra mismatch/compatible, không so output; lý do theo CMP-014/017/018.|

# **5 Business Rules**

|**ID**|**Business rule**|
| :- | :- |
|BR-CMP-006-01|Trình tự là quyền → cặp Snapshot/CMP-005 → dữ liệu input/CMP-006 → output → Result/CMP-001. Gate trước không đạt thì gate sau không chạy.|
|BR-CMP-006-02|Chỉ actual request đã resolve từ Execution nguồn là chứng cứ; cấu hình mới, bản preview hoặc Run Result bị truncate không được thay Snapshot.|
|BR-CMP-006-03|Method, URL/path/query, headers và body đều thuộc input; chỉ kết luận compatible khi các phần áp dụng đã so đầy đủ theo policy đang dùng.|
|BR-CMP-006-04|Không tự suy ra tương đương từ cùng schema, cùng tên API, cùng Environment hoặc cùng authentication context; các điều kiện này không chứng minh actual input bằng nhau.|
|BR-CMP-006-05|HTTP header name được đánh giá theo ngữ nghĩa tên header, header value theo strict; quy tắc exact cho trùng header, thứ tự, whitespace và encoding thuộc CMP-007/017.|
|BR-CMP-006-06|Secret/token tạm không dùng làm giá trị so; không được hiển thị nguyên văn trong log, reason hoặc Difference Detail. Phần nghiệp vụ trộn trong header/cookie vẫn phải được xét sau khi tách an toàn.|
|BR-CMP-006-07|Loại trừ header kỹ thuật/trường động phải là policy được định nghĩa, có phạm vi và có thể truy vết khi so; thiếu policy thì không tự loại trừ.|
|BR-CMP-006-08|Absent body, empty body và JSON null không mặc nhiên tương đương. Binary/file input cần dữ liệu đầy đủ và phương pháp theo CMP-017/018.|
|BR-CMP-006-09|Khác biệt input hợp lệ là mismatch, không phải DIFFERENT của Comparison; không so output và không tìm baseline khác.|
|BR-CMP-006-10|Thiếu hoặc không đọc được dữ liệu input là trường hợp không thể đánh giá, không được suy diễn thành compatible hay mismatch.|
|BR-CMP-006-11|Kết luận input, cặp Snapshot, chiều cặp và policy/rule đã dùng phải đủ truy vết; mã enum và mô hình lưu chốt ở CMP-016/AnD.|
|BR-CMP-006-12|Các cặp trong chuỗi độc lập; một mismatch không cản cặp tiếp theo. Không có một kết luận input chung cho cả chuỗi.|

# **6 Main Flow**
1. Hệ thống nhận hai Snapshot ID và chiều cặp đã được CMP-003/004 xác định; kiểm tra quyền và CMP-005.
1. Hệ thống lấy actual request input bất biến của hai Snapshot, cùng quy tắc so và policy loại trừ được áp dụng cho cặp.
1. Hệ thống xác định dữ liệu input đầy đủ, định dạng có thể xử lý và các phần secret phải được bảo vệ; nếu không đủ, dừng với reason theo CMP-014/017/018.
1. Hệ thống đối chiếu method, URL/path/query, headers và body theo quy tắc strict/format; chỉ áp dụng ngoại lệ đã được cấu hình rõ.
1. Nếu input mismatch, hệ thống ghi kết luận và chi tiết an toàn, không chạy bước output, Result rỗng.
1. Nếu input compatible, hệ thống ghi kết luận input và chuyển chính cặp đó sang bước đối chiếu output; CMP-001 chỉ kết luận sau khi output so hoàn tất.
# **7 Alternative and Exception Flows**

|**ID**|**Situation**|**Expected behavior**|
| :- | :- | :- |
|ALT-01|S1/S2 cùng context, method/path bằng nhau nhưng query id khác|Input mismatch; không so output; Result rỗng.|
|ALT-02|Chỉ raw token luân chuyển, cùng auth context và phần input khác bằng nhau|Không dùng token tạm để tạo mismatch; tiếp tục theo những phần input còn lại.|
|ALT-03|Header/cookie có secret và business value cùng tồn tại|Tách secret theo policy; business value vẫn được so; không lộ secret.|
|ALT-04|Timestamp hoặc request ID khác, chưa có policy loại trừ|Input mismatch nếu quy tắc strict xác định khác; không tự bỏ qua.|
|ALT-05|Có policy loại trừ field được áp dụng rõ cho cặp|Chỉ loại đúng phần thuộc policy; ghi dấu policy/rule đã áp dụng.|
|ALT-06|Input compatible, output khác|Chuyển so output; CMP-001 có thể tạo DIFFERENT sau khi so hoàn tất.|
|EXC-01|Snapshot thiếu actual body cần so hoặc bị truncate|Không thể đánh giá input; không tạo compatible/mismatch hay Result giả.|
|EXC-02|Format input không hỗ trợ hoặc giải mã thất bại|Dừng an toàn với reason phù hợp; không so output.|
|EXC-03|Cặp không đạt CMP-005|Dừng ở gate CMP-005; không đọc/so input.|
|EXC-04|Chuỗi S1→S2 mismatch nhưng S2→S3 compatible|Cặp đầu dừng; cặp sau tiếp tục so output độc lập.|

# **8 Acceptance Criteria**

|**ID**|**Given**|**When**|**Then**|
| :- | :- | :- | :- |
|AC-CMP-006-01|Cặp đạt CMP-005; actual input đầy đủ và bằng nhau theo rule|Bắt đầu Comparison|Ghi input compatible và chuyển sang so output; chưa có Result tại gate input.|
|AC-CMP-006-02|Actual request id=1001 so với id=1002|Kiểm tra input|Ghi mismatch, không so output, Result rỗng; không chọn baseline khác.|
|AC-CMP-006-03|Cấu hình API hiện tại khác cấu hình ở S1/S2|Kiểm tra input|Chỉ dùng actual request lưu trong S1/S2, không dùng cấu hình hiện tại.|
|AC-CMP-006-04|S1/S2 cùng API/Environment/auth context nhưng body khác|CMP-005 đã đạt|CMP-006 vẫn ghi mismatch; cùng context không đủ chứng minh input compatible.|
|AC-CMP-006-05|S1/S2 khác raw bearer token do rotation, cùng auth context và input khác bằng|Kiểm tra input|Token tạm không tự tạo mismatch; không lộ raw token.|
|AC-CMP-006-06|Cookie có secret và business field id khác|Kiểm tra input|Không lộ secret; business field vẫn được xét và có thể mismatch.|
|AC-CMP-006-07|Header kỹ thuật khác, chưa có policy loại trừ|Kiểm tra input|Không tự bỏ qua header; kết luận theo rule/header policy áp dụng.|
|AC-CMP-006-08|Timestamp khác, có policy loại trừ được áp dụng rõ|Kiểm tra input|Chỉ field thuộc policy được loại; kết luận và dấu vết policy được ghi.|
|AC-CMP-006-09|Một request body absent, bên kia empty|Kiểm tra input|Không mặc nhiên coi bằng nhau; áp dụng CMP-009/017.|
|AC-CMP-006-10|Một request body JSON null, bên kia string "null"|Kiểm tra input|Không ép kiểu; áp dụng CMP-007/009/010.|
|AC-CMP-006-11|Input Snapshot bị truncate hoặc thiếu phần bắt buộc|Kiểm tra input|Không kết luận mismatch hay compatible; không so output, Result rỗng.|
|AC-CMP-006-12|Cặp khác Environment ID, input lại giống|Yêu cầu Compare|CMP-005 chặn trước; CMP-006 không chạy.|
|AC-CMP-006-13|S1→S2 mismatch; S2→S3 compatible|Xử lý so chuỗi|S1→S2 không Result; S2→S3 vẫn tiếp tục so output.|
|AC-CMP-006-14|Input compatible, output giống nhau đầy đủ|Comparison hoàn tất|CMP-001 kết luận SAME sau bước output, không kết luận chỉ từ input.|
|AC-CMP-006-15|Input compatible nhưng engine lỗi khi so output|Comparison dừng|Không có SAME/DIFFERENT theo CMP-001/014.|

# **9 Clarification and Decision Log**

|**CL-CMP-006**|**Decision approved by BA**|**Status**|
| :- | :- | :- |
|01|Dùng actual request đã thực gửi và lưu trong Snapshot, không dùng cấu hình hiện tại.|BA Approved|
|02|Phạm vi gồm method, URL/path/query, headers, body; auth context thuộc CMP-005.|BA Approved|
|03|Mặc định strict theo rule liên quan; cùng schema không đủ; khác một phần là mismatch.|BA Approved|
|04|URL/query theo actual request; không tự chuẩn hóa, chi tiết ở strict/format.|BA Approved|
|05|Header name theo HTTP, value strict; loại header kỹ thuật phải có policy rõ.|BA Approved|
|06|Không so raw token/secret tạm; tách phần nghiệp vụ trong header/cookie và bảo vệ secret.|BA Approved|
|07|So actual body; absent, empty, JSON null khác; không ép kiểu/bỏ field động.|BA Approved|
|08|Trường động vẫn xét trừ policy loại trừ rõ phạm vi và có truy vết.|BA Approved|
|09|Thiếu/truncate/không đọc được input: không kết luận compatible hay mismatch.|BA Approved|
|10|Ghi kết luận input đúng cặp và rule; mismatch dừng output, không Result/baseline thay.|BA Approved|
|11|So chuỗi xét input từng cặp độc lập; một mismatch không chặn cặp khác.|BA Approved|

# **10 Dependencies and Handoff**

|**Reference**|**Ownership and handoff**|
| :- | :- |
|CMP-005/001/014/016|Gate cặp trước input, Result sau output, trạng thái/lý do và lưu attempt/quy tắc áp dụng.|
|CMP-007/008/009/010|Thuật toán strict, thứ tự array, missing/null/empty và không ép kiểu; không tái định nghĩa ở CMP-006.|
|CMP-017/018; SNP-003/004|Xử lý JSON/text/binary/file và dữ liệu Snapshot đầy đủ, actual request lịch sử.|
|AUTH/SEC; CMP-015|Phân loại/masking secret và thể hiện chi tiết khác biệt an toàn.|
|CMP-003/004; RUN Request Assembly|Baseline/cặp đã chọn, chuỗi cặp và request thực gửi sau resolve.|

Handoff gate: triển khai phải bảo toàn thứ tự CMP-005 → CMP-006 → output → CMP-001, lưu được rule/policy dùng để giải thích kết luận input, và không suy ra SAME/DIFFERENT khi input mismatch hoặc không đủ dữ liệu. Cấu hình loại trừ phải có owner, phạm vi và phiên bản ở AnD; không tự tạo danh sách mặc định ngoài quyết định đã duyệt.
QC Tool  |  Group 6 Comparison Engine  |  
