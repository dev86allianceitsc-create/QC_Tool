REQ-CMP-004  •  BA Approved | Pending Client Confirmation

**Detail Requirement**

REQ-CMP-004  Comparison Snapshot Selection Methods

QC Tool  |  Group 6 Comparison Engine  |  BA FINAL  |  Priority Must

Tài liệu xác định ba cách chọn Snapshot: baseline đã ghi của latest, hai bản bất kỳ và một chuỗi cặp liên tiếp. Mười một clarification đã được Quỳnh duyệt ở cấp BA. Mỗi phương thức tạo cặp cụ thể; CMP-005/006 và các quy tắc output quyết định liệu từng cặp có tạo SAME/DIFFERENT hay không. Chọn thủ công không sửa baseline đã chốt cho Run.
# **1 Requirement Information and Original Statement**
Requirement gốc: “Hệ thống phải cho phép so sánh mốc với latest, hai Snapshot bất kỳ và các Snapshot liên tiếp, với điều kiện chúng tương thích.”

|**Field**|**Value**|
| :- | :- |
|Requirement ID and name|REQ-CMP-004 — Comparison Snapshot Selection Methods|
|Type and priority|Functional / Must|
|Primary actor|Người dùng có quyền truy cập Project|
|Related actor|QC Tool System chọn/freeze cặp và kiểm tra điều kiện Comparison|
|Analysis status|Clarification completed — BA Approved (11/11); Detail Requirement BA FINAL; Client Confirmation pending where BA detail extends baseline|
|Dependencies|CMP-001/003/005/006/013/014/015/016; SNP-002/005/007/008; RUN-007; AUTH/SEC|

# **2 Business Objective and Requirement Statements**
Người dùng cần so sánh lần mới nhất với baseline lịch sử đã chốt, đối chiếu một cặp tự chọn, hoặc quan sát thay đổi theo từng bước trong một khoảng Snapshot. Hệ thống phải bảo toàn đúng cặp, chiều và phạm vi được chọn để kết quả có thể giải thích, kiểm tra lại và truy vết.

|**Method**|**Pair or pair sequence**|
| :- | :- |
|Baseline vs latest|Baseline Snapshot ID đã ghi cho Execution nguồn của latest → latest Snapshot.|
|Any two Snapshots|Snapshot mốc A → Snapshot đối chiếu B do người dùng chọn rõ.|
|Consecutive Snapshots|Các cặp kề nhau trong dãy lịch sử thuộc một phạm vi và khoảng đã chọn: S1→S2, S2→S3, S3→S4.|

RS-CMP-004-01 — Hệ thống phải hỗ trợ ba phương thức: baseline vs latest, hai Snapshot bất kỳ và các Snapshot liên tiếp, với mọi cặp đều qua cùng gate CMP-005/006 trước khi kết luận.

RS-CMP-004-02 — Ở baseline vs latest, phía latest là Snapshot hoàn tất, chưa invalidated, có execution\_completed\_at gần nhất trong phạm vi Project/API/Environment/auth context đã chọn; hòa theo Snapshot ID. Run không tạo Snapshot mới không thành latest.

RS-CMP-004-03 — Phía baseline của latest phải là Snapshot ID đã ghi cho Execution nguồn theo CMP-003; không tính lại từ lịch sử tại thời điểm mở màn hình. Không có baseline hoặc baseline về sau invalidated thì không dựng cặp thay thế.

RS-CMP-004-04 — Latest có format chưa hỗ trợ vẫn là bản latest được chọn; hệ thống ghi không thể so theo CMP-014/017, không lùi sang bản cũ để lấy kết quả.

RS-CMP-004-05 — Ở chế độ hai bản bất kỳ, người dùng được chọn hai Snapshot ID khác nhau không bị giới hạn tuổi hay tính liền kề, nếu cùng phạm vi và đạt CMP-005.

