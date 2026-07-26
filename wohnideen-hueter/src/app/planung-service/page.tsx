import type { Metadata } from "next";
import { advantages, faqs, processSteps, services } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import {
  AdvantageCard,
  FeatureSplit,
  PlaceholderNote,
  ProcessStepCard,
  TickList,
} from "@/components/Cards";
import { CtaBand } from "@/components/CtaBand";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = pageMeta({
  title: "Planung & Service – Ihr Ablauf",
  description:
    "So arbeiten wir: von Beratung und Aufmaß über die individuelle Planung bis zu Lieferung, Montage und persönlicher Nachbetreuung. Ein Ansprechpartner für Ihr ganzes Projekt.",
  path: "/planung-service",
});

export default function PlanungServicePage() {
  return (
    <>
      <PageHero
        image="/images/hero-planung.svg"
        alt="Persönliche Einrichtungsplanung – beispielhafte Darstellung"
        crumb="Planung & Service"
        eyebrow="Planung & Service"
        title={
          <>
            Ein Ansprechpartner.
            <br />
            Für Ihr ganzes Projekt.
          </>
        }
        lead="Wir nehmen Ihnen die Koordination ab – und begleiten Sie von der ersten Idee bis zur fertigen Einrichtung persönlich."
      />

      <Section>
        <Container>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((a, i) => (
              <AdvantageCard key={a.title} advantage={a} delay={(i % 4) * 0.08} />
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="ink">
        <Container>
          <SectionHeader
            light
            eyebrow="Der Ablauf"
            title={
              <>
                In sieben Schritten zu
                <br />
                Ihrer neuen Einrichtung
              </>
            }
            lead="Jeder Schritt schafft Klarheit und nimmt Unsicherheit. Sie wissen immer, wo Ihr Projekt gerade steht."
            className="mb-12"
          />
          <div className="grid gap-px overflow-hidden rounded-panel border border-[#413a32] bg-[#413a32] sm:grid-cols-2 lg:grid-cols-3">
            {processSteps.map((s, i) => (
              <ProcessStepCard key={s.n} step={s} onDark delay={(i % 3) * 0.08} />
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <FeatureSplit
            image="/images/service-1.svg"
            alt="Aufmaß und Planung vor Ort – beispielhafte Darstellung"
            eyebrow="Unsere Services"
            title="Mehr als nur Möbel"
          >
            <TickList
              items={services.map((s) => (
                <span key={s.title}>
                  <strong className="text-ink">{s.title}</strong> – {s.text}
                </span>
              ))}
            />
            <p>
              <PlaceholderNote>
                Weitere Services? Fragen Sie uns – wir finden eine Lösung.
              </PlaceholderNote>
            </p>
          </FeatureSplit>
        </Container>
      </Section>

      {/* FAQ */}
      <Section tone="sand">
        <Container narrow>
          <SectionHeader
            center
            eyebrow="Häufige Fragen"
            title="Gut zu wissen"
            className="mb-10"
          />
          <Reveal>
            <div className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-paper">
              {faqs.map((f) => (
                <details key={f.q} className="group px-6 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-h4 text-ink marker:hidden">
                    {f.q}
                    <span className="text-clay transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-ink-soft">{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
