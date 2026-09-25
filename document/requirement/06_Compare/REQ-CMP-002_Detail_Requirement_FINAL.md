# REQ-CMP-002 — Đánh dấu Expected/Unexpected

**QC Tool · Group 7 Kết quả và đánh giá Comparison · BA FINAL · Priority: Should**  
**Trạng thái phân tích:** Clarification completed — BA Approved (14/14); phần chi tiết mở rộng baseline chờ Client Confirmation nếu quy trình dự án yêu cầu.

## 1. Requirement Information and Original Statement

> “Sau khi có kết quả DIFFERENT, người dùng phải có thể đánh dấu thay đổi là Expected hoặc Unexpected.”

| Thuộc tính | Nội dung |
| --- | --- |
| Requirement ID | REQ-CMP-002 |
| Tên | Đánh dấu Expected/Unexpected |
| Loại / ưu tiên | Functional / Should |
| Actor chính | Người dùng có quyền đánh giá Comparison trong Project |
| Actor hệ thống | QC Tool kiểm tra điều kiện, quyền, lưu và hiển thị classification |
| Phụ thuộc | CMP-001/004/014/015/016; OUT-002; USR/PRJ/AUTH/SEC |

## 2. Business Objective and Requirement Statements

Engine chỉ kết luận dữ liệu actual output giống hay khác sau khi cặp hợp lệ, input compatible và phép so hoàn tất. Người dùng có thể đánh giá một kết quả **DIFFERENT** là thay đổi dự kiến (Expected) hoặc ngoài dự kiến (Unexpected). Classification là nhận định thủ công gắn đúng Comparison, có thể thay đổi và truy vết; nó không sửa Result, Difference Detail hay Snapshot lịch sử.

| ID | Requirement statement |
| --- | --- |
| RS-CMP-002-01 | Chỉ Comparison hợp lệ đã hoàn tất với Result DIFFERENT mới cho phép đánh dấu Expected/Unexpected; SAME, input mismatch và trạng thái chưa hoàn tất không có thao tác này. |
| RS-CMP-002-02 | DIFFERENT mới có trạng thái classification chưa được đánh dấu; hệ thống không tự chọn Expected hoặc Unexpected. |
| RS-CMP-002-03 | Expected là đánh giá của người dùng rằng thay đổi quan sát được là dự kiến; Unexpected là đánh giá rằng thay đổi ngoài dự kiến. Đây không phải kết luận tự động về đúng/sai. |
| RS-CMP-002-04 | Classification gắn với một Comparison/cặp Snapshot A→B cụ thể, không gắn chung cho API hoặc tự áp dụng các lần so sau. |
| RS-CMP-002-05 | Đánh dấu không thay Result DIFFERENT, Difference Detail, Snapshot hoặc rule/policy của lần so; Summary có thể hiển thị đồng thời Result và classification. |
| RS-CMP-002-06 | Chỉ người có quyền phù hợp trong Project được đánh dấu. Backend phải kiểm tra quyền và Result DIFFERENT, không chỉ dựa vào trạng thái nút UI; permission matrix cụ thể thuộc nhóm User/Role. |
| RS-CMP-002-07 | Người có quyền được đổi Expected ↔ Unexpected khi đánh giá lại; lưu classification hiện tại, người/thời điểm cập nhật và lịch sử các lần thay đổi. |
| RS-CMP-002-08 | Cập nhật phải nhắm đúng Comparison ID. Với cập nhật gần đồng thời, hệ thống phải có cơ chế phát hiện/xử lý xung đột để không âm thầm làm mất đánh giá; kỹ thuật cụ thể thuộc AnD. |
| RS-CMP-002-09 | Ghi chú/lý do đánh dấu là tùy chọn; nếu có, lưu cùng đánh giá và bảo vệ theo quyền. |
| RS-CMP-002-10 | Khi mở lại lịch sử, hiển thị Result và classification hiện tại tách biệt, cùng người/thời điểm đánh giá; thay classification không chạy lại Comparison. |
| RS-CMP-002-11 | Với so chuỗi, mỗi cặp DIFFERENT có classification riêng; không có Expected/Unexpected tổng hợp tự áp cho cả chuỗi. |
| RS-CMP-002-12 | Nếu Snapshot của cặp về sau invalidated, classification lịch sử vẫn gắn Comparison đã hoàn tất; UI nêu tình trạng Snapshot hiện tại riêng. |
| RS-CMP-002-13 | Người không có quyền không được xem/sửa classification hoặc ghi chú ngoài Project; lịch sử không làm lộ dữ liệu nhạy cảm. |
| RS-CMP-002-14 | Vì Priority Should, chức năng có thể triển khai sau phần Result/Detail Must; việc chưa có classification không cản trở Comparison Engine tạo Result. |

