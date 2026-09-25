# REQ-CMP-013 — Tự động kích hoạt Comparison sau Run

**QC Tool · Group 6 Comparison Engine · BA FINAL · Priority: Must (BA Proposed)**  
**Trạng thái phân tích:** Clarification completed — BA Approved (12/12). Requirement bổ sung ở mức BA Proposed, chờ Client Confirmation trước khi coi là baseline khách hàng.

## 1. Requirement Information and Proposed Statement

> **Requirement bổ sung ở mức BA Proposed:** “Sau khi một API Execution tạo target Snapshot đủ điều kiện, hệ thống phải tự động so Snapshot đó với baseline Snapshot đã chốt trước Execution (nếu có); trạng thái và kết quả Comparison phải được ghi riêng với Run.”

| Thuộc tính | Nội dung |
| --- | --- |
| Requirement ID | REQ-CMP-013 |
| Tên | Tự động kích hoạt Comparison sau Run |
| Nguồn | BA Proposed để nối luồng Run → Snapshot → Comparison; 12 clarification đã được BA duyệt |
| Loại / ưu tiên đề xuất | Functional / Must |
| Actor chính | QC Tool System |
| Actor liên quan | Người dùng khởi tạo Run và người dùng có quyền xem kết quả trong Project |
| Phụ thuộc | CMP-001/003/004/005/006/007/014/016; RUN, SNP, AUTH/SEC |

## 2. Business Objective and Requirement Statements

Sau một lần chạy tạo Snapshot mới, người dùng cần biết dữ liệu đầu vào và đầu ra của lần đó có giống baseline hay không mà không phải tự chọn lại cặp. Baseline được xác định trước Execution; Comparison tự động bắt đầu sau khi target Snapshot đã lưu thành công. Run, Snapshot và Comparison là các kết quả xử lý riêng: việc so sánh chưa xong hoặc thất bại không đảo ngược một lần Run hay Snapshot đã thành công.

| ID | Requirement statement |
| --- | --- |
| RS-CMP-013-01 | Trước mỗi API Execution, hệ thống phải chốt baseline Snapshot ID theo CMP-003. Khi Execution tạo target Snapshot đủ điều kiện, hệ thống tự đưa đúng cặp baseline → target vào luồng Comparison. |
| RS-CMP-013-02 | Nếu không có baseline vì đây là Snapshot đầu tiên, hệ thống giữ target Snapshot và thể hiện lý do chưa có mốc để so trong ngữ cảnh Execution/Snapshot; không tạo Comparison một phía hoặc SAME. |
| RS-CMP-013-03 | Nếu Run lỗi hoặc lưu target Snapshot thất bại, hệ thống không tự tạo Comparison; Run Outcome/Error và lý do chưa thể so phải được ghi đúng ngữ cảnh theo CMP-014. |
| RS-CMP-013-04 | Với Run một API hoặc danh sách API, tự động Comparison áp dụng cho từng API Execution tạo Snapshot; mỗi Execution có baseline, target, trạng thái và kết quả độc lập. |
| RS-CMP-013-05 | Hệ thống phải giữ baseline ID đã chốt, không âm thầm chọn Snapshot cũ khác nếu baseline invalidated, cặp không đủ điều kiện hoặc input mismatch. |
| RS-CMP-013-06 | Trước khi kết luận Result, hệ thống phải kiểm tra điều kiện cặp theo CMP-005, so actual input theo CMP-006 rồi mới so actual output đầy đủ. Chỉ phép so hợp lệ hoàn tất mới tạo SAME/DIFFERENT theo CMP-001. |
| RS-CMP-013-07 | Comparison tự động có thể tiếp tục sau khi Snapshot được lưu thành công. Giao diện phải thể hiện trạng thái đang xử lý và cập nhật kết quả/trạng thái dừng sau đó; không hiển thị SAME/DIFFERENT tạm thời. |
| RS-CMP-013-08 | Lỗi Comparison không được đổi Run/Execution và Snapshot đã thành công thành Run lỗi; trạng thái/lý do Comparison được ghi riêng theo CMP-014/016. |
| RS-CMP-013-09 | Tác vụ hoặc sự kiện tự động lặp lại cho cùng Execution và cùng cặp baseline → target không được tạo nhiều Comparison hoàn tất trùng nhau. Cấu trúc attempt, khóa chống trùng và retry thuộc CMP-016/AnD. |
| RS-CMP-013-10 | Khi thử lại do nguyên nhân có thể khắc phục, hệ thống phải kiểm tra điều kiện hiện hành, giữ cặp đã chốt và không ghi đè một Comparison đã hoàn tất; lịch sử lần thử theo CMP-016. |
| RS-CMP-013-11 | Comparison thủ công hoặc so chuỗi theo CMP-004 độc lập với Comparison tự động; thao tác đó không thay baseline hoặc kết quả tự động của Execution đã ghi. |
| RS-CMP-013-12 | Chỉ người dùng có quyền với Project mới được xem trạng thái/kết quả tự động; lý do và chi tiết không được làm lộ Snapshot, token hoặc dữ liệu nhạy cảm ngoài quyền. |

