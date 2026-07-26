# Benötigte echte Inhalte — Wohnideen Hueter

Diese Liste erfasst alle noch fehlenden **echten** Inhalte. Bis sie vorliegen,
zeigt die Website klar gekennzeichnete Platzhalter. **Nichts wurde erfunden** –
Namen, Orte, Bewertungen, Jahreszahlen und Partnerschaften bleiben leer, bis sie
bestätigt sind.

Bilder bitte als **JPG oder WebP** liefern und unter `public/images/` mit dem
angegebenen Dateinamen ablegen (ersetzen die gleichnamige `.svg`-Datei; danach im
jeweiligen `<Image src>` die Endung anpassen). Richtwert Qualität: scharf, gut
belichtet, natürliche Farben, nicht verzerrt.

---

## 1. Bilder

### Startseite & globale Motive
| Datei | Motiv | Ausrichtung | Seitenverhältnis | Mindestauflösung | Einsatzort |
|---|---|---|---|---|---|
| `hero-home` | Helle Wohnküche / Wohnraum, ruhiger rechter Bildbereich | Querformat | 16:10 | 2000×1250 | Startseite-Hero |
| `about-home` | Beratungssituation / gemütliche Sitzecke | Querformat | 5:4 | 1400×1120 | Startseite „Zuhören", Über uns |
| `about-story` | Schauraum / Familie Hueter | Querformat | 5:4 | 1500×1200 | Startseite Über-uns-Teaser |
| `service-1` | Aufmaß / Planung vor Ort, Schauraum | Querformat | 5:4 | 1400×1120 | Planung, Über-uns-Schauraum |
| `og-default` | Aussagekräftiges Vorschaubild (Social) | Querformat | 1.91:1 | 1200×630 | Open-Graph-Vorschau |

### Wohnwelten (je Bereich `<slug>` = kuechen, wohnen, essen, schlafen, vorzimmer, bad)
| Datei | Motiv | Ausrichtung | Seitenverhältnis | Mindestauflösung | Einsatzort |
|---|---|---|---|---|---|
| `hero-<slug>` | Repräsentatives Raumbild des Bereichs | Querformat | 21:10 | 2000×950 | Bereichs-Hero |
| `feature-<slug>` | Detail-/Nahaufnahme (Material, Funktion) | Querformat | 5:4 | 1400×1120 | Einführungs-Split |
| `cat-<slug>` | Stimmungsbild des Bereichs | Hochformat | 4:5 | 1080×1350 | Wohnwelten-Kacheln (Start & Bereiche) |
| `mood-<slug>` | Großes, emotionales Raumbild | Querformat | 16:9 | 2000×1125 | Bildband (v. a. Wohnen, Essen) |
| `detail-<slug>` | Zusätzliches Detail/Material | Quadrat | 1:1 | 1200×1200 | Galerie/Reserve |

### Sekundär-Heroes
`hero-planung`, `hero-projekte`, `hero-marken`, `hero-ueberuns`, `hero-kontakt`
— je Querformat 21:10, mind. 2000×950, passend zum Seitenthema.

### Team-Porträts
| Datei | Motiv | Ausrichtung | Seitenverhältnis | Mindestauflösung |
|---|---|---|---|---|
| `team-rudi` | Porträt Rudi Hueter | Quadrat | 1:1 | 800×800 |
| `team-andrea` | Porträt Andrea Hueter | Quadrat | 1:1 | 800×800 |
| ggf. weitere | weitere Mitarbeitende (falls vorhanden) | Quadrat | 1:1 | 800×800 |

### Projektbilder
Pro Projekt ein Hauptbild `proj-<slug>` (Querformat 3:2, mind. 1500×1000) sowie
optional eine Galerie (siehe Abschnitt 2). Aktuelle Platzhalter-Slugs:
`kueche-drautal`, `wohnraum`, `schlafzimmer`, `essbereich`, `garderobe`,
`gesamtprojekt` — **diese Slugs/Titel durch echte Projekte ersetzen.**

### Schauraum
Echte Fotos des Schauraums in Irschen (Innenansichten, Materialwände) —
Querformat, mind. 1500×1000. Einsatz: Über uns, Kontakt.

