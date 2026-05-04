import { getPool } from '../lib/db.js';
import { authenticate } from '../lib/auth.js';

const TIER_IDS = ['easy', 'normal', 'medium', 'hard', 'expert', 'master'];

async function getSettings(db) {
  const r = await db.query(
    "SELECT key, value FROM game_settings WHERE key LIKE 'illuminate_%' OR key = 'life_regen_minutes'"
  );
  const s = {};
  for (const { key, value } of r.rows) s[key] = value;
  return s;
}

async function getCredits(userId, db) {
  const r = await db.query(
    'SELECT tier, credits FROM illuminate_credits WHERE user_id = $1', [userId]
  );
  const credits = {};
  for (const id of TIER_IDS) credits[id] = 0;
  for (const { tier, credits: c } of r.rows) credits[tier] = parseInt(c);
  return credits;
}

export default async function handler(req, res) {
  const db = getPool();
  const { action } = req.query ?? {};

  // Public: returns illuminate ratios and life regen time (no auth needed)
  if (req.method === 'GET' && action === 'settings') {
    const s = await getSettings(db);
    const illuminateRatios = {};
    for (const tier of ['master', 'expert', 'hard', 'medium', 'normal']) {
      const raw = s[`illuminate_${tier}`];
      illuminateRatios[tier] = raw ? JSON.parse(raw) : {};
    }
    return res.json({
      illuminateRatios,
      lifeRegenMinutes: parseInt(s['life_regen_minutes'] ?? '15'),
    });
  }

  const user = await authenticate(req, res);
  if (!user) return;

  if (req.method === 'GET' && action === 'credits') {
    return res.json({ credits: await getCredits(user.sub, db) });
  }

  if (req.method === 'POST' && action === 'award') {
    const { tier } = req.body ?? {};
    if (!TIER_IDS.includes(tier)) return res.status(400).json({ error: 'invalid tier' });
    const s = await getSettings(db);
    const rawAwards = s[`illuminate_${tier}`];
    if (!rawAwards) return res.json({ credits: await getCredits(user.sub, db), awarded: {} });
    const awards = JSON.parse(rawAwards);
    for (const [awardTier, amount] of Object.entries(awards)) {
      if (amount > 0) {
        await db.query(
          `INSERT INTO illuminate_credits (user_id, tier, credits) VALUES ($1,$2,$3)
           ON CONFLICT (user_id, tier) DO UPDATE SET credits = illuminate_credits.credits + $3`,
          [user.sub, awardTier, amount]
        );
      }
    }
    return res.json({ credits: await getCredits(user.sub, db), awarded: awards });
  }

  if (req.method === 'POST' && action === 'spend') {
    const { tier, gx, gy } = req.body ?? {};
    if (!TIER_IDS.includes(tier) || typeof gx !== 'number' || typeof gy !== 'number') {
      return res.status(400).json({ error: 'tier, gx, gy required' });
    }
    // Check credit exists
    const creditCheck = await db.query(
      'SELECT credits FROM illuminate_credits WHERE user_id=$1 AND tier=$2', [user.sub, tier]
    );
    if (!creditCheck.rows.length || creditCheck.rows[0].credits <= 0) {
      return res.status(400).json({ error: 'insufficient credits' });
    }
    // Check grid not already won
    const gridCheck = await db.query(
      'SELECT status FROM grid_states WHERE user_id=$1 AND grid_x=$2 AND grid_y=$3',
      [user.sub, gx, gy]
    );
    if (gridCheck.rows.length && gridCheck.rows[0].status === 'won') {
      return res.status(400).json({ error: 'grid already won' });
    }
    // Atomic decrement
    const r = await db.query(
      `UPDATE illuminate_credits SET credits = credits - 1
       WHERE user_id=$1 AND tier=$2 AND credits > 0 RETURNING credits`,
      [user.sub, tier]
    );
    if (!r.rows.length) return res.status(400).json({ error: 'insufficient credits' });
    // Mark grid as won
    await db.query(
      `INSERT INTO grid_states (user_id, grid_x, grid_y, status, first_click)
       VALUES ($1,$2,$3,'won',FALSE)
       ON CONFLICT (user_id, grid_x, grid_y) DO UPDATE SET status='won', updated_at=NOW()`,
      [user.sub, gx, gy]
    );
    return res.json({ ok: true, credits: await getCredits(user.sub, db) });
  }

  res.status(405).end();
}
