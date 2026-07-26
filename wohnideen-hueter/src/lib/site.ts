/**
 * =============================================================================
 *  ZENTRALE INHALTSDATEN — Wohnideen Hueter
 * =============================================================================
 *  Sämtliche Unternehmens-, Kontakt-, Navigations- und Sortimentsdaten an
 *  EINER Stelle, typisiert. Kontaktdaten NICHT mehrfach hart in Komponenten
 *  kodieren – immer aus diesem Modul importieren. So lässt sich später leicht
 *  ein CMS anschließen (dieselbe Datenform als Quelle).
 *
 *  Verifizierte Daten: Firmenbuch (FN 350099 b), firmenabc.at, herold.at,
 *  wohnideen-hueter.at. Unbestätigtes ist als TODO markiert – nichts erfunden.
 * =============================================================================
 */

export interface Person {
  name: string;
  role: string;
  phone: string;
  phoneHref: string;
}

export const site = {
  name: "Wohnideen Hueter",
  legalName: "Rudolf Hueter e.U.",
  claim: "Räume, die zu Ihrem Leben passen.",
  tagline:
    "Wir planen Küchen und Wohnräume persönlich, individuell und mit einem Blick fürs Ganze.",
  /** Canonical-Domain (Zielhosting). */
  url: "https://www.wohnideen-hueter.at",

  phone: "+43 676 7532300",
  phoneDisplay: "+43 676 75 32 300",
  phoneHref: "tel:+436767532300",
  email: "office@wohnideen-hueter.at",
  emailHref: "mailto:office@wohnideen-hueter.at",

  address: {
    street: "Irschen 26",
    zip: "9773",
    city: "Irschen",
    region: "Kärnten",
    country: "Österreich",
    countryCode: "AT",
    district: "Spittal an der Drau",
    // Ortszentrum Irschen (öffentlich). TODO: exakte Betriebs-Koordinaten bestätigen.
    lat: 46.7333,
    lng: 13.15,
  },

  hours: {
    note: "Termine nach persönlicher Vereinbarung",
    detail:
      "Rufen Sie uns an oder schreiben Sie uns – wir finden gemeinsam einen Termin, der zu Ihnen passt. Gerne auch außerhalb üblicher Geschäftszeiten.",
  },

  social: {
    facebook: "https://www.facebook.com/wohnideen.hueter/",
  },

  legal: {
    owner: "Rudolf Hueter",
    fn: "FN 350099 b",
    court: "Landesgericht Klagenfurt",
    uid: "ATU52777008",
    activity: "Einzelhandel mit Wohnmöbeln aller Art",
    chamber: "Wirtschaftskammer Kärnten",
    trade: "Handelsgewerbe",
  },
} as const;

export const people: Record<"rudi" | "andrea", Person> = {
  rudi: {
    name: "Rudi Hueter",
    role: "Inhaber · Planung & Beratung",
    phone: "+43 676 75 32 300",
    phoneHref: "tel:+436767532300",
  },
  andrea: {
    name: "Andrea Hueter",
    role: "Beratung & Organisation",
    phone: "+43 676 75 32 301",
    phoneHref: "tel:+436767532301",
  },
};

/** Einzugsgebiet (real, konservativ – oberes Drautal / Oberkärnten / Osttirol) */
export const serviceArea = [
  "Irschen",
  "Oberdrauburg",
  "Greifenburg",
  "Berg im Drautal",
  "Dellach im Drautal",
  "Spittal an der Drau",
  "Lienz",
  "Osttirol",
  "Oberkärnten",
] as const;

/* ---------------------------------------------------------------------------
 *  SORTIMENT
 * ------------------------------------------------------------------------- */
export type Hue = "clay" | "sage" | "dusk" | "wood" | "stone" | "water" | "warm";
export type Scene =
  | "kitchen"
  | "living"
  | "bedroom"
  | "dining"
  | "hall"
  | "bath"
  | "room"
  | "portrait";