RS-CMP-004-06 — Người dùng chọn rõ A là mốc và B là bản đối chiếu. Hệ thống giữ đúng chiều A→B kể cả khi A mới hơn B; UI có thể gợi ý nhưng không tự đảo. SAME/DIFFERENT đối xứng, Difference Detail theo chiều chọn.

RS-CMP-004-07 — Ở chế độ liên tiếp, người dùng chọn hai điểm đầu/cuối trong cùng phạm vi. Hệ thống lấy toàn bộ Snapshot lịch sử hoàn tất trong khoảng bao gồm hai đầu, sắp theo execution\_completed\_at và Snapshot ID, rồi xét từng cặp kề nhau.

RS-CMP-004-08 — Snapshot invalidated trong chuỗi vẫn là một vị trí lịch sử: các cặp chạm nó không đủ điều kiện theo CMP-005; không nối tắt qua nó để tạo cặp mới. Những cặp khác tiếp tục được xét.

RS-CMP-004-09 — Mỗi cặp trong chuỗi được xử lý độc lập; input mismatch hoặc lỗi ở một cặp không dừng các cặp khác. Không tạo một SAME/DIFFERENT đại diện toàn chuỗi.

RS-CMP-004-10 — Một thao tác so chuỗi thuộc một Project/API/Environment/auth context. Không trộn Snapshot khác phạm vi; mọi cặp sử dụng quy tắc compatibility chung.

RS-CMP-004-11 — Khi người dùng gửi yêu cầu so chuỗi, hệ thống chốt danh sách Snapshot ID và thứ tự cặp; Snapshot lưu sau không được chèn vào tác vụ đang xử lý. Tư cách của từng cặp vẫn được kiểm tra khi thực hiện.

RS-CMP-004-12 — Compare thủ công hoặc chuỗi không cập nhật baseline mặc định của bất kỳ Execution nào. Cách lưu yêu cầu, các lần thử hoặc kết quả cùng cặp thuộc CMP-016.
# **3 Scope and Boundaries**

|**In scope of CMP-004**|**Owned by related requirement**|
| :- | :- |
|Tạo cặp/các cặp theo đúng ba phương thức, chọn latest, giữ baseline ID lịch sử và chiều A→B.|CMP-003 chốt baseline của Execution; CMP-005/006 quyết định eligibility và input; CMP-015 sở hữu Difference Detail.|
|Xếp dãy liên tiếp, giữ gap do invalidation, xử lý từng cặp độc lập và chốt danh sách ID khi gửi yêu cầu.|SNP-002/005 giữ invalidation; CMP-014 phân loại reason; CMP-016 lưu request/cặp/results.|
|Mọi lựa chọn trong cùng ngữ cảnh và theo quyền hiện hành, không ảnh hưởng Run tương lai.|SNP-007/008 sở hữu History/provenance; AUTH/SEC chốt quyền; CMP-013 tự động Compare sau Run.|
|Không chốt giới hạn kích thước chuỗi, cơ chế tác vụ và pagination ở mức requirement này.|NFR/AnD UI/API quyết định giới hạn cấu hình, hiệu năng và trình bày, nhưng không được âm thầm bỏ cặp.|

# **4 Actor Trigger Preconditions and Postconditions**

|**Field**|**Rule**|
| :- | :- |
|Actor|Người dùng có quyền Project chọn phương thức/phạm vi/cặp; QC Tool System xác định Snapshot ID và tạo các cặp.|
|Trigger|Người dùng chọn Baseline vs Latest, chọn thủ công A/B, hoặc chọn khoảng cho Consecutive Comparison.|
|Preconditions|Phiên/quyền hiện hành hợp lệ; API/Environment/auth context và Snapshot lịch sử có thể xác định theo ID; số bản trong khoảng đủ để hình thành cặp khi áp dụng.|
|Success|Hệ thống giữ đúng Snapshot ID, chiều và thứ tự cặp; từng cặp được chuyển qua CMP-005/006 và xử lý độc lập.|
|Unavailable|Không đủ hai bản, baseline của latest không có, quyền thiếu hoặc cặp không đủ điều kiện: không tạo Result giả; reason theo CMP-014/AUTH.|

