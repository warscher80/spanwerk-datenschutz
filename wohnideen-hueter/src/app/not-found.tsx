import type { Metadata } from "next";
import { Container } from "@/components/Layout";
import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  description: "Die gewünschte Seite wurde nicht gefunden.",
};

export default function NotFound() {
  return (
    <section className="grid min-h-[70vh] place-items-center bg-cream pb-16 pt-[calc(78px+3rem)] text-center">
      <Container>
        <Eyebrow center>Fehler 404</Eyebrow>
        <h1 className="text-h1 mb-3 mt-4">
          Diese Seite konnten
          <br />
          wir nicht finden.
        </h1>
        <p className="text-lead mx-auto max-w-[34rem] text-ink-soft">
          Vielleicht wurde die Adresse geändert. Kehren Sie zur Startseite zurück
          oder nehmen Sie direkt Kontakt mit uns auf.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3.5">
          <Button href="/" icon="arrow">
            Zur Startseite
          </Button>
          <Button href="/kontakt" variant="ghost" icon="chat">
            Kontakt
          </Button>
        </div>
      </Container>
    </section>
  );
}
