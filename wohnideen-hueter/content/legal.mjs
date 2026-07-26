import { site } from '../site.config.mjs';
import { icon, esc } from '../templates/layout.mjs';

const L = site.legal, A = site.address;

/* ================================ IMPRESSUM =============================== */
export const impressum = {
  page: 'impressum.html',
  title: 'Impressum | Wohnideen Hueter',
  description: 'Impressum und Offenlegung gemäß §5 ECG, §14 UGB und §25 MedienG von Rudolf Hueter e.U. (Wohnideen Hueter), Irschen.',
  body: `
<section class="section">
  <div class="wrap prose" data-reveal>
    <span class="eyebrow">Rechtliches</span>
    <h1>Impressum</h1>
    <p><small>Offenlegung gemäß §&nbsp;5 ECG, §&nbsp;14 UGB und §&nbsp;25 MedienG</small></p>

    <h2>Medieninhaber &amp; Unternehmen</h2>
    <p>
      <strong>${esc(site.legalName)}</strong> (Wohnideen Hueter)<br>
      Inhaber: ${esc(L.owner)}<br>
      ${esc(A.street)}<br>
      ${esc(A.zip)} ${esc(A.city)}, ${esc(A.region)}<br>
      ${esc(A.country)}
    </p>

    <h2>Kontakt</h2>
    <p>
      Telefon: <a href="tel:${site.phoneHref}">${esc(site.phoneDisplay)}</a><br>
      E-Mail: <a href="mailto:${site.email}">${esc(site.email)}</a>
    </p>

    <h2>Unternehmensdaten</h2>
    <ul>
      <li>Firmenbuchnummer: ${esc(L.fn)}</li>
      <li>Firmenbuchgericht: ${esc(L.court)}</li>
      <li>UID-Nummer: ${esc(L.uid)}</li>
      <li>Unternehmensgegenstand: ${esc(L.activity)}</li>
      <li>Gewerbe: ${esc(L.trade)}</li>
    </ul>

    <h2>Kammerzugehörigkeit &amp; Aufsichtsbehörde</h2>
    <p>Mitglied der ${esc(L.chamber)} (Wirtschaftskammer Österreich).<br>
    Zuständige Aufsichtsbehörde/Gewerbebehörde: Bezirkshauptmannschaft ${esc(A.district)}.<br>
    Es gelten die berufsrechtlichen Vorschriften der Gewerbeordnung (GewO), abrufbar unter
    <a href="https://www.ris.bka.gv.at" target="_blank" rel="noopener">ris.bka.gv.at</a>.</p>

    <h2>Verbraucherstreitbeilegung / Online-Streitbeilegung</h2>
    <p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
    <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">ec.europa.eu/consumers/odr</a>.
    Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer
    Verbraucherschlichtungsstelle teilzunehmen.</p>

    <h2>Urheberrecht</h2>
    <p>Inhalte und Werke auf dieser Website unterliegen dem österreichischen Urheberrecht.
    Marken- und Herstellernamen sind Eigentum der jeweiligen Rechteinhaber und dienen der
    sachlichen Information.</p>

    <h2>Bildhinweis</h2>
    <p>Aktuell zeigt diese Website teilweise klar gekennzeichnete Platzhalter-Grafiken
    („Platzhalter · echtes Foto folgt"). Diese werden durch echtes Bildmaterial von
    Wohnideen Hueter ersetzt.</p>

    <p class="mt-2"><small>Stand: laufend aktualisiert. <!-- TODO: Angaben vor Livegang final durch den Unternehmer prüfen lassen. --></small></p>
  </div>
</section>
`,
};

