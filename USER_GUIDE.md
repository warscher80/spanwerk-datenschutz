# Kurzanleitung – Preisschmiede

Praxisnahe Schritte für den Metallbau-Alltag. Erst-PIN: **1234** (danach unter
Stammdaten → Benutzer ändern).

## Erste Kalkulation (z. B. Balkongeländer)
1. **Konfigurator** öffnen → Produktgruppe *Geländer* → Fragen beantworten
   (Länge, Höhe, Füllung …) → speichern.
2. Aus der fertigen Konfiguration **„Kalkulation erstellen"**.
3. Material, Arbeit, Maschine werden vorbelegt – Werte prüfen/anpassen.
4. Rechts erscheinen live Selbstkosten, Deckungsbeitrag, Netto/Brutto.

## Maschine anlegen
Stammdaten → *Maschinen der Firma* → **+ Maschine**: Name, Arbeitsschritt,
Maschinenstundensatz, Rüstzeit, Rüstkostensatz/fixe Rüstkosten, Kapazität.

## Rüstkosten verstehen
`Rüstkosten je Auftrag = Rüstzeit × Rüstkostensatz + fixe Rüstkosten`.
Bei Serien werden sie über die Stückzahl verteilt (Staffelpreise) – 100 Stück
mit 80 € Rüsten = 0,80 €/Stück.

## Material importieren
Material → Import (CSV/DATANORM) **oder** Dokumente → Stückliste (CSV) →
Analyse → Materialabgleich → als Konfiguration übernehmen.

## Angebot erstellen
Kalkulation **freigeben** → **Angebote** → *Neues Angebot aus Kalkulation* →
Texte/Positionen prüfen → **Freigeben** → **🖨️ PDF**. Interne Zahlen erscheinen
nie im Kunden-PDF.

## Auftrag starten & Zeit erfassen
Angenommenes Angebot → **In Auftrag umwandeln**. In **Planung → Werkstatt**
den Arbeitsgang mit **▶ Start** beginnen (Zeiterfassung läuft).

## Nachkalkulation
Aufträge → Auftrag öffnen → Ist-Zeiten/Fremdkosten eintragen → Soll-Ist-
Abweichung wird berechnet; abgeschlossene Aufträge speisen das Lernmodell.

## Fertigung planen
**Planung → Auto-Vorschlag** für einen beauftragten Auftrag. Der Vorschlag
zeigt Termine, Maschine und Konflikte und wird **erst nach Übernahme** aktiv.

## Dashboard
Rollenabhängige Kennzahlen mit Zeitraum-/Kundenfilter. Fertigung/Montage sehen
nur operative Daten (keine Gewinn-/Deckungsbeitragswerte).
