# Support-Leitfaden – Preisschmiede

## Für Benutzer: Problem melden
- Über den **💬-Knopf** (unten rechts) oder System → Feedback.
- Kategorie wählen, Bereich/Kommission angeben, kurz beschreiben (was passiert,
  was war erwartet). Bei Fehlermeldung die **Fehler-ID** mit angeben.
- Meldungen bleiben lokal in der App; es werden keine Passwörter oder
  vertraulichen Kalkulationen übertragen.

## Für Administratoren: Meldungen bearbeiten
- System → Feedback: Status pflegen
  (neu → bestätigt → in Bearbeitung → behoben → getestet → geschlossen/abgelehnt).
- Fehler-ID im **Fehlerprotokoll** nachschlagen (System-Seite).

## Support-Paket
- System → **Support-Paket** erzeugt eine anonymisierte technische Übersicht:
  App-/Build-Version, Schema, Healthchecks, Backup-Status, Zählwerte, letzte
  Fehler-IDs + gekürzte Meldungen, Browser-Info.
- **Nicht enthalten:** Passwörter, Salts/Hashes, Tokens, vollständige
  Kundendaten, vertrauliche Kalkulationen, personenbezogene Mitarbeiterdaten.
- Vor dem Export wird eine **Vorschau** angezeigt; erkennt die App potenziell
  sensible Felder, wird der Export blockiert.

## Häufige Rückfragen
- **„Daten sind weg":** Browser/Gerät gewechselt? `localStorage` ist lokal –
  Backup importieren.
- **„PDF kommt nicht":** Pop-ups erlauben.
- **„Preis stimmt nicht":** Eingaben prüfen; Referenztest muss grün sein.
- **„Kann Seite X nicht sehen":** Rolle prüfen (Berechtigungen).

## Eskalationswege
1. Benutzer → Administrator (Fehler-ID nennen).
2. Administrator → technische Betreuung (Support-Paket beilegen).
