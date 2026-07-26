import { site, categories, brands } from '../site.config.mjs';
import { icon, esc } from '../templates/layout.mjs';
import { img, pagehero, ctaBand } from './parts.mjs';

// Szenen-/Farb-Zuordnung für Platzhalterbilder
const SCENE = {
  kuechen:   { variant: 'kitchen', hue: 'clay' },
  wohnen:    { variant: 'living',  hue: 'sage' },
  schlafen:  { variant: 'bedroom', hue: 'dusk' },
  essen:     { variant: 'dining',  hue: 'wood' },
  vorzimmer: { variant: 'hall',    hue: 'stone' },
  bad:       { variant: 'bath',    hue: 'water' },
};

// Redaktioneller Detailinhalt je Bereich (keine erfundenen Fakten – beschreibend)
const DETAIL = {
  kuechen: {
    intro: 'Die Küche ist der Raum, in dem Ihr Zuhause zusammenkommt. Wir planen sie so, dass sie zu Ihrem Alltag passt – von den Wegen beim Kochen bis zur letzten Steckdose. Präzises Aufmaß, durchdachte Stauraumlösungen und hochwertige Geräte sorgen dafür, dass alles seinen Platz hat.',
    offers: ['Individuelle Küchenplanung mit Visualisierung', 'Präzises Aufmaß vor Ort', 'Hochwertige Elektrogeräte und Spülen namhafter Marken', 'Arbeitsflächen, Fronten und Griffe nach Ihrem Geschmack', 'Fachgerechte Lieferung und Montage', 'Anschluss und saubere Übergabe'],
    note: 'Von der kompakten Küche bis zur offenen Wohnküche – wir stimmen jede Lösung auf Ihren Raum, Ihr Budget und Ihre Gewohnheiten ab.',
    brands: ['ewe', 'FM Küchen', 'Siemens', 'Blanco'],
  },
  wohnen: {
    intro: 'Ihr Wohnraum ist der Ort zum Ankommen, Durchatmen und Beisammensein. Wir gestalten ihn warm und wohnlich – mit Sofas, die zum Verweilen einladen, Wohnwänden mit klugem Stauraum und einer Beleuchtung, die Stimmung macht.',
    offers: ['Polster- und Sitzmöbel in vielen Stoffen und Ledern', 'Wohnwände und Sideboards mit durchdachtem Stauraum', 'Beleuchtungskonzepte für jede Tageszeit', 'Teppiche, Vorhänge und Wohnaccessoires', 'Farb- und Materialberatung', 'Aufeinander abgestimmte Gesamtgestaltung'],
    note: 'Ob gemütlich oder klar und modern – wir finden den Stil, der zu Ihnen passt, und richten den Raum stimmig ein.',
    brands: ['Koinor', 'Rauchenzauner', 'JAB Anstoetz', 'Fine'],
  },
  schlafen: {
    intro: 'Erholung beginnt mit dem richtigen Bett. Wir beraten Sie zu Schlafsystemen, Matratzen und Schränken, die zu Ihrem Schlaf und Ihrem Raum passen – für Nächte, in denen Sie wirklich zur Ruhe kommen.',
    offers: ['Betten in vielen Größen, Höhen und Materialien', 'Schlafsysteme, Matratzen und Zubehör', 'Kleiderschränke – auch nach Maß geplant', 'Naturmaterialien und Massivholz auf Wunsch', 'Persönliche Beratung zu gesundem Schlaf', 'Lieferung und Montage inklusive'],
    note: 'Gerade beim Schlafzimmer lohnt sich die persönliche Beratung – jeder Mensch schläft anders. Wir nehmen uns die Zeit dafür.',
    brands: ['ADA Austria', 'elastica', 'Schösswender', 'ANREI'],
  },
  essen: {
    intro: 'Der Esstisch ist der Ort, an dem man gerne zusammensitzt. Wir richten Ihren Essbereich mit langlebigen Tischen, bequemen Stühlen und Bänken ein – gemacht für viele gemeinsame Stunden.',
    offers: ['Esstische aus Massivholz und anderen Materialien', 'Stühle, Bänke und Sitzgruppen', 'Passende Beleuchtung über dem Tisch', 'Sideboards und Vitrinen zum Ensemble', 'Ausziehbare Lösungen für Gäste', 'Abstimmung auf Ihren Wohn- und Küchenbereich'],
    note: 'Wir achten darauf, dass Essbereich, Küche und Wohnraum zusammenpassen – für ein stimmiges Gesamtbild.',
    brands: ['ANREI', 'Schösswender', 'Satler'],
  },
  vorzimmer: {
    intro: 'Das Vorzimmer ist der erste Eindruck Ihres Zuhauses – und oft der Raum, in dem Ordnung am meisten zählt. Wir schaffen Garderoben und Stauraumlösungen, die gut aussehen und den Alltag leichter machen.',
    offers: ['Garderoben – häufig nach Maß gefertigt', 'Schuh- und Stauraumlösungen', 'Sitzgelegenheiten und Spiegel', 'Passende Beleuchtung für den Eingangsbereich', 'Nutzung auch schwieriger Grundrisse', 'Abstimmung auf den Wohnstil des Hauses'],
    note: 'Gerade enge oder verwinkelte Vorzimmer lassen sich mit einer Maßplanung optimal nutzen. Sprechen Sie uns an.',
    brands: ['Sangiacomo', 'ANREI'],
  },
  bad: {
    intro: 'Ein Bad darf mehr sein als eine Nasszelle. Wir bringen Wohnlichkeit ins Badezimmer – mit Badmöbeln und Ausstattung, die Funktion und Wohlgefühl verbinden und auf Ihren Raum abgestimmt sind.',
    offers: ['Badmöbel und Waschtischlösungen', 'Stauraum, der Ordnung schafft', 'Warme Materialien und Oberflächen', 'Passende Beleuchtung und Spiegel', 'Abstimmung auf vorhandene Sanitärobjekte', 'Persönliche Planung nach Aufmaß'],
    note: 'Der Umfang unseres Bad-Sortiments wird laufend erweitert. Fragen Sie uns nach den aktuellen Möglichkeiten für Ihr Projekt.',
    brands: [],
    tentative: true,
  },
};

