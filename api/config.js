// Returns public client-side config so we don't hard-code keys in index.html
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  res.json({
    supabaseUrl:     process.env.MSW_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_MSW_SUPABASE_ANON_KEY,
  });
}
