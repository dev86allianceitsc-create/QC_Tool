# REQ-CMP-017 — Encoding và định dạng dữ liệu khi so sánh

**QC Tool · Group 6 Comparison Engine · BA FINAL · Priority: Must (BA Proposed)**  
**Trạng thái phân tích:** Clarification completed — BA Approved (15/15). Requirement bổ sung ở mức BA Proposed, chờ Client Confirmation trước khi coi là baseline khách hàng.

## 1. Requirement Information and Proposed Statement

> **Requirement bổ sung ở mức BA Proposed:** “Hệ thống phải bảo toàn và xác định rõ biểu diễn actual input/output dùng cho phép so raw strict, áp dụng cùng ranh giới xử lý cho hai Snapshot, phân biệt dữ liệu hợp lệ với dữ liệu thiếu/hỏng hoặc định dạng không hỗ trợ, và không để thao tác giải mã/hiển thị làm thay đổi Result.”

| Thuộc tính | Nội dung |
| --- | --- |
| Requirement ID | REQ-CMP-017 |
| Tên | Encoding và định dạng dữ liệu khi so sánh |
| Nguồn | BA Proposed để chốt ranh giới dữ liệu raw, encoding và khả năng xử lý trước AnD |
| Loại / ưu tiên đề xuất | Functional / Must |
| Actor chính | QC Tool System |
| Actor liên quan | Người dùng có quyền xem Snapshot/Comparison |
| Phụ thuộc | CMP-001/005/006/007/009/010/014/015/016/018; RUN, SNP-003/004, AUTH/SEC |

## 2. Business Objective and Requirement Statements

So raw strict chỉ đáng tin cậy khi hai phía dùng cùng loại biểu diễn và Snapshot giữ đủ dữ liệu actual. Các thư viện HTTP, bộ giải nén, decoder và parser có thể biến đổi body trước lúc ứng dụng nhìn thấy. QC Tool phải ghi rõ ranh giới bytes được lưu để so, không dùng bản preview hoặc dữ liệu parse/serialize lại thay nguồn quyết định. Việc không giải mã được để hiển thị không mặc nhiên có nghĩa không thể so bytes; ngược lại, thiếu bytes cần thiết thì không thể kết luận từ dữ liệu gần đúng.

| ID | Requirement statement |
| --- | --- |
| RS-CMP-017-01 | Engine phải so actual data đã lưu trong Snapshot, không gọi lại API hoặc dựng lại body từ UI, schema hay cấu hình hiện tại. |
| RS-CMP-017-02 | Snapshot phải xác định biểu diễn body lưu để so và metadata liên quan như content type, charset, content encoding nếu có; A/B phải được đối chiếu ở cùng một ranh giới xử lý. |
| RS-CMP-017-03 | Với text/JSON được hỗ trợ, nguồn quyết định raw strict là bytes đã lưu trước bước parse/format để hiển thị; parse JSON chỉ hỗ trợ định vị Detail. |
| RS-CMP-017-04 | Không tự chuyển charset, chuẩn hóa Unicode, xuống dòng, BOM, whitespace, escape hoặc serialize lại trước khi so; bytes khác thuộc phạm vi được xử lý tại gate input/output tương ứng. |
| RS-CMP-017-05 | `Content-Type` và `Content-Encoding` là actual response headers theo CMP-007; giá trị header khác vẫn được so strict dù body sau xử lý có vẻ giống. |
| RS-CMP-017-06 | Nếu HTTP client tự giải nén/chuyển đổi, QC Tool phải ghi rõ bytes được lưu ở giai đoạn nào và áp dụng nhất quán cho A/B; không so wire bytes của một phía với bytes đã giải nén của phía kia. |
| RS-CMP-017-07 | Body thực sự absent phải phân biệt với body 0 byte, chuỗi rỗng, JSON `null` và dữ liệu bị thiếu do lưu lỗi; response 204 hợp lệ không mặc nhiên là dữ liệu thiếu. |
| RS-CMP-017-08 | Content type/charset khai báo sai hoặc không có không được dùng để âm thầm sửa bytes. Nếu raw đầy đủ vẫn so được theo định dạng được hỗ trợ, Result dựa trên raw; lỗi giải mã phục vụ hiển thị được thông báo riêng. |
| RS-CMP-017-09 | Khi bytes cần so thiếu, truncate, hỏng hoặc không khôi phục được, hệ thống không dùng preview, hash hay text đã parse để suy SAME/DIFFERENT; dừng với reason theo CMP-014. |
| RS-CMP-017-10 | Khi format/encoding nằm ngoài phạm vi hỗ trợ và không thể áp dụng quy tắc so đã chốt, ghi unsupported format/encoding với Result rỗng, không diễn giải thành output difference. |
| RS-CMP-017-11 | File/binary và multipart phải giữ đủ cấu trúc/bytes liên quan; quy tắc so chuyên biệt do CMP-018 chốt. CMP-017 xác định ranh giới lưu/đọc và báo không hỗ trợ. |
| RS-CMP-017-12 | JSON cú pháp không hợp lệ nhưng raw bytes đầy đủ vẫn được so raw theo CMP-007 nếu dạng dữ liệu đó được hỗ trợ; UI không dựng JSON path giả, dùng vị trí/vùng raw. |
| RS-CMP-017-13 | Detail chỉ hiển thị text giải mã khi giải mã đáng tin cậy; nếu không, dùng biểu diễn an toàn như byte offset/hex preview theo quyền. Cách hiển thị không đổi Result. |
| RS-CMP-017-14 | Quy tắc áp dụng cho cả actual input và output: khác ở input dừng trước output và không có Result; khác ở output chỉ tạo DIFFERENT khi input compatible và output so đầy đủ. |
| RS-CMP-017-15 | Snapshot/Comparison giữ dấu vết phiên bản quy tắc và biểu diễn dùng tại lần so, để mở lại lịch sử không diễn giải lại bytes theo engine/cấu hình mới. |

