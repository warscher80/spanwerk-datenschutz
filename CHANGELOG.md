# Changelog – Preisschmiede

Format orientiert an „Keep a Changelog". Versionierung bezieht sich auf das
Datenschema (`store.js` `version`).

## Phase 12B – Kundenuploads & Zeichnungsfreigabe  (Schema v10)

### Hinzugefügt
- **Kundenuploads:** Datei-Upload im Portal mit Zuordnung (Kommission/Projekt,
  Dokumenttyp, Beschreibung), Statusanzeige. **Serverseitig-äquivalente
  Prüfung** (Endung-Whitelist, MIME, Größe max 15 MB, Abwehr gefährlicher/
  aktiver Formate inkl. Doppelendungen). Upload intern „ungeprüft", nie
  automatisch technisch freigegeben; interne Freigabe/Ablehnung auf System-Seite.
- **Zeichnungsfreigabe im Portal:** nur ausdrücklich freigegebene Zeichnungen
  sichtbar (Nummer/Revision/Datum/Status), Öffnen/Download, Entscheidung
  „freigeben"/„Änderung erforderlich" (Kommentarpflicht bei Änderung), Protokoll
  (Kunde/Person/Revision/Zeitpunkt). Ersetzte Revisionen gesperrt, keine
  Doppelfreigabe. Interne Verwaltung (Sichtbarkeit, Entscheidungsverlauf,
  Portal-Ereignisse). Ausdrücklich **keine** qualifizierte E-Signatur.
- Portal-UI: Zeichnungsübersicht, Zeichnungsdetail, Freigabe-/Änderungsdialog,
  Uploadliste + Upload-Dialog. Interne Prüf-/Verwaltungsansicht (System-Seite).
- Beispieldaten: Zeichnungsfreigabe (Rev B „zur Prüfung", Rev A „ersetzt"),
  Kundenupload.

### Tests
- `tests/referenz.test.js` auf **196/196** erweitert (16 neue: Upload-
  Validierung inkl. gefährliche/zu große/leere Dateien; Zeichnungsfreigabe
  freigeben/Änderung/ersetzte Revision/Doppelfreigabe/fremder Kunde/Mandant).
  End-to-End-Browsertests: Upload gültig/abgelehnt, Zeichnung freigeben,
  ersetzte Revision gesperrt, interne Prüfansicht.

## Phase 12 – Sicheres Kundenportal & digitale Angebotsannahme  (Schema v10)

### Hinzugefügt
- **Kundenportal-Engine `portal.js`** (Sicherheitskern, rein/testbar):
  Portalrollen, sichere Zugriffe (Konto + gehashter, befristeter, widerrufbarer,
  optional einmaliger, scoped Angebotslink), server-seitige Neuberechnung aus
  der freigegebenen Version (Client-Preise nie verbindlich), optionale/
  Alternativpositionen, manipulationsgeschütztes Annahmeprotokoll (Siegel/
  Prüfsumme, Guards gegen Doppelannahme/Ablauf/ersetzte Version/Berechtigung),
  Ablehnung, Bestätigungsdokument, getrennte Nachrichten, Dokumentfreigabe,
  Status-Mapping, Branding.
- **Kundenportal-Oberfläche** `portal.html` + `assets/js/portal-app.js` +
  `assets/css/portal.css`: mobil-first, eigenes Branding je Mandant, Login
  (Konto/Link), Dashboard, Angebotsansicht, Optionen/Alternativen mit
  Live-Neuberechnung, Angebots-PDF, Fragen, Annahme-Dialog, Bestätigungsansicht
  + Bestätigungs-PDF, Ablehnung. Kein interner Datenleak (Whitelist +
  Leak-Detektor).
- **Datenmodell v10** (additiv): `portalUsers`, `portalLinks`,
  `portalNachrichten`, `portalProtokolle`, `dokumentFreigaben`,
  `zeichnungsFreigaben`, `kundenUploads`, `portalEreignisse`.
- **Beispieldaten:** freigegebenes Angebot mit optionaler + Alternativgruppe,
  Portal-Konto (Demo-Passwort) + Demo-Angebotslink, Kundenfrage; zweiter
  Beispiel-Mandant mit eigenem Branding (Cross-Tenant-Demo).
- Link „🔗 Kundenportal" in der internen App; `PORTAL.md`.

### Tests
- `tests/referenz.test.js` auf **180/180** erweitert (46 Portal-/Sicherheits-
  tests) + End-to-End-Browsertests: Konto- und Link-Zugang, Optionen/
  Alternativen + server-seitige Neuberechnung, Annahme + Bestätigungs-PDF,
  Cross-Tenant-Branding, mobil/Tablet/Desktop, kein interner Datenleak,
  kein horizontaler Überlauf.

