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

const SLUG = "vorzimmer";
const c = getCategory(SLUG)!;
const s = getSortiment(SLUG)!;

export const metadata: Metadata = pageMeta({
  title: s.metaTitle,
  description: s.metaDescription,
  path: `/${SLUG}`,
});

/**
 * Vorzimmer — kompakt, clever, Stauraumfokus.
 * Reihenfolge: Einführung → schwierige Grundrisse/Planung → Lösungen →
 * robuste Materialien → „keine Nebensache“-Service → Referenz → Verlinkung → CTA.
 */
export default function VorzimmerPage() {
  return (
    <>
      <PageHero
        image={`/images/hero-${SLUG}.svg`}
        alt="Garderobe nach Maß in einem schmalen Vorzimmer"
        crumb={c.title}
        eyebrow={s.heroEyebrow}
        title={c.title}
        lead={c.lead}
      />
      <SortimentIntro
        image={`/images/feature-${SLUG}.svg`}
        imageAlt="Eingangsbereich mit Garderobe, Bank und Spiegel"
        eyebrow="Der erste Raum"
        title={s.introTitle}
        paras={s.introParas}
      />
      <PlanningList
        eyebrow="Maßarbeit"
        title={s.planningTitle}
        lead={s.planningLead}
        points={s.planningPoints}
      />
      <FeatureGrid eyebrow={s.featuresEyebrow} title={s.featuresTitle} features={s.features} />
      <MaterialPalette title={s.materialsTitle} lead={s.materialsLead} materials={s.materials} />
      <ServiceNote title={s.serviceTitle} text={s.serviceText} tone="cream" />
      <ProjectHighlight slug={s.projectSlug} tone="sand" reverse />
      <CrossLinks title={s.crossTitle} links={s.crossLinks} tone="cream" />
      <CtaBand title={s.ctaTitle} lead={s.ctaLead} />
    </>
  );
}
