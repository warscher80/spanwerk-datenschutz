/* ===========================================================================
 *  BUILD — Wohnideen Hueter
 *  Erzeugt alle statischen HTML-Seiten, Platzhalterbilder, robots.txt & sitemap.
 *  Aufruf:  node build.mjs
 * ========================================================================= */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { site, categories } from './site.config.mjs';
import { page } from './templates/layout.mjs';
import { placeholder, favicon, ogImage } from './templates/placeholder.mjs';

import { home } from './content/home.mjs';
import { categoryPages } from './content/category.mjs';
import { pages } from './content/pages.mjs';
import { legalPages } from './content/legal.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const out = p => join(__dir, p);
const write = (p, c) => { mkdirSync(dirname(out(p)), { recursive: true }); writeFileSync(out(p), c); };

/* ---- 1) HTML-Seiten -------------------------------------------------------*/
const allPages = [home, ...categoryPages, ...pages, ...legalPages];
let count = 0;
for (const p of allPages) { write(p.page, page(p)); count++; }

/* ---- 2) Platzhalterbilder -------------------------------------------------*/
const SCENE = {
  kuechen:  { v: 'kitchen', hue: 'clay' }, wohnen: { v: 'living', hue: 'sage' },
  schlafen: { v: 'bedroom', hue: 'dusk' }, essen: { v: 'dining', hue: 'wood' },
  vorzimmer:{ v: 'hall', hue: 'stone' }, bad: { v: 'bath', hue: 'water' },
};

const imgs = [];
const addImg = (name, o) => imgs.push([name, o]);

// Global
addImg('favicon', { raw: favicon() });
addImg('og-default', { raw: ogImage() });

// Home
addImg('hero-home', { w: 1600, h: 1000, hue: 'warm', variant: 'living', badge: false });
addImg('about-home', { w: 1000, h: 800, hue: 'clay', variant: 'living' });
addImg('about-story', { w: 1000, h: 800, hue: 'warm', variant: 'room' });

// Kategorie-Bilder (Karte, Hero, Feature)
for (const c of categories) {
  const s = SCENE[c.slug];
  addImg(`cat-${c.slug}`, { w: 900, h: 1125, hue: s.hue, variant: s.v });
  addImg(`hero-${c.slug}`, { w: 1600, h: 760, hue: s.hue, variant: s.v, badge: false });
  addImg(`feature-${c.slug}`, { w: 1000, h: 800, hue: s.hue, variant: s.v });
}

// Sekundär-Heroes
addImg('hero-planung', { w: 1600, h: 760, hue: 'warm', variant: 'living', badge: false });
addImg('hero-projekte', { w: 1600, h: 760, hue: 'wood', variant: 'dining', badge: false });
addImg('hero-marken', { w: 1600, h: 760, hue: 'stone', variant: 'room', badge: false });
addImg('hero-ueberuns', { w: 1600, h: 760, hue: 'warm', variant: 'living', badge: false });
addImg('hero-kontakt', { w: 1600, h: 760, hue: 'clay', variant: 'room', badge: false });
addImg('service-1', { w: 1000, h: 800, hue: 'sage', variant: 'kitchen' });

// Projekte (Platzhalter)
const projScenes = [['clay', 'kitchen'], ['sage', 'living'], ['dusk', 'bedroom'], ['wood', 'dining'], ['stone', 'hall'], ['warm', 'room']];
projScenes.forEach((p, i) => addImg(`proj-${i + 1}`, { w: 1200, h: 800, hue: p[0], variant: p[1] }));

// Team-Porträts
addImg('team-rudi', { w: 800, h: 800, hue: 'stone', variant: 'portrait' });
addImg('team-andrea', { w: 800, h: 800, hue: 'sage', variant: 'portrait' });

for (const [name, o] of imgs) {
  write(`assets/img/${name}.svg`, o.raw || placeholder(o));
}

/* ---- 3) robots.txt --------------------------------------------------------*/
const baseUrl = `${site.url}${site.base}`;
write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`);

/* ---- 4) sitemap.xml -------------------------------------------------------*/
const urls = allPages
  .filter(p => p.page !== '404.html')
  .map(p => {
    const loc = `${baseUrl}/${p.page === 'index.html' ? '' : p.page}`;
    const priority = p.page === 'index.html' ? '1.0' : (p.page.startsWith('impressum') || p.page.startsWith('datenschutz') || p.page.startsWith('barriere') ? '0.3' : '0.8');
    return `  <url><loc>${loc}</loc><changefreq>monthly</changefreq><priority>${priority}</priority></url>`;
  }).join('\n');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);

console.log(`✓ ${count} HTML-Seiten, ${imgs.length} Bilder, robots.txt & sitemap.xml erstellt.`);
