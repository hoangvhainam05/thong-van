-- =============================================================
--  Thông Vân — Intelligent Order & Delivery Optimization System
--  MySQL 8.x schema
-- =============================================================
CREATE DATABASE IF NOT EXISTS thongvan
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE thongvan;

-- Kho / chi nhánh xuất hàng (điểm xuất phát của tuyến)
CREATE TABLE warehouse (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120)  NOT NULL,
  address     VARCHAR(255)  NOT NULL,
  lat         DECIMAL(10,7) NOT NULL,
  lng         DECIMAL(10,7) NOT NULL
);

CREATE TABLE customer (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(20)  NOT NULL UNIQUE,
  email       VARCHAR(120) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_category (
  id VARCHAR(60) NOT NULL PRIMARY KEY,
  name VARCHAR(60) NOT NULL
);
INSERT INTO product_category (id, name) VALUES
('may-giat', 'Máy giặt'), ('tu-lanh', 'Tủ lạnh'), ('dieu-hoa', 'Điều hoà'),
('tivi', 'Tivi'), ('may-say', 'Máy sấy'), ('loc-nuoc', 'Máy lọc nước'),
('nong-lanh', 'Bình nóng lạnh'), ('gia-dung', 'Gia dụng');

-- Hàng điện máy: cần thể tích (sức chứa xe) và thời gian lắp đặt (ETA)
CREATE TABLE product (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  sku             VARCHAR(40)    NULL UNIQUE,
  name            VARCHAR(160)  NOT NULL,
  brand           VARCHAR(100)  NULL,
  category        VARCHAR(60)   NOT NULL,
  price           DECIMAL(12,0) NOT NULL,
  cost_price      DECIMAL(12,0) NULL,
  old_price       DECIMAL(12,0) NULL,
  volume_m3       DECIMAL(6,3)  NOT NULL DEFAULT 0.1,
  weight_kg       DECIMAL(7,2)  NOT NULL DEFAULT 1,
  install_minutes INT           NOT NULL DEFAULT 10,
  image_url       VARCHAR(1000) NULL,
  image_public_id VARCHAR(255) NULL,
  warranty_months INT           NOT NULL DEFAULT 12,
  maintenance_interval_months INT NULL,
  stock           INT           NOT NULL DEFAULT 10,
  description     TEXT          NULL,
  active          TINYINT(1)    NOT NULL DEFAULT 1,
  CONSTRAINT fk_product_category FOREIGN KEY (category) REFERENCES product_category(id)
);

CREATE TABLE driver (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  name    VARCHAR(120) NOT NULL,
  phone   VARCHAR(20)  NOT NULL,
  active  TINYINT(1)   NOT NULL DEFAULT 1
);

-- Tài khoản và phân quyền RBAC. Mật khẩu chỉ lưu dưới dạng hash.
CREATE TABLE role (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL
);

CREATE TABLE permission (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL
);

CREATE TABLE role_permission (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permission_role FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permission_permission FOREIGN KEY (permission_id) REFERENCES permission(id) ON DELETE CASCADE
);

CREATE TABLE `user` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  customer_id INT NULL UNIQUE,
  driver_id INT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NULL UNIQUE,
  phone VARCHAR(20) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  notifications_enabled_at DATETIME(6) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES role(id),
  CONSTRAINT fk_user_customer FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE SET NULL,
  CONSTRAINT fk_user_driver FOREIGN KEY (driver_id) REFERENCES driver(id) ON DELETE SET NULL
);


-- Ma trận quyền mặc định tương ứng frontend/lib/rbac.js; không tạo tài khoản/mật khẩu mẫu.
INSERT INTO role (code, name) VALUES
('ADMIN', 'Quản trị viên'),
('MANAGER', 'Quản lý điều phối'),
('SALES', 'Nhân viên bán hàng'),
('DRIVER', 'Nhân viên giao hàng'),
('CUSTOMER', 'Khách hàng');

