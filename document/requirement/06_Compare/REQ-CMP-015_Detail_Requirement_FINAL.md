# REQ-CMP-015 — Difference Detail

**QC Tool · Group 6 Comparison Engine · BA FINAL · Priority: Must (BA Proposed)**  
**Trạng thái phân tích:** Clarification completed — BA Approved (14/14). Requirement bổ sung ở mức BA Proposed, chờ Client Confirmation trước khi coi là baseline khách hàng.

## 1. Requirement Information and Proposed Statement

> **Requirement bổ sung ở mức BA Proposed:** “Với một Comparison hợp lệ đã hoàn tất, hệ thống phải cung cấp chi tiết các khác biệt thuộc phạm vi so giữa hai Snapshot theo chiều baseline → target, đồng thời phân biệt output difference với input mismatch và bảo vệ dữ liệu nhạy cảm.”

| Thuộc tính | Nội dung |
| --- | --- |
| Requirement ID | REQ-CMP-015 |
| Tên | Difference Detail |
| Nguồn | BA Proposed để làm rõ cách đọc và truy vết kết quả Comparison |
| Loại / ưu tiên đề xuất | Functional / Must |
| Actor chính | QC Tool System |
| Actor liên quan | Người dùng có quyền xem Comparison trong Project |
| Phụ thuộc | CMP-001/004/005/006/007/008/009/010/011/012/014/016/017/018; OUT-002; AUTH/SEC |

## 2. Business Objective and Requirement Statements

Nhãn DIFFERENT cho biết có thay đổi thuộc phạm vi so, nhưng người dùng còn cần biết thay đổi nằm ở đâu và hai phía A→B khác như thế nào. Detail phải phản ánh đúng quy tắc **input trước, output sau** và so raw strict, kể cả khác biệt chỉ ở biểu diễn. Phần trình bày cần hỗ trợ định vị mà không làm mất khác biệt, không che giấu việc kết quả chưa đầy đủ và không tiết lộ dữ liệu ngoài quyền.

| ID | Requirement statement |
| --- | --- |
| RS-CMP-015-01 | Difference Detail phải gắn với một cặp Snapshot cụ thể A→B, trong đó A là baseline và B là target; người xem nhận biết được hai Snapshot và chiều đối chiếu. |
| RS-CMP-015-02 | Khi Comparison hoàn tất với Result DIFFERENT, Detail phải chỉ ra các thành phần actual output khác nhau thuộc phạm vi so; không chỉ hiển thị nhãn DIFFERENT. |
| RS-CMP-015-03 | Khi Result SAME, Detail phải thể hiện không có output difference thuộc phạm vi so; latency và version metadata nếu khác được trình bày riêng theo CMP-011/012. |
| RS-CMP-015-04 | Input mismatch phải được trình bày là kết quả của bước kiểm tra input, kèm bước dừng và phần không tương thích trong phạm vi quyền; không biến thành output difference hoặc Result DIFFERENT. |
| RS-CMP-015-05 | Mỗi output difference cần nêu thành phần (`HTTP status`, response header hoặc body), vị trí nếu xác định được, biểu diễn/giá trị A→B an toàn và quy tắc so liên quan. |
| RS-CMP-015-06 | Với JSON, path chỉ giúp định vị. Detail phải giải thích được khác biệt raw ở thứ tự key, whitespace, escape hoặc biểu diễn số dù nội dung parse ra có vẻ tương đương. |
| RS-CMP-015-07 | Với array, Detail phải giữ vị trí phần tử và thứ tự; với missing, null, empty string, empty array và khác kiểu, hai phía phải được biểu diễn phân biệt theo CMP-008/009/010. |
| RS-CMP-015-08 | Với response header, Detail tuân theo CMP-007: tên header không phân biệt hoa/thường, giá trị so strict; không tạo difference chỉ vì case của tên header. |
| RS-CMP-015-09 | Với text/raw hoặc binary/file không có path JSON phù hợp, Detail dùng vị trí byte hoặc vùng khác biệt có thể xác định và cách biểu diễn an toàn; không suy ra khác biệt chỉ từ filename, length hoặc hash thiếu nội dung xác thực. |
| RS-CMP-015-10 | Nếu giao diện phân trang hoặc rút gọn, hệ thống phải cho biết còn phần chưa hiển thị và có cách xem tiếp theo quyền; không âm thầm bỏ bớt khác biệt khiến người dùng nghĩ đã xem toàn bộ. |
| RS-CMP-015-11 | Giá trị chứa token, credential, secret hoặc dữ liệu bị hạn chế phải được che/giới hạn theo quyền; việc che trên giao diện không làm mất dấu vết rằng có khác biệt thuộc phạm vi so. |
| RS-CMP-015-12 | Detail phải gắn với dữ liệu Snapshot và rule/policy áp dụng tại lần Comparison, không tính lại bằng cấu hình hiện tại khi mở lịch sử và thay đổi kết luận đã ghi. |
| RS-CMP-015-13 | Detail mô tả khác biệt ở đâu và A→B như thế nào, không tự kết luận nguyên nhân, đúng/sai hoặc Expected/Unexpected. |
| RS-CMP-015-14 | Nếu cặp không đủ điều kiện hoặc Comparison chưa hoàn tất, hệ thống không tạo Difference Detail như thể đã có Result; hiển thị trạng thái/reason theo CMP-014. |

