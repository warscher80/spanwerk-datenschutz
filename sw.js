/* Preisschmiede – Service Worker (Phase 14A)
   Cacht NUR die statische App-Shell (HTML/CSS/JS/Icons). Es werden
   KEINE Benutzer-/Mandantendaten gecacht (diese liegen in localStorage/
   IndexedDB und werden vom SW nicht angefasst). Sichere Cache-
   Versionierung: alte Caches werden bei Aktivierung entfernt. */
"use strict";
var CACHE = "preisschmiede-shell-b4";
var SHELL = [
  "index.html", "portal.html", "mobil.html", "datenschutz.html", "manifest.webmanifest",
  "assets/css/styles.css", "assets/css/portal.css", "assets/css/mobil.css",
  "assets/vendor/qrcode.js", "assets/vendor/jsQR.js",
  "assets/js/products.js", "assets/js/konfigurator.js", "assets/js/vorlagen.js", "assets/js/kalkulation.js",
  "assets/js/angebot.js", "assets/js/store.js", "assets/js/auth.js", "assets/js/calc.js", "assets/js/datanorm.js",
  "assets/js/sortiment.js", "assets/js/auswertung.js", "assets/js/planung.js", "assets/js/dokumente.js",
  "assets/js/betrieb.js", "assets/js/mandant.js", "assets/js/infra.js", "assets/js/portal.js", "assets/js/portal-app.js",
  "assets/js/rechnung.js", "assets/js/lager.js", "assets/js/qualitaet.js", "assets/js/qualitaet-ui.js", "assets/js/lager-ui.js", "assets/js/sync.js", "assets/js/offlinedb.js", "assets/js/offline-app.js",
  "assets/js/mobil-app.js", "assets/js/app.js",
  "brand/icon-only.png", "brand/icon-foreground.png"
];

self.addEventListener("install", function (ev) {
  ev.waitUntil(caches.open(CACHE).then(function (c) {
    // Einzeln cachen, damit ein fehlendes Asset die Installation nicht abbricht.
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () { return null; }); }));
  }));
  // Nicht automatisch skipWaiting: Update wird kontrolliert per Nachricht aktiviert
  // (schützt eine laufende kritische Speicherung – siehe offline-app.js).
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (ev) {
  if (ev.data === "SKIP_WAITING") self.skipWaiting();
});

function istShell(url) { return url.origin === self.location.origin; }

self.addEventListener("fetch", function (ev) {
  var req = ev.request;
  if (req.method !== "GET") return; // nur GET cachen
  var url = new URL(req.url);
  if (!istShell(url)) return; // keine Fremd-Hosts cachen
  if (req.mode === "navigate") {
    // Navigation: Netzwerk zuerst, bei Offline die gecachte App-Shell.
    ev.respondWith(fetch(req).catch(function () {
      return caches.match(req).then(function (r) { return r || caches.match("index.html"); });
    }));
    return;
  }
  // Statische Assets: Cache zuerst, im Hintergrund aktualisieren (stale-while-revalidate).
  ev.respondWith(caches.match(req).then(function (cached) {
    var netz = fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === "basic") { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return cached; });
    return cached || netz;
  }));
});
