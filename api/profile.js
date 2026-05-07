import { getPool } from '../lib/db.js';
import { authenticate } from '../lib/auth.js';

const TIER_IDS = ['easy', 'normal', 'medium', 'hard', 'expert', 'master'];

const ACHIEVEMENTS = [
  { id: 'first_win',      icon: '🌱', title: '初出茅庐',   desc: '赢得第一场游戏',                    check: d => d.totalWon >= 1 },
  { id: 'first_loss',     icon: '💥', title: '踩雷留名',   desc: '第一次踩雷',                        check: d => d.totalLost >= 1 },
  { id: 'wins_10',        icon: '⚡', title: '熟能生巧',   desc: '累计赢得 10 场游戏',                check: d => d.totalWon >= 10 },
  { id: 'wins_50',        icon: '🔥', title: '百战之师',   desc: '累计赢得 50 场游戏',                check: d => d.totalWon >= 50 },
  { id: 'wins_100',       icon: '💎', title: '永不言败',   desc: '累计赢得 100 场游戏',               check: d => d.totalWon >= 100 },
  { id: 'won_expert',     icon: '🏆', title: '专家认证',   desc: '赢得一场 Expert 难度游戏',          check: d => (d.wonTiers.expert || 0) >= 1 },
  { id: 'won_master',     icon: '👑', title: '踩雷宗师',   desc: '赢得一场 Master 难度游戏',          check: d => (d.wonTiers.master || 0) >= 1 },
  { id: 'weeks_3',        icon: '📅', title: '周常老兵',   desc: '参与了 3 张不同的周地图',           check: d => d.weekCount >= 3 },
  { id: 'top1_week',      icon: '🥇', title: '本周冠军',   desc: '在某周地图中排名第一',              check: d => d.bestRank === 1 },
  { id: 'top3_week',      icon: '🥉', title: '前三甲',     desc: '在某周地图中排名前三',              check: d => d.bestRank <= 3 && d.bestRank > 0 },
  { id: 'sweep_easy',     icon: '🌿', title: 'Easy 全清',  desc: '某周地图中赢得所有 Easy 格子',      check: d => !!d.tierSweeps.easy },
  { id: 'sweep_master',   icon: '🐉', title: 'Master 全清',desc: '某周地图中赢得所有 Master 格子',    check: d => !!d.tierSweeps.master },
];

async function buildAchievementData(userId, db) {
  // Current week totals (grid_states, no tier context)
  const curr = await db.query(
    `SELECT COUNT(*) FILTER (WHERE status='won') AS won,
            COUNT(*) FILTER (WHERE status='lost') AS lost
     FROM grid_states WHERE user_id=$1`,
    [userId]
  );
  const currWon  = parseInt(curr.rows[0]?.won)  || 0;
  const currLost = parseInt(curr.rows[0]?.lost) || 0;

  // Past weeks: per-tier aggregates
  const hist = await db.query(
    `SELECT tier,
            SUM(won)  AS won,
            SUM(lost) AS lost,
            COUNT(DISTINCT map_id) AS maps
     FROM map_week_snapshots WHERE user_id=$1 GROUP BY tier`,
    [userId]
  );
  const wonTiers = {};
  let histWon = 0, histLost = 0, weekCount = 0;
  for (const r of hist.rows) {
    wonTiers[r.tier] = parseInt(r.won) || 0;
    histWon  += parseInt(r.won)  || 0;
    histLost += parseInt(r.lost) || 0;
    weekCount = Math.max(weekCount, parseInt(r.maps) || 0);
  }

  // Best rank across all weeks
  const rankRes = await db.query(
    `WITH weekly AS (
       SELECT map_id, user_id, SUM(won) AS won
       FROM map_week_snapshots GROUP BY map_id, user_id
     ), ranked AS (
       SELECT user_id, RANK() OVER (PARTITION BY map_id ORDER BY won DESC) AS rnk
       FROM weekly
     )
     SELECT MIN(rnk) AS best FROM ranked WHERE user_id=$1`,
    [userId]
  );
  const bestRank = parseInt(rankRes.rows[0]?.best) || 999;

  // Tier sweeps (won >= total in any past map for a tier)
  const sweepRes = await db.query(
    `SELECT DISTINCT tier FROM map_week_snapshots
     WHERE user_id=$1 AND total > 0 AND won >= total`,
    [userId]
  );
  const tierSweeps = {};
  for (const r of sweepRes.rows) tierSweeps[r.tier] = true;

  return { totalWon: currWon + histWon, totalLost: currLost + histLost, wonTiers, weekCount, bestRank, tierSweeps };
}