## 3. Scope and Boundaries

| Trong phạm vi CMP-002 | Thuộc yêu cầu liên quan |
| --- | --- |
| Điều kiện đánh dấu, trạng thái chưa đánh dấu, Expected/Unexpected, thay đổi và lịch sử đánh giá. | CMP-001/014/016 quyết định Result/status, persistence Comparison và cặp hợp lệ. |
| Hiển thị classification tách Result trên Summary/Detail. | OUT-002/CMP-015 sở hữu Summary và output Difference Detail. |
| Quyền cập nhật/xem, ghi chú tùy chọn và bảo vệ lịch sử. | USR/PRJ/AUTH/SEC chốt permission matrix, quyền Project và audit/security; AnD chốt contract/xung đột. |
| Ưu tiên Should và thứ tự triển khai. | Engine Result/Detail Must vẫn hoạt động khi classification chưa được triển khai. |

## 4. Actor, Trigger, Preconditions and Postconditions

| Mục | Quy tắc |
| --- | --- |
| Actor | Người dùng có quyền đánh giá trong Project; QC Tool xác thực/kiểm tra và lưu. |
| Trigger | Người dùng chọn Expected hoặc Unexpected từ một Comparison DIFFERENT, hoặc cập nhật đánh giá đã có. |
| Preconditions | Comparison ID hợp lệ trong Project có quyền, processing status hoàn tất và Result DIFFERENT. |
| Postcondition — thành công | Classification hiện tại/ghi chú nếu có, người và thời điểm được lưu; lịch sử thay đổi truy vết được; Result vẫn DIFFERENT. |
| Postcondition — từ chối | SAME, không hoàn tất, khác Project/không quyền hoặc xung đột cập nhật: không đổi classification; trả lý do an toàn. |

## 5. Business Rules

| ID | Business rule |
| --- | --- |
| BR-CMP-002-01 | Classification có ba trạng thái nghiệp vụ: chưa được đánh dấu, Expected, Unexpected. Chưa đánh dấu không được ngầm xem là Unexpected. |
| BR-CMP-002-02 | Chỉ Result DIFFERENT hoàn tất mới cho phép tạo/đổi classification; input mismatch không phải DIFFERENT. |
| BR-CMP-002-03 | Result DIFFERENT là kết luận của engine về actual output; classification là đánh giá thủ công, không sửa Result/Detail/rule/policy/Snapshot. |
| BR-CMP-002-04 | Một classification hiện tại gắn đúng Comparison ID/cặp A→B; các Comparison khác cùng API hoặc trong chuỗi không thừa hưởng. |
| BR-CMP-002-05 | Mỗi cập nhật thành công ghi giá trị mới, người và thời điểm; lịch sử giữ các giá trị trước để truy vết. |
| BR-CMP-002-06 | Cập nhật gần đồng thời phải được phát hiện/xử lý thay vì ghi đè âm thầm; AnD quyết định version guard/transaction/response xung đột. |
| BR-CMP-002-07 | Ghi chú là tùy chọn, gắn lần đánh giá tương ứng và được kiểm tra/hiển thị theo quyền; không tự tạo nhận định của hệ thống. |
| BR-CMP-002-08 | UI cho thấy `DIFFERENT` tách với Expected/Unexpected và trạng thái chưa đánh dấu; không dùng classification thay badge Result. |
| BR-CMP-002-09 | Invalidation về sau không xóa classification lịch sử hoặc đổi Result, nhưng UI nêu tình trạng Snapshot hiện tại riêng. |
| BR-CMP-002-10 | Backend kiểm tra quyền Project/quyền đánh giá và trạng thái Result ở mỗi thao tác; người không quyền không được đọc classification/ghi chú/history ngoài quyền. |
| BR-CMP-002-11 | Priority Should cho phép hoãn đánh dấu; khi chưa có tính năng, DIFFERENT và Detail Must vẫn truy xuất/hiển thị bình thường. |

