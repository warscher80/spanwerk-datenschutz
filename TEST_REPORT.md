# Testbericht – Preisschmiede (Final Audit)

**Datum:** 2026-08-01 · **Branch:** `claude/metalwork-estimation-app-9ez1ks` ·
**Schema:** v13 · **Bezugsdokument:** `FINAL_AUDIT.md`

Dieser Bericht listet **alle** im Abschluss-Audit gelaufenen Prüfungen mit
Ergebnis, Testumgebung und – ehrlich gekennzeichnet – der Unterscheidung
zwischen **echt ausgeführt**, **nur simuliert** und **nicht geprüft**.

---

## 1. Testumgebung

| Punkt | Wert |
|---|---|
| Laufzeit | Node.js 22 (headless, Linux-Container) |
| Browser | Chromium 1194 (Playwright, headless) |
| Auslieferung im Test | lokaler HTTP-Server auf `127.0.0.1` (**nicht** `file://`) |
| Speicher | `localStorage` + IndexedDB des Testbrowsers |
| Daten | ausschließlich generierte Testdaten, **keine** echten Kunden-/Firmendaten |
| Netzwerk | keine externen Aufrufe; keine E-Mail-, Zahlungs- oder ERP-Verbindung |

**Alle Lasttests liefen ausschließlich in dieser Testumgebung.** Es wurde kein
Produktivsystem und kein öffentliches Deployment berührt.

---

## 2. Gesamtergebnis

| Suite | Art | Ergebnis |
|---|---|---|
| Referenz-/Invarianten-/Migrationstests (`tests/referenz.test.js`) | Node, echt | **481 / 481** |
| Unabhängige Kalkulations-Kontrollrechnungen | Node, echt | **35 / 35** |
| Rollen / Mandanten / CSV / Migration / Performance | Node, echt | **32 / 32** |
| XSS / Responsive / PDF / Offline-PWA | Browser, echt | **20 / 20** |
| Final-Audit End-to-End über die echte UI | Browser, echt | **31 / 31** |
| Schaltflächen-Audit (alle 16 Seiten) | Browser, echt | **224 / 224** |
| Phase-14B Mobile-E2E | Browser, echt | **22 / 22** |
| Phase-15B Desktop-E2E | Browser, echt | **14 / 14** |
| Phase-15B Mobile-E2E | Browser, echt | **13 / 13** |
| Phase-16B Desktop-E2E | Browser, echt | **39 / 39** |
| Phase-16B Mobile-E2E | Browser, echt | **18 / 18** |
| `node --check` (alle `assets/js/*.js`, `sw.js`, `scripts/*.mjs`, `tests/*.js`) | statisch | fehlerfrei |
| Secret-Scan im Repository | statisch | sauber |
| `scripts/check-env.mjs` | statisch | OK |
| Produktions-Build `npm run copyweb` | Build | erfolgreich (28 JS-Dateien) |

**Summe: 729 automatisierte Prüfungen · 0 fehlgeschlagen.**

Es wurde **kein** fehlgeschlagener Test ignoriert, übersprungen oder
weginterpretiert. Zwei zunächst rot gemeldete Punkte waren nachweislich Fehler
im Auditskript, nicht im Produkt (siehe Abschnitt 8).

---

## 3. Fachliche Tests (Node)

### 3.1 Referenztests – 481/481

Abgedeckt: Kalkulationsformeln, Decimal-Rundung (`r2`/`r3`/`r4`),
Angebots-/Auftrags-/Rechnungsnummernkreise, Snapshot-Invarianten (historische
Belege ändern sich nicht bei Stammdatenänderung), Migrationen v1→v13,
Konfigurator- und Vorlagenlogik, Portal-Sicherheitskern, Nachtrags- und
Teilrechnungslogik, Offline-Sync-Idempotenz, Lagerkern (Bestandstöpfe,
Reservierung, Sperrung, Inventurdifferenz), QM-Kern (Prüfplanversionierung,
Toleranzbewertung, Sperr-/Nacharbeits-/Reklamationswege).

### 3.2 Unabhängige Kontrollrechnung – 35/35

Alle 35 Werte wurden **außerhalb der Engine** in reiner Arithmetik nachgerechnet
und mit dem Engine-Ergebnis verglichen:

