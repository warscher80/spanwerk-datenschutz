# Preisschmiede – Projektstatus

Kalkulations- und Betriebsverwaltungs-App für Metallbaubetriebe.
Läuft vollständig **offline** (localStorage), als Web-App, Android-App (Capacitor)
und Windows-Desktop (Electron). Alle Daten bleiben lokal auf dem Gerät.

Letzte Aktualisierung: **Phase 9 – Pilotbetrieb & Betriebsüberwachung**
umgesetzt. Neue Betriebs-Engine (`betrieb.js`) + Admin-**System-Seite**
(Status, Healthchecks, Backup-Überwachung, Betriebswarnungen, Pilot-Kennzahlen,
Feedback, Fehlerprotokoll, Support-Paket, Freigabestufen). First-Login-PIN-
Pflicht ab Pilotstufe. Datenschema **v9** (`feedback`, `fehlerlog`,
`settings.betrieb`).
Doku: `AUDIT_REPORT.md`, `CALCULATION_RULES.md`, `SECURITY.md`,
`BACKUP_RESTORE.md`, `KNOWN_LIMITATIONS.md`, `DEPLOYMENT.md`,
`ARCHITECTURE.md`, `PILOT_PLAN.md`, `PILOT_CHECKLIST.md`, `OPERATIONS_GUIDE.md`,
`INCIDENT_RESPONSE.md`, `RELEASE_PROCESS.md`, `SUPPORT_GUIDE.md`,
`PILOT_RESULTS_TEMPLATE.md`. Tests: `tests/referenz.test.js` (43/43).
**Reifegrad:** **Pilot kann mit Einschränkungen starten** (siehe
AUDIT_REPORT → Pilot-Startentscheidung); voller Produktivbetrieb
(Mehrbenutzer/Server/ERP-Live) noch nicht.

---

## Architektur

| Schicht | Datei | Aufgabe |
|---|---|---|
| Datenhaltung | `assets/js/store.js` | localStorage, Migration, Beispieldaten, PIN-Hash |
| Anmeldung/Rollen | `assets/js/auth.js` | Login, Rollen, Berechtigungen |
| Berechnung | `assets/js/calc.js` | Kalkulation, Soll/Ist, Lernfaktoren |
| Produkte | `assets/js/products.js` | Produkt-/Zeitmodelle (Basis) |
| Material-Import | `assets/js/datanorm.js` | DATANORM-4.0-Parser |
| Grundsortiment | `assets/js/sortiment.js` | 112 Metallbau-Artikel mit Gewichten |
| UI/Steuerung | `assets/js/app.js` | Seiten, Modals, Navigation |
| Styling | `assets/css/styles.css` | Responsive (Desktop/Tablet/Smartphone) |

**Rollen & Berechtigungen**
- **admin** – alle Bereiche inkl. Benutzerverwaltung
- **buero** (Büro/Kalkulation) – alles außer Benutzerverwaltung
- **werkstatt** (Werkstatt/Montage) – Dashboard + Aufträge/Zeiterfassung

Anmeldung ist lokal: PIN wird **gesalzen gehasht** gespeichert (nie im Klartext).
Erst-PIN aller Benutzer: `1234` (nach dem ersten Login unter Stammdaten → Benutzer ändern).

**Datenmodell (localStorage, `version: 2`)**
```
settings { firma{name,inhaber,strasse,plzOrt,tel,email,web,uid,iban,bic,bank},
           rates{cad,fertigung,montage,projektleitung}, maschinen[],
           materialAufschlag, gemeinkosten, gewinn, verschnitt, mwst,
           transportProKm, montagePauschaleAnfahrt, angebotZaehler, projektZaehler }
maschinen[]   { id,name,schritt, stundensatz, ruestzeitStd, ruestkostensatz, fixeRuestkosten }
users[]       { id,name,benutzername,rolle,salt,hash,aktiv,erstellt }
mitarbeiter[] { id,name,gruppe,stundensatz,aktiv }
lieferanten[] { id,name,kundennummer,ansprechpartner,tel,email,web,notiz }
kunden[]      { id,name,ansprechpartner,strasse,plzOrt,tel,email,notiz,erstellt }
projekte[]    { id,nummer,name,kundeId,kommission,status,notiz,erstellt }
material[]    { id,name,typ,kategorie,unterkategorie,einheit,preis,lieferant,
                kgProEinheit,preisProKg,lager,artikelnummer,historie[] }
auftraege[]   { ... positionen[], fremdkosten[], ist ... }
lernen        { faktoren, erkenntnisse }
```

---

## Phase 1 & 2 – ERLEDIGT ✅

1. ✅ **Projekt analysiert**, Architektur & Datenmodell festgelegt.
2. ✅ **PROJECT_STATUS.md** erstellt (diese Datei).
3. ✅ **Benutzeranmeldung & Rollen** – Login-Overlay, gesalzener PIN-Hash,
   3 Rollen, rollenbasierte Navigations-Sichtbarkeit, Abmelden (Desktop + Handy).
