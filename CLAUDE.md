# CLAUDE.md — Thông Vân Delivery Optimization

Hướng dẫn cho Claude Code khi làm việc trong repo này.

## Bối cảnh
Dự án môn Quản trị dự án TMĐT: hệ thống đặt hàng điện máy + tối ưu tuyến giao hàng
cho cửa hàng Thông Vân. Điểm khác biệt: khách thấy "còn N điểm giao trước bạn" và
khung giờ ETA. Hàng cồng kềnh, nhiều sản phẩm cần lắp đặt → thời gian phục vụ mỗi điểm
và thể tích xe là ràng buộc quan trọng.

## Stack
- Backend: Node.js 20+, NestJS, TypeORM, MySQL — `backend/`
- Frontend: Next.js 15 App Router, JavaScript, CSS thuần — `frontend/`
- DB: MySQL 8 — `database/schema.sql` là nguồn chuẩn; các entity TypeORM trong `backend/src/database/entities/` phải khớp với nó.

## Lệnh
- DB: `docker compose up -d`
- API: `cd backend && npm run start:dev` (docs: /docs)
- Web: `cd frontend && npm run dev`
- Test/build: `cd backend && npm run build`

## Quy ước
- Giao diện và thông báo lỗi bằng tiếng Việt; tên biến/hàm bằng tiếng Anh.
- `orders.status` là nguồn trạng thái duy nhất. Không thêm cột trạng thái trùng lặp.
- Chỉ tuyến `DRAFT` được tối ưu lại. Không bao giờ đổi `sequence` của tuyến đã `LOCKED`.
- API theo dõi đơn không được trả thông tin của đơn khác (chỉ trả số lượng).
- Thay đổi schema: sửa `schema.sql` + entity TypeORM tương ứng + ghi chú trong README.

## Frontend hiện tại (UI-first, dữ liệu mẫu)
- Toàn bộ dữ liệu và thao tác nằm trong `frontend/lib/store.js` (React context, lưu localStorage).
  Mỗi action gọi `need("<quyền>")` trước khi đổi dữ liệu và ghi `audit`. Khi nối NestJS, thay thân action bằng lời gọi API, giữ nguyên chữ ký.
- Phân quyền: `frontend/lib/rbac.js`. Trang bọc `<RequirePerm perm="...">`, nút bọc `<Can perm="...">`. Luôn kiểm tra quyền, không kiểm tra tên vai trò.
  Quyền mới: thêm vào `PERMISSION_GROUPS` + `DEFAULT_MATRIX`, backend phải có quyền cùng tên.
- Dữ liệu mẫu: `frontend/lib/mock/seed.js` (tất định, ngày tương đối theo hôm nay). Thuật toán tối ưu JS: `frontend/lib/optimizer.js`, giữ đồng bộ với `backend/src/optimization/solver.ts`.
- Giao diện: token màu trong `app/globals.css` (xanh biển chỉ dẫn + vàng tín hiệu). Màu vàng chỉ dùng cho "vị trí của bạn / điểm đang tới".
- Giữ phạm vi MVP (xem README mục 5); tính năng mới ngoài MVP cần hỏi trước.

## Agent (từ msitarzewski/agency-agents, MIT) — `.claude/agents/`
| Việc | Agent |
|---|---|
| Kiến trúc tổng thể, quyết định kỹ thuật | Software Architect |
| API NestJS, nghiệp vụ backend | Backend Architect |
| Trang Next.js | Frontend Developer |
| Bố cục, trải nghiệm khách/tài xế | UX Architect, UI Designer |
| Schema, index, truy vấn MySQL | Database Optimizer |
| Tối ưu tuyến, ETA, mô hình dự đoán trễ | AI Engineer, Spatial Data Scientist |
| Bản đồ, Map API, geocoding | Web GIS Developer |
| Làm nhanh bản thử | Rapid Prototyper |
| Review code | Code Reviewer |
| Kiểm thử API, kiểm tra "đã thật sự xong chưa" | API Tester, Reality Checker |
| WBS, timeline, rủi ro, phạm vi | Senior Project Manager, Product Manager |

Gọi trong Claude Code, ví dụ: *"Dùng Backend Architect để thêm đăng nhập JWT cho admin."*
