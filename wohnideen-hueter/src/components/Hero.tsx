import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/lib/site";
import { Button } from "./Button";
import { Eyebrow } from "./SectionHeader";
import { Reveal } from "./Reveal";
import { Icon } from "./Icon";

/** Startseiten-Hero: großformatig, emotional, mit primärem/sekundärem CTA. */
export function HomeHero() {
  return (
    <section className="relative flex min-h-[min(92vh,860px)] items-end overflow-hidden pt-[78px] text-white">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/hero-home.svg"
          alt="Heller, wohnlich eingerichteter Wohnraum in warmen Naturtönen – beispielhafte Darstellung"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg,rgba(30,22,16,.5) 0%,rgba(30,22,16,.15) 35%,rgba(30,22,16,.78) 100%)",
          }}
        />
      </div>
      <div className="mx-auto w-full max-w-[75rem] px-5 py-[clamp(2.5rem,7vw,5.5rem)] sm:px-8 lg:px-10">
        <div className="max-w-[52rem]">
          <Reveal>
            <Eyebrow light>
              Einrichtungshaus im oberen Drautal · Irschen, Kärnten
            </Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="text-display mt-4 mb-4 text-white [text-shadow:0_2px_40px_rgba(0,0,0,.25)]">
              Räume, die zu Ihrem
              <br />
              Leben passen.
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="text-lead max-w-[38rem] text-white/90">
              {site.tagline} Persönlich beraten, individuell geplant und bis zum
              letzten Handgriff begleitet – von der Familie Hueter.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap gap-3.5">
              <Button href="/kontakt" variant="primary" icon="chat">
                Beratungstermin vereinbaren
              </Button>
              <Button href="/projekte" variant="light" iconRight="arrow">
                Projekte entdecken
              </Button>
            </div>
          </Reveal>
          <Reveal delay={0.32}>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/25 pt-6 text-[0.92rem] text-white/90">
              <span className="inline-flex items-center gap-2">
                <Icon name="pin" /> {site.address.zip} {site.address.city}
              </span>
              <span className="inline-flex items-center gap-2">
                <Icon name="clock" /> {site.hours.note}
              </span>
              <a
                href={site.phoneHref}
                className="inline-flex items-center gap-2 hover:text-white"
              >
                <Icon name="phone" /> {site.phoneDisplay}
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

interface PageHeroProps {
  image: string;
  alt: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  /** Breadcrumb-Zusatz nach „Startseite ·“ (Text oder verschachtelte Links) */
  crumb?: ReactNode;
}

/** Sekundär-Hero für Unterseiten. */
export function PageHero({ image, alt, eyebrow, title, lead, crumb }: PageHeroProps) {
  return (
    <section className="relative flex min-h-[clamp(340px,46vh,520px)] items-end overflow-hidden pt-[78px] text-white">
      <div className="absolute inset-0 -z-10">
        <Image
          src={image}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg,rgba(30,22,16,.45),rgba(30,22,16,.72))",
          }}
        />
      </div>
      <div className="mx-auto w-full max-w-[75rem] px-5 py-[clamp(2rem,5vw,3.6rem)] sm:px-8 lg:px-10">
        {crumb && (
          <Reveal>
            <p className="text-[0.85rem] text-white/80">
              <Link href="/" className="hover:text-white hover:underline">
                Startseite
              </Link>{" "}
              · {crumb}
            </p>
          </Reveal>
        )}
        {eyebrow && (
          <Reveal delay={0.06}>
            <Eyebrow light className="mt-2">
              {eyebrow}
            </Eyebrow>
          </Reveal>
        )}
        <Reveal delay={0.08}>
          <h1 className="text-h1 mt-3 mb-3 text-white">{title}</h1>
        </Reveal>
        {lead && (
          <Reveal delay={0.16}>
            <p className="text-lead max-w-[40rem] text-white/90">{lead}</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
