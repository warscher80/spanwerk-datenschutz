# Wohnideen Hueter — Website

Moderne, hochwertige Unternehmenswebsite für **Wohnideen Hueter** (Rudolf
Hueter e.U.), das persönliche Einrichtungshaus in Irschen im oberen Drautal
(Kärnten). Umgesetzt als eigenständige, statisch exportierbare Next.js-App –
premium im Auftritt, schlank in der Technik.

## Technologien

- **Next.js 15** (App Router) mit **statischem Export** (`output: "export"`)
- **TypeScript** (strikt, keine `any` ohne Not)
- **Tailwind CSS v4** – zentrales Designsystem über `@theme`-Tokens
- **Framer Motion** – dezente, zugängliche Reveal-/Menü-Animationen
- **next/font (lokal)** – selbst gehostete Schriften (DSGVO-konform)
- **ESLint** (`eslint-config-next`)

Kein Runtime-Server nötig: Der Build erzeugt reine HTML/CSS/JS-Dateien, die auf
jedem statischen Host laufen (eigene Domain, GitHub Pages, CDN).

## Installation & Entwicklung

```bash
npm install          # Abhängigkeiten installieren
npm run dev          # Entwicklungsserver → http://localhost:3000
```

## Build & Qualität

```bash
npm run build        # Produktions-Build + statischer Export nach ./out
npm run typecheck    # TypeScript-Prüfung ohne Emit
npm run lint         # ESLint
npm run gen:images   # Platzhalterbilder neu erzeugen (public/images)
```

Das exportierte, statische Ergebnis liegt in **`out/`** und kann 1:1 auf einen
Webserver hochgeladen werden.

### Deployment auf der Zieldomain (Root)

Für den Betrieb auf `https://www.wohnideen-hueter.at` (Domain-Root) ist keine
weitere Konfiguration nötig: `npm run build`, dann Inhalt von `out/` deployen.

### Deployment in einem Unterverzeichnis (z. B. GitHub Pages Projektpfad)

Wenn die Seite **nicht** im Root, sondern unter einem Pfad läuft, den Basis-Pfad
über die Umgebungsvariable setzen (präfixt Assets/Links automatisch):

```bash
NEXT_PUBLIC_BASE_PATH="/wohnideen-hueter" npm run build
```

> Hinweis: Dieses Repository hostet mehrere unabhängige Projekte. Bevor ein
> GitHub-Pages-Workflow aktiviert wird, die bestehende Pages-Konfiguration
> prüfen, um Konflikte zu vermeiden.

## Projektstruktur

```
wohnideen-hueter/
├─ src/
│  ├─ app/                 App Router – je Route ein Ordner mit page.tsx
│  │  ├─ layout.tsx        Root-Layout (Fonts, Header, Footer, SEO, JSON-LD)
│  │  ├─ globals.css       DESIGNSYSTEM (Tailwind @theme-Tokens + Basis)
│  │  ├─ page.tsx          Startseite
│  │  ├─ [slug]/           Sortiment-Vorlage (Küchen, Wohnen, … via Slug)
│  │  ├─ planung-service/  projekte/  marken/  ueber-uns/  kontakt/
│  │  ├─ impressum/  datenschutz/  barrierefreiheit/
│  │  ├─ not-found.tsx     404-Seite
│  │  └─ sitemap.ts  robots.ts
│  ├─ components/          Wiederverwendbare UI-Komponenten
│  ├─ lib/
│  │  ├─ site.ts           ZENTRALE INHALTSDATEN (Kontakt, Sortiment, Marken …)
│  │  ├─ seo.ts            Metadaten-Helfer + LocalBusiness-Schema
│  │  ├─ fonts.ts          Schrift-Einbindung (lokal)
│  │  └─ cn.ts
│  └─ fonts/               Schrift-Dateien (woff2)
├─ public/images/          Platzhalterbilder (SVG, generiert)
├─ scripts/                Generator für Platzhalterbilder
├─ next.config.ts          Export- & basePath-Konfiguration
└─ README.md
```

