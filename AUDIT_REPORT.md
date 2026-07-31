# Prüfbericht & Abschlussbericht – Phase 8 (Gesamtprüfung)

Stand: Gesamtprüfung nach Phase 7D. Grundlage: statische Offline-Web-App
(Vanilla JS, `localStorage`), ausgeliefert als Web/Android/Windows.

## 1. Funktionsinventur

Legende: ✅ vollständig · 🟡 teilweise · 🧩 vorbereitet, nicht angebunden ·
⛔ nicht umgesetzt

| Modul | Status | Anmerkung |
|---|---|---|
| Anmeldung / PIN (Hash+Salt) | ✅ | keine Klartext-PIN |
| Benutzerverwaltung / Rollen | ✅ | admin/buero/werkstatt, Rechtematrix |
| Firmenstammdaten | ✅ | |
| Kunden / Projekte / Kommissionen | ✅ | |
| Lieferanten | ✅ | |
| Materialien / Materialpreise / Historie | ✅ | Preishistorie je Artikel |
| Mitarbeitergruppen / Stundensätze | ✅ | |
| Maschinen / Maschinenstundensatz / Rüstkosten | ✅ | inkl. Kapazität (7C) |
| Produktgruppen / Konfigurator | ✅ | 17 Feldtypen, datengetrieben |
| Blecharbeiten (Vorlage) | ✅ | Fläche/Gewicht automatisch |
| Kalkulationen | ✅ | Decimal, Snapshot, Versionierung |
| Angebote / PDF | ✅ | kundensicher, Leak-Detektor |
| Aufträge / Nachkalkulation (Soll-Ist) | 🟡 | Legacy-Modell aktiv; Phase-5-Ausbau offen |
| Zeiterfassung / Maschinenzeit / Materialverbrauch | 🟡 | über Auftragspositionen; dedizierte 5-Tabellen offen |
| Montage | ✅ | Planung + Erfassung |
| Lernvorschläge | 🟡 | Legacy statistisch; Phase-6-Ausbau offen |
| Dashboard / Auswertungen | ✅ | reale Daten, Rollen, Drill-down (7A) |
| Fertigungsplanung | ✅ | Kapazität/Konflikte/Gantt/Kanban (7C) |
| Dokumente / Zeichnungen / Stücklisten | ✅ | Upload/Analyse/Übernahme (7D) |
| Import/Export | 🟡 | DATANORM + CSV; Import-**zentrale** (7B) offen |
| ERP-Vorbereitung (KingBill) | 🧩 | Dateiexport vorbereitet, keine Live-API |
| Frankstahl-Live-API | 🧩 | nicht konfiguriert |
| OCR / externe KI | ⛔/🧩 | bewusst nicht angebunden |
| Materialbestellungen | 🟡 | Grundfunktion; Bestellworkflow (7B) offen |

Keine 🧩-Schnittstelle wird in der UI als „funktionsfähig" ausgegeben.

## 2. End-to-End-Hauptablauf

Der Kernpfad **Login → Stammdaten → Kunde/Projekt/Kommission → Material/
Maschine/Rüstkosten → Konfiguration → Kalkulation → Freigabe → Angebot → PDF →
Auftrag → Planung → Nachkalkulation → Dashboard** ist durch automatisierte
Browser-Tests (Playwright) und Engine-Tests abgedeckt. Alle Seiten rendern,
**0 pageerror** beim Durchklicken aller sichtbaren Buttons, **keine sichtbare
Schaltfläche ohne Funktion** festgestellt.

## 3. Referenzkalkulation TEST-REFERENZ-001

Automatisierter Regressionstest `tests/referenz.test.js`. Kontrollwerte
(Material 550/600/720 €, Arbeit 12 h/480/900 €, Rüst 80 €, Maschinenkosten
300 €, Rüst/Stück 0,80 €, direkt 1.460 €, Selbst 1.606 €, Risiko 80,30 €)
**bestätigt**. Der Test schlägt bei jeder Formeländerung fehl.

## 4. Kalkulationsprüfung

Formeln zentral dokumentiert in `CALCULATION_RULES.md`. Geprüft: getrennte
Rüst-/Stückkosten, keine doppelten Aufschläge/Bedienerkosten (Warnung),
korrekte Reihenfolge des Preis-Wasserfalls, Staffelpreise, USt, Rabatt,
Decimal-Rundung, Division durch null (→ 0), Stückzahl 0, negative Marge
(Warnung), sehr große Stückzahlen. Alle Robustheitsfälle grün.

## 5. Historische Daten & Snapshots

Getestet und bestätigt: Materialpreis-/Stammdatenänderung ändert bestehende
Kalkulation nicht; Firmendaten-/Textbausteinänderung ändert freigegebenen
Angebots-Snapshot nicht; Zeichnungsrevision überschreibt Vorgänger nicht.
**Behoben:** Angebots-Snapshot hielt zuvor Referenzen auf Firma/Kunde
(jetzt tiefe Kopie in `Angebot.kundenAusgabe`).

## 6. Rollen & Berechtigungen

