import { site } from '../site.config.mjs';
import { icon, esc } from '../templates/layout.mjs';

export const img = n => `assets/img/${n}.svg`;

export function pagehero({ img: image, hue = 'warm', variant = 'room', alt, kicker, h1, lead, crumb }) {
  return `
<section class="pagehero">
  <div class="pagehero-media"><img src="${image}" alt="${esc(alt)}" fetchpriority="high" width="1600" height="760"></div>
  <div class="wrap pagehero-inner">
    ${crumb ? `<p class="crumbs" data-reveal><a href="index.html">Startseite</a> · ${esc(crumb)}</p>` : ''}
    ${kicker ? `<span class="eyebrow hero-eyebrow" data-reveal data-delay="1">${esc(kicker)}</span>` : ''}
    <h1 data-reveal data-delay="1">${h1}</h1>
    ${lead ? `<p class="lead" data-reveal data-delay="2">${esc(lead)}</p>` : ''}
  </div>
</section>`;
}

export function ctaBand({ h = 'Lassen Sie uns gemeinsam Ihren Wohnraum planen.', lead = 'Vereinbaren Sie einen unverbindlichen Beratungstermin – im Schauraum oder bei Ihnen zu Hause.' } = {}) {
  return `
<section class="section">
  <div class="wrap">
    <div class="cta-band" data-reveal>
      <span class="eyebrow hero-eyebrow" style="justify-content:center">Ihr nächster Schritt</span>
      <h2>${h}</h2>
      <p class="lead">${esc(lead)}</p>
      <div class="cta-actions">
        <a class="btn btn-primary" href="kontakt.html">${icon('chat')} ${esc(site.cta.appointment)}</a>
        <a class="btn btn-light" href="tel:${site.phoneHref}">${icon('phone')} ${esc(site.phoneDisplay)}</a>
      </div>
    </div>
  </div>
</section>`;
}
