REQ-CMP-003  •  BA Approved | Pending Client Confirmation

**Detail Requirement**

REQ-CMP-003  Default Comparison Baseline

QC Tool  |  Group 6 Comparison Engine  |  BA FINAL  |  Priority Must

Tài liệu quy định cách chọn và giữ mốc Snapshot mặc định ngay trước một API Execution mới. Chín clarification đã được Quỳnh duyệt ở cấp BA. Trong trường hợp Run tuần tự, baseline dịch chuyển S1 → S2 → S3; khi các Execution chạy đồng thời, mỗi Execution giữ mốc đã chọn riêng. CMP-003 xác định cặp mặc định, còn CMP-005/006 và các quy tắc output quyết định phép so có thể hoàn tất hay không.
# **1 Requirement Information and Original Statement**
Requirement gốc: “Ngay trước một Run mới, Snapshot hợp lệ gần nhất của cùng API, Environment và auth context phải được dùng làm mốc so sánh mặc định.”

|**Field**|**Value**|
| :- | :- |
|Requirement ID and name|REQ-CMP-003 — Default Comparison Baseline|
|Type and priority|Functional / Must|
|Primary actor|QC Tool System|
|Related actor|Người dùng khởi tạo Single/Batch Run hoặc truy xuất Comparison theo quyền Project|
|Analysis status|Clarification completed — BA Approved (9/9); Detail Requirement BA FINAL; Client Confirmation pending where BA detail extends baseline|
|Dependencies|CMP-001/004/005/006/013/014/016/017/018; SNP-001 đến SNP-008; RUN-001/007/008; AUTH/SEC|

# **2 Business Objective and Requirement Statements**
Mục tiêu là đối chiếu lần thực thi mới với bản Snapshot hợp lệ gần nhất đã có trong đúng phạm vi lịch sử tại thời điểm Execution sắp bắt đầu. Baseline mặc định là một Snapshot ID cụ thể, không phải một truy vấn “latest” được chạy lại tùy lúc xem kết quả.

RS-CMP-003-01 — Ngay trước khi mỗi API Execution bắt đầu, hệ thống phải tìm Snapshot hoàn tất gần nhất đã có sẵn trong cùng Project, API, Environment và Authentication Context lịch sử.

RS-CMP-003-02 — Trong tập ứng viên đã lưu hoàn tất và không bị vô hiệu hóa tại thời điểm chọn, hệ thống phải lấy bản có execution\_completed\_at gần nhất; nếu bằng nhau, dùng Snapshot ID làm tiêu chí thứ tự ổn định.

RS-CMP-003-03 — Hệ thống phải ghi nhận Snapshot ID được chọn làm baseline của chính Execution đó trước khi gọi target API; không chọn tại Run Draft và không chọn lại khi response hoặc Snapshot mới về.

RS-CMP-003-04 — Batch Run phải xét baseline riêng cho từng API Execution theo bốn chiều phạm vi. Retry/redirect nội bộ không tự tạo một lần chọn baseline mới.

RS-CMP-003-05 — Snapshot đã vô hiệu hóa trước thời điểm chọn phải bị bỏ qua để tìm bản hoàn tất gần nhất tiếp theo; nếu không có bản phù hợp, Execution không có baseline mặc định.

RS-CMP-003-06 — Bản gần nhất không bị vô hiệu hóa nhưng Comparison chưa hỗ trợ format hoặc dữ liệu không đủ để so không được âm thầm thay bằng bản cũ hơn. Cặp đã chọn chuyển sang CMP-005/014/017/018 để ghi nhận không thể so.

RS-CMP-003-07 — Input mismatch ở CMP-006 không làm hệ thống chọn một baseline cũ khác. Không có SAME/DIFFERENT khi output chưa được so theo CMP-001.

RS-CMP-003-08 — Run không tạo Snapshot mới đủ điều kiện không tạo Comparison và không thay đổi baseline của một Execution đã bắt đầu. Snapshot cũ giữ nguyên; lần Run sau chọn lại theo dữ liệu có sẵn lúc nó bắt đầu.

RS-CMP-003-09 — Nếu baseline bị vô hiệu hóa sau khi chọn nhưng trước khi tạo Comparison, hệ thống không chuyển cặp âm thầm; CMP-005 chặn Comparison mới và CMP-014 ghi lý do. Comparison đã hoàn tất trước khi vô hiệu hóa vẫn giữ lịch sử.

