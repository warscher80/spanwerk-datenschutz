import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { getProject } from "@/lib/site";
import type { CrossLink, Material, SortimentFeature } from "@/lib/sortiment";
import { Container, Section } from "@/components/Layout";
import { Eyebrow, SectionHeader } from "@/components/SectionHeader";
import { Button, TextLink } from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";
import { TickList } from "@/components/Cards";

type Tone = "cream" | "sand" | "ink" | "paper";

/* -------------------------------------------------------- Emotionale Einführung */
export function SortimentIntro({
  image,
  imageAlt,
  eyebrow,
  title,
  paras,
  reverse = false,
  tone = "cream",
  aspect = "aspect-[5/4]",
  extra,
}: {
  image: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  paras: string[];
  reverse?: boolean;
  tone?: Tone;
  aspect?: string;
  extra?: ReactNode;
}) {
  return (
    <Section tone={tone}>
      <Container>
        <div className="grid items-center gap-[clamp(2rem,5vw,4.5rem)] lg:grid-cols-2">
          <Reveal className={cn("order-1", reverse && "lg:order-2")}>
            <div className={cn("relative overflow-hidden rounded-panel shadow-soft", aspect)}>
              <Image
                src={image}
                alt={imageAlt}
                fill
                sizes="(max-width:1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={0.1} className={cn("order-2", reverse && "lg:order-1")}>
            <div>
              <Eyebrow>{eyebrow}</Eyebrow>
              <h2 className="text-h2 mt-4">{title}</h2>
              {paras.map((p, i) => (
                <p key={i} className={cn(i === 0 ? "mt-5 text-lead text-ink-soft" : "mt-4 text-ink-soft")}>
                  {p}
                </p>
              ))}
              {extra}
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------ Planungsmöglichkeiten */
export function PlanningList({
  eyebrow = "Planung",
  title,
  lead,
  points,
  tone = "sand",
}: {
  eyebrow?: string;
  title: string;
  lead: string;
  points: string[];
  tone?: Tone;
}) {
  return (
    <Section tone={tone}>
      <Container>
        <div className="grid gap-[clamp(1.5rem,3vw,3rem)] lg:grid-cols-2">
          <SectionHeader eyebrow={eyebrow} title={title} lead={lead} className="mb-0" />
          <Reveal delay={0.08}>
            <TickList items={points} />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------- Funktionen / Lösungen */
export function FeatureGrid({
  eyebrow,
  title,
  features,
  tone = "cream",
}: {
  eyebrow: string;
  title: string;
  features: SortimentFeature[];
  tone?: Tone;
}) {
  return (
    <Section tone={tone}>
      <Container>
        <SectionHeader eyebrow={eyebrow} title={title} className="mb-10" />
        <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal
              key={f.title}
              delay={(i % 3) * 0.07}
              className="border-t border-line pt-5"
            >
              <span className="font-display text-[0.85rem] font-semibold tracking-[0.18em] text-clay">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-[1.35rem] text-ink">{f.title}</h3>
              <p className="mt-2 text-[0.96rem] leading-relaxed text-ink-soft">{f.text}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ---------------------------------------------------------- Materialien / Farben */
export function MaterialPalette({
  title,
  lead,
  materials,
  tone = "sand",
}: {
  title: string;
  lead: string;
  materials: Material[];
  tone?: Tone;
}) {
  return (
    <Section tone={tone}>
      <Container>
        <div className="grid gap-[clamp(1.5rem,3vw,3rem)] lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionHeader eyebrow="Materialien & Gestaltung" title={title} lead={lead} className="mb-0" />
          <Reveal delay={0.08}>
            <ul className="flex flex-wrap gap-x-6 gap-y-6">
              {materials.map((m) => (
                <li key={m.label} className="flex w-[calc(50%-0.75rem)] items-center gap-3 sm:w-auto">
                  <span
                    aria-hidden
                    className="size-11 flex-none rounded-full border border-black/10 shadow-soft"
                    style={{ backgroundColor: m.swatch }}
                  />
                  <span className="text-[0.95rem] font-medium text-ink">{m.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[0.88rem] text-ink-mute">
              Farbflächen dienen nur der Orientierung. Konkrete Marken, Materialien
              und Oberflächen wählen wir gemeinsam im Beratungsgespräch aus.
            </p>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------- Bild-Mood-Band */
export function MoodBand({
  image,
  imageAlt,
  statement,
}: {
  image: string;
  imageAlt: string;
  statement: string;
}) {
  return (
    <section className="relative flex min-h-[clamp(320px,42vw,520px)] items-center overflow-hidden text-white">
      <div className="absolute inset-0 -z-10">
        <Image src={image} alt={imageAlt} fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-black/45" />
      </div>
      <Container>
        <Reveal>
          <p className="max-w-[42rem] font-display text-[clamp(1.6rem,3.4vw,2.6rem)] leading-[1.25] text-white [text-shadow:0_2px_30px_rgba(0,0,0,.35)]">
            {statement}
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- Referenz-Projekt */
export function ProjectHighlight({
  slug,
  tone = "cream",
  reverse = false,
}: {
  slug: string;
  tone?: Tone;
  reverse?: boolean;
}) {
  const p = getProject(slug);
  if (!p) return null;
  return (
    <Section tone={tone}>
      <Container>
        <div className="grid items-center gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal className={cn("order-1", reverse && "lg:order-2")}>
            <Link
              href="/projekte"
              className="group relative block aspect-[3/2] overflow-hidden rounded-panel bg-ink shadow-soft"
            >
              <Image
                src={`/images/proj-${p.slug}.svg`}
                alt={`${p.title}`}
                fill
                sizes="(max-width:1024px) 100vw, 60vw"
                className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink">
                {p.tag}
              </span>
            </Link>
          </Reveal>
          <Reveal delay={0.1} className={cn("order-2", reverse && "lg:order-1")}>
            <div>
              <Eyebrow>Referenz</Eyebrow>
              <h2 className="text-h3 mt-4">{p.title}</h2>
              <p className="mt-3 text-ink-soft">{p.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-line bg-paper px-2.5 py-1 text-[0.75rem] font-medium text-ink-soft"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-6">
                <TextLink href="/projekte">Alle Projekte entdecken</TextLink>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* ----------------------------------------------------------- Service-Hinweis */
export function ServiceNote({
  title,
  text,
  tone = "cream",
}: {
  title: string;
  text: string;
  tone?: Tone;
}) {
  return (
    <Section tone={tone}>
      <Container>
        <Reveal>
          <div className="mx-auto max-w-[52rem] rounded-panel border border-line bg-paper p-[clamp(1.6rem,4vw,2.8rem)] text-center shadow-soft">
            <Icon name="chat" size={1.8} className="mx-auto text-clay" />
            <h2 className="text-h3 mt-4">{title}</h2>
            <p className="mx-auto mt-3 max-w-[42rem] text-ink-soft">{text}</p>
            <div className="mt-6">
              <Button href="/planung-service" variant="ghost" iconRight="arrow">
                Planung &amp; Service kennenlernen
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------- Scope-Hinweis */
export function ScopeNote({ text }: { text: string }) {
  return (
    <Section tone="cream">
      <Container>
        <Reveal>
          {/* Ehrlicher Hinweis auf den Leistungsumfang – bewusst sichtbar. */}
          <div className="mx-auto flex max-w-[52rem] items-start gap-4 rounded-panel border border-line bg-clay-tint/50 p-6">
            <Icon name="chat" size={1.5} className="mt-0.5 flex-none text-clay" />
            <p className="text-[0.95rem] leading-relaxed text-ink-soft">{text}</p>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------------------------------------------------- Interne Verlinkung */
export function CrossLinks({
  title,
  links,
  tone = "sand",
}: {
  title: string;
  links: CrossLink[];
  tone?: Tone;
}) {
  return (
    <Section tone={tone}>
      <Container>
        <SectionHeader eyebrow="Weiterlesen" title={title} className="mb-10" />
        <div className="grid gap-4 md:grid-cols-3">
          {links.map((l, i) => (
            <Reveal key={l.href + l.label} delay={(i % 3) * 0.07} className="h-full">
              <Link
                href={l.href}
                className="group flex h-full flex-col rounded-panel border border-line bg-paper p-6 shadow-soft transition-colors hover:border-clay/40"
              >
                <p className="text-[0.96rem] text-ink-soft">{l.text}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 font-semibold text-clay">
                  {l.label}
                  <Icon
                    name="arrow"
                    size={0.95}
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