## Inhalte bearbeiten

- **Kontaktdaten, Öffnungszeiten, Adresse, Marken, Sortiment, Projekte, FAQ:**
  zentral in `src/lib/site.ts` – nirgends mehrfach hart kodiert. Die Struktur ist
  so gewählt, dass später leicht ein CMS angeschlossen werden kann.
- **Texte der Sortimentsseiten** (Küchen, Wohnen, Essen, Schlafen, Vorzimmer,
  Bad): zentral in `src/lib/sortiment.ts`. Die Seiten selbst
  (`src/app/<bereich>/page.tsx`) setzen die Abschnitte je Bereich in
  unterschiedlicher Reihenfolge zusammen; die wiederverwendbaren Sektionen
  liegen in `src/components/sortiment/`.
- **Navigation:** ebenfalls in `src/lib/site.ts` (`mainNav`, `legalNav`).
- **Seitentexte:** in der jeweiligen `src/app/.../page.tsx`.
- **Design (Farben, Typografie, Radien, Schatten, Abstände):** zentral in
  `src/app/globals.css` im `@theme`-Block.

## Bilder austauschen

Aktuell sind alle Bilder **klar gekennzeichnete Platzhalter**
(„Platzhalter · echtes Foto folgt“), erzeugt von
`scripts/generate-placeholders.mjs` (`npm run gen:images`).

Zum Ersetzen ein echtes Foto unter `public/images/<name>.(jpg|webp)` ablegen und
im jeweiligen `<Image src>` die Endung anpassen. Empfohlene Seitenverhältnisse:
Hero 16:9–8:5 · Kategorie-Karten 4:5 · Feature/Split 5:4 · Projekte 3:2 ·
Porträts 1:1.

## Kontaktformular / E-Mail-Versand

Standard (statisches Hosting): Das Formular öffnet als ehrlicher Rückfall das
E-Mail-Programm mit vorbereiteter Nachricht – **ohne** falsche „gesendet"-Meldung.

Für echten Serverversand:

1. `NEXT_PUBLIC_CONTACT_ENDPOINT` auf die Endpoint-URL setzen (nur die URL, kein
   Secret) – dann postet das Formular per `fetch` und zeigt Erfolg **nur** bei
   HTTP 200.
2. Serverseitigen Handler aus `docs/contact-endpoint.example.ts` aktivieren
   (nach `src/app/api/kontakt/route.ts`, Node-Host statt reinem Static-Export)
   und SMTP-/Mailservice-Zugang per Umgebungsvariablen bereitstellen
   (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CONTACT_TO`,
   `CONTACT_FROM`). **Niemals Secrets im Frontend.**

Ein Honeypot-Feld dient als einfacher Spam-Schutz.

## Fehlende echte Inhalte

Alle noch benötigten echten Texte und Bilder (inkl. Motiv, Format,
Mindestauflösung, Einsatzort und Dateiname) sind in **`CONTENT-NEEDED.md`**
strukturiert aufgelistet.

## Datenschutz & Barrierefreiheit

- Kein Tracking, keine Cookies, keine externen Schriften.
- Karte lädt DSGVO-konform erst nach Klick (Zwei-Klick-Lösung).
- Kontaktformular ohne Backend (öffnet vorbereitete E-Mail), kein Drittdienst.
- Fokuszustände, Alt-Texte, semantisches HTML, `prefers-reduced-motion`,
  No-JS-Fallback (Inhalte bleiben ohne JavaScript sichtbar).

## Offene Punkte (TODO)

Im Code als `TODO` markiert – **keine erfundenen Fakten, Referenzen,
Kundenstimmen oder Markenpartnerschaften**:

- Genaue Öffnungszeiten bestätigen
- Echte Projekt-, Team- und Schauraumfotos einsetzen
- Freigegebene Kundenstimme(n) ergänzen
- Markenliste final abgleichen
- Hosting-Details in der Datenschutzerklärung ergänzen
- Rechtstexte vor Livegang final prüfen lassen
- Exakte Betriebs-Koordinaten/Anfahrt bestätigen
