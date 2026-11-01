-- ============================================================================
-- Arunai Sacred Soils - MySQL schema + starter data
-- Safe to run more than once: it only creates what is missing and never drops data.
-- Run in MySQL Workbench (open this file, press the lightning bolt) or with: npm run db:setup
-- Tested on MariaDB 10.11; written for MySQL 8.0+.
-- ============================================================================
CREATE DATABASE IF NOT EXISTS arunai_sacred_soils CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE arunai_sacred_soils;

-- To start completely fresh, uncomment the next line and run it first (DELETES ALL DATA):
-- DROP DATABASE arunai_sacred_soils;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  phone         VARCHAR(15)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,                       -- bcrypt hash, never plaintext
  role          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(80)  NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  image_url   VARCHAR(255) NOT NULL DEFAULT '',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id  INT UNSIGNED NOT NULL,
  name         VARCHAR(120) NOT NULL,
  description  TEXT NULL,
  price        DECIMAL(10,2) NOT NULL,
  unit         VARCHAR(40)  NOT NULL DEFAULT 'per kg',
  image_url    VARCHAR(255) NOT NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  is_featured  TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_name (name),
  KEY idx_products_category (category_id),
  KEY idx_products_featured (is_featured),
  KEY idx_products_price (price),
  CONSTRAINT chk_products_price CHECK (price > 0),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- One inventory row per product (stock lives here, not in products)
