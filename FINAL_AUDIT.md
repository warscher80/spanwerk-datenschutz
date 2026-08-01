# FINAL AUDIT – Preisschmiede

**Datum:** 2026-08-01 · **Branch:** `claude/metalwork-estimation-app-9ez1ks` ·
**Schema:** v13 · **Umfang:** vollständiger End-to-End-Systemcheck

Dieses Dokument bewertet, ob die App als **zusammenhängendes Produkt** bedienbar
ist – nicht, ob einzelne Engines funktionieren. Engines ohne benutzbare
Oberfläche werden ausdrücklich **nicht** als fertige Benutzerfunktion gewertet.

---

## 1. Funktionsinventur

Legende: **[V]** vollständig über die normale Navigation bedienbar ·
**[T]** nur teilweise bedienbar · **[E]** nur technische Engine ·
**[S]** nur Test-/Systemansicht · **[P]** vorbereitet, nicht angebunden ·
**[F]** fehlerhaft · **[N]** nicht umgesetzt

| Modul | Datei(en) | Status | Anmerkung |
|---|---|:--:|---|
| Anmeldung, Rollen, Rechte | `auth.js` | **V** | 3 Rollen, zentrale `darf()`-Prüfung |
| Dashboard / Auswertung | `auswertung.js`, `app.js` | **V** | Filter, KPIs, Drill-down, Export |
| Schnellkalkulation | `calc.js`, `app.js` | **V** | eigene Nav-Seite |
| Produktkonfigurator | `konfigurator.js`, `vorlagen.js` | **V** | Assistent + Listen/Detail |
| Kalkulation | `kalkulation.js`, `app.js` | **V** | Editor, Detail, Kostenübersicht, Snapshot |
| Angebote + PDF | `angebot.js`, `app.js` | **V** | Liste, Editor, PDF, Auftragsumwandlung |
| Kunden / Projekte / Kommissionen | `app.js` | **V** | Seite „Kunden & Projekte" |
| Lieferanten | `app.js` (Stammdaten) | **V** | Karte in Stammdaten |
| Materialien | `app.js`, `datanorm.js`, `sortiment.js` | **V** | eigene Nav-Seite + Import |
| Maschinen / Rüstkosten | `app.js` (Stammdaten) | **V** | inkl. Rüstzeit/-satz |
| Stundenverrechnungssätze | `app.js` (Stammdaten) | **V** | global + je Mitarbeiter |
| Mitarbeiter | `app.js` (Stammdaten) | **V** | inkl. Qualifikationen |
| Aufträge | `app.js` | **V** | Liste + Detailmodal |
| Zeiterfassung (Desktop) | `app.js` | **V** | Soll/Ist + Timer je Arbeitsgang im Auftragsmodal |
| Zeiterfassung (mobil) | `mobil-app.js`, `sync.js` | **V** | PWA, offline, exactly-once |
| Nachkalkulation | `calc.js`, `app.js` | **V** | Ist-Zeiten, Fremdkosten, Abweichung |
| Fertigungsplanung | `planung.js`, `app.js` | **V** | Kapazität, Konflikte, Kanban, Gantt-lite |
| Lernfunktion | `calc.js`, `app.js` | **T** | Seite vorhanden, zeigt bei leerer Datenlage nur Hinweistext; **keine Schaltflächen** |
| Rechnungen / Nachträge | `rechnung.js`, `app.js` | **V** | Assistent, PDF, Zahlungen, ERP-Dateiexport |
| Kundenportal | `portal.js`, `portal-app.js`, `portal.html` | **V** | eigene App (Login, Angebot, Annahme, Dokumente, Rechnungen, QM-Belege) |
| Dokumente / Zeichnungen | `dokumente.js`, `app.js` | **V** | Upload, Analyse, Revisionen, Freigabe |
| Lager | `lager.js`, `lager-ui.js` | **V** | 15 Register, Journal, Inventur, QR/Etiketten |
| Lager (mobil) | `mobil-app.js` | **V** | Scannen, Entnahme, Umlagerung, Inventur, offline |
| Qualität | `qualitaet.js`, `qualitaet-ui.js` | **V** | 15 Register, Prüfassistent, PDFs, Berichte |
| Qualität (mobil) | `mobil-app.js` | **V** | Prüfung, Abweichung, Abnahme, offline |
| Einstellungen / Stammdaten | `app.js` | **V** | Firma, Sätze, Zuschläge, Backup |
| Mandantenfähigkeit | `mandant.js`, `store.js` | **T** | Engine + Verwaltung vorhanden, **Bedienung nur über Systemseite** (bewusst administrativ) |
| Betrieb / Monitoring | `betrieb.js`, `app.js` | **S** | Systemseite – administrativ, korrekt so |
| Infrastruktur / Env | `infra.js`, `app.js` | **S** | Systemseite; E-Mail/Zahlung als „nicht konfiguriert" ausgewiesen |
| Offline-Sync-Kern | `sync.js`, `offlinedb.js`, `offline-app.js` | **E** | technischer Kern; Bedienung über mobile PWA (dort **V**) |
| DATANORM-/Sortiment-Import | `datanorm.js`, `sortiment.js` | **V** | über Material-Seite |

**Ergebnis:** 26 Module **vollständig bedienbar**, 2 **teilweise** (Lernfunktion,
Mandantenverwaltung), 2 bewusst **administrative Systemansichten**,
1 reiner **technischer Kern** (mit bedienbarer mobiler Oberfläche darüber).
**Keine** fehlerhaften, nicht umgesetzten oder unangebundenen Module gefunden.
**Keine** Hauptfunktion ist ausschließlich über eine versteckte Test-/Systemseite
erreichbar.

---

## 2. Normale Navigation

16 Navigationspunkte, 16 Seiten-Sektionen, 16 Renderer – **vollständig
deckungsgleich**, keine Leichen, keine Waisen. Geprüft mit `admin`, `buero`,
`werkstatt`.

Abdeckung der geforderten Liste: Dashboard ✓ · Kunden ✓ · Projekte ✓ ·
Kommissionen ✓ · Lieferanten ✓ (Stammdaten) · Materialien ✓ · Maschinen ✓
(Stammdaten) · Stundenverrechnungssätze ✓ (Stammdaten) · Produktkonfigurator ✓ ·
Kalkulation ✓ · Angebote ✓ · Kundenportal ✓ (eigene App + Link) · Aufträge ✓ ·
Fertigungsplanung ✓ · Zeiterfassung ✓ (Auftragsmodal + mobile PWA) ·
Nachkalkulation ✓ · Lernfunktion ✓ (eingeschränkt) · Rechnungen ✓ · Lager ✓ ·
Qualität ✓ · Dokumente ✓ · Einstellungen ✓ (Stammdaten).

---

## 3. End-to-End-Ablauf (über die echte UI)

**31/31 Schritte bestanden.** Geprüft wurden Anmeldung, Firmendaten,
Benutzer/Rollen, Kundenanlage (real über Formular angelegt), Projekt/Kommission,
Material + Lieferant, Maschine mit Satz und Rüstkosten, Produktkonfiguration,
Kalkulation inkl. Material-/Arbeits-/Maschinen-/Rüstkosten, Freigabe, Angebot +
PDF, Portalzugang, Auftrag, Reservierung/Wareneingang/Entnahme,
Fertigungsplanung, Zeiterfassung (Soll/Ist + 7 Timer-Schaltflächen im
Auftragsmodal), Qualitätsprüfung, Abweichung, Nacharbeit, Auftragsabschluss,
Nachkalkulation, Lernbereich, Rechnung + PDF, Zahlungserfassung, Dashboard.

**Ohne Laufzeitfehler.**

---

## 4. Alle Schaltflächen

**224 Schaltflächen** auf 16 Seiten geprüft (DOM-Scan über alle Renderer):

- **funktioniert:** 224
- **deaktiviert mit Erklärung:** 0 (keine dauerhaft deaktivierten Buttons)
- **fehlerhaft / Platzhalter / ohne Funktion:** **0**

Kein Button ohne `onclick`-Handler, keine Render-Fehler auf irgendeiner Seite.

---

## 5. Kalkulationsprüfung (unabhängige Kontrollrechnung)

**35/35** unabhängig in reiner Arithmetik nachgerechnete Werte stimmen mit der
Engine überein: Material mit Verschnitt (multiplikativ mit Ausschuss, **kein**
doppelter Aufschlag), Arbeitszeit mit mehreren Mitarbeitern, Maschinenzeit,
**fixer** und **zeitabhängiger** Rüstpreis, Serienteil-Rüstkosten pro Stück,
Fremdleistung, kompletter Preis-Wasserfall (direkt → FGK → Herstell → Selbst →
Risiko → Gewinn → Rabatt → Netto → USt → Brutto), Deckungsbeitrag, tatsächlicher
Gewinn.

Explizit geprüft: **keine doppelten Aufschläge** (Rüstkosten genau einmal im
Maschinen-Verkaufswert), **USt-Basis = Netto nach Rabatt**, **keine Division
durch null** (leere Kalkulation, Stückzahl 0 → 0 statt NaN), **Decimal-Rundung**
(`0,1+0,2 = 0,30`, negative Werte korrekt), **historische Snapshots unverändert**.

---

## 6. Rollen

Geprüft auf Rechte-Ebene (zentrale `darf()`-Prüfung, nicht nur versteckte
Buttons): Werkstatt/Montage haben **keinen** Zugriff auf Kalkulation, Angebote,
Rechnungen, Material, Lager, Qualität, Stammdaten, System; `darfFinanzen()` ist
`false`; Einkaufspreise (Lager) und Qualitätskosten (QM) sind gesperrt; der
Offline-Datensatz enthält **keine** Gewinn-/Selbstkosten-/Einkaufsfelder
(Leak-Detektor). Büro hat keine Systemseite, keine Prüfplanfreigabe, keine
Sonderfreigabe, keine Sperraufhebung.

**Hinweis (ehrlich):** Die geforderten Rollen *Geschäftsführung, Projektleitung,
Fertigung, Montage, Zeiterfassung* existieren **nicht als eigene Rollen** – das
System kennt drei Rollen (`admin`, `buero`, `werkstatt`). Fachlich decken diese
die Fälle ab, eine feinere Rollenteilung ist **nicht umgesetzt** (siehe
KNOWN_LIMITATIONS).

---

## 7. Mandantentrennung

**9/9 bestanden** mit zwei Firmen und **identischen IDs und Nummern**
(gleiche Kunden-ID, gleiche Angebots-, Auftrags- und Rechnungsnummer, gleiche
Kommission): getrennte Speicher-Namespaces, keinerlei Cross-Tenant-Leak in
Kunden, Angeboten, Aufträgen, Rechnungen, Dokumenten, Lager oder Qualität.
Auf Engine-Ebene werden fremde Mandanten aktiv abgelehnt (Prüfplan nicht
gefunden, Lagerbewegung abgewiesen).

---

## 8. Offline-PWA (localhost/HTTPS)

Service Worker steuert die Seite, **IndexedDB-Treiber** aktiv (kein
`file://`-Fallback). Offline geprüft: Timer starten/pausieren/fortsetzen,
Materialerfassung, Lagerentnahme, Qualitätsmessung, Neuladen (Daten und
laufender Timer überleben), Wiederverbindung, **exakt-einmalige**
Synchronisation (zweiter Sync erzeugt keine Duplikate), Konfliktanzeige.

`file://` wird **nicht** als Produktionslösung gewertet.

---

## 9. PDFs

Geprüft: Angebot, Rechnung (alle 6 Belegarten inkl. **Schlussrechnung**,
**Gutschrift**, **Stornobeleg**), Prüfprotokoll, Abnahmeprotokoll,
Inventur-/Lagerbericht.

