// npm run db:verify -> checks the live database against what the application expects.
const { pool } = require('../config/db'); const cfg = require('../config/env');
const TABLES = ['users', 'categories', 'products', 'inventory', 'carts', 'cart_items', 'addresses', 'orders', 'order_items', 'payments', 'reviews', 'newsletter_subscribers'];
const FKS = ['products.category_id>categories', 'inventory.product_id>products', 'carts.user_id>users', 'cart_items.cart_id>carts', 'cart_items.product_id>products', 'addresses.user_id>users',
  'orders.user_id>users', 'order_items.order_id>orders', 'order_items.product_id>products', 'payments.order_id>orders', 'reviews.product_id>products', 'reviews.user_id>users'];
let bad = 0; const line = (ok, msg) => { if (!ok) bad++; console.log((ok ? '  ok    ' : '  FAIL  ') + msg); };
(async () => {
  const db = cfg.db.database; const [[v]] = await pool.query('SELECT VERSION() AS v'); console.log(`Verifying "${db}" on ${v.v}\n`);
  const [t] = await pool.query('SELECT table_name AS n, engine AS e, table_collation AS c FROM information_schema.tables WHERE table_schema = ?', [db]);
  for (const name of TABLES) { const r = t.find(x => x.n === name); line(!!r && r.e === 'InnoDB' && /^utf8mb4/.test(r.c), `table ${name} exists (InnoDB, utf8mb4)`); }
  const [fk] = await pool.query('SELECT table_name AS t, column_name AS c, referenced_table_name AS r FROM information_schema.key_column_usage WHERE table_schema = ? AND referenced_table_name IS NOT NULL', [db]);
  const have = new Set(fk.map(x => `${x.t}.${x.c}>${x.r}`)); for (const f of FKS) line(have.has(f), 'foreign key ' + f);
  const [uq] = await pool.query("SELECT table_name AS t, index_name AS i FROM information_schema.statistics WHERE table_schema = ? AND non_unique = 0 AND index_name <> 'PRIMARY'", [db]);
  for (const u of ['users.uq_users_email', 'users.uq_users_phone', 'orders.uq_orders_number', 'products.uq_products_name', 'carts.uq_carts_user', 'cart_items.uq_cart_product', 'payments.uq_payments_order', 'newsletter_subscribers.uq_newsletter_email'])
    line(uq.some(x => `${x.t}.${x.i}` === u), 'unique constraint ' + u);
  const one = async (sql) => (await pool.query(sql))[0][0].n;
  line(await one('SELECT COUNT(*) n FROM categories') >= 6, 'at least 6 categories'); line(await one('SELECT COUNT(*) n FROM products') >= 12, 'at least 12 products');
  line(await one('SELECT COUNT(*) n FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE i.product_id IS NULL') === 0, 'every product has an inventory row');
  line(await one("SELECT COUNT(*) n FROM products WHERE image_url = ''") === 0, 'every product has an image path');
  line(await one('SELECT COUNT(DISTINCT image_url) n FROM products WHERE id <= 12') === 12, 'the 12 starter products have 12 different images');
  line(await one("SELECT COUNT(*) n FROM users WHERE password_hash NOT LIKE '$2%'") === 0, 'all stored passwords are bcrypt hashes');
  line(await one("SELECT COUNT(*) n FROM users WHERE role = 'admin'") >= 1, 'an admin account exists (run: npm run seed:admin)');
  line(await one('SELECT COUNT(*) n FROM orders o LEFT JOIN payments p ON p.order_id = o.id WHERE p.id IS NULL') === 0, 'every order has a payment record');
  line(await one('SELECT COUNT(*) n FROM orders o WHERE ABS(o.total - (o.subtotal + o.delivery_charge - o.discount)) > 0.001') === 0, 'every order total = subtotal + delivery - discount');
  line(await one('SELECT COUNT(*) n FROM orders o WHERE ABS(o.subtotal - (SELECT COALESCE(SUM(line_total),0) FROM order_items i WHERE i.order_id = o.id)) > 0.001') === 0, 'every order subtotal matches its items');
  console.log(bad ? `\n${bad} check(s) failed.` : '\nDatabase looks good.'); await pool.end(); process.exit(bad ? 1 : 0);
})().catch(async e => { console.error('Could not verify:', e.message); try { await pool.end(); } catch (x) { /* ignore */ } process.exit(1); });
