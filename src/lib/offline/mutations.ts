import { enqueueMutation } from "./queue";

export type MutationResult =
  | { sent: true; queued: false; status: number; body: unknown }
  | { sent: false; queued: true; queuedId: number }
  | { sent: false; queued: false; status: number; body: unknown };

/**
 * Posts a JSON mutation, transparently falling back to the offline queue when
 * the device is disconnected or the request hits a network failure. Returns
 * whether the mutation was delivered synchronously or queued for replay.
 */
export async function offlineCapablePost(
  url: string,
  body: unknown,
  kind: string,
): Promise<MutationResult> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline) {
    const queuedId = await enqueueMutation({ kind, url, method: "POST", body });
    return { sent: false, queued: true, queuedId };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const payload = await res.json().catch(() => ({}));
    if (res.ok) return { sent: true, queued: false, status: res.status, body: payload };
    return { sent: false, queued: false, status: res.status, body: payload };
  } catch {
    const queuedId = await enqueueMutation({ kind, url, method: "POST", body });
    return { sent: false, queued: true, queuedId };
  }
}