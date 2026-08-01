# Qualitätsmanagement-Kern – Preisschmiede (Phase 16A)

Technischer QM-Kern: eine Qualitätsabweichung ist von der **Prüfung** über
**Sperrung**, **Nacharbeit** und **Nachprüfung** bis zur **dokumentierten
Freigabe** vollständig nachvollziehbar. Reine, testbare Engine
`assets/js/qualitaet.js` (`window.Preisschmiede.Qualitaet`) – **ohne UI, ohne
Netzwerk**. Persistenz über den bestehenden `Store` (Datenbank je Mandant).

> **Phase 16A = nur der Kern.** Es gibt bewusst **noch keine umfangreiche
> Qualitätsoberfläche** und keine mobile QM-Oberfläche. Beispieldaten und Tests
> belegen den vollständigen Ablauf.

## Ehrliche Grenzen (verbindlich)

- **Es wird KEINE Normkonformität und KEINE Zertifizierung behauptet.**
- **Keine Schweiß-, Bau- oder Qualitätsnorm ist im Code hinterlegt.** Normen und
  Prüfvorschriften sind ausschließlich **konfigurierbare Freitext-Referenzen**
  (`pruefplan.referenz`, `stammdaten.normReferenzen` – standardmäßig leer). Jeder
  Prüfplan trägt den Hinweis „Freitext-Referenz – keine Konformitätsaussage".
