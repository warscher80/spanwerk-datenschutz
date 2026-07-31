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

## Offene Aufgaben (Folgephasen)

- **Phase 3:** Produktkonfigurator (Geländer, Zäune, Tore, Vordächer …) mit
  parametrischen Zeit-/Materialmodellen ausbauen.
- **Phase 4:** KI-/Lernfunktion vertiefen (Vorschläge, Preisautomatik).
- Aufträge fester mit Projekten/Kommissionen verknüpfen (Auswahl im Auftrag).
- Angebots-PDF um Bankdaten/UID aus den erweiterten Firmenstammdaten ergänzen.
- Optional: feinere Rechte je Bereich, Mitarbeiter-Zeiterfassung je Person.

## Nächster Umsetzungsschritt

**Aufträge mit Projekten verknüpfen:** Im Auftrag ein Projekt/eine Kommission
auswählbar machen und im Dashboard/Projektblatt je Projekt auswerten – als
Brücke zwischen der neuen Projektverwaltung (Phase 2) und dem Auftragswesen,
bevor der Produktkonfigurator (Phase 3) ausgebaut wird.
