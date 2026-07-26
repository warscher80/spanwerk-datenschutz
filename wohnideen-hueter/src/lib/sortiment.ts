/**
 * =============================================================================
 *  SORTIMENT-INHALTE — je Bereich eigenständige Texte & Bausteine
 * =============================================================================
 *  Bewusst pro Bereich unterschiedlich formuliert (keine identischen Seiten).
 *  Enthält KEINE erfundenen Produkte, Marken oder Preise. Materialangaben sind
 *  allgemeine Material-Familien zur Orientierung – konkrete Auswahl erfolgt im
 *  Beratungsgespräch (siehe Hinweis je Seite).
 * =============================================================================
 */

export interface SortimentFeature {
  title: string;
  text: string;
}
export interface Material {
  label: string;
  /** rein illustrative Farbfläche (keine Produktzusage) */
  swatch: string;
}
export interface CrossLink {
  href: string;
  label: string;
  text: string;
}
export interface SortimentContent {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  heroEyebrow: string;
  /** kurze emotionale Einführung */
  introTitle: string;
  introParas: string[];
  /** konkrete Planungsmöglichkeiten */
  planningTitle: string;
  planningLead: string;
  planningPoints: string[];
  /** Funktionen / Lösungen */
  featuresEyebrow: string;
  featuresTitle: string;
  features: SortimentFeature[];
  /** Materialien / Gestaltung */
  materialsTitle: string;
  materialsLead: string;
  materials: Material[];
  /** optionale Bildband-Aussage */
  moodStatement?: string;
  /** Beratungs-/Servicehinweis */
  serviceTitle: string;
  serviceText: string;
  /** interne Verlinkung (konkrete Linktexte) */
  crossTitle: string;
  crossLinks: CrossLink[];
  /** Abschluss-CTA */
  ctaTitle: string;
  ctaLead: string;
  /** passende Referenz */
  projectSlug: string;
  /** Bad: Sortiment im Aufbau → ehrlicher Hinweis */
  scopeNote?: string;
}

const LINK_PLANUNG: CrossLink = {
  href: "/planung-service",
  label: "Planung & Service ansehen",
  text: "Aufmaß, Planung, Lieferung und Montage – so begleiten wir Ihr Projekt.",
};
const LINK_PROJEKTE: CrossLink = {
  href: "/projekte",
  label: "Projekte entdecken",
  text: "Ein Einblick in umgesetzte Einrichtungen aus dem Drautal.",
};

