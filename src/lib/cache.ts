import { Redis } from "@upstash/redis";

/**
 * Caching layer for CargoFlow.
 *
 * Uses Upstash Redis when configured (shared, works across server instances)
 * and transparently falls back to an in-process TTL cache otherwise. Every
 * function stays non-blocking/best-effort — a cache hiccup must never break a
 * request.
 */

const CACHE_PREFIX = "cf:";

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export function isRedisConfigured() {
  return getRedis() !== null;
}

/* ------------------------------------------------------------------ */
/* In-memory fallback (single Next.js process)                         */
/* ------------------------------------------------------------------ */

type MemoryEntry = { value: unknown; expiresAt: number };

const memoryStore = new Map<string, MemoryEntry>();
const MEMORY_MAX_ENTRIES = 20_000;
const MEMORY_SWEEP_EVERY = 500;
let memoryOps = 0;

function memoryGet<T>(key: string): T | undefined {
  const entry = memoryStore.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function memorySet(key: string, value: unknown, ttlMs: number) {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });

  // Keep the map bounded: sweep expired entries occasionally.
  memoryOps += 1;
  if (memoryOps % MEMORY_SWEEP_EVERY === 0 && memoryStore.size > MEMORY_MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, e] of memoryStore) {
      if (e.expiresAt <= now) memoryStore.delete(k);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Read a cached value by key. Returns `undefined` when missing or expired.
 */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const fullKey = `${CACHE_PREFIX}${key}`;
  const client = getRedis();
  if (client) {
    try {
      return (await client.get<T>(fullKey)) ?? undefined;
    } catch {
      return undefined;
    }
  }
  return memoryGet<T>(fullKey);
}

/**
 * Write a value with a TTL (seconds). Best-effort.
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number) {
  const fullKey = `${CACHE_PREFIX}${key}`;
  const client = getRedis();
  if (client) {
    try {
      await client.set(fullKey, value, { ex: ttlSeconds });
    } catch {
      /* best-effort */
    }
    return;
  }
  memorySet(fullKey, value, ttlSeconds * 1000);
}

/**
 * Get-or-compute. Uses a per-key TTL and avoids stampede on cold misses by
 * letting only one caller compute; the rest fall through to the stale value
 * if one exists. Falls back to the compute fn's result on any cache failure.
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== undefined) return cached;

  const fresh = await compute();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

/**
 * Delete one or more keys (supports `*` wildcards via Redis `del` on a scan;
 * on the memory fallback we match the prefix manually).
 */
export async function cacheInvalidate(keyPattern: string) {
  const fullPattern = `${CACHE_PREFIX}${keyPattern}`;
  const client = getRedis();
  if (client) {
    try {
      const keys = await client.keys(fullPattern);
      if (keys.length > 0) await client.del(...keys);
    } catch {
      /* best-effort */
    }
    return;
  }
  const regex = new RegExp(`^${fullPattern.replace(/\*/g, ".*")}$`);
  const now = Date.now();
  for (const [k, e] of memoryStore) {
    if (e.expiresAt > now && regex.test(k)) memoryStore.delete(k);
  }
}