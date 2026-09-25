# REQ-CMP-016 — Lưu và truy xuất lịch sử Comparison

**QC Tool · Group 6 Comparison Engine · BA FINAL · Priority: Must (BA Proposed)**  
**Trạng thái phân tích:** Clarification completed — BA Approved (15/15). Requirement bổ sung ở mức BA Proposed, chờ Client Confirmation trước khi coi là baseline khách hàng.

## 1. Requirement Information and Proposed Statement

> **Requirement bổ sung ở mức BA Proposed:** “Hệ thống phải lưu và cho phép truy xuất lịch sử Comparison theo đúng cặp Snapshot, nguồn tạo, trạng thái xử lý, Result, reason, Difference Detail và dấu vết rule/policy; không ghi kết quả giả hoặc làm thay đổi kết quả đã hoàn tất khi thử lại hay khi cấu hình hiện tại thay đổi.”

| Thuộc tính | Nội dung |
| --- | --- |
| Requirement ID | REQ-CMP-016 |
| Tên | Lưu và truy xuất lịch sử Comparison |
| Nguồn | BA Proposed để làm rõ persistence, history và contract nghiệp vụ trước AnD DB/API |
| Loại / ưu tiên đề xuất | Functional / Must |
| Actor chính | QC Tool System |
| Actor liên quan | Người dùng có quyền xem Comparison trong Project; người dùng có quyền khởi tạo so thủ công |
| Phụ thuộc | CMP-001/003/004/005/006/007/011/012/013/014/015; RUN, SNP, OUT-002, AUTH/SEC |

## 2. Business Objective and Requirement Statements

Người dùng cần truy xuất lại một phép so và hiểu **cặp nào được so, vì sao có hoặc chưa có Result, chi tiết khác biệt nào thuộc lần so đó**. Lịch sử phải giữ đúng ngữ cảnh đã xảy ra, không suy lại từ Run hoặc cấu hình hiện tại. Hệ thống tách availability khi chưa đủ hai Snapshot, trạng thái từng attempt và Result của Comparison hoàn tất; retry và tác vụ tự động giao lặp không được tạo kết quả hoàn tất trùng hoặc ghi đè lịch sử.

| ID | Requirement statement |
| --- | --- |
| RS-CMP-016-01 | Mỗi Comparison phải gắn Project, API, Environment, baseline Snapshot A, target Snapshot B và chiều A→B; không chỉ lưu hai Run ID rồi suy Snapshot về sau. |
| RS-CMP-016-02 | Hệ thống phải lưu nguồn tạo: tự động sau Execution, so hai Snapshot thủ công hoặc một cặp thuộc so chuỗi. Các nguồn không được ghi đè kết quả của nhau. |
| RS-CMP-016-03 | Processing status phải tách với Comparison Result. Result chỉ là SAME/DIFFERENT khi phép so hợp lệ hoàn tất; trường hợp khác để Result rỗng và ghi status/reason theo CMP-014. |
| RS-CMP-016-04 | Lưu gate/bước dừng hoặc hoàn tất: kiểm tra cặp, kiểm tra input, so output. Input mismatch có chẩn đoán riêng, không lưu thành DIFFERENT. |
| RS-CMP-016-05 | Khi hoàn tất, lưu Result, Difference Detail thuộc phạm vi, chiều A→B và dấu vết rule/policy đã áp dụng. Mở lại lịch sử không tự tính lại bằng cấu hình hiện tại. |
| RS-CMP-016-06 | Không công bố Comparison hoàn tất nếu Result và Detail cần thiết chưa được ghi nhất quán. Khác biệt phát hiện trước lúc engine lỗi không trở thành Result/Detail hoàn chỉnh. |
| RS-CMP-016-07 | Mỗi attempt có thể truy vết thời điểm, trạng thái, reason và cặp Snapshot. Retry sau lỗi giữ lịch sử attempt và không ghi đè Comparison đã hoàn tất. |
| RS-CMP-016-08 | Tác vụ tự động giao lặp cho cùng Execution và cặp A→B không được tạo nhiều Comparison hoàn tất trùng. Yêu cầu so thủ công có danh tính riêng và không bị gộp nhầm vào tác vụ tự động. |
| RS-CMP-016-09 | Baseline ID đã chốt cho Execution phải được giữ trong dấu vết dù target không tạo được, baseline về sau invalidated hoặc cặp bị từ chối. Khi chưa có đủ hai Snapshot, ghi availability trong ngữ cảnh Execution, không tạo Comparison giả. |
| RS-CMP-016-10 | Invalidation sau khi Comparison hoàn tất không xóa/sửa âm thầm Result lịch sử; khi mở lại, giao diện cần thể hiện tình trạng hiện tại của Snapshot nếu liên quan. |
| RS-CMP-016-11 | Comparison theo chuỗi phải lưu theo từng cặp và có liên kết truy xuất chuỗi; không tạo SAME/DIFFERENT tổng hợp thay kết quả từng cặp. |
| RS-CMP-016-12 | Latency và API/Database Version lấy từ Snapshot lịch sử theo CMP-011/012. Bất kỳ dữ liệu hiển thị dẫn xuất nào được lưu thêm cũng không thay nguồn dữ liệu hoặc ảnh hưởng Result. |
| RS-CMP-016-13 | Chỉ người có quyền Project được truy xuất Comparison, attempt, reason và Detail. Dữ liệu lưu/trả về phải bảo vệ secret; reason không lộ token hoặc credential. |
| RS-CMP-016-14 | Hệ thống phải hỗ trợ truy xuất danh sách/chi tiết theo Project, API, Snapshot, Execution trong phạm vi quyền và phân biệt nguồn tự động/thủ công, status, Result cho UI History/Detail. |
| RS-CMP-016-15 | Requirement chốt ngữ nghĩa và tính toàn vẹn dữ liệu; tên bảng, enum, idempotency key, transaction và định dạng API cụ thể do AnD xác định. |

