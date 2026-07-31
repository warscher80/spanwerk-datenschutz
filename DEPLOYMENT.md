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
erstem Login unter Stammdaten → Benutzer ändern).

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
