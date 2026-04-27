import Redis from 'ioredis';
import 'dotenv/config';

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  redis.on('error', (err) => {
    // Non-fatal: presence features degrade gracefully without Redis
    console.warn('[redis] connection error (presence features disabled):', err.message);
  });
}

export { redis };
