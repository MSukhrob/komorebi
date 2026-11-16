// One shared PostgreSQL connection pool for the whole app.
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
