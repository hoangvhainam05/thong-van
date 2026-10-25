# Kế hoạch chức năng và lộ trình sprint — Thông Vân

> Tài liệu lập kế hoạch dựa trên `luong-he-thong-thong-van.md`, `luong-don-hang-thong-van.md`, `README.md` và cấu trúc mã nguồn hiện có. Các luồng trong tài liệu được xem là yêu cầu sản phẩm; đề xuất kỹ thuật và thứ tự triển khai bên dưới là kế hoạch cho dự án.

## 1. Mục tiêu hệ thống

Khách có thể đặt và theo dõi đơn điện máy; nhân viên xác nhận đơn và chuẩn bị hàng; quản lý chia đơn cho xe, tối ưu và chốt tuyến; tài xế giao, lắp đặt, ghi nhận kết quả; quản lý theo dõi KPI. Khách xem trạng thái, số điểm giao còn trước mình và khoảng giờ dự kiến mà không nhìn thấy thông tin đơn hay địa chỉ của khách khác.

Luồng chính:

```text
Danh mục → Giỏ hàng/đặt hàng → Xác nhận & chuẩn bị → Xếp và duyệt tuyến
         → Giao/lắp đặt → Bằng chứng giao → Bảo hành & báo cáo
```

## 2. Phạm vi chức năng

| Phân hệ | Chức năng cần có khi hoàn tất | Ưu tiên |
|---|---|---|
| Website bán hàng | Danh mục, tìm kiếm/lọc, trang chi tiết, giá, tình trạng hàng, hình ảnh, giỏ hàng | MVP |
| Đặt hàng | Thông tin người nhận và người đặt, đặt hộ gia đình, địa chỉ/ghi chú, khung giờ nhận, COD theo điều kiện, chuyển khoản QR, mã đơn và liên kết theo dõi | MVP |
| Xử lý đơn | Danh sách/chi tiết đơn, xác nhận, yêu cầu khách bổ sung thông tin, đánh dấu sẵn sàng, hủy và ghi lý do; nhân viên nhập đơn mua tại quầy | MVP |
| Vị trí giao | Lưu địa chỉ và tọa độ, kiểm tra vị trí, cho phép nhân viên chỉnh/ghim vị trí khi chưa chắc chắn | MVP thủ công; tự động hóa sau |
| Hàng hóa và kho | CRUD sản phẩm, giá, tồn kho, thể tích, cân nặng, thời gian lắp đặt, phụ kiện; kiểm tra tồn trước xác nhận | MVP |
| Đội giao hàng | Quản lý tài xế, xe, tải trọng/thể tích, giờ làm và trạng thái sẵn sàng | MVP |
| Điều phối | Gom đơn theo ngày, tách đơn giao gấp, tạo tuyến nhiều xe, xem đơn chưa xếp được, tổng km/thời gian, điều chỉnh tuyến nháp, phân công xe/tài xế | MVP |
| Tối ưu tuyến | Ràng buộc khung giờ, sức chứa, thời lượng phục vụ/lắp đặt và tối đa 8 giờ/chuyến; mục tiêu cân bằng km và thời gian | MVP |
| Duyệt tuyến | Duyệt/chốt trước giờ giao, khóa thứ tự; tuyến đã chốt không bị thay đổi bởi lần tối ưu sau | MVP |
| Tài xế | Xem tuyến và thứ tự điểm trên điện thoại; bắt đầu tuyến; ghi đã đến; ghi giao thành công/thất bại và lý do; COD; ảnh hoàn tất | MVP |
| Theo dõi khách | Tra cứu an toàn, trạng thái, ETA dạng khoảng, điểm thứ N/còn N điểm, nội dung giao thất bại, ảnh bàn giao | MVP |
| Thông báo | Thông báo trên trang theo dõi khi xác nhận, lên lịch, xe xuất phát, giao xong/thất bại; ghi nhận sự đồng ý nhận thông báo | MVP trong website; SMS/Zalo/email sau |
| Người dùng và quyền | Đăng nhập nhân viên, vai trò/quyền, giới hạn dữ liệu theo khách/tài xế, nhật ký thao tác | Tối thiểu cần cho triển khai thật; hoàn thiện trong giai đoạn sau MVP nếu chỉ làm bản demo môn học |
| Bảo hành | Tra cứu bảo hành theo đơn/sản phẩm, thời hạn và thông tin liên hệ | Sau MVP |
| Bảo dưỡng | Lịch và nhắc bảo dưỡng theo sản phẩm/ngày giao | Sau MVP |
| Báo cáo | Đơn, doanh thu, giao thành công/thất bại, đúng khung giờ, km tiết kiệm, tuyến và đơn chưa xếp được | Bản cơ bản trong MVP; bộ lọc/xuất báo cáo sau |
| Định vị và thông minh | GPS trực tiếp, tự động geocoding, AI phân tích địa chỉ, ML dự đoán ETA/trễ và dự báo nhu cầu | Sau MVP |

