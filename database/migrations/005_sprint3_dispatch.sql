-- Chạy một lần trên database đã áp dụng migrations 001–004.
ALTER TABLE product ADD COLUMN image_public_id VARCHAR(255) NULL AFTER image_url;
ALTER TABLE orders ADD COLUMN is_urgent TINYINT(1) NOT NULL DEFAULT 0 AFTER is_gift;
ALTER TABLE order_history MODIFY COLUMN event_type ENUM('STATUS','PAYMENT','INFO_REQUEST','LOCATION','PRIORITY') NOT NULL;
ALTER TABLE route ADD UNIQUE KEY uq_route_date_vehicle (route_date, vehicle_id);
ALTER TABLE route ADD UNIQUE KEY uq_route_date_driver (route_date, driver_id);
