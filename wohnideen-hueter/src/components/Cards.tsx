import Image from "next/image";
import { asset } from "@/lib/asset";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/site";
import { Icon } from "./Icon";
import { Reveal } from "./Reveal";
import { Eyebrow } from "./SectionHeader";

/** Projektkarte (Referenzen), verlinkt zur Detailseite. */
export function ProjectCard({
  project,
  delay = 0,
}: {
  project: Project;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <Link
        href={`/projekte/${project.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-panel border border-line bg-paper shadow-soft transition-colors hover:border-clay/40"
      >
        <div className="relative aspect-[3/2] overflow-hidden bg-taupe">
          <Image
            src={asset(`/images/proj-${project.slug}.jpg`)}
            alt={project.title}
            fill
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
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
        </div>
      </Link>
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
            src={asset(image)}
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
