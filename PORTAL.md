# Kundenportal – digitale Angebotsannahme (Phase 12)

Sicheres, firmenbezogenes Portal, über das Kunden freigegebene Angebote ansehen,
prüfen, optionale/Alternativpositionen wählen und ein Angebot **nachvollziehbar
annehmen oder ablehnen** können. Eigene, mobil-first Oberfläche
(`portal.html` + `assets/js/portal-app.js`), die ausschließlich die bestehenden
Engines und deren Sicherheitslogik nutzt (`assets/js/portal.js`, `angebot.js`,
`store.js`).

## Zugriffsarten

- **Portal-Konto:** Firma (Branding) wählen, E-Mail + Passwort. Passwort ist
  gesalzen gehasht gespeichert. Rollen: Kundenadministrator, Entscheider,
  technischer Ansprechpartner, nur lesen. Nur Kundenadministrator/Entscheider
  dürfen verbindlich annehmen.
- **Sicherer Angebotslink:** zufälliger Token, **gehasht** gespeichert (nie im
  Klartext), zeitlich begrenzt, widerrufbar, optional einmalig, **scoped auf
  genau ein Angebot und einen Mandanten**. Ein Link öffnet nur sein Angebot.

> Demo/Test: Konto-Passwort `portal1234`, Angebotslink-Token
> `DEMO-ANGEBOTSLINK`. **Kein echter E-Mail-Versand.**

## Funktionen

- **Dashboard** (Konto): eigene Angebote nach Status (offen/angenommen/
  abgelehnt/abgelaufen), freigegebene Dokumente. Link-Zugang öffnet direkt das
  betreffende Angebot.
- **Angebotsansicht:** kundensichere Ausgabe (Whitelist aus `angebot.js`) –
  Positionen, Mengen, Einzel-/Gesamtpreise, Netto, USt je Satz, Brutto,
  Konditionen. Zeigt **exakt die freigegebene Version**.
- **Optionale Positionen:** ankreuzbar, **nicht vorausgewählt**.
- **Alternativpositionen:** je Gruppe höchstens eine (Radio inkl. „keine"),
  ungültige Kombinationen ausgeschlossen.
- **Server-seitige Neuberechnung:** Die Gesamtsumme wird bei jeder Auswahl aus
  der **freigegebenen Angebotsversion** neu berechnet (zentrale Decimal-/
  Rundungslogik, `Angebot.summen`). **Frontend-Preise sind nie verbindlich** –
  es zählen nur die Auswahl-IDs.
- **PDF-Download:** Angebot und Bestätigung als druckbares Dokument
  (Browser „Als PDF speichern"); enthält Mandanten-Branding.
- **Fragen & Nachrichten:** kundensichtbare Nachrichten zum Angebot; interne
  Notizen sind strikt getrennt und nie sichtbar.
- **Annahme:** Zusammenfassung (Version, Optionen, verbindliche Summe, USt,
  Konditionen, Annahmeerklärung), Pflichtfelder (Name, E-Mail, Zustimmung),
  optional Funktion/Bestellnummer/Kommentar → **manipulationsgeschütztes
  Annahmeprotokoll** (Siegel/Prüfsumme, Version, Auswahl, Summe, Zeitpunkt/
  Zeitzone, Zugang, Transaktions-ID, App-Version). Schutz gegen Doppelannahme,
  Ablauf, ersetzte Version, fehlende Berechtigung.
- **Bestätigungsansicht + Bestätigungs-PDF** (unveränderlich, mit Dokument­
  kennung).
- **Ablehnung:** optionaler Grund + Kommentar (Grund nicht erzwungen).

## Was NIE im Portal erscheint

Einkaufspreise, Materialaufschläge, interne Stundensätze, Maschinen-/Rüstkosten,
Selbstkosten, Deckungsbeitrag, Gewinn, Lernvorschläge, interne Notizen, Daten
anderer Kunden oder Firmen. Absicherung: kundensichere Whitelist + rekursiver
Leak-Detektor (`Angebot.enthaeltInterne`) blockiert eine Ausgabe mit internen
Feldern.

## Sicherheit / Mandantentrennung

- Das Portal arbeitet ausschließlich im **Namespace des jeweiligen Mandanten**
  (`preisschmiede.tenant.<id>`); es liest nie fremde Mandanten.
- Ein Konto sieht nur Angebote **seines eigenen Kunden**; ein Link nur **sein**
  Angebot. Cross-Tenant- und Fremdkunden-Zugriff werden abgewiesen.
- Alle Preise werden serverseitig-äquivalent aus der freigegebenen Version
  geladen und berechnet; manipulierte Browser-Preise wirken nicht.
- Getestet: 46 Engine-/Sicherheitstests + End-to-End-Browsertests (Konto- und
  Link-Zugang, Neuberechnung, Annahme, Cross-Tenant-Branding, mobil/Desktop).

## Getestete Abläufe

Angebot öffnen → Option/Alternative wählen → Preis wird serverseitig neu
berechnet → Angebot verbindlich annehmen → Bestätigungs-PDF – jeweils für zwei
getrennte Mandanten mit eigenem Branding (Konto- und Link-Zugang), mobil (390 px),
Tablet und Desktop, ohne horizontalen Überlauf und ohne internen Datenleak.

## Rechtliche Einordnung (bitte prüfen lassen)

Die Funktion ist eine **dokumentierte digitale Angebotsannahme / Zustimmung**,
**keine** qualifizierte elektronische Signatur. Der Annahmetext ist
konfigurierbar. Die verbindliche rechtliche Ausgestaltung sollte von einer
Rechtsberatung geprüft werden.

## Bekannte Einschränkungen (ehrlich)

- Reine Offline-App ohne Backend: die Trennung ist client-/namespaceseitig,
  **nicht serverseitig erzwungen**; echter Mehrbenutzer-Server-Betrieb,
  signierte Server-Download-Links und echte Auth erfordern ein Backend.
- **Kein echter E-Mail-Versand** (Einladung/Benachrichtigung nur Vorschau/
  „nicht gesendet – Dienst nicht konfiguriert").
- PDF entsteht über die Druckfunktion des Browsers (kein Server-PDF-Dienst).
- Kundenuploads/Zeichnungsfreigabe sind im Datenmodell vorbereitet; die
  Oberfläche dieser Nebenfunktionen ist noch nicht ausgebaut.

## Nächster Schritt

Rechnungen, Teilrechnungen, Nachträge und ERP-Übergabe (Phase 13).
