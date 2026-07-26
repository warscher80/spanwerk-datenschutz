import type { Metadata } from "next";
import Image from "next/image";
import { people, site } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader, Eyebrow } from "@/components/SectionHeader";
import { FeatureSplit } from "@/components/Cards";
import { ContactCta } from "@/components/ContactCta";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";
import { Button, TextLink } from "@/components/Button";

export const metadata: Metadata = pageMeta({
  title: "Über uns – das Einrichtungshaus der Familie Hueter",
  description:
    "Wohnideen Hueter ist ein familiengeführtes Einrichtungshaus in Irschen im oberen Drautal. Lernen Sie Rudi und Andrea Hueter, unsere Arbeitsweise und unseren Schauraum kennen.",
  path: "/ueber-uns",
});

// Bestätigte Ansprechpartner (Namen/Funktionen). Fotos sind Platzhalter (TODO).
const team = [
  { ...people.rudi, img: "team-rudi", focus: "Küchen- & Wohnraumplanung, Aufmaß, Montage" },
  { ...people.andrea, img: "team-andrea", focus: "Beratung, Organisation und Betreuung" },
];

const values = [
  { title: "Persönlich", text: "Sie haben feste Ansprechpartner, die Ihr Projekt vom ersten Gespräch an kennen – kein wechselndes Verkaufspersonal." },
  { title: "Regional", text: "Verwurzelt in Irschen im oberen Drautal. Kurze Wege, ein Handschlag, der zählt, und Nähe, die man merkt." },
  { title: "Verlässlich", text: "Was wir zusagen, halten wir – von der Terminplanung bis zur sauberen Übergabe. Auch danach bleiben wir erreichbar." },
];

