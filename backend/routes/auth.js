const router = require('express').Router();
const bcrypt = require('bcrypt'); const jwt = require('jsonwebtoken');
const cfg = require('../config/env'); const { pool } = require('../config/db');
const auth = require('../middleware/auth'); const V = require('../utils/validators'); const S = require('../utils/serializers');
const { AppError, asyncHandler, ok, text } = require('../utils/helpers');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);   // keeps login timing similar for unknown emails

router.post('/register', asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!V.name(b.name)) throw new AppError(400, 'Enter your full name.');
  if (!V.email(b.email)) throw new AppError(400, 'Enter a valid email address.');
  if (!V.phone(b.phone)) throw new AppError(400, 'Enter a valid 10-digit Indian mobile number.');
  if (!V.password(b.password)) throw new AppError(400, 'Password needs 8+ characters with upper, lower, number and symbol.');
  if (b.password !== b.confirmPassword) throw new AppError(400, 'Passwords do not match.');
  const email = text(b.email, 190).toLowerCase(), phone = b.phone;
  const [dupe] = await pool.query('SELECT email, phone FROM users WHERE email = ? OR phone = ?', [email, phone]);
  if (dupe.some(r => r.email === email)) throw new AppError(409, 'An account with this email already exists.');
  if (dupe.length) throw new AppError(409, 'An account with this phone number already exists.');
  const hash = await bcrypt.hash(b.password, 10);
  // role is always 'customer': any "role" sent by the client is ignored
  const [r] = await pool.query("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')", [text(b.name, 100), email, phone, hash]);
  const [rows] = await pool.query('SELECT id, name, email, phone, role, created_at AS createdAt FROM users WHERE id = ?', [r.insertId]);
  ok(res, { user: S.user(rows[0]) }, 201);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '', password = typeof b.password === 'string' ? b.password : '';
  const [rows] = await pool.query('SELECT id, name, email, phone, role, password_hash, created_at AS createdAt FROM users WHERE email = ?', [email]);
  const u = rows[0];
  const match = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
  if (!u || !match) throw new AppError(401, 'Incorrect email or password.');
  const token = jwt.sign({ sub: String(u.id), role: u.role }, cfg.jwtSecret, { algorithm: 'HS256', expiresIn: cfg.jwtExpires });
  ok(res, { token, user: S.user(u) });
}));

router.get('/me', auth, (req, res) => ok(res, { user: S.user(req.user) }));

// Tokens are stateless: logging out means the browser discards its token.
router.post('/logout', (req, res) => ok(res, { message: 'Logged out.' }));
module.exports = router;
