import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { brands, categories, people, projects, site } from "@/lib/site";
import { Container, Section } from "@/components/Layout";
import { Eyebrow, SectionHeader } from "@/components/SectionHeader";
import { Button, TextLink } from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import { Icon, type IconName } from "@/components/Icon";

const cat = (slug: string) => categories.find((c) => c.slug === slug)!;

/* ======================================================================== *
 *  1 · VERTRAUENSSTRIP — typografisch, mit feinen Trennlinien (keine Boxen)
 * ======================================================================== */
const trust: { icon: IconName; title: string; text: string }[] = [
  { icon: "chat", title: "Persönliche Beratung", text: "Wir nehmen uns Zeit für Ihre Wünsche, Räume und Lebensgewohnheiten." },
  { icon: "ruler", title: "Individuelle Planung", text: "Keine Lösung von der Stange, sondern Einrichtung, die zu Ihnen passt." },
  { icon: "truck", title: "Aus einer Hand", text: "Von der ersten Idee über die Lieferung bis zur fachgerechten Montage." },
  { icon: "heart", title: "Persönliche Betreuung", text: "Ein Ansprechpartner, der bleibt – auch nach der Montage." },
];

export function TrustStrip() {
  return (
    <Section>
      <Container>
        <Reveal className="max-w-[46rem]">
          <Eyebrow>Warum Wohnideen Hueter</Eyebrow>
          <p className="mt-4 font-display text-h3 text-ink">
            Kein anonymer Möbelkauf – sondern ein Weg, den wir gemeinsam gehen.
          </p>
        </Reveal>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4">
          {trust.map((t, i) => (
            <Reveal
              key={t.title}
              delay={(i % 4) * 0.07}
              className={cn(
                "border-t border-line py-7",
                "lg:border-t-0 lg:border-l lg:first:border-l-0 lg:px-7 lg:first:pl-0",
              )}
            >
              <Icon name={t.icon} size={1.6} className="text-clay" />
              <h3 className="mt-4 font-display text-[1.35rem] text-ink">
                {t.title}
              </h3>
              <p className="mt-1.5 text-[0.96rem] leading-relaxed text-ink-soft">
                {t.text}
              </p>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ======================================================================== *
 *  2 · EMOTIONALE EINFÜHRUNG — „Gute Räume beginnen mit gutem Zuhören.“
 * ======================================================================== */
export function Listening() {
  return (
    <Section tone="sand">
      <Container>
        <div className="grid items-center gap-[clamp(2rem,5vw,4.5rem)] lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <figure className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-panel shadow-soft">
                <Image
                  src="/images/about-home.svg"
                  alt="Persönliches Beratungsgespräch im Schauraum"
                  fill
                  sizes="(max-width:1024px) 100vw, 45vw"
                  className="object-cover"
                />
              </div>
              {/* TODO (Bild): echtes Beratungs-/Schauraumfoto, Hochformat 4:5, mind. 1200×1500 px */}
              <figcaption className="absolute -bottom-4 left-4 rounded-full bg-paper px-4 py-2 text-[0.78rem] font-medium text-ink-mute shadow-soft">
                Schauraum in Irschen
              </figcaption>
            </figure>
          </Reveal>
          <Reveal delay={0.1}>
            <div>
              <Eyebrow>Unsere Haltung</Eyebrow>
              <h2 className="text-h2 mt-4">
                Gute Räume beginnen
                <br />
                mit gutem Zuhören.
              </h2>
              <p className="mt-5 text-lead text-ink-soft">
                Bevor wir über Möbel sprechen, sprechen wir über Sie. Wie Sie
                leben, kochen, Gäste empfangen und zur Ruhe kommen – daraus
                entsteht eine Planung, die zu Ihnen passt und nicht umgekehrt.
              </p>
              <p className="mt-4 text-ink-soft">
                Wir verbinden Gestaltung mit Alltagstauglichkeit und behalten
                dabei Ihre Räume, Ihr Budget und Ihren Zeitrahmen im Blick. Eine
                ehrliche Empfehlung ist uns wichtiger als ein schneller Verkauf.
              </p>
              <div className="mt-7">
                <TextLink href="/planung-service">
                  So arbeiten wir
                </TextLink>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* ======================================================================== *
 *  3 · WOHNWELTEN — Editorial-Bento mit variablen Größen
 * ======================================================================== */
function WohnweltTile({
  slug,
  featured = false,
  className,
  delay = 0,
}: {
  slug: string;
  featured?: boolean;
  className?: string;
  delay?: number;
}) {
  const c = cat(slug);
  return (
    <Reveal delay={delay} className={cn("min-h-[15rem]", className)}>
      <Link
        href={`/${c.slug}`}
        className="group relative flex h-full min-h-[15rem] flex-col justify-end overflow-hidden rounded-panel bg-ink shadow-soft"
      >
        <Image
          src={`/images/cat-${c.slug}.svg`}
          alt={`${c.title} bei Wohnideen Hueter`}
          fill
          sizes={featured ? "(max-width:1024px) 100vw, 50vw" : "(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"}
          className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="relative p-5 sm:p-6">
          <h3 className={cn("text-white", featured ? "text-h2" : "font-display text-[1.4rem]")}>
            {c.title}
          </h3>
          {featured && (
            <p className="mt-2 max-w-[34ch] text-[0.98rem] text-white/85">
              {c.kicker}.
            </p>
          )}
          <span className="mt-3 inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-white/95">
            Entdecken
            <Icon
              name="arrow"
              size={0.95}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

export function Wohnwelten() {
  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow="Wohnwelten"
          title="Für jeden Raum die passende Idee"
          lead="Von der Küche bis zum Vorzimmer richten wir Ihr Zuhause aus einer Hand ein – aufeinander abgestimmt, hochwertig und langlebig."
          className="mb-10"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[15rem]">
          <WohnweltTile slug="kuechen" featured className="sm:col-span-2 lg:row-span-2" delay={0} />
          <WohnweltTile slug="wohnen" delay={0.06} />
          <WohnweltTile slug="schlafen" delay={0.12} />
          <WohnweltTile slug="essen" delay={0.06} />
          <WohnweltTile slug="vorzimmer" delay={0.12} />
          <WohnweltTile slug="bad" delay={0.18} />
        </div>
      </Container>
    </Section>
  );
}

/* ======================================================================== *
 *  4 · PLANUNGSPROZESS — große Ghost-Nummern (keine Timeline mit Kreisen)
 * ======================================================================== */
const journey: { n: string; title: string; text: string }[] = [
  { n: "01", title: "Kennenlernen", text: "Wir hören zu und lernen Sie, Ihre Räume und Ihren Alltag kennen." },
  { n: "02", title: "Wünsche & Räume verstehen", text: "Aufmaß vor Ort und gemeinsame Bedarfsermittlung – präzise und in Ruhe." },
  { n: "03", title: "Individuell planen", text: "Eine maßgeschneiderte Planung mit Visualisierung, abgestimmt auf Ihr Budget." },
  { n: "04", title: "Materialien auswählen", text: "Oberflächen, Farben und Geräte zum Angreifen und Vergleichen." },
  { n: "05", title: "Liefern & montieren", text: "Termingerechte Lieferung und saubere, fachgerechte Montage." },
  { n: "06", title: "Persönlich betreuen", text: "Auch danach für Sie da – ein Ansprechpartner, der bleibt." },
];

export function ProcessJourney() {
  return (
    <Section tone="ink">
      <Container>
        <SectionHeader
          light
          eyebrow="Planung aus einer Hand"
          title={
            <>
              Von der ersten Idee bis
              <br />
              zur fertigen Einrichtung
            </>
          }
          lead="Sie haben einen Ansprechpartner für alles. Jeder Schritt schafft Klarheit – Sie wissen immer, wo Ihr Projekt gerade steht."
          className="mb-14"
        />
        <ol className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {journey.map((s) => (
            <Reveal as="li" key={s.n} className="relative border-t border-white/15 pt-7">
              <span
                aria-hidden
                className="pointer-events-none absolute right-1 top-4 font-display text-[4.5rem] leading-none text-white/[0.07]"
              >
                {s.n}
              </span>
              <p className="font-display text-[0.9rem] font-semibold tracking-[0.2em] text-gold">
                {s.n}
              </p>
              <h3 className="mt-2 font-display text-[1.5rem] text-white">
                {s.title}
              </h3>
              <p className="mt-2 text-[0.96rem] leading-relaxed text-[#f3ece1]/70">
                {s.text}
              </p>
            </Reveal>
          ))}
        </ol>
        <Reveal className="mt-12">
          <Button href="/planung-service" variant="light" iconRight="arrow">
            Planung &amp; Service kennenlernen
          </Button>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ======================================================================== *
 *  5 · PROJEKTE — ein hervorgehobenes Projekt + ergänzende (variable Größen)
 * ======================================================================== */
function ProjectTile({
  slug,
  featured = false,
  delay = 0,
}: {
  slug: string;
  featured?: boolean;
  delay?: number;
}) {
  const p = projects.find((x) => x.slug === slug)!;
  return (
    <Reveal delay={delay} className={cn("h-full", featured && "sm:col-span-2 lg:col-span-2 lg:row-span-2")}>
      <Link
        href={`/projekte/${p.slug}`}
        className={cn(
          "group relative flex h-full flex-col justify-end overflow-hidden rounded-panel bg-ink shadow-soft",
          featured ? "min-h-[22rem] lg:min-h-[30rem]" : "min-h-[14rem]",
        )}
      >
        <Image
          src={`/images/proj-${p.slug}.svg`}
          alt={`${p.title}`}
          fill
          sizes={featured ? "(max-width:1024px) 100vw, 66vw" : "(max-width:1024px) 50vw, 33vw"}
          className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink">
          {p.tag}
        </span>
        <div className="relative p-5 sm:p-6">
          <h3 className={cn("text-white", featured ? "text-h3" : "font-display text-[1.25rem]")}>
            {p.title}
          </h3>
          {featured && (
            <p className="mt-2 max-w-[42ch] text-white/85">{p.summary}</p>
          )}
          <span className="mt-3 inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-white/90">
            Projekt ansehen
            <Icon
              name="arrow"
              size={0.95}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

export function FeaturedProjects() {
  return (
    <Section tone="sand">
      <Container>
        {/* TODO: Echte Projektfotos & -daten (Raumtyp · Aufgabe · Material · Lösung).
            Detailseiten folgen; Karten verlinken vorerst auf die Projektübersicht. */}
        <div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeader
            eyebrow="Projekte & Referenzen"
            title="Einrichtung, die im Alltag ankommt"
            lead="Nicht nur Produkte, sondern individuell umgesetzte Lösungen. Sobald die Fotos unserer aktuellen Projekte vorliegen, zeigen wir sie hier in voller Größe."
            className="mb-0"
          />
          <Reveal className="hidden shrink-0 sm:block">
            <TextLink href="/projekte">Alle Projekte entdecken</TextLink>
          </Reveal>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[1fr]">
          <ProjectTile slug="kueche-drautal" featured delay={0} />
          <ProjectTile slug="wohnraum" delay={0.08} />
          <ProjectTile slug="schlafzimmer" delay={0.14} />
        </div>
        <Reveal className="mt-8 sm:hidden">
          <TextLink href="/projekte">Alle Projekte entdecken</TextLink>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ======================================================================== *
 *  6 · ÜBER UNS — persönlich, mit Pull-Quote
 * ======================================================================== */
export function AboutTeaser() {
  return (
    <Section>
      <Container>
        <div className="grid items-center gap-[clamp(2rem,5vw,4.5rem)] lg:grid-cols-2">
          <Reveal>
            <div>
              <Eyebrow>Über Wohnideen Hueter</Eyebrow>
              <blockquote className="mt-5 font-display text-[clamp(1.7rem,3.4vw,2.6rem)] leading-[1.2] text-ink">
                „Ein Zuhause entsteht nicht aus einzelnen Möbelstücken. Es
                entsteht aus einer Planung, die Menschen, Räume und Alltag
                zusammenbringt.“
              </blockquote>
              <p className="mt-6 text-ink-soft">
                Als familiengeführtes Einrichtungshaus in Irschen sprechen Sie
                bei uns mit den Menschen, die Ihr Projekt auch umsetzen. Rudi und
                Andrea Hueter beraten Sie persönlich – mit Erfahrung,
                Handschlagqualität und echter regionaler Nähe.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button href="/ueber-uns" variant="dark" iconRight="arrow">
                  Familie Hueter kennenlernen
                </Button>
                <a
                  href={people.rudi.phoneHref}
                  className="inline-flex items-center gap-2 font-semibold text-ink-soft hover:text-clay"
                >
                  <Icon name="phone" size={1} className="text-clay" />
                  {site.phoneDisplay}
                </a>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <figure className="relative">
              <div className="relative aspect-[5/4] overflow-hidden rounded-panel shadow-soft">
                <Image
                  src="/images/about-story.svg"
                  alt="Schauraum von Wohnideen Hueter in Irschen"
                  fill
                  sizes="(max-width:1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              {/* TODO (Bild): echtes Team-/Schauraumfoto, Querformat 5:4, mind. 1500×1200 px */}
              <figcaption className="absolute -bottom-4 right-4 rounded-full bg-paper px-4 py-2 text-[0.78rem] font-medium text-ink-mute shadow-soft">
                Familie Hueter, Irschen
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* ======================================================================== *
 *  7 · MARKEN & QUALITÄT — ruhig, redaktionell (keine Logo-Leiste)
 * ======================================================================== */
const featuredBrands = [
  "ewe",
  "FM Küchen",
  "Siemens",
  "Blanco",
  "Koinor",
  "ADA Austria",
  "ANREI",
  "Schösswender",
];

export function BrandsQuality() {
  const items = featuredBrands
    .map((n) => brands.find((b) => b.name === n))
    .filter((b): b is (typeof brands)[number] => Boolean(b));
  return (
    <Section tone="sand">
      <Container>
        <div className="grid gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <Reveal>
            <div>
              <Eyebrow>Marken &amp; Qualität</Eyebrow>
              <h2 className="text-h2 mt-4">
                Qualität, die man sieht und täglich spürt.
              </h2>
              <p className="mt-5 text-ink-soft">
                Wir arbeiten mit ausgewählten Herstellern aus Österreich und
                Europa, die für gutes Handwerk, ehrliche Materialien und
                Langlebigkeit stehen. Welche Marke zu Ihrem Projekt passt,
                beraten wir herstellerübergreifend und ehrlich.
              </p>
              <div className="mt-7">
                <TextLink href="/marken">Alle Marken ansehen</TextLink>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <ul className="grid grid-cols-2 border-t border-line sm:grid-cols-2">
              {items.map((b, i) => (
                <li
                  key={b.name}
                  className={cn(
                    "flex flex-col justify-center border-b border-line py-5",
                    i % 2 === 1 && "border-l pl-6",
                    i % 2 === 0 && "pr-6",
                  )}
                >
                  <span className="font-display text-[1.4rem] text-ink">
                    {b.name}
                  </span>
                  <span className="text-[0.74rem] uppercase tracking-[0.12em] text-ink-mute">
                    {b.note}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* ======================================================================== *
 *  8 · ABSCHLUSS-CTA — dunkel, mit Kontaktpanel
 * ======================================================================== */
function ContactRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5 py-4">
      <Icon name={icon} size={1.35} className="mt-0.5 text-gold" />
      <div>
        <p className="text-[0.72rem] uppercase tracking-[0.15em] text-[#a99e8d]">
          {label}
        </p>
        <div className="mt-0.5 text-[0.98rem] text-[#f3ece1]">{children}</div>
      </div>
    </div>
  );
}

export function HomeCta() {
  return (
    <Section tone="ink">
      <Container>
        <div className="grid items-center gap-[clamp(2.5rem,5vw,4.5rem)] lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <div>
              <Eyebrow light>Beratung &amp; Kontakt</Eyebrow>
              <h2 className="text-h2 mt-4 text-white">
                Lassen Sie uns über
                <br />
                Ihr Zuhause sprechen.
              </h2>
              <p className="mt-5 max-w-[34rem] text-lead text-[#f3ece1]/80">
                Vereinbaren Sie einen persönlichen Beratungstermin und erzählen
                Sie uns von Ihren Räumen, Wünschen und Ideen – unverbindlich, im
                Schauraum oder bei Ihnen zu Hause.
              </p>
              <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap">
                <Button href="/kontakt" variant="primary" icon="chat">
                  Beratungstermin vereinbaren
                </Button>
                <Button href={site.phoneHref} variant="light" icon="phone">
                  {site.phoneDisplay}
                </Button>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-panel border border-white/15 bg-white/[0.04] p-6 sm:p-8">
              <h3 className="sr-only">Kontaktdaten</h3>
              <div className="divide-y divide-white/10">
                <ContactRow icon="phone" label="Telefon">
                  <a href={people.rudi.phoneHref} className="hover:text-white">
                    {people.rudi.name}: {people.rudi.phone}
                  </a>
                  <br />
                  <a href={people.andrea.phoneHref} className="hover:text-white">
                    {people.andrea.name}: {people.andrea.phone}
                  </a>
                </ContactRow>
                <ContactRow icon="pin" label="Schauraum & Adresse">
                  {site.legalName}
                  <br />
                  {site.address.street}, {site.address.zip} {site.address.city}
                </ContactRow>
                <ContactRow icon="clock" label="Termine">
                  {site.hours.note}
                </ContactRow>
              </div>
              <Link
                href="/kontakt"
                className="mt-5 inline-flex items-center gap-1.5 border-b border-white/25 pb-0.5 text-[0.92rem] font-semibold text-white hover:border-gold"
              >
                Anfrage senden &amp; Anfahrt
                <Icon name="arrow" size={0.95} />
              </Link>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
