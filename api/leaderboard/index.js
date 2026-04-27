import { getPool } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const db = getPool();
  const r = await db.query(
    `SELECT username, won_count, lost_count, active_count
     FROM leaderboard
     WHERE won_count > 0
     ORDER BY won_count DESC
     LIMIT 20`
  );
  res.json({ leaderboard: r.rows });
}
