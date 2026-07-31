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

## Zeitzonen

- Zeitstempel werden als ISO/UTC gespeichert und in österreichischer
  Lokalzeit angezeigt (`toLocaleString("de-AT")`).
