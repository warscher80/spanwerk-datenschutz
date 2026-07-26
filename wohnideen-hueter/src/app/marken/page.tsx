import type { Metadata } from "next";
import { brands } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { BrandGrid } from "@/components/Cards";
import { CtaBand } from "@/components/CtaBand";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = pageMeta({
  title: "Marken & Hersteller",
  description:
    "Ausgewählte Marken und Hersteller für langlebige Qualität – von Küchen und Geräten über Polstermöbel bis zu Massivholz und Schlafsystemen. Aus Österreich und Europa.",
  path: "/marken",
});

export default function MarkenPage() {
  return (
    <>
      <PageHero
        image="/images/hero-marken.svg"
        alt="Hochwertige Marken – beispielhafte Darstellung"
        crumb="Marken"
        eyebrow="Marken & Hersteller"
        title="Qualität, die bleibt."
        lead="Wir arbeiten mit ausgewählten Herstellern, die für Handwerk, Materialqualität und Langlebigkeit stehen – viele davon aus Österreich."
      />

      <Section>
        <Container>
          <SectionHeader
            center
            eyebrow="Unsere Partner"
            title="Sorgfältig ausgewählt"
            lead="Nicht jede Marke passt zu jedem Zuhause. Wir beraten Sie, welcher Hersteller für Ihr Projekt am besten geeignet ist."
            className="mb-12"
          />
          <BrandGrid items={brands} />
          <Reveal>
            {/* TODO: Markenliste mit Familie Hueter final abgleichen. */}
            <p className="mx-auto mt-8 max-w-[46rem] text-center text-[0.9rem] text-ink-mute">
              Alle genannten Marken sind Eigentum der jeweiligen Hersteller und
              dienen der sachlichen Information. Die Auswahl wird laufend
              aktualisiert.
            </p>
          </Reveal>
        </Container>
      </Section>

      <CtaBand
        title="Welche Marke passt zu Ihrem Zuhause?"
        lead="Wir beraten Sie herstellerübergreifend und ehrlich – abgestimmt auf Ihr Projekt und Ihr Budget."
      />
    </>
  );
}
