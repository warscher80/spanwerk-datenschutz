/* Sommerfest Kassa – Service Worker
   Ziel: läuft auch ohne Internet sauber weiter.
   - kassa.html: network-first (frische Version wenn online, Cache wenn offline)
   - Logo/Manifest: cache-first
   Greift NUR auf die Kassa-Dateien zu, lässt alles andere unangetastet. */
const CACHE = 'kassa-v3';
const ASSETS = ['./kassa.html', './sommerfest-logo.png', './manifest.json', './qrcode.js',
                './fsgl-logo.svg', './scl-logo.png', './scl-emblem.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  const isHtml   = url.pathname.endsWith('/kassa.html');
  const isAsset  = /\/(sommerfest-logo\.png|manifest\.json|qrcode\.js|fsgl-logo\.svg|scl-logo\.png|scl-emblem\.png)$/.test(url.pathname);
  const isAppNav = req.mode === 'navigate' && isHtml;

  if (isHtml || isAppNav) {
    // network-first: online -> frisch holen + Cache aktualisieren; offline -> Cache
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./kassa.html', cp)).catch(()=>{}); return r; })
        .catch(() => caches.match('./kassa.html'))
    );
    return;
  }

  if (isAsset) {
    // cache-first
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(rr => {
        const cp = rr.clone(); caches.open(CACHE).then(c => c.put(req, cp)).catch(()=>{}); return rr;
      }))
    );
  }
  // alle anderen Anfragen: normal (kein Eingriff)
});
