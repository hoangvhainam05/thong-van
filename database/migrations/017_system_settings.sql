-- Cấu hình hệ thống động trong database (có thể chỉnh sửa qua giao diện Quản lý / Admin)
CREATE TABLE IF NOT EXISTS system_setting (
  id INT PRIMARY KEY DEFAULT 1,
  shipping_fee INT NOT NULL DEFAULT 150000,
  free_ship_from INT NOT NULL DEFAULT 5000000,
  delivery_day_start VARCHAR(10) NOT NULL DEFAULT '08:00',
  delivery_day_end VARCHAR(10) NOT NULL DEFAULT '18:00',
  avg_speed_kmh DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  road_factor DECIMAL(4,2) NOT NULL DEFAULT 1.35,
  weight_km DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  weight_time DECIMAL(4,2) NOT NULL DEFAULT 0.50,
  bank_name VARCHAR(120) NULL,
  bank_account_name VARCHAR(120) NULL,
  bank_account_number VARCHAR(60) NULL,
  bank_transfer_prefix VARCHAR(60) NOT NULL DEFAULT 'THONGVAN',
  warranty_contact VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO system_setting (id, shipping_fee, free_ship_from, delivery_day_start, delivery_day_end, avg_speed_kmh, road_factor, weight_km, weight_time, bank_name, bank_account_name, bank_account_number, bank_transfer_prefix, warranty_contact)
VALUES (1, 150000, 5000000, '08:00', '18:00', 30.00, 1.35, 1.00, 0.50, 'MB Bank', 'CUA HANG THONG VAN', '9999999999', 'THONGVAN', '0988 000 001 - CSKH Thông Vân')
ON DUPLICATE KEY UPDATE id=id;

-- Cấp quyền settings.manage cho vai trò MANAGER (Quản lý điều phối)
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r, permission p
WHERE r.code = 'MANAGER' AND p.code = 'settings.manage';
