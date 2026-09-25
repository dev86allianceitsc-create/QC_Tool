---
title: Detail Requirement
---

REQ-CMP-005 Snapshot Compatibility

QC Tool \| Group 6 Comparison Engine \| BA FINAL \| Priority Must

Tài liệu xác định khi nào một cặp Snapshot được phép đi tiếp tới bước
kiểm tra input của Comparison. Chín clarification đã được Quỳnh duyệt ở
cấp BA. CMP-005 kiểm tra tư cách từng Snapshot và ngữ cảnh lịch sử của
cặp; CMP-006 đối chiếu input sau đó, rồi mới đến so output theo CMP-001.
Những chi tiết trạng thái và thuật toán thuộc các requirement chuyên
trách được nêu rõ ở phần handoff.

# 1 Requirement Information and Original Statement

Requirement gốc: "Chỉ các Snapshot của cùng API, cùng Environment và
cùng auth context mới được so sánh."

  -----------------------------------------------------------------------
  **Field**        **Value**
  ---------------- ------------------------------------------------------
  Requirement ID   REQ-CMP-005 --- Snapshot Compatibility
  and name         

  Type and         Functional / Must
  priority         

  Primary actor    QC Tool System

  Related actor    Người dùng có quyền truy cập Project và yêu cầu
                   Compare thủ công

  Analysis status  Clarification completed --- BA Approved (9/9); Detail
                   Requirement BA FINAL; Client Confirmation pending
                   where BA detail extends baseline

  Dependencies     CMP-001/003/004/006/014/017/018; SNP-001 đến SNP-008;
                   ENV-004; AUTH/SEC; Project/API/Environment lifecycle
  -----------------------------------------------------------------------

# 2 Business Objective and Requirement Statements

Mục tiêu là chỉ đưa những Snapshot cùng đối tượng API, Environment và
danh tính xác thực lịch sử vào phép đối chiếu. Cặp không đạt điều kiện
được giải thích rõ, không tạo SAME/DIFFERENT; cặp đạt điều kiện mới tiếp
tục so input, rồi output nếu input tương thích.

RS-CMP-005-01 --- Hệ thống phải kiểm tra tư cách của từng Snapshot trước
khi ghép cặp: bản lưu hoàn tất, dữ liệu cần dùng có thể truy xuất đầy đủ
theo phạm vi CMP-017/018 và chưa bị vô hiệu hóa.

RS-CMP-005-02 --- Hai Snapshot chỉ tương thích về ngữ cảnh khi cùng
Project ID, API ID, Environment ID và Authentication Context ổn định
được lưu từ Execution nguồn.

RS-CMP-005-03 --- Hệ thống không được ghép cặp chỉ dựa vào tên Project,
API, Environment, URL hiện tại hoặc token/credential tạm thời; đổi tên
không làm thay đổi ID lịch sử.

RS-CMP-005-04 --- Auth context phải xác định được ở cả hai Snapshot.
Rotate token của cùng danh tính/quyền target không tự làm khác context;
đổi danh tính hoặc quyền target được phân biệt theo chính sách AUTH đã
chốt.

RS-CMP-005-05 --- Nếu một Snapshot đã vô hiệu hóa, hệ thống không được
tạo Comparison mới với bản đó, kể cả người dùng chọn thủ công.
Comparison lịch sử đã tồn tại vẫn được giữ để truy vết.

RS-CMP-005-06 --- API Version, Database Version, thời điểm Run, tuổi
Snapshot, thay đổi cấu hình request và trạng thái hiện tại của đối tượng
nguồn không tự làm cặp mất tương thích về ngữ cảnh.

RS-CMP-005-07 --- Cặp đạt CMP-005 phải được đưa sang CMP-006 để đối
chiếu input. CMP-005 không dùng input giống/khác làm tiêu chí ghép cặp;
nếu CMP-006 xác định mismatch thì không tiếp tục so output và không có
Result theo CMP-001.

RS-CMP-005-08 --- Hai Snapshot phải có Snapshot ID khác nhau. Điều kiện
tương thích áp dụng như nhau cho Comparison tự động và thủ công; phương
thức và chiều chọn cặp thuộc CMP-003/004.

RS-CMP-005-09 --- Cặp thiếu ngữ cảnh bắt buộc, bản lưu dở, invalidated,
thiếu/hỏng payload hoặc format chưa được hỗ trợ không được kết luận
SAME/DIFFERENT; trạng thái và lý do do CMP-014/017/018 quy định.

