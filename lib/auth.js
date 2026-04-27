import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);

export async function signAccess(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(secret());
}

export async function verifyAccess(token) {
  const { payload } = await jwtVerify(token, secret());
  return payload;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function bearerToken(req) {
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function authenticate(req, res) {
  const token = bearerToken(req);
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  try {
    return await verifyAccess(token);
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}
