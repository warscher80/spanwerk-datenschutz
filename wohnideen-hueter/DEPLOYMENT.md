# Deployment — Wohnideen Hueter

Die Website ist eine **statisch exportierte Next.js-App** (`output: "export"`).
Der Build erzeugt reine HTML/CSS/JS-Dateien unter `out/`, die auf jedem
statischen Host laufen – ohne Node-Server.

## 1. Build erzeugen

```bash
npm ci
npm run build      # erzeugt ./out
```

Qualitäts-Checks vorab:

```bash
npm run typecheck  # TypeScript
npm run lint       # ESLint
```

## 2. Zielumgebungen

### a) Eigene Domain im Root  (empfohlen für www.wohnideen-hueter.at)

Keine weitere Konfiguration nötig. `out/` auf den Webserver / das Hosting
hochladen. `NEXT_PUBLIC_BASE_PATH` leer lassen.

### b) Unterverzeichnis (z. B. GitHub Pages Projektpfad)

```bash
NEXT_PUBLIC_BASE_PATH="/wohnideen-hueter" npm run build
```

Alle Asset- und Link-Pfade werden automatisch mit dem Präfix versehen.

### c) GitHub Pages via Actions (optional)

Beispiel-Workflow (`.github/workflows/pages.yml`) – vor Aktivierung die
bestehende Pages-Konfiguration des Repos prüfen (mehrere Projekte im Repo):

```yaml
name: Deploy Wohnideen Hueter
on: { push: { branches: [main], paths: ["wohnideen-hueter/**"] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: wohnideen-hueter } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: wohnideen-hueter/package-lock.json }
      - run: npm ci
      - run: npm run build
        env: { NEXT_PUBLIC_BASE_PATH: "" }
      - uses: actions/upload-pages-artifact@v3
        with: { path: wohnideen-hueter/out }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.d.outputs.page_url }}" }
    steps: [ { id: d, uses: actions/deploy-pages@v4 } ]
```

## 3. Serverbetrieb (nur bei echtem Formularversand)

Für echten E-Mail-Versand des Kontaktformulars ist ein Node-fähiger Host nötig
(statischer Export unterstützt keine API-Routen). Dann:

1. `output: "export"` in `next.config.ts` entfernen (Hybrid-/Server-Betrieb).
2. Handler aus `docs/contact-endpoint.example.ts` nach
   `src/app/api/kontakt/route.ts` übernehmen, `npm i nodemailer` ergänzen.
3. Server-Umgebungsvariablen setzen (siehe `ENVIRONMENT.md`).
4. `NEXT_PUBLIC_CONTACT_ENDPOINT=/api/kontakt` setzen.

Ohne diesen Schritt bleibt der datenschutzfreundliche E-Mail-Programm-Rückfall
aktiv (ehrliche Info-Meldung, keine falsche „gesendet“-Anzeige).

## 4. Empfohlene Sicherheits-Header (Host-Konfiguration)

Bei eigenem Host/Reverse-Proxy setzen:

```
Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src https://www.openstreetmap.org; font-src 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
```

(Statische Hosts wie GitHub Pages erlauben keine eigenen Header – dort greifen
die Standard-Header des Anbieters.)

## 5. Nach dem Deployment prüfen

- Alle Seiten erreichbar, 404-Seite funktioniert
- `sitemap.xml` und `robots.txt` erreichbar (Domain in beiden korrekt)
- Kontaktformular: Testanfrage (im Fallback öffnet das E-Mail-Programm)
- Karte lädt erst nach Klick (DSGVO)