## 3. Scope and Boundaries

| Trong phạm vi CMP-013 | Thuộc yêu cầu liên quan |
| --- | --- |
| Thời điểm và điều kiện kích hoạt Comparison tự động sau khi có target Snapshot đủ điều kiện; liên kết đúng Execution, baseline và target. | CMP-003 chọn/chốt baseline; RUN/SNP xác định Execution Outcome, Snapshot đủ điều kiện và bất biến. |
| Hành vi khi không có baseline, Run lỗi, lưu Snapshot thất bại hoặc cặp bị từ chối. | CMP-014 sở hữu ngữ nghĩa chưa thể so, không đủ điều kiện, lỗi và reason. |
| Giữ hai luồng Run/Snapshot và Comparison độc lập; hiển thị đang xử lý, hoàn tất hoặc không hoàn tất theo thực tế. | CMP-016 và AnD quyết định status/attempt/history, idempotency key, queue/transaction và API contract cụ thể. |
| Bảo đảm mỗi Execution và mỗi cặp được xử lý độc lập, kể cả Run danh sách API. | CMP-004 sở hữu lựa chọn thủ công/so chuỗi; CMP-005/006/007/001 sở hữu eligibility, input/output và Result. |

## 4. Actor, Trigger, Preconditions and Postconditions

| Mục | Quy tắc |
| --- | --- |
| Actor | QC Tool System kích hoạt/so/lưu trạng thái; người dùng có quyền Project xem tiến độ và kết quả. |
| Trigger | API Execution tạo và lưu thành công target Snapshot đủ điều kiện sau khi baseline ID đã được chốt trước Execution. |
| Preconditions | Execution, target Snapshot và baseline ID (nếu có) được xác định rõ; điều kiện cặp/input/output vẫn được kiểm tra trong luồng Comparison, không giả định đạt trước. |
| Postcondition — hoàn tất | Cặp hợp lệ, input compatible, output so đầy đủ; Result SAME hoặc DIFFERENT được gắn đúng cặp và Execution. |
| Postcondition — chưa thể so | Thiếu baseline/target hoặc gate không đạt: không có Result; lý do thể hiện đúng bước dừng theo CMP-014. |
| Postcondition — lỗi Comparison | Run/Execution/Snapshot đã thành công giữ trạng thái của chúng; Comparison ghi lỗi riêng và Result rỗng. |

## 5. Business Rules