## 6. Main Flow

1. Người dùng có quyền mở Summary/Detail của một Comparison đã hoàn tất với Result DIFFERENT và thấy classification hiện tại hoặc “chưa được đánh dấu”.
2. Người dùng chọn Expected hoặc Unexpected, có thể nhập ghi chú/lý do tùy chọn, rồi gửi cập nhật cho đúng Comparison ID.
3. Backend kiểm tra phiên, quyền Project/quyền đánh giá, Comparison tồn tại và vẫn là DIFFERENT hoàn tất; kiểm tra xung đột cập nhật nếu cần.
4. Hệ thống lưu giá trị mới, ghi chú nếu có, người/thời điểm và lịch sử thay đổi; giữ nguyên Result, Difference Detail và Snapshot.
5. UI hiển thị đồng thời `DIFFERENT` và classification hiện tại cùng thông tin người/thời điểm; khi mở lại lịch sử, lấy dữ liệu đã lưu, không chạy lại engine.

## 7. Alternative and Exception Flows

| ID | Tình huống | Xử lý mong đợi |
| --- | --- | --- |
| ALT-01 | DIFFERENT chưa được đánh dấu. | Hiển thị “chưa được đánh dấu”, không tự chọn Unexpected. |
| ALT-02 | Người có quyền đổi Expected sang Unexpected. | Giữ lịch sử giá trị cũ và người/thời điểm; Result vẫn DIFFERENT. |
| ALT-03 | Đánh dấu không kèm ghi chú. | Vẫn thành công; ghi chú không bắt buộc. |
| ALT-04 | Chuỗi có hai cặp DIFFERENT. | Đánh dấu từng cặp theo Comparison ID riêng, không lan sang cặp còn lại. |
| ALT-05 | Snapshot invalidated sau khi đã đánh dấu. | Giữ classification/Result lịch sử; thông báo tình trạng Snapshot hiện tại riêng. |
| EXC-01 | Comparison SAME hoặc input mismatch. | Từ chối đánh dấu; không đổi Result hoặc tạo classification. |
| EXC-02 | Comparison đang xử lý/failed. | Từ chối đánh dấu, nêu trạng thái phù hợp. |
| EXC-03 | Hai người gửi cập nhật gần đồng thời. | Phát hiện/xử lý xung đột theo AnD, không âm thầm mất cập nhật. |
| EXC-04 | Người dùng không có quyền Project/quyền đánh giá. | Backend từ chối trước khi trả/sửa dữ liệu nhạy cảm. |

## 8. Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-CMP-002-01 | Comparison đã hoàn tất với DIFFERENT, chưa có classification. | Mở Summary/Detail. | Hiển thị DIFFERENT và “chưa được đánh dấu”; không tự gắn Expected/Unexpected. |
| AC-CMP-002-02 | Người có quyền, Comparison DIFFERENT hoàn tất. | Chọn Expected không kèm ghi chú. | Lưu Expected thành công; Result/Detail/Snapshot/rule không đổi. |
| AC-CMP-002-03 | Người có quyền, Comparison DIFFERENT hoàn tất. | Chọn Unexpected kèm ghi chú. | Lưu classification và ghi chú theo quyền, người/thời điểm và lịch sử. |
| AC-CMP-002-04 | Classification hiện tại Expected. | Người có quyền đổi sang Unexpected. | Hiển thị giá trị mới, lưu lịch sử Expected trước đó; Result vẫn DIFFERENT. |
| AC-CMP-002-05 | Comparison SAME hoàn tất. | Gửi yêu cầu đánh dấu trực tiếp qua API. | Backend từ chối, không tạo classification. |
| AC-CMP-002-06 | Input mismatch hoặc cặp không đủ điều kiện, Result rỗng. | Yêu cầu đánh dấu. | Backend từ chối; không quy thành DIFFERENT. |
| AC-CMP-002-07 | Comparison đang xử lý hoặc failed. | Yêu cầu đánh dấu. | Không có classification mới; status/reason được giữ. |
| AC-CMP-002-08 | Hai Comparison DIFFERENT của cùng API hoặc cùng chain. | Đánh dấu một cặp. | Cặp kia vẫn chưa đánh dấu hoặc giữ giá trị riêng, không tự kế thừa. |
| AC-CMP-002-09 | Hai người có quyền đọc cùng classification rồi cập nhật gần đồng thời. | Gửi hai cập nhật. | Xung đột được phát hiện/xử lý theo contract AnD, không âm thầm làm mất đánh giá. |
| AC-CMP-002-10 | Comparison DIFFERENT đã đánh dấu, sau đó Snapshot bị invalidated. | Mở lại lịch sử. | Result/classification lịch sử giữ nguyên; tình trạng Snapshot hiện tại hiển thị riêng. |
| AC-CMP-002-11 | Rule/policy hoặc cấu hình hiện tại thay đổi sau khi đánh dấu. | Mở lại Comparison. | Result/Detail/classification đã ghi không bị tính lại; đổi classification không chạy engine. |
| AC-CMP-002-12 | Người dùng không có quyền Project hoặc không có quyền đánh giá. | Xem/sửa classification qua UI/API. | Không được sửa; dữ liệu classification/ghi chú/history ngoài quyền không bị lộ. |
| AC-CMP-002-13 | Chức năng Should chưa được triển khai trong giai đoạn đầu. | Comparison engine trả DIFFERENT. | Result và Difference Detail Must vẫn hoạt động, không đòi classification. |

