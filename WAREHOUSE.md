# Lagerkern – Preisschmiede (Phase 15A)

Technischer Lagerkern: jede Materialmenge ist vom **Wareneingang** über
**Lagerplatz**, **Reservierung** und **Entnahme** bis zum **Auftrag**
nachvollziehbar. Reine, testbare Engine `assets/js/lager.js`
(`window.Preisschmiede.Lager`) – **ohne UI, ohne Netzwerk**. Persistenz über
den bestehenden `Store` (mandantengetrennte Datenbank pro Mandant).

> **Phase 15A = nur der Kern.** Es gibt bewusst **noch keine umfangreiche
> Lageroberfläche**. Beispieldaten und Tests belegen den vollständigen
> Materialfluss.

## Ehrliche Grenzen

- **Keine Bewegung wird je gelöscht.** Korrekturen erfolgen ausschließlich über
  **Storno/Gegenbuchung**. Das Bewegungsjournal ist die **Quelle der Wahrheit**
  für den Bestand.
- **Keine steuerrechtlich verbindliche Lagerbewertung** – nur technische
  Vorbereitung (letzter EK / gleitender Durchschnitt / chargenbezogen).
- **Keine echte ERP-Lageranbindung, keine Live-Bestellung** wird versendet.
- **Offline-Bewegungen gelten als nicht vertrauenswürdig** und werden bei der
  Übernahme **erneut validiert**; bei Konflikten wird nichts still gelöscht und
  keine negative Menge unbemerkt erzeugt – der Konflikt wird zur Prüfung
  gespeichert.
- Historische Kalkulationen behalten ihre **Preis-Snapshots**; neue
  Einkaufspreise ändern sie nicht.

## Datenmodell (Schema v12, additiv, mandantengetrennt)

Neue Arrays in der Mandanten-`db` (Migration legt sie leer an – kein
Datenverlust bestehender Bestände):

| Array | Inhalt |
|---|---|
| `lagerStandorte` | Standort {code, name, adresse} |
| `lager` | Lager {standortId, code, name} |
| `lagerBereiche` | Lagerbereich {lagerId, code, name} |
| `lagerRegale` | Regal {bereichId, code, name} |
| `lagerplaetze` | Lagerplatz {regalId, code, bezeichnung, status, erlaubteMaterialgruppen[], gesperrt, sperrgrund, notiz} |
| `lagerArtikel` | Lagerartikel (siehe unten) |
| `lagerBewegungen` | **unveränderbares Bewegungsjournal** |
| `lagerChargen` | Charge {chargennummer, schmelznummer, lieferantId, herstellerName, wareneingangId, werkstoff, menge, pruefstatus, gesperrt, zertifikate[], lagerplaetze[]} |
| `lagerReservierungen` | Reservierung (siehe unten) |
| `lagerReststuecke` | Reststück (siehe unten) |
| `wareneingaenge` | Wareneingang {bestellungId, lieferantId, lieferschein, datum, positionen[]} |
| `bestellungen` | Bestellung {lieferantId, status, positionen[{artikelId, bestellt, geliefert, status}]} |
| `lagerKonflikte` | Offline-/Bestandskonflikte zur Prüfung |

`settings.lager = { bewertungsmethode, zaehler{…} }`.

**Lagerartikel:** `artikelnummer, materialId, werkstoff, abmessung, basiseinheit,
gewicht, standardLaenge|standardFormat, mindestbestand, meldebestand,
zielbestand, bevorzugterLieferantId, standardLagerplatzId, chargenpflicht,
zertifikatspflicht, reststueckverwaltung, negativerBestandErlaubt,
verpackungseinheit, mindestbestellmenge, lieferzeitTage, bewertungsmethode`.

## Bewegungslogik

Bewegungsarten: `WARENEINGANG, ENTNAHME, RUECKGABE, RESERVIERUNG,
RESERVIERUNG_AUF, UMLAGERUNG, KORREKTUR, INVENTURDIFFERENZ, AUSSCHUSS,
RESTSTUECK_ZUGANG, RESTSTUECK_VERBRAUCH, SPERRUNG, ENTSPERRUNG,
LIEFERANTENRETOURE, STORNO`.

Pro Bewegung: `id, mandantId, typ, artikelId, menge, einheit, quelle-/
zielLagerplatzId, auftragId, projektId, kommission, arbeitsgang, chargeId,
reservierungId, benutzer, zeitpunkt, grund, preisSnapshot, idempotenzKey,
stornoVon`. Jede Bewegung trägt vorab berechnete **Töpfe-Deltas**
(`physisch, reserviert, gesperrt, quali, rest`).

