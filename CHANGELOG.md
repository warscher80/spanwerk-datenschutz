# Changelog – Preisschmiede

Format orientiert an „Keep a Changelog". Versionierung bezieht sich auf das
Datenschema (`store.js` `version`).

## Phase 16A – Qualitätsmanagement-Kern, Prüfpläne & Abweichungen  (Schema v13)

### Hinzugefügt
- **QM-Engine `assets/js/qualitaet.js`** (rein/testbar, keine UI): konfigurierbare
  Qualitätsstammdaten (Prüfarten, Merkmale, Methoden, Toleranzen, Fehlerarten/
  -klassen, Risikostufen, Abweichungsgründe, Korrekturmaßnahmen,
  Zertifikatsarten, Reklamationsarten, Freigabestufen).
- **Versionierte Prüfpläne** mit Freigabe-Workflow und **unveränderbarem
  Prüfplan-Snapshot** je Prüfauftrag – spätere Vorlagenänderungen verändern
  laufende/abgeschlossene Aufträge nicht. Prüfschritte mit 13 Prüfzeitpunkten,
  15 Merkmaltypen, Soll/Toleranzen, Methode, Prüfmittel, Stichprobe, Pflicht-,
  Foto-, Dokument- und Freigabepflicht sowie „bei Fehler sperren".
- **Zentrale Toleranzprüfung**: `Abweichung = Ist − Soll`, Grenzwerte
  **eingeschlossen**, asymmetrische Toleranzen, Ergebnisse innerhalb/außerhalb/
  Nachprüfung/nicht bewertbar; Messung mit ungültigem Prüfmittel ergibt nie
  stillschweigend „bestanden".
- **Prüfaufträge** (9 Status) mit zentraler Auswertung (offene Pflichtschritte,
  sperrende Fehler, fehlende Nachweise) und geschütztem Abschluss.
- **Wareneingangsprüfung** über den Phase-15A-Lagerkern: QS-Bestand bleibt
  gesperrt, Teilfreigabe gibt nur die geprüfte Menge frei (**keine zweite
  Bestandslogik**).
- **Abweichungen** (9 Status, Doppelschutz über Idempotenzschlüssel),
  **Sperrung** von Bauteil/Materialcharge/Arbeitsgang/Auftragsteil/Lieferung/
  Montagefreigabe nur mit Berechtigung, Grund, Benutzer, Zeitpunkt und Audit –
  inkl. Ermittlung betroffener Reservierungen/Entnahmen/Aufträge/Kommissionen.
