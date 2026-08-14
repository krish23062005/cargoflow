import { Redis } from "@upstash/redis";

/**
 * Realtime hub, keyed by organization.
 *
 * When Upstash Redis is configured, this becomes a true distributed hub:
 * publishers broadcast to a shared Redis channel and every server instance's
 * local subscriber set receives the event. Without Redis it degrades to a
 * single-process in-memory hub (dev/demo).
 *
 * Architecture:
 *   broadcast → local subscribers + publish to Redis channel
 *   bridge (subscribe to Redis channel) → forward into local subscribers
 */

type Subscriber = (event: string, data: unknown) => void;

const subscribersByOrg = new Map<string, Set<Subscriber>>();

/* ------------------------------------------------------------------ */
/* Redis plumbing                                                      */
/* ------------------------------------------------------------------ */

const REDIS_CHANNEL = "cf:org:events";

let redis: Redis | null | undefined;
let bridgeStarted = false;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/**
 * Bridge Redis → local subscribers. Started once on first subscribe and kept
 * alive; forwards every published org event into this instance's in-memory
 * sets. Upstash REST subscriptions reconnect automatically.
 */
function ensureBridge() {
  const client = getRedis();
  if (!client || bridgeStarted) return;
  bridgeStarted = true;

  const subscriber = client.subscribe(REDIS_CHANNEL);
  subscriber.on("message", (event) => {
    try {
      const msg = JSON.parse(String(event.message)) as {
        orgId: string;
        event: string;
        payload: unknown;
      };
      dispatchToLocal(msg.orgId, msg.event, msg.payload);
    } catch {
      /* ignore malformed payloads */
    }
  });
}

function dispatchToLocal(orgId: string, event: string, data: unknown) {
  const set = subscribersByOrg.get(orgId);
  if (!set) return;
  for (const subscriber of set) {
    try {
      subscriber(event, data);
    } catch {
      removeSubscriber(orgId, subscriber);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function removeSubscriber(orgId: string, subscriber: Subscriber) {
  const set = subscribersByOrg.get(orgId);
  if (!set) return;
  set.delete(subscriber);
  if (set.size === 0) subscribersByOrg.delete(orgId);
}

/** Subscribe to org-wide realtime events. Returns an unsubscribe fn. */
export function subscribeToOrg(orgId: string, subscriber: Subscriber): () => void {
  let set = subscribersByOrg.get(orgId);
  if (!set) {
    set = new Set();
    subscribersByOrg.set(orgId, set);
  }
  set.add(subscriber);
  ensureBridge();
  return () => removeSubscriber(orgId, subscriber);
}

/** Push an event to every listener of an organization. */
export function broadcastToOrg(orgId: string, event: string, data: unknown) {
  // Always deliver to local listeners first (covers both single-process and
  // the instance that originated the event in a multi-instance deployment).
  dispatchToLocal(orgId, event, data);

  // Then publish to Redis so the bridge on every other instance delivers it
  // to their local subscriber sets.
  const client = getRedis();
  if (!client) return;
  void client
    .publish(REDIS_CHANNEL, JSON.stringify({ orgId, event, payload: data }))
    .catch(() => {
      /* best-effort publish */
    });
}