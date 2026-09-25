# REQ-ENV-004 — Không so sánh khác Environment

**QC Tool · Group 6 Comparison Engine / Environment · BA FINAL · Priority: Must**  
**Trạng thái phân tích:** Clarification completed — BA Approved (12/12); phần chi tiết mở rộng baseline chờ Client Confirmation nếu quy trình dự án yêu cầu.

## 1. Requirement Information and Original Statement

> “Hệ thống không cho phép comparison giữa hai Environment khác nhau.”

| Thuộc tính | Nội dung |
| --- | --- |
| Requirement ID | REQ-ENV-004 |
| Tên | Không so sánh khác Environment |
| Loại / ưu tiên | Functional / Must |
| Actor chính | QC Tool System |
| Actor liên quan | Người dùng có quyền yêu cầu hoặc xem Comparison trong Project |
| Phụ thuộc | CMP-001/003/004/005/006/013/014/015/016; ENV, SNP, AUTH/SEC |

## 2. Business Objective and Requirement Statements

Kết quả giữa hai lần chạy ở các Environment khác nhau không phải một cặp Comparison được phép theo yêu cầu đã chốt. Hệ thống dùng **Environment ID gắn với từng Snapshot lúc tạo**, kiểm tra trước khi so actual input. Tên Environment hoặc lựa chọn UI hiện tại không thay danh tính lịch sử. Khi cặp không đạt, hệ thống nêu lý do không đủ điều kiện và không tạo SAME/DIFFERENT.

| ID | Requirement statement |
| --- | --- |
| RS-ENV-004-01 | Hai Snapshot chỉ được so khi cùng Environment ID đã gắn lúc tạo Snapshot; không dựa vào tên hiển thị như “UAT” hoặc “Production”. |
| RS-ENV-004-02 | Kiểm tra Environment là một phần của gate điều kiện cặp CMP-005 và phải hoàn tất trước khi so actual input/output. |
| RS-ENV-004-03 | Nếu A/B khác Environment, cặp không đủ điều kiện: không tạo SAME/DIFFERENT, output Difference Detail hoặc input mismatch; reason nêu không khớp Environment theo CMP-014. |
| RS-ENV-004-04 | Quy tắc áp dụng cho Comparison tự động sau Run, so thủ công hai Snapshot và từng cặp của so chuỗi; Admin không có ngoại lệ ngầm. |
| RS-ENV-004-05 | UI chỉ nên cho chọn Snapshot cùng Environment khi lập cặp; backend vẫn phải kiểm tra và từ chối cặp khác Environment kể cả khi gọi API trực tiếp. |
| RS-ENV-004-06 | Hai Environment ID khác nhau dù trùng tên vẫn là khác Environment. Đổi tên một Environment nhưng giữ ID không làm Snapshot của nó thành khác Environment. |
| RS-ENV-004-07 | Environment ID gắn Snapshot là dữ liệu lịch sử bất biến; lựa chọn UI hoặc cấu hình API hiện tại không được chuyển Snapshot cũ sang Environment khác. |
| RS-ENV-004-08 | Nếu baseline mặc định đã chốt nhưng khi xử lý bị xác định khác Environment với target, giữ cặp/ID đã chốt và reason không đủ điều kiện, không tự chọn baseline khác. |
| RS-ENV-004-09 | Với so chuỗi, kiểm tra từng cặp riêng: cặp khác Environment bị từ chối; cặp hợp lệ khác vẫn xử lý độc lập, không tạo Result tổng hợp. |
| RS-ENV-004-10 | Đổi tên, ngừng sử dụng Environment hoặc thay Allow Run sau khi có Snapshot không tự sửa Result Comparison đã hoàn tất; quyền Run mới thuộc yêu cầu ENV/RUN riêng. |
| RS-ENV-004-11 | Reason từ chối đủ rõ cho người có quyền, nhưng không tiết lộ tên/sự tồn tại của Environment hoặc Snapshot thuộc Project ngoài quyền. |
| RS-ENV-004-12 | Nếu Environment ID của một Snapshot thiếu hoặc không xác định được do dữ liệu lịch sử hỏng, không mặc định hai phía cùng Environment; dừng với reason dữ liệu không đủ theo CMP-014. |