**Bestandsberechnung** (zentral, aus dem Journal):

```
verfügbarer Bestand = physischer Bestand − reservierter Bestand − gesperrter Bestand
```

- **Bestellte, aber nicht gelieferte Ware** ist **kein** physischer Bestand
  (separat aus offenen `bestellungen`).
- **Qualitätsprüfbestand** (QS): Wareneingang mit Prüfpflicht bucht physisch
  **und** gesperrt (Topf `quali`), sodass die Formel exakt bleibt und QS-Ware
  nicht verfügbar ist.
- **Bestand je Lagerplatz** berücksichtigt Umlagerungen (Quelle −, Ziel +).
- **Storno** erzeugt eine Gegenbuchung mit invertierten Deltas; Original bleibt
  erhalten (`storniert=true`), Netto-Wirkung 0.

## Wareneingang (Teil-/Mehr-/Minderlieferung)

`wareneingang(state, kopf)` bucht **nur die akzeptierte Menge**
(geliefert − beschädigt), legt/ergänzt die **Charge** samt Zertifikaten und
Lagerplatz, hält je Position `bestellt, bisherGeliefert, gelieferteMenge,
restMenge, mehrlieferung, beschaedigteMenge, akzeptierteMenge, einkaufspreis
(Snapshot), qualitaetsstatus`. Der Bestellfortschritt wird fortgeschrieben
(`teilgeliefert`/`abgeschlossen`); Teillieferungen summieren sich korrekt,
Mehrlieferungen erzeugen einen Hinweis.

## Reservierungslogik (keine stille Überreservierung)

`reserviere(state, {artikelId, auftragId, menge, chargeId, lagerplatzId,
benoetigtBis, prioritaet})` prüft den **verfügbaren** Bestand und reserviert
**höchstens** diesen. Ergebnis: `reserviert`, `fehlmenge`, `teilweise`. Status:
`vorgemerkt, reserviert, teilweise reserviert, entnommen, freigegeben,
abgelaufen, storniert`. Der reservierte Bestand kann nie den physischen
übersteigen. `reservierungAufloesen` gibt den offenen Anteil frei.

## Entnahme & Rückgabe

`entnahme` prüft Bestand/Charge/Cross-Tenant (`pruefeBewegung`), bucht gegen
eine Reservierung (reduziert `reserviert`) und verhindert negativen Bestand
(außer der Artikel erlaubt ihn ausdrücklich). `rueckgabe` **referenziert die
ursprüngliche Entnahme** (`entnahmeRef`) und darf sie nicht übersteigen.

```
tatsächlicher Verbrauch = Entnahmen − Rückgaben
```

## Reststücke (inkl. Langgut-Restlänge)

Pro Reststück: `reststuecknummer, materialId, werkstoff, chargeId, laenge,
breite, staerke, durchmesser, gewicht, ursprungAuftragId, kommission,
lagerplatzId, qualitaetsstatus, status, fotoRef, qrRef`. Status: `verfügbar,
reserviert, teilweise verwendet, verbraucht, gesperrt, verschrottet`.

```
Restlänge = Ausgangslänge − verwendete Länge − Schnittverlust
```

Keine Nesting-/Verschnittoptimierung wird vorgetäuscht.

## Chargenrückverfolgung

`rueckverfolgung(state, chargeId)` liefert die Kette
**Lieferant → Wareneingang → Charge → Lagerplatz → Auftrag → Kommission**
(inkl. Schmelznummer, Zertifikate, Verwendungen). Chargen können gesperrt
werden (`chargeSperren`/`chargeEntsperren`); aus gesperrten Chargen ist keine
Entnahme/Reservierung möglich.

## Mindestbestand & Bestellvorschlag

```
Vorschlagsmenge = Zielbestand + reservierter Fehlbedarf − verfügbarer Bestand − bereits bestellte Menge
```

Aufgerundet auf **Verpackungseinheit**, mindestens **Mindestbestellmenge**;
berücksichtigt bevorzugten Lieferanten und Lieferzeit. **Negative
Vorschlagsmengen ergeben keine Bestellung.**

## Bestandsbewertung (technisch)

`bewertung(state, artikelId, methode)` liefert **letzter EK**, **gleitender
Durchschnitt** (Σ Menge·Preis / Σ Menge über akzeptierte Eingänge) und
**chargenbezogene** Preise. Methode je Mandant/Artikel konfigurierbar. Kein
Anspruch auf steuerrechtliche Verbindlichkeit.

## Idempotenz & Offline-Vorbereitung

