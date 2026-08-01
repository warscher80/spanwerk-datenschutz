# Sicherheitshinweise – Preisschmiede

> Dies ist **keine** Sicherheitszertifizierung. Die App läuft vollständig
> **offline und lokal** (Vanilla JS, `localStorage`, kein Server, keine
> Datenbank). Viele klassische Server-Risiken entfallen dadurch, andere
> gelten dafür verschärft (lokaler Geräteschutz).

## Architekturbedingt entfallende Risiken

| Klasse | Status | Begründung |
|---|---|---|
| SQL-Injection | entfällt | keine SQL-Datenbank |
| Server-side API-Auth-Bypass | entfällt | keine Server-API |
| CSRF | entfällt | keine serverseitigen State-Changing Requests |
| Secrets im Repo/Log | entfällt/geprüft | keine Secrets, keine `.env` mit Werten |
| Pfadmanipulation serverseitig | entfällt | kein Datei-Backend |

## Umgesetzte Schutzmaßnahmen

- **PIN-Speicherung:** PINs werden nie im Klartext gespeichert. Es wird ein
  pro Benutzer zufälliger **Salt** und ein Hash (`Store.hashPin`) abgelegt
  (verifiziert in `tests/referenz.test.js`, Abschnitt SEC).
- **Rollenmodell:** `auth.js` steuert Navigation und Renderer über eine
  Rechtematrix; gesperrte Seiten werden auf die erste erlaubte Seite
  umgeleitet. Vertrauliche Kennzahlen (Gewinn/Deckungsbeitrag) sind für die
  Rolle Fertigung/Montage über `Auth.darfFinanzen()` ausgeblendet.
- **Kundensichere Angebotsausgabe:** interne Kalkulationsdaten
  (Einkaufspreise, interne Sätze, Gemeinkosten, Deckungsbeitrag, Gewinn)
  werden über eine Whitelist (`Angebot.kundenAusgabe`) erzeugt und durch einen
  rekursiven Leak-Detektor (`Angebot.enthaeltInterne`) vor jeder PDF-Ausgabe
  geprüft.
- **XSS:** Benutzereingaben werden vor der HTML-Ausgabe mit `esc()`
  maskiert (`&<>"`).
- **CSV-Formula-Injection:** **Alle** Exporte maskieren Zellen, die mit
  `= + - @`, Tabulator oder CR beginnen, mit einem vorangestellten Apostroph
  und quoten danach nach RFC 4180: `csvZelle` (`app.js`), `csvEscape`
  (`lager.js`, `qualitaet.js`) und `csvFeld` (`rechnung.js`, inkl.
  ERP-Dateiexport). *Historie: Die drei zuletzt genannten Module hatten diesen
  Schutz zunächst nicht – der Fehler wurde im Abschluss-Audit (2026-08-01)
  gefunden und behoben, siehe `FINAL_AUDIT.md` Abschnitt 12.*
- **Datei-Uploads (Phase 7D):** Endungs-/Größenprüfung, Ablehnung
  ausführbarer Dateien, Dublettenerkennung per Prüfsumme; es werden **keine**
  Makros/Formeln/Skripte ausgeführt (nur konservative Textextraktion).

## Grenzen / offen (ehrlich)

- **Kein Multi-User-Zugriffsschutz auf Serverebene.** Das Rollenmodell ist ein
  UI-/Anwendungsschutz auf dem lokalen Gerät. „Button verstecken" ist kein
  Serverschutz – ein technisch versierter lokaler Benutzer kann `localStorage`
  direkt einsehen/ändern. Für echten Mehrbenutzerbetrieb mit Trennung ist ein
  Server-Backend nötig.
- **Verschlüsselung ruhender Daten:** `localStorage` ist unverschlüsselt. Der
  Schutz hängt am Betriebssystem-/Geräteschutz (Gerätesperre, verschlüsselte
  Festplatte).
- **Rate-Limiting der Anmeldung:** nicht umgesetzt (lokale App).
- **Abhängigkeits-Scans:** Es werden keine externen Runtime-Abhängigkeiten im
  Browser geladen (QR-Bibliotheken sind offline eingebettet). Build-Tooling
  (Capacitor/Electron) sollte regelmäßig per `npm audit` geprüft werden.

## Mandantentrennung (Phase 10)

- **Modell:** Datenbank-pro-Mandant. Globale Registry
  (`preisschmiede.mandanten.v1`) verwaltet Firmenliste, Zuordnungen,
  Tarife/Feature-Flags, Supportzugriffe; jede Firma hat einen **eigenen**
  Speicher-Namespace `preisschmiede.tenant.<id>` mit der vollständigen db.
- **Isolation durch Konstruktion:** Es gibt kein gemeinsames Array zwischen
  Firmen. Kein Codepfad mischt Daten eines fremden Namespaces in die aktive db.
  Gleiche Nummern (Kunden/Angebote/Aufträge/Kommissionen) in verschiedenen
  Firmen sind zulässig und kollidieren nicht.
- **Aktiver Mandant:** wird aus der Registry/Sitzung bestimmt – **nie** aus
  URL, Formular oder Browser-Parameter. `Store.load()/save()` routen
  ausschließlich auf den aktiven Namespace.
