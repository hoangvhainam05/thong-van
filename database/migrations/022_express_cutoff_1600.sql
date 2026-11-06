-- Set express acceptance cutoff to 16:00 and record the rate/config version change.
SET @shipping_cutoff_changed := (
  SELECT express_cutoff_time <> '16:00'
  FROM system_setting
  WHERE id = 1
);

UPDATE system_setting
SET express_cutoff_time = '16:00',
    shipping_rate_version = shipping_rate_version + IF(@shipping_cutoff_changed, 1, 0)
WHERE id = 1;

INSERT INTO shipping_rate_history (version, snapshot)
SELECT shipping_rate_version,
       JSON_OBJECT(
         'change', 'Express cutoff updated to 16:00',
         'shipping', JSON_OBJECT(
           'base_distance_km', shipping_base_distance_km,
           'base_fee', shipping_base_fee,
           'per_km_fee', shipping_per_km_fee,
           'express_fee', shipping_express_fee,
           'rounding_increment', shipping_rounding_increment,
           'volume_tiers', shipping_volume_tiers,
           'weight_fee_per_kg', shipping_weight_fee_per_kg
         ),
         'express', JSON_OBJECT(
           'cutoff_time', express_cutoff_time,
           'max_minutes', express_max_minutes,
           'max_distance_km', express_max_distance_km,
           'max_volume_m3', express_max_volume_m3,
           'max_weight_kg', express_max_weight_kg
         )
       )
FROM system_setting
WHERE id = 1 AND @shipping_cutoff_changed;