Jede Bewegung erhält einen **stabilen Idempotenzschlüssel** (aus fachlichen
Bestandteilen). `uebernehmeOffline` verhindert eine zweite Bewegung bei
doppelter Übertragung und validiert offline erzeugte Bewegungen erneut; bei
Konflikt (z. B. zu wenig Bestand, gesperrte Charge, fremder Mandant) wird ein
`lagerKonflikt` gespeichert statt still zu scheitern.

## Mandantentrennung & Rechte

Alle Berechnungen filtern nach `mandantId`; fremde Mandanten werden abgelehnt
(`Cross-Tenant`). Rechtematrix `LAGER_RECHTE` (zentral geprüft):

| Recht | admin | buero | werkstatt |
|---|:--:|:--:|:--:|
| bestandSehen | ✓ | ✓ | ✓ |
| einkaufspreiseSehen | ✓ | ✓ | – |
| wareneingang | ✓ | ✓ | – |
| reservieren | ✓ | ✓ | – |
| entnehmen | ✓ | ✓ | ✓ |
| zurueckgeben | ✓ | ✓ | ✓ |
| korrigieren | ✓ | ✓ | – |
| chargeSperren | ✓ | ✓ | – |
| inventurFreigeben | ✓ | – | – |
| bestellungErstellen | ✓ | ✓ | – |
| bestellungFreigeben | ✓ | – | – |

## Beispieldaten (nur Testumgebung)

Über die Engine konsistent aufgebaut: 1 Standort, **2 Lager**, 5 Lagerplätze
(einer gesperrt), Stahl-/Edelstahl-/Aluminiumartikel (Langgut + Bleche),
2 offene Bestellungen, **Teil-Wareneingang** (36/60) mit Charge + Zertifikat,
QS-Wareneingang mit beschädigter Menge, **2+ Chargen** (eine gesperrt),
Reservierung + **Teilreservierung** (Fehlmenge), Entnahme + Rückgabe,
Reststück (Langgut), woraus sich reale **Bestellvorschläge** ergeben.

## Phase 15B – Lageroberfläche, Inventur, QR-Erfassung, mobile Buchungen

Aufbauend auf demselben Kern (**keine zweite Bestandslogik**) ergänzt Phase 15B
die Oberflächen. Jede Buchung läuft über `Lager.*`; die Bestandstöpfe kommen
immer aus dem Bewegungsjournal.

### Desktop – Seite „Lager" (`assets/js/lager-ui.js`, Nav-Eintrag `lager`)

15 Register: **Dashboard** (physisch/verfügbar/reserviert/bestellt/gesperrt/QS/
Reststücke, unter Meldebestand, offene Bestellungen, verspätete Lieferungen,
gesperrte Chargen, offene Konflikte, Inventurdifferenzen; **Lagerwert nur mit
Preisrecht**), **Bestand** (Artikelübersicht + Filter Werkstoff/unter Melde/
gesperrt/mit Reststücken/ohne Preis, Detaildialog), **Struktur** (Standort→
Lager→Bereich→Regal→Lagerplatz anlegen/bearbeiten/sperren, Etikett; belegte
Plätze werden nicht gelöscht), **Journal** (unveränderbar, Suche/Filter, Detail,
**Gegenbuchung**, CSV – *keine Löschschaltfläche*), **Wareneingang** (Assistent
mit Bestellbezug, bestellt/bisher geliefert/Restmenge, Mehrlieferungswarnung mit
Bestätigung, beschädigte Menge, Charge/Schmelznummer/Zertifikat, QS-Status,
Lagerplatz, EK-Snapshot, Etikett), **Reservierung** (voll/teilweise, Fehlmenge,
Bestellvorschlag aus Fehlmenge), **Entnahme** (gegen Reservierung, Warnung bei
ungewöhnlich hoher Menge, gesperrte Chargen gesperrt), **Rückgabe** (referenziert
die Entnahme, optional als Reststück), **Umlagerung** (Quelle/Ziel im Journal),
**Reststücke** (Übersicht/Suche/anlegen/reservieren/verwenden/verschrotten/
Etikett; Langgut-Restlängenrechnung live), **Chargen** (Sperren mit
Auswirkungsanalyse, Entsperren mit Grund + Audit, **Rückverfolgung vorwärts und
rückwärts**), **Inventur**, **Bestellungen**, **QR/Etiketten**, **Berichte**.

### Inventur

Voll-, Lagerplatz-, Artikel- und Stichprobeninventur. Ablauf: anlegen → Zählliste
(Artikel × Lagerplatz mit Systembestand) → zählen → **zweite Zählung bei
Abweichung über Schwelle** (Freigabe blockiert, bis sie vorliegt) → Freigabe
(nur mit Recht `inventurFreigeben`) → **Korrekturbuchungen** als
`INVENTURDIFFERENZ` (idempotent) → Abschluss. Differenzwert nur mit Preisrecht.

