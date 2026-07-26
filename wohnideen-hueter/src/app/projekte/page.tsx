import type { Metadata } from "next";
import { projects } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { ProjectCard } from "@/components/Cards";
import { CtaBand } from "@/components/CtaBand";
import { Eyebrow } from "@/components/SectionHeader";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = pageMeta({
  title: "Projekte & Referenzen",
  description:
    "Einblicke in unsere Einrichtungsprojekte aus dem oberen Drautal. Echte Projektfotos folgen – gerne zeigen wir Ihnen Referenzen im persönlichen Gespräch.",
  path: "/projekte",
});

export default function ProjektePage() {
  return (
    <>
      <PageHero
        image="/images/hero-projekte.svg"
        alt="Einrichtungsprojekte – beispielhafte Darstellung"
        crumb="Projekte"
        eyebrow="Projekte & Referenzen"
        title={
          <>
            Einrichtung, die
            <br />
            im Alltag ankommt.
          </>
        }
        lead="Ein Einblick in unsere Arbeit. Sobald die Fotos unserer aktuellen Projekte vorliegen, zeigen wir sie hier in voller Größe – ehrlich, ohne Schönfärberei."
      />

      <Section>
        <Container>
          {/* TODO: Echte Projektfotos & -daten einsetzen (Raumart · Aufgabe ·
              Materialien · besondere Lösung). KEINE erfundenen Referenzen. */}
          <SectionHeader
            eyebrow="Auswahl"
            title="Aktuelle Projekte"
            lead="Die folgenden Beispiele sind Platzhalter und zeigen die geplante Darstellung. Echte Projekte folgen."
            className="mb-12"
          />
          <div className="grid gap-[clamp(1.1rem,2vw,1.6rem)] sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <ProjectCard key={p.slug} project={p} delay={(i % 3) * 0.08} />
            ))}
          </div>
        </Container>
      </Section>

      {/* Kundenstimmen – nur echte Inhalte */}
      <Section tone="sand">
        <Container narrow>
          <Reveal className="text-center">
            <Eyebrow center>Kundenstimmen</Eyebrow>
            <p className="text-lead mt-4 mb-4 text-ink-soft">
              Wir zeigen hier nur echte Rückmeldungen unserer Kundinnen und
              Kunden.
            </p>
            {/* TODO: Echte, freigegebene Kundenstimme(n) einsetzen. Keine erfundenen Bewertungen. */}
            <blockquote className="font-display text-[clamp(1.5rem,3vw,2.3rem)] leading-tight text-ink">
              „Persönliche Beratung, individuelle Planung und eine Montage, auf
              die man sich verlassen kann.“
            </blockquote>
            <cite className="mt-5 block text-[0.95rem] font-semibold not-italic text-ink-soft">
              Platzhalter – echte Kundenstimme mit Einverständnis folgt
            </cite>
          </Reveal>
        </Container>
      </Section>

      <CtaBand
        title="Ihr Projekt könnte das nächste sein."
        lead="Erzählen Sie uns von Ihren Räumen und Ihren Ideen – wir hören zu."
      />
    </>
  );
}