# **5 Business Rules**

|**ID**|**Business rule**|
| :- | :- |
|BR-CMP-004-01|Cặp là hai Snapshot ID khác nhau; việc cùng phạm vi và đủ điều kiện do CMP-005 kiểm tra ở cả ba phương thức.|
|BR-CMP-004-02|Latest là bản đã lưu hoàn tất, chưa invalidated có execution\_completed\_at mới nhất trong phạm vi; tie theo Snapshot ID. Format chưa hỗ trợ không làm hệ thống chọn bản cũ hơn.|
|BR-CMP-004-03|Baseline vs latest đọc baseline ID cố định của Execution tạo latest; không suy lại từ “bản ngay trước” khi hiển thị hoặc yêu cầu so.|
|BR-CMP-004-04|Nếu latest là bản đầu tiên không có baseline, hoặc baseline đã invalidated, không tạo cặp thay thế; CMP-014 nêu lý do.|
|BR-CMP-004-05|Manual A/B không yêu cầu hai Snapshot liền nhau hay A cũ hơn B. Giữ chiều người dùng chọn; Difference Detail biểu diễn A→B.|
|BR-CMP-004-06|Consecutive xây dãy theo execution\_completed\_at ASC, Snapshot ID ASC trong cùng bốn chiều; so các vị trí kề nhau trong dãy nguồn.|
|BR-CMP-004-07|Invalidated không bị xóa khỏi dãy lịch sử để nối tắt. Cặp chạm bản invalidated bị chặn; đoạn khác của chuỗi vẫn được xét.|
|BR-CMP-004-08|Mỗi cặp có Result hoặc trạng thái/lý do riêng. Không kết luận chung toàn chuỗi và không dừng toàn bộ vì một cặp mismatch/failed.|
|BR-CMP-004-09|Chốt tập Snapshot ID và thứ tự cặp lúc nhận yêu cầu chuỗi; bản lưu sau chỉ tham gia yêu cầu mới. Nếu trạng thái eligibility đổi sau đó, CMP-005 đánh giá khi xử lý cặp.|
|BR-CMP-004-10|Yêu cầu chọn Snapshot khác Project/API/Environment/auth context bị chặn; không ghép bằng tên hoặc token tạm.|
|BR-CMP-004-11|Compare thủ công và chuỗi không viết lại Snapshot, baseline của Execution hoặc quy tắc chọn baseline của Run tương lai.|
|BR-CMP-004-12|Quyền hiện hành được kiểm tra trước khi lộ Snapshot/cặp; retention không thời hạn không có nghĩa mọi user giữ quyền vĩnh viễn.|

# **6 Main Flows**
## **6.1 Baseline vs Latest**
1. Người dùng chọn Project, API, Environment và Authentication Context mà họ có quyền truy cập.
1. Hệ thống xác định latest Snapshot hoàn tất chưa invalidated theo execution\_completed\_at, tie bằng Snapshot ID.
1. Hệ thống đọc baseline Snapshot ID đã ghi cho Execution nguồn của latest, không tính lại theo danh sách hiện tại.
1. Nếu có hai ID, hệ thống giữ cặp baseline→latest và chuyển CMP-005/006; nếu không, CMP-014 nêu lý do.
## **6.2 Two Selected Snapshots**
1. Người dùng chọn Snapshot mốc A và Snapshot đối chiếu B theo ID, xác nhận chiều A→B.
1. Hệ thống kiểm tra quyền và hai ID khác nhau, giữ đúng chiều chọn, rồi chuyển cặp CMP-005/006.
1. Kết quả/difference thuộc riêng cặp A→B; thao tác không sửa baseline mặc định.
## **6.3 Consecutive Snapshot Range**
1. Người dùng chọn một phạm vi Project/API/Environment/auth context và hai Snapshot làm điểm đầu/cuối.
1. Hệ thống lấy mọi Snapshot lịch sử hoàn tất nằm trong khoảng, gồm bản invalidated; sắp theo thời điểm hoàn tất Execution và Snapshot ID.
1. Hệ thống chốt dãy ID, tạo cặp kề nhau theo thứ tự và xử lý mỗi cặp độc lập qua CMP-005/006; không nối tắt qua bản invalidated.
1. Hệ thống cung cấp Result hoặc reason của từng cặp, giữ các gap lịch sử và không gán Result chung cho cả khoảng.
# **7 Alternative and Exception Flows**

