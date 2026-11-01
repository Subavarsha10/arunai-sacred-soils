const router = require('express').Router();
const crypto = require('crypto');
const { pool, withTransaction } = require('../config/db'); const auth = require('../middleware/auth');
const V = require('../utils/validators'); const S = require('../utils/serializers'); const { calcTotals } = require('../utils/pricing');
const { AppError, asyncHandler, ok, int, text, round2 } = require('../utils/helpers');
const STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
router.use(auth);

function orderNumber() { const d = new Date(), p = n => String(n).padStart(2, '0'); return 'ASS-' + String(d.getUTCFullYear()).slice(2) + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '-' + crypto.randomInt(1000, 10000); }

router.post('/', asyncHandler(async (req, res) => {
  const b = req.body || {}, uid = req.user.id;
  if (!V.name(b.fullName) || !V.phone(b.phone) || !V.email(b.email)) throw new AppError(400, 'Check your name, phone and email.');
  if (!['HOME_DELIVERY', 'STORE_PICKUP'].includes(b.fulfilment)) throw new AppError(400, 'Choose home delivery or store pickup.');
  if (!['COD', 'DEMO_UPI', 'DEMO_CARD'].includes(b.paymentMethod)) throw new AppError(400, 'Choose a payment method.');
  const home = b.fulfilment === 'HOME_DELIVERY';
  if (home && (text(b.address).length < 5 || text(b.city).length < 2 || text(b.state).length < 2 || !V.pin(b.pin))) throw new AppError(400, 'Enter a complete delivery address with a valid PIN code.');

  const id = await withTransaction(async conn => {
    // lock the cart's product stock rows so two checkouts cannot sell the same last item
    const [items] = await conn.query(`SELECT ci.id AS cartItemId, ci.cart_id, ci.quantity, p.id AS pid, p.name, p.unit, p.price, p.image_url, p.is_available, i.quantity AS stock
      FROM cart_items ci JOIN carts c ON c.id = ci.cart_id JOIN products p ON p.id = ci.product_id JOIN inventory i ON i.product_id = p.id
      WHERE c.user_id = ? ORDER BY p.id FOR UPDATE`, [uid]);
    if (!items.length) throw new AppError(400, 'Your cart is empty.');
    for (const it of items) if (!it.is_available || it.quantity > it.stock) throw new AppError(409, `${it.name} has only ${it.is_available ? it.stock : 0} left. Update your cart.`);
    const t = calcTotals(round2(items.reduce((s, i) => s + i.price * i.quantity, 0)), b.fulfilment);

    let orderId = null;
    for (let attempt = 0; attempt < 5 && !orderId; attempt++) {
      try {
        const [r] = await conn.query(`INSERT INTO orders (order_number, user_id, customer_name, phone, email, fulfilment, ship_line1, ship_city, ship_state, ship_pin, subtotal, delivery_charge, discount, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderNumber(), uid, text(b.fullName, 100), b.phone, text(b.email, 190).toLowerCase(), b.fulfilment, home ? text(b.address) : null, home ? text(b.city, 80) : null, home ? text(b.state, 80) : null, home ? b.pin : null, t.subtotal, t.delivery, t.discount, t.total]);
        orderId = r.insertId;
      } catch (e) { if (e.code !== 'ER_DUP_ENTRY' || attempt === 4) throw e; }   // order number collision: try another
    }
    await conn.query('INSERT INTO order_items (order_id, product_id, product_name, unit, image_url, price, quantity, line_total) VALUES ?',
      [items.map(i => [orderId, i.pid, i.name, i.unit, i.image_url, i.price, i.quantity, round2(i.price * i.quantity)])]);
    await conn.query('INSERT INTO payments (order_id, method, status, amount) VALUES (?, ?, ?, ?)', [orderId, b.paymentMethod, b.paymentMethod === 'COD' ? 'PENDING' : 'PAID_DEMO', t.total]);
    for (const it of items) {
      const [u] = await conn.query('UPDATE inventory SET quantity = quantity - ? WHERE product_id = ? AND quantity >= ?', [it.quantity, it.pid, it.quantity]);
      if (u.affectedRows !== 1) throw new AppError(409, `${it.name} just went out of stock.`);
    }
    await conn.query('DELETE FROM cart_items WHERE cart_id = ?', [items[0].cart_id]);
    return orderId;
  });
  const [order] = await S.loadOrders(pool, 'WHERE o.id = ?', [id]); ok(res, order, 201);
}));

router.get('/', asyncHandler(async (req, res) => ok(res, await S.loadOrders(pool, 'WHERE o.user_id = ?', [req.user.id]))));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = int(req.params.id, 1, 1e9); const [o] = id ? await S.loadOrders(pool, 'WHERE o.id = ?', [id]) : [];
  if (!o || (o.userId !== req.user.id && req.user.role !== 'admin')) throw new AppError(404, 'Order not found.');   // 404, not 403: do not reveal other people's order ids
  ok(res, o);
}));

router.put('/:id/status', asyncHandler(async (req, res) => {
  const id = int(req.params.id, 1, 1e9), status = req.body && req.body.status, isAdmin = req.user.role === 'admin';
  if (!STATUSES.includes(status)) throw new AppError(400, 'Invalid status.');
  const updated = await withTransaction(async conn => {
    const [o] = id ? await S.loadOrders(conn, 'WHERE o.id = ?', [id], '', 'FOR UPDATE') : [];
    if (!o || (!isAdmin && o.userId !== req.user.id)) throw new AppError(404, 'Order not found.');
    if (o.status === 'Cancelled' || o.status === 'Delivered') throw new AppError(409, `This order is already ${o.status.toLowerCase()}.`);
    if (!isAdmin && !(status === 'Cancelled' && o.status === 'Pending')) throw new AppError(403, 'You can only cancel orders that are still pending.');
    if (status === 'Cancelled') for (const i of o.items) if (i.productId) await conn.query('UPDATE inventory SET quantity = quantity + ? WHERE product_id = ?', [i.quantity, i.productId]);
    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    if (status === 'Delivered' && o.payment.method === 'COD') await conn.query("UPDATE payments SET status = 'PAID_COD' WHERE order_id = ?", [id]);
    return id;
  });
  const [order] = await S.loadOrders(pool, 'WHERE o.id = ?', [updated]); ok(res, order);
}));
module.exports = router;
