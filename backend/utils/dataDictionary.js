// npm run db:docs -> writes ../docs/DATA-DICTIONARY.md from the live database, so the documentation always matches the real tables.
const fs = require('fs'); const path = require('path'); const { pool } = require('../config/db'); const cfg = require('../config/env');
(async () => {
  const db = cfg.db.database; let out = `# Data dictionary: ${db}\n\nGenerated from the live database by \`npm run db:docs\`.\n\n`;
  const [tables] = await pool.query("SELECT TABLE_NAME n, TABLE_ROWS r, ENGINE e FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY TABLE_NAME", [db]);
  for (const t of tables) {
    out += `## ${t.n}\n\n| Column | Type | Null | Key | Default | Notes |\n|---|---|---|---|---|---|\n`;
    const [cols] = await pool.query('SELECT COLUMN_NAME c, COLUMN_TYPE t, IS_NULLABLE n, COLUMN_KEY k, COLUMN_DEFAULT d, EXTRA x FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ORDINAL_POSITION', [db, t.n]);
    cols.forEach(c => { out += `| ${c.c} | ${c.t} | ${c.n} | ${c.k || ''} | ${c.d === null ? '' : String(c.d).replace(/\|/g, '/')} | ${c.x || ''} |\n`; });
    const [fks] = await pool.query('SELECT k.COLUMN_NAME c, k.REFERENCED_TABLE_NAME rt, k.REFERENCED_COLUMN_NAME rc, r.DELETE_RULE d, r.UPDATE_RULE u FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r ON r.constraint_name = k.constraint_name AND r.constraint_schema = k.table_schema WHERE k.table_schema = ? AND k.table_name = ? AND k.referenced_table_name IS NOT NULL', [db, t.n]);
    if (fks.length) out += '\nForeign keys: ' + fks.map(f => `\`${f.c}\` -> \`${f.rt}.${f.rc}\` (on delete ${f.d.toLowerCase()})`).join('; ') + '\n';
    const [idx] = await pool.query('SELECT INDEX_NAME i, NON_UNIQUE nu, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) cols FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? GROUP BY INDEX_NAME, NON_UNIQUE', [db, t.n]);
    out += '\nIndexes: ' + idx.map(i => `\`${i.i}\` (${i.cols})${i.nu ? '' : ' unique'}`).join('; ') + '\n\n';
  }
  const [views] = await pool.query('SELECT TABLE_NAME n FROM information_schema.views WHERE table_schema = ? ORDER BY 1', [db]);
  if (views.length) out += '## Views\n\n' + views.map(v => `* \`${v.n}\``).join('\n') + '\n';
  const dir = path.join(__dirname, '..', '..', 'docs'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'DATA-DICTIONARY.md'), out); console.log('Wrote docs/DATA-DICTIONARY.md (' + tables.length + ' tables, ' + views.length + ' views)'); await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
