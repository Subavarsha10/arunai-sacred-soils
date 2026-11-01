const router = require('express').Router();
const { pool } = require('../config/db'); const auth = require('../middleware/auth'); const admin = require('../middleware/admin');
const { resolveImage, removeUpload } = require('../utils/images'); const { AppError, asyncHandler, ok, int, text } = require('../utils/helpers');
const DEFAULT_IMG = 'assets/images/categories/grains.svg';
const LIST = `SELECT c.id, c.name, c.description, c.image_url AS image, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS productCount FROM categories c`;

router.get('/', asyncHandler(async (req, res) => { const [rows] = await pool.query(LIST + ' ORDER BY c.id'); ok(res, rows); }));

router.post('/', auth, admin, asyncHandler(async (req, res) => {
  const b = req.body || {}, name = text(b.name, 80);
  if (name.length < 2) throw new AppError(400, 'Category name is required.');
  const [dupe] = await pool.query('SELECT id FROM categories WHERE name = ?', [name]); if (dupe.length) throw new AppError(409, 'Category already exists.');
  const image = b.image ? resolveImage(b.image) : DEFAULT_IMG;
  const [r] = await pool.query('INSERT INTO categories (name, description, image_url) VALUES (?, ?, ?)', [name, text(b.description, 255), image]);
  const [rows] = await pool.query(LIST + ' WHERE c.id = ?', [r.insertId]); ok(res, rows[0], 201);
}));

router.put('/:id', auth, admin, asyncHandler(async (req, res) => {
  const id = int(req.params.id, 1, 1e9), b = req.body || {}; if (!id) throw new AppError(404, 'Category not found.');
  const [cur] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]); if (!cur.length) throw new AppError(404, 'Category not found.');
  const name = text(b.name, 80); if (name.length < 2) throw new AppError(400, 'Category name is required.');
  const [dupe] = await pool.query('SELECT id FROM categories WHERE name = ? AND id <> ?', [name, id]); if (dupe.length) throw new AppError(409, 'Another category already uses that name.');
  const image = b.image ? resolveImage(b.image) : cur[0].image_url;
  await pool.query('UPDATE categories SET name = ?, description = ?, image_url = ? WHERE id = ?', [name, b.description === undefined ? cur[0].description : text(b.description, 255), image, id]);
  if (image !== cur[0].image_url) removeUpload(cur[0].image_url);
  const [rows] = await pool.query(LIST + ' WHERE c.id = ?', [id]); ok(res, rows[0]);
}));

router.delete('/:id', auth, admin, asyncHandler(async (req, res) => {
  const id = int(req.params.id, 1, 1e9); if (!id) throw new AppError(404, 'Category not found.');
  const [cur] = await pool.query('SELECT image_url FROM categories WHERE id = ?', [id]); if (!cur.length) throw new AppError(404, 'Category not found.');
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM products WHERE category_id = ?', [id]);
  if (n) throw new AppError(409, 'Move or delete the products in this category first.');
  await pool.query('DELETE FROM categories WHERE id = ?', [id]); removeUpload(cur[0].image_url); ok(res, { message: 'Category deleted.' });
}));
module.exports = router;
