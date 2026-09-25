# REQ-CMP-011 — Latency không tạo DIFFERENT

**QC Tool · Group 6 Comparison Engine · BA FINAL · Priority: Must**  
**Trạng thái phân tích:** Clarification completed — BA Approved (10/10); phần chi tiết mở rộng baseline chờ Client Confirmation nếu quy trình dự án yêu cầu.

## 1. Requirement Information and Original Statement

> “Chênh lệch latency không làm kết quả thành DIFFERENT; latency chỉ được lưu và hiển thị để thống kê.”

| Thuộc tính | Nội dung |
| --- | --- |
| Requirement ID | REQ-CMP-011 |
| Tên | Latency không tạo DIFFERENT |
| Loại / ưu tiên | Functional / Must |
| Actor chính | QC Tool System |
| Actor liên quan | Người dùng có quyền yêu cầu hoặc xem Comparison trong Project |
| Phụ thuộc | CMP-001/003/004/005/006/007/014/015; yêu cầu Run, Snapshot và phân quyền liên quan |

## 2. Business Objective and Requirement Statements

Latency của một lần API Execution là số đo phục vụ quan sát hiệu năng. Việc so dữ liệu vẫn thực hiện theo hai bước: **input compatibility trước, actual output sau**. Chênh lệch ở latency metadata không được tự tạo output difference hoặc đổi Comparison Result. Một giá trị về thời gian do API trả về trong response lại là actual output và tuân theo phạm vi so output đã duyệt.

| ID | Requirement statement |
| --- | --- |
| RS-CMP-011-01 | QC Tool phải dùng latency đo cho từng API Execution gắn với Snapshot. Mốc bắt đầu/kết thúc phép đo tuân theo yêu cầu Run; không dùng thời gian engine thực hiện Comparison làm latency của Snapshot. |
| RS-CMP-011-02 | Latency metadata do QC Tool đo phải nằm ngoài tập dữ liệu input/output dùng để xác định compatibility và SAME/DIFFERENT. |
| RS-CMP-011-03 | Khi cặp hợp lệ, input compatible, output được so đầy đủ và giống nhau, chỉ khác latency metadata thì Result là SAME. |
| RS-CMP-011-04 | Khi input compatible và output được so đầy đủ nhưng khác, Result là DIFFERENT do output; chênh lệch latency được trình bày riêng và không thay đổi lý do kết luận. |
| RS-CMP-011-05 | Trường thời gian nằm trong actual response, ví dụ `durationMs` ở body hoặc `Server-Timing` ở header, vẫn thuộc output được so raw strict theo CMP-007, trừ khi có chính sách loại trừ cụ thể đã được phê duyệt. Không tự coi mọi trường mang tên timing là latency metadata. |
| RS-CMP-011-06 | Hệ thống phải lưu latency của từng Snapshot và, khi có đủ hai giá trị, hiển thị latency A, latency B cùng chênh lệch có chiều A→B; không gọi lại API để lấy số đo khi xem Comparison. |
| RS-CMP-011-07 | Đơn vị latency là mili giây (ms). Bản ghi lịch sử phải giữ độ chính xác đo được; việc làm tròn để hiển thị không được tác động đến dữ liệu gốc hoặc Comparison Result. |
| RS-CMP-011-08 | Nếu một phía không có latency hợp lệ, hiển thị “không có dữ liệu” cho phía đó và không tính chênh lệch; không thay thiếu dữ liệu bằng 0. Thiếu latency đơn thuần không chặn phép so dữ liệu đã đầy đủ. |
| RS-CMP-011-09 | Run lỗi không có Snapshot đủ điều kiện thì không tạo cặp Comparison theo CMP-005; latency nếu có của Run lỗi thuộc Run Result/Error, không phải latency của một Snapshot so sánh hợp lệ. |
| RS-CMP-011-10 | Latency được lưu/hiển thị cho thống kê trong phạm vi quyền truy cập. CMP-011 không định nghĩa ngưỡng hiệu năng, cảnh báo hoặc performance PASS/FAIL; khi so chuỗi, số đo trình bày theo từng cặp, không tạo Result hay phán đoán hiệu năng tổng hợp cho cả chuỗi. |

## 3. Scope and Boundaries