export const sortiment: Record<string, SortimentContent> = {
  /* ------------------------------------------------------------------ KÜCHEN */
  kuechen: {
    slug: "kuechen",
    metaTitle: "Küchen individuell geplant – Wohnküchen aus Irschen",
    metaDescription:
      "Individuelle Küchenplanung im oberen Drautal: Ergonomie, Stauraum, Arbeitsflächen, Geräte und Beleuchtung – aufeinander abgestimmt, geliefert und fachgerecht montiert.",
    heroEyebrow: "Der Raum, in dem Ihr Zuhause zusammenkommt",
    introTitle: "Küchen, die zu Ihrem Alltag passen",
    introParas: [
      "Kochen, arbeiten, reden, zusammensitzen – in kaum einem Raum passiert so viel wie in der Küche. Deshalb planen wir sie nicht nach Katalog, sondern nach Ihrem Alltag.",
      "Wir verbinden Gestaltung und Funktion so, dass Wege kurz, Flächen sinnvoll und jedes Detail durchdacht sind. Damit die Küche nicht nur schön aussieht, sondern sich jeden Tag gut bedienen lässt.",
    ],
    planningTitle: "Planung beginnt bei Ihren Gewohnheiten",
    planningLead:
      "Bevor wir Fronten und Farben wählen, sehen wir uns an, wie Sie kochen und leben. Daraus entsteht ein Grundriss, der wirklich funktioniert.",
    planningPoints: [
      "Präzises Aufmaß und Prüfung der baulichen Anschlüsse vor Ort",
      "Ergonomische Anordnung von Kochen, Spülen und Vorbereiten",
      "Durchdachte Zonen für Vorräte, Geschirr und Geräte",
      "Planung mit Visualisierung – abgestimmt auf Raum und Budget",
      "Berücksichtigung von Licht, Steckdosen und Belüftung",
    ],
    featuresEyebrow: "Funktion im Detail",
    featuresTitle: "Was eine Küche im Alltag ausmacht",
    features: [
      { title: "Ergonomische Planung", text: "Arbeitshöhen und Wege so abgestimmt, dass Ihnen die Küche entgegenkommt – nicht umgekehrt." },
      { title: "Stauraum mit System", text: "Auszüge, Ecklösungen und Innenausstattung, damit alles seinen festen Platz hat." },
      { title: "Arbeitsflächen", text: "Robuste, pflegeleichte Oberflächen mit genügend Platz zum Vorbereiten." },
      { title: "Geräte sinnvoll integrieren", text: "Backofen, Kühlung und Dunstabzug dort, wo sie den Ablauf unterstützen." },
      { title: "Beleuchtung", text: "Blendfreies Licht über Arbeitsflächen und stimmungsvolles Licht für den Raum." },
      { title: "Lieferung & Montage", text: "Saubere, fachgerechte Montage und Anschluss – bis zur ordentlichen Übergabe." },
    ],
    materialsTitle: "Stilrichtungen und Materialien",
    materialsLead:
      "Ob klar und modern oder warm und natürlich – die Wirkung entsteht aus Fronten, Oberflächen und Griffen. Diese Material-Familien sind ein erster Anhaltspunkt.",
    materials: [
      { label: "Matte Lackfronten", swatch: "#e7e1d6" },
      { label: "Echtholz & Furnier", swatch: "#b98f63" },
      { label: "Naturstein-Optik", swatch: "#cfc9bd" },
      { label: "Glas", swatch: "#d7e0e0" },
      { label: "Metallgriffe", swatch: "#9a958c" },
    ],
    serviceTitle: "Von der Idee bis zur fertigen Küche",
    serviceText:
      "Sie haben einen Ansprechpartner für das ganze Projekt: Beratung, Aufmaß, Planung, Lieferung und Montage – ohne Schnittstellen, ohne Weiterreichen.",
    crossTitle: "Passt gut zusammen",
    crossLinks: [
      { href: "/essen", label: "Esstische & Stühle ansehen", text: "Der Essbereich schließt an die Küche an – wir stimmen beides aufeinander ab." },
      { href: "/wohnen", label: "Offenen Übergang zum Wohnraum planen", text: "Küche und Wohnen als durchgängiges Konzept, wenn der Grundriss offen ist." },
      LINK_PLANUNG,
    ],
    ctaTitle: "Planen wir gemeinsam Ihre neue Küche.",
    ctaLead:
      "Erzählen Sie uns, wie Sie kochen und leben – wir entwickeln daraus eine Küche, die genau dazu passt.",
    projectSlug: "kueche-drautal",
  },

  /* ------------------------------------------------------------------ WOHNEN */
  wohnen: {
    slug: "wohnen",
    metaTitle: "Wohnen – Wohnräume zum Ankommen",
    metaDescription:
      "Wohnräume, die zum Ankommen und Beisammensein einladen: Sofas, Wohnwände, Stauraum und Beleuchtung – warm, wohnlich und individuell geplant im oberen Drautal.",
    heroEyebrow: "Zum Ankommen, Durchatmen und Beisammensein",
    introTitle: "Der Raum, in dem Ihr Zuhause zur Ruhe kommt",
    introParas: [
      "Der Wohnraum ist der Ort, an dem der Tag ausklingt und die Familie zusammenkommt. Er darf gemütlich sein und trotzdem Ordnung halten.",
      "Wir gestalten ihn so, dass Komfort und Gestaltung zusammengehen – mit Möbeln zum Wohlfühlen und Lösungen, die den Alltag leichter machen.",
    ],
    planningTitle: "Ein Wohnraum, der zusammenpasst",
    planningLead:
      "Damit ein Raum wirkt, müssen die Teile aufeinander abgestimmt sein. Wir denken Sofa, Wohnwand, Licht und Textilien von Anfang an gemeinsam.",
    planningPoints: [
      "Raumaufteilung mit Blick auf Licht, Wege und Blickachsen",
      "Sitzmöbel passend zu Raumgröße und Sitzgewohnheiten",
      "Wohnwände und Sideboards mit sichtbarem und verborgenem Stauraum",
      "Medienbereiche unauffällig integriert",
      "Farben, Stoffe und Beleuchtung als stimmiges Ganzes",
    ],
    featuresEyebrow: "Lösungen für den Wohnraum",
    featuresTitle: "Komfort und Gestaltung, die zusammengehören",
    features: [
      { title: "Wohnwände nach Maß", text: "Passgenau für Ihre Wand – mit Stauraum, der Ordnung hält und gut aussieht." },
      { title: "Sitzmöbel", text: "Sofas und Sessel in vielen Stoffen und Ledern, abgestimmt auf Komfort und Raum." },
      { title: "Medienbereiche", text: "Fernseher, Geräte und Kabel sauber integriert statt sichtbar verteilt." },
      { title: "Stauraum", text: "Sideboards und Regale, die zeigen, was schön ist, und verbergen, was stört." },
      { title: "Offene Wohnkonzepte", text: "Fließende Übergänge zwischen Wohnen, Essen und Küche – klar gegliedert." },
      { title: "Licht & Textilien", text: "Vorhänge, Teppiche und Leuchten, die Wärme und Ruhe in den Raum bringen." },
    ],
    materialsTitle: "Warme Materialien, ruhige Töne",
    materialsLead:
      "Wohnlichkeit entsteht aus dem Zusammenspiel von Holz, Textil und Licht. Diese Familien geben eine erste Richtung.",
    materials: [
      { label: "Massivholz", swatch: "#b98f63" },
      { label: "Polster & Textil", swatch: "#c9b79e" },
      { label: "Warme Naturtöne", swatch: "#d8c5ae" },
      { label: "Glas & Metall", swatch: "#a9a59c" },
    ],
    moodStatement:
      "Ein Wohnraum sollte sich anfühlen wie ein tiefes Durchatmen nach einem langen Tag.",
    serviceTitle: "Aus einer Hand geplant",
    serviceText:
      "Wir richten den ganzen Raum ein – aufeinander abgestimmt, geliefert und montiert. So entsteht ein stimmiges Bild statt einzelner Möbelstücke.",
    crossTitle: "Weiterdenken",
    crossLinks: [
      { href: "/essen", label: "Essbereich anschließen", text: "Wohnen und Essen gehen oft ineinander über – wir planen den Übergang mit." },
      { href: "/vorzimmer", label: "Vorzimmer passend gestalten", text: "Der erste Raum stimmt auf den Wohnstil des ganzen Hauses ein." },
      LINK_PROJEKTE,
    ],
    ctaTitle: "Machen wir aus Ihrem Wohnraum einen Ort, der wirklich zu Ihnen passt.",
    ctaLead:
      "Erzählen Sie uns, wie Sie wohnen möchten – wir bringen Komfort, Stauraum und Gestaltung zusammen.",
    projectSlug: "wohnraum",
  },

  /* ------------------------------------------------------------------- ESSEN */
  essen: {
    slug: "essen",
    metaTitle: "Essen – Esstische, Stühle & Bänke",
    metaDescription:
      "Der Essbereich als Ort für Alltag und Zusammensein: Esstische, Stühle, Bänke und Beleuchtung – hochwertig, langlebig und passend zu Küche und Wohnraum.",
    heroEyebrow: "Der Tisch, an dem man gerne zusammensitzt",
    introTitle: "Wo der Tag zusammenkommt",
    introParas: [
      "Am Esstisch wird gefrühstückt, gearbeitet, gefeiert und geredet. Er ist mehr als ein Möbelstück – er ist ein Treffpunkt.",
      "Wir planen den Essbereich so, dass er zum täglichen Miteinander einlädt und auch dann funktioniert, wenn unerwartet Gäste kommen.",
    ],
    planningTitle: "Der richtige Platz für jeden Anlass",
    planningLead:
      "Wie viele sitzen täglich am Tisch, wie viele an Feiertagen? Aus dieser Frage ergeben sich Größe, Form und Flexibilität.",
    planningPoints: [
      "Tischgröße passend zu Raum und Personenzahl",
      "Ausreichend Bewegungsfläche rund um den Tisch",
      "Ausziehbare oder erweiterbare Lösungen für Gäste",
      "Stühle und Bänke, die bequem und alltagstauglich sind",
      "Licht, das den Tisch in den Mittelpunkt rückt",
    ],
    featuresEyebrow: "Rund um den Tisch",
    featuresTitle: "Alles, was zum Zusammensitzen gehört",
    features: [
      { title: "Der richtige Tisch", text: "In Massivholz oder anderen Materialien, in der Größe und Form, die zu Ihrem Raum passt." },
      { title: "Stühle & Bänke", text: "Bequem für lange Abende – als Sitzgruppe oder frei kombiniert." },
      { title: "Licht über dem Tisch", text: "Eine Leuchte, die wärmt und den Essbereich klar zoniert." },
      { title: "Platz für Gäste", text: "Ausziehbare Tische und flexible Sitzlösungen für spontane Runden." },
      { title: "Materialkombinationen", text: "Holz mit Metall, Stoff oder Leder – abgestimmt statt zusammengewürfelt." },
      { title: "Übergang zu Küche & Wohnen", text: "Der Essbereich verbindet die Räume – wir gestalten ihn als Bindeglied." },
    ],
    materialsTitle: "Materialien, die zusammenspielen",
    materialsLead:
      "Ein Esstisch lebt vom Materialmix. Diese Familien lassen sich schön kombinieren.",
    materials: [
      { label: "Massivholz", swatch: "#b0824f" },
      { label: "Furnier", swatch: "#c9a878" },
      { label: "Polster & Leder", swatch: "#b79a7c" },
      { label: "Metallgestelle", swatch: "#8f8b82" },
    ],
    moodStatement:
      "Die schönsten Gespräche entstehen dort, wo man gerne sitzen bleibt.",
    serviceTitle: "Abgestimmt auf Ihre Räume",
    serviceText:
      "Wir wählen den Essbereich passend zu Küche und Wohnraum – damit ein durchgängiges, ruhiges Gesamtbild entsteht.",
    crossTitle: "Passt dazu",
    crossLinks: [
      { href: "/kuechen", label: "Zur Küchenplanung", text: "Küche und Essbereich denken wir als Einheit – kurze Wege inklusive." },
      { href: "/wohnen", label: "Wohnraum gestalten", text: "Offener Übergang vom Essen zum Wohnen für ein großzügiges Raumgefühl." },
      LINK_PROJEKTE,
    ],
    ctaTitle: "Gestalten wir Ihren Essbereich zum Lieblingsplatz.",
    ctaLead:
      "Sagen Sie uns, wie oft und mit wie vielen Sie am Tisch sitzen – wir finden die passende Lösung.",
    projectSlug: "essbereich",
  },

  /* ---------------------------------------------------------------- SCHLAFEN */
  schlafen: {
    slug: "schlafen",
    metaTitle: "Schlafen – Betten, Schränke & Stauraum",
    metaDescription:
      "Schlafzimmer für Ruhe, Ordnung und Komfort: Betten, Kleiderschränke nach Maß, Stauraum und harmonische Farbkonzepte – individuell geplant im oberen Drautal.",
    heroEyebrow: "Erholung beginnt mit dem richtigen Raum",
    introTitle: "Ein Raum, der zur Ruhe kommt",
    introParas: [
      "Das Schlafzimmer ist der persönlichste Raum im Haus. Es darf ruhig, aufgeräumt und ganz auf Erholung ausgerichtet sein.",
      "Wir gestalten es mit weichen Übergängen, harmonischen Farben und Stauraum, der den Alltag ordnet, ohne den Raum zu überladen.",
    ],
    planningTitle: "Ruhe entsteht durch Ordnung",
    planningLead:
      "Ein aufgeräumter Raum beruhigt. Deshalb steht Stauraum bei der Schlafzimmerplanung oft im Mittelpunkt – unsichtbar und großzügig zugleich.",
    planningPoints: [
      "Bett passend zu Raum, Höhe und Schlafgewohnheiten",
      "Kleiderschränke und Ankleiden nach Maß geplant",
      "Stauraum bis unter die Decke, auch in Schrägen und Nischen",
      "Nachtkästchen und Ablagen dort, wo man sie braucht",
      "Ruhige Farb- und Materialkonzepte für einen harmonischen Raum",
    ],
    featuresEyebrow: "Für erholsame Nächte",
    featuresTitle: "Was ein gutes Schlafzimmer ausmacht",
    features: [
      { title: "Betten", text: "In vielen Größen, Höhen und Materialien – abgestimmt auf Ihren Raum." },
      { title: "Kleiderschränke & Ankleiden", text: "Nach Maß geplant, damit jeder Zentimeter sinnvoll genutzt wird." },
      { title: "Stauraum", text: "Durchdachte Innenaufteilung, die Ordnung leicht macht." },
      { title: "Nachtkästchen", text: "Praktische Ablage in der richtigen Höhe, passend zum Bett." },
      { title: "Beleuchtung", text: "Warmes, dimmbares Licht für Entspannung und praktisches Leselicht." },
      { title: "Farb- & Materialkonzepte", text: "Ruhige Töne und natürliche Materialien für ein stimmiges Ganzes." },
    ],
    materialsTitle: "Ruhige Farben, natürliche Materialien",
    materialsLead:
      "Im Schlafzimmer wirken zurückhaltende Töne und warme Materialien am besten. Diese Familien geben die Richtung vor.",
    materials: [
      { label: "Massivholz", swatch: "#bfa07a" },
      { label: "Weiche Textilien", swatch: "#cdbfa9" },
      { label: "Ruhige Farbtöne", swatch: "#d3cabb" },
      { label: "Naturmaterialien", swatch: "#b3a58f" },
    ],
    serviceTitle: "Persönlich beraten",
    serviceText:
      "Gerade beim Schlafzimmer lohnt sich das persönliche Gespräch – jeder Mensch schläft anders. Wir nehmen uns die Zeit dafür.",
    crossTitle: "Mehr Ordnung im Haus",
    crossLinks: [
      { href: "/vorzimmer", label: "Stauraum fürs Vorzimmer", text: "Auch im Eingangsbereich schaffen wir clevere Ordnung nach Maß." },
      { href: "/wohnen", label: "Wohnraum abstimmen", text: "Ruhige Materialien und Farben ziehen sich stimmig durchs ganze Zuhause." },
      LINK_PLANUNG,
    ],
    ctaTitle: "Entdecken Sie Lösungen für mehr Ruhe, Ordnung und Komfort.",
    ctaLead:
      "Erzählen Sie uns von Ihrem Schlafzimmer – wir planen es ruhig, aufgeräumt und ganz auf Erholung ausgerichtet.",
    projectSlug: "schlafzimmer",
  },

  /* --------------------------------------------------------------- VORZIMMER */
  vorzimmer: {
    slug: "vorzimmer",
    metaTitle: "Vorzimmer & Garderobe nach Maß",
    metaDescription:
      "Garderoben und Stauraumlösungen fürs Vorzimmer – auch für kleine, enge oder verwinkelte Eingangsbereiche. Nach Maß geplant für einen guten ersten Eindruck.",
    heroEyebrow: "Der erste Eindruck Ihres Zuhauses",
    introTitle: "Klein, aber entscheidend",
    introParas: [
      "Das Vorzimmer ist der erste Raum, den Gäste sehen – und der Ort, an dem der Alltag ankommt und wieder aufbricht. Hier zählt jede clevere Idee.",
      "Gerade kleine oder verwinkelte Eingangsbereiche gewinnen durch eine Planung nach Maß enorm: mehr Ordnung, mehr Platz, ein besserer erster Eindruck.",
    ],
    planningTitle: "Auch schwierige Grundrisse clever genutzt",
    planningLead:
      "Nischen, Schrägen und schmale Wände sind kein Hindernis, sondern die Grundlage für eine maßgeschneiderte Lösung.",
    planningPoints: [
      "Aufmaß auch für enge und verwinkelte Grundrisse",
      "Garderobe nach Maß statt Möbel von der Stange",
      "Stauraum vom Boden bis zur Decke – Nischen inklusive",
      "Sitzgelegenheit und Ablage für den täglichen Übergang",
      "Robuste Oberflächen, die dem Alltag standhalten",
    ],
    featuresEyebrow: "Clevere Lösungen",
    featuresTitle: "Ordnung auf wenig Raum",
    features: [
      { title: "Garderobe nach Maß", text: "Passgenau für Ihre Wand – für Jacken, Taschen und den täglichen Kram." },
      { title: "Schuhaufbewahrung", text: "Geordnet und griffbereit, ohne dass der Raum voll wirkt." },
      { title: "Sitzen & Ablegen", text: "Eine Bank zum An- und Ausziehen, Ablage für Schlüssel und Post." },
      { title: "Spiegel & Licht", text: "Ein Spiegel weitet den Raum, gutes Licht macht ihn freundlich." },
      { title: "Nischen nutzen", text: "Schrägen und Ecken werden zu wertvollem Stauraum." },
      { title: "Robuste Materialien", text: "Oberflächen, die Feuchtigkeit, Schuhe und Alltag gut vertragen." },
    ],
    materialsTitle: "Robust und trotzdem schön",
    materialsLead:
      "Im Eingangsbereich müssen Oberflächen einiges aushalten. Diese Familien verbinden Widerstandsfähigkeit mit Wohnlichkeit.",
    materials: [
      { label: "Robuste Oberflächen", swatch: "#c2b6a4" },
      { label: "Holztöne", swatch: "#b98f63" },
      { label: "Metall", swatch: "#96928a" },
      { label: "Spiegelglas", swatch: "#cdd6d6" },
    ],
    serviceTitle: "Keine unwichtige Nebensache",
    serviceText:
      "Wir planen das Vorzimmer mit der gleichen Sorgfalt wie jeden anderen Raum – nach Aufmaß, individuell gefertigt und sauber montiert.",
    crossTitle: "Passt zusammen",
    crossLinks: [
      { href: "/wohnen", label: "Wohnstil weiterführen", text: "Das Vorzimmer stimmt auf den Stil des ganzen Hauses ein." },
      { href: "/schlafen", label: "Stauraum fürs Schlafzimmer", text: "Maßgefertigter Stauraum lohnt sich auch im Schlafbereich." },
      LINK_PLANUNG,
    ],
    ctaTitle: "Machen wir aus Ihrem Eingangsbereich einen guten ersten Eindruck.",
    ctaLead:
      "Zeigen Sie uns Ihren Grundriss – auch für kleine und schwierige Vorzimmer finden wir eine clevere Lösung.",
    projectSlug: "garderobe",
  },

  /* --------------------------------------------------------------------- BAD */
  bad: {
    slug: "bad",
    metaTitle: "Bad – Badmöbel & Ausstattung",
    metaDescription:
      "Wohnliche Bäder mit durchdachtem Stauraum: Badmöbel, Waschtischlösungen, Spiegel und Beleuchtung – abgestimmt auf Ihren Raum und feuchtigkeitsgeeignete Materialien.",
    heroEyebrow: "Wohnliche Bäder statt kühler Nasszellen",
    introTitle: "Ein Bad, das wohnlich ist",
    introParas: [
      "Ein Bad darf mehr sein als eine funktionale Nasszelle. Mit den richtigen Möbeln, warmen Materialien und gutem Licht wird es zu einem Raum zum Wohlfühlen.",
      "Wir gestalten Badmöbel und Ausstattung klar und reduziert – mit viel Stauraum und Oberflächen, die für das Bad geeignet sind.",
    ],
    planningTitle: "Klarheit und Stauraum",
    planningLead:
      "Im Bad zählt jeder Zentimeter. Eine gute Planung schafft Ordnung, ohne den Raum zu verstellen.",
    planningPoints: [
      "Aufmaß und Planung passend zu vorhandenen Sanitärobjekten",
      "Waschtisch- und Möbellösungen für Ihren Grundriss",
      "Stauraum, der Ordnung schafft – auch in kleinen Bädern",
      "Spiegel und Beleuchtung für Funktion und Wohnlichkeit",
      "Feuchtigkeitsgeeignete Materialien und Oberflächen",
    ],
    featuresEyebrow: "Durchdachte Lösungen",
    featuresTitle: "Was ein wohnliches Bad ausmacht",
    features: [
      { title: "Badmöbel", text: "Klar gestaltet und auf Ihren Raum abgestimmt – reduziert statt überladen." },
      { title: "Waschtischlösungen", text: "Passend zu Ihrem Waschbecken, mit Stauraum darunter." },
      { title: "Stauraum", text: "Hochschränke und Unterschränke, die Ordnung ins Bad bringen." },
      { title: "Spiegel & Licht", text: "Spiegel mit gutem Licht – für den Alltag und ein weiteres Raumgefühl." },
      { title: "Feuchtigkeitsgeeignete Materialien", text: "Oberflächen, die für die Bedingungen im Bad ausgelegt sind." },
      { title: "Kleine Bäder", text: "Auch auf wenig Fläche holen wir mit Maßplanung das Beste heraus." },
    ],
    materialsTitle: "Materialnah und klar",
    materialsLead:
      "Im Bad verbinden wir warme Töne mit Oberflächen, die Feuchtigkeit vertragen. Diese Familien geben eine erste Orientierung.",
    materials: [
      { label: "Feuchtigkeitsgeeignete Fronten", swatch: "#cbc6bd" },
      { label: "Warme Holztöne", swatch: "#b98f63" },
      { label: "Stein-Optik", swatch: "#bdb8ae" },
      { label: "Glas", swatch: "#cdd8d8" },
    ],
    serviceTitle: "Abgestimmt geplant",
    serviceText:
      "Wir planen Badmöbel und Ausstattung passend zu Ihren vorhandenen Sanitärobjekten und montieren fachgerecht.",
    // Ehrlicher Hinweis: Umfang offen, keine Sanitär-/Installateurleistung behauptet.
    scopeNote:
      "Wir konzentrieren uns auf Badmöbel und Ausstattung. Die sanitäre Installation ist nicht Teil unseres Angebots – hier arbeiten wir mit Ihrem Installateur zusammen. Der Umfang des Bad-Sortiments wird laufend erweitert. TODO: genauen Leistungs- und Sortimentsumfang mit Familie Hueter bestätigen.",
    crossTitle: "Passt dazu",
    crossLinks: [
      { href: "/schlafen", label: "Schlafbereich abstimmen", text: "Ruhige Materialien verbinden Bad und Schlafzimmer zu einem stimmigen Rückzugsbereich." },
      LINK_PLANUNG,
      LINK_PROJEKTE,
    ],
    ctaTitle: "Planen wir Ihr Bad wohnlich und durchdacht.",
    ctaLead:
      "Sprechen Sie mit uns über Ihr Bad – wir zeigen Ihnen, welche Möbel- und Stauraumlösungen für Ihren Raum möglich sind.",
    projectSlug: "gesamtprojekt",
  },
};

export const getSortiment = (slug: string): SortimentContent | undefined =>
  sortiment[slug];
