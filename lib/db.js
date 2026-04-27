import pg from 'pg';
const { Pool } = pg;

// Serverless-safe singleton: reuse pool across warm invocations
let pool;
export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
    });
    pool.on('error', (err) => console.error('pg pool error', err));
  }
  return pool;
}