## 3. Ranh giới MVP

MVP là một luồng xuyên suốt có thể demo và vận hành thử: khách chọn hàng, tạo đơn và theo dõi; nhân viên xác nhận, kiểm tra thanh toán/tồn kho, bổ sung tọa độ và chuẩn bị; quản lý tạo tuyến, xem các cảnh báo, phân công và chốt; tài xế xem tuyến, ghi kết quả và ảnh; khách thấy trạng thái/ETA cập nhật; quản lý xem KPI cơ bản.

**MVP không cần mô hình AI.** Dùng bộ tối ưu tuyến hiện có (heuristic chèn tham lam + 2-opt) làm bộ giải ban đầu. Nếu cần tính quãng đường đường bộ, tích hợp nhà cung cấp bản đồ sau khi cấu hình và kiểm soát chi phí; không đưa tuyến qua geocoding/AI mà thiếu bước nhân viên xác nhận tọa độ. Ghi planned/actual arrival và kết quả giao ngay từ MVP để có dữ liệu đánh giá ETA. Chỉ thử ML khi dữ liệu lịch sử đủ và đo được lợi ích.

Thanh toán chuyển khoản trong MVP nên là QR/thông tin chuyển khoản và bước nhân viên xác nhận đã nhận tiền. Chỉ coi là thanh toán tự động khi đã chọn và tích hợp cổng thanh toán có webhook đối soát. Quy tắc COD dưới 10 triệu và không áp dụng cho đơn đặt hộ phải được kiểm tra ở backend, không chỉ ẩn lựa chọn ở giao diện.

## 4. Đánh giá MongoDB

MongoDB **có thể dùng được**, nhưng không phải lựa chọn mình khuyến nghị cho repo hiện tại.

| Tiêu chí | MongoDB | MySQL hiện có |
|---|---|---|
| Quan hệ đơn–khách–sản phẩm–xe–điểm dừng | Phải tự duy trì liên kết và tính nhất quán qua nhiều document; có thể nhúng các dòng hàng/điểm dừng nhưng cập nhật đơn, tồn và tuyến vẫn cần phối hợp | Quan hệ khóa ngoại, unique, giao dịch và truy vấn báo cáo phù hợp trực tiếp |
| Dữ liệu bản đồ / sự kiện linh hoạt | Linh hoạt nếu sau này lưu GPS/event nhiều và cấu trúc thay đổi thường xuyên | Đủ cho vị trí, ETA, lịch sử giao và nhật ký hiện tại; dữ liệu vị trí có thể mở rộng khi có nhu cầu rõ |
| Tương thích mã nguồn hiện tại | Cần thay TypeORM MySQL, schema SQL, migrations/seed, cấu hình Docker và cách truy vấn; TypeORM không cung cấp hỗ trợ Mongo tương đương như với quan hệ | Đã có schema MySQL 8, entity TypeORM, quan hệ và ràng buộc; ít công việc chuyển đổi |
| Rủi ro triển khai | Phải thiết kế lại giao dịch/unique/consistency, đặc biệt khi xác nhận đơn, trừ tồn và xếp tuyến | Ít rủi ro hơn với quy trình nhiều bước, trạng thái và báo cáo tổng hợp |

**Khuyến nghị: giữ MySQL 8 làm cơ sở dữ liệu chính cho MVP.** Đơn hàng, tồn kho, tuyến, điểm dừng và trạng thái có quan hệ chặt; MySQL đã được dựng trong dự án. Chuyển MongoDB lúc này tăng phạm vi mà không giải quyết một trở ngại đã được xác định. Nếu yêu cầu môn học/đơn vị bắt buộc MongoDB, vẫn triển khai được nhưng cần coi Sprint 0 là một quyết định kiến trúc lớn: chốt mô hình document và giao dịch trước, rồi chuyển toàn bộ tầng lưu trữ; không chạy song song hai DB cho cùng một dữ liệu nghiệp vụ.

## 5. Lưu ảnh với Cloudinary

Cloudinary phù hợp để lưu ảnh sản phẩm và ảnh bằng chứng giao/lắp. Backend cấp upload signature ngắn hạn hoặc nhận upload rồi chuyển tiếp; frontend không chứa secret. Lưu URL/asset ID cùng loại ảnh, đơn/điểm dừng, người tải và thời gian trong MySQL. Kiểm tra loại file, kích thước và quyền tải; ảnh bàn giao chỉ được đọc từ đơn thuộc khách đang tra cứu hoặc nhân viên có quyền. Không lưu ảnh nhạy cảm hơn mức cần thiết.

MVP nên hỗ trợ ảnh sản phẩm và ảnh hoàn tất giao. Xóa/sửa ảnh phải có quy tắc rõ và không để lộ credential Cloudinary ở trình duyệt.

## 6. Kế hoạch sprint

Giả định sprint 2 tuần và có người làm FE, BE, cùng một người điều phối/kiểm thử. Trong mỗi sprint, FE và BE làm song song theo hợp đồng API đã chốt đầu sprint; cuối sprint tích hợp trên môi trường chung. Có thể điều chỉnh thời lượng theo số người và lịch môn học.

### Sprint 0 — Chốt nền tảng và hợp đồng (1 tuần chuẩn bị)

**Mục tiêu:** thống nhất quy tắc nghiệp vụ, dữ liệu và API trước khi nối UI với backend.

- **FE:** kiểm kê các trang prototype hiện có; chốt luồng khách, quản lý, nhân viên bán hàng, tài xế; lập danh sách trạng thái/nút và dữ liệu mỗi màn.
- **BE:** chốt OpenAPI DTO cho sản phẩm, đơn, thanh toán, tuyến, điểm dừng, tracking; quy định chuyển trạng thái và lỗi nghiệp vụ; đánh giá MySQL (khuyến nghị giữ), cấu hình dev/staging.
- **Phối hợp:** chốt điều kiện COD/chuyển khoản, khung giờ “sáng/chiều/cả ngày”, giờ chốt 16:00/duyệt 18:00, cách xử lý đơn gấp và đơn giao thất bại; tạo bảng backlog và dữ liệu demo.
- **Hoàn thành khi:** FE và BE cùng dùng một API contract; không còn mâu thuẫn về trạng thái, quy tắc thanh toán và ai được thao tác.

### Sprint 1 — Nền tảng thật: dữ liệu, danh mục, tài khoản truy cập

- **FE:** thay các trang danh mục/chi tiết sản phẩm lấy dữ liệu mẫu bằng API; trạng thái tải/lỗi/rỗng; trang đăng nhập nhân viên tối thiểu.
- **BE:** kết nối MySQL, chuẩn hóa seed/migration; CRUD và truy vấn sản phẩm; kiểm tra tồn; xác thực staff token an toàn cho bản MVP, cấu hình secrets; health check và Swagger.
- **Phối hợp:** quản lý sản phẩm ở admin; tải ảnh sản phẩm lên Cloudinary; lưu asset ID/URL vào DB.
- **Hoàn thành khi:** tạo/sửa/tắt sản phẩm ở admin và thấy dữ liệu nhất quán ngoài trình duyệt; ảnh tải lên qua backend; không có secret trong frontend.

### Sprint 2 — Đặt hàng, nhận đơn và xác nhận

- **FE:** giỏ hàng/checkout, thông tin người đặt và người nhận, đặt hộ gia đình, địa chỉ, ghi chú, khung giờ; QR/chỉ dẫn chuyển khoản; trang quản lý xác nhận, yêu cầu bổ sung, hủy và nhập đơn tại quầy.
- **BE:** tạo đơn có mã TV duy nhất; lưu snapshot giá/chi tiết hàng; quy tắc COD; trạng thái thanh toán pending/verified; xử lý tồn kho và chống đặt trùng; API xác nhận, yêu cầu khách bổ sung, hủy, nhập đơn tại quầy; nhật ký thay đổi trạng thái.
- **Phối hợp:** tọa độ có thể trống; nhân viên sửa/ghim tọa độ. Giai đoạn này chưa tự động đọc địa chỉ bằng AI.
- **Hoàn thành khi:** một đơn mới đi từ checkout đến xác nhận hoặc hủy; backend chặn tổ hợp thanh toán không hợp lệ; không trừ/tồn sai khi request gửi lặp.