CREATE TABLE IF NOT EXISTS inventory (
  product_id          INT UNSIGNED NOT NULL,
  quantity            INT UNSIGNED NOT NULL DEFAULT 0,
  low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 10,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS carts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_carts_user (user_id),
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cart_items (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_id    INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity   INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_product (cart_id, product_id),
  KEY idx_cart_items_product (product_id),
  CONSTRAINT chk_cart_qty CHECK (quantity > 0),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts (id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS addresses (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  label      VARCHAR(40)  NOT NULL DEFAULT 'Home',
  line1      VARCHAR(255) NOT NULL,
  city       VARCHAR(80)  NOT NULL,
  state      VARCHAR(80)  NOT NULL,
  pin_code   CHAR(6)      NOT NULL,
  is_default TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number    VARCHAR(30)  NOT NULL,
  user_id         INT UNSIGNED NOT NULL,
  customer_name   VARCHAR(100) NOT NULL,
  phone           VARCHAR(15)  NOT NULL,
  email           VARCHAR(190) NOT NULL,
  fulfilment      ENUM('HOME_DELIVERY','STORE_PICKUP') NOT NULL,
  ship_line1      VARCHAR(255) NULL,
  ship_city       VARCHAR(80)  NULL,
  ship_state      VARCHAR(80)  NULL,
  ship_pin        CHAR(6)      NULL,
  subtotal        DECIMAL(10,2) NOT NULL,
  delivery_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount        DECIMAL(10,2) NOT NULL DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL,
  status          ENUM('Pending','Confirmed','Preparing','Out for Delivery','Delivered','Cancelled') NOT NULL DEFAULT 'Pending',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (order_number),
  KEY idx_orders_user (user_id),
  KEY idx_orders_status (status),
  KEY idx_orders_created (created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Name/price/image are copied at purchase time so history survives product edits or deletion
CREATE TABLE IF NOT EXISTS order_items (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id     INT UNSIGNED NOT NULL,
  product_id   INT UNSIGNED NULL,
  product_name VARCHAR(120) NOT NULL,
  unit         VARCHAR(40)  NOT NULL,
  image_url    VARCHAR(255) NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  quantity     INT UNSIGNED NOT NULL,
  line_total   DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_product (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Demo payments only: no card or UPI details are ever stored
CREATE TABLE IF NOT EXISTS payments (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id   INT UNSIGNED NOT NULL,
  method     ENUM('COD','DEMO_UPI','DEMO_CARD') NOT NULL,
  status     ENUM('PENDING','PAID_DEMO','PAID_COD') NOT NULL DEFAULT 'PENDING',
  amount     DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  rating     TINYINT UNSIGNED NOT NULL,
  comment    VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_product_user (product_id, user_id),
  KEY idx_reviews_user (user_id),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  subscribed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_newsletter_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Convenience views for reports in MySQL Workbench (the backend does not depend on them)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_product_stock AS
SELECT p.id AS product_id, p.name, c.name AS category, p.price, p.unit, i.quantity, i.low_stock_threshold,
       CASE WHEN i.quantity = 0 OR p.is_available = 0 THEN 'Out of Stock'
            WHEN i.quantity <= i.low_stock_threshold THEN 'Low Stock' ELSE 'In Stock' END AS availability
FROM products p JOIN categories c ON c.id = p.category_id JOIN inventory i ON i.product_id = p.id;

CREATE OR REPLACE VIEW v_order_summary AS
SELECT o.id, o.order_number, u.email AS customer_email, o.customer_name, o.fulfilment, o.status,
       pay.method AS payment_method, pay.status AS payment_status,
       o.subtotal, o.delivery_charge, o.discount, o.total,
       (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count, o.created_at
FROM orders o JOIN users u ON u.id = o.user_id JOIN payments pay ON pay.order_id = o.id;

-- ---------------------------------------------------------------------------
-- Starter data (no customers or admins are inserted; create the admin with: npm run seed:admin)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO categories (id, name, description, image_url) VALUES
 (1,'Fresh Vegetables','Farm-picked vegetables, harvested at peak freshness.','assets/images/categories/vegetables.svg'),
 (2,'Coconut Products','Tender and mature coconuts from local groves.','assets/images/categories/coconut.svg'),
 (3,'Farm Eggs','Free-range eggs gathered fresh every morning.','assets/images/categories/eggs.svg'),
 (4,'Natural Oils','Cold pressed oils with nothing added.','assets/images/categories/oils.svg'),
 (5,'Natural Honey','Raw, unprocessed honey straight from the hive.','assets/images/categories/honey.svg'),
 (6,'Grains & Millets','Traditional rice, millets and whole grains.','assets/images/categories/grains.svg');

INSERT IGNORE INTO products (id, category_id, name, description, price, unit, image_url, is_available, is_featured) VALUES
 (1,1,'Fresh Tomatoes','Juicy, sun-ripened tomatoes picked the same morning. Perfect for curries, chutneys and salads.',40,'per kg','assets/images/products/tomatoes.svg',1,1),
 (2,1,'Fresh Carrots','Crisp, sweet carrots grown in rich red soil. Enjoy them raw, in sambar or as a halwa.',50,'per kg','assets/images/products/carrots.svg',1,0),
 (3,2,'Fresh Coconut','Heavy, water-rich coconuts from nearby groves. Ideal for cooking, chutneys and temple offerings.',35,'per piece','assets/images/products/coconut.svg',1,1),
 (4,3,'Farm Fresh Eggs','Eggs from free-range hens fed on natural grain, with deep golden yolks.',96,'per dozen','assets/images/products/eggs.svg',1,1),
 (5,4,'Cold Pressed Coconut Oil','Slow-pressed from sun-dried copra at low temperature. Aromatic and unrefined.',420,'per litre','assets/images/products/coconut-oil.svg',1,1),
 (6,4,'Cold Pressed Groundnut Oil','Traditional wooden-press style groundnut oil with a rich nutty aroma. Great for frying and tempering.',380,'per litre','assets/images/products/groundnut-oil.svg',1,0),
 (7,5,'Natural Honey','Raw, unheated forest honey. Nothing added, nothing removed.',450,'per 500 g','assets/images/products/honey.svg',1,1),
 (8,6,'Organic Ragi','Whole finger millet grown without chemicals. Rich in calcium. Use for ragi mudde, dosa or porridge.',85,'per kg','assets/images/products/ragi.svg',1,1),
 (9,6,'Traditional Rice','Unpolished traditional rice with full flavour and a pleasant bite.',72,'per kg','assets/images/products/rice.svg',1,0),
 (10,6,'Pearl Millet','Cleaned pearl millet (kambu / bajra). Good for rotis, koozh and porridge.',68,'per kg','assets/images/products/pearl-millet.svg',1,0),
 (11,6,'Foxtail Millet','Golden foxtail millet (thinai), a light grain that cooks like rice.',95,'per kg','assets/images/products/foxtail-millet.svg',1,0),
 (12,6,'Little Millet','Fine little millet (samai), easy to digest and great for upma and pongal.',105,'per kg','assets/images/products/little-millet.svg',1,0);

INSERT IGNORE INTO inventory (product_id, quantity, low_stock_threshold) VALUES
 (1,120,10),(2,90,10),(3,150,10),(4,60,10),(5,45,10),(6,50,10),
 (7,6,10),(8,80,10),(9,200,10),(10,70,10),(11,55,10),(12,0,10);
