# Nachträge & Rechnungskern (Phase 13A)

Engine `assets/js/rechnung.js` – reine, testbare Logik für Nachträge und einen
Rechnungskern. Nutzt dieselbe Decimal-sichere Rundung (`r2`) und die bestehende
Kalkulationslogik (`Kalkulation.*`). Mandantengetrennt (Namespace in store.js).

> **Ehrlich:** Diese Phase liefert Datenmodelle + Berechnung + Tests. Es gibt
> **keine** vollständige Rechnungs-UI (nur eine schreibgeschützte Vorschau auf
> der System-Seite), **keine** steuerliche/rechtliche Beurteilung, **keine**
> echte ERP-/E-Mail-/Zahlungsanbindung und **keinen** Rechnungsversand. Die
> steuerliche/rechtliche Ausgestaltung (Pflichtangaben, Reverse Charge,
> Einbehalte, Aufbewahrung) ist von Steuer-/Rechtsberatung zu prüfen.

## Datenmodelle

**Nachtrag** (`db.nachtraege[]`): id, mandantId, nummer, auftragId, projektId,
kommission, kundeId, bezeichnung, beschreibung, ursache, gemeldetVon,
gewuenschterTermin, status, mwstProz, gemeinkostenProz, gewinnProz, kalk (Kosten­
zeilen), sollSnapshot, sollVersion, aenderungsverlauf[], zusatzleistungen[].
Status: erkannt · in Prüfung · kalkuliert · freigegeben · angenommen · abgelehnt
· abgerechnet.

**Beleg** (`db.rechnungen[]`): id, mandantId, kundeId, projektId, kommission,
auftragId, nummer, art, vorzeichen, referenzBelegId, rechnungsdatum,
leistungszeitraum, zahlungszielTage, skonto, faelligkeit, mwstProz, rabattProz,
reverseCharge(+bestätigt+hinweis), positionen[] (menge, einheit, einzelpreis,
rabattProz, mwstProz, gesamtmenge, bereitsAbgerechnet, bezug), abzuege[],
anrechnungen[], status, zahlungstatus, zahlungen[], snapshot, freigegeben,
freigegebenVon/-Am. Arten: Rechnungsentwurf · Akonto · Abschlag · Teil · Schluss
· Gutschrift · Stornobeleg.

**Nummernkreise** (`settings.rechnung.kreise`): je Mandant, je Belegklasse
(Rechnung/Gutschrift/Stornobeleg) mit Präfix/Jahr/laufend/Mindestlänge.

Datenschema **v11** (additiv migriert; keine Bestandsdaten verändert).

## Berechnungsformeln (Decimal, `r2`)

- **Positionsnetto:** `r2(menge × einzelpreis) × (1 − positionsrabatt%)`.
- **Belegsummen:** je Umsatzsteuersatz gruppiert; globaler Rabatt anteilig je
  Satz; `netto = Σ nettoSatz`, `mwst = Σ r2(nettoSatz × satz%)`,
  `brutto = netto + mwst`. Vorzeichen −1 bei Gutschrift/Storno.
- **Reverse Charge:** nur wenn `reverseCharge` gesetzt → Steuersatz 0; Hinweis
  nur bei manueller Bestätigung; ohne Bestätigung keine Freigabe.
- **Nachtragskalkulation:** `Material+Arbeit+Maschine(inkl. Rüst)+Montage+
  Fremd` über `Kalkulation.*`; `netto = verkaufBasis × (1+gemeinkosten%) ×
  (1+gewinn%)`; eigener Soll-Snapshot; **Auftragskalkulation bleibt unverändert**.
- **Aktueller Auftragswert:** `ursprung + Σ netto(angenommene/abgerechnete
  Nachträge)` – getrennt ausgewiesen.
- **Bereits verrechnet:** Σ Belegnetto der **freigegebenen** Belege,
  vorzeichenrichtig (Gutschrift/Storno reduzieren).
- **Schlussvorschlag:** `aktuellerAuftragswert − verrechnet(ohne Schluss)` →
  **keine Doppelverrechnung**.
- **Überrechnung:** `verrechnet + neuerBeleg > aktuellerAuftragswert` → Flag
  (nur mit Begründung/Berechtigung zulässig).
- **Fälligkeit:** `rechnungsdatum + zahlungszielTage`; optional Skonto.
- **Zahlungstatus:** offen/teilweise/bezahlt/überfällig aus erfassten Zahlungen
  (keine Bankanbindung).

## Unveränderbarkeit

Nach Freigabe: endgültige Nummer vergeben (Zähler sofort erhöht → keine
Wiederverwendung), **vollständiger Snapshot** (Firma/Kunde/Positionen/Summen +
Prüfsumme) eingefroren, Beleg nicht mehr bearbeitbar; Korrektur nur über
**Gutschrift** oder **Stornobeleg**. Historische Stammdatenänderungen verändern
den Beleg nicht (Snapshot).

## Rollen

`Rechnung.darfBeleg(rolle, aktion)`: admin/buero mit Finanzrechten
(entwurf/bearbeiten/preise/steuerart/prüfen/freigeben/stornieren/gutschrift/
zahlung/…); **werkstatt ohne Rechnungsrechte**.

## Tests (Phase 13A)

`tests/referenz.test.js` **234/234** (38 neu): Nachtragskalkulation, Auftrag
unverändert, aktueller Wert inkl. Nachtrag, Akonto/Teil(-menge)/mehrere Teil/
Schluss, keine Doppelverrechnung, Überrechnung, mehrere Steuersätze, Reverse-
Charge-Hinweis, Rundung, Unveränderbarkeit, Gutschrift, Storno, Teil-/Vollzahlung,
Fälligkeit, transaktionssichere Nummern, Mandantentrennung, Rollen. Browser-
Smoke der schreibgeschützten Vorschau (kein interner Kostenleak).

## Rechtlich/steuerlich offene Punkte (zu prüfen)

Pflichtangaben je Belegart, Reverse-Charge-Sachverhalte, Behandlung von
Einbehalten (Haftrücklass/Deckungsrücklass/Skonto), Anzahlungs-/Schlussrechnungs-
Logik, Rechnungsnummern-Vorschriften, Aufbewahrungsfristen. **Keine** Aussage zur
Konformität – Steuer-/Rechtsberatung erforderlich.

## Nächster Schritt (später)

Vollständige Rechnungs-UI (Erstellung/Freigabe/PDF), ERP-Exportvorschau
(Dateiexport, keine Live-Übertragung), Zahlungsimport – jeweils ohne
vorgetäuschte Konformität/Anbindung.
