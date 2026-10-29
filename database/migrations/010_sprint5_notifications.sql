-- Đồng ý nhận thông báo chỉ áp dụng cho thông báo trên website.
ALTER TABLE `user` ADD COLUMN notifications_enabled_at DATETIME NULL AFTER active;
CREATE TABLE user_notification_read (
  user_id INT NOT NULL,
  history_id INT NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, history_id),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_history FOREIGN KEY (history_id) REFERENCES order_history(id) ON DELETE CASCADE
);