RS-CMP-003-10 — Compare thủ công không cập nhật hoặc khóa baseline mặc định cho lần Run sau. Snapshot mới hoàn tất, dù phép Comparison của Run đó không tạo SAME/DIFFERENT, vẫn được xét làm ứng viên cho Run tiếp theo nếu chưa bị vô hiệu hóa.
# **3 Scope and Boundaries**

|**In scope of CMP-003**|**Owned by related requirement**|
| :- | :- |
|Thời điểm chọn, phạm vi tìm, thứ tự bản gần nhất, ghi nhận Snapshot ID cố định cho từng Execution.|SNP-001/006 xác định bản hoàn tất; SNP-008 giữ identity lịch sử; RUN-007 xác định Execution và thời điểm bắt đầu.|
|Bỏ qua bản invalidated trước điểm chọn; không tìm bản cũ thay cặp đã chọn khi input/format không tương thích.|SNP-002/005 quản lý invalidation; CMP-005/006/014/017/018 quyết định compatibility và lý do không so.|
|Xử lý Batch, Run đồng thời, Run thất bại, Compare thủ công và quyết định invalidation xảy ra sau khi chọn.|CMP-004 quy định phương thức/chiều cặp; CMP-013/016 quy định tự động Compare và lưu lịch sử.|
|Cặp mặc định chỉ là mốc đầu vào, chưa tự tạo SAME/DIFFERENT.|CMP-001 là kết luận Result; CMP-007 đến CMP-010/017/018 là quy tắc đối chiếu output.|

# **4 Actor Trigger Preconditions and Postconditions**

|**Field**|**Rule**|
| :- | :- |
|Actor|QC Tool System chọn baseline; người dùng khởi tạo Run theo quyền và policy của Project/Environment.|
|Trigger|Ngay trước khi từng API Execution mới bắt đầu gọi target API; trong Batch xét theo từng Execution.|
|Preconditions|Project/API/Environment/auth context của Execution đã xác định; Run đã qua các gate tiền thực thi và Execution chuẩn bị bắt đầu.|
|Success|Lưu tham chiếu một Snapshot ID cụ thể trong cùng phạm vi, hoàn tất và chưa invalidated ở thời điểm chọn; hoặc ghi nhận rõ không có baseline.|
|After Run|Nếu Execution tạo Snapshot mới, cặp đã chốt được xét theo CMP-005/006/013; nếu không có Snapshot mới thì không tạo Comparison. Việc chọn mốc không sửa Snapshot.|

# **5 Business Rules**

|**ID**|**Business rule**|
| :- | :- |
|BR-CMP-003-01|Baseline mặc định được xác định cho một API Execution, không dùng Run Draft, Batch tổng hoặc cấu hình API hiện tại làm mốc.|
|BR-CMP-003-02|Phạm vi ứng viên là cùng Project ID, API ID, Environment ID và auth context ổn định đã lưu; đối chiếu theo ID/ngữ cảnh lịch sử, không theo tên.|
|BR-CMP-003-03|Chỉ bản đã hoàn tất lưu và tồn tại trước điểm chọn mới là ứng viên; bản đang lưu dở, hoàn tất sau điểm chọn hoặc Snapshot của Execution mới không được dùng.|
|BR-CMP-003-04|Trong tập ứng viên chưa invalidated, sắp theo execution\_completed\_at giảm dần, rồi Snapshot ID giảm dần để chọn một bản xác định khi thời điểm trùng.|
|BR-CMP-003-05|Snapshot invalidated trước điểm chọn bị bỏ qua; bản cũ đủ điều kiện tiếp theo được chọn. Tuổi bản cũ không tự làm nó hết tư cách.|
|BR-CMP-003-06|Snapshot được chọn dù format hiện chưa hỗ trợ vẫn là mốc lịch sử; phép so có thể bị chặn theo CMP-005/017/018, không nhảy sang bản cũ để lấy kết luận.|
|BR-CMP-003-07|Sau khi đã ghi nhận baseline ID cho Execution, Snapshot khác được lưu, vô hiệu hóa hoặc truy xuất trong lúc Execution chạy không làm hệ thống chọn lại mốc đó.|
|BR-CMP-003-08|Trước khi tạo Comparison, CMP-005 kiểm tra tư cách hiện hành của cặp; nếu baseline đã invalidated, không tạo Comparison mới và không thay baseline ID đã ghi.|
|BR-CMP-003-09|Input mismatch ở CMP-006 không kích hoạt tìm baseline khác. Snapshot mới vẫn được lưu theo SNP-006 nếu Execution đủ điều kiện.|
|BR-CMP-003-10|Run lỗi/không tạo Snapshot không tiêu thụ, xóa hoặc cập nhật Snapshot cũ; lần Run sau xét lại tập ứng viên tại điểm chọn mới.|
|BR-CMP-003-11|Compare thủ công chọn đúng cặp người dùng chỉ định, không ghi đè mốc mặc định của Execution khác hoặc ảnh hưởng cách chọn cho Run tiếp theo.|

