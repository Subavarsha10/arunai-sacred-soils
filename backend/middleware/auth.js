const jwt = require('jsonwebtoken');
const cfg = require('../config/env'); const { pool } = require('../config/db'); const { AppError, asyncHandler } = require('../utils/helpers');

/** Requires a valid "Authorization: Bearer <token>" header and loads the user from the database. */
module.exports = asyncHandler(async (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw new AppError(401, 'Please log in to continue.');
  let payload;
  try { payload = jwt.verify(h.slice(7), cfg.jwtSecret, { algorithms: ['HS256'] }); }
  catch (e) { throw new AppError(401, 'Your session has expired. Please log in again.'); }
  const [rows] = await pool.query('SELECT id, name, email, phone, role, created_at AS createdAt FROM users WHERE id = ?', [payload.sub]);
  if (!rows.length) throw new AppError(401, 'Account not found. Please log in again.');
  req.user = rows[0]; next();
});