| ID | Business rule |
| --- | --- |
| BR-CMP-013-01 | Baseline là Snapshot ID được chốt ngay trước Execution theo CMP-003; target là Snapshot mới được lưu thành công từ chính Execution đó. Không tái chọn baseline sau khi biết outcome. |
| BR-CMP-013-02 | Không có hai Snapshot cụ thể thì không có Comparison hợp lệ: Snapshot đầu tiên được giữ làm mốc tương lai; Run lỗi/lưu target thất bại không sinh cặp giả. |
| BR-CMP-013-03 | Mỗi API Execution trong Run danh sách có quyết định kích hoạt riêng. Thất bại ở một Execution/cặp không tạo hoặc đổi Result của Execution/cặp khác. |
| BR-CMP-013-04 | Baseline invalidated sau lúc chốt, khác context hoặc thiếu điều kiện thì dừng ở gate tương ứng với baseline ID đã chốt; không tìm bản thay thế. |
| BR-CMP-013-05 | Input mismatch dừng trước output; output difference chỉ tạo DIFFERENT khi input compatible và phép so output hoàn tất. |
| BR-CMP-013-06 | Đang xử lý là trạng thái xử lý, không phải Result. Không hiển thị SAME/DIFFERENT cho phép so chưa hoàn tất hoặc thất bại. |
| BR-CMP-013-07 | Run Outcome, Snapshot save outcome và Comparison processing status được lưu/hiển thị theo đúng đối tượng; lỗi engine Comparison không hồi tố thành Run Error. |
| BR-CMP-013-08 | Cùng Execution và đúng cặp baseline → target không được tạo nhiều bản Comparison hoàn tất do sự kiện giao lại hoặc thao tác tự động lặp. Thiết kế khóa và lưu attempt thuộc CMP-016/AnD. |
| BR-CMP-013-09 | Retry chỉ dùng cặp đã chốt, kiểm tra lại quyền/điều kiện hiện hành, giữ lịch sử phù hợp và không ghi đè kết quả Comparison đã hoàn tất. |
| BR-CMP-013-10 | Comparison thủ công và so chuỗi không sửa baseline ID, target ID hoặc Result của Comparison tự động trước đó. |
| BR-CMP-013-11 | Kiểm soát quyền trước khi trả trạng thái, reason, cặp Snapshot hoặc Difference Detail; bảo vệ secret theo AUTH/SEC. |

## 6. Main Flow

1. Ngay trước từng API Execution, hệ thống chọn và chốt baseline Snapshot ID theo CMP-003, hoặc ghi nhận không có baseline.
2. Hệ thống chạy API, xác định Execution Outcome và lưu target Snapshot nếu đủ điều kiện theo nhóm RUN/SNP.
3. Nếu có target nhưng không có baseline, hệ thống giữ Snapshot và ghi tình trạng chưa có mốc để so; kết thúc luồng tự động mà không tạo Comparison một phía.
4. Nếu có baseline và target, hệ thống kích hoạt xử lý cặp baseline → target, liên kết với đúng Execution và thể hiện trạng thái đang xử lý.
5. Hệ thống kiểm tra cặp theo CMP-005, so input theo CMP-006; chỉ khi input compatible mới so output theo CMP-007 và các quy tắc liên quan.
6. Khi phép so hoàn tất, CMP-001 tạo SAME hoặc DIFFERENT. Nếu dừng hoặc lỗi, CMP-014 ghi trạng thái/lý do và Result rỗng; CMP-016 lưu attempt/history, không làm thay đổi Run/Snapshot thành công.

## 7. Alternative and Exception Flows

