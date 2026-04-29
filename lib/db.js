import pg from 'pg';
const { Pool } = pg;

function stripSslMode(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete('sslmode');
    return u.toString();
  } catch { return url; }
}

let pool;
export function getPool() {
  if (!pool) {
    const connStr = process.env.MSW_POSTGRES_URL;
    pool = new Pool({
      connectionString: stripSslMode(connStr),
      ssl: connStr?.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
    });
    pool.on('error', (err) => console.error('pg pool error', err));
  }
  return pool;
}
