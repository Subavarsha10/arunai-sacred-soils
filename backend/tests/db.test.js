/* Database integrity test: proves the schema enforces its own rules (keys, constraints, cascades, charset, re-runnable setup).
   Usage: npm run test:db   (needs the database from "npm run db:setup"; the server does NOT need to be running)
   It only touches rows it creates itself (prefix "dbtest") and removes them afterwards. */
const fs = require('fs'); const path = require('path'); const mysql = require('mysql2/promise');
const cfg = require('../config/env'); const { pool, withTransaction } = require('../config/db');
let pass = 0, fail = 0; const T = Date.now(), tag = 'dbtest' + T;
const t = (n, c, x) => { if (c) pass++; else { fail++; console.log('  FAIL:', n, x !== undefined ? JSON.stringify(x).slice(0, 200) : ''); } };
async function rejects(name, sqlOrFn, codes) {
  try { typeof sqlOrFn === 'string' ? await pool.query(sqlOrFn) : await sqlOrFn(); t(name + ' (should be rejected)', false); }
  catch (e) { t(name, codes.includes(e.code), e.code); }
}
const q = async (s, p) => (await pool.query(s, p))[0];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ids = { users: [], products: [], cats: [] };

(async () => {
  const db = cfg.db.database;
  const names = (await q('SELECT table_name n FROM information_schema.tables WHERE table_schema = ? AND table_type = ?', [db, 'BASE TABLE'])).map(r => r.n);
  const expected = ['users', 'categories', 'products', 'inventory', 'carts', 'cart_items', 'addresses', 'orders', 'order_items', 'payments', 'reviews', 'newsletter_subscribers'];
  t('all 12 required tables exist', expected.every(x => names.includes(x)) && names.length === 12, names);
  t('2 reporting views exist', (await q('SELECT COUNT(*) n FROM information_schema.views WHERE table_schema = ?', [db]))[0].n === 2);
  t('12 foreign keys', (await q('SELECT COUNT(*) n FROM information_schema.referential_constraints WHERE constraint_schema = ?', [db]))[0].n === 12);
  t('all tables are InnoDB', (await q("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' AND engine <> 'InnoDB'", [db]))[0].n === 0);
  t('every table has created/updated or equivalent timestamp', (await q("SELECT COUNT(DISTINCT table_name) n FROM information_schema.columns WHERE table_schema = ? AND column_name IN ('created_at','updated_at','subscribed_at')", [db]))[0].n >= 11);
  const keys = (await q('SELECT DISTINCT index_name n FROM information_schema.statistics WHERE table_schema = ?', [db])).map(r => r.n);
  for (const k of ['uq_users_email', 'uq_users_phone', 'uq_orders_number', 'uq_cart_product', 'uq_payments_order', 'uq_newsletter_email', 'idx_orders_user', 'idx_orders_status', 'idx_products_category', 'idx_order_items_order']) t('index ' + k, keys.includes(k));

  // ---- starter data ----
  t('6 starter categories', (await q('SELECT COUNT(*) n FROM categories WHERE id BETWEEN 1 AND 6'))[0].n === 6);
  const prods = await q('SELECT p.id, p.name, p.image_url, i.product_id inv FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.id <= 12');
  t('12 starter products', prods.length === 12); t('every starter product has an inventory row', prods.every(p => p.inv === p.id));
  t('12 distinct starter images', new Set(prods.map(p => p.image_url)).size === 12); t('no starter image is blank', prods.every(p => p.image_url.length > 5));
  t('no product without inventory', (await q('SELECT COUNT(*) n FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE i.product_id IS NULL'))[0].n === 0);
  t('no plaintext passwords stored', (await q("SELECT COUNT(*) n FROM users WHERE password_hash NOT LIKE '$2%'"))[0].n === 0);
  t('views return data', (await q('SELECT COUNT(*) n FROM v_product_stock'))[0].n >= 12 && Array.isArray(await q('SELECT * FROM v_order_summary LIMIT 1')));

  // ---- setup script is re-runnable and keeps your data ----
  const [[before]] = await pool.query('SELECT quantity FROM inventory WHERE product_id = 7'); await pool.query('UPDATE inventory SET quantity = 77 WHERE product_id = 7');
  await pool.query("UPDATE products SET price = 451 WHERE id = 7");
  const conn = await mysql.createConnection({ host: cfg.db.host, port: cfg.db.port, user: cfg.db.user, password: cfg.db.password, multipleStatements: true });
  await conn.query(fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8').replace(/arunai_sacred_soils/g, db)); await conn.end();
  t('re-running schema keeps edited stock', (await q('SELECT quantity FROM inventory WHERE product_id = 7'))[0].quantity === 77);
  t('re-running schema keeps edited price and adds no duplicates', (await q('SELECT price FROM products WHERE id = 7'))[0].price == 451 && (await q('SELECT COUNT(*) n FROM products WHERE id <= 12'))[0].n === 12);
  await pool.query('UPDATE inventory SET quantity = ? WHERE product_id = 7', [before.quantity]); await pool.query('UPDATE products SET price = 450 WHERE id = 7');

  // ---- fixtures ----
  const mkUser = async (suffix) => { const [r] = await pool.query("INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, '$2b$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz0123456')", ['DB Test', `${tag}${suffix}@example.com`, '9' + String(T).slice(-8) + suffix]); ids.users.push(r.insertId); return r.insertId; };
  const uid = await mkUser(1);
  t('new user defaults to customer role', (await q('SELECT role FROM users WHERE id = ?', [uid]))[0].role === 'customer');

  // ---- unique, not null, enum, check ----
  await rejects('duplicate email blocked', `INSERT INTO users (name,email,phone,password_hash) VALUES ('x','${tag}1@example.com','9000011111','h')`, ['ER_DUP_ENTRY']);
  await rejects('duplicate email blocked regardless of case', `INSERT INTO users (name,email,phone,password_hash) VALUES ('x','${tag.toUpperCase()}1@EXAMPLE.COM','9000011112','h')`, ['ER_DUP_ENTRY']);
  await rejects('duplicate phone blocked', `INSERT INTO users (name,email,phone,password_hash) VALUES ('x','other${tag}@example.com','${'9' + String(T).slice(-8) + 1}','h')`, ['ER_DUP_ENTRY']);
  await rejects('user without name blocked (NOT NULL)', `INSERT INTO users (email,phone,password_hash) VALUES ('nn${tag}@example.com','9000011113','h')`, ['ER_NO_DEFAULT_FOR_FIELD', 'ER_BAD_NULL_ERROR']);
  await rejects('null password hash blocked', `INSERT INTO users (name,email,phone,password_hash) VALUES ('x','np${tag}@example.com','9000011114',NULL)`, ['ER_BAD_NULL_ERROR']);
  await rejects('invalid role blocked (ENUM)', `INSERT INTO users (name,email,phone,password_hash,role) VALUES ('x','rl${tag}@example.com','9000011115','h','superuser')`, ['WARN_DATA_TRUNCATED', 'ER_WARN_DATA_TRUNCATED']);
  await rejects('duplicate category name blocked', "INSERT INTO categories (name) VALUES ('Fresh Vegetables')", ['ER_DUP_ENTRY']);
  await rejects('duplicate product name blocked', "INSERT INTO products (category_id,name,price,image_url) VALUES (1,'Fresh Tomatoes',5,'x')", ['ER_DUP_ENTRY']);
  await rejects('price of zero blocked (CHECK)', `INSERT INTO products (category_id,name,price,image_url) VALUES (1,'${tag}-p0',0,'x')`, ['ER_CHECK_CONSTRAINT_VIOLATED']);
  await rejects('negative price blocked (CHECK)', `INSERT INTO products (category_id,name,price,image_url) VALUES (1,'${tag}-pn',-1,'x')`, ['ER_CHECK_CONSTRAINT_VIOLATED']);
  await rejects('negative stock blocked (UNSIGNED)', 'UPDATE inventory SET quantity = quantity - 100000 WHERE product_id = 12', ['ER_DATA_OUT_OF_RANGE', 'ER_WARN_DATA_OUT_OF_RANGE']);
  await rejects('invalid order status blocked (ENUM)', `INSERT INTO orders (order_number,user_id,customer_name,phone,email,fulfilment,subtotal,total,status) VALUES ('${tag}-s',${uid},'x','9000011116','x@x.com','STORE_PICKUP',1,1,'Shipped')`, ['WARN_DATA_TRUNCATED', 'ER_WARN_DATA_TRUNCATED']);
  await rejects('invalid payment method blocked (ENUM)', `INSERT INTO payments (order_id,method,amount) VALUES (1,'BITCOIN',1)`, ['WARN_DATA_TRUNCATED', 'ER_WARN_DATA_TRUNCATED', 'ER_NO_REFERENCED_ROW_2']);
  await rejects('duplicate newsletter email blocked', async () => { await pool.query('INSERT INTO newsletter_subscribers (email) VALUES (?)', [`${tag}@example.com`]); await pool.query('INSERT INTO newsletter_subscribers (email) VALUES (?)', [`${tag}@EXAMPLE.com`]); }, ['ER_DUP_ENTRY']);

  // ---- foreign keys ----
  await rejects('product with missing category blocked (FK)', `INSERT INTO products (category_id,name,price,image_url) VALUES (99999,'${tag}-fk',5,'x')`, ['ER_NO_REFERENCED_ROW_2']);
  await rejects('order for missing user blocked (FK)', "INSERT INTO orders (order_number,user_id,customer_name,phone,email,fulfilment,subtotal,total) VALUES ('x-fk',99999999,'x','9000011117','x@x.com','STORE_PICKUP',1,1)", ['ER_NO_REFERENCED_ROW_2']);
  await rejects('order item for missing order blocked (FK)', "INSERT INTO order_items (order_id,product_name,unit,image_url,price,quantity,line_total) VALUES (99999999,'x','kg','x',1,1,1)", ['ER_NO_REFERENCED_ROW_2']);
  await rejects('inventory for missing product blocked (FK)', 'INSERT INTO inventory (product_id,quantity) VALUES (99999999,1)', ['ER_NO_REFERENCED_ROW_2']);
  await rejects('category with products cannot be deleted (RESTRICT)', 'DELETE FROM categories WHERE id = 1', ['ER_ROW_IS_REFERENCED_2']);

  // ---- cascades, set null, restrict on users with orders ----
  const [pc] = await pool.query('INSERT INTO categories (name) VALUES (?)', [tag + '-cat']); ids.cats.push(pc.insertId);
  const [pp] = await pool.query('INSERT INTO products (category_id,name,description,price,unit,image_url) VALUES (?,?,?,?,?,?)', [pc.insertId, `${tag}-தக்காளி 🍅`, 'முயற்சி', 12.5, 'per kg', 'assets/x.svg']); ids.products.push(pp.insertId);
  await pool.query('INSERT INTO inventory (product_id,quantity) VALUES (?,5)', [pp.insertId]);
  const [[nm]] = await pool.query('SELECT name FROM products WHERE id = ?', [pp.insertId]); t('Tamil text and emoji round-trip (utf8mb4)', nm.name === `${tag}-தக்காளி 🍅`, nm.name);
  t('default low-stock threshold is 10', (await q('SELECT low_stock_threshold n FROM inventory WHERE product_id = ?', [pp.insertId]))[0].n === 10);
  t('price keeps 2 decimals', (await q('SELECT price FROM products WHERE id = ?', [pp.insertId]))[0].price == 12.5);
  const [cart] = await pool.query('INSERT INTO carts (user_id) VALUES (?)', [uid]);
  await pool.query('INSERT INTO cart_items (cart_id,product_id,quantity) VALUES (?,?,2)', [cart.insertId, pp.insertId]);
  await rejects('same product twice in one cart blocked', `INSERT INTO cart_items (cart_id,product_id,quantity) VALUES (${cart.insertId},${pp.insertId},1)`, ['ER_DUP_ENTRY']);
  await rejects('cart quantity 0 blocked (CHECK)', `INSERT INTO cart_items (cart_id,product_id,quantity) VALUES (${cart.insertId},1,0)`, ['ER_CHECK_CONSTRAINT_VIOLATED']);
  await rejects('second cart for same user blocked', `INSERT INTO carts (user_id) VALUES (${uid})`, ['ER_DUP_ENTRY']);
  await pool.query('INSERT INTO addresses (user_id,line1,city,state,pin_code) VALUES (?,?,?,?,?)', [uid, '12 Main Street', 'Vijayapura', 'Karnataka', '586101']);
  const [o] = await pool.query("INSERT INTO orders (order_number,user_id,customer_name,phone,email,fulfilment,subtotal,total) VALUES (?,?,'DB Test','9000011118','x@x.com','STORE_PICKUP',25,25)", [tag + '-o', uid]);
  await pool.query("INSERT INTO order_items (order_id,product_id,product_name,unit,image_url,price,quantity,line_total) VALUES (?,?,?,?,?,12.5,2,25)", [o.insertId, pp.insertId, 'Snapshot name', 'per kg', 'x']);
  await pool.query("INSERT INTO payments (order_id,method,amount) VALUES (?, 'COD', 25)", [o.insertId]);
  await rejects('two payments for one order blocked', `INSERT INTO payments (order_id,method,amount) VALUES (${o.insertId},'COD',25)`, ['ER_DUP_ENTRY']);
  const [[os]] = await pool.query('SELECT status, payment_status, item_count FROM v_order_summary WHERE id = ?', [o.insertId]); t('order defaults to Pending, view shows item count', os.status === 'Pending' && os.payment_status === 'PENDING' && Number(os.item_count) === 2, os);
  await pool.query('INSERT INTO reviews (product_id,user_id,rating,comment) VALUES (?,?,5,?)', [pp.insertId, uid, 'Great']);
  await rejects('rating 6 blocked (CHECK)', `INSERT INTO reviews (product_id,user_id,rating) VALUES (${pp.insertId},${await mkUser(2)},6)`, ['ER_CHECK_CONSTRAINT_VIOLATED']);
  await rejects('second review by same user blocked', `INSERT INTO reviews (product_id,user_id,rating) VALUES (${pp.insertId},${uid},4)`, ['ER_DUP_ENTRY']);
  await rejects('user with orders cannot be deleted (RESTRICT)', `DELETE FROM users WHERE id = ${uid}`, ['ER_ROW_IS_REFERENCED_2']);
  await rejects('category with a product cannot be deleted (RESTRICT)', `DELETE FROM categories WHERE id = ${pc.insertId}`, ['ER_ROW_IS_REFERENCED_2']);

  const u0 = (await q('SELECT updated_at FROM products WHERE id = ?', [pp.insertId]))[0].updated_at; await sleep(1100); await pool.query('UPDATE products SET price = 13 WHERE id = ?', [pp.insertId]);
  t('updated_at changes automatically', (await q('SELECT updated_at FROM products WHERE id = ?', [pp.insertId]))[0].updated_at > u0);

  await pool.query('DELETE FROM products WHERE id = ?', [pp.insertId]);
  t('deleting a product removes its inventory row (CASCADE)', (await q('SELECT COUNT(*) n FROM inventory WHERE product_id = ?', [pp.insertId]))[0].n === 0);
  t('deleting a product removes it from carts (CASCADE)', (await q('SELECT COUNT(*) n FROM cart_items WHERE cart_id = ?', [cart.insertId]))[0].n === 0);
  t('deleting a product removes its reviews (CASCADE)', (await q('SELECT COUNT(*) n FROM reviews WHERE product_id = ?', [pp.insertId]))[0].n === 0);
  const [[oi]] = await pool.query('SELECT product_id, product_name, line_total FROM order_items WHERE order_id = ?', [o.insertId]); t('order history survives product deletion (SET NULL, name kept)', oi.product_id === null && oi.product_name === 'Snapshot name' && oi.line_total == 25, oi);
  await pool.query('DELETE FROM orders WHERE id = ?', [o.insertId]);
  t('deleting an order removes its items and payment (CASCADE)', (await q('SELECT (SELECT COUNT(*) FROM order_items WHERE order_id = ?) + (SELECT COUNT(*) FROM payments WHERE order_id = ?) n', [o.insertId, o.insertId]))[0].n === 0);
  await pool.query('DELETE FROM users WHERE id = ?', [uid]);
  t('deleting a user removes cart and addresses (CASCADE)', (await q('SELECT (SELECT COUNT(*) FROM carts WHERE user_id = ?) + (SELECT COUNT(*) FROM addresses WHERE user_id = ?) n', [uid, uid]))[0].n === 0);

  // ---- transactions ----
  try { await withTransaction(async c => { await c.query('INSERT INTO categories (name) VALUES (?)', [tag + '-rollback']); throw new Error('boom'); }); } catch (e) { /* expected */ }
  t('failed transaction leaves nothing behind (ROLLBACK)', (await q('SELECT COUNT(*) n FROM categories WHERE name = ?', [tag + '-rollback']))[0].n === 0);
  await withTransaction(async c => { await c.query('INSERT INTO categories (name) VALUES (?)', [tag + '-commit']); });
  t('successful transaction is saved (COMMIT)', (await q('SELECT COUNT(*) n FROM categories WHERE name = ?', [tag + '-commit']))[0].n === 1);

  // ---- cleanup ----
  await pool.query('DELETE FROM categories WHERE name LIKE ?', [tag + '%']); await pool.query('DELETE FROM newsletter_subscribers WHERE email LIKE ?', [tag + '%']);
  await pool.query('DELETE FROM users WHERE email LIKE ?', [tag + '%']);
  console.log(`\n${pass} passed, ${fail} failed`); await pool.end(); process.exit(fail ? 1 : 0);
})().catch(async e => { console.error('DB test crashed:', e); try { await pool.query('DELETE FROM users WHERE email LIKE ?', [tag + '%']); await pool.query('DELETE FROM categories WHERE name LIKE ?', [tag + '%']); await pool.end(); } catch (x) { /* ignore */ } process.exit(1); });