4. ✅ **Firmenstammdaten** – Name, Inhaber, Adresse, Tel, E-Mail, Web, UID, IBAN/BIC/Bank.
5. ✅ **Kunden, Projekte & Kommissionen** – eigene Seite „Kunden & Projekte";
   Projekte einem Kunden zugeordnet, mit Nummer/Kommission/Status.
6. ✅ **Lieferantenverwaltung** – CRUD (Name, Kundennummer, Kontakt, Notiz).
7. ✅ **Materialdatenbank** – Kategorien/Unterkategorien (thesteel.com-Struktur),
   Filter/Suche, DATANORM-Import, Grundsortiment, gewichtsbasierte Preise.
8. ✅ **Mitarbeiter** – individuelle Stundenverrechnungssätze je Mitarbeiter/Gruppe.
9. ✅ **Maschinenverwaltung** – Maschinenstundensatz, **Rüstzeit**, **Rüstkostensatz**
   und **fixe Rüstkosten**; Rüstkosten je Auftrag = Rüstzeit × Satz + fix.
10. ✅ **Beispieldaten** für alle Entitäten; **Daten dauerhaft** in localStorage;
    **Desktop/Tablet/Smartphone** getestet; **Tests & Build** grün, keine Fehler.

**Bewusst noch NICHT umgesetzt** (laut Auftrag): umfangreicher Produktkonfigurator
und KI-Funktion (nur die bestehende Basis-Kalkulation/Lernfunktion ist vorhanden).

**Verifikation:** E2E-Test (`scratchpad/phase12test.js`) – Login inkl. falschem
PIN, Rollen-Nav (admin 7 / werkstatt 2 Punkte), CRUD für Kunden/Projekte/
Mitarbeiter/Lieferanten/Benutzer, Maschinen-Rüstkosten, erweiterte Firmendaten,
Login-Card auf Tablet/Mobile im Viewport – **keine JS-Fehler**.

---

---

## Phase 3A – Produktverwaltung & dynamischer Konfigurator – ERLEDIGT ✅

**Neue Dateien**
- `assets/js/konfigurator.js` – Engine: 17 Feldtypen, Sichtbarkeits-/
  Abhängigkeits-Engine (Operatoren =, !=, wahr, gesetzt, in, >, <), Pflicht-/
  Bereichsvalidierung, sicherer Formel-Evaluator (nur Arithmetik), berechnete
  Felder, Abschnitts-Gruppierung, Vorlagen-Snapshot.
- `assets/js/vorlagen.js` – 11 Produktgruppen; vollständige Vorlagen für
  **Geländer** (45 Felder), **Blecharbeiten** (inkl. Auto-Fläche/-Gewicht/
  Materialbedarf) und **Serienteile**; 3 Beispielkonfigurationen.

**Neue Datenstrukturen** (`store.js`, `version: 3`)
```
settings.dichten { Stahl:7.85, Edelstahl:7.90, Aluminium:2.70 }  // g/cm³, zentral
settings.konfigZaehler
produktgruppen[]  { id,key,name,icon,aktiv,archiviert,sort }
vorlagen[]        { id,gruppeKey,version,aktiv, felder[] }
felder[]          { key,typ,frage,hilfe,einheit,pflicht,standard,min,max,sort,
                    aktiv,optionen[],abh{feld,op,wert},formel }
konfigurationen[] { id,nummer,bezeichnung,kundeId,projektId,kommission,gruppeKey,
                    vorlageId,vorlageVersion,vorlageSnapshot[],antworten{},
                    berechnet{},status,erstellt,geaendert,bearbeiter,verlauf[] }
```

**Umgesetzt**
- Produktgruppen-Verwaltung (Admin): anlegen, bearbeiten, duplizieren,
  sortieren, aktivieren/deaktivieren, archivieren – kein Hard-Delete
  verwendeter Gruppen.
- Dynamischer Fragen-Editor je Gruppe (alle Feldeinstellungen inkl.
  Abhängigkeiten/Sichtbarkeit); Versionsnummer steigt bei Änderungen.
- Assistent: Kunde/Projekt/Kommission → Produktgruppe → dynamische
  Abschnitte → Zusammenfassung → Speichern; Autospeichern, Zurück/Weiter,
  Fortschrittsanzeige, Pflichtfeldprüfung, Entwurf fortsetzen, Duplizieren,
  Bearbeiten, Vorschau.
- Versionierung über eingefrorenen Snapshot: Vorlagenänderungen verändern
  bestehende Konfigurationen nicht.
- Automatische Gewichts-/Flächenberechnung aus Länge/Breite/Blechstärke ×
  Werkstoffdichte (zentral in Stammdaten).
- Kommission durchgängig: im Assistenten, in Listen, durchsuch-/filterbar,
  Kunde/Projekt zugeordnet, beim Duplizieren übernommen.
- Ansichten: Konfigurations-Liste (Filter Suche/Gruppe/Status), Assistent,
  Detail, Bearbeitung, Zusammenfassung, Produktgruppen-Verwaltung,
  Fragen-Editor, Vorschau. Responsive (Desktop/Tablet/Smartphone).

