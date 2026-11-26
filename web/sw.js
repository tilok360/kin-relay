// Kin Relay's service worker: keeps the app's own files on the device so it opens offline (Solo games need no network).
// Files are served from the device first and refreshed in the background, so an update appears the second time you open it.
"use strict";
const VERSION = "__VERSION__";
const CORE = __CORE__;
self.addEventListener("install", (e) => { e.waitUntil(caches.open("kin-relay-" + VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("kin-relay-") && k !== "kin-relay-" + VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(caches.open("kin-relay-" + VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
