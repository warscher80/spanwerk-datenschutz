import type { ReactNode } from "react";
import { site } from "@/lib/site";
import { Button } from "./Button";
import { Eyebrow } from "./SectionHeader";
import { Reveal } from "./Reveal";
import { Container, Section } from "./Layout";

interface CtaBandProps {
  title?: ReactNode;
  lead?: string;
}

/** Emotionaler Abschluss-CTA (Beratung/Termin/Anruf). */
export function CtaBand({
  title = (
    <>
      Lassen Sie uns gemeinsam
      <br />
      Ihren Wohnraum planen.
    </>
  ),
  lead = "Vereinbaren Sie einen unverbindlichen Beratungstermin – im Schauraum oder bei Ihnen zu Hause.",
}: CtaBandProps) {
  return (
    <Section>
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-panel bg-ink px-[clamp(1.5rem,5vw,4.5rem)] py-[clamp(2.5rem,6vw,4.5rem)] text-center text-white">
            <div
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 0%,rgba(156,107,78,.5),transparent 60%)",
              }}
            />
            <div className="relative">
              <Eyebrow center light>
                Ihr nächster Schritt
              </Eyebrow>
              <h2 className="text-h2 mb-3 mt-4 text-white">{title}</h2>
              <p className="text-lead mx-auto mb-8 max-w-[36rem] text-white/85">
                {lead}
              </p>
              <div className="flex flex-wrap justify-center gap-3.5">
                <Button href="/kontakt" variant="primary" icon="chat">
                  Beratungstermin vereinbaren
                </Button>
                <Button href={site.phoneHref} variant="light" icon="phone">
                  {site.phoneDisplay}
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
