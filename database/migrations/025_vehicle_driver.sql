-- Phân công tài xế cho xe: mỗi xe tối đa 2 tài xế, tài xế mới chưa gán xe.
CREATE TABLE IF NOT EXISTS vehicle_driver (
  vehicle_id INT NOT NULL,
  driver_id  INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vehicle_id, driver_id),
  UNIQUE KEY uq_vehicle_driver_driver (driver_id),
  CONSTRAINT fk_vd_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle(id) ON DELETE CASCADE,
  CONSTRAINT fk_vd_driver  FOREIGN KEY (driver_id)  REFERENCES driver(id)  ON DELETE CASCADE
);