|**ID**|**Situation**|**Expected behavior**|
| :- | :- | :- |
|ALT-01|T3 chạy đồng thời và chốt S1, dù S2 xuất hiện trước khi xem S3|Nếu latest=S3 thì baseline vs latest dùng S1→S3, không tính lại S2→S3.|
|ALT-02|Run mới nhất lỗi, không có Snapshot mới|Latest vẫn là Snapshot hoàn tất trước đó; không tạo target giả từ Run lỗi.|
|ALT-03|Manual chọn A mới hơn B|Giữ A→B; Result đối xứng nhưng Difference Detail diễn giải theo chiều đó.|
|ALT-04|Chuỗi S1,S2,S3,S4; S2 invalidated|S1→S2 và S2→S3 bị chặn; S3→S4 vẫn xét; không sinh S1→S3.|
|ALT-05|S1→S2 input mismatch, S2→S3 hợp lệ|Cặp đầu không Result; cặp sau vẫn xét độc lập.|
|EXC-01|Latest chưa có baseline hoặc baseline invalidated|Không dựng baseline khác; lý do theo CMP-014.|
|EXC-02|Chọn trộn Environment/auth context hoặc cùng Snapshot ID|Không tạo Comparison hợp lệ; gate CMP-005/014 và AUTH/SEC.|
|EXC-03|Snapshot mới lưu trong lúc xử lý chuỗi|Không chèn vào danh sách ID đã chốt; request sau mới xét bản đó.|
|EXC-04|Một Snapshot trong dãy bị invalidated sau lúc chốt danh sách|Giữ danh sách cặp nhưng CMP-005 chặn các cặp chạm bản đó tại lúc xử lý.|
|EXC-05|Một cặp engine failed trong chuỗi|Cặp đó có reason failed, cặp còn lại tiếp tục theo phạm vi yêu cầu.|

# **8 Acceptance Criteria**