### Rechtlich / Grenzen (ehrlich)
- Digitale Zustimmung, **keine** qualifizierte E-Signatur; Annahmetext
  konfigurierbar, rechtliche Prüfung empfohlen. Kein echter E-Mail-Versand;
  Trennung client-/namespaceseitig (kein Backend).

## Phase 11 – Hosting, Domain, E-Mail, Monitoring & Produktionsinfrastruktur  (Schema v9)

### Ehrliche Einordnung
- Die App bleibt **statisch/offline** (localStorage). Server-abhängige
  Anforderungen (PostgreSQL, Objektspeicher, echte Cron/Webhooks, echter
  E-Mail-/Zahlungsbetrieb) sind **bewusst nicht** aktiviert und klar als
  „erfordert Backend / nicht konfiguriert" dokumentiert.

### Hinzugefügt
- **Infrastruktur-Engine `infra.js`** (rein, testbar): Env-Spezifikation +
  Validierung (ohne Wertausgabe), modularer **E-Mail-Adapter** + Vorlagen
  (Vorschaumodus, kein vorgetäuschter Versand, Header-Injection-Schutz,
  Doppelversandschutz), **signierte, ablaufende, mandantengebundene
  Download-Links**, **Hintergrundaufgaben-Queue** (Status/Retry/Idempotenz),
  **geplante Jobs** (Fälligkeit, Mandantenzeitzone), **Monitoring-Scrubbing**
  (keine PII/Secrets) + interne **Alarme** (kritisch/hoch/mittel),
  **Zahlungsadapter** (Webhook-Signatur, idempotent, keine Kartendaten, kein
  Zahlungsknopf ohne Anbieter), **Rate-Limiter**.
- **Reproduzierbares Hosting:** `Dockerfile` (Multi-Stage, unprivilegiertes
  nginx, non-root uid 101, `HEALTHCHECK /healthz`, keine Secrets/Beispieldaten),
  `.dockerignore`, `deploy/nginx.conf` (Security-Header, Dotfile-Sperre),
  `deploy/netlify.toml` + `deploy/_headers` (managed static). **Lokal per
  `docker build`/`run` verifiziert** (200 auf /healthz, Header gesetzt, non-root).
- **`.env.example`** vollständig gruppiert (App/DB/Auth/Storage/E-Mail/PDF/Jobs/
  Monitoring/Lieferanten/ERP/Zahlung/Sicherheit) mit Zweck/Pflicht/Beispiel/
  Format/Umgebung; **`scripts/check-env.mjs`** validiert Pflichtvariablen ohne
  Secret-Ausgabe; **`scripts/secret-scan.mjs`** + CI-Gate.
- **CI-Workflow `ci.yml`**: Syntax → Env-Validierung → Tests → Secret-Scan →
  Build. **Kein** automatisches Produktions-Deployment (nur mit Freigabe).
- **System-Seite:** Panel „Infrastruktur & Produktion" (Adapter-Status, interne
  Alarme, fällige geplante Jobs, E-Mail-Vorschau).
- Doku: `PRODUCTION_INFRASTRUCTURE.md` (Analyse-Tabelle, Hosting-Anforderungen,
  Varianten A/B, Container, Env, DB, Dateispeicher, Domain-/SPF-DKIM-DMARC-
  Checkliste, E-Mail, Monitoring, Alarmierung, Zahlung, CI/CD, Release, Wartung,
  Rollback, Produktions-Checkliste, getestet vs. vorbereitet, nächster Schritt).

### Tests
- `tests/referenz.test.js` auf **134/134** erweitert (32 neue Infra-Tests:
  Env-Validierung, signierte/abgelaufene/Cross-Tenant-Links, E-Mail-Vorschau/
  Header-Injection/nicht-konfiguriert, Reset-Token, Angebotsversand +
  Doppelschutz, Aufgabe/Retry/Idempotenz, geplanter Job/Zeitzone, Scrubbing
  ohne PII, Webhook-Signatur/Duplikat, manuelle Lizenz, leere Prod-DB,
  Rate-Limit) + Browser-Smoke (Infrastruktur-Panel, E-Mail-Vorschau).

## Phase 10 – Mandantenfähigkeit, Firmenkonten & Lizenzvorbereitung  (Schema v9)

### Architektur
- **Datenbank-pro-Mandant** (Namespace-Isolation): globale Registry
  `preisschmiede.mandanten.v1` + je Firma ein eigener Namespace
  `preisschmiede.tenant.<id>`. Kein gemeinsames Array zwischen Firmen →
  **Isolation durch Konstruktion**; gleiche Nummern (z. B. `ANG-2026-0001`,
  `KUN-0001`) in verschiedenen Firmen kollidieren nicht.
