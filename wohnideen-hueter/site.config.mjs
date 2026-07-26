/**
 * =============================================================================
 *  ZENTRALE KONFIGURATION — Wohnideen Hueter
 * =============================================================================
 *  Alle Unternehmens-, Kontakt- und Standortdaten an EINER Stelle.
 *  Zum Ändern von Adresse, Telefon, Öffnungszeiten etc. nur hier editieren
 *  und `node build.mjs` ausführen — die Daten werden in alle Seiten eingesetzt.
 *
 *  Quelle der verifizierten Daten: Firmenbuch (FN 350099 b), firmenabc.at,
 *  herold.at, wohnideen-hueter.at (Stand der Recherche: Juli 2026).
 *  Alles, was NICHT gesichert ist, ist unten als TODO markiert.
 * =============================================================================
 */

export const site = {
  // Deploy-Pfad (GitHub Pages Unterordner). Für Root-Deploy auf '' setzen.
  base: '/wohnideen-hueter',
  url: 'https://www.wohnideen-hueter.at', // Canonical-Domain (Ziel-Domain)

  name: 'Wohnideen Hueter',
  legalName: 'Rudolf Hueter e.U.',
  claim: 'Räume, die sich nach Zuhause anfühlen.',
  tagline: 'Persönlich geplant. Hochwertig eingerichtet. Für Sie gemacht.',

  // Ansprechpersonen (verifiziert: herold.at)
  people: {
    rudi:  { name: 'Rudi Hueter',   role: 'Inhaber, Planung & Beratung', phone: '+43 676 7532300' },
    andrea:{ name: 'Andrea Hueter',  role: 'Beratung & Organisation',      phone: '+43 676 7532301' },
  },

  // Primärer Kontakt
  phone:        '+43 676 7532300',
  phoneDisplay: '+43 676 75 32 300',
  phoneHref:    '+436767532300',
  email:        'office@wohnideen-hueter.at',

  address: {
    street:  'Irschen 26',
    zip:     '9773',
    city:    'Irschen',
    region:  'Kärnten',
    country: 'Österreich',
    countryCode: 'AT',
    district: 'Spittal an der Drau',
    // Geo-Koordinaten Ortszentrum Irschen (öffentlich, für Karte/Schema).
    // TODO: Exakte Betriebs-Koordinaten von Familie Hueter bestätigen.
    lat: 46.7333,
    lng: 13.1500,
  },

  // TODO: Genaue Öffnungszeiten von Familie Hueter bestätigen.
  // Gesichert ist nur: "Termine nach Vereinbarung".
  hours: {
    note: 'Termine nach persönlicher Vereinbarung',
    detail: 'Rufen Sie uns an oder schreiben Sie uns – wir finden gemeinsam einen Termin, der zu Ihnen passt. Gerne auch außerhalb üblicher Geschäftszeiten.',
  },

  social: {
    facebook: 'https://www.facebook.com/wohnideen.hueter/',
  },

  // Rechtliches (verifiziert: Firmenbuch / firmenabc.at)
  legal: {
    owner: 'Rudolf Hueter',
    fn: 'FN 350099 b',
    court: 'Landesgericht Klagenfurt',
    uid: 'ATU52777008',
    activity: 'Einzelhandel mit Wohnmöbeln aller Art',
    chamber: 'Wirtschaftskammer Kärnten',
    trade: 'Handelsgewerbe',
  },

  // Einzugsgebiet (real, konservativ — oberes Drautal / Oberkärnten / Osttirol)
  serviceArea: ['Irschen', 'Oberdrauburg', 'Greifenburg', 'Berg im Drautal',
    'Dellach im Drautal', 'Spittal an der Drau', 'Lienz', 'Osttirol', 'Oberkärnten'],

  cta: {
    appointment: 'Beratungstermin vereinbaren',
    projects: 'Projekte entdecken',
    call: 'Anrufen',
    write: 'Anfrage senden',
    visit: 'Schauraum besuchen',
  },
};

/**
 * Marken (verifiziert aus mehreren Quellen). `note` kennzeichnet den Bereich.
 * TODO: Vollständigkeit & aktuelle Partnerschaften mit Familie Hueter abgleichen.
 */
export const brands = [
  { name: 'ewe',                note: 'Küchen' },
  { name: 'FM Küchen',          note: 'Küchen' },
  { name: 'Siemens',            note: 'Küchengeräte' },
  { name: 'Blanco',             note: 'Spülen & Armaturen' },
  { name: 'Koinor',             note: 'Polstermöbel' },
  { name: 'ADA Austria',        note: 'Polster & Schlafen' },
  { name: 'elastica',           note: 'Schlafsysteme' },
  { name: 'ANREI',              note: 'Massivholzmöbel' },
  { name: 'Schösswender',       note: 'Massivholz & Schlafen' },
  { name: 'Rauchenzauner',      note: 'Polstermöbel' },
  { name: 'JAB Anstoetz',       note: 'Textilien & Vorhänge' },
  { name: 'Fine',               note: 'Wohnaccessoires' },
  { name: 'Sangiacomo',         note: 'Wohn- & Vorzimmermöbel' },
  { name: 'Satler',             note: 'Einrichtung' },
  { name: 'Woodbase',           note: 'Bodenbeläge' },
];

