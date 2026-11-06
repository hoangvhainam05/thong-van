-- Shipping price snapshots and package measurements. Existing orders remain unchanged.
ALTER TABLE product
  ADD COLUMN package_length_cm DECIMAL(8,2) NULL,
  ADD COLUMN package_width_cm DECIMAL(8,2) NULL,
  ADD COLUMN package_height_cm DECIMAL(8,2) NULL,
  ADD COLUMN package_weight_kg DECIMAL(8,3) NULL;

ALTER TABLE orders
  ADD COLUMN warehouse_id INT NULL,
  ADD COLUMN delivery_distance_km DECIMAL(9,3) NULL,
  ADD COLUMN delivery_type ENUM('STANDARD','EXPRESS') NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN length_cm DECIMAL(8,2) NULL,
  ADD COLUMN width_cm DECIMAL(8,2) NULL,
  ADD COLUMN height_cm DECIMAL(8,2) NULL,
  ADD COLUMN volume_m3 DECIMAL(9,4) NULL,
  ADD COLUMN weight_kg DECIMAL(9,3) NULL,
  ADD COLUMN package_count INT NULL,
  ADD COLUMN package_details JSON NULL,
  ADD COLUMN preparation_minutes INT NULL,
  ADD COLUMN travel_minutes INT NULL,
  ADD COLUMN estimated_delivery_minutes INT NULL,
  ADD COLUMN estimated_arrival_at DATETIME NULL,
  ADD COLUMN distance_fee INT NULL,
  ADD COLUMN volume_fee INT NULL,
  ADD COLUMN weight_fee INT NULL,
  ADD COLUMN express_fee INT NULL,
  ADD COLUMN shipping_discount INT NULL,
  ADD COLUMN total_shipping_fee DECIMAL(12,0) NULL,
  ADD COLUMN shipping_rate_version INT NULL,
  ADD INDEX idx_orders_warehouse (warehouse_id);

UPDATE orders SET total_shipping_fee = shipping_fee;
ALTER TABLE orders ALTER COLUMN time_window_end SET DEFAULT '18:00:00';

ALTER TABLE system_setting
  ADD COLUMN express_cutoff_time VARCHAR(5) NOT NULL DEFAULT '16:00',
  ADD COLUMN express_max_minutes INT NOT NULL DEFAULT 300,
  ADD COLUMN express_max_distance_km DECIMAL(7,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN express_max_volume_m3 DECIMAL(7,4) NOT NULL DEFAULT 0.1000,
  ADD COLUMN express_max_weight_kg DECIMAL(8,3) NULL,
  ADD COLUMN shipping_base_distance_km DECIMAL(7,2) NOT NULL DEFAULT 2.00,
  ADD COLUMN shipping_base_fee INT NOT NULL DEFAULT 15000,
  ADD COLUMN shipping_per_km_fee INT NOT NULL DEFAULT 5000,
  ADD COLUMN shipping_express_fee INT NOT NULL DEFAULT 10000,
  ADD COLUMN shipping_rounding_increment INT NOT NULL DEFAULT 1000,
  ADD COLUMN shipping_volume_tiers JSON NULL,
  ADD COLUMN shipping_weight_fee_per_kg INT NULL,
  ADD COLUMN shipping_additional_delay_minutes INT NOT NULL DEFAULT 0,
  ADD COLUMN shipping_preparation_minutes INT NOT NULL DEFAULT 10,
  ADD COLUMN shipping_handover_minutes INT NOT NULL DEFAULT 5,
  ADD COLUMN shipping_fallback_speed_kmh DECIMAL(5,2) NOT NULL DEFAULT 25.00,
  ADD COLUMN shipping_rate_version INT NOT NULL DEFAULT 1;

CREATE TABLE shipping_rate_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  version INT NOT NULL,
  snapshot JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_shipping_rate_history_version (version)
);
