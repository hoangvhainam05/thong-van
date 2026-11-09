ALTER TABLE orders ADD COLUMN payos_account_name VARCHAR(255) NULL;

CREATE TABLE payment_support_request (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  customer_id INT NOT NULL,
  message VARCHAR(1000) NOT NULL,
  image_data MEDIUMBLOB NULL,
  image_mime VARCHAR(30) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_payment_support_order (order_id),
  CONSTRAINT fk_payment_support_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_payment_support_customer FOREIGN KEY (customer_id) REFERENCES customer(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
