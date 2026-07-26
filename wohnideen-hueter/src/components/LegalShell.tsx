import type { ReactNode } from "react";
import { Container } from "./Layout";
import { Eyebrow } from "./SectionHeader";
import { Reveal } from "./Reveal";

/**
 * Rahmen für Rechtstexte. Enthält den nötigen oberen Abstand, da diese Seiten
 * kein dunkles Hero haben und der Header fix positioniert ist.
 */
export function LegalShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-cream pb-[clamp(3.5rem,8vw,7rem)] pt-[calc(68px+clamp(2.5rem,6vw,4.5rem))]">
      <Container>
        <Reveal className="prose-legal">
          <Eyebrow>Rechtliches</Eyebrow>
          <h1 className="text-h1 mb-3 mt-4">{title}</h1>
          {intro}
          {children}
        </Reveal>
      </Container>
    </section>
  );
}
