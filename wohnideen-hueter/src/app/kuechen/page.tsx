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
  ServiceNote,
  CrossLinks,
} from "@/components/sortiment/Sections";

const SLUG = "kuechen";
const c = getCategory(SLUG)!;
const s = getSortiment(SLUG)!;

export const metadata: Metadata = pageMeta({
  title: s.metaTitle,
  description: s.metaDescription,
  path: `/${SLUG}`,
});

/**
 * Küchen — Planungsfokus, klare Linien.
 * Reihenfolge: Einführung → Planungslogik → Funktionen → Materialien →
 * Referenz → Service aus einer Hand → Verlinkung → CTA.
 */
export default function KuechenPage() {
  return (
    <>
      <PageHero
        image={`/images/hero-${SLUG}.svg`}
        alt="Individuell geplante Wohnküche in warmen Tönen – beispielhafte Darstellung"
        crumb={c.title}
        eyebrow={s.heroEyebrow}
        title={c.title}
        lead={c.lead}
      />
      <SortimentIntro
        image={`/images/feature-${SLUG}.svg`}
        imageAlt="Küchenzeile mit durchdachtem Stauraum – beispielhafte Darstellung"
        eyebrow="Küchen mit Charakter"
        title={s.introTitle}
        paras={s.introParas}
      />
      <PlanningList
        eyebrow="Planung"
        title={s.planningTitle}
        lead={s.planningLead}
        points={s.planningPoints}
      />
      <FeatureGrid eyebrow={s.featuresEyebrow} title={s.featuresTitle} features={s.features} />
      <MaterialPalette title={s.materialsTitle} lead={s.materialsLead} materials={s.materials} />
      <ProjectHighlight slug={s.projectSlug} />
      <ServiceNote title={s.serviceTitle} text={s.serviceText} tone="sand" />
      <CrossLinks title={s.crossTitle} links={s.crossLinks} tone="cream" />
      <CtaBand title={s.ctaTitle} lead={s.ctaLead} />
    </>
  );
}