## 3. Scope and Boundaries

| Trong phạm vi CMP-017 | Thuộc yêu cầu liên quan |
| --- | --- |
| Biểu diễn body, ranh giới bytes, metadata định dạng/encoding và tính nhất quán giữa A/B. | RUN/SNP xác định thu thập, lưu raw đầy đủ và tính bất biến; AnD chốt kỹ thuật chặn tự chuyển đổi của HTTP client hoặc ghi dấu vết chuyển đổi. |
| So raw bytes của định dạng được hỗ trợ, tách nguồn quyết định với parser/decoder dùng cho Detail. | CMP-007/009/010 xác định strict rules, absent/empty/null và kiểu/lexeme; CMP-015 xác định Detail. |
| Dừng khi dữ liệu không đầy đủ hoặc không thể áp dụng định dạng hỗ trợ; phân biệt với lỗi hiển thị. | CMP-014/016 quản lý status/reason và lịch sử; CMP-018 quản lý file/binary/multipart. |
| Cả input và output theo đúng gate; không tính lại lịch sử. | CMP-001/005/006 quyết định điều kiện cặp, input compatibility và Result. |

## 4. Actor, Trigger, Preconditions and Postconditions

| Mục | Quy tắc |
| --- | --- |
| Actor | QC Tool System thu/lưu/đọc biểu diễn và so; người dùng có quyền xem kết quả/Detail. |
| Trigger | Thu actual request/response của Execution hoặc bắt đầu gate input/output của Comparison. |
| Preconditions | Snapshot A/B được chọn; raw data, metadata và ranh giới lưu có thể truy xuất; cặp phải đạt CMP-005 trước so input. |
| Postcondition — input khác | Ghi input mismatch, dừng trước output, Result rỗng. |
| Postcondition — output khác | Chỉ DIFFERENT sau input compatible và so output đầy đủ theo dữ liệu raw cùng ranh giới. |
| Postcondition — không thể so | Thiếu/hỏng/truncate hoặc unsupported: status/reason phù hợp, Result rỗng, không dùng dữ liệu dẫn xuất để suy ra kết quả. |

## 5. Business Rules