| Trong phạm vi CMP-011 | Thuộc yêu cầu liên quan |
| --- | --- |
| Phân biệt latency QC Tool đo với actual input/output; loại metadata này khỏi quyết định Result. | CMP-001 quyết định SAME/DIFFERENT sau gate input và so output đầy đủ; CMP-006/007 quyết định dữ liệu input/output thuộc phạm vi. |
| Lưu và trình bày số đo latency A/B, chênh lệch A→B; xử lý thiếu hoặc không hợp lệ. | Yêu cầu Run xác định mốc đo và trạng thái Run; yêu cầu Snapshot xác định lưu trữ dữ liệu lịch sử. |
| Xác định ảnh hưởng của latency trong từng cặp Comparison. | CMP-003/004 quản lý baseline và chuỗi; CMP-005/014 quản lý cặp đủ điều kiện, trạng thái không hoàn tất; CMP-015 quản lý Difference Detail. |
| Thống kê dựa trên số đo trong phạm vi quyền truy cập. | Chức năng thống kê, ngưỡng, cảnh báo và performance PASS/FAIL cần yêu cầu riêng nếu được triển khai. |

## 4. Actor, Trigger, Preconditions and Postconditions

| Mục | Quy tắc |
| --- | --- |
| Actor | QC Tool System đo/lưu và trình bày; người dùng có quyền Project yêu cầu hoặc xem Comparison. |
| Trigger | Một API Execution tạo Snapshot đủ điều kiện; hoặc người dùng mở Comparison của cặp Snapshot. |
| Preconditions để so | Cặp qua CMP-005; actual input và output cần so có đủ dữ liệu theo các yêu cầu liên quan. Latency có thể thiếu mà không tự làm mất điều kiện này. |
| Postcondition — SAME | Input compatible, output so đầy đủ và không khác; chênh lệch latency metadata chỉ được hiển thị riêng. |
| Postcondition — DIFFERENT | Input compatible, output so đầy đủ và có khác biệt thuộc phạm vi; latency không phải nguyên nhân riêng của Result. |
| Postcondition — không hoàn tất | Input mismatch, cặp không hợp lệ hoặc output chưa so đầy đủ: không tạo SAME/DIFFERENT theo CMP-001/014, bất kể latency có hay không. |

## 5. Business Rules

| ID | Business rule |
| --- | --- |
| BR-CMP-011-01 | Latency đo ở cấp API Execution/Snapshot là metadata của QC Tool, không phải actual request hoặc actual response. |
| BR-CMP-011-02 | Ký hiệu A là baseline Snapshot, B là target Snapshot; chênh lệch có chiều được tính **Δ latency = latency B − latency A**, đơn vị ms, khi cả hai hợp lệ. Dấu dương nghĩa B chậm hơn A theo số đo; dấu âm nghĩa B nhanh hơn A. |
| BR-CMP-011-03 | Metadata latency khác, bằng nhau, thiếu hoặc không hợp lệ không thể một mình tạo DIFFERENT, SAME hay input mismatch; Result do các gate dữ liệu quyết định. |
| BR-CMP-011-04 | Nếu actual response chứa giá trị thời gian, so nó như output theo CMP-007; việc loại trừ cần chính sách cụ thể được phê duyệt và có dấu vết theo các yêu cầu liên quan. |
| BR-CMP-011-05 | Latency lịch sử lấy từ Snapshot của từng phía; không đo lại, không suy ra từ lúc mở trang hoặc lúc chạy engine Comparison. |
| BR-CMP-011-06 | Lưu số đo ms với độ chính xác đã ghi nhận. Hiển thị có thể làm tròn nhất quán, nhưng phép tính chênh lệch dựa trên giá trị lưu, không dựa trên số đã làm tròn. |
| BR-CMP-011-07 | Thiếu hoặc không hợp lệ ở một phía: hiển thị “không có dữ liệu”; Δ latency không có dữ liệu. Không mặc định 0 và không làm thất bại Comparison nếu dữ liệu input/output đầy đủ. |
| BR-CMP-011-08 | Run lỗi không tạo Snapshot đủ điều kiện thì không lấy latency Run Error làm latency của một phía Comparison. |
| BR-CMP-011-09 | Giá trị latency và thống kê chỉ hiển thị cho người dùng có quyền đối với Project/dữ liệu tương ứng. |
| BR-CMP-011-10 | Trong chuỗi, xử lý latency độc lập cho từng cặp A→B; không tổng hợp các số đo thành một Result của chuỗi. |

