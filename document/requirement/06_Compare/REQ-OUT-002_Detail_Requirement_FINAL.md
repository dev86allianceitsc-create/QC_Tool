# REQ-OUT-002 — Hiển thị kết quả và Comparison Detail

**QC Tool · Group 7 Kết quả và đánh giá Comparison · BA FINAL · Priority: Must**  
**Trạng thái phân tích:** Clarification completed — BA Approved (14/14); phần chi tiết mở rộng baseline chờ Client Confirmation nếu quy trình dự án yêu cầu.

## 1. Requirement Information and Original Statement

> “Màn hình tổng hợp comparison phải hiển thị SAME/DIFFERENT; khi người dùng mở Detail, hệ thống phải hiển thị phần đối chiếu output.”

| Thuộc tính | Nội dung |
| --- | --- |
| Requirement ID | REQ-OUT-002 |
| Tên | Hiển thị kết quả và Comparison Detail |
| Loại / ưu tiên | Functional / Must |
| Actor chính | Người dùng có quyền xem Comparison trong Project |
| Actor hệ thống | QC Tool UI và backend cung cấp dữ liệu Comparison |
| Phụ thuộc | CMP-001/002/003/004/006/011/012/014/015/016; OUT-001; SNP, AUTH/SEC |

## 2. Business Objective and Requirement Statements

Người dùng cần biết phép so nào đã hoàn tất và kết quả là SAME hay DIFFERENT, đồng thời có thể xem actual output của đúng cặp Snapshot theo chiều baseline A→target B. Các trạng thái chưa thể kết luận phải được nhận diện riêng, tránh badge giả. Summary và Detail trình bày nhất quán dữ liệu lịch sử, phân biệt input mismatch với output difference, và bảo vệ thông tin theo quyền.

| ID | Requirement statement |
| --- | --- |
| RS-OUT-002-01 | Summary chỉ hiển thị Result SAME/DIFFERENT khi Comparison hợp lệ đã hoàn tất. |
| RS-OUT-002-02 | Chưa có cặp, đang xử lý, cặp không đủ điều kiện, input mismatch hoặc Comparison failed không được hiển thị badge SAME/DIFFERENT giả; thể hiện status/reason theo CMP-014. |
| RS-OUT-002-03 | Mỗi kết quả phải xác định baseline Snapshot A→target Snapshot B, API, Project, Environment và thời điểm liên quan. |
| RS-OUT-002-04 | Với SAME, Summary nêu không có output difference thuộc phạm vi sau khi input compatible và output so đầy đủ; không tuyên bố mọi dữ liệu/metadata đều giống. |
| RS-OUT-002-05 | Với DIFFERENT, Summary cho biết có output difference và cho mở Detail đúng cặp; không tự đánh giá lỗi, đúng/sai hoặc nguyên nhân. |
| RS-OUT-002-06 | Detail của DIFFERENT phải hiển thị đối chiếu output A→B theo CMP-015: HTTP status, response headers, body và vị trí/biểu diễn khác biệt an toàn khi có. |
| RS-OUT-002-07 | Detail của SAME phải thể hiện không có output difference, cho xem bối cảnh cặp, input compatibility đã đạt và metadata latency/version riêng. |
| RS-OUT-002-08 | Input mismatch phải hiển thị chẩn đoán input và bước dừng; không dựng output Detail hoặc Result DIFFERENT. |
| RS-OUT-002-09 | Latency A/B/Δ và API/Database Version A→B hiển thị riêng; cảnh báo Version changed theo CMP-012 không đổi Result. |
| RS-OUT-002-10 | Detail dài hoặc có file/binary có thể phân trang/rút gọn, nhưng phải cho biết còn nội dung và cách xem tiếp theo quyền. |
| RS-OUT-002-11 | So chuỗi hiển thị từng cặp với status/Result riêng; mở Detail của đúng cặp, không có một SAME/DIFFERENT tổng hợp thay thế. |
| RS-OUT-002-12 | Mở lại Comparison lịch sử phải dùng Result, Detail, rule/policy đã ghi; không tự tính lại theo cấu hình hiện tại. Tình trạng Snapshot hiện tại như invalidated được nêu riêng. |
| RS-OUT-002-13 | UI và API chỉ trả dữ liệu trong phạm vi quyền Project; thông tin nhạy cảm được che/giới hạn theo quyền nhưng giữ dấu vết khác biệt an toàn. |
| RS-OUT-002-14 | Trong MVP, Summary và Detail cung cấp trên giao diện; export file, email/chat, webhook và CI integration ngoài phạm vi theo OUT-001. |