## 3. Scope and Boundaries

| Trong phạm vi ENV-004 | Thuộc yêu cầu liên quan |
| --- | --- |
| Kiểm tra cùng Environment ID lịch sử của cặp trước gate input và từ chối cặp khác ID. | CMP-005 chốt toàn bộ điều kiện cặp (cùng Project/API/auth context và Snapshot đủ điều kiện); CMP-006/007 xử lý input/output sau gate. |
| Áp dụng cho tự động, thủ công và các cặp trong chuỗi; giữ baseline đã chốt. | CMP-003/004/013 chốt baseline, phương thức chọn và thời điểm tự động Comparison. |
| Status/reason không đủ điều kiện, Result rỗng và truy xuất an toàn. | CMP-001/014/015/016 sở hữu Result, reason, Detail và persistence; AUTH/SEC sở hữu quyền. |
| Giữ Environment lịch sử bất biến dù cấu hình/tên/Allow Run thay đổi. | ENV/RUN/SNP sở hữu cấu hình, quyền Run và lưu lịch sử Snapshot. |

## 4. Actor, Trigger, Preconditions and Postconditions

| Mục | Quy tắc |
| --- | --- |
| Actor | QC Tool System kiểm tra ở backend; người dùng có quyền Project chọn/xem cặp. |
| Trigger | Một cặp Snapshot A baseline → B target được đề nghị so tự động/thủ công hoặc là cặp trong chuỗi. |
| Preconditions | Xác định đúng Snapshot A/B và quyền Project; lấy Environment ID lịch sử của mỗi Snapshot. |
| Postcondition — cùng Environment | Gate Environment đạt; tiếp tục các điều kiện khác của CMP-005 rồi mới so input theo CMP-006. Chưa thể kết luận SAME chỉ từ Environment giống. |
| Postcondition — khác Environment | Cặp không đủ điều kiện, Result rỗng; không so input/output hoặc tạo Detail khác biệt. |
| Postcondition — thiếu ID | Dừng với reason dữ liệu lịch sử không đủ; không suy từ tên Environment hoặc cấu hình hiện tại. |

## 5. Business Rules

| ID | Business rule |
| --- | --- |
| BR-ENV-004-01 | Điều kiện là `environmentId(A) = environmentId(B)` với cả hai ID xác định, lấy từ Snapshot bất biến. |
| BR-ENV-004-02 | Tên hiển thị không phải khóa điều kiện; trùng tên khác ID vẫn từ chối, cùng ID sau đổi tên vẫn đạt gate Environment. |
| BR-ENV-004-03 | Gate Environment nằm trước input compatibility và output comparison; cặp khác ID không sinh input mismatch, DIFFERENT hoặc SAME. |
| BR-ENV-004-04 | Backend cưỡng chế điều kiện cho mọi phương thức so và mọi role; lọc/khóa lựa chọn trên UI chỉ hỗ trợ tránh thao tác không hợp lệ. |
| BR-ENV-004-05 | Cặp bị từ chối giữ A/B và reason trong phạm vi CMP-014/016, không tự chọn Snapshot khác để tạo kết quả. |
| BR-ENV-004-06 | Mỗi cặp trong chain độc lập; cặp khác Environment không khiến cặp hợp lệ khác thành DIFFERENT hoặc dừng toàn chuỗi, và không có Result chuỗi thay từng cặp. |
| BR-ENV-004-07 | Environment ID của Snapshot không được ghi lại từ Environment đang chọn hoặc cấu hình API hiện tại khi xem/so lịch sử. |
| BR-ENV-004-08 | Thay tên, trạng thái hoạt động hoặc Allow Run sau khi so xong không làm tính lại/sửa Result lịch sử; quy định có được Run tiếp hay không thuộc ENV/RUN. |
| BR-ENV-004-09 | Kiểm tra quyền trước khi lộ thông tin Environment, Snapshot, reason hoặc Comparison; reason không tiết lộ Project ngoài quyền. |
| BR-ENV-004-10 | ID thiếu/hỏng là dữ liệu không đủ, không phải “cùng Environment” hoặc “khác Environment” suy từ tên; Result rỗng. |

