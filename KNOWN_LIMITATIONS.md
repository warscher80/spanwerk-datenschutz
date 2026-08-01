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

## Kundenportal & Uploads (Phase 12)

- **Kein Backend-Virenscan.** Kundenuploads werden nur nach Typ, Größe und
  Dateinamen geprüft; es findet **keine** Schadsoftware-Prüfung statt. Für
  echten Schutz ist ein serverseitiger Scanner nötig.
- **Digitale Angebotsannahme ist keine qualifizierte elektronische Signatur.**
  Sie ist eine protokollierte Zustimmung (Zeitpunkt, Kennung, Prüfsumme) –
  rechtlich ist das etwas anderes als eine qualifizierte Signatur.
- **Portal-Zugangslinks** sind offline erzeugte Token mit dokumentiertem
  Digest, kein serverseitig signierter Link.
- Foto-/Dokument-Uploads liegen **lokal** im Browser-Speicher; ohne Server gibt
  es keine zentrale Ablage und keine geräteübergreifende Sicherung.

## Rechnungen, Nachträge & ERP (Phase 13)

- **Kein Rechnungsversand.** Es wird keine E-Mail und kein Beleg an einen
  Empfänger gesendet; erzeugt wird ausschließlich ein PDF zum Herunterladen.
- **Keine Bankanbindung.** Zahlungen werden manuell erfasst; es gibt keinen
  Kontoabgleich, keinen Zahlungseingangsabruf und kein Mahnwesen mit Versand.
- **Keine Live-KingBill-/ERP-Verbindung.** Nur Dateiexport (CSV); es wird keine
  Schnittstelle angesprochen und keine Übernahme bestätigt.
- **Keine steuerliche oder rechtliche Konformitätsprüfung.** Rechnungsrecht,
  Registrierkassenpflicht, Aufbewahrungsfristen und Belegkette wurden **nicht**
  geprüft. Im Pilotbetrieb sind Rechnungen zusätzlich im bestehenden System zu
  führen.

## Offline & mobile PWA (Phase 14)

- **`file://` ist keine Produktions-PWA.** Ohne HTTP(S) gibt es keinen Service
  Worker und keine IndexedDB; die App fällt dann auf `localStorage` zurück.
  Dieser Fallback ist ein Notbehelf und **keine** Produktionslösung – produktiv
  ist Auslieferung über HTTPS (oder `localhost`) erforderlich.
- **Keine echten Gerätetests.** Alle mobilen Prüfungen liefen in headless
  Chromium mit Mobil-Viewport, **nicht** auf echten iOS-/Android-Geräten.
  Kamera und Scanner wurden über Browser-APIs simuliert.
- **Die Offline-Prüfsumme ist nicht fälschungssicher.** Sie erkennt
  Übertragungs- und Reihenfolgefehler, ist aber kein kryptografischer
  Manipulationsschutz.
- **Synchronisation ist Client-zu-Client-Speicher**, kein Server-Sync; ohne
  Backend gibt es keine zentrale Konfliktinstanz.

## Lager (Phase 15)

- **Keine ERP-Lagerverbindung.** Bestellvorschläge erzeugen Dateien/Belege,
  es wird **keine** Bestellung versendet.
- **Bestandsbewegungen werden nie gelöscht** (unveränderbares Journal);
  Korrekturen erfolgen ausschließlich über Gegenbuchungen. Das ist gewollt,
  bedeutet aber, dass Fehlbuchungen sichtbar bleiben.
- **QR-/Barcode-Erfassung** nutzt die Browser-Kamera; die Erkennungsqualität
  auf echter Hardware ist noch nicht verifiziert. Manuelle Eingabe ist immer
  möglich.
- Der Lagerbestand ist **kein bilanzieller Nachweis** und keine geprüfte
  Inventurbewertung.

## Qualität (Phase 16)

- **Keine Normkonformität und keine Zertifizierung.** Im Code ist **keine**
  Schweiß-, Bau- oder Qualitätsnorm hinterlegt; Normen und Prüfvorschriften
  sind ausschließlich konfigurierbare Freitext-Referenzen.
- **Keine automatische Schuldzuweisung.** Ursachen werden erfasst, nicht
  Personen bewertet; es gibt bewusst keine Mitarbeiter-Rangliste als
  Standardansicht.
- **Keine qualifizierte elektronische Signatur** auf Abnahme- oder
  Prüfprotokollen – nur protokollierte Bestätigung mit Zeitpunkt und Kennung.
- **Freigaben sind offline nicht möglich** (bewusst): offline erfasste
  Prüfungen werden beim Sync erneut auf Berechtigung, Prüfplanversion und
  Toleranz geprüft.

## Im Abschluss-Audit ergänzt (2026-08-01)

- **Nur drei Rollen.** Das System kennt `admin`, `buero` und `werkstatt`. Eine
  feinere Rollenteilung (Geschäftsführung, Projektleitung, Fertigung, Montage,
  reine Zeiterfassung) ist **nicht umgesetzt**; die drei Rollen decken die
  Fälle fachlich ab, aber nicht rollenscharf.
- **Kein eigenes Nachkalkulationsbericht-PDF.** Die Nachkalkulation ist im
  Auftragsdetail und im Dashboard-Export enthalten, aber nicht als eigenes
  Druckdokument.
- **Lernfunktion ist eine reine Anzeige.** Die Seite hat keine Schaltflächen
  und zeigt bei dünner Datenlage nur einen Hinweistext. Die Auswertung entsteht
  passiv aus Nachkalkulationsdaten.
- **Mandantenverwaltung nur über die Systemseite** (bewusst administrativ, aber
  damit nicht Teil der normalen Navigation).
- **`localStorage`-Grenze:** ca. 5–10 MB **pro Mandant**. Ein Testbestand mit
  500 Kunden, 10 000 Materialien, 2 000 Angeboten und 1 000 Aufträgen belegt
  bereits 1,4 MB – ohne Dokumenteninhalte. Langjähriger Vollbetrieb mit vielen
  Uploads sprengt dieses Limit.
- **`maxStundenProTag` ist ohne Wirkung.** Das Feld ist in den
  Mitarbeiter-Stammdaten erfassbar und wird gespeichert, aber von keinem Modul
  ausgewertet – die Fertigungsplanung prüft Qualifikation, Abwesenheit und
  Maschinenberechtigung, nicht die Tagesarbeitszeit. Im Formular ist das
  ausdrücklich vermerkt.
- **Maschinenberechtigungen sind eine Positivliste mit Sonderfall:** eine
  **leere** Liste bedeutet „keine Einschränkung" (alle Maschinen erlaubt),
  sobald aber **eine** Maschine gewählt ist, gelten alle übrigen als gesperrt.
  Berechtigungen für zwischenzeitlich gelöschte Maschinen bleiben erhalten und
  werden im Formular als solche gekennzeichnet, damit aus einer Sperre nicht
  unbemerkt eine Freigabe wird.
- **Kein Anmelde-Rate-Limit und keine serverseitige Rechteprüfung**, da es kein
  Backend gibt. Der Rollenschutz ist Anwendungsschutz. `infra.rateLimiter()`
  existiert als getesteter Baustein, ist aber **nicht** an die Anmeldung
  angebunden – ohne Server ließe sich ein Limit lokal ohnehin umgehen.

## Zeitzonen

- Zeitstempel werden als ISO/UTC gespeichert und in österreichischer
  Lokalzeit angezeigt (`toLocaleString("de-AT")`).
