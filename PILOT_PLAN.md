# Pilot-Plan – Preisschmiede

## Ziel
Kontrollierter Pilotbetrieb in **einem** Metallbaubetrieb, um Kalkulation,
Angebot, Auftrag, Zeiterfassung und Nachkalkulation im Echteinsatz zu prüfen –
ohne Risiko für Bestandsdaten und ohne externe Live-Übertragungen.

## Rahmen
- **Dauer:** empfohlen **4–6 Wochen**.
- **Benutzer:** **6–8** (siehe Rollen unten).
- **Geräte:** ein zentraler PC (Büro/Kalkulation) + 1–2 Tablets/Smartphones
  (Werkstatt/Montage). Datenabgleich per Backup-Export/Import oder WLAN-Sync.
- **Freigabestufe:** in der App auf **Pilot** stellen (System → Freigabestufe).
  Pilotfunktionen sind gekennzeichnet.

## Pilotbenutzer & Rollen
| Rolle in App | Pilotperson | Zweck |
|---|---|---|
| admin | 1 Administrator | Einrichtung, Backup, System |
| buero | 1 Geschäftsführung | Auswertungen, Freigaben |
| buero | 1 Kalkulator | Kalkulation/Angebote |
| buero | 1 Projektleiter | Planung/Termine |
| werkstatt | 2 Fertigungsmitarbeiter | Zeiterfassung |
| werkstatt | 2 Monteure | Montagezeiten |
| werkstatt | 1 Zeiterfassung | ausschließlich Zeiten |

> Hinweis: Die App kennt technisch die Rollen **admin/buero/werkstatt**. Die
> obigen Funktionsrollen werden darauf abgebildet. Keine allgemein bekannten
> Standard-PINs verwenden; ab Freigabestufe Pilot wird beim ersten Login ein
> PIN-Wechsel erzwungen.

## Pflicht-Abläufe im Pilot
Kunde/Projekt · Kommission · Produktkonfiguration · Kalkulation · Maschinen-/
Rüstkosten · Angebot · Auftrag · mobile Zeiterfassung · Materialverbrauch ·
Nachkalkulation.

## Optional (Pilotstatus, gekennzeichnet)
Lernvorschläge · automatische Planung · Zeichnungserkennung ·
Lieferantenadapter · KingBill-Export · Bestellvorschläge.

## Erfolgskriterien (ehrlich, keine Schönfärberei)
- Referenzkalkulation weiterhin korrekt.
- Angebots-PDFs ohne interne Daten, korrekt lesbar.
- Timer/Zeiterfassung zuverlässig, keine offenen Timer am Tagesende.
- Soll-Ist-Vergleich plausibel gegenüber Bauchgefühl der Meister.
- Tägliches Backup vorhanden; ein Restore-Test erfolgreich.
- Keine offenen kritischen/hohen Fehler.

## Datengrundlage
Echte Betriebsdaten **nur** über den kontrollierten Pilotimport
(siehe PILOT_CHECKLIST.md, Abschnitt Import) – **kein** automatisches Auslesen
aus Alt-Systemen, **keine** Beispieldaten in der Pilotumgebung.

## Auswertung
Wöchentliche Sichtung von System → Pilot-Kennzahlen, Feedback und
Fehlerprotokoll. Ergebnis in `PILOT_RESULTS_TEMPLATE.md` festhalten.
