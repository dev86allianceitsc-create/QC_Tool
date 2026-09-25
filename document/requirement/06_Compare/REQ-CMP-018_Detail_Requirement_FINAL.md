# REQ-CMP-018 — So sánh file, binary và multipart

**QC Tool · Group 6 Comparison Engine · BA FINAL · Priority: Must (BA Proposed)**  
**Trạng thái phân tích:** Clarification completed — BA Approved (15/15). Requirement bổ sung ở mức BA Proposed, chờ Client Confirmation trước khi coi là baseline khách hàng.

## 1. Requirement Information and Proposed Statement

> **Requirement bổ sung ở mức BA Proposed:** “Khi actual request hoặc response chứa file, binary hay multipart thuộc định dạng được hỗ trợ, hệ thống phải bảo toàn và so đầy đủ bytes/cấu trúc raw tại cùng ranh giới xử lý; dữ liệu thiếu hoặc không hỗ trợ không được suy thành SAME/DIFFERENT.”

| Thuộc tính | Nội dung |
| --- | --- |
| Requirement ID | REQ-CMP-018 |
| Tên | So sánh file, binary và multipart |
| Nguồn | BA Proposed để cụ thể hóa raw strict cho payload không phải text/JSON thông thường |
| Loại / ưu tiên đề xuất | Functional / Must |
| Actor chính | QC Tool System |
| Actor liên quan | Người dùng có quyền yêu cầu hoặc xem Comparison trong Project |
| Phụ thuộc | CMP-001/005/006/007/009/014/015/016/017; RUN, SNP-003/004, AUTH/SEC |

## 2. Business Objective and Requirement Statements

Một API có thể nhận file trong **actual request (input)** hoặc trả file trong **actual response (output)**. Ví dụ request upload ảnh/PDF chứa bytes của file, hoặc body `application/octet-stream` chứa bytes trực tiếp. Filename, kích thước hay bản preview không đủ để chứng minh nội dung bằng nhau. Engine cần so đầy đủ biểu diễn raw đã lưu, tuân gate input trước output. Với multipart, boundary và thứ tự part có thể thay đổi dù file nghiệp vụ giống nhau; theo raw strict đã chốt, những bytes đó vẫn thuộc phạm vi nếu chưa có policy ngoại lệ được duyệt.

