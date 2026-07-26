import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, brands, getCategory } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { Button, TextLink } from "@/components/Button";
import {
  BrandGrid,
  CategoryCard,
  FeatureSplit,
  PlaceholderNote,
  TickList,
} from "@/components/Cards";
import { CtaBand } from "@/components/CtaBand";

/** Nur die Sortiment-Slugs statisch erzeugen; andere Routen sind eigene Ordner. */
export const dynamicParams = false;
export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategory(slug);
  if (!cat) return {};
  return pageMeta({
    title: `${cat.title} – individuell geplant`,
    description: `${cat.lead} Persönliche Planung, Lieferung und Montage bei Wohnideen Hueter in Irschen, Kärnten.`,
    path: `/${cat.slug}`,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = getCategory(slug);
  if (!cat) notFound();

  const others = categories.filter((c) => c.slug !== cat.slug);
  const relBrands = cat.brands
    .map((n) => brands.find((b) => b.name === n))
    .filter((b): b is (typeof brands)[number] => Boolean(b));

  return (
    <>
      <PageHero
        image={`/images/hero-${cat.slug}.svg`}
        alt={`${cat.title} bei Wohnideen Hueter – beispielhafte Darstellung`}
        crumb={cat.title}
        eyebrow={cat.kicker}
        title={cat.title}
        lead={cat.lead}
      />

      {/* Einführung */}
      <Section>
        <Container>
          <FeatureSplit
            image={`/images/feature-${cat.slug}.svg`}
            alt={`${cat.title} – Detailansicht, beispielhafte Darstellung`}
            eyebrow={cat.title}
            title={
              <>
                Individuell geplant,
                <br />
                fachgerecht umgesetzt
              </>
            }
          >
            <p className="text-lead text-ink-soft">{cat.intro}</p>
            {cat.tentative && (
              <p className="mt-4">
                <PlaceholderNote>
                  Sortiment wird erweitert – bitte anfragen
                </PlaceholderNote>
              </p>
            )}
            <div className="mt-6">
              <Button href="/kontakt" icon="chat">
                Beratung zu {cat.title}
              </Button>
            </div>
          </FeatureSplit>
        </Container>
      </Section>

      {/* Leistungen */}
      <Section tone="sand">
        <Container>
          <div className="grid gap-[clamp(1.5rem,3vw,2.5rem)] lg:grid-cols-2">
            <SectionHeader
              eyebrow="Was wir bieten"
              title={<>Leistungen im Bereich {cat.title}</>}
              lead="Alles aus einer Hand – von der ersten Idee bis zur fertigen Montage."
            />
            <div>
              <TickList items={cat.offers} />
              <p className="text-ink-soft">{cat.note}</p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Marken */}
      {relBrands.length > 0 && (
        <Section>
          <Container>
            <SectionHeader
              center
              eyebrow={`Marken für ${cat.title}`}
              title="Ausgewählte Partner"
              className="mb-10"
            />
            <BrandGrid items={relBrands} />
            <p className="mt-8 text-center">
              <TextLink href="/marken">Alle Marken ansehen</TextLink>
            </p>
          </Container>
        </Section>
      )}

      {/* Weiter im Sortiment */}
      <Section tone="sand">
        <Container>
          <SectionHeader
            eyebrow="Weiter im Sortiment"
            title="Alles für Ihr Zuhause"
            className="mb-10"
          />
          <div className="grid gap-[clamp(1.1rem,2vw,1.6rem)] sm:grid-cols-2 lg:grid-cols-3">
            {others.map((c, i) => (
              <CategoryCard
                key={c.slug}
                category={c}
                showKicker={false}
                delay={(i % 3) * 0.08}
              />
            ))}
          </div>
        </Container>
      </Section>

      <CtaBand
        title={
          <>
            Bereit für Ihr Projekt
            <br />
            im Bereich {cat.title}?
          </>
        }
        lead="Wir beraten Sie persönlich und unverbindlich – im Schauraum oder bei Ihnen zu Hause."
      />
    </>
  );
}
