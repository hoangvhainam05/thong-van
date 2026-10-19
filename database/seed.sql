-- Dữ liệu MẪU để chạy thử. Toạ độ chỉ là ví dụ:
-- hãy thay bằng địa chỉ/toạ độ thật của kho Thông Vân và khách hàng.
USE thongvan;

INSERT INTO warehouse (name, address, lat, lng) VALUES
('Kho Thông Vân (mẫu)', 'Địa chỉ kho — cập nhật sau', 21.0285000, 105.8542000);

INSERT INTO product (name, category, price, volume_m3, weight_kg, install_minutes) VALUES
('Máy giặt cửa trước 9kg',        'Máy giặt',  8990000, 0.45, 70, 20),
('Máy giặt cửa trên 10kg',        'Máy giặt',  6490000, 0.40, 40, 15),
('Tủ lạnh 2 cánh 320L',            'Tủ lạnh',   9490000, 0.85, 65, 10),
('Tủ lạnh side-by-side 600L',     'Tủ lạnh',  21990000, 1.40, 110, 15),
('Điều hoà 1 chiều 9000BTU',       'Điều hoà',  7990000, 0.30, 35, 75),
('Điều hoà 2 chiều 12000BTU',      'Điều hoà', 12490000, 0.35, 40, 90),
('Tivi 55 inch',                   'Tivi',     11990000, 0.25, 18, 20),
('Nồi cơm điện 1.8L',              'Gia dụng',   990000, 0.03, 3, 0),
('Quạt đứng',                      'Gia dụng',   690000, 0.08, 6, 5),
('Bình nóng lạnh 30L',             'Gia dụng',  3290000, 0.12, 15, 45);

INSERT INTO driver (name, phone) VALUES
('Nguyễn Văn An', '0900000001'),
('Trần Văn Bình', '0900000002');

INSERT INTO vehicle (plate, capacity_m3, capacity_kg) VALUES
('XE-01 (tải nhỏ)', 3.50, 800),
('XE-02 (tải nhỏ)', 3.50, 800);

INSERT INTO customer (name, phone) VALUES
('Khách A', '0911000001'), ('Khách B', '0911000002'), ('Khách C', '0911000003'),
('Khách D', '0911000004'), ('Khách E', '0911000005'), ('Khách F', '0911000006'),
('Khách G', '0911000007'), ('Khách H', '0911000008'), ('Khách I', '0911000009'),
('Khách K', '0911000010');

-- 10 đơn giao trong ngày hôm nay, đã sẵn sàng giao (READY)
INSERT INTO orders (customer_id, address, lat, lng, delivery_date, time_window_start, time_window_end, total, status) VALUES
(1,  'Địa chỉ mẫu 1',  21.0450, 105.8000, CURDATE(), '08:00', '12:00',  8990000, 'READY'),
(2,  'Địa chỉ mẫu 2',  21.0120, 105.8700, CURDATE(), '08:00', '17:00',  9490000, 'READY'),
(3,  'Địa chỉ mẫu 3',  21.0600, 105.8300, CURDATE(), '13:00', '17:00',  7990000, 'READY'),
(4,  'Địa chỉ mẫu 4',  20.9900, 105.8100, CURDATE(), '08:00', '17:00', 11990000, 'READY'),
(5,  'Địa chỉ mẫu 5',  21.0350, 105.9000, CURDATE(), '08:00', '12:00',  6490000, 'READY'),
(6,  'Địa chỉ mẫu 6',  20.9700, 105.8600, CURDATE(), '08:00', '17:00', 21990000, 'READY'),
(7,  'Địa chỉ mẫu 7',  21.0800, 105.8700, CURDATE(), '08:00', '17:00', 12490000, 'READY'),
(8,  'Địa chỉ mẫu 8',  21.0200, 105.7800, CURDATE(), '14:00', '17:00',  3290000, 'READY'),
(9,  'Địa chỉ mẫu 9',  21.0500, 105.8550, CURDATE(), '08:00', '17:00',   690000, 'CONFIRMED'),
(10, 'Địa chỉ mẫu 10', 21.0000, 105.8400, CURDATE(), '08:00', '17:00',   990000, 'PENDING');

UPDATE orders SET code = CONCAT('TV', LPAD(id, 6, '0')) WHERE code IS NULL;

INSERT INTO order_item (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 1,  8990000), (2, 3, 1,  9490000), (3, 5, 1,  7990000),
(4, 7, 1, 11990000), (5, 2, 1,  6490000), (6, 4, 1, 21990000),
(7, 6, 1, 12490000), (8, 10, 1, 3290000), (9, 9, 1,   690000),
(10, 8, 1,  990000);