export function categoryPage(cat) {
  const s = SCENE[cat.slug] || { variant: 'room', hue: 'warm' };
  const d = DETAIL[cat.slug];
  const others = categories.filter(c => c.slug !== cat.slug);
  const relBrands = (d.brands || []).map(name => brands.find(b => b.name === name)).filter(Boolean);

  const body = `
${pagehero({
    img: img('hero-' + cat.slug), hue: s.hue, variant: s.variant,
    alt: `${cat.title} bei Wohnideen Hueter – beispielhafte Darstellung`,
    crumb: cat.title, kicker: cat.kicker, h1: esc(cat.title),
    lead: cat.lead,
  })}

<section class="section">
  <div class="wrap">
    <div class="split">
      <div class="split-media" data-reveal><img src="${img('feature-' + cat.slug)}" alt="${esc(cat.title)} – Detailansicht, beispielhafte Darstellung" loading="lazy" width="1000" height="800"></div>
      <div class="split-body" data-reveal data-delay="1">
        <span class="eyebrow">${esc(cat.title)}</span>
        <h2>Individuell geplant,<br>fachgerecht umgesetzt</h2>
        <p class="lead">${esc(d.intro)}</p>
        ${d.tentative ? `<p class="ph-note">${icon('chat')} Sortiment wird erweitert – bitte anfragen</p>` : ''}
        <a class="btn btn-primary mt-1" href="kontakt.html">${icon('chat')} Beratung zu ${esc(cat.title)}</a>
      </div>
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    <div class="grid-2">
      <div data-reveal>
        <span class="eyebrow">Was wir bieten</span>
        <h2>Leistungen im Bereich ${esc(cat.title)}</h2>
        <p class="lead">Alles aus einer Hand – von der ersten Idee bis zur fertigen Montage.</p>
      </div>
      <div data-reveal data-delay="1">
        <ul class="ticklist">
          ${d.offers.map(o => `<li>${esc(o)}</li>`).join('')}
        </ul>
        <p style="color:var(--ink-soft)">${esc(d.note)}</p>
      </div>
    </div>
  </div>
</section>

${relBrands.length ? `
<section class="section">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <span class="eyebrow">Marken für ${esc(cat.title)}</span>
      <h2>Ausgewählte Partner</h2>
    </div>
    <div class="brand-grid" data-reveal>
      ${relBrands.map(b => `<div class="brand-cell"><span class="brand-name">${esc(b.name)}</span><span class="brand-note">${esc(b.note)}</span></div>`).join('')}
    </div>
    <p class="center mt-2" data-reveal><a class="textlink" href="marken.html">Alle Marken ansehen ${icon('arrow')}</a></p>
  </div>
</section>` : ''}

<section class="section section-tint">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Weiter im Sortiment</span>
      <h2>Alles für Ihr Zuhause</h2>
    </div>
    <div class="cat-grid">
      ${others.map((c, i) => `
      <a class="cat-card" href="${c.slug}.html" data-reveal data-delay="${(i % 3) + 1}">
        <img src="${img('cat-' + c.slug)}" alt="${esc(c.title)} bei Wohnideen Hueter – beispielhafte Darstellung" loading="lazy" width="900" height="1125">
        <div class="cat-body"><h3>${esc(c.title)}</h3><span class="cat-arrow">Entdecken ${icon('arrow')}</span></div>
      </a>`).join('')}
    </div>
  </div>
</section>

${ctaBand({ h: `Bereit für Ihr Projekt im Bereich ${esc(cat.title)}?`, lead: 'Wir beraten Sie persönlich und unverbindlich – im Schauraum oder bei Ihnen zu Hause.' })}
`;

  return {
    page: `${cat.slug}.html`,
    heroTop: true,
    title: `${cat.title} – individuell geplant | Wohnideen Hueter Irschen`,
    description: `${cat.lead} Persönliche Planung, Lieferung und Montage bei Wohnideen Hueter in Irschen, Kärnten.`,
    body,
  };
}

export const categoryPages = categories.map(categoryPage);