## 3. Scope and Boundaries

| Trong phạm vi CMP-016 | Thuộc yêu cầu liên quan |
| --- | --- |
| Danh tính cặp, chiều, nguồn tạo, liên kết Execution/chuỗi và dữ liệu cần truy xuất. | CMP-003/004/013 xác định baseline, các phương thức so và thời điểm tự động kích hoạt. |
| Processing status, gate, reason, Result rỗng hoặc SAME/DIFFERENT và lịch sử attempt. | CMP-001/005/006/014 chốt điều kiện Result, input mismatch và ngữ nghĩa trạng thái/reason. |
| Lưu nhất quán Result–Detail–rule/policy và bảo toàn lịch sử khi retry, invalidation hoặc thay cấu hình. | CMP-007/015/017/018 chốt phạm vi so và Detail; SNP chốt tính bất biến/invalidation của Snapshot. |
| Truy xuất danh sách/chi tiết trong phạm vi quyền và dữ liệu an toàn. | OUT-002/UI và AnD API chốt trải nghiệm, phân trang và response contract; AUTH/SEC chốt quyền/redaction. |

## 4. Actor, Trigger, Preconditions and Postconditions

| Mục | Quy tắc |
| --- | --- |
| Actor | QC Tool System tạo/lưu/truy xuất; người dùng có quyền Project xem hoặc yêu cầu so thủ công. |
| Trigger ghi | Comparison tự động/thủ công/so chuỗi bắt đầu; attempt chuyển trạng thái, hoàn tất hoặc dừng. |
| Trigger đọc | Người dùng xem danh sách, chi tiết, lịch sử attempt hoặc mở lại Comparison đã ghi. |
| Preconditions tạo Comparison | Có đúng hai Snapshot được chỉ định A/B; kiểm tra eligibility và các gate theo CMP-005/006/007 vẫn diễn ra sau đó. |
| Postcondition hoàn tất | Result, Detail, rule/policy và danh tính cặp được ghi nhất quán; Result SAME/DIFFERENT đúng điều kiện CMP-001. |
| Postcondition không hoàn tất | Status/gate/reason được giữ, Result rỗng; nếu chưa đủ cặp, availability ở Execution và không có Comparison giả. |

## 5. Business Rules

