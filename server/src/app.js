import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';

import { db } from './db.js';
import authRoutes from './routes/auth.js';
import progressRoutes from './routes/progress.js';
import leaderboardRoutes from './routes/leaderboard.js';
import worldRoutes from './routes/world.js';
import wsHub from './plugins/ws.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

// ── Plugins ────────────────────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  credentials: true,
});

await app.register(jwt, {
  secret: process.env.SUPABASE_JWT_SECRET,
  sign: { expiresIn: '15m' },
});

await app.register(websocket);

// Serve static files:
//   dev  → project root  (server/src/../../  =  MineSweepingWorld/)
//   prod → /srv/public   (Dockerfile copies index.html there)
const staticRoot = process.env.STATIC_ROOT
  ?? (process.env.NODE_ENV === 'production'
      ? join(__dirname, '../../public')
      : join(__dirname, '../../'));

await app.register(staticFiles, {
  root: staticRoot,
  prefix: '/',
  decorateReply: false,
});

// ── Auth decorator ─────────────────────────────────────────────────────────
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// ── Routes ─────────────────────────────────────────────────────────────────
await app.register(wsHub);
await app.register(authRoutes,        { prefix: '/auth' });
await app.register(progressRoutes,    { prefix: '/progress' });
await app.register(leaderboardRoutes, { prefix: '/leaderboard' });
await app.register(worldRoutes,       { prefix: '/world' });

// ── Startup ────────────────────────────────────────────────────────────────
try {
  // Run migrations on startup
  const { readFileSync } = await import('fs');
  const sql = readFileSync(join(__dirname, '../migrations/001_init.sql'), 'utf8');
  await db.query(sql);

  const port = parseInt(process.env.PORT ?? '3000');
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
