const mysql = require('mysql2/promise');
const cfg = require('./env');

const pool = mysql.createPool({
  ...cfg.db, waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4',
  decimalNumbers: true,            // DECIMAL columns come back as numbers, not strings
  dateStrings: false, timezone: 'Z'
});
pool.on('connection', c => c.query("SET time_zone = '+00:00'"));

/** Run fn(conn) inside a transaction; commits on success, rolls back on any error. */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const out = await fn(conn); await conn.commit(); return out; }
  catch (err) { try { await conn.rollback(); } catch (e) { /* connection already gone */ } throw err; }
  finally { conn.release(); }
}
module.exports = { pool, withTransaction };