INSERT INTO permission (code, name) VALUES
('order.place', 'Đặt hàng và thanh toán'),
('order.track_own', 'Xem và theo dõi đơn của mình'),
('notification.own', 'Nhận thông báo đơn hàng'),
('backoffice.access', 'Vào trang quản trị'),
('dashboard.view', 'Xem tổng quan'),
('order.view_all', 'Xem tất cả đơn hàng'),
('order.confirm', 'Xác nhận và chuẩn bị đơn'),
('order.edit_location', 'Sửa vị trí giao hàng'),
('order.cancel', 'Huỷ đơn'),
('customer.view', 'Xem khách hàng'),
('product.manage', 'Thêm, sửa, ẩn sản phẩm'),
('dispatch.view', 'Xem lịch giao và tuyến'),
('route.optimize', 'Chạy tối ưu tuyến'),
('route.approve', 'Duyệt và chốt tuyến'),
('route.dispatch', 'Xuất kho, đổi tài xế'),
('fleet.manage', 'Quản lý tài xế và xe'),
('delivery.app', 'Dùng ứng dụng giao hàng'),
('delivery.update', 'Cập nhật kết quả giao'),
('report.view', 'Xem báo cáo'),
('user.manage', 'Quản lý tài khoản nhân viên'),
('role.manage', 'Chỉnh phân quyền'),
('settings.manage', 'Cài đặt hệ thống và tham số tối ưu'),
('audit.view', 'Xem nhật ký thao tác');

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p ON
  (r.code = 'ADMIN' AND p.code IN ('backoffice.access', 'dashboard.view', 'order.view_all', 'order.confirm', 'order.edit_location', 'order.cancel', 'customer.view', 'product.manage', 'dispatch.view', 'route.optimize', 'route.approve', 'route.dispatch', 'fleet.manage', 'report.view', 'user.manage', 'role.manage', 'settings.manage', 'audit.view'))
  OR (r.code = 'MANAGER' AND p.code IN ('backoffice.access', 'dashboard.view', 'order.view_all', 'order.confirm', 'order.edit_location', 'order.cancel', 'customer.view', 'dispatch.view', 'route.optimize', 'route.approve', 'route.dispatch', 'fleet.manage', 'report.view'))
  OR (r.code = 'SALES' AND p.code IN ('backoffice.access', 'dashboard.view', 'order.view_all', 'order.confirm', 'order.edit_location', 'customer.view', 'product.manage', 'dispatch.view'))
  OR (r.code = 'DRIVER' AND p.code IN ('delivery.app', 'delivery.update'))
  OR (r.code = 'CUSTOMER' AND p.code IN ('order.place', 'order.track_own', 'notification.own'));

CREATE TABLE vehicle (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  plate        VARCHAR(20)  NOT NULL UNIQUE,
  capacity_m3  DECIMAL(6,2) NOT NULL,
  capacity_kg  DECIMAL(8,2) NOT NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1
);

-- Một nguồn trạng thái duy nhất cho đơn hàng (orders.status)
CREATE TABLE orders (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  code               VARCHAR(20)   NULL UNIQUE,          -- TV000123, sinh sau khi insert
  customer_id        INT           NOT NULL,
  recipient_name     VARCHAR(120)  NULL,
  recipient_phone    VARCHAR(20)   NULL,
  is_gift            TINYINT(1)    NOT NULL DEFAULT 0,
  is_urgent          TINYINT(1)    NOT NULL DEFAULT 0,
  address            VARCHAR(255)  NOT NULL,
  lat                DECIMAL(10,7) NULL,                 -- NULL = chưa định vị được (rủi ro R1)
  lng                DECIMAL(10,7) NULL,
  delivery_date      DATE          NOT NULL,
  time_window_start  TIME          NOT NULL DEFAULT '08:00:00',
  time_window_end    TIME          NOT NULL DEFAULT '17:00:00',
  total              DECIMAL(14,0) NOT NULL DEFAULT 0,
  subtotal           DECIMAL(14,0) NOT NULL DEFAULT 0,
  shipping_fee       DECIMAL(12,0) NOT NULL DEFAULT 0,
  client_request_id  VARCHAR(64)   NULL UNIQUE,
  payment_method     ENUM('COD','BANK_TRANSFER','COUNTER_CASH') NOT NULL DEFAULT 'COD',
  payment_status     ENUM('UNPAID','PENDING','PAID') NOT NULL DEFAULT 'UNPAID',
  source             ENUM('WEB','COUNTER') NOT NULL DEFAULT 'WEB',
  status             ENUM('PENDING','CONFIRMED','READY','SCHEDULED',
                          'OUT_FOR_DELIVERY','DELIVERED','FAILED','CANCELLED')
                     NOT NULL DEFAULT 'PENDING',
  note               VARCHAR(255)  NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customer(id),
  INDEX idx_orders_date_status (delivery_date, status)
);

CREATE TABLE order_item (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  unit_price  DECIMAL(12,0) NOT NULL,
  warranty_months_snapshot INT NULL,
  maintenance_interval_months_snapshot INT NULL,
  CONSTRAINT fk_item_order   FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES product(id)
);

CREATE TABLE order_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL,
  event_type  ENUM('STATUS','PAYMENT','INFO_REQUEST','LOCATION','PRIORITY') NOT NULL,
  from_value  VARCHAR(30) NULL,
  to_value    VARCHAR(30) NULL,
  note        VARCHAR(255) NULL,
  actor       VARCHAR(40) NOT NULL DEFAULT 'SYSTEM',
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_order_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_history_order_date (order_id, created_at)
);