## 3. Scope and Boundaries

| Trong phạm vi OUT-002 | Thuộc yêu cầu liên quan |
| --- | --- |
| Summary, trạng thái chưa có Result và điều hướng vào Detail đúng cặp. | CMP-001/014/016 chốt Result, status/reason và persistence; CMP-003/004 chốt cặp/chuỗi. |
| Đối chiếu output A→B và chẩn đoán input mismatch tách riêng. | CMP-006/015 chốt input gate và Difference Detail; CMP-007/018 chốt phạm vi/định dạng output. |
| Trình bày latency/version riêng, Detail dài, lịch sử và quyền. | CMP-011/012/015/016, SNP và AUTH/SEC chốt dữ liệu nguồn, rule/policy và bảo vệ. |
| Báo cáo trên UI trong MVP. | OUT-001 loại trừ export, email/chat, webhook và CI integration. CMP-002 sở hữu đánh dấu Expected/Unexpected. |

## 4. Actor, Trigger, Preconditions and Postconditions

| Mục | Quy tắc |
| --- | --- |
| Actor | Người dùng có quyền Project; QC Tool UI/backend kiểm tra và trả dữ liệu. |
| Trigger | Người dùng mở danh sách/Summary, một kết quả Comparison, hoặc Detail của một cặp. |
| Preconditions | Phiên hợp lệ, quyền Project, định danh Comparison/cặp có thể truy xuất; dữ liệu Result/status lấy từ lần xử lý đã ghi. |
| Postcondition — hoàn tất | Summary hiển thị đúng SAME/DIFFERENT; Detail phản ánh output của cặp A→B và metadata riêng. |
| Postcondition — chưa hoàn tất | Hiển thị status/reason, không có badge Result hoặc output Detail giả. |
| Postcondition — trái quyền | Không lộ cặp, Environment, Snapshot, Result, reason hoặc payload ngoài quyền. |

## 5. Business Rules

| ID | Business rule |
| --- | --- |
| BR-OUT-002-01 | Badge SAME/DIFFERENT chỉ nhận từ Comparison đã hoàn tất theo CMP-001/016, không suy từ UI, output preview hoặc dữ liệu chưa so đủ. |
| BR-OUT-002-02 | Các trạng thái chưa có cặp, processing, ineligible, input mismatch và failed có Result rỗng; tên status/reason chính thức theo CMP-014/AnD. |
| BR-OUT-002-03 | Mỗi Summary/Detail giữ Snapshot ID A/B, chiều A→B, API/Project/Environment và thời điểm có ý nghĩa; không để người xem nhầm cặp. |
| BR-OUT-002-04 | SAME nghĩa input compatible và output so đầy đủ không có khác biệt thuộc phạm vi, không đồng nghĩa latency/API Version/DB Version đều bằng nhau. |
| BR-OUT-002-05 | DIFFERENT do output thuộc phạm vi; giao diện không suy ra nguyên nhân hay đánh giá thay đổi. Expected/Unexpected nếu có là đánh dấu riêng theo CMP-002. |
| BR-OUT-002-06 | Detail output của DIFFERENT phản ánh HTTP status, response headers/body và các mục khác biệt an toàn theo CMP-015; Detail SAME thể hiện không có output difference. |
| BR-OUT-002-07 | Input mismatch hiển thị như chẩn đoán input và bước dừng, không như output Difference Detail hoặc Result DIFFERENT. |
| BR-OUT-002-08 | Latency và version metadata nằm ở phần bối cảnh riêng; Version changed có thể đi cùng SAME hoặc DIFFERENT nhưng không đổi Result. |
| BR-OUT-002-09 | UI rút gọn/phân trang phải báo còn khác biệt/vùng chưa hiển thị và cung cấp cách xem tiếp theo quyền; không biến rút gọn thành mất dữ liệu. |
| BR-OUT-002-10 | So chuỗi có status/Result theo từng cặp; Detail được mở theo Comparison/cặp ID, không dựa vào vị trí dòng không ổn định. |
| BR-OUT-002-11 | Xem lịch sử dùng dữ liệu và rule/policy của lần so; invalidation hiện tại là thông tin bổ sung, không viết lại Result lịch sử. |
| BR-OUT-002-12 | Backend kiểm tra quyền trước khi trả dữ liệu; UI che/giới hạn secret phù hợp, không dựa vào ẩn nút để bảo vệ API. |
| BR-OUT-002-13 | Trong MVP không có thao tác export file, gửi email/chat, webhook hoặc CI integration trên Summary/Detail theo OUT-001. |