| ID | Requirement statement |
| --- | --- |
| RS-CMP-018-01 | Với file/binary được hỗ trợ, engine phải so toàn bộ actual bytes đã lưu ở cùng ranh giới xử lý A/B; không kết luận từ filename, size, preview hoặc hash thiếu chứng thực nội dung. |
| RS-CMP-018-02 | Quy tắc áp dụng cho cả dữ liệu file/binary trong actual request (input) và actual response (output). Input khác tạo input mismatch, dừng trước output; output khác chỉ tạo DIFFERENT sau input compatible và so output đầy đủ. |
| RS-CMP-018-03 | Body/file absent khác body/file tồn tại với 0 byte. Thiếu bytes do lưu lỗi là dữ liệu không đủ để so, không phải một giá trị payload. |
| RS-CMP-018-04 | Với payload lớn, hệ thống có thể so theo từng phần để không tải toàn bộ vào bộ nhớ, nhưng phải kiểm tra đến hết nội dung của cả hai phía trước khi tạo SAME/DIFFERENT; cách chia phần thuộc AnD. |
| RS-CMP-018-05 | Nếu bytes thiếu, truncate, hỏng hoặc không đọc hết, Result rỗng với reason theo CMP-014; khác biệt tìm được trước khi lỗi không được công bố là DIFFERENT hoàn chỉnh. |
| RS-CMP-018-06 | Với multipart được hỗ trợ, Snapshot phải giữ đủ raw body và metadata/header cần thiết để tái hiện dữ liệu so; không chỉ lưu tên part hoặc danh sách file. |
| RS-CMP-018-07 | Mặc định multipart raw strict: thứ tự part, boundary, header của part và bytes nội dung đều thuộc biểu diễn raw; không âm thầm bỏ boundary hoặc sắp xếp lại part để tạo input compatible/SAME. |
| RS-CMP-018-08 | Boundary client tự sinh có thể làm request multipart khác mỗi Run. Bỏ qua boundary hoặc so theo cấu trúc part chỉ được áp dụng qua policy loại trừ/chuyển đổi riêng đã duyệt, có dấu vết và áp dụng nhất quán; CMP-018 không tự đặt ngoại lệ. |
| RS-CMP-018-09 | Filename, `Content-Type`, `Content-Disposition` và metadata trong actual multipart/header được so theo phạm vi raw đã chốt, trừ policy loại trừ cụ thể. Metadata QC Tool tự ghi để quản lý Snapshot không tự thành payload. |
| RS-CMP-018-10 | Nếu format file/multipart hoặc encoding không được hỗ trợ và không thể áp dụng quy tắc so đầy đủ, ghi unsupported format với Result rỗng, không coi là DIFFERENT. |
| RS-CMP-018-11 | Difference Detail cho file/binary cần nêu part nếu xác định được, vị trí byte/vùng A→B và loại khác biệt; không bắt buộc hiển thị cả file như text hoặc dựng JSON path giả. |
| RS-CMP-018-12 | Preview, download hoặc hex excerpt phải theo quyền và bảo vệ dữ liệu nhạy cảm; khi UI rút gọn, vẫn báo còn Detail chưa hiển thị theo CMP-015. |
| RS-CMP-018-13 | Result lịch sử gắn đúng Snapshot bytes và rule/policy của lần so; thay file nguồn, cấu hình API hoặc cách hiển thị về sau không âm thầm sửa Result hoàn tất. |
| RS-CMP-018-14 | File/binary trong request hoặc response có thể chứa secret; backend phải kiểm tra quyền Project khi truy xuất nội dung, Detail và tải file, không chỉ ẩn thao tác UI. |
| RS-CMP-018-15 | MIME type và extension hỗ trợ nhận diện/hiển thị và kiểm tra khả năng xử lý, không chứng minh nội dung bằng nhau; bytes khác thuộc phạm vi được xử lý theo gate tương ứng. |

## 3. Scope and Boundaries

| Trong phạm vi CMP-018 | Thuộc yêu cầu liên quan |
| --- | --- |
| So đầy đủ raw bytes file/binary, bảo toàn multipart, xử lý absent/zero-byte và payload lớn. | SNP-003/004 và CMP-017 chốt lưu payload đầy đủ, biểu diễn và cùng ranh giới bytes; AnD chọn lưu trữ/streaming cụ thể. |
| Giữ nguyên ranh giới gate input/output và raw strict cho multipart, kể cả boundary. | CMP-001/005/006/007 chốt điều kiện cặp, input compatibility, output và Result. |
| Dừng khi bytes không đủ hoặc format không hỗ trợ; Detail an toàn. | CMP-014/015/016 chốt status/reason, Difference Detail và lịch sử rule/policy. |
| Truy xuất payload file theo quyền. | AUTH/SEC quyết định quyền Project, bảo vệ secret, giới hạn preview/download. |

## 4. Actor, Trigger, Preconditions and Postconditions

| Mục | Quy tắc |
| --- | --- |
| Actor | QC Tool System lưu/so/trình bày; người dùng có quyền Project xem Comparison hoặc file theo quyền. |
| Trigger | Gate so actual request hoặc response gặp file, body binary hay multipart. |
| Preconditions | Cặp Snapshot đạt CMP-005; raw bytes và ranh giới biểu diễn của cả hai phía đầy đủ, đọc được và format được hỗ trợ; output chỉ xét sau input compatible. |
| Postcondition — input mismatch | File/binary/multipart trong actual request khác thuộc phạm vi: dừng trước output, Result rỗng. |
| Postcondition — output difference | Input compatible và toàn bộ output so xong; output bytes/header thuộc phạm vi khác: DIFFERENT. |
| Postcondition — không thể so | Thiếu/hỏng/truncate, lỗi đọc hoặc format không hỗ trợ: status/reason phù hợp, Result rỗng. |

## 5. Business Rules