## 6. Main Flow

1. QC Tool hoàn tất API Execution, đo latency theo mốc của yêu cầu Run và gắn số đo với Snapshot đủ điều kiện.
2. Khi so cặp Snapshot, hệ thống kiểm tra điều kiện cặp theo CMP-005, rồi so actual input theo CMP-006.
3. Nếu input compatible, hệ thống so actual output đầy đủ theo CMP-007 và các quy tắc dữ liệu liên quan. Latency metadata không tham gia hai bước so.
4. Sau khi phép so output hoàn tất, CMP-001 kết luận SAME nếu không có output difference thuộc phạm vi, hoặc DIFFERENT nếu có.
5. Hệ thống đọc latency lịch sử của A và B, trình bày từng giá trị ms; nếu cả hai hợp lệ, tính và hiển thị Δ latency theo chiều A→B, tách khỏi lý do Result.

## 7. Alternative and Exception Flows

| ID | Tình huống | Xử lý mong đợi |
| --- | --- | --- |
| ALT-01 | Chỉ latency metadata khác, input compatible và output giống nhau. | SAME; hiển thị A, B và Δ nếu đủ dữ liệu. |
| ALT-02 | Output khác và latency metadata cũng khác. | DIFFERENT do output; hiển thị latency riêng. |
| ALT-03 | Input không compatible dù latency bằng nhau. | Dừng trước output; không có SAME/DIFFERENT. |
| ALT-04 | Response body có `durationMs` hoặc header có `Server-Timing` khác. | So như actual output raw strict; có thể tạo DIFFERENT nếu input compatible, output so đầy đủ và không có chính sách loại trừ đã duyệt. |
| ALT-05 | Một phía thiếu hoặc có latency không hợp lệ. | Phía đó ghi “không có dữ liệu”; không tính Δ; so input/output tiếp tục nếu dữ liệu so đầy đủ. |
| ALT-06 | Giá trị lưu có nhiều chữ số thập phân hơn số hiển thị. | Giữ lịch sử và tính Δ từ giá trị lưu; hiển thị theo quy tắc làm tròn, không ảnh hưởng Result. |
| EXC-01 | Run lỗi, không có Snapshot đủ điều kiện. | Không tạo cặp; số đo Run lỗi nếu có ở Run Result/Error. |
| EXC-02 | Output thiếu/không đọc được nhưng có đủ latency. | Không suy ra Result từ latency; trạng thái và reason theo CMP-014. |
| ALT-07 | Chuỗi nhiều Snapshot. | Hiển thị latency theo từng cặp; các cặp độc lập, không có Result tổng hợp. |

