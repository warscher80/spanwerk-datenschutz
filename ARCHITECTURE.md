# Architektur – Preisschmiede

## Überblick

Reine **Client-App** ohne Server: HTML/CSS/**Vanilla JavaScript** (kein
Framework, kein Build-Step für den Code, kein TypeScript). Persistenz im
Browser-`localStorage`. Auslieferung als Web, **Android** (Capacitor) und
**Windows/Desktop** (Electron).

## Module (`assets/js/`)

Jedes Modul ist ein IIFE, das an `window.Preisschmiede.*` hängt.

| Datei | Rolle |
|---|---|
| `products.js` | Arbeitsschritte (SCHRITTE), Produktbasis |
| `konfigurator.js` | dynamische Konfigurator-Engine (Feldtypen, Regeln, Snapshot) |
| `vorlagen.js` | Produktgruppen + Vorlagen + Beispielkonfigurationen |
| `kalkulation.js` | Kalkulations-Engine (Decimal, Preis-Wasserfall, Staffel, Snapshot) |
| `angebot.js` | Angebots-Engine (Summen, Platzhalter, **kundensichere Ausgabe**, Leak-Detektor) |
| `calc.js` | Legacy-Schnellkalkulation + Soll-Ist + Lern-Erkenntnisse |
| `auswertung.js` | Dashboard-/Analyse-Engine (7A) |
| `planung.js` | Fertigungsplanung: Kapazität, Konflikte, Auto-Plan, Rüstopt. (7C) |
| `dokumente.js` | Dokumente/CSV-BOM/PDF-Text/DXF, Erkennungswerte, Übernahme (7D) |
| `lager.js` | Lagerkern (15A): Bestand, Bewegungsjournal, Chargen, Reservierung, Reststücke, Inventur, Bestellvorschlag |
| `lager-ui.js` | Lageroberfläche (15B): Seite „Lager" mit 15 Registern über dem Lagerkern |
| `qualitaet.js` | QM-Kern (16A): Prüfpläne/Snapshot, Toleranzprüfung, Prüfaufträge, Abweichungen, Sperren, Nacharbeit, Ausschuss, Reklamationen, Prüfmittel, Audit |
| `store.js` | Datenmodell, `fresh()`/`migrate()`, Persistenz, Hash/Salt |
| `auth.js` | Anmeldung, Rollen, Rechtematrix, `darfFinanzen()` |
| `app.js` | gesamte UI-Steuerung (Renderer je Seite, Modale) |
| `datanorm.js`, `sortiment.js` | Materialimport/Grundsortiment |

**Ladereihenfolge** (`index.html`): Engines vor `store.js` referenziert werden
nur zur Aufrufzeit über `window.Preisschmiede.*`; `app.js` lädt zuletzt.

## Datenmodell (`store.js`, `version: 8`)

Eine JSON-Wurzel unter `localStorage["ps.db.v1"]`:

```
settings{ firma, rates, maschinen[], gemeinkosten, gewinn, verschnitt, mwst,
          dichten, toleranzen, angebotNummernkreis, angebotVorlagen[],
          planung{schicht,arbeitstage,feiertage}, qualifikationen[], … }
material[]  kunden[]  lieferanten[]  mitarbeiter[]  projekte[]  users[]
produktgruppen[]  vorlagen[]  konfigurationen[]  kalkulationen[]
angebote[]  textbausteine[]  auftraege[]
planung{ elemente[], versionen[], benachrichtigungen[], montage[] }
dokumente[]  lernen{ faktoren, erkenntnisse }
```

## Kernprinzipien

- **Decimal-sicher:** zentrale Rundung `r2/r4` gegen Float-Fehler.
- **Snapshots/Versionierung:** Kalkulationen, Angebote, Planung und
  Zeichnungen frieren ihren Zustand ein; spätere Stammdatenänderungen
  verändern historische Datensätze nicht (tiefe Kopien).
- **Kundensichere Ausgabe:** interne Daten per Whitelist getrennt +
  rekursiver Leak-Detektor.
- **Ehrliche Grenzen:** nicht angebundene Fremdsysteme (Frankstahl/KingBill/
  OCR/DWG) werden nie als funktionsfähig ausgegeben.
- **Idempotente Migration:** `migrate()` füllt fehlende Felder feldweise auf.

## Tests

- `tests/referenz.test.js` – Referenzkalkulation, Snapshot-Invarianten,
  Migrationen, Sicherheitsbasis (Node, ohne Browser).
- Engine-Tests je Modul + Playwright-Browser-E2E (Kalkulation, Angebote,
  Dashboard, Planung, Dokumente, Audit-Sweep).
