REQ-CMP-007  •  BA Approved | Pending Client Confirmation

**Raw Strict Comparison Requirement**

REQ-CMP-007  Raw Strict Input and Output Comparison

QC Tool  |  Group 6 Comparison Engine  |  BA FINAL  |  Priority Must

Tài liệu xác định cách hiểu dữ liệu raw và quy tắc strict trong Comparison. Mười hai clarification đã được Quỳnh duyệt ở cấp BA. Hệ thống dùng nội dung actual request/response đầy đủ trong Snapshot, kiểm tra input trước output, và chỉ tạo SAME hoặc DIFFERENT khi phép so hoàn tất. Khác biệt biểu diễn trong body vẫn là khác biệt, kể cả JSON có cùng ý nghĩa cấu trúc nhưng khác thứ tự key hoặc khoảng trắng.
# **1 Requirement Information and Original Statement**
Requirement gốc: “Input và output phải được so sánh theo dữ liệu raw với quy tắc strict.”

|**Field**|**Value**|
| :- | :- |
|Requirement ID and name|REQ-CMP-007 — Raw Strict Input and Output Comparison|
|Type and priority|Functional / Must|
|Primary actor|QC Tool System|
|Related actor|Người dùng có quyền yêu cầu hoặc xem Comparison trong Project|
|Analysis status|Clarification completed — BA Approved (12/12); Detail Requirement BA FINAL; Client Confirmation pending where BA detail extends baseline|
|Dependencies|CMP-001/005/006/008/009/010/011/012/014/015/016/017/018; SNP-003/004; AUTH/SEC|

# **2 Business Objective and Requirement Statements**
Mục tiêu là phát hiện thay đổi trong actual input và output đã quan sát, kể cả thay đổi ở cách biểu diễn raw. Quy tắc phải xác định rõ dữ liệu nào được so, ngoại lệ nào được phép và khi nào chưa đủ căn cứ kết luận. “Strict” không đồng nghĩa với tự chuẩn hóa JSON hay bỏ qua trường biến động.

RS-CMP-007-01 — Hệ thống phải lấy actual input và output đầy đủ đã lưu trong hai Snapshot; không thay bằng bản hiển thị bị cắt, cấu hình hiện tại, Run Result truncate hoặc kết quả gọi lại API.

RS-CMP-007-02 — Request/response body phải được so theo biểu diễn raw đã lưu, không tự chuẩn hóa, sắp xếp, làm đẹp hoặc bỏ trường. Khác byte trong phần body thuộc phạm vi so là khác theo quy tắc strict.

RS-CMP-007-03 — Với JSON, đổi thứ tự key, khoảng trắng hoặc cách biểu diễn raw khác nhau phải được xem là khác, dù hai bản có thể tương đương sau khi parse thành cấu trúc.

RS-CMP-007-04 — Hệ thống không tự chuẩn hóa Unicode hoặc coi ký tự và cách viết escape khác nhau là bằng nhau khi raw khác nhau; bước xác định bytes được ghi và giải mã theo CMP-017/018.

RS-CMP-007-05 — Actual URL input được so theo biểu diễn đã gửi; thứ tự query, encoding hoặc cách viết URL khác không tự tương đương, trừ ngoại lệ được cấu hình rõ theo CMP-006.

RS-CMP-007-06 — Tên HTTP header được đối chiếu không phân biệt chữ hoa/thường; giá trị header strict. Thứ tự giữa các tên header khác nhau không tạo khác biệt; thứ tự các giá trị lặp của cùng header được giữ, trừ quy tắc riêng được duyệt.

RS-CMP-007-07 — Phạm vi output gồm HTTP status, response headers thuộc phạm vi và actual response body. Header biến động như Date không tự bị bỏ qua; loại trừ phải có policy rõ.

RS-CMP-007-08 — Hệ thống áp dụng CMP-008/009/010: thứ tự array có ý nghĩa; missing/null/empty khác nhau; kiểu và cách viết giá trị số 1, 1.0, chuỗi "1" không được coi là giống nhau.

RS-CMP-007-09 — Chỉ loại trừ secret hoặc trường/header theo policy được duyệt và áp dụng theo CMP-006/AUTH/SEC; phải truy vết policy và không lộ raw secret trong reason hoặc Difference Detail.

RS-CMP-007-10 — File/binary phải được đối chiếu theo nội dung đầy đủ với phương pháp byte/format của CMP-018; trùng tên file, kích thước hoặc metadata không đủ để kết luận bằng nhau.

RS-CMP-007-11 — Nếu dữ liệu trong phạm vi thiếu, bị cắt, không thể đọc hoặc format chưa hỗ trợ, hệ thống không suy SAME/DIFFERENT từ phần đã so; dừng với lý do theo CMP-014/017/018.

RS-CMP-007-12 — Nếu input mismatch, không so output và không có Result. Nếu input compatible và output được so đầy đủ, không có khác biệt thì SAME, có ít nhất một khác biệt thuộc phạm vi thì DIFFERENT theo CMP-001.
# **3 Scope and Boundaries**

|**In scope of CMP-007**|**Owned by related requirement**|
| :- | :- |
|Định nghĩa raw strict cho body, URL, header và output status; giữ khác biệt cách biểu diễn.|CMP-006 xác định input compatibility và ngoại lệ input; CMP-001 kết luận Result sau khi output so hoàn tất.|
|Áp dụng rõ các ngoại lệ đã duyệt, kiểm tra dữ liệu đầy đủ trước khi kết luận.|CMP-014/016 giữ status, reason, attempt và policy/rule version; AUTH/SEC bảo vệ secret.|
|Nêu hệ quả của JSON raw và ranh giới file/binary.|CMP-008/009/010 sở hữu các quy tắc chuyên biệt; CMP-017/018 sở hữu ghi/đọc bytes, encoding và định dạng; CMP-015 sở hữu Difference Detail.|

# **4 Actor Trigger Preconditions and Postconditions**

|**Field**|**Rule**|
| :- | :- |
|Actor|QC Tool System thực hiện; người dùng có quyền Project yêu cầu hoặc truy xuất Comparison.|
|Trigger|Cặp Snapshot đã được chọn và đủ điều kiện CMP-005 bắt đầu quy trình kiểm tra input rồi output.|
|Preconditions|Hai Snapshot hoàn tất, đủ điều kiện; actual request/response và thành phần trong phạm vi có thể truy xuất đầy đủ theo quyền và format hỗ trợ.|
|Success|Input compatible, output so đầy đủ: SAME nếu không có khác biệt; DIFFERENT nếu có ít nhất một khác biệt.|
|Input mismatch|Dừng trước output, lưu kết luận input theo CMP-006; Result rỗng.|
|Unavailable|Dữ liệu bị thiếu/truncate, không thể đọc hoặc format chưa hỗ trợ: không kết luận Result; reason theo CMP-014/017/018.|

# **5 Business Rules**

|**ID**|**Business rule**|
| :- | :- |
|BR-CMP-007-01|Snapshot đầy đủ là nguồn chứng cứ; giới hạn preview/UI, metadata-only hoặc dữ liệu Run Result bị truncate không thay thế body cần so.|
|BR-CMP-007-02|Body raw strict là đối chiếu biểu diễn bytes thuộc phạm vi đã lưu theo cùng quy tắc capture/format; không parse rồi serialize lại để quyết định bằng nhau.|
|BR-CMP-007-03|JSON đổi key order, whitespace, escape hoặc biểu diễn số là khác nếu raw bytes khác. Không gọi đó là thay đổi nghiệp vụ; Result chỉ nói có thay đổi.|
|BR-CMP-007-04|URL/query actual không tự chuẩn hóa hoặc sắp xếp. Policy ngoại lệ nếu có phải xác định đúng thành phần, phạm vi và phiên bản áp dụng.|
|BR-CMP-007-05|Header name case-insensitive, value strict; thứ tự các tên header khác nhau không ảnh hưởng, thứ tự repeated values cùng tên được giữ.|
|BR-CMP-007-06|Output status, header thuộc phạm vi và body đều phải được đánh giá. Dynamic header chỉ bị loại theo policy được duyệt, không theo phỏng đoán của engine.|
|BR-CMP-007-07|Các quy tắc array order, missing/null/empty và strict type/number theo CMP-008/009/010 là ràng buộc bắt buộc, không bị một phép parse/normalization làm mất.|
|BR-CMP-007-08|Secret được bảo vệ và chỉ phần được loại trừ theo policy mới không tham gia so; không bỏ toàn bộ header/cookie có phần nghiệp vụ cần xét.|
|BR-CMP-007-09|Binary/file không kết luận từ filename, length hoặc hash thiếu nội dung chứng thực; cách đối chiếu nội dung đầy đủ theo CMP-018.|
|BR-CMP-007-10|Không có SAME/DIFFERENT khi CMP-005 không đạt, input mismatch, input/output chưa đủ dữ liệu, format không hỗ trợ hoặc engine dừng giữa chừng.|
|BR-CMP-007-11|Latency, API Version và DB Version không tự tạo DIFFERENT; CMP-011/012 quyết định biểu diễn riêng khi output trong phạm vi giống nhau.|
|BR-CMP-007-12|Difference Detail phải gắn phần khác biệt với đúng cặp và rule/policy áp dụng, không lộ secret; cấu trúc trình bày thuộc CMP-015/016.|