- **Nacharbeit** (Herkunft intern/Lieferant/Kunde/konstruktiv/**ungeklärt**),
  **Nachprüfung** aus demselben Snapshot, **Ausschuss** mit Lagerbuchung und
  getrennten Qualitätskosten, **Sonderfreigabe** (nur mit Beurteilung und
  freigebender Person).
- **Ursachenanalyse** mit strikt getrennten Kandidaten und bestätigter Ursache
  (5-Why + Mensch/Maschine/Material/Methode/Umgebung/Messung).
- **Korrekturmaßnahmen** (8 Status) mit Wirksamkeitsprüfung, **Kundenreklamation**
  (9 Status, Bewertung nur ausdrücklich mit Begründung) und
  **Lieferantenreklamation** mit direkter Chargensperre.
- **Qualitätskosten** nach 11 Kostenarten, **Prüfmittel/Kalibrierung** inkl.
  Ermittlung betroffener früherer Prüfungen, **Audit-Protokoll** aller
  Qualitätsaktionen.
- **Offline-Übernahme** über die Phase-14-Queue: Idempotenz, zentrale
  Toleranzberechnung, Konfliktprüfung (fehlender/abgeschlossener Prüfauftrag,
  abweichende Prüfplanversion), **keine automatische Freigabe offline**, keine
  doppelte Abweichung, lokale Daten bleiben bei Konflikt erhalten.
- **Schema v13**: additive QM-Arrays in `store.js` (`fresh`/`migrate`, ohne
  Datenverlust) + `settings.qualitaet`; Beispieldaten nur in Testumgebung.
  `qualitaet.js` in `index.html`, `mobil.html`, `sw.js`-SHELL (v5) und Testharness.

### Tests / Prüfungen
- Referenztests **441/441** (95 neue QM-Tests) + Ablauf-Durchlauf über die
  Beispieldaten; bestehende E2E unverändert grün (Desktop 14/14, Mobil 13/13).
  `node --check`, Secret-Scan, Produktions-Build grün.

### Ehrlich / Grenzen
- **Keine Normkonformität und keine Zertifizierung wird behauptet.** Keine
  Schweiß-, Bau- oder Qualitätsnorm ist im Code hinterlegt – Normen und
  Prüfvorschriften sind ausschließlich konfigurierbare Freitext-Referenzen.
- **Keine automatische Schuldzuweisung**, keine automatische Sonderfreigabe,
  keine automatische Bewertung von Reklamationen, keine automatische
  Kostenweitergabe, **keine qualifizierte elektronische Signatur**.
- Noch **keine Qualitätsoberfläche** und keine mobile QM-Oberfläche.

## Phase 15B – Lageroberfläche, Inventur, QR-Erfassung & mobile Buchungen  (Schema v12)

### Hinzugefügt
- **Desktop-Lager-UI `assets/js/lager-ui.js`** (neue Seite „Lager", 15 Register)
  auf demselben Phase-15A-Kern – **keine zweite Bestandslogik**: Dashboard mit
  allen Bestandsarten und Warnungen (Lagerwert nur mit Preisrecht), Artikel-/
  Bestandsübersicht mit Filtern, Lagerstruktur (Standort→Lagerplatz) inkl.
  Sperren/Etikett, **unveränderbares Bewegungsjournal** mit Suche/Filter/Detail/
  **Gegenbuchung**/CSV (keine Löschschaltfläche), Wareneingangs-Assistent
  (Teillieferung, Mehrlieferungswarnung, beschädigte Menge, Charge/Schmelze/
  Zertifikat, QS-Status, Lagerplatz, EK-Snapshot), Reservierung (voll/teilweise,
  Fehlmenge → Bestellvorschlag), Entnahme (gegen Reservierung, Warnung bei
  ungewöhnlicher Menge), Rückgabe (referenziert Entnahme, optional als
  Reststück), Umlagerung, Reststückverwaltung (Langgut-Restlänge live, Bleche),
  Chargen mit **Rückverfolgung vorwärts und rückwärts**, Sperr-Auswirkungs-
  analyse und Entsperren mit Grund + Audit, Inventur, Bestellungen, QR/Etiketten,
  Berichte.
- **Inventur** (Engine + UI): Voll-/Lagerplatz-/Artikel-/Stichprobeninventur,
  Zählliste aus Systembestand, **zweite Zählung bei hoher Abweichung** (Freigabe
  blockiert), Freigabe nur mit Recht, **Korrekturbuchungen** als
  `INVENTURDIFFERENZ` (idempotent), Abschluss; Differenzwert nur mit Preisrecht.
- **Bestell-Workflow** (9 Status von Entwurf bis geliefert/storniert) mit
  Historie und Freigaberecht – **nichts wird automatisch versendet**.
- **QR-Codes/Etiketten**: Referenzcode `PS:<LP|AR|CH|RS|BO|WE>:<id>` (nur sichere
  Referenz, **keine Preise**), typabhängige Etikettdaten, druckbare Ansicht.
- **Berichte/Exporte**: Bestand, Bewegungen, Fehlmengen, Inventur als CSV oder
  Druckansicht; Wertspalten nur mit `einkaufspreiseSehen`.
- **Mobile Lageransicht** in der PWA (`mobil.html`, `mobil-app.js`): Scannen/
  Code, Entnahme, Umlagerung, Inventurzählung, Reststück, Wareneingang
  (rollenabhängig), Bestandsliste ohne Preise, Sync-Status. Buchungen laufen über
  die **bestehende Phase-14-Queue** (`Offline.ereignis({typ:"lager"})`);
  `offline-app.js` übergibt sie beim Sync an `Lager.uebernehmeOffline`
  (Neuvalidierung, exactly-once, **Konflikt statt negativem Bestand**).
- **Mobile Inventurzählung** bildet die Differenz erst beim Sync gegen den
  **aktuellen** Systembestand – veraltete Offline-Bestände gelten nie als
  verbindlich.
- Erweiterte **Rollenmatrix** (15 Rechte inkl. umlagern, inventurZaehlen,
  inventurFreigeben, chargeEntsperren, berichteExportieren); Seite „Lager" für
  admin/buero, Werkstatt nutzt die mobile Ansicht.
- `db.lagerInventuren` (Migration additiv), Beispiel-Inventur und Beispiel-
  Bestellung im Testdatensatz; `lager-ui.js` in `index.html` und `sw.js`-SHELL
  (v4), `lager.js` zusätzlich in `mobil.html`.

### Behoben
- `artikelUebersicht` referenzierte eine undefinierte Variable (`bws`).
- Journal-Bewegungsnummern und CSV-Schaltfläche kosmetisch korrigiert.

### Tests / Prüfungen
- Referenztests **346/346** (23 neue); **Desktop-E2E 14/14**; **Mobile-E2E
  13/13** (Offline-Buchung, Reload, exactly-once 10→11/11→11, Konflikt, mobile
  Inventurdifferenz −3). `node --check`, Secret-Scan, Produktions-Build grün.

### Ehrlich / Grenzen
- Keine Bestandsbewegung wird gelöscht (nur Storno/Gegenbuchung), keine zweite
  Bestandsengine, keine echte Bestellung versendet, keine ERP-Lagerverbindung,
  keine steuerrechtliche Lagerbewertung, kein geometrisches Nesting. Technische
  Eignung von Reststücken wird nie automatisch bestätigt.

## Phase 15A – Lagerkern, Bestandsbuchungen & Reservierungen  (Schema v12)

### Hinzugefügt
- **Lager-Engine `assets/js/lager.js`** (rein/testbar, keine UI): Lagerstruktur
  (Standort/Lager/Bereich/Regal/Lagerplatz), Lagerartikel, zentrale
  Bestandsberechnung (`verfügbar = physisch − reserviert − gesperrt`; bestellte
  Ware kein physischer Bestand; Qualitätsprüfbestand separat), **unveränderbares
  Bewegungsjournal** mit 14 Bewegungsarten (WARENEINGANG…LIEFERANTENRETOURE,
  STORNO) inkl. Idempotenzschlüssel und Preis-Snapshot.
- **Wareneingang** mit Teil-/Mehr-/Minderlieferung, beschädigter/akzeptierter
  Menge, Charge + Zertifikaten + Lagerplatz; Bestellfortschritt (teilgeliefert/
  abgeschlossen).
- **Chargen** mit Rückverfolgung Lieferant→Wareneingang→Charge→Lagerplatz→
  Auftrag→Kommission; Charge sperren/entsperren (gesperrte Charge nicht
  entnehmbar).
- **Reservierungen** (voll/teilweise, keine stille Überreservierung, Fehlmenge,
  Priorität, benötigt-bis); **Entnahme/Rückgabe** (Rückgabe referenziert
  Entnahme; tatsächlicher Verbrauch = Entnahmen − Rückgaben).
- **Reststücke** inkl. Langgut-Restlänge (Ausgangslänge − verwendet −
  Schnittverlust), Status verfügbar…verschrottet.
- **Mindestbestand + Bestellvorschlag** (Ziel + reservierter Fehlbedarf −
  verfügbar − bestellt; Verpackungseinheit/Mindestbestellmenge; keine negativen
  Vorschläge), **Umlagerung/Korrektur/Inventurdifferenz/Storno**.
- **Bestandsbewertung** technisch (letzter EK / gleitender Durchschnitt /
  Charge); **Offline-Übernahme** mit Neuvalidierung + Konfliktspeicherung
  (nichts still löschen, keine unbemerkte negative Menge).
- **Rechtematrix** Lager (Cross-Tenant abgelehnt; Werkstatt ohne Einkaufspreise/
  Wareneingang/Korrektur).
- **Schema v12**: additive Lager-Arrays in `store.js` (`fresh`/`migrate`, ohne
  Datenverlust) + `settings.lager`; Beispieldaten nur in Testumgebung.
  `lager.js` in `index.html`, `sw.js`-SHELL (v3) und Testharness eingebunden.

### Tests / Prüfungen
- `tests/referenz.test.js` **323/323** (46 neue Lagertests) + Materialfluss-
  Durchlauf über die Beispieldaten; `node --check` alle JS, Secret-Scan,
  Produktions-Build grün.

### Ehrlich / Grenzen
- Noch **keine** Lageroberfläche (nur Kern). Keine Bewegung wird gelöscht;
  Korrektur nur per Storno/Gegenbuchung. Keine steuerrechtlich verbindliche
  Lagerbewertung, keine Live-Bestellung, keine ERP-Lageranbindung. Kein
  Nesting/keine Verschnittoptimierung vorgetäuscht.

## Phase 14B – mobile Werkstatt- & Montageoberfläche  (Schema v11)

### Hinzugefügt
- **Mobile PWA-Oberfläche** `mobil.html`, `assets/css/mobil.css`,
  `assets/js/mobil-app.js` für Werkstatt/Montage – nutzt **denselben
  Phase-14A-Offline-Kern** (Sync/OfflineDB/Offline), keine zweite Offline-Logik.
- **Ansichten:** Heute (Schnellaktionen, laufender Timer, heute geplant),
  Auftragssuche (aktive/geplante Aufträge zuerst sortiert), Zeit-Timer
  (Start/Pause/Fortsetzen/Beenden mit Gut-/Ausschuss-/Nacharbeit-Mengen),
  Maschine/Rüstzeit/Stillstand, Materialverbrauch, Stückzahl, Montage-
  Tagesbericht, **Fotos** (lokal per Canvas komprimiert, Status „nur lokal",
  kein vorgetäuschter Upload), offline verfügbare freigegebene Dokumente, Sync-
  und **Konfliktansicht** (Retry/lokal stornieren), Profil, **Terminalmodus**
  (Mitarbeiter-PIN statt Sammelkonto, Inaktivitäts-Rückkehr), PWA-Installations-
  hinweis (iOS/Android).
- **Rollenschutz:** Werkstatt/Montage sehen keine Verkaufs-/Einkaufspreise,
  Deckungsbeiträge, Gewinne oder Rechnungsdaten (im E2E über alle Ansichten
  geprüft).
- `offline-app.js`: `ereignis()` unterstützt Nicht-Timer-Datensätze
  (Maschine/Material/Montage/Stückzahl/Foto) über `Sync.recordNeu`; neue Exporte
  `stornieren(recordId)` (markiert CANCELLED, löscht nicht) und `record(id)`.
- `sw.js`-SHELL um `mobil.html`, `assets/css/mobil.css`, `assets/js/mobil-app.js`
  erweitert (Cache `preisschmiede-shell-v2`); `copyweb.mjs` kopiert `mobil.html`;
  Link auf die mobile App aus `index.html`.

### Behoben
- `assets/css/mobil.css`: Toast-Overlay blockierte Touch-Eingaben auf Dialog-
  Buttons – `pointer-events: none` ergänzt.
- Mobile Auftragsliste sortiert aktive/geplante Aufträge nach vorn (statt
  unsortiert); Maschine/Material/Montage nutzen nach einem Reload den Auftrag
  des laufenden Timers als Kontext.

### Tests / Prüfungen
- `tests/referenz.test.js` **277/277**; **Browser-E2E (Chromium, http/localhost)
  22/22** (SW-Steuerung, IndexedDB, Timer-Persistenz online+offline, exactly-once
  8→8, Konflikt, keine Preisdaten, Terminalmodus); Screenshots Smartphone/Tablet
  Hoch-/Querformat; `node --check` alle JS, Secret-Scan, Produktions-Build grün.

### Ehrlich / Grenzen
- Nur in headless Chromium getestet, **nicht** auf echten iOS/Android-Geräten.
- `file://`-localStorage-Fallback ist **keine** zuverlässige Produktions-Offline-
  lösung (Service Worker/IndexedDB brauchen https/localhost).
- Fotos bleiben lokal (kein Backend); Status wird ehrlich als „nur lokal"
  ausgewiesen. Keine stille Löschung lokaler Daten.

## Phase 14A – PWA- & Offline-Synchronisationskern  (Schema v11)

### Hinzugefügt
- **Sync-Engine `sync.js`** (rein/testbar): unveränderbare Zeiterfassungs-
  Ereignisse (TIMER_STARTED/BREAK_STARTED/BREAK_ENDED/TIMER_STOPPED/
  ENTRY_CORRECTED/ENTRY_CANCELLED), **Dauer aus Ereignissen**, Timer-
  Rekonstruktion, Ein-Timer-Garantie (Doppel-Tap/zwei Timer/Cross-Mandant/
  Pause/Stop-ohne-Start), **Synchronisationswarteschlange** (LOCAL_ONLY/QUEUED/
  SYNCING/SYNCED/RETRY/CONFLICT/CANCELLED) mit Reihenfolge + Abhängigkeiten,
  **Exactly-once** (stabiler Idempotenzschlüssel), kontrollierter Backoff-Retry
  + max. Versuche, **Konfliktprüfung** (Cross-Tenant, Auftrag abgeschlossen/
  fehlt, Maschine belegt, Material archiviert, Serverversion, fremder Timer,
  Sitzung/Benutzer/Gerät, unplausible Gerätezeit), **Zeitdrift**, Offline-
  Datenumfang ohne vertrauliche Felder.
- **Dauerhafter Offline-Speicher `offlinedb.js`**: versionierte **IndexedDB**
  (http/s) mit **localStorage-Fallback** (u. a. `file://`), Migration.
- **Integration `offline-app.js`**: Service-Worker-Registrierung + Update-
  Erkennung (kein erzwungenes Update bei laufendem Timer), Geräte-ID, Geräte-/
  Serverzeit, Ereigniserfassung, **exakt-einmalige Synchronisation** in
  `db.offlineBuchungen`.
- **PWA:** `sw.js` (App-Shell-Cache, Cache-Versionierung, Offline-Start,
  Navigation network-first→Cache; cacht **keine** Nutzerdaten) +
  `manifest.webmanifest` (Name/Icons/maskable/Standalone) + Meta/Apple-Tags.
- **Kompakte Diagnose** auf der System-Seite (online/offline, aktiver Timer,
  lokale/wartende/synchronisierte/Konflikte, letzte Sync, Treiber/DB-/App-
  Version) + funktionierender „Jetzt synchronisieren"-Knopf.
- Datenmodell: `db.offlineBuchungen[]` (Ziel der Synchronisation).

### Tests
- `tests/referenz.test.js` **277/277** (35 neue Sync-Tests). Browser-E2E:
  `file://` Timer offline → App-Neustart → rekonstruiert → stop → 2× Sync =
  genau eine Buchung (exactly-once), Doppel-Tap verhindert; `http://` Service
  Worker registriert+steuert, Manifest ladbar, IndexedDB überlebt Reload.

### Ehrlich / Grenzen
- Kein echter Server – Ziel ist die zentrale `Store`-db; Offline-Daten werden
  bei der Übernahme erneut validiert. Gerätetests nur in headless Chromium
  (iOS/Android nur simuliert). Service Worker nur im sicheren Kontext
  (https/localhost), nicht unter `file://` (dort localStorage-Fallback).

## Phase 13B – Rechnungs-UI, PDF, Kundenportal & ERP-Dateiexport  (Schema v11)

### Hinzugefügt
- **Interne Seite „Rechnungen & Nachträge"** (Nav; admin/buero, werkstatt ohne
  Zugriff): Nachtragsübersicht/-detail (anlegen/bearbeiten/kalkulieren/interne
  Freigabe/angenommen/abgelehnt/Zusatzleistung/Änderungsverlauf, ursprünglicher
  + aktueller Auftragswert), Rechnungsübersicht mit Filtern, **Rechnungs-
  assistent** (4 Schritte inkl. Positionseditor mit Teilmengen, Nachtrags-
  übernahme, Anrechnung früherer Rechnungen, Steuerart-Bestätigung, Über-
  rechnungswarnung), Freigabe-Prüfdialog + Unveränderbarkeit, Zahlungserfassung,
  Gutschrift/Storno, Portal-Freigabe je Beleg. Alle Summen aus der zentralen
  Engine (keine parallele UI-Formel).
- **Rechnungs-PDF** (A4): alle Pflichtfelder, USt je Steuersatz, bereits bezahlt/
  offen, Belegkennung; **keine internen Kosten/Margen**.
- **ERP-/KingBill-Dateiexport (CSV):** Vorschau, Mappingprofil, Prüfsumme +
  Export-ID, **Doppelexport-Erkennung**, Export-Verlauf, Download; keine Live-API.
- **Kundenportal – Rechnungen:** nur ausdrücklich freigegebene, portal-sichtbare
  Rechnungen mit PDF-Download; keine internen/ERP-Daten.
- Nav „🧾 Rechnungen"; Auth-Recht `rechnungen` (admin/buero). Datenmodell:
  `beleg.portalSichtbar`, `beleg.erpExportId`, `db.erpExporte[]`.

### Tests
- `tests/referenz.test.js` **242/242** (8 neue: positionRest, ERP-Export/CSV-
  Maskierung/keine internen Felder, Doppelexport-Erkennung) + Browser-E2E
  (Assistent→Freigabe→PDF, ERP-Export, Portal-Rechnungen, kein interner Leak).

### Ehrlich / Grenzen
- Offline-Prüfsumme **nicht** kryptografisch manipulationssicher. Keine
  steuerliche/rechtliche Konformität, kein Versand, keine Live-ERP-Übertragung,
  keine Bank-/Zahlungsanbindung.