### QR-Codes & Etiketten

Referenzcode `PS:<LP|AR|CH|RS|BO|WE>:<id>` – **nur eine sichere Referenz, keine
Preise**. `etikettDaten()` liefert je Typ passende Zeilen (Artikelnummer,
Werkstoff, Abmessung, Charge, Lagerplatz, Reststückmaß …). Druckbare
Etikettenansicht (einzeln oder alle Lagerplätze).

### Mobile Lageransicht (PWA)

Neuer Bereich „Lager" in `mobil.html`/`mobil-app.js`: **Scannen/Code**,
Entnahme, Umlagerung, Inventurzählung, Reststück, Wareneingang (rollenabhängig),
Bestandsliste (**nur Mengen, keine Preise**) und Sync-Status. Alle Buchungen
laufen über `Offline.ereignis({typ:"lager"})` in die **bestehende Phase-14-Queue**
mit stabilem Idempotenzschlüssel; `offline-app.js` übergibt sie beim Sync an
`Lager.uebernehmeOffline`, das sie **erneut validiert** (Konflikt statt stillem
Fehler oder negativem Bestand). **Mobile Inventurzählungen** bilden die Differenz
erst beim Sync gegen den **aktuellen** Systembestand – veraltete Offline-Bestände
gelten nie als verbindlich.

### Berichte & Exporte

Bestands-, Bewegungs-, Fehlmengen- und Inventurbericht als **CSV** oder
druckbare Ansicht. Wertspalten nur mit `einkaufspreiseSehen`. Keine
Live-ERP-Verbindung.

### Rollen (erweitert)

`bestandSehen, einkaufspreiseSehen, wareneingang, reservieren, entnehmen,
zurueckgeben, umlagern, korrigieren, chargeSperren, chargeEntsperren,
inventurZaehlen, inventurFreigeben, bestellungErstellen, bestellungFreigeben,
berichteExportieren`. Werkstatt: Bestand sehen, entnehmen, zurückgeben,
umlagern, Inventur zählen – **keine** Preise, kein Wareneingang, keine Freigaben.
Die Desktop-Seite „Lager" ist für Werkstatt nicht in der Navigation.

### Phase-15B-Tests

Referenztests **346/346** (23 neue: Dashboard-Aggregation, Artikelübersicht +
Filter, QR-Referenzcode/Parsing, Etikett ohne Preis, Rückwärts-Rückverfolgung,
Sperr-Impact, Berichte mit/ohne Wert, Inventur inkl. zweiter Zählung/Freigabe/
Buchung, Bestell-Workflow, neue Rollenrechte).
**Desktop-E2E (Chromium) 14/14**: alle 15 Register fehlerfrei, Dashboard mit
echten Zahlen, Wareneingang gebucht, Journal, Entnahme, Inventur angelegt,
Chargenrückverfolgung, QR/Etikett erzeugt, Bestellvorschläge, Werkstatt ohne
Lager-Navigation.
**Mobile-E2E (Chromium, http/localhost) 13/13**: mobile Lageransicht ohne
Preise, Rollenfilter der Aktionen, QR-Code erkannt, **Offline-Entnahme in der
Queue**, überlebt Reload, **exactly-once** ins Journal (10→11, zweiter Sync
11→11), **Offline-Konflikt statt negativem Bestand**, mobile Inventurzählung
erzeugt −3-Differenzbuchung gegen den aktuellen Bestand.

## Tests

`tests/referenz.test.js` – **323/323** (davon 46 neue Lagertests): Wareneingang,
Teillieferung, Mehrlieferungswarnung, Bestandsberechnung (inkl. QS separat),
Reservierung, Teilreservierung, Überreservierung verhindern, Entnahme, Entnahme
gegen Reservierung, Rückgabe, tatsächlicher Verbrauch, Umlagerung (je
Lagerplatz), Storno + Gegenbuchung, Charge sperren, gesperrte Charge nicht
entnehmen, Reststück anlegen, Langgut-Restlänge, Reststück reservieren,
Mindestbestand, Bestellvorschlag, Verpackungseinheit, reservierter Fehlbedarf,
gleitender Durchschnittspreis, Idempotenz, Offline-Konflikt, Rollen,
Cross-Tenant-Schutz, historische Kalkulation unverändert, vollständige
Rückverfolgung.

Zusätzlich verifiziert ein Materialfluss-Durchlauf die Beispieldaten
(kein negativer Bestand, verfügbar = physisch − reserviert − gesperrt,
Bestellvorschläge, Rückverfolgung).
