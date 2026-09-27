// Back-Assistent Pro – Service Worker
// Cached die App-Shell, damit die App auch ohne Netz in der Backstube
// startet und rechnet. Reine Client-Logik – keine API-Calls.
//
// WICHTIG: CACHE_NAME bei jedem Release mitziehen (gleiche Nummer wie in
// index.html). Die App zeigt bei einem neuen SW ein "Update verfügbar"-Banner
// und aktiviert die neue Version erst, wenn der Nutzer zustimmt
// (SKIP_WAITING-Nachricht) – vorher lief still immer die VORHERIGE Version.

const APP_VERSION = '0.29.0';
const CACHE_NAME = 'back-assistent-pro-v' + APP_VERSION.replace(/\./g, '-');
const APP_SHELL_REQUIRED = ['./index.html', './manifest.json'];
const APP_SHELL_OPTIONAL = ['./icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Pflichtdateien müssen klappen; ein fehlendes Icon darf die
      // Installation nicht komplett scheitern lassen (addAll wäre alles-oder-nichts).
      await cache.addAll(APP_SHELL_REQUIRED);
      await Promise.all(APP_SHELL_OPTIONAL.map((url) => cache.add(url).catch(() => null)));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Stale-while-revalidate: sofort aus dem Cache antworten (funktioniert
// offline), im Hintergrund neu laden und Cache aktualisieren.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
      return cached || networkFetch;
    })
  );
});
