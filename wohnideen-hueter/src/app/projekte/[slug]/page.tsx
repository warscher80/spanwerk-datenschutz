import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCategory,
  getProject,
  projects,
  type Project,
  type ProjectImage,
} from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { SectionHeader, Eyebrow } from "@/components/SectionHeader";
import { Button, TextLink } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";
import { ProjectGallery } from "@/components/projects/Gallery";
import { ProjectCard } from "@/components/Cards";

export const dynamicParams = false;
export function generateStaticParams() {
  return projects.filter((p) => p.published).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) return {};
  return pageMeta({
    title: `${p.title} – Projekt`,
    description: `${p.summary} Ein Einblick in die Arbeit von Wohnideen Hueter im oberen Drautal.`,
    path: `/projekte/${p.slug}`,
  });
}

/** Baut eine Platzhalter-Galerie aus den Bildern der zugehörigen Wohnwelt. */
function placeholderGallery(p: Project): ProjectImage[] {
  const cat = p.category ?? "wohnen";
  const base: ProjectImage[] = [
    { src: `/images/proj-${p.slug}.svg`, alt: `${p.title} – Gesamtansicht` },
    { src: `/images/feature-${cat}.svg`, alt: `${p.title} – Detail` },
    { src: `/images/detail-${cat}.svg`, alt: `${p.title} – Ausschnitt` },
    { src: `/images/mood-${cat}.svg`, alt: `${p.title} – Raumstimmung` },
  ];
  return base;
}

/** Abschnitt nur rendern, wenn Inhalt vorhanden ist. */
function Story({ label, title, text }: { label: string; title: string; text?: string }) {
  if (!text) return null;
  return (
    <Reveal className="border-t border-line pt-6">
      <p className="text-[0.78rem] font-semibold uppercase tracking-[0.15em] text-clay">{label}</p>
      <h2 className="text-h3 mt-2">{title}</h2>
      <p className="mt-3 text-ink-soft">{text}</p>
    </Reveal>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p || !p.published) notFound();

  const gallery = p.gallery && p.gallery.length ? p.gallery : placeholderGallery(p);
  const services = p.services ?? p.chips;
  const category = p.category ? getCategory(p.category) : undefined;
  const related = (p.related ?? [])
    .map((s) => getProject(s))
    .filter((r): r is Project => Boolean(r && r.published))
    .slice(0, 3);

  return (
    <>
      <PageHero
        image={`/images/proj-${p.slug}.svg`}
        alt={`${p.title}`}
        crumb={
          <>
            <Link href="/projekte" className="hover:text-white hover:underline">
              Projekte
            </Link>{" "}
            · {p.title}
          </>
        }
        eyebrow={p.tag}
        title={p.title}
        lead={p.summary}
      />

      {/* Zusammenfassung + Leistungen/Meta */}
      <Section>
        <Container>
          <div className="grid gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[1.4fr_0.6fr]">
            <Reveal>
              <div>
                <Eyebrow>Über dieses Projekt</Eyebrow>
                <p className="text-lead mt-4 text-ink-soft">{p.summary}</p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <dl className="rounded-panel border border-line bg-paper p-6 shadow-soft">
                <div>
                  <dt className="text-[0.72rem] uppercase tracking-[0.15em] text-ink-mute">Raumkategorie</dt>
                  <dd className="mt-1 font-medium text-ink">{p.tag}</dd>
                </div>
                {p.location && (
                  <div className="mt-4">
                    <dt className="text-[0.72rem] uppercase tracking-[0.15em] text-ink-mute">Ort</dt>
                    <dd className="mt-1 font-medium text-ink">{p.location}</dd>
                  </div>
                )}
                <div className="mt-4">
                  <dt className="text-[0.72rem] uppercase tracking-[0.15em] text-ink-mute">Leistungen</dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {services.map((c) => (
                      <span key={c} className="rounded-full border border-line bg-cream px-2.5 py-1 text-[0.75rem] font-medium text-ink-soft">
                        {c}
                      </span>
                    ))}
                  </dd>
                </div>
                {p.materials && p.materials.length > 0 && (
                  <div className="mt-4">
                    <dt className="text-[0.72rem] uppercase tracking-[0.15em] text-ink-mute">Materialien</dt>
                    <dd className="mt-1 text-ink-soft">{p.materials.join(", ")}</dd>
                  </div>
                )}
              </dl>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* Erzählabschnitte – blenden sich aus, wenn keine Daten vorhanden sind */}
      {(p.situation || p.wishes || p.planningIdea || p.result) && (
        <Section tone="sand">
          <Container narrow>
            <div className="grid gap-8">
              <Story label="Ausgangssituation" title="Wie es war" text={p.situation} />
              <Story label="Wünsche & Anforderungen" title="Was gewünscht war" text={p.wishes} />
              <Story label="Planungsidee" title="Unser Ansatz" text={p.planningIdea} />
              {p.highlights && p.highlights.length > 0 && (
                <Reveal className="border-t border-line pt-6">
                  <p className="text-[0.78rem] font-semibold uppercase tracking-[0.15em] text-clay">Besondere Lösungen</p>
                  <ul className="mt-3 grid gap-2">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2.5 text-ink-soft">
                        <Icon name="check" size={0.95} className="mt-1 text-clay" /> {h}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              )}
              <Story label="Ergebnis" title="Wie es wurde" text={p.result} />
            </div>
          </Container>
        </Section>
      )}

      {/* Bildergalerie */}
      <Section>
        <Container>
          <SectionHeader
            eyebrow="Eindrücke"
            title="Bildergalerie"
            lead="Klicken oder mit der Tastatur öffnen, um die Bilder groß zu sehen."
            className="mb-8"
          />
          <Reveal>
            <ProjectGallery images={gallery} />
          </Reveal>
        </Container>
      </Section>

      {/* Passende Wohnwelt */}
      {category && (
        <Section tone="sand">
          <Container>
            <Reveal>
              <div className="flex flex-col items-start justify-between gap-5 rounded-panel border border-line bg-paper p-[clamp(1.5rem,4vw,2.5rem)] shadow-soft sm:flex-row sm:items-center">
                <div>
                  <Eyebrow>Passende Wohnwelt</Eyebrow>
                  <h2 className="text-h3 mt-3">{category.title} bei Wohnideen Hueter</h2>
                  <p className="mt-2 max-w-[46ch] text-ink-soft">{category.kicker}.</p>
                </div>
                <Button href={`/${category.slug}`} variant="ghost" iconRight="arrow">
                  {category.title} entdecken
                </Button>
              </div>
            </Reveal>
          </Container>
        </Section>
      )}

      {/* Verwandte Projekte */}
      {related.length > 0 && (
        <Section>
          <Container>
            <SectionHeader eyebrow="Weitere Projekte" title="Das könnte Sie auch interessieren" className="mb-10" />
            <div className="grid gap-[clamp(1.1rem,2vw,1.6rem)] sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r, i) => (
                <ProjectCard key={r.slug} project={r} delay={(i % 3) * 0.07} />
              ))}
            </div>
            <p className="mt-8">
              <TextLink href="/projekte">Alle Projekte ansehen</TextLink>
            </p>
          </Container>
        </Section>
      )}

      <CtaBand
        title="Planen wir Ihr nächstes Projekt."
        lead="Erzählen Sie uns von Ihren Räumen und Ideen – wir entwickeln daraus eine Lösung, die zu Ihnen passt."
      />
    </>
  );
}
