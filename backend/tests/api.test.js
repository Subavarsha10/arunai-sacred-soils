/* End-to-end API test. Needs the server running (npm start) and an admin account (npm run seed:admin).
   Usage: npm run test:api        (optional: API_URL=http://localhost:5000/api)
   It creates temporary users/orders, then deletes them and restores any stock it changed. */
const cfg = require('../config/env'); const { pool } = require('../config/db'); const seedAdmin = require('../utils/seedAdmin');
const BASE = process.env.API_URL || `http://localhost:${cfg.port}/api`;
const ORIGIN = BASE.replace(/\/api$/, '');
let pass = 0, fail = 0;
const t = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } };
async function call(method, path, body, token) {
  const r = await fetch(BASE + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) { /* not json */ }
  return { s: r.status, b: j, d: j && j.data, m: j && j.message };
}
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const PW = 'Test@1234', PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
async function newUser(tag) {
  const email = `t${tag}${Date.now()}${rnd().slice(0, 3)}@example.com`, phone = '9' + rnd() + String(Math.floor(Math.random() * 10));
  const r = await call('POST', '/auth/register', { name: 'Test ' + tag, email, phone, password: PW, confirmPassword: PW });
  const l = await call('POST', '/auth/login', { email, password: PW });
  return { email, phone, id: r.d && r.d.user.id, token: l.d && l.d.token };
}
const stockOf = async id => (await call('GET', '/products/' + id)).d.stock;
const cleanupUsers = [], restore = {};