| ID | Tình huống | Xử lý mong đợi |
| --- | --- | --- |
| ALT-01 | Execution tạo Snapshot đầu tiên. | Giữ target, thể hiện chưa có baseline; không tạo Comparison hay SAME. |
| ALT-02 | Run danh sách gồm nhiều Execution đủ điều kiện. | Mỗi Execution kích hoạt cặp độc lập với baseline đã chốt riêng. |
| ALT-03 | Snapshot đã lưu, Comparison đang xử lý. | Run/Snapshot thành công được thể hiện đúng; Result Comparison chưa có cho đến khi hoàn tất. |
| ALT-04 | Người dùng so thủ công hai Snapshot trong lúc có Comparison tự động. | Hai tác vụ độc lập; không đổi cặp/baseline và kết quả tự động. |
| EXC-01 | API Execution thất bại, không có target Snapshot đủ điều kiện. | Không tạo Comparison; Run Result/Error nêu lỗi nguồn. |
| EXC-02 | API Execution thành công nhưng lưu target Snapshot thất bại. | Không tạo Comparison; thể hiện lỗi lưu Snapshot theo RUN/SNP/CMP-014. |
| EXC-03 | Baseline bị invalidated sau khi chốt và trước khi so. | Cặp không đủ điều kiện hiện hành; giữ baseline ID, không tự chọn bản cũ khác. |
| EXC-04 | Input mismatch. | Dừng trước output; Result rỗng, reason theo CMP-014. |
| EXC-05 | Output có khác biệt một phần rồi engine lỗi trước khi so xong. | Comparison failed, Result rỗng; không kết luận DIFFERENT từ phép so dở. |
| EXC-06 | Sự kiện tự động được giao lặp cho cùng Execution/cặp. | Không có nhiều Comparison hoàn tất trùng; attempt/retry theo CMP-016. |
| EXC-07 | Thử lại sau lỗi tạm thời. | Kiểm tra điều kiện hiện hành với cặp đã chốt; không ghi đè Comparison hoàn tất. |

## 8. Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-CMP-013-01 | Baseline A đã chốt trước Execution, target B được lưu thành công và đủ điều kiện. | B được tạo. | Hệ thống tự kích hoạt Comparison đúng A→B, liên kết Execution; không cần người dùng chọn cặp. |
| AC-CMP-013-02 | Không có baseline, Execution tạo Snapshot B đầu tiên. | B lưu thành công. | B được giữ; thể hiện chưa có mốc để so, không tạo Comparison một phía hoặc SAME. |
| AC-CMP-013-03 | Run lỗi và không có target Snapshot đủ điều kiện. | Execution kết thúc. | Không kích hoạt Comparison; lỗi thuộc Run Result/Error. |
| AC-CMP-013-04 | Execution thành công nhưng target Snapshot lưu thất bại. | Xử lý hậu Run. | Không kích hoạt Comparison; lỗi lưu được ghi đúng nơi, không sinh Result giả. |
| AC-CMP-013-05 | Run danh sách có hai Execution, mỗi cái tạo Snapshot đủ điều kiện. | Hậu Run xử lý. | Hai cặp được xác định theo baseline/target từng Execution; kết quả độc lập. |
| AC-CMP-013-06 | Baseline A đã chốt, sau đó bị invalidated; tồn tại Snapshot cũ C. | Target B được lưu và xử lý tự động. | Cặp A→B bị từ chối với reason tương ứng, không tự thay A bằng C. |
| AC-CMP-013-07 | Cặp hợp lệ nhưng actual input mismatch. | So tự động. | Dừng trước output, không có SAME/DIFFERENT; không chọn baseline khác. |
| AC-CMP-013-08 | Cặp hợp lệ, input compatible, output giống và so đầy đủ. | Comparison hoàn tất. | Result SAME được gắn đúng cặp và Execution. |
| AC-CMP-013-09 | Cặp hợp lệ, input compatible, output khác và so đầy đủ. | Comparison hoàn tất. | Result DIFFERENT do output; không tự đánh giá thay đổi đúng/sai. |
| AC-CMP-013-10 | Target Snapshot đã lưu, tác vụ Comparison còn chạy. | Người dùng xem Execution. | Thấy trạng thái đang xử lý, chưa có SAME/DIFFERENT tạm thời. |
| AC-CMP-013-11 | Run và Snapshot thành công; engine Comparison lỗi giữa chừng. | Tác vụ dừng. | Comparison failed, Result rỗng; Run/Snapshot vẫn thể hiện thành công. |
| AC-CMP-013-12 | Cùng sự kiện/cặp A→B được xử lý lại. | Tác vụ tự động được giao lần nữa. | Không tạo thêm Comparison hoàn tất trùng; lịch sử attempt theo CMP-016. |
| AC-CMP-013-13 | Một lần thử trước thất bại do sự cố có thể khắc phục, chưa có Comparison hoàn tất. | Thử lại. | Kiểm tra điều kiện hiện hành và giữ cặp A→B; không ghi đè kết quả đã hoàn tất của cặp nếu có. |
| AC-CMP-013-14 | Comparison tự động A→B đã ghi; người dùng thực hiện so thủ công hoặc so chuỗi. | Tác vụ thủ công hoàn tất. | Baseline và Result của Comparison tự động không bị thay đổi. |
| AC-CMP-013-15 | Người dùng không có quyền Project. | Truy cập trạng thái/kết quả tự động. | Không lộ Snapshot, reason hoặc dữ liệu nhạy cảm ngoài quyền. |