| ID | Business rule |
| --- | --- |
| BR-CMP-016-01 | Danh tính Comparison phải chứa hai Snapshot ID cụ thể và chiều A baseline → B target, cùng Project/API/Environment. Liên kết Run/Execution bổ sung provenance, không thay thế Snapshot ID. |
| BR-CMP-016-02 | Nguồn tạo phải phân biệt automatic, manual pair và pair thuộc chain; một thao tác thủ công không sửa kết quả automatic dù cùng cặp Snapshot. |
| BR-CMP-016-03 | Status xử lý và Result là hai thuộc tính khác nhau. SAME/DIFFERENT chỉ hợp lệ ở trạng thái phép so hoàn tất; các trạng thái còn lại có Result rỗng. |
| BR-CMP-016-04 | Gate và reason chính ghi theo bước dừng đầu tiên theo CMP-014; input mismatch là trạng thái/chẩn đoán input, không phải output difference. |
| BR-CMP-016-05 | Comparison hoàn tất phải có Result và tập Detail tương ứng: SAME không có output difference; DIFFERENT có ít nhất một output difference thuộc phạm vi, kèm rule/policy và chiều A→B. |
| BR-CMP-016-06 | Chỉ công bố hoàn tất sau khi dữ liệu Result/Detail cần thiết đã được ghi nhất quán; lỗi khi ghi hoặc so dở không xuất bản một phần như kết quả hoàn chỉnh. Cách bảo đảm atomicity thuộc AnD. |
| BR-CMP-016-07 | Attempt ghi thời điểm, trạng thái, reason, cặp và liên kết tác vụ; retry tạo dấu vết mới phù hợp, không ghi đè lịch sử hoặc Comparison hoàn tất. |
| BR-CMP-016-08 | Một tác vụ automatic của cùng Execution và cùng cặp không có nhiều Comparison hoàn tất trùng do sự kiện giao lặp. Yêu cầu manual phải giữ danh tính yêu cầu/thao tác riêng. |
| BR-CMP-016-09 | Baseline ID đã chốt vẫn được lưu ở ngữ cảnh Execution khi không có target; nếu có đủ cặp nhưng cặp bị từ chối thì giữ hai Snapshot ID và lý do, không tự chọn baseline khác. |
| BR-CMP-016-10 | Invalidation về sau không sửa Result/Detail đã hoàn tất; thông tin tình trạng hiện tại của Snapshot được trình bày riêng khi xem lịch sử, không viết lại sự kiện quá khứ. |
| BR-CMP-016-11 | Chain có các Comparison theo cặp và liên kết chain; mỗi cặp có status/Result riêng, không có Result chung thay thế. |
| BR-CMP-016-12 | Latency/API Version/DB Version được lấy từ Snapshot lịch sử; dữ liệu dẫn xuất nếu lưu chỉ phục vụ hiển thị và không tham gia engine Result. |
| BR-CMP-016-13 | Truy xuất theo Project/API/Snapshot/Execution phải kiểm tra quyền Project trước khi lộ sự tồn tại, reason hoặc Detail. Payload/secret được lưu và trả an toàn theo AUTH/SEC. |
| BR-CMP-016-14 | Cấu trúc bảng/enum/khóa idempotency/transaction/API là quyết định AnD, nhưng phải bảo đảm các ràng buộc nghiệp vụ trên và truy xuất được lịch sử. |

## 6. Main Flow

1. Hệ thống nhận yêu cầu hoặc sự kiện Comparison, xác định nguồn tạo và cặp Snapshot A→B. Với automatic, cặp gắn đúng Execution và baseline đã chốt.
2. Nếu chưa có đủ hai Snapshot, ghi availability/lý do ở ngữ cảnh Execution theo CMP-014; không tạo Comparison một phía.
3. Với cặp cụ thể, hệ thống tạo/nhận diện tác vụ và attempt phù hợp, giữ Project/API/Environment, Snapshot ID, chiều, nguồn và trạng thái xử lý.
4. Engine kiểm tra cặp, so input rồi output. Tại gate dừng hoặc lỗi, ghi status/gate/reason và Result rỗng; không xuất bản Detail hoàn chỉnh từ phép so dở.
5. Khi so đầy đủ, lưu nhất quán Result SAME/DIFFERENT, Difference Detail tương ứng và dấu vết rule/policy; chỉ sau đó công bố trạng thái hoàn tất.
6. Khi người dùng truy xuất, hệ thống kiểm tra quyền và trả lịch sử cặp/attempt/Detail đã ghi, cùng thông tin Snapshot hiện tại có liên quan, không tính lại bằng cấu hình hiện tại.

## 7. Alternative and Exception Flows