# **6 Main Flow**
1. Hệ thống nhận đúng cặp Snapshot đã qua kiểm tra quyền và CMP-005; lấy actual input/output đầy đủ cùng rule/policy áp dụng.
1. Hệ thống kiểm tra sự đầy đủ và khả năng xử lý của thành phần input; áp dụng ngoại lệ được duyệt, sau đó đối chiếu input theo CMP-006 và strict rules.
1. Nếu input mismatch, hệ thống dừng trước output, ghi kết luận input và reason phù hợp; Result rỗng.
1. Nếu input compatible, hệ thống kiểm tra đầy đủ HTTP status, response headers thuộc phạm vi và actual response body.
1. Hệ thống so output strict theo kiểu thành phần: body raw, header theo quy tắc tên/giá trị, status và các quy tắc CMP-008/009/010/017/018.
1. Khi toàn bộ phần output cần so hoàn tất, CMP-001 tạo SAME nếu không có khác biệt hoặc DIFFERENT nếu có ít nhất một khác biệt; CMP-015 có thể biểu diễn chi tiết an toàn.
# **7 Alternative and Exception Flows**

|**ID**|**Situation**|**Expected behavior**|
| :- | :- | :- |
|ALT-01|Hai JSON output chỉ khác thứ tự key|DIFFERENT sau khi input compatible, vì body raw khác.|
|ALT-02|Hai JSON chỉ khác khoảng trắng hoặc escape|DIFFERENT nếu raw bytes khác; không chuẩn hóa ngầm.|
|ALT-03|Actual URL input chỉ khác thứ tự query|Input mismatch nếu không có policy ngoại lệ; không so output.|
|ALT-04|Header name Content-Type so với content-type, cùng value|Không tạo khác biệt chỉ vì case của tên header.|
|ALT-05|Response Date khác và không có policy loại trừ|Header khác thuộc phạm vi; có thể dẫn tới DIFFERENT sau input compatible.|
|ALT-06|Chỉ latency hoặc API/DB Version đổi|Nếu input compatible và output thuộc phạm vi giống, SAME; metadata xử lý riêng.|
|EXC-01|Output body bị truncate, dù phần nhìn thấy giống|Không SAME; dừng theo CMP-014/017/018.|
|EXC-02|Binary cùng tên và kích thước nhưng bytes khác|Không kết luận từ metadata; CMP-018 đối chiếu nội dung.|
|EXC-03|Một phía có raw secret cần mask|Không lộ secret; policy loại trừ được áp dụng và lưu dấu vết.|
|EXC-04|Engine lỗi sau khi phát hiện một khác biệt|Chưa so đầy đủ nên không kết luận DIFFERENT; reason failed theo CMP-014.|

# **8 Acceptance Criteria**

