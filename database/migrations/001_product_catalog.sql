-- Apply once to an existing MySQL database before deploying the product API.
ALTER TABLE product
  ADD COLUMN sku VARCHAR(40) NULL,
  ADD COLUMN brand VARCHAR(100) NULL,
  ADD COLUMN old_price DECIMAL(12,0) NULL,
  ADD COLUMN warranty_months INT NOT NULL DEFAULT 12,
  ADD COLUMN stock INT NOT NULL DEFAULT 10,
  ADD COLUMN description TEXT NULL,
  MODIFY COLUMN image_url VARCHAR(1000) NULL;

UPDATE product
SET sku = CONCAT('TV-', LPAD(id, 5, '0')),
    brand = COALESCE(brand, 'Chưa cập nhật'),
    category = CASE category
      WHEN 'Máy giặt' THEN 'may-giat'
      WHEN 'Tủ lạnh' THEN 'tu-lanh'
      WHEN 'Điều hoà' THEN 'dieu-hoa'
      WHEN 'Tivi' THEN 'tivi'
      WHEN 'Máy sấy' THEN 'may-say'
      WHEN 'Máy lọc nước' THEN 'loc-nuoc'
      WHEN 'Bình nóng lạnh' THEN 'nong-lanh'
      WHEN 'Gia dụng' THEN 'gia-dung'
      ELSE category
    END
WHERE sku IS NULL;

CREATE UNIQUE INDEX uq_product_sku ON product (sku);
