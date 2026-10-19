-- =============================================================
--  Thông Vân — Intelligent Order & Delivery Optimization System
--  MySQL 8.x schema
-- =============================================================
CREATE DATABASE IF NOT EXISTS thongvan
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE thongvan;

-- Kho / chi nhánh xuất hàng (điểm xuất phát của tuyến)
CREATE TABLE warehouse (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120)  NOT NULL,
  address     VARCHAR(255)  NOT NULL,
  lat         DECIMAL(10,7) NOT NULL,
  lng         DECIMAL(10,7) NOT NULL
);

CREATE TABLE customer (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(20)  NOT NULL UNIQUE,
  email       VARCHAR(120) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Hàng điện máy: cần thể tích (sức chứa xe) và thời gian lắp đặt (ETA)
CREATE TABLE product (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(160)  NOT NULL,
  category        VARCHAR(60)   NOT NULL,
  price           DECIMAL(12,0) NOT NULL,
  volume_m3       DECIMAL(6,3)  NOT NULL DEFAULT 0.1,
  weight_kg       DECIMAL(7,2)  NOT NULL DEFAULT 1,
  install_minutes INT           NOT NULL DEFAULT 10,
  image_url       VARCHAR(255)  NULL,
  active          TINYINT(1)    NOT NULL DEFAULT 1
);

CREATE TABLE driver (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  name    VARCHAR(120) NOT NULL,
  phone   VARCHAR(20)  NOT NULL,
  active  TINYINT(1)   NOT NULL DEFAULT 1
);

CREATE TABLE vehicle (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  plate        VARCHAR(20)  NOT NULL UNIQUE,
  capacity_m3  DECIMAL(6,2) NOT NULL,
  capacity_kg  DECIMAL(8,2) NOT NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1
);

-- Một nguồn trạng thái duy nhất cho đơn hàng (orders.status)
CREATE TABLE orders (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  code               VARCHAR(20)   NULL UNIQUE,          -- TV000123, sinh sau khi insert
  customer_id        INT           NOT NULL,
  address            VARCHAR(255)  NOT NULL,
  lat                DECIMAL(10,7) NULL,                 -- NULL = chưa định vị được (rủi ro R1)
  lng                DECIMAL(10,7) NULL,
  delivery_date      DATE          NOT NULL,
  time_window_start  TIME          NOT NULL DEFAULT '08:00:00',
  time_window_end    TIME          NOT NULL DEFAULT '17:00:00',
  total              DECIMAL(14,0) NOT NULL DEFAULT 0,
  payment_method     ENUM('COD','BANK_TRANSFER') NOT NULL DEFAULT 'COD',
  status             ENUM('PENDING','CONFIRMED','READY','SCHEDULED',
                          'OUT_FOR_DELIVERY','DELIVERED','FAILED','CANCELLED')
                     NOT NULL DEFAULT 'PENDING',
  note               VARCHAR(255)  NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customer(id),
  INDEX idx_orders_date_status (delivery_date, status)
);

CREATE TABLE order_item (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  unit_price  DECIMAL(12,0) NOT NULL,
  CONSTRAINT fk_item_order   FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES product(id)
);

-- Tuyến giao hàng. DRAFT = còn được tối ưu lại; LOCKED = đã chốt, thứ tự không đổi nữa
CREATE TABLE route (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  route_date        DATE NOT NULL,
  warehouse_id      INT  NOT NULL,
  driver_id         INT  NULL,
  vehicle_id        INT  NOT NULL,
  status            ENUM('DRAFT','LOCKED','IN_PROGRESS','DONE') NOT NULL DEFAULT 'DRAFT',
  total_km          DECIMAL(8,2) NOT NULL DEFAULT 0,
  total_minutes     INT          NOT NULL DEFAULT 0,
  baseline_km       DECIMAL(8,2) NULL,     -- quãng đường nếu giao theo thứ tự đặt hàng (để đo KPI)
  solver            VARCHAR(30)  NOT NULL DEFAULT 'heuristic',
  locked_at         DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_route_wh      FOREIGN KEY (warehouse_id) REFERENCES warehouse(id),
  CONSTRAINT fk_route_driver  FOREIGN KEY (driver_id)    REFERENCES driver(id),
  CONSTRAINT fk_route_vehicle FOREIGN KEY (vehicle_id)   REFERENCES vehicle(id),
  INDEX idx_route_date (route_date)
);

-- Điểm dừng: sequence là cơ sở của tính năng "còn N đơn trước bạn"
CREATE TABLE delivery_stop (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  route_id        INT NOT NULL,
  order_id        INT NOT NULL UNIQUE,
  sequence        INT NOT NULL,
  eta_start       DATETIME NOT NULL,
  eta_end         DATETIME NOT NULL,
  planned_arrival DATETIME NOT NULL,
  actual_arrival  DATETIME NULL,
  completed_at    DATETIME NULL,
  CONSTRAINT fk_stop_route FOREIGN KEY (route_id) REFERENCES route(id) ON DELETE CASCADE,
  CONSTRAINT fk_stop_order FOREIGN KEY (order_id) REFERENCES orders(id),
  UNIQUE KEY uq_route_seq (route_id, sequence)
);
