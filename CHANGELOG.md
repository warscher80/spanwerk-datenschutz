# Changelog – Preisschmiede

Format orientiert an „Keep a Changelog". Versionierung bezieht sich auf das
Datenschema (`store.js` `version`).

## Phase 8 – Gesamtprüfung & Produktionsvorbereitung
### Behoben
- **Hoch:** Angebots-Snapshot hielt Referenzen auf Firma/Kunde – spätere
  Stammdatenänderung hätte ein altes Angebot verändert. Jetzt tiefe Kopie in
  `Angebot.kundenAusgabe` (Invariante durch Test abgesichert).
- **Responsive:** horizontaler Überlauf auf Tablets (820 px) und kleinen
  Handys (≤360 px) auf allen Hauptseiten. Ursachen: nicht begrenzter
  `.main`-Grid-Track, 12-teilige Handy-Navigation, mobile Topbar, ungekapselte
  Tabellen. Jetzt 320–1600 px überlauffrei.
### Hinzugefügt
- `tests/referenz.test.js` (Referenzkalkulation TEST-REFERENZ-001, Snapshot-
  Invarianten, Migrationen, Sicherheitsbasis).
- Dokumentation: `CALCULATION_RULES.md`, `SECURITY.md`, `BACKUP_RESTORE.md`,
  `KNOWN_LIMITATIONS.md`, `DEPLOYMENT.md`, `ARCHITECTURE.md`, `AUDIT_REPORT.md`,
  `.env.example`, dieses Changelog.
- `Store.fresh`/`Store.migrate` exportiert (Testbarkeit).

## Phase 7D – Zeichnungen, Stücklisten & Maßübernahme  (Schema v8)
- Dokumenten-/Analyse-Engine (`dokumente.js`), Dokumentenseite, CSV-BOM-Import,
  konservative PDF-Textextraktion, ASCII-DXF, Materialabgleich, kontrollierte
  Übernahme, Revisionsvergleich. Ehrliche Formatkennzeichnung.

## Phase 7C – Fertigungsplanung  (Schema v7)
- Planungs-Engine (`planung.js`), 7 Ansichten inkl. Gantt/Kanban, Kapazität,
  Konflikte, Auto-Vorschlag, Rüstoptimierung, Werkstattansicht.

## Phase 7A – Management-Dashboard  (Schema v6)
- Analyse-Engine (`auswertung.js`), rollenbasiertes Dashboard mit Filtern,
  Vorperiodenvergleich, Drill-down, Export.

## Phase 4 – Angebotsgenerator  (Schema v5)
- Angebots-Engine, kundensichere PDF-Ausgabe, Auftragsumwandlung.

## Phase 3A/3B – Konfigurator & Kalkulation  (Schema v3/v4)
- Dynamischer Produktkonfigurator, vollständige Kalkulationslogik (Decimal,
  Snapshot, Staffelpreise).

## Phasen 1 & 2 – Grundlagen
- Anmeldung/Rollen, Stammdaten, Kunden/Projekte/Kommissionen, Lieferanten,
  Material, Mitarbeiter, Maschinen (Rüstzeit/-kosten).
