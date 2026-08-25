/* sw.js — Service Worker der Rettungspunkte-App.

   Zweck: Die App muss nach vollständigem Schließen auch im Flugmodus wieder
   starten. Dafür werden Programm und Baustellendaten vorab gespeichert.

   Die Behauptung „offline einsatzbereit" macht die App erst, wenn dieser
   Worker aktiv ist UND alle Pflichtdateien wirklich im Speicher liegen —
   dieser Worker meldet das der Seite zurück (Nachricht 'status').

   Der Pfad ist bewusst relativ: Die App läuft unter
   /spanwerk-datenschutz/rettungspunkte/ und muss auch dort funktionieren. */

var CACHE = 'rettungspunkte-682f5ab4';

// Ohne diese Dateien ist die App im Einsatz nicht brauchbar.
var PFLICHT = [
  './',
  './index.html',
  './geo.js',
  './daten-pruefung.js',
  './daten-baustelle.js',
  './daten-notruf.js'
];

// Nützlich, aber kein Grund, den Offline-Betrieb abzulehnen.
var KUER = [
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Pflichtdateien müssen klappen, der Rest darf scheitern.
      return c.addAll(PFLICHT).then(function () {
        return Promise.all(KUER.map(function (u) {
          return c.add(u).catch(function () { return null; });
        }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.map(function (n) {
        return (n !== CACHE && n.indexOf('rettungspunkte-') === 0) ? caches.delete(n) : null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // fremde Adressen nicht anfassen

  // Seitenaufrufe: erst Netz (damit Updates ankommen), sonst Speicher.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (a) {
        var kopie = a.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', kopie); });
        return a;
      }).catch(function () {
        return caches.match('./index.html').then(function (a) {
          return a || caches.match('./') || new Response(
            '<h1>Offline</h1><p>Die App wurde noch nicht vollständig gespeichert. ' +
            'Bitte einmal mit Internet öffnen.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        });
      })
    );
    return;
  }

  // Alles andere: erst Speicher (schnell und offline sicher), dann Netz.
  e.respondWith(
    caches.match(req).then(function (treffer) {
      if (treffer) return treffer;
      return fetch(req).then(function (a) {
        if (a && a.status === 200 && a.type === 'basic') {
          var kopie = a.clone();
          caches.open(CACHE).then(function (c) { c.put(req, kopie); });
        }
        return a;
      }).catch(function () {
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});

// Die Seite fragt: Bin ich wirklich offline-bereit?
self.addEventListener('message', function (e) {
  var daten = e.data || {};
  if (daten.typ === 'status') {
    caches.open(CACHE).then(function (c) {
      return Promise.all(PFLICHT.map(function (u) {
        return c.match(u).then(function (t) { return !!t; });
      })).then(function (treffer) {
        var da = treffer.filter(Boolean).length;
        var antwort = {
          typ: 'status',
          cache: CACHE,
          vollstaendig: da === PFLICHT.length,
          gespeichert: da,
          noetig: PFLICHT.length
        };
        if (e.ports && e.ports[0]) e.ports[0].postMessage(antwort);
        else if (e.source) e.source.postMessage(antwort);
      });
    });
  }
  if (daten.typ === 'aktualisieren') self.skipWaiting();
});