- **Keine automatische Schuldzuweisung.** Ursachen werden als *Kandidaten*
  gesammelt (`ursachenKandidaten`, Sicherheit „Vermutung"); die *bestätigte*
  Ursache ist ein getrenntes Feld und muss ausdrücklich von einer Person gesetzt
  werden. Die Herkunft ist standardmäßig **„ungeklärt"**.
- **Keine automatische Sonderfreigabe** (technische Beurteilung + freigebende
  Person sind Pflicht), **keine automatische Bewertung** einer Reklamation als
  berechtigt/unberechtigt, **keine automatische Kostenweitergabe**
  (`kostentraeger` bleibt „nicht zugewiesen").
- **Keine qualifizierte elektronische Signatur** – nur ein einfaches,
  nachvollziehbares Audit-Protokoll.
- Bestände laufen **ausschließlich über den Phase-15A-Lagerkern** – es gibt
  keine zweite Bestandslogik.

## Datenmodell (Schema v13, additiv, mandantengetrennt)

| Array | Inhalt |
|---|---|
| `qualPruefplaene` | versionierte Prüfpläne inkl. Prüfschritte |
| `qualPruefauftraege` | Prüfaufträge mit **unveränderbarem Prüfplan-Snapshot** + Ergebnissen |
| `qualAbweichungen` | Abweichungen inkl. Ursachenkandidaten/bestätigter Ursache, Historie |
| `qualSperren` | Sperrungen (Bauteil, Materialcharge, Arbeitsgang, Auftragsteil, Lieferung, Montagefreigabe) |
| `qualNacharbeiten` | Nacharbeiten inkl. Herkunft, Zeiten, Nachprüfungsbezug |
| `qualAusschuss` | Ausschuss inkl. Kostenanteilen und Lagerbewegung |
| `qualSonderfreigaben` | Sonderfreigaben mit Beurteilung/Einschränkungen |
| `qualMassnahmen` | Korrekturmaßnahmen inkl. Wirksamkeitsprüfung |
| `qualReklamationen` | Kundenreklamationen (Bewertung getrennt) |
| `qualLieferantenReklamationen` | Lieferantenreklamationen inkl. direkter Chargensperre |
| `qualPruefmittel` | Prüfmittel + Kalibrierstatus |
| `qualKosten` | Qualitätskosten je Kostenart |
| `qualWareneingangspruefungen` | Wareneingangsprüfungen inkl. Teilfreigabe |
| `qualAudit` | Audit-Protokoll aller Qualitätsaktionen |
| `qualKonflikte` | Offline-Konflikte zur Prüfung |

`settings.qualitaet.stammdaten` enthält die **konfigurierbaren** Stammdaten:
Prüfarten, Prüfmerkmale, Prüfmethoden, Toleranzen, Fehlerarten, Fehlerklassen,
Risikostufen, Abweichungsgründe, Korrekturmaßnahmen, Zertifikatsarten,
Reklamationsarten, Freigabestufen und (leere) Normreferenzen.

## Prüfplan- und Snapshotlogik

- Prüfplan: Nummer, Bezeichnung, Produktgruppe/Produkt/Material/Arbeitsgang/
  Maschine, optionaler Kunde, **Version**, gültig ab/bis, Beschreibung,
  verantwortliche Rolle, Freigabestatus, Freitext-Referenz, aktiv/inaktiv.
- **Versionierung:** `pruefplanNeueVersion()` legt v+1 an; der Vorgänger bleibt
  **unverändert** erhalten (`gueltigBis` gesetzt, `aktiv=false`). Eine neue
  Version startet immer als **Entwurf** – sie ist nicht automatisch freigegeben.
- **Freigabe:** nur mit Recht `pruefplanFreigeben` und nur mit Prüfschritten.
  Aus einem nicht freigegebenen Plan lässt sich kein Prüfauftrag erzeugen.
- **Snapshot:** `pruefauftragNeu()` friert den Prüfplan als tiefe Kopie ein
  (`istSnapshot=true`). **Spätere Vorlagenänderungen verändern laufende oder
  abgeschlossene Aufträge nicht** (im Test abgesichert).
- Prüfschritte tragen u. a. Prüfzeitpunkt (13 Werte von Wareneingang bis
  Endabnahme), Merkmal/Merkmaltyp, Soll, Einheit, obere/untere Toleranz,
  Methode, Prüfmittel, Stichprobe, Pflichtprüfung, Foto-/Dokument-/
  Freigabepflicht, Rolle und **„bei Fehler sperren"**.
- 15 **Merkmaltypen**: jaNein, bestanden, zahl, mass, winkel, gewicht,
  stueckzahl, sicht, text, auswahl, foto, dokument, bestaetigung,
  seriennummer, chargennummer.

## Toleranzberechnung (zentral)

```
Abweichung = Istwert − Sollwert
obere Grenze = Sollwert + obere Toleranz
untere Grenze = Sollwert − |untere Toleranz|
```

Ergebnis: **innerhalb Toleranz**, **außerhalb Toleranz**, **Nachprüfung
erforderlich**, **nicht bewertbar**.

- **Grenzwerte sind eingeschlossen** (`>=` / `<=`, ε-tolerant); `aufGrenze`
  weist einen Wert exakt auf der Grenze aus.
- Asymmetrische Toleranzen werden unterstützt; die untere Toleranz darf als
  positiver Betrag oder als negativer Offset angegeben werden.
- Ohne numerische Werte oder ohne hinterlegte Toleranz → **nicht bewertbar**.
- Messung mit **ungültigem/abgelaufenem Prüfmittel** → **Nachprüfung
  erforderlich** (nie stillschweigend „bestanden").
- Die Bewertung erfolgt **immer** über `bewerteSchritt()`/`pruefeToleranz()` in
  der Engine – nicht in einer Oberfläche.

## Prüfaufträge

Status: geplant, bereit, in Prüfung, bestanden, mit Abweichung bestanden, nicht
bestanden, gesperrt, Nachprüfung, abgeschlossen. `pruefauftragAuswerten()`
liefert offene Pflichtschritte, Anzahl außerhalb/Nachprüfung/nicht bewertbar,
fehlende Nachweise und sperrende Schritte. `pruefauftragAbschliessen()`
verweigert den Abschluss bei offener Pflichtprüfung und setzt den Status
zentral (sperrender Fehler → **gesperrt**). Abgeschlossene Prüfungen sind nicht
mehr änderbar.

## Wareneingangsprüfung

Nutzt den Lagerkern: QS-Ware ist physisch vorhanden, aber **gesperrt** und damit
nicht verfügbar. Die Prüfung gibt eine Teilmenge frei (Lagerbewegung
`ENTSPERRUNG`), der Rest bleibt gesperrt. Ergebnis: **vollständig freigegeben**,
**teilweise freigegeben**, **gesperrt** oder **Lieferantenreklamation
erforderlich**. Geprüft werden Menge, Material, Werkstoff, Abmessung, Charge,
Zertifikat und Schäden. **Nur freigegebene Mengen werden regulär verfügbar.**

## Sperrverfahren

`sperreNeu()` sperrt Bauteil, Materialcharge, Arbeitsgang, Auftragsteil,
Lieferung oder Montagefreigabe – **nur mit Berechtigung, Grund, Benutzer,
Zeitpunkt und Audit-Eintrag**; keine stillen Statusänderungen.
`betroffeneVorgaenge()` ermittelt aus dem Lagerkern die betroffenen
Reservierungen, Entnahmen, Aufträge, Kommissionen und Prüfaufträge (reine
Ermittlung, keine Bewertung). `sperreAufheben()` verlangt das Recht
`sperrungAufheben` **und** einen Grund; beides landet im Audit.

## Nacharbeit und Ausschuss

- **Nacharbeit**: Abweichung, Ursache (Freitext), Tätigkeit, Mitarbeitergruppe,
  Maschine, Material, geplante/tatsächliche Zeit, Termin, Ergebnis,
  Nachprüfungspflicht. **Herkunft** (intern / Lieferant / Kunde / konstruktive
  Änderung / **ungeklärt**) wird nie automatisch gesetzt. Die Freigabe erfordert
  das Recht `nacharbeitFreigeben`. Kosten werden **getrennt** als
  Qualitätskosten erfasst (Kostenart „Nacharbeit").
- **Nachprüfung**: `nachpruefungAnlegen()` erzeugt einen neuen Prüfauftrag aus
  **demselben Prüfplan-Snapshot** und verweist auf den Ursprung.
- **Ausschuss**: Bauteil, Menge, Material, Charge, Bearbeitungs-/Maschinen-/
  Materialkosten, Grund, Freigabe, Entsorgung, Ersatzfertigung. Die
  Bestandswirkung läuft als Lagerbewegung `AUSSCHUSS` über den Lagerkern; die
  Kosten fließen getrennt in die Qualitätskosten.

## Reklamationen

- **Kundenreklamation**: vollständige Stammdaten, 9 Statuswerte, Historie. Das
  Feld `berechtigung` startet als **„nicht bewertet"**; `reklamationBewerten()`
  verlangt Benutzer **und** Begründung – es gibt keine automatische Bewertung.
- **Lieferantenreklamation**: Lieferant, Bestellung, Wareneingang, Material,
  Charge, Lieferschein, Menge, Fehler, Zertifikat, geforderte Maßnahme, Antwort,
  Ersatzlieferung, Gutschrift, Status. Die betroffene **Charge ist direkt
  sperrbar** (QM-Sperre + Lager-Chargensperre; danach ist keine Entnahme mehr
  möglich).

## Prüfmittel

Nummer, Bezeichnung, Hersteller, Modell, Seriennummer, Messbereich,
Genauigkeit, Standort, Verantwortlicher, Kalibrierintervall, letzte/nächste
Kalibrierung, Status, Zertifikat. Status: verfügbar, in Verwendung,
**Kalibrierung fällig**, gesperrt, defekt, außer Betrieb.
`pruefmittelGueltig()` erkennt abgelaufene Kalibrierungen und gesperrte Geräte;
`pruefmittelStatusAktualisieren()` markiert fällige Geräte.
`betroffenePruefungen()` ermittelt **bereits erfasste Prüfungen**, die mit einem
ungültig gewordenen Prüfmittel durchgeführt wurden (Ermittlung, keine
automatische Neubewertung).

## Audit und Unveränderbarkeit

Jede Qualitätsaktion schreibt `{mandantId, benutzer, aktion, referenzTyp,
referenzId, vorher, nachher, grund, zeitpunkt}` in `qualAudit`. Abgeschlossene
Prüfungen nehmen keine weiteren Ergebnisse mehr an. Statuswechsel bei
Abweichungen, Maßnahmen und Reklamationen erfordern immer einen Benutzer und
werden mit Historie gespeichert.

## Offline-Vorbereitung (Phase-14-Queue)

`uebernehmeOffline()` verarbeitet offline erfasste Prüfergebnisse und
Abweichungen:

- **Idempotenz** über einen stabilen Schlüssel – kein zweites Ergebnis, **keine
  doppelte Abweichung**.
- **Zentrale Toleranzberechnung** auch bei Offline-Übernahme.
- **Keine automatische Freigabe offline** (`aktion:"freigabe"` wird abgelehnt).
- **Konfliktprüfung**: fehlender Prüfauftrag, bereits abgeschlossene Prüfung
  oder **abweichende Prüfplanversion** erzeugen einen gespeicherten Konflikt –
  die lokalen Daten bleiben dabei vollständig erhalten, nichts wird gelöscht.

## Rollen

`pruefplanErstellen, pruefplanFreigeben, pruefungDurchfuehren,
pruefungFreigeben, abweichungAnlegen, chargeSperren, sperrungAufheben,
sonderfreigabe, nacharbeitFreigeben, reklamationBearbeiten,
qualitaetskostenSehen, pruefmittelVerwalten, qualitaetsberichteExportieren`.

| Recht | admin | buero | werkstatt |
|---|:--:|:--:|:--:|
| Prüfung durchführen | ✓ | ✓ | ✓ |
| Abweichung anlegen | ✓ | ✓ | ✓ |
| Prüfplan erstellen | ✓ | ✓ | – |
| Prüfplan freigeben | ✓ | – | – |
| Prüfung freigeben | ✓ | ✓ | – |
| Charge sperren | ✓ | ✓ | – |
| Sperrung aufheben | ✓ | – | – |
| Sonderfreigabe | ✓ | – | – |
| Nacharbeit freigeben | ✓ | – | – |
| Reklamation bearbeiten | ✓ | ✓ | – |
| Qualitätskosten sehen | ✓ | ✓ | – |
| Prüfmittel verwalten | ✓ | ✓ | – |
| Qualitätsberichte exportieren | ✓ | ✓ | – |

Alle Prüfungen filtern nach `mandantId`; ein fremder Mandant findet keinen
Prüfplan (Cross-Tenant-Schutz).

## Beispieldaten (nur Testumgebung)

Über die Engine konsistent aufgebaut: Prüfplan **Edelstahlgeländer** (v1 → v2,
beide freigegeben, 5 Prüfschritte) und **Blecharbeit** (3 Schritte);
Prüfauftrag **bestanden** (inkl. Messwert exakt auf dem Grenzwert), Prüfauftrag
**nicht bestanden/gesperrt** → Abweichung → Sperrung → Ursachenanalyse
(2 Kandidaten, einer bestätigt) → **Nacharbeit** → **Nachprüfung bestanden**;
**Wareneingangsprüfung mit Teilfreigabe** (3 von 5 freigegeben) →
**Lieferantenreklamation mit Chargensperre**; **Ausschuss** mit Lagerbuchung;
**Sonderfreigabe** mit Einschränkung; **Kundenreklamation** (bewusst „nicht
bewertet"); **gültiges Prüfmittel** und **Prüfmittel mit abgelaufener
Kalibrierung**; Korrekturmaßnahme; Qualitätskosten getrennt nach Kostenart.

## Tests

`tests/referenz.test.js` – **441/441** (95 neue QM-Tests): Prüfplanversionierung,
Prüfplan-Snapshot-Unveränderbarkeit, Prüfauftrag, Maß innerhalb/exakt auf
Grenzwert/außerhalb, asymmetrische Toleranz, Pflichtprüfung, Wareneingangs-
prüfung mit Teil-/Vollfreigabe, gesperrte Charge, Abweichung (inkl.
Doppelschutz), Auftragssperre mit Auswirkungsanalyse, Nacharbeit, Nachprüfung,
Ausschuss (Lagerwirkung + Kosten), Sonderfreigabe, Ursachenanalyse ohne
Automatik, Korrekturmaßnahme mit Wirksamkeitsprüfung, Kunden- und
Lieferantenreklamation, Qualitätskosten, Prüfmittel/fällige Kalibrierung/
gesperrtes Prüfmittel/betroffene frühere Prüfungen, Offline-Idempotenz,
Offline-Konflikt (auch bei abweichender Prüfplanversion), keine Offline-
Freigabe, Rollen, Cross-Tenant-Schutz, historische Aufträge unverändert und
„keine Normen fest programmiert".

Zusätzlich verifiziert ein Ablauf-Durchlauf die Beispieldaten (Prüfung →
Abweichung → Sperre → Nacharbeit → Nachprüfung bestanden, Lagerintegration,
Qualitätskosten).
