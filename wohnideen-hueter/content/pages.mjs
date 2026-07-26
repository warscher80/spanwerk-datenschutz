import { site, brands, process, advantages, categories, contactAreas } from '../site.config.mjs';
import { icon, esc } from '../templates/layout.mjs';
import { img, pagehero, ctaBand } from './parts.mjs';

/* ============================ PLANUNG & SERVICE ============================ */
export const planung = {
  page: 'planung-service.html', heroTop: true,
  title: 'Planung & Service – Ihr Ablauf | Wohnideen Hueter',
  description: 'So arbeiten wir: von Beratung und Aufmaß über die individuelle Planung bis zu Lieferung, Montage und persönlicher Nachbetreuung. Ein Ansprechpartner für Ihr ganzes Projekt.',
  body: `
${pagehero({ img: img('hero-planung'), hue: 'warm', variant: 'living',
    alt: 'Persönliche Einrichtungsplanung – beispielhafte Darstellung', crumb: 'Planung & Service',
    kicker: 'Planung & Service', h1: 'Ein Ansprechpartner.<br>Für Ihr ganzes Projekt.',
    lead: 'Wir nehmen Ihnen die Koordination ab – und begleiten Sie von der ersten Idee bis zur fertigen Einrichtung persönlich.' })}

<section class="section">
  <div class="wrap">
    <div class="adv-grid">
      ${advantages.map((a, i) => `
      <div class="adv-card" data-reveal data-delay="${(i % 4) + 1}">
        <div class="adv-ic">${icon(a.icon)}</div>
        <h3>${esc(a.title)}</h3><p>${esc(a.text)}</p>
      </div>`).join('')}
    </div>
  </div>
</section>

<section class="section section-ink">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Der Ablauf</span>
      <h2>In sieben Schritten zu<br>Ihrer neuen Einrichtung</h2>
      <p class="lead">Jeder Schritt schafft Klarheit und nimmt Unsicherheit. Sie wissen immer, wo Ihr Projekt gerade steht.</p>
    </div>
    <div class="steps cols-3">
      ${process.map((p, i) => `
      <div class="step" data-reveal data-delay="${(i % 3) + 1}">
        <span class="step-n">${p.n}</span>
        <div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>
      </div>`).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="split">
      <div class="split-media" data-reveal><img src="${img('service-1')}" alt="Aufmaß und Planung vor Ort – beispielhafte Darstellung" loading="lazy" width="1000" height="800"></div>
      <div class="split-body" data-reveal data-delay="1">
        <span class="eyebrow">Unsere Services</span>
        <h2>Mehr als nur Möbel</h2>
        <ul class="ticklist">
          <li><strong>Persönliche Beratung &amp; Wohnraumplanung</strong> – zugeschnitten auf Ihre Räume und Wünsche</li>
          <li><strong>Aufmaß vor Ort</strong> – präzise Grundlage für eine passgenaue Planung</li>
          <li><strong>Lieferung &amp; fachgerechte Montage</strong> – sauber, termingerecht und zuverlässig</li>
          <li><strong>Persönliche Nachbetreuung</strong> – ein Ansprechpartner, der auch danach für Sie da ist</li>
          <li><strong>Urlaubs-Aufbauservice</strong> – auf Wunsch richten wir ein, während Sie unterwegs sind</li>
        </ul>
        <p class="ph-note">${icon('chat')} Weitere Services? Fragen Sie uns – wir finden eine Lösung.</p>
      </div>
    </div>
  </div>
</section>

${ctaBand()}
`,
};

