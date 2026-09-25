# REQ-CMP-012 — Version changed nhưng vẫn SAME

**QC Tool · Group 6 Comparison Engine · BA FINAL · Priority: Must**  
**Trạng thái phân tích:** Clarification completed — BA Approved (12/12); phần chi tiết mở rộng baseline chờ Client Confirmation nếu quy trình dự án yêu cầu.

## 1. Requirement Information and Original Statement

> “Nếu chỉ API Version hoặc Database Version thay đổi nhưng input/output giống nhau, kết quả phải là SAME và giao diện phải hiển thị cảnh báo Version changed.”

| Thuộc tính | Nội dung |
| --- | --- |
| Requirement ID | REQ-CMP-012 |
| Tên | Version changed nhưng vẫn SAME |
| Loại / ưu tiên | Functional / Must |
| Actor chính | QC Tool System |
| Actor liên quan | Người dùng có quyền xem Comparison trong Project |
| Phụ thuộc | CMP-001/003/004/005/006/007/014/015; yêu cầu Run, Snapshot, Version và phân quyền liên quan |

## 2. Business Objective and Requirement Statements

API Version và Database Version cho người dùng biết bối cảnh của hai lần chạy. Sự khác nhau của version metadata không tự chứng minh actual input/output đã đổi. Comparison vẫn phải kiểm tra **input trước, output sau**, rồi mới kết luận SAME hoặc DIFFERENT từ dữ liệu thuộc phạm vi so. Cảnh báo **Version changed** được trình bày riêng với Result và chỉ xuất hiện khi xác định được giá trị version của cả hai phía và chúng khác nhau.

| ID | Requirement statement |
| --- | --- |
| RS-CMP-012-01 | Hệ thống phải so actual input theo CMP-006 trước; chỉ khi input compatible mới so actual output đầy đủ. SAME đòi hỏi cặp hợp lệ, input compatible và không có output difference sau khi so hoàn tất. |
| RS-CMP-012-02 | API Version và Database Version đã lưu theo từng Snapshot là metadata bối cảnh, không tham gia tập actual input/output để quyết định SAME/DIFFERENT. |
| RS-CMP-012-03 | Nếu ít nhất một loại version đã xác định thay đổi, nhưng input compatible và output giống nhau sau khi so đầy đủ, Result phải là SAME và giao diện hiển thị Version changed. |
| RS-CMP-012-04 | Nếu input compatible và output khác sau khi so đầy đủ, Result là DIFFERENT do output. Nếu version cũng thay đổi, giao diện có thể đồng thời trình bày Version changed như thông tin riêng. |
| RS-CMP-012-05 | Nếu actual input mismatch, hệ thống dừng trước output và không tạo SAME/DIFFERENT; thông tin version khác nhau nếu có không thay đổi trạng thái này. |
| RS-CMP-012-06 | Hệ thống phải đọc API Version và Database Version lịch sử của Snapshot A/B; không dùng version hiện tại trong cấu hình hoặc truy vấn lại API/DB để thay giá trị đã ghi. Version được khai báo thủ công trước Run, khi đã lưu vào Snapshot, tuân theo cùng quy tắc. |
| RS-CMP-012-07 | Giao diện phải thể hiện riêng API Version A→B và Database Version A→B, cùng chỉ dấu loại nào đã xác định thay đổi; không chỉ có cảnh báo chung thiếu chi tiết. |
| RS-CMP-012-08 | Với từng loại version, chỉ xác định changed khi cả A và B có giá trị xác định và khác nhau. `UNKNOWN` hoặc thiếu ở một phía phải được hiển thị là chưa xác định/không có dữ liệu, không tự suy diễn thành changed. |
| RS-CMP-012-09 | So version theo giá trị chuỗi đã lưu, không chuẩn hóa ngầm `v1.0` thành `1.0`, không suy luận thứ tự hoặc bản nào mới hơn. |
| RS-CMP-012-10 | Trường `version` hoặc tương tự nằm trong actual response body/header là output thuộc phạm vi CMP-007, trừ khi có chính sách loại trừ cụ thể đã duyệt; quy tắc miễn trừ metadata không áp dụng cho nó. |
| RS-CMP-012-11 | Version changed là cảnh báo thông tin, không phải đánh giá đúng/sai, Expected/Unexpected, tính tương thích của release hoặc nguyên nhân gây output difference. |
| RS-CMP-012-12 | Với so sánh chuỗi, hệ thống xác định Result và tình trạng Version changed theo từng cặp Snapshot độc lập, không tạo Result/cảnh báo tổng hợp thay thế cho từng cặp. |