| ID | Business rule |
| --- | --- |
| BR-CMP-017-01 | Nguồn so là actual bytes/giá trị đã được ghi tại Snapshot, không phải response mới hoặc text do UI dựng lại. |
| BR-CMP-017-02 | Hệ thống phải biết representation boundary của body A/B: bytes đã đi qua bước xử lý nào, content metadata nào áp dụng và quy tắc phiên bản nào dùng. Hai phía phải cùng ranh giới có thể đối chiếu. |
| BR-CMP-017-03 | Text/JSON được hỗ trợ so từ bytes lưu trước parse/pretty print; parser không được chuẩn hóa key order, whitespace, escape hoặc numeric lexeme để quyết định Result. |
| BR-CMP-017-04 | Không charset conversion, Unicode normalization, đổi newline/BOM, trim hoặc reserialization ngầm. Nếu chính sách loại trừ/chuyển đổi được duyệt ở yêu cầu khác, phải có dấu vết, không tự phát sinh tại CMP-017. |
| BR-CMP-017-05 | `Content-Type`/`Content-Encoding` là response headers thuộc phạm vi CMP-007; body bytes và headers được xét theo quy tắc riêng, không thay thế nhau. |
| BR-CMP-017-06 | Tự động giải nén/chuyển đổi bởi client phải được nhận diện. Không trộn wire bytes với bytes sau chuyển đổi giữa A/B; nếu không bảo đảm cùng ranh giới, dừng thay vì tạo kết luận sai. |
| BR-CMP-017-07 | Absent là trạng thái body không tồn tại; zero-byte là body tồn tại với độ dài 0. JSON `null`, empty string và việc lưu không đầy đủ là các trạng thái khác nhau theo CMP-009/014. |
| BR-CMP-017-08 | Lỗi giải mã chỉ để hiển thị không làm mất kết quả raw khi bytes đầy đủ và quy tắc hỗ trợ. Nếu format/encoding cần thiết cho phép so không được hỗ trợ, Result rỗng với reason riêng. |
| BR-CMP-017-09 | Preview, file name, size hoặc hash thiếu nội dung chứng thực không phải nguồn thay thế cho bytes bị thiếu; không kết luận từ dữ liệu không đủ. |
| BR-CMP-017-10 | JSON không hợp lệ vẫn có thể so raw đầy đủ nếu được hỗ trợ như raw text/body; Detail dùng raw span/offset thay JSON path giả. |
| BR-CMP-017-11 | Hiển thị text chỉ khi decode đáng tin cậy; nếu không, trình bày offset/hex preview an toàn, có chỉ dấu giới hạn hiển thị và quyền truy cập. |
| BR-CMP-017-12 | Khác ở input thuộc phạm vi dẫn đến input mismatch và không so output; khác ở output chỉ dẫn tới DIFFERENT sau so đầy đủ. |
| BR-CMP-017-13 | Kết quả lịch sử gắn biểu diễn và rule/policy phiên bản đã dùng; mở lại không tự diễn giải hay chạy lại theo phiên bản mới. |

## 6. Main Flow

1. Khi Execution chạy, QC Tool thu actual input/output và lưu biểu diễn đầy đủ cùng content metadata, ranh giới xử lý và dấu vết cần thiết trong Snapshot theo RUN/SNP.
2. Khi Comparison bắt đầu, hệ thống xác định cặp hợp lệ theo CMP-005 và kiểm tra cả hai Snapshot có dữ liệu ở cùng ranh giới so được hay không.
3. Hệ thống so actual input trước theo CMP-006 bằng dữ liệu raw đã lưu. Nếu input mismatch, dừng trước output và để Result rỗng.
4. Nếu input compatible, hệ thống kiểm tra sự đầy đủ/khả năng hỗ trợ của output, rồi so HTTP status, response headers và body theo CMP-007 cùng quy tắc liên quan.
5. Khi output so đầy đủ, CMP-001 tạo SAME/DIFFERENT. CMP-015 có thể parse/giải mã để định vị và trình bày Detail nhưng không dùng kết quả biến đổi đó để đổi Result.
6. Nếu dữ liệu thiếu/hỏng hoặc representation không thể đối chiếu, hệ thống dừng với reason theo CMP-014/016 và không suy Result từ preview hoặc một phần phép so.

## 7. Alternative and Exception Flows

