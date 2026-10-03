const CACHE_PREFIX = "signal-relay-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const OFFLINE_PAGE = "/offline.html";

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.add(OFFLINE_PAGE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Never cache API responses, auth pages, or user-specific dashboard HTML.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    request.mode !== "navigate"
  )
    return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(OFFLINE_PAGE)) || Response.error();
    })
  );
});
