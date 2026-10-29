# Báo cáo Sprint 3 — Chuẩn bị hàng và điều phối tuyến

**Trạng thái:** Hoàn thành phạm vi MVP của Sprint 3 trên MySQL local. Quản lý có thể xếp đơn `READY` lên nhiều xe, xem đơn chưa xếp được, chỉnh tuyến nháp, phân tài xế và khóa tuyến. Tối ưu lại giữ nguyên tuyến đã khóa.

## Rà soát và khắc phục Sprint 1–2

- Danh mục/chi tiết sản phẩm không còn âm thầm dùng dữ liệu mẫu khi API lỗi; trạng thái tải, lỗi và rỗng được tách rõ.
- Lưu cả Cloudinary URL và `public_id` của ảnh sản phẩm trong MySQL, thuận tiện quản lý asset về sau.
- Cấu hình Next.js workspace root rõ ràng; build không còn cảnh báo chọn lockfile ở thư mục cha.
- Cho phép đơn đã xác nhận chuyển `READY` khi chưa có tọa độ. Đơn đó hiện trong hàng đợi nhưng không được đưa vào bộ giải cho đến khi nhân viên cập nhật vị trí.
- Chạy lại integration test Sprint 2 với MySQL local: 8/8 nhóm đạt và dữ liệu thử được dọn.

## Đã làm trong Sprint 3

### Backend và database

- Thêm API đọc/tạo/sửa tài xế, xe, trạng thái hoạt động và sức chứa m³/kg; thêm API đọc kho. Các API nhân viên dùng `X-Staff-Token` như các sprint trước.
- Bổ sung cờ đơn gấp, API đổi ưu tiên trước khi xếp lịch và sự kiện `PRIORITY` trong lịch sử đơn.
- Bộ giải heuristic tính thể tích, tải trọng kg, thời gian dỡ hàng và lắp đặt, khung giờ giao và ca tối đa 8 giờ; đơn gấp được xét trước khi xếp. Mỗi tuyến xuất phát từ kho, đi qua các điểm theo thứ tự và quay về kho.
- Tối ưu tuyến trong transaction MySQL: thu hồi tuyến nháp cũ, đưa đơn của tuyến đó về `READY`, tạo tuyến/điểm dừng mới và chuyển đơn đã xếp sang `SCHEDULED`. Trả về lý do chưa xếp: thiếu xe, vượt sức chứa, hoặc không phù hợp khung giờ/ca. Đơn thiếu tọa độ được trả riêng.
- Cho sửa thứ tự điểm, xe và tài xế trên tuyến `DRAFT`; backend tính lại ETA, km, thời gian và kiểm tra ràng buộc. Khóa tuyến yêu cầu có tài xế và xe đang hoạt động. Tối ưu lại không sửa tuyến `LOCKED`.
- Thêm ràng buộc unique theo ngày cho xe/tài xế trên tuyến để tránh phân trùng; thêm migration `005_sprint3_dispatch.sql` và cập nhật `schema.sql`. Migration 005 đã áp dụng cho MySQL local.

### Frontend

- `/admin/dispatch` lấy đơn, tuyến, kho, xe và tài xế từ API/MySQL; lọc theo ngày, chỉ rõ đơn thiếu vị trí, đánh dấu gấp, chọn xe, tối ưu, hiển thị lý do chưa xếp, bản đồ tuyến và các thao tác sửa/chốt tuyến.
- `/admin/fleet` quản lý tài xế và xe qua API, gồm sức chứa và trạng thái hoạt động.
- `/admin/routes/[id]` đọc tuyến đã lưu và hiển thị thứ tự điểm, ETA, quãng đường, thời gian và bản đồ.

## Kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Backend `npm test -- --runInBand` | Đạt: 3 suites, 7 tests; có test tải trọng kg, ca 8 giờ, ưu tiên đơn gấp |
| Backend `npm run build` | Đạt |
| Frontend `npm run build` | Đạt, không còn cảnh báo workspace root |
| Backend `npm run test:integration` | Đạt: 8/8 nhóm Sprint 2; cleanup thành công |
| Backend `npm run test:dispatch` | Đạt: 7/7 nhóm Sprint 3; kiểm tra quyền, CRUD xe/tài xế, thiếu vị trí, đơn gấp, tối ưu, sửa/chốt và giữ tuyến đã khóa; cleanup thành công |
| Trình duyệt + API + MySQL | `/admin/dispatch` tải hàng đợi, xe/tài xế/kho; `/admin/fleet` hiển thị tài xế và sức chứa xe. `/products` tải 10 sản phẩm từ API; khi dừng backend, trang hiện lỗi thay vì hàng mẫu. Lỗi truy vấn kho phát hiện khi kiểm tra UI đã được sửa. |
| `git diff --check` | Đạt |

## Giới hạn và chuẩn bị Sprint 4

- Google Route Matrix/Route Optimization chưa bật: chưa có cấu hình và phê duyệt chi phí API trong dự án. Bộ giải hiện dùng khoảng cách Haversine nhân hệ số đường bộ, nên km/ETA là ước lượng; phần kết nối Google chỉ triển khai khi có key, hạn mức và kiểm thử fallback.
- Việc chốt mốc 16:00/18:00 đang thao tác thủ công theo kế hoạch MVP; chưa có lịch tự chạy hoặc nhắc tự động.
- `/driver`, dashboard, một số màn tài khoản và phân quyền frontend vẫn dùng dữ liệu demo/localStorage. Backend chỉ có staff token dùng chung; chưa có đăng nhập nhân viên và RBAC theo người dùng. Không coi tài khoản demo là kiểm soát truy cập backend.
- Sprint 4 cần nối màn tài xế với tuyến `LOCKED/IN_PROGRESS`, ghi đến/rời điểm, kết quả giao, COD và ảnh bằng chứng Cloudinary; xử lý giao thất bại và xếp lại mà vẫn giữ lịch sử tuyến cũ. Sau đó kiểm thử xuyên suốt từ chốt tuyến đến khách tra cứu.
