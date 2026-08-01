# Release-Checkliste – Preisschmiede

Stand: **2026-08-01** · Bezug: `FINAL_AUDIT.md`, `TEST_REPORT.md`

Diese Liste ist der verbindliche Ablauf, bevor eine Version an Anwender geht.
Sie bewertet **keine** Zertifizierung und ersetzt **keine** rechtliche oder
steuerliche Prüfung.

Legende: **[x]** erfüllt · **[ ]** offen · **[–]** bewusst nicht anwendbar

---

## 1. Technische Freigabe

- [x] `node tests/referenz.test.js` grün (**481/481**)
- [x] `node --check` über alle `assets/js/*.js`, `sw.js`, `scripts/*.mjs`, `tests/*.js`
- [x] Browser-E2E grün (End-to-End 31/31, Schaltflächen 224/224, 14B 22/22,
      15B 14/14 + 13/13, 16B 39/39 + 18/18)
- [x] XSS-/Responsive-/PDF-/PWA-Prüfung grün (20/20)
- [x] Unabhängige Kalkulations-Kontrollrechnung grün (35/35)
- [x] Rollen-/Mandanten-/Export-/Migrationsprüfung grün (32/32)
- [x] Keine JavaScript-Laufzeitfehler im Gesamtdurchlauf
- [x] Produktions-Build `npm run copyweb` erfolgreich
- [x] Secret-Scan sauber (keine Schlüssel, Tokens, Passwörter im Repository)
- [x] `scripts/check-env.mjs` OK
- [x] Schema-Migration von der Vorversion getestet, **verlustfrei** und idempotent

## 2. Funktionale Freigabe

- [x] Alle 16 Navigationspunkte erreichbar, 16 Renderer deckungsgleich
- [x] Kein Hauptablauf ausschließlich über eine System-/Testseite erreichbar
- [x] Keine sichtbare Schaltfläche ohne Funktion
- [x] Hauptablauf Kunde → Kalkulation → Angebot → Auftrag → Fertigung →
      Zeiterfassung → Lager → Qualität → Rechnung → Nachkalkulation
      vollständig über die normale Oberfläche durchführbar
- [x] Mobile PWA (Werkstatt/Montage/Lager/Prüfung) offline bedienbar und
      exakt-einmalig synchronisierend
- [x] Kundenportal zeigt ausschließlich freigegebene Inhalte

## 3. Sicherheit

- [x] Rollentrennung zentral geprüft (`darf()`), nicht nur über versteckte Buttons
- [x] Mandantentrennung auch bei identischen IDs und Nummern nachgewiesen
- [x] Kein interner Wert (Selbstkosten, Deckungsbeitrag, Einkaufspreis,
      Qualitätskosten) in Kundendokumenten oder im mobilen Datensatz
- [x] CSV-/ERP-Exporte gegen Formula-Injection geschützt (behoben im Audit)
- [x] Keine Demo-PINs außerhalb der Releasestufe „test"; Erstlogin erzwingt
      PIN-Wechsel
- [ ] **Vor Produktivbetrieb:** serverseitige Rechteprüfung, Anmelde-Rate-Limit
      und Virenprüfung für Uploads – **nicht vorhanden** (kein Backend)
- [–] Sicherheitszertifizierung – **wird nicht behauptet und nicht angestrebt**

## 4. Datensicherheit & Wiederherstellung

- [x] Export/Backup erzeugt eine vollständige, wieder einspielbare Datei
- [x] Restore in ein zweites Browserprofil getestet
- [x] Migration löscht keine Bestandsdaten (Legacy-Schlüssel bleibt als Backup)
- [ ] **Vor Pilotstart:** Backup-Rhythmus mit dem Betrieb schriftlich vereinbart
      (die App hat **keinen** automatischen Server-Backup-Job)

## 5. Dokumentation

- [x] `PROJECT_STATUS.md` auf dem aktuellen Stand
- [x] `FINAL_AUDIT.md` erstellt
- [x] `TEST_REPORT.md` erstellt
- [x] `KNOWN_LIMITATIONS.md` enthält alle bekannten Einschränkungen ungeschönt
- [x] `CHANGELOG.md` fortgeschrieben
- [x] `SECURITY.md`, `DEPLOYMENT.md`, `PILOT_CHECKLIST.md` aktualisiert
- [x] `README.md` verweist auf Audit- und Testbericht

## 6. Freigabeentscheidung

- [x] Reifegrad festgestellt: **Pilotbetrieb** (begleiteter Echteinsatz in
      **einem** Betrieb) – **nicht** produktionsbereit
- [ ] Schriftliche Freigabe des Betriebsinhabers für den Pilotbetrieb
- [ ] Pilotauflagen vereinbart (siehe Abschnitt 7)

## 7. Auflagen für den Pilotbetrieb

- [ ] Genau **ein** Betrieb, **ein** Mandant
- [ ] Rechnungen zusätzlich im bestehenden System führen (Doppelführung), bis
      die steuerliche/rechtliche Prüfung durch Fachleute erfolgt ist
- [ ] Tägliches Backup durch den Administrator (System → Backup)
- [ ] Gerätetests auf den real eingesetzten Smartphones/Tablets nachholen
- [ ] Rückmeldungen über die eingebaute Feedback-Funktion sammeln
- [ ] Keine Übernahme echter Personendaten ohne geklärte Rechtsgrundlage

## 8. Ausdrücklich **nicht** freigegeben

- [ ] Öffentliches Deployment – **nicht durchgeführt, nicht freigegeben**
- [ ] Merge in den Hauptbranch – **nicht durchgeführt**
- [ ] Play-Store-Veröffentlichung (nur unsignierte Debug-APK vorhanden)
- [ ] Mehrbenutzerbetrieb über einen gemeinsamen Server
- [ ] Live-Anbindung an ERP, Bank, Zahlungsdienst oder E-Mail-Versand

---

## 9. Ablauf für ein Release

1. Änderungen auf dem Entwicklungsbranch abschließen.
2. Abschnitte 1–3 dieser Liste vollständig durchlaufen; **kein**
   fehlgeschlagener Test wird übergangen.
3. `CHANGELOG.md` und `PROJECT_STATUS.md` fortschreiben.
4. Neue Einschränkungen in `KNOWN_LIMITATIONS.md` ergänzen – ungeschönt.
5. Sauberen Commit erstellen und pushen.
6. Freigabe einholen (Abschnitt 6), erst danach ausrollen.
7. Nach dem Ausrollen: Betriebswarnungen und Fehlerprotokoll der ersten Tage
   sichten (System-Seite).