| ID | Tình huống | Xử lý mong đợi |
| --- | --- | --- |
| ALT-01 | Comparison hoàn tất SAME. | Lưu SAME, tập output difference rỗng, rule/policy và cặp A→B. |
| ALT-02 | Comparison hoàn tất DIFFERENT. | Lưu DIFFERENT cùng output Difference Detail thuộc phạm vi, nhất quán với Result. |
| ALT-03 | So chuỗi A→B→C. | Lưu cặp A→B và B→C riêng, liên kết chain; không có Result tổng hợp thay từng cặp. |
| ALT-04 | Cùng A/B được so tự động và thủ công. | Hai nguồn/tác vụ được nhận diện riêng; thao tác sau không ghi đè kết quả trước. |
| ALT-05 | Snapshot bị invalidated sau Comparison hoàn tất. | Kết quả lịch sử giữ nguyên; UI thể hiện tình trạng Snapshot hiện tại riêng. |
| EXC-01 | Không có baseline hoặc target Snapshot. | Chỉ availability trong Execution; không tạo Comparison giả. |
| EXC-02 | Cặp không đủ điều kiện hoặc input mismatch. | Ghi gate/reason, Result rỗng; không biến mismatch thành DIFFERENT. |
| EXC-03 | Engine lỗi sau khi thấy một phần output khác biệt. | Attempt lỗi, Result rỗng; không xuất bản Difference Detail hoàn chỉnh. |
| EXC-04 | Ghi Result thành công nhưng ghi Detail cần thiết thất bại. | Không công bố hoàn tất; bảo đảm trạng thái nhất quán theo AnD. |
| EXC-05 | Tác vụ automatic được giao lại cho cùng Execution/cặp. | Không sinh nhiều Comparison hoàn tất trùng; vẫn có dấu vết xử lý/attempt phù hợp. |
| EXC-06 | Retry một phép so lỗi có thể khắc phục. | Kiểm tra điều kiện hiện hành, giữ cặp và lịch sử attempt, không ghi đè kết quả hoàn tất. |
| EXC-07 | Người xem không có quyền Project. | Từ chối trước khi lộ cặp, trạng thái, reason hoặc Detail. |

## 8. Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-CMP-016-01 | Comparison A→B được tạo trong Project/API/Environment xác định. | Truy xuất chi tiết. | Thấy đúng Snapshot ID A/B, chiều, ngữ cảnh và provenance; không suy cặp chỉ từ Run ID. |
| AC-CMP-016-02 | Cùng cặp A/B được so tự động và thủ công. | Truy xuất lịch sử. | Phân biệt được nguồn và tác vụ, không có kết quả nguồn này ghi đè nguồn kia. |
| AC-CMP-016-03 | Phép so còn xử lý. | Truy xuất. | Status đang xử lý, Result rỗng; không có SAME/DIFFERENT tạm. |
| AC-CMP-016-04 | Cặp đạt điều kiện nhưng input mismatch. | Engine dừng ở input. | Lưu gate input và reason/chẩn đoán, Result rỗng, không có output Difference Detail. |
| AC-CMP-016-05 | Input compatible và output giống, so đầy đủ. | Hoàn tất và đọc lại. | SAME, tập output difference rỗng, cặp/chiều/rule/policy lịch sử nhất quán. |
| AC-CMP-016-06 | Input compatible và output khác, so đầy đủ. | Hoàn tất và đọc lại. | DIFFERENT cùng ít nhất một output difference thuộc phạm vi, đúng chiều A→B và rule/policy. |
| AC-CMP-016-07 | Engine phát hiện một khác biệt rồi lỗi trước khi so xong. | Đọc lại attempt. | Status lỗi, Result rỗng; khác biệt tạm không xuất bản như Detail hoàn chỉnh. |
| AC-CMP-016-08 | Lưu Result được nhưng lưu Detail bắt buộc bị lỗi. | Xử lý ghi hoàn tất. | Không công bố Comparison hoàn tất với Result/Detail thiếu nhất quán. |
| AC-CMP-016-09 | Attempt đầu thất bại và được thử lại. | Xem lịch sử. | Truy vết được thời điểm/status/reason của từng attempt; cặp giữ nguyên, kết quả hoàn tất cũ không bị ghi đè. |
| AC-CMP-016-10 | Sự kiện automatic của cùng Execution/cặp A→B được giao hai lần. | Cả hai lần xử lý. | Không có hai Comparison hoàn tất trùng cho tác vụ automatic đó. |
| AC-CMP-016-11 | Baseline A đã chốt nhưng target không được tạo vì Run/lưu Snapshot lỗi. | Xem Execution. | Có dấu vết baseline/availability thích hợp, không có Comparison một phía. |
| AC-CMP-016-12 | Baseline A đã chốt, cặp A→B bị từ chối. | Xem lịch sử. | Giữ A/B và reason; không âm thầm thay A bằng Snapshot khác. |
| AC-CMP-016-13 | Comparison A→B hoàn tất, sau đó A bị invalidated. | Mở lịch sử. | Result/Detail lịch sử giữ nguyên; trạng thái hiện tại của A được báo riêng. |
| AC-CMP-016-14 | Chuỗi A→B→C được so. | Xem chuỗi. | Truy xuất được từng cặp và status/Result riêng qua liên kết chuỗi, không có Result tổng hợp thay thế. |
| AC-CMP-016-15 | Cấu hình rule/policy thay đổi sau Comparison hoàn tất. | Mở lại chi tiết. | Hiển thị Result/Detail/rule đã áp dụng của lần so, không tính lại ngầm. |
| AC-CMP-016-16 | Snapshot A/B có latency và API/DB Version lịch sử. | Xem Comparison. | Trình bày theo Snapshot, không lấy cấu hình hiện tại hoặc dùng metadata để đổi Result. |
| AC-CMP-016-17 | Người dùng có quyền Project tìm theo API, Snapshot hoặc Execution. | Truy xuất danh sách/chi tiết. | Nhận đúng Comparison trong phạm vi quyền với nguồn, status và Result phân biệt. |
| AC-CMP-016-18 | Người dùng không có quyền Project. | Yêu cầu danh sách hoặc chi tiết. | Không lộ sự tồn tại, cặp, attempt, reason, Detail hay secret của Project. |