## 3. Scope and Boundaries

| Trong phạm vi CMP-012 | Thuộc yêu cầu liên quan |
| --- | --- |
| Xác định thay đổi của API Version và Database Version metadata giữa hai Snapshot; hiển thị từng giá trị A→B và cảnh báo thông tin. | Yêu cầu Run/Version xác định nguồn và cách ghi version; Snapshot giữ dữ liệu lịch sử bất biến. |
| Giữ Result dựa trên input compatibility và output đã so đầy đủ, không đổi Result chỉ vì version metadata. | CMP-001/005/006/007/014 sở hữu điều kiện cặp, gate input, raw output, Result và trạng thái không hoàn tất. |
| Xử lý `UNKNOWN`/thiếu ở từng phía, so chuỗi version đúng giá trị đã lưu, trình bày theo từng cặp. | CMP-003/004 xác định baseline và chuỗi; giao diện Summary/Detail thể hiện thông tin theo quyền. |
| Cảnh báo Version changed cung cấp bối cảnh. | Việc đánh giá Expected/Unexpected, nguyên nhân, tính tương thích hoặc thứ tự release cần yêu cầu riêng. |

## 4. Actor, Trigger, Preconditions and Postconditions

| Mục | Quy tắc |
| --- | --- |
| Actor | QC Tool System so và tính trạng thái; người dùng có quyền Project xem Result và thông tin version. |
| Trigger | Comparison của hai Snapshot đủ điều kiện được tạo hoặc được mở để xem. |
| Preconditions | Xác định Snapshot A (baseline) và B (target), quyền truy cập và điều kiện cặp theo CMP-005; lấy actual data cùng version đã lưu. |
| Postcondition — SAME | Input compatible, output so đầy đủ và giống nhau; nếu version metadata xác định khác, hiển thị Version changed cùng Result SAME. |
| Postcondition — DIFFERENT | Input compatible, output so đầy đủ và khác; version metadata khác được trình bày riêng, không phải nguyên nhân mặc định. |
| Postcondition — không hoàn tất | Input mismatch, cặp không hợp lệ hoặc output chưa so đầy đủ: không tạo SAME/DIFFERENT theo CMP-001/014, dù có thể trình bày version lịch sử theo quyền. |

## 5. Business Rules

| ID | Business rule |
| --- | --- |
| BR-CMP-012-01 | A là baseline Snapshot, B là target Snapshot của cặp đang xét; hai loại version được đọc riêng từ A/B. |
| BR-CMP-012-02 | Version metadata không tham gia input compatibility hoặc actual output diff. Quyết định SAME/DIFFERENT chỉ được đưa ra sau các gate dữ liệu theo CMP-001/006/007. |
| BR-CMP-012-03 | Với API Version hoặc Database Version: **changed = A xác định ∧ B xác định ∧ chuỗi A khác chuỗi B**. Cảnh báo chung Version changed xuất hiện nếu ít nhất một loại có `changed = true`. |
| BR-CMP-012-04 | `UNKNOWN` là trạng thái chưa xác định, không phải tên một bản phát hành; thiếu dữ liệu cũng không được ngầm thay bằng giá trị version khác hoặc giả định có thay đổi. |
| BR-CMP-012-05 | Nếu một loại version chưa xác định ở A hoặc B, giao diện thể hiện trạng thái đó riêng cho loại tương ứng; loại version còn lại vẫn được xét độc lập. |
| BR-CMP-012-06 | So chuỗi version đã ghi đúng giá trị, không thêm quy tắc semantic version, bỏ tiền tố, ép kiểu, cắt khoảng trắng, đổi hoa/thường hoặc suy ra thứ tự mới/cũ. |
| BR-CMP-012-07 | Version được lấy từ Snapshot bất biến, kể cả giá trị khai báo thủ công trước Run; thay đổi cấu hình sau Run không viết lại lịch sử Comparison. |
| BR-CMP-012-08 | Trường version do API thực sự trả về trong body/header thuộc actual output của CMP-007; nó có thể tạo DIFFERENT khi input compatible và output so đầy đủ. |
| BR-CMP-012-09 | Cảnh báo không kết luận release tương thích, thay đổi Expected/Unexpected hay nguyên nhân của Difference Detail. |
| BR-CMP-012-10 | Trong chuỗi, mỗi cặp A→B được xử lý riêng; không lấy version ở đầu và cuối chuỗi để thay trạng thái các cặp trung gian. |

