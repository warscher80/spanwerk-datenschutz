import type { Metadata } from "next";
import { publishedProjects } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader, Eyebrow } from "@/components/SectionHeader";
import { CtaBand } from "@/components/CtaBand";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";
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
        image="/images/hero-projekte.svg"
        alt="Individuell eingerichtete Räume – beispielhafte Darstellung"
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
          {/* Ehrlicher Platzhalter-Hinweis, solange keine echten Projektfotos vorliegen. */}
          <Reveal>
            <div className="mb-10 flex items-start gap-4 rounded-panel border border-line bg-clay-tint/50 p-6">
              <Icon name="pin" size={1.5} className="mt-0.5 flex-none text-clay" />
              <p className="text-[0.95rem] leading-relaxed text-ink-soft">
                Die folgenden Projekte sind aktuell{" "}
                <strong className="text-ink">Platzhalter</strong> und zeigen die
                geplante Darstellung. Sobald Fotos und Details echter Projekte
                vorliegen, treten sie an ihre Stelle – ohne erfundene Namen, Orte
                oder Angaben. {/* TODO: echte Projektdaten einpflegen (siehe CONTENT-NEEDED.md) */}
              </p>
            </div>
          </Reveal>

          <SectionHeader
            eyebrow="Auswahl"
            title="Einrichtung, die im Alltag ankommt"
            lead="Jedes Projekt entsteht individuell. Wählen Sie einen Bereich, um mehr zu sehen."
            className="mb-10"
          />
          <ProjectOverview items={items} />
        </Container>
      </Section>

      {/* Kundenstimmen – nur echte Inhalte, sonst ehrlicher Platzhalter */}
      <Section tone="sand">
        <Container narrow>
          <Reveal className="text-center">
            <Eyebrow center>Kundenstimmen</Eyebrow>
            <p className="text-lead mx-auto mt-4 max-w-[40rem] text-ink-soft">
              Wir zeigen hier ausschließlich echte, freigegebene Rückmeldungen
              unserer Kundinnen und Kunden.
            </p>
            {/* TODO: Echte, freigegebene Kundenstimme(n) einsetzen. Keine erfundenen Bewertungen. */}
            <p className="mx-auto mt-6 max-w-[30rem] rounded-panel border border-dashed border-line bg-paper px-6 py-8 text-[0.9rem] text-ink-mute">
              Platzhalter – hier erscheinen echte Kundenstimmen, sobald sie mit
              Einverständnis vorliegen.
            </p>
          </Reveal>
        </Container>
      </Section>

      <CtaBand
        title="Ihr Projekt könnte das nächste sein."
        lead="Erzählen Sie uns von Ihren Räumen und Ihren Ideen – wir hören zu und planen mit Ihnen gemeinsam."
      />
    </>
  );
}
