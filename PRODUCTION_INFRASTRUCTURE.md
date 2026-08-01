# Produktionsinfrastruktur – Hosting, Domain, E-Mail, Monitoring (Phase 11)

> **Ehrliche Kernaussage vorab.** Preisschmiede ist heute eine **statische,
> vollständig offline lauffähige Web-App** (reines HTML/CSS/**Vanilla-JS**,
> Persistenz im Browser-`localStorage`), ausgeliefert als Web, **Android**
> (Capacitor) und **Windows** (Electron). Es gibt **keinen Server, keine
> serverseitige Datenbank, keinen Worker, keinen SMTP-Dienst, keine
> Zahlungsanbindung**. Viele Punkte des Phase-11-Auftrags (PostgreSQL,
> persistenter Objektspeicher, serverseitige Berechnungen, echte Cron-Jobs,
> Webhooks, echter E-Mail-/Zahlungsbetrieb) setzen ein **Backend** voraus, das
> hier bewusst **nicht** existiert. Dieses Dokument trennt daher strikt:
> **(A)** was real und getestet vorbereitet ist und **(B)** was ein Backend
> erfordert und nur konzeptionell/ehrlich als „nicht konfiguriert" vorbereitet
> wurde. Nichts wird als funktionsfähig bezeichnet, das nicht getestet wurde.

## 1. Infrastruktur-Analyse (Ist-Stand)

| Bereich | Vorhanden | Funktionsfähig | Fehlt | Empfehlung |
|---|---|---|---|---|
| Webanwendung | ✅ statisch (HTML/CSS/JS) | ✅ getestet (134 Tests, Docker-Serve verifiziert) | Server-Runtime | Static Hosting (Variante A) oder Docker/nginx (Variante B) |
| Datenbank | ⚠️ `localStorage` je Gerät | ✅ offline; Migration idempotent | zentrale DB (PostgreSQL) | erst mit Backend; bis dahin Backup-Export/Import |
| Dateispeicher | ⚠️ `localStorage`/Data-URI | ✅ offline, mandantengetrennt | persistenter Objektspeicher (S3) | signierte Links vorbereitet (`infra.js`), real erst mit Backend |
| Hintergrundaufgaben | ⚠️ In-App | ✅ Queue-Logik getestet (Status/Retry/Idempotenz) | echter Worker | `QUEUE_DRIVER=inapp`; Redis/Worker erst mit Backend |
| E-Mail | ⚠️ Adapter vorbereitet | ❌ kein Versand (Vorschaumodus) | SMTP/API + verifizierte Domain | Adapter aktiv schalten, sobald Backend + Domain stehen |
| Domain | ❌ | ❌ | eigene Domain | Checkliste §8; **keine Domain gekauft** |
| Backups | ✅ Export/Import + Überwachung | ✅ getestet (isolierter Restore-Test dokumentiert) | automatisierter Server-Backup-Job | mit Backend: DB-Backup + PITR |
| Monitoring | ✅ interne Statusansicht | ✅ intern; Alarme abgeleitet | externer Dienst | `MONITORING_URL` optional, ohne PII (`scrubbe`) |
| Fehlerprotokollierung | ✅ intern (Fehler-ID, ohne Secrets) | ✅ getestet | externer Fehlertracker | `ERROR_TRACKING_DSN` optional, Scrubbing vorhanden |
| Zahlungsanbieter | ⚠️ Adapter vorbereitet | ❌ keine echte Abbuchung | Anbieter + Backend-Webhooks | manuelle Lizenzverwaltung; kein Zahlungsknopf ohne Anbieter |

Legende: ✅ real & getestet · ⚠️ offline-Ersatz/vorbereitet · ❌ nicht vorhanden.

## 2. Hosting-Anforderungen – ehrliche Bewertung

| Anforderung | Für STATISCHE App | Mit späterem Backend |
|---|---|---|
| Auslieferung Web-App | ✅ jeder Static-Host / nginx | ✅ |
| serverseitige Berechnungen | ❌ nicht nötig (Client rechnet) | erforderlich (Angebots-/Portal-Preise serverseitig) |
| sichere Authentifizierung | ⚠️ lokal (PIN, Rollen) | Server-Sessions/OAuth nötig |
| PostgreSQL / DB | ❌ nicht genutzt | erforderlich |
| persistenter Dateispeicher | ❌ (localStorage) | Objektspeicher nötig |
| PDF-Erstellung | ✅ clientseitig | optional serverseitig |
| Hintergrund-/geplante Aufgaben | ⚠️ In-App (App muss offen sein) | echter Worker/Cron nötig |
| WebSockets/Echtzeit | ❌ (nur WLAN-Sync im Desktop) | optional |
| horizontale Skalierung | ✅ trivial (statisch/CDN) | DB-/Worker-Skalierung nötig |
| Healthchecks/Logs/Backups | ✅ (Docker `/healthz`, interne Logs) | erweitern |
| getrennte Test-/Prod-Umgebung | ✅ getrennte Deploys/Container | getrennte DBs/Buckets |

**Fazit:** Für den **aktuellen** Funktionsumfang genügt ein Static-Host/Container
vollständig und zuverlässig. Sobald **Mehrbenutzer-Server**, echtes Kundenportal
mit serverseitiger Preisberechnung, echte E-Mails oder Zahlungen gewünscht sind,
ist ein Backend zwingend – das ist eine bewusste, dokumentierte Grenze.

## 3. Deployment-Varianten

### Variante A – verwaltetes Static Hosting (empfohlen für den Start)
- **Beispiele:** Netlify, Cloudflare Pages, GitHub Pages, Vercel (Static).
- **Build:** `node scripts/copyweb.mjs` → veröffentlicht `www/`.
- **Konfig:** `deploy/netlify.toml` + `deploy/_headers` (Security-Header, SPA-Fallback).
- **Eignung:** schnelle Bereitstellung, automatische Deployments, verwaltetes
  TLS/HTTPS, minimale Administration. **Keine** verwaltete DB nötig (App offline).
- **Grenzen:** keine Server-Laufzeit → keine echten Cron/Webhooks/SMTP.

### Variante B – Docker/VPS (volle Kontrolle)
- **Artefakt:** `Dockerfile` (Multi-Stage: Node baut Bundle → **unprivilegiertes
  nginx** serviert `www/` auf Port 8080, `HEALTHCHECK` auf `/healthz`).
- **Konfig:** `deploy/nginx.conf` (Security-Header, kein Directory-Listing,
  Dotfile-Sperre).
- **Eignung:** volle Kontrolle, eigene TLS-Terminierung/Reverse-Proxy, spätere
  Erweiterung um Backend-Container möglich (eigene Worker/DB/Objektspeicher).
- **Grenzen:** mehr Wartungsaufwand (Updates, TLS, Monitoring selbst betreiben).

| Kriterium | A – Managed Static | B – Docker/VPS |
|---|---|---|
| technische Eignung (heute) | ✅ | ✅ |
| Wartungsaufwand | gering | mittel–hoch |
| Skalierbarkeit | ✅ CDN | Container/LB |
| Dateispeicherung | – (offline) | – (offline), Backend nachrüstbar |
| Hintergrundaufgaben | – | eigener Worker nachrüstbar |
| PDF-Erstellung | Client | Client (Server nachrüstbar) |
| Datenbank | – | eigene DB nachrüstbar |
| Backups | Anbieter + App-Export | eigene Strategie + App-Export |
| Monitoring | Anbieter + intern | selbst + intern |
| Komplexität | niedrig | mittel |

> **Preise:** bewusst **keine** genannt – sie ändern sich und müssten aus einer
> aktuellen, verifizierten Quelle stammen. Zu erwartende **Komponenten** (nicht
> Preise): Static-Hosting **oder** ein kleiner Container/VPS; später optional
> Backend-Server, verwaltete PostgreSQL, Objektspeicher, E-Mail-Dienst,
> Monitoring/Fehlertracker, Zahlungsanbieter.

## 4. Container & reproduzierbarer Build (getestet)

`Dockerfile` + `.dockerignore` erzeugen ein schlankes Laufzeit-Image:
Multi-Stage, **nicht-root** (`uid 101`), `HEALTHCHECK` auf `/healthz`, **keine
Secrets**, **keine** Entwicklungswerkzeuge im Runtime-Image, **keine**
automatischen Beispieldaten (statische Dateien werden nur ausgeliefert).

Lokal verifiziert (Phase 11):
```
docker build -t preisschmiede-web .
docker run -d -p 8080:8080 preisschmiede-web
curl -f http://localhost:8080/healthz          # -> 200 "ok"
# non-root bestätigt (uid=101), Security-Header gesetzt, Dotfiles -> 403
```

## 5. Umgebungsvariablen

Vollständig gruppiert in `.env.example` (Anwendung, Datenbank, Auth, Storage,
E-Mail, PDF, Jobs, Monitoring, Lieferanten, ERP, Zahlung, Sicherheit) mit je
**Zweck, Pflicht, Beispiel (ohne echtes Secret), Format, Umgebung**. Single
Source of Truth ist `Infra.ENV_SPEC` (`assets/js/infra.js`).

**Validierung beim Start / in CI:** `node scripts/check-env.mjs [datei] [umgebung]`
prüft Pflichtfelder und Formate und gibt **niemals Werte** aus (keine Secrets in
Logs). Da die App offline läuft, sind aktuell **keine** Variablen Pflicht; das
Skript ist für den späteren Backend-Betrieb vorbereitet.

## 6. Datenbank

- **Heute:** eine JSON-Datenbank je Mandant im `localStorage`
  (`preisschmiede.tenant.<id>`), idempotente `Store.migrate()`, versioniert
  (Schema v9), Backup über Export/Import. Kein Server, kein Pooling nötig.
- **Mit Backend (vorbereitet, nicht aktiv):** verschlüsselte Verbindung
  (`DATABASE_URL`), Connection Pooling, versionierte/rückwärtskompatible
  Migrationen, Transaktionen, Indizes, getrennte Test-/Prod-DB, eingeschränkte
  DB-Benutzer, Point-in-Time-Recovery je nach Anbieter, Restore-Test.

## 7. Dateispeicher

- **Heute:** Dokumente/Zeichnungen liegen mandantengetrennt im `localStorage`
  (Größenlimit). Kein öffentlich erratbarer Pfad, da nichts serverseitig
  ausgeliefert wird.
- **Vorbereitet (`infra.js`):** **signierte, zeitlich begrenzte, mandanten­
  gebundene Download-Links** (`signierterLink`/`linkPruefen`) – Token =
  keyed Digest über `mandantId|pfad|ablauf|nonce`, Cross-Tenant-Prüfung,
  Ablaufprüfung. Für echten privaten Objektspeicher (private Dateien,
  Upload-Validierung, Virenscan, Aufbewahrung/Löschung) ist ein Backend nötig.
  Ehrliche Grenze: das echte HMAC gehört serverseitig; der Offline-Digest ist
  ein dokumentierter Ersatz.

## 8. Domain – Checkliste (keine Domain gekauft)

Beispielstruktur (Platzhalter, **nicht** festgelegt):
`app.beispiel-domain.at`, später optional `firma1.beispiel-domain.at` …

- [ ] DNS A/AAAA/CNAME auf Host zeigen
- [ ] SSL/TLS-Zertifikat (Anbieter/Let's Encrypt)
- [ ] HTTP → HTTPS Weiterleitung (an TLS-Terminierung)
- [ ] Hauptdomain + App-Subdomain
- [ ] E-Mail-Domain (nur wenn E-Mail-Dienst kommt)
- [ ] **SPF**, **DKIM**, **DMARC** (E-Mail-Authentizität)
- [ ] sichere Cookies (`Secure`, `HttpOnly`, `SameSite`) – **erst mit Backend/
      Session-Cookies**; die App nutzt aktuell **keine** Cookies
- [ ] erlaubte Redirect-URLs (Whitelist, `ALLOWED_REDIRECT_URLS`)
- [ ] CORS nur falls nötig (Backend-API)
- [ ] Security-Header aktiv (CSP/HSTS/XFO – siehe `deploy/`)

## 9.–12. E-Mail, Vorlagen, Sicherheit, Angebotsversand

`infra.js` liefert einen **modularen E-Mail-Adapter** und **Vorlagen** für alle
geforderten Arten (Einladung, Bestätigung, Reset, Angebot, Status, interne
Freigabe, Systemwarnung, Materialpreis-/Backup-Fehler) mit **Betreff/Text/HTML**
und Mandanten-Branding.

- **Ehrlich ohne Dienst:** `send()` täuscht **keine** Zustellung vor →
  Status „**nicht gesendet – Dienst nicht konfiguriert**", Vorschau im UI
  (System → Infrastruktur → E-Mail-Vorschau).
- **Sicherheit:** Header-Injection-Schutz (`sanitizeHeader`, CR/LF entfernt),
  E-Mail-Validierung, Anhangsbegrenzung (10 MB), **keine** Passwörter/Secrets/
  internen Kalkulationswerte in Vorlagen, sichere einmalige Tokens mit Ablauf
  (Reset/Einladung via `Mandant.einladungNeu`), **Schutz vor doppeltem Versand**
  über Idempotenzschlüssel (Aufgaben-Queue).
- **Angebotsversand (Ablauf):** freigegebenes Angebot → Empfänger prüfen →
  Vorlage → **Vorschau** → PDF prüfen → Bestätigung → Versand als idempotente
  Aufgabe → Status speichern. **Kein** erneuter Versand durch bloßes Neuladen
  (Idempotenz). Der echte Transport erfordert ein Backend.

## 13.–14. Hintergrund- & geplante Aufgaben

- **Queue** (`aufgabeNeu`/`aufgabeVerarbeiten`): Felder Mandant, Typ, Priorität,
  Status (`wartet/läuft/erfolgreich/fehlgeschlagen/wird wiederholt/abgebrochen`),
  Versuch/Max, nächster Versuch (Backoff), Fehler, Ergebnis, Zeiten,
  **Idempotenzschlüssel** gegen Doppelverarbeitung.
- **Geplante Jobs** (`GEPLANTE_JOBS`, `faelligeJobs`): Backup-Prüfung,
  Materialpreis-Alter, ablaufende Angebote, offene Timer, gefährdete
  Liefertermine, veraltete Lernvorschläge, temporäre Exporte, abgelaufene
  Einladungen sperren, Systemstatus. Zeitpläne konfigurierbar, **Mandanten­
  zeitzone** als Parameter berücksichtigt. Ehrliche Grenze: ohne Server laufen
  Jobs nur, **während die App geöffnet ist** – ein echter Cron braucht ein Backend.

## 15.–17. Monitoring, Alarmierung, Fehlertracking

- **Interne Statusansicht** (System-Seite) + abgeleitete **Alarme**
  (`Infra.alarme`) in den Stufen **kritisch/hoch/mittel**. Ohne E-Mail-Dienst
  sind Alarme **im Administrationsbereich sichtbar**.
- **Kein PII-Abfluss:** `Infra.scrubbe` entfernt Passwörter, Tokens, Cookies,
  E-Mail-Inhalte, Kundennamen, Kommissionen, Kalkulationswerte, Dokumentinhalte
  und personenbezogene Daten, **bevor** irgendetwas an ein externes Monitoring/
  Fehlertracking ginge. Extern nur mit `MONITORING_URL`/`ERROR_TRACKING_DSN`.
- **Fehler-ID** intern für Supportanfragen (bereits Phase 9, ohne Secrets).

## 18. Zahlungsanbieter

Austauschbarer **Zahlungsadapter** (`zahlungAdapter`): Abo/Status/Test/
Verlängerung/Kündigung, **Webhook-Signaturprüfung** (`webhookSignaturPruefen`,
konstante-Zeit-Vergleich), **idempotente** Ereignisverarbeitung gegen ein
Ereignis-Log. Regeln: **keine Kartendaten** gespeichert, **keine** Tarifänderung
allein aufgrund eines Browserparameters, strikte Trennung Test/Produktion. Ohne
Anbieter: **manuelle Lizenzverwaltung**, Status „nicht konfiguriert", **kein**
Zahlungsknopf. Echte Abbuchung erfordert Backend + Anbieter.

## 19. CI/CD

`.github/workflows/ci.yml` (Qualitäts-Gates je Push/PR): Syntaxprüfung
(`node --check` = „TypeScript-Prüfung" für reines JS), Env-Validierung,
Referenz-/Berechnungs-/Berechtigungs-/Sicherheitstests (`tests/referenz.test.js`),
**Secret-Scan** (`scripts/secret-scan.mjs`), Produktions-Build (`copyweb`).
`android.yml` baut zusätzlich APK/EXE-Release. **Kein automatisches
Produktions-Deployment** – Veröffentlichung nur kontrolliert und mit
ausdrücklicher Freigabe (siehe `RELEASE_PROCESS.md`). Bei fehlgeschlagenen Tests
kein Deployment.

## 20.–22. Release, Wartungsmodus, Rollback

- **Release-Prozess:** siehe `RELEASE_PROCESS.md` (Version → Changelog → Backup →
  Testumgebung → Migration testen → E2E → Freigabe → ggf. Wartungsmodus →
  Produktion → Healthchecks → Stichprobe → Monitoring → Rollback bei Fehler).
- **Wartungsmodus:** Admin-Schalter (System-Seite), Nutzerhinweis,
  laufende Timer werden berücksichtigt, Admin-Zugriff bleibt, Ende protokolliert.
- **Rollback (isoliert getestet, nie destruktiv auf Produktion):** vorheriges
  App-Artefakt (APK/EXE/Static-Deploy) zurückrollen; Daten aus Backup
  wiederherstellen (Import in getrenntem Profil); Migration ist idempotent und
  additiv (rückwärtskompatibel). Datenbank-/Dateispeicher-Rollback erst mit
  Backend relevant.

## 23. Produktions-Checkliste (vor Freigabe)

- [ ] Domain + HTTPS + HTTP→HTTPS + Security-Header aktiv
- [ ] (mit Backend) sichere Cookies, Produktions-DB, Objektspeicher
- [ ] Backups + **erfolgreicher** isolierter Restore-Test
- [ ] Secrets nur in Secret-Verwaltung (Secret-Scan grün)
- [ ] (mit E-Mail) E-Mail-Domain + SPF/DKIM/DMARC
- [ ] Monitoring + Alarmierung aktiv
- [ ] Hintergrund-/geplante Aufgaben konfiguriert
- [ ] Healthchecks grün · Rate-Limits gesetzt
- [ ] mind. ein echter Administrator, **keine** Standard-PINs
- [ ] **keine** Beispieldaten, **keine** Testbenutzer, **keine** Debug-Ausgaben
- [ ] keine offenen kritischen/hohen Fehler
- [ ] Kalkulations-Referenztests grün · Cross-Tenant-Tests grün

## 24. Tests (Phase 11)

`tests/referenz.test.js` deckt die auf das Offline-Modell anwendbare Teilmenge
der geforderten 30 Tests ab (insgesamt **134** Tests grün): fehlende
Umgebungsvariable, Speicher-Healthcheck, mandantenbezogener + Cross-Tenant-
Dateizugriff über signierten Link, abgelaufener Link, E-Mail-Vorschau +
Header-Injection-Schutz, nicht konfigurierter E-Mail-Dienst, Reset-Token,
Angebotsversand + Doppelversandschutz, Hintergrundaufgabe/Retry/Idempotenz,
geplanter Job + Zeitzonenparameter, Monitoring ohne PII (Scrubbing),
Webhook-Signatur + doppeltes Ereignis, manuelle Lizenz, leere Produktions-DB
ohne Beispieldaten, Rate-Limit. Zusätzlich Browser-Smoke (Docker-Serve,
Security-Header, `/healthz`, System-Infrastruktur-Panel + E-Mail-Vorschau).

## Zusammenfassung: getestet vs. nur vorbereitet

**Getestet & reproduzierbar:** statisches Bundle, Docker-Serve (non-root,
Healthcheck, Header, Dotfile-Sperre), Env-Validierung, Secret-Scan, CI-Gates,
Adapter-/Queue-/Job-/Scrubbing-/Signatur-Logik (Unit-Tests), interne
Alarme/Statusansicht, E-Mail-**Vorschau**.

**Nur vorbereitet (Backend nötig, ehrlich „nicht konfiguriert"):** echter
E-Mail-Versand, echte Zahlungen/Webhooks, serverseitige DB/Objektspeicher,
echte Cron-Jobs, externes Monitoring/Fehlertracking, eigene Domain/HTTPS.

## Empfehlung & nächster Schritt

- **Empfohlene Startvariante:** **A – Managed Static Hosting** (schnell, TLS
  inklusive, minimale Wartung); **B – Docker/VPS** für volle Kontrolle und als
  Basis, sobald ein Backend hinzukommt.
- **Benötigte externe Dienste (erst bei Serverbetrieb):** Static-Host **oder**
  Container/VPS; später Backend, verwaltete PostgreSQL, Objektspeicher,
  E-Mail-Dienst, Monitoring/Fehlertracker, Zahlungsanbieter.
- **Zugangsdaten:** aktuell **keine** nötig/vorhanden (offline). Für Backend-
  Betrieb fehlen sämtliche produktiven Secrets bewusst (gehören in eine
  Secret-Verwaltung).
- **Nächster Schritt:** **kontrollierte Veröffentlichung** (nur mit
  ausdrücklicher Freigabe) und das **Kundenportal** (Phase 12), das für echte
  serverseitige Preisberechnung und sichere Kundenzugriffe ein Backend benötigt.

> Ohne ausdrückliche Freigabe erfolgt **kein** öffentliches Deployment, **kein**
> Domainkauf, **kein** echter E-Mail-Versand und **keine** echte Zahlungs­
> aktivierung.