|**ID**|**Given**|**When**|**Then**|
| :- | :- | :- | :- |
|AC-CMP-007-01|Hai Snapshot input compatible, output status/header/body raw bằng nhau|So output hoàn tất|Result SAME.|
|AC-CMP-007-02|Output JSON {"a":1,"b":2} so với {"b":2,"a":1}|So output sau input compatible|Result DIFFERENT vì thứ tự key làm raw body khác.|
|AC-CMP-007-03|Output JSON {"a":1} so với { "a": 1 }|So output|Result DIFFERENT do khoảng trắng raw khác.|
|AC-CMP-007-04|Output ký tự và escape cho cùng ký tự có raw bytes khác|So output|Không tự chuẩn hóa; DIFFERENT nếu bytes khác theo CMP-017.|
|AC-CMP-007-05|Input URL ?a=1&b=2 so với ?b=2&a=1, không có policy|So input|Mismatch; không so output; Result rỗng.|
|AC-CMP-007-06|Header Content-Type và content-type có cùng value|So header|Tên khác case không tạo khác biệt.|
|AC-CMP-007-07|Hai response header Date khác, chưa có policy loại trừ|So output sau input compatible|Header khác được tính, Result DIFFERENT nếu phép so hoàn tất.|
|AC-CMP-007-08|Hai response status 200 và 201, body giống|So output|Result DIFFERENT vì status thuộc output.|
|AC-CMP-007-09|Hai body array cùng phần tử nhưng đảo thứ tự|So output|DIFFERENT theo CMP-008 và raw strict.|
|AC-CMP-007-10|Một field missing, bên kia null hoặc empty|So phần liên quan|Không coi bằng nhau theo CMP-009.|
|AC-CMP-007-11|Giá trị JSON 1, 1.0 hoặc chuỗi "1"|So phần liên quan|Không coi bằng nhau theo CMP-010 và raw strict.|
|AC-CMP-007-12|Input/output trong phạm vi giống, latency/version khác|So hoàn tất|SAME; latency/version hiển thị riêng theo CMP-011/012.|
|AC-CMP-007-13|Binary cùng filename/length nhưng nội dung khác|So output|Không suy SAME từ metadata; xử lý theo CMP-018.|
|AC-CMP-007-14|Output thiếu hoặc chỉ có preview bị cắt|So output|Không tạo SAME/DIFFERENT từ phần đã thấy.|
|AC-CMP-007-15|Input mismatch dù output raw giống|Bắt đầu Comparison|Không so output; không tạo SAME/DIFFERENT.|
|AC-CMP-007-16|Engine dừng sau khi thấy một diff nhưng chưa hoàn tất|So output|Không tạo DIFFERENT từ phép so dở; reason theo CMP-014.|

# **9 Clarification and Decision Log**

|**CL-CMP-007**|**Decision approved by BA**|**Status**|
| :- | :- | :- |
|01|So actual input/output đầy đủ đã lưu, không dùng preview, cấu hình hiện tại hoặc gọi lại.|BA Approved|
|02|Body raw strict: khác byte thuộc phạm vi là khác; không tự chuẩn hóa.|BA Approved|
|03|JSON đổi thứ tự key hoặc whitespace là khác dù cấu trúc tương đương.|BA Approved|
|04|Không tự chuẩn hóa Unicode/escape; bytes/cách giải mã theo CMP-017/018.|BA Approved|
|05|Actual URL/query theo biểu diễn gửi; ngoại lệ phải cấu hình rõ.|BA Approved|
|06|Header name không phân biệt case; value strict; thứ tự repeated values có nghĩa.|BA Approved|
|07|Output gồm HTTP status, header thuộc phạm vi và body; header động không tự bỏ.|BA Approved|
|08|Áp dụng CMP-008/009/010 cho array, missing/null/empty, kiểu và biểu diễn số.|BA Approved|
|09|Secret/ngoại lệ chỉ loại theo policy duyệt, có truy vết và không lộ raw secret.|BA Approved|
|10|File/binary cần nội dung đầy đủ; filename/size/metadata không đủ.|BA Approved|
|11|Thiếu/truncate/unsupported: không SAME/DIFFERENT từ phép so một phần.|BA Approved|
|12|Input mismatch dừng; input compatible và output so đầy đủ mới SAME/DIFFERENT.|BA Approved|

# **10 Dependencies and Handoff**

|**Reference**|**Ownership and handoff**|
| :- | :- |
|CMP-001/005/006/014/016|Eligibility, input gate, Result chỉ khi hoàn tất, reason/status và lưu rule/policy đã áp dụng.|
|CMP-008/009/010|Thứ tự array, missing/null/empty và kiểu/biểu diễn số; các quyết định này không bị normalization làm mất.|
|CMP-011/012/015|Latency/version ngoài Result; Difference Detail đúng phạm vi và bảo vệ secret.|
|CMP-017/018; SNP-003/004|Định dạng, bytes được capture/giải mã, nội dung body/file/binary đầy đủ của Snapshot.|
|AUTH/SEC|Quyền truy xuất và policy bảo vệ hoặc loại trừ secret.|

Handoff gate: Claude phải bảo toàn biểu diễn raw của payload để phân biệt JSON key order, whitespace và 1/1.0; không parse rồi serialize lại làm nguồn quyết định. So input trước output; chỉ khác biệt output sau khi input compatible và so đầy đủ mới là DIFFERENT. Các ngoại lệ phải được khai báo và truy vết, không suy đoán từ tên trường.
QC Tool  |  Group 6 Comparison Engine  |  
