import { site, categories } from '../site.config.mjs';

const NAV = [
  { href: 'index.html', label: 'Startseite', home: true },
  ...categories.map(c => ({ href: `${c.slug}.html`, label: c.nav })),
  { href: 'planung-service.html', label: 'Planung & Service' },
  { href: 'projekte.html', label: 'Projekte' },
  { href: 'marken.html', label: 'Marken' },
  { href: 'ueber-uns.html', label: 'Über uns' },
  { href: 'kontakt.html', label: 'Kontakt', cta: true },
];

// Sortiment-Untergruppe für das Mega-artige Dropdown / mobile Gliederung
const SORTIMENT = categories.map(c => ({ href: `${c.slug}.html`, label: c.nav }));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function icon(name) {
  const p = {
    chat: '<path d="M4 5h16v11H8l-4 4z"/>',
    ruler: '<path d="M3 8l13-5 5 13-13 5z"/><path d="M8 8l1 2M11 7l1 2M14 6l1 2"/>',
    truck: '<path d="M2 7h11v9H2zM13 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    heart: '<path d="M12 20s-7-4.6-9.2-8.4C1.1 8.3 2.8 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.2 0 4.9 3.3 3.2 6.6C19 15.4 12 20 12 20z"/>',
    phone: '<path d="M5 3h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 5a2 2 0 012-2z"/>',
    mail: '<path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/>',
    pin: '<path d="M12 22s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  }[name] || '';
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

/**
 * Erzeugt eine vollständige HTML-Seite.
 * @param {object} o
 *   page       aktueller Dateiname (für aktiven Nav-Zustand)
 *   title      <title> / og:title
 *   description meta description
 *   body       Haupt-HTML (Sections)
 *   extraHead  optionales zusätzliches <head>-HTML (z.B. JSON-LD)
 *   heroTop    true, wenn Hero direkt unter transparenten Header läuft
 */
export function page(o) {
  const B = site.base;
  const canonical = `${site.url}${B}/${o.page === 'index.html' ? '' : o.page}`;
  const ogImg = `${site.url}${B}/assets/img/og-default.svg`;
  const navHtml = NAV.map(n => {
    const active = n.href === o.page ? ' aria-current="page"' : '';
    const cls = n.cta ? 'nav-link nav-cta' : 'nav-link';
    return `<li><a class="${cls}"${active} href="${n.href}">${esc(n.label)}</a></li>`;
  }).join('');

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'FurnitureStore',
    '@id': `${site.url}${B}/#business`,
    name: site.name,
    legalName: site.legalName,
    description: 'Persönliches Einrichtungshaus im oberen Drautal (Kärnten): individuelle Planung von Küchen, Wohn-, Schlaf-, Ess- und Vorzimmern inkl. Lieferung, Montage und Nachbetreuung.',
    url: `${site.url}${B}/`,
    telephone: site.phone,
    email: site.email,
    image: ogImg,
    priceRange: '€€–€€€',
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      postalCode: site.address.zip,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      addressCountry: site.address.countryCode,
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.address.lat, longitude: site.address.lng },
    areaServed: site.serviceArea.map(a => ({ '@type': 'Place', name: a })),
    openingHours: 'Mo-Sa by appointment',
    sameAs: [site.social.facebook],
  };

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#faf6f0">
<meta name="author" content="${esc(site.legalName)}">
<meta name="robots" content="index, follow">
<script>document.documentElement.classList.add('js')</script>

<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="de_AT">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImg}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.description)}">
<meta name="twitter:image" content="${ogImg}">

<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/img/favicon.svg">

<link rel="preload" href="assets/fonts/cormorant-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/inter-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/styles.css">
<script type="application/ld+json">${JSON.stringify(localBusiness)}</script>
${o.extraHead || ''}
</head>
<body class="${o.heroTop ? 'has-hero' : ''}">
<a class="skip-link" href="#main">Zum Inhalt springen</a>

