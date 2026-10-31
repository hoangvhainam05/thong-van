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

## 0. Giao diện demo và phần đã kết nối backend

Có thể xem các màn demo bằng frontend độc lập:
```bash
cd frontend && npm install && npm run dev     # mở http://localhost:3000
```

**Tài khoản và phân quyền:** MySQL lưu `user`, `role`, `permission`, `role_permission` và `user_session`. Đăng nhập tại `/login`, khách có thể đăng ký tại `/register`; quản trị viên quản lý tài khoản tại `/admin/users` và vai trò tại `/admin/roles`. Mật khẩu được băm bằng scrypt, token phiên lưu dưới dạng hash ở máy chủ và hết hạn sau 12 giờ. API kiểm tra quyền hiện tại từ cơ sở dữ liệu cho mỗi yêu cầu. Không còn dùng `STAFF_TOKEN`.

Đối với cơ sở dữ liệu mới hoặc chưa có ADMIN, tạo quản trị viên đầu tiên từ terminal trong thư mục `backend` (lệnh không hoạt động nếu đã có ADMIN):

```bash
read 'BOOTSTRAP_ADMIN_EMAIL?Email quản trị: '
read -s 'BOOTSTRAP_ADMIN_PASSWORD?Mật khẩu (ít nhất 8 ký tự): '
echo
export BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD
npm run bootstrap:admin
unset BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD
```

Không có mật khẩu mặc định. API quản trị yêu cầu `Authorization: Bearer <token>` nhận từ `POST /api/auth/login`. Vai trò hệ thống không thể xóa; không thể tự xóa, tự khóa hoặc tự đổi vai trò; quyền quản trị cốt lõi của ADMIN không thể bị gỡ.

**Dữ liệu mẫu** (`frontend/lib/mock/`) vẫn tồn tại cho phần trình diễn và giỏ hàng phía trình duyệt. Danh mục, đơn, tài xế, tracking, tổng quan và báo cáo sử dụng API/MySQL; không dùng các con số mô phỏng làm báo cáo vận hành.

Đơn, tracking và thông báo khách dùng MySQL; khách đăng nhập chỉ xem được đơn thuộc hồ sơ của mình. Đăng nhập/đăng ký giới hạn 10 yêu cầu mỗi IP trong 5 phút; tra cứu giới hạn 60 yêu cầu mỗi IP/phút. Bộ đếm nằm trong bộ nhớ từng tiến trình và đặt lại khi khởi động lại; khi triển khai nhiều máy hoặc sau proxy cần giới hạn chia sẻ tại proxy/gateway theo IP được xác thực.

