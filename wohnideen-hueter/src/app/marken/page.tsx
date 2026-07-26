import type { Metadata } from "next";
import { brands } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { ContactCta } from "@/components/ContactCta";
import { Reveal } from "@/components/Reveal";
import { TextLink } from "@/components/Button";

const find = (name: string) => brands.find((b) => b.name === name);

/**
 * Marken nach Einsatzbereichen gruppiert. Beschreibungen sind kurz, sachlich und
 * eigenständig – keine kopierten Herstellertexte, keine Exklusivpartnerschaften.
 * TODO: Markenliste & Zuordnung mit Familie Hueter final abgleichen.
 */
const groups: {
  title: string;
  text: string;
  link?: { href: string; label: string };
  brands: string[];
}[] = [
  {
    title: "Küche & Geräte",
    text: "Küchenmöbel, Elektrogeräte und Spülen für das tägliche Kochen und Vorbereiten.",
    link: { href: "/kuechen", label: "Zur Küchenplanung" },
    brands: ["ewe", "FM Küchen", "Siemens", "Blanco"],
  },
  {
    title: "Polstermöbel & Wohnen",
    text: "Sofas und Sitzmöbel in unterschiedlichen Stoffen und Ledern für den Wohnraum.",
    link: { href: "/wohnen", label: "Zum Bereich Wohnen" },
    brands: ["Koinor", "Rauchenzauner", "ADA Austria"],
  },
  {
    title: "Schlafen & Massivholz",
    text: "Betten, Schlafsysteme und Massivholzmöbel für Schlaf- und Wohnräume.",
    link: { href: "/schlafen", label: "Zum Bereich Schlafen" },
    brands: ["elastica", "Schösswender", "ANREI"],
  },
  {
    title: "Textilien & Wohnaccessoires",
    text: "Vorhänge, Stoffe und Accessoires, die Räumen Wärme und Charakter geben.",
    link: { href: "/wohnen", label: "Wohnideen ansehen" },
    brands: ["JAB Anstoetz", "Fine"],
  },
  {
    title: "Wohn- & Vorzimmermöbel",
    text: "Möbelsysteme für Wohnräume und Eingangsbereiche.",
    link: { href: "/vorzimmer", label: "Zum Bereich Vorzimmer" },
    brands: ["Sangiacomo", "Satler"],
  },
  {
    title: "Bodenbeläge",
    text: "Böden, die zur Einrichtung passen und den Raum abrunden.",
    brands: ["Woodbase"],
  },
];

export const metadata: Metadata = pageMeta({
  title: "Marken & Hersteller – ausgewählte Qualität",
  description:
    "Ausgewählte Marken und Hersteller für Küchen, Polstermöbel, Schlafen, Textilien und Böden – aus Österreich und Europa. Herstellerübergreifend und ehrlich beraten.",
  path: "/marken",
});

export default function MarkenPage() {
  return (
    <>
      <PageHero
        image="/images/hero-marken.svg"
        alt="Hochwertige Materialien und Oberflächen – beispielhafte Darstellung"
        crumb="Marken"
        eyebrow="Marken & Hersteller"
        title="Qualität, die man täglich spürt."
        lead="Wir arbeiten mit ausgewählten Herstellern aus Österreich und Europa, die für gutes Handwerk, ehrliche Materialien und Langlebigkeit stehen."
      />

      <Section>
        <Container>
          <Reveal className="max-w-[48rem]">
            <p className="text-lead text-ink-soft">
              Nicht jede Marke passt zu jedem Zuhause. Deshalb beraten wir
              herstellerübergreifend und wählen gemeinsam mit Ihnen aus, was für
              Ihr Projekt, Ihren Stil und Ihr Budget am besten geeignet ist.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-2">
            {groups.map((g, gi) => (
              <Reveal key={g.title} delay={(gi % 2) * 0.08}>
                <div className="border-t border-line pt-7">
                  <h2 className="font-display text-[1.6rem] text-ink">{g.title}</h2>
                  <p className="mt-2 max-w-[46ch] text-ink-soft">{g.text}</p>
                  <ul className="mt-5 flex flex-wrap gap-2.5">
                    {g.brands.map((name) => {
                      const b = find(name);
                      return (
                        <li
                          key={name}
                          className="rounded-full border border-line bg-paper px-4 py-2 text-[0.95rem] font-medium text-ink"
                          title={b?.note}
                        >
                          {name}
                        </li>
                      );
                    })}
                  </ul>
                  {g.link && (
                    <p className="mt-5">
                      <TextLink href={g.link.href}>{g.link.label}</TextLink>
                    </p>
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p className="mx-auto mt-14 max-w-[52rem] text-center text-[0.88rem] text-ink-mute">
              Alle genannten Marken sind Eigentum der jeweiligen Hersteller und
              dienen der sachlichen Information. Die Auswahl wird laufend
              aktualisiert; sie stellt keine Exklusivpartnerschaft dar.
            </p>
          </Reveal>
        </Container>
      </Section>

      <ContactCta
        eyebrow="Beratung"
        title="Welche Marke passt zu Ihrem Zuhause?"
        lead="Wir beraten Sie herstellerübergreifend und ehrlich – abgestimmt auf Ihr Projekt, Ihren Stil und Ihr Budget."
      />
    </>
  );
}
