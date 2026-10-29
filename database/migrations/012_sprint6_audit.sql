CREATE TABLE audit_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  actor_name VARCHAR(120) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_audit_created (created_at,id),
  INDEX idx_audit_user (user_id,created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE SET NULL
);