# 3 Scope and Boundaries

  -----------------------------------------------------------------------
  **In scope of CMP-005**             **Owned by related requirement**
  ----------------------------------- -----------------------------------
  Eligibility của từng Snapshot và    SNP-001/006 xác định Snapshot hoàn
  cặp theo                            tất; SNP-002/005 sở hữu
  Project/API/Environment/auth        invalidation và retention; SNP-008
  context lịch sử; Snapshot ID phải   sở hữu định danh lịch sử.
  khác nhau.                          

  Không tự loại cặp vì version, tuổi, CMP-003/004 chọn cặp, thứ tự
  request thay đổi hoặc nguồn hiện    baseline/latest và hướng hiển thị;
  inactive; áp dụng cùng điều kiện    CMP-012 xử lý version.
  cho tự động và thủ công.            

  Chuyển cặp hợp lệ sang bước so      CMP-006 định nghĩa trường input và
  input; không gộp input mismatch vào quy tắc tương thích; CMP-007 đến
  compatibility ngữ cảnh.             CMP-010 định nghĩa output strict.

  Không kết luận khi thiếu/hỏng dữ    CMP-014 quy định trạng thái/lý do;
  liệu hoặc format không hỗ trợ.      CMP-017/018 quy định loại payload
                                      và tính đầy đủ/bảo mật; SEC áp dụng
                                      quyền hiện hành.
  -----------------------------------------------------------------------

# 4 Actor Trigger Preconditions and Postconditions

  -----------------------------------------------------------------------
  **Field**       **Rule**
  --------------- -------------------------------------------------------
  Actor           QC Tool System kiểm tra cặp; người dùng có quyền
                  Project có thể yêu cầu Compare theo CMP-004.

  Trigger         Luồng tự động sau Run xác định hai Snapshot hoặc người
                  dùng chọn hai Snapshot để Compare.

  Preconditions   Các Snapshot được tham chiếu theo ID và có ngữ cảnh
                  lịch sử đã lưu; quyền truy cập hiện hành được kiểm tra
                  theo Project/SEC.

  Success         Cả hai bản đủ điều kiện, ID khác nhau, cùng bốn chiều
                  ngữ cảnh; hệ thống cho phép chuyển sang bước đối chiếu
                  input của CMP-006.

  Failure         Không thực hiện bước đối chiếu input/output khi cặp
                  không hợp lệ; không tạo SAME/DIFFERENT. Trạng thái/lý
                  do theo CMP-014.
  -----------------------------------------------------------------------

# 5 Business Rules

  ------------------------------------------------------------------------
  **ID**          **Business rule**
  --------------- --------------------------------------------------------
  BR-CMP-005-01   Kiểm tra từng Snapshot riêng trước khi kiểm tra cặp:
                  phải hoàn tất, không bị invalidated và có dữ liệu cần
                  thiết theo CMP-017/018.

  BR-CMP-005-02   Cặp phải có hai Snapshot ID khác nhau, cùng Project ID,
                  API ID, Environment ID và auth context ổn định tại thời
                  điểm Execution.

  BR-CMP-005-03   Trùng tên API/Environment/Project không đủ căn cứ; khác
                  ID thì không ghép. Đổi tên nhưng ID không đổi không tự
                  loại cặp.

  BR-CMP-005-04   Không dùng token/password tạm để định danh auth context.
                  Không xác định được context ở một bên thì không tự giả
                  định hai bên giống nhau.

  BR-CMP-005-05   Đổi token cùng danh tính/quyền target không tự đổi
                  context; đổi danh tính/quyền target phải được phân biệt
                  theo AUTH/SNP-008.

  BR-CMP-005-06   Invalidated ở bất kỳ bên nào chặn tạo Comparison mới, kể
                  cả chọn thủ công. Lịch sử Comparison đã tạo trước quyết
                  định invalidation không bị xóa hay sửa ngầm.

  BR-CMP-005-07   Version và tuổi không phải điều kiện loại cặp; API/DB
                  Version khác nhau thuộc thông tin bổ sung CMP-012.

  BR-CMP-005-08   Method, URL, params, headers và body của request có thay
                  đổi không được CMP-005 tự diễn giải là input mismatch;
                  CMP-006 thực hiện đối chiếu actual input.

  BR-CMP-005-09   Project/API/Environment hiện inactive hoặc xóa mềm không
                  làm thay đổi ID và ngữ cảnh Snapshot cũ; việc truy cập
                  vẫn phải theo quyền hiện hành.

  BR-CMP-005-10   Tư cách cặp là điều kiện cần, chưa đủ để có Result. Chỉ
                  CMP-001 sau khi CMP-006 và phép so output hoàn tất mới
                  được kết luận SAME/DIFFERENT.

  BR-CMP-005-11   Tự động và thủ công phải qua cùng gate. CMP-005 không tự
                  chọn lại một Snapshot cũ khác khi cặp được cung cấp
                  không đạt điều kiện.
  ------------------------------------------------------------------------

