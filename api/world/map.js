import { getPool } from '../../lib/db.js';

const TIER_IDS = ['easy', 'normal', 'medium', 'hard', 'expert', 'master'];

function isMaintenanceWindow() {
  const now = new Date();
  return now.getUTCDay() === 1 && now.getUTCHours() === 0 && now.getUTCMinutes() < 30;
}

async function performSwitch(db, newMapId) {
  const oldRes = await db.query(
    'SELECT id, data, width, height FROM world_maps WHERE is_active=TRUE LIMIT 1'
  );
  if (oldRes.rows.length) {
    const old = oldRes.rows[0];
    const mapData = JSON.parse(old.data);
    const { id: oldId, width, height } = old;

    const tierAt = (gx, gy) => {
      const v = mapData[gy * width + gx];
      return (v > 0 && v <= 6) ? TIER_IDS[v - 1] : null;
    };

    // Total cells per tier in this map
    const tierTotals = {};
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const t = tierAt(x, y);
        if (t) tierTotals[t] = (tierTotals[t] || 0) + 1;
      }

    // Per-user per-tier stats from grid_states
    const states = await db.query('SELECT user_id, grid_x, grid_y, status FROM grid_states');
    const userStats = {};
    for (const row of states.rows) {
      const t = tierAt(row.grid_x, row.grid_y);
      if (!t) continue;
      if (!userStats[row.user_id]) userStats[row.user_id] = {};
      if (!userStats[row.user_id][t]) userStats[row.user_id][t] = { won: 0, lost: 0 };
      if (row.status === 'won')  userStats[row.user_id][t].won++;
      else if (row.status === 'lost') userStats[row.user_id][t].lost++;
    }

    // Snapshot
    for (const [userId, tiers] of Object.entries(userStats)) {
      for (const tierId of TIER_IDS) {
        const total = tierTotals[tierId] || 0;
        if (!total) continue;
        const { won = 0, lost = 0 } = tiers[tierId] || {};
        if (won === 0 && lost === 0) continue;
        await db.query(
          `INSERT INTO map_week_snapshots (map_id, user_id, tier, total, won, lost)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (map_id, user_id, tier) DO UPDATE SET won=$5, lost=$6`,
          [oldId, userId, tierId, total, won, lost]
        );
      }
    }

    // Clear game state for the new week
    await db.query('DELETE FROM grid_states');
    await db.query('DELETE FROM illuminate_credits');
    await db.query('UPDATE world_maps SET is_active=FALSE, scheduled_at=NULL WHERE id=$1', [oldId]);
  }

  await db.query(
    'UPDATE world_maps SET is_active=TRUE, scheduled_at=NULL, week_start=NOW() WHERE id=$1',
    [newMapId]
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const db = getPool();

  // Maintenance window: Monday 00:00–00:30 UTC
  if (isMaintenanceWindow()) {
    const now = new Date();
    const resumesAt = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 30, 0
    )).toISOString();
    return res.json({ maintenance: true, resumesAt });
  }

  // Lazy switch: activate scheduled map if maintenance window has passed
  const ready = await db.query(
    `SELECT id FROM world_maps
     WHERE scheduled_at IS NOT NULL AND scheduled_at + INTERVAL '30 minutes' <= NOW()
     ORDER BY scheduled_at ASC LIMIT 1`
  );
  if (ready.rows.length) {
    const current = await db.query('SELECT id FROM world_maps WHERE is_active=TRUE LIMIT 1');
    if (!current.rows.length || current.rows[0].id !== ready.rows[0].id) {
      await performSwitch(db, ready.rows[0].id).catch(e => console.error('[switch]', e.message));
    }
  }

  const r = await db.query(
    'SELECT id, name, data, width, height, week_start FROM world_maps WHERE is_active=TRUE LIMIT 1'
  );
  if (!r.rows.length) return res.json({ map: null });
  const row = r.rows[0];
  row.data = JSON.parse(row.data);
  res.json({ map: row });
}
