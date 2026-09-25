REQ-CMP-008  •  BA Approved | Pending Client Confirmation

**Array Order Comparison Requirement**

REQ-CMP-008  Array Element Order Is Significant

QC Tool  |  Group 6 Comparison Engine  |  BA FINAL  |  Priority Must

Tài liệu xác định cách đối chiếu thứ tự phần tử array trong actual input và output của Snapshot. Mười một clarification đã được Quỳnh duyệt ở cấp BA. Array được xét theo vị trí, kể cả khi lồng nhau hoặc chứa object có ID; đổi thứ tự ở input dừng trước output, còn đổi thứ tự ở output có thể tạo DIFFERENT sau khi input tương thích và phép so hoàn tất.
# **1 Requirement Information and Original Statement**
Requirement gốc: “Thứ tự phần tử trong array phải có ý nghĩa; thay đổi thứ tự được xem là khác.”

|**Field**|**Value**|
| :- | :- |
|Requirement ID and name|REQ-CMP-008 — Array Element Order Is Significant|
|Type and priority|Functional / Must|
|Primary actor|QC Tool System|
|Related actor|Người dùng có quyền yêu cầu hoặc xem Comparison trong Project|
|Analysis status|Clarification completed — BA Approved (11/11); Detail Requirement BA FINAL; Client Confirmation pending where BA detail extends baseline|
|Dependencies|CMP-001/004/005/006/007/009/010/014/015/016/017/018; SNP-003/004; AUTH/SEC|

# **2 Business Objective and Requirement Statements**
Thứ tự các phần tử có thể là một phần của actual request hoặc response quan sát được. Hệ thống phải giữ nguyên thứ tự lịch sử và chỉ kết luận sau khi đối chiếu đúng vị trí; không suy đoán khóa nghiệp vụ để ghép lại các phần tử. Quy tắc này bổ sung cho raw strict của CMP-007 và áp dụng ở hai bước khác nhau trong trình tự Comparison.

RS-CMP-008-01 — Hệ thống phải áp dụng quy tắc thứ tự cho mọi array thuộc phạm vi input hoặc output được so, kể cả array lồng trong object hoặc trong array khác.

RS-CMP-008-02 — Hệ thống phải đối chiếu các phần tử theo vị trí trong array; không tự sắp xếp hoặc ghép phần tử theo id, tên, khóa hay thuộc tính nghiệp vụ.

RS-CMP-008-03 — Nếu hai array input chứa các phần tử khác nhau tại vị trí tương ứng do đổi thứ tự, CMP-006 phải kết luận input mismatch; hệ thống dừng trước output và không có SAME/DIFFERENT.

RS-CMP-008-04 — Nếu input đã tương thích và array output đổi thứ tự làm khác phần tử ở vị trí tương ứng, phép so output hoàn tất phải tạo DIFFERENT theo CMP-001.

RS-CMP-008-05 — Hệ thống chỉ kết luận từ biểu diễn thực quan sát được; đổi chỗ các phần tử có cùng biểu diễn raw không tạo khác biệt nếu dãy cuối cùng vẫn giống hệt.

RS-CMP-008-06 — Array lồng nhau được đối chiếu theo vị trí ở từng cấp; đổi thứ tự trong array con làm phần input/output chứa nó khác theo quy tắc tương ứng.

RS-CMP-008-07 — Thêm, bớt hoặc sửa giá trị phần tử được đánh giá theo CMP-007/009/010; empty array, missing field và null không tự tương đương theo CMP-009.

RS-CMP-008-08 — Với array chứa object, hệ thống không dùng cùng id hoặc thuộc tính để ghép lại object sau khi đổi vị trí; raw representation của mỗi phần tử theo CMP-007.

RS-CMP-008-09 — MVP không có mặc định “array không cần thứ tự”. Nếu có ngoại lệ được khách hàng phê duyệt trong tương lai, policy phải xác định đường dẫn trường, phạm vi và phiên bản áp dụng, có truy vết; không âm thầm áp dụng cho mọi array.

