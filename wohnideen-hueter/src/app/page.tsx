import type { Metadata } from "next";
import { BrandHero } from "@/components/home/Hero";
import {
  Statement,
  Wohnwelten,
  HomeProjects,
  Approach,
  TrustBlock,
  ClosingCta,
} from "@/components/home/Sections";

export const metadata: Metadata = {
  title: {
    absolute:
      "Wohnideen Hueter – Küchen & Wohnräume, individuell geplant | Irschen, Kärnten",
  },
  description:
    "Wohnideen Hueter plant individuelle Küchen und Wohnräume – persönlich, ganzheitlich und präzise umgesetzt. Ihr Partner für Lebensräume im oberen Drautal.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Wohnideen Hueter – Räume sind mehr als Einrichtung",
    description:
      "Individuelle Küchen und Wohnräume, persönlich geplant und präzise umgesetzt. Studio in Irschen, Kärnten.",
    url: "/",
    type: "website",
    siteName: "Wohnideen Hueter",
    locale: "de_AT",
    images: [{ url: "/images/og-default.jpg", width: 1200, height: 630 }],
  },
};

export default function HomePage() {
  return (
    <>
      <BrandHero />
      <Statement />
      <Wohnwelten />
      <HomeProjects />
      <Approach />
      <TrustBlock />
      <ClosingCta />
    </>
  );
}
