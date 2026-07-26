import type { Metadata } from "next";
import { EditorialHero } from "@/components/home/Hero";
import {
  TrustStrip,
  Listening,
  Wohnwelten,
  ProcessJourney,
  FeaturedProjects,
  AboutTeaser,
  BrandsQuality,
  HomeCta,
} from "@/components/home/Sections";

export const metadata: Metadata = {
  title: {
    absolute:
      "Wohnideen Hueter – Küchen & Wohnräume persönlich geplant | Irschen, Kärnten",
  },
  description:
    "Individuelle Küchen und Wohnräume aus dem oberen Drautal: persönliche Beratung, individuelle Planung, Lieferung und Montage aus einer Hand. Jetzt Beratungstermin bei Familie Hueter vereinbaren.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Wohnideen Hueter – Räume, die sich nach Zuhause anfühlen",
    description:
      "Persönliche Einrichtungsplanung in Irschen, Kärnten: Küchen, Wohnen, Schlafen, Essen, Vorzimmer und Bad – individuell geplant, geliefert und montiert.",
    url: "/",
    type: "website",
    siteName: "Wohnideen Hueter",
    locale: "de_AT",
    images: [{ url: "/images/og-default.svg", width: 1200, height: 630 }],
  },
};

export default function HomePage() {
  return (
    <>
      <EditorialHero />
      <TrustStrip />
      <Listening />
      <Wohnwelten />
      <ProcessJourney />
      <FeaturedProjects />
      <AboutTeaser />
      <BrandsQuality />
      <HomeCta />
    </>
  );
}