# 6 Main Flow

1.  Hệ thống nhận hai Snapshot ID từ phương thức chọn cặp theo
    CMP-003/004 và kiểm tra quyền Project hiện hành.

2.  Hệ thống xác nhận hai ID khác nhau, từng Snapshot hoàn tất, không
    invalidated và có thể truy xuất dữ liệu cần cho Comparison.

3.  Hệ thống đối chiếu Project ID, API ID, Environment ID và
    Authentication Context ổn định đã lưu ở cả hai bản.

4.  Nếu bốn chiều ngữ cảnh khớp và cặp đủ điều kiện, hệ thống chuyển
    đúng cặp sang CMP-006 để đối chiếu actual input.

5.  Chỉ sau khi input đạt quy tắc CMP-006, phép so output mới có thể
    thực hiện và CMP-001 mới được kết luận SAME/DIFFERENT.

# 7 Alternative and Exception Flows

  ----------------------------------------------------------------------------
  **ID**   **Situation**             **Expected behavior**
  -------- ------------------------- -----------------------------------------
  ALT-01   API/Environment đổi tên,  Không loại cặp chỉ do tên thay đổi; vẫn
           ID giữ nguyên             kiểm tra các điều kiện khác.

  ALT-02   API/DB Version khác nhau  Không loại chỉ vì version/tuổi; version
           hoặc Snapshot rất cũ      hiển thị theo CMP-012.

  ALT-03   Token rotate cùng danh    Không coi token mới là auth context mới
           tính/quyền target         nếu AUTH/SNP-008 xác nhận cùng context.

  ALT-04   Nguồn lịch sử             Vẫn xét Snapshot lịch sử theo ID và quyền
           inactive/soft deleted     hiện hành, không dựa vào trạng thái cấu
                                     hình hiện tại để sửa lịch sử.

  ALT-05   Input thực tế khác dù cặp CMP-005 cho đi tiếp; CMP-006 quyết định
           cùng ngữ cảnh             tương thích input và chặn output khi
                                     mismatch.

  EXC-01   Khác                      Cặp không tương thích; không chuyển sang
           Project/API/Environment   đối chiếu input/output; không tạo Result.
           ID hoặc auth context      

  EXC-02   Thiếu auth context hoặc   Không giả định context hoặc so bản với
           cùng Snapshot ID          chính nó; không tạo Result.

  EXC-03   Một bản invalidated, dù   Không tạo Comparison mới; giữ bản gốc và
           chọn thủ công             các Comparison lịch sử đã có.

  EXC-04   Payload thiếu/hỏng hoặc   Không kết luận SAME/DIFFERENT; trạng
           định dạng chưa hỗ trợ     thái/lý do theo CMP-014/017/018.
  ----------------------------------------------------------------------------

# 8 Acceptance Criteria

  --------------------------------------------------------------------------------------
  **ID**          **Given**                      **When**    **Then**
  --------------- ------------------------------ ----------- ---------------------------
  AC-CMP-005-01   S1/S2 hoàn tất, khác ID, cùng  Yêu cầu     Cặp đạt CMP-005 và được
                  Project/API/Environment/auth   Compare     chuyển sang CMP-006; chưa
                  context, không invalidated                 có SAME/DIFFERENT ở bước
                                                             này.

  AC-CMP-005-02   Hai API cùng tên nhưng khác    Yêu cầu     Cặp không tương thích;
                  API ID                         Compare     không so input/output.

  AC-CMP-005-03   Cùng API ID, Environment ID    Yêu cầu     Tên đổi không tự làm cặp
                  nhưng Environment đổi tên sau  Compare     không tương thích.
                  S1                             S1/S2       

  AC-CMP-005-04   S1 ở DEV, S2 ở UAT, khác       Yêu cầu     Cặp không tương thích dù
                  Environment ID                 Compare     API, tên hoặc output giống
                                                             nhau.

  AC-CMP-005-05   S1/S2 cùng auth context, token Yêu cầu     Token khác không tự làm cặp
                  được rotate giữa hai Run       Compare     không tương thích.

  AC-CMP-005-06   S2 dùng danh tính/quyền target Yêu cầu     Cặp không tương thích về
                  khác S1 theo AUTH              Compare     auth context.

  AC-CMP-005-07   Một bản không xác định được    Yêu cầu     Không tự gán context bằng
                  auth context                   Compare     nhau; không so
                                                             input/output.

  AC-CMP-005-08   S1 đã invalidated; S1 và S2    Chọn thủ    Không tạo C2; C1 và bằng
                  từng có Comparison C1          công S1/S2  chứng gốc vẫn được giữ để
                                                 lần nữa     truy vết.

  AC-CMP-005-09   S1/S2 cùng ngữ cảnh, API       Yêu cầu     Không loại cặp chỉ vì
                  Version khác và S1 đã nhiều    Compare     version hoặc tuổi.
                  năm tuổi                                   

  AC-CMP-005-10   S1/S2 cùng ngữ cảnh nhưng      Yêu cầu     CMP-005 cho chuyển CMP-006;
                  request id khác                Compare     nếu CMP-006 kết luận
                                                             mismatch thì không so
                                                             output và không có Result.

  AC-CMP-005-11   Project/API hiện inactive hoặc Yêu cầu     Trạng thái hiện tại không
                  soft deleted; người dùng vẫn   Compare hai tự loại cặp; quyền hiện
                  có quyền xem lịch sử           bản hợp lệ  hành vẫn được kiểm tra.

  AC-CMP-005-12   S1 payload hỏng/thiếu, hoặc    Yêu cầu     Không tạo Result; ghi nhận
                  chọn S1 so với chính S1        Compare     lý do theo requirement
                                                             chuyên trách.

  AC-CMP-005-13   Cặp không tương thích được gửi Kiểm tra    Cả hai phương thức cùng bị
                  từ luồng tự động hoặc thủ công cặp         chặn và không tự chuyển
                                                             sang cặp khác.
  --------------------------------------------------------------------------------------

