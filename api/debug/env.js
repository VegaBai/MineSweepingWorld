// Temporary diagnostic endpoint — DELETE after debugging
// Shows DB host only (no password), protected by MIGRATE_SECRET
export default function handler(req, res) {
  if (req.headers['x-migrate-secret'] !== process.env.MIGRATE_SECRET) {
    return res.status(403).end();
  }
  let dbHost = '(not set)';
  try {
    const url = new URL(process.env.MSW_POSTGRES_URL ?? '');
    dbHost = url.hostname;
  } catch {}
  res.json({
    dbHost,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV, // 'production' | 'preview' | 'development'
  });
}
