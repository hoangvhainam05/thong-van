-- Sprint 2: identify source orders and persist status/payment/info-request audit events.
ALTER TABLE orders
  ADD COLUMN source ENUM('WEB','COUNTER') NOT NULL DEFAULT 'WEB';

CREATE TABLE order_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL,
  event_type  ENUM('STATUS','PAYMENT','INFO_REQUEST','LOCATION') NOT NULL,
  from_value  VARCHAR(30) NULL,
  to_value    VARCHAR(30) NULL,
  note        VARCHAR(255) NULL,
  actor       VARCHAR(40) NOT NULL DEFAULT 'SYSTEM',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_history_order_date (order_id, created_at)
);

INSERT INTO order_history (order_id, event_type, from_value, to_value, note, actor, created_at)
SELECT id, 'STATUS', NULL, status, 'Trạng thái hiện tại trước Sprint 2', 'SYSTEM', created_at
FROM orders;
