import { getPool } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const db = getPool();
  const r = await db.query(
    'SELECT id, name, data, width, height FROM world_maps WHERE is_active = TRUE LIMIT 1'
  );
  if (r.rows.length === 0) return res.json({ map: null });
  const row = r.rows[0];
  row.data = JSON.parse(row.data);
  res.json({ map: row });
}
