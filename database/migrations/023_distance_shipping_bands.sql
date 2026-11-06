ALTER TABLE system_setting
  ADD COLUMN shipping_free_distance_km DECIMAL(7,2) NOT NULL DEFAULT 20.00,
  ADD COLUMN shipping_first_band_end_km DECIMAL(7,2) NOT NULL DEFAULT 30.00,
  ADD COLUMN shipping_first_band_fee INT NOT NULL DEFAULT 150000,
  ADD COLUMN shipping_distance_step_km DECIMAL(7,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN shipping_distance_step_fee INT NOT NULL DEFAULT 50000;

UPDATE system_setting
SET shipping_rate_version = shipping_rate_version + 1
WHERE id = 1;

INSERT INTO shipping_rate_history (version, snapshot)
SELECT shipping_rate_version,
       JSON_OBJECT(
         'change', 'Shipping fees now use actual road-distance bands',
         'shipping', JSON_OBJECT(
           'free_distance_km', shipping_free_distance_km,
           'first_band_end_km', shipping_first_band_end_km,
           'first_band_fee', shipping_first_band_fee,
           'distance_step_km', shipping_distance_step_km,
           'distance_step_fee', shipping_distance_step_fee
         )
       )
FROM system_setting
WHERE id = 1;