/* ============================== DATENSCHUTZ =============================== */
export const datenschutz = {
  page: 'datenschutz.html',
  title: 'Datenschutzerklärung | Wohnideen Hueter',
  description: 'Datenschutzerklärung von Wohnideen Hueter: Diese Website verwendet keine Tracking-Dienste und keine Cookies. Informationen zu Kontaktformular, Schriften und Kartendarstellung.',
  body: `
<section class="section">
  <div class="wrap prose" data-reveal>
    <span class="eyebrow">Rechtliches</span>
    <h1>Datenschutzerklärung</h1>
    <p class="lead">Der Schutz Ihrer persönlichen Daten ist uns wichtig. Diese Website ist bewusst
    datensparsam gestaltet: <strong>kein Tracking, keine Werbe-Cookies, keine Weitergabe an Dritte.</strong></p>

    <h2>1. Verantwortlicher</h2>
    <p>${esc(site.legalName)} (Wohnideen Hueter)<br>
    ${esc(A.street)}, ${esc(A.zip)} ${esc(A.city)}, ${esc(A.country)}<br>
    E-Mail: <a href="mailto:${site.email}">${esc(site.email)}</a> · Telefon: <a href="tel:${site.phoneHref}">${esc(site.phoneDisplay)}</a></p>

    <h2>2. Grundsatz &amp; Cookies</h2>
    <p>Diese Website setzt <strong>keine Cookies</strong> zu Analyse- oder Marketingzwecken und bindet
    <strong>keine externen Tracking- oder Werbedienste</strong> ein. Es findet keine automatisierte
    Auswertung Ihres Verhaltens statt. Einstellungen (z.&nbsp;B. reduzierte Bewegung) werden allein von
    Ihrem Browser verwaltet.</p>

    <h2>3. Server-Logfiles (Hosting)</h2>
    <p>Beim Aufruf der Website werden vom Hosting-Provider technisch notwendige Zugriffsdaten
    (z.&nbsp;B. IP-Adresse, Datum/Uhrzeit, abgerufene Seite, Browsertyp) verarbeitet. Rechtsgrundlage ist
    das berechtigte Interesse am sicheren und stabilen Betrieb der Website (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO).
    <!-- TODO: Konkreten Hosting-Anbieter und dessen Auftragsverarbeitungsvertrag/Server­standort ergänzen. --></p>

    <h2>4. Schriftarten</h2>
    <p>Die verwendeten Schriften (Cormorant Garamond, Inter) werden <strong>lokal vom eigenen Server
    ausgeliefert</strong>. Es besteht keine Verbindung zu Google Fonts oder anderen externen Anbietern;
    dabei werden keine personenbezogenen Daten an Dritte übertragen.</p>

    <h2>5. Kontaktaufnahme &amp; Anfrageformular</h2>
    <p>Wenn Sie uns über das Formular kontaktieren, öffnet sich Ihr eigenes E-Mail-Programm mit einer
    vorbereiteten Nachricht an ${esc(site.email)}. Die Website selbst speichert und übermittelt dabei
    <strong>keine</strong> Daten an einen Server; der Versand erfolgt über Ihren E-Mail-Anbieter.
    Die von Ihnen mitgeteilten Daten (Name, E-Mail, ggf. Telefon, Nachricht) verwenden wir ausschließlich
    zur Bearbeitung Ihrer Anfrage (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b und lit.&nbsp;a DSGVO). Sie werden gelöscht,
    sobald sie nicht mehr benötigt werden und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</p>

    <h2>6. Kartendarstellung (OpenStreetMap)</h2>
    <p>Auf der Kontaktseite kann eine Karte von OpenStreetMap eingebunden werden. Diese lädt
    <strong>erst nach Ihrem ausdrücklichen Klick</strong> auf „Karte laden" (Zwei-Klick-Lösung, Art.&nbsp;6
    Abs.&nbsp;1 lit.&nbsp;a DSGVO). Erst dann wird eine Verbindung zu den Servern der OpenStreetMap Foundation
    aufgebaut und Ihre IP-Adresse übertragen. Details:
    <a href="https://wiki.osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener">OSMF Privacy Policy</a>.</p>

    <h2>7. Externe Links</h2>
    <p>Diese Website enthält Links zu externen Seiten (z.&nbsp;B. Facebook). Auf deren Inhalte und
    Datenverarbeitung haben wir keinen Einfluss; es gelten die Datenschutzbestimmungen der jeweiligen
    Anbieter.</p>

    <h2>8. Ihre Rechte</h2>
    <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
    Datenübertragbarkeit sowie Widerspruch. Wenden Sie sich dazu an die oben genannten Kontaktdaten.
    Ihnen steht außerdem ein Beschwerderecht bei der österreichischen Datenschutzbehörde zu
    (<a href="https://www.dsb.gv.at" target="_blank" rel="noopener">dsb.gv.at</a>).</p>

    <p class="mt-2"><small>Stand: laufend aktualisiert. <!-- TODO: Hosting-Details ergänzen und vor Livegang rechtlich prüfen lassen. --></small></p>
  </div>
</section>
`,
};

