# Pilot-Checklisten – Preisschmiede

## A. Einrichtung (einmalig, Administrator)
- [ ] Repository/App in **getrennter** Pilotumgebung bereitgestellt
      (eigenes Gerät/Browserprofil, nicht das Dev-Profil).
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