**Erfolgreiche Tests** (`scratchpad/p3a.js` + Engine-Test)
- Gewichtsberechnung Stahl/Edelstahl/Aluminium; Fläche; Materialbedarf inkl.
  Verschnitt · Sichtbarkeits-/Abhängigkeitsregeln · Pflichtfeldprüfung ·
  Speichern & erneutes Laden · Autospeichern (Entwurf) · Duplizieren ·
  Vorlagenversionierung (v1→v2) · Snapshot-Schutz bestehender Konfigurationen ·
  Kommissionssuche/-filter · Rollen (werkstatt ohne Konfigurator) · mobile
  Darstellung ohne Überlauf. Keine JS-Fehler.

**Bekannte Einschränkungen**
- Materialauswahl-Feld nutzt eine flache Materialliste (keine Gruppierung im
  Dropdown); Zuschnittoptimierung bewusst nicht enthalten.
- Feld-Editor bietet die gängigen Einstellungen; sehr komplexe
  Validierungsregeln (reguläre Ausdrücke o. ä.) sind noch nicht vorgesehen.

---

## Phase 3B – Vollständige Kalkulationslogik – ERLEDIGT ✅

**Neue Datei**
- `assets/js/kalkulation.js` – Decimal-sicherer Rechenkern (cent-genaue
  Rundung `r2`, keine Float-Fehler): Material (Nettobedarf, Verschnitt,
  Ausschuss, Aufrunden auf Verpackungseinheit, Fracht, Aufschlag, manueller
  Preis), Arbeit (Personenstunden × Sätze), Maschine (fixe **und**
  zeitabhängige Rüstkosten, Laufzeit, Mindestverrechnung, Werkzeug/Energie),
  Fremdleistung, Montage (getrennte Fahrt-/Montagezeit), Transport,
  Gemeinkosten (konfigurierbare Basis), Preis-Wasserfall (Selbstkosten →
  Risiko → Gewinn → Rabatt → Netto → USt → Brutto), Deckungsbeitrag/Gewinn,
  Warnungen, **Staffelpreise** (Rüstkostenverteilung), Preis-Snapshot,
  Ableitung aus Produktkonfiguration.

**Neue Datenstruktur** (`store.js`, `version: 4`)
```
settings.kalkZaehler, settings.toleranzen{gruen,gelb}
kalkulationen[] { id,nummer,bezeichnung,kundeId,projektId,kommission,konfigId,
                  gruppeKey,stueckzahl,version,status(Entwurf/freigegeben),
                  material[],arbeit[],maschine[],fremd[],montage,transport,
                  fertigungsGK,risikoProz,gewinnProz,manuellerAufschlag,
                  rabattProz,mwstProz, snapshot,ergebnis, verlauf[] }
```

**Umgesetzt**
- Eigene Seite „Kalkulation" (getrennt von der Legacy-„Schnellkalk."):
  Liste mit Kennzahlen (offen/freigegeben, Netto-Summen), Suche/Filter,
  Editor mit **Live-Neuberechnung**, Detail-/Kostenübersicht.
- Positionen (Material/Arbeit/Maschine/Fremd) hinzufügen/bearbeiten/löschen;
  Montage & Transport separat; alle automatisch vorgeschlagen und manuell
  überschreibbar (inkl. manuellem Materialpreis mit Begründung).
- „Kalkulation erstellen" direkt aus einer fertigen Produktkonfiguration
  (Material/Arbeitsgänge/Montage werden vorbelegt).
- **Freigabe** friert Preise per Snapshot ein; Änderungen erzeugen eine
  **neue Version** (revisionssicher, Änderungsverlauf).
- Staffelpreisansicht (1/10/50/100/250/500/1000) mit korrekter
  Rüstkostenverteilung.
- Warnungen: negativer DB/Gewinn, Preis unter Selbstkosten, hoher Rabatt,
  fehlende Sätze/Materialpreise, veraltete Preise, fehlende Rüstkosten,
  doppelte Bedienerkosten.
- Rollen: nur Administrator/Büro; Werkstatt hat keinen Zugriff. Responsive.

**Erfolgreiche Tests**
- Rechenkern: **34/34 Formeltests** (`scratchpad`) – Material+Verschnitt,
  Aufrunden, Arbeit (mehrere Mitarbeiter), Maschine fix/zeitabhängig, Fremd
  mit Fracht+Aufschlag, Montage, Preis-Wasserfall, DB, Gewinn, negative
  Marge, Staffelpreise, Decimal-Rundungen (0,1+0,2 / 19,99×3).
- UI (`scratchpad/p3b.js`): Erstellen aus Konfiguration, Position hinzufügen
  mit Live-Neuberechnung, Zuschlag-Änderung, Freigabe + Snapshot,
  Versionierung (v1→v2), Staffelpreise, Rollen, mobile Darstellung.
  Keine JS-Fehler.

