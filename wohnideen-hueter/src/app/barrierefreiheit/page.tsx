import type { Metadata } from "next";
import { site } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = pageMeta({
  title: "Barrierefreiheit",
  description:
    "Erklärung zur Barrierefreiheit der Website von Wohnideen Hueter: Maßnahmen, Standards und Kontaktmöglichkeit für Feedback zu Barrieren.",
  path: "/barrierefreiheit",
});

export default function BarrierefreiheitPage() {
  return (
    <LegalShell
      title="Erklärung zur Barrierefreiheit"
      intro={
        <p className="text-lead" style={{ color: "var(--color-ink-soft)" }}>
          Wir möchten, dass unsere Website von möglichst allen Menschen gut
          genutzt werden kann.
        </p>
      }
    >
      <h2>Unser Anspruch</h2>
      <p>
        Diese Website wurde mit dem Ziel entwickelt, sich an den Anforderungen der
        Web Content Accessibility Guidelines (WCAG 2.1, Stufe AA) zu orientieren.
      </p>

      <h2>Umgesetzte Maßnahmen</h2>
      <ul>
        <li>Semantisch strukturiertes HTML und sinnvolle Überschriftenhierarchie</li>
        <li>Vollständige Tastaturbedienbarkeit mit sichtbaren Fokuszuständen</li>
        <li>Ausreichende Farbkontraste und gut lesbare Schriftgrößen</li>
        <li>Alternativtexte für Bilder und beschriftete Bedienelemente</li>
        <li>Berücksichtigung von „reduzierter Bewegung“ (prefers-reduced-motion)</li>
        <li>Responsives Layout ohne horizontales Scrollen</li>
      </ul>

      <h2>Bekannte Einschränkungen</h2>
      <p>
        Einzelne Bilder sind derzeit klar gekennzeichnete Platzhalter und werden
        durch echtes Bildmaterial ersetzt. Sollten Ihnen weitere Barrieren
        auffallen, freuen wir uns über Ihren Hinweis.
      </p>

      <h2>Feedback &amp; Kontakt</h2>
      <p>
        Wenn Ihnen Inhalte nicht barrierefrei zugänglich sind, melden Sie sich
        bitte bei uns – wir helfen gerne weiter und verbessern die Website laufend:
      </p>
      <p>
        E-Mail: <a href={site.emailHref}>{site.email}</a>
        <br />
        Telefon: <a href={site.phoneHref}>{site.phoneDisplay}</a>
      </p>

      <p className="mt-8">
        {/* TODO: Bei rechtlicher Verpflichtung (BaFG) formale Konformitätsbewertung ergänzen. */}
        <small>Stand: laufend aktualisiert.</small>
      </p>
    </LegalShell>
  );
}