export interface Category {
  slug: string;
  nav: string;
  title: string;
  kicker: string;
  lead: string;
  hue: Hue;
  scene: Scene;
  intro: string;
  offers: string[];
  note: string;
  brands: string[];
  /** Sortiment noch nicht final bestätigt → Hinweis statt Behauptung. */
  tentative?: boolean;
}

export const categories: Category[] = [
  {
    slug: "kuechen",
    nav: "Küchen",
    title: "Küchen",
    kicker: "Der Raum, in dem Ihr Zuhause zusammenkommt",
    lead: "Eine Küche, die zu Ihrem Alltag passt – exakt aufgemessen, individuell geplant und fachgerecht montiert.",
    hue: "clay",
    scene: "kitchen",
    intro:
      "Die Küche ist der Raum, in dem Ihr Zuhause zusammenkommt. Wir planen sie so, dass sie zu Ihrem Alltag passt – von den Wegen beim Kochen bis zur letzten Steckdose. Präzises Aufmaß, durchdachte Stauraumlösungen und hochwertige Geräte sorgen dafür, dass alles seinen Platz hat.",
    offers: [
      "Individuelle Küchenplanung mit Visualisierung",
      "Präzises Aufmaß vor Ort",
      "Hochwertige Elektrogeräte und Spülen namhafter Marken",
      "Arbeitsflächen, Fronten und Griffe nach Ihrem Geschmack",
      "Fachgerechte Lieferung und Montage",
      "Anschluss und saubere Übergabe",
    ],
    note: "Von der kompakten Küche bis zur offenen Wohnküche – wir stimmen jede Lösung auf Ihren Raum, Ihr Budget und Ihre Gewohnheiten ab.",
    brands: ["ewe", "FM Küchen", "Siemens", "Blanco"],
  },
  {
    slug: "wohnen",
    nav: "Wohnen",
    title: "Wohnen",
    kicker: "Zum Ankommen, Durchatmen und Beisammensein",
    lead: "Sofas, Wohnwände und Beleuchtung, die Ihren Wohnraum warm, wohnlich und ganz persönlich machen.",
    hue: "sage",
    scene: "living",
    intro:
      "Ihr Wohnraum ist der Ort zum Ankommen, Durchatmen und Beisammensein. Wir gestalten ihn warm und wohnlich – mit Sofas, die zum Verweilen einladen, Wohnwänden mit klugem Stauraum und einer Beleuchtung, die Stimmung macht.",
    offers: [
      "Polster- und Sitzmöbel in vielen Stoffen und Ledern",
      "Wohnwände und Sideboards mit durchdachtem Stauraum",
      "Beleuchtungskonzepte für jede Tageszeit",
      "Teppiche, Vorhänge und Wohnaccessoires",
      "Farb- und Materialberatung",
      "Aufeinander abgestimmte Gesamtgestaltung",
    ],
    note: "Ob gemütlich oder klar und modern – wir finden den Stil, der zu Ihnen passt, und richten den Raum stimmig ein.",
    brands: ["Koinor", "Rauchenzauner", "JAB Anstoetz", "Fine"],
  },
  {
    slug: "schlafen",
    nav: "Schlafen",
    title: "Schlafen",
    kicker: "Erholung beginnt mit dem richtigen Bett",
    lead: "Betten, Schränke und Schlafsysteme, individuell auf Ihren Schlaf und Ihren Raum abgestimmt.",
    hue: "dusk",
    scene: "bedroom",
    intro:
      "Erholung beginnt mit dem richtigen Bett. Wir beraten Sie zu Schlafsystemen, Matratzen und Schränken, die zu Ihrem Schlaf und Ihrem Raum passen – für Nächte, in denen Sie wirklich zur Ruhe kommen.",
    offers: [
      "Betten in vielen Größen, Höhen und Materialien",
      "Schlafsysteme, Matratzen und Zubehör",
      "Kleiderschränke – auch nach Maß geplant",
      "Naturmaterialien und Massivholz auf Wunsch",
      "Persönliche Beratung zu gesundem Schlaf",
      "Lieferung und Montage inklusive",
    ],
    note: "Gerade beim Schlafzimmer lohnt sich die persönliche Beratung – jeder Mensch schläft anders. Wir nehmen uns die Zeit dafür.",
    brands: ["ADA Austria", "elastica", "Schösswender", "ANREI"],
  },
  {
    slug: "essen",
    nav: "Essen",
    title: "Essen",
    kicker: "Der Tisch, an dem man gerne zusammensitzt",
    lead: "Esstische, Stühle und Bänke aus hochwertigen Materialien – gemacht für viele gemeinsame Stunden.",
    hue: "wood",
    scene: "dining",
    intro:
      "Der Esstisch ist der Ort, an dem man gerne zusammensitzt. Wir richten Ihren Essbereich mit langlebigen Tischen, bequemen Stühlen und Bänken ein – gemacht für viele gemeinsame Stunden.",
    offers: [
      "Esstische aus Massivholz und anderen Materialien",
      "Stühle, Bänke und Sitzgruppen",
      "Passende Beleuchtung über dem Tisch",
      "Sideboards und Vitrinen zum Ensemble",
      "Ausziehbare Lösungen für Gäste",
      "Abstimmung auf Ihren Wohn- und Küchenbereich",
    ],
    note: "Wir achten darauf, dass Essbereich, Küche und Wohnraum zusammenpassen – für ein stimmiges Gesamtbild.",
    brands: ["ANREI", "Schösswender", "Satler"],
  },
  {
    slug: "vorzimmer",
    nav: "Vorzimmer",
    title: "Vorzimmer",
    kicker: "Der erste Eindruck Ihres Zuhauses",
    lead: "Garderoben und Stauraumlösungen, die Ordnung schaffen und schön aussehen – oft nach Maß gefertigt.",
    hue: "stone",
    scene: "hall",
    intro:
      "Das Vorzimmer ist der erste Eindruck Ihres Zuhauses – und oft der Raum, in dem Ordnung am meisten zählt. Wir schaffen Garderoben und Stauraumlösungen, die gut aussehen und den Alltag leichter machen.",
    offers: [
      "Garderoben – häufig nach Maß gefertigt",
      "Schuh- und Stauraumlösungen",
      "Sitzgelegenheiten und Spiegel",
      "Passende Beleuchtung für den Eingangsbereich",
      "Nutzung auch schwieriger Grundrisse",
      "Abstimmung auf den Wohnstil des Hauses",
    ],
    note: "Gerade enge oder verwinkelte Vorzimmer lassen sich mit einer Maßplanung optimal nutzen. Sprechen Sie uns an.",
    brands: ["Sangiacomo", "ANREI"],
  },
  {
    slug: "bad",
    nav: "Bad",
    title: "Bad",
    kicker: "Wohnliche Bäder statt kühler Nasszellen",
    lead: "Badmöbel und Ausstattung, die Funktion und Wohlgefühl verbinden – abgestimmt auf Ihren Raum.",
    hue: "water",
    scene: "bath",
    intro:
      "Ein Bad darf mehr sein als eine Nasszelle. Wir bringen Wohnlichkeit ins Badezimmer – mit Badmöbeln und Ausstattung, die Funktion und Wohlgefühl verbinden und auf Ihren Raum abgestimmt sind.",
    offers: [
      "Badmöbel und Waschtischlösungen",
      "Stauraum, der Ordnung schafft",
      "Warme Materialien und Oberflächen",
      "Passende Beleuchtung und Spiegel",
      "Abstimmung auf vorhandene Sanitärobjekte",
      "Persönliche Planung nach Aufmaß",
    ],
    note: "Der Umfang unseres Bad-Sortiments wird laufend erweitert. Fragen Sie uns nach den aktuellen Möglichkeiten für Ihr Projekt.",
    brands: [],
    tentative: true,
  },
];