---

## 2. Projekte / Referenzen (`src/lib/site.ts` → `projects`)

Pro echtem Projekt benötigt:
- **Titel** (echter Projektname – kein erfundener wie „Villa am See")
- **Kategorie** (Küche, Wohnen, …)
- **Kurzbeschreibung / Besonderheit**
- **Ort** – nur, wenn öffentlich und bestätigt (sonst weglassen)
- **Leistungen** (z. B. Aufmaß, Planung, Montage)
- **Materialien** (optional)
- optional Erzähltexte: Ausgangssituation, Wünsche, Planungsidee, besondere
  Lösungen, Ergebnis (fehlende Abschnitte blenden sich automatisch aus)
- **Hauptbild** + **Galeriebilder** (`gallery`: je `src`, `alt`, optional `caption`)
- verwandte Projekte (Slugs)

> Solange keine echten Projekte vorliegen, sind alle Einträge `placeholder: true`
> und deutlich als Beispiel markiert.

---

## 3. Team (`src/app/ueber-uns/page.tsx`, `people` in `site.ts`)
- Bestätigt: **Rudi Hueter**, **Andrea Hueter** (Namen/Funktionen aus öffentlichen Quellen)
- **Benötigt:** echte Porträtfotos, ggf. Feinschliff der Funktions-/Schwerpunkttexte,
  weitere Mitarbeitende (falls vorhanden), optional kurze persönliche Aussagen

---

## 4. Unternehmen / Über uns
- **Gründungsjahr / Unternehmensgeschichte** — derzeit bewusst nicht genannt (unbestätigt)
- **Erfahrung in Jahren** — nur mit belegter Angabe
- **Zertifikate / Auszeichnungen** — nur, wenn tatsächlich vorhanden
- Feinschliff der Philosophie-/Haltungstexte durch Familie Hueter

---

## 5. Öffnungszeiten & Kontakt
- **Genaue Öffnungszeiten** bestätigen — aktuell nur „Termine nach Vereinbarung"
- **Exakte Geo-Koordinaten** des Betriebs bestätigen (aktuell Ortszentrum Irschen)
- Kontaktdaten verifiziert: Tel. +43 676 75 32 300 / 301, `office@wohnideen-hueter.at`,
  Irschen 26, 9773 Irschen. **Bitte final gegenprüfen.**

---

## 6. Marken (`src/app/marken/page.tsx`)
- Markenliste & Zuordnung zu Bereichen **final abgleichen** (Vollständigkeit, aktuelle
  Partnerschaften). Keine Exklusivpartnerschaften behaupten.

---

## 7. Kundenstimmen
- **Echte, freigegebene** Kundenstimmen (Text + Name/Ort mit Einverständnis).
  Bis dahin nur klar markierter Platzhalter, keine erfundenen Bewertungen.

---

## 8. Kontaktformular / E-Mail-Versand
- Aktuell: ehrlicher E-Mail-Programm-Rückfall (keine falsche „gesendet"-Meldung).
- **Für echten Serverversand:** Handler aus `docs/contact-endpoint.example.ts`
  aktivieren, SMTP-/Mailservice-Zugang bereitstellen und `NEXT_PUBLIC_CONTACT_ENDPOINT`
  setzen (Details in `README.md`). Keine Secrets im Frontend.

---

## 9. Rechtlich zu prüfen (TODO – fachliche Prüfung)
- **Impressum & Datenschutzerklärung** vor Livegang rechtlich prüfen lassen
- Datenschutz: **Hosting-Anbieter, Serverstandort, Auftragsverarbeitung** ergänzen
- Bei Formular-Serverversand: Verarbeitung/Aufbewahrung in der Datenschutzerklärung ergänzen
- **Bad:** genauen Leistungs- und Sortimentsumfang bestätigen (keine Sanitärinstallation behauptet)
- **Planung & Service:** Partnermodell für Fremdgewerke bestätigen
- Barrierefreiheit: bei gesetzlicher Verpflichtung (BaFG) formale Konformitätsbewertung ergänzen
