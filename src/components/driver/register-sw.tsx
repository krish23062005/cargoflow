"use client";

import { useEffect } from "react";

/** Registers the CargoFlow Driver service worker so the app works offline. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/driver-sw.js", { scope: "/driver/" })
      .then((reg) => {
        const sync = (reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync;
        if (sync) {
          sync.register("cargoflow-flush").catch(() => {
            /* best-effort */
          });
        }
      })
      .catch(() => {
        /* registration is best-effort - the app still works online */
      });
  }, []);

  return null;
}