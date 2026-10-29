-- Độ chính xác microsecond giúp phân biệt sự kiện trước/sau lúc bật thông báo.
ALTER TABLE `user` MODIFY COLUMN notifications_enabled_at DATETIME(6) NULL;
ALTER TABLE order_history MODIFY COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
