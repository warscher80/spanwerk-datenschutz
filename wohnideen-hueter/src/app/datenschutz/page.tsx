import type { Metadata } from "next";
import { site } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = pageMeta({
  title: "Datenschutzerklärung",
  description:
    "Datenschutzerklärung von Wohnideen Hueter: Diese Website verwendet keine Tracking-Dienste und keine Cookies. Informationen zu Kontaktformular, Schriften und Kartendarstellung.",
  path: "/datenschutz",
});

const A = site.address;

export default function DatenschutzPage() {
  return (
    <LegalShell
      title="Datenschutzerklärung"
      intro={
        <p className="text-lead" style={{ color: "var(--color-ink-soft)" }}>
          Der Schutz Ihrer persönlichen Daten ist uns wichtig. Diese Website ist
          bewusst datensparsam gestaltet:{" "}
          <strong>kein Tracking, keine Werbe-Cookies, keine Weitergabe an Dritte.</strong>
        </p>
      }
    >
      <h2>1. Verantwortlicher</h2>
      <p>
        {site.legalName} (Wohnideen Hueter)
        <br />
        {A.street}, {A.zip} {A.city}, {A.country}
        <br />
        E-Mail: <a href={site.emailHref}>{site.email}</a> · Telefon:{" "}
        <a href={site.phoneHref}>{site.phoneDisplay}</a>
      </p>

      <h2>2. Grundsatz &amp; Cookies</h2>
      <p>
        Diese Website setzt <strong>keine Cookies</strong> zu Analyse- oder
        Marketingzwecken und bindet <strong>keine externen Tracking- oder
        Werbedienste</strong> ein. Es findet keine automatisierte Auswertung Ihres
        Verhaltens statt. Einstellungen (z.&nbsp;B. reduzierte Bewegung) verwaltet
        allein Ihr Browser.
      </p>

      <h2>3. Server-Logfiles (Hosting)</h2>
      <p>
        Beim Aufruf der Website werden vom Hosting-Provider technisch notwendige
        Zugriffsdaten (z.&nbsp;B. IP-Adresse, Datum/Uhrzeit, abgerufene Seite,
        Browsertyp) verarbeitet. Rechtsgrundlage ist das berechtigte Interesse am
        sicheren und stabilen Betrieb der Website (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f
        DSGVO).{" "}
        {/* TODO: Konkreten Hosting-Anbieter, Auftragsverarbeitung & Serverstandort ergänzen. */}
      </p>

      <h2>4. Schriftarten</h2>
      <p>
        Die verwendeten Schriften (Cormorant Garamond, Inter) werden{" "}
        <strong>lokal vom eigenen Server ausgeliefert</strong>. Es besteht keine
        Verbindung zu Google Fonts oder anderen externen Anbietern; es werden keine
        personenbezogenen Daten an Dritte übertragen.
      </p>

      <h2>5. Kontaktaufnahme &amp; Anfrageformular</h2>
      <p>
        Wenn Sie uns über das Formular kontaktieren, öffnet sich Ihr eigenes
        E-Mail-Programm mit einer vorbereiteten Nachricht an {site.email}. Die
        Website selbst speichert und übermittelt dabei <strong>keine</strong> Daten
        an einen Server; der Versand erfolgt über Ihren E-Mail-Anbieter. Die von
        Ihnen mitgeteilten Daten (Name, E-Mail, ggf. Telefon, Nachricht) verwenden
        wir ausschließlich zur Bearbeitung Ihrer Anfrage (Art.&nbsp;6 Abs.&nbsp;1
        lit.&nbsp;b und lit.&nbsp;a DSGVO) und löschen sie, sobald sie nicht mehr
        benötigt werden und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
      </p>

      <h2>6. Kartendarstellung (OpenStreetMap)</h2>
      <p>
        Auf der Kontaktseite kann eine Karte von OpenStreetMap eingebunden werden.
        Diese lädt <strong>erst nach Ihrem ausdrücklichen Klick</strong> auf „Karte
        laden“ (Zwei-Klick-Lösung, Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;a DSGVO). Erst
        dann wird eine Verbindung zu den Servern der OpenStreetMap Foundation
        aufgebaut und Ihre IP-Adresse übertragen. Details:{" "}
        <a
          href="https://wiki.osmfoundation.org/wiki/Privacy_Policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          OSMF Privacy Policy
        </a>
        .
      </p>

      <h2>7. Externe Links</h2>
      <p>
        Diese Website verlinkt auf externe Seiten (z.&nbsp;B. Facebook). Auf deren
        Inhalte und Datenverarbeitung haben wir keinen Einfluss; es gelten die
        Datenschutzbestimmungen der jeweiligen Anbieter.
      </p>

      <h2>8. Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
        Verarbeitung, Datenübertragbarkeit sowie Widerspruch. Wenden Sie sich dazu
        an die oben genannten Kontaktdaten. Ihnen steht außerdem ein Beschwerderecht
        bei der österreichischen Datenschutzbehörde zu (
        <a href="https://www.dsb.gv.at" target="_blank" rel="noopener noreferrer">
          dsb.gv.at
        </a>
        ).
      </p>

      <p className="mt-8">
        {/* TODO: Hosting-Details ergänzen und vor Livegang rechtlich prüfen lassen. */}
        <small>Stand: laufend aktualisiert.</small>
      </p>
    </LegalShell>
  );
}
