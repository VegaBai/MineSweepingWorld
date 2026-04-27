import { db } from '../db.js';

// Uint8Array ↔ base64 helpers (client sends base64, we store BYTEA)
const b64toBuf = (s) => s ? Buffer.from(s, 'base64') : null;
const bufToB64 = (b) => b ? b.toString('base64') : null;

function validateCoords(x, y, worldW, worldH) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < worldW && y >= 0 && y < worldH;
}

const WORLD_W = 50, WORLD_H = 50;

export default async function progressRoutes(app) {
  // ── GET all grid states for the current user ───────────────────────────
  app.get('/', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await db.query(
      `SELECT grid_x, grid_y, status,
              mines, revealed, flagged,
              flag_count, revealed_count, first_click, hit_idx, elapsed_sec
       FROM grid_states WHERE user_id=$1`,
      [req.user.sub],
    );
    return rows.map(r => ({
      gx: r.grid_x, gy: r.grid_y,
      status:         r.status,
      mines:          bufToB64(r.mines),
      revealed:       bufToB64(r.revealed),
      flagged:        bufToB64(r.flagged),
      flagCount:      r.flag_count,
      revealedCount:  r.revealed_count,
      firstClick:     r.first_click,
      hitIdx:         r.hit_idx,
      elapsed:        r.elapsed_sec,
    }));
  });

  // ── PUT save / update a single grid ───────────────────────────────────
  app.put('/:x/:y', {
    preHandler: [app.authenticate],
    schema: {
      params: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } } },
      body: {
        type: 'object', required: ['status'],
        properties: {
          status:        { type: 'string', enum: ['active', 'won', 'lost'] },
          mines:         { type: 'string' },
          revealed:      { type: 'string' },
          flagged:       { type: 'string' },
          flagCount:     { type: 'integer' },
          revealedCount: { type: 'integer' },
          firstClick:    { type: 'boolean' },
          hitIdx:        { type: 'integer' },
          elapsed:       { type: 'integer' },
        },
      },
    },
  }, async (req, reply) => {
    const gx = parseInt(req.params.x), gy = parseInt(req.params.y);
    if (!validateCoords(gx, gy, WORLD_W, WORLD_H)) {
      return reply.status(400).send({ error: 'Coordinates out of bounds' });
    }

    const { status, mines, revealed, flagged,
            flagCount = 0, revealedCount = 0,
            firstClick = true, hitIdx = -1, elapsed = 0 } = req.body;

    await db.query(`
      INSERT INTO grid_states
        (user_id, grid_x, grid_y, status, mines, revealed, flagged,
         flag_count, revealed_count, first_click, hit_idx, elapsed_sec, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
      ON CONFLICT (user_id, grid_x, grid_y) DO UPDATE SET
        status=$4, mines=$5, revealed=$6, flagged=$7,
        flag_count=$8, revealed_count=$9, first_click=$10,
        hit_idx=$11, elapsed_sec=$12, updated_at=NOW()
    `, [
      req.user.sub, gx, gy, status,
      b64toBuf(mines), b64toBuf(revealed), b64toBuf(flagged),
      flagCount, revealedCount, firstClick, hitIdx, elapsed,
    ]);

    // Notify WebSocket hub when a grid is won
    if (status === 'won') {
      app.wsHub.broadcast({ type: 'grid_won', gx, gy, username: req.user.username });
    }

    return { ok: true };
  });

  // ── DELETE reset a grid (used by Restart) ─────────────────────────────
  app.delete('/:x/:y', {
    preHandler: [app.authenticate],
    schema: { params: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } } } },
  }, async (req, reply) => {
    const gx = parseInt(req.params.x), gy = parseInt(req.params.y);
    if (!validateCoords(gx, gy, WORLD_W, WORLD_H)) {
      return reply.status(400).send({ error: 'Coordinates out of bounds' });
    }
    await db.query(
      'DELETE FROM grid_states WHERE user_id=$1 AND grid_x=$2 AND grid_y=$3',
      [req.user.sub, gx, gy],
    );
    return { ok: true };
  });
}