/**
 * Sortimentsbereiche — Reihenfolge = Navigation & Startseiten-Grid.
 * `img` verweist auf Platzhalter (siehe assets/img). Bei echten Fotos ersetzen.
 */
export const categories = [
  {
    slug: 'kuechen', nav: 'Küchen', title: 'Küchen',
    kicker: 'Der Raum, in dem Ihr Zuhause zusammenkommt',
    lead: 'Eine Küche, die zu Ihrem Alltag passt – exakt aufgemessen, individuell geplant und fachgerecht montiert.',
    hue: 'clay',
  },
  {
    slug: 'wohnen', nav: 'Wohnen', title: 'Wohnen',
    kicker: 'Zum Ankommen, Durchatmen und Beisammensein',
    lead: 'Sofas, Wohnwände und Beleuchtung, die Ihren Wohnraum warm, wohnlich und ganz persönlich machen.',
    hue: 'sage',
  },
  {
    slug: 'schlafen', nav: 'Schlafen', title: 'Schlafen',
    kicker: 'Erholung beginnt mit dem richtigen Bett',
    lead: 'Betten, Schränke und Schlafsysteme, individuell auf Ihren Schlaf und Ihren Raum abgestimmt.',
    hue: 'dusk',
  },
  {
    slug: 'essen', nav: 'Essen', title: 'Essen',
    kicker: 'Der Tisch, an dem man gerne zusammensitzt',
    lead: 'Esstische, Stühle und Bänke aus hochwertigen Materialien – gemacht für viele gemeinsame Stunden.',
    hue: 'wood',
  },
  {
    slug: 'vorzimmer', nav: 'Vorzimmer', title: 'Vorzimmer',
    kicker: 'Der erste Eindruck Ihres Zuhauses',
    lead: 'Garderoben und Stauraumlösungen, die Ordnung schaffen und schön aussehen – oft nach Maß gefertigt.',
    hue: 'stone',
  },
  {
    slug: 'bad', nav: 'Bad', title: 'Bad',
    kicker: 'Wohnliche Bäder statt kühler Nasszellen',
    lead: 'Badmöbel und Ausstattung, die Funktion und Wohlgefühl verbinden – abgestimmt auf Ihren Raum.',
    hue: 'water',
    // TODO: Badmöbel-Sortiment mit Familie Hueter bestätigen (Umfang/Marken).
    tentative: true,
  },
];

// Ablauf „von der Idee zur fertigen Einrichtung" (aus Firmenphilosophie abgeleitet)
export const process = [
  { n: '01', title: 'Kennenlernen & Beratung', text: 'Wir hören zu: Wie leben Sie, was wünschen Sie sich, was soll bleiben? Ohne Zeitdruck, ganz persönlich.' },
  { n: '02', title: 'Aufmaß & Bedarfsermittlung', text: 'Wir kommen zu Ihnen, messen präzise auf und erfassen die baulichen Gegebenheiten Ihrer Räume.' },
  { n: '03', title: 'Individuelle Planung', text: 'Sie erhalten eine maßgeschneiderte Planung mit Visualisierung – abgestimmt auf Ihren Raum und Ihr Budget.' },
  { n: '04', title: 'Materialien & Ausstattung', text: 'Gemeinsam wählen wir Materialien, Oberflächen, Farben und Geräte aus – zum Angreifen und Vergleichen.' },
  { n: '05', title: 'Lieferung', text: 'Wir liefern termingerecht und behandeln Ihre neue Einrichtung mit Sorgfalt – bis in den Raum hinein.' },
  { n: '06', title: 'Fachgerechte Montage', text: 'Unsere Montage erfolgt sauber, präzise und zuverlässig. Erst wenn alles passt, sind wir fertig.' },
  { n: '07', title: 'Persönliche Nachbetreuung', text: 'Auch danach sind wir für Sie da – ein Ansprechpartner, der bleibt. Auf Wunsch mit Urlaubs-Aufbauservice.' },
];

// Vertrauens-Vorteile (Startseite, direkt nach Hero)
export const advantages = [
  { icon: 'chat',   title: 'Persönliche Beratung', text: 'Kein anonymer Möbelkauf. Sie sprechen mit den Menschen, die Ihr Projekt auch umsetzen.' },
  { icon: 'ruler',  title: 'Individuelle Planung', text: 'Aufgemessen, durchdacht und auf Ihren Raum zugeschnitten – nicht von der Stange.' },
  { icon: 'truck',  title: 'Lieferung & Montage', text: 'Fachgerechte Lieferung und saubere Montage aus einer Hand. Wir lassen Sie nicht allein.' },
  { icon: 'heart',  title: 'Ein Ansprechpartner', text: 'Von der ersten Idee bis zur Nachbetreuung begleitet Sie dieselbe vertraute Familie.' },
];

// Kontakt-Formular: Einrichtungsbereiche
export const contactAreas = ['Küche', 'Wohnen', 'Schlafen', 'Essen', 'Vorzimmer', 'Bad', 'Mehrere Räume', 'Noch offen'];
