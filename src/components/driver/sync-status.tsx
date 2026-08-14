"use client";

import { useOfflineSync } from "./use-offline-sync";

/**
 * Floating sync status pill shown above the bottom navigation. Summarises
 * connectivity, queued work, and last successful sync. Tapping it forces a
 * flush immediately.
 */
export function SyncStatus() {
  const { online, pending, failed, syncing, lastSyncAt, flush } = useOfflineSync();

  const label = syncing
    ? "Syncing…"
    : !online
      ? "Offline"
      : pending > 0
        ? `${pending} pending` + (failed > 0 ? ` · ${failed} failed` : "")
        : failed > 0
          ? `${failed} failed · tap to retry`
          : lastSyncAt
            ? "All synced"
            : "Ready";

  const badgeClass = syncing
    ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
    : !online
      ? "bg-red-500/15 text-red-300 border-red-500/40"
      : pending > 0 || failed > 0
        ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
        : "bg-white/10 text-neutral-300 border-white/10";

  const dotClass = syncing || pending > 0 ? "bg-amber-400 animate-pulse" : !online ? "bg-red-500" : "bg-emerald-400";

  const showTooltip = lastSyncAt != null && online && pending === 0 && failed === 0;
  const timeLabel = showTooltip
    ? new Date(lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-4">
      <button
        type="button"
        onClick={flush}
        className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur transition active:scale-95 ${badgeClass}`}
        aria-live="polite"
      >
        <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
        <span>{label}</span>
        {timeLabel ? <span className="text-neutral-400">· {timeLabel}</span> : null}
      </button>
    </div>
  );
}