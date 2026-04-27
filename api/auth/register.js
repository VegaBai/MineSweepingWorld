import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getPool } from '../../lib/db.js';
import { signAccess, hashToken } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'username must be 3-20 alphanumeric/underscore chars' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'password too short' });

  const db = getPool();
  const hash = await bcrypt.hash(password, 10);

  let user;
  try {
    const r = await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1,$2) RETURNING id, username',
      [username, hash]
    );
    user = r.rows[0];
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'username taken' });
    throw e;
  }

  const raw = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 86400_000);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [user.id, hashToken(raw), expires]
  );

  const accessToken = await signAccess({ sub: String(user.id), username: user.username });
  res.status(201).json({ accessToken, refreshToken: raw, username: user.username, userId: user.id });
}
