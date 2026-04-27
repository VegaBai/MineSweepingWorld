import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getPool } from '../../lib/db.js';
import { signAccess, hashToken } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  const db = getPool();
  const r = await db.query('SELECT id, username, password_hash FROM users WHERE username=$1', [username]);
  const user = r.rows[0];
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  await db.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [user.id]);

  const raw = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 86400_000);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [user.id, hashToken(raw), expires]
  );

  const accessToken = await signAccess({ sub: String(user.id), username: user.username });
  res.json({ accessToken, refreshToken: raw, username: user.username, userId: user.id });
}
