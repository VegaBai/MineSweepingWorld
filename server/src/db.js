import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

db.on('error', (err) => {
  console.error('[db] unexpected pool error', err.message);
});