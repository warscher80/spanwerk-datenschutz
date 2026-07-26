import Link from "next/link";
import type { ReactNode } from "react";
import { people, site } from "@/lib/site";
import { Container, Section } from "./Layout";
import { Eyebrow } from "./SectionHeader";
import { Button } from "./Button";
import { Reveal } from "./Reveal";
import { Icon, type IconName } from "./Icon";

function Row({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5 py-4">
      <Icon name={icon} size={1.35} className="mt-0.5 text-gold" />
      <div>
        <p className="text-[0.72rem] uppercase tracking-[0.15em] text-[#8a8c90]">{label}</p>
        <div className="mt-0.5 text-[0.98rem] text-[#e7e7e4]">{children}</div>
      </div>
    </div>
  );
}

/**
 * Wiederverwendbarer Abschluss-CTA mit Kontaktpanel (Telefon, Schauraum,
 * Termine). Alle Kontaktdaten stammen zentral aus site.ts.
 */
export function ContactCta({
  eyebrow = "Beratung & Kontakt",
  title,
  lead,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead: string;
}) {
  return (
    <Section tone="ink">
      <Container>
        <div className="grid items-center gap-[clamp(2.5rem,5vw,4.5rem)] lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <div>
              <Eyebrow light>{eyebrow}</Eyebrow>
              <h2 className="text-h2 mt-4 text-white">{title}</h2>
              <p className="mt-5 max-w-[34rem] text-lead text-[#e7e7e4]/80">{lead}</p>
              <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap">
                <Button href="/kontakt" variant="primary" icon="chat">
                  Beratungstermin anfragen
                </Button>
                <Button href={site.phoneHref} variant="light" icon="phone">
                  {site.phoneDisplay}
                </Button>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-panel border border-white/15 bg-white/[0.04] p-6 sm:p-8">
              <h3 className="sr-only">Kontaktdaten</h3>
              <div className="divide-y divide-white/10">
                <Row icon="phone" label="Telefon">
                  <a href={people.rudi.phoneHref} className="hover:text-white">
                    {people.rudi.name}: {people.rudi.phone}
                  </a>
                </Row>
                <Row icon="mail" label="E-Mail">
                  <a href={site.emailHref} className="break-all hover:text-white">
                    {site.email}
                  </a>
                </Row>
                <Row icon="pin" label="Schauraum & Adresse">
                  {site.legalName}
                  <br />
                  {site.address.street}, {site.address.zip} {site.address.city}
                </Row>
                <Row icon="clock" label="Termine">
                  {site.hours.note}
                </Row>
              </div>
              <Link
                href="/kontakt"
                className="mt-5 inline-flex items-center gap-1.5 border-b border-white/25 pb-0.5 text-[0.92rem] font-semibold text-white hover:border-gold"
              >
                Zum Kontaktformular &amp; Anfahrt
                <Icon name="arrow" size={0.95} />
              </Link>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