| ID | Business rule |
| --- | --- |
| BR-CMP-018-01 | So bytes actual đã lưu của A/B ở cùng representation boundary theo CMP-017. Filename, size, extension, preview hoặc hash thiếu chứng thực nội dung không thay thế đối chiếu nội dung đầy đủ. |
| BR-CMP-018-02 | Dữ liệu file/binary trong actual request là input. Khác ở đó là input mismatch, không phải output DIFFERENT; chỉ sau input compatible mới xét response output. |
| BR-CMP-018-03 | Absent, zero-byte và bytes thất lạc do lỗi lưu là ba trạng thái khác nhau theo CMP-009/014. |
| BR-CMP-018-04 | Phép so theo chunk được phép nếu kết quả tương đương so toàn bộ bytes và xác nhận đọc/kiểm tra hoàn tất cả hai phía; phát hiện khác biệt sớm không cho phép công bố Result trước khi tính đầy đủ được xác nhận. |
| BR-CMP-018-05 | Multipart raw body, thứ tự part, boundary, per-part headers và content bytes thuộc phạm vi raw strict mặc định; parser chỉ giúp định vị Detail, không âm thầm chuẩn hóa. |
| BR-CMP-018-06 | Nếu boundary được tạo khác mỗi Run, input multipart có thể mismatch dù file nghiệp vụ giống. Chỉ policy ngoại lệ được phê duyệt, version hóa và ghi dấu vết mới thay quy tắc mặc định. |
| BR-CMP-018-07 | Filename, `Content-Type`, `Content-Disposition` trong actual payload/header vẫn được xét theo raw scope; metadata do QC Tool tự thêm để quản lý Snapshot không tham gia so input/output. |
| BR-CMP-018-08 | Unsupported format/encoding, bytes thiếu/hỏng/truncate hoặc không đọc hết làm Result rỗng theo CMP-014, không chuyển thành DIFFERENT. |
| BR-CMP-018-09 | Detail định vị theo part và byte offset/vùng raw khi xác định được, thể hiện A→B an toàn; không bịa JSON path hoặc phát tán toàn bộ binary lên UI. |
| BR-CMP-018-10 | Rút gọn/phân trang Detail không làm mất dấu vết khác biệt hoặc tạo cảm giác đã xem toàn bộ; preview/download kiểm soát quyền backend và bảo vệ secret. |
| BR-CMP-018-11 | Result hoàn tất và Detail lịch sử dựa Snapshot bytes và rule/policy của lần so; dữ liệu nguồn hoặc cấu hình hiện tại không viết lại lịch sử. |
| BR-CMP-018-12 | MIME type/extension dùng để phân loại khả năng hỗ trợ và cách trình bày, không chứng minh SAME. Header/content bytes vẫn được so theo phạm vi đã chốt. |

## 6. Main Flow

1. Hệ thống kiểm tra quyền và cặp Snapshot theo CMP-005, rồi đọc actual input đã lưu cùng representation boundary theo CMP-017.
2. Nếu input có file/binary/multipart được hỗ trợ, hệ thống xác nhận bytes/cấu trúc đầy đủ và so raw đến hết hai phía; khác thuộc phạm vi thì ghi input mismatch và dừng trước output.
3. Nếu input compatible, hệ thống đọc HTTP status, response headers và body/file của actual output; kiểm tra dữ liệu đầy đủ và format được hỗ trợ.
4. Hệ thống so toàn bộ output thuộc phạm vi, có thể đọc theo chunk nhưng chỉ kết luận sau khi xác nhận phép so đầy đủ.
5. CMP-001 tạo SAME khi không khác, DIFFERENT khi output khác. CMP-015 trình bày part/byte span A→B an toàn; CMP-016 giữ Result/Detail/rule lịch sử nhất quán.
6. Nếu thiếu bytes, lỗi đọc hoặc format không hỗ trợ ở bất kỳ gate cần thiết nào, CMP-014 ghi status/reason và Result rỗng; không dùng metadata/preview hoặc khác biệt tạm để kết luận.

## 7. Alternative and Exception Flows