|**ID**|**Given**|**When**|**Then**|
| :- | :- | :- | :- |
|AC-CMP-004-01|Latest S3 có baseline ID S1 đã ghi do Run đồng thời; S2 cũng tồn tại|Chọn baseline vs latest|Cặp là S1→S3, không tính lại S2→S3.|
|AC-CMP-004-02|S1 là Snapshot duy nhất và không có baseline|Chọn baseline vs latest|Không có cặp giả; nêu no baseline theo CMP-014.|
|AC-CMP-004-03|Latest S3 có baseline S2 nhưng S2 sau đó invalidated|Chọn baseline vs latest|Không chuyển sang S1; cặp S2/S3 bị chặn theo CMP-005/014.|
|AC-CMP-004-04|S3 là latest hợp lệ về lưu trữ nhưng format chưa hỗ trợ; S2 hỗ trợ|Chọn baseline vs latest|S3 vẫn là target; không lùi S2 để tạo SAME/DIFFERENT.|
|AC-CMP-004-05|T4 Run lỗi và không có S4; S3 là latest|Chọn baseline vs latest|Không dùng Run T4 làm Snapshot latest.|
|AC-CMP-004-06|S1 và S4 cùng phạm vi nhưng không liền nhau|Chọn thủ công S1→S4|Hệ thống xét đúng cặp nếu đạt CMP-005, không buộc chọn S2/S3.|
|AC-CMP-004-07|S4 mới hơn S1|Chọn thủ công S4 làm A, S1 làm B|Giữ S4→S1; Difference Detail theo A→B, không đảo ngầm.|
|AC-CMP-004-08|S1,S2,S3,S4 cùng phạm vi trong khoảng chọn|Yêu cầu so liên tiếp S1 đến S4|Tạo ba cặp S1→S2, S2→S3, S3→S4; không tạo S1→S4 thay.|
|AC-CMP-004-09|S2 invalidated trong dãy S1 đến S4|Yêu cầu so liên tiếp|Không nối S1→S3; cặp chạm S2 không đủ điều kiện, S3→S4 vẫn xét.|
|AC-CMP-004-10|S1→S2 input mismatch, S2→S3 output giống nhau|Xử lý chuỗi|Cặp đầu không Result; cặp sau có thể SAME; không có Result chung.|
|AC-CMP-004-11|S1 ở UAT, S2 ở DEV hoặc auth context khác|Chọn cùng cặp/chuỗi|Không trộn phạm vi hoặc bỏ qua CMP-005.|
|AC-CMP-004-12|Dãy S1,S2,S3 chốt khi gửi request; S4 lưu sau|Xử lý request đang chạy|Dãy vẫn chỉ S1,S2,S3; S4 không tự chèn.|
|AC-CMP-004-13|S2 invalidated sau khi dãy đã chốt nhưng trước khi so cặp|Xử lý S1→S2|CMP-005 kiểm tra tại lúc xử lý, cặp bị chặn; dãy ID không đổi.|
|AC-CMP-004-14|User Compare thủ công S1/S3; S3 gần nhất còn hợp lệ|Run mới bắt đầu|Baseline Run vẫn theo CMP-003, không bị thao tác thủ công sửa.|
|AC-CMP-004-15|User không còn quyền Project|Yêu cầu một trong ba phương thức|AUTH/SEC từ chối trước khi lộ Snapshot/cặp/kết quả.|

# **9 Clarification and Decision Log**

|**CL-CMP-004**|**Decision approved by BA**|**Status**|
| :- | :- | :- |
|01|Baseline vs latest dùng baseline ID đã ghi cho Execution tạo latest, không tính lại.|BA Approved|
|02|Latest theo execution\_completed\_at trong bản hoàn tất/chưa invalidated; format unsupported không lùi bản.|BA Approved|
|03|Latest không baseline hoặc baseline invalidated: không dựng cặp thay thế.|BA Approved|
|04|Hai Snapshot bất kỳ không giới hạn tuổi hoặc phải liền nhau, vẫn qua CMP-005.|BA Approved|
|05|Manual giữ A→B kể cả A mới hơn; Difference Detail theo chiều người dùng chọn.|BA Approved|
|06|Consecutive là mọi cặp kề nhau trong khoảng cùng phạm vi, sắp theo completion time và ID.|BA Approved|
|07|Invalidated ở giữa tạo gap, không nối tắt qua bản đó.|BA Approved|
|08|Mỗi cặp trong chuỗi xử lý độc lập; không có Result chung toàn chuỗi.|BA Approved|
|09|Một chuỗi thuộc đúng một Project/API/Environment/auth context.|BA Approved|
|10|Chốt Snapshot ID/thứ tự cặp khi submit; bản lưu sau không chèn vào request đang chạy.|BA Approved|
|11|Compare thủ công/chuỗi không đổi baseline của Run tương lai.|BA Approved|

# **10 Dependencies and Handoff**

|**Reference**|**Ownership and handoff**|
| :- | :- |
|CMP-003/005/006/014|Baseline ID lịch sử, gate compatibility/input và reason khi không đủ điều kiện.|
|CMP-001/015/016|Result theo từng cặp, Directional Difference Detail, lưu request/cặp và history.|
|CMP-013; SNP-002/005/007/008|So tự động sau Run, invalidation, retention và danh sách/provenance Snapshot.|
|RUN-007; AUTH/SEC; NFR/AnD|Execution nguồn, quyền Project, giới hạn/performance của chuỗi và UI/API triển khai.|

QC Tool  |  Group 6 Comparison Engine  |  