- **Firmenwechsel:** Timer-Wächter (laufende Zeiterfassung blockiert den
  Wechsel), danach Sitzung beenden → Namespace umsetzen → db-Cache leeren →
  **Re-Login** mit einem Benutzer der Zielfirma. Kein Benutzer wandert zwischen
  Firmen.
- **Einladungen:** manueller, sicherer Ablauf (kein E-Mail-Dienst). Token ist
  **einmalig, zeitlich begrenzt, gesalzen gehasht** und wird **nie im Klartext
  gespeichert oder protokolliert** (nur `tokenHash` + `tokenSalt`).
- **Lizenzstatus** steuert Schreibrechte; **Daten bleiben stets lesbar und
  exportierbar** (auch bei „gesperrt"/„gekündigt") – Daten werden nie entzogen.
- **Supportzugriff:** nur mit ausdrücklicher Freigabe des Firmenadministrators,
  mit Grund, zeitlich begrenzt, protokolliert und widerrufbar.
- **Zahlung:** nur Abstraktion, Status **„nicht eingerichtet"**; keine echte
  Abbuchung, **keine Kreditkartendaten** gespeichert.
- **Ehrliche Grenze:** In einer reinen Offline-App **ohne Server** ist eine
  *serverseitig erzwungene* Mandantentrennung nicht möglich – ein lokaler
  Nutzer mit Entwicklerwerkzeugen kann den `localStorage` einsehen. Für echte
  Mehrfirmen-Server-Trennung (serverseitige Query-Erzwingung, signierte
  Downloads, echte Auth/Zahlung/E-Mail) ist ein Backend nötig. Siehe
  `MULTITENANCY.md` und `KNOWN_LIMITATIONS.md`.

## Produktionsinfrastruktur & Adapter (Phase 11)

- **Reproduzierbares Hosting:** Docker-Image mit **unprivilegiertem nginx**
  (non-root uid 101), `HEALTHCHECK /healthz`, Security-Header (CSP/HSTS/XFO/
  Referrer-Policy/Permissions-Policy), Directory-Listing aus, Dotfile-Sperre
  (`/\.` → 403). Managed-Static-Alternative mit `deploy/_headers`/`netlify.toml`.
- **Keine Secrets im Repo:** `scripts/secret-scan.mjs` (CI-Gate) + strikte
  `.dockerignore`; `.env.example` enthält nur leere Platzhalter. Env-Validierung
  (`scripts/check-env.mjs`) gibt **niemals Werte** aus.
- **E-Mail-Adapter:** Header-Injection-Schutz (CR/LF entfernt), E-Mail-
  Validierung, Anhangsbegrenzung, **keine** Secrets/internen Kalkulationswerte
  in Vorlagen, sichere einmalige Tokens mit Ablauf, **Doppelversandschutz**
  (Idempotenz). Ohne Dienst: kein Versand, keine vorgetäuschte Zustellung.
- **Signierte Download-Links:** mandantengebunden, zeitlich begrenzt,
  Cross-Tenant-Prüfung, konstante-Zeit-Vergleich (offline-Digest, echtes HMAC
  serverseitig nachzurüsten).
- **Zahlungs-Webhooks:** Signaturprüfung + idempotente Verarbeitung; **keine**
  Tarifänderung durch Browserparameter; **keine** Kartendaten.
- **Monitoring:** `scrubbe` entfernt PII/Secrets vor jeder externen Übertragung.
- **Rate-Limit:** `infra.rateLimiter()` existiert als geprüfter Baustein, ist
  aber **nicht** an die Anmeldung angebunden. **Es gibt derzeit kein
  wirksames Anmelde-Rate-Limit.** (Im Abschluss-Audit 2026-08-01 korrigierte
  Aussage – vorher stand hier missverständlich „Fehlanmeldungs-Limiter".)

## Sicherheitsbefunde (Kurzregister)

| Schwere | Befund | Status |
|---|---|---|
| Hoch | Angebots-Snapshot hielt Referenzen auf Firma/Kunde (spätere Stammdatenänderung hätte altes Angebot verändert) | **behoben** (tiefe Kopie in `kundenAusgabe`) |
| Hoch | **CSV-Formula-Injection** in Lager-, Qualitäts- und ERP-Export (`=`/`+`/`-`/`@` ungeschützt exportiert, von Excel/LibreOffice als Formel ausgeführt) | **behoben** 2026-08-01 (`lager.js`, `qualitaet.js`, `rechnung.js`) |
| Niedrig | SECURITY.md behauptete einen aktiven Anmelde-Limiter, der nicht angebunden ist | **behoben** 2026-08-01 (Aussage korrigiert) |
| Mittel | `localStorage` unverschlüsselt | offen (Geräteschutz, dokumentiert) |
| Niedrig | Kein Anmelde-Rate-Limit | offen (lokale App, kein Backend) |

**Von Fachleuten prüfen lassen:** rechtliche DSGVO-Konformität, betriebliche
Datenschutz-/Aufbewahrungsregeln, ggf. Backend-Sicherheit bei späterer
Server-Erweiterung.
