// Service worker minimale: abilita l'installazione PWA e fa da cache per la
// app shell. I dati (Esse3/Elly) restano sempre network-only: niente cache di
// risposte autenticate.
const CACHE = "unidesk-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/unipr.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Solo GET same-origin e mai le API (dati autenticati / per-utente).
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }
  // Network-first con fallback alla cache (utile offline per la shell).
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((r) => r ?? caches.match("/"))),
  );
});
