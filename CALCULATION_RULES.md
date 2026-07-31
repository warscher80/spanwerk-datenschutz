# Kalkulationsregeln – Preisschmiede

Technische Dokumentation aller Kalkulationsformeln. Verbindliche Quelle ist
`assets/js/kalkulation.js`. Jede Änderung an diesen Formeln muss den
Referenztest `tests/referenz.test.js` (Kommission **TEST-REFERENZ-001**)
bestehen.

## Rundung & Decimal

- `r2(x)` – kaufmännische Rundung auf 2 Nachkommastellen, „half away from
  zero" mit 1e-9-Epsilon gegen Float-Artefakte (z. B. `0,1 + 0,2 = 0,30`).
- `r4(x)` – 4 Nachkommastellen (Mengen/Stückzeiten).
- Alle Geldbeträge werden mit `r2` gerundet; Division-durch-Null liefert `0`
  statt `NaN`/`Infinity`.

## Material (`material`)

```
netto           = menge + fixeZugabe
mitVerschnitt   = netto × (1 + verschnittProz/100)
mitAusschuss    = mitVerschnitt × (1 + ausschussProz/100)
bestellmenge    = aufrunden(mitAusschuss, Verpackungseinheit)   (falls gesetzt)
                  bzw. r4(mitAusschuss); min. Mindestbestellmenge
einkauf         = bestellmenge × einkaufspreis
kosten          = einkauf + frachtanteil
verkauf         = manuellerPreis  ODER  kosten × (1 + materialaufschlagProz/100)
```

## Arbeit (`arbeit`)

```
stueckzeit      = bearbeitungProStk × stueckzahl
personenstunden = (ruestzeit + stueckzeit + zusatzzeit) × anzahlMitarbeiter
kosten          = personenstunden × internerSatz
verkauf         = manuellerPreis  ODER  personenstunden × verkaufSatz
```

## Maschine (`maschine`)

```
ruestkosten     = anzahlRuest × ruestFix                       (falls ruestFix gesetzt)
                  ODER anzahlRuest × ruestzeitProVorgang × ruestSatz
laufzeit        = laufzeitProStk × stueckzahl + zusatzlaufzeit
maschinenkosten = laufzeit × internerSatz
gesamtkosten    = ruestkosten + maschinenkosten + werkzeugkosten + energiezuschlag
verkauf         = laufzeit × verkaufSatz + ruestkosten         (Rüsten ist im
                  Verkaufswert enthalten; Mindestverrechnung bzw. manueller
                  Preis überschreiben ihn)
```

**Rüst- vs. Stückkosten** sind getrennt geführt: `ruestKosten` erscheint als
eigene Summe und wird bei Staffelpreisen je Stückzahl verteilt (siehe unten).
Der Maschinen-**Verkaufswert** enthält die Rüstkosten bewusst genau **einmal**
(keine Doppelverrechnung).

## Fremdleistung / Montage / Transport

```
fremd.kosten    = einkaufspreis × menge + fracht + mindermenge
fremd.verkauf   = kosten × (1 + aufschlagProz/100)
montage.kosten  = stunden×internerSatz + km×kmSatz + Nebenkosten
transport.kosten= Verpackung + Paletten + Sonderverpackung + Maut + Kran + km×kmSatz + Beladung
```

## Preis-Wasserfall (`berechne`)

```
direkt        = Material + Arbeit + Maschine(inkl. Rüst) + Fremd + Montage + Transport + sonstigeKosten
FGK           = Fertigungsgemeinkosten (Default: Prozent auf „direkt", Satz = settings.gemeinkosten)
herstell      = direkt + FGK
VwVtGK        = Verwaltungs-/Vertriebsgemeinkosten (Default 0, Basis „herstell")
selbst        = herstell + VwVtGK
risiko        = selbst × risikoProz/100
nachRisiko    = selbst + risiko
gewinn        = nachRisiko × gewinnProz/100
listenNetto   = nachRisiko + gewinn + manuellerAufschlag
rabatt        = listenNetto × rabattProz/100
netto         = listenNetto − rabatt
USt           = netto × mwstProz/100          (mwstProz aus Kalkulation oder settings.mwst)
brutto        = netto + USt
```

**Keine doppelten Aufschläge:** Gemeinkosten wirken nur auf „direkt", Risiko
und Gewinn nur auf die jeweils vorherige Stufe. **Rabatt** mindert Netto,
Deckungsbeitrag und Gewinn um denselben Betrag.

## Deckungsbeitrag & Gewinn

```
variableKosten = Material + Arbeit + Maschine + Fremd + Montage + Transport
deckungsbeitrag = netto − variableKosten          (Gemeinkosten gelten als fix)
dbQuote        = deckungsbeitrag / netto × 100
gewinn         = netto − selbst
gewinnQuote    = gewinn / netto × 100
```

## Staffelpreise (`staffel`)

```
variableProStk = (variableKosten − ruestKosten) / Referenzstückzahl
ruestProStk(n) = ruestKosten / n                  (n = 0 → 0, keine Infinity)
kostenProStk   = variableProStk + ruestProStk(n)
preisProStk    = kostenProStk × (1 + risikoProz/100) × (1 + gewinnProz/100)
```

## Warnungen

Negativer Deckungsbeitrag/Gewinn, Verkauf unter Selbstkosten, Rabatt > 15 %,
fehlende Stundensätze/Materialpreise, Materialpreis älter als 180 Tage,
Maschinen ohne Rüstkosten, mögliche doppelte Bedienerkosten (Bedienerzeit an
Maschine **und** separater Arbeitsgang).

## Referenz TEST-REFERENZ-001 (Kontrollwerte)

| Größe | Wert |
|---|---|
| Material nach Verschnitt (10 %) | 550,00 € |
| Materialkosten inkl. Fracht (50 €) | 600,00 € |
| Materialverkauf (Aufschlag 20 %) | 720,00 € |
| Personenstunden (2 + 10, 1 Person) | 12 h |
| Interne Arbeitskosten (40 €/h) | 480,00 € |
| Arbeitsverkauf (75 €/h) | 900,00 € |
| Rüstkosten (1 h × 80) | 80,00 € |
| Interne Maschinenkosten (5 h × 60) | 300,00 € |
| Rüstkosten pro Stück (100 Stk.) | 0,80 € |
| Maschinen-Laufkostenverkauf (5 h × 100) | 500,00 € |
| direkte Kosten | 1.460,00 € |
| Herstell-/Selbstkosten (FGK 10 %) | 1.606,00 € |
| Risiko (5 %) | 80,30 € |

Diese Werte sind in `tests/referenz.test.js` als automatischer Regressionsanker
hinterlegt.