export const getCategory = (slug: string) =>
  categories.find((c) => c.slug === slug);

/* ---------------------------------------------------------------------------
 *  MARKEN (verifiziert). TODO: Vollständigkeit mit Familie Hueter abgleichen.
 * ------------------------------------------------------------------------- */
export interface Brand {
  name: string;
  note: string;
}
export const brands: Brand[] = [
  { name: "ewe", note: "Küchen" },
  { name: "FM Küchen", note: "Küchen" },
  { name: "Siemens", note: "Küchengeräte" },
  { name: "Blanco", note: "Spülen & Armaturen" },
  { name: "Koinor", note: "Polstermöbel" },
  { name: "ADA Austria", note: "Polster & Schlafen" },
  { name: "elastica", note: "Schlafsysteme" },
  { name: "ANREI", note: "Massivholzmöbel" },
  { name: "Schösswender", note: "Massivholz & Schlafen" },
  { name: "Rauchenzauner", note: "Polstermöbel" },
  { name: "JAB Anstoetz", note: "Textilien & Vorhänge" },
  { name: "Fine", note: "Wohnaccessoires" },
  { name: "Sangiacomo", note: "Wohn- & Vorzimmermöbel" },
  { name: "Satler", note: "Einrichtung" },
  { name: "Woodbase", note: "Bodenbeläge" },
];

