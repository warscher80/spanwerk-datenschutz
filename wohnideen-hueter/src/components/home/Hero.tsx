import Image from "next/image";
import { site } from "@/lib/site";
import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/SectionHeader";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";

/**
 * Editorialer Startseiten-Hero.
 * Asymmetrisch: Textblock links, großzügige Bildfläche rechts. Statt einer
 * flächigen dunklen Überlagerung nur ein diagonaler Verlauf, der die Schrift
 * links trägt und das Bild rechts frei atmen lässt.
 *
 * TODO (Bild): hero-home.svg durch echtes, hochauflösendes Küchen-/Wohnraum-
 * foto ersetzen (mind. 2000×1250 px, Querformat, ruhiger rechter Bildbereich
 * für die Textfreiheit).
 */
export function EditorialHero() {
  return (
    <section className="relative isolate flex min-h-[clamp(600px,90svh,900px)] items-end overflow-hidden pt-[78px] text-white">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/hero-home.svg"
          alt="Hell und warm eingerichtete Wohnküche in Naturtönen"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[70%_center]"
        />
        {/* Diagonaler Verlauf für Lesbarkeit links, Bild bleibt rechts sichtbar */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, rgba(24,17,11,.86) 0%, rgba(24,17,11,.62) 34%, rgba(24,17,11,.2) 62%, rgba(24,17,11,.05) 100%)",
          }}
        />
        {/* Feiner oberer Scrim für den transparenten Header */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/35 to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-[75rem] px-5 pb-[clamp(2.5rem,6vw,4.5rem)] pt-24 sm:px-8 lg:px-10">
        <div className="max-w-[38rem] lg:max-w-[44rem]">
          <Reveal>
            <Eyebrow light>Einrichtungshaus · Irschen im Drautal</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="text-display mt-5 text-balance text-white [text-shadow:0_2px_40px_rgba(0,0,0,.3)]">
              Räume, die sich nach{" "}
              <span className="italic text-[#f0dcc9]">Zuhause</span> anfühlen.
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 max-w-[34rem] text-[1.12rem] leading-relaxed text-white/90 sm:text-[1.2rem]">
              Individuelle Küchen und Wohnräume – persönlich beraten, sorgfältig
              geplant und zuverlässig umgesetzt. Von der Familie Hueter, Ihrem
              regionalen Einrichtungspartner.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap">
              <Button href="/kontakt" variant="primary" icon="chat">
                Beratungstermin vereinbaren
              </Button>
              <Button href="/projekte" variant="light" iconRight="arrow">
                Wohnideen entdecken
              </Button>
            </div>
          </Reveal>

          {/* Dezente Vertrauens-/Kontaktinformation als feiner Strip */}
          <Reveal delay={0.32}>
            <dl className="mt-10 flex flex-col gap-4 border-t border-white/20 pt-6 text-[0.92rem] text-white/90 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-7 sm:gap-y-3">
              <div className="flex items-center gap-2.5">
                <Icon name="pin" className="text-white/70" />
                <dt className="sr-only">Standort</dt>
                <dd>
                  {site.address.zip} {site.address.city}, {site.address.region}
                </dd>
              </div>
              <span aria-hidden className="hidden h-4 w-px bg-white/25 sm:block" />
              <div className="flex items-center gap-2.5">
                <Icon name="clock" className="text-white/70" />
                <dt className="sr-only">Öffnungszeiten</dt>
                <dd>{site.hours.note}</dd>
              </div>
              <span aria-hidden className="hidden h-4 w-px bg-white/25 sm:block" />
              <div className="flex items-center gap-2.5">
                <Icon name="phone" className="text-white/70" />
                <dt className="sr-only">Telefon</dt>
                <dd>
                  <a href={site.phoneHref} className="hover:text-white">
                    {site.phoneDisplay}
                  </a>
                </dd>
              </div>
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