/* ========================== BARRIEREFREIHEIT ============================= */
export const barrierefreiheit = {
  page: 'barrierefreiheit.html',
  title: 'Barrierefreiheit | Wohnideen Hueter',
  description: 'Erklärung zur Barrierefreiheit der Website von Wohnideen Hueter: Maßnahmen, Standards und Kontaktmöglichkeit für Feedback zu Barrieren.',
  body: `
<section class="section">
  <div class="wrap prose" data-reveal>
    <span class="eyebrow">Rechtliches</span>
    <h1>Erklärung zur Barrierefreiheit</h1>
    <p class="lead">Wir möchten, dass unsere Website von möglichst allen Menschen gut genutzt werden kann.</p>

    <h2>Unser Anspruch</h2>
    <p>Diese Website wurde mit dem Ziel entwickelt, sich an den Anforderungen der
    Web Content Accessibility Guidelines (WCAG 2.1, Stufe AA) zu orientieren.</p>

    <h2>Umgesetzte Maßnahmen</h2>
    <ul>
      <li>Semantisch strukturiertes HTML und sinnvolle Überschriftenhierarchie</li>
      <li>Vollständige Tastaturbedienbarkeit mit sichtbaren Fokuszuständen</li>
      <li>Ausreichende Farbkontraste und gut lesbare Schriftgrößen</li>
      <li>Alternativtexte für Bilder und beschriftete Bedienelemente</li>
      <li>Berücksichtigung von „reduzierter Bewegung" (prefers-reduced-motion)</li>
      <li>Responsives Layout ohne horizontales Scrollen</li>
    </ul>

    <h2>Bekannte Einschränkungen</h2>
    <p>Einzelne Bilder sind derzeit klar gekennzeichnete Platzhalter und werden durch echtes
    Bildmaterial ersetzt. Sollten Ihnen weitere Barrieren auffallen, freuen wir uns über Ihren Hinweis.</p>

    <h2>Feedback &amp; Kontakt</h2>
    <p>Wenn Ihnen Inhalte nicht barrierefrei zugänglich sind, melden Sie sich bitte bei uns –
    wir helfen gerne weiter und verbessern die Website laufend:</p>
    <p>E-Mail: <a href="mailto:${site.email}">${esc(site.email)}</a><br>
    Telefon: <a href="tel:${site.phoneHref}">${esc(site.phoneDisplay)}</a></p>

    <p class="mt-2"><small><!-- TODO: Bei rechtlicher Verpflichtung (BaFG) formale Konformitätsbewertung ergänzen. --> Stand: laufend aktualisiert.</small></p>
  </div>
</section>
`,
};

/* ================================== 404 ================================== */
export const notFound = {
  page: '404.html', heroTop: false,
  title: 'Seite nicht gefunden | Wohnideen Hueter',
  description: 'Die gewünschte Seite wurde nicht gefunden.',
  body: `
<section class="section" style="min-height:60vh;display:grid;place-items:center;text-align:center">
  <div class="wrap" data-reveal>
    <span class="eyebrow" style="justify-content:center">Fehler 404</span>
    <h1 style="margin:.3em 0">Diese Seite konnten<br>wir nicht finden.</h1>
    <p class="lead" style="max-width:520px;margin-inline:auto">Vielleicht wurde die Adresse geändert. Kehren Sie zur Startseite zurück oder nehmen Sie direkt Kontakt mit uns auf.</p>
    <div class="cta-actions" style="margin-top:1.6rem">
      <a class="btn btn-primary" href="index.html">${icon('arrow')} Zur Startseite</a>
      <a class="btn btn-ghost" href="kontakt.html">${icon('chat')} Kontakt</a>
    </div>
  </div>
</section>
`,
};

export const legalPages = [impressum, datenschutz, barrierefreiheit, notFound];