## 9. Clarification and Decision Log

| ID | Quyết định đã thống nhất | Trạng thái |
| --- | --- | --- |
| CL-CMP-013-01 | Chốt baseline ID trước Execution, tự so đúng baseline→target sau khi có Snapshot đủ điều kiện. | BA Approved |
| CL-CMP-013-02 | Snapshot đầu tiên được giữ, không có Comparison một phía hoặc SAME. | BA Approved |
| CL-CMP-013-03 | Run lỗi hoặc lưu target thất bại không kích hoạt Comparison; lỗi ghi đúng ngữ cảnh. | BA Approved |
| CL-CMP-013-04 | Từng API Execution trong Run đơn hoặc danh sách có cặp/kết quả độc lập. | BA Approved |
| CL-CMP-013-05 | Không tự thay baseline ID đã chốt khi invalidated, không đủ điều kiện hoặc input mismatch. | BA Approved |
| CL-CMP-013-06 | Qua CMP-005, so input trước output; chỉ phép so hoàn tất mới có SAME/DIFFERENT. | BA Approved |
| CL-CMP-013-07 | Comparison có thể chạy sau khi Snapshot lưu; UI thể hiện processing, không có Result tạm. | BA Approved |
| CL-CMP-013-08 | Lỗi Comparison không đảo Run/Snapshot thành công; lỗi Comparison được ghi riêng. | BA Approved |
| CL-CMP-013-09 | Sự kiện/tác vụ lặp không tạo nhiều Comparison hoàn tất trùng cùng Execution/cặp; CMP-016 chốt persistence. | BA Approved |
| CL-CMP-013-10 | Retry kiểm tra điều kiện hiện hành, giữ cặp và không ghi đè Comparison hoàn tất. | BA Approved |
| CL-CMP-013-11 | Comparison thủ công/so chuỗi độc lập, không sửa baseline hoặc Result tự động. | BA Approved |
| CL-CMP-013-12 | Chỉ xem theo quyền Project, lý do/chi tiết bảo vệ dữ liệu nhạy cảm. | BA Approved |

## 10. Dependencies and Handoff

| Reference | Ownership / handoff |
| --- | --- |
| CMP-003/004 | Chốt baseline trước Execution; phương thức so thủ công và so chuỗi độc lập. |
| CMP-005/006/007/001 | Điều kiện cặp, input trước output, raw comparison và điều kiện tạo SAME/DIFFERENT. |
| CMP-014/016 | Trạng thái/lý do không thể so; cấu trúc Comparison, attempt, retry, idempotency và lịch sử. |
| RUN/SNP | Execution Outcome, target Snapshot đủ điều kiện, lưu Snapshot thành công và tính bất biến. |
| AUTH/SEC và UI | Kiểm soát quyền; trình bày processing/result/reason an toàn cho người có quyền. |
