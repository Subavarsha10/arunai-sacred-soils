const router = require('express').Router();
const { pool } = require('../config/db'); const auth = require('../middleware/auth'); const admin = require('../middleware/admin');
const S = require('../utils/serializers'); const { AppError, asyncHandler, ok, int } = require('../utils/helpers');
router.use(auth, admin);   // every /api/admin route needs a logged-in administrator

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [[c]] = await pool.query(`SELECT (SELECT COUNT(*) FROM products) AS totalProducts, (SELECT COUNT(*) FROM users WHERE role = 'customer') AS totalCustomers,
    (SELECT COUNT(*) FROM orders) AS totalOrders, (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status <> 'Cancelled') AS totalRevenue,
    (SELECT COUNT(*) FROM orders WHERE status = 'Pending') AS pendingOrders`);
  const [low] = await pool.query(S.PRODUCT_SELECT + ' WHERE i.quantity <= i.low_stock_threshold ORDER BY i.quantity, p.id');
  const [recent] = await pool.query('SELECT id FROM orders ORDER BY id DESC LIMIT 5');
  const recentOrders = recent.length ? await S.loadOrders(pool, 'WHERE o.id IN (?)', [recent.map(r => r.id)]) : [];
  ok(res, { ...c, totalRevenue: Number(c.totalRevenue), lowStockProducts: low.map(S.product), recentOrders });
}));

router.get('/customers', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at AS createdAt, COUNT(o.id) AS orderCount,
    COALESCE(SUM(CASE WHEN o.status <> 'Cancelled' THEN o.total END), 0) AS totalSpent
    FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE u.role = 'customer' GROUP BY u.id, u.name, u.email, u.phone, u.role, u.created_at ORDER BY u.id DESC`);
  ok(res, rows.map(r => ({ ...r, orderCount: Number(r.orderCount), totalSpent: Number(r.totalSpent) })));
}));
router.get('/customers/:id', asyncHandler(async (req, res) => {
  const id = int(req.params.id, 1, 1e9); const [u] = id ? await pool.query("SELECT id, name, email, phone, role, created_at AS createdAt FROM users WHERE id = ? AND role = 'customer'", [id]) : [[]];
  if (!u.length) throw new AppError(404, 'Customer not found.'); ok(res, { ...S.user(u[0]), orders: await S.loadOrders(pool, 'WHERE o.user_id = ?', [id]) });
}));
router.get('/orders', asyncHandler(async (req, res) => ok(res, await S.loadOrders(pool))));
router.get('/inventory', asyncHandler(async (req, res) => { const [r] = await pool.query(S.PRODUCT_SELECT + ' ORDER BY p.id'); ok(res, r.map(S.product)); }));
router.put('/inventory/:id', asyncHandler(async (req, res) => {
  const id = int(req.params.id, 1, 1e9), b = req.body || {}; const stock = int(b.stock, 0, 1e6), thr = int(b.lowStockThreshold, 0, 1e6);
  if (stock === null) throw new AppError(400, 'Stock must be a whole number, 0 or more.'); if (thr === null) throw new AppError(400, 'Low-stock threshold must be a whole number.');
  const [r] = id ? await pool.query('UPDATE inventory SET quantity = ?, low_stock_threshold = ? WHERE product_id = ?', [stock, thr, id]) : [{ affectedRows: 0 }];
  const [p] = id ? await pool.query(S.PRODUCT_SELECT + ' WHERE p.id = ?', [id]) : [[]];
  if (!p.length) throw new AppError(404, 'Product not found.'); ok(res, S.product(p[0]));
}));
module.exports = router;
