const router = require('express').Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db'); const auth = require('../middleware/auth');
const V = require('../utils/validators'); const S = require('../utils/serializers'); const { AppError, asyncHandler, ok, int, text } = require('../utils/helpers');
router.use(auth);

router.get('/profile', (req, res) => ok(res, S.user(req.user)));
router.put('/profile', asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!V.name(b.name)) throw new AppError(400, 'Enter your full name.'); if (!V.phone(b.phone)) throw new AppError(400, 'Enter a valid 10-digit mobile number.');
  const [d] = await pool.query('SELECT id FROM users WHERE phone = ? AND id <> ?', [b.phone, req.user.id]); if (d.length) throw new AppError(409, 'That phone number is already used by another account.');
  await pool.query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [text(b.name, 100), b.phone, req.user.id]);   // email and role can never be changed here
  const [r] = await pool.query('SELECT id, name, email, phone, role, created_at AS createdAt FROM users WHERE id = ?', [req.user.id]); ok(res, S.user(r[0]));
}));
router.put('/change-password', asyncHandler(async (req, res) => {
  const b = req.body || {}; const [r] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (typeof b.currentPassword !== 'string' || !(await bcrypt.compare(b.currentPassword, r[0].password_hash))) throw new AppError(400, 'Current password is incorrect.');
  if (!V.password(b.newPassword)) throw new AppError(400, 'New password is too weak.'); if (b.newPassword !== b.confirmPassword) throw new AppError(400, 'New passwords do not match.');
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(b.newPassword, 10), req.user.id]); ok(res, { message: 'Password updated.' });
}));

router.get('/addresses', asyncHandler(async (req, res) => { const [r] = await pool.query('SELECT * FROM addresses WHERE user_id = ? ORDER BY id', [req.user.id]); ok(res, r.map(S.address)); }));
router.post('/addresses', asyncHandler(async (req, res) => {
  const b = req.body || {}; const line1 = text(b.line1), city = text(b.city, 80), state = text(b.state, 80);
  if (line1.length < 5 || city.length < 2 || state.length < 2 || !V.pin(b.pin)) throw new AppError(400, 'Fill address, city, state and a valid 6-digit PIN code.');
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?', [req.user.id]); if (n >= 10) throw new AppError(409, 'You can save up to 10 addresses.');
  const [r] = await pool.query('INSERT INTO addresses (user_id, label, line1, city, state, pin_code) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, text(b.label, 40) || 'Home', line1, city, state, b.pin]);
  const [row] = await pool.query('SELECT * FROM addresses WHERE id = ?', [r.insertId]); ok(res, S.address(row[0]), 201);
}));
router.delete('/addresses/:id', asyncHandler(async (req, res) => {
  const id = int(req.params.id, 1, 1e9); if (id) await pool.query('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, req.user.id]); ok(res, { message: 'Address removed.' });
}));
module.exports = router;
