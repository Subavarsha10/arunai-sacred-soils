const router = require('express').Router();
const { pool } = require('../config/db'); const auth = require('../middleware/auth');
const { AppError, asyncHandler, ok, int, round2 } = require('../utils/helpers');
router.use(auth);

async function cartId(userId) { await pool.query('INSERT IGNORE INTO carts (user_id) VALUES (?)', [userId]); const [r] = await pool.query('SELECT id FROM carts WHERE user_id = ?', [userId]); return r[0].id; }
async function view(userId) {
  const [rows] = await pool.query(`SELECT ci.id, p.id AS productId, p.name, p.price, p.unit, p.image_url AS image, ci.quantity, i.quantity AS stock
    FROM cart_items ci JOIN carts c ON c.id = ci.cart_id JOIN products p ON p.id = ci.product_id JOIN inventory i ON i.product_id = p.id WHERE c.user_id = ? ORDER BY ci.id`, [userId]);
  const items = rows.map(r => ({ ...r, lineTotal: round2(r.price * r.quantity) }));
  return { items, itemCount: items.reduce((s, i) => s + i.quantity, 0), subtotal: round2(items.reduce((s, i) => s + i.lineTotal, 0)) };
}
async function ownItem(userId, itemId) {
  const id = int(itemId, 1, 1e9); if (!id) throw new AppError(404, 'Cart item not found.');
  const [r] = await pool.query('SELECT ci.id, ci.quantity, ci.product_id FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE ci.id = ? AND c.user_id = ?', [id, userId]);
  if (!r.length) throw new AppError(404, 'Cart item not found.'); return r[0];
}

router.get('/', asyncHandler(async (req, res) => ok(res, await view(req.user.id))));

router.post('/items', asyncHandler(async (req, res) => {
  const pid = int(req.body && req.body.productId, 1, 1e9), qty = req.body && req.body.quantity === undefined ? 1 : int(req.body.quantity, 1, 1000);
  if (!pid) throw new AppError(404, 'Product not found.'); if (!qty) throw new AppError(400, 'Quantity must be at least 1.');
  const [pr] = await pool.query('SELECT p.name, p.is_available, i.quantity AS stock FROM products p JOIN inventory i ON i.product_id = p.id WHERE p.id = ?', [pid]);
  if (!pr.length) throw new AppError(404, 'Product not found.');
  const p = pr[0]; if (p.stock <= 0 || !p.is_available) throw new AppError(409, p.name + ' is out of stock.');
  const cid = await cartId(req.user.id);
  const [ex] = await pool.query('SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?', [cid, pid]);
  const total = (ex[0] ? ex[0].quantity : 0) + qty; if (total > p.stock) throw new AppError(409, `Only ${p.stock} of ${p.name} available.`);
  await pool.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = ?', [cid, pid, qty, total]);
  ok(res, await view(req.user.id), 201);
}));

router.put('/items/:id', asyncHandler(async (req, res) => {
  const item = await ownItem(req.user.id, req.params.id); const qty = int(req.body && req.body.quantity, 1, 1000);
  if (!qty) throw new AppError(400, 'Quantity must be at least 1.');
  const [[{ stock }]] = await pool.query('SELECT quantity AS stock FROM inventory WHERE product_id = ?', [item.product_id]);
  if (qty > stock) throw new AppError(409, `Only ${stock} available.`);
  await pool.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [qty, item.id]); ok(res, await view(req.user.id));
}));

router.delete('/items/:id', asyncHandler(async (req, res) => {
  const item = await ownItem(req.user.id, req.params.id); await pool.query('DELETE FROM cart_items WHERE id = ?', [item.id]); ok(res, await view(req.user.id));
}));
module.exports = router;
