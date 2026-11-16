// Creates all tables. Run with: npm run migrate
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = migrate;

if (require.main === module) {
  migrate()
    .then(() => { console.log('Database is up to date.'); return pool.end(); })
    .catch((err) => { console.error('Migration failed:', err.message); process.exit(1); });
}