**Kịch bản API thật hiện có:** khách đặt hàng → bán hàng xác nhận và chuẩn bị → quản lý tối ưu, phân công và chốt tuyến → tài xế bắt đầu tuyến, ghi đến nơi, ảnh bằng chứng, tiền COD và kết quả từng điểm → quản lý hẹn lại đơn thất bại nếu cần.

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
cp .env.example .env          # cấu hình kết nối MySQL
npm run start:dev -- --port 8000
```
Tài liệu API: http://localhost:8000/docs

Nếu đang dùng database cũ, dừng backend và chạy các migration chưa áp dụng theo thứ tự. Bỏ qua migration đã chạy; không chạy chúng trên database vừa tạo từ `schema.sql`:
```bash
mysql -u thongvan -p thongvan < database/migrations/001_product_catalog.sql
mysql -u thongvan -p thongvan < database/migrations/002_checkout_orders.sql
mysql -u thongvan -p thongvan < database/migrations/003_order_history_and_counter.sql
mysql -u thongvan -p thongvan < database/migrations/004_counter_cash_payment.sql
mysql -u thongvan -p thongvan < database/migrations/005_sprint3_dispatch.sql
mysql -u thongvan -p thongvan < database/migrations/006_route_routing_matrix.sql
mysql -u thongvan -p thongvan < database/migrations/007_users_roles.sql
mysql -u thongvan -p thongvan < database/migrations/008_auth_sessions.sql
mysql -u thongvan -p thongvan < database/migrations/009_sprint4_delivery.sql
mysql -u thongvan -p thongvan < database/migrations/010_sprint5_notifications.sql
mysql -u thongvan -p thongvan < database/migrations/011_notification_timestamps.sql
mysql -u thongvan -p thongvan < database/migrations/012_sprint6_audit.sql
mysql -u thongvan -p thongvan < database/migrations/013_audit_details.sql
mysql -u thongvan -p thongvan < database/migrations/014_sprint6_report_index.sql
mysql -u thongvan -p thongvan < database/migrations/015_warranty_maintenance.sql
mysql -u thongvan -p thongvan < database/migrations/016_product_categories_cost.sql
```
Để dùng khoảng cách đường bộ, tạo tài khoản và API key tại [OpenRouteService Dashboard](https://account.heigit.org/), sau đó đặt `ORS_API_KEY` trong `backend/.env` và khởi động lại backend. Key chỉ được dùng ở backend. Matrix API dùng `https://api.heigit.org/openrouteservice/v2/matrix/driving-car`; các yêu cầu được chia thành tối đa 3.500 cặp nguồn–đích mỗi lần. API có quota theo tài khoản; số lượng lớn điểm có thể cần nhiều request. Ma trận ORS hợp lệ được cache trong bộ nhớ 5 phút. ORS không cung cấp giao thông trực tiếp, nên thời gian và ETA không phản ánh traffic hiện tại. Khi thiếu key, hết quota (429), lỗi mạng, timeout hoặc dữ liệu không hợp lệ, toàn bộ ma trận chuyển sang Haversine × hệ số đường bộ và giao diện ghi rõ là ước tính. Sửa tuyến dùng lại ma trận đã lưu; nếu tọa độ thay đổi, cần tối ưu lại. Tuyến cũ chưa có ma trận được tính lại bằng ước tính khi sửa.

Bản đồ chọn vị trí dùng ảnh vệ tinh MapTiler. Đặt `MAPTILER_API_KEY` trong `backend/.env`; khóa chỉ được backend dùng để proxy tile qua `/api/location/tiles`. `GEOAPIFY_API_KEY` vẫn dùng riêng cho tìm kiếm và tra cứu địa chỉ.

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

Danh mục và chi tiết sản phẩm lấy từ API/MySQL; checkout tạo đơn trong MySQL; trang đơn quản trị tải đơn và gửi thao tác xác nhận, thanh toán, huỷ, cập nhật vị trí, yêu cầu bổ sung và nhập đơn tại quầy qua API. `/track` tra cứu qua API bằng mã đơn và số điện thoại. Quản lý xe/tài xế và điều phối cũng dùng API/MySQL. Đăng nhập bằng tài khoản có quyền để truy cập API nhân viên. Màn tài xế chỉ xem được tuyến được phân công; danh sách đơn và thông báo của khách, dashboard, báo cáo, khách hàng và nhật ký dùng API/MySQL. Trang cài đặt chỉ hiển thị cấu hình backend; chỉnh biến môi trường cần khởi động lại backend.

### Kiểm tra backend
```bash
cd backend && npm run build
npm test -- --runInBand
```

Khi MySQL và backend đang chạy, đặt `AUTH_TEST_TOKEN` là phiên của tài khoản quản trị rồi dùng `npm run test:integration` và `npm run test:dispatch`. `npm run test:auth` kiểm tra đăng nhập và CRUD trên backend ở cổng 18081 (hoặc đặt `AUTH_TEST_BASE`). Các script tạo dữ liệu thử rồi dọn dữ liệu của chính mình; chỉ chạy trên database phát triển.

## 2. Kịch bản kiểm thử Sprint 1–3 trên UI