## 9. Clarification and Decision Log

| ID | Quyết định đã thống nhất | Trạng thái |
| --- | --- | --- |
| CL-CMP-002-01 | Chỉ DIFFERENT hoàn tất được đánh dấu; SAME/mismatch/chưa xong không được. | BA Approved |
| CL-CMP-002-02 | DIFFERENT ban đầu chưa đánh dấu, không tự chọn. | BA Approved |
| CL-CMP-002-03 | Expected/Unexpected là đánh giá thủ công, không kết luận đúng/sai của engine. | BA Approved |
| CL-CMP-002-04 | Classification gắn một Comparison/cặp A→B, không gắn API/lần so sau. | BA Approved |
| CL-CMP-002-05 | Đánh dấu không sửa Result/Detail/Snapshot/rule; UI hiển thị đồng thời. | BA Approved |
| CL-CMP-002-06 | Quyền Project/quyền đánh giá kiểm tra backend; matrix cụ thể thuộc User/Role. | BA Approved |
| CL-CMP-002-07 | Có thể đổi Expected↔Unexpected; lưu hiện tại, người/thời điểm và lịch sử. | BA Approved |
| CL-CMP-002-08 | Cập nhật theo Comparison ID, phát hiện/xử lý xung đột thay vì mất cập nhật âm thầm. | BA Approved |
| CL-CMP-002-09 | Ghi chú tùy chọn, nếu có lưu và bảo vệ theo quyền. | BA Approved |
| CL-CMP-002-10 | Lịch sử hiển thị Result/classification riêng, người/thời điểm; không chạy lại Comparison. | BA Approved |
| CL-CMP-002-11 | Chain đánh dấu từng cặp DIFFERENT riêng. | BA Approved |
| CL-CMP-002-12 | Invalidation sau đó không tự xóa classification; tình trạng Snapshot riêng. | BA Approved |
| CL-CMP-002-13 | Không xem/sửa ngoài quyền; lịch sử bảo vệ dữ liệu nhạy cảm. | BA Approved |
| CL-CMP-002-14 | Priority Should, có thể triển khai sau Result/Detail Must và không chặn engine. | BA Approved |

## 10. Dependencies and Handoff

| Reference | Ownership / handoff |
| --- | --- |
| CMP-001/014/016 | Result DIFFERENT hoàn tất, status và persistence/identity Comparison. |
| CMP-004/015; OUT-002 | Cặp trong chain, Difference Detail và Summary/Detail hiển thị classification riêng. |
| USR/PRJ/AUTH/SEC | Permission matrix, kiểm tra quyền Project, lịch sử/audit và bảo vệ ghi chú. |
| AnD DB/API/UI | Classification hiện tại, history người/thời điểm, xung đột cập nhật và contract sửa/xem. |
