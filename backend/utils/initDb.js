// npm run db:setup  -> runs ../database/schema.sql (creates database, tables, views and starter data if missing; never deletes data)
// npm run db:reset  -> DELETES the whole database, then recreates it from schema.sql (development only)
const fs = require('fs'); const path = require('path'); const mysql = require('mysql2/promise'); const cfg = require('../config/env');
const reset = process.argv.includes('--reset'), confirmed = process.argv.includes('--yes');
(async () => {
  if (reset && !confirmed) { console.error('db:reset deletes ALL data in "' + cfg.db.database + '". Run:  npm run db:reset'); process.exit(1); }
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8').replace(/arunai_sacred_soils/g, cfg.db.database);
  let conn;
  try {
    conn = await mysql.createConnection({ host: cfg.db.host, port: cfg.db.port, user: cfg.db.user, password: cfg.db.password, multipleStatements: true });
    if (reset) { await conn.query('DROP DATABASE IF EXISTS `' + cfg.db.database.replace(/`/g, '') + '`'); console.log('Old database deleted.'); }
    await conn.query(sql); console.log('Database "' + cfg.db.database + '" is ready (tables, views and starter data created if missing).');
    if (reset) console.log('Next: npm run seed:admin');
  } catch (e) { console.error('Database setup failed:', e.code || '', e.message); process.exitCode = 1; }
  finally { if (conn) await conn.end(); }
})();
