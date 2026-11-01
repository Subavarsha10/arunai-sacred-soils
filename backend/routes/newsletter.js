const router = require('express').Router();
const { pool } = require('../config/db'); const V = require('../utils/validators'); const { AppError, asyncHandler, ok } = require('../utils/helpers');
router.post('/', asyncHandler(async (req, res) => {
  const email = req.body && typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!V.email(email)) throw new AppError(400, 'Enter a valid email address.');
  const [r] = await pool.query('INSERT IGNORE INTO newsletter_subscribers (email) VALUES (?)', [email]);
  if (!r.affectedRows) throw new AppError(409, 'You are already subscribed.'); ok(res, { message: 'Subscribed.' }, 201);
}));
module.exports = router;
