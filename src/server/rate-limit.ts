import { Redis } from "@upstash/redis";

/**
 * Sliding-window rate limiter.
 *
 * Uses Upstash Redis when configured so limits hold across every server
 * instance (production). Falls back to an in-process fixed-window limiter for
 * single-process dev/demo — functionally equivalent, just not shared.
 */

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

const RATE_LIMIT_PREFIX = "cf:rl:";

/**
 * Windowed limiter keyed by any string (IP, user id, composite). Returns
 * whether the caller may proceed and how long to wait otherwise.
 *
 * Redis path uses a Lua script for an atomic sliding window:
 *   - trim the sorted set to the window,
 *   - count remaining entries,
 *   - if under the max, add the current millisecond and set the TTL.
 */
const LUA_WINDOW = /* lua */ `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local floor = now - window
redis.call('ZREMRANGEBYSCORE', key, 0, floor)
local count = redis.call('ZCARD', key)
if count < max then
  redis.call('ZADD', key, now, now)
  redis.call('PEXPIRE', key, window)
  return { 1, count + 1, 0 }
end
local ttl = redis.call('PTTL', key)
return { 0, count, ttl }
`;

export async function checkWindowRateLimit(
  key: string,
  windowMs: number,
  max: number,
  maxBuckets = 10_000,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const client = getRedis();
  if (client) {
    try {
      const res = await client.eval<[number, number, number]>(
        LUA_WINDOW,
        [`${RATE_LIMIT_PREFIX}${key}`],
        [Date.now(), windowMs, max],
      );
      const [ok, , ttlMs] = Array.isArray(res) ? res : [0, 0, 0];
      return {
        ok: ok === 1,
        retryAfterSec: Math.max(1, Math.ceil((ttlMs ?? 0) / 1000)),
      };
    } catch {
      // Redis unreachable — fail open so an outage never blocks the app.
      return { ok: true, retryAfterSec: 0 };
    }
  }
  return checkMemoryRateLimit(key, windowMs, max, maxBuckets);
}

/* ------------------------------------------------------------------ */
/* In-memory fallback (single process)                                 */
/* ------------------------------------------------------------------ */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function checkMemoryRateLimit(
  key: string,
  windowMs: number,
  max: number,
  maxBuckets = MAX_BUCKETS,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();

  const bucket = buckets.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > maxBuckets) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return { ok: bucket.count <= max, retryAfterSec };
}

const PORTAL_WINDOW_MS = 10 * 60_000;
const PORTAL_MAX_PER_WINDOW = 60;

/**
 * Public portal anti-scrape limiter. Keyed per (client IP, tracking number) so
 * a scraper hammering one shipment (or many shipments from one IP) gets
 * throttled without hurting other users.
 */
export async function checkRateLimit(
  ip: string,
  trackingNumber: string,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  return checkWindowRateLimit(
    `${ip}:${trackingNumber.toUpperCase()}`,
    PORTAL_WINDOW_MS,
    PORTAL_MAX_PER_WINDOW,
  );
}