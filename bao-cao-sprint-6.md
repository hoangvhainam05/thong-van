# Báo cáo Sprint 6 — Phân quyền, báo cáo và hoàn thiện MVP

## Đã triển khai

- Tổng quan, báo cáo, danh sách khách và nhật ký thao tác lấy dữ liệu từ API/MySQL, có kiểm tra `dashboard.view`, `report.view`, `customer.view` và `audit.view` ở backend. Đơn quản trị không còn trộn đơn mẫu; chi tiết đơn tải trực tiếp theo ID thật. Màn cài đặt hiển thị cấu hình thực tế ở chế độ chỉ đọc.
- Báo cáo tách đơn theo ngày giao, lần giao theo ngày hoàn tất, tuyến theo ngày tuyến. Giá trị đơn đã giao không được gọi là tiền đã đối soát; km là kế hoạch. Tỷ lệ đúng giờ tính trên lần giao thành công có giờ đến; tỷ lệ thất bại tính trên các lần giao có kết quả. So sánh km chỉ tính tuyến có baseline.
- Thêm nhật ký phía máy chủ cho các thay đổi API đã xác thực. Lưu người thực hiện, vai trò, phương thức, đường dẫn và các trường trạng thái/quyền đã chọn; không lưu token, mật khẩu hay toàn bộ body. API nhật ký phân trang và yêu cầu `audit.view`.
- Giới hạn cơ bản theo IP cho đăng nhập/đăng ký và tra cứu. Giỏ hàng và checkout lấy phí và ngưỡng miễn phí từ backend thay vì dùng giá trị mẫu; menu khách dùng số thông báo từ API. Đơn giao thất bại đã hẹn lại có thể cập nhật vị trí khi không còn điểm giao đang mở.
- Thêm index cho báo cáo điểm giao, script sao lưu MySQL, và migration `012`, `013`, `014`; các migration đã áp dụng vào MySQL local.

## Kiểm tra

- Backend: compile và 14 unit tests đạt. Frontend: production build đạt.
- Integration: đối chiếu KPI từ dữ liệu thử gồm một đơn giao thất bại rồi giao lại, đơn hủy, giờ đến và hai tuyến; kiểm tra quyền, nhật ký và dữ liệu khách.
- Hồi quy: Sprint 2 đạt 8/8 nhóm, Sprint 3 đạt 7/7 nhóm; các script xác thực, giao hàng và tracking đều đạt. Dữ liệu thử đã dọn.
- Trình duyệt: đăng nhập quản trị thử, xác nhận đơn thử, xem nhật ký và báo cáo, mở trực tiếp chi tiết đơn. Đã đối chiếu trạng thái và nhật ký trong MySQL, sau đó dọn dữ liệu thử.
- Kiểm tra giỏ hàng trên trình duyệt: sản phẩm 690.000 ₫, phí cấu hình 150.000 ₫, tổng 840.000 ₫; đã xóa sản phẩm thử khỏi giỏ.
- Script backup tạo được dump tạm và gzip hợp lệ; bản tạm đã được xóa. Chưa thử khôi phục database đầy đủ.

## Giới hạn

- Nhật ký ghi sau khi thay đổi đã commit; lỗi ghi log hoặc tiến trình dừng giữa hai bước có thể làm thiếu sự kiện. Không ghi các yêu cầu thất bại và chưa có lưu trữ bất biến.
- Rate limit trong bộ nhớ từng tiến trình, đặt lại khi restart; triển khai nhiều instance hoặc qua proxy cần lớp giới hạn chia sẻ và cấu hình IP đáng tin cậy.
- Cấu hình chỉ đọc trên giao diện; chưa có màn cập nhật cấu hình backend. Sao lưu chưa tự động và cần thử khôi phục trên database riêng. Một số dữ liệu trình diễn và giỏ hàng vẫn ở trình duyệt.
