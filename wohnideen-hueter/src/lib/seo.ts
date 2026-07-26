import type { Metadata } from "next";
import { site, serviceArea } from "./site";

/** Basis-URL für Canonicals/OG (Zieldomain, Root). */
export const SITE_URL = site.url;

/**
 * Erzeugt konsistente Seiten-Metadaten (Title, Description, Canonical, OG).
 * `path` ist der Routenpfad ("/" oder "/kuechen").
 */
export function pageMeta({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = path === "/" ? "/" : path;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: site.name,
      locale: "de_AT",
      images: [{ url: "/images/og-default.svg", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/og-default.svg"],
    },
  };
}

/** LocalBusiness / FurnitureStore JSON-LD (strukturierte Daten). */
export const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "FurnitureStore",
  "@id": `${SITE_URL}/#business`,
  name: site.name,
  legalName: site.legalName,
  description:
    "Persönliches Einrichtungshaus im oberen Drautal (Kärnten): individuelle Planung von Küchen, Wohn-, Schlaf-, Ess- und Vorzimmern inkl. Lieferung, Montage und Nachbetreuung.",
  url: `${SITE_URL}/`,
  telephone: site.phone,
  email: site.email,
  image: `${SITE_URL}/images/og-default.svg`,
  priceRange: "€€–€€€",
  address: {
    "@type": "PostalAddress",
    streetAddress: site.address.street,
    postalCode: site.address.zip,
    addressLocality: site.address.city,
    addressRegion: site.address.region,
    addressCountry: site.address.countryCode,
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: site.address.lat,
    longitude: site.address.lng,
  },
  areaServed: serviceArea.map((a) => ({ "@type": "Place", name: a })),
  openingHours: "Mo-Sa by appointment",
  sameAs: [site.social.facebook],
};
