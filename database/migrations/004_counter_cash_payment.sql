-- Sprint 2: distinguish cash collected at the counter from cash-on-delivery.
ALTER TABLE orders
  MODIFY COLUMN payment_method ENUM('COD','BANK_TRANSFER','COUNTER_CASH') NOT NULL DEFAULT 'COD';
