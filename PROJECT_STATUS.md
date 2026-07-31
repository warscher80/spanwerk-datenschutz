# Preisschmiede – Projektstatus

Kalkulations- und Betriebsverwaltungs-App für Metallbaubetriebe.
Läuft vollständig **offline** (localStorage), als Web-App, Android-App (Capacitor)
und Windows-Desktop (Electron). Alle Daten bleiben lokal auf dem Gerät.

Letzte Aktualisierung: Umsetzung **Phase 1 & 2** abgeschlossen.

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

## Nächster Schritt

**Phase 4 – Angebotsgenerator & PDF-Ausgabe:** aus einer freigegebenen
Kalkulation ein professionelles Kundenangebot erzeugen – interne Daten
(Einkaufspreise, Kostensätze, Gemeinkosten, Deckungsbeitrag, Gewinn) niemals
im Kunden-PDF; Angebotsnummernkreis, Status, Editor, Textbausteine, Vorlagen,
druckfertige PDF-Ausgabe.