## 3. Scope and Boundaries

| Trong phạm vi CMP-015 | Thuộc yêu cầu liên quan |
| --- | --- |
| Cấu trúc nghiệp vụ và hiển thị khác biệt A→B của actual output sau phép so hoàn tất. | CMP-001 quyết định Result; CMP-007/008/009/010/017/018 quyết định dữ liệu và quy tắc so. |
| Chẩn đoán input mismatch tách khỏi output difference; hiển thị lý do không có Detail khi phép so chưa hoàn tất. | CMP-006 sở hữu input compatibility; CMP-014 sở hữu trạng thái/reason dừng. |
| Định vị khác biệt, biểu diễn raw an toàn, bảo toàn tính đầy đủ khi phân trang/rút gọn và truy vết rule/policy. | CMP-016 sở hữu cấu trúc lưu và dấu vết lần so; OUT-002 sở hữu màn hình Summary/Detail; AUTH/SEC sở hữu quyền/che dữ liệu. |
| Trình bày latency/version metadata tách riêng. | CMP-011/012 sở hữu ý nghĩa latency và Version changed. |

## 4. Actor, Trigger, Preconditions and Postconditions

| Mục | Quy tắc |
| --- | --- |
| Actor | QC Tool System tạo/lấy Detail; người dùng có quyền Project mở Comparison Detail. |
| Trigger | Comparison hoàn tất hoặc người dùng mở Detail/trạng thái của một cặp A→B. |
| Preconditions — output Detail | Cặp đạt CMP-005, input compatible theo CMP-006, actual output đã so đầy đủ và có Result SAME/DIFFERENT. |
| Postcondition — DIFFERENT | Các output difference thuộc phạm vi so có thể được truy cập đầy đủ theo quyền, gắn đúng cặp/chiều và rule/policy. |
| Postcondition — SAME | Không có output difference thuộc phạm vi; metadata latency/version hiển thị ở khu vực riêng khi có dữ liệu. |
| Postcondition — không có Result | Input mismatch hoặc Comparison không hoàn tất: thể hiện chẩn đoán/trạng thái tương ứng, không trình bày output Difference Detail giả. |

## 5. Business Rules