**Bekannte Einschränkungen**
- Fix/variabel für den Deckungsbeitrag ist auf „alle direkten Kosten
  variabel, Gemeinkosten fix" voreingestellt (noch nicht je Position
  umschaltbar). Zuschnittoptimierung bewusst nicht enthalten (Schnittstelle
  vorbereitet).

## Phase 4 – Angebotsgenerator & PDF-Ausgabe – ERLEDIGT ✅

**Neue Datei**
- `assets/js/angebot.js` – Angebots-Engine (Positionstypen, Summen,
  Platzhalter, **kundensichere Ausgabe**): Positionsarten (normal,
  Überschrift, Text, Zwischensumme, Pauschal, **optional**, **alternativ**,
  Bedarf, Nachlass, Zuschlag), positionsgenaue USt, Summenberechnung mit
  getrennt gehaltenen optionalen Positionen, Angebotsnummernkreis mit
  jährlichem Neustart, Platzhalter-Ersetzung (`{{kunde}}`, `{{projekt}}`,
  `{{kommission}}`, `{{angebotsnummer}}` …), Erkennung offener Platzhalter,
  Ableitung aus einer freigegebenen Kalkulation (Modi detail/zusammen/
  pauschal), Standard-Textbausteine und -Vorlage, Beispielangebote.

**Kundensichere Ausgabe (zentrale Anforderung)**
- `Angebot.kundenAusgabe()` erzeugt ein **separates Ausgabeobjekt per
  Whitelist** – nur kundenrelevante Felder (Firma, Kunde, Positionen mit
  End-/Einzelpreisen, Summen, Texte). Interne Werte (Einkaufspreise, interne
  Stundensätze, Gemeinkosten, Deckungsbeitrag, Gewinn, Risiko,
  Selbstkosten, interne Notizen, Lieferantenkonditionen) sind **strukturell
  nicht enthalten** – nicht nur im Frontend ausgeblendet.
- `Angebot.enthaeltInterne()` – rekursiver Leak-Detektor gegen eine
  Verbotsliste; läuft als **Sicherheitsnetz vor jeder PDF-Erzeugung** und
  bricht ab, falls interne Daten erkannt würden.

**Neue Datenstruktur** (`store.js`, `version: 5`)
```
settings.angebotNummernkreis{praefix,jahr,laufend,mindestlaenge,
                             jaehrlicherNeustart}, settings.angebotVorlagen[]
angebote[] { id,nummer,version,status,bezeichnung,kundeId,projektId,kommission,
             kalkId,kalkVersion,betreff,ansprechpartner,gueltigTage,rabattProz,
             positionen[],einleitung,zahlungs-/liefer-/ausführungstexte,
             schlusstext, snapshot{ausgabe,summen,datum}, statusVerlauf[],
             auftragId }
textbausteine[] { id,kategorie,titel,text,standard,aktiv,sort }
```

**Umgesetzt**
- Eigene Seite „Angebote": Kennzahlen (offen/angenommen/abgelehnt/
  Abschlussquote), Suche/Statusfilter, Liste mit PDF/Duplizieren/Löschen.
- **Angebot aus freigegebener Kalkulation** erzeugen (3 Detailgrade).
- Editor: Kopfdaten, Rabatt, Positionsverwaltung (alle Positionstypen,
  optional/alternativ), Textfelder mit **Textbaustein-Auswahl**, Live-Summen.
- **Freigabe** friert die kundensichere Ausgabe per Snapshot ein (prüft
  Empfänger, berechnende Position, offene Platzhalter, Firmen-UID).
- Statusworkflow (12 Stufen) mit Statusverlauf; **Neue Version** für
  Änderungen nach Freigabe (revisionssicher).
- **Druckfertige A4-PDF-Ausgabe** (Firmenkopf, Empfänger, Positionstabelle,
  Summen mit USt, Zahlungs-/Liefer-/Ausführungstexte, Unterschriftszeilen) –
  offline über Druckvorschau, ohne Server/Bibliothek.
- **Umwandlung angenommener Angebote in Aufträge** (mit Soll-Snapshot der
  Kalkulation, legacy-kompatible Auftragsstruktur, Schutz vor
  Doppel-Umwandlung).
- Textbausteinverwaltung (Kategorien, Standard je Kategorie, aktiv/inaktiv).
- Rollen: Administrator/Büro; Werkstatt hat keinen Zugriff. Responsive.

**Erfolgreiche Tests**
- Engine (`angebot.js`): **17/17** Tests – Summen, optionale Positionen
  (nicht im Netto), Nummernkreis, Platzhalter, kundensichere Ausgabe,
  Leak-Detektor.
- UI/E2E (`scratchpad/p4.js`): Angebot aus Kalkulation erstellen, optionale
  Position separat gehalten, Freigabe + Snapshot, **Leak-Detektor ohne
  Treffer**, **keine verbotenen Begriffe in Kundenausgabe oder PDF-HTML**,
  PDF mit Angebotssummen erzeugt, Auftragsumwandlung mit Soll-Snapshot,
  Doppel-Umwandlung geschützt, Rollen (Werkstatt ohne Angebote, Büro mit),
  mobile Darstellung ohne Überlauf. Keine JS-Fehler.

