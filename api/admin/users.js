import { getPool } from '../../lib/db.js';
import { authenticate } from '../../lib/auth.js';

const VALID_ROLES = ['user', 'subscriber', 'premium', 'admin'];

export default async function handler(req, res) {
  const user = await authenticate(req, res);
  if (!user) return;
  if (user.role !== 'admin') return res.status(403).json({ error: 'admin only' });

  const db = getPool();

  // GET — list all users
  if (req.method === 'GET') {
    const r = await db.query(
      `SELECT id, username, email, role, created_at, last_seen
       FROM users ORDER BY created_at DESC`
    );
    const counts = await db.query(
      `SELECT role, COUNT(*) AS count FROM users GROUP BY role`
    );
    return res.json({
      users: r.rows,
      counts: Object.fromEntries(counts.rows.map(r => [r.role, parseInt(r.count)])),
    });
  }

  // PATCH — update a user's role
  if (req.method === 'PATCH') {
    const { userId, role } = req.body ?? {};
    if (!userId || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'userId and valid role required' });
    }
    // Prevent admins from removing their own admin role
    if (String(userId) === String(user.sub) && role !== 'admin') {
      return res.status(400).json({ error: 'cannot remove your own admin role' });
    }
    await db.query('UPDATE users SET role=$1 WHERE id=$2', [role, userId]);
    return res.status(204).end();
  }

  res.status(405).end();
}
