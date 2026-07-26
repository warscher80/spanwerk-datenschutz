# Wohnideen Hueter — Website

Statische, moderne Unternehmenswebsite für **Wohnideen Hueter** (Rudolf Hueter e.U.),
das persönliche Einrichtungshaus in Irschen im oberen Drautal (Kärnten).

Kein Framework, kein Runtime-JavaScript-Ballast: reines, semantisches HTML +
modernes CSS + minimales Vanilla-JS. Ausgeliefert als statische Dateien
(z. B. über GitHub Pages) unter `/wohnideen-hueter/`.

## Aufbau

```
wohnideen-hueter/
├─ site.config.mjs     ← ZENTRALE Unternehmens-, Kontakt- & Standortdaten
├─ build.mjs           ← Generator (erzeugt HTML, Bilder, sitemap, robots)
├─ templates/
│  ├─ layout.mjs       ← Head, Header/Navigation, Footer, SEO, Schema.org
│  └─ placeholder.mjs  ← SVG-Platzhalterbilder (bis echte Fotos vorliegen)
├─ content/            ← Seiteninhalte (home, category, pages, legal …)
├─ assets/
│  ├─ css/styles.css   ← Design-System
│  ├─ js/main.js       ← Navigation, Reveal-Animationen, Formular, Karte
│  ├─ fonts/           ← selbst gehostete Schriften (DSGVO-konform)
│  └─ img/             ← generierte Platzhalterbilder (SVG)
└─ *.html              ← generierte Seiten (nicht von Hand editieren)
```

## Bauen

```bash
node build.mjs
```

Erzeugt alle `*.html`, Platzhalterbilder unter `assets/img/`, `robots.txt`
und `sitemap.xml`. **Die HTML-Dateien werden generiert** – Inhalte immer in
`content/` bzw. Daten in `site.config.mjs` ändern, dann neu bauen.

## Inhalte ändern

- **Adresse, Telefon, Öffnungszeiten, Marken, Sortiment:** `site.config.mjs`
- **Seitentexte:** entsprechende Datei in `content/`
- **Design/Farben/Typografie:** `assets/css/styles.css` (CSS-Variablen ganz oben)

## Echte Bilder einsetzen

Aktuell zeigen alle Bilder klar gekennzeichnete Platzhalter
(„Platzhalter · echtes Foto folgt"). Zum Ersetzen ein echtes Foto unter
`assets/img/<name>.(jpg|webp)` ablegen und im jeweiligen `content/`-Template
die Bildendung anpassen. Empfohlene Seitenverhältnisse: Hero 16:9–8:5,
Kategorie-Karten 4:5, Feature/Split 5:4, Projekte 3:2, Porträts 1:1.

## Offene Punkte (TODO)

Im Code als `TODO` markiert – u. a. genaue Öffnungszeiten, echte Projekt- und
Teamfotos, freigegebene Kundenstimmen, Hosting-Details für die
Datenschutzerklärung und die finale Prüfung der Rechtstexte durch den Betreiber.
**Es wurden keine Fakten, Bewertungen oder Referenzen erfunden.**
