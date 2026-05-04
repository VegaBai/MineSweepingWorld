import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getPool } from '../lib/db.js';
import { signAccess, hashToken } from '../lib/auth.js';

const ADMIN_EMAILS = ['vegabaixuan@gmail.com'];

async function handleRegister(req, res) {
  const { username, password, email } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'username must be 3-20 alphanumeric/underscore chars' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'password too short' });

  const db = getPool();
  const hash = await bcrypt.hash(password, 10);
  const role = ADMIN_EMAILS.includes(email?.toLowerCase()) ? 'admin' : 'user';

  let user;
  try {
    const r = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, username, role',
      [username, email ?? null, hash, role]
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

  const accessToken = await signAccess({ sub: String(user.id), username: user.username, role: user.role });
  res.status(201).json({ accessToken, refreshToken: raw, username: user.username, userId: user.id, role: user.role });
}

async function handleLogin(req, res) {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  const db = getPool();
  const r = await db.query('SELECT id, username, password_hash, role FROM users WHERE username=$1', [username]);
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

  const accessToken = await signAccess({ sub: String(user.id), username: user.username, role: user.role });
  res.json({ accessToken, refreshToken: raw, username: user.username, userId: user.id, role: user.role });
}

async function handleLogout(req, res) {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) {
    const db = getPool();
    await db.query('DELETE FROM refresh_tokens WHERE token_hash=$1', [hashToken(refreshToken)]);
  }
  res.status(204).end();
}

async function handleRefresh(req, res) {
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

async function handleGoogle(req, res) {
  const { supabaseToken } = req.body ?? {};
  if (!supabaseToken) return res.status(400).json({ error: 'supabaseToken required' });

  const supaRes = await fetch(`${process.env.MSW_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${supabaseToken}`,
      apikey: process.env.NEXT_PUBLIC_MSW_SUPABASE_ANON_KEY,
    },
  });
  if (!supaRes.ok) return res.status(401).json({ error: 'invalid supabase token' });

  const supaUser = await supaRes.json();
  const email = supaUser.email;
  if (!email) return res.status(400).json({ error: 'no email on google account' });

  const rawName = supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || email.split('@')[0];
  const baseUsername = rawName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20);

  const db = getPool();
  const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'user';

  let user;
  const existing = await db.query('SELECT id, username, role FROM users WHERE email=$1', [email]);
  if (existing.rows.length) {
    user = existing.rows[0];
  } else {
    let username = baseUsername;
    const taken = await db.query('SELECT 1 FROM users WHERE username=$1', [username]);
    if (taken.rows.length) username = username.slice(0, 15) + '_' + crypto.randomBytes(2).toString('hex');
    const r = await db.query(
      'INSERT INTO users (username, email, role) VALUES ($1,$2,$3) RETURNING id, username, role',
      [username, email, role]
    );
    user = r.rows[0];
  }

  const raw = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 86400_000);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [user.id, hashToken(raw), expires]
  );

  const accessToken = await signAccess({ sub: String(user.id), username: user.username, role: user.role });
  res.json({ accessToken, refreshToken: raw, username: user.username, userId: user.id, role: user.role });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { action } = req.query ?? {};
  if (action === 'register') return handleRegister(req, res);
  if (action === 'login')    return handleLogin(req, res);
  if (action === 'logout')   return handleLogout(req, res);
  if (action === 'refresh')  return handleRefresh(req, res);
  if (action === 'google')   return handleGoogle(req, res);
  res.status(404).json({ error: 'unknown action' });
}
