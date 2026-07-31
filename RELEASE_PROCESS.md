# Release- & Updateprozess – Preisschmiede

## Versionierung
- **Datenschema:** `store.js` `version` (aktuell **9**). Migration läuft beim
  Start automatisch und idempotent.
- **Freigabestufen:** Entwicklung → Interner Test → Pilot → eingeschränkter
  Produktivbetrieb → Produktivbetrieb (System-Seite, für Admins sichtbar).

## Kontrollierter Update-Ablauf
1. **Backup** erstellen (System → Backup).
2. **Wartungsmodus** aktivieren (System-Seite; Banner erscheint).
3. **Neue Version** einspielen (Web: Dateien ersetzen; Android/Windows: neues
   Release aus `app-latest`).
4. **Migration** läuft automatisch beim ersten Start.
5. **Systemprüfung:** `node tests/referenz.test.js`, `node --check`,
   Healthchecks grün, eine Testkalkulation.
6. **Freigabe** durch Administrator.
7. **Wartungsmodus beenden**.

## Rollback
Bei Fehlern nach dem Update:
1. Wartungsmodus aktiv lassen.
2. **Vorheriges Backup** in einem Zweitprofil prüfen.
3. Alte App-Version wiederherstellen (vorherige Dateien/vorheriges Release).
4. Geprüftes Backup importieren.
5. Referenztest + Stichprobe, dann Freigabe.

> Da Migrationen additiv/idempotent sind, ist ein Rollback über das Backup der
> zuverlässigste Weg. Kein Downgrade der Schema-Version ohne Backup.

## Vor jedem Release verpflichtend
- Referenzkalkulation grün, Angebots-PDF korrekt, Rollen geprüft,
  Responsive-Sweep grün, Produktions-Build (CI) grün.
- `CHANGELOG.md` aktualisiert (Version, Änderungen, behobene Fehler, Grenzen).
