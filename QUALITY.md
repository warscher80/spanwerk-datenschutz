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

## Phase 16B – Qualitäts-UI, mobile Prüfungen, Abnahmen, Berichte, Dashboard

Aufbauend auf **demselben Kern** (keine zweite Prüf-, Toleranz-, Sperr- oder
Reklamationslogik) ergänzt Phase 16B die Oberflächen. Jede Bewertung und jede
Buchung läuft über `Qualitaet.*`; Bestände weiterhin über den Lagerkern.

### Desktop – Seite „Qualität" (`assets/js/qualitaet-ui.js`, Nav `qualitaet`)

15 Register: **Dashboard** (offene/überfällige Prüfungen, bestanden/nicht
bestanden, offene Abweichungen, gesperrte Bauteile/Chargen, offene Nacharbeiten/
Nachprüfungen, Ausschussquote, Nacharbeitsstunden, Qualitätskosten, Kunden-/
Lieferantenreklamationen, fällige Prüfmittel, offene Korrekturmaßnahmen; Filter
nach Zeitraum/Kommission/Produktgruppe/Maschine/Material/Charge/Prüfstatus/
Fehlerart/Verantwortlichem; **bewusst keine Mitarbeiter-Ranglisten**),
**Prüfpläne** (Übersicht, Editor mit allen Phase-16A-Schrittfeldern, neue
Version, Vorschau, Freigabe, aktiv/inaktiv, **Versionsvergleich**),
**Prüfaufträge** (Liste + Prüfer zuweisen + Protokoll), **Prüfungsassistent**
(Schrittnavigation, Soll/Toleranzgrenzen, Istwert, Prüfmittel, Foto/Dokument,
Notiz, **zentrale Bewertung**, Zwischenstand, Abschluss), **Abweichungen**
(Detail mit betroffenen Vorgängen, Ursachenanalyse, Audit-Verlauf, Aktionen),
**Sperren** (Grund, Risiko, betroffene Vorgänge, erlaubte nächste Aktionen,
Entsperren mit Pflichtgrund + Bestätigung), **Nacharbeit** (inkl. Nachprüfung
aus demselben Snapshot, getrennte Kosten), **Ausschuss** (mit
**Auswirkungsvorschau** auf Lagerbestand, Fertigungsmenge, Nachkalkulation und
Ersatzbedarf), **Reklamationen**, **Lieferanten** (Chargensperre direkt),
**Maßnahmen** (Kanban über alle 8 Status, Überfälligkeit, Wirksamkeitsprüfung),
**Prüfmittel** (Kalibrierung eintragen, Vorwarnung, betroffene frühere
Prüfungen, Sperren), **Abnahmen**, **Portalfreigaben**, **Berichte**,
**Lernhinweise**.

### Prüfungsassistent

