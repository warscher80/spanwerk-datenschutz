import { site, categories, advantages, process, brands } from '../site.config.mjs';
import { icon, esc } from '../templates/layout.mjs';

const img = n => `assets/img/${n}.svg`;

export const home = {
  page: 'index.html',
  heroTop: true,
  title: 'Wohnideen Hueter – Persönliche Einrichtungsplanung in Irschen, Kärnten',
  description: 'Ihr persönliches Einrichtungshaus im oberen Drautal: Küchen, Wohn-, Schlaf-, Ess- und Vorzimmer individuell geplant, geliefert und montiert. Beratungstermin bei Familie Hueter.',
  body: `
<section class="hero">
  <div class="hero-media" data-parallax><img src="${img('hero-home')}" alt="Wohnlich eingerichteter, heller Wohnraum mit warmen Naturtönen – beispielhafte Darstellung" fetchpriority="high" width="1600" height="1000"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow hero-eyebrow" data-reveal>Einrichtungshaus im oberen Drautal · Irschen, Kärnten</span>
    <h1 data-reveal data-delay="1">Räume, die sich nach<br>Zuhause anfühlen.</h1>
    <p class="lead" data-reveal data-delay="2">Persönlich geplant, hochwertig eingerichtet und bis zum letzten Handgriff begleitet – von der Familie Hueter, Ihrem regionalen Partner für Küchen und Wohnräume.</p>
    <div class="hero-actions" data-reveal data-delay="3">
      <a class="btn btn-primary" href="kontakt.html">${icon('chat')} ${esc(site.cta.appointment)}</a>
      <a class="btn btn-light" href="projekte.html">${esc(site.cta.projects)} ${icon('arrow')}</a>
    </div>
    <div class="hero-meta" data-reveal data-delay="4">
      <span>${icon('pin')} ${esc(site.address.zip)} ${esc(site.address.city)}</span>
      <span>${icon('clock')} ${esc(site.hours.note)}</span>
      <span>${icon('phone')} <a href="tel:${site.phoneHref}">${esc(site.phoneDisplay)}</a></span>
    </div>
  </div>
</section>

<!-- Vertrauensbereich -->
<section class="section">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <span class="eyebrow">Warum Wohnideen Hueter</span>
      <h2>Kein anonymer Möbelkauf.<br>Sondern ein Weg, den wir gemeinsam gehen.</h2>
    </div>
    <div class="adv-grid">
      ${advantages.map((a, i) => `
      <div class="adv-card" data-reveal data-delay="${(i % 4) + 1}">
        <div class="adv-ic">${icon(a.icon)}</div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.text)}</p>
      </div>`).join('')}
    </div>
  </div>
</section>

<!-- Sortiment -->
<section class="section section-tint">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Unser Sortiment</span>
      <h2>Für jeden Raum die passende Idee</h2>
      <p class="lead">Von der Küche bis zum Vorzimmer richten wir Ihr Zuhause aus einer Hand ein – aufeinander abgestimmt, hochwertig und langlebig.</p>
    </div>
    <div class="cat-grid">
      ${categories.map((c, i) => `
      <a class="cat-card" href="${c.slug}.html" data-reveal data-delay="${(i % 3) + 1}">
        <img src="${img('cat-' + c.slug)}" alt="${esc(c.title)} bei Wohnideen Hueter – beispielhafte Darstellung" loading="lazy" width="900" height="1125">
        <div class="cat-body">
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.kicker)}</p>
          <span class="cat-arrow">Entdecken ${icon('arrow')}</span>
        </div>
      </a>`).join('')}
    </div>
  </div>
</section>

<!-- Planung & Service -->
<section class="section section-ink">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Planung &amp; Service</span>
      <h2>Von der ersten Idee bis<br>zur fertigen Einrichtung</h2>
      <p class="lead">Sie haben einen Ansprechpartner – für alles. Wir nehmen Ihnen die Koordination ab und begleiten jeden Schritt persönlich.</p>
    </div>
    <div class="steps cols-3">
      ${process.map((p, i) => `
      <div class="step" data-reveal data-delay="${(i % 3) + 1}">
        <span class="step-n">${p.n}</span>
        <div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>
      </div>`).join('')}
    </div>
    <div class="mt-2" data-reveal>
      <a class="btn btn-light" href="planung-service.html">Mehr über unseren Ablauf ${icon('arrow')}</a>
    </div>
  </div>
</section>

<!-- Referenzen -->
<section class="section">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Projekte &amp; Referenzen</span>
      <h2>Einrichtung, die im Alltag ankommt</h2>
      <p class="lead">Ein Einblick in unsere Arbeit. Sobald die Fotos unserer aktuellen Projekte vorliegen, zeigen wir sie hier in voller Größe.</p>
    </div>
    <div class="proj-grid">
      <!-- TODO: Echte Projektfotos & -daten von Wohnideen Hueter einsetzen. Keine erfundenen Referenzen. -->
      <article class="proj-card" data-reveal data-delay="1">
        <div class="proj-media"><img src="${img('proj-1')}" alt="Beispielhafte Darstellung einer geplanten Küche – Platzhalter" loading="lazy" width="1200" height="800"><span class="proj-tag">Küche</span></div>
        <div class="proj-body"><h3>Küche im Drautal</h3><p>Individuell geplante Küche mit fachgerechter Montage. Projektdetails folgen.</p><span class="ph-note">${icon('pin')} Beispiel · echtes Projekt folgt</span></div>
      </article>
      <article class="proj-card" data-reveal data-delay="2">
        <div class="proj-media"><img src="${img('proj-2')}" alt="Beispielhafte Darstellung eines Wohnraums – Platzhalter" loading="lazy" width="1200" height="800"><span class="proj-tag">Wohnen</span></div>
        <div class="proj-body"><h3>Wohnraum neu gedacht</h3><p>Wohnliche Gestaltung aus einer Hand. Projektdetails folgen.</p><span class="ph-note">${icon('pin')} Beispiel · echtes Projekt folgt</span></div>
      </article>
      <article class="proj-card" data-reveal data-delay="3">
        <div class="proj-media"><img src="${img('proj-3')}" alt="Beispielhafte Darstellung eines Schlafzimmers – Platzhalter" loading="lazy" width="1200" height="800"><span class="proj-tag">Schlafen</span></div>
        <div class="proj-body"><h3>Ruhiges Schlafzimmer</h3><p>Aufeinander abgestimmte Schlafzimmereinrichtung. Projektdetails folgen.</p><span class="ph-note">${icon('pin')} Beispiel · echtes Projekt folgt</span></div>
      </article>
    </div>
    <div class="mt-2" data-reveal><a class="textlink" href="projekte.html">Alle Projekte ansehen ${icon('arrow')}</a></div>
  </div>
</section>

<!-- Über uns -->
<section class="section section-tint">
  <div class="wrap">
    <div class="split is-reverse">
      <div class="split-media" data-reveal><img src="${img('about-home')}" alt="Persönliche Beratung im Einrichtungshaus – beispielhafte Darstellung" loading="lazy" width="1000" height="800"></div>
      <div class="split-body" data-reveal data-delay="1">
        <span class="eyebrow">Über Wohnideen Hueter</span>
        <h2>Ein Familienbetrieb, der zuhört</h2>
        <p class="lead">Bei uns sprechen Sie mit den Menschen, die Ihr Projekt auch umsetzen. Rudi und Andrea Hueter beraten Sie persönlich – mit Erfahrung, Handschlagqualität und einem klaren Blick für das, was zu Ihnen und Ihren Räumen passt.</p>
        <ul class="ticklist">
          <li>Persönliche Beratung – ohne Verkaufsdruck, mit ehrlicher Empfehlung</li>
          <li>Individuelle Planung statt Möbel von der Stange</li>
          <li>Präzise Fertigung durch bewährte Partner &amp; perfekte Montage</li>
          <li>Regional verwurzelt in Irschen im oberen Drautal</li>
        </ul>
        <a class="btn btn-dark" href="ueber-uns.html">Familie Hueter kennenlernen ${icon('arrow')}</a>
      </div>
    </div>
  </div>
</section>

<!-- Marken -->
<section class="section">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <span class="eyebrow">Marken &amp; Hersteller</span>
      <h2>Qualität, die bleibt</h2>
      <p class="lead">Wir arbeiten mit ausgewählten Herstellern, die für langlebige Qualität stehen – aus Österreich und Europa.</p>
    </div>
    <div class="brand-grid" data-reveal>
      ${brands.slice(0, 10).map(b => `
      <div class="brand-cell"><span class="brand-name">${esc(b.name)}</span><span class="brand-note">${esc(b.note)}</span></div>`).join('')}
    </div>
    <div class="mt-2 center" data-reveal><a class="textlink" href="marken.html">Alle Marken ansehen ${icon('arrow')}</a></div>
  </div>
</section>

<!-- Abschluss-CTA -->
<section class="section">
  <div class="wrap">
    <div class="cta-band" data-reveal>
      <span class="eyebrow hero-eyebrow" style="justify-content:center">Ihr nächster Schritt</span>
      <h2>Lassen Sie uns gemeinsam<br>Ihren Wohnraum planen.</h2>
      <p class="lead">Vereinbaren Sie einen unverbindlichen Beratungstermin – bei uns im Schauraum oder direkt bei Ihnen zu Hause.</p>
      <div class="cta-actions">
        <a class="btn btn-primary" href="kontakt.html">${icon('chat')} ${esc(site.cta.appointment)}</a>
        <a class="btn btn-light" href="tel:${site.phoneHref}">${icon('phone')} ${esc(site.phoneDisplay)}</a>
      </div>
    </div>
  </div>
</section>
`,
};
