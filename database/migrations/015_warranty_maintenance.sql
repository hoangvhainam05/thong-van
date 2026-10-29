-- Đơn cũ không có snapshot: để NULL, không tự suy đoán thời hạn lúc mua.
ALTER TABLE product ADD COLUMN maintenance_interval_months INT NULL AFTER warranty_months;
ALTER TABLE order_item ADD COLUMN warranty_months_snapshot INT NULL AFTER unit_price,
  ADD COLUMN maintenance_interval_months_snapshot INT NULL AFTER warranty_months_snapshot;
CREATE TABLE maintenance_record (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT NOT NULL,
  cycle_no INT NOT NULL,
  due_date DATE NOT NULL,
  completed_date DATE NOT NULL,
  recorded_by INT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_maintenance_cycle (order_item_id, cycle_no),
  CONSTRAINT fk_maintenance_item FOREIGN KEY (order_item_id) REFERENCES order_item(id) ON DELETE CASCADE,
  CONSTRAINT fk_maintenance_user FOREIGN KEY (recorded_by) REFERENCES `user`(id) ON DELETE SET NULL
);
CREATE TABLE maintenance_reminder_read (
  user_id INT NOT NULL,
  order_item_id INT NOT NULL,
  cycle_no INT NOT NULL,
  read_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, order_item_id, cycle_no),
  CONSTRAINT fk_maintenance_read_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE CASCADE,
  CONSTRAINT fk_maintenance_read_item FOREIGN KEY (order_item_id) REFERENCES order_item(id) ON DELETE CASCADE
);
