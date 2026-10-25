# Thông Vân — Hệ thống quản lý đơn hàng & tối ưu hoá giao hàng thông minh

*Intelligent Order & Delivery Optimization System* — MVP cho môn Quản trị dự án TMĐT.

```
Order  →  Logistics  →  Optimization  →  Customer Tracking
```

| Tầng | Công nghệ | Thư mục |
|---|---|---|
| Frontend (khách, quản lý, tài xế) | Next.js 15 (App Router) | `frontend/` |
| Backend API | NestJS · TypeORM · MySQL | `backend/src/` |
| Optimization Engine | Heuristic VRPTW (TypeScript) | `backend/src/optimization/` |
| Database | MySQL 8 | `database/` |
| Agent hỗ trợ phát triển | [agency-agents](https://github.com/msitarzewski/agency-agents) | `.claude/agents/` |

## 0. Giao diện demo (chạy độc lập, chưa cần backend)

Giao diện hiện chạy bằng **dữ liệu mẫu lưu trong trình duyệt** (`frontend/lib/store.js`), nên chỉ cần:
```bash
cd frontend && npm install && npm run dev     # mở http://localhost:3000
```

**Tài khoản mẫu** (mật khẩu đều là `123456`, có nút đăng nhập nhanh ở /login):

| Tài khoản | Vai trò | Trang chính | Làm được gì |
|---|---|---|---|
| khach@thongvan.vn | Khách hàng | `/` , `/account/orders` | Mua hàng, thanh toán, theo dõi "còn N điểm trước bạn" |
| admin@thongvan.vn | Quản trị viên | `/admin` | Toàn quyền, tài khoản, phân quyền, cài đặt, nhật ký |
| quanly@thongvan.vn | Quản lý điều phối | `/admin/dispatch` | Tối ưu tuyến, chốt tuyến, đổi tài xế, xuất kho, báo cáo |
| banhang@thongvan.vn | Nhân viên bán hàng | `/admin/orders` | Xác nhận đơn, sửa vị trí, quản lý sản phẩm, xem khách |
| taixe1@thongvan.vn | Nhân viên giao hàng | `/driver` | Tuyến hôm nay, đã đến, giao xong / thất bại |
| (không đăng nhập) | Khách vãng lai | `/track` | Xem sản phẩm, tra cứu đơn bằng mã + SĐT |

**Phân quyền** (`frontend/lib/rbac.js`): 24 quyền chia 5 nhóm, ma trận mặc định cho 5 vai trò, chỉnh trực tiếp ở `/admin/roles`.
Giao diện kiểm tra *quyền* chứ không kiểm tra tên vai trò: menu, nút bấm và trang đều ẩn/chặn theo quyền (trang thiếu quyền hiện màn hình 403).
Mọi thao tác trong `store.js` kiểm tra quyền lần nữa (giống backend sẽ làm) và ghi nhật ký. Ngoài quyền còn giới hạn phạm vi dữ liệu: khách chỉ thấy đơn của mình, tài xế chỉ cập nhật tuyến của mình.

**Dữ liệu mẫu** (`frontend/lib/mock/`): 32 sản phẩm, 72 khách, ~240 đơn trong 21 ngày qua đến 2 ngày tới, 30+ tuyến đã chạy, 5 tài xế, 5 xe. Hôm nay có một tuyến đang chạy, một tuyến đã chốt, đơn chờ xác nhận và một đơn thiếu vị trí để thử. Dữ liệu tự sinh lại mỗi ngày; nút "Khôi phục dữ liệu mẫu" ở `/admin/settings`.

**Kịch bản thử nhanh:** khách đặt hàng → bán hàng xác nhận, bấm "Sẵn sàng" → quản lý mở Điều phối, chạy tối ưu, duyệt và chốt, xuất kho → tài xế bấm "Đã đến", "Giao thành công" → khách thấy số điểm phía trước giảm đi. Thử tắt quyền ở `/admin/roles` rồi đăng nhập lại vai trò đó để thấy menu và trang bị chặn.

## 1. Chạy toàn bộ hệ thống (macOS)

Cần cài: **Node.js 20+**, và **Docker Desktop** (hoặc MySQL cài bằng Homebrew).

### Bước 1 — Database
```bash
docker compose up -d          # tạo DB thongvan + bảng + dữ liệu mẫu
```
Không dùng Docker:
```bash
brew install mysql && brew services start mysql
mysql -u root < database/schema.sql
mysql -u root < database/seed.sql
mysql -u root -e "CREATE USER IF NOT EXISTS 'thongvan'@'localhost' IDENTIFIED BY 'thongvan'; GRANT ALL ON thongvan.* TO 'thongvan'@'localhost';"
```
> Dữ liệu mẫu dùng ngày giao = ngày khởi tạo DB. Muốn demo lại ngày khác:
> `UPDATE orders SET delivery_date = CURDATE();`

### Bước 2 — Backend
```bash
cd backend
npm install
cp .env.example .env          # đổi STAFF_TOKEN
npm run start:dev -- --port 8000
```
Tài liệu API: http://localhost:8000/docs

Nếu đang dùng database cũ, dừng backend và chạy các migration chưa áp dụng theo thứ tự. Bỏ qua migration đã chạy; không chạy chúng trên database vừa tạo từ `schema.sql`:
```bash
mysql -u thongvan -p thongvan < database/migrations/001_product_catalog.sql
mysql -u thongvan -p thongvan < database/migrations/002_checkout_orders.sql
mysql -u thongvan -p thongvan < database/migrations/003_order_history_and_counter.sql
mysql -u thongvan -p thongvan < database/migrations/004_counter_cash_payment.sql
```
Để tải ảnh sản phẩm, điền `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` và `CLOUDINARY_API_SECRET` trong `backend/.env`. API chỉ gửi chữ ký tạm thời về trình duyệt; không đặt API secret vào biến `NEXT_PUBLIC_*`.

Để bật lựa chọn chuyển khoản thủ công ở checkout, điền `BANK_NAME`, `BANK_ACCOUNT_NAME` và `BANK_ACCOUNT_NUMBER`; nội dung chuyển khoản dùng `BANK_TRANSFER_CONTENT_PREFIX` cộng mã đơn. Nếu thiếu thông tin tài khoản, checkout sẽ ẩn phương thức chuyển khoản. Hệ thống chưa tạo QR hoặc tự đối soát giao dịch.

### Bước 3 — Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Mở http://localhost:3000

Danh mục và chi tiết sản phẩm lấy từ API/MySQL; checkout tạo đơn trong MySQL; trang đơn quản trị tải đơn và gửi thao tác xác nhận, thanh toán, huỷ, cập nhật vị trí, yêu cầu bổ sung và nhập đơn tại quầy qua API. `/track` tra cứu qua API bằng mã đơn và số điện thoại. Ở trang quản lý sản phẩm, nhập `STAFF_TOKEN` đã cấu hình trong `backend/.env`; token này hiện dùng chung cho API nhân viên, chưa thay thế đăng nhập/RBAC thật ở backend. Điều phối tuyến, giao hàng và một số màn tài khoản vẫn còn phần demo/localStorage theo các sprint tiếp theo.

### Kiểm tra backend
```bash
cd backend && npm run build
npm test -- --runInBand
```

Khi MySQL và backend đang chạy, có thể chạy `npm run test:integration` để kiểm tra checkout, trạng thái, tồn kho, quyền staff, tra cứu đơn và nhập đơn quầy. Script tạo đơn thử rồi dọn dữ liệu của chính nó; chỉ chạy trên database phát triển.

## 2. Kịch bản demo (10 phút)

1. **/admin** → nhập `STAFF_TOKEN` → thấy 10 đơn mẫu (8 READY, 1 CONFIRMED, 1 PENDING).
2. Bấm **Tối ưu tuyến** → hệ thống chia đơn cho 2 xe, hiện tổng km và **% tiết kiệm so với giao theo thứ tự đặt hàng**.
3. Khách tra **/track** với `TV000003` + `0911000003` → thấy *"điểm giao thứ N"* và khung giờ ETA (lịch còn có thể đổi).
4. Admin bấm **Duyệt & chốt tuyến** → **Xuất kho**.
5. **/driver** → chọn tài xế → bấm *Đã đến* / *Giao xong* từng điểm.
6. Khách tải lại **/track** → *"Còn 1 điểm giao trước bạn"*, ETA tự dời nếu tài xế đang trễ.
7. Đặt một đơn mới ở **/** → admin xác nhận → nhập toạ độ → Sẵn sàng → tối ưu lại: tuyến đã chốt **không bị xáo trộn**.

## 3. Luồng nghiệp vụ & trạng thái

```
Đơn:   PENDING → CONFIRMED → READY → SCHEDULED → OUT_FOR_DELIVERY → DELIVERED / FAILED
                         └──────── CANCELLED ────────┘
Tuyến: DRAFT (còn tối ưu lại) → LOCKED (đã chốt) → IN_PROGRESS → DONE
```

- **Một nguồn trạng thái duy nhất**: `orders.status`.
- **Quy tắc chốt tuyến** (xử lý rủi ro R7): tối ưu lại chỉ đụng tới tuyến `DRAFT`; đơn phát sinh sau khi chốt vào tuyến kế tiếp → khách không bị tụt vị trí.
- **Quyền riêng tư**: trang theo dõi chỉ hiện *số* điểm phía trước, không lộ mã đơn/địa chỉ người khác; tra cứu cần mã đơn **và** SĐT.

## 4. Optimization Engine

Bài toán **VRPTW** — Vehicle Routing Problem with Time Windows + Capacity.

- **Mục tiêu**: `min  WEIGHT_KM × tổng km + WEIGHT_TIME × tổng phút`
- **Ràng buộc cứng**: sức chứa xe (m³), khung giờ khách, giờ làm việc.
- **Thời gian phục vụ mỗi điểm** = 10 phút dỡ hàng + thời gian lắp đặt từng sản phẩm (đặc thù điện máy).
- **Khoảng cách**: MVP dùng Haversine × hệ số đường bộ (`backend/src/optimization/distance.ts`). Muốn chính xác hơn, thay bằng Map API (Google Maps / Goong / OSRM) mà không phải sửa bộ giải.
- **Bộ giải**: heuristic TypeScript (chèn tham lam + 2-opt), luôn chạy được và không cần runtime ngoài Node.js.
- **ETA** (`backend/src/optimization/eta.ts`): giờ đến dự kiến mở rộng thành khung giờ. Hàm `predictDelayMinutes` là chỗ cắm **mô hình AI dự đoán trễ** ở giai đoạn sau, khi đã có dữ liệu `planned_arrival` vs `actual_arrival`.

> "Thuật toán tối ưu lo tuyến đường, AI lo dự đoán thời gian."

## 5. Ngoài phạm vi MVP (Future Development)
Đăng nhập & phân quyền đầy đủ (hiện dùng một `STAFF_TOKEN` chung), GPS real-time, thông báo SMS/Zalo, cổng thanh toán online, geocoding tự động, mô hình ML cho ETA, dự báo nhu cầu.

## 6. Agent hỗ trợ (agency-agents)
Xem `CLAUDE.md` để biết agent nào dùng cho việc gì.
