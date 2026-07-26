import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/site";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";

function OverviewTile({
  p,
  featured = false,
  className,
  delay = 0,
}: {
  p: Project;
  featured?: boolean;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className={cn("min-h-[15rem]", className)}>
      <Link
        href={`/projekte/${p.slug}`}
        className="group relative flex h-full min-h-[15rem] flex-col justify-end overflow-hidden rounded-panel bg-ink shadow-soft"
      >
        <Image
          src={`/images/proj-${p.slug}.svg`}
          alt={`${p.title} – beispielhafte Darstellung (Platzhalter)`}
          fill
          sizes={featured ? "(max-width:1024px) 100vw, 66vw" : "(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"}
          className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink">
          {p.tag}
        </span>
        <div className="relative p-5 sm:p-6">
          <h3 className={cn("text-white", featured ? "text-h3" : "font-display text-[1.3rem]")}>
            {p.title}
          </h3>
          {featured && <p className="mt-2 max-w-[42ch] text-white/85">{p.summary}</p>}
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

/** Editoriale Übersicht mit variablen Bildgrößen (keine gleichförmige Kartenwand). */
export function ProjectOverview({ items }: { items: Project[] }) {
  const [first, ...rest] = items;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[15rem]">
      {first && (
        <OverviewTile p={first} featured className="sm:col-span-2 lg:row-span-2" />
      )}
      {rest.map((p, i) => (
        <OverviewTile key={p.slug} p={p} delay={(i % 3) * 0.06} />
      ))}
    </div>
  );
}
