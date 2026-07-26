/* ---------------------------------------------------------------------------
 *  PLATZHALTER-BILDER (SVG)
 *  Erzeugt hochwertige, klar gekennzeichnete Platzhalter, solange keine echten
 *  Fotos von Wohnideen Hueter vorliegen. Jeder Platzhalter zeigt dezent den
 *  Hinweis „Platzhalter · echtes Foto folgt".
 *
 *  ➜ ZUM ERSETZEN: einfach die Datei assets/img/<name>.svg durch ein echtes
 *    Foto gleichen Namens (z.B. <name>.jpg) austauschen und im <img src> die
 *    Endung anpassen. Seitenverhältnisse siehe unten.
 * ------------------------------------------------------------------------- */

const HUES = {
  clay:  ['#c08a68', '#8a5a40', '#6f4632'],
  sage:  ['#969c7d', '#6a7052', '#535840'],
  dusk:  ['#948aa0', '#63596f', '#4d4557'],
  wood:  ['#c0966a', '#8a6440', '#6d4d32'],
  stone: ['#ada69e', '#7d766e', '#635d56'],
  water: ['#87a2ac', '#566f78', '#455a62'],
  night: ['#5b5040', '#3a3227', '#2a2420'],
  warm:  ['#c9a888', '#9c6b4e', '#6f4a34'],
};

// Verschiedene abstrakte „Interieur"-Kompositionen (deterministisch pro Variante)
function scene(variant, c) {
  const [a, , d] = c;
  const scenes = {
    // Sofa + Fenster + Lampe
    living: `
      <rect x="120" y="120" width="230" height="150" rx="10" fill="${a}" opacity=".5"/>
      <line x1="120" y1="120" x2="120" y2="270" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>
      <path d="M700 300 h300 v150 q0 20 -20 20 h-260 q-20 0 -20 -20 z" fill="${d}" opacity=".55"/>
      <rect x="690" y="270" width="330" height="60" rx="18" fill="${d}" opacity=".7"/>
      <line x1="850" y1="60" x2="850" y2="150" stroke="#fff" stroke-opacity=".3" stroke-width="2"/>
      <circle cx="850" cy="168" r="26" fill="#fff" fill-opacity=".18"/>`,
    // Küche: Zeile + Dunstabzug
    kitchen: `
      <rect x="90" y="300" width="520" height="120" rx="8" fill="${d}" opacity=".55"/>
      <rect x="90" y="180" width="520" height="70" rx="6" fill="${a}" opacity=".4"/>
      <rect x="300" y="120" width="120" height="70" rx="8" fill="#fff" fill-opacity=".14"/>
      <circle cx="470" cy="360" r="10" fill="#fff" fill-opacity=".3"/>
      <rect x="760" y="150" width="260" height="270" rx="10" fill="${a}" opacity=".45"/>
      <line x1="760" y1="285" x2="1020" y2="285" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>`,
    // Bett + Nachttisch
    bedroom: `
      <rect x="140" y="250" width="620" height="170" rx="12" fill="${d}" opacity=".55"/>
      <rect x="140" y="150" width="620" height="110" rx="14" fill="${a}" opacity=".45"/>
      <rect x="800" y="300" width="120" height="120" rx="10" fill="${d}" opacity=".6"/>
      <circle cx="860" cy="230" r="20" fill="#fff" fill-opacity=".16"/>
      <line x1="860" y1="60" x2="860" y2="210" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>`,
    // Tisch + Stühle
    dining: `
      <rect x="330" y="250" width="440" height="26" rx="8" fill="${a}" opacity=".6"/>
      <rect x="360" y="276" width="14" height="130" fill="${d}" opacity=".55"/>
      <rect x="726" y="276" width="14" height="130" fill="${d}" opacity=".55"/>
      <rect x="250" y="290" width="60" height="120" rx="8" fill="${d}" opacity=".5"/>
      <rect x="790" y="290" width="60" height="120" rx="8" fill="${d}" opacity=".5"/>
      <ellipse cx="550" cy="150" rx="70" ry="14" fill="#fff" fill-opacity=".14"/>
      <line x1="550" y1="60" x2="550" y2="150" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>`,
    // Garderobe / Vorzimmer
    hall: `
      <rect x="180" y="120" width="180" height="320" rx="10" fill="${d}" opacity=".55"/>
      <line x1="270" y1="120" x2="270" y2="440" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>
      <rect x="430" y="160" width="8" height="120" fill="${a}" opacity=".6"/>
      <circle cx="470" cy="180" r="8" fill="#fff" fill-opacity=".3"/>
      <circle cx="510" cy="200" r="8" fill="#fff" fill-opacity=".3"/>
      <rect x="640" y="330" width="330" height="110" rx="10" fill="${a}" opacity=".4"/>`,
    // Bad
    bath: `
      <rect x="150" y="260" width="360" height="160" rx="80" fill="${a}" opacity=".45"/>
      <rect x="700" y="160" width="200" height="260" rx="10" fill="${d}" opacity=".5"/>
      <circle cx="800" cy="230" r="34" fill="#fff" fill-opacity=".16"/>
      <line x1="800" y1="120" x2="800" y2="196" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>`,
    // Porträt (neutrale Silhouette)
    portrait: `
      <circle cx="570" cy="250" r="95" fill="#fff" fill-opacity=".16"/>
      <path d="M400 470 q0 -150 170 -150 q170 0 170 150 z" fill="#fff" fill-opacity=".16"/>`,
    // generisch (Fenster + Pflanze)
    room: `
      <rect x="120" y="110" width="300" height="230" rx="8" fill="#fff" fill-opacity=".12"/>
      <line x1="270" y1="110" x2="270" y2="340" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>
      <line x1="120" y1="225" x2="420" y2="225" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>
      <path d="M820 430 q-40 -140 0 -200 q40 60 0 200 z" fill="${a}" opacity=".55"/>
      <rect x="795" y="425" width="50" height="40" rx="6" fill="${d}" opacity=".6"/>`,
  };
  return scenes[variant] || scenes.room;
}