/* ---------------------------------------------------------------------------
 *  ABLAUF / PROZESS
 * ------------------------------------------------------------------------- */
export interface Step {
  n: string;
  title: string;
  text: string;
}
export const processSteps: Step[] = [
  { n: "01", title: "Persönliches Erstgespräch", text: "Wir hören zu: Wie leben Sie, was wünschen Sie sich, was soll bleiben? Ohne Zeitdruck, ganz persönlich." },
  { n: "02", title: "Beratung & Bedarfsermittlung", text: "Wir kommen zu Ihnen, messen präzise auf und erfassen die baulichen Gegebenheiten Ihrer Räume." },
  { n: "03", title: "Individuelle Planung", text: "Sie erhalten eine maßgeschneiderte Planung mit Visualisierung – abgestimmt auf Ihren Raum und Ihr Budget." },
  { n: "04", title: "Material- & Produktauswahl", text: "Gemeinsam wählen wir Materialien, Oberflächen, Farben und Geräte aus – zum Angreifen und Vergleichen." },
  { n: "05", title: "Lieferung", text: "Wir liefern termingerecht und behandeln Ihre neue Einrichtung mit Sorgfalt – bis in den Raum hinein." },
  { n: "06", title: "Fachgerechte Montage", text: "Unsere Montage erfolgt sauber, präzise und zuverlässig. Erst wenn alles passt, sind wir fertig." },
  { n: "07", title: "Persönliche Betreuung", text: "Auch danach sind wir für Sie da – ein Ansprechpartner, der bleibt. Auf Wunsch mit Urlaubs-Aufbauservice." },
];

/* ---------------------------------------------------------------------------
 *  VORTEILE (Vertrauensbereich)
 * ------------------------------------------------------------------------- */
export interface Advantage {
  icon: "chat" | "ruler" | "truck" | "heart";
  title: string;
  text: string;
}
export const advantages: Advantage[] = [
  { icon: "chat", title: "Persönliche Beratung", text: "Kein anonymer Möbelkauf. Sie sprechen mit den Menschen, die Ihr Projekt auch umsetzen." },
  { icon: "ruler", title: "Individuelle Planung", text: "Aufgemessen, durchdacht und auf Ihren Raum zugeschnitten – nicht von der Stange." },
  { icon: "truck", title: "Lieferung & Montage", text: "Fachgerechte Lieferung und saubere Montage aus einer Hand. Wir lassen Sie nicht allein." },
  { icon: "heart", title: "Ein Ansprechpartner", text: "Von der ersten Idee bis zur Nachbetreuung begleitet Sie dieselbe vertraute Familie." },
];

/* ---------------------------------------------------------------------------
 *  NAVIGATION
 * ------------------------------------------------------------------------- */
