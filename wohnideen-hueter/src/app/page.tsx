import {
  advantages,
  brands,
  categories,
  processSteps,
  projects,
} from "@/lib/site";
import { Container, Section } from "@/components/Layout";
import { HomeHero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { Button, TextLink } from "@/components/Button";
import {
  AdvantageCard,
  CategoryCard,
  FeatureSplit,
  ProcessStepCard,
  ProjectCard,
  BrandGrid,
  TickList,
} from "@/components/Cards";
import { CtaBand } from "@/components/CtaBand";
import { Reveal } from "@/components/Reveal";

export default function HomePage() {
  return (
    <>
      <HomeHero />

      {/* Vertrauensbereich */}
      <Section>
        <Container>
          <SectionHeader
            center
            eyebrow="Warum Wohnideen Hueter"
            title={
              <>
                Kein anonymer Möbelkauf.
                <br />
                Sondern ein Weg, den wir gemeinsam gehen.
              </>
            }
            className="mb-12"
          />
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((a, i) => (
              <AdvantageCard key={a.title} advantage={a} delay={(i % 4) * 0.08} />
            ))}
          </div>
        </Container>
      </Section>

      {/* Sortiment */}
      <Section tone="sand">
        <Container>
          <SectionHeader
            eyebrow="Unser Sortiment"
            title="Für jeden Raum die passende Idee"
            lead="Von der Küche bis zum Vorzimmer richten wir Ihr Zuhause aus einer Hand ein – aufeinander abgestimmt, hochwertig und langlebig."
            className="mb-12"
          />
          <div className="grid gap-[clamp(1.1rem,2vw,1.6rem)] sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c, i) => (
              <CategoryCard key={c.slug} category={c} delay={(i % 3) * 0.08} />
            ))}
          </div>
        </Container>
      </Section>

      {/* Planung aus einer Hand */}
      <Section tone="ink">
        <Container>
          <SectionHeader
            light
            eyebrow="Planung & Service"
            title={
              <>
                Von der ersten Idee bis
                <br />
                zur fertigen Einrichtung
              </>
            }
            lead="Sie haben einen Ansprechpartner – für alles. Wir nehmen Ihnen die Koordination ab und begleiten jeden Schritt persönlich."
            className="mb-12"
          />
          <div className="grid gap-px overflow-hidden rounded-panel border border-[#413a32] bg-[#413a32] sm:grid-cols-2 lg:grid-cols-3">
            {processSteps.map((s, i) => (
              <ProcessStepCard key={s.n} step={s} onDark delay={(i % 3) * 0.08} />
            ))}
          </div>
          <Reveal className="mt-8">
            <Button href="/planung-service" variant="light" iconRight="arrow">
              Mehr über unseren Ablauf
            </Button>
          </Reveal>
        </Container>
      </Section>

      {/* Ausgewählte Projekte */}
      <Section>
        <Container>
          <SectionHeader
            eyebrow="Projekte & Referenzen"
            title="Einrichtung, die im Alltag ankommt"
            lead="Ein Einblick in unsere Arbeit. Sobald die Fotos unserer aktuellen Projekte vorliegen, zeigen wir sie hier in voller Größe."
            className="mb-12"
          />
          <div className="grid gap-[clamp(1.1rem,2vw,1.6rem)] sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 3).map((p, i) => (
              <ProjectCard key={p.slug} project={p} delay={(i % 3) * 0.08} />
            ))}
          </div>
          <Reveal className="mt-8">
            <TextLink href="/projekte">Alle Projekte ansehen</TextLink>
          </Reveal>
        </Container>
      </Section>

      {/* Über uns */}
      <Section tone="sand">
        <Container>
          <FeatureSplit
            reverse
            image="/images/about-home.svg"
            alt="Persönliche Beratung im Einrichtungshaus – beispielhafte Darstellung"
            eyebrow="Über Wohnideen Hueter"
            title="Ein Familienbetrieb, der zuhört"
          >
            <p className="text-lead text-ink-soft">
              Bei uns sprechen Sie mit den Menschen, die Ihr Projekt auch
              umsetzen. Rudi und Andrea Hueter beraten Sie persönlich – mit
              Erfahrung, Handschlagqualität und einem klaren Blick für das, was
              zu Ihnen und Ihren Räumen passt.
            </p>
            <TickList
              items={[
                "Persönliche Beratung – ohne Verkaufsdruck, mit ehrlicher Empfehlung",
                "Individuelle Planung statt Möbel von der Stange",
                "Präzise Fertigung durch bewährte Partner & perfekte Montage",
                "Regional verwurzelt in Irschen im oberen Drautal",
              ]}
            />
            <Button href="/ueber-uns" variant="dark" iconRight="arrow">
              Familie Hueter kennenlernen
            </Button>
          </FeatureSplit>
        </Container>
      </Section>

      {/* Marken */}
      <Section>
        <Container>
          <SectionHeader
            center
            eyebrow="Marken & Hersteller"
            title="Qualität, die bleibt"
            lead="Wir arbeiten mit ausgewählten Herstellern, die für langlebige Qualität stehen – aus Österreich und Europa."
            className="mb-12"
          />
          <BrandGrid items={brands.slice(0, 10)} />
          <Reveal className="mt-8 text-center">
            <TextLink href="/marken">Alle Marken ansehen</TextLink>
          </Reveal>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