- Materialkosten mit Verschnitt **und** Ausschuss (multiplikativ, **kein**
  doppelter Aufschlag)
- Arbeitszeit mit mehreren Mitarbeitern und unterschiedlichen Sätzen
- Maschinenzeit; **fixer** und **zeitabhängiger** Rüstpreis
- Serienteil: Rüstkosten korrekt auf die Stückzahl verteilt
- Fremdleistung mit Aufschlag
- vollständiger Preis-Wasserfall: direkt → Fertigungsgemeinkosten → Herstell →
  Selbstkosten → Risiko → Gewinn → Rabatt → Netto → USt → Brutto
- Deckungsbeitrag und tatsächlicher Gewinn

Zusätzlich geprüft und bestanden: **keine doppelten Aufschläge**,
**USt-Basis = Netto nach Rabatt**, **keine Division durch null** (leere
Kalkulation, Stückzahl 0 → 0 statt `NaN`/`Infinity`),
`0,1 + 0,2 = 0,30`, korrekte Behandlung negativer Werte.

### 3.3 Rollen, Mandanten, Export, Migration, Performance – 32/32

- **Rollen:** `werkstatt` ohne Zugriff auf Kalkulation, Angebote, Rechnungen,
  Material, Lager, Qualität, Stammdaten, System; `darfFinanzen() === false`;
  Einkaufspreise und Qualitätskosten gesperrt; **Leak-Detektor** über den
  mobilen Offline-Datensatz: keine Gewinn-, Selbstkosten- oder
  Einkaufspreisfelder enthalten. `buero` ohne Systemseite, ohne
  Prüfplanfreigabe, ohne Sonderfreigabe, ohne Sperraufhebung.
- **Mandanten (9 Prüfungen):** zwei Firmen mit **identischen IDs und Nummern**
  (gleiche Kunden-ID, gleiche Angebots-, Auftrags-, Rechnungsnummer, gleiche
  Kommission) – kein Cross-Tenant-Leak in Kunden, Angeboten, Aufträgen,
  Rechnungen, Dokumenten, Lager, Qualität. Fremdmandant-IDs werden auf
  Engine-Ebene aktiv abgewiesen.
- **CSV-/ERP-Export:** Trennzeichen, Quoting nach RFC 4180, Umlaute,
  **Formula-Injection-Schutz** (siehe Abschnitt 7).
- **Migration:** v1→v13 verlustfrei; wiederholte Migration derselben Instanz
  ändert nichts mehr (Idempotenz per Deep-Diff belegt).
- **Performance:** siehe Abschnitt 6.

---

## 4. Browser-Tests (echte UI)

### 4.1 End-to-End-Hauptablauf – 31/31

Ein durchgehender Durchlauf über die **normale Oberfläche**, nicht über
Konsolenaufrufe:

Anmeldung → Firmendaten → Benutzer/Rollen → Kunde (real über das Formular
angelegt) → Projekt/Kommission → Material + Lieferant → Maschine mit
Stundensatz und Rüstkosten → Produktkonfiguration → Kalkulation
(Material/Arbeit/Maschine/Rüst) → Freigabe → Angebot → Angebots-PDF →
Portalzugang → Auftrag → Reservierung/Wareneingang/Entnahme →
Fertigungsplanung → Zeiterfassung (Soll/Ist + 7 Timer-Schaltflächen im
Auftragsmodal) → Qualitätsprüfung → Abweichung → Nacharbeit →
Auftragsabschluss → Nachkalkulation → Lernbereich → Rechnung → Rechnungs-PDF →
Zahlungserfassung → Dashboard.

**Keine** JavaScript-Laufzeitfehler im gesamten Durchlauf.

### 4.2 Schaltflächen – 224/224

DOM-Scan über alle 16 Seiten und alle Register: 224 sichtbare Schaltflächen,
**alle mit Funktion**. Keine Platzhalter, keine dauerhaft deaktivierten
Schaltflächen ohne Erklärung, keine Render-Fehler.

### 4.3 XSS, Responsive, PDF, PWA – 20/20

- **XSS:** Skript-Payloads in Kunden-, Auftrags-, Material-, Lager- und
  QM-Feldern – kein Skript ausgeführt, keine Injektion im DOM.
