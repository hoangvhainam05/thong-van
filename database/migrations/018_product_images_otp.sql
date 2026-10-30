ALTER TABLE product ADD COLUMN images JSON NULL;
UPDATE product SET images = JSON_ARRAY(JSON_OBJECT('imageUrl', image_url, 'imagePublicId', image_public_id)) WHERE image_url IS NOT NULL;

CREATE TABLE auth_otp (
  email VARCHAR(120) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  code CHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  PRIMARY KEY (email, purpose),
  INDEX idx_auth_otp_expiry (expires_at)
);