export default function UeberUnsPage() {
  return (
    <>
      <PageHero
        image="/images/hero-ueberuns.svg"
        alt="Familie Hueter in ihrem Einrichtungshaus in Irschen"
        crumb="Über uns"
        eyebrow="Über Wohnideen Hueter"
        title={
          <>
            Wir beginnen nicht
            <br />
            mit einem Produkt.
          </>
        }
        lead="Sondern mit den Menschen, die den Raum täglich nutzen. Aus dieser Haltung entsteht bei uns jede Einrichtung."
      />

      {/* Kurze Vorstellung */}
      <Section>
        <Container>
          <FeatureSplit
            image="/images/about-story.svg"
            alt="Schauraum von Wohnideen Hueter"
            eyebrow="Wer wir sind"
            title="Ein Familienbetrieb aus dem Drautal"
          >
            <p className="text-lead text-ink-soft">
              Wohnideen Hueter ist ein familiengeführtes Einrichtungshaus in
              Irschen. Bei uns sprechen Sie mit den Menschen, die Ihr Projekt auch
              umsetzen – Rudi und Andrea Hueter.
            </p>
            <p className="mt-4 text-ink-soft">
              Wir sind bewusst kein anonymes Möbelhaus. Statt Ware von der Stange
              planen wir Einrichtung, die zu Ihren Räumen und Ihrem Alltag passt,
              und begleiten sie von der ersten Idee bis zur fertigen Montage.
            </p>
          </FeatureSplit>
        </Container>
      </Section>

      {/* Haltung & Arbeitsweise */}
      <Section tone="sand">
        <Container>
          <FeatureSplit
            reverse
            image="/images/about-home.svg"
            alt="Persönliches Beratungsgespräch"
            eyebrow="Unsere Arbeitsweise"
            title="Zuerst zuhören, dann planen"
          >
            <p className="text-lead text-ink-soft">
              Bevor wir über Möbel sprechen, sprechen wir über Sie: Wie Sie leben,
              was Ihnen wichtig ist, was heute stört. Erst daraus wird eine Planung.
            </p>
            <p className="mt-4 text-ink-soft">
              Wir nehmen uns Zeit, geben ehrliche Empfehlungen und behalten Budget
              und Zeitrahmen im Blick. So entsteht Einrichtung, die im Alltag
              funktioniert – nicht nur am Plan.
            </p>
            <div className="mt-6">
              <TextLink href="/planung-service">So läuft die Zusammenarbeit ab</TextLink>
            </div>
          </FeatureSplit>
        </Container>
      </Section>

      {/* Team */}
      <Section>
        <Container>
          <SectionHeader
            center
            eyebrow="Ihre Ansprechpartner"
            title="Persönlich für Sie da"
            lead="Bei Wohnideen Hueter haben Sie feste Ansprechpartner – vom ersten Gespräch bis nach der Montage."
            className="mb-12"
          />
          <div className="mx-auto grid max-w-[46rem] gap-[clamp(1.2rem,2.5vw,2rem)] sm:grid-cols-2">
            {team.map((m, i) => (
              <Reveal key={m.name} delay={i * 0.08}>
                <div className="text-center">
                  <div className="relative mx-auto mb-4 aspect-square overflow-hidden rounded-panel bg-taupe shadow-soft">
                    <Image
                      src={`/images/${m.img}.svg`}
                      alt={`Porträt ${m.name}`}
                      fill
                      sizes="(max-width:640px) 100vw, 22rem"
                      className="object-cover"
                    />
                  </div>
                  <h3 className="text-h4">{m.name}</h3>
                  <p className="font-semibold text-clay">{m.role}</p>
                  <p className="mt-1 text-[0.9rem] text-ink-soft">{m.focus}</p>
                  <a
                    href={m.phoneHref}
                    className="mt-2 inline-flex items-center gap-2 text-[0.92rem] text-ink-soft hover:text-clay"
                  >
                    <Icon name="phone" size={1} className="text-clay" /> {m.phone}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
          {/* Hinweis-Doku: echte Team-Fotos siehe CONTENT-NEEDED.md */}
        </Container>
      </Section>

      {/* Schauraum – ehrlich, nur bestätigte Angaben */}
      <Section tone="sand">
        <Container>
          <div className="grid items-center gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-2">
            <Reveal>
              <div className="relative aspect-[5/4] overflow-hidden rounded-panel shadow-soft">
                <Image
                  src="/images/service-1.svg"
                  alt="Schauraum von Wohnideen Hueter in Irschen"
                  fill
                  sizes="(max-width:1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              {/* TODO: Echte Schauraum-Fotos einsetzen. */}
            </Reveal>
            <Reveal delay={0.1}>
              <div>
                <Eyebrow>Schauraum in Irschen</Eyebrow>
                <h2 className="text-h2 mt-4">Kommen Sie vorbei – am besten mit Termin</h2>
                <p className="mt-5 text-ink-soft">
                  In unserem Schauraum in Irschen können Sie Materialien und
                  Oberflächen in Ruhe ansehen und angreifen. Damit wir uns Zeit für
                  Sie nehmen können, vereinbaren wir Termine gerne persönlich.
                </p>
                <div className="mt-6 grid gap-3 text-[0.96rem]">
                  <p className="flex items-center gap-2.5 text-ink-soft">
                    <Icon name="pin" size={1.1} className="text-clay" />
                    {site.address.street}, {site.address.zip} {site.address.city}
                  </p>
                  <p className="flex items-center gap-2.5 text-ink-soft">
                    <Icon name="clock" size={1.1} className="text-clay" />
                    {site.hours.note}
                  </p>
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button href="/kontakt" icon="chat">
                    Termin anfragen
                  </Button>
                  <a
                    className="inline-flex items-center gap-2 rounded-btn border-[1.5px] border-line px-6 py-[0.95rem] font-semibold text-ink transition-colors hover:border-clay hover:text-clay"
                    href={`https://www.openstreetmap.org/?mlat=${site.address.lat}&mlon=${site.address.lng}#map=15/${site.address.lat}/${site.address.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="pin" size={1.05} /> Anfahrt
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* Werte */}
      <Section>
        <Container>
          <SectionHeader center eyebrow="Wofür wir stehen" title="Unsere Werte" className="mb-12" />
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={(i % 3) * 0.08} className="border-t border-line pt-6">
                <h3 className="font-display text-[1.5rem] text-ink">{v.title}</h3>
                <p className="mt-2 text-ink-soft">{v.text}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <ContactCta
        eyebrow="Lernen wir uns kennen"
        title="Reden wir über Ihr Zuhause."
        lead="Kommen Sie in den Schauraum oder vereinbaren Sie einen Termin bei Ihnen zu Hause – wir freuen uns auf Sie."
      />
    </>
  );
}