| ID | Tình huống | Xử lý mong đợi |
| --- | --- | --- |
| ALT-01 | Hai file có cùng filename/size nhưng bytes khác ở request. | Input mismatch, dừng trước output, Result rỗng. |
| ALT-02 | Input compatible; response file cùng filename nhưng bytes khác. | DIFFERENT sau khi so output đầy đủ. |
| ALT-03 | Hai file khác filename nhưng bytes giống, filename thuộc actual multipart/header. | Khác ở metadata raw thuộc phạm vi; xử lý ở gate tương ứng, không chỉ nhìn bytes file. |
| ALT-04 | Multipart chỉ khác boundary hoặc thứ tự part. | Khác raw theo mặc định; input mismatch hoặc output DIFFERENT tùy gate sau khi so đầy đủ. |
| ALT-05 | Body absent so với file 0 byte. | Khác trạng thái theo CMP-009; không coi zero-byte là absent. |
| ALT-06 | Payload lớn được đọc theo chunk. | Kiểm tra đến hết cả hai phía và tính đầy đủ trước Result; chunk size không đổi kết luận. |
| ALT-07 | Detail file không giải mã thành text. | Hiển thị part/byte offset/vùng và preview an toàn theo quyền, không dựng JSON path giả. |
| EXC-01 | Chỉ có preview, filename, length hoặc hash nhưng thiếu actual bytes cần so. | Result rỗng, reason dữ liệu không đủ; không suy SAME/DIFFERENT. |
| EXC-02 | Phát hiện byte khác sớm rồi lỗi đọc phần còn lại. | Result rỗng, không công bố DIFFERENT hoàn chỉnh. |
| EXC-03 | Multipart/file format không hỗ trợ theo rule hiện hành. | Unsupported format, Result rỗng, không coi là output difference. |
| EXC-04 | Người dùng không có quyền Project yêu cầu download. | Backend từ chối trước khi trả bytes hoặc Detail nhạy cảm. |

## 8. Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-CMP-018-01 | Hai actual request upload file có cùng filename và size nhưng một byte nội dung khác. | So input. | Input mismatch; dừng trước output, không có SAME/DIFFERENT. |
| AC-CMP-018-02 | Input compatible; hai response binary khác một byte, dữ liệu đầy đủ. | So output hoàn tất. | DIFFERENT do actual output bytes. |
| AC-CMP-018-03 | Input compatible; hai response binary có toàn bộ bytes giống nhau và headers/status thuộc phạm vi giống. | So output hoàn tất. | SAME. |
| AC-CMP-018-04 | File/body A absent, B tồn tại 0 byte. | So gate tương ứng. | Hai trạng thái khác nhau; không quy B thành absent. |
| AC-CMP-018-05 | Request multipart cùng part content nhưng boundary khác; không có policy ngoại lệ. | So input. | Input mismatch theo raw strict, không so output. |
| AC-CMP-018-06 | Input compatible; response multipart chỉ khác thứ tự part hoặc boundary. | So output đầy đủ. | DIFFERENT theo raw strict nếu bytes khác. |
| AC-CMP-018-07 | Multipart A/B cùng bytes file nhưng `Content-Disposition` hoặc filename raw khác. | So gate tương ứng. | Khác biệt được xét theo actual payload/header thuộc phạm vi, không chỉ so file content. |
| AC-CMP-018-08 | Một policy được phê duyệt cho boundary động, có version/dấu vết và áp dụng nhất quán. | So cặp thuộc policy đó. | Chỉ loại trừ/chuyển đổi đúng phần được duyệt; lưu rule/policy của lần so, không âm thầm áp dụng cho cặp khác. |
| AC-CMP-018-09 | File lớn cần xử lý theo chunk. | Engine so. | Result chỉ xuất hiện sau khi kiểm tra đầy đủ cả hai phía; đổi chunk size không đổi Result. |
| AC-CMP-018-10 | Engine thấy byte khác rồi không đọc được phần còn lại. | Tác vụ dừng. | Result rỗng với reason lỗi/thiếu dữ liệu; không công bố DIFFERENT. |
| AC-CMP-018-11 | Snapshot chỉ có preview, hash, filename/size nhưng actual bytes cần so bị mất. | Bắt đầu Comparison. | Không kết luận SAME/DIFFERENT; reason dữ liệu không đủ. |
| AC-CMP-018-12 | File/multipart có format ngoài phạm vi hỗ trợ. | Bắt đầu gate tương ứng. | Unsupported format, Result rỗng, không tạo output difference. |
| AC-CMP-018-13 | Binary output khác và Comparison hoàn tất. | Mở Difference Detail. | Thấy part nếu có, byte offset/vùng A→B và loại khác biệt an toàn; không có JSON path giả. |
| AC-CMP-018-14 | Detail file dài hơn phần preview ban đầu. | Xem Detail. | Giao diện báo còn nội dung và cung cấp cách xem tiếp theo quyền; Result không đổi do rút gọn. |
| AC-CMP-018-15 | File chứa secret hoặc người dùng không có quyền Project. | Yêu cầu preview/download/Detail. | Backend kiểm tra quyền và không trả nội dung ngoài quyền; khác biệt vẫn có dấu vết an toàn cho người được phép xem. |
| AC-CMP-018-16 | File nguồn/cấu hình API thay đổi sau Comparison hoàn tất. | Mở lịch sử. | Result/Detail dựa Snapshot bytes và rule/policy đã lưu, không bị tính lại ngầm. |
| AC-CMP-018-17 | Hai file có MIME type/extension giống nhưng bytes khác. | So gate tương ứng. | Không suy SAME từ MIME/extension; quyết định theo bytes và gate. |

