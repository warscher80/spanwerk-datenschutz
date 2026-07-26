# Final Audit — Wohnideen Hueter

Production-Readiness-Audit der gesamten Website. Alle im Rahmen ohne zusätzliche
Unternehmensinformationen lösbaren Punkte wurden **direkt im Code behoben**.

## Automatisiert geprüft (headless Chromium)

- **17 Routen × 8 Breiten (320 / 360 / 390 / 430 / 768 / 1280 / 1440 / 1920 px)**
  - ✅ kein horizontaler Überlauf
  - ✅ keine Console-Errors / Page-Errors
  - ✅ genau **eine `<h1>`** pro Seite
  - ✅ kein `<img>` ohne `alt`
  - ✅ jede Seite mit eigenem `<title>` und Meta-Description
- ✅ TypeScript (`tsc --noEmit`) fehlerfrei
- ✅ ESLint 0 Errors / 0 Warnings
- ✅ Produktions-Build + statischer Export (26 Seiten) erfolgreich
- ✅ Lightbox per Tastatur bedienbar (Öffnen, Blättern, Esc, Fokusfalle)
- ✅ Kontaktformular-Rückfall zeigt keine falsche „gesendet“-Meldung

## Behobene Punkte (Auszug)

**Inhalt / Vertrauen**
- Sämtliche sichtbaren Platzhalter-/„Beispiel“-/„TODO“-Texte aus Produktionsseiten
  entfernt (im gerenderten HTML 0 Treffer). Verbleibende TODOs nur in Code-Kommentaren
  und Dokumentation.
- Platzhalterbilder ohne aufgedruckte „Platzhalter“-Beschriftung neu erzeugt.
- Ortsbezogenen Projekttitel entschärft (keine erfundenen Orte/Namen).
- Alt-Texte von Platzhalter-Wortlaut bereinigt, beschreibend gehalten.
- Leere „Kundenstimmen“-Sektion sauber ausgeblendet (keine erfundenen Bewertungen).

**Design / Code-Hygiene**
- 5 ungenutzte Komponenten entfernt (HomeHero, CategoryCard, AdvantageCard,
  ProcessStepCard, BrandGrid) und deren Imports bereinigt.
- Framer Motion nur über eine kleine `Reveal`-Client-Komponente eingebunden
  (nicht pro Komponente).

**Barrierefreiheit**
- Kontrast der Hinweis-/Label-Farbe (`--color-ink-mute`) auf WCAG-AA angehoben.
- Lightbox: Fokusfalle ergänzt, Fokus-Rückgabe an das auslösende Element.
- 404-Seite bietet drei klare Wege (Startseite, Wohnwelten, Kontakt).

**Navigation / UX**
- Projektkarten überall zur jeweiligen Detailseite verlinkt.
- Mobile Kontaktleiste auf zwei Aktionen reduziert (Anrufen · Termin anfragen).

**SEO**
- Eigene Titel/Descriptions/OG je Seite; FAQPage-Schema (nur sichtbare, allgemeine
  Antworten); LocalBusiness/FurnitureStore-Schema mit **echten** Kontakt-/Adressdaten;
  Projektdetails in `sitemap.xml`. Keine erfundenen Bewertungen/AggregateRating.

**Datenschutz / Sicherheit**
- Keine Cookies, kein Tracking; Schriften lokal gehostet; Karte lädt erst nach
  Klick (Zwei-Klick-Lösung). Keine Secrets im Repository; nur öffentliche
  `NEXT_PUBLIC_`-Variablen im Client. Externe Links mit `rel="noopener noreferrer"`.

## Seitenbestand (alle erreichbar, keine Dubletten/Testseiten)

`/` · `/kuechen` · `/wohnen` · `/essen` · `/schlafen` · `/vorzimmer` · `/bad` ·
`/planung-service` · `/projekte` · `/projekte/[slug]` (6) · `/marken` ·
`/ueber-uns` · `/kontakt` · `/impressum` · `/datenschutz` · `/barrierefreiheit` ·
404 · `sitemap.xml` · `robots.txt`

## Verbleibende offene Punkte (benötigen Unternehmensinformationen)

Vollständige Liste inkl. Bildspezifika in **`CONTENT-NEEDED.md`**. Kurz:

- **Bilder:** echte Fotos (Hero, Wohnwelten, Projekte, Team, Schauraum) ersetzen die
  abstrakten Platzhalter.
- **Projekte:** echte Projektdaten/-fotos (Titel, Leistungen, Materialien, Galerie).
- **Team:** echte Porträtfotos von Rudi & Andrea Hueter.
- **Unternehmen:** Gründungsjahr/Geschichte, ggf. Auszeichnungen (nur wenn belegt).
- **Öffnungszeiten & Geo-Koordinaten** final bestätigen.
- **Kundenstimmen:** echte, freigegebene Rückmeldungen.
- **Marken:** Zuordnung/Vollständigkeit final abgleichen.

## Erforderliche Zugangsdaten (nur bei echtem Formularversand)

Für serverseitigen E-Mail-Versand: SMTP-/Mailservice-Zugang und Setzen der in
`ENVIRONMENT.md` beschriebenen Server-Variablen. Standardmäßig nicht nötig
(E-Mail-Programm-Rückfall aktiv).

## Deployment-Voraussetzungen

- Statischer Host für `out/` (eigene Domain empfohlen) – Details in `DEPLOYMENT.md`.
- Für echten Formularversand: Node-fähiger Host + Endpoint-Aktivierung.

## Bekannte Einschränkungen

- Alle Bilder sind derzeit **abstrakte Platzhalter** (keine Fotos). Optik ist
  bewusst dezent; ersetzt werden sie über gleichnamige Dateien in `public/images`.
- Ohne serverseitigen Endpoint ist das Kontaktformular ein E-Mail-Programm-Handoff
  (bewusst, statt Scheinversand).
- Browsertests soweit im System möglich (Chromium/Playwright). Safari-spezifische
  Punkte (svh-Viewport, backdrop-blur, sticky) sind berücksichtigt, aber nicht auf
  echter Safari-Hardware verifiziert.
- Rechtstexte (Impressum/Datenschutz) sind sorgfältig, aber **nicht anwaltlich
  geprüft** – vor Livegang prüfen lassen (in Doku als TODO markiert).

## Empfehlung vor Veröffentlichung

1. Echte Bilder & Projektdaten einpflegen (`CONTENT-NEEDED.md`).
2. Öffnungszeiten, Kontaktdaten und Markenliste final bestätigen.
3. Impressum & Datenschutzerklärung rechtlich prüfen lassen; bei aktivem
   Serverformular die Datenverarbeitung in der Datenschutzerklärung ergänzen.
4. Domain/Deployment fixieren (`site.url`, `NEXT_PUBLIC_BASE_PATH`).

**Technischer Stand:** stabil, sauber gebaut und veröffentlichungsbereit; für den
Livegang fehlen ausschließlich echte Inhalte und die rechtliche Endprüfung.
