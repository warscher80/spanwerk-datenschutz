# Backup & Wiederherstellung – Preisschmiede

Die App speichert **alle** Daten lokal im Browser-`localStorage` des Geräts
(Schlüssel `ps.db.v1`). Es gibt keinen zentralen Server. Backup =
Export der lokalen Daten.

## Was gesichert werden muss

| Inhalt | Enthalten im Export | Hinweis |
|---|---|---|
| Stammdaten, Kunden, Material, Maschinen, Mitarbeiter | ✅ | Teil der JSON-Datenbank |
| Kalkulationen, Angebote (inkl. Snapshots) | ✅ | historisch eingefroren |
| Aufträge, Planung, Lernmodell | ✅ | |
| Dokumente/Zeichnungen/Stücklisten | ✅ (sofern lokal abgelegt) | große Binärdateien können das lokale Limit sprengen |
| Angebots-PDFs | ⚠️ | werden bei Bedarf neu erzeugt (kein Dauerspeicher) |
| Benutzer-Dashboard-Einstellungen | teilweise (pro Gerät) | `ps.dash.*` |

## Backup erstellen

1. Als Administrator anmelden.
2. **Stammdaten → Daten-Verwaltung → „⬇️ Backup exportieren"**.
3. Es wird `preisschmiede-backup.json` heruntergeladen.
4. Datei an einem sicheren, möglichst verschlüsselten Ort ablegen.

Alternativ **Geräte-Sync (WLAN)** zum Übertragen auf ein zweites Gerät.

## Wiederherstellung

1. Als Administrator anmelden.
2. **Stammdaten → Daten-Verwaltung → „⬆️ Backup importieren"** und die
   JSON-Datei wählen.
3. Die App migriert die Daten automatisch idempotent auf die aktuelle
   Schema-Version (`Store.migrate`).
4. Stichprobe prüfen: eine ältere freigegebene Kalkulation/ein Angebot öffnen
   und Werte kontrollieren (müssen unverändert sein).

## Empfohlene Strategie

- **Häufigkeit:** täglich am Betriebsende, zusätzlich vor größeren
  Preis-/Stammdatenänderungen.
- **Aufbewahrung:** rollierend mind. 30 Tage; monatliche Stände 12 Monate.
- **Verschlüsselung:** Backup-Ablage auf verschlüsseltem Datenträger.
- **Verantwortlich:** Geschäftsführung/Administrator.
- **Prüfintervall:** vierteljährlicher Test-Restore in einem separaten
  Browserprofil (niemals das Produktivprofil überschreiben).

## Restore-Test (getrennte Umgebung)

1. Zweites Browserprofil/Gerät verwenden.
2. Backup dort importieren.
3. Stammdaten, eine Kalkulation, ein Angebot und eine Planung kontrollieren.
4. Dateien/Verknüpfungen (Dokumente ↔ Kommission) prüfen.

> Wichtig: Der Restore-Test darf **keine** produktiven Daten überschreiben.
