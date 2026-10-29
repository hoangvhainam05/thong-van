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
