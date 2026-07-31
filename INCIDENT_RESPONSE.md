# Incident Response – Preisschmiede

Leitfaden für Störungen im Pilotbetrieb. Grundsatz: **Daten sichern, dann
handeln.**

## Sofortmaßnahmen bei jedem Vorfall
1. Ruhe bewahren, betroffene Aktion stoppen.
2. **Backup** erstellen (falls die App noch bedienbar ist): System → Backup.
3. Fehler-ID notieren (erscheint in der Fehlermeldung / System → Fehlerprotokoll).
4. Vorfall im **Feedback** erfassen (Kategorie, Beschreibung, Kommission).

## Typische Vorfälle

### App lädt nicht / weiße Seite
- Browser-Cache leeren, Seite neu laden.
- Anderes Browserprofil testen; letztes Backup dort importieren.

### „Kein Speicherplatz" / Speicher unhealthy
- Backup exportieren.
- Große Dokument-Uploads löschen; Testdaten entfernen.
- Erneut versuchen.

### Falsche Kalkulation vermutet
- **Nichts** an den Formeln ändern.
- `node tests/referenz.test.js` ausführen (muss grün sein).
- Eingaben prüfen (Mengen, Sätze, Rüstkosten). Feedback mit Kommission anlegen.

### PDF fehlerhaft / erscheint nicht
- Pop-ups im Browser erlauben.
- Angebot erneut öffnen; Fehler-ID sichern.

### Timer-Problem / offener Timer
- System/Planung: Arbeitsgang-Status prüfen, Zeit manuell korrigieren.
- Verbindungsabbruch: Daten liegen lokal – nach Neustart erneut prüfen.

### Datenverlust befürchtet
- **Kein** Überschreiben. Letztes Backup in einem **Zweitprofil** öffnen und
  prüfen, bevor irgendetwas ersetzt wird.

## Eskalation
- Kritisch/Datenverlust: sofort Administrator, Backup sichern, Support-Paket
  erstellen.
- Fehler-ID + Support-Paket an die technische Betreuung geben.

## Was NICHT tun
- Keine produktiven Daten löschen/überschreiben.
- Keine Formeländerung „auf Verdacht".
- Keine externen Übertragungen (E-Mail/Bestellung/ERP) ohne Bestätigung.
