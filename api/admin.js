import { getPool } from '../lib/db.js';
import { authenticate } from '../lib/auth.js';

const VALID_ROLES = ['user', 'subscriber', 'premium', 'admin'];

async function handleUsers(req, res, user, db) {
  if (req.method === 'GET') {
    const r = await db.query(
      'SELECT id, username, email, role, created_at, last_seen FROM users ORDER BY created_at DESC'
    );
    const counts = await db.query('SELECT role, COUNT(*) AS count FROM users GROUP BY role');
    return res.json({
      users: r.rows,
      counts: Object.fromEntries(counts.rows.map(r => [r.role, parseInt(r.count)])),
    });
  }
  if (req.method === 'PATCH') {
    const { userId, role } = req.body ?? {};
    if (!userId || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'userId and valid role required' });
    }
    if (String(userId) === String(user.sub) && role !== 'admin') {
      return res.status(400).json({ error: 'cannot remove your own admin role' });
    }
    await db.query('UPDATE users SET role=$1 WHERE id=$2', [role, userId]);
    return res.status(204).end();
  }
  res.status(405).end();
}

async function handleWorldmap(req, res, user, db) {
  if (req.method === 'GET') {
    const { id } = req.query ?? {};
    if (id) {
      const r = await db.query(
        'SELECT id, name, data, width, height, is_active, created_at FROM world_maps WHERE id = $1',
        [id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'not found' });
      const row = r.rows[0];
      row.data = JSON.parse(row.data);
      return res.json({ map: row });
    }
    const r = await db.query(
      'SELECT id, name, width, height, is_active, created_at FROM world_maps ORDER BY created_at DESC'
    );
    return res.json({ maps: r.rows });
  }
  if (req.method === 'POST') {
    const { name, data, width = 20, height = 16 } = req.body ?? {};
    if (!name || !data) return res.status(400).json({ error: 'name and data required' });
    const r = await db.query(
      `INSERT INTO world_maps (name, data, width, height, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, width, height, is_active, created_at`,
      [name, JSON.stringify(data), width, height, user.sub]
    );
    return res.status(201).json({ map: r.rows[0] });
  }
  if (req.method === 'PATCH') {
    const { id, is_active } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required' });
    if (is_active) {
      await db.query('UPDATE world_maps SET is_active = FALSE');
      await db.query('UPDATE world_maps SET is_active = TRUE WHERE id = $1', [id]);
    } else {
      await db.query('UPDATE world_maps SET is_active = FALSE WHERE id = $1', [id]);
    }
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required' });
    await db.query('DELETE FROM world_maps WHERE id = $1', [id]);
    return res.json({ ok: true });
  }
  res.status(405).end();
}

export default async function handler(req, res) {
  const user = await authenticate(req, res);
  if (!user) return;
  if (user.role !== 'admin') return res.status(403).json({ error: 'admin only' });

  const db = getPool();
  const { resource } = req.query ?? {};

  if (resource === 'users')    return handleUsers(req, res, user, db);
  if (resource === 'worldmap') return handleWorldmap(req, res, user, db);
  res.status(404).json({ error: 'unknown resource' });
}