(async () => {
  console.log('Testing', BASE);
  for (const id of [1, 5, 7, 12]) restore[id] = await pool.query('SELECT quantity, low_stock_threshold FROM inventory WHERE product_id = ?', [id]).then(([r]) => r[0]);

  // ---- health, catalogue ----
  let r = await call('GET', '/health'); t('health ok', r.s === 200 && r.d.database === 'up', r.b);
  r = await call('GET', '/categories'); t('6 categories', r.s === 200 && r.d.length >= 6 && r.d[0].productCount >= 1, r.b);
  r = await call('GET', '/products'); const seeded = r.d.filter(p => p.id <= 12);
  t('12 seeded products', seeded.length === 12, r.d.length); t('12 distinct images', new Set(seeded.map(p => p.image)).size === 12);
  t('product shape', ['id', 'name', 'categoryName', 'price', 'unit', 'image', 'stock', 'availability'].every(k => k in seeded[0]));
  t('search millet', (await call('GET', '/products?search=millet')).d.length === 3);
  t('category filter', (await call('GET', '/products?category=4')).d.length === 2);
  t('sort price asc', (await call('GET', '/products?sort=price_asc')).d[0].price === 35);
  t('sort name asc', (await call('GET', '/products?sort=name_asc')).d[0].name === 'Cold Pressed Coconut Oil');
  t('featured', (await call('GET', '/products?featured=true')).d.length === 6);
  t('little millet out of stock', (await call('GET', '/products/12')).d.availability === 'Out of Stock' || restore[12].quantity > 0);
  t('product 404', (await call('GET', '/products/99999')).s === 404);
  t('sqli search safe', (await call('GET', "/products?search=" + encodeURIComponent("' OR 1=1 --"))).d.length === 0);
  t('sqli category safe', (await call('GET', '/products?category=' + encodeURIComponent('1 OR 1=1'))).d.length === 0);
  t('sqli sort safe', (await call('GET', '/products?sort=' + encodeURIComponent('price; DROP TABLE users'))).s === 200);

  // ---- auth ----
  const email = `reg${Date.now()}@example.com`, phone = '98' + rnd();
  const bad = { name: 'Varsha K', email, phone, password: PW, confirmPassword: PW };
  t('weak password rejected', (await call('POST', '/auth/register', { ...bad, password: 'abc', confirmPassword: 'abc' })).s === 400);
  t('bad email rejected', (await call('POST', '/auth/register', { ...bad, email: 'nope' })).s === 400);
  t('bad phone rejected', (await call('POST', '/auth/register', { ...bad, phone: '12345' })).s === 400);
  t('password mismatch rejected', (await call('POST', '/auth/register', { ...bad, confirmPassword: 'x' })).s === 400);
  r = await call('POST', '/auth/register', { ...bad, role: 'admin' }); t('register ok', r.s === 201, r.b); t('role forced to customer', r.d.user.role === 'customer');
  cleanupUsers.push(r.d.user.id);
  const [[row]] = await pool.query('SELECT password_hash, role FROM users WHERE id = ?', [r.d.user.id]);
  t('password stored as bcrypt hash', /^\$2[aby]\$10\$/.test(row.password_hash) && !row.password_hash.includes(PW)); t('db role customer', row.role === 'customer');
  r = await call('POST', '/auth/register', bad); t('duplicate email 409', r.s === 409 && /email/.test(r.m), r.b);
  r = await call('POST', '/auth/register', { ...bad, email: 'other' + email }); t('duplicate phone 409', r.s === 409 && /phone/.test(r.m), r.b);
  t('invalid login 401', (await call('POST', '/auth/login', { email, password: 'wrong' })).s === 401);
  t('unknown email 401', (await call('POST', '/auth/login', { email: 'nobody@example.com', password: PW })).s === 401);
  t('sqli login 401', (await call('POST', '/auth/login', { email: "' OR '1'='1", password: "' OR '1'='1" })).s === 401);
  t('login with object body 401', (await call('POST', '/auth/login', { email: { $ne: 1 }, password: { $ne: 1 } })).s === 401);
  r = await call('POST', '/auth/login', { email: email.toUpperCase(), password: PW }); t('login ok (case-insensitive email)', r.s === 200 && !!r.d.token && r.d.user.email === email, r.b);
  const tok = r.d.token; t('no password in response', !JSON.stringify(r.b).includes('password'));
  r = await call('GET', '/auth/me', undefined, tok); t('me ok', r.s === 200 && r.d.user.email === email);
  t('me without token 401', (await call('GET', '/auth/me')).s === 401); t('garbage token 401', (await call('GET', '/auth/me', undefined, 'abc.def.ghi')).s === 401);
  t('logout ok', (await call('POST', '/auth/logout')).s === 200);

  // ---- protection ----
  for (const p of ['/cart', '/orders', '/users/profile', '/admin/dashboard', '/admin/orders']) t('401 without token ' + p, (await call('GET', p)).s === 401);
  t('customer blocked from admin dashboard', (await call('GET', '/admin/dashboard', undefined, tok)).s === 403);
  t('customer blocked from product create', (await call('POST', '/products', { name: 'Hack', categoryId: 1, price: 1, stock: 1 }, tok)).s === 403);
  t('customer blocked from category create', (await call('POST', '/categories', { name: 'Hack' }, tok)).s === 403);
  t('customer blocked from inventory', (await call('PUT', '/admin/inventory/1', { stock: 999, lowStockThreshold: 1 }, tok)).s === 403);
  t('anonymous blocked from product delete', (await call('DELETE', '/products/1')).s === 401);

  // ---- cart ----
  const s1 = await stockOf(1), s5 = await stockOf(5);
  r = await call('POST', '/cart/items', { productId: 1, quantity: 2 }, tok); t('add to cart', r.s === 201 && r.d.itemCount === 2 && r.d.subtotal === 80, r.b);
  const item1 = r.d.items[0].id;
  r = await call('POST', '/cart/items', { productId: 1, quantity: 1 }, tok); t('adding same product merges', r.d.items.length === 1 && r.d.itemCount === 3);
  t('out-of-stock add rejected', restore[12].quantity > 0 || (await call('POST', '/cart/items', { productId: 12, quantity: 1 }, tok)).s === 409);
  t('over-stock add rejected', (await call('POST', '/cart/items', { productId: 1, quantity: 1000 }, tok)).s === 409);
  t('invalid quantity rejected', (await call('POST', '/cart/items', { productId: 1, quantity: 0 }, tok)).s === 400);
  t('unknown product 404', (await call('POST', '/cart/items', { productId: 99999, quantity: 1 }, tok)).s === 404);
  r = await call('PUT', '/cart/items/' + item1, { quantity: 2 }, tok); t('update quantity', r.s === 200 && r.d.itemCount === 2 && r.d.subtotal === 80, r.b);
  t('quantity above stock rejected', (await call('PUT', '/cart/items/' + item1, { quantity: s1 + 1 }, tok)).s === 409);
  r = await call('POST', '/cart/items', { productId: 5, quantity: 1 }, tok); t('cart subtotal 500', r.d.subtotal === 500, r.d);
  const other = await newUser('other'); cleanupUsers.push(other.id);
  t("cannot touch another user's cart item", (await call('PUT', '/cart/items/' + item1, { quantity: 1 }, other.token)).s === 404 && (await call('DELETE', '/cart/items/' + item1, undefined, other.token)).s === 404);
  r = await call('DELETE', '/cart/items/' + item1, undefined, tok); t('remove item', r.s === 200 && r.d.items.length === 1);
  await call('POST', '/cart/items', { productId: 1, quantity: 2 }, tok);

  // ---- checkout ----
  const order = { fullName: 'Varsha K', phone, email, fulfilment: 'HOME_DELIVERY', address: '12 Main Street', city: 'Vijayapura', state: 'Karnataka', pin: '586101', paymentMethod: 'COD' };
  t('order needs address', (await call('POST', '/orders', { ...order, address: '' }, tok)).s === 400);
  t('order needs valid pin', (await call('POST', '/orders', { ...order, pin: '12' }, tok)).s === 400);
  t('order needs payment method', (await call('POST', '/orders', { ...order, paymentMethod: 'BITCOIN' }, tok)).s === 400);
  t('empty cart cannot order', (await call('POST', '/orders', order, other.token)).s === 400);
  r = await call('POST', '/orders', order, tok); t('place order', r.s === 201, r.b); const o1 = r.d;
  t('order number format', /^ASS-\d{6}-\d{4}$/.test(o1.orderNumber), o1.orderNumber); t('order totals (free delivery, no discount)', o1.subtotal === 500 && o1.deliveryCharge === 0 && o1.discount === 0 && o1.total === 500, o1);
  t('order items saved', o1.items.length === 2 && o1.items.every(i => i.name && i.lineTotal > 0)); t('COD payment pending', o1.payment.method === 'COD' && /Pay on delivery/.test(o1.payment.status) && o1.status === 'Pending');
  t('inventory reduced', (await stockOf(1)) === s1 - 2 && (await stockOf(5)) === s5 - 1);
  t('cart emptied', (await call('GET', '/cart', undefined, tok)).d.itemCount === 0);
  const [[cnt]] = await pool.query('SELECT (SELECT COUNT(*) FROM orders WHERE id = ?) o, (SELECT COUNT(*) FROM order_items WHERE order_id = ?) i, (SELECT COUNT(*) FROM payments WHERE order_id = ?) p', [o1.id, o1.id, o1.id]);
  t('order persisted in MySQL', cnt.o === 1 && cnt.i === 2 && cnt.p === 1, cnt);
  await call('POST', '/cart/items', { productId: 1, quantity: 1 }, tok);
  r = await call('POST', '/orders', { ...order, paymentMethod: 'DEMO_UPI', upiId: 'a@b', cardNumber: '4111111111111111' }, tok); const o2 = r.d;
  t('small order pays delivery charge', r.s === 201 && o2.deliveryCharge === 40 && o2.total === 80, r.b); t('demo payment labelled', /demo/i.test(o2.payment.status));
  await call('POST', '/cart/items', { productId: 5, quantity: 3 }, tok);
  r = await call('POST', '/orders', { ...order, fulfilment: 'STORE_PICKUP', address: '', city: '', state: '', pin: '' }, tok); const o3 = r.d;
  t('pickup order: no address, free, 5% discount over 1000', r.s === 201 && o3.address === null && o3.deliveryCharge === 0 && o3.subtotal === 1260 && o3.discount === 63 && o3.total === 1197, r.b);
  r = await call('GET', '/orders', undefined, tok); t('order history (newest first)', r.d.length === 3 && r.d[0].id === o3.id);
  t('get own order', (await call('GET', '/orders/' + o1.id, undefined, tok)).d.items.length === 2);
  t("other user cannot read my order", (await call('GET', '/orders/' + o1.id, undefined, other.token)).s === 404);
  t("other user history empty", (await call('GET', '/orders', undefined, other.token)).d.length === 0);

  // ---- cancel rules ----
  t('customer cannot confirm own order', (await call('PUT', `/orders/${o2.id}/status`, { status: 'Confirmed' }, tok)).s === 403);
  t('invalid status rejected', (await call('PUT', `/orders/${o2.id}/status`, { status: 'Shipped' }, tok)).s === 400);
  t("other user cannot cancel my order", (await call('PUT', `/orders/${o2.id}/status`, { status: 'Cancelled' }, other.token)).s === 404);
  const before = await stockOf(1); r = await call('PUT', `/orders/${o2.id}/status`, { status: 'Cancelled' }, tok);
  t('customer cancels pending order', r.s === 200 && r.d.status === 'Cancelled', r.b); t('stock restored on cancel', (await stockOf(1)) === before + 1);
  t('cannot cancel twice', (await call('PUT', `/orders/${o2.id}/status`, { status: 'Cancelled' }, tok)).s === 409);

  // ---- profile / password / addresses ----
  r = await call('PUT', '/users/profile', { name: 'Varsha Kumar', phone, role: 'admin', email: 'x@y.com' }, tok); t('profile update ignores role/email', r.s === 200 && r.d.name === 'Varsha Kumar' && r.d.role === 'customer' && r.d.email === email, r.b);
  t('profile phone must be valid', (await call('PUT', '/users/profile', { name: 'Varsha', phone: '123' }, tok)).s === 400);
  t('profile phone cannot clash', (await call('PUT', '/users/profile', { name: 'Varsha', phone: other.phone }, tok)).s === 409);
  t('wrong current password', (await call('PUT', '/users/change-password', { currentPassword: 'nope', newPassword: 'New@12345', confirmPassword: 'New@12345' }, tok)).s === 400);
  t('weak new password', (await call('PUT', '/users/change-password', { currentPassword: PW, newPassword: 'abc', confirmPassword: 'abc' }, tok)).s === 400);
  t('change password', (await call('PUT', '/users/change-password', { currentPassword: PW, newPassword: 'New@12345', confirmPassword: 'New@12345' }, tok)).s === 200);
  t('old password no longer works', (await call('POST', '/auth/login', { email, password: PW })).s === 401); t('new password works', (await call('POST', '/auth/login', { email, password: 'New@12345' })).s === 200);
  t('address needs valid pin', (await call('POST', '/users/addresses', { line1: '12 Main Street', city: 'X', state: 'Y', pin: '1' }, tok)).s === 400);
  r = await call('POST', '/users/addresses', { label: 'Home', line1: '12 Main Street', city: 'Vijayapura', state: 'Karnataka', pin: '586101' }, tok); t('add address', r.s === 201 && r.d.pin === '586101', r.b);
  t('list addresses', (await call('GET', '/users/addresses', undefined, tok)).d.length === 1);
  await call('DELETE', '/users/addresses/' + r.d.id, undefined, other.token); t("other user cannot delete my address", (await call('GET', '/users/addresses', undefined, tok)).d.length === 1);
  await call('DELETE', '/users/addresses/' + r.d.id, undefined, tok); t('delete address', (await call('GET', '/users/addresses', undefined, tok)).d.length === 0);

  // ---- admin ----
  const adminEmail = 'admin-test-' + Date.now() + '@example.com';
  await seedAdmin({ email: adminEmail, phone: '9' + rnd() + '0', password: 'Admin@12345', name: 'Test Admin' });
  r = await call('POST', '/auth/login', { email: adminEmail, password: 'Admin@12345' }); t('admin login', r.s === 200 && r.d.user.role === 'admin', r.b); const at = r.d.token;
  const [[adm]] = await pool.query('SELECT id FROM users WHERE email = ?', [adminEmail]); cleanupUsers.push(adm.id);
  r = await call('GET', '/admin/dashboard', undefined, at); t('dashboard', r.s === 200 && r.d.totalProducts >= 12 && r.d.totalOrders >= 3 && Array.isArray(r.d.lowStockProducts) && Array.isArray(r.d.recentOrders) && typeof r.d.totalRevenue === 'number', r.b);
  t('dashboard excludes cancelled revenue', r.d.totalRevenue >= o1.total + o3.total);
  r = await call('GET', '/admin/customers', undefined, at); const me = r.d.find(c => c.email === email); t('admin customers list', r.s === 200 && me && me.orderCount === 3 && me.totalSpent === o1.total + o3.total, me);
  t('customer detail with orders', (await call('GET', '/admin/customers/' + me.id, undefined, at)).d.orders.length === 3);
  t('admin sees all orders', (await call('GET', '/admin/orders', undefined, at)).d.some(o => o.id === o1.id));
  t('admin can read any order', (await call('GET', '/orders/' + o1.id, undefined, at)).s === 200);
  t('admin inventory list', (await call('GET', '/admin/inventory', undefined, at)).d.length >= 12);
  // products
  r = await call('POST', '/products', { name: 'Test Jaggery ' + Date.now(), categoryId: 6, price: 90, unit: 'per kg', stock: 20, description: 'Test', image: PNG, featured: true }, at); t('admin creates product', r.s === 201 && /^uploads\/[a-f0-9]+\.png$/.test(r.d.image) && r.d.stock === 20 && r.d.featured === true, r.b); const np = r.d;
  const img = await fetch(ORIGIN + '/' + np.image); t('uploaded image is served', img.status === 200 && /image\/png/.test(img.headers.get('content-type')));
  t('svg upload rejected', (await call('POST', '/products', { name: 'Bad Svg', categoryId: 6, price: 1, stock: 1, image: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }, at)).s === 400);
  t('fake png rejected', (await call('POST', '/products', { name: 'Bad Png', categoryId: 6, price: 1, stock: 1, image: 'data:image/png;base64,AAAAAAAAAAAA' }, at)).s === 400);
  t('path traversal image rejected', (await call('POST', '/products', { name: 'Bad Path', categoryId: 6, price: 1, stock: 1, image: 'assets/../../.env' }, at)).s === 400);
  t('product validation', (await call('POST', '/products', { name: 'X', categoryId: 6, price: -5, stock: 1 }, at)).s === 400 && (await call('POST', '/products', { name: 'Valid Name', categoryId: 999, price: 5, stock: 1 }, at)).s === 400 && (await call('POST', '/products', { name: 'Valid Name', categoryId: 6, price: 5, stock: 1.5 }, at)).s === 400);
  t('duplicate product name 409', (await call('POST', '/products', { name: np.name, categoryId: 6, price: 5, stock: 1 }, at)).s === 409);
  r = await call('PUT', '/products/' + np.id, { price: 95, stock: 7, lowStockThreshold: 9, available: false }, at); t('admin edits product', r.s === 200 && r.d.price === 95 && r.d.stock === 7 && r.d.availability === 'Out of Stock', r.b);
  t('unavailable product cannot be carted', (await call('POST', '/cart/items', { productId: np.id, quantity: 1 }, tok)).s === 409);
  await call('DELETE', '/products/' + np.id, undefined, at); t('admin deletes product', (await call('GET', '/products/' + np.id)).s === 404);
  const gone = await fetch(ORIGIN + '/' + np.image); t('upload file removed with product', gone.status === 404);
  // categories
  r = await call('POST', '/categories', { name: 'Test Spices ' + Date.now(), description: 'Test' }, at); t('admin creates category', r.s === 201 && r.d.productCount === 0, r.b); const nc = r.d;
  t('duplicate category 409', (await call('POST', '/categories', { name: nc.name }, at)).s === 409);
  t('admin edits category', (await call('PUT', '/categories/' + nc.id, { name: nc.name + ' II', description: 'x' }, at)).d.name.endsWith(' II'));
  t('category with products cannot be deleted', (await call('DELETE', '/categories/1', undefined, at)).s === 409);
  t('admin deletes category', (await call('DELETE', '/categories/' + nc.id, undefined, at)).s === 200);
  // order status
  r = await call('PUT', `/orders/${o1.id}/status`, { status: 'Confirmed' }, at); t('admin confirms order', r.s === 200 && r.d.status === 'Confirmed', r.b);
  r = await call('PUT', `/orders/${o1.id}/status`, { status: 'Delivered' }, at); t('admin delivers COD order -> cash collected', r.d.status === 'Delivered' && /cash collected/.test(r.d.payment.status), r.b);
  t('delivered order is final', (await call('PUT', `/orders/${o1.id}/status`, { status: 'Cancelled' }, at)).s === 409);
  const bef = await stockOf(5); t('admin cancels order restores stock', (await call('PUT', `/orders/${o3.id}/status`, { status: 'Cancelled' }, at)).d.status === 'Cancelled' && (await stockOf(5)) === bef + 3);
  // inventory
  r = await call('PUT', '/admin/inventory/12', { stock: 30, lowStockThreshold: 10 }, at); t('admin updates inventory', r.s === 200 && r.d.availability === 'In Stock', r.b);
  t('inventory validation', (await call('PUT', '/admin/inventory/12', { stock: -1, lowStockThreshold: 10 }, at)).s === 400);
  t('low stock appears in dashboard', (await call('GET', '/admin/dashboard', undefined, at)).d.lowStockProducts.some(p => p.id === 7) || restore[7].quantity > restore[7].low_stock_threshold);

  // ---- race: two buyers, one item left ----
  const a = await newUser('raceA'), b = await newUser('raceB'); cleanupUsers.push(a.id, b.id);
  await call('PUT', '/admin/inventory/12', { stock: 1, lowStockThreshold: 0 }, at);
  await call('POST', '/cart/items', { productId: 12, quantity: 1 }, a.token); await call('POST', '/cart/items', { productId: 12, quantity: 1 }, b.token);
  const mk = u => ({ fullName: 'Racer', phone: u.phone, email: u.email, fulfilment: 'STORE_PICKUP', paymentMethod: 'COD' });
  const [ra, rb] = await Promise.all([call('POST', '/orders', mk(a), a.token), call('POST', '/orders', mk(b), b.token)]);
  t('exactly one buyer gets the last item', [ra.s, rb.s].sort().join() === '201,409', [ra.s, rb.s]); t('stock never negative', (await stockOf(12)) === 0);

  // ---- misc ----
  t('newsletter ok', (await call('POST', '/newsletter', { email: `news${Date.now()}@example.com` })).s === 201);
  const ne = `dup${Date.now()}@example.com`; await call('POST', '/newsletter', { email: ne }); t('newsletter duplicate 409', (await call('POST', '/newsletter', { email: ne })).s === 409);
  t('newsletter invalid 400', (await call('POST', '/newsletter', { email: 'bad' })).s === 400);
  const raw = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' }); t('malformed JSON -> 400 JSON error', raw.status === 400 && (await raw.json()).success === false);
  r = await call('GET', '/nope'); t('unknown endpoint 404 json', r.s === 404 && r.b.success === false);
  const nf = await fetch(ORIGIN + '/uploads/../.env'); t('.env not downloadable', nf.status !== 200 || !(await nf.text()).includes('JWT_SECRET'));
  const hdr = await fetch(BASE + '/health'); t('security headers present', hdr.headers.get('x-content-type-options') === 'nosniff' && !hdr.headers.get('x-powered-by'));

  // ---- cleanup ----
  if (cleanupUsers.length) {
    await pool.query('DELETE FROM orders WHERE user_id IN (?)', [cleanupUsers]); await pool.query('DELETE FROM users WHERE id IN (?)', [cleanupUsers]);
    await pool.query("DELETE FROM newsletter_subscribers WHERE email LIKE 'news%@example.com' OR email LIKE 'dup%@example.com'");
  }
  for (const [id, v] of Object.entries(restore)) await pool.query('UPDATE inventory SET quantity = ?, low_stock_threshold = ? WHERE product_id = ?', [v.quantity, v.low_stock_threshold, id]);
  await pool.query('UPDATE inventory SET quantity = quantity WHERE product_id = 1');
  console.log(`\n${pass} passed, ${fail} failed`); await pool.end(); process.exit(fail ? 1 : 0);
})().catch(async e => { console.error('Test run crashed:', e); try { await pool.end(); } catch (x) { /* ignore */ } process.exit(1); });
