---
title: Detail Requirement
---

REQ-CMP-001 Comparison Result SAME and DIFFERENT

QC Tool \| Group 6 Comparison Engine \| BA FINAL \| Priority Must

Tài liệu định nghĩa điều kiện để QC Tool kết luận SAME hoặc DIFFERENT từ
một cặp Snapshot. Mười clarification đã được Quỳnh duyệt ở cấp BA;
CL-CMP-001-03 được làm rõ thêm: hệ thống đối chiếu cả input và output
theo thứ tự, và chỉ kết luận sau khi bước input đạt quy tắc tương thích.
Các quy tắc trường dữ liệu và thuật toán chi tiết được chốt ở những
requirement CMP liên quan.

# 1 Requirement Information and Statement

Requirement gốc: "Kết quả chức năng cốt lõi phải là SAME hoặc DIFFERENT;
hệ thống không tự kết luận thay đổi là đúng, sai hoặc do nguyên nhân
nào."

  -------------------------------------------------------------------------------
  **Field**        **Value**
  ---------------- --------------------------------------------------------------
  Requirement ID   REQ-CMP-001 --- Comparison Result
  and name         

  Type and         Functional / Must
  priority         

  Primary actor    QC Tool System

  Related actor    Người dùng có quyền truy cập Project

  Analysis status  Clarification completed --- BA Approved (10/10); Detail
                   Requirement BA FINAL; Client Confirmation pending where
                   applicable

  Dependencies     SNP-001 đến SNP-008;
                   CMP-003/005/006/007/008/009/010/011/012/014/015/016/017/018;
                   CMP-002 and OUT-002
  -------------------------------------------------------------------------------

# 2 Business Objective and Requirement Statements

Mục tiêu là cho QA/QC biết dữ liệu giữa hai lần thực thi có thay đổi
trong phạm vi so sánh hợp lệ hay không. Kết luận này không xác nhận API
đúng nghiệp vụ, không tự gán lỗi, nguyên nhân hoặc Expected/Unexpected.

RS-CMP-001-01 --- Comparison sử dụng dữ liệu của hai Snapshot hoàn tất,
đủ điều kiện và tương thích; không dùng bản Run Result đã truncate hoặc
cấu hình hiện tại thay thế.

RS-CMP-001-02 --- Comparison Result chỉ nhận SAME hoặc DIFFERENT khi
phép so sánh hợp lệ hoàn tất. Trạng thái thực thi Comparison được quản
lý riêng; trường Result không có giá trị khi chưa thể kết luận.

RS-CMP-001-03 --- Hệ thống phải đối chiếu input của hai Snapshot trước
theo CMP-006. Chỉ khi input đạt quy tắc tương thích mới đối chiếu output
theo các quy tắc CMP; không được bỏ qua bước input.

RS-CMP-001-04 --- SAME chỉ được tạo khi cặp Snapshot hợp lệ, input đạt
quy tắc tương thích, việc đối chiếu output hoàn tất và không có khác
biệt nào trong phạm vi dữ liệu được so sánh.

RS-CMP-001-05 --- DIFFERENT chỉ được tạo khi cặp Snapshot hợp lệ, input
đạt quy tắc tương thích, việc đối chiếu output hoàn tất và phát hiện ít
nhất một khác biệt trong phạm vi output được so sánh.

RS-CMP-001-06 --- Nếu input không tương thích, hệ thống dừng trước bước
output, ghi nhận kết quả kiểm tra input, và không tạo SAME/DIFFERENT.
Input mismatch không được mạo nhận là output đã đổi.

RS-CMP-001-07 --- Không có baseline hoặc không có Snapshot mới đủ điều
kiện thì không tạo kết quả SAME/DIFFERENT giả; Run Result và Snapshot
hiện có giữ nguyên dữ liệu thực tế.

RS-CMP-001-08 --- Chỉ latency hoặc API/DB Version thay đổi không tự tạo
DIFFERENT nếu dữ liệu output trong phạm vi Comparison giống nhau; thay
đổi đó được quản lý như thông tin bổ sung.

RS-CMP-001-09 --- Hệ thống không tự kết luận DIFFERENT là bug, đúng/sai,
Expected/Unexpected hoặc nguyên nhân thay đổi.

RS-CMP-001-10 --- Comparison Result được quản lý riêng và gắn với cặp
Snapshot tham gia; việc so sánh không sửa nội dung Snapshot bất biến.