| ID | Tình huống | Xử lý mong đợi |
| --- | --- | --- |
| ALT-01 | Hai JSON parse ra tương đương nhưng raw khác whitespace/key order/escape. | Input khác → mismatch; output khác sau input compatible/so đủ → DIFFERENT. |
| ALT-02 | Header `Content-Encoding` khác nhưng body sau giải nén có vẻ giống. | Header vẫn được so strict theo CMP-007; body được so theo ranh giới bytes đã lưu nhất quán. |
| ALT-03 | Response 204 thực sự không có body ở cả hai phía. | Absent hợp lệ ở cả hai, không coi là thiếu lưu trữ. |
| ALT-04 | Body absent so với body tồn tại 0 byte. | Hai trạng thái khác nhau theo CMP-009. |
| ALT-05 | JSON không hợp lệ, raw bytes đầy đủ và format raw được hỗ trợ. | So raw; Detail dùng byte/vùng raw, không tạo JSON path giả. |
| ALT-06 | Charset khai báo sai làm decoder hiển thị lỗi nhưng raw bytes vẫn đủ. | So raw nếu quy tắc hỗ trợ; UI báo không giải mã đáng tin cậy và dùng biểu diễn an toàn. |
| EXC-01 | Một Snapshot lưu bytes bị truncate/hỏng. | Result rỗng, reason dữ liệu không đủ; không dùng preview/hash để đoán. |
| EXC-02 | A ở wire bytes, B ở bytes đã giải nén và không khôi phục được cùng ranh giới. | Không so chéo hai representation; Result rỗng với reason phù hợp. |
| EXC-03 | Format/encoding ngoài phạm vi engine hỗ trợ. | Unsupported format/encoding, Result rỗng; không gọi là output difference. |
| EXC-04 | File/binary/multipart cần quy tắc chuyên biệt. | Chuyển theo CMP-018 nếu hỗ trợ; nếu không, reason không hỗ trợ theo CMP-014. |

## 8. Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-CMP-017-01 | Hai Snapshot có actual bytes đầy đủ cùng representation boundary, input compatible. | So output. | Result dựa trên bytes đã lưu, không gọi lại API hoặc dựng lại body. |
| AC-CMP-017-02 | JSON A/B khác key order nhưng parse ra cùng object. | So input. | Input mismatch; không so output, Result rỗng. |
| AC-CMP-017-03 | Input compatible; JSON output A/B chỉ khác whitespace hoặc escape raw. | So output đầy đủ. | DIFFERENT theo raw strict, không dùng JSON đã parse để tạo SAME. |
| AC-CMP-017-04 | Text A/B chỉ khác BOM, newline hoặc Unicode bytes. | So tại gate tương ứng. | Khác biệt được xử lý theo raw, không chuẩn hóa ngầm. |
| AC-CMP-017-05 | Response header `Content-Type` hoặc `Content-Encoding` khác; input compatible. | So output đầy đủ. | Header difference theo CMP-007 dù body sau xử lý có vẻ giống. |
| AC-CMP-017-06 | HTTP client tự giải nén ở một lần lưu. | Lưu và so Snapshot A/B. | Giai đoạn bytes của mỗi phía có dấu vết; không kết luận bằng cách so wire A với decoded B. |
| AC-CMP-017-07 | Cả hai response 204 hợp lệ với body absent. | So output đầy đủ. | Absent được nhận diện là dữ liệu hợp lệ, không tự coi là Snapshot thiếu. |
| AC-CMP-017-08 | A body absent, B body tồn tại 0 byte. | So gate tương ứng. | Hai trạng thái được phân biệt theo CMP-009. |
| AC-CMP-017-09 | Charset sai khiến UI không decode được, nhưng raw bytes đầy đủ và được hỗ trợ. | So rồi mở Detail. | Result từ raw; UI báo hạn chế giải mã và dùng offset/hex preview an toàn. |
| AC-CMP-017-10 | JSON sai cú pháp nhưng raw đầy đủ thuộc định dạng so được. | So và mở Detail. | Quyết định từ raw; không dựng JSON path giả. |
| AC-CMP-017-11 | Bytes của một phía bị truncate, chỉ còn preview và hash. | Bắt đầu Comparison. | Không SAME/DIFFERENT; reason dữ liệu không đủ. |
| AC-CMP-017-12 | A/B nằm ở hai representation boundary khác nhau, không thể khôi phục đồng nhất. | Bắt đầu Comparison. | Không kết luận SAME/DIFFERENT từ bytes không tương ứng. |
| AC-CMP-017-13 | Format/encoding chưa được hỗ trợ và không áp dụng được rule đã chốt. | Bắt đầu so. | Result rỗng, reason unsupported; không tạo DIFFERENT. |
| AC-CMP-017-14 | Input raw khác dù output có vẻ giống. | So cặp. | Dừng trước output, Result rỗng; không suy SAME từ output. |
| AC-CMP-017-15 | Input compatible, output raw khác và so hoàn tất. | Kết thúc Comparison. | DIFFERENT; Detail được trình bày an toàn mà không đổi Result. |
| AC-CMP-017-16 | Engine/cấu hình hiện tại đổi sau khi Comparison hoàn tất. | Mở lịch sử. | Giữ Result và dấu vết representation/rule của lần so; không diễn giải lại ngầm. |