# **6 Main Flow**
1. Run qua các kiểm tra tiền thực thi; hệ thống xác định ngữ cảnh Project/API/Environment/auth context cho API Execution sắp bắt đầu.
1. Hệ thống đọc các Snapshot cùng phạm vi đã lưu hoàn tất trước thời điểm chọn và loại bản đã invalidated tại thời điểm đó.
1. Hệ thống chọn bản có execution\_completed\_at mới nhất, dùng Snapshot ID để phá hòa; ghi nhận baseline Snapshot ID cho Execution. Nếu tập rỗng, ghi nhận không có baseline.
1. Hệ thống gọi target API. Baseline đã ghi không thay đổi khi các Execution khác hoàn tất hoặc lưu Snapshot trong lúc này.
1. Nếu Execution tạo Snapshot mới hoàn tất và có baseline, hệ thống đưa đúng cặp đã chốt vào gate CMP-005, bước input CMP-006 và luồng Comparison theo CMP-013; chỉ CMP-001 mới tạo SAME/DIFFERENT khi hợp lệ hoàn tất.
1. Snapshot mới hoàn tất được xét làm ứng viên tại điểm chọn của Execution tương lai; Compare thủ công không sửa nguyên tắc chọn.
# **7 Alternative and Exception Flows**

|**ID**|**Situation**|**Expected behavior**|
| :- | :- | :- |
|ALT-01|Run đầu tiên trong cùng phạm vi|Không có baseline; nếu đủ điều kiện thì lưu S1, không có SAME/DIFFERENT giả.|
|ALT-02|T2/T3 bắt đầu khi mới có S1|Cả hai ghi S1 nếu S2 chưa tồn tại lúc từng Execution chọn; S2 lưu sau không đổi mốc T3.|
|ALT-03|S3 gần nhất invalidated trước Run T4|Bỏ S3, chọn bản hợp lệ gần nhất còn lại; nếu không có thì ghi không có baseline.|
|ALT-04|S3 gần nhất chưa invalidated nhưng format chưa so được|Giữ S3 làm mốc; CMP-005/014/017/018 xử lý không thể so, không âm thầm thay S2.|
|ALT-05|S3 input mismatch với S4|Không chọn S2 thay; không so output; S4 hoàn tất vẫn là ứng viên Run sau.|
|ALT-06|Người dùng Compare thủ công S1/S3|Dùng đúng cặp cho Comparison thủ công; Run sau vẫn chọn bản gần nhất theo CMP-003.|
|EXC-01|Run lỗi hoặc lưu Snapshot mới thất bại|Không có Comparison mới; Snapshot cũ và baseline ID của Execution giữ nguyên.|
|EXC-02|Baseline invalidated sau chọn, trước Compare|CMP-005 chặn Comparison mới; CMP-014 ghi lý do; không chọn bản thay thế trong Execution này.|
|EXC-03|Không thể xác định auth context bắt buộc|Không ghép Snapshot bằng suy đoán; xử lý theo SNP/AUTH và CMP-014 nếu Execution có Snapshot mới.|

# **8 Acceptance Criteria**