### Sprint 3 — Chuẩn bị hàng và điều phối tối ưu

- **FE:** hàng đợi đơn theo ngày/trạng thái; màn chuẩn bị/sẵn sàng; màn điều phối để chọn ngày, xem đơn đủ/thiếu vị trí, chạy tối ưu, xem tuyến và điểm chưa xếp, sửa tuyến nháp, chọn tài xế/xe, duyệt/chốt.
- **BE:** API xe/tài xế và năng lực; chuyển READY; tích hợp bộ solver hiện có; tính thể tích, tải trọng, thời gian dỡ/lắp, khung giờ và giới hạn 8 giờ; tạo tuyến DRAFT; khóa tuyến LOCKED; đảm bảo tuyến locked không bị ghi đè; cơ chế riêng cho đơn gấp.
- **Phối hợp:** bắt đầu dùng Route Matrix/Google Route Optimization nếu được cấu hình và duyệt chi phí; fallback heuristic hoạt động khi API bản đồ lỗi. Không bắt AI làm bộ xếp tuyến.
- **Hoàn thành khi:** quản lý xếp được đơn cho nhiều xe, nhìn rõ lý do đơn chưa xếp, phân công và khóa tuyến; chạy tối ưu lại không thay đổi tuyến đã khóa. Luồng chốt 16:00/duyệt 18:00 có thể thao tác thủ công ở MVP; lịch tự chạy/nhắc tự động là phần bổ sung.

### Sprint 4 — Ứng dụng tài xế, giao/lắp và bằng chứng

- **FE:** giao diện mobile cho tài xế; chỉ hiển thị tuyến được giao; danh sách điểm, chỉ đường ngoài ứng dụng, gọi người nhận, đã đến, giao xong/thất bại, lý do, COD và chụp ảnh.
- **BE:** API bắt đầu tuyến, ghi sự kiện đến/rời điểm, kết quả giao, lý do thất bại, thu COD; kiểm tra tài xế đúng tuyến; tải ảnh bằng chứng Cloudinary; khi thất bại đưa đơn về hàng đợi cần xếp lịch lại mà không làm sai lịch sử tuyến cũ.
- **Hoàn thành khi:** tài xế chỉ cập nhật tuyến của mình; ảnh gắn đúng đơn; tuyến hoàn tất khi mọi điểm có kết quả; đơn lỗi có thể được xếp lại ngày sau.

### Sprint 5 — Theo dõi khách, ETA và thông báo trên web

- **FE:** trang tracking bằng mã đơn + SĐT; trạng thái và lịch sử; khung giờ ETA; dải “điểm thứ N/còn N điểm”; ảnh bàn giao; consent thông báo; tài khoản khách nếu phạm vi MVP yêu cầu.
- **BE:** API tracking chỉ trả dữ liệu của đơn được tra cứu và số điểm phía trước; không trả tên/mã/địa chỉ đơn khác; ETA từ kế hoạch cộng độ trễ quan sát được; endpoint thông báo/lịch sử; phát thông báo khi trạng thái thay đổi.
- **Phối hợp:** cập nhật trạng thái bằng refresh/polling trước; GPS real-time, SMS/Zalo và push notification đưa sang giai đoạn sau.
- **Hoàn thành khi:** khách theo dõi được đơn của mình và ETA cập nhật khi điểm trước hoàn tất/trễ; thử tra cứu sai thông tin không làm lộ dữ liệu người khác.

### Sprint 6 — Quyền truy cập, báo cáo và hoàn thiện MVP

- **FE:** hoàn thiện phân quyền theo quyền thao tác, trang tổng quan và báo cáo cơ bản; trạng thái lỗi/empty/loading; kiểm tra responsive và luồng demo xuyên suốt.
- **BE:** RBAC thật, phân vùng dữ liệu theo khách/tài xế, audit log, báo cáo tổng đơn/doanh thu/tỷ lệ đúng giờ/giao thất bại/km tiết kiệm; rà soát truy vấn, sao lưu, log và cấu hình triển khai.
- **Phối hợp:** xử lý lỗi xuyên luồng; kiểm tra trường hợp giao thất bại, hủy, thanh toán chưa xác nhận, thiếu tọa độ, quá tải xe, không có tài xế, request lặp và API bản đồ/Cloudinary lỗi.
- **Hoàn thành khi:** kịch bản demo ở README chạy bằng DB/API thật, quyền được kiểm tra ở backend, dữ liệu riêng tư được bảo vệ và các KPI khớp dữ liệu nguồn.