- **Verlustfreie Migration**: bestehende Einzelinstallation wird beim ersten
  Start zu „Mandant 1" **kopiert** (Legacy-Schlüssel bleibt als Backup, wird
  nicht gelöscht); Benutzer-Zuordnungen aus `db.users` erzeugt.
- **Aktiver Mandant** kommt aus Registry/Sitzung – **nie** aus URL/Formular/
  Browser-Parameter. `Store.load()/save()` routen auf den aktiven Namespace.

### Hinzugefügt
- Mandanten-Engine `mandant.js`: Tarife (basis < professional < intelligent),
  Feature-Flags (Tarif + Aktivierung + Lizenz), Lizenzstatus/Schreibrechte,
  Nutzung/Limits mit Warnstufen 80/90/100 % (Kulanz, kein harter Abbruch),
  **sichere Einladungen** (Token einmalig, zeitlich begrenzt, **gesalzen
  gehasht, nie im Klartext gespeichert/geloggt**), kontrollierter, zeitlich
  begrenzter, widerrufbarer Supportzugriff, Mandantenexport (nur eigene Daten).
- Mandanten-Verwaltung auf der **System-Seite** (nur Administration): aktive
  Firma + Tarif + Lizenzhinweis + Benutzer-/Speicherauslastung, Feature-Matrix,
  Firmenliste, Anlegen/Bearbeiten, **Firmenwechsel mit Timer-Wächter** und
  erzwungenem **Re-Login** im Zielmandanten, Mandantenexport.
- Aktive-Firma-Anzeige in der Seitenleiste (bei mehreren Mandanten).
- **Testmodus**: „2 Test-Firmen anlegen" (absichtlich gleiche Nummern) zur
  Isolationsprüfung – nur in Test-/Entwicklungsstufe, ohne Bestandsdatenverlust.
