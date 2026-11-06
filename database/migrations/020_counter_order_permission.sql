-- Tách quyền tạo đơn tại quầy khỏi quyền xác nhận và chuẩn bị đơn.
INSERT IGNORE INTO permission (code, name)
VALUES ('order.create_counter', 'Tạo đơn tại quầy');

INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.code = 'order.create_counter'
WHERE r.code IN ('ADMIN', 'MANAGER', 'SALES');
