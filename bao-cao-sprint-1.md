# Báo cáo Sprint 1 — Nền tảng dữ liệu sản phẩm

**Trạng thái:** Hoàn thành. Sau khi cập nhật tài khoản MySQL, đã khởi tạo database local, chạy API bằng MySQL thật và kiểm tra luồng sản phẩm cùng upload Cloudinary.

## Đã làm

- Backend đọc danh mục sản phẩm đang bán từ MySQL với đủ các trường giao diện cần: mã SKU, hãng, danh mục, giá/giá cũ, tồn kho, thể tích, cân nặng, thời gian lắp, bảo hành, mô tả và URL ảnh.
- Thêm API quản trị để đọc cả sản phẩm ẩn, tạo, sửa và ẩn/hiện sản phẩm. Thay đổi ghi xuống MySQL; SKU được tạo tự động nếu chưa nhập và kiểm tra trùng.
- API quản trị được bảo vệ bằng `X-Staff-Token`. Giao diện sản phẩm quản trị cho phép nhập token từ cấu hình backend; đây vẫn là token dùng chung của bản MVP, chưa phải đăng nhập/phân quyền cá nhân.
- Trang danh mục và chi tiết sản phẩm tải dữ liệu từ API/MySQL. Sau đợt rà soát trước Sprint 3, hai trang hiển thị riêng trạng thái đang tải, lỗi kết nối và không có sản phẩm; không còn dùng sản phẩm mẫu khi API lỗi. Ảnh Cloudinary được hiển thị ở danh sách và chi tiết.
- Thêm API ký upload Cloudinary ở backend. API secret chỉ nằm trong backend; giao diện tải ảnh trực tiếp bằng chữ ký tạm thời. Kiểm tra ảnh ở giao diện: loại ảnh và kích thước tối đa 5 MB.
- Bổ sung cột SKU, hãng, giá cũ, thời hạn bảo hành, tồn kho, mô tả và URL ảnh dài hơn vào entity/schema. Sau đợt rà soát trước Sprint 3, lưu thêm `image_public_id` của Cloudinary cùng URL qua migration 005. Cập nhật seed cho cài đặt mới và thêm migration cho database cũ, gồm chuyển tên danh mục sang mã slug mà giao diện dùng.
- Bổ sung cấu hình mẫu Cloudinary, cấu hình API URL cho frontend và hướng dẫn migration/configuration trong README.

## Kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| `cd backend && npm test -- --runInBand` | Đạt: 2 suites, 4 tests |
| `cd backend && npm run build` | Đạt |
| `git diff --check` | Đạt, không có lỗi whitespace |
| `cd frontend && npm ci` | Đạt: cài 23 packages |
| `cd frontend && npm run build` | Đạt; Next cảnh báo tìm thấy nhiều lockfile và chọn workspace root phía trên repo |
| MySQL bằng cấu hình `backend/.env` | Đạt: kết nối local; tạo DB `thongvan` mới bằng schema/seed, có 10 sản phẩm, 10 đơn và 10 khách hàng mẫu |
| API sản phẩm với MySQL | Đạt: health/public/admin, chặn thiếu staff token, tạo/sửa/ẩn/hiện/đọc sản phẩm; dọn sản phẩm thử sau kiểm tra |
| Upload Cloudinary thật | Đạt: upload ảnh PNG thử và xóa asset sau đó; API secret không trả về frontend |
| `docker compose ps` | Docker daemon/socket chưa hoạt động; lần kiểm tra này dùng MySQL local đang chạy ngoài Docker |
| `npm audit` (frontend) | Có 2 advisories: Next mức moderate, PostCSS mức high; đề xuất tự động cần nâng Next sang major mới (16.4.3), chưa tự đổi dependency |

Migration `001_product_catalog.sql` đã được áp dụng cho database local trước đó. Backend build/unit tests vẫn chạy độc lập với database; các API smoke test bổ sung ở trên xác nhận kết nối MySQL thực. Chi tiết khắc phục phát hiện TypeORM và kiểm thử API đơn hàng được ghi ở báo cáo Sprint 2.

## Theo dõi sau Sprint 1

1. `backend/.env` hiện dùng tài khoản có quyền rộng cho môi trường local. Trước staging/production, tạo user MySQL riêng với quyền tối thiểu trên database `thongvan`; không đưa `.env` vào Git.

2. Đã khai báo `outputFileTracingRoot` trong `frontend/next.config.mjs`; build sau Sprint 3 không còn cảnh báo chọn lockfile ở thư mục cha.

3. `npm audit` ghi nhận 2 advisories trong cây frontend: Next mức moderate và PostCSS mức high. Bản sửa tự động được đề xuất cần nâng Next qua major; cần đánh giá migration rồi mới nâng.

4. Khi chuyển sang database có dữ liệu khác, sao lưu trước rồi chỉ chạy những migration còn thiếu theo thứ tự `001` đến `005`. Database mới dùng `schema.sql`/`seed.sql` thì không chạy lại migration.

5. Nếu cài lại frontend dependencies khi cần, dùng:

   ```bash
   cd frontend
   npm ci
   npm run build
   ```

## Tiếp theo

Sprint 2 đã bắt đầu; xem [báo cáo Sprint 2](bao-cao-sprint-2.md) để biết phần đã tích hợp, kết quả test và các giới hạn còn lại.
