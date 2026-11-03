-- Migration 019: Thêm bảng customer_address để quản lý sổ địa chỉ giao hàng của khách
CREATE TABLE IF NOT EXISTS customer_address (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  customer_id    INT           NOT NULL,
  label          VARCHAR(60)   NOT NULL DEFAULT 'Nhà riêng',
  recipient_name VARCHAR(120)  NULL,
  phone          VARCHAR(20)   NULL,
  address        VARCHAR(255)  NOT NULL,
  district       VARCHAR(100)  NULL,
  lat            DECIMAL(10,7) NULL,
  lng            DECIMAL(10,7) NULL,
  is_default     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_address_customer FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE,
  INDEX idx_customer_address_customer (customer_id),
  INDEX idx_customer_address_default (customer_id, is_default)
);