## 6. Main Flow

1. Người dùng có quyền mở danh sách hoặc Summary Comparison trong Project. Backend kiểm tra quyền rồi trả cặp, nguồn, status, Result nếu có và metadata bối cảnh.
2. UI hiển thị A baseline→B target, API/Project/Environment và thời điểm. Chỉ Comparison hoàn tất mới nhận badge SAME hoặc DIFFERENT.
3. Nếu Result SAME, UI giải thích không có output difference sau input compatible và so output đầy đủ; latency/version trình bày riêng.
4. Nếu Result DIFFERENT, UI cho mở Detail đúng cặp. Backend trả dữ liệu output Difference Detail theo CMP-015 trong phạm vi quyền; UI trình bày A→B và dấu vết rule/policy an toàn.
5. Nếu chưa thể kết luận, UI hiển thị status/reason hoặc chẩn đoán input mismatch, không tạo output Detail giả.
6. Với Detail dài hoặc chuỗi cặp, UI cho xem từng cặp/trang theo quyền và chỉ rõ còn nội dung chưa hiển thị; mở lại lịch sử giữ kết quả đã ghi.

## 7. Alternative and Exception Flows

| ID | Tình huống | Xử lý mong đợi |
| --- | --- | --- |
| ALT-01 | SAME nhưng latency A/B khác. | SAME và “không có output difference”; hiển thị latency riêng. |
| ALT-02 | SAME nhưng API/DB Version đổi. | SAME cùng Version changed và giá trị A→B riêng theo CMP-012. |
| ALT-03 | DIFFERENT và Version changed. | DIFFERENT do output; Version changed là bối cảnh, không tự ghi nguyên nhân. |
| ALT-04 | Input mismatch. | Chẩn đoán input và bước dừng; không có DIFFERENT/output Detail. |
| ALT-05 | Chưa có baseline hoặc target Snapshot. | Thể hiện availability trong ngữ cảnh Run/Execution, không dựng Comparison/SAME giả. |
| ALT-06 | Detail chứa nhiều mục hoặc file/binary lớn. | Báo còn nội dung, cho xem tiếp theo quyền; không ngụ ý đã xem toàn bộ. |
| ALT-07 | Chain nhiều cặp với status khác nhau. | Hiển thị từng cặp/status/Result, điều hướng Detail đúng cặp. |
| EXC-01 | Comparison failed sau khi phát hiện một phần khác biệt. | Status/reason failed, Result rỗng; không công bố DIFFERENT/Detail hoàn chỉnh. |
| EXC-02 | Snapshot invalidated sau khi Comparison hoàn tất. | Result lịch sử giữ nguyên; nêu trạng thái Snapshot hiện tại riêng. |
| EXC-03 | Người dùng mất quyền Project khi đang mở Detail. | API từ chối dữ liệu tiếp theo, UI không hiển thị nội dung vượt quyền. |