## 6. Main Flow

1. Hệ thống kiểm tra quyền Project và xác định đúng cặp Snapshot A→B theo CMP-003/004/013.
2. Hệ thống đọc Environment ID lịch sử của A và B, xác nhận cả hai ID có thể xác định.
3. Nếu ID khác nhau, dừng ở gate điều kiện cặp theo CMP-005, ghi reason khác Environment và để Result rỗng theo CMP-014/016.
4. Nếu ID giống nhau, hệ thống tiếp tục kiểm tra các điều kiện cặp còn lại. Chỉ sau khi toàn bộ gate đạt mới so actual input theo CMP-006 và output theo CMP-007.
5. CMP-001 chỉ tạo SAME/DIFFERENT khi input compatible và phép so output thuộc phạm vi hoàn tất; việc cùng Environment không tự tạo Result.

## 7. Alternative and Exception Flows

| ID | Tình huống | Xử lý mong đợi |
| --- | --- | --- |
| ALT-01 | Hai Environment trùng tên “UAT” nhưng khác ID. | Từ chối cặp trước input; Result rỗng. |
| ALT-02 | Environment đổi tên từ “UAT” thành “Staging” nhưng giữ ID. | Snapshot cũ/mới cùng ID đạt gate Environment, còn các gate khác vẫn phải kiểm tra. |
| ALT-03 | Admin chọn hai Snapshot khác Environment. | UI ngăn khi có thể; backend vẫn từ chối, không ngoại lệ ngầm. |
| ALT-04 | So tự động có baseline đã chốt khác Environment với target do tình huống dữ liệu bất thường. | Giữ baseline ID/cặp, reason không đủ điều kiện; không tìm bản cũ thay. |
| ALT-05 | Chain A→B cùng Environment, B→C khác Environment. | Xử lý A→B độc lập; B→C bị từ chối; không có Result tổng hợp. |
| ALT-06 | Environment ngừng sử dụng hoặc Allow Run thay sau Comparison hoàn tất. | Giữ Result lịch sử; Run mới xét theo ENV/RUN. |
| EXC-01 | Snapshot A thiếu Environment ID do dữ liệu hỏng. | Dừng với reason dữ liệu không đủ, không suy từ tên hoặc cấu hình hiện tại. |
| EXC-02 | Người dùng không có quyền với Project chứa Snapshot. | Từ chối truy cập trước khi tiết lộ cặp/Environment/reason. |

