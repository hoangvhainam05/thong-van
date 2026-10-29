ALTER TABLE delivery_stop ADD INDEX idx_stop_completed_result (completed_at, result);
