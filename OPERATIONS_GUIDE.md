# Betriebshandbuch (Operations Guide) – Preisschmiede

Zielgruppe: Administrator im Pilotbetrieb.

## Tägliche Aufgaben
- **Backup** erstellen: System → „Backup erstellen & protokollieren".
- **Betriebswarnungen** prüfen (System-Seite): veraltete Preise, fehlende
  Sätze/Rüstkosten, offene Timer, negative Marge, gefährdete Liefertermine,
  auslaufende Angebote.
- **Offene Timer** kontrollieren (keine Timer über Nacht laufen lassen).

## Wöchentliche Aufgaben
- **Pilot-Kennzahlen** notieren (System → Pilot-Kennzahlen).
- **Feedback** durchgehen und Status pflegen (neu → in Bearbeitung → …).
- **Fehlerprotokoll** sichten; auffällige Fehler-IDs den Meldungen zuordnen.
- **Restore-Test** in einem Zweitprofil (nie auf der aktiven Datenbank).

## Systemseite verstehen
- **Freigabestufe:** Entwicklung → Interner Test → Pilot → eingeschränkter
  Produktivbetrieb → Produktivbetrieb. Ab „Pilot" PIN-Wechselpflicht.
- **Healthchecks:** healthy/degraded/unhealthy für App, Speicher, PDF, Backup.
  Nicht konfigurierte Adapter (Frankstahl/KingBill/OCR) sind **kein**
  Systemfehler.
- **Wartungsmodus:** Kennzeichnung für kontrollierte Updates (Banner sichtbar).

## Speicher
`localStorage` ist begrenzt (~5 MB). Bei „degraded/unhealthy": große
Dokument-Uploads entfernen, Backup exportieren, Testdaten löschen.

## Healthcheck-Ampel (Interpretation)
- **healthy:** normal.
- **degraded:** Aufmerksamkeit (z. B. Backup fehlt, Speicher > 80 %).
- **unhealthy:** sofort handeln (Speicher > 95 %) – Backup + Aufräumen.

## Support
Bei Problemen: **Support-Paket** exportieren (System → Support-Paket). Es
enthält keine Passwörter/Tokens/Kundendaten. Vorschau vor Export prüfen.
