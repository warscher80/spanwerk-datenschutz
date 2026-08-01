# Mandantenfähigkeit – Architekturprüfung, Strategie & Migrationsplan (Phase 10)

## 1. Architekturprüfung (Ist-Stand vor Phase 10)

Die App war bisher **einmandantig**: **eine** JSON-Datenbank unter dem
localStorage-Schlüssel `preisschmiede.kalkulation.v1`, geladen/gespeichert über
`Store.load()/save()`. Alle Module (`app.js`, `kalkulation.js`, `angebot.js`,
`planung.js`, `dokumente.js`, `auswertung.js`, `betrieb.js`) arbeiten auf dieser
**einen** aktiven `db`.

**Ehrliche Kernaussage:** Diese App läuft vollständig **offline** im Browser
(`localStorage`), ohne Server und ohne serverseitige Datenbank. Eine
*serverseitig erzwungene* Mandantentrennung (wie im Auftrag idealtypisch
beschrieben) ist ohne Backend technisch nicht möglich – ein lokaler Benutzer mit
Entwicklerwerkzeugen kann den `localStorage` immer einsehen. Wir setzen daher
auf die **stärkste offline mögliche Isolation: eine getrennte Speicher-Namespace
je Mandant** (Datenbank-pro-Mandant). Für echte Mehrbenutzer-Server-Trennung ist
weiterhin ein Backend nötig (siehe `SECURITY.md`, `KNOWN_LIMITATIONS.md`).

### Firmenspezifische Daten (müssen mandantengetrennt sein)
settings (Firma, Sätze, Gemeinkosten, Maschinen, Nummernkreise, Betrieb),
users, kunden, projekte, lieferanten, material, mitarbeiter, produktgruppen,
vorlagen, konfigurationen, kalkulationen, angebote, textbausteine, auftraege,
planung, dokumente, feedback, fehlerlog, lernen. → **alle** waren zuvor ohne
Mandantenzuordnung in **einer** db.

### Global mögliche Daten (keine vertraulichen Firmeninfos)
Länder, Währungen, Einheiten, allgemeine Werkstoffbezeichnungen,
Systemrollen-Vorlagen, Systeminformationen, **Tarif-/Feature-Flag-Vorlagen**.

### Risiken für Datenvermischung (vor Phase 10)
- Keine `tenantId` an Datensätzen → bei naiver Server-Migration Vermischungsgefahr.
- Nummernkreise waren global → in Phase 10 pro Mandant getrennt (durch Namespace
  automatisch; identische Nummern in verschiedenen Mandanten kollidieren nicht).
- Dateien/Support-Paket/Exporte bezogen sich auf die eine db.

## 2. Gewählte Strategie: Datenbank-pro-Mandant (Namespace-Isolation)

- **Registry** (global): `preisschmiede.mandanten.v1` – Mandantenliste,
  Benutzer-Zuordnungen, Einladungen, Tarife, Feature-Flags, Systemadmins,
  Supportzugriffe, Zahlungsabstraktion, aktiver Mandant.
- **Pro Mandant**: `preisschmiede.tenant.<mandantId>` – die vollständige,
  bestehende db-Struktur (settings, kunden, … , lernen).
- **Aktiver Mandant** wird aus der Registry/Sitzung bestimmt (nicht aus URL/
  Formular). `Store.load()/save()` routen auf den Schlüssel des aktiven
  Mandanten. Kein gemeinsames Array zwischen Mandanten → **Isolation durch
  Konstruktion**: Cross-Tenant-Zugriff ist nicht möglich, weil kein Codepfad
  Daten eines fremden Namespaces in die aktive db mischt.
- **Firmenwechsel**: aktiven Mandanten umsetzen, db-Cache leeren, Sitzung
  zurücksetzen (Re-Login im Zielmandanten), laufender Timer muss vorher beendet/
  pausiert werden. Danach werden ausschließlich Daten des Zielmandanten geladen.

## 3. Eindeutige Werte pro Mandant

Kunden-, Angebots-, Auftrags-, Kalkulations-, Material-Nummern und Kommissionen
sind **pro Mandant** eindeutig. Da jeder Mandant seinen eigenen Namespace +
eigene Nummernkreise hat, ist z. B. `ANG-2026-0001` in Mandant A und Mandant B
gleichzeitig gültig und erzeugt **keinen** Konflikt.

## 4. Migrationsplan (verlustfrei)

1. Vollständiges Backup vorhanden (Registry legt zusätzlich `…legacy`-Kopie an,
   der alte Schlüssel wird **nicht** gelöscht).
2. Bestehende Einzelinstallation (`preisschmiede.kalkulation.v1`) wird beim
   ersten Start der Registry analysiert.
3. Zielmandant „Mandant 1" wird aus dem Firmennamen der Bestandsdaten angelegt.
4. Die Bestandsdaten werden **kopiert** nach `preisschmiede.tenant.<id>`
   (Original bleibt als Backup erhalten).
5. Benutzer-Zuordnungen werden aus `db.users` erzeugt.
6. Erst danach arbeitet die App auf dem Mandanten-Namespace.
7. Zweite Testfirma wird separat angelegt (eigener Namespace).

Es werden **keine** Bestandsdaten gelöscht und **keine** Daten automatisch einem
falschen Mandanten zugeordnet.

## 5. Zahlung / E-Mail / Support (ehrlich)

- **Zahlungsanbieter:** nur modulare Abstraktion; Status „nicht eingerichtet".
  Keine echte Abbuchung, keine Kreditkartendaten.
- **E-Mail-Einladungen:** kein E-Mail-Dienst konfiguriert → **manueller,
  sicherer Einladungsablauf** (Token, einmalig, zeitlich begrenzt, gehasht) für
  den Pilotbetrieb; im UI klar als „Testprozess/manuell" gekennzeichnet.
- **Systemadmin-Supportzugriff:** nur mit ausdrücklicher Freigabe des
  Firmenadministrators, zeitlich begrenzt, mit Grund, protokolliert, widerrufbar.

## 6. Grenzen (siehe KNOWN_LIMITATIONS.md)

Serverseitige Query-Erzwingung, echte Mandanten-Auth über einen Server,
signierte Download-Links, echte Zahlungs-/E-Mail-Dienste erfordern ein Backend
und sind bewusst nicht implementiert. Die Offline-Isolation erfolgt über
getrennte Speicher-Namespaces und ist für den **lokalen Pilotbetrieb** geeignet.
