import { getPool } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const db = getPool();
  const r = await db.query(
    `SELECT COALESCE(u.display_name, u.username) AS username,
            COUNT(*) FILTER (WHERE gs.status = 'won')    AS won_count,
            COUNT(*) FILTER (WHERE gs.status = 'lost')   AS lost_count,
            COUNT(*) FILTER (WHERE gs.status = 'active') AS active_count
     FROM users u
     LEFT JOIN grid_states gs ON gs.user_id = u.id
     GROUP BY u.id, u.display_name, u.username
     HAVING COUNT(*) FILTER (WHERE gs.status = 'won') > 0
     ORDER BY won_count DESC
     LIMIT 20`
  );
  res.json({ leaderboard: r.rows });
}