RS-CMP-008-10 — Difference Detail của cặp đủ điều kiện cần định vị đường dẫn và chỉ số phần tử bị ảnh hưởng theo chiều Snapshot A→B; cấu trúc chi tiết do CMP-015 quyết định và không gán nguyên nhân nghiệp vụ.

RS-CMP-008-11 — Array thiếu, bị cắt hoặc không đọc được đầy đủ không được dùng để kết luận SAME/DIFFERENT; dừng với lý do theo CMP-014/017/018.
# **3 Scope and Boundaries**

|**In scope of CMP-008**|**Owned by related requirement**|
| :- | :- |
|Quy tắc vị trí/thứ tự cho array input và output, gồm array lồng và array chứa object.|CMP-006 quyết định input compatibility; CMP-001 tạo Result khi output so hoàn tất; CMP-007 giữ biểu diễn raw strict.|
|Không sắp xếp hoặc ghép theo ID; diễn giải phần tử trùng nhau và ngoại lệ đã được duyệt.|CMP-009/010 sở hữu missing/null/empty và kiểu; CMP-016 lưu rule/policy version.|
|Vị trí khác biệt và ranh giới dữ liệu không đầy đủ.|CMP-015 sở hữu Difference Detail; CMP-014/017/018 sở hữu reason, định dạng và nội dung đầy đủ.|

# **4 Actor Trigger Preconditions and Postconditions**

|**Field**|**Rule**|
| :- | :- |
|Actor|QC Tool System đối chiếu array; người dùng có quyền Project yêu cầu hoặc xem Comparison.|
|Trigger|Bước input theo CMP-006 hoặc output theo CMP-007 gặp array trong dữ liệu thuộc phạm vi so.|
|Preconditions|Cặp đã qua CMP-005, các Snapshot có dữ liệu đầy đủ; với output, input phải tương thích và format có thể xử lý.|
|Input mismatch|Array input đổi thứ tự quan sát được: ghi input mismatch, dừng trước output, Result rỗng.|
|Output difference|Array output đổi thứ tự quan sát được sau input compatible: DIFFERENT khi output so đầy đủ.|
|Unavailable|Array thiếu/truncate/không đọc được: không kết luận từ phần dữ liệu còn lại, lý do theo CMP-014/017/018.|

# **5 Business Rules**

|**ID**|**Business rule**|
| :- | :- |
|BR-CMP-008-01|Thứ tự array là dữ liệu quan sát được. So theo chỉ số vị trí từ đầu đến cuối ở từng cấp lồng nhau.|
|BR-CMP-008-02|Không sort, không coi array là set/multiset và không ghép theo id, key, tên hoặc giá trị trùng để che thay đổi thứ tự.|
|BR-CMP-008-03|Nếu dãy raw sau cùng không đổi vì hoán đổi hai phần tử không phân biệt được, không tự tạo khác biệt giả.|
|BR-CMP-008-04|Array input đổi thứ tự là input mismatch theo CMP-006; không gọi output, không tạo DIFFERENT, không chọn baseline khác.|
|BR-CMP-008-05|Array output đổi thứ tự là một khác biệt output; chỉ tạo DIFFERENT sau khi input compatible và toàn bộ output thuộc phạm vi so hoàn tất.|
|BR-CMP-008-06|Tại mỗi vị trí, giá trị/kiểu và raw representation của phần tử tiếp tục tuân CMP-007/009/010; object cùng ID không xóa bỏ vị trí của nó.|
|BR-CMP-008-07|Array con cũng được so theo vị trí riêng. Đường dẫn khác biệt bao gồm cấp chứa và chỉ số bị ảnh hưởng theo CMP-015.|
|BR-CMP-008-08|Độ dài khác, phần tử thiếu hoặc empty/null là các khác biệt theo quy tắc dữ liệu liên quan; không đổi chúng thành phép ghép thứ tự.|
|BR-CMP-008-09|Không có ngoại lệ mặc định. Policy bỏ qua thứ tự chỉ được dùng sau khi khách hàng duyệt phạm vi/đường dẫn/phiên bản và có dấu vết áp dụng.|
|BR-CMP-008-10|Không suy đoán nghiệp vụ “đổi thứ tự không quan trọng” hay nguyên nhân đổi thứ tự; Result chỉ ghi nhận giống/khác.|
|BR-CMP-008-11|Thiếu nội dung đầy đủ hoặc không hỗ trợ format không được tạo kết luận SAME/DIFFERENT từ một phần array.|
|BR-CMP-008-12|Các cặp trong so chuỗi vẫn độc lập theo CMP-004; array mismatch ở một cặp không dừng cặp khác.|