| ID | Business rule |
| --- | --- |
| BR-CMP-015-01 | Mọi Difference Detail tham chiếu đúng Comparison, baseline Snapshot A, target Snapshot B và chiều A→B; đảo chiều hiển thị phải là một phép đối chiếu có ngữ cảnh riêng, không tự đổi nghĩa dữ liệu đã ghi. |
| BR-CMP-015-02 | DIFFERENT đòi hỏi ít nhất một output difference thuộc phạm vi sau khi so đầy đủ; SAME có tập output difference rỗng. |
| BR-CMP-015-03 | Input mismatch là chẩn đoán gate input, Result rỗng và không có output Difference Detail; cần thể hiện thành phần input khác trong phạm vi quyền mà không gọi là DIFFERENT. |
| BR-CMP-015-04 | Một mục khác biệt cần có loại thành phần, vị trí nếu có, trạng thái/giá trị hoặc biểu diễn A→B an toàn, và rule/policy liên quan; nếu path logic không đủ để giải thích raw difference, bổ sung vị trí/vùng raw. |
| BR-CMP-015-05 | JSON path không được dùng để chuẩn hóa lại dữ liệu. Khác thứ tự key, whitespace, escape hoặc lexeme số theo CMP-007/010 vẫn phải được nhận biết và giải thích bằng raw span/vị trí phù hợp. |
| BR-CMP-015-06 | Array dùng index theo vị trí A/B; missing, null, empty và type khác phải có nhãn phân biệt, không biến một trạng thái thành trạng thái khác. |
| BR-CMP-015-07 | Header name case-insensitive theo CMP-007; Detail không tạo mục khác biệt cho `Content-Type` so với `content-type` nếu giá trị tương ứng giống nhau. Giá trị header vẫn so strict. |
| BR-CMP-015-08 | Text/raw và binary/file dùng vị trí byte/vùng khác biệt xác định được khi không có path JSON; file name, size hoặc hash thiếu chứng thực nội dung không thay thế phép so nội dung đầy đủ theo CMP-018. |
| BR-CMP-015-09 | Rút gọn/phân trang là cách trình bày, không làm thay đổi Result hoặc số lượng/phạm vi khác biệt thực tế; giao diện báo còn nội dung và cung cấp đường xem tiếp theo quyền. |
| BR-CMP-015-10 | Redaction ở tầng xem phải không tiết lộ secret; vẫn thể hiện sự tồn tại và vị trí/loại khác biệt ở mức an toàn nếu người xem có quyền xem Comparison. Chi tiết ngoài quyền không được trả về. |
| BR-CMP-015-11 | Detail lịch sử dùng Snapshot và rule/policy của lần so đã ghi. Việc hiển thị lại không âm thầm chạy lại theo cấu hình hiện tại hoặc làm đổi Result. |
| BR-CMP-015-12 | Latency và version metadata không được đưa vào danh sách output difference chỉ vì giá trị metadata khác; actual response timing/version field vẫn thuộc output theo CMP-011/012. |
| BR-CMP-015-13 | Detail không suy luận nguyên nhân, đánh giá release hoặc tự gắn Expected/Unexpected; các thao tác đánh giá thuộc yêu cầu riêng. |
| BR-CMP-015-14 | Khi phép so chưa hoàn tất, phần đã phát hiện tạm thời không được công bố như Difference Detail hoàn chỉnh hoặc dùng để kết luận DIFFERENT. |

## 6. Main Flow

1. Hệ thống kiểm tra quyền, xác định Comparison và cặp Snapshot A→B cùng trạng thái xử lý.
2. Nếu cặp không đủ điều kiện, input mismatch hoặc phép so chưa hoàn tất, hiển thị đúng gate/trạng thái/reason theo CMP-006/014; không dựng output Difference Detail giả.
3. Nếu Result SAME, hiển thị không có output difference thuộc phạm vi. Latency, API Version và Database Version được hiển thị riêng khi có dữ liệu.
4. Nếu Result DIFFERENT, lấy các output difference đã ghi theo dữ liệu Snapshot và rule/policy của lần so; tổ chức theo HTTP status, response headers và body.
5. Với mỗi mục, trình bày vị trí/path hoặc raw span phù hợp, biểu diễn A→B an toàn và quy tắc liên quan. Giữ thứ tự/index array và các phân biệt missing/null/empty/type.
6. Nếu nội dung được phân trang/rút gọn, chỉ rõ còn phần chưa hiển thị và cho phép xem tiếp theo quyền, không thay Result hoặc dữ liệu lịch sử.

## 7. Alternative and Exception Flows

