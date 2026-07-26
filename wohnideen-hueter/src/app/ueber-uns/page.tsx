import type { Metadata } from "next";
import Image from "next/image";
import { people } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { FeatureSplit, ProcessStepCard } from "@/components/Cards";
import { CtaBand } from "@/components/CtaBand";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = pageMeta({
  title: "Über uns – Familie Hueter",
  description:
    "Wohnideen Hueter ist ein familiengeführtes Einrichtungshaus in Irschen im oberen Drautal. Lernen Sie Rudi und Andrea Hueter und unsere Arbeitsweise kennen.",
  path: "/ueber-uns",
});

const team = [
  { ...people.rudi, img: "team-rudi" },
  { ...people.andrea, img: "team-andrea" },
];

const values = [
  { title: "Persönlich", text: "Sie haben feste Ansprechpartner, die Ihr Projekt vom ersten Gespräch an kennen." },
  { title: "Regional", text: "Verwurzelt in Irschen im oberen Drautal – mit kurzen Wegen und echter Nähe." },
  { title: "Verlässlich", text: "Handschlagqualität: Was wir zusagen, halten wir – bis zur sauberen Übergabe." },
];

export default function UeberUnsPage() {
  return (
    <>
      <PageHero
        image="/images/hero-ueberuns.svg"
        alt="Familie Hueter in ihrem Einrichtungshaus – beispielhafte Darstellung"
        crumb="Über uns"
        eyebrow="Über Wohnideen Hueter"
        title={
          <>
            Ein Familienbetrieb,
            <br />
            der zuhört.
          </>
        }
        lead="Bei uns sprechen Sie mit den Menschen, die Ihr Projekt auch umsetzen – persönlich, ehrlich und regional verwurzelt."
      />

      <Section>
        <Container>
          <FeatureSplit
            image="/images/about-story.svg"
            alt="Schauraum von Wohnideen Hueter – beispielhafte Darstellung"
            eyebrow="Unsere Handschrift"
            title={
              <>
                Beraten. Planen.
                <br />
                Perfekt umsetzen.
              </>
            }
          >
            <p className="text-lead text-ink-soft">
              Wohnideen Hueter steht für persönliche Beratung, individuelle
              Planung, präzise Fertigung durch bewährte Partner und eine Montage,
              auf die Sie sich verlassen können.
            </p>
            <p className="mt-4 text-ink-soft">
              Als kleiner Familienbetrieb in Irschen nehmen wir uns die Zeit, die
              es braucht: Wir hören zu, verstehen, wie Sie leben, und planen
              Einrichtung, die wirklich zu Ihnen und Ihren Räumen passt. Kein
              anonymer Möbelkauf – sondern ein Weg, den wir gemeinsam gehen.
            </p>
          </FeatureSplit>
        </Container>
      </Section>

      {/* Team */}
      <Section tone="sand">
        <Container>
          <SectionHeader
            center
            eyebrow="Ihre Ansprechpartner"
            title="Persönlich für Sie da"
            className="mb-12"
          />
          <div className="mx-auto grid max-w-[46rem] gap-[clamp(1.2rem,2.5vw,2rem)] sm:grid-cols-2">
            {team.map((m, i) => (
              <Reveal key={m.name} delay={i * 0.08}>
                <div className="text-center">
                  <div className="relative mx-auto mb-4 aspect-square overflow-hidden rounded-panel bg-taupe shadow-soft">
                    <Image
                      src={`/images/${m.img}.svg`}
                      alt={`Porträt ${m.name} – Platzhalter, echtes Foto folgt`}
                      fill
                      sizes="(max-width:640px) 100vw, 24rem"
                      className="object-cover"
                    />
                  </div>
                  <h3 className="text-h4">{m.name}</h3>
                  <p className="mb-2 font-semibold text-clay">{m.role}</p>
                  <a
                    href={m.phoneHref}
                    className="inline-flex items-center gap-2 text-[0.92rem] text-ink-soft hover:text-clay"
                  >
                    <Icon name="phone" size={1} /> {m.phone}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
          {/* TODO: Echte Team-Fotos einsetzen. Rollen/Funktionen bestätigen. */}
        </Container>
      </Section>

      {/* Werte */}
      <Section>
        <Container>
          <SectionHeader
            center
            eyebrow="Wofür wir stehen"
            title="Unsere Werte"
            className="mb-12"
          />
          <div className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {values.map((v, i) => (
              <ProcessStepCard
                key={v.title}
                step={{ n: "·", title: v.title, text: v.text }}
                delay={(i % 3) * 0.08}
              />
            ))}
          </div>
        </Container>
      </Section>

      <CtaBand
        title="Lernen wir uns kennen."
        lead="Kommen Sie in den Schauraum oder vereinbaren Sie einen Termin bei Ihnen zu Hause."
      />
    </>
  );
}
