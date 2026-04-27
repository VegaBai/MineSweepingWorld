import { getPool } from '../../lib/db.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const user = await authenticate(req, res);
  if (!user) return;

  const db = getPool();
  const r = await db.query(
    'SELECT gx, gy, status, mines, revealed, flagged, updated_at FROM grid_states WHERE user_id=$1',
    [user.sub]
  );

  const grids = r.rows.map(row => ({
    gx: row.gx,
    gy: row.gy,
    status: row.status,
    mines:    row.mines    ? Buffer.from(row.mines).toString('base64')    : null,
    revealed: row.revealed ? Buffer.from(row.revealed).toString('base64') : null,
    flagged:  row.flagged  ? Buffer.from(row.flagged).toString('base64')  : null,
    updatedAt: row.updated_at,
  }));

  res.json({ grids });
}