export interface NavItem {
  href: string;
  label: string;
}
export const mainNav: NavItem[] = [
  ...categories.map((c) => ({ href: `/${c.slug}`, label: c.nav })),
  { href: "/planung-service", label: "Planung & Service" },
  { href: "/projekte", label: "Projekte" },
  { href: "/marken", label: "Marken" },
  { href: "/ueber-uns", label: "Über uns" },
];
export const contactNav: NavItem = { href: "/kontakt", label: "Kontakt" };

export const legalNav: NavItem[] = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/barrierefreiheit", label: "Barrierefreiheit" },
];

/** Kontaktformular: Auswahl Einrichtungsbereich */
export const contactAreas = [
  "Küche",
  "Wohnen",
  "Essen",
  "Schlafen",
  "Vorzimmer",
  "Bad",
  "Mehrere Räume",
  "Allgemeine Beratung",
] as const;

/** Terminanfrage: bevorzugter Tag / Zeitfenster (keine Echtzeitbuchung). */
export const preferredDays = ["Werktags (Mo–Fr)", "Wochenende", "Flexibel"] as const;
export const preferredTimes = ["Vormittag", "Nachmittag", "Abend", "Flexibel"] as const;

/* ---------------------------------------------------------------------------
 *  PROJEKTE / REFERENZEN
 *  TODO: Durch echte Projekte ersetzen. KEINE erfundenen Kunden/Details.
 *  `placeholder: true` kennzeichnet Beispiel-Einträge eindeutig.
 * ------------------------------------------------------------------------- */
export interface ProjectImage {
  src: string;
  alt: string;
  caption?: string;
}
export interface Project {
  slug: string;
  title: string;
  /** Raumkategorie (Anzeige) */
  tag: string;
  /** zugehörige Wohnwelt (interne Verlinkung & Bildquelle) */
  category?: string;
  summary: string;
  hue: Hue;
  scene: Scene;
  chips: string[];
  /** true = Beispiel-Eintrag ohne echte Projektdaten */
  placeholder: boolean;
  /** in Ausgabe/Übersicht anzeigen */
  published: boolean;
  /** Sortierreihenfolge (kleiner = weiter vorne) */
  order: number;
  /** nur wenn öffentlich & bestätigt */
  location?: string;
  services?: string[];
  materials?: string[];
  highlights?: string[];
  /* Erzählabschnitte – wenn leer, blendet die Detailseite sie aus */
  situation?: string;
  wishes?: string;
  planningIdea?: string;
  result?: string;
  /** Galerie; wenn leer, baut die Detailseite Platzhalter aus der Wohnwelt */
  gallery?: ProjectImage[];
  /** verwandte Projekte (Slugs) */
  related?: string[];
}

/**
 * TODO: Durch echte Projekte ersetzen. KEINE erfundenen Kunden/Orte/Details.
 * Alle Einträge sind mit `placeholder: true` klar als Beispiele gekennzeichnet;
 * Erzählabschnitte (situation/wishes/…) sind bewusst leer und werden auf der
 * Detailseite automatisch ausgeblendet.
 */