/* ================================ PROJEKTE ================================ */
export const projekte = {
  page: 'projekte.html', heroTop: true,
  title: 'Projekte & Referenzen | Wohnideen Hueter Irschen',
  description: 'Einblicke in unsere Einrichtungsprojekte aus dem oberen Drautal. Echte Projektfotos folgen – gerne zeigen wir Ihnen Referenzen im persönlichen Gespräch.',
  body: `
${pagehero({ img: img('hero-projekte'), hue: 'wood', variant: 'dining',
    alt: 'Einrichtungsprojekte – beispielhafte Darstellung', crumb: 'Projekte',
    kicker: 'Projekte & Referenzen', h1: 'Einrichtung, die<br>im Alltag ankommt.',
    lead: 'Ein Einblick in unsere Arbeit. Sobald die Fotos unserer aktuellen Projekte vorliegen, zeigen wir sie hier in voller Größe – ehrlich, ohne Schönfärberei.' })}

<section class="section">
  <div class="wrap">
    <!-- TODO: Echte Projektfotos und Projektdaten von Wohnideen Hueter einsetzen.
         Struktur je Projekt: Raumart · Planungsaufgabe · Materialien · besondere Lösung.
         KEINE erfundenen Kunden, Bewertungen oder Projektdetails. -->
    <div class="section-head" data-reveal>
      <span class="eyebrow">Auswahl</span>
      <h2>Aktuelle Projekte</h2>
      <p class="lead">Die folgenden Beispiele sind Platzhalter und zeigen die geplante Darstellung. Echte Projekte folgen.</p>
    </div>
    <div class="proj-grid">
      ${[
      { slug: 'proj-1', tag: 'Küche', h: 'Küche im Drautal', p: 'Individuell geplante Küche mit fachgerechter Montage.', chips: ['Aufmaß vor Ort', 'Individuelle Planung', 'Montage'] },
      { slug: 'proj-2', tag: 'Wohnen', h: 'Wohnraum neu gedacht', p: 'Wohnliche Gestaltung aus einer Hand.', chips: ['Polstermöbel', 'Beleuchtung', 'Textilien'] },
      { slug: 'proj-3', tag: 'Schlafen', h: 'Ruhiges Schlafzimmer', p: 'Aufeinander abgestimmte Schlafzimmereinrichtung.', chips: ['Schlafsystem', 'Schrank nach Maß'] },
      { slug: 'proj-4', tag: 'Essen', h: 'Essbereich aus Massivholz', p: 'Tisch und Stühle für viele gemeinsame Stunden.', chips: ['Massivholz', 'Sitzgruppe'] },
      { slug: 'proj-5', tag: 'Vorzimmer', h: 'Garderobe nach Maß', p: 'Stauraumlösung für einen verwinkelten Grundriss.', chips: ['Maßanfertigung', 'Stauraum'] },
      { slug: 'proj-6', tag: 'Gesamtprojekt', h: 'Einrichtung aus einer Hand', p: 'Mehrere Räume aufeinander abgestimmt geplant.', chips: ['Mehrere Räume', 'Gesamtkonzept'] },
    ].map((x, i) => `
      <article class="proj-card" data-reveal data-delay="${(i % 3) + 1}">
        <div class="proj-media"><img src="${img(x.slug)}" alt="${esc(x.h)} – beispielhafte Darstellung (Platzhalter)" loading="lazy" width="1200" height="800"><span class="proj-tag">${esc(x.tag)}</span></div>
        <div class="proj-body">
          <h3>${esc(x.h)}</h3>
          <p>${esc(x.p)}</p>
          <div class="proj-meta">${x.chips.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>
          <p class="mt-1"><span class="ph-note">${icon('pin')} Beispiel · echtes Projekt folgt</span></p>
        </div>
      </article>`).join('')}
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    <div class="quote" data-reveal>
      <span class="eyebrow" style="justify-content:center">Kundenstimmen</span>
      <p class="lead">Wir zeigen hier nur echte Rückmeldungen unserer Kundinnen und Kunden.</p>
      <!-- TODO: Echte, freigegebene Kundenstimme(n) einsetzen. Keine erfundenen Bewertungen. -->
      <blockquote>„Persönliche Beratung, individuelle Planung und eine Montage, auf die man sich verlassen kann."</blockquote>
      <cite>Platzhalter – echte Kundenstimme mit Einverständnis folgt</cite>
    </div>
  </div>
</section>

${ctaBand({ h: 'Ihr Projekt könnte das nächste sein.', lead: 'Erzählen Sie uns von Ihren Räumen und Ihren Ideen – wir hören zu.' })}
`,
};

/* ================================= MARKEN ================================= */
export const marken = {
  page: 'marken.html', heroTop: true,
  title: 'Marken & Hersteller | Wohnideen Hueter',
  description: 'Ausgewählte Marken und Hersteller für langlebige Qualität – von Küchen und Geräten über Polstermöbel bis zu Massivholz und Schlafsystemen. Aus Österreich und Europa.',
  body: `
${pagehero({ img: img('hero-marken'), hue: 'stone', variant: 'room',
    alt: 'Hochwertige Marken – beispielhafte Darstellung', crumb: 'Marken',
    kicker: 'Marken & Hersteller', h1: 'Qualität, die bleibt.',
    lead: 'Wir arbeiten mit ausgewählten Herstellern, die für Handwerk, Materialqualität und Langlebigkeit stehen – viele davon aus Österreich.' })}

<section class="section">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <span class="eyebrow">Unsere Partner</span>
      <h2>Sorgfältig ausgewählt</h2>
      <p class="lead">Nicht jede Marke passt zu jedem Zuhause. Wir beraten Sie, welcher Hersteller für Ihr Projekt am besten geeignet ist.</p>
    </div>
    <div class="brand-grid" data-reveal>
      ${brands.map(b => `<div class="brand-cell"><span class="brand-name">${esc(b.name)}</span><span class="brand-note">${esc(b.note)}</span></div>`).join('')}
    </div>
    <p class="center mt-2" style="color:var(--ink-mute);font-size:.9rem" data-reveal>
      <!-- TODO: Markenliste mit Familie Hueter final abgleichen (Vollständigkeit & aktuelle Partnerschaften). -->
      Alle genannten Marken sind Eigentum der jeweiligen Hersteller. Die Auswahl wird laufend aktualisiert.
    </p>
  </div>
</section>

${ctaBand({ h: 'Welche Marke passt zu Ihrem Zuhause?', lead: 'Wir beraten Sie herstellerübergreifend und ehrlich – abgestimmt auf Ihr Projekt und Ihr Budget.' })}
`,
};

/* ================================ ÜBER UNS ================================ */
export const ueberUns = {
  page: 'ueber-uns.html', heroTop: true,
  title: 'Über uns – Familie Hueter | Wohnideen Hueter Irschen',
  description: 'Wohnideen Hueter ist ein familiengeführtes Einrichtungshaus in Irschen im oberen Drautal. Lernen Sie Rudi und Andrea Hueter und unsere Arbeitsweise kennen.',
  body: `
${pagehero({ img: img('hero-ueberuns'), hue: 'warm', variant: 'living',
    alt: 'Familie Hueter in ihrem Einrichtungshaus – beispielhafte Darstellung', crumb: 'Über uns',
    kicker: 'Über Wohnideen Hueter', h1: 'Ein Familienbetrieb,<br>der zuhört.',
    lead: 'Bei uns sprechen Sie mit den Menschen, die Ihr Projekt auch umsetzen – persönlich, ehrlich und regional verwurzelt.' })}

<section class="section">
  <div class="wrap">
    <div class="split">
      <div class="split-media" data-reveal><img src="${img('about-story')}" alt="Schauraum von Wohnideen Hueter – beispielhafte Darstellung" loading="lazy" width="1000" height="800"></div>
      <div class="split-body" data-reveal data-delay="1">
        <span class="eyebrow">Unsere Handschrift</span>
        <h2>Beraten. Planen.<br>Perfekt umsetzen.</h2>
        <p class="lead">Wohnideen Hueter steht für persönliche Beratung, individuelle Planung, präzise Fertigung durch bewährte Partner und eine Montage, auf die Sie sich verlassen können.</p>
        <p style="color:var(--ink-soft)">Als kleiner Familienbetrieb in Irschen nehmen wir uns die Zeit, die es braucht: Wir hören zu, verstehen, wie Sie leben, und planen Einrichtung, die wirklich zu Ihnen und Ihren Räumen passt. Kein anonymer Möbelkauf – sondern ein Weg, den wir gemeinsam gehen.</p>
      </div>
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <span class="eyebrow">Ihre Ansprechpartner</span>
      <h2>Persönlich für Sie da</h2>
    </div>
    <div class="team-grid">
      <div class="team-card" data-reveal data-delay="1">
        <div class="team-photo"><img src="${img('team-rudi')}" alt="Porträt Rudi Hueter – Platzhalter, echtes Foto folgt" loading="lazy" width="800" height="800"></div>
        <h3>${esc(site.people.rudi.name)}</h3>
        <p class="team-role">${esc(site.people.rudi.role)}</p>
        <a href="tel:+436767532300">${icon('phone')} ${esc(site.people.rudi.phone)}</a>
      </div>
      <div class="team-card" data-reveal data-delay="2">
        <div class="team-photo"><img src="${img('team-andrea')}" alt="Porträt Andrea Hueter – Platzhalter, echtes Foto folgt" loading="lazy" width="800" height="800"></div>
        <h3>${esc(site.people.andrea.name)}</h3>
        <p class="team-role">${esc(site.people.andrea.role)}</p>
        <a href="tel:+436767532301">${icon('phone')} +43 676 75 32 301</a>
      </div>
    </div>
    <p class="center mt-2" style="color:var(--ink-mute);font-size:.9rem" data-reveal>
      <!-- TODO: Echte Team-Fotos einsetzen. Rollen/Funktionen mit Familie Hueter bestätigen. -->
    </p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <span class="eyebrow">Wofür wir stehen</span>
      <h2>Unsere Werte</h2>
    </div>
    <div class="steps cols-3">
      <div class="step" data-reveal data-delay="1"><span class="step-n">·</span><div><h3>Persönlich</h3><p>Sie haben feste Ansprechpartner, die Ihr Projekt vom ersten Gespräch an kennen.</p></div></div>
      <div class="step" data-reveal data-delay="2"><span class="step-n">·</span><div><h3>Regional</h3><p>Verwurzelt in Irschen im oberen Drautal – mit kurzen Wegen und echter Nähe.</p></div></div>
      <div class="step" data-reveal data-delay="3"><span class="step-n">·</span><div><h3>Verlässlich</h3><p>Handschlagqualität: Was wir zusagen, halten wir – bis zur sauberen Übergabe.</p></div></div>
    </div>
  </div>
</section>

${ctaBand({ h: 'Lernen wir uns kennen.', lead: 'Kommen Sie in den Schauraum oder vereinbaren Sie einen Termin bei Ihnen zu Hause.' })}
`,
};

/* ================================= KONTAKT ================================ */
export const kontakt = {
  page: 'kontakt.html', heroTop: true,
  title: 'Kontakt & Beratungstermin | Wohnideen Hueter Irschen',
  description: 'Vereinbaren Sie einen persönlichen Beratungstermin bei Wohnideen Hueter in Irschen, Kärnten. Telefon, E-Mail, Anfrageformular, Anfahrt und Öffnungszeiten.',
  extraHead: `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'ContactPage',
    name: 'Kontakt – Wohnideen Hueter',
    mainEntity: {
      '@type': 'FurnitureStore', name: site.name, telephone: site.phone, email: site.email,
      address: { '@type': 'PostalAddress', streetAddress: site.address.street, postalCode: site.address.zip, addressLocality: site.address.city, addressRegion: site.address.region, addressCountry: site.address.countryCode },
    },
  })}</script>`,
  body: `
${pagehero({ img: img('hero-kontakt'), hue: 'clay', variant: 'room',
    alt: 'Kontakt zu Wohnideen Hueter – beispielhafte Darstellung', crumb: 'Kontakt',
    kicker: 'Kontakt & Beratungstermin', h1: 'Reden wir über<br>Ihr Zuhause.',
    lead: 'Rufen Sie an, schreiben Sie uns oder senden Sie das Formular. Wir melden uns persönlich und finden gemeinsam einen Termin.' })}

<section class="section">
  <div class="wrap">
    <div class="grid-2">
      <div data-reveal>
        <span class="eyebrow">Anfrage senden</span>
        <h2>Beratungstermin anfragen</h2>
        <p class="lead">Wir brauchen nur wenige Angaben. Alles Weitere besprechen wir persönlich.</p>
        <form class="form-card" data-contact-form data-mailto="${site.email}" novalidate>
          <div class="field-row two">
            <div class="field">
              <label for="name">Name <span class="req" aria-hidden="true">*</span></label>
              <input id="name" name="name" type="text" autocomplete="name" required>
            </div>
            <div class="field">
              <label for="email">E-Mail <span class="req" aria-hidden="true">*</span></label>
              <input id="email" name="email" type="email" autocomplete="email" required>
            </div>
          </div>
          <div class="field-row two">
            <div class="field">
              <label for="telefon">Telefon <span style="color:var(--ink-mute);font-weight:400">(optional)</span></label>
              <input id="telefon" name="telefon" type="tel" autocomplete="tel">
            </div>
            <div class="field">
              <label for="bereich">Einrichtungsbereich</label>
              <select id="bereich" name="bereich">
                <option value="">Bitte wählen …</option>
                ${contactAreas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field">
            <label for="nachricht">Ihre Nachricht <span class="req" aria-hidden="true">*</span></label>
            <textarea id="nachricht" name="nachricht" required placeholder="Erzählen Sie uns kurz von Ihrem Vorhaben …"></textarea>
          </div>
          <div class="field">
            <span style="display:block;font-weight:600;font-size:.9rem;margin-bottom:.5rem">Bevorzugte Kontaktart</span>
            <div class="contact-methods">
              <label class="pref"><input type="radio" name="kontaktart" value="Telefon" checked> Telefon</label>
              <label class="pref"><input type="radio" name="kontaktart" value="E-Mail"> E-Mail</label>
              <label class="pref"><input type="radio" name="kontaktart" value="Egal"> Egal</label>
            </div>
          </div>
          <div class="field">
            <label class="consent">
              <input type="checkbox" name="datenschutz" required>
              <span>Ich habe die <a href="datenschutz.html" target="_blank" rel="noopener">Datenschutzerklärung</a> gelesen und bin einverstanden, dass meine Angaben zur Bearbeitung meiner Anfrage verwendet werden. <span class="req" aria-hidden="true">*</span></span>
            </label>
          </div>
          <button class="btn btn-primary btn-block" type="submit">${icon('mail')} Anfrage senden</button>
          <p class="form-note">Ihre Anfrage wird über Ihr E-Mail-Programm an ${esc(site.email)} übermittelt. Es werden keine Daten an Dritte weitergegeben und kein Tracking eingesetzt.</p>
          <p class="form-status" data-form-status aria-live="polite"></p>
        </form>
      </div>

      <div data-reveal data-delay="1">
        <span class="eyebrow">So erreichen Sie uns</span>
        <h2>Direkt &amp; persönlich</h2>
        <div class="info-grid mt-1">
          <div class="info-card">${icon('phone')}<div><h3>Telefon</h3>
            <p><a href="tel:+436767532300">${esc(site.people.rudi.name)}: ${esc(site.people.rudi.phone)}</a><br>
            <a href="tel:+436767532301">${esc(site.people.andrea.name)}: +43 676 75 32 301</a></p></div></div>
          <div class="info-card">${icon('mail')}<div><h3>E-Mail</h3><p><a href="mailto:${site.email}">${esc(site.email)}</a></p></div></div>
          <div class="info-card">${icon('pin')}<div><h3>Adresse &amp; Schauraum</h3><p>${esc(site.legalName)}<br>${esc(site.address.street)}, ${esc(site.address.zip)} ${esc(site.address.city)}<br>${esc(site.address.region)}, ${esc(site.address.country)}</p></div></div>
          <div class="info-card">${icon('clock')}<div><h3>Termine</h3><p>${esc(site.hours.detail)}</p></div></div>
        </div>
        <div class="mt-2">
          <!-- DSGVO: Karte lädt erst nach ausdrücklichem Klick (Zwei-Klick-Lösung).
               Erst dann wird eine Verbindung zu OpenStreetMap aufgebaut. -->
          <div class="map-consent" data-map
               data-map-src="https://www.openstreetmap.org/export/embed.html?bbox=13.06%2C46.70%2C13.24%2C46.77&layer=mapnik&marker=46.7333%2C13.15"
               data-map-title="Standort Wohnideen Hueter in Irschen auf OpenStreetMap">
            <div class="map-consent-inner">
              <p>${icon('pin')} Die Karte wird erst geladen, wenn Sie zustimmen. Dabei wird eine Verbindung zu OpenStreetMap aufgebaut.</p>
              <button type="button" class="btn btn-ghost" data-map-load>Karte laden</button>
            </div>
          </div>
          <p style="font-size:.82rem;color:var(--ink-mute);margin-top:.6rem">Kartendarstellung © OpenStreetMap-Mitwirkende. <a class="textlink" href="https://www.openstreetmap.org/?mlat=46.7333&mlon=13.15#map=13/46.7333/13.15" target="_blank" rel="noopener">Route planen ${icon('arrow')}</a>
          <br><!-- TODO: Exakte Betriebsadresse/Koordinaten und Anfahrtsbeschreibung bestätigen. --></p>
        </div>
      </div>
    </div>
  </div>
</section>
`,
};

export const pages = [planung, projekte, marken, ueberUns, kontakt];
