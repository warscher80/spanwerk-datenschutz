import type { Metadata } from "next";
import { publishedProjects } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { CtaBand } from "@/components/CtaBand";
import { ProjectOverview } from "@/components/projects/Overview";

export const metadata: Metadata = pageMeta({
  title: "Projekte & Referenzen – Einrichtung aus dem Drautal",
  description:
    "Einblicke in individuell geplante Küchen und Wohnräume von Wohnideen Hueter. Von der ersten Idee bis zur fertigen Montage – umgesetzt im oberen Drautal.",
  path: "/projekte",
});

export default function ProjektePage() {
  const items = publishedProjects();
  return (
    <>
      <PageHero
        image="/images/hero-projekte.jpg"
        alt="Individuell eingerichtete Räume"
        crumb="Projekte"
        eyebrow="Projekte & Referenzen"
        title={
          <>
            Nicht nur Möbel.
            <br />
            Ganze Räume.
          </>
        }
        lead="Ein Einblick, wie aus Wünschen, Räumen und Alltag eine fertige Einrichtung wird – geplant, geliefert und fachgerecht montiert."
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Auswahl"
            title="Einrichtung, die im Alltag ankommt"
            lead="Ein Einblick, welche Räume wir planen und umsetzen – von der Küche bis zum Gesamtkonzept. Unsere Projektübersicht wächst laufend."
            className="mb-10"
          />
          <ProjectOverview items={items} />
        </Container>
      </Section>

      <CtaBand
        title="Ihr Projekt könnte das nächste sein."
        lead="Erzählen Sie uns von Ihren Räumen und Ihren Ideen – wir hören zu und planen mit Ihnen gemeinsam."
      />
    </>
  );
}
