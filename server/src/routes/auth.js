import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db.js';

const USERNAME_RE = /^[A-Za-z0-9_\-]{2,20}$/;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createRefreshToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES ($1,$2,$3)',
    [hashToken(token), userId, expiresAt],
  );
  return token;
}

export default async function authRoutes(app) {
  // ── Register ───────────────────────────────────────────────────────────
  app.post('/register', {
    schema: {
      body: {
        type: 'object', required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string', minLength: 6 },
          email:    { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { username, password, email } = req.body;

    if (!USERNAME_RE.test(username)) {
      return reply.status(400).send({ error: 'Username must be 2–20 alphanumeric/underscore characters' });
    }

    const clash = await db.query(
      'SELECT id FROM users WHERE username=$1 OR (email IS NOT NULL AND email=$2)',
      [username, email ?? ''],
    );
    if (clash.rows.length > 0) {
      return reply.status(409).send({ error: 'Username or email already taken' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3) RETURNING id, username',
      [username, email ?? null, password_hash],
    );
    const user = rows[0];

    const accessToken  = app.jwt.sign({ sub: user.id, username: user.username });
    const refreshToken = await createRefreshToken(user.id);
    return reply.status(201).send({ accessToken, refreshToken, username: user.username, userId: user.id });
  });

  // ── Login ──────────────────────────────────────────────────────────────
  app.post('/login', {
    schema: {
      body: {
        type: 'object', required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { username, password } = req.body;

    const { rows } = await db.query(
      'SELECT id, username, password_hash FROM users WHERE username=$1',
      [username],
    );
    if (rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user  = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    await db.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [user.id]);

    const accessToken  = app.jwt.sign({ sub: user.id, username: user.username });
    const refreshToken = await createRefreshToken(user.id);
    return { accessToken, refreshToken, username: user.username, userId: user.id };
  });

  // ── Refresh access token ───────────────────────────────────────────────
  app.post('/refresh', {
    schema: { body: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } } },
  }, async (req, reply) => {
    const { rows } = await db.query(
      `SELECT rt.user_id, u.username
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash=$1 AND rt.expires_at > NOW()`,
      [hashToken(req.body.refreshToken)],
    );
    if (rows.length === 0) return reply.status(401).send({ error: 'Invalid or expired refresh token' });

    const { user_id, username } = rows[0];
    const accessToken = app.jwt.sign({ sub: user_id, username });
    return { accessToken };
  });

  // ── Logout ─────────────────────────────────────────────────────────────
  app.delete('/logout', {
    schema: { body: { type: 'object', properties: { refreshToken: { type: 'string' } } } },
  }, async (req, reply) => {
    if (req.body?.refreshToken) {
      await db.query('DELETE FROM refresh_tokens WHERE token_hash=$1', [hashToken(req.body.refreshToken)]);
    }
    return { ok: true };
  });
}
