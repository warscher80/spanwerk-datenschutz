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

const SLUG = "schlafen";
const c = getCategory(SLUG)!;
const s = getSortiment(SLUG)!;

export const metadata: Metadata = pageMeta({
  title: s.metaTitle,
  description: s.metaDescription,
  path: `/${SLUG}`,
});

/**
 * Schlafen — ruhig, weiche Übergänge, viel Luft.
 * Kein Bildband (bewusst zurückhaltend). Reihenfolge: Einführung (Bild rechts)
 * → Ordnung/Planung → Ausstattung → Farb-/Materialkonzept → Referenz →
 * persönliche Beratung → Verlinkung → CTA.
 */
export default function SchlafenPage() {
  return (
    <>
      <PageHero
        image={`/images/hero-${SLUG}.jpg`}
        alt="Ruhiges Schlafzimmer in gedämpften Naturtönen"
        crumb={c.title}
        eyebrow={s.heroEyebrow}
        title={c.title}
        lead={c.lead}
      />
      <SortimentIntro
        image={`/images/feature-${SLUG}.jpg`}
        imageAlt="Bett mit Nachtkästchen und weichem Licht"
        eyebrow="Zur Ruhe kommen"
        title={s.introTitle}
        paras={s.introParas}
        reverse
      />
      <PlanningList
        eyebrow="Ordnung & Ruhe"
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
