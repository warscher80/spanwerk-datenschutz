import Image from "next/image";
import { asset } from "@/lib/asset";
import Link from "next/link";
import { site } from "@/lib/site";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";

/**
 * Brand-Hero: großflächige Grotesk-Typografie auf Graphit, ein angeschnittenes
 * Interior-Bild, technische Mono-Metadaten, ein einziger starker CTA.
 *
 * TODO (Bild): hero-home.svg durch echtes, hochauflösendes Interior-Foto
 * ersetzen (Hochformat 3:4, mind. 1400×1866 px).
 */
export function BrandHero() {
  return (
    <section className="relative flex min-h-svh flex-col bg-ink pt-[68px] text-white">
      <div className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col justify-between gap-10 px-5 py-8 sm:px-8">
        {/* Technische Meta-Zeile */}
        <Reveal>
          <div className="flex items-center justify-between border-b border-line-dark pb-4 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-white/45">
            <span>Küchen &amp; Wohnräume</span>
            <span className="hidden sm:inline">Irschen · Kärnten</span>
            <span>N 46.73 / E 13.15</span>
          </div>
        </Reveal>

        <div className="grid items-end gap-10 lg:grid-cols-12">
          {/* Headline-Block */}
          <div className="lg:col-span-7 xl:col-span-8">
            <Reveal>
              <p className="mb-6 flex items-center gap-2.5 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-white/50">
                <span className="size-1.5 bg-clay" aria-hidden />
                Familie Hueter · Einrichtungshaus
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="font-display text-[clamp(2.9rem,10.5vw,8.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.035em] text-white">
                Räume sind
                <br />
                mehr als
                <br />
                Einrichtung<span className="text-clay">.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="mt-8 max-w-[38rem] text-[1.1rem] leading-relaxed text-white/75 sm:text-[1.25rem]">
                Individuelle Küchen und Wohnräume – persönlich geplant und präzise
                umgesetzt. Wir denken Räume ganzheitlich, beginnend bei den
                Menschen, die darin leben.
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <div className="mt-9 flex flex-wrap items-center gap-6">
                <Link
                  href="/kontakt"
                  className="group inline-flex items-center gap-3 bg-clay px-8 py-4 font-semibold text-white transition-colors hover:bg-clay-dark"
                >
                  Projekt starten
                  <Icon name="arrow" size={1.05} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/projekte"
                  className="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-white/70 underline-offset-4 hover:text-white hover:underline"
                >
                  Projekte ansehen
                </Link>
              </div>
            </Reveal>
          </div>

          {/* Angeschnittenes Bild */}
          <Reveal delay={0.18} className="lg:col-span-5 xl:col-span-4">
            <figure className="relative">
              <div className="relative aspect-[3/4] overflow-hidden">
                <Image
                  src={asset("/images/hero-home.jpg")}
                  alt="Individuell geplanter Wohnraum von Wohnideen Hueter"
                  fill
                  priority
                  sizes="(max-width:1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-3 flex items-center justify-between font-mono text-[0.68rem] uppercase tracking-[0.14em] text-white/45">
                <span>Fig. 01 — Wohnraum</span>
                <a href={site.phoneHref} className="hover:text-clay">
                  {site.phoneDisplay}
                </a>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