1. Chạy MySQL, backend và frontend. Đăng nhập tài khoản quản lý ở `/login`, rồi mở `/admin/dispatch`. Nếu ngày hiện tại không có đơn, chọn ngày có đơn trong MySQL hoặc tạo đơn mới qua checkout.
2. Ở `/admin/products`, tạo/sửa sản phẩm và tải ảnh lên Cloudinary. Kiểm tra sản phẩm ở `/products`; khi API lỗi, trang báo lỗi thay vì hiển thị sản phẩm mẫu như dữ liệu thật.
3. Đặt đơn ở `/checkout`; vào `/admin/orders` để xác nhận, cập nhật vị trí nếu cần và chuyển sang `READY`. Đơn `READY` thiếu tọa độ vẫn xuất hiện ở hàng đợi với cảnh báo.
4. Ở `/admin/fleet`, xem/thêm/sửa xe, tài xế và sức chứa. Vào `/admin/dispatch`, chọn ngày và xe, đánh dấu đơn gấp nếu cần, rồi bấm **Tối ưu tuyến nháp**. Xem đơn chưa xếp được cùng lý do.
5. Đổi thứ tự điểm, xe hoặc tài xế trên tuyến nháp; mở chi tiết tuyến để xem thứ tự đã lưu. Chọn tài xế và bấm **Duyệt và chốt**. Chạy tối ưu lại: tuyến đã chốt giữ nguyên.

### Kiểm tra Sprint 4

1. Trong Quản lý xe/tài xế, tạo tài xế. Trong Tài khoản, tạo tài khoản có vai trò DRIVER và chọn **Liên kết tài xế** tương ứng. Đặt xe, tối ưu và chốt tuyến cho tài xế đó.
2. Đăng nhập tài khoản tài xế, mở `/driver`, bắt đầu tuyến, ghi đã đến và xử lý từng điểm theo thứ tự. Với đơn COD, cần xác nhận đã thu đủ tiền trước khi giao thành công. Có thể chụp/tải ảnh bằng chứng trước khi hoàn tất; ảnh được lưu ở Cloudinary dạng authenticated và chỉ cấp liên kết xem có hạn cho tài xế được phân công.
3. Với đơn giao thất bại, ghi lý do. Trong Điều phối, chọn ngày mới sau ngày giao cũ rồi bấm **Hẹn lại**; đơn về hàng đợi READY của ngày mới để tối ưu tiếp, còn lịch sử điểm cũ được giữ nguyên.
4. Để kiểm thử trên database phát triển, chạy backend ở cổng 18082 rồi `cd backend && npm run test:delivery`. Nếu muốn kiểm tra tải và xóa ảnh thật, chạy `DELIVERY_TEST_CLOUDINARY=1 npm run test:delivery`. Script tạo và tự dọn dữ liệu thử; tránh chạy đồng thời với những người đang làm việc trên ngày giao thử.

### Kiểm tra Sprint 5

1. Khách đăng nhập, vào **Đơn hàng** để xem đơn gắn với hồ sơ khách của mình. `/track` cho phép tra cứu bằng mã đơn và số điện thoại người đặt; giao diện gửi số điện thoại trong nội dung POST và tự cập nhật mỗi 30 giây. API GET cũ được giữ cho tương thích.
2. Đơn đã xếp tuyến hiển thị số điểm phía trước và ETA. ETA là khoảng dự kiến theo kế hoạch, cộng độ trễ quan sát ở điểm trước; chưa dùng GPS hoặc giao thông trực tiếp. Đơn thất bại hiện lý do và lịch sử, sau khi hẹn lại sẽ theo lần giao mới.
3. Khi đơn giao thành công có ảnh, khách có thể yêu cầu liên kết xem ảnh hết hạn sau 5 phút. API xác thực mã đơn + SĐT hoặc phiên tài khoản đúng chủ đơn trước khi cấp liên kết.
4. Khách có thể đồng ý hoặc tắt thông báo trên website ở `/account/notifications`. Khi đồng ý, các sự kiện đơn phát sinh sau thời điểm đó được hiển thị, có số chưa đọc và thao tác đánh dấu đã đọc. Không gửi SMS, email hoặc push. Danh sách hiển thị tối đa 100 thông báo gần nhất.
5. Chạy backend ở cổng 18083 rồi `cd backend && npm run test:tracking` để kiểm thử trên database phát triển. `TRACKING_TEST_CLOUDINARY=1 npm run test:tracking` kiểm tra thêm ảnh thật và tự dọn ảnh thử.

