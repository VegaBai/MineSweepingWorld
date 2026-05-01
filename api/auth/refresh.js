import { getPool } from '../../lib/db.js';
import { signAccess, hashToken } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { refreshToken } = req.body ?? {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

  const db = getPool();
  const r = await db.query(
    `SELECT rt.user_id, u.username, u.role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash=$1 AND rt.expires_at > NOW()`,
    [hashToken(refreshToken)]
  );
  if (!r.rows.length) return res.status(401).json({ error: 'invalid or expired refresh token' });

  const { user_id, username, role } = r.rows[0];
  const accessToken = await signAccess({ sub: String(user_id), username, role });
  res.json({ accessToken, role });
}