export const projects: Project[] = [
  { slug: "kueche-drautal", title: "Wohnküche, individuell geplant", tag: "Küche", category: "kuechen", summary: "Individuell geplante Küche mit fachgerechter Montage.", hue: "clay", scene: "kitchen", chips: ["Aufmaß vor Ort", "Individuelle Planung", "Montage"], placeholder: true, published: true, order: 1, related: ["essbereich", "wohnraum"] },
  { slug: "wohnraum", title: "Wohnraum neu gedacht", tag: "Wohnen", category: "wohnen", summary: "Wohnliche Gestaltung aus einer Hand.", hue: "sage", scene: "living", chips: ["Polstermöbel", "Beleuchtung", "Textilien"], placeholder: true, published: true, order: 2, related: ["essbereich", "schlafzimmer"] },
  { slug: "schlafzimmer", title: "Ruhiges Schlafzimmer", tag: "Schlafen", category: "schlafen", summary: "Aufeinander abgestimmte Schlafzimmereinrichtung.", hue: "dusk", scene: "bedroom", chips: ["Schlafsystem", "Schrank nach Maß"], placeholder: true, published: true, order: 3, related: ["garderobe", "wohnraum"] },
  { slug: "essbereich", title: "Essbereich aus Massivholz", tag: "Essen", category: "essen", summary: "Tisch und Stühle für viele gemeinsame Stunden.", hue: "wood", scene: "dining", chips: ["Massivholz", "Sitzgruppe"], placeholder: true, published: true, order: 4, related: ["kueche-drautal", "wohnraum"] },
  { slug: "garderobe", title: "Garderobe nach Maß", tag: "Vorzimmer", category: "vorzimmer", summary: "Stauraumlösung für einen verwinkelten Grundriss.", hue: "stone", scene: "hall", chips: ["Maßanfertigung", "Stauraum"], placeholder: true, published: true, order: 5, related: ["wohnraum", "schlafzimmer"] },
  { slug: "gesamtprojekt", title: "Einrichtung aus einer Hand", tag: "Gesamtkonzept", category: "wohnen", summary: "Mehrere Räume aufeinander abgestimmt geplant.", hue: "warm", scene: "room", chips: ["Mehrere Räume", "Gesamtkonzept"], placeholder: true, published: true, order: 6, related: ["kueche-drautal", "schlafzimmer"] },
];
export const publishedProjects = () =>
  projects.filter((p) => p.published).sort((a, b) => a.order - b.order);
export const getProject = (slug: string) => projects.find((p) => p.slug === slug);

/* ---------------------------------------------------------------------------
 *  SERVICELEISTUNGEN (Planung & Service)
 * ------------------------------------------------------------------------- */
export const services: { title: string; text: string }[] = [
  { title: "Persönliche Beratung & Wohnraumplanung", text: "Zugeschnitten auf Ihre Räume und Wünsche – ehrlich und ohne Verkaufsdruck." },
  { title: "Aufmaß vor Ort", text: "Präzise Grundlage für eine passgenaue Planung, direkt bei Ihnen zu Hause." },
  { title: "Lieferung & fachgerechte Montage", text: "Sauber, termingerecht und zuverlässig – bis alles an seinem Platz ist." },
  { title: "Persönliche Nachbetreuung", text: "Ein Ansprechpartner, der auch nach der Montage für Sie da ist." },
  { title: "Urlaubs-Aufbauservice", text: "Auf Wunsch richten wir ein, während Sie unterwegs sind." },
];

/**
 * Detaillierter Planungsablauf (Planung & Service).
 * `expect` = was Kundinnen und Kunden im Schritt erwartet.
 * `prep`   = optionaler, hilfreicher Vorbereitungshinweis (keine Voraussetzung).
 */
export interface FlowStep {
  n: string;
  title: string;
  text: string;
  expect: string;
  prep?: string;
}
export const planningFlow: FlowStep[] = [
  { n: "01", title: "Erstgespräch", text: "Wir lernen uns kennen und sprechen über Ihr Vorhaben – unverbindlich und in Ruhe.", expect: "Ein offenes Gespräch ohne Verkaufsdruck.", prep: "Erste Ideen oder Inspirationsbilder, falls vorhanden." },
  { n: "02", title: "Wünsche & Raumsituation erfassen", text: "Wie leben Sie, was soll der Raum können, was stört heute? Das halten wir gemeinsam fest.", expect: "Wir hören zu und stellen die richtigen Fragen.", prep: "Fotos des Raums helfen beim Einstieg." },
  { n: "03", title: "Aufmaß & Grundlagen", text: "Wir messen vor Ort präzise auf und prüfen die baulichen Gegebenheiten und Anschlüsse.", expect: "Einen Termin bei Ihnen zu Hause.", prep: "Zugang zum Raum und Infos zu vorhandenen Anschlüssen." },
  { n: "04", title: "Planung & Entwurf", text: "Aus allen Informationen entwickeln wir eine maßgeschneiderte Planung mit Visualisierung.", expect: "Einen konkreten Entwurf zum Ansehen und Besprechen." },
  { n: "05", title: "Materialien & Ausstattung", text: "Gemeinsam wählen wir Oberflächen, Farben, Fronten und Geräte aus – zum Angreifen und Vergleichen.", expect: "Zeit, in Ruhe zu vergleichen und zu entscheiden." },
  { n: "06", title: "Angebot & Abstimmung", text: "Sie erhalten ein nachvollziehbares Angebot. Änderungswünsche arbeiten wir ein, bis alles passt.", expect: "Klarheit über Umfang und Ablauf." },
  { n: "07", title: "Lieferung & Montage", text: "Wir liefern termingerecht und montieren sauber und fachgerecht – bis alles an seinem Platz ist.", expect: "Eine zuverlässige, ordentliche Umsetzung." },
  { n: "08", title: "Übergabe & Betreuung", text: "Zum Abschluss übergeben wir Ihre fertige Einrichtung. Auch danach bleiben wir Ihr Ansprechpartner.", expect: "Eine saubere Übergabe – und jemanden, der erreichbar bleibt." },
];