**Bekannte Einschränkungen**
- PDF entsteht über die Browser-Druckfunktion (offline, keine PDF-Bibliothek);
  das Layout ist auf A4 optimiert. E-Mail-Versand nicht enthalten.

## Phase 7A – Management-Dashboard & betriebswirtschaftliche Auswertungen – ERLEDIGT ✅

**Architektur-Hinweis:** Die App ist eine vollständig **offline** laufende
Vanilla-JS-Anwendung (localStorage, kein Server, keine SQL-DB, kein
TypeScript). Die Vorgaben des Masterprompts (serverseitige Aggregation,
DB-Indizes, TypeScript-Prüfung) sind sinngemäß auf diese Realität übertragen:
Aggregation clientseitig, „Migration" = idempotentes `store.js`-`migrate()`,
„TypeScript-Prüfung" = `node --check`. Alle Kennzahlen werden aus real
gespeicherten Daten berechnet – keine fest verdrahteten oder zufälligen Werte.

**Neue Datei**
- `assets/js/auswertung.js` – reine, testbare Analyse-Engine (keine
  DOM-Zugriffe): Zeitraum-Presets (heute/Woche/Monat/Quartal/Jahr/Vorjahr/
  benutzerdefiniert) mit Vorperiode, Filter (Kunde/Produktgruppe/Kommission/
  Status), Hauptkennzahlen mit Vorperiodenvergleich, Angebotsauswertung
  (Abschlussquote nach **Anzahl** und **Wert**), Auftrags-/Soll-Ist-Auswertung,
  priorisierte Warnliste, Produktgruppenvergleich, Kundenanalyse,
  Maschinenanalyse (Kapazität/Auslastung/Rüstabweichung), Lernauswertung.
  Division-durch-Null-geschützt (`pct`), Decimal-Rundung (`r2`).

**Datenmodell** (`store.js`, `version: 6`)
- Maschinen um **Kapazität** ergänzt (`arbeitstage`, `stundenProTag`,
  `wartungStunden`) – in den Stammdaten pflegbar; Auslastung = Ist-Stunden /
  (Arbeitstage × Std/Tag − Wartung).
- **Beispielaufträge mit echten Soll-/Ist-Daten** geseedet (u. a. ein
  überzogener Auftrag mit negativem Gewinn + Fremdkosten), damit das Dashboard
  reale Nachkalkulation, DB, Gewinn und Kalkulationsgenauigkeit zeigt.
- Beide Auftrags-Formen (Legacy-„Vorgang" und Phase-4-Auftrag mit
  Soll-Snapshot) werden in der Engine über `normAuftrag` vereinheitlicht.

**Umgesetzt**
- **Rollenabhängiges Dashboard:** Geschäftsführung (admin) & Kalkulation
  (buero) sehen alle Kennzahlen; **Fertigung/Montage (werkstatt) sehen ein
  rein operatives Dashboard OHNE Gewinn-/Deckungsbeitragsdaten**
  (`Auth.darfFinanzen`). E2E bestätigt: keine vertraulichen Begriffe im
  Werkstatt-Dashboard.
- **Zentrale Filterleiste** (Zeitraum + Kunde + Produktgruppe), auf alle
  Elemente angewandt, aktive Filter als entfernbare Chips.
- **Hauptkennzahlen** mit aktuellem Wert, Vorperiodenvergleich (▲/▼ %),
  „kein Vergleich" bei nicht vergleichbaren Zeiträumen (keine irreführenden
  Prozentangaben).
- **Angebotsauswertung** inkl. Abschlussquote nach Anzahl/Wert; offene
  Angebote werden nie als abgelehnt gewertet (durch Test abgesichert).
- **Auftragsauswertung** (laufend, über Budget, negativer Gewinn, ohne
  Zeiterfassung, verspätet, nachkalkuliert) mit **priorisierter Warnliste**
  – jede Warnung führt per Klick zum betroffenen Auftrag (Drill-down).
- **Soll-Ist**, **Produktgruppenvergleich** (mit „wenig Daten"-Kennzeichnung
  ab < 3 Aufträgen), **Kundenanalyse**, **Maschinenauslastung**,
  **Lernfunktions-Auswertung** (Genauigkeit nur bei ≥ 3 Ist-Aufträgen
  ausgewiesen).
- **Drill-down** auf Karten/Diagramme/Produktgruppen/Warnungen.
- **Offlinefähige SVG-Balkendiagramme** (kein externes Chart-Framework),
  Tabellen scrollen mobil innerhalb `.table-wrap`.
- **Berichtsexport**: CSV (mit Schutz gegen **CSV-Formula-Injection**) für
  Angebots-, Auftrags-, Soll-Ist-, Produktgruppen-, Maschinen- und
  Kundenbericht; **Druckansicht** (interner Bericht, klar kein
  Kundenangebot). Exporte weisen Zeitraum + Filter aus.