/**
 * @param {object} o
 *   w,h        ViewBox-Größe (Seitenverhältnis)
 *   hue        Schlüssel aus HUES
 *   variant    Szene (living|kitchen|bedroom|dining|hall|bath|room)
 *   label      Bereichsname (dezent eingeblendet)
 *   badge      Platzhalter-Hinweis anzeigen (default true)
 */
export function placeholder(o) {
  const w = o.w || 1200, h = o.h || 800;
  const c = HUES[o.hue] || HUES.warm;
  const gid = 'g' + o.hue + w + h + (o.variant || '');
  // Badge nur zeigen, wenn ausdrücklich gewünscht (Produktion: keine Beschriftung).
  const badge = o.badge === true ? `
    <g font-family="Inter, system-ui, sans-serif" opacity=".9">
      <rect x="${w/2 - 150}" y="${h - 70}" width="300" height="34" rx="17" fill="#000" fill-opacity=".28"/>
      <text x="${w/2}" y="${h - 48}" text-anchor="middle" fill="#fff" fill-opacity=".92" font-size="15" font-weight="500" letter-spacing="1">Platzhalter · echtes Foto folgt</text>
    </g>` : '';
  const label = o.label ? `<text x="60" y="${h - 54}" font-family="'Cormorant Garamond', Georgia, serif" fill="#fff" fill-opacity=".9" font-size="46" font-weight="600">${o.label}</text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c[0]}"/>
      <stop offset="0.55" stop-color="${c[1]}"/>
      <stop offset="1" stop-color="${c[2]}"/>
    </linearGradient>
    <radialGradient id="${gid}v" cx="0.5" cy="0.3" r="0.9">
      <stop offset="0" stop-color="#fff" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.25"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${gid})"/>
  <g transform="scale(${w/1140}) translate(${(1140-1140)/2},0)">${scene(o.variant, c)}</g>
  <rect width="${w}" height="${h}" fill="url(#${gid}v)"/>
  ${o.label ? '' : label}${label}${badge}
</svg>`;
}

// Favicon (Monogramm WH)
export function favicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="#9c6b4e"/>
  <text x="32" y="43" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="34" font-weight="600" fill="#fff" letter-spacing="0.5">WH</text>
</svg>`;
}

// Open-Graph-Standardbild (1200×630)
export function ogImage() {
  const c = HUES.warm;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs><linearGradient id="og" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c[0]}"/><stop offset="0.6" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/>
  </linearGradient></defs>
  <rect width="1200" height="630" fill="url(#og)"/>
  <rect width="1200" height="630" fill="#000" opacity="0.12"/>
  <text x="600" y="255" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" letter-spacing="6" fill="#fff" fill-opacity=".85">WOHNIDEEN HUETER · IRSCHEN</text>
  <text x="600" y="345" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="66" font-weight="600" fill="#fff">Räume, die sich nach</text>
  <text x="600" y="415" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="66" font-weight="600" fill="#fff">Zuhause anfühlen.</text>
  <text x="600" y="500" text-anchor="middle" font-family="Inter, sans-serif" font-size="24" fill="#fff" fill-opacity=".82">Persönlich geplant · Hochwertig eingerichtet</text>
</svg>`;
}