## 8. Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-OUT-002-01 | Cặp hợp lệ, input compatible, output giống và so đầy đủ. | Mở Summary. | Hiển thị SAME và cặp A→B đúng; giải thích không có output difference thuộc phạm vi. |
| AC-OUT-002-02 | Cặp hợp lệ, input compatible, output khác và so đầy đủ. | Mở Summary rồi Detail. | Hiển thị DIFFERENT; Detail đối chiếu output của đúng A→B. |
| AC-OUT-002-03 | Comparison đang xử lý. | Mở Summary. | Hiển thị trạng thái xử lý, không có SAME/DIFFERENT tạm thời. |
| AC-OUT-002-04 | Run đầu chưa có baseline. | Xem Run/Comparison context. | Hiển thị chưa có mốc để so, không có Comparison hoặc SAME giả. |
| AC-OUT-002-05 | Cặp không đủ điều kiện hoặc Comparison failed. | Mở Summary. | Hiển thị status/reason theo CMP-014, Result rỗng. |
| AC-OUT-002-06 | Actual input mismatch. | Mở kết quả. | Thấy bước dừng/chẩn đoán input, không có output Detail hay DIFFERENT. |
| AC-OUT-002-07 | DIFFERENT ở HTTP status, response header và body. | Mở Detail. | Thấy từng phần output A→B với vị trí/biểu diễn an toàn và rule liên quan khi có. |
| AC-OUT-002-08 | SAME; latency và API Version metadata khác. | Mở Detail. | Không có output difference; metadata A/B, Δ và Version changed được hiển thị riêng theo CMP-011/012. |
| AC-OUT-002-09 | Detail chứa nhiều mục hơn phần hiển thị đầu. | Mở trang đầu. | UI báo còn mục/vùng và cung cấp cách xem tiếp theo quyền. |
| AC-OUT-002-10 | Detail có file/binary hoặc secret. | Xem Detail. | Có biểu diễn an toàn theo CMP-015/018 và quyền; không lộ nội dung vượt quyền. |
| AC-OUT-002-11 | Chain A→B→C có một cặp SAME, một cặp khác không hoàn tất. | Xem Summary và Detail. | Mỗi cặp có status/Result riêng; Detail mở đúng cặp, không có Result chuỗi tổng hợp. |
| AC-OUT-002-12 | Rule/policy hiện tại thay đổi sau Comparison hoàn tất. | Mở lại lịch sử. | Result/Detail/rule của lần so đã ghi không bị tính lại ngầm. |
| AC-OUT-002-13 | Snapshot bị invalidated sau Comparison hoàn tất. | Mở Summary/Detail lịch sử. | Result lịch sử giữ nguyên, trạng thái Snapshot hiện tại được nêu riêng. |
| AC-OUT-002-14 | Người dùng không có quyền Project. | Yêu cầu Summary/Detail qua UI hoặc API. | Không trả cặp, Result, reason hay payload ngoài quyền. |
| AC-OUT-002-15 | Người dùng đang ở màn hình Summary/Detail MVP. | Kiểm tra các thao tác kết quả. | Có xem trên UI; không có export/email/chat/webhook/CI integration thuộc OUT-001. |

## 9. Clarification and Decision Log

| ID | Quyết định đã thống nhất | Trạng thái |
| --- | --- | --- |
| CL-OUT-002-01 | Chỉ Comparison hoàn tất mới hiển thị SAME/DIFFERENT. | BA Approved |
| CL-OUT-002-02 | Chưa có cặp/processing/ineligible/input mismatch/failed hiển thị status/reason, không Result giả. | BA Approved |
| CL-OUT-002-03 | Hiển thị cặp A→B, API, Project, Environment và thời điểm. | BA Approved |
| CL-OUT-002-04 | SAME là input compatible và output so đủ không khác, không tuyên bố mọi metadata bằng nhau. | BA Approved |
| CL-OUT-002-05 | DIFFERENT cho mở đúng Detail, không tự kết luận lỗi/nguyên nhân. | BA Approved |
| CL-OUT-002-06 | Detail DIFFERENT đối chiếu HTTP status, response headers/body A→B an toàn. | BA Approved |
| CL-OUT-002-07 | Detail SAME không có output difference, vẫn có bối cảnh/input compatible/metadata riêng. | BA Approved |
| CL-OUT-002-08 | Input mismatch là chẩn đoán input và bước dừng, không output Detail/DIFFERENT. | BA Approved |
| CL-OUT-002-09 | Latency/version trình bày riêng, Version changed không thay Result. | BA Approved |
| CL-OUT-002-10 | Detail dài/file/binary phân trang/rút gọn phải báo còn nội dung và xem tiếp theo quyền. | BA Approved |
| CL-OUT-002-11 | Chain hiển thị status/Result từng cặp, mở Detail đúng cặp, không Result tổng hợp. | BA Approved |
| CL-OUT-002-12 | Lịch sử dùng Result/Detail/rule đã ghi, invalidation hiện tại nêu riêng. | BA Approved |
| CL-OUT-002-13 | UI/API theo quyền Project, che/giới hạn dữ liệu nhạy cảm an toàn. | BA Approved |
| CL-OUT-002-14 | MVP chỉ xem trên UI; export/email/chat/webhook/CI ngoài phạm vi OUT-001. | BA Approved |

## 10. Dependencies and Handoff

| Reference | Ownership / handoff |
| --- | --- |
| CMP-001/006/014/016 | Result, input compatibility, status/reason và dữ liệu lịch sử. |
| CMP-003/004/015/017/018 | Cặp/chuỗi, output Difference Detail, raw/file/binary và giới hạn hiển thị. |
| CMP-011/012; CMP-002 | Latency/version metadata riêng; Expected/Unexpected là đánh dấu sau DIFFERENT theo requirement riêng. |
| OUT-001 | Phạm vi báo cáo trên UI của MVP, không export/gửi/tích hợp CI. |
| SNP; AUTH/SEC; AnD UI/API | Snapshot/history, quyền Project/redaction và contract Summary/Detail theo các trạng thái đã chốt. |