| ID | Tình huống | Xử lý mong đợi |
| --- | --- | --- |
| ALT-01 | Output SAME; chỉ latency metadata khác. | Detail nêu không có output difference; latency hiển thị riêng, Result SAME. |
| ALT-02 | Output SAME; chỉ API/DB Version metadata khác. | Không tạo output difference; Version changed hiển thị riêng theo CMP-012. |
| ALT-03 | JSON chỉ khác thứ tự key hoặc khoảng trắng. | DIFFERENT theo raw strict; Detail định vị vùng raw khác dù các path/value parse ra tương đương. |
| ALT-04 | JSON số `1` so với `1.0`, hoặc escape khác. | Giữ biểu diễn raw A→B và rule tương ứng; không chuẩn hóa trước khi trình bày. |
| ALT-05 | Array đổi thứ tự phần tử. | Thể hiện index/vị trí liên quan, không gom hai phía thành cùng tập. |
| ALT-06 | Header name chỉ khác case, value giống. | Không tạo header difference từ tên; value khác vẫn tạo difference. |
| ALT-07 | Body text/raw hoặc binary/file không có JSON path. | Dùng byte offset/vùng khác biệt và biểu diễn an toàn theo định dạng; tuân CMP-017/018. |
| ALT-08 | Có nhiều khác biệt, giao diện chỉ tải trang đầu. | Thể hiện còn mục/vùng chưa hiển thị và cho xem tiếp theo quyền; không gắn nhãn “đã xem hết”. |
| ALT-09 | Một giá trị khác biệt là token/secret. | Che hoặc giới hạn giá trị theo quyền nhưng giữ dấu vết khác biệt an toàn. |
| EXC-01 | Input mismatch. | Chẩn đoán input riêng, dừng trước output, Result rỗng; không có output Difference Detail. |
| EXC-02 | Engine dừng sau khi phát hiện một phần output khác biệt. | Result rỗng và reason theo CMP-014; không xuất bản Detail như phép so đã hoàn tất. |
| EXC-03 | Cặp không đủ điều kiện hoặc dữ liệu cần so thiếu. | Chỉ trạng thái/reason phù hợp, không tạo Difference Detail giả. |

## 8. Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-CMP-015-01 | Comparison A→B hoàn tất với DIFFERENT ở HTTP status. | Mở Detail. | Thấy đúng Snapshot A/B, chiều A→B, HTTP status A và B, quy tắc so. |
| AC-CMP-015-02 | Input compatible; output khác ở response header và body, phép so hoàn tất. | Mở Detail. | Thấy từng thành phần khác, vị trí nếu xác định được và biểu diễn A→B an toàn; không chỉ nhãn DIFFERENT. |
| AC-CMP-015-03 | Comparison hoàn tất với SAME; latency và version metadata khác. | Mở Detail. | Không có output difference; latency/version trình bày riêng, Result vẫn SAME. |
| AC-CMP-015-04 | Actual input mismatch. | Mở trạng thái/Detail. | Thấy bước input và chẩn đoán không tương thích theo quyền; không có Result DIFFERENT hoặc output Difference Detail. |
| AC-CMP-015-05 | JSON output chỉ khác thứ tự key, input compatible và so hoàn tất. | Mở Detail. | DIFFERENT được giải thích bằng vùng/vị trí raw phù hợp; không bị báo giống vì JSON parse tương đương. |
| AC-CMP-015-06 | JSON output chỉ khác whitespace hoặc escape raw. | Mở Detail. | Thấy khác biệt biểu diễn raw A→B an toàn; không chuẩn hóa mất dấu vết. |
| AC-CMP-015-07 | Output number `1` so với `1.0`. | Mở Detail. | Biểu diễn đúng hai lexeme raw, loại dữ liệu và rule strict; không làm tròn thành cùng giá trị. |
| AC-CMP-015-08 | Array output có hai phần tử đổi thứ tự. | Mở Detail. | Thấy index/vị trí của A và B; Result DIFFERENT theo CMP-008. |
| AC-CMP-015-09 | Một phía missing, phía kia null hoặc empty string/array. | Mở Detail. | Thấy trạng thái hai phía phân biệt theo CMP-009, không hiển thị thay thế lẫn nhau. |
| AC-CMP-015-10 | Header `Content-Type` ở A và `content-type` ở B có cùng value. | Mở Detail. | Không có mục khác biệt chỉ vì case của tên header. |
| AC-CMP-015-11 | Header name tương ứng, value khác. | Mở Detail. | Có mục header difference với value A→B an toàn. |
| AC-CMP-015-12 | Body raw/binary khác và không có JSON path phù hợp. | Mở Detail. | Có vị trí byte/vùng khác biệt có thể xác định; không chỉ dựa filename, length hoặc hash thiếu xác thực. |
| AC-CMP-015-13 | Có nhiều khác biệt hơn số mục đang hiện trên một trang. | Xem trang đầu. | Giao diện cho biết còn nội dung và có cách xem tiếp theo quyền, không ngụ ý đã hiển thị toàn bộ. |
| AC-CMP-015-14 | Mục khác biệt có credential/secret. | Người dùng xem Detail. | Giá trị được che/giới hạn theo quyền, nhưng dấu vết có khác biệt được thể hiện an toàn. |
| AC-CMP-015-15 | Rule/policy hiện tại thay đổi sau khi Comparison A→B hoàn tất. | Mở lại Detail lịch sử. | Result và Detail của lần so đã ghi không bị tính lại/đổi ngầm theo cấu hình hiện tại. |
| AC-CMP-015-16 | Engine lỗi giữa lúc so output dù đã phát hiện một phần khác biệt. | Mở Comparison. | Không có Result hoặc Difference Detail hoàn chỉnh; hiển thị reason theo CMP-014. |
| AC-CMP-015-17 | Người dùng không có quyền Project. | Truy cập Difference Detail. | Không nhận dữ liệu Snapshot, output hoặc secret ngoài quyền. |