## 9. Clarification and Decision Log

| ID | Quyết định đã thống nhất | Trạng thái |
| --- | --- | --- |
| CL-CMP-017-01 | So actual data trong Snapshot, không gọi lại/dựng lại. | BA Approved |
| CL-CMP-017-02 | Snapshot ghi biểu diễn body/metadata; A/B cùng ranh giới xử lý. | BA Approved |
| CL-CMP-017-03 | Text/JSON so bytes trước parse/format; parser chỉ giúp Detail. | BA Approved |
| CL-CMP-017-04 | Không tự chuyển charset/Unicode/newline/BOM/whitespace/escape/serialize. | BA Approved |
| CL-CMP-017-05 | `Content-Type`/`Content-Encoding` là actual header so strict. | BA Approved |
| CL-CMP-017-06 | Ghi dấu vết tự giải nén/chuyển đổi và không trộn wire/decoded bytes giữa A/B. | BA Approved |
| CL-CMP-017-07 | Absent khác zero-byte/empty/null/thiếu dữ liệu; 204 hợp lệ không mặc nhiên thiếu. | BA Approved |
| CL-CMP-017-08 | Khai báo sai/thiếu không âm thầm sửa bytes; lỗi decode hiển thị tách khỏi raw Result khi vẫn so được. | BA Approved |
| CL-CMP-017-09 | Thiếu/truncate/hỏng không suy Result từ preview/hash/text parse. | BA Approved |
| CL-CMP-017-10 | Unsupported format/encoding không tạo DIFFERENT hoặc Result. | BA Approved |
| CL-CMP-017-11 | File/binary/multipart giữ đủ bytes/cấu trúc, quy tắc chuyên biệt CMP-018. | BA Approved |
| CL-CMP-017-12 | JSON sai cú pháp nhưng raw đầy đủ vẫn so raw nếu hỗ trợ, không dựng path giả. | BA Approved |
| CL-CMP-017-13 | Chỉ hiển thị text khi decode đáng tin; nếu không dùng offset/hex preview an toàn. | BA Approved |
| CL-CMP-017-14 | Áp dụng input trước output, khác input không Result, khác output chỉ DIFFERENT khi so đủ. | BA Approved |
| CL-CMP-017-15 | Giữ dấu vết version rule/biểu diễn cho lịch sử. | BA Approved |

## 10. Dependencies and Handoff

| Reference | Ownership / handoff |
| --- | --- |
| CMP-001/005/006/007/009/010 | Điều kiện cặp, input trước output, raw strict, absent/empty/null và biểu diễn kiểu/số. |
| CMP-014/015/016 | Status/reason không thể so, Detail an toàn và persistence dấu vết rule/representation. |
| CMP-018 | Quy tắc so nội dung file/binary/multipart sau khi bảo toàn dữ liệu. |
| RUN/SNP-003/004 | Thu và lưu actual bytes, metadata, completeness, representation boundary và tính bất biến Snapshot. |
| AnD API/DB; AUTH/SEC | Chốt giai đoạn bytes và metadata cụ thể, format hỗ trợ, mã reason, truy xuất/hiển thị bảo vệ dữ liệu. |
