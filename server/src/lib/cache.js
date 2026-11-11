import Redis from 'ioredis';
import { config } from '../config.js';

/**
 * Optional Redis cache for report results. When REDIS_URL is not set (or Redis is
 * unreachable) every call is a harmless no-op, so the app works without Redis.
 */
let client = null;

export function getRedis() {
  if (!config.redisUrl) return null;
  if (!client) {
    client = new Redis(config.redisUrl, { maxRetriesPerRequest: 1 });
    client.on('error', () => {}); // degrade silently; calls below catch failures
  }
  return client;
}

export async function cacheGet(key) {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttl = config.reportCacheTtl) {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    /* ignore */
  }
}

/** Drop every cached report for one patient (called whenever a reading changes). */
export async function invalidateReports(userId) {
  const r = getRedis();
  if (!r) return;
  try {
    const stream = r.scanStream({ match: `report:${userId}:*`, count: 100 });
    for await (const keys of stream) {
      if (keys.length) await r.unlink(keys);
    }
  } catch {
    /* ignore */
  }
}

export const reportKey = (userId, type, date) => `report:${userId}:${type}:${date}`;

export async function closeRedis() {
  if (client) await client.quit().catch(() => {});
  client = null;
}
