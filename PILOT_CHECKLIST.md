# Pilot-Checklisten – Preisschmiede

> Grundlage: `FINAL_AUDIT.md` (Reifegrad **Pilotbetrieb**), `TEST_REPORT.md`,
> `RELEASE_CHECKLIST.md`. Der Pilot ist ein **begleiteter** Echteinsatz in
> **einem** Betrieb – kein Produktivbetrieb. Rechtliche und steuerliche
> Konformität ist **nicht** geprüft.

## A. Einrichtung (einmalig, Administrator)
- [ ] Repository/App in **getrennter** Pilotumgebung bereitgestellt
      (eigenes Gerät/Browserprofil, nicht das Dev-Profil).
- [ ] App wird über **HTTP(S)** oder als Android-App bereitgestellt – **nicht**
      per `file://` (sonst keine Offline-PWA, siehe `DEPLOYMENT.md`).
- [ ] `node tests/referenz.test.js` grün, `node --check assets/js/*.js` grün.
- [ ] App gestartet, mit Admin angemeldet.
- [ ] **Freigabestufe** auf *Pilot* gesetzt (System-Seite).
- [ ] Firmendaten hinterlegt (Name, Adresse, UID, IBAN).
- [ ] Stundenverrechnungssätze, Gemeinkosten, Gewinn, USt geprüft.
- [ ] Mindestens eine Maschine mit Maschinenstundensatz + Rüstkosten.
- [ ] Materialien + aktuelle Preise vorhanden.
- [ ] Pilotbenutzer angelegt, **keine** Standard-PINs.
- [ ] Beispieldaten entfernt (Testdaten-Generator: „Testdaten entfernen").
- [ ] Erstes Backup erstellt (System → Backup) + Restore-Test in Zweitprofil.

## B. Pilotimport (pro Datenart)
Reihenfolge: Kunden → Lieferanten → Materialien → Preise → Maschinen →
Stundensätze → Textbausteine → Projekte → offene Angebote → laufende Aufträge.
Für **jede** Datenart:
- [ ] Backup **vor** Import.
- [ ] Importvorschau geprüft.
- [ ] Fehler-/Duplikatprüfung durchgeführt.
- [ ] Import bestätigt, Importprotokoll gesichtet.
- [ ] Stichprobe (3–5 Datensätze) kontrolliert.
- [ ] Rücknahme bei Bedarf möglich (sonst erneutes Backup einspielen).

## C. Vor Kalkulation
- [ ] Kunde, Projekt, Kommission vorhanden.
- [ ] Materialpreise aktuell (keine Warnung „älter als 180 Tage").
- [ ] Stunden-/Maschinenstundensätze + Rüstkosten geprüft.

## D. Vor Angebot
- [ ] Materialmenge, Arbeits-/Maschinenzeiten, Rüstkosten kontrolliert.
- [ ] Montage berücksichtigt.
- [ ] Verkaufspreis plausibel (keine negative Marge, sinnvoller DB).
- [ ] Angebotstext geprüft, **PDF** kontrolliert (Umlaute, €, Summen, kein
      interner Wert sichtbar).

## E. Vor Auftragsstart
- [ ] Zeichnung freigegeben (aktuelle Revision).
- [ ] Material verfügbar oder bestellt (Materialstatus).
- [ ] Fertigung eingeplant, Mitarbeiter zugewiesen, Maschine verfügbar.
- [ ] Liefertermin bestätigt.

## F. Vor Abschluss
- [ ] Alle Arbeits-/Maschinen-/Rüstzeiten erfasst, keine offenen Timer.
- [ ] Materialverbrauch + Ausschuss erfasst.
- [ ] Montage abgeschlossen.
- [ ] Nachkalkulation geprüft (Soll-Ist plausibel).

## G. Täglich (Administrator)
- [ ] Backup erstellt (System → Backup).
- [ ] System → Betriebswarnungen gesichtet.
- [ ] Offene Timer/Feedback/Fehlerprotokoll geprüft.
- [ ] Speicherauslastung geprüft (Limit ~5–10 MB pro Mandant).

## H. Mobile Geräte (aus dem Abschluss-Audit offen)
Echte Gerätetests sind **noch nicht erfolgt** – alle mobilen Prüfungen liefen
in headless Chromium. Vor produktiver Nutzung auf jedem real eingesetzten
Gerät nachholen:
- [ ] Anmeldung und Auftragsliste in der PWA.
- [ ] Zeiterfassung: starten, pausieren, fortsetzen, App schließen und neu
      öffnen – laufender Timer überlebt.
- [ ] Flugmodus: Buchung offline erfassen → wieder online → **genau eine**
      Buchung im System (keine Dublette).
- [ ] Lagerbuchung mit **echter Kamera** (QR/Barcode) – bei schlechter
      Erkennung manuelle Eingabe verwenden.
- [ ] Qualitätsprüfung mit Foto.
- [ ] Bedienbarkeit mit Arbeitshandschuhen/Displaygröße bewertet.

## I. Ausdrücklich **nicht** im Pilot verwenden
- [ ] Rechnungen **nicht** als alleinige Belegführung nutzen – parallel im
      bestehenden System führen, bis Fachleute die steuerliche/rechtliche
      Seite geprüft haben.
- [ ] Keine Prüf-/Abnahmeprotokolle als Normnachweis oder Zertifikat
      weitergeben – die App macht **keine** Normkonformitätsaussage und
      erzeugt **keine** qualifizierte elektronische Signatur.
- [ ] Keine Kundenuploads als virengeprüft behandeln – es gibt **keinen**
      Virenscan.
- [ ] Kein Mehrbenutzerbetrieb über ein gemeinsames Server-Konto.