export default async function handler(req, res) {
  const user = await authenticate(req, res);
  if (!user) return;
  const db = getPool();
  const { resource } = req.query ?? {};

  // ── Profile GET/PATCH ────────────────────────────────────────────────────
  if (resource === 'profile') {
    if (req.method === 'GET') {
      const r = await db.query(
        'SELECT username, email, display_name, avatar, role, created_at FROM users WHERE id=$1',
        [user.sub]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'not found' });
      return res.json(r.rows[0]);
    }
    if (req.method === 'PATCH') {
      const { display_name, avatar } = req.body ?? {};
      const fields = [], vals = [];
      if (display_name !== undefined) {
        const dn = String(display_name).trim().slice(0, 20);
        if (dn.length < 2 && dn.length > 0) return res.status(400).json({ error: 'display_name too short' });
        fields.push(`display_name=$${vals.push(dn || null)}`);
      }
      if (avatar !== undefined) {
        fields.push(`avatar=$${vals.push(String(avatar).slice(0, 32))}`);
      }
      if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
      vals.push(user.sub);
      await db.query(`UPDATE users SET ${fields.join(',')} WHERE id=$${vals.length}`, vals);
      return res.json({ ok: true });
    }
  }

  // ── History GET ──────────────────────────────────────────────────────────
  if (resource === 'history' && req.method === 'GET') {
    // Past weeks from snapshots
    const snap = await db.query(
      `SELECT s.map_id, s.tier, s.won, s.lost, s.total,
              m.name AS map_name, m.week_start
       FROM map_week_snapshots s
       JOIN world_maps m ON m.id = s.map_id
       WHERE s.user_id=$1
       ORDER BY m.week_start DESC`,
      [user.sub]
    );
    // Group by map
    const maps = new Map();
    for (const r of snap.rows) {
      if (!maps.has(r.map_id)) {
        maps.set(r.map_id, { map_id: r.map_id, map_name: r.map_name, week_start: r.week_start, tiers: {} });
      }
      maps.get(r.map_id).tiers[r.tier] = { won: r.won, lost: r.lost, total: r.total };
    }

    // Current week from grid_states + active map
    const mapRes = await db.query(
      'SELECT id, name, data, width, height, week_start FROM world_maps WHERE is_active=TRUE LIMIT 1'
    );
    let currentWeek = null;
    if (mapRes.rows.length) {
      const { id, name, data, width, week_start } = mapRes.rows[0];
      const mapData = JSON.parse(data);
      const gsRes = await db.query(
        'SELECT grid_x, grid_y, status FROM grid_states WHERE user_id=$1', [user.sub]
      );
      const tiers = {};
      for (const gs of gsRes.rows) {
        const v = mapData[gs.grid_y * width + gs.grid_x];
        const tier = (v >= 1 && v <= 6) ? TIER_IDS[v - 1] : null;
        if (!tier) continue;
        if (!tiers[tier]) tiers[tier] = { won: 0, lost: 0, total: 0 };
        if (gs.status === 'won')  tiers[tier].won++;
        if (gs.status === 'lost') tiers[tier].lost++;
      }
      // Count tier totals from map
      const tierTotals = {};
      for (const v of mapData) {
        if (v >= 1 && v <= 6) {
          const t = TIER_IDS[v - 1];
          tierTotals[t] = (tierTotals[t] || 0) + 1;
        }
      }
      for (const [t, total] of Object.entries(tierTotals)) {
        if (!tiers[t]) tiers[t] = { won: 0, lost: 0, total: 0 };
        tiers[t].total = total;
      }
      currentWeek = { map_id: id, map_name: name, week_start, tiers, isCurrent: true };
    }

    return res.json({ currentWeek, pastWeeks: [...maps.values()] });
  }

  // ── Achievements GET ─────────────────────────────────────────────────────
  if (resource === 'achievements' && req.method === 'GET') {
    const data = await buildAchievementData(user.sub, db);
    const results = ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(data), check: undefined }));
    return res.json({ achievements: results, stats: data });
  }

  res.status(405).end();
}
