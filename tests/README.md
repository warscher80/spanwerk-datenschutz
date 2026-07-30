# Sommerfest-Kassa – Tests

Automatische Tests für `kassa.html` (Unit-Logik **und** End-to-End im echten Browser).
Sie laufen gegen die **echte** Datei über den Chromium-Browser (Playwright) und
verändern **keine** produktiven Kassendaten – jeder Test benutzt einen eigenen,
isolierten Browser-Kontext.

## Ausführen

```bash
node tests/kassa.test.mjs
```

Voraussetzung: Playwright mit Chromium. Falls nicht vorhanden:

```bash
npm i -D playwright
npx playwright install chromium
```

Das Skript findet Playwright automatisch (lokal oder global).

## Was wird getestet (95 Prüfungen)

| Bereich | Inhalt |
|---|---|
| Cent-Konvertierung & Euro-Format | `centsFromInput`, `eur` inkl. Sonderfälle (leer, negativ, Rundung) |
| Warenkorb / Pfand / Summen | Speisen ohne Pfand, Getränke mit 2 € Pfand, gemischt, sehr große Mengen |
| SCL-Artikel | Schlipfkrapfen 9 €, Soda-Aufpreis 0,50 €, Bier + Aufpreis |
| Verkauf buchen | genau 1× buchen, Doppelklick-Schutz, „zu wenig gegeben“-Sperre, leeres Feld erlaubt Buchung |
| Rückgeld | Rückgeld / „fehlen“ / exakt / leer / negativ |
| Schnelltasten Gegeben | 1/2/5/10/20/50/100 addieren, C löscht |
| Tagesstatistik & PIN | falscher/richtiger PIN, „Verkäufe“ = Vorgänge (nicht Artikel) |
| Becher noch draußen | wird nie negativ angezeigt |
| Tag abschließen | archivieren, Wechselgeld übernehmen, Gesamt bleibt |
| Vereinstrennung | FSGL/SCL vollständig getrennt (namespaced localStorage) |
| Speichern & Wiederherstellen | offene Bestellung nach Neuladen |
| Beschädigte Daten | kaputtes JSON / falsche Strukturen -> kein Absturz |
| QR Encode/Decode & Bericht | Roundtrip inkl. Umlauten, PNG-Bericht ohne Vereinswahl |
| Beschädigte QR-URL | keine leere/blockierte Seite |
| Lange drücken = +5 | kein zusätzliches +1; schnelles Tippen exakt |
| Bestellliste | +/- und Entfernen bei Menge 0 |
| Vereinswahl | richtiger/falscher Code, Abbrechen |
| 2-Tablet-Zusammenführung | Merge per QR, kein Doppelzählen |
| QR-Fallback | ohne QR-Bibliothek wird die Statistik als Bild angeboten |
| Speicherfehler | sichtbare Warnung statt stillem Ignorieren |