## Phase 13A – Nachträge & Rechnungskern  (Schema v11)

### Hinzugefügt
- **Engine `rechnung.js`** (rein/testbar, Decimal, nutzt `Kalkulation.*`):
  - **Nachträge:** Zuordnung zu Auftrag/Projekt/Kommission, Status (erkannt→…→
    abgerechnet), Kalkulation (Material/Arbeit/Maschine inkl. Rüst/Montage/Fremd)
    mit eigenem Soll-Snapshot + Änderungsverlauf, Übernahme von Zusatzleistungen;
    **ursprünglicher Auftragswert bleibt unverändert**, angenommene Nachträge
    getrennt addiert.
  - **Rechnungskern:** Rechnungsentwurf/Akonto/Abschlag/Teil/Schluss/Gutschrift/
    Storno; Belegsummen je Umsatzsteuersatz (Decimal, Rabatte, Abzüge,
    Anrechnungen), Teilmengen, mehrere Teilrechnungen, Anzahlungen/vorherige
    Rechnungen abziehen, **keine Doppelverrechnung**, **Überrechnung erkennen**,
    mehrere Steuersätze, **Reverse Charge nur manuell bestätigt** (keine
    automatische steuerliche Beurteilung).
  - **Nummernkreise** pro Mandant, transaktionssicher (Zähler sofort erhöht,
    keine Wiederverwendung), identische Nummern in verschiedenen Mandanten
    erlaubt; Entwürfe ohne endgültige Nummer.
  - **Unveränderbarkeit** nach Freigabe (Snapshot + Prüfsumme; Korrektur nur via
    Gutschrift/Storno; Stammdatenänderungen ändern den Beleg nicht).
  - **Zahlungsstatus** (offen/teilweise/bezahlt/überfällig/…); Fälligkeit/Skonto.
    Keine Bankanbindung, kein Einzug.
  - **Rollen:** admin/buero mit Finanzrechten, werkstatt ohne Rechnungsrechte.
- **Datenschema v11** (additiv): `nachtraege[]`, `rechnungen[]`,
  `settings.rechnung.kreise`.
- **Beispieldaten** (Testumgebung): Auftrag mit angenommenem Nachtrag,
  Akontorechnung (Teilzahlung), zwei Teilrechnungen, Schlussrechnung, Gutschrift,
  Stornobeleg.
- **Schreibgeschützte Vorschau** auf der System-Seite (keine Aktions-
  Schaltflächen); Doku `BILLING.md`.

### Tests
- `tests/referenz.test.js` auf **234/234** erweitert (38 neue Rechnungs-/
  Nachtragstests) + Browser-Smoke der Vorschau.

### Ehrlich / offen
- Keine steuerliche/rechtliche Konformität behauptet; keine ERP-/E-Mail-/
  Zahlungsanbindung; kein Rechnungsversand. Prüfung durch Steuer-/Rechtsberatung
  erforderlich (siehe BILLING.md).

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
