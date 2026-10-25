# Báo cáo Sprint 2 — Đặt hàng và xác nhận

**Trạng thái:** Hoàn thành theo tiêu chí Sprint 2 trong kế hoạch: checkout → MySQL → nhân viên xác nhận/hủy; backend chặn nghiệp vụ thanh toán không hợp lệ; request lặp không làm sai tồn kho. Build, Jest và integration test đều đạt.

## Đã làm

- Checkout gửi đơn đến `POST /api/orders`; gửi người đặt/người nhận, địa chỉ/toạ độ, ngày/khung giờ, ghi chú, mặt hàng và UUID chống gửi trùng.
- Backend lưu mã `TV...`, snapshot đơn giá, phí giao hàng/tổng tiền, phương thức/trạng thái thanh toán, nguồn đơn và thông tin đặt hộ.
- Backend khoá bản ghi sản phẩm trong transaction, kiểm tra tồn và trừ kho cùng lúc tạo đơn. Hủy đơn chưa thanh toán sẽ hoàn tồn; lặp request cùng UUID trả lại đơn cũ. Bổ sung xử lý xung đột unique key cho các request lặp đồng thời.
- COD bị chặn ở backend với đơn đặt hộ hoặc tổng tiền từ 10 triệu đồng. Chuyển khoản tạo đơn `PENDING`; nhân viên phải xác nhận đã nhận tiền trước khi xác nhận đơn. Đơn đã thanh toán không thể hủy khi chưa có quy trình hoàn tiền.
- Giao diện không còn QR giả hoặc báo “đã thanh toán” khi khách chỉ bấm nút. Khách được thông báo rằng chuyển khoản hiện cần cửa hàng cung cấp thông tin và đối soát thủ công.
- Bổ sung cấu hình tài khoản nhận chuyển khoản qua `.env`; checkout chỉ hiện lựa chọn này khi đủ tên ngân hàng, tên chủ tài khoản và số tài khoản. Mã đơn tạo sẵn nội dung chuyển khoản; không tạo QR giả hoặc giả lập xác nhận tiền.
- Đơn quầy có phương thức tiền mặt tại quầy riêng (`COUNTER_CASH`), mặc định đã thu tiền; backend không cho chọn phương thức này trên checkout website. Đơn đã thu tiền không thể hủy trước khi có nghiệp vụ hoàn tiền.
- Trang quản trị tải đơn từ API khi đã nhập staff token; có thao tác xác nhận chuyển khoản, xác nhận đơn, đánh dấu sẵn sàng, hủy với lý do, yêu cầu bổ sung thông tin, chỉnh vị trí và tạo đơn tại quầy.
- Thêm `order_history` để lưu trạng thái, đối soát thanh toán, yêu cầu bổ sung và chỉnh vị trí. Ghi nhận nguồn `WEB`/`COUNTER`.
- Trang `/track` tra cứu qua API bằng mã đơn và số điện thoại; chỉ trả dữ liệu khi khớp số điện thoại người đặt. Khách nhìn được yêu cầu bổ sung và hướng dẫn chuyển khoản (nếu cửa hàng đã cấu hình).
- Thêm `npm run test:integration` để kiểm tra API/MySQL xuyên suốt và tự dọn đơn/customer tạm.
- Sửa lỗi TypeORM khi lưu mặt hàng: gán `order_id` rõ ràng sau khi tạo đơn thay vì dựa vào cascade.
- Áp dụng schema/migration Sprint 2 vào MySQL local; cập nhật hướng dẫn migration trong README.

## Kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| `cd backend && npm run build` | Đạt |
| `cd frontend && npm run build` | Đạt; còn cảnh báo Next chọn lockfile ở thư mục cha làm workspace root |
| `cd backend && npm test -- --runInBand` | Đạt: 2 suites, 4 tests |
| `cd backend && npm run test:integration` | Đạt: 8 nhóm kiểm thử, gồm request đồng thời, tra cứu riêng tư, yêu cầu bổ sung, thanh toán, COD, hoàn tồn, chỉnh vị trí, nhập đơn tại quầy và tiền mặt tại quầy |
| MySQL/API smoke test trước đó | Đạt 10/10 nhóm; kiểm tra concurrency bổ sung đạt 4/4 |
| Dữ liệu thử | Đã xóa các order/customer thử; hoàn tồn kho về giá trị trước test |

Smoke test dùng API và MySQL local, không phải kiểm thử trình duyệt tự động. Các test Jest hiện có chủ yếu kiểm tra module sản phẩm/Cloudinary; chưa có bộ integration test orders được lưu trong repo.

## Việc ngoài Sprint 2 / chuẩn bị giai đoạn sau

1. **Bật nhận chuyển khoản:** các biến `BANK_NAME`, `BANK_ACCOUNT_NAME` và `BANK_ACCOUNT_NUMBER` trong `backend/.env` đang để trống. Điền thông tin thật để checkout mở phương thức này; không gửi thông tin tài khoản vào chat.
2. **Xác thực đầy đủ:** API nhân viên hiện dùng một `STAFF_TOKEN` chung. Đăng nhập nhân viên, RBAC theo người dùng, đăng nhập khách và tự hủy đơn sẽ hoàn thiện theo Sprint 6/phạm vi MVP đã chốt.
3. **Thanh toán tự động và kênh thông báo:** QR động, webhook/cổng thanh toán, SMS/Zalo/email thuộc giai đoạn sau MVP. Hiện nhân viên xác nhận chuyển khoản thủ công; khách có thể đọc yêu cầu bổ sung trên `/track` và cần liên hệ cửa hàng để phản hồi.
4. **Sprint tiếp theo:** tích hợp lưu tuyến/điểm dừng, phân xe/tài xế, khóa tuyến và ứng dụng giao hàng theo Sprint 3/4; một số màn hiện vẫn là demo/localStorage.
5. **Dependency audit:** còn cảnh báo Next/PostCSS như báo cáo Sprint 1; xử lý qua nâng phiên bản có đánh giá, không tự nâng major trong sprint này.

## Chuẩn bị Sprint 3

- Nối hàng đợi `READY` từ API vào màn điều phối; đảm bảo ID đơn backend ổn định khi tạo tuyến.
- Chuyển lưu tuyến/điểm dừng sang transaction MySQL; khóa tuyến không bị ghi đè khi tối ưu lại.
- Chốt hợp đồng API xe, tài xế, năng lực và chuyển `READY → SCHEDULED` trước khi triển khai UI điều phối.
- Giữ bộ tối ưu heuristic hiện có làm fallback; Google Maps/Route Optimization cần cấu hình, ngân sách và kiểm thử riêng.