## 9. Clarification and Decision Log

| ID | Quyết định đã thống nhất | Trạng thái |
| --- | --- | --- |
| CL-CMP-018-01 | So toàn bộ actual bytes ở cùng boundary; filename/size/preview/hash thiếu chứng thực không đủ kết luận. | BA Approved |
| CL-CMP-018-02 | Áp dụng cho file/binary trong actual request (input) và actual response (output), theo gate input trước output. | BA Approved |
| CL-CMP-018-03 | Absent khác zero-byte; thiếu bytes do lỗi không phải payload value. | BA Approved |
| CL-CMP-018-04 | Payload lớn có thể so theo phần, nhưng phải kiểm tra đến hết hai phía trước Result. | BA Approved |
| CL-CMP-018-05 | Thiếu/truncate/hỏng/không đọc hết → Result rỗng, không công bố khác biệt tạm. | BA Approved |
| CL-CMP-018-06 | Multipart lưu đủ raw body và metadata/header cần thiết, không chỉ tên part/file. | BA Approved |
| CL-CMP-018-07 | Multipart mặc định raw strict với part order, boundary, part headers và content bytes. | BA Approved |
| CL-CMP-018-08 | Ngoại lệ boundary/so cấu trúc part cần policy riêng đã duyệt, có dấu vết/nhất quán. | BA Approved |
| CL-CMP-018-09 | Filename, Content-Type/Disposition thuộc actual payload/header được so; QC metadata không tự thành payload. | BA Approved |
| CL-CMP-018-10 | Unsupported format/encoding không tạo DIFFERENT hoặc Result. | BA Approved |
| CL-CMP-018-11 | Detail file/binary theo part/byte span A→B an toàn, không dựng JSON path giả. | BA Approved |
| CL-CMP-018-12 | Preview/download/hex theo quyền; rút gọn phải báo còn nội dung. | BA Approved |
| CL-CMP-018-13 | Lịch sử gắn Snapshot bytes và rule/policy, không đổi vì nguồn/config/display mới. | BA Approved |
| CL-CMP-018-14 | Backend kiểm tra quyền Project khi trả nội dung/Detail/download, bảo vệ secret. | BA Approved |
| CL-CMP-018-15 | MIME/extension chỉ hỗ trợ nhận diện, không chứng minh nội dung bằng nhau. | BA Approved |

## 10. Dependencies and Handoff

| Reference | Ownership / handoff |
| --- | --- |
| CMP-001/005/006/007/009 | Điều kiện cặp, input trước output, raw strict và absent/empty. |
| CMP-014/015/016/017 | Status/reason, Difference Detail, persistence, representation boundary và rule history. |
| RUN/SNP-003/004 | Thu/lưu đầy đủ file bytes, multipart raw body, metadata và khả năng đọc lại Snapshot. |
| AUTH/SEC | Quyền Project, secret, preview/download và redaction ở backend. |
| AnD DB/API | Chọn lưu/streaming/chunking, định dạng hỗ trợ, policy ngoại lệ, API truy xuất nội dung theo ràng buộc nghiệp vụ trên. |
