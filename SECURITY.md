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
- **CSV-Formula-Injection:** Exporte maskieren Zellen, die mit `= + - @`
  beginnen (`csvZelle` in `app.js`).
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

## Sicherheitsbefunde (Kurzregister)

| Schwere | Befund | Status |
|---|---|---|
| Hoch | Angebots-Snapshot hielt Referenzen auf Firma/Kunde (spätere Stammdatenänderung hätte altes Angebot verändert) | **behoben** (tiefe Kopie in `kundenAusgabe`) |
| Mittel | `localStorage` unverschlüsselt | offen (Geräteschutz, dokumentiert) |
| Niedrig | Kein Anmelde-Rate-Limit | offen (lokale App) |

**Von Fachleuten prüfen lassen:** rechtliche DSGVO-Konformität, betriebliche
Datenschutz-/Aufbewahrungsregeln, ggf. Backend-Sicherheit bei späterer
Server-Erweiterung.
