import Image from "next/image";
import Link from "next/link";
import { publishedProjects, site } from "@/lib/site";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";
import { RoomIndex } from "./RoomIndex";

const WRAP = "mx-auto w-full max-w-[100rem] px-5 sm:px-8";

/* ========================================================== 1 · HALTUNG === */
export function Statement() {
  return (
    <section className="bg-cream py-[clamp(4.5rem,10vw,9rem)]">
      <div className={WRAP}>
        <Reveal>
          <p className="mb-10 flex items-center gap-2.5 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-ink">
            <span className="size-1.5 bg-clay" aria-hidden />
            Haltung
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="max-w-[26ch] font-display text-[clamp(1.9rem,4.6vw,3.6rem)] font-bold uppercase leading-[1.02] tracking-[-0.02em]">
            Ein guter Raum entsteht nicht aus Produkten. Er entsteht aus einer
            Idee, die zu den Menschen passt<span className="text-clay">.</span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-px border border-line bg-line sm:grid-cols-3">
          {[
            ["Persönlich geplant", "Kein anonymer Möbelkauf – wir planen mit Ihnen, nicht für Sie."],
            ["Ganzheitlich gedacht", "Gestaltung, Funktion und Alltag als ein zusammenhängendes Ganzes."],
            ["Präzise umgesetzt", "Von der ersten Skizze bis zur fachgerechten Montage aus einer Hand."],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 0.07} className="bg-cream">
              <div className="h-full p-7">
                <p className="font-mono text-[0.72rem] text-clay">0{i + 1}</p>
                <h3 className="mt-3 font-display text-[1.4rem] font-bold uppercase tracking-[-0.01em]">
                  {t}
                </h3>
                <p className="mt-2 text-[0.96rem] text-ink-soft">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ==================================================== 2 · WOHNWELTEN ======= */
export function Wohnwelten() {
  return (
    <section className="bg-cream py-[clamp(3.5rem,8vw,7rem)]">
      <div className={WRAP}>
        <Reveal>
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4 border-t border-ink pt-5">
            <h2 className="font-display text-[clamp(1.6rem,3.4vw,2.6rem)] font-bold uppercase tracking-[-0.02em]">
              Wohnwelten
            </h2>
            <p className="max-w-[34ch] font-mono text-[0.75rem] uppercase tracking-[0.1em] text-ink-mute">
              Sechs Bereiche — ein Zuhause, aus einer Hand geplant.
            </p>
          </div>
        </Reveal>
        <RoomIndex />
      </div>
    </section>
  );
}

/* ==================================================== 3 · PROJEKTE ========= */
export function HomeProjects() {
  const items = publishedProjects().slice(0, 3);
  return (
    <section className="bg-ink py-[clamp(4.5rem,9vw,8rem)] text-white">
      <div className={WRAP}>
        <Reveal>
          <div className="mb-14 flex flex-wrap items-end justify-between gap-4 border-t border-line-dark pt-5">
            <h2 className="font-display text-[clamp(1.9rem,5vw,4rem)] font-bold uppercase tracking-[-0.025em] text-white">
              Ausgewählte
              <br />
              Projekte
            </h2>
            <Link
              href="/projekte"
              className="font-mono text-[0.75rem] uppercase tracking-[0.14em] text-white/70 underline-offset-4 hover:text-clay hover:underline"
            >
              Alle Projekte →
            </Link>
          </div>
        </Reveal>

        <div className="grid gap-x-10 gap-y-14 lg:grid-cols-3">
          {items.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 3) * 0.08}>
              <Link href={`/projekte/${p.slug}`} className="group block">
                <div className="mb-5 flex items-baseline gap-4">
                  <span className="font-display text-[2.4rem] font-bold leading-none text-clay">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-white/50">
                    {p.tag}
                  </span>
                </div>
                <div className="relative aspect-[4/5] overflow-hidden bg-[#1a1b1d]">
                  <Image
                    src={`/images/proj-${p.slug}.jpg`}
                    alt={p.title}
                    fill
                    sizes="(max-width:1024px) 100vw, 33vw"
                    className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </div>
                <h3 className="mt-5 font-display text-[1.5rem] font-bold uppercase tracking-[-0.01em] transition-colors group-hover:text-clay">
                  {p.title}
                </h3>
                <p className="mt-2 max-w-[38ch] text-[0.96rem] text-white/60">
                  {p.summary}
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ==================================================== 4 · ARBEITSWEISE ===== */
const approach = [
  { n: "01", verb: "Zuhören", text: "Wir beginnen mit Ihren Räumen, Ihrem Alltag und Ihren Erwartungen." },
  { n: "02", verb: "Verstehen", text: "Wir analysieren Abläufe, Maße, Materialien und Prioritäten." },
  { n: "03", verb: "Entwerfen", text: "Aus Anforderungen entsteht ein stimmiges Gesamtkonzept." },
  { n: "04", verb: "Abstimmen", text: "Wir verfeinern gemeinsam, bis Planung, Budget und Zeitplan passen." },
  { n: "05", verb: "Umsetzen", text: "Lieferung und fachgerechte Montage – präzise bis zur Übergabe." },
];

export function Approach() {
  return (
    <section className="bg-cream py-[clamp(4.5rem,9vw,8rem)]">
      <div className={WRAP}>
        <Reveal>
          <p className="mb-12 flex items-center gap-2.5 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-ink">
            <span className="size-1.5 bg-clay" aria-hidden />
            Arbeitsweise — 5 Schritte
          </p>
        </Reveal>
        <ol>
          {approach.map((s, i) => (
            <Reveal as="li" key={s.n} delay={(i % 5) * 0.05} className="border-t border-line last:border-b">
              <div className="grid items-baseline gap-2 py-6 sm:grid-cols-[6rem_1fr_1.2fr] sm:gap-8 sm:py-8">
                <span className="font-display text-[2.2rem] font-bold leading-none text-ink-mute sm:text-[3rem]">
                  {s.n}
                </span>
                <span className="font-display text-[1.9rem] font-bold uppercase tracking-[-0.02em] sm:text-[2.6rem]">
                  {s.verb}
                </span>
                <span className="text-ink-soft sm:text-[1.05rem]">{s.text}</span>
              </div>
            </Reveal>
          ))}
        </ol>
        <Reveal className="mt-10">
          <Link
            href="/planung-service"
            className="inline-flex items-center gap-3 border border-ink px-7 py-4 font-semibold transition-colors hover:bg-ink hover:text-white"
          >
            Planung &amp; Service <Icon name="arrow" size={1} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ==================================================== 5 · VERTRAUEN ======== */
export function TrustBlock() {
  return (
    <section className="bg-cream pb-[clamp(4.5rem,9vw,8rem)]">
      <div className={WRAP}>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden bg-taupe">
              <Image
                src="/images/about-story.jpg"
                alt="Familie Hueter in ihrem Studio in Irschen"
                fill
                sizes="(max-width:1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            {/* TODO (Bild): echtes Team-/Studiofoto, Querformat 4:3, mind. 1600×1200 px */}
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col justify-center">
            <div>
              <p className="mb-6 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-ink-mute">
                Studio · Familie Hueter
              </p>
              <h2 className="font-display text-[clamp(2rem,4.4vw,3.4rem)] font-bold uppercase leading-[1.02] tracking-[-0.02em]">
                Gute Planung
                <br />
                braucht Vertrauen<span className="text-clay">.</span>
              </h2>
              <p className="mt-6 max-w-[42ch] text-ink-soft sm:text-[1.05rem]">
                Bei uns sprechen Sie mit den Menschen, die Ihr Projekt auch
                umsetzen. Wir begleiten Sie persönlich, entscheiden gemeinsam und
                bleiben Ihr Ansprechpartner – vom ersten Gespräch bis nach der
                Montage.
              </p>
              <div className="mt-8">
                <Link
                  href="/ueber-uns"
                  className="inline-flex items-center gap-2 border-b-2 border-clay pb-1 font-semibold hover:text-clay"
                >
                  Das Studio kennenlernen <Icon name="arrow" size={0.95} />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ==================================================== 6 · ABSCHLUSS ======== */
export function ClosingCta() {
  return (
    <section className="bg-ink py-[clamp(4.5rem,10vw,9rem)] text-white">
      <div className={WRAP}>
        <Reveal>
          <p className="mb-8 flex items-center gap-2.5 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-white/50">
            <span className="size-1.5 bg-clay" aria-hidden />
            Kontakt
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="font-display text-[clamp(2.6rem,9vw,7rem)] font-bold uppercase leading-[0.92] tracking-[-0.03em] text-white">
            Beginnen wir
            <br />
            mit Ihrem Raum<span className="text-clay">.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-10 border-t border-line-dark pt-10 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <Link
              href="/kontakt"
              className="group inline-flex items-center gap-3 bg-clay px-8 py-4 font-semibold text-white transition-colors hover:bg-clay-dark"
            >
              Projektanfrage senden
              <Icon name="arrow" size={1.05} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
          <Reveal delay={0.08}>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 font-mono text-[0.85rem]">
              <div>
                <dt className="text-[0.68rem] uppercase tracking-[0.16em] text-white/40">Telefon</dt>
                <dd className="mt-1">
                  <a href={site.phoneHref} className="hover:text-clay">{site.phoneDisplay}</a>
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] uppercase tracking-[0.16em] text-white/40">E-Mail</dt>
                <dd className="mt-1 break-all">
                  <a href={site.emailHref} className="hover:text-clay">{site.email}</a>
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] uppercase tracking-[0.16em] text-white/40">Studio</dt>
                <dd className="mt-1 text-white/80">
                  {site.address.street}, {site.address.zip} {site.address.city}
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] uppercase tracking-[0.16em] text-white/40">Termine</dt>
                <dd className="mt-1 text-white/80">Nach Vereinbarung</dd>
              </div>
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