# 3 Scope and Boundaries

  -----------------------------------------------------------------------
  **In scope of CMP-001**             **Owned by related requirement**
  ----------------------------------- -----------------------------------
  Ý nghĩa và điều kiện tối thiểu để   CMP-006 chốt trường input và tiêu
  tạo SAME/DIFFERENT; trình tự kiểm   chí tương thích; CMP-007 đến
  tra input rồi output.               CMP-010/017 chốt phạm vi output,
                                      strict rules và format.

  Tách Result khỏi trạng thái không   CMP-005/014 chốt eligibility, trạng
  thể kết luận; không kết luận khi    thái, mã lý do; CMP-003/004 chốt
  thiếu cặp, input mismatch hoặc bước baseline và chọn cặp.
  so sánh chưa hoàn tất.              

  Loại latency và version khỏi căn cứ CMP-011/012 chốt thông tin phụ;
  tự động tạo DIFFERENT; không tự     CMP-002 chốt classification;
  đánh giá đúng/sai.                  OUT-002 chốt cách hiển thị.

  Không sửa Snapshot khi tạo          CMP-015/016 chốt difference detail,
  Comparison Result.                  persistence, history và liên kết
                                      vật lý.
  -----------------------------------------------------------------------

# 4 Actor Trigger Preconditions and Postconditions

  ------------------------------------------------------------------------
  **Field**        **Rule**
  ---------------- -------------------------------------------------------
  Actor            QC Tool System thực hiện; người dùng có quyền Project
                   có thể yêu cầu so sánh theo CMP-004.

  Trigger          Một cặp Snapshot được xác định bởi luồng tự động sau
                   Run hoặc thao tác Compare hợp lệ.

  Preconditions    Hai Snapshot hoàn tất, đủ điều kiện, thuộc cặp được
                   phép so sánh theo CMP-005; dữ liệu bắt buộc cho phép
                   đối chiếu theo CMP-018.

  Success          Input được đối chiếu và đạt quy tắc CMP-006, output
                   được đối chiếu hoàn tất; kết quả là SAME hoặc DIFFERENT
                   và có thể liên kết với đúng cặp Snapshot.

  Non-conclusive   Không có cặp đủ điều kiện, input không tương thích hoặc
                   quá trình chưa hoàn tất: không có Result
                   SAME/DIFFERENT; trạng thái/lý do cụ thể thuộc CMP-014.
  ------------------------------------------------------------------------

# 5 Business Rules

  ------------------------------------------------------------------------
  **ID**          **Business rule**
  --------------- --------------------------------------------------------
  BR-CMP-001-01   SAME/DIFFERENT là kết quả của một phép so sánh hợp lệ
                  giữa hai Snapshot xác định, không phải Execution Outcome
                  hay trạng thái Snapshot.

  BR-CMP-001-02   SAME nghĩa là bước input đã được thực hiện và đạt quy
                  tắc tương thích, output được so sánh đầy đủ theo phạm vi
                  đã chốt và không có khác biệt.

  BR-CMP-001-03   DIFFERENT nghĩa là bước input đã được thực hiện và đạt
                  quy tắc tương thích, output được so sánh đầy đủ và có ít
                  nhất một khác biệt.

  BR-CMP-001-04   Input mismatch là một kết quả kiểm tra input riêng;
                  output không được so và Comparison Result rỗng. Không
                  suy diễn DIFFERENT từ hai input khác nhau.

  BR-CMP-001-05   Không có baseline hoặc Snapshot mới không hợp lệ: không
                  được gán SAME theo mặc định hay DIFFERENT từ lỗi Run.

  BR-CMP-001-06   HTTP 4xx/5xx và lỗi transport không tự sinh Snapshot
                  response hợp lệ theo Group 5; bằng chứng lỗi thuộc Run
                  Result, không chuyển thành DIFFERENT.

  BR-CMP-001-07   Latency và API/DB Version là metadata bổ sung; chỉ thay
                  đổi các giá trị đó không ảnh hưởng SAME/DIFFERENT. Chính
                  sách UNKNOWN thuộc CMP-012.

  BR-CMP-001-08   Phạm vi trường input/output, việc một HTTP
                  status/header/body khác nhau có tạo DIFFERENT hay không,
                  và cách xử lý payload format do CMP-006/007/017/018
                  quyết định.

  BR-CMP-001-09   SAME không chứng minh API đúng; DIFFERENT không chứng
                  minh bug. Classification của người dùng là thông tin
                  riêng theo CMP-002.

  BR-CMP-001-10   Một Snapshot có thể tham gia nhiều Comparison; Result
                  thuộc Comparison tương ứng và không ghi đè nội dung
                  Snapshot.
  ------------------------------------------------------------------------

