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
  ProjectHighlight,
  ScopeNote,
  CrossLinks,
} from "@/components/sortiment/Sections";

const SLUG = "bad";
const c = getCategory(SLUG)!;
const s = getSortiment(SLUG)!;

export const metadata: Metadata = pageMeta({
  title: s.metaTitle,
  description: s.metaDescription,
  path: `/${SLUG}`,
});

/**
 * Bad — klar, reduziert, materialnah.
 * Enthält einen bewusst sichtbaren, ehrlichen Hinweis zum Leistungsumfang
 * (keine Sanitär-/Installateurleistung behauptet).
 * Reihenfolge: Einführung → ehrlicher Hinweis → Planung → Lösungen →
 * Materialien → Referenz → Verlinkung → CTA.
 */
export default function BadPage() {
  return (
    <>
      <PageHero
        image={`/images/hero-${SLUG}.svg`}
        alt="Wohnliches Badezimmer mit Badmöbeln und warmem Licht"
        crumb={c.title}
        eyebrow={s.heroEyebrow}
        title={c.title}
        lead={c.lead}
      />
      <SortimentIntro
        image={`/images/feature-${SLUG}.svg`}
        imageAlt="Waschtisch mit Unterschrank und Spiegel"
        eyebrow="Mehr als eine Nasszelle"
        title={s.introTitle}
        paras={s.introParas}
      />
      {s.scopeNote && <ScopeNote text={s.scopeNote} />}
      <PlanningList
        eyebrow="Planung"
        title={s.planningTitle}
        lead={s.planningLead}
        points={s.planningPoints}
      />
      <FeatureGrid eyebrow={s.featuresEyebrow} title={s.featuresTitle} features={s.features} />
      <MaterialPalette title={s.materialsTitle} lead={s.materialsLead} materials={s.materials} />
      <ProjectHighlight slug={s.projectSlug} tone="cream" />
      <CrossLinks title={s.crossTitle} links={s.crossLinks} tone="sand" />
      <CtaBand title={s.ctaTitle} lead={s.ctaLead} />
    </>
  );
}