Zeigt je Schritt Sollwert und berechnete Grenzen, nimmt den Istwert auf und
lässt **den Kern** bewerten. Das Ergebnis wird eindeutig als **bestanden /
außerhalb Toleranz / Nachprüfung erforderlich / nicht bewertbar** angezeigt –
immer mit Symbol **und** Text (Status nie nur über Farbe). Gesperrte oder
abgelaufene Prüfmittel sind nur mit Sonderberechtigung („Prüfmittel verwalten")
wählbar.

### Mobile Prüfoberfläche (PWA)

Neuer Bereich „Prüfung" in `mobil.html`/`mobil-app.js`: Prüfauftrag suchen/
öffnen, Sollwert und Grenzen sehen, Istwert mit großem Zahlenfeld erfassen
(bzw. i. O./n. i. O. als XL-Buttons), Prüfmittel wählen, **Foto aufnehmen**,
Abweichung erfassen und **Montageabnahme** vorbereiten. Keine Preis- oder
Finanzdaten. Alle Erfassungen laufen über die **bestehende Phase-14-Queue**
(`Offline.ereignis({typ:"qualitaet"})`); `offline-app.js` übergibt sie beim Sync
an den Qualitätskern, der **Berechtigung und Prüfplanversion erneut prüft**, die
**Toleranz zentral neu berechnet**, Idempotenz anwendet, doppelte Abweichungen
verhindert, Konflikte sichtbar speichert und **offline niemals freigibt**.

### Qualitäts-PDFs

Prüfprotokoll, Abweichungsbericht, Nacharbeitsbericht, Reklamationsbericht,
Abnahmeprotokoll, Prüfmittelübersicht und alle acht Berichtsarten als druckbare
A4-Ansicht (Firma, Kunde, Projekt/Kommission, Auftrag, **Prüfplanversion**,
Ergebnisse, Abweichungen, Fotonachweise, Freigaben, **Dokumentkennung**,
Kopf-/Fußzeile mit Seitenangabe). Jedes Dokument trägt den Hinweis, dass **keine
Normkonformität und keine Zertifizierung** bestätigt wird.

### Kundenportal

Im Portal erscheinen **ausschließlich ausdrücklich freigegebene** Belege
(Abnahmeprotokoll, Prüfbericht, Materialzertifikat, freigegebene Zeichnung) und
der eigene **Reklamationsstatus**. `pruefberichtKundensicher()` gibt nur
Schritt, Soll-, Istwert, Einheit und Ergebnis aus – **keine** internen
Ursachenanalysen, Mitarbeiterdaten, Qualitätskosten, internen Bewertungen oder
nicht freigegebenen Lieferanteninformationen. Freigaben sind jederzeit
widerrufbar (protokolliert).

### Lernhinweise

Statistische Auffälligkeiten (häufigste Fehlerart je Produktgruppe, erhöhte
Nacharbeit bei einer Maschine, wiederkehrende Abweichung bei einem Material,
häufig unterschätzte Qualitätszeit). Jeder Hinweis nennt **Datenmenge,
Zeitraum, Vertrauenswert und Grundlage** und weist ausdrücklich auf
**Korrelation statt gesicherter Ursache** hin. Es findet **keine Bewertung
einzelner Mitarbeiter** statt.

### Phase-16B-Tests

Referenztests **481/481** (40 neue): Dashboard inkl. Filter, acht Berichtsarten,
Abnahme + Protokoll + Idempotenz, Portalfreigabe/Widerruf/Rechte,
kundensicherer Prüfbericht ohne interne Felder, Kalibrierung + Vorwarnung,
Lernhinweise (Korrelation, ohne Personen), mobile Offline-Prüfung mit
Idempotenz/Konflikt/keiner Freigabe.
**Desktop-E2E (Chromium) 39/39**: alle 15 Register, Dashboard, Prüfplaneditor +
Prüfschritt + Versionsvergleich, Prüfungsassistent mit zentraler Bewertung,
Abweichung → Detail (betroffene Vorgänge/Ursachen/Audit), Sperren, Nacharbeit →
Nachprüfung, Prüfmittel + Kalibrierung, Reklamationsbewertung nur mit
Begründung, Lieferantenreklamation mit Chargensperre, Maßnahmen-Kanban,
Abnahmen, **PDFs (Prüfprotokoll, Abnahmeprotokoll) mit Normhinweis**, Berichte,
Rollen (Werkstatt ohne Qualitäts-Nav, Büro ohne Prüfplanfreigabe), Tablet- und
Smartphone-Ansicht ohne horizontalen Scroll.
**Mobile-E2E (Chromium, http/localhost) 18/18**: mobile Prüfansicht ohne
Preisdaten, Sollwert/Grenzen, Prüfmittel, Kamera, **Offline-Messwert in der
Queue**, Offline-Abweichung, Reload-Persistenz, **exactly-once** (17→18, 18→18),
**zentrale Toleranzbewertung beim Sync**, Offline-Konflikt bei veralteter
Prüfplanversion, **Offline-Freigabe abgelehnt**, mobile Montageabnahme.

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
