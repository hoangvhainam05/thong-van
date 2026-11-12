ALTER TABLE route
  ADD COLUMN shift ENUM('MORNING','AFTERNOON') NOT NULL DEFAULT 'MORNING' AFTER route_date;

UPDATE route r
SET shift = 'AFTERNOON'
WHERE EXISTS (
  SELECT 1
  FROM delivery_stop s
  JOIN orders o ON o.id = s.order_id
  WHERE s.route_id = r.id AND o.time_window_start >= '12:00:00'
)
AND NOT EXISTS (
  SELECT 1
  FROM delivery_stop s
  JOIN orders o ON o.id = s.order_id
  WHERE s.route_id = r.id AND o.time_window_end <= '12:00:00'
);

ALTER TABLE route
  DROP INDEX uq_route_date_vehicle,
  DROP INDEX uq_route_date_driver,
  ADD UNIQUE KEY uq_route_date_shift_vehicle (route_date, shift, vehicle_id),
  ADD UNIQUE KEY uq_route_date_shift_driver (route_date, shift, driver_id);