## 9. Clarification and Decision Log

| ID | Quyết định đã thống nhất | Trạng thái |
| --- | --- | --- |
| CL-CMP-016-01 | Lưu Project/API/Environment, Snapshot A/B và chiều; Run ID không thay Snapshot ID. | BA Approved |
| CL-CMP-016-02 | Phân biệt nguồn automatic/manual/chain, không ghi đè lẫn nhau. | BA Approved |
| CL-CMP-016-03 | Processing status tách Result; chỉ phép so hoàn tất có SAME/DIFFERENT. | BA Approved |
| CL-CMP-016-04 | Lưu gate dừng/hoàn tất; input mismatch không là DIFFERENT. | BA Approved |
| CL-CMP-016-05 | Lưu Result, Detail, chiều và rule/policy; mở lại không tính lại theo config mới. | BA Approved |
| CL-CMP-016-06 | Công bố hoàn tất khi Result/Detail nhất quán; không xuất bản khác biệt tạm. | BA Approved |
| CL-CMP-016-07 | Truy vết mỗi attempt; retry không ghi đè lịch sử/kết quả hoàn tất. | BA Approved |
| CL-CMP-016-08 | Event automatic lặp không tạo completion trùng; manual có danh tính riêng. | BA Approved |
| CL-CMP-016-09 | Giữ baseline ID đã chốt; chưa đủ hai Snapshot ghi availability ở Execution, không Comparison giả. | BA Approved |
| CL-CMP-016-10 | Invalidation sau completion không sửa Result lịch sử; thể hiện tình trạng hiện tại riêng. | BA Approved |
| CL-CMP-016-11 | Chain lưu từng cặp có liên kết, không có Result tổng hợp thay thế. | BA Approved |
| CL-CMP-016-12 | Latency/version lấy từ Snapshot lịch sử; dẫn xuất không ảnh hưởng Result. | BA Approved |
| CL-CMP-016-13 | Truy xuất theo quyền Project, bảo vệ secret và reason. | BA Approved |
| CL-CMP-016-14 | Truy xuất danh sách/chi tiết theo Project/API/Snapshot/Execution, phân biệt nguồn/status/Result. | BA Approved |
| CL-CMP-016-15 | AnD chốt bảng/enum/key/transaction/API; requirement chốt ngữ nghĩa và toàn vẹn. | BA Approved |

## 10. Dependencies and Handoff

| Reference | Ownership / handoff |
| --- | --- |
| CMP-001/003/004/005/006/007/013/014/015 | Result, baseline, phương thức so, gate, xử lý tự động, reason và Difference Detail. |
| CMP-011/012 | Latency và API/DB Version là metadata Snapshot, trình bày riêng với Result. |
| RUN/SNP | Execution provenance, baseline ID đã chốt, Snapshot lịch sử, invalidation và availability khi thiếu cặp. |
| OUT-002/UI; AUTH/SEC | Danh sách, Detail, trạng thái theo quyền, redaction và tránh lộ dữ liệu ngoài Project. |
| AnD DB/API | Thiết kế persistence, enum, idempotency, transaction, pagination/query và API contract đáp ứng các ràng buộc trên. |