|**ID**|**Given**|**When**|**Then**|
| :- | :- | :- | :- |
|AC-CMP-003-01|Run T1 trong API A/UAT/auth X chưa có Snapshot|Execution T1 bắt đầu rồi tạo S1|Không có baseline/T1 Comparison; S1 được lưu nếu đủ điều kiện.|
|AC-CMP-003-02|S1 đã hoàn tất; T2 cùng phạm vi chuẩn bị bắt đầu|Chọn baseline rồi T2 tạo S2|Baseline T2 = S1; chỉ cặp S1/S2 được xét Compare tự động.|
|AC-CMP-003-03|S1, S2 đã hoàn tất; T3 cùng phạm vi bắt đầu sau S2|Chọn baseline|Baseline T3 = S2, không cố định S1 vĩnh viễn.|
|AC-CMP-003-04|S1 ở UAT/auth X; S2 ở DEV hoặc auth Y|Execution mới ở UAT/auth X bắt đầu|Không lấy S2; chỉ xét bản cùng bốn chiều phạm vi.|
|AC-CMP-003-05|S1 và S2 cùng phạm vi; S2 đã invalidated trước T3|T3 chọn baseline|Bỏ S2, chọn S1 nếu còn hợp lệ.|
|AC-CMP-003-06|T2 và T3 cùng bắt đầu lúc chỉ S1 đã lưu|S2 được lưu khi T3 còn chạy|T3 vẫn có baseline S1; không tự đổi thành S2.|
|AC-CMP-003-07|S1/S2 cùng completion time, cùng phạm vi và đã lưu trước T3|T3 chọn baseline|Snapshot ID cho thứ tự ổn định chọn đúng một bản.|
|AC-CMP-003-08|S2 hoàn tất Execution trước T3 nhưng chưa lưu xong lúc T3 chọn|T3 bắt đầu|S2 không phải ứng viên; không sửa baseline T3 sau khi S2 lưu muộn.|
|AC-CMP-003-09|S2 là bản gần nhất, format chưa được Comparison hỗ trợ|T3 tạo S3|Giữ cặp S2/S3; không nhảy S1; không kết luận Result khi CMP-005/017 chặn.|
|AC-CMP-003-10|S2 là baseline T3; input S2/S3 không tương thích|CMP-006 kiểm tra input|Không chọn S1 thay, không so output, không có SAME/DIFFERENT; S3 vẫn có thể lưu.|
|AC-CMP-003-11|Baseline S2 đã ghi cho T3 rồi S2 bị invalidated|S3 hoàn tất và chuẩn bị Compare|Không chuyển sang S1; Comparison mới bị chặn và ghi lý do.|
|AC-CMP-003-12|T3 lỗi HTTP 500 và không tạo Snapshot|T4 cùng phạm vi bắt đầu|T3 không tạo Comparison; T4 chọn Snapshot hoàn tất gần nhất tại thời điểm T4 bắt đầu.|
|AC-CMP-003-13|Batch có API A và B ở các ngữ cảnh riêng|Từng Execution bắt đầu|Mỗi Execution chọn baseline riêng, không dùng chung mốc Batch.|
|AC-CMP-003-14|User Compare thủ công S1/S3; S3 gần nhất còn hợp lệ|T4 bắt đầu|Baseline T4 vẫn là S3; thao tác thủ công không thay đổi quy tắc mặc định.|
|AC-CMP-003-15|Comparison C1 đã hoàn tất rồi S1 bị invalidated|Xem lịch sử C1|C1 không bị tính lại/ghi đè; dấu vết invalidation được giữ riêng.|

# **9 Clarification and Decision Log**

|**CL-CMP-003**|**Decision approved by BA**|**Status**|
| :- | :- | :- |
|01|Chọn và ghi baseline ID ngay trước từng API Execution; Batch chọn riêng.|BA Approved|
|02|Trong bản đã lưu hoàn tất tại điểm chọn, dùng execution\_completed\_at gần nhất; tie theo Snapshot ID.|BA Approved|
|03|Execution giữ baseline đã ghi; Run đồng thời không làm đổi mốc giữa chừng.|BA Approved|
|04|Invalidated trước điểm chọn bị bỏ qua; tìm bản hoàn tất hợp lệ kế tiếp.|BA Approved|
|05|Format chưa hỗ trợ ở bản gần nhất không làm tự chọn bản cũ; ghi không thể so.|BA Approved|
|06|Input mismatch không làm tìm baseline cũ thay thế.|BA Approved|
|07|Run không tạo Snapshot mới không có Comparison; lần sau xét lại tại điểm chọn mới.|BA Approved|
|08|Baseline invalidated sau khi chọn: không chọn lại; chặn Comparison mới, giữ lịch sử cũ.|BA Approved|
|09|Compare thủ công không đổi baseline mặc định hoặc lịch sử đã chốt.|BA Approved|

# **10 Dependencies and Handoff**

|**Reference**|**Ownership and handoff**|
| :- | :- |
|SNP-001/002/005/006/008|Tạo và giữ Snapshot hoàn tất, invalidation, retention và identity lịch sử.|
|RUN-001/007/008; AUTH/SEC|Execution trong Single/Batch, thời điểm trước khi gọi target và auth context ổn định; quyền/policy Run.|
|CMP-001/004/005/006|Result, cặp thủ công, eligibility và input compatibility; không được chọn lại cặp âm thầm.|
|CMP-013/014/016/017/018|So tự động, lý do không thể so, lưu baseline ID/cặp Snapshot, format và completeness.|

QC Tool  |  Group 6 Comparison Engine  |  