# 6 Main Flow

1.  Hệ thống nhận đúng cặp Snapshot do luồng tự động hoặc người dùng
    chọn và kiểm tra điều kiện cặp theo CMP-005.

2.  Hệ thống đối chiếu input được lưu trong hai Snapshot theo CMP-006 và
    ghi nhận kết quả kiểm tra input.

3.  Nếu input tương thích, hệ thống đối chiếu output đã lưu theo phạm vi
    và các quy tắc CMP-007 đến CMP-010/017/018.

4.  Khi đối chiếu output hoàn tất, hệ thống xác định SAME nếu không có
    khác biệt; nếu có ít nhất một khác biệt, xác định DIFFERENT.

5.  Hệ thống gắn Result với Comparison của đúng cặp Snapshot, giữ nguyên
    Snapshot và cung cấp kết quả để lưu/hiển thị theo
    CMP-015/016/OUT-002.

# 7 Alternative and Exception Flows

  --------------------------------------------------------------------------
  **ID**   **Situation**           **Expected behavior**
  -------- ----------------------- -----------------------------------------
  ALT-01   Lần Run đầu tạo S1,     Lưu S1; không tạo SAME/DIFFERENT.
           chưa có baseline        CMP-003/014 quyết định biểu diễn trường
                                   hợp này.

  ALT-02   Input S1 và S2 không    Ghi nhận input mismatch; dừng trước
           tương thích             output; Result không có giá trị.

  ALT-03   Chỉ latency hoặc        Nếu input đạt kiểm tra và output giống
           version khác            nhau, Result SAME; thông tin phụ xử lý
                                   theo CMP-011/012.

  ALT-04   Output có một khác biệt Sau khi input đạt kiểm tra và output so
           thuộc phạm vi           hoàn tất, Result DIFFERENT; chi tiết theo
                                   CMP-015.

  EXC-01   Run 4xx/5xx hoặc lỗi    Giữ outcome/HTTP status và bằng chứng lỗi
           transport không tạo     thực tế ở Run Result; không có
           Snapshot mới            SAME/DIFFERENT.

  EXC-02   Lưu Snapshot thất bại   Không dùng bản dở/truncated để kết luận;
           hoặc payload không đủ   trạng thái/lý do theo CMP-014/018.
           cho Comparison          

  EXC-03   Lỗi khi so output trước Không kết luận SAME/DIFFERENT từ phần đã
           khi hoàn tất            so; trạng thái xử lý theo CMP-014.
  --------------------------------------------------------------------------

# 8 Acceptance Criteria

  ------------------------------------------------------------------------------
  **ID**          **Given**              **When**     **Then**
  --------------- ---------------------- ------------ --------------------------
  AC-CMP-001-01   Hai Snapshot hoàn tất, So sánh hoàn Result SAME và liên kết
                  đủ điều kiện; input    tất          với đúng cặp Snapshot.
                  đạt CMP-006; output                 
                  trong phạm vi giống                 
                  nhau                                

  AC-CMP-001-02   Như trên nhưng một     So sánh hoàn Result DIFFERENT; không tự
                  thành phần output      tất          gán bug hoặc
                  thuộc phạm vi khác                  Expected/Unexpected.
                  nhau                                

  AC-CMP-001-03   S1 input id=1001, S2   Bắt đầu      Input mismatch được ghi
                  input id=1002 và       Comparison   nhận; output không được
                  CMP-006 xác định không              so; Result không có giá
                  tương thích                         trị.

  AC-CMP-001-04   S1 là Snapshot đầu     Run tạo S1   S1 được lưu; không có kết
                  tiên của cùng          thành công   luận SAME/DIFFERENT giả.
                  API/Environment/auth                
                  context                             

  AC-CMP-001-05   S1 tồn tại; Run tiếp   Run hoàn tất Lỗi ở Run Result; không có
                  theo trả HTTP 500,                  DIFFERENT hay SAME mới.
                  không tạo S2 hợp lệ                 

  AC-CMP-001-06   Input đạt kiểm tra,    So sánh hoàn Result SAME; thay đổi
                  output giống nhau,     tất          latency/version được xử lý
                  latency 150→300 ms và               riêng.
                  API Version 1.0→2.0                 

  AC-CMP-001-07   S1 tham gia C1 với S2  Hai          Mỗi Comparison giữ Result
                  và C2 với S3           Comparison   riêng; nội dung S1/S2/S3
                                         hoàn tất     không bị sửa.

  AC-CMP-001-08   Input đạt kiểm tra     Comparison   Không phát sinh
                  nhưng quá trình so     dừng         SAME/DIFFERENT từ phần
                  output lỗi giữa chừng               output đã xử lý.

  AC-CMP-001-09   Run Result hiển thị đã Thực hiện    Hệ thống dùng dữ liệu
                  bị truncate; hai       Comparison   Snapshot đủ điều kiện,
                  Snapshot lưu đủ dữ                  không lấy bản Run Result
                  liệu                                cắt ngắn làm căn cứ.

  AC-CMP-001-10   Một Comparison hợp lệ  Xem Result   Không tự hiển thị
                  cho DIFFERENT nhưng                 classification
                  người dùng chưa đánh                Expected/Unexpected hoặc
                  giá                                 nguyên nhân do hệ thống
                                                      suy đoán.
  ------------------------------------------------------------------------------