- **Dashboard-Konfiguration je Benutzer** (Karten ein-/ausblenden,
  Standard-Zeitraum, Warnschwelle) – nur lokal für den Benutzer gespeichert.
- **Performance-Testdaten-Generator** (nur Admin, Datensätze mit
  `_testdaten` gekennzeichnet, nicht automatisch in Produktion, wieder
  entfernbar).

**Erfolgreiche Tests**
- Engine (`scratchpad/p7a.js`): **48/48** – Zeiträume, Division/0,
  Decimal-Rundung, Abschlussquote (Anzahl & Wert, Kontrollrechnung), offen ≠
  abgelehnt, Auftragswert/Selbstkosten/DB (Kontrollrechnung), negativer
  Gewinn, Warnungen mit Drill-down-ID + Priorisierung, Soll-Ist,
  Produktgruppen, Kunden, Maschinen-Verfügbarkeit/Rüstabweichung,
  Lernauswertung, Vorperiodenvergleich, Filter (Kunde/Produktgruppe),
  Euro-/Prozent-Formatierung.
- UI/E2E (`scratchpad/p7a-e2e.js`): Filterleiste, 26 KPI-Karten,
  Zeitraum-/Kundenfilter + Chip-Entfernung, Drill-down zu Angeboten/Aufträgen,
  Warnung → Auftragsseite, Karten aus-/einblenden, Export-Optionen,
  Maschinen-Kapazitätsfelder, **Werkstatt ohne Finanzdaten**, mobile
  Darstellung ohne Überlauf. Keine JS-Fehler.
- Performance: voller Report über **1005 Aufträge + 2002 Angebote in ~60 ms**
  (warm ~21 ms).

**Bekannte Einschränkungen**
- Aggregation läuft clientseitig (Offline-App ohne Server) – dank kompakter
  Datenhaltung auch bei mehreren tausend Datensätzen performant.
- Getrennte Zeiterfassungs-/Maschinen-/Materialbuchungstabellen (formale
  Phase 5) existieren noch nicht; Ist-Daten stammen aus den Positions-
  Ist-Zeiten der Aufträge. Personen-/Gehaltsauswertungen bewusst nicht
  enthalten. Standort-Filter mangels Standortdaten nicht aktiv.

## Phase 7C – Fertigungsplanung, Kapazitäten & Terminübersicht – ERLEDIGT ✅

**Neue Datei**
- `assets/js/planung.js` – reine, testbare Planungs-Engine (keine
  DOM-Zugriffe): österreichische **Feiertage** (Ostercomputus, konfigurierbar),
  Arbeitstage/Schichtmodell, arbeitszeitkonformes Terminieren
  (`addArbeitsstunden` überspringt Nächte/Wochenenden/Feiertage),
  Maschinen- und Mitarbeiterkapazität, **Abhängigkeiten** (ES/SS/EE + Puffer)
  mit **Zyklusprüfung** (topologische Sortierung), **Konflikterkennung**
  (Maschinen-/Mitarbeiter-/Fahrzeug-/Hebegerät-Doppelbelegung, Qualifikation,
  Abwesenheit, Maschinenberechtigung, Mindestbesetzung, Abhängigkeits­verletzung,
  Materialrisiko, gefährdeter Liefertermin), **automatischer Planungsvorschlag**
  (Vorwärtsterminierung, nicht-destruktiv, begründet), **Rüstoptimierung**
  (Gruppierung nach Maschine+Material, nachvollziehbare Ersparnis),
  gewichteter **Fortschritt**, **Terminprognose** (als Schätzung
  gekennzeichnet), Plan-Ist-Vergleich.

**Datenmodell** (`store.js`, `version: 7`)
- `settings.planung` (Schicht/Arbeitstage/Feiertage), `settings.qualifikationen`.
- Maschinen um `maxParallel`, `standort`, `alternativMaschinen`, `qualifikation`
  erweitert; Mitarbeiter um `qualifikationen`, `abwesenheiten` (ohne
  medizinische Details), `maschinenberechtigungen`, `team`, `standort`.
- `db.planung` { elemente, versionen, benachrichtigungen, montage }.
- **Beispielplanung mit bewusst erzeugten Konflikten** (Maschinen- und
  Mitarbeiter-Doppelbelegung, verspätetes Material, gefährdeter Liefertermin,
  Alternativmaschine, Rüstoptimierungspotenzial).

**Umgesetzt (UI)**
- Eigene Seite **Planung** mit Ansichten: Übersicht, Maschinenbelegung,
  Team-/Mitarbeiterbelegung, **Gantt-lite**, **Kanban** (8 Fertigungsstatus),
  Montageplanung, **Werkstattansicht**.
- Zentrale Filterleiste; die **Kommission ist in allen Ansichten sichtbar und
  durchsuchbar**.
- **Konfliktpanel** (priorisiert) und **Rüstoptimierungs-Panel** aus realen
  Plandaten.