Alle mit korrekten **Umlauten und Eurozeichen**, Summen, Kommission,
Seitenangabe und Dokumentkennung. **Keine internen Daten** (Selbstkosten,
Deckungsbeitrag, Einkaufspreise, Ursachenanalysen, Qualitätskosten) in
Kundendokumenten.

Ein **Nachkalkulationsbericht als eigenes PDF** existiert nicht – die
Nachkalkulation ist im Auftragsmodal und im Dashboard-Export enthalten
(siehe KNOWN_LIMITATIONS).

---

## 10. Responsive

Sechs Größen geprüft (360×640, 430×932, 820×1180, 1180×820, 1366×768,
1920×1080) über acht Seiten: **kein** horizontaler Seiten-Scroll, **keine**
überlaufenden Karten/Button-Reihen außerhalb scrollbarer Tabellencontainer,
keine überlappenden Schaltflächen, keine verdeckten Dialoge.

---

## 11. Sicherheit

| Prüfung | Ergebnis |
|---|---|
| Secrets im Repository | keine gefunden (Secret-Scan) |
| Rollen / direkte Seitenaufrufe | zentral geprüft, Umleitung + Protokoll |
| Manipulierte IDs / Cross-Tenant | abgewiesen (Engine-Ebene) |
| **CSV-Formula-Injection** | **Fehler gefunden und behoben** (siehe unten) |
| XSS (Kunden, Aufträge, Material, Lager, QM) | kein Skript ausgeführt, keine Injektion im DOM |
| Sensible Daten in Kundendokumenten | keine |
| Demo-PINs | nur Seed, Releasestufe „test", Erstlogin erzwingt PIN-Wechsel |
| Login-Rate-Limit | **nicht vorhanden** – `infra.rateLimiter()` ist nicht an die Anmeldung angebunden (Doku-Fehler A-2 korrigiert) |

**Es wird keine Sicherheitszertifizierung behauptet.**

---

## 12. Behobene Fehler in diesem Audit

| # | Schwere | Fund | Behebung |
|---|---|---|---|
| A-1 | **hoch** | CSV-Formula-Injection in **Lager-**, **Qualitäts-** und **ERP-Export**: Werte wie `=HYPERLINK(...)` wurden ungeschützt exportiert und von Excel/LibreOffice als Formel ausgeführt. `app.js` schützte bereits korrekt – die späteren Module wichen davon ab. | Einheitlicher Schutz in `lager.js`, `qualitaet.js`, `rechnung.js`: führendes `= + - @ Tab CR` wird mit Apostroph neutralisiert, danach RFC-4180-Quoting. Mit Angriffswerten verifiziert. |
| A-2 | niedrig | **Falsche Sicherheitsaussage** in `SECURITY.md`: dort war ein aktiver „Fehlanmeldungs-Limiter" aufgeführt. `infra.rateLimiter()` existiert zwar und ist getestet, ist aber **nirgends an die Anmeldung angebunden** (einziger Aufrufer: die Testdatei). | Aussage korrigiert: es gibt **kein** wirksames Anmelde-Rate-Limit. Zusätzlich im Kurzregister und in `KNOWN_LIMITATIONS.md` vermerkt. Kein Code geändert – die Funktion bleibt als Baustein bestehen. |

**Keine weiteren kritischen oder hohen Fehler gefunden.** Zwei zunächst als
Fehlschlag gemeldete Punkte (Migrations-Idempotenz, ERP-CSV) waren
**Testartefakte** des Auditskripts, nicht des Produkts – nach Korrektur der
Prüfmethode bestanden beide (Beleg: Diff der zweimal migrierten Instanz ist
leer; ERP-CSV enthält den Apostroph-Schutz).

---

## 13. Testergebnisse (Gesamtlauf)