# **6 Main Flow**
1. Hệ thống nhận cặp Snapshot đã qua CMP-005 và đọc actual input đầy đủ theo CMP-006/007.
1. Nếu trong input có array, hệ thống đi qua phần tử theo thứ tự ở từng cấp lồng nhau, không sort hoặc ghép theo ID.
1. Nếu array input khác ở vị trí thuộc phạm vi, ghi input mismatch và dừng trước output; nếu input tương thích, chuyển sang output.
1. Hệ thống đọc output đầy đủ và đối chiếu mọi array theo vị trí cùng các quy tắc raw/type/missing liên quan.
1. Nếu array output đổi thứ tự quan sát được, ghi khác biệt theo đúng cặp và đường dẫn; chỉ sau khi output so hoàn tất, CMP-001 kết luận DIFFERENT. Nếu không có khác biệt nào thuộc phạm vi, kết luận SAME.
# **7 Alternative and Exception Flows**

|**ID**|**Situation**|**Expected behavior**|
| :- | :- | :- |
|ALT-01|Input [A,B] so với [B,A]|Input mismatch; không so output; Result rỗng.|
|ALT-02|Output [A,B] so với [B,A], input compatible|DIFFERENT sau khi so output đầy đủ.|
|ALT-03|[A,A,B] vẫn là [A,A,B] sau khi đổi hai A|Không có khác biệt quan sát được do riêng lần hoán đổi đó.|
|ALT-04|Array object [{id:1},{id:2}] đảo vị trí|Khác theo vị trí, không ghép lại theo id.|
|ALT-05|Array con trong object đổi thứ tự|Khác ở đường dẫn array con, theo gate input/output tương ứng.|
|ALT-06|Một array có thêm phần tử ở cuối|Khác số lượng/giá trị theo CMP-007/009; không sort hoặc ghép lại.|
|EXC-01|Một bên [] và bên kia null hoặc missing|Không mặc nhiên tương đương; quy tắc CMP-009.|
|EXC-02|Array bị cắt trước vị trí khác biệt|Không suy SAME từ tiền tố đã thấy; reason theo CMP-014/017/018.|
|EXC-03|User mong array không cần thứ tự, chưa có policy duyệt|Giữ quy tắc thứ tự mặc định; không tự bật ngoại lệ.|
|EXC-04|S1→S2 array input mismatch, S2→S3 hợp lệ|Cặp đầu dừng; cặp sau tiếp tục độc lập theo CMP-004.|

# **8 Acceptance Criteria**

