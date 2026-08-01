# Preisschmiede – Kalkulations-App für Metallbau

Intelligente Kalkulations-App für Metallbaubetriebe. Berechnet aus wenigen
Eingaben Material, Arbeitszeiten und Verkaufspreis, erzeugt fertige Angebote
und lernt aus jeder Nachkalkulation dazu.

**Alles läuft offline. Alle Daten bleiben lokal auf dem Gerät.**

## Die App benutzen (am einfachsten)

Einfach `index.html` im Browser öffnen – fertig. Funktioniert am Computer,
Tablet und Handy, auch ohne Internet.

## Android-App (APK) installieren

Die App gibt es auch als installierbare Android-App. So kommst du an die APK:

1. Auf GitHub oben auf **„Releases“** tippen (oder direkt:
   `https://github.com/warscher80/spanwerk-datenschutz/releases`).
2. Beim Release **„Preisschmiede – aktuelle App“** die Datei **`preisschmiede.apk`**
   auf dem Handy herunterladen.
3. Die heruntergeladene Datei öffnen und auf **Installieren** tippen.
4. Erscheint „Installation blockiert“: einmalig **„Aus dieser Quelle zulassen“**
   für den Browser erlauben, dann nochmal auf Installieren.

> Hinweis: Es ist ein Test-Build (Debug-APK) zum direkten Installieren –
> nicht über den Play Store. Für die Play-Store-Veröffentlichung wird später
> eine signierte Version erstellt.

## Wie die APK gebaut wird

Bei jeder Änderung baut GitHub automatisch eine neue APK (siehe
`.github/workflows/android.yml`) und legt sie als Release ab. Es muss also
nichts manuell gebaut werden.

Technisch: Die statische Web-App im Projekt-Root wird mit
[Capacitor](https://capacitorjs.com/) in eine native Android-App verpackt
(`scripts/copyweb.mjs` → `www/` → `cap sync` → Gradle-Build).

## Funktionen (Kurzüberblick)

- **Stammdaten:** Stundensätze, Maschinenstundensätze, Zuschläge, Gewinn, Firmendaten
- **Materialdatenbank:** Preise, Lieferanten, Preishistorie, Lagerbestand, Verschnitt
- **Produktkonfigurator:** Geländer, Treppe, Balkon, Zaun, Stahlbau, Edelstahlbau,
  Sonderkonstruktion, Serienteil, Reparatur/Wartung
- **Automatische Zeit- & Preiskalkulation** inkl. Maschinenkosten
- **Angebotsgenerator** mit druckbarem PDF-Angebot
- **Nachkalkulation** mit Soll-/Ist-Vergleich
- **Fertigungsplanung** (Kapazität, Konflikte, Gantt/Kanban, Montage)
- **Dokumente/Zeichnungen/Stücklisten** (Upload, Analyse, kontrollierte Übernahme)
- **Management-Dashboard** mit rollenbasierten Auswertungen
- **System-/Betriebsseite** (Healthchecks, Backup-Überwachung, Feedback,
  Fehlerprotokoll, Freigabestufen) – nur für Administration
- **Selbstlernende Statistik** – segmentiert nach Produkt × Werkstoff × Größe

## Für den Pilotbetrieb & Betrieb

Diese App ist für einen kontrollierten Pilotbetrieb vorbereitet. Wichtige
Dokumente:

| Thema | Datei |
|---|---|
| Projektstand & Reifegrad | `PROJECT_STATUS.md` |
| **Abschluss-Audit (Systemcheck, Reifegrad, Empfehlung)** | **`FINAL_AUDIT.md`** |
| **Vollständiger Testbericht** | **`TEST_REPORT.md`** |
| **Release-Checkliste** | **`RELEASE_CHECKLIST.md`** |
| Früherer Prüf-/Abschlussbericht (Phase 8) | `AUDIT_REPORT.md` |
| Kalkulationsformeln | `CALCULATION_RULES.md` |
| Architektur | `ARCHITECTURE.md` |
| Sicherheit | `SECURITY.md` |
| Backup & Wiederherstellung | `BACKUP_RESTORE.md` |
| Deployment & Freigabestufen | `DEPLOYMENT.md` |
| Bekannte Einschränkungen | `KNOWN_LIMITATIONS.md` |
| Kurzanleitung | `USER_GUIDE.md` |
| Pilotplan / Checklisten | `PILOT_PLAN.md`, `PILOT_CHECKLIST.md` |
| Betrieb / Störungen / Release / Support | `OPERATIONS_GUIDE.md`, `INCIDENT_RESPONSE.md`, `RELEASE_PROCESS.md`, `SUPPORT_GUIDE.md` |
| Pilot-Ergebnisse (Vorlage) | `PILOT_RESULTS_TEMPLATE.md` |
| Änderungshistorie | `CHANGELOG.md` |

**Tests:** `node tests/referenz.test.js` (Referenzkalkulation, Snapshot-
Invarianten, Migrationen, Betriebs-/Sicherheitschecks). Syntaxprüfung:
`node --check assets/js/*.js`.

**Reifegrad (Stand Abschluss-Audit 2026-08-01): begleiteter Pilotbetrieb.**
Alle Hauptabläufe sind durchgängig über die normale Oberfläche bedienbar;
729 automatisierte Prüfungen laufen fehlerfrei (`TEST_REPORT.md`).
**Nicht produktionsbereit:** es gibt kein Backend (damit keine serverseitige
Rechteprüfung, kein Anmelde-Rate-Limit, keine Virenprüfung für Uploads), der
Speicher ist auf ~5–10 MB pro Mandant begrenzt, und echte iOS-/Android-
Gerätetests stehen aus. Es wird **keine** Sicherheitszertifizierung und
**keine** steuerliche oder rechtliche Konformität behauptet. Kein öffentliches
Deployment und keine Übernahme echter Firmendaten ohne ausdrückliche Freigabe.

**Für den mobilen Betrieb:** die App muss über **HTTP(S)** ausgeliefert werden
(Server oder `localhost`). Ein Aufruf per `file://` funktioniert als Notbehelf,
ist aber **keine** vollwertige PWA (kein Service Worker, keine IndexedDB).