## 6. Main Flow

1. Hệ thống chọn cặp Snapshot A/B theo CMP-003/004 và kiểm tra quyền, điều kiện cặp theo CMP-005.
2. Hệ thống lấy actual input/output cùng API Version và Database Version đã lưu tại mỗi Snapshot.
3. Hệ thống so actual input trước theo CMP-006. Nếu mismatch, dừng trước output và không tạo SAME/DIFFERENT.
4. Nếu input compatible, hệ thống so actual output theo CMP-007 và các quy tắc liên quan. Chỉ sau khi so đầy đủ, CMP-001 kết luận SAME hoặc DIFFERENT.
5. Độc lập với phép quyết định Result, hệ thống xét từng loại version theo giá trị lịch sử A→B. Giao diện hiển thị hai loại version, trạng thái chưa xác định/thiếu nếu có, và cảnh báo Version changed khi ít nhất một loại có giá trị xác định khác nhau.

## 7. Alternative and Exception Flows

| ID | Tình huống | Xử lý mong đợi |
| --- | --- | --- |
| ALT-01 | API Version đổi, Database Version giữ nguyên; input compatible, output giống. | SAME; cảnh báo Version changed chỉ rõ API Version A→B. |
| ALT-02 | Cả API Version và Database Version đổi; input compatible, output giống. | SAME; hiển thị cả hai thay đổi. |
| ALT-03 | Version đổi và actual output khác. | DIFFERENT do output; Version changed là thông tin riêng. |
| ALT-04 | Version đổi nhưng actual input mismatch. | Dừng trước output, không có Result; có thể hiển thị version khác theo quyền mà không suy ra Result. |
| ALT-05 | API Version `UNKNOWN` ở A, `v2` ở B; Database Version không đổi. | Không khẳng định API Version changed; hiển thị A chưa xác định và B = `v2`; không có cảnh báo chung từ cặp API Version này. |
| ALT-06 | API Version chưa xác định, Database Version A/B xác định và khác. | Cảnh báo Version changed do Database Version; API Version vẫn ghi chưa xác định. |
| ALT-07 | API Version `v1.0` ở A và `1.0` ở B, cả hai xác định. | Xác định API Version changed theo chuỗi đã lưu; không chuẩn hóa hai chuỗi thành bằng nhau. |
| ALT-08 | Actual response có field `version` khác, metadata version giống. | So field như output; có thể DIFFERENT sau khi input compatible và so output đầy đủ. |
| EXC-01 | Output không đủ dữ liệu hoặc engine dừng trước khi so xong. | Không tạo SAME/DIFFERENT từ version; trạng thái/reason theo CMP-014. |
| ALT-09 | So chuỗi nhiều cặp. | Result và Version changed được xác định riêng cho mỗi cặp. |

