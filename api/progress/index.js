import { getPool } from '../../lib/db.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const user = await authenticate(req, res);
  if (!user) return;

  const db = getPool();
  const r = await db.query(
    `SELECT grid_x, grid_y, status,
            mines, revealed, flagged,
            flag_count, revealed_count, first_click, hit_idx, elapsed_sec
     FROM grid_states WHERE user_id=$1`,
    [user.sub]
  );

  const grids = r.rows.map(row => ({
    gx: row.grid_x,
    gy: row.grid_y,
    status:        row.status,
    mines:         row.mines    ? Buffer.from(row.mines).toString('base64')    : null,
    revealed:      row.revealed ? Buffer.from(row.revealed).toString('base64') : null,
    flagged:       row.flagged  ? Buffer.from(row.flagged).toString('base64')  : null,
    flagCount:     row.flag_count,
    revealedCount: row.revealed_count,
    firstClick:    row.first_click,
    hitIdx:        row.hit_idx,
    elapsed:       row.elapsed_sec,
  }));

  res.json({ grids });
}
