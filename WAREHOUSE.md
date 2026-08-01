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