## 8. Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-CMP-012-01 | Cặp hợp lệ; input compatible, output giống và so đầy đủ; API Version `v1`→`v2`, Database Version `db1`→`db1`. | Hoàn tất Comparison. | SAME; hiển thị Version changed, chỉ rõ API Version `v1`→`v2`. |
| AC-CMP-012-02 | Input compatible, output giống và so đầy đủ; API Version `v1`→`v2`, Database Version `db1`→`db2`. | Hoàn tất Comparison. | SAME; hiển thị hai loại version thay đổi A→B. |
| AC-CMP-012-03 | Input compatible, output khác và so đầy đủ; API Version `v1`→`v2`. | Hoàn tất Comparison. | DIFFERENT do output; Version changed hiển thị riêng, không thay thế Difference Detail. |
| AC-CMP-012-04 | Input mismatch; API Version A/B khác nhau. | So cặp. | Dừng trước output, không có SAME/DIFFERENT; version không dùng để kết luận Result. |
| AC-CMP-012-05 | Input compatible, output giống; API Version `UNKNOWN`→`v2`, Database Version bằng nhau. | Xem Comparison. | SAME; thể hiện API Version A chưa xác định, không cảnh báo Version changed chỉ vì `UNKNOWN`→`v2`. |
| AC-CMP-012-06 | API Version thiếu ở A, xác định ở B; Database Version `db1`→`db2`; input compatible, output giống. | Xem Comparison. | SAME; cảnh báo Version changed do Database Version; API Version A hiển thị không có dữ liệu. |
| AC-CMP-012-07 | API Version `v1.0`→`1.0`; input compatible, output giống và so đầy đủ. | Hoàn tất Comparison. | SAME và Version changed; không chuẩn hóa hai chuỗi. |
| AC-CMP-012-08 | Version Snapshot A/B đã lưu, sau đó cấu hình API/DB version hiện tại thay đổi. | Mở lại Comparison. | Dùng giá trị lịch sử của A/B; cảnh báo và Result không đổi do cấu hình hiện tại. |
| AC-CMP-012-09 | Version B được khai báo thủ công trước Run và đã lưu vào Snapshot. | So A/B. | So đúng version đã lưu của B như nguồn lịch sử, không xem nhẹ vì nguồn khai báo thủ công. |
| AC-CMP-012-10 | Metadata version giống; actual response body có field `version` khác. | So output hoàn tất sau input compatible. | DIFFERENT do field output theo CMP-007, nếu không có chính sách loại trừ đã duyệt. |
| AC-CMP-012-11 | Output chưa so xong; cả hai version đã xác định và khác. | Engine dừng. | Không tạo SAME/DIFFERENT; Version changed không thay thế trạng thái/reason không hoàn tất. |
| AC-CMP-012-12 | Chuỗi gồm A→B và B→C với các version khác nhau. | Xem chuỗi. | Từng cặp có Result và chỉ dấu Version changed riêng; không có Result/cảnh báo tổng hợp thay cho từng cặp. |
| AC-CMP-012-13 | Người dùng không có quyền xem Project. | Truy cập version và Comparison. | Không hiển thị dữ liệu vượt phạm vi quyền. |

## 9. Clarification and Decision Log

| ID | Quyết định đã thống nhất | Trạng thái |
| --- | --- | --- |
| CL-CMP-012-01 | So input trước, output sau; SAME chỉ khi cặp hợp lệ, input compatible và output so đủ, giống nhau. | BA Approved |
| CL-CMP-012-02 | API/DB Version là metadata Snapshot, không quyết định SAME/DIFFERENT. | BA Approved |
| CL-CMP-012-03 | Version xác định khác nhưng input/output giống theo gate thì SAME và Version changed. | BA Approved |
| CL-CMP-012-04 | Output khác thì DIFFERENT do output; vẫn có thể hiển thị version đổi riêng. | BA Approved |
| CL-CMP-012-05 | Input mismatch dừng trước output, không Result; version không thay gate. | BA Approved |
| CL-CMP-012-06 | So version lịch sử của Snapshot; không dùng cấu hình hiện tại hoặc gọi lại; giá trị khai báo thủ công đã lưu có cùng hiệu lực. | BA Approved |
| CL-CMP-012-07 | Hiển thị riêng API Version và Database Version A→B, rõ loại thay đổi. | BA Approved |
| CL-CMP-012-08 | Chỉ xác định changed khi A/B đều có giá trị xác định và khác; `UNKNOWN`/thiếu không được suy diễn là changed. | BA Approved |
| CL-CMP-012-09 | So chuỗi version đúng giá trị lưu; không chuẩn hóa hoặc suy luận bản mới hơn. | BA Approved |
| CL-CMP-012-10 | Field version trong actual response vẫn là output theo CMP-007 nếu chưa có chính sách loại trừ đã duyệt. | BA Approved |
| CL-CMP-012-11 | Version changed chỉ là cảnh báo thông tin, không đánh giá nguyên nhân, đúng/sai hay Expected/Unexpected. | BA Approved |
| CL-CMP-012-12 | So chuỗi xử lý Result và cảnh báo theo từng cặp, không tổng hợp thay thế. | BA Approved |

## 10. Dependencies and Handoff

| Reference | Ownership / handoff |
| --- | --- |
| CMP-001/005/006/007 | Điều kiện cặp, input compatibility, raw strict output và Result sau khi so đầy đủ. |
| CMP-003/004 | Cặp Snapshot A/B, baseline và xử lý từng cặp trong chuỗi. |
| CMP-014/015 và UI Comparison | Trạng thái/reason không hoàn tất, Difference Detail và cách trình bày Result cùng Version changed riêng biệt. |
| Run / Snapshot / Version | Nguồn version trước Run, giá trị `UNKNOWN`, lưu lịch sử bất biến và quyền truy cập dữ liệu. |
