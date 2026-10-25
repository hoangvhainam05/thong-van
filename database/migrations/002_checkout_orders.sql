-- Apply once to an existing MySQL database before deploying checkout changes.
ALTER TABLE orders
  ADD COLUMN recipient_name VARCHAR(120) NULL,
  ADD COLUMN recipient_phone VARCHAR(20) NULL,
  ADD COLUMN is_gift TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN subtotal DECIMAL(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN shipping_fee DECIMAL(12,0) NOT NULL DEFAULT 0,
  ADD COLUMN client_request_id VARCHAR(64) NULL,
  ADD COLUMN payment_status ENUM('UNPAID','PENDING','PAID') NOT NULL DEFAULT 'UNPAID',
  ADD UNIQUE INDEX uq_orders_client_request (client_request_id);

UPDATE orders o
JOIN customer c ON c.id = o.customer_id
SET o.recipient_name = c.name,
    o.recipient_phone = c.phone,
    o.subtotal = COALESCE((
      SELECT SUM(oi.quantity * oi.unit_price)
      FROM order_item oi WHERE oi.order_id = o.id
    ), o.total),
    o.shipping_fee = GREATEST(o.total - COALESCE((
      SELECT SUM(oi.quantity * oi.unit_price)
      FROM order_item oi WHERE oi.order_id = o.id
    ), o.total), 0),
    o.payment_status = CASE
      WHEN o.payment_method = 'BANK_TRANSFER' THEN 'PENDING'
      ELSE 'UNPAID'
    END;