## 8. Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-ENV-004-01 | A ở Environment ID E1, B ở E2; cả hai có tên “UAT”. | Yêu cầu Comparison. | Backend từ chối trước input/output; Result rỗng, reason khác Environment. |
| AC-ENV-004-02 | A/B cùng Environment ID E1; tên E1 đổi sau khi tạo A. | Yêu cầu Comparison. | Gate Environment đạt; hệ thống tiếp tục gate khác, không kết luận SAME chỉ vì cùng E1. |
| AC-ENV-004-03 | A/B khác Environment, actual input của chúng cũng khác. | So cặp. | Reason chính ở gate cặp khác Environment; không tạo input mismatch hoặc output Detail. |
| AC-ENV-004-04 | A/B khác Environment, actual output có vẻ giống. | So cặp. | Không tạo SAME; cặp không đủ điều kiện trước khi so dữ liệu. |
| AC-ENV-004-05 | UI đã lọc Snapshot cùng Environment. | Client gọi API trực tiếp với A/B khác Environment. | Backend vẫn từ chối; không dựa riêng vào UI. |
| AC-ENV-004-06 | Admin chọn A/B khác Environment. | Yêu cầu so thủ công. | Bị từ chối theo cùng rule, không có ngoại lệ role ngầm. |
| AC-ENV-004-07 | Baseline A đã chốt nhưng khác Environment với target B; có Snapshot cũ C cùng Environment B. | Tự động xử lý. | Giữ cặp A→B, từ chối với reason; không tự đổi A thành C. |
| AC-ENV-004-08 | Chain có cặp A→B hợp lệ và B→C khác Environment. | So chuỗi. | A→B được xử lý riêng; B→C bị từ chối; không có Result chuỗi tổng hợp. |
| AC-ENV-004-09 | Comparison A→B đã hoàn tất, sau đó E1 đổi tên/ngừng sử dụng/đổi Allow Run. | Mở lịch sử. | Result/Detail đã hoàn tất không bị sửa hoặc tính lại. |
| AC-ENV-004-10 | Snapshot A thiếu Environment ID. | Yêu cầu Comparison. | Result rỗng với reason dữ liệu không đủ; không suy Environment từ tên hoặc cấu hình hiện tại. |
| AC-ENV-004-11 | Người dùng không có quyền Project. | Truy cập cặp khác Environment. | Không lộ tên/sự tồn tại của Environment, Snapshot hay reason nội bộ. |
| AC-ENV-004-12 | A/B cùng Environment và qua các gate còn lại; input compatible, output giống và so đầy đủ. | Hoàn tất Comparison. | SAME được tạo bởi luồng CMP-001/006/007, không bởi riêng gate Environment. |

## 9. Clarification and Decision Log

| ID | Quyết định đã thống nhất | Trạng thái |
| --- | --- | --- |
| CL-ENV-004-01 | So Environment ID lịch sử, không theo tên hiển thị. | BA Approved |
| CL-ENV-004-02 | Gate Environment thuộc CMP-005, trước input/output. | BA Approved |
| CL-ENV-004-03 | Khác Environment → cặp không đủ điều kiện, Result rỗng, không input mismatch/Detail. | BA Approved |
| CL-ENV-004-04 | Áp dụng automatic/manual/chain, không ngoại lệ Admin ngầm. | BA Approved |
| CL-ENV-004-05 | UI hỗ trợ lọc; backend bắt buộc từ chối cặp khác Environment. | BA Approved |
| CL-ENV-004-06 | Khác ID dù trùng tên là khác; cùng ID sau đổi tên vẫn là cùng Environment. | BA Approved |
| CL-ENV-004-07 | Environment ID trên Snapshot bất biến, không đổi theo UI/config hiện tại. | BA Approved |
| CL-ENV-004-08 | Baseline đã chốt khác Environment thì giữ cặp/reason, không chọn bản thay. | BA Approved |
| CL-ENV-004-09 | Chain kiểm tra từng cặp độc lập, không có Result tổng hợp thay thế. | BA Approved |
| CL-ENV-004-10 | Đổi tên/trạng thái/Allow Run về sau không sửa Result hoàn tất. | BA Approved |
| CL-ENV-004-11 | Reason đủ rõ trong quyền, không lộ Environment/Snapshot ngoài Project. | BA Approved |
| CL-ENV-004-12 | Thiếu/hỏng Environment ID → dữ liệu không đủ, không suy là cùng Environment. | BA Approved |

## 10. Dependencies and Handoff

| Reference | Ownership / handoff |
| --- | --- |
| CMP-005/006/007/001 | Gate điều kiện cặp, input trước output và điều kiện tạo SAME/DIFFERENT. |
| CMP-003/004/013 | Baseline đã chốt, so thủ công/chuỗi và so tự động sau Run. |
| CMP-014/015/016 | Reason/status không đủ điều kiện, không tạo Detail giả và lưu/truy xuất cặp lịch sử. |
| ENV/RUN/SNP | Environment ID và tính bất biến Snapshot; cấu hình/Allow Run cho lần chạy mới. |
| AUTH/SEC; UI/AnD API | Kiểm soát quyền, lọc lựa chọn, validation backend và response reason an toàn. |
