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

const SLUG = "wohnen";
const c = getCategory(SLUG)!;
const s = getSortiment(SLUG)!;

export const metadata: Metadata = pageMeta({
  title: s.metaTitle,
  description: s.metaDescription,
  path: `/${SLUG}`,
});

/**
 * Wohnen — emotional & bildstark.
 * Reihenfolge: Einführung → großes Bildband → Planung → Lösungen → Materialien
 * → Referenz → Verlinkung → CTA.
 */
export default function WohnenPage() {
  return (
    <>
      <PageHero
        image={`/images/hero-${SLUG}.jpg`}
        alt="Warmer, wohnlicher Wohnraum mit Sofa und Wohnwand"
        crumb={c.title}
        eyebrow={s.heroEyebrow}
        title={c.title}
        lead={c.lead}
      />
      <SortimentIntro
        image={`/images/feature-${SLUG}.jpg`}
        imageAlt="Gemütliche Sitzecke mit warmer Beleuchtung"
        eyebrow="Zuhause ankommen"
        title={s.introTitle}
        paras={s.introParas}
      />
      <MoodBand
        image={`/images/mood-${SLUG}.jpg`}
        imageAlt="Großzügiger Wohnraum in warmen Naturtönen"
        statement={s.moodStatement!}
      />
      <PlanningList
        eyebrow="Raumkonzept"
        title={s.planningTitle}
        lead={s.planningLead}
        points={s.planningPoints}
        tone="cream"
      />
      <FeatureGrid
        eyebrow={s.featuresEyebrow}
        title={s.featuresTitle}
        features={s.features}
        tone="sand"
      />
      <MaterialPalette
        title={s.materialsTitle}
        lead={s.materialsLead}
        materials={s.materials}
        tone="cream"
      />
      <ProjectHighlight slug={s.projectSlug} tone="sand" reverse />
      <CrossLinks title={s.crossTitle} links={s.crossLinks} tone="cream" />
      <CtaBand title={s.ctaTitle} lead={s.ctaLead} />
    </>
  );
}
