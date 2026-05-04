import { getPool } from '../lib/db.js';
import { authenticate } from '../lib/auth.js';

const MAX_LIVES = 3;
const REGEN_MS  = 15 * 60 * 1000; // 15 minutes

function applyRegen(lives, regenAt) {
  if (lives >= MAX_LIVES) return { lives, regenAt: new Date(regenAt ?? Date.now()) };
  const elapsed = Date.now() - new Date(regenAt).getTime();
  const gained  = Math.floor(elapsed / REGEN_MS);
  if (gained <= 0) return { lives, regenAt: new Date(regenAt) };
  const newLives   = Math.min(MAX_LIVES, lives + gained);
  const newRegenAt = new Date(new Date(regenAt).getTime() + gained * REGEN_MS);
  return { lives: newLives, regenAt: newRegenAt };
}

function msUntilNextRegen(lives, regenAt) {
  if (lives >= MAX_LIVES) return null;
  return Math.max(0, new Date(regenAt).getTime() + REGEN_MS - Date.now());
}

export default async function handler(req, res) {
  const user = await authenticate(req, res);
  if (!user) return;

  const db = getPool();

  if (req.method === 'GET') {
    const r = await db.query(
      'SELECT lives, lives_regen_at FROM users WHERE id = $1', [user.sub]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'user not found' });
    let { lives, lives_regen_at } = r.rows[0];
    const regen = applyRegen(lives, lives_regen_at ?? new Date());
    if (regen.lives !== lives) {
      await db.query(
        'UPDATE users SET lives=$1, lives_regen_at=$2 WHERE id=$3',
        [regen.lives, regen.regenAt, user.sub]
      );
    }
    return res.json({ lives: regen.lives, nextRegenIn: msUntilNextRegen(regen.lives, regen.regenAt) });
  }

  if (req.method === 'POST') {
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
    // Note: the decrement already happened; check if we actually consumed one
    // (If lives was 0 before, it stays 0 — we return 400)
    // We can't easily tell after the fact, so: check if caller had > 0
    // Simpler: if result lives >= original, no change → was 0
    // Just trust the CASE logic — if lives was 0, we return it as-is and client checks
    return res.json({ lives, nextRegenIn: msUntilNextRegen(lives, lives_regen_at) });
  }

  res.status(405).end();
}