### Giai đoạn sau MVP — Tự động hóa và dự đoán

1. Bảo hành theo sản phẩm/đơn và lịch bảo dưỡng; nhắc tự động.
2. Tích hợp SMS/Zalo/email/push và cổng thanh toán có webhook đối soát.
3. Geocoding có kiểm tra độ tin cậy, nhân viên xác nhận vị trí; GPS xe và cập nhật ETA trực tiếp.
4. Đánh giá dữ liệu planned vs actual; chỉ huấn luyện/đưa ML dự đoán ETA vào sau khi đủ dữ liệu và có chỉ số so sánh với baseline.
5. Dự báo nhu cầu, tự động lập lịch chạy tuyến và tối ưu chi phí nhà cung cấp bản đồ.

## 7. Cách làm song song FE và BE

Mỗi chức năng đi theo một lát cắt đầu-cuối, không đợi BE hoàn thành toàn bộ mới bắt đầu FE:

1. Đầu sprint thống nhất DTO, endpoint, quyền và ví dụ lỗi trong OpenAPI.
2. BE triển khai API/DB và seed; FE triển khai màn hình bằng API client hoặc mock đúng contract.
3. Giữa sprint tích hợp một luồng nhỏ trên staging; cập nhật contract khi phát hiện sai lệch.
4. Cuối sprint xác nhận tiêu chí hoàn thành trên dữ liệu backend thật, ghi nhận lỗi và quyết định sprint sau.

Với tính năng chưa có API, FE có thể dùng mock theo contract; không để mock/localStorage trở thành nguồn dữ liệu sản xuất. Các thao tác thay đổi đơn, thanh toán, phân quyền và khóa tuyến phải được xác thực ở backend.

## 8. Trạng thái và quy tắc cốt lõi

Đơn hàng dùng một trường trạng thái làm nguồn chuẩn. Trạng thái hiện có trong repo có thể dùng cho MVP:

```text
PENDING → CONFIRMED → READY → SCHEDULED → OUT_FOR_DELIVERY
                                      → DELIVERED / FAILED
PENDING / CONFIRMED / READY → CANCELLED (theo quyền và điều kiện nghiệp vụ)
```

Tuyến:

```text
DRAFT → LOCKED → IN_PROGRESS → DONE
```

Giao thất bại cần lịch sử lần giao và lý do; đơn được đưa về trạng thái chờ xử lý/xếp lịch theo quy tắc nghiệp vụ mà không xóa dấu vết. Thứ tự điểm trên tuyến LOCKED hoặc IN_PROGRESS không được thay đổi ngầm. Tracking công khai chỉ cung cấp thông tin của chính đơn đó và số lượng điểm phía trước.

## 9. Tình trạng mã nguồn và điểm cần lưu ý khi bắt đầu

- Frontend hiện là bản UI-first, dùng `localStorage` và dữ liệu mẫu; các trang cho khách, admin và tài xế đã có khung. Cần nối dần từng action sang API.
- Backend NestJS đã có module đơn hàng, sản phẩm, tuyến, tracking và system; có TypeORM entities, solver heuristic, tính khoảng cách và ETA. Cần đối chiếu API với giao diện và hoàn thiện nghiệp vụ.
- DB hiện là MySQL 8 theo `database/schema.sql`; backend cấu hình TypeORM/MySQL. Vì vậy khuyến nghị giữ MySQL thay vì đổi DB trong cùng đợt tích hợp.
- Cần rà lại chênh lệch giữa sơ đồ mới và enum/schema hiện có: xác nhận trạng thái thanh toán, trường người đặt/người nhận/đặt hộ, tồn kho, lịch sử giao, ảnh bằng chứng và consent thông báo chưa thể giả định đã lưu đầy đủ.
- `README.md` và `CLAUDE.md` là tài liệu stack/phạm vi hiện tại; các nội dung trong hai sơ đồ là yêu cầu nghiệp vụ cần đưa vào backlog, không tự động có nghĩa mọi phần đều thuộc MVP.
