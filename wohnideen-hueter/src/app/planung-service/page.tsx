import type { Metadata } from "next";
import { faqs, planningFlow, preparation, services } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { ContactCta } from "@/components/ContactCta";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = pageMeta({
  title: "Planung & Service – von der ersten Idee zum fertigen Raum",
  description:
    "So arbeiten wir: Erstgespräch, Aufmaß, Planung, Materialauswahl, Lieferung und Montage – aus einer Hand. Mit hilfreichen Tipps zur Vorbereitung und Antworten auf häufige Fragen.",
  path: "/planung-service",
});

// FAQ-Schema nur aus tatsächlich sichtbaren, allgemein gültigen Antworten.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function PlanungServicePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <PageHero
        image="/images/hero-planung.jpg"
        alt="Persönliche Einrichtungsplanung mit Aufmaß und Entwurf"
        crumb="Planung & Service"
        eyebrow="Planung & Service"
        title={
          <>
            Von der ersten Idee
            <br />
            bis zum fertigen Raum.
          </>
        }
        lead="Persönliche Beratung, durchdachte Planung und zuverlässige Umsetzung aus einer Hand – Sie haben einen Ansprechpartner für das ganze Projekt."
      />

      {/* Der Ablauf – 8 Schritte mit Erwartung & Vorbereitung */}
      <Section>
        <Container>
          <SectionHeader
            eyebrow="Der Ablauf"
            title="So arbeiten wir zusammen"
            lead="Jeder Schritt schafft Klarheit. Sie wissen immer, was als Nächstes kommt und was Sie erwartet."
            className="mb-14"
          />
          <ol className="grid gap-x-10 gap-y-12 md:grid-cols-2">
            {planningFlow.map((s) => (
              <Reveal as="li" key={s.n} className="relative border-t border-line pt-7">
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-1 top-4 font-display text-[4rem] leading-none text-clay/10"
                >
                  {s.n}
                </span>
                <p className="font-display text-[0.85rem] font-semibold tracking-[0.2em] text-clay">
                  {s.n}
                </p>
                <h3 className="mt-2 font-display text-[1.5rem] text-ink">{s.title}</h3>
                <p className="mt-2 text-ink-soft">{s.text}</p>
                <div className="mt-4 grid gap-2 text-[0.9rem]">
                  <p className="flex items-start gap-2 text-ink-soft">
                    <Icon name="check" size={0.95} className="mt-1 flex-none text-clay" />
                    <span>
                      <span className="font-semibold text-ink">Das erwartet Sie:</span>{" "}
                      {s.expect}
                    </span>
                  </p>
                  {s.prep && (
                    <p className="flex items-start gap-2 text-ink-mute">
                      <Icon name="chat" size={0.95} className="mt-1 flex-none text-clay" />
                      <span>
                        <span className="font-semibold text-ink-soft">Gut vorbereitet:</span>{" "}
                        {s.prep}
                      </span>
                    </p>
                  )}
                </div>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Leistungen */}
      <Section tone="sand">
        <Container>
          <SectionHeader
            eyebrow="Leistungen"
            title="Was wir für Sie übernehmen"
            lead="Alles, was zur Einrichtung gehört – aus einer Hand und persönlich betreut."
            className="mb-10"
          />
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((sv, i) => (
              <Reveal key={sv.title} delay={(i % 3) * 0.07} className="border-t border-line pt-5">
                <h3 className="font-display text-[1.3rem] text-ink">{sv.title}</h3>
                <p className="mt-2 text-[0.96rem] text-ink-soft">{sv.text}</p>
              </Reveal>
            ))}
          </div>
          {/* Ehrlicher Hinweis zu Fremdgewerken – nichts behaupten, was Dritte erbringen. */}
          <Reveal>
            <p className="mt-10 max-w-[52rem] rounded-panel border border-line bg-paper p-5 text-[0.92rem] text-ink-soft">
              <span className="font-semibold text-ink">Transparent:</span> Planung,
              Beratung, Lieferung und Möbelmontage übernehmen wir selbst. Einzelne
              Gewerke wie Elektro- oder Sanitärinstallation erfolgen bei Bedarf über
              Ihre Fachbetriebe – wir sagen Ihnen von Anfang an klar, was zu unserem
              Angebot gehört und was nicht.
              {/* TODO: genauen Leistungsumfang & Partnermodell mit Familie Hueter bestätigen. */}
            </p>
          </Reveal>
        </Container>
      </Section>

      {/* Gut vorbereitet zum Beratungsgespräch */}
      <Section>
        <Container>
          <SectionHeader
            eyebrow="Vor dem Termin"
            title="Gut vorbereitet zum Beratungsgespräch"
            lead="Nichts davon ist Voraussetzung – es hilft uns nur, schneller ein gutes Bild zu bekommen. Kommen Sie ruhig auch ganz ohne Vorbereitung."
            className="mb-10"
          />
          <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {preparation.map((item, i) => (
              <Reveal as="li" key={item.title} delay={(i % 3) * 0.06} className="flex gap-3.5">
                <span className="mt-0.5 grid size-9 flex-none place-items-center rounded-full bg-clay-tint text-clay">
                  <Icon name="check" size={1.1} />
                </span>
                <div>
                  <h3 className="font-display text-[1.2rem] text-ink">{item.title}</h3>
                  <p className="mt-1 text-[0.94rem] text-ink-soft">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      {/* FAQ */}
      <Section tone="sand">
        <Container narrow>
          <SectionHeader center eyebrow="Häufige Fragen" title="Gut zu wissen" className="mb-10" />
          <Reveal>
            <div className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-paper">
              {faqs.map((f) => (
                <details key={f.q} className="group px-6 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[1.2rem] text-ink marker:hidden">
                    {f.q}
                    <span
                      aria-hidden
                      className="text-clay transition-transform duration-200 group-open:rotate-45"
                    >
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

      <ContactCta
        title={
          <>
            Der erste Schritt ist ein
            <br />
            persönliches Gespräch.
          </>
        }
        lead="Vereinbaren Sie einen unverbindlichen Beratungstermin – im Schauraum in Irschen oder bei Ihnen zu Hause."
      />
    </>
  );
}