- **Automatischer Planungsvorschlag** je Auftrag mit Vorschau (Start/Ende/
  Maschine/Konflikte/Begründung) – wird **erst nach ausdrücklicher Übernahme**
  wirksam, legt eine **Planungsversion** an.
- **Konfliktgeprüftes Verschieben/Zuweisen** eines Arbeitsgangs (Termin, Dauer,
  Maschine, Team, Status, Material, Fixtermin); erzeugt eine Änderung Konflikte,
  wird ausdrücklich rückgefragt.
- **Werkstattansicht** (auch als eigene Rolle Fertigung/Montage): heutige und
  nächste Arbeitsgänge mit Start-Schaltfläche für die Zeiterfassung – **ohne
  vertrauliche Kalkulations-/Gewinn-/Deckungsbeitragsdaten**.
- CSV-Export des Fertigungsplans (mit Filter/Zeitstempel).

**Erfolgreiche Tests**
- Engine (`scratchpad/p7c.js`): **37/37** – Kapazität, Maschinen-/Mitarbeiter-/
  Fahrzeug-Doppelbelegung, Qualifikation, Abwesenheit, Schichtmodell, Feiertag
  (Computus), Abhängigkeitsverletzung, **Zyklusverhinderung**, Material,
  Planung aus Kalkulation, **Kalkulation bleibt unverändert**, Drag-/Move-
  Konfliktprüfung, Auto-Vorschlag (Reihenfolge/Begründung), Alternativmaschine,
  Rüstoptimierung, Montage-/Fahrzeugkonflikt, gewichteter Fortschritt,
  Terminprognose, Plan-Ist, Fixtermin, Kommission je Element, Seed-Konflikte.
- UI/E2E (`scratchpad/p7c-e2e.js`): 7 Ansichten, Konflikt-/Optimierungspanel,
  Kommission durchsuchbar, Kanban, Element-Editor, Auto-Vorschlag +
  Versionierung, Export, **Werkstatt ohne vertrauliche Kennzahlen**, mobil
  ohne Überlauf. Keine JS-Fehler.

**Bekannte Einschränkungen**
- Terminverschiebung erfolgt über einen konfliktgeprüften Editor (funktional
  äquivalent), **echtes Pixel-Drag-and-drop im Gantt** und Zoom-Stufen sind
  noch nicht umgesetzt. Feiertage/Schicht sind konfigurierbar hinterlegt, eine
  eigene Verwaltungs-UI dafür folgt. Benachrichtigungen sind intern gespeichert
  (kein Push/SMS/E-Mail – bewusst als spätere Erweiterung vorbereitet).

## Phase 7D – Zeichnungen, Stücklisten & Maßübernahme – ERLEDIGT ✅

**Ehrlichkeitsgrundsatz:** Automatisch erkannte Werte sind IMMER „ungeprüft"
und müssen bestätigt werden; sie fließen **nie** automatisch in eine
freigegebene Kalkulation. Keine Maßschätzung aus Pixeln, keine externen
OCR-/KI-Dienste, keine vorgetäuschte CAD-Erkennung.

**Neue Datei**
- `assets/js/dokumente.js` – reine, testbare Analyse-Engine: Prüfsumme
  (FNV-1a), Upload-Validierung (Endung/Größe/ausführbare Dateien/Dublette),
  **CSV-Stücklistenparser** (Trennzeichen-/Dezimalerkennung, Auto-Spaltenzuordnung,
  Validierung, Einheitenumrechnung, Duplikaterkennung), **Materialabgleich**
  gegen die Materialdatenbank (eindeutig/mehrere/kein Treffer, abweichende
  Einheit, veralteter Preis), **Erkennungswert-Modell** (Status ungeprüft/
  bestätigt/korrigiert/abgelehnt) mit **Verwechslungswarnungen** (0/O, 1/I,
  5/S, 6/8, Komma/Punkt, mm/cm, ⌀, °), **konservative PDF-Textextraktion**
  (nur unkomprimierte Streams; komprimiert/gescannt → ehrlicher Hinweis,
  keine Erfindung), Passwort-/Verschlüsselungserkennung, **ASCII-DXF-Parser**
  (Entities/Einheiten/Begrenzung, ohne Material-/Stärkeannahme),
  Zeichnungskopf-Heuristik (niedrige Konfidenz), **kontrollierte Übernahme**
  (freigegebene Kalkulation gesperrt, Snapshot unverändert),
  **Revisionsvergleich** (hinzugefügt/entfernt/geändert/unverändert) und
  **Analyseprotokoll** (reproduzierbar, mit Parserversion).

**Tatsächlich unterstützte Formate (ehrlich gekennzeichnet)**
- **Real verarbeitet:** PDF (eingebetteter Text, konservativ), CSV-Stücklisten,
  Bilder (Vorschau), ASCII-DXF (Entities/Einheiten).
- **Nur Ablage / vorbereitet:** XLSX/XLS (bitte als CSV exportieren – kein
  Formelimport), DWG/STEP/IFC (**nicht konfiguriert**, keine lizenzierte
  Konvertierung), OCR (nicht konfiguriert). Diese werden in der UI klar als
  „nur Ablage" bzw. „nicht konfiguriert" markiert und nicht vorgetäuscht.

