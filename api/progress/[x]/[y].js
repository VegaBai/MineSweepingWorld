import { getPool } from '../../../lib/db.js';
import { authenticate } from '../../../lib/auth.js';

const WORLD_W = 20;
const WORLD_H = 16;

export default async function handler(req, res) {
  const user = await authenticate(req, res);
  if (!user) return;

  const gx = parseInt(req.query.x, 10);
  const gy = parseInt(req.query.y, 10);
  if (isNaN(gx) || isNaN(gy) || gx < 0 || gx >= WORLD_W || gy < 0 || gy >= WORLD_H) {
    return res.status(400).json({ error: 'invalid coordinates' });
  }

  const db = getPool();

  if (req.method === 'PUT') {
    const { status, mines, revealed, flagged } = req.body ?? {};
    const minesBuf    = mines    ? Buffer.from(mines,    'base64') : null;
    const revealedBuf = revealed ? Buffer.from(revealed, 'base64') : null;
    const flaggedBuf  = flagged  ? Buffer.from(flagged,  'base64') : null;

    await db.query(
      `INSERT INTO grid_states (user_id, gx, gy, status, mines, revealed, flagged)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, gx, gy)
       DO UPDATE SET status=$4, mines=$5, revealed=$6, flagged=$7, updated_at=NOW()`,
      [user.sub, gx, gy, status, minesBuf, revealedBuf, flaggedBuf]
    );

    return res.status(204).end();
  }

  if (req.method === 'DELETE') {
    await db.query('DELETE FROM grid_states WHERE user_id=$1 AND gx=$2 AND gy=$3', [user.sub, gx, gy]);
    return res.status(204).end();
  }

  res.status(405).end();
}