Navigation je Rolle entspricht exakt der Rechtematrix (admin 12, buero 12,
werkstatt 3 Bereiche; keine unerlaubten Einträge). Direkter Renderer-Aufruf
einer gesperrten Seite (werkstatt → Kalkulation) wird auf eine erlaubte Seite
umgeleitet. Fertigung/Montage sehen **keine** Gewinn-/Deckungsbeitragsdaten.
**Grenze (ehrlich):** UI-/Anwendungsschutz, kein serverseitiger Zwang – siehe
`SECURITY.md`.

## 7. Sicherheit (Kurzbericht)

| Schwere | Punkt | Status |
|---|---|---|
| Hoch | Angebots-Snapshot-Immutabilität | **behoben** |
| Mittel | `localStorage` unverschlüsselt | offen (Geräteschutz) |
| Niedrig | kein Anmelde-Rate-Limit | offen (lokale App) |

SQL-Injection/CSRF/Server-Auth entfallen mangels Backend. XSS-Maskierung,
CSV-Formula-Injection-Schutz, Upload-Validierung vorhanden. Keine Secrets im
Repo. **Keine** Sicherheitszertifizierung behauptet.

## 8. Datenbank / Migrationen

Kein SQL; Persistenz als versioniertes JSON (`version: 8`). Migration ist
**idempotent** und wurde auf leerem Objekt, altem Datenstand und doppelter
Ausführung getestet (grün). Zeitstempel in ISO/UTC, Anzeige in de-AT.

## 9./10. Backup & Datenschutz

Backup/Restore dokumentiert (`BACKUP_RESTORE.md`). Datenschutz: Datensparsam,
rollenbasiert, keine medizinischen Details bei Abwesenheiten. **Rechtliche
DSGVO-Prüfung durch Fachleute erforderlich** – kein Zertifikat behauptet.

## 11.–15. Fehlerbehandlung / UX / Responsive / Barrierefreiheit

Modale fangen Fehler ab (verständliche Toast-Meldungen, keine Server-Interna).
**Responsive: behoben** – Überlauf auf Tablet (820 px) und kleinen Handys
(≤360 px) korrigiert; jetzt 320–1600 px über alle Hauptseiten überlauffrei.
Barrierefreiheit: semantische Überschriften/Tabellenköpfe, Alt-Texte für
SVG-Diagramme, Status nicht nur farblich (Badges mit Text). Vollständige
a11y-Prüfung mit Screenreader steht aus (in KNOWN_LIMITATIONS vermerkt).

## 16.–19. PDF / Import-Export / Performance / Offline

- **PDF:** Angebote inkl. optionaler Positionen, Umlaute, €, Summenblock,
  Seitenumbrüche geprüft; kundensicher (kein Leak).
- **Import/Export:** CSV (Semikolon/Komma, Dezimalkomma/-punkt),
  Materialabgleich, CSV-Export mit Injection-Schutz; nicht konfigurierte
  Adapter klar gekennzeichnet.
- **Performance:** Dashboard-Aggregation über 1.005 Aufträge + 2.002 Angebote
  in ~60 ms (warm ~21 ms).
- **Offline:** App ist per Design offline; Ist-Zeiterfassung lokal. Kein
  Scheindaten-Verlust – Daten liegen bis zum Backup lokal.

## Testergebnisse

| Suite | Ergebnis |
|---|---|
| Referenz/Invarianten/Migration (`tests/referenz.test.js`) | 35/35 |
| Auswertungs-Engine | 48/48 |
| Planungs-Engine | 37/37 |
| Dokumenten-Engine | 43/43 |
| Angebots-Engine | 17/17 |
| Kalkulations-Formeltests | 34/34 |
| Browser-E2E (Angebote/Dashboard/Planung/Dokumente/Audit-Sweep) | grün, 0 JS-Fehler |
| `node --check` alle Module | grün |
| Responsive 320–1600 px × 12 Seiten | überlauffrei |
| Produktions-Build (Android + Windows, CI) | zuletzt grün |

Fehlgeschlagen: 0 · Übersprungen: 0 kritische.

## Produktionsfreigabe (ehrliche Bewertung)

- **Bereit für internen Testbetrieb:** ✅ ja.
- **Bereit für Pilotbetrieb** (ein Betrieb, wenige Nutzer, ein Gerät/gepflegtes
  Backup): ✅ ja, mit den in `KNOWN_LIMITATIONS.md` genannten Auflagen.
- **Bereit für vollen Produktivbetrieb** (mehrere Nutzer, echte
  Zugriffstrennung, Serverdatenhaltung, ERP-Live-Anbindung): ⛔ noch nicht –
  erfordert ein Backend (Server/DB), Phase 7B (Importzentrale) und den Ausbau
  von Phase 5/6.

**Begründung:** Alle Hauptabläufe funktionieren, Kalkulationswerte sind gegen
eine feste Referenz verifiziert, Berechtigungen greifen, historische Daten
bleiben stabil, keine toten Schaltflächen, Responsive/Build grün, Backup
dokumentiert. Die verbleibenden Einschränkungen sind architektonisch (Offline/
Einzelplatz) bzw. bewusst nicht vorgetäuschte Fremdanbindungen und sauber
dokumentiert. Kein echter externer Produktiv-Deploy wird ohne ausdrückliche
Freigabe und Zielumgebung durchgeführt.
