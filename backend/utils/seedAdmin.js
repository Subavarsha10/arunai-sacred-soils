// npm run seed:admin -> creates (or resets the password of) the admin account from the ADMIN_* values in .env
const bcrypt = require('bcrypt'); const cfg = require('../config/env'); const { pool } = require('../config/db'); const V = require('./validators');
async function seedAdmin(o = {}) {
  const e = process.env, name = o.name || e.ADMIN_NAME || 'Store Admin', email = (o.email || e.ADMIN_EMAIL || '').toLowerCase(), phone = o.phone || e.ADMIN_PHONE || '9000000000', password = o.password || e.ADMIN_PASSWORD || '';
  if (!V.email(email) || !V.phone(phone) || !V.password(password)) throw new Error('Set a valid ADMIN_EMAIL, ADMIN_PHONE and a strong ADMIN_PASSWORD in backend/.env');
  const hash = await bcrypt.hash(password, 10);
  const [r] = await pool.query("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin') ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin', name = VALUES(name)", [name, email, phone, hash]);
  return { email, created: r.affectedRows === 1 };
}
module.exports = seedAdmin;
if (require.main === module) seedAdmin().then(r => { console.log(`Admin ready: ${r.email} (${r.created ? 'created' : 'password reset'}). Change the password in .env before any real deployment.`); return pool.end(); })
  .catch(err => { console.error(err.message); process.exitCode = 1; return pool.end(); });
