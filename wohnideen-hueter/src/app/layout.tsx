import type { Metadata } from "next";
import "./globals.css";
import { display, sans, mono } from "@/lib/fonts";
import { SITE_URL, localBusinessJsonLd } from "@/lib/seo";
import { site } from "@/lib/site";
import { asset } from "@/lib/asset";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileCta } from "@/components/MobileCta";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "Wohnideen Hueter – Persönliche Einrichtungsplanung in Irschen, Kärnten",
    template: "%s | Wohnideen Hueter",
  },
  description:
    "Ihr persönliches Einrichtungshaus im oberen Drautal: Küchen, Wohn-, Schlaf-, Ess- und Vorzimmer individuell geplant, geliefert und montiert.",
  applicationName: site.name,
  authors: [{ name: site.legalName }],
  icons: {
    icon: [{ url: asset("/images/favicon.svg"), type: "image/svg+xml" }],
    apple: [{ url: asset("/images/favicon.svg") }],
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#0e0f11",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="de"
      className={`no-js ${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        {/* Ohne JS bleibt Inhalt sichtbar; mit JS übernehmen die Reveal-Animationen. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.remove('no-js');document.documentElement.classList.add('js');",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
      </head>
      <body className="antialiased pb-[60px] nav:pb-0">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-[100] focus:rounded-br-lg focus:bg-ink focus:px-4 focus:py-3 focus:text-white"
        >
          Zum Inhalt springen
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <MobileCta />
      </body>
    </html>
  );
}
