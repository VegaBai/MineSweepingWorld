import { getPool } from '../../../lib/db.js';
import { authenticate } from '../../../lib/auth.js';

export default async function handler(req, res) {
  const user = await authenticate(req, res);
  if (!user) return;

  const gx = parseInt(req.query.x, 10);
  const gy = parseInt(req.query.y, 10);
  if (isNaN(gx) || isNaN(gy) || gx < 0 || gy < 0 || gx > 999 || gy > 999) {
    return res.status(400).json({ error: 'invalid coordinates' });
  }

  const db = getPool();

  if (req.method === 'PUT') {
    const {
      status,
      mines, revealed, flagged,
      flagCount = 0, revealedCount = 0,
      firstClick = true, hitIdx = -1, elapsed = 0,
    } = req.body ?? {};

    await db.query(
      `INSERT INTO grid_states
         (user_id, grid_x, grid_y, status, mines, revealed, flagged,
          flag_count, revealed_count, first_click, hit_idx, elapsed_sec, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (user_id, grid_x, grid_y) DO UPDATE SET
         status=$4, mines=$5, revealed=$6, flagged=$7,
         flag_count=$8, revealed_count=$9, first_click=$10,
         hit_idx=$11, elapsed_sec=$12, updated_at=NOW()`,
      [
        user.sub, gx, gy, status,
        mines    ? Buffer.from(mines,    'base64') : null,
        revealed ? Buffer.from(revealed, 'base64') : null,
        flagged  ? Buffer.from(flagged,  'base64') : null,
        flagCount, revealedCount, firstClick, hitIdx, elapsed,
      ]
    );

    return res.status(204).end();
  }

  if (req.method === 'DELETE') {
    await db.query(
      'DELETE FROM grid_states WHERE user_id=$1 AND grid_x=$2 AND grid_y=$3',
      [user.sub, gx, gy]
    );
    return res.status(204).end();
  }

  res.status(405).end();
}