- Registry-Datenmodell: Tarife, Feature-Flags, Zuordnungen, Einladungen,
  Systemadmins, Supportzugriffe, Zahlungsabstraktion (Status **„nicht
  eingerichtet"**, keine echte Abbuchung, keine Kreditkartendaten).
- Doku: `MULTITENANCY.md` (Architekturprüfung, Strategie, Migrationsplan),
  Ergänzungen in `SECURITY.md`, `KNOWN_LIMITATIONS.md`.

### Ehrlichkeit / Grenzen
- Reine Offline-App ohne Server: eine **serverseitig erzwungene** Trennung ist
  ohne Backend nicht möglich; ein lokaler Nutzer mit Entwicklerwerkzeugen kann
  den `localStorage` einsehen. Gewählt: stärkste offline mögliche Isolation
  (getrennte Namespaces). Keine echten Zahlungen/E-Mails/öffentlichen
  Registrierungen/endgültigen Kontolöschungen aktiviert.

### Tests
- `tests/referenz.test.js` auf **102/102** erweitert (45 neue Mandanten-/
  Isolationstests: gleiche Nummern getrennt, kein Fremdzugriff, Namespaces ohne
  Fremd-Geheimnisse, Tarif-/Feature-/Lizenzlogik, Nutzungs-Warnstufen, Token-
  Hashing/Einmaligkeit/Ablauf, Support-Lebenszyklus, Zuordnungen, Export).
- Browser-Smoke (Playwright): System-Seite rendert, Test-Firmen mit gleichen
  Nummern angelegt, Isolation im echten `localStorage` bestätigt, keine
  Laufzeitfehler.

## Phase 9 – Pilotbetrieb & Betriebsüberwachung  (Schema v9)
### Nachtrag (Restlücken geschlossen)
- **Ersteinrichtungs-Assistent** (geführte Grundeinrichtung: Firma,
  Kalkulationsbasis, Maschinen, Material, Benutzer/Freigabestufe,
  Zusammenfassung) – überspringbar/fortsetzbar; Auto-Start nur bei leerer
  Installation.
- **Pilotfunktions-Kennzeichnung** im Menü (ab Freigabestufe Pilot; Lernen,
  Planung, Dokumente als „Pilot" markiert).
- **In-App-Versions-/Änderungsansicht** (Neu / behobene Fehler / bekannte
  Einschränkungen) auf der System-Seite.
- **Fehlgeschlagene Anmeldungen** und **Berechtigungsverstöße** werden ohne
  PIN/Secrets protokolliert (mit Fehler-ID).
- Systemstatus erweitert: letzte Migration, Hintergrundaufgaben,
  Materialpreis-Sync, letztes fehlgeschlagenes Backup.
- README.md um Doku-Index + Pilot-Hinweis ergänzt.
- `tests/referenz.test.js` auf **57/57** erweitert (Pilot-Testfälle:
  Staffel-Rüst/Stück, Maschinenkonflikt, veralteter Preis, optionale Position,
  Verkauf unter Selbstkosten, Kostenüberschreitung, fehlgeschlagenes Backup,
  Preisberechtigung, gesperrte URL, Duplikate, Revisionsvergleich).

### Hinzugefügt
- Betriebs-/Monitoring-Engine `betrieb.js`: Release-Stufen, Systemstatus,
  Healthchecks (nicht-konfigurierte Adapter = kein Systemfehler),
  Backup-Überwachung + Warnungen, aggregierte Betriebswarnungen,
  anonymisiertes Support-Paket (ohne Secrets, mit Vorschau + Sicherheitsnetz),
  Feedback-/Fehlerlog-Modelle, Pilotkennzahlen (echte Zahlen).
- Admin-**System-Seite** (Status/Health/Backup/Warnungen/Pilot-Kennzahlen/
  Feedback/Fehlerprotokoll/Support/Freigabestufe/Wartungsmodus).
- Globaler **Feedback-Knopf** (alle Rollen); Feedback-Statusworkflow.
- Globales **Fehlerprotokoll** mit Fehler-ID (keine Secrets/Personendaten);
  Fehler-ID in Modal-Fehlermeldungen.
- **First-Login-PIN-Pflicht** ab Freigabestufe Pilot (Standard-PIN abgelehnt).
- Release-Stufen-Banner für Administration.
- Datenschema **v9**: `feedback[]`, `fehlerlog[]`, `settings.betrieb`
  (releaseStufe/backupMeta/wartungsmodus), `user.pinGeaendert`.
- Pilot-Doku: PILOT_PLAN, PILOT_CHECKLIST, OPERATIONS_GUIDE, INCIDENT_RESPONSE,
  RELEASE_PROCESS, SUPPORT_GUIDE, PILOT_RESULTS_TEMPLATE.
### Tests
- `tests/referenz.test.js` auf **43/43** erweitert (Betrieb: Healthchecks,
  Backup-Warnungen, Support-Paket ohne Secrets, Warnungssortierung,
  Fehler-ID-Format, Pilotkennzahlen).

## Phase 8 – Gesamtprüfung & Produktionsvorbereitung
### Behoben
- **Hoch:** Angebots-Snapshot hielt Referenzen auf Firma/Kunde – spätere
  Stammdatenänderung hätte ein altes Angebot verändert. Jetzt tiefe Kopie in
  `Angebot.kundenAusgabe` (Invariante durch Test abgesichert).
- **Responsive:** horizontaler Überlauf auf Tablets (820 px) und kleinen
  Handys (≤360 px) auf allen Hauptseiten. Ursachen: nicht begrenzter
  `.main`-Grid-Track, 12-teilige Handy-Navigation, mobile Topbar, ungekapselte
  Tabellen. Jetzt 320–1600 px überlauffrei.
### Hinzugefügt
- `tests/referenz.test.js` (Referenzkalkulation TEST-REFERENZ-001, Snapshot-
  Invarianten, Migrationen, Sicherheitsbasis).
- Dokumentation: `CALCULATION_RULES.md`, `SECURITY.md`, `BACKUP_RESTORE.md`,
  `KNOWN_LIMITATIONS.md`, `DEPLOYMENT.md`, `ARCHITECTURE.md`, `AUDIT_REPORT.md`,
  `.env.example`, dieses Changelog.
- `Store.fresh`/`Store.migrate` exportiert (Testbarkeit).

## Phase 7D – Zeichnungen, Stücklisten & Maßübernahme  (Schema v8)
- Dokumenten-/Analyse-Engine (`dokumente.js`), Dokumentenseite, CSV-BOM-Import,
  konservative PDF-Textextraktion, ASCII-DXF, Materialabgleich, kontrollierte
  Übernahme, Revisionsvergleich. Ehrliche Formatkennzeichnung.

## Phase 7C – Fertigungsplanung  (Schema v7)
- Planungs-Engine (`planung.js`), 7 Ansichten inkl. Gantt/Kanban, Kapazität,
  Konflikte, Auto-Vorschlag, Rüstoptimierung, Werkstattansicht.

## Phase 7A – Management-Dashboard  (Schema v6)
- Analyse-Engine (`auswertung.js`), rollenbasiertes Dashboard mit Filtern,
  Vorperiodenvergleich, Drill-down, Export.

## Phase 4 – Angebotsgenerator  (Schema v5)
- Angebots-Engine, kundensichere PDF-Ausgabe, Auftragsumwandlung.

## Phase 3A/3B – Konfigurator & Kalkulation  (Schema v3/v4)
- Dynamischer Produktkonfigurator, vollständige Kalkulationslogik (Decimal,
  Snapshot, Staffelpreise).

## Phasen 1 & 2 – Grundlagen
- Anmeldung/Rollen, Stammdaten, Kunden/Projekte/Kommissionen, Lieferanten,
  Material, Mitarbeiter, Maschinen (Rüstzeit/-kosten).