- **Responsive:** 360×640, 430×932, 820×1180, 1180×820, 1366×768, 1920×1080
  über acht Seiten – kein horizontaler Seiten-Scroll, keine überlappenden
  Schaltflächen, keine verdeckten Dialoge.
- **PDF:** Angebot, alle 6 Rechnungsbelegarten (inkl. Schlussrechnung,
  Gutschrift, Storno), Prüfprotokoll, Abnahmeprotokoll, Inventur-/Lagerbericht
  – Umlaute und Eurozeichen korrekt, Summen korrekt, Kommission,
  Dokumentkennung und Seitenangabe vorhanden, **keine** internen Werte
  (Selbstkosten, Deckungsbeitrag, Einkaufspreise, Ursachenanalysen,
  Qualitätskosten) in Kundendokumenten.
- **PWA/Offline:** Service Worker steuert die Seite, **IndexedDB-Treiber aktiv**
  (kein `file://`-Fallback). Offline geprüft: Timer starten/pausieren/
  fortsetzen, Materialerfassung, Lagerentnahme, Qualitätsmessung, Neuladen
  (Daten und laufender Timer überleben), Wiederverbindung, **exakt-einmalige**
  Synchronisation (zweiter Sync erzeugt keine Duplikate), Konfliktanzeige.

---

## 5. Manuell/gezielt geprüfte Abläufe

Zusätzlich zu den Skripten wurden folgende Abläufe gezielt in der laufenden
Oberfläche kontrolliert (inkl. Bildschirmaufnahmen im Prüflauf):

- Auftragsdetail mit Soll-/Ist-Zeiten und Timer je Arbeitsgang
- Prüfplan-Editor: Kopffelder bleiben beim Öffnen des Schritt-Dialogs erhalten
- Rechnungsdetail → PDF-Ansicht, Druckschaltfläche überdeckt den Kopf nicht
- Lager-Register Reservierung / Wareneingang / Entnahme
- Qualitäts-Register Prüfaufträge / Abweichungen / Nacharbeit
- Mandantenwechsel mit erzwungenem Re-Login
- Mobile PWA: Anmeldung, Auftragsliste, Zeiterfassung, Lagerbuchung, Prüfung

---

## 6. Performance (nur Testumgebung)

Datenbestand: 500 Kunden, 10 000 Materialien, 2 000 Angebote, 1 000 Aufträge.

| Messung | Ergebnis |
|---|---|
| Suche über alle Materialien | 1 ms |
| Dashboard-Analyse (volle KPI-Berechnung) | 64 ms |
| Serialisierung der gesamten Datenbank | 12 ms |
| Datengröße (JSON) | 1,4 MB |

**Ehrliche Einordnung:** Der gesamte Bestand liegt in `localStorage`
(Browser-Limit typisch 5–10 MB **pro Mandant**). 1,4 MB bei dieser Datenmenge
heißt: für einen Kleinbetrieb ausreichend, für langjährigen Vollbetrieb mit
eingebetteten Dokumenteninhalten **nicht** unbegrenzt skalierbar.

---

## 7. Gefundene und behobene Fehler

| # | Schwere | Fund | Behebung | Beleg |
|---|---|---|---|---|
| A-1 | **hoch** | **CSV-Formula-Injection** im Lager-, Qualitäts- und ERP-Export: Werte wie `=HYPERLINK("http://evil","klick")` wurden ungeschützt exportiert und von Excel/LibreOffice als Formel ausgeführt. `app.js` schützte bereits korrekt – die später entstandenen Module `lager.js`, `qualitaet.js`, `rechnung.js` wichen davon ab. | Einheitlicher Schutz in allen drei Modulen: führendes `=`, `+`, `-`, `@`, Tab oder CR wird mit einem Apostroph neutralisiert, danach RFC-4180-Quoting. | Export mit Angriffswerten erneut erzeugt, Apostroph-Schutz im Ergebnis nachgewiesen |
| A-2 | niedrig | **Falsche Sicherheitsaussage** in `SECURITY.md`: dort war ein aktiver Fehlanmeldungs-Limiter aufgeführt. `infra.rateLimiter()` existiert und ist getestet, wird aber **von keinem Anmeldepfad aufgerufen** – einziger Aufrufer im gesamten Repository ist `tests/referenz.test.js`. | Aussage korrigiert: es gibt **kein** wirksames Anmelde-Rate-Limit. Vermerkt in `SECURITY.md`, `KNOWN_LIMITATIONS.md` und `FINAL_AUDIT.md`. Kein Code geändert. | Volltextsuche über alle `assets/js/*.js`: kein Aufruf außerhalb der Definition |