### Kiểm tra Sprint 6

- `/admin` và `/admin/reports` lấy số liệu từ MySQL. Đơn và giá trị đơn đã giao nhóm theo **ngày giao hiện tại**; kết quả từng lần giao và đúng giờ nhóm theo **ngày hoàn tất**; tuyến và km kế hoạch nhóm theo **ngày tuyến**. Giá trị đơn đã giao là tổng giá trị đơn, không phải doanh thu đã đối soát. Km là kế hoạch, không phải GPS; chênh lệch km chỉ tính tuyến có baseline.
- `/admin/audit` hiển thị các thay đổi qua API đã xác thực với người thực hiện, đường dẫn và một số trường trạng thái/quyền được chọn; không ghi token, mật khẩu hoặc toàn bộ request. Nhật ký được ghi sau khi nghiệp vụ thành công và có thể thiếu nếu ghi log lỗi hoặc tiến trình dừng giữa hai bước; chưa phải audit bất biến hoặc giao dịch nguyên tử.
- `/admin/customers` trả tối đa 500 khách theo ID giảm dần. `/admin/settings` chỉ đọc cấu hình thực tế, không lưu thay đổi giả trong trình duyệt.
- Chạy backend ở cổng 18084 rồi `cd backend && npm run test:admin` trên database phát triển để kiểm tra KPI, quyền và audit. Script tự tạo và dọn dữ liệu thử.

### Bảo hành và bảo dưỡng

- Trong `/admin/products`, đặt số tháng bảo hành và, nếu cần, chu kỳ bảo dưỡng từ 1 đến 120 tháng. Các giá trị được chụp tại thời điểm đặt hàng; thay đổi sản phẩm sau đó không sửa điều khoản của đơn đã tạo. Các dòng đơn cũ không có bản chụp được hiển thị là chưa rõ thông tin, không tự suy đoán từ sản phẩm hiện tại.
- Sau khi giao thành công, khách xem thông tin tại `/account/warranties` hoặc tra cứu đơn bằng mã đơn và số điện thoại tại `/track`. Bảo hành bắt đầu vào ngày giao thành công và hết hiệu lực từ ngày tương ứng sau số tháng bảo hành; giao diện ghi rõ ngày kết thúc không bao gồm. Có thể đặt `WARRANTY_CONTACT` trong `backend/.env` và khởi động lại backend để hiển thị liên hệ bảo hành; nếu bỏ trống, khách được hướng dẫn liên hệ cửa hàng.
- Lịch bảo dưỡng tính theo ngày giao và chu kỳ đã chụp. Nhắc việc hiển thị trên website khi khách bật thông báo: trước hạn 7 ngày với chu kỳ 1 tháng, 14 ngày với chu kỳ 2–3 tháng, 30 ngày với chu kỳ dài hơn, hoặc khi quá hạn. Không có SMS, email, push hay tác vụ gửi nền. Khách tự ghi nhận đã bảo dưỡng; kỳ tiếp theo là kỳ theo lịch sau ngày ghi nhận. Một dòng đơn áp dụng chung cho toàn bộ số lượng trên dòng, chưa theo dõi từng số sê-ri và không xác nhận việc bảo dưỡng của trung tâm.
- Để kiểm thử trên database phát triển, chạy backend ở cổng 18085 rồi `cd backend && npm run test:warranty`; có thể đặt `WARRANTY_TEST_BASE` nếu dùng địa chỉ khác. Script tạo và tự dọn dữ liệu thử. Cấu hình múi giờ backend và MySQL nhất quán để ngày giao được diễn giải đúng.