## 9. Clarification and Decision Log

| ID | Quyết định đã thống nhất | Trạng thái |
| --- | --- | --- |
| CL-CMP-015-01 | Detail gắn đúng cặp A baseline → B target. | BA Approved |
| CL-CMP-015-02 | DIFFERENT hoàn tất phải nêu output difference thuộc phạm vi, không chỉ nhãn. | BA Approved |
| CL-CMP-015-03 | SAME không có output difference; latency/version metadata riêng. | BA Approved |
| CL-CMP-015-04 | Input mismatch là chẩn đoán gate input, không phải output difference/DIFFERENT. | BA Approved |
| CL-CMP-015-05 | Mỗi khác biệt có thành phần, vị trí nếu có, A→B an toàn và rule. | BA Approved |
| CL-CMP-015-06 | JSON path chỉ hỗ trợ định vị; raw order/whitespace/escape/number khác vẫn giải thích được. | BA Approved |
| CL-CMP-015-07 | Array giữ index/order; missing/null/empty/type phân biệt. | BA Approved |
| CL-CMP-015-08 | Header name case-insensitive, value strict, theo CMP-007. | BA Approved |
| CL-CMP-015-09 | Text/raw/binary dùng byte/vùng khác khi cần; không chỉ dựa metadata file/hash thiếu nội dung xác thực. | BA Approved |
| CL-CMP-015-10 | Rút gọn/phân trang phải báo còn khác biệt và có cách xem tiếp theo quyền. | BA Approved |
| CL-CMP-015-11 | Che/giới hạn secret theo quyền nhưng không làm mất dấu vết khác biệt. | BA Approved |
| CL-CMP-015-12 | Detail lịch sử gắn Snapshot và rule/policy lần so, không đổi ngầm theo cấu hình hiện tại. | BA Approved |
| CL-CMP-015-13 | Detail mô tả ở đâu/A→B ra sao, không kết luận nguyên nhân, đúng/sai, Expected/Unexpected. | BA Approved |
| CL-CMP-015-14 | Không tạo Difference Detail giả khi cặp không đủ điều kiện hoặc phép so chưa hoàn tất. | BA Approved |

## 10. Dependencies and Handoff

| Reference | Ownership / handoff |
| --- | --- |
| CMP-001/005/006/014 | Điều kiện cặp, input trước output, Result và lý do không thể kết luận. |
| CMP-007/008/009/010/017/018 | Raw strict, header/body, array, missing/null/empty, kiểu, format và binary/file. |
| CMP-011/012 | Latency và API/DB Version metadata hiển thị riêng; field tương ứng nằm trong actual response vẫn thuộc output. |
| CMP-016 và OUT-002 | Cấu trúc lưu/truy xuất difference, rule/policy lịch sử, phân trang và giao diện Comparison Summary/Detail. |
| AUTH/SEC | Quyền Project, redaction và không tiết lộ secret ngoài phạm vi được phép. |
