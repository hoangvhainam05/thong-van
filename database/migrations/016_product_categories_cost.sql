-- Apply once to an existing database after migration 015.
CREATE TABLE product_category (
  id VARCHAR(60) NOT NULL PRIMARY KEY,
  name VARCHAR(60) NOT NULL
);
INSERT INTO product_category (id, name) VALUES
('may-giat', 'Máy giặt'), ('tu-lanh', 'Tủ lạnh'), ('dieu-hoa', 'Điều hoà'),
('tivi', 'Tivi'), ('may-say', 'Máy sấy'), ('loc-nuoc', 'Máy lọc nước'),
('nong-lanh', 'Bình nóng lạnh'), ('gia-dung', 'Gia dụng');
-- Preserve any custom category codes already used by products.
INSERT INTO product_category (id, name)
SELECT DISTINCT p.category, p.category FROM product p
WHERE NOT EXISTS (SELECT 1 FROM product_category c WHERE c.id = p.category);
ALTER TABLE product ADD COLUMN cost_price DECIMAL(12,0) NULL AFTER price;
ALTER TABLE product ADD CONSTRAINT fk_product_category FOREIGN KEY (category) REFERENCES product_category(id);
