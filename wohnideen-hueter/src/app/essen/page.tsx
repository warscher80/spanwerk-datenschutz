import type { Metadata } from "next";
import { getCategory } from "@/lib/site";
import { getSortiment } from "@/lib/sortiment";
import { pageMeta } from "@/lib/seo";
import { PageHero } from "@/components/Hero";
import { CtaBand } from "@/components/CtaBand";
import {
  SortimentIntro,
  PlanningList,
  FeatureGrid,
  MaterialPalette,
  MoodBand,
  ProjectHighlight,
  CrossLinks,
} from "@/components/sortiment/Sections";

const SLUG = "essen";
const c = getCategory(SLUG)!;
const s = getSortiment(SLUG)!;

export const metadata: Metadata = pageMeta({
  title: s.metaTitle,
  description: s.metaDescription,
  path: `/${SLUG}`,
});

/**
 * Essen — gemeinschaftliche Atmosphäre, horizontale Bildführung.
 * Reihenfolge: Einführung → Lösungen rund um den Tisch → Bildband →
 * Platzbedarf/Planung → Materialien → Referenz → Verlinkung → CTA.
 */
export default function EssenPage() {
  return (
    <>
      <PageHero
        image={`/images/hero-${SLUG}.svg`}
        alt="Gedeckter Esstisch mit Stühlen und Hängeleuchte"
        crumb={c.title}
        eyebrow={s.heroEyebrow}
        title={c.title}
        lead={c.lead}
      />
      <SortimentIntro
        image={`/images/feature-${SLUG}.svg`}
        imageAlt="Massivholztisch mit Bank im Essbereich"
        eyebrow="Der Treffpunkt im Haus"
        title={s.introTitle}
        paras={s.introParas}
      />
      <FeatureGrid
        eyebrow={s.featuresEyebrow}
        title={s.featuresTitle}
        features={s.features}
        tone="sand"
      />
      <MoodBand
        image={`/images/mood-${SLUG}.svg`}
        imageAlt="Langer Esstisch mit vielen Sitzplätzen"
        statement={s.moodStatement!}
      />
      <PlanningList
        eyebrow="Platz & Anlass"
        title={s.planningTitle}
        lead={s.planningLead}
        points={s.planningPoints}
        tone="cream"
      />
      <MaterialPalette
        title={s.materialsTitle}
        lead={s.materialsLead}
        materials={s.materials}
        tone="sand"
      />
      <ProjectHighlight slug={s.projectSlug} tone="cream" />
      <CrossLinks title={s.crossTitle} links={s.crossLinks} tone="sand" />
      <CtaBand title={s.ctaTitle} lead={s.ctaLead} />
    </>
  );
}
