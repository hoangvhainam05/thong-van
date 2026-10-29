-- Mỗi đơn có thể có nhiều lần giao; chỉ được có một điểm chưa hoàn tất.
ALTER TABLE delivery_stop DROP FOREIGN KEY fk_stop_order;
ALTER TABLE delivery_stop DROP INDEX order_id;
ALTER TABLE delivery_stop
  ADD COLUMN result ENUM('DELIVERED','FAILED') NULL AFTER completed_at,
  ADD COLUMN result_note VARCHAR(255) NULL AFTER result,
  ADD COLUMN cod_collected DECIMAL(14,0) NOT NULL DEFAULT 0 AFTER result_note,
  ADD COLUMN proof_public_id VARCHAR(255) NULL AFTER cod_collected,
  ADD COLUMN proof_format VARCHAR(10) NULL AFTER proof_public_id,
  ADD COLUMN proof_uploaded_by INT NULL AFTER proof_format,
  ADD COLUMN proof_uploaded_at DATETIME NULL AFTER proof_uploaded_by,
  ADD COLUMN active_order_id INT GENERATED ALWAYS AS (IF(completed_at IS NULL, order_id, NULL)) STORED,
  ADD UNIQUE KEY uq_stop_active_order (active_order_id),
  ADD UNIQUE KEY uq_stop_route_order (route_id, order_id),
  ADD KEY idx_stop_order (order_id),
  ADD CONSTRAINT fk_stop_order FOREIGN KEY (order_id) REFERENCES orders(id),
  ADD CONSTRAINT fk_stop_proof_user FOREIGN KEY (proof_uploaded_by) REFERENCES `user`(id) ON DELETE SET NULL;
UPDATE delivery_stop s JOIN orders o ON o.id=s.order_id
SET s.result=o.status
WHERE s.completed_at IS NOT NULL AND s.result IS NULL AND o.status IN ('FAILED','DELIVERED');
