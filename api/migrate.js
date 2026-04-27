import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../lib/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// One-time migration endpoint — protect with a secret to prevent public access
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-migrate-secret'] !== process.env.MIGRATE_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const sql = readFileSync(join(__dirname, '../server/migrations/001_init.sql'), 'utf8');
  const db = getPool();
  await db.query(sql);
  res.json({ ok: true });
}
