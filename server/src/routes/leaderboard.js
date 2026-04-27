import { db } from '../db.js';

export default async function leaderboardRoutes(app) {
  // Top 20 by won grids
  app.get('/', async (_req, reply) => {
    const { rows } = await db.query(`
      SELECT username, won_count, lost_count, active_count
      FROM leaderboard
      WHERE won_count > 0
      ORDER BY won_count DESC
      LIMIT 20
    `);
    return rows;
  });
}