**Keine weiteren kritischen oder hohen Fehler offen.** Der einzige verbliebene
niedrige Punkt (fehlendes Anmelde-Rate-Limit) ist ohne Backend nicht sinnvoll
lösbar und daher als Einschränkung geführt, nicht als offener Defekt.
Alle übrigen verbleibenden Punkte sind bewusste Einschränkungen, keine Defekte
(siehe `KNOWN_LIMITATIONS.md`).

---

## 8. Testartefakte (ehrliche Korrektur eigener Prüfmethoden)

Zwei Prüfungen meldeten zunächst „fehlgeschlagen". Beide Meldungen waren
**Fehler im Auditskript**, nicht im Produkt. Sie werden hier offengelegt, statt
sie stillschweigend zu entfernen:

1. **Migrations-Idempotenz:** Das Skript verglich das zweimal migrierte Objekt
   mit einer *separat* erzeugten Migration; deren Feld `letzteMigration` trug
   einen anderen Zeitstempel. Ein Deep-Diff derselben Instanz vor/nach erneuter
   Migration ist leer → Idempotenz bestätigt.
2. **ERP-CSV-Schutz:** Das Skript übergab einen Beleg **ohne Positionen**, die
   erzeugte Datei bestand nur aus der Kopfzeile, in der es nichts zu schützen
   gab. Mit einer echten Position ist der Apostroph-Schutz vorhanden.

Zwei weitere zunächst rote E2E-Schritte (Zeiterfassung, Rechnungs-PDF) waren
falsche **Selektoren** im Skript: beide Ansichten öffnen in einem Modal bzw.
über die Detailansicht, nicht direkt auf der Seite. Nach Korrektur der
Selektoren bestanden beide.

---

## 9. Nur simuliert bzw. nicht geprüft (ehrlich)

Folgendes wurde **nicht** real getestet und darf nicht als getestet gelten:

- **Echte iOS-/Android-Geräte** – alle mobilen Tests liefen in headless
  Chromium mit Mobil-Viewport, nicht auf echter Hardware. Kamera/Scanner
  wurden über Browser-APIs simuliert.
- **E-Mail-Versand** – kein Dienst konfiguriert; die App zeigt ausschließlich
  eine Vorschau mit dem Status „nicht gesendet".
- **Zahlungs- und Bankanbindung** – nicht vorhanden, nur Abstraktion mit
  Status „nicht eingerichtet".
- **ERP-Livekopplung (KingBill u. a.)** – nur Dateiexport; keine Verbindung
  aufgebaut, keine API angesprochen.
- **Lieferanten-Live-APIs** – nicht konfiguriert; nur CSV-/DATANORM-Import.
- **Virenprüfung von Uploads** – findet nicht statt (kein Backend).
- **Mehrbenutzerbetrieb über einen Server** – existiert nicht; die Isolation
  ist rein clientseitig und daher **nicht serverseitig erzwungen**.
- **Steuerliche und rechtliche Konformität** (Rechnungsrecht, Registrierkasse,
  Aufbewahrung, DSGVO) – **nicht** geprüft, keine Aussage möglich.
- **Norm-/Sicherheitszertifizierung** – es wird **keine** behauptet.
- **Langzeit-/Dauerlast über Monate** – nicht durchgeführt.
- **`file://`-Betrieb** – funktioniert als Notfall-Fallback, wird hier
  **ausdrücklich nicht** als Produktionslösung bewertet oder getestet.

---

## 10. Reproduktion

```bash
node tests/referenz.test.js          # 481/481
node --check assets/js/*.js sw.js    # Syntaxprüfung
node scripts/check-env.mjs           # Umgebungsprüfung
npm run copyweb                      # Produktions-Build
```

Die Browser-Prüfungen (E2E, Schaltflächen, XSS, Responsive, PDF, PWA) laufen
über Playwright gegen einen lokalen HTTP-Server; sie benötigen zwingend
`http://127.0.0.1`, da Service Worker und IndexedDB unter `file://` nicht
verfügbar sind.
