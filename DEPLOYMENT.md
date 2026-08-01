# Deployment & Betrieb – Preisschmiede

Preisschmiede ist eine **statische, offline-fähige Web-App** (reines
HTML/CSS/JS, keine Server-Laufzeit). Sie wird als **Web**, **Android**
(Capacitor) und **Windows/Desktop** (Electron) ausgeliefert.

## Es gibt keine Geheimnisse

Die App benötigt **keine** Datenbank, keinen Server und **keine** Secrets zur
Laufzeit. Siehe `.env.example` – dort stehen nur optionale Build-/CI-Schalter,
niemals echte Zugangsdaten. **Keine Secrets im Repository.**

## Web-Vorschau (Entwicklung)

```
# statischen Server im Projektordner starten, z. B.
npx serve .
# oder
python3 -m http.server 8080
```

Danach `index.html` öffnen. Erst-PIN aller Beispielbenutzer: **1234** (nach
erstem Login unter Stammdaten → Benutzer ändern). Die Demo-PIN existiert nur
in der Releasestufe „Entwicklung/Test"; ab **Pilot** erzwingt der Erstlogin
einen PIN-Wechsel.

### Wichtig: HTTP(S) ist Pflicht für den mobilen/Offline-Betrieb

Die mobile PWA (`mobil.html`) benötigt **Service Worker und IndexedDB**. Beide
sind unter `file://` nicht verfügbar. Die App fällt dort auf `localStorage`
zurück – das ist ein **Notbehelf und keine Produktionslösung**. Für Werkstatt-,
Montage-, Lager- und Prüfnutzung muss die App über einen Server oder über
`http://localhost` ausgeliefert werden (in der Android-App übernimmt das
Capacitor).

## Tests

```
node tests/referenz.test.js      # Referenz-, Invarianten-, Migrationstests
node --check assets/js/*.js       # „TypeScript-Prüfung" (Syntax; das Projekt ist reines JS)
```

Die Browser-End-to-End-Tests (Playwright) liegen im Arbeits-/Scratchpad und
prüfen Kalkulation, Angebote, Dashboard, Planung und Dokumente.

## Produktions-Build (App-Stores / .exe)

Der Build läuft in GitHub Actions („Apps bauen (Android + Windows)") und legt
APK und Windows-`.exe` in das Release `app-latest`. Ein echter externer
Produktiv-Deploy wird **nicht** automatisch durchgeführt.

## Reproduzierbares Hosting (Phase 11)

Die statische App kann zusätzlich reproduzierbar bereitgestellt werden – siehe
`PRODUCTION_INFRASTRUCTURE.md` für Details und die ehrliche Abgrenzung
(Offline-App ohne Backend).

**Variante A – Managed Static Hosting** (empfohlen für den Start):
```
node scripts/copyweb.mjs   # erzeugt www/
# www/ bei Netlify/Cloudflare Pages/GitHub Pages veröffentlichen
# Header/Fallback: deploy/netlify.toml + deploy/_headers
```

**Variante B – Docker/VPS** (volle Kontrolle, non-root nginx, Healthcheck):
```
docker build -t preisschmiede-web .
docker run -d -p 8080:8080 preisschmiede-web
curl -f http://localhost:8080/healthz   # -> 200 "ok"
```

**Qualitäts-Gates (CI, `.github/workflows/ci.yml`):**
```
for f in assets/js/*.js; do node --check "$f"; done   # Syntax/„TS"-Prüfung
node scripts/check-env.mjs .env.example prod-backend    # Env-Validierung (ohne Secrets)
node tests/referenz.test.js                              # Referenz-/Sicherheitstests
node scripts/secret-scan.mjs                             # Secret-Scan
node scripts/copyweb.mjs                                 # Produktions-Build
```
Es gibt **kein** automatisches Produktions-Deployment – nur kontrolliert und mit
ausdrücklicher Freigabe (siehe `RELEASE_PROCESS.md` und `RELEASE_CHECKLIST.md`).

Zusätzlich zu den CI-Gates laufen Browser-Prüfungen (End-to-End, Schaltflächen,
XSS, Responsive, PDF, PWA) über Playwright gegen einen lokalen HTTP-Server;
Umfang und Ergebnisse stehen in `TEST_REPORT.md`.

**Stand 2026-08-01:** Es wurde **kein** öffentliches Deployment durchgeführt.
Freigegebener Reifegrad ist **Pilotbetrieb**, nicht Produktivbetrieb – die
Voraussetzungen und Auflagen stehen in `RELEASE_CHECKLIST.md`.

## Freigabestufen (Phase 9)

In der App (System-Seite, nur Admin) einstellbar:
Entwicklung → Interner Test → Pilot → eingeschränkter Produktivbetrieb →
Produktivbetrieb. Ab **Pilot** wird beim ersten Login ein PIN-Wechsel
erzwungen. Die aktuelle Stufe wird Administratoren als Banner angezeigt.
Der **Wartungsmodus** kennzeichnet kontrollierte Updates (siehe
`RELEASE_PROCESS.md`).

## Betriebsmodi

- **Entwicklung/Test:** Beispieldaten sind aktiv (klar als „Beispiel"
  gekennzeichnet). Performance-Testdaten nur über den Admin-Generator und mit
  `_testdaten` markiert.
- **Produktivbetrieb:** vor der Übergabe an echte Nutzer:
  1. Beispieldaten entfernen bzw. echte Stammdaten über den
     Ersteinrichtungs-Assistenten anlegen.
  2. Alle Beispielbenutzer-PINs ändern; mindestens ein neuer Admin.
  3. `_testdaten` über „Testdaten entfernen" löschen.
  4. Backup-Routine gemäß `BACKUP_RESTORE.md` einrichten.

## Update

Neue Version über den App-Update-Mechanismus (Android: APK, Windows: `.exe`
aus dem `app-latest`-Release). Vor jedem Update ein Backup erstellen. Migration
läuft beim ersten Start automatisch und idempotent.

## Fehlerbehebung

- **„Kein Speicherplatz":** lokales `localStorage`-Limit erreicht – große
  Dokument-Uploads entfernen, Backup exportieren, ggf. Testdaten löschen.
- **Weiße Seite/Ladefehler:** Browser-Cache leeren; sicherstellen, dass alle
  `assets/js/*.js` geladen werden.
- **Daten weg nach Browserwechsel:** `localStorage` ist geräte-/browsergebunden
  – Backup importieren.
