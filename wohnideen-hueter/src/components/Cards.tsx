import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Advantage, Brand, Category, Project, Step } from "@/lib/site";
import { Icon } from "./Icon";
import { Reveal } from "./Reveal";
import { Eyebrow } from "./SectionHeader";

/** Klar gekennzeichneter Platzhalter-Hinweis (bis echte Fotos/Projekte vorliegen). */
export function PlaceholderNote({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-tint px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-clay">
      <Icon name="pin" size={0.95} /> {children}
    </span>
  );
}

/** Sortimentskachel mit großem Bild. */
export function CategoryCard({
  category,
  showKicker = true,
  delay = 0,
}: {
  category: Category;
  showKicker?: boolean;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <Link
        href={`/${category.slug}`}
        className="group relative flex aspect-[4/5] h-full flex-col justify-end overflow-hidden rounded-panel bg-ink shadow-soft"
      >
        <Image
          src={`/images/cat-${category.slug}.svg`}
          alt={`${category.title} bei Wohnideen Hueter – beispielhafte Darstellung`}
          fill
          sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,15,10,.82)] via-transparent to-transparent" />
        <div className="relative p-6">
          <h3 className="text-h3 text-white">{category.title}</h3>
          {showKicker && (
            <p className="mt-1 max-w-[34ch] text-[0.92rem] text-white/85">
              {category.kicker}
            </p>
          )}
          <span className="mt-3.5 inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-white">
            Entdecken
            <Icon
              name="arrow"
              size={1}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

/** Vorteilskarte im Vertrauensbereich. */
export function AdvantageCard({
  advantage,
  delay = 0,
}: {
  advantage: Advantage;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="h-full bg-paper p-[clamp(1.6rem,3vw,2.3rem)]">
        <div className="mb-4 grid size-13 place-items-center rounded-[14px] bg-clay-tint text-clay">
          <Icon name={advantage.icon} size={1.5} />
        </div>
        <h3 className="text-h4 mb-1.5">{advantage.title}</h3>
        <p className="text-[0.98rem] text-ink-soft">{advantage.text}</p>
      </div>
    </Reveal>
  );
}

/** Ablauf-Schritt. */
export function ProcessStepCard({
  step,
  delay = 0,
  onDark = false,
}: {
  step: Step;
  delay?: number;
  onDark?: boolean;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div
        className={cn(
          "flex h-full items-start gap-4 p-[clamp(1.5rem,2.6vw,2.1rem)]",
          onDark ? "bg-[#332e28]" : "bg-paper",
        )}
      >
        <span
          className={cn(
            "font-display text-[1.9rem] font-semibold leading-none",
            onDark ? "text-gold" : "text-clay",
          )}
        >
          {step.n}
        </span>
        <div>
          <h3 className="text-h4 mb-1.5">{step.title}</h3>
          <p
            className={cn(
              "text-[0.95rem]",
              onDark ? "text-[#f3ece1]/70" : "text-ink-soft",
            )}
          >
            {step.text}
          </p>
        </div>
      </div>
    </Reveal>
  );
}

/** Projektkarte (Referenzen). */
export function ProjectCard({
  project,
  delay = 0,
}: {
  project: Project;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-panel border border-line bg-paper shadow-soft">
        <div className="relative aspect-[3/2] overflow-hidden bg-taupe">
          <Image
            src={`/images/proj-${project.slug}.svg`}
            alt={`${project.title} – beispielhafte Darstellung (Platzhalter)`}
            fill
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            className="object-cover"
          />
          <span className="absolute left-3.5 top-3.5 rounded-full bg-white/90 px-2.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink">
            {project.tag}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-6">
          <h3 className="text-h4 mb-1.5">{project.title}</h3>
          <p className="text-[0.94rem] text-ink-soft">{project.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {project.chips.map((c) => (
              <span
                key={c}
                className="rounded-full border border-line bg-sand px-2.5 py-1 text-[0.75rem] font-medium text-ink-soft"
              >
                {c}
              </span>
            ))}
          </div>
          {project.placeholder && (
            <p className="mt-4">
              <PlaceholderNote>Beispiel · echtes Projekt folgt</PlaceholderNote>
            </p>
          )}
        </div>
      </article>
    </Reveal>
  );
}

/** Ruhiges Markenraster. */
export function BrandGrid({ items }: { items: Brand[] }) {
  return (
    <Reveal>
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
        {items.map((b) => (
          <li
            key={b.name}
            className="flex min-h-[118px] flex-col items-center justify-center gap-1 bg-paper p-6 text-center transition-colors hover:bg-sand"
          >
            <span className="font-display text-[1.35rem] font-semibold text-ink">
              {b.name}
            </span>
            <span className="text-[0.72rem] uppercase tracking-[0.1em] text-ink-mute">
              {b.note}
            </span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

/** Redaktioneller Bild-Text-Abschnitt. */
export function FeatureSplit({
  image,
  alt,
  eyebrow,
  title,
  children,
  reverse = false,
}: {
  image: string;
  alt: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-[clamp(2rem,5vw,4.5rem)] lg:grid-cols-2">
      <Reveal className={cn("order-1", reverse && "lg:order-2")}>
        <div className="relative aspect-[5/4] overflow-hidden rounded-panel shadow-soft">
          <Image
            src={image}
            alt={alt}
            fill
            sizes="(max-width:1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      </Reveal>
      <Reveal delay={0.1} className={cn("order-2", reverse && "lg:order-1")}>
        <div>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 className="text-h2 mb-4 mt-4">{title}</h2>
          {children}
        </div>
      </Reveal>
    </div>
  );
}

/** Häkchen-Liste. */
export function TickList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="my-6 grid gap-3.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-ink-soft">
          <span className="mt-1 grid size-[22px] flex-none place-items-center rounded-full bg-clay-tint text-clay">
            <Icon name="check" size={0.85} />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