### Sao lưu database

Cần `mysqldump` và `gzip`. Trong thư mục gốc dự án, với DB_* trong `backend/.env`:

```bash
(cd backend; set -a; source .env; set +a; bash scripts/backup-db.sh)
```

Script tạo file nén quyền riêng tư trong `backups/` (đã được Git bỏ qua), dùng consistent snapshot cho bảng InnoDB; không hỗ trợ `DATABASE_URL` mà cần các biến `DB_*`. Bản sao chứa dữ liệu khách, cần lưu và chuyển an toàn. Hãy kiểm tra khôi phục trên **database thử riêng** theo quy trình quản trị của bạn trước khi dựa vào bản sao; chưa có lịch sao lưu tự động. Kiểm thử hiện tại chỉ xác nhận dump tạo được và file gzip hợp lệ, chưa khôi phục toàn bộ database.

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
- **Ràng buộc cứng**: sức chứa xe (m³ và kg), khung giờ khách, thời gian dỡ/lắp, ca tối đa 8 giờ.
- **Thời gian phục vụ mỗi điểm** = 10 phút dỡ hàng + thời gian lắp đặt từng sản phẩm (đặc thù điện máy).
- **Khoảng cách**: OpenRouteService Matrix cho km và phút; khi không khả dụng dùng Haversine × hệ số đường bộ và tốc độ trung bình (`backend/src/optimization/distance.ts`). Sơ đồ SVG hiện nối thẳng các điểm và không có bản đồ nền hay geometry đường bộ.
- **Bộ giải**: heuristic TypeScript (chèn tham lam + 2-opt), luôn chạy được và không cần runtime ngoài Node.js.
- **ETA** (`backend/src/optimization/eta.ts`): giờ đến dự kiến mở rộng thành khung giờ. Hàm `predictDelayMinutes` là chỗ cắm **mô hình AI dự đoán trễ** ở giai đoạn sau, khi đã có dữ liệu `planned_arrival` vs `actual_arrival`.

> "Thuật toán tối ưu lo tuyến đường, AI lo dự đoán thời gian."

## 5. Ngoài phạm vi MVP (Future Development)
GPS real-time, thông báo SMS/Zalo, cổng thanh toán online, geocoding tự động, mô hình ML cho ETA, dự báo nhu cầu.

## 6. Agent hỗ trợ (agency-agents)
Xem `CLAUDE.md` để biết agent nào dùng cho việc gì.

### Ảnh sản phẩm và mã xác nhận email

Với cơ sở dữ liệu đã có, chạy `database/migrations/018_product_images_otp.sql` một lần trước khi cập nhật ứng dụng. Migration giữ ảnh hiện tại làm ảnh đầu tiên; cơ sở dữ liệu mới dùng `database/schema.sql`. Trang quản trị cho phép chọn tối đa 20 ảnh, mỗi ảnh tối đa 5 MB; ảnh đầu tiên là ảnh đại diện.

Cấu hình `GMAIL_USER` và `GMAIL_APP_PASSWORD` trong môi trường backend (mật khẩu ứng dụng Gmail), rồi khởi động lại backend. Đăng ký yêu cầu email và mã xác nhận; người dùng có thể đặt lại mật khẩu bằng email đã đăng ký. Mã gồm 6 số, có hiệu lực 3 phút kể từ lần gửi đầu tiên; gửi lại trong thời gian này dùng cùng mã và không gia hạn. Mã được xóa khi xác nhận thành công; bản ghi hết hạn được dọn định kỳ khi backend đang chạy và khi có yêu cầu mã mới. Tài khoản không có email cần liên hệ quản trị viên để cập nhật trước khi dùng tính năng quên mật khẩu. Chức năng giới hạn yêu cầu hiện tại chạy theo từng tiến trình; khi triển khai nhiều máy chủ cần bổ sung giới hạn dùng chung.
