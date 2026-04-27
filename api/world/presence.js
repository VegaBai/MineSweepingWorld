import { getPool } from '../../lib/db.js';

// Vercel has no persistent WebSocket — return active-player count via DB
// (active = has at least one grid_state with status='active', updated in last 5 min)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const db = getPool();
  const r = await db.query(
    `SELECT COUNT(DISTINCT user_id) AS count
     FROM grid_states
     WHERE status = 'active' AND updated_at > NOW() - INTERVAL '5 minutes'`
  );
  res.json({ count: parseInt(r.rows[0].count, 10) });
}
