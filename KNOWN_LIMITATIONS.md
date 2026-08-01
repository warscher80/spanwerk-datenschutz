# Bekannte Einschränkungen – Preisschmiede

Ehrliche Auflistung dessen, was **nicht** oder nur eingeschränkt umgesetzt ist.
Diese Punkte sind für den vorgesehenen **internen Test-/Pilotbetrieb** auf
einem gemeinsam genutzten Gerät vertretbar dokumentiert.

## Architektur

- **Offline-Einzelplatz/Kleingruppe.** Keine Server-DB, kein zentrales
  Mehrbenutzer-Backend. Datenhaltung in `localStorage` des jeweiligen Geräts;
  Abgleich über manuellen Export/Import oder WLAN-Sync.
- **Rollenschutz = Anwendungsschutz**, nicht serverseitig erzwingbar. Für
  echte Mandanten-/Benutzertrennung ist ein Backend nötig.
- **Speicherlimit:** `localStorage` (~5–10 MB). Viele oder große
  Dokument-Uploads können das Limit erreichen; große Binärdateien gehören
  langfristig auf einen Server.

## Nicht angebundene Schnittstellen (vorbereitet, ehrlich gekennzeichnet)

- **Frankstahl-/Lieferanten-Live-API** – nicht konfiguriert; stattdessen
  CSV-/DATANORM-Import.
- **KingBill / weitere ERP** – Dateiexport vorbereitet, keine Live-Verbindung.
- **Externe OCR-/KI-Dienste** – nicht angebunden (nur konservative
  PDF-Textextraktion, keine Bilderkennung).
- **Externe Benachrichtigungen** (Push/SMS/E-Mail) – vorbereitet, nicht aktiv.

## Dateien & CAD (Phase 7D)

- **PDF-Textextraktion** nur für unkomprimierte Textstreams; gescannte/
  komprimierte PDFs liefern keinen Text (kein OCR).
- **XLSX** wird nicht geparst (bitte als CSV exportieren).
- **DWG/STEP/IFC** nicht unterstützt (keine lizenzierte Konvertierung);
  DXF nur ASCII (Entities/Einheiten, keine Material-/Stärkeannahme).

## Fachlich noch offen (formale Phasen)

- **Phase 5** (dedizierte mobile Zeiterfassung & Nachkalkulations-Tabellen)
  und **Phase 6** (statistische Lernfunktion) existieren als **Legacy-Variante**
  (Ist-Zeiten je Auftragsposition, Soll-Ist, einfache Korrekturfaktoren) und
  speisen Dashboard und Planung, sind aber nicht im vollen Umfang der späteren
  Spezifikation ausgebaut.
- **Phase 7B** (Materialpreis-Importzentrale mit Freigabe-Workflow) noch offen.
- **Gantt**: vereinfachte Ansicht; echtes Pixel-Drag-and-drop/Zoom fehlt
  (Terminverschiebung über konfliktgeprüften Editor).

## Sicherheit/Datenschutz

- `localStorage` unverschlüsselt (Geräteschutz maßgeblich).
- Kein Anmelde-Rate-Limit.
- **Keine** DSGVO-Zertifizierung – rechtliche Prüfung durch Fachleute
  erforderlich (Aufbewahrung, Lösch-/Anonymisierungskonzept).

## Betrieb / Pilot (Phase 9)

- **Feedback & Fehlerprotokoll bleiben lokal** in der App (kein Versand an
  einen Server). Support-Paket wird als Datei exportiert.
- **Keine externen Benachrichtigungen** (Push/SMS/E-Mail) – vorbereitet, nicht
  aktiv.
- **Backup-Überwachung** stützt sich auf die in der App protokollierten
  Backup-Zeitpunkte (manueller Export) – es gibt keinen automatischen
  Server-Backup-Job.
- **Healthchecks** prüfen den Client (App/Speicher/PDF/Backup); es gibt keinen
  Server-Healthcheck-Endpunkt.
- **Freigabestufen** sind ein organisatorischer Schalter in der App, kein
  technisch getrennter Deploy je Stufe.

## Mandantenfähigkeit (Phase 10)

- **Isolation ist offline-clientseitig** (getrennte `localStorage`-Namespaces,
  Datenbank-pro-Mandant). Es gibt **keine serverseitige Erzwingung** – ein
  lokaler Nutzer mit Entwicklerwerkzeugen kann prinzipiell alle Namespaces auf
  seinem Gerät einsehen. Für echte, serverseitig durchgesetzte Trennung ist ein
  Backend nötig.
- **Keine echte Zahlung:** nur modulare Abstraktion, Status „nicht
  eingerichtet"; keine Abbuchung, keine Kreditkartendaten.
- **Keine E-Mail-Einladungen:** kein E-Mail-Dienst konfiguriert →
  **manueller, sicherer** Token-Ablauf (einmalig, befristet, gehasht). Der
  Versand erfolgt außerhalb der App.
- **Keine öffentliche Selbstregistrierung** und **keine endgültige
  Kontolöschung** aktiviert (bewusst; verhindert versehentlichen Datenverlust).
- **Firmenwechsel erfordert Re-Login** (Sitzung wird zurückgesetzt); ein
  laufender Zeiterfassungs-Timer blockiert den Wechsel, bis gebucht wurde.
- **Nutzungslimits** (Benutzer/Speicher) sind **Kulanz-Warnungen** (80/90/100 %)
  und brechen laufende Prozesse nicht hart ab.

## Produktionsinfrastruktur (Phase 11)

- **Kein Backend:** echte serverseitige DB, persistenter Objektspeicher, echte
  Cron-Jobs, Webhooks, echter E-Mail-/Zahlungsbetrieb sind **nicht** aktiv. Die
  App bleibt statisch/offline; `infra.js` bereitet diese Adapter ehrlich als
  „nicht konfiguriert" vor, ohne Funktion vorzutäuschen.
- **E-Mail:** nur **Vorschaumodus** – ohne konfigurierten Dienst wird nichts
  versendet (Status „nicht gesendet – Dienst nicht konfiguriert").
- **Zahlung:** keine echte Abbuchung, keine Kartendaten; ohne Anbieter manuelle
  Lizenzverwaltung, kein Zahlungsknopf.
- **Geplante Aufgaben** laufen nur, **während die App geöffnet ist** (kein
  Server-Cron).
- **Signierte Download-Links** nutzen offline einen dokumentierten Digest statt
  echtem HMAC; echtes serverseitiges Signieren erfordert ein Backend.
- **Externes Monitoring/Fehlertracking** nur mit Konfiguration; Daten werden
  vorher von PII/Secrets bereinigt (`scrubbe`).
- **Docker/Hosting** liefert nur die **statischen** Dateien aus; es ist kein
  Applikationsserver enthalten.

## Zeitzonen

- Zeitstempel werden als ISO/UTC gespeichert und in österreichischer
  Lokalzeit angezeigt (`toLocaleString("de-AT")`).