# 9 Clarification and Decision Log

  ---------------------------------------------------------------------------------
  **CL-CMP-005**   **Decision approved by BA**                         **Status**
  ---------------- --------------------------------------------------- ------------
  01               Cùng Project ID và API ID lịch sử; trùng tên/URL    BA Approved
                   không đủ.                                           

  02               Environment ID lịch sử phải khớp; đổi tên không ảnh BA Approved
                   hưởng, DEV/UAT khác ID không so.                    

  03               Auth context ổn định; không so token, không giả     BA Approved
                   định giống nhau khi thiếu context.                  

  04               Invalidated ở bất kỳ bên nào chặn Comparison mới kể BA Approved
                   cả thủ công; giữ Comparison lịch sử.                

  05               Version, thời điểm Run và tuổi Snapshot không tự    BA Approved
                   chặn cặp.                                           

  06               Request thay đổi thuộc CMP-006, không là gate       BA Approved
                   CMP-005.                                            

  07               Nguồn hiện inactive/soft deleted không xóa tư cách  BA Approved
                   Snapshot lịch sử; kiểm tra quyền hiện hành.         

  08               Payload thiếu/hỏng hoặc format chưa hỗ trợ: không   BA Approved
                   Result; chi tiết CMP-014/017/018.                   

  09               Không so một Snapshot với chính nó; chiều cặp thuộc BA Approved
                   CMP-004.                                            
  ---------------------------------------------------------------------------------

# 10 Dependencies and Handoff

  ---------------------------------------------------------------------------------------
  **Reference**                     **Ownership and handoff**
  --------------------------------- -----------------------------------------------------
  SNP-001/002/003/004/005/006/008   Bản hoàn tất, invalidation, dữ liệu đầy đủ, retention
                                    và định danh Project/API/Environment/auth context
                                    lịch sử.

  CMP-001/006                       CMP-005 là gate cặp; CMP-006 kiểm tra input; CMP-001
                                    chỉ kết luận sau khi output so hoàn tất.

  CMP-003/004/014                   Chọn baseline, phương thức/chiều cặp và trạng thái/lý
                                    do không thể so.

  CMP-012/017/018                   Version là thông tin phụ; format, completeness và
                                    security boundary được chốt riêng.

  ENV-004; AUTH/SEC                 Không so chéo Environment; nhận diện auth context ổn
                                    định và kiểm tra quyền hiện hành.
  ---------------------------------------------------------------------------------------

Handoff gate: Claude phải kiểm tra cùng bốn ID/ngữ cảnh lịch sử và tư
cách từng Snapshot trước CMP-006. Không dùng tên hiển thị, token tạm,
API Version hay request input để thay quy tắc của CMP-005; không tạo
SAME/DIFFERENT cho cặp không hợp lệ. CMP-003 quyết định baseline gần
nhất trước Run mới; CMP-005 không tự tìm bản khác để thay cặp đã chọn.
Trạng thái/mã lý do, dữ liệu thiếu và format chưa hỗ trợ chỉ được chốt
khi CMP-014/017/018 hoàn tất.
