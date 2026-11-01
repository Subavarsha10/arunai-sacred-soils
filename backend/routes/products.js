const router = require('express').Router();
const { pool, withTransaction } = require('../config/db'); const auth = require('../middleware/auth'); const admin = require('../middleware/admin');
const S = require('../utils/serializers'); const { resolveImage, removeUpload } = require('../utils/images');
const { AppError, asyncHandler, ok, int, text } = require('../utils/helpers');

const SORTS = { price_asc: 'p.price ASC, p.id', price_desc: 'p.price DESC, p.id', name_asc: 'p.name ASC', name_desc: 'p.name DESC' };   // whitelist: never put user text in ORDER BY

router.get('/', asyncHandler(async (req, res) => {
  const where = [], params = [], q = req.query;
  if (typeof q.search === 'string' && q.search.trim()) { where.push('p.name LIKE ?'); params.push('%' + q.search.trim().slice(0, 80).replace(/[\\%_]/g, '\\$&') + '%'); }
  if (q.category !== undefined && q.category !== '') { const c = int(q.category, 1, 1e9); if (!c) return ok(res, []); where.push('p.category_id = ?'); params.push(c); }
  if (q.featured === 'true' || q.featured === '1') where.push('p.is_featured = 1');
  const [rows] = await pool.query(`${S.PRODUCT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${SORTS[q.sort] || 'p.id'}`, params);
  ok(res, rows.map(S.product));
}));

async function getProduct(conn, id) { const [rows] = await conn.query(S.PRODUCT_SELECT + ' WHERE p.id = ?', [id]); return rows[0]; }

router.get('/:id', asyncHandler(async (req, res) => {
  const id = int(req.params.id, 1, 1e9); const p = id && await getProduct(pool, id);
  if (!p) throw new AppError(404, 'Product not found.'); ok(res, S.product(p));
}));

/** Validates the body. partial=true (PUT) only checks fields that are present. */
async function parse(b, partial) {
  b = b || {}; const p = {}, inv = {}, has = k => b[k] !== undefined;
  if (!partial || has('name')) { const n = text(b.name, 120); if (n.length < 2) throw new AppError(400, 'Product name is required.'); p.name = n; }
  if (!partial || has('categoryId')) {
    const c = int(b.categoryId, 1, 1e9); const [r] = c ? await pool.query('SELECT id FROM categories WHERE id = ?', [c]) : [[]];
    if (!r.length) throw new AppError(400, 'Choose a valid category.'); p.category_id = c;
  }
  if (!partial || has('price')) { const n = Number(b.price); if (!(n > 0 && n <= 1000000) || typeof b.price === 'boolean' || b.price === '' || b.price === null) throw new AppError(400, 'Price must be greater than zero.'); p.price = Math.round(n * 100) / 100; }
  if (!partial || has('stock')) { const n = int(b.stock, 0, 1e6); if (n === null) throw new AppError(400, 'Stock must be a whole number, 0 or more.'); inv.quantity = n; }
  if (has('lowStockThreshold')) { const n = int(b.lowStockThreshold, 0, 1e6); if (n === null) throw new AppError(400, 'Low-stock threshold must be a whole number.'); inv.low_stock_threshold = n; }
  if (has('unit')) { const u = text(b.unit, 40); if (!u) throw new AppError(400, 'Enter a unit.'); p.unit = u; }
  if (has('description')) p.description = text(b.description, 2000);
  if (has('available')) p.is_available = b.available === true || b.available === 1 || b.available === '1' ? 1 : 0;
  if (has('featured')) p.is_featured = b.featured === true || b.featured === 1 || b.featured === '1' ? 1 : 0;
  if (has('image') && b.image) p.image_url = resolveImage(b.image);
  return { p, inv };
}
const setClause = o => ({ sql: Object.keys(o).map(k => `${k} = ?`).join(', '), vals: Object.values(o) });

router.post('/', auth, admin, asyncHandler(async (req, res) => {
  const { p, inv } = await parse(req.body, false);
  p.image_url = p.image_url || 'assets/images/products/tomatoes.svg';
  const id = await withTransaction(async conn => {
    const cols = Object.keys(p);
    const [r] = await conn.query(`INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map(c => p[c]));
    await conn.query('INSERT INTO inventory (product_id, quantity, low_stock_threshold) VALUES (?, ?, ?)', [r.insertId, inv.quantity, inv.low_stock_threshold ?? 10]);
    return r.insertId;
  });
  ok(res, S.product(await getProduct(pool, id)), 201);
}));

router.put('/:id', auth, admin, asyncHandler(async (req, res) => {
  const id = int(req.params.id, 1, 1e9); const cur = id && await getProduct(pool, id); if (!cur) throw new AppError(404, 'Product not found.');
  const { p, inv } = await parse(req.body, true);
  await withTransaction(async conn => {
    if (Object.keys(p).length) { const c = setClause(p); await conn.query(`UPDATE products SET ${c.sql} WHERE id = ?`, [...c.vals, id]); }
    if (Object.keys(inv).length) { const c = setClause(inv); await conn.query(`UPDATE inventory SET ${c.sql} WHERE product_id = ?`, [...c.vals, id]); }
  });
  if (p.image_url && p.image_url !== cur.image) removeUpload(cur.image);
  ok(res, S.product(await getProduct(pool, id)));
}));

router.delete('/:id', auth, admin, asyncHandler(async (req, res) => {
  const id = int(req.params.id, 1, 1e9); const cur = id && await getProduct(pool, id); if (!cur) throw new AppError(404, 'Product not found.');
  await pool.query('DELETE FROM products WHERE id = ?', [id]);     // inventory + cart rows cascade; order history keeps its copied name/price
  removeUpload(cur.image); ok(res, { message: 'Product deleted.' });
}));
module.exports = router;
