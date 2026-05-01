import crypto from 'crypto';
import { getPool } from '../../lib/db.js';
import { signAccess, hashToken } from '../../lib/auth.js';

const ADMIN_EMAILS = ['vegabaixuan@gmail.com'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { supabaseToken } = req.body ?? {};
  if (!supabaseToken) return res.status(400).json({ error: 'supabaseToken required' });

  // Verify the Supabase token and get the user's Google profile
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

  // Derive a username from the Google display name or email prefix
  const rawName = supaUser.user_metadata?.full_name
    || supaUser.user_metadata?.name
    || email.split('@')[0];
  const baseUsername = rawName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20);

  const db = getPool();

  // Find existing user by email, or create a new one
  let user;
  const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'user';

  const existing = await db.query(
    'SELECT id, username, role FROM users WHERE email=$1', [email]
  );

  if (existing.rows.length) {
    user = existing.rows[0];
  } else {
    let username = baseUsername;
    const taken = await db.query('SELECT 1 FROM users WHERE username=$1', [username]);
    if (taken.rows.length) {
      username = username.slice(0, 15) + '_' + crypto.randomBytes(2).toString('hex');
    }
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
