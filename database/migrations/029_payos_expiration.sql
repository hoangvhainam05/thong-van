ALTER TABLE orders ADD COLUMN payos_expires_at DATETIME NULL;

UPDATE orders
SET payos_expires_at = DATE_ADD(updated_at, INTERVAL 15 MINUTE)
WHERE payos_checkout_url IS NOT NULL
  AND payos_expires_at IS NULL;
