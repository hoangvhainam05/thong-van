# Báo cáo Sprint 5 — Theo dõi khách, ETA và thông báo web

## Đã triển khai

- `/track` tra cứu đơn thật bằng mã đơn và số điện thoại người đặt, dùng POST trên giao diện và tự làm mới mỗi 30 giây. Kết quả thể hiện trạng thái, sản phẩm, lịch sử phù hợp cho khách, khung ETA, số điểm phía trước và dải điểm ẩn danh. Không còn fallback sang dữ liệu mẫu khi API lỗi.
- ETA lấy khoảng dự kiến và cộng độ trễ ở điểm trước gần nhất, tính cả thời gian phục vụ thực tế. Khi giao thất bại rồi hẹn lại, tracking dùng lần giao mới và không hiển thị tuyến cũ trong lúc chờ xếp.
- Khách đã đăng nhập xem danh sách và chi tiết đơn từ MySQL. Backend lọc theo customer ID của phiên, không nhận customer ID từ client; đơn không thuộc khách trả 404. Checkout chuyển đến chi tiết bằng ID đơn thật.
- Với đơn đã giao có ảnh, khách có thể lấy liên kết Cloudinary authenticated có thời hạn 5 phút sau khi xác thực đúng mã + SĐT hoặc đúng tài khoản. Không có URL công khai cho ảnh.
- Thông báo website dùng sự kiện đã ghi trong lịch sử đơn. Khách chủ động đồng ý hoặc tắt, chỉ thấy sự kiện sau thời điểm đồng ý, có số chưa đọc và đánh dấu đã đọc; lựa chọn và trạng thái đọc lưu MySQL. Giao diện polling 30 giây; không gửi SMS/email/push.
- Đã áp dụng migration `010_sprint5_notifications.sql` và `011_notification_timestamps.sql` vào MySQL local.

## Kiểm tra

- Backend: TypeScript compile và 13 unit tests đạt. Frontend: production build đạt.
- Integration MySQL kiểm tra đúng/sai số điện thoại, cô lập tài khoản, tiến độ và ETA theo điểm trước, đồng ý và ngừng nhận thông báo, trạng thái đọc độc lập giữa hai khách, và không lộ dữ liệu đơn khác.
- Kiểm tra Cloudinary thật: chỉ chủ đơn hoặc người có mã + SĐT đúng được cấp liên kết ảnh, tải được ảnh và dữ liệu thử được dọn.
- Kiểm tra trình duyệt với tài khoản và đơn thử: danh sách và chi tiết đơn từ API, đồng ý nhận thông báo, nhận sự kiện sau khi nhân viên xác nhận đơn, và tra cứu bằng mã + số điện thoại. Dữ liệu thử được dọn.

## Giới hạn

- Danh sách thông báo hiển thị 100 sự kiện gần nhất; số chưa đọc tính trên toàn bộ sự kiện từ thời điểm bật. Không có push, SMS hoặc email.
- ETA là ước tính từ kế hoạch và tiến độ các điểm trước, không có GPS/giao thông trực tiếp. Dashboard và báo cáo vẫn dùng dữ liệu mẫu.
- Chưa có giới hạn số lần thử đăng nhập/tra cứu; cần triển khai trước khi đưa hệ thống ra Internet. API tracking GET cũ vẫn nhận SĐT trong query để tương thích; giao diện mới dùng POST.