|**ID**|**Given**|**When**|**Then**|
| :- | :- | :- | :- |
|AC-CMP-008-01|Hai input [A,B] và [B,A]|So input|Ghi mismatch; không so output, không có Result.|
|AC-CMP-008-02|Input compatible; output [A,B] và [B,A]|So output hoàn tất|Result DIFFERENT.|
|AC-CMP-008-03|Hai output [A,A,B] giống nhau|So output|Không tạo diff chỉ từ giả định hai A đã đổi chỗ.|
|AC-CMP-008-04|Output [{"id":1},{"id":2}] so với [{"id":2},{"id":1}]|So output|DIFFERENT; không ghép phần tử lại theo id.|
|AC-CMP-008-05|Input object có array con [1,2] so với [2,1]|So input|Mismatch tại array con, dừng output.|
|AC-CMP-008-06|Output [[1,2],[3,4]] so với [[2,1],[3,4]]|So output|DIFFERENT ở array con đầu; Detail theo đường dẫn/vị trí.|
|AC-CMP-008-07|Output [A,B] so với [A,B,C]|So output|DIFFERENT do thêm phần tử; không coi dãy đầu là bằng.|
|AC-CMP-008-08|Một bên [], bên kia missing field|So phần liên quan|Không coi tương đương; áp dụng CMP-009.|
|AC-CMP-008-09|Một bên [], bên kia null|So phần liên quan|Không coi tương đương; áp dụng CMP-009.|
|AC-CMP-008-10|Array chứa 1 so với "1" tại cùng vị trí|So phần tử|Không coi bằng nhau theo CMP-010.|
|AC-CMP-008-11|Output array đổi thứ tự nhưng engine lỗi trước khi so xong|So output|Không tạo DIFFERENT từ phép so dở; reason theo CMP-014.|
|AC-CMP-008-12|Array Snapshot bị truncate|Bắt đầu Comparison|Không SAME/DIFFERENT từ tiền tố; reason dữ liệu không đủ.|
|AC-CMP-008-13|Chưa có policy ngoại lệ được khách duyệt|So array|Thứ tự vẫn có ý nghĩa ở mọi array thuộc phạm vi.|
|AC-CMP-008-14|Có diff array output sau input compatible|Xem Difference Detail|Hiển thị đường dẫn/chỉ số theo A→B, không gán nguyên nhân nghiệp vụ.|
|AC-CMP-008-15|S1→S2 input mismatch, S2→S3 input compatible|So chuỗi|Cặp đầu không Result; cặp sau vẫn tiếp tục so output.|

# **9 Clarification and Decision Log**

|**CL-CMP-008**|**Decision approved by BA**|**Status**|
| :- | :- | :- |
|01|Áp dụng mọi array input/output trong phạm vi, kể cả lồng nhau.|BA Approved|
|02|So theo vị trí; không sort hoặc ghép bằng id/key/thuộc tính.|BA Approved|
|03|Array input đổi thứ tự là input mismatch, không so output/Result.|BA Approved|
|04|Array output đổi thứ tự sau input compatible là DIFFERENT khi so đầy đủ.|BA Approved|
|05|Hoán đổi phần tử cùng raw mà dãy không đổi không tạo khác biệt giả.|BA Approved|
|06|Array lồng so theo vị trí từng cấp.|BA Approved|
|07|Thêm/bớt/sửa theo CMP-007/009/010; [] khác missing/null.|BA Approved|
|08|Array object không ghép theo cùng id; raw từng phần tử theo CMP-007.|BA Approved|
|09|Không mặc định bỏ thứ tự; ngoại lệ tương lai phải khách duyệt và truy vết.|BA Approved|
|10|Detail nêu đường dẫn/chỉ số theo A→B, không gán nguyên nhân nghiệp vụ.|BA Approved|
|11|Array thiếu/truncate/không đọc đủ không tạo SAME/DIFFERENT.|BA Approved|

# **10 Dependencies and Handoff**

|**Reference**|**Ownership and handoff**|
| :- | :- |
|CMP-001/005/006/007|Eligibility, input trước output, raw strict và Result chỉ sau phép so hoàn tất.|
|CMP-009/010/017/018|Missing/null/empty, kiểu dữ liệu, format và nội dung Snapshot đầy đủ.|
|CMP-004/014/016|Cặp chuỗi độc lập, reason khi không thể so và lưu rule/policy áp dụng.|
|CMP-015; SNP-003/004|Difference Detail theo đường dẫn/chỉ số; actual input/output lưu đầy đủ.|

Handoff gate: engine phải duy trì thứ tự phần tử array ở mọi cấp, không sort hoặc tự ghép theo ID. Array đổi thứ tự ở input chặn output; ở output chỉ tạo DIFFERENT sau khi input compatible và so hoàn tất. Hiện chưa có policy bỏ qua thứ tự mặc định; ngoại lệ tương lai cần quyết định khách hàng riêng và dấu vết áp dụng.
QC Tool  |  Group 6 Comparison Engine  |  
