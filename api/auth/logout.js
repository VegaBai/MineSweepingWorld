import { getPool } from '../../lib/db.js';
import { hashToken } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { refreshToken } = req.body ?? {};
  if (refreshToken) {
    const db = getPool();
    await db.query('DELETE FROM refresh_tokens WHERE token_hash=$1', [hashToken(refreshToken)]);
  }
  res.status(204).end();
}