-- Tuyến giao hàng. DRAFT = còn được tối ưu lại; LOCKED = đã chốt, thứ tự không đổi nữa
CREATE TABLE route (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  route_date        DATE NOT NULL,
  warehouse_id      INT  NOT NULL,
  driver_id         INT  NULL,
  vehicle_id        INT  NOT NULL,
  status            ENUM('DRAFT','LOCKED','IN_PROGRESS','DONE') NOT NULL DEFAULT 'DRAFT',
  total_km          DECIMAL(8,2) NOT NULL DEFAULT 0,
  total_minutes     INT          NOT NULL DEFAULT 0,
  baseline_km       DECIMAL(8,2) NULL,     -- quãng đường nếu giao theo thứ tự đặt hàng (để đo KPI)
  routing_matrix    JSON NULL,              -- ma trận và nguồn dùng để tính lại tuyến nháp
  solver            VARCHAR(30)  NOT NULL DEFAULT 'heuristic',
  locked_at         DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_route_wh      FOREIGN KEY (warehouse_id) REFERENCES warehouse(id),
  CONSTRAINT fk_route_driver  FOREIGN KEY (driver_id)    REFERENCES driver(id),
  CONSTRAINT fk_route_vehicle FOREIGN KEY (vehicle_id)   REFERENCES vehicle(id),
  INDEX idx_route_date (route_date),
  UNIQUE KEY uq_route_date_vehicle (route_date, vehicle_id),
  UNIQUE KEY uq_route_date_driver (route_date, driver_id)
);

-- Điểm dừng: sequence là cơ sở của tính năng "còn N đơn trước bạn"
CREATE TABLE delivery_stop (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  route_id        INT NOT NULL,
  order_id        INT NOT NULL,
  sequence        INT NOT NULL,
  eta_start       DATETIME NOT NULL,
  eta_end         DATETIME NOT NULL,
  planned_arrival DATETIME NOT NULL,
  actual_arrival  DATETIME NULL,
  completed_at    DATETIME NULL,
  result          ENUM('DELIVERED','FAILED') NULL,
  result_note     VARCHAR(255) NULL,
  cod_collected   DECIMAL(14,0) NOT NULL DEFAULT 0,
  proof_public_id VARCHAR(255) NULL,
  proof_format    VARCHAR(10) NULL,
  proof_uploaded_by INT NULL,
  proof_uploaded_at DATETIME NULL,
  active_order_id INT GENERATED ALWAYS AS (IF(completed_at IS NULL, order_id, NULL)) STORED,
  UNIQUE KEY uq_stop_active_order (active_order_id),
  UNIQUE KEY uq_stop_route_order (route_id, order_id),
  INDEX idx_stop_order (order_id),
  INDEX idx_stop_completed_result (completed_at, result),
  CONSTRAINT fk_stop_proof_user FOREIGN KEY (proof_uploaded_by) REFERENCES `user`(id) ON DELETE SET NULL,
  CONSTRAINT fk_stop_route FOREIGN KEY (route_id) REFERENCES route(id) ON DELETE CASCADE,
  CONSTRAINT fk_stop_order FOREIGN KEY (order_id) REFERENCES orders(id),
  UNIQUE KEY uq_route_seq (route_id, sequence)
);
CREATE TABLE user_session (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_user (user_id),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE CASCADE
);

CREATE TABLE user_notification_read (
  user_id INT NOT NULL,
  history_id INT NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, history_id),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_history FOREIGN KEY (history_id) REFERENCES order_history(id) ON DELETE CASCADE
);
CREATE TABLE audit_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  actor_name VARCHAR(120) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(255) NOT NULL,
  details JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_audit_created (created_at,id),
  INDEX idx_audit_user (user_id,created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE SET NULL
);

CREATE TABLE maintenance_record (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT NOT NULL,
  cycle_no INT NOT NULL,
  due_date DATE NOT NULL,
  completed_date DATE NOT NULL,
  recorded_by INT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_maintenance_cycle (order_item_id, cycle_no),
  CONSTRAINT fk_maintenance_item FOREIGN KEY (order_item_id) REFERENCES order_item(id) ON DELETE CASCADE,
  CONSTRAINT fk_maintenance_user FOREIGN KEY (recorded_by) REFERENCES `user`(id) ON DELETE SET NULL
);
CREATE TABLE maintenance_reminder_read (
  user_id INT NOT NULL,
  order_item_id INT NOT NULL,
  cycle_no INT NOT NULL,
  read_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, order_item_id, cycle_no),
  CONSTRAINT fk_maintenance_read_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE CASCADE,
  CONSTRAINT fk_maintenance_read_item FOREIGN KEY (order_item_id) REFERENCES order_item(id) ON DELETE CASCADE
);