<header class="site-header" data-header>
  <div class="wrap header-inner">
    <a class="brand" href="index.html" aria-label="${esc(site.name)} – Startseite">
      <span class="brand-mark" aria-hidden="true">WH</span>
      <span class="brand-text"><span class="brand-name">Wohnideen Hueter</span><span class="brand-sub">Einrichtung mit Persönlichkeit · Irschen</span></span>
    </a>
    <nav class="site-nav" aria-label="Hauptnavigation">
      <ul class="nav-list">${navHtml}</ul>
    </nav>
    <div class="header-actions">
      <a class="phone-pill" href="tel:${site.phoneHref}">${icon('phone')}<span>${esc(site.phoneDisplay)}</span></a>
      <button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="mobile-nav" aria-label="Menü öffnen">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<div class="mobile-nav" id="mobile-nav" data-mobile-nav hidden>
  <ul class="mobile-nav-list">
    ${NAV.map(n => `<li><a href="${n.href}"${n.href === o.page ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('\n    ')}
  </ul>
  <div class="mobile-nav-contact">
    <a class="btn btn-primary btn-block" href="kontakt.html">${esc(site.cta.appointment)}</a>
    <a class="btn btn-ghost btn-block" href="tel:${site.phoneHref}">${icon('phone')} ${esc(site.phoneDisplay)}</a>
  </div>
</div>

<main id="main">
${o.body}
</main>

<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <span class="brand-mark" aria-hidden="true">WH</span>
      <p class="footer-claim">Räume, die sich nach Zuhause anfühlen.</p>
      <p class="footer-note">Persönliche Einrichtungsplanung im oberen Drautal – von der ersten Idee bis zur fertigen Montage.</p>
      <a class="footer-social" href="${site.social.facebook}" target="_blank" rel="noopener">Facebook</a>
    </div>

    <nav class="footer-col" aria-label="Sortiment">
      <h2 class="footer-h">Sortiment</h2>
      <ul>${SORTIMENT.map(s => `<li><a href="${s.href}">${esc(s.label)}</a></li>`).join('')}</ul>
    </nav>

    <nav class="footer-col" aria-label="Unternehmen">
      <h2 class="footer-h">Unternehmen</h2>
      <ul>
        <li><a href="planung-service.html">Planung &amp; Service</a></li>
        <li><a href="projekte.html">Projekte</a></li>
        <li><a href="marken.html">Marken</a></li>
        <li><a href="ueber-uns.html">Über uns</a></li>
        <li><a href="kontakt.html">Kontakt &amp; Termin</a></li>
      </ul>
    </nav>

    <div class="footer-col footer-contact">
      <h2 class="footer-h">Kontakt</h2>
      <address>
        <p><strong>${esc(site.legalName)}</strong><br>${esc(site.address.street)}<br>${esc(site.address.zip)} ${esc(site.address.city)}, ${esc(site.address.region)}</p>
        <p>
          <a href="tel:${site.phoneHref}">${icon('phone')} ${esc(site.phoneDisplay)}</a><br>
          <a href="mailto:${site.email}">${icon('mail')} ${esc(site.email)}</a>
        </p>
        <p class="footer-hours">${icon('clock')} ${esc(site.hours.note)}</p>
      </address>
    </div>
  </div>

  <div class="wrap footer-bottom">
    <p>© ${new Date().getFullYear()} ${esc(site.legalName)} · ${esc(site.legal.activity)}</p>
    <ul class="footer-legal">
      <li><a href="impressum.html">Impressum</a></li>
      <li><a href="datenschutz.html">Datenschutz</a></li>
      <li><a href="barrierefreiheit.html">Barrierefreiheit</a></li>
    </ul>
  </div>
</footer>

<a class="mobile-cta" href="kontakt.html" aria-label="${esc(site.cta.appointment)}">
  ${icon('chat')}<span>Beratungstermin</span>
</a>

<script src="assets/js/main.js" defer></script>
</body>
</html>`;
}

export { icon, esc };