## 8. Acceptance Criteria

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-CMP-011-01 | Cặp hợp lệ; input compatible; output giống nhau và so đầy đủ; A = 120 ms, B = 150 ms. | Hoàn tất Comparison. | Result SAME; hiển thị A = 120 ms, B = 150 ms, Δ = +30 ms. |
| AC-CMP-011-02 | Cặp hợp lệ; input compatible; output khác và so đầy đủ; A = 150 ms, B = 120 ms. | Hoàn tất Comparison. | Result DIFFERENT do output; hiển thị Δ = −30 ms riêng. |
| AC-CMP-011-03 | Input của A/B không compatible; latency bằng nhau. | So cặp. | Dừng trước output; không tạo SAME/DIFFERENT. |
| AC-CMP-011-04 | Cặp hợp lệ, input compatible, output body chỉ khác trường `durationMs`; không có chính sách loại trừ. | So output hoàn tất. | DIFFERENT do actual output, không áp dụng miễn trừ dành cho latency metadata. |
| AC-CMP-011-05 | Cặp hợp lệ, input compatible, output header `Server-Timing` khác; không có chính sách loại trừ. | So output hoàn tất. | DIFFERENT theo so header của CMP-007. |
| AC-CMP-011-06 | Cặp hợp lệ, input compatible, output giống nhau; B thiếu latency. | Xem Comparison. | SAME; B hiển thị “không có dữ liệu”, không có Δ; A vẫn hiển thị giá trị lưu. |
| AC-CMP-011-07 | Cặp hợp lệ, input compatible, output khác; A có latency không hợp lệ. | Xem Comparison. | DIFFERENT do output; A hiển thị “không có dữ liệu”, không tính Δ hoặc thay bằng 0. |
| AC-CMP-011-08 | A/B có số đo lịch sử với độ chính xác cao hơn số trình bày. | Mở lại Comparison nhiều lần. | Dùng số đo đã lưu để tính Δ; không gọi lại API; Result không đổi do làm tròn. |
| AC-CMP-011-09 | Run B lỗi và không có Snapshot đủ điều kiện. | Yêu cầu so A với B. | Không tạo Comparison hợp lệ; latency Run B nếu có thuộc Run Result/Error. |
| AC-CMP-011-10 | Chuỗi có nhiều cặp Snapshot đủ điều kiện. | Xem chuỗi. | Mỗi cặp hiển thị latency A/B/Δ theo dữ liệu của cặp; không có Result/performance PASS/FAIL tổng hợp cho chuỗi. |
| AC-CMP-011-11 | Output chưa so hoàn tất nhưng hai phía có latency. | Engine dừng. | Không kết luận SAME/DIFFERENT từ latency; reason theo CMP-014. |
| AC-CMP-011-12 | Người dùng không có quyền xem dữ liệu Project. | Truy cập latency/statistics của Comparison. | Không hiển thị dữ liệu vượt phạm vi quyền. |

## 9. Clarification and Decision Log

| ID | Quyết định đã thống nhất | Trạng thái |
| --- | --- | --- |
| CL-CMP-011-01 | Latency là số đo per API Execution gắn Snapshot; mốc đo theo Run, không phải thời gian Comparison. | BA Approved |
| CL-CMP-011-02 | Loại latency metadata khỏi so input/output; chỉ khác nó và output giống nhau thì SAME sau input compatible và so đủ. | BA Approved |
| CL-CMP-011-03 | Output khác và so đủ thì DIFFERENT do output; latency khác được trình bày riêng. | BA Approved |
| CL-CMP-011-04 | Timing field trong actual response vẫn là output raw strict nếu chưa có chính sách loại trừ được duyệt. | BA Approved |
| CL-CMP-011-05 | Lưu latency mỗi Snapshot; hiển thị A, B, chênh lệch A→B khi đủ; không gọi lại API. | BA Approved |
| CL-CMP-011-06 | Đơn vị ms; giữ độ chính xác lịch sử; làm tròn trình bày không đổi Result. | BA Approved |
| CL-CMP-011-07 | Thiếu/không hợp lệ một phía hiển thị “không có dữ liệu,” không giả 0/Δ và không chặn so dữ liệu đầy đủ. | BA Approved |
| CL-CMP-011-08 | Run lỗi không có Snapshot đủ điều kiện thì không so; latency Run lỗi ở Run Result/Error. | BA Approved |
| CL-CMP-011-09 | Thống kê theo quyền; không có ngưỡng hoặc performance PASS/FAIL trong CMP-011. | BA Approved |
| CL-CMP-011-10 | Chuỗi hiển thị latency theo từng cặp; không có Result/phán đoán hiệu năng tổng hợp. | BA Approved |

## 10. Dependencies and Handoff

| Reference | Ownership / handoff |
| --- | --- |
| CMP-001/005/006/007 | Điều kiện cặp, input compatibility, raw strict của actual output và thời điểm kết luận SAME/DIFFERENT. |
| CMP-003/004 | Baseline đã chọn và các cặp độc lập trong chuỗi. |
| CMP-014/015 | Trạng thái/reason không hoàn tất và Difference Detail; latency trình bày riêng với output difference. |
| Run / Snapshot | Mốc đo API Execution, lưu latency lịch sử, xử lý Run lỗi và Snapshot đủ điều kiện. |
| Authorization / Statistics | Quyền truy cập Project và thống kê latency; ngưỡng/cảnh báo/performance PASS/FAIL cần yêu cầu riêng. |