/** „Gut vorbereitet zum Beratungsgespräch“ – Unterstützung, keine Voraussetzung. */
export const preparation: { title: string; text: string }[] = [
  { title: "Raummaße oder Grundriss", text: "Wenn vorhanden – wir messen später ohnehin genau auf." },
  { title: "Fotos des Raums", text: "Ein paar Handyfotos genügen, um sich ein Bild zu machen." },
  { title: "Wünsche & Inspiration", text: "Bilder, Ausschnitte oder Notizen zu dem, was Ihnen gefällt." },
  { title: "Budgetvorstellung", text: "Ein grober Rahmen hilft, passende Lösungen vorzuschlagen." },
  { title: "Vorhandene Anschlüsse", text: "Infos zu Strom, Wasser oder Geräten, die bleiben sollen." },
  { title: "Zeitrahmen", text: "Wann die Einrichtung fertig sein soll – falls es einen Anlass gibt." },
];

/** Häufige Fragen (allgemein & ehrlich beantwortbar, keine erfundenen Fakten). */
export const faqs: { q: string; a: string }[] = [
  { q: "Wie läuft ein erstes Beratungsgespräch ab?", a: "Wir hören zunächst zu: Wie Sie leben, was Sie sich wünschen und was der Raum können soll. Daraus entsteht Schritt für Schritt eine Planung. Das Erstgespräch ist unverbindlich." },
  { q: "Muss ich schon genaue Vorstellungen haben?", a: "Nein. Viele kommen mit einer groben Idee – manchmal auch nur mit einem Problem, das gelöst werden soll. Wir entwickeln die Details gemeinsam mit Ihnen." },
  { q: "Welche Unterlagen soll ich mitbringen?", a: "Hilfreich sind Fotos des Raums, grobe Maße oder ein Grundriss und Inspirationsbilder. Nötig ist das aber nicht – wir messen später ohnehin präzise vor Ort auf." },
  { q: "Werden auch einzelne Räume geplant?", a: "Ja. Ob eine einzelne Küche oder mehrere Räume aus einer Hand – beides ist möglich. Sie entscheiden, wie viel wir gemeinsam gestalten." },
  { q: "Kommen Sie für das Aufmaß zu mir nach Hause?", a: "Ja. Für eine passgenaue Planung messen wir gerne direkt bei Ihnen vor Ort auf und sehen uns die räumlichen Gegebenheiten an." },
  { q: "Sind Lieferung und Montage möglich?", a: "Ja. Lieferung und fachgerechte Montage gehören für uns dazu – Sie haben einen Ansprechpartner für das ganze Projekt." },
  { q: "Wie lange dauert eine Planung?", a: "Das hängt vom Umfang und von der Materialverfügbarkeit ab und lässt sich pauschal nicht sagen. Wir besprechen einen realistischen Zeitrahmen im persönlichen Gespräch." },
  { q: "Wie vereinbare ich einen Beratungstermin?", a: "Am einfachsten telefonisch oder über das Kontaktformular. Wir melden uns persönlich und finden gemeinsam einen passenden Termin – gerne auch außerhalb üblicher Geschäftszeiten." },
];
