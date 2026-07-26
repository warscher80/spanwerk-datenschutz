import type { Metadata } from "next";
import type { ReactNode } from "react";
import { people, site } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { Container, Section } from "@/components/Layout";
import { PageHero } from "@/components/Hero";
import { Eyebrow } from "@/components/SectionHeader";
import { ContactForm } from "@/components/ContactForm";
import { MapConsent } from "@/components/MapConsent";
import { Reveal } from "@/components/Reveal";
import { Icon, type IconName } from "@/components/Icon";
import { TextLink } from "@/components/Button";

export const metadata: Metadata = pageMeta({
  title: "Kontakt & Beratungstermin",
  description:
    "Vereinbaren Sie einen persönlichen Beratungstermin bei Wohnideen Hueter in Irschen, Kärnten. Telefon, E-Mail, Anfrageformular, Anfahrt und Öffnungszeiten.",
  path: "/kontakt",
});

const contactPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Kontakt – Wohnideen Hueter",
  mainEntity: {
    "@type": "FurnitureStore",
    name: site.name,
    telephone: site.phone,
    email: site.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      postalCode: site.address.zip,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      addressCountry: site.address.countryCode,
    },
  },
};

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 rounded-card border border-line bg-paper p-6">
      <Icon name={icon} size={1.5} className="mt-0.5 text-clay" />
      <div>
        <h3 className="text-h4 mb-1">{title}</h3>
        <div className="text-[0.95rem] text-ink-soft">{children}</div>
      </div>
    </div>
  );
}

export default function KontaktPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageJsonLd) }}
      />
      <PageHero
        image="/images/hero-kontakt.jpg"
        alt="Kontakt zu Wohnideen Hueter"
        crumb="Kontakt"
        eyebrow="Kontakt & Beratungstermin"
        title={
          <>
            Reden wir über
            <br />
            Ihr Zuhause.
          </>
        }
        lead="Rufen Sie an, schreiben Sie uns oder senden Sie das Formular. Wir melden uns persönlich und finden gemeinsam einen Termin."
      />

      <Section>
        <Container>
          <div className="grid gap-[clamp(1.5rem,3vw,2.5rem)] lg:grid-cols-2">
            {/* Formular */}
            <Reveal>
              <Eyebrow>Anfrage senden</Eyebrow>
              <h2 className="text-h2 mb-3 mt-4">Beratungstermin anfragen</h2>
              <p className="text-lead mb-6 text-ink-soft">
                Wir brauchen nur wenige Angaben. Alles Weitere besprechen wir
                persönlich.
              </p>
              <ContactForm />
            </Reveal>

            {/* Kontaktinfos + Karte */}
            <Reveal delay={0.1}>
              <Eyebrow>So erreichen Sie uns</Eyebrow>
              <h2 className="text-h2 mb-6 mt-4">Direkt &amp; persönlich</h2>
              <div className="grid gap-4">
                <InfoCard icon="phone" title="Telefon">
                  <a href={people.rudi.phoneHref} className="hover:text-clay">
                    {people.rudi.name}: {people.rudi.phone}
                  </a>
                </InfoCard>
                <InfoCard icon="mail" title="E-Mail">
                  <a
                    href={site.emailHref}
                    className="break-all hover:text-clay"
                  >
                    {site.email}
                  </a>
                </InfoCard>
                <InfoCard icon="pin" title="Adresse & Schauraum">
                  {site.legalName}
                  <br />
                  {site.address.street}, {site.address.zip} {site.address.city}
                  <br />
                  {site.address.region}, {site.address.country}
                </InfoCard>
                <InfoCard icon="clock" title="Termine">
                  {site.hours.detail}
                </InfoCard>
              </div>

              <div className="mt-6">
                <MapConsent
                  src="https://www.openstreetmap.org/export/embed.html?bbox=13.06%2C46.70%2C13.24%2C46.77&layer=mapnik&marker=46.7333%2C13.15"
                  title="Standort Wohnideen Hueter in Irschen auf OpenStreetMap"
                />
                <p className="mt-2.5 text-[0.82rem] text-ink-mute">
                  Kartendarstellung © OpenStreetMap-Mitwirkende.{" "}
                  <TextLink href="https://www.openstreetmap.org/?mlat=46.7333&mlon=13.15#map=13/46.7333/13.15">
                    Route planen
                  </TextLink>
                  {/* TODO: Exakte Betriebsadresse/Koordinaten & Anfahrt bestätigen. */}
                </p>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