# 9 Clarification and Decision Log

  ----------------------------------------------------------------------------------
  **CL-CMP-001**   **Decision approved by BA**                          **Status**
  ---------------- ---------------------------------------------------- ------------
  01               Đối chiếu hai Snapshot hoàn tất, đủ điều kiện; không BA Approved
                   dùng Run Result truncate.                            

  02               Result chỉ SAME/DIFFERENT; Status riêng, Result rỗng BA Approved
                   nếu chưa kết luận.                                   

  03               Đối chiếu cả input và output theo thứ tự; SAME khi   BA Approved
                   input đạt tương thích, output so hoàn tất và không   
                   có khác biệt. Quỳnh xác nhận bổ sung cách diễn đạt   
                   này.                                                 

  04               DIFFERENT khi input đạt tương thích, output so hoàn  BA Approved
                   tất và có ít nhất một khác biệt.                     

  05               Input không tương thích: không so output, không có   BA Approved
                   SAME/DIFFERENT.                                      

  06               Không có baseline: lưu Snapshot mới, không tạo       BA Approved
                   Result giả.                                          

  07               Run không tạo Snapshot đủ điều kiện: không có        BA Approved
                   Result; giữ Run Result thực tế.                      

  08               Chỉ latency/version thay đổi: SAME nếu input đạt     BA Approved
                   kiểm tra và output trong phạm vi giống nhau.         

  09               Không tự kết luận bug, đúng/sai, Expected/Unexpected BA Approved
                   hoặc nguyên nhân.                                    

  10               Comparison Result riêng và liên kết cặp Snapshot;    BA Approved
                   không sửa Snapshot.                                  
  ----------------------------------------------------------------------------------

# 10 Dependencies and Handoff

  --------------------------------------------------------------------------------------
  **Reference**                     **Ownership and handoff**
  --------------------------------- ----------------------------------------------------
  SNP-001--008                      Điều kiện tạo, dữ liệu đầy đủ, bất biến và liên kết
                                    ngữ cảnh lịch sử của Snapshot.

  CMP-003/004/005/014               Baseline gần nhất, phương thức chọn cặp,
                                    compatibility và biểu diễn trường hợp không thể so.

  CMP-006/007/008/009/010/017/018   Trường và quy tắc đối chiếu input/output, strict
                                    comparison, JSON/text/file/binary và đầy đủ dữ liệu.

  CMP-011/012                       Latency và version là thông tin bổ sung; không tự
                                    làm DIFFERENT.

  CMP-015/016; OUT-002; CMP-002     Difference detail, lưu/traceability, hiển thị và
                                    người dùng phân loại Expected/Unexpected.
  --------------------------------------------------------------------------------------

Handoff gate: Claude phải thể hiện rõ kết quả kiểm tra input và Result
của phép so output, không quy input mismatch thành DIFFERENT. Không tự
chọn trường, thuật toán, enum trạng thái hay chính sách binary/secret
trước khi các requirement sở hữu được chốt. Baseline mặc định là
Snapshot hợp lệ gần nhất trước Run mới trong cùng phạm vi, theo CMP-003;
việc chọn cặp khác không sửa lịch sử Snapshot.
