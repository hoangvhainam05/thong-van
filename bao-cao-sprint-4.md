# Báo cáo Sprint 4 — Tài xế và giao hàng

## Đã triển khai

- Tài khoản có thể liên kết với một tài xế trong trang quản trị. API tài xế chỉ trả các tuyến đã chốt hoặc đang chạy/đã hoàn tất của tài xế được liên kết; không cho tài xế thao tác tuyến của người khác.
- Màn `/driver` và lịch sử dùng MySQL/API: bắt đầu tuyến, ghi giờ đến, xử lý điểm theo thứ tự, xem hàng và thông tin người nhận, gọi điện/chỉ đường, xác nhận COD và ghi lý do thất bại. Đơn, điểm dừng, tiền thu và lịch sử được cập nhật trong cùng transaction. Tuyến kết thúc khi mọi điểm có kết quả.
- Có thể chụp/tải ảnh JPEG, PNG, WebP tối đa 5 MB. Backend kiểm tra quyền và dữ liệu ảnh, tải lên Cloudinary dưới dạng `authenticated`, lưu public ID, định dạng, người tải và thời gian; liên kết xem ảnh chỉ cấp cho tài xế đúng tuyến và có thời hạn 5 phút. Ảnh là tùy chọn; khi Cloudinary chưa cấu hình, việc tải ảnh báo lỗi rõ ràng.
- Đơn FAILED được quản lý hẹn lại sang ngày sau và chuyển READY. Mỗi lần giao có điểm dừng riêng; khóa duy nhất theo đơn đang mở ngăn xếp đồng thời hai tuyến. Kết quả và thứ tự của tuyến cũ không bị sửa. Tracking hiển thị lý do thất bại và không dùng tuyến cũ khi đơn đã về hàng đợi.
- Migration `009_sprint4_delivery.sql` đã áp dụng vào MySQL local. Schema, entity và hướng dẫn chạy đã cập nhật.

## Kiểm tra

- Backend: TypeScript build và 13 unit tests đạt.
- Frontend: production build đạt.
- Integration trên MySQL local: kiểm tra quyền tài xế, trạng thái và thứ tự điểm, COD, lý do thất bại, kết thúc tuyến, hẹn lại, tối ưu lần giao mới, lịch sử tuyến cũ và tracking.
- Kiểm tra Cloudinary thật bằng ảnh thử: upload authenticated, từ chối URL công khai và tài xế khác, tải được bằng liên kết có hạn, sau đó xóa ảnh thử và dữ liệu thử.
- Kiểm tra giao diện trên trình duyệt với tài khoản và tuyến thử: đăng nhập, bắt đầu tuyến, ghi đã đến, xác nhận thu COD và giao thành công. MySQL ghi `DELIVERED`, `PAID`, số tiền thu và tuyến `DONE`; dữ liệu thử đã được dọn.

## Giới hạn

- Ảnh là tùy chọn và hiện chỉ tài xế được phân công xem được. Hiển thị ảnh cho khách thuộc Sprint 5; chưa có thông báo hoặc lịch sử đơn khách đồng bộ MySQL.
- Các màn dashboard/báo cáo vẫn còn dữ liệu mẫu. Chưa có GPS thời gian thực hay giao lại tự động.
- Tài xế phải được liên kết với tài khoản ở trang quản trị. Cần restart backend/frontend sau khi cập nhật mã và migration.