**Datenmodell** (`store.js`, `version: 8`)
- `db.dokumente[]` (Nummer, Typ, Format, Prüfsumme, Zeichnungsnummer/Revision,
  Version/Vorgänger/aktuell, Kommission, Inhalt/dataUrl, Analysen[]),
  `settings.dokumentZaehler`. Beispieldokumente (Zeichnung 1045 Rev A/B,
  CSV-Stückliste) klar als Beispiel gekennzeichnet.

**Umgesetzt (UI)**
- Seite **Dokumente**: Liste mit Suche/Typfilter, **Upload-Assistent**
  (FileReader, Format-/Größenprüfung, Dubletten-Warnung, Zeichnungsnummer/
  Revision-Vorschlag aus PDF-Text), Detailansicht mit Metadaten +
  **Versionshistorie**, **Vorschau** (PDF-Text, CSV-Tabelle, Bild, DXF-Kennzahlen).
- **Analyseansicht**: erkannte Kopf-/Maßwerte als Tabelle mit
  **Bestätigen/Korrigieren/Ablehnen** und deutlichem „ungeprüft"-Hinweis;
  **CSV-Stücklistenimport** mit editierbarer Spaltenzuordnung, Validierung
  und Materialabgleich (mehrdeutige Treffer werden nicht automatisch
  zusammengeführt).
- **Kontrollierte Übernahme**: bestätigte Werte bzw. Stücklistenpositionen in
  eine **neue Produktkonfiguration (Entwurf)**; jede Übernahme wird
  protokolliert. **Revisionsvergleich** zwischen Vorgänger und aktueller
  Revision mit Hinweis auf möglicherweise veraltete Kalkulationen (keine
  automatische Neuberechnung).
- Rollen: Administrator/Büro; Werkstatt hat keinen Dokumentenzugriff.
  Responsive.

**Erfolgreiche Tests**
- Engine (`scratchpad/p7d.js`): **43/43** – sicherer PDF-/Excel-Upload,
  unzulässiger Typ, Größenlimit, Dublette, PDF-Textextraktion,
  Kopferkennung, Verwechslungswarnungen, bestätigen/korrigieren/ablehnen,
  keine Pixelmaße, CSV-Import (Semikolon/Komma), Auto-Mapping, Materialabgleich
  (eindeutig/mehrdeutig/kein), Einheitenumrechnung, Übernahme in Konfiguration,
  bestehender Wert bleibt, freigegebene Kalkulation gesperrt/Snapshot
  unverändert, Revisionsvergleich, relevante Änderung markiert, Rollenrecht,
  Analyseprotokoll, beschädigte/verschlüsselte Datei, DXF-Einheitenkonflikt.
- UI/E2E (`scratchpad/p7d-e2e.js`): Beispieldokumente, Ehrlichkeits-Hinweis,
  CSV-BOM-Analyse + Materialabgleich + Übernahme in Konfiguration,
  PDF-Kopferkennung + Bestätigung, Revisionsvergleich, echter Datei-Upload,
  Werkstatt ohne Zugriff, mobil ohne Überlauf. Keine JS-Fehler.

**Bekannte Grenzen**
- PDF-Textextraktion nur für **unkomprimierte** Textstreams; gescannte/
  komprimierte PDFs liefern keinen Text (ehrlicher Hinweis, kein OCR).
  DWG/STEP/IFC/XLSX-Parsing und echte OCR erfordern Bibliotheken/Serverdienste
  und sind bewusst nicht als funktionsfähig ausgegeben. Dateien liegen lokal
  (Größenlimit) – produktiv gehört dies serverseitig.

## Nächster Schritt

**Phase 7B – Materialpreisimporte, Lieferantenschnittstellen & ERP-
Vorbereitung:** CSV-/XLSX-Importzentrale mit Spaltenzuordnung, Validierung,
Preisversionierung/-freigabe und Importprofilen; modulare SupplierAdapter
(Frankstahl u. a.) und KingBill-Dateiexport – nicht konfigurierte Live-APIs
werden eindeutig als „Dateiimport/-export" gekennzeichnet, keine
vorgetäuschte Live-Schnittstelle, kein Web-Scraping. Danach: vollständiger
End-to-End-Gesamtcheck, Sicherheitsprüfung und Vorbereitung für den
Produktivbetrieb (Zeichnungs-/Stücklistenimport aus Phase 7D ist erledigt).

**Weiterhin offen (formal):** Phase 5 (dedizierte mobile Zeiterfassung &
Nachkalkulations-Tabellen) und Phase 6 (statistische Lernfunktion, regel-
basiert, ohne externe KI). Eine Legacy-Variante beider Bereiche
(Ist-Zeiterfassung je Auftragsposition, Erkenntnis-/Korrekturfaktoren) ist
bereits vorhanden und speist Dashboard und Planung.
