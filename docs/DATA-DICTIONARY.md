# Data dictionary: arunai_sacred_soils

Generated from the live database by `npm run db:docs`.

## addresses

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| user_id | int unsigned | NO | MUL |  |  |
| label | varchar(40) | NO |  | Home |  |
| line1 | varchar(255) | NO |  |  |  |
| city | varchar(80) | NO |  |  |  |
| state | varchar(80) | NO |  |  |  |
| pin_code | char(6) | NO |  |  |  |
| is_default | tinyint(1) | NO |  | 0 |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

Foreign keys: `user_id` -> `users.id` (on delete cascade)

Indexes: `idx_addresses_user` (user_id); `PRIMARY` (id) unique

## cart_items

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| cart_id | int unsigned | NO | MUL |  |  |
| product_id | int unsigned | NO | MUL |  |  |
| quantity | int unsigned | NO |  |  |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

Foreign keys: `cart_id` -> `carts.id` (on delete cascade); `product_id` -> `products.id` (on delete cascade)

Indexes: `idx_cart_items_product` (product_id); `PRIMARY` (id) unique; `uq_cart_product` (cart_id,product_id) unique

## carts

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| user_id | int unsigned | NO | UNI |  |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

Foreign keys: `user_id` -> `users.id` (on delete cascade)

Indexes: `PRIMARY` (id) unique; `uq_carts_user` (user_id) unique

## categories

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| name | varchar(80) | NO | UNI |  |  |
| description | varchar(255) | NO |  |  |  |
| image_url | varchar(255) | NO |  |  |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

Indexes: `PRIMARY` (id) unique; `uq_categories_name` (name) unique

## inventory

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| product_id | int unsigned | NO | PRI |  |  |
| quantity | int unsigned | NO |  | 0 |  |
| low_stock_threshold | int unsigned | NO |  | 10 |  |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

Foreign keys: `product_id` -> `products.id` (on delete cascade)

Indexes: `PRIMARY` (product_id) unique

## newsletter_subscribers

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| email | varchar(190) | NO | UNI |  |  |
| subscribed_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

Indexes: `PRIMARY` (id) unique; `uq_newsletter_email` (email) unique

## order_items

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| order_id | int unsigned | NO | MUL |  |  |
| product_id | int unsigned | YES | MUL |  |  |
| product_name | varchar(120) | NO |  |  |  |
| unit | varchar(40) | NO |  |  |  |
| image_url | varchar(255) | NO |  |  |  |
| price | decimal(10,2) | NO |  |  |  |
| quantity | int unsigned | NO |  |  |  |
| line_total | decimal(10,2) | NO |  |  |  |

Foreign keys: `order_id` -> `orders.id` (on delete cascade); `product_id` -> `products.id` (on delete set null)

Indexes: `idx_order_items_order` (order_id); `idx_order_items_product` (product_id); `PRIMARY` (id) unique

## orders

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| order_number | varchar(30) | NO | UNI |  |  |
| user_id | int unsigned | NO | MUL |  |  |
| customer_name | varchar(100) | NO |  |  |  |
| phone | varchar(15) | NO |  |  |  |
| email | varchar(190) | NO |  |  |  |
| fulfilment | enum('HOME_DELIVERY','STORE_PICKUP') | NO |  |  |  |
| ship_line1 | varchar(255) | YES |  |  |  |
| ship_city | varchar(80) | YES |  |  |  |
| ship_state | varchar(80) | YES |  |  |  |
| ship_pin | char(6) | YES |  |  |  |
| subtotal | decimal(10,2) | NO |  |  |  |
| delivery_charge | decimal(10,2) | NO |  | 0.00 |  |
| discount | decimal(10,2) | NO |  | 0.00 |  |
| total | decimal(10,2) | NO |  |  |  |
| status | enum('Pending','Confirmed','Preparing','Out for Delivery','Delivered','Cancelled') | NO | MUL | Pending |  |
| created_at | timestamp | NO | MUL | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

Foreign keys: `user_id` -> `users.id` (on delete restrict)

Indexes: `idx_orders_created` (created_at); `idx_orders_status` (status); `idx_orders_user` (user_id); `PRIMARY` (id) unique; `uq_orders_number` (order_number) unique

## payments

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| order_id | int unsigned | NO | UNI |  |  |
| method | enum('COD','DEMO_UPI','DEMO_CARD') | NO |  |  |  |
| status | enum('PENDING','PAID_DEMO','PAID_COD') | NO |  | PENDING |  |
| amount | decimal(10,2) | NO |  |  |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

Foreign keys: `order_id` -> `orders.id` (on delete cascade)

Indexes: `PRIMARY` (id) unique; `uq_payments_order` (order_id) unique

## products

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| category_id | int unsigned | NO | MUL |  |  |
| name | varchar(120) | NO | UNI |  |  |
| description | text | YES |  |  |  |
| price | decimal(10,2) | NO | MUL |  |  |
| unit | varchar(40) | NO |  | per kg |  |
| image_url | varchar(255) | NO |  |  |  |
| is_available | tinyint(1) | NO |  | 1 |  |
| is_featured | tinyint(1) | NO | MUL | 0 |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

Foreign keys: `category_id` -> `categories.id` (on delete restrict)

Indexes: `idx_products_category` (category_id); `idx_products_featured` (is_featured); `idx_products_price` (price); `PRIMARY` (id) unique; `uq_products_name` (name) unique

## reviews

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| product_id | int unsigned | NO | MUL |  |  |
| user_id | int unsigned | NO | MUL |  |  |
| rating | tinyint unsigned | NO |  |  |  |
| comment | varchar(1000) | YES |  |  |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

Foreign keys: `product_id` -> `products.id` (on delete cascade); `user_id` -> `users.id` (on delete cascade)

Indexes: `idx_reviews_user` (user_id); `PRIMARY` (id) unique; `uq_reviews_product_user` (product_id,user_id) unique

## users

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | int unsigned | NO | PRI |  | auto_increment |
| name | varchar(100) | NO |  |  |  |
| email | varchar(190) | NO | UNI |  |  |
| phone | varchar(15) | NO | UNI |  |  |
| password_hash | varchar(100) | NO |  |  |  |
| role | enum('customer','admin') | NO | MUL | customer |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

Indexes: `idx_users_role` (role); `PRIMARY` (id) unique; `uq_users_email` (email) unique; `uq_users_phone` (phone) unique

## Views

* `v_order_summary`
* `v_product_stock`
