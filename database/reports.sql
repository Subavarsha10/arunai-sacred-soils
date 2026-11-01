-- Handy read-only queries for MySQL Workbench demos and project evaluation. Run one at a time.
USE arunai_sacred_soils;

-- 1. Catalogue with stock status
SELECT p.id, p.name, c.name AS category, p.price, p.unit, i.quantity AS stock,
       CASE WHEN i.quantity = 0 OR p.is_available = 0 THEN 'Out of Stock' WHEN i.quantity <= i.low_stock_threshold THEN 'Low Stock' ELSE 'In Stock' END AS availability
FROM products p JOIN categories c ON c.id = p.category_id JOIN inventory i ON i.product_id = p.id ORDER BY c.id, p.id;

-- 2. Low-stock alerts
SELECT p.name, i.quantity, i.low_stock_threshold FROM inventory i JOIN products p ON p.id = i.product_id WHERE i.quantity <= i.low_stock_threshold ORDER BY i.quantity;

-- 3. Orders with customer, status and payment
SELECT o.order_number, o.created_at, o.customer_name, o.fulfilment, o.total, o.status, pay.method, pay.status AS payment_status
FROM orders o JOIN payments pay ON pay.order_id = o.id ORDER BY o.id DESC;

-- 4. Items in each order (shows price at time of purchase)
SELECT o.order_number, oi.product_name, oi.quantity, oi.price, oi.line_total FROM order_items oi JOIN orders o ON o.id = oi.order_id ORDER BY o.id DESC, oi.id;

-- 5. Revenue per day (cancelled orders excluded)
SELECT DATE(created_at) AS day, COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE status <> 'Cancelled' GROUP BY DATE(created_at) ORDER BY day DESC;

-- 6. Best-selling products
SELECT oi.product_name, SUM(oi.quantity) AS units_sold, SUM(oi.line_total) AS revenue
FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status <> 'Cancelled' GROUP BY oi.product_name ORDER BY units_sold DESC;

-- 7. Customers and what they have spent
SELECT u.id, u.name, u.email, COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.status <> 'Cancelled' THEN o.total END), 0) AS spent
FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE u.role = 'customer' GROUP BY u.id, u.name, u.email ORDER BY spent DESC;

-- 8. Orders by status
SELECT status, COUNT(*) AS orders FROM orders GROUP BY status ORDER BY FIELD(status, 'Pending','Confirmed','Preparing','Out for Delivery','Delivered','Cancelled');

-- 9. Integrity check: should return zero rows
SELECT o.order_number FROM orders o WHERE ABS(o.total - (o.subtotal + o.delivery_charge - o.discount)) > 0.001;
