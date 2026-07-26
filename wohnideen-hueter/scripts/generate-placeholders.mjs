/* ---------------------------------------------------------------------------
 *  Platzhalterbilder erzeugen  →  public/images/*.svg
 *  Aufruf:  node scripts/generate-placeholders.mjs
 *
 *  Erzeugt klar gekennzeichnete SVG-Platzhalter, solange keine echten Fotos
 *  vorliegen ("Platzhalter · echtes Foto folgt"). Zum Ersetzen ein echtes Foto
 *  gleichen Namens (z. B. .jpg/.webp) in public/images ablegen und den <Image>-
 *  Pfad in der jeweiligen Komponente anpassen.
 * ------------------------------------------------------------------------- */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { placeholder, favicon, ogImage } from "./placeholder.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dir, "..", "public", "images");
mkdirSync(outDir, { recursive: true });
const write = (name, svg) => writeFileSync(join(outDir, name + ".svg"), svg);

// Sortiment (Slug → Szene/Farbe) – gespiegelt aus src/lib/site.ts
const categories = [
  { slug: "kuechen", scene: "kitchen", hue: "clay" },
  { slug: "wohnen", scene: "living", hue: "sage" },
  { slug: "schlafen", scene: "bedroom", hue: "dusk" },
  { slug: "essen", scene: "dining", hue: "wood" },
  { slug: "vorzimmer", scene: "hall", hue: "stone" },
  { slug: "bad", scene: "bath", hue: "water" },
];
const projects = [
  { slug: "kueche-drautal", scene: "kitchen", hue: "clay" },
  { slug: "wohnraum", scene: "living", hue: "sage" },
  { slug: "schlafzimmer", scene: "bedroom", hue: "dusk" },
  { slug: "essbereich", scene: "dining", hue: "wood" },
  { slug: "garderobe", scene: "hall", hue: "stone" },
  { slug: "gesamtprojekt", scene: "room", hue: "warm" },
];

let n = 0;
const P = (name, o) => {
  write(name, placeholder(o));
  n++;
};

// Global
write("favicon", favicon());
write("og-default", ogImage());
n += 2;

// Startseite
P("hero-home", { w: 1600, h: 1000, hue: "warm", variant: "living", badge: false });
P("about-home", { w: 1000, h: 800, hue: "clay", variant: "living" });
P("about-story", { w: 1000, h: 800, hue: "stone", variant: "living" });
P("service-1", { w: 1000, h: 800, hue: "sage", variant: "kitchen" });

// Kategorien: Karte (4:5), Hero (breit), Feature (5:4),
// Detail (quadratisch) und Mood-Band (breit, für vollflächige Bildbänder)
for (const c of categories) {
  P(`cat-${c.slug}`, { w: 900, h: 1125, hue: c.hue, variant: c.scene });
  P(`hero-${c.slug}`, { w: 1600, h: 760, hue: c.hue, variant: c.scene, badge: false });
  P(`feature-${c.slug}`, { w: 1000, h: 800, hue: c.hue, variant: c.scene });
  P(`detail-${c.slug}`, { w: 1000, h: 1000, hue: c.hue, variant: c.scene });
  P(`mood-${c.slug}`, { w: 1600, h: 900, hue: c.hue, variant: c.scene, badge: false });
}

// Sekundär-Heroes der Unterseiten
P("hero-planung", { w: 1600, h: 760, hue: "warm", variant: "living", badge: false });
P("hero-projekte", { w: 1600, h: 760, hue: "wood", variant: "dining", badge: false });
P("hero-marken", { w: 1600, h: 760, hue: "stone", variant: "room", badge: false });
P("hero-ueberuns", { w: 1600, h: 760, hue: "warm", variant: "living", badge: false });
P("hero-kontakt", { w: 1600, h: 760, hue: "clay", variant: "room", badge: false });

// Projekte
for (const p of projects) {
  P(`proj-${p.slug}`, { w: 1200, h: 800, hue: p.hue, variant: p.scene });
}

// Team-Porträts
P("team-rudi", { w: 800, h: 800, hue: "stone", variant: "portrait" });
P("team-andrea", { w: 800, h: 800, hue: "sage", variant: "portrait" });

console.log(`✓ ${n} Platzhalterbilder erzeugt → public/images/`);