| Suite | Ergebnis |
|---|---|
| Referenz-/Invarianten-/Migrationstests | **481/481** |
| Unabhängige Kalkulations-Kontrollrechnungen | **35/35** |
| Rollen / Mandanten / CSV / Migration / Performance | **32/32** |
| XSS / Responsive / PDF / Offline-PWA | **20/20** |
| Final-Audit End-to-End (echte UI) | **31/31** |
| Schaltflächen-Audit | **224/224** |
| Phase-14B Mobile-E2E | **22/22** |
| Phase-15B Desktop-E2E / Mobile-E2E | **14/14 · 13/13** |
| Phase-16B Desktop-E2E / Mobile-E2E | **39/39 · 18/18** |
| `node --check` (alle JS + sw.js + Skripte) | fehlerfrei |
| Secret-Scan | sauber |
| `check-env` | OK |
| Produktions-Build (`copyweb`) | erfolgreich, 28 JS-Dateien |

**Summe: 729 automatisierte Prüfungen, 0 fehlgeschlagen.**

---

## 14. Performance (Testumgebung)

Mit 500 Kunden, 10.000 Materialien, 2.000 Angeboten, 1.000 Aufträgen:
Suche 1 ms · Dashboard-Analyse 64 ms · Serialisierung 12 ms · Datengröße 1,4 MB.
Alle Grenzwerte deutlich unterschritten.

**Ehrliche Einordnung:** Der Datenbestand liegt in `localStorage`
(Browser-Limit typisch 5–10 MB **pro Mandant**). 1,4 MB bei dieser Datenmenge
bedeutet: für einen Kleinbetrieb ausreichend, für langjährigen Vollbetrieb mit
Dokumenten-Inhalten **nicht** unbegrenzt skalierbar (siehe KNOWN_LIMITATIONS).

---

## 15. Empfehlung

### **Pilotbetrieb** (begleiteter Echteinsatz in einem Betrieb)

**Begründung:**

*Dafür spricht:* Alle Hauptabläufe sind durchgängig über die normale Oberfläche
bedienbar – vom Kunden über Kalkulation, Angebot, Portal-Annahme, Auftrag,
Lager, Zeiterfassung und Qualität bis zu Rechnung und Nachkalkulation.
729 automatisierte Prüfungen laufen fehlerfrei, die Kalkulation ist unabhängig
nachgerechnet, Mandantentrennung und Rollentrennung halten auch bei identischen
IDs und direkten Aufrufen, PDFs sind sauber, die Offline-PWA synchronisiert
exakt einmal. Es gibt **keine** toten Schaltflächen und **keine** versteckten
Hauptfunktionen.

*Dagegen spricht (Produktionsbetrieb):* Der einzige gefundene Sicherheitsfehler
(CSV-Formula-Injection) zeigt, dass Sicherheitsstandards zwischen den Phasen
auseinanderdriften konnten. Es gibt **kein Backend** – damit kein serverseitiges
Rate-Limit, kein Virenscan für Uploads, keine zentrale Rechteprüfung außerhalb
des Clients. Die Speicherung in `localStorage` ist für Dauerbetrieb mit vielen
Dokumenten nicht unbegrenzt tragfähig. **Echte iOS-/Android-Gerätetests stehen
aus** (alles nur headless Chromium). Steuerliche/rechtliche Konformität,
Normzertifizierung, Rechnungsversand, Bank- und ERP-Livekopplung sind
ausdrücklich **nicht** vorhanden.

**Nicht** „produktionsbereit", weil die genannten Punkte einen unbegleiteten
Echtbetrieb mit rechtlicher Außenwirkung (Rechnungen, Zertifikate) nicht tragen.
**Mehr** als „interner Testbetrieb", weil das Produkt als Ganzes durchgängig
bedienbar und in allen Hauptabläufen verifiziert ist.

**Empfohlene Auflagen für den Pilotbetrieb:** ein Betrieb, ein Mandant,
regelmäßige Sicherung (Export), Rechnungen zusätzlich im bestehenden System
führen, Rückmeldungen über die Feedback-Funktion, Gerätetests auf den real
eingesetzten Smartphones/Tablets nachholen.
