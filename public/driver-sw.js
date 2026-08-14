/* CargoFlow Driver service worker.
 * Strategy (network-first unless noted), tuned for a trucker PWA:
 *  - App shell is precached on install so the whole driver app boots offline.
 *  - Navigations: network-first, falling back to the cached page or "/driver".
 *  - Same-origin static assets and /_next/ chunks: stale-while-revalidate
 *    (serve cache instantly, refresh in the background so new deploys roll in).
 *  - Driver GET APIs (/api/driver/*, /api/portal/*): network-first with a cache
 *    fallback so the last known context still renders fully offline. The cache
 *    is per-origin and the auth cookie is handled by the browser's normal fetch.
 *  - All API POSTs are NEVER intercepted here: the page routes mutations through
 *    the IndexedDB offline queue (see src/lib/offline) and replays them itself.
 *  - Background Sync: a "cargoflow-flush" sync event wakes controlled clients
 *    and asks them to replay the queue from the page (IndexedDB lives in page
 *    scope, not SW scope).
 */
const CACHE = "cargoflow-driver-v2";
const SHELL = [
  "/driver",
  "/driver/",
  "/driver/login",
  "/driver/navigate",
  "/driver/history",
  "/driver/pod",
  "/driver-manifest.json",
  "/driver-icons/icon-192.png",
  "/driver-icons/icon-512.png",
];

const DRIVER_API_PREFIXES = ["/api/driver/", "/api/portal/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/* Best-effort: when the browser decides we have connectivity again it may
 * throw a sync event; ask every controlled client to flush its queues. */
self.addEventListener("sync", (event) => {
  if (event.tag !== "cargoflow-flush") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: "CARGOFLOW_FLUSH" }));
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch analytics/SSE/tRPC, RSC prefetch payloads, or anything that
  // must always hit the network.
  if (
    url.pathname.startsWith("/api/sse") ||
    url.pathname.startsWith("/trpc") ||
    url.pathname.includes("/_next/data/") ||
    request.headers.get("RSC") === "1"
  ) {
    return;
  }

  // Same-origin driver GET APIs: network-first -> cached fallback.
  if (
    url.origin === self.location.origin &&
    DRIVER_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error())),
    );
    return;
  }

  // Any other API call must always reach the network (auth/session checks etc).
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/driver")),
        ),
    );
    return;
  }

  // Static assets + /_next/ chunks: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      }),
    );
  }
});