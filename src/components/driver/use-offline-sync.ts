"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { flushQueue, getSnapshot, hydrateLastSync, refreshCounts, setOnline, subscribe } from "@/lib/offline/queue";

const SERVER_SNAPSHOT = {
  online: true,
  pending: 0,
  failed: 0,
  syncing: false,
  lastSyncAt: null as number | null,
};

/**
 * Client-only live view of the offline queue. Rerenders whenever connectivity,
 * pending/failed counts, or last-sync time change. Auto-flushes when the device
 * comes back online, on a timer while pending work exists, and when the tab is
 * refocused - plus on background-sync "wake" messages from the service worker.
 */
export function useOfflineSync() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const flush = useCallback(() => {
    void flushQueue();
  }, []);

  useEffect(() => {
    void hydrateLastSync();
    void refreshCounts();
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const timer = setInterval(() => {
      if (getSnapshot().online && getSnapshot().pending > 0) void flushQueue();
    }, 30000);

    const onVisibility = () => {
      if (document.visibilityState === "visible" && getSnapshot().pending > 0) void flushQueue();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onSwMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "CARGOFLOW_FLUSH") void flushQueue();
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, []);

  return { ...snapshot, flush };
}