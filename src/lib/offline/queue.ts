import {
  addQueue,
  clearQueue,
  deleteQueue,
  getAllQueue,
  getMeta,
  setMeta,
  updateQueue,
  type QueuedMutation,
} from "./db";

/**
 * Offline mutation queue for the driver PWA.
 *
 * Rule: mutations are replayed strictly in the order the driver made them
 * (FIFO by creation time). Status transitions are forward-only on the server,
 * so if a replayed action returns 409 CONFLICT the server is already at or
 * past that state - last-write-wins using server time as the tiebreaker - and
 * we drop the record instead of failing the whole flush.
 *
 * Retryable failures (network errors / 5xx / 429) keep the record pending and
 * abort the current flush; the next online event, timer tick, or manual "sync
 * now" retries them. Permanent failures (4xx) are marked `failed` so the user
 * can inspect and retry them, but they never block the rest of the queue.
 */

export type OfflineSyncState = {
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
  lastSyncAt: number | null;
};

const SYNC_TAG = "cargoflow-flush";

let state: OfflineSyncState = {
  online: true,
  pending: 0,
  failed: 0,
  syncing: false,
  lastSyncAt: null,
};

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSnapshot(): OfflineSyncState {
  return state;
}

function emit() {
  for (const fn of listeners) fn();
}

function setState(patch: Partial<OfflineSyncState>) {
  state = { ...state, ...patch };
  emit();
}

function isPermanentStatus(status: number): boolean {
  // 409 = server already advanced past this mutation (LWW) -> safe to drop.
  return status >= 400 && status < 500 && status !== 429;
}

export async function refreshCounts() {
  try {
    const all = await getAllQueue();
    const pending = all.filter((r) => r.status === "pending").length;
    const failed = all.length - pending;
    setState({ pending, failed });
  } catch {
    /* db unavailable (e.g. private mode) - keep counters as-is */
  }
}

export function setOnline(online: boolean) {
  if (state.online === online) return;
  setState({ online });
  if (online && state.pending > 0) {
    void flushQueue();
  }
}

export async function enqueueMutation(
  item: Pick<QueuedMutation, "kind" | "url" | "method" | "body" | "headers">,
): Promise<number> {
  const id = await addQueue({
    kind: item.kind,
    url: item.url,
    method: item.method,
    body: item.body,
    headers: item.headers,
    createdAt: Date.now(),
    status: "pending",
  });
  await refreshCounts();
  void registerBackgroundSync();
  return id;
}

/**
 * Tracking points are high-frequency telemetry. While offline we keep only the
 * most recent sample so the queue stays small; on reconnect the latest position
 * is replayed, which is all the dashboard needs.
 */
export async function enqueueTracking(body: unknown): Promise<void> {
  const all = await getAllQueue();
  const pending = all.filter((r) => r.kind === "tracking" && r.status === "pending");
  for (const rec of pending) {
    if (rec.id != null) await deleteQueue(rec.id);
  }
  await addQueue({
    kind: "tracking",
    url: "/api/tracking/ingest",
    method: "POST",
    body,
    createdAt: Date.now(),
    status: "pending",
  });
  await refreshCounts();
  void registerBackgroundSync();
}

export async function retryFailed(): Promise<void> {
  const all = await getAllQueue();
  for (const rec of all) {
    if (rec.status === "failed" && rec.id != null) {
      await updateQueue(rec.id, { status: "pending", error: undefined });
    }
  }
  void flushQueue();
}

export async function clearAll(): Promise<void> {
  await clearQueue();
  await refreshCounts();
}

export async function flushQueue(): Promise<{ synced: number; remaining: number; failed: number }> {
  if (state.syncing) return { synced: 0, remaining: state.pending, failed: state.failed };
  setState({ syncing: true });
  let synced = 0;
  try {
    const all = await getAllQueue();
    const items = all.filter((r) => r.status === "pending").sort((a, b) => a.createdAt - b.createdAt);
    for (const item of items) {
      if (item.id == null) continue;
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json", ...(item.headers ?? {}) },
          body: item.body != null ? JSON.stringify(item.body) : undefined,
          credentials: "same-origin",
        });
        if (res.ok) {
          await deleteQueue(item.id);
          synced += 1;
          continue;
        }
        if (isPermanentStatus(res.status)) {
          const msg = res.status === 409 ? "already applied (server ahead)" : `HTTP ${res.status}`;
          await updateQueue(item.id, { status: "failed", error: msg });
          continue;
        }
        // Retryable (network-ish / 5xx / 429): stop, retry on next flush.
        break;
      } catch {
        // Network failure: keep pending, retry on next flush.
        break;
      }
    }
    const remaining = items.length - synced;
    const failedAll = await getAllQueue();
    setState({
      syncing: false,
      pending: remaining,
      failed: failedAll.filter((r) => r.status === "failed").length,
      online: typeof navigator !== "undefined" ? navigator.onLine : state.online,
      lastSyncAt: synced > 0 ? Date.now() : state.lastSyncAt,
    });
    if (synced > 0) {
      await setMeta("lastSyncAt", Date.now());
    }
    return { synced, remaining, failed: state.failed };
  } catch {
    setState({ syncing: false });
    return { synced: 0, remaining: state.pending, failed: state.failed };
  }
}

async function registerBackgroundSync() {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync;
    if (sync) await sync.register(SYNC_TAG);
  } catch {
    /* background sync is best-effort */
  }
}

/** Restores last sync timestamp into the store on first mount (client only). */
export async function hydrateLastSync() {
  try {
    const last = await getMeta<number>("lastSyncAt");
    if (typeof last === "number") setState({ lastSyncAt: last });
  } catch {
    /* ignore */
  }
}