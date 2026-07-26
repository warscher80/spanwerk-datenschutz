import type { Metadata } from "next";
import { site } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = pageMeta({
  title: "Impressum",
  description:
    "Impressum und Offenlegung gemäß §5 ECG, §14 UGB und §25 MedienG von Rudolf Hueter e.U. (Wohnideen Hueter), Irschen.",
  path: "/impressum",
});

const L = site.legal;
const A = site.address;

export default function ImpressumPage() {
  return (
    <LegalShell
      title="Impressum"
      intro={
        <p>
          <small>Offenlegung gemäß §&nbsp;5 ECG, §&nbsp;14 UGB und §&nbsp;25 MedienG</small>
        </p>
      }
    >
      <h2>Medieninhaber &amp; Unternehmen</h2>
      <p>
        <strong>{site.legalName}</strong> (Wohnideen Hueter)
        <br />
        Inhaber: {L.owner}
        <br />
        {A.street}
        <br />
        {A.zip} {A.city}, {A.region}
        <br />
        {A.country}
      </p>

      <h2>Kontakt</h2>
      <p>
        Telefon: <a href={site.phoneHref}>{site.phoneDisplay}</a>
        <br />
        E-Mail: <a href={site.emailHref}>{site.email}</a>
      </p>

      <h2>Unternehmensdaten</h2>
      <ul>
        <li>Firmenbuchnummer: {L.fn}</li>
        <li>Firmenbuchgericht: {L.court}</li>
        <li>UID-Nummer: {L.uid}</li>
        <li>Unternehmensgegenstand: {L.activity}</li>
        <li>Gewerbe: {L.trade}</li>
      </ul>

      <h2>Kammerzugehörigkeit &amp; Aufsichtsbehörde</h2>
      <p>
        Mitglied der {L.chamber} (Wirtschaftskammer Österreich).
        <br />
        Zuständige Aufsichts-/Gewerbebehörde: Bezirkshauptmannschaft {A.district}.
        <br />
        Es gelten die berufsrechtlichen Vorschriften der Gewerbeordnung (GewO),
        abrufbar unter{" "}
        <a href="https://www.ris.bka.gv.at" target="_blank" rel="noopener noreferrer">
          ris.bka.gv.at
        </a>
        .
      </p>

      <h2>Verbraucherstreitbeilegung / Online-Streitbeilegung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
        (OS) bereit:{" "}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
          ec.europa.eu/consumers/odr
        </a>
        . Wir sind nicht verpflichtet und nicht bereit, an einem
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen.
      </p>

      <h2>Urheberrecht &amp; Bildhinweis</h2>
      <p>
        Inhalte und Werke auf dieser Website unterliegen dem österreichischen
        Urheberrecht. Marken- und Herstellernamen sind Eigentum der jeweiligen
        Rechteinhaber und dienen der sachlichen Information. Ein Teil des
        Bildmaterials wird laufend durch eigene Aufnahmen von Wohnideen Hueter
        ergänzt und ersetzt.
      </p>

      <p className="mt-8">
        {/* TODO: Angaben vor Livegang final durch den Unternehmer prüfen lassen. */}
        <small>Stand: laufend aktualisiert.</small>
      </p>
    </LegalShell>
  );
}
