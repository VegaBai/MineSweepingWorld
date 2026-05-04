import { getPool } from '../lib/db.js';
import { authenticate } from '../lib/auth.js';

const MAX_LIVES = 3;

async function getRegenMs(db) {
  try {
    const r = await db.query("SELECT value FROM game_settings WHERE key='life_regen_minutes'");
    if (r.rows.length) return parseInt(r.rows[0].value) * 60 * 1000;
  } catch {}
  return 15 * 60 * 1000;
}

function applyRegen(lives, regenAt, regenMs) {
  if (lives >= MAX_LIVES) return { lives, regenAt: new Date(regenAt ?? Date.now()) };
  const elapsed = Date.now() - new Date(regenAt).getTime();
  const gained  = Math.floor(elapsed / regenMs);
  if (gained <= 0) return { lives, regenAt: new Date(regenAt) };
  const newLives   = Math.min(MAX_LIVES, lives + gained);
  const newRegenAt = new Date(new Date(regenAt).getTime() + gained * regenMs);
  return { lives: newLives, regenAt: newRegenAt };
}

function msUntilNextRegen(lives, regenAt, regenMs) {
  if (lives >= MAX_LIVES) return null;
  return Math.max(0, new Date(regenAt).getTime() + regenMs - Date.now());
}

export default async function handler(req, res) {
  const user = await authenticate(req, res);
  if (!user) return;

  const db = getPool();

  if (req.method === 'GET') {
    const regenMs = await getRegenMs(db);
    const r = await db.query(
      'SELECT lives, lives_regen_at FROM users WHERE id = $1', [user.sub]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'user not found' });
    let { lives, lives_regen_at } = r.rows[0];
    const regen = applyRegen(lives, lives_regen_at ?? new Date(), regenMs);
    if (regen.lives !== lives) {
      await db.query(
        'UPDATE users SET lives=$1, lives_regen_at=$2 WHERE id=$3',
        [regen.lives, regen.regenAt, user.sub]
      );
    }
    return res.json({ lives: regen.lives, nextRegenIn: msUntilNextRegen(regen.lives, regen.regenAt, regenMs) });
  }

  if (req.method === 'POST') {
    const regenMs = await getRegenMs(db);
    // Consume 1 life (atomic: only decrement if lives > 0)
    const r = await db.query(
      `UPDATE users SET
         lives = CASE
           WHEN lives > 0 THEN lives - 1
           ELSE lives
         END,
         lives_regen_at = CASE
           WHEN lives = $2 AND lives > 0 THEN NOW()  -- start regen clock when dropping from MAX
           ELSE lives_regen_at
         END
       WHERE id = $1
       RETURNING lives, lives_regen_at`,
      [user.sub, MAX_LIVES]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'user not found' });
    const { lives, lives_regen_at } = r.rows[0];
    return res.json({ lives, nextRegenIn: msUntilNextRegen(lives, lives_regen_at, regenMs) });
  }

  res.status(405).end();
}
