import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { db } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '../migrations/001_init.sql'), 'utf8');

try {
  await db.query(sql);
  console.log('[migrate] schema up to date');
} catch (err) {
  console.error('[migrate] failed:', err.message);
  process.exit(1);
} finally {
  await db.end();
}
