/* ============================================================
   Preisschmiede – Datenhaltung (localStorage)
   Alle Daten bleiben lokal auf dem Gerät (siehe Datenschutz).
   ============================================================ */
(function (w) {
  "use strict";

  var KEY = "preisschmiede.kalkulation.v1";

  // ---- Standard-Stammdaten ----------------------------------
  var DEFAULT_SETTINGS = {
    // Firmendaten für den Angebots-Briefkopf
    firma: {
      name: "Preisschmiede", inhaber: "Nico Warscher",
      strasse: "", plzOrt: "", tel: "", email: "nicowarscher@gmx.at",
      web: "", uid: "", iban: "", bic: "", bank: ""
    },
    angebotZaehler: 1, // laufende Angebotsnummer
    projektZaehler: 1, // laufende Projektnummer
    // Stundenverrechnungssätze je Mitarbeitergruppe (€/h) – Vorgabewerte,
    // einzelne Mitarbeiter können abweichende Sätze haben (siehe mitarbeiter).
    rates: { cad: 65, fertigung: 58, montage: 62, projektleitung: 78 },
    // Maschinen: Maschinenstundensatz (€/h) + Rüstung. Die Rüstkosten je
    // Auftrag ergeben sich aus Rüstzeit (h) × Rüstkostensatz (€/h) + fixen
    // Rüstkosten (€). Zugeordnet zu einem Arbeitsschritt (schritt-Key).
    // Kapazität (arbeitstage, stundenProTag, wartungStunden) für Auslastungsanalyse;
    // maxParallel/standort/alternativMaschinen/qualifikation für die Fertigungsplanung (7C)
    maschinen: [
      { id: "m-saege",    name: "Säge",            schritt: "zuschnitt",  stundensatz: 22, ruestzeitStd: 0.15, ruestkostensatz: 40, fixeRuestkosten: 2,  arbeitstage: 220, stundenProTag: 8, wartungStunden: 30, maxParallel: 1, standort: "Halle 1", alternativMaschinen: [], qualifikation: "" },
      { id: "m-laser",    name: "Laser",           schritt: "lasern",     stundensatz: 95, ruestzeitStd: 0.30, ruestkostensatz: 60, fixeRuestkosten: 12, arbeitstage: 220, stundenProTag: 8, wartungStunden: 60, maxParallel: 1, standort: "Halle 1", alternativMaschinen: ["m-saege"], qualifikation: "Laserschneiden" },
      { id: "m-abkant",   name: "Abkantpresse",    schritt: "biegen",     stundensatz: 70, ruestzeitStd: 0.25, ruestkostensatz: 55, fixeRuestkosten: 6,  arbeitstage: 220, stundenProTag: 8, wartungStunden: 40, maxParallel: 1, standort: "Halle 1", alternativMaschinen: [], qualifikation: "Abkantpresse" },
      { id: "m-bohr",     name: "Bohrmaschine",    schritt: "bohren",     stundensatz: 18, ruestzeitStd: 0.10, ruestkostensatz: 40, fixeRuestkosten: 1,  arbeitstage: 220, stundenProTag: 8, wartungStunden: 20, maxParallel: 2, standort: "Halle 1", alternativMaschinen: [], qualifikation: "" },
      { id: "m-schweiss", name: "Schweißgerät",    schritt: "schweissen", stundensatz: 14, ruestzeitStd: 0.05, ruestkostensatz: 40, fixeRuestkosten: 1,  arbeitstage: 220, stundenProTag: 8, wartungStunden: 20, maxParallel: 3, standort: "Halle 2", alternativMaschinen: [], qualifikation: "MAG-Schweißen" },
      { id: "m-schleif",  name: "Schleifmaschine", schritt: "schleifen",  stundensatz: 10, ruestzeitStd: 0.05, ruestkostensatz: 40, fixeRuestkosten: 1,  arbeitstage: 220, stundenProTag: 8, wartungStunden: 15, maxParallel: 2, standort: "Halle 2", alternativMaschinen: [], qualifikation: "" }
    ],
    materialAufschlag: 12,  // % auf Materialeinkauf
    gemeinkosten: 14,       // % auf Selbstkosten
    gewinn: 18,             // % Gewinnaufschlag
    verschnitt: 8,          // % Standard-Verschnitt
    mwst: 20,               // % USt
    transportProKm: 0.9,    // €/km (Hin- und Rückfahrt)
    montagePauschaleAnfahrt: 1.0, // h Anfahrt-Rüstzeit pro Montage
    // Werkstoffdichten (g/cm³) – zentral für die Gewichtsberechnung im Konfigurator
    dichten: { Stahl: 7.85, Edelstahl: 7.90, Aluminium: 2.70 },
    konfigZaehler: 1, // laufende Konfigurations-Nummer
    kalkZaehler: 1,   // laufende Kalkulations-Nummer
    // Toleranzgrenzen für den Soll-Ist-Vergleich (Phase 5)
    toleranzen: { gruen: 5, gelb: 15 },
    // Angebots-Nummernkreis (Phase 4), konfigurierbar
    angebotNummernkreis: { praefix: "AN", jahr: null, laufend: 1, mindestlaenge: 4, jaehrlicherNeustart: true },
    // Fertigungsplanung (Phase 7C): Schicht-/Arbeitszeitmodell + Feiertage
    planung: { schichtStunden: 8, schichtStart: 7, arbeitstage: [1, 2, 3, 4, 5], feiertageAktiv: true, feiertage: [], pufferStd: 0 },
    // Qualifikationen (Phase 7C), vom Admin verwaltbar
    qualifikationen: ["MAG-Schweißen", "WIG-Schweißen", "Edelstahlschweißen", "Laserschneiden", "Abkantpresse", "Stapler", "Kran", "Montage", "Projektleitung", "Qualitätsprüfung"],
    // Dokumentenverwaltung (Phase 7D)
    dokumentZaehler: 1,
    // Betrieb/Pilot (Phase 9)
    betrieb: {
      releaseStufe: "test",           // entwicklung|test|pilot|eingeschraenkt|produktion
      wartungsmodus: false,
      backupMeta: { letztes: null, status: "keins", groesseKB: null, aufbewahrungTage: 30, restoreGetestet: false, letzterRestoreTest: null },
      feedbackZaehler: 1,
      setup: { abgeschlossen: false, uebersprungen: false, schritt: 0 }
    }
  };

  // ---- Beispiel-Materialdatenbank ---------------------------
  // Preise sind realistische Richtwerte (netto) und können
  // jederzeit angepasst oder per Lieferant aktualisiert werden.
  // kg = Gewicht je Einheit (für optional gewichtsbasierte Kalkulation und Gesamtgewicht)
  var SEED_MATERIAL = [
    { name: "Rundrohr Stahl 42,4 x 2,0", typ: "Stahl", einheit: "m", preis: 6.40, kg: 2.0, lieferant: "Frankstahl" },
    { name: "Rundrohr Edelstahl 42,4 x 2,0 (V2A)", typ: "Edelstahl", einheit: "m", preis: 21.80, kg: 2.0, lieferant: "Frankstahl" },
    { name: "Vierkantrohr Stahl 40 x 40 x 2,0", typ: "Stahl", einheit: "m", preis: 7.10, kg: 2.3, lieferant: "Frankstahl" },
    { name: "Vierkantrohr Edelstahl 40 x 40 x 2,0", typ: "Edelstahl", einheit: "m", preis: 26.50, kg: 2.3, lieferant: "Frankstahl" },
    { name: "Flachstahl 40 x 8", typ: "Stahl", einheit: "m", preis: 3.20, kg: 2.5, lieferant: "Frankstahl" },
    { name: "Rundstab Stahl 12 mm", typ: "Stahl", einheit: "m", preis: 1.10, kg: 0.9, lieferant: "Frankstahl" },
    { name: "Rundstab Edelstahl 12 mm", typ: "Edelstahl", einheit: "m", preis: 4.60, kg: 0.9, lieferant: "Frankstahl" },
    { name: "Blech Stahl 2,0 mm", typ: "Stahl", einheit: "m²", preis: 28.0, kg: 15.7, lieferant: "Frankstahl" },
    { name: "Blech Edelstahl 2,0 mm", typ: "Edelstahl", einheit: "m²", preis: 96.0, kg: 16.0, lieferant: "Frankstahl" },
    { name: "Rundrohr Aluminium 42,4 x 2,0", typ: "Aluminium", einheit: "m", preis: 12.4, kg: 0.7, lieferant: "Frankstahl" },
    { name: "Vierkantrohr Aluminium 40 x 40 x 2,0", typ: "Aluminium", einheit: "m", preis: 14.9, kg: 0.8, lieferant: "Frankstahl" },
    { name: "Rundstab Aluminium 12 mm", typ: "Aluminium", einheit: "m", preis: 2.6, kg: 0.3, lieferant: "Frankstahl" },
    { name: "Blech Aluminium 2,0 mm", typ: "Aluminium", einheit: "m²", preis: 41.0, kg: 5.4, lieferant: "Frankstahl" },
    { name: "VSG-Glas 8.8.4 klar", typ: "Glas", einheit: "m²", preis: 145.0, kg: 20.0, lieferant: "Glas Müller" },
    { name: "Glasklemme Edelstahl", typ: "Beschlag", einheit: "Stk", preis: 14.5, kg: 0.3, lieferant: "MetallProfi" },
    { name: "Pfostenanker / Bodenplatte", typ: "Beschlag", einheit: "Stk", preis: 9.8, kg: 0.8, lieferant: "MetallProfi" },
    { name: "Chemiedübel-Set M12", typ: "Befestigung", einheit: "Stk", preis: 2.3, kg: 0.1, lieferant: "MetallProfi" }
  ];

  // ---- Beispieldaten für die Betriebsverwaltung -------------
  var SEED_LIEFERANTEN = [
    { name: "Frankstahl", kundennummer: "", ansprechpartner: "", tel: "+43 5 0503 0", email: "thesteel@frankstahl.com", web: "thesteel.com", notiz: "Stahl-Vollsortiment (DATANORM verfügbar)" },
    { name: "Glas Müller", kundennummer: "", ansprechpartner: "", tel: "", email: "", web: "", notiz: "Glas / VSG" },
    { name: "MetallProfi", kundennummer: "", ansprechpartner: "", tel: "", email: "", web: "", notiz: "Beschläge & Befestigung" }
  ];
  var SEED_MITARBEITER = [
    { name: "Nico Warscher", gruppe: "projektleitung", stundensatz: 78, aktiv: true, team: "Leitung", standort: "Halle 1", qualifikationen: ["Projektleitung", "Qualitätsprüfung", "Montage"], maschinenberechtigungen: [], abwesenheiten: [], maxStundenProTag: 8 },
    { name: "CAD / Planung", gruppe: "cad", stundensatz: 65, aktiv: true, team: "Büro", standort: "Halle 1", qualifikationen: ["Laserschneiden"], maschinenberechtigungen: ["m-laser"], abwesenheiten: [], maxStundenProTag: 8 },
    { name: "Werkstatt 1", gruppe: "fertigung", stundensatz: 58, aktiv: true, team: "Fertigung A", standort: "Halle 2", qualifikationen: ["MAG-Schweißen", "WIG-Schweißen", "Abkantpresse"], maschinenberechtigungen: ["m-schweiss", "m-abkant", "m-saege"], abwesenheiten: [], maxStundenProTag: 8 },
    { name: "Monteur 1", gruppe: "montage", stundensatz: 62, aktiv: true, team: "Montage 1", standort: "Baustelle", qualifikationen: ["Montage", "Stapler"], maschinenberechtigungen: [], abwesenheiten: [], maxStundenProTag: 8 }
  ];
  var SEED_KUNDEN = [
    { name: "Muster Bau GmbH", ansprechpartner: "Herr Huber", strasse: "Industriestraße 5", plzOrt: "9500 Villach", tel: "04242 12345", email: "office@musterbau.at", notiz: "Gewerbekunde" },
    { name: "Familie Berger", ansprechpartner: "", strasse: "Seeweg 12", plzOrt: "9220 Velden", tel: "0664 1234567", email: "berger@example.at", notiz: "Privatkunde" }
  ];
  // Benutzer mit Rollen; Standard-PIN 1234 (bitte nach dem ersten Login ändern)
  var SEED_USERS = [
    { name: "Administrator", benutzername: "admin", rolle: "admin", pin: "1234" },
    { name: "Büro", benutzername: "buero", rolle: "buero", pin: "1234" },
    { name: "Werkstatt", benutzername: "werkstatt", rolle: "werkstatt", pin: "1234" }
  ];

  function nowISO() { return new Date().toISOString(); }
  function uid() {
    return "id-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }
  function makeSalt() { return Math.random().toString(36).slice(2, 12); }
  // Gehärteter (iterierter) Hash für lokale PINs – speichert nie Klartext.
  // Kein kryptografischer Ersatz, aber ausreichend zur lokalen Rollentrennung.
  function hashPin(pin, salt) {
    var base = String(salt) + "|" + String(pin);
    var h = 0x811c9dc5 >>> 0;
    for (var r = 0; r < 3000; r++) {
      for (var i = 0; i < base.length; i++) {
        h ^= base.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      h = (h ^ r) >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }
  function makeUser(u) {
    var salt = makeSalt();
    return {
      id: uid(), name: u.name, benutzername: u.benutzername, rolle: u.rolle,
      salt: salt, hash: hashPin(u.pin, salt), aktiv: u.aktiv !== false, erstellt: nowISO()
    };
  }

  // Beispielaufträge mit echten Soll-/Ist-Daten, damit das Management-
  // Dashboard (Phase 7A) reale Nachkalkulation, Deckungsbeitrag, Gewinn
  // und Kalkulationsgenauigkeit zeigen kann. Datumswerte relativ zu heute.
  function beispielAuftraege(kunden) {
    function vorTagen(t) { var d = new Date(); d.setDate(d.getDate() - t); return d.toISOString(); }
    function inTagen(t) { var d = new Date(); d.setDate(d.getDate() + t); return d.toISOString(); }
    function pos(produktKey, netto, soll, ist) { return [{ produktKey: produktKey, label: null, kalk: { zeiten: soll, netto: netto }, ist: ist ? { zeiten: ist, erfasstAm: vorTagen(2) } : null }]; }
    function auftrag(o) {
      return Object.assign({
        id: uid(), erstellt: o.erstellt, status: o.status, kommission: o.kommission,
        kundeId: o.kundeId, titel: o.titel, gruppeKey: o.gruppeKey,
        positionen: pos(o.gruppeKey, o.netto, o.soll, o.ist),
        kalk: { netto: o.netto, selbstkosten: o.selbst, deckungsbeitrag: o.db, gewinn: o.gewinn, stundenGesamt: o.stunden },
        fremdkosten: o.fremd || [], nettowert: o.netto
      });
    }
    var k0 = kunden[0] ? kunden[0].id : null, k1 = kunden[1] ? kunden[1].id : k0, k2 = kunden[2] ? kunden[2].id : k0;
    return [
      auftrag({ titel: "Balkongeländer Musterstraße", gruppeKey: "gelaender", kundeId: k0, kommission: "BV Musterstraße", status: "Abgeschlossen", erstellt: vorTagen(50), netto: 4200, selbst: 3100, db: 1100, gewinn: 700, stunden: 46,
        soll: { cad: 4, zuschnitt: 3, schweissen: 18, schleifen: 6, oberflaeche: 5, montage: 10 },
        ist:  { cad: 3.5, zuschnitt: 3, schweissen: 17, schleifen: 6, oberflaeche: 5, montage: 9 } }),
      auftrag({ titel: "Stahltreppe Wohnhaus Berger", gruppeKey: "treppen", kundeId: k1, kommission: "Wohnhaus Berger", status: "Abgeschlossen", erstellt: vorTagen(38), netto: 8600, selbst: 6400, db: 2200, gewinn: 1400, stunden: 92,
        soll: { cad: 8, zuschnitt: 6, lasern: 5, biegen: 4, schweissen: 40, schleifen: 12, montage: 17 },
        ist:  { cad: 10, zuschnitt: 7, lasern: 5, biegen: 5, schweissen: 49, schleifen: 15, montage: 21 } }),
      Object.assign(auftrag({ titel: "Doppelstabzaun Grundstück Nord", gruppeKey: "zaeune", kundeId: k2, kommission: "GST Nord", status: "Beauftragt", erstellt: vorTagen(9), netto: 5300, selbst: 3900, db: 1400, gewinn: 900, stunden: 34,
        soll: { cad: 3, zuschnitt: 8, schweissen: 10, oberflaeche: 4, montage: 9 }, ist: null }), { liefertermin: inTagen(4), prioritaet: 1 }),
      Object.assign(auftrag({ titel: "Edelstahlgeländer Stiege West", gruppeKey: "gelaender", kundeId: k1, kommission: "Stiege West", status: "Beauftragt", erstellt: vorTagen(5), netto: 6100, selbst: 4400, db: 1700, gewinn: 1050, stunden: 40,
        soll: { cad: 5, zuschnitt: 6, lasern: 4, biegen: 4, schweissen: 12, schleifen: 5, montage: 4 }, ist: null }), { liefertermin: inTagen(12), prioritaet: 2 }),
      auftrag({ titel: "Blechkassetten Serie 40 Stk.", gruppeKey: "blecharbeiten", kundeId: k0, kommission: "Serie B40", status: "Abgeschlossen", erstellt: vorTagen(24), netto: 3100, selbst: 2350, db: 750, gewinn: 480, stunden: 28,
        soll: { cad: 3, lasern: 8, biegen: 10, schleifen: 4, verpackung: 3 },
        ist:  { cad: 3, lasern: 8, biegen: 10, schleifen: 4, verpackung: 3 } }),
      auftrag({ titel: "Sonderkonstruktion Vordach Glas", gruppeKey: "sonderkonstruktionen", kundeId: k1, kommission: "Vordach Glas", status: "Abgeschlossen", erstellt: vorTagen(15), netto: 7400, selbst: 6100, db: 1300, gewinn: 300, stunden: 78,
        soll: { cad: 12, zuschnitt: 6, lasern: 4, biegen: 6, schweissen: 30, schleifen: 8, montage: 12 },
        ist:  { cad: 18, zuschnitt: 7, lasern: 4, biegen: 8, schweissen: 44, schleifen: 12, montage: 20 },
        fremd: [{ bezeichnung: "Glasfüllungen (Zukauf)", betrag: 900 }] })
    ];
  }

  // Beispiel-Fertigungsplanung mit bewusst erzeugten Konflikten
  // (Maschinen-/Mitarbeiter-Doppelbelegung, verspätetes Material,
  // gefährdeter Liefertermin, Rüstoptimierungspotenzial).
  function beispielPlanung(auftraege, settings, mitarbeiter) {
    var P = w.Preisschmiede && w.Preisschmiede.Planung;
    var basis = { elemente: [], versionen: [], benachrichtigungen: [], montage: [] };
    if (!P) return basis;
    try {
      var offene = auftraege.filter(function (a) { return a.status === "Beauftragt"; });
      if (!offene.length) offene = auftraege.slice(0, 2);
      var start = new Date(); start.setHours(7, 0, 0, 0);
      var ctx = { settings: settings, auftraege: auftraege, mitarbeiter: mitarbeiter };
      var alle = [];
      // Jeder Auftrag getrennt ab demselben Start eingeplant → realistische
      // Maschinenüberschneidungen zwischen den Aufträgen.
      offene.slice(0, 2).forEach(function (a) {
        var els = P.planAusAuftrag(a, ctx, settings);
        var vor = P.autoPlan(els, ctx, settings, start.toISOString());
        if (vor.ok) alle = alle.concat(vor.elemente);
      });
      var fert = mitarbeiter[2], mont = mitarbeiter[3];
      alle.forEach(function (e) {
        if (["schweissen", "biegen", "zuschnitt", "lasern"].indexOf(e.arbeitsgang) >= 0 && fert) e.mitarbeiterIds = [fert.id];
        if (e.typ === "montage" && mont) e.mitarbeiterIds = [mont.id];
        if (["lasern", "zuschnitt"].indexOf(e.arbeitsgang) >= 0) e.ruestMerkmale = { material: "Edelstahl", staerke: 3 };
      });
      if (alle[0]) alle[0].material = { status: "verspätet", werkstoff: "Edelstahl" };
      var benach = [{ id: uid(), typ: "zuweisung", text: "Neue Fertigungsplanung wurde erstellt (" + alle.length + " Arbeitsgänge).", datum: nowISO(), gelesen: false }];
      return { elemente: alle, versionen: [], benachrichtigungen: benach, montage: [] };
    } catch (e) { return basis; }
  }

  // Beispiel-Dokumente (künstliche Testdaten, klar gekennzeichnet).
  // Kleine Textinhalte (CSV/PDF-Text) – keine großen Binärdateien im
  // lokalen Speicher.
  function beispielDokumente(kunden, auftraege) {
    var D = w.Preisschmiede && w.Preisschmiede.Dokumente;
    if (!D) return [];
    var k0 = kunden[0] ? kunden[0].id : null;
    var csv = "Pos;Bezeichnung;Werkstoff;Länge;Breite;Stärke;Menge;Einheit\n" +
      "1;Handlaufhalter;S235JR;120;40;6;8;Stk\n2;Pfosten 40x40;S235JR;1000;40;3;6;Stk\n3;Füllstab;Edelstahl 1.4301;900;12;;24;Stk";
    var pdfA = "%PDF-1.4\n/Type /Page\nBT (Zeichnung Nr: 1045) Tj ET BT (Revision: A) Tj ET BT (Werkstoff: S235JR) Tj ET BT (Stück: 8) Tj ET BT (Maßstab: 1:10) Tj ET";
    var pdfB = pdfA.replace("Revision: A", "Revision: B").replace("Werkstoff: S235JR", "Werkstoff: 1.4301").replace("Stück: 8", "Stück: 10");
    function doc(o) {
      return Object.assign({
        id: uid(), _beispiel: true, nummer: o.nummer, typ: o.typ, dateiname: o.dateiname,
        format: D.formatInfo(o.dateiname), groesse: (o.inhalt || "").length, pruefsumme: D.pruefsumme(o.inhalt || o.nummer),
        zeichnungsnummer: o.zeichnungsnummer || "", revision: o.revision || "", beschreibung: o.beschreibung || "",
        ersteller: "Beispiel", hochgeladen: nowISO(), status: "hochgeladen", analysezustand: "nicht analysiert",
        kundeId: o.kundeId || null, auftragId: o.auftragId || null, kommission: o.kommission || "",
        version: o.version || 1, vorgaengerId: o.vorgaengerId || null, aktuell: o.aktuell !== false,
        inhalt: o.inhalt || "", analysen: []
      });
    }
    var a = doc({ nummer: "ZNG-1045-A", typ: "technische Zeichnung", dateiname: "1045_Gelaenderpfosten.pdf", zeichnungsnummer: "1045", revision: "A", beschreibung: "Geländerpfosten (Beispiel)", kundeId: k0, kommission: "BV Musterstraße", inhalt: pdfA, aktuell: false });
    var b = doc({ nummer: "ZNG-1045-B", typ: "technische Zeichnung", dateiname: "1045_Gelaenderpfosten_RevB.pdf", zeichnungsnummer: "1045", revision: "B", beschreibung: "Geländerpfosten – Revision B (Werkstoffwechsel)", kundeId: k0, kommission: "BV Musterstraße", inhalt: pdfB, version: 2, vorgaengerId: a.id });
    var s = doc({ nummer: "STL-2026-001", typ: "Stückliste", dateiname: "Stueckliste_Gelaender.csv", beschreibung: "Stückliste Geländer (Beispiel)", kundeId: k0, kommission: "BV Musterstraße", inhalt: csv });
    return [a, b, s];
  }

  // Beispiel-Lagerdaten (nur Testumgebung, Phase 15A). Baut über die reine
  // Lager-Engine einen konsistenten Materialfluss auf: Struktur, Artikel,
  // Bestellung, (Teil-)Wareneingang mit Charge/Zertifikat, Reservierung +
  // Teilreservierung, Entnahme + Rückgabe, Reststück (Langgut), gesperrte Charge.
  function beispielLager(lieferanten, auftraege, mandantId) {
    var L = w.Preisschmiede && w.Preisschmiede.Lager;
    var leer = { lagerStandorte: [], lager: [], lagerBereiche: [], lagerRegale: [], lagerplaetze: [], lagerArtikel: [], lagerBewegungen: [], lagerChargen: [], lagerReservierungen: [], lagerReststuecke: [], wareneingaenge: [], bestellungen: [], lagerKonflikte: [] };
    if (!L) return leer;
    try {
      var jetzt = nowISO();
      var liefFrank = (lieferanten.filter(function (x) { return /frank/i.test(x.name); })[0] || lieferanten[0] || {}).id || null;
      var liefProfi = (lieferanten.filter(function (x) { return /profi|metall/i.test(x.name); })[0] || lieferanten[0] || {}).id || null;
      var aufBeauftragt = (auftraege || []).filter(function (a) { return a.status === "Beauftragt"; })[0] || (auftraege || [])[0] || {};

      var stand = { id: uid(), mandantId: mandantId, code: "ST-01", name: "Betrieb Musterstadt", adresse: "Werkstraße 1", aktiv: true };
      var lHaupt = { id: uid(), mandantId: mandantId, standortId: stand.id, code: "L-HAUPT", name: "Hauptlager", aktiv: true };
      var lAussen = { id: uid(), mandantId: mandantId, standortId: stand.id, code: "L-AUSSEN", name: "Außenlager (Langgut)", aktiv: true };
      var bStahl = { id: uid(), mandantId: mandantId, lagerId: lHaupt.id, code: "B-STAHL", name: "Bereich Stahl" };
      var bBlech = { id: uid(), mandantId: mandantId, lagerId: lHaupt.id, code: "B-BLECH", name: "Bereich Blech" };
      var bLang = { id: uid(), mandantId: mandantId, lagerId: lAussen.id, code: "B-LANG", name: "Bereich Langgut" };
      var rStahl = { id: uid(), mandantId: mandantId, bereichId: bStahl.id, code: "R-01", name: "Regal 1" };
      var rLang = { id: uid(), mandantId: mandantId, bereichId: bLang.id, code: "R-KRAG", name: "Kragarmregal" };
      function platz(regalId, code, name, gruppen, gesperrt) { return { id: uid(), mandantId: mandantId, regalId: regalId, lagerId: regalId === rLang.id ? lAussen.id : lHaupt.id, code: code, bezeichnung: name, status: L.PLATZ_STATUS.AKTIV, erlaubteMaterialgruppen: gruppen || [], gesperrt: !!gesperrt, sperrgrund: gesperrt ? "Wartung" : null, notiz: null }; }
      var pStahl = platz(rStahl.id, "A-01-01", "Stahl Fachboden A", ["Stahl"]);
      var pEdel = platz(rStahl.id, "A-01-02", "Edelstahl Fachboden B", ["Edelstahl"]);
      var pBlech = platz(rStahl.id, "A-02-01", "Blechlager", ["Stahl", "Aluminium"]);
      var pLang1 = platz(rLang.id, "K-01", "Kragarm 1", ["Stahl", "Edelstahl"]);
      var pLangGesperrt = platz(rLang.id, "K-09", "Kragarm 9 (Wartung)", ["Stahl"], true);

      function artikel(daten) {
        return Object.assign({
          id: uid(), mandantId: mandantId, artikelnummer: daten.artikelnummer, materialId: daten.materialId || null,
          werkstoff: daten.werkstoff, abmessung: daten.abmessung || null, basiseinheit: daten.basiseinheit,
          gewicht: daten.gewicht != null ? daten.gewicht : null, standardLaenge: daten.standardLaenge || null, standardFormat: daten.standardFormat || null,
          mindestbestand: daten.mindestbestand || 0, meldebestand: daten.meldebestand || 0, zielbestand: daten.zielbestand || 0,
          bevorzugterLieferantId: daten.bevorzugterLieferantId || null, standardLagerplatzId: daten.standardLagerplatzId || null,
          chargenpflicht: !!daten.chargenpflicht, zertifikatspflicht: !!daten.zertifikatspflicht, reststueckverwaltung: !!daten.reststueckverwaltung,
          negativerBestandErlaubt: !!daten.negativerBestandErlaubt, verpackungseinheit: daten.verpackungseinheit || 1,
          mindestbestellmenge: daten.mindestbestellmenge || 0, lieferzeitTage: daten.lieferzeitTage || 7,
          bewertungsmethode: daten.bewertungsmethode || L.METHODE.GLEITEND, letzterEinkaufspreis: daten.letzterEinkaufspreis || 0, erstellt: jetzt
        });
      }
      var aVk = artikel({ artikelnummer: "VK-STAHL-40x40x2", werkstoff: "Stahl", abmessung: "40×40×2 mm", basiseinheit: "m", gewicht: 2.3, standardLaenge: 6, mindestbestand: 12, meldebestand: 24, zielbestand: 60, bevorzugterLieferantId: liefFrank, standardLagerplatzId: pLang1.id, chargenpflicht: true, zertifikatspflicht: true, reststueckverwaltung: true, verpackungseinheit: 6, mindestbestellmenge: 12, lieferzeitTage: 5 });
      var aRr = artikel({ artikelnummer: "RR-V2A-42x2", werkstoff: "Edelstahl", abmessung: "Ø42,4×2 mm", basiseinheit: "m", gewicht: 2.0, standardLaenge: 6, mindestbestand: 6, meldebestand: 12, zielbestand: 36, bevorzugterLieferantId: liefFrank, standardLagerplatzId: pLang1.id, chargenpflicht: true, zertifikatspflicht: true, reststueckverwaltung: true, verpackungseinheit: 6, mindestbestellmenge: 6, lieferzeitTage: 8, bewertungsmethode: L.METHODE.CHARGE });
      var aBlS = artikel({ artikelnummer: "BL-STAHL-2.0", werkstoff: "Stahl", abmessung: "2,0 mm", basiseinheit: "m²", standardFormat: "2000×1000", mindestbestand: 4, meldebestand: 8, zielbestand: 20, bevorzugterLieferantId: liefFrank, standardLagerplatzId: pBlech.id, chargenpflicht: true, verpackungseinheit: 1, mindestbestellmenge: 2, lieferzeitTage: 6 });
      var aBlA = artikel({ artikelnummer: "BL-ALU-2.0", werkstoff: "Aluminium", abmessung: "2,0 mm", basiseinheit: "m²", standardFormat: "2000×1000", mindestbestand: 2, meldebestand: 5, zielbestand: 12, bevorzugterLieferantId: liefProfi, standardLagerplatzId: pBlech.id, verpackungseinheit: 1, mindestbestellmenge: 1, lieferzeitTage: 10, bewertungsmethode: L.METHODE.LETZTER });

      var state = { artikel: [aVk, aRr, aBlS, aBlA], bewegungen: [], chargen: [], reservierungen: [], reststuecke: [], wareneingaenge: [], bestellungen: [], plaetze: [pStahl, pEdel, pBlech, pLang1, pLangGesperrt], konflikte: [] };

      // Offene Bestellung: Vierkantrohr 60 m bestellt, davon 36 m teilgeliefert (Teillieferung).
      var boVk = { id: uid(), mandantId: mandantId, lieferantId: liefFrank, status: "offen", lieferzeitTage: 5, erstellt: jetzt, positionen: [{ artikelId: aVk.id, bestellt: 60, geliefert: 0, status: "offen" }] };
      // Bestellung Edelstahl vollständig
      var boRr = { id: uid(), mandantId: mandantId, lieferantId: liefFrank, status: "offen", lieferzeitTage: 8, erstellt: jetzt, positionen: [{ artikelId: aRr.id, bestellt: 24, geliefert: 0, status: "offen" }] };
      state.bestellungen.push(boVk, boRr);

      // Teil-Wareneingang Vierkantrohr: 36 von 60, Charge + Zertifikat.
      L.wareneingang(state, { mandantId: mandantId, bestellungId: boVk.id, lieferantId: liefFrank, lieferschein: "LS-2026-101", datum: jetzt, benutzer: "buero",
        positionen: [{ artikelId: aVk.id, gelieferteMenge: 36, beschaedigteMenge: 0, lagerplatzId: pLang1.id, chargennummer: "CH-VK-2026-01", schmelznummer: "SM-778812", herstellerName: "Stahlwerk Ost", zertifikate: ["Werkszeugnis 3.1"], einkaufspreis: 7.10, qs: false }] }, jetzt);

      // Wareneingang Edelstahl: 24 m, ZWEI Chargen (eine QS/gesperrt), Zertifikate.
      L.wareneingang(state, { mandantId: mandantId, bestellungId: boRr.id, lieferantId: liefFrank, lieferschein: "LS-2026-102", datum: jetzt, benutzer: "buero",
        positionen: [{ artikelId: aRr.id, gelieferteMenge: 18, beschaedigteMenge: 0, lagerplatzId: pLang1.id, chargennummer: "CH-RR-2026-07", schmelznummer: "SM-551200", herstellerName: "INOX AG", zertifikate: ["Werkszeugnis 3.1", "EN 10204/3.1"], einkaufspreis: 21.80, qs: false }] }, jetzt);
      L.wareneingang(state, { mandantId: mandantId, lieferantId: liefFrank, lieferschein: "LS-2026-103", datum: jetzt, benutzer: "buero",
        positionen: [{ artikelId: aRr.id, gelieferteMenge: 6, beschaedigteMenge: 1, lagerplatzId: pLang1.id, chargennummer: "CH-RR-2026-08", schmelznummer: "SM-551333", herstellerName: "INOX AG", zertifikate: ["Werkszeugnis 3.1"], einkaufspreis: 22.40, qs: true }] }, jetzt);

      // Blech Stahl + Alu einlagern
      L.wareneingang(state, { mandantId: mandantId, lieferantId: liefFrank, lieferschein: "LS-2026-110", datum: jetzt, benutzer: "buero",
        positionen: [{ artikelId: aBlS.id, gelieferteMenge: 10, beschaedigteMenge: 0, lagerplatzId: pBlech.id, chargennummer: "CH-BLS-2026-02", zertifikate: ["Werkszeugnis 2.2"], einkaufspreis: 56.0 }] }, jetzt);
      L.wareneingang(state, { mandantId: mandantId, lieferantId: liefProfi, lieferschein: "LS-2026-111", datum: jetzt, benutzer: "buero",
        positionen: [{ artikelId: aBlA.id, gelieferteMenge: 3, beschaedigteMenge: 0, lagerplatzId: pBlech.id, einkaufspreis: 82.0 }] }, jetzt);

      // Reservierung (voll) + Teilreservierung (Fehlmenge) für Vierkantrohr aus einem Auftrag.
      var chVk = (state.chargen.filter(function (c) { return c.chargennummer === "CH-VK-2026-01"; })[0] || {}).id;
      L.reserviere(state, { mandantId: mandantId, artikelId: aVk.id, auftragId: aufBeauftragt.id || null, kommission: aufBeauftragt.kommission || "GST Nord", menge: 12, chargeId: chVk, lagerplatzId: pLang1.id, benoetigtBis: jetzt, prioritaet: 2 }, jetzt);
      var teil = L.reserviere(state, { mandantId: mandantId, artikelId: aVk.id, auftragId: aufBeauftragt.id || null, kommission: aufBeauftragt.kommission || "GST Nord", menge: 40, lagerplatzId: pLang1.id, benoetigtBis: jetzt, prioritaet: 3 }, jetzt);

      // Entnahme gegen die volle Reservierung + Teilrückgabe.
      var vollRes = state.reservierungen[0];
      var ent = L.entnahme(state, { mandantId: mandantId, artikelId: aVk.id, menge: 10, reservierungId: vollRes.id, chargeId: vollRes.chargeId, lagerplatzId: pLang1.id, auftragId: vollRes.auftragId, kommission: vollRes.kommission, arbeitsgang: "zuschnitt", benutzer: "werkstatt" }, jetzt);
      if (ent.ok && ent.bewegung) L.rueckgabe(state, { entnahmeId: ent.bewegung.id, menge: 2, benutzer: "werkstatt", grund: "Rest nicht benötigt" }, jetzt);

      // Reststück (Langgut) aus Verschnitt anlegen.
      L.reststueckAnlegen(state, { mandantId: mandantId, artikelnummer: aVk.artikelnummer, artikelId: aVk.id, materialId: null, werkstoff: "Stahl", chargeId: (state.chargen[0] || {}).id, laenge: 1.8, gewicht: 4.14, ursprungAuftragId: vollRes.auftragId, kommission: vollRes.kommission, lagerplatzId: pLang1.id, qrRef: "QR-RST-0001" }, jetzt);

      // Charge sperren (gesperrte Charge – darf nicht entnommen werden).
      var chGesperrt = state.chargen.filter(function (c) { return c.chargennummer === "CH-RR-2026-08"; })[0];
      if (chGesperrt) L.chargeSperren(state, chGesperrt.id, "Zertifikat unklar", jetzt);

      // Beispiel-Bestellung im Freigabe-Workflow (Entwurf) für die Bestell-UI.
      L.bestellungNeu(state, { mandantId: mandantId, lieferantId: liefFrank, lieferzeitTage: 6, liefertermin: null, benutzer: "buero", positionen: [{ artikelId: aBlS.id, menge: 6 }] }, jetzt);
      // Beispiel-Artikelinventur mit einer kleinen Differenz (offen, nicht gebucht).
      state.inventuren = [];
      var inv = L.inventurNeu(state, { mandantId: mandantId, typ: L.INVENTUR_TYP.ARTIKEL, artikelIds: [aBlS.id], umfang: "Blech Stahl" }, jetzt);
      if (inv.positionen[0]) L.inventurZaehlung(state, inv.id, { positionId: inv.positionen[0].id, gezaehlt: inv.positionen[0].systemBestand - 1, grund: "Zählabweichung", benutzer: "buero" }, jetzt);

      return {
        lagerStandorte: [stand], lager: [lHaupt, lAussen], lagerBereiche: [bStahl, bBlech, bLang], lagerRegale: [rStahl, rLang],
        lagerplaetze: state.plaetze, lagerArtikel: state.artikel, lagerBewegungen: state.bewegungen, lagerChargen: state.chargen,
        lagerReservierungen: state.reservierungen, lagerReststuecke: state.reststuecke, wareneingaenge: state.wareneingaenge,
        bestellungen: state.bestellungen, lagerKonflikte: state.konflikte, lagerInventuren: state.inventuren || []
      };
    } catch (e) { return leer; }
  }

  // Beispiel-Qualitätsdaten (nur Testumgebung, Phase 16A). Baut über die reine
  // QM-Engine einen vollständigen Ablauf auf: Prüfpläne (versioniert/freigegeben),
  // Prüfaufträge mit Snapshot, bestandene und nicht bestandene Prüfung,
  // Abweichung → Sperrung → Nacharbeit → Nachprüfung, Ausschuss, Sonderfreigabe,
  // Kunden- und Lieferantenreklamation, gültiges und abgelaufenes Prüfmittel.
  // Normen/Prüfvorschriften sind reine Freitext-Referenzen (keine Konformität!).
  function beispielQualitaet(lagerSeed, auftraege, kunden, lieferanten, mandantId) {
    var Q = w.Preisschmiede && w.Preisschmiede.Qualitaet;
    var leer = { qualPruefplaene: [], qualPruefauftraege: [], qualAbweichungen: [], qualSperren: [], qualNacharbeiten: [], qualAusschuss: [], qualSonderfreigaben: [], qualMassnahmen: [], qualReklamationen: [], qualLieferantenReklamationen: [], qualPruefmittel: [], qualKosten: [], qualAudit: [], qualWareneingangspruefungen: [], qualKonflikte: [] };
    if (!Q) return leer;
    try {
      var jz = nowISO();
      var vorTagenISO = function (n) { return new Date(Date.now() - n * 86400000).toISOString(); };
      var inTagenISO = function (n) { return new Date(Date.now() + n * 86400000).toISOString(); };
      var s = { stammdaten: Q.standardStammdaten(), pruefplaene: [], pruefauftraege: [], abweichungen: [], sperren: [], nacharbeiten: [], ausschuss: [], sonderfreigaben: [], massnahmen: [], reklamationen: [], lieferantenReklamationen: [], pruefmittel: [], qualitaetskosten: [], audit: [], wareneingangspruefungen: [], konflikte: [] };
      var lagerState = { artikel: lagerSeed.lagerArtikel, plaetze: lagerSeed.lagerplaetze, chargen: lagerSeed.lagerChargen, bewegungen: lagerSeed.lagerBewegungen, reservierungen: lagerSeed.lagerReservierungen, reststuecke: lagerSeed.lagerReststuecke, wareneingaenge: lagerSeed.wareneingaenge, bestellungen: lagerSeed.bestellungen, konflikte: lagerSeed.lagerKonflikte, inventuren: lagerSeed.lagerInventuren };

      // --- Prüfmittel: eines gültig, eines mit abgelaufener Kalibrierung ---
      var pmGut = Q.pruefmittelNeu(s, { mandantId: mandantId, nummer: "PM-001", bezeichnung: "Messschieber digital 150 mm", hersteller: "Mitutoyo", modell: "500-196-30", seriennummer: "MS-88213", messbereich: "0–150 mm", genauigkeit: "0,02 mm", standort: "Werkstatt", verantwortlicher: "buero", kalibrierintervallTage: 365, letzteKalibrierung: vorTagenISO(60) }, jz);
      var pmAlt = Q.pruefmittelNeu(s, { mandantId: mandantId, nummer: "PM-002", bezeichnung: "Schichtdickenmessgerät", hersteller: "Elcometer", modell: "456", seriennummer: "SD-4471", messbereich: "0–1500 µm", genauigkeit: "±1 %", standort: "Oberfläche", verantwortlicher: "buero", kalibrierintervallTage: 365, letzteKalibrierung: vorTagenISO(500) }, jz);
      Q.pruefmittelStatusAktualisieren(s, jz);

      // --- Prüfplan 1: Edelstahlgeländer (freigegeben, v1 -> v2) ---
      var pp1 = Q.pruefplanNeu(s, {
        mandantId: mandantId, nummer: "PP-GEL-01", bezeichnung: "Edelstahlgeländer – Fertigung & Endabnahme",
        produktgruppeKey: "gelaender", arbeitsgang: "schweissen", verantwortlicheRolle: "buero",
        beschreibung: "Maß-, Schweiß- und Oberflächenprüfung für Edelstahlgeländer.",
        referenz: "Kundenvorgabe BV Musterstraße (Freitext-Referenz, keine Konformitätsaussage)",
        schritte: [
          { nummer: 1, bezeichnung: "Pfostenabstand", pruefzeitpunkt: "nach Schweißen", merkmal: "Maß", merkmalTyp: "mass", sollwert: 1200, einheit: "mm", obereToleranz: 5, untereToleranz: 5, methode: "Bandmaß", pruefmittelId: pmGut.id, pflicht: true, beiFehlerSperren: true, rolle: "werkstatt" },
          { nummer: 2, bezeichnung: "Handlaufhöhe", pruefzeitpunkt: "nach Schweißen", merkmal: "Maß", merkmalTyp: "mass", sollwert: 1000, einheit: "mm", obereToleranz: 10, untereToleranz: 10, methode: "Bandmaß", pruefmittelId: pmGut.id, pflicht: true, beiFehlerSperren: false },
          { nummer: 3, bezeichnung: "Schweißnaht Sichtprüfung", pruefzeitpunkt: "nach Schweißen", merkmal: "Schweißnaht (Sicht)", merkmalTyp: "sicht", methode: "Sichtprüfung", pflicht: true, fotoErforderlich: true, beiFehlerSperren: true },
          { nummer: 4, bezeichnung: "Oberfläche geschliffen", pruefzeitpunkt: "nach Schleifen", merkmal: "Oberfläche", merkmalTyp: "sicht", methode: "Sichtprüfung", pflicht: true, beiFehlerSperren: false },
          { nummer: 5, bezeichnung: "Endabnahme vollständig", pruefzeitpunkt: "Endabnahme", merkmal: "Vollständigkeit", merkmalTyp: "bestaetigung", pflicht: true, freigabeErforderlich: true }
        ], benutzer: "admin"
      }, jz);
      Q.pruefplanFreigeben(s, pp1.id, "admin", "admin", jz);
      // Neue Version (v2) – Vorgänger bleibt unverändert erhalten
      var pp1v2 = Q.pruefplanNeueVersion(s, pp1.id, { beschreibung: "v2: Toleranz Handlaufhöhe verschärft.", benutzer: "admin", schritte: pp1.schritte.map(function (x) { return x.nummer === 2 ? Object.assign({}, x, { obereToleranz: 5, untereToleranz: 5 }) : x; }) }, jz);
      if (pp1v2.ok) Q.pruefplanFreigeben(s, pp1v2.pruefplan.id, "admin", "admin", jz);

      // --- Prüfplan 2: Blecharbeit (freigegeben) ---
      var pp2 = Q.pruefplanNeu(s, {
        mandantId: mandantId, nummer: "PP-BLE-01", bezeichnung: "Blecharbeit – Zuschnitt & Kanten",
        produktgruppeKey: "blech", arbeitsgang: "biegen", verantwortlicheRolle: "buero",
        beschreibung: "Maß- und Winkelprüfung für Blechteile.",
        referenz: "interne Werksvorgabe (Freitext)",
        schritte: [
          { nummer: 1, bezeichnung: "Zuschnittlänge", pruefzeitpunkt: "nach Zuschnitt", merkmal: "Maß", merkmalTyp: "mass", sollwert: 500, einheit: "mm", obereToleranz: 1, untereToleranz: 1, methode: "Messschieber", pruefmittelId: pmGut.id, pflicht: true, beiFehlerSperren: true },
          { nummer: 2, bezeichnung: "Kantwinkel", pruefzeitpunkt: "nach Kanten", merkmal: "Winkel", merkmalTyp: "winkel", sollwert: 90, einheit: "°", obereToleranz: 1, untereToleranz: 1, methode: "Winkelmesser", pflicht: true, beiFehlerSperren: false },
          { nummer: 3, bezeichnung: "Beschichtungsdicke", pruefzeitpunkt: "nach Oberflächenbehandlung", merkmal: "Beschichtungsdicke", merkmalTyp: "zahl", sollwert: 80, einheit: "µm", obereToleranz: 20, untereToleranz: 20, methode: "Schichtdickenmessung", pruefmittelId: pmAlt.id, pflicht: false }
        ], benutzer: "admin"
      }, jz);
      Q.pruefplanFreigeben(s, pp2.id, "admin", "admin", jz);

      var aufA = (auftraege || []).filter(function (a) { return a.status === "Beauftragt"; })[0] || (auftraege || [])[0] || {};
      var aufB = (auftraege || []).filter(function (a) { return a.id !== aufA.id; })[0] || aufA;

      // --- Prüfauftrag 1: BESTANDEN (alle Werte in Toleranz) ---
      var pa1 = Q.pruefauftragNeu(s, { mandantId: mandantId, auftragId: aufA.id, kommission: aufA.kommission, bauteil: "Geländer Feld 1", pruefplanId: (pp1v2.ok ? pp1v2.pruefplan.id : pp1.id), pruefer: "werkstatt", geplantesDatum: jz, benutzer: "buero" }, jz);
      if (pa1.ok) {
        Q.ergebnisErfassen(s, pa1.pruefauftrag.id, { schrittNummer: 1, wert: 1202, pruefer: "werkstatt" }, jz);
        Q.ergebnisErfassen(s, pa1.pruefauftrag.id, { schrittNummer: 2, wert: 1005, pruefer: "werkstatt" }, jz);   // exakt auf Grenzwert (v2: ±5)
        Q.ergebnisErfassen(s, pa1.pruefauftrag.id, { schrittNummer: 3, wert: "io", pruefer: "werkstatt", fotoRef: "foto-schweissnaht-1" }, jz);
        Q.ergebnisErfassen(s, pa1.pruefauftrag.id, { schrittNummer: 4, wert: "io", pruefer: "werkstatt" }, jz);
        Q.ergebnisErfassen(s, pa1.pruefauftrag.id, { schrittNummer: 5, wert: true, pruefer: "buero" }, jz);
        Q.pruefauftragAbschliessen(s, pa1.pruefauftrag.id, { pruefer: "buero", rolle: "buero" }, jz);
      }

      // --- Prüfauftrag 2: NICHT BESTANDEN -> Abweichung -> Sperre -> Nacharbeit -> Nachprüfung ---
      var pa2 = Q.pruefauftragNeu(s, { mandantId: mandantId, auftragId: aufB.id, kommission: aufB.kommission, bauteil: "Geländer Feld 2", pruefplanId: (pp1v2.ok ? pp1v2.pruefplan.id : pp1.id), pruefer: "werkstatt", geplantesDatum: jz, benutzer: "buero" }, jz);
      var abw1 = null;
      if (pa2.ok) {
        Q.ergebnisErfassen(s, pa2.pruefauftrag.id, { schrittNummer: 1, wert: 1218, pruefer: "werkstatt" }, jz);   // außerhalb (+18 > +5), sperrend
        Q.ergebnisErfassen(s, pa2.pruefauftrag.id, { schrittNummer: 2, wert: 998, pruefer: "werkstatt" }, jz);
        Q.ergebnisErfassen(s, pa2.pruefauftrag.id, { schrittNummer: 3, wert: "io", pruefer: "werkstatt", fotoRef: "foto-schweissnaht-2" }, jz);
        Q.ergebnisErfassen(s, pa2.pruefauftrag.id, { schrittNummer: 4, wert: "io", pruefer: "werkstatt" }, jz);
        Q.ergebnisErfassen(s, pa2.pruefauftrag.id, { schrittNummer: 5, wert: true, pruefer: "buero" }, jz);
        Q.pruefauftragAbschliessen(s, pa2.pruefauftrag.id, { pruefer: "buero", rolle: "buero" }, jz);
        var a1 = Q.abweichungNeu(s, {
          mandantId: mandantId, auftragId: aufB.id, kommission: aufB.kommission, bauteil: "Geländer Feld 2",
          arbeitsgang: "schweissen", pruefauftragId: pa2.pruefauftrag.id, beschreibung: "Pfostenabstand 1218 mm statt 1200 mm (+18 mm).",
          fehlerart: "Maßabweichung", fehlerklasse: "hauptfehler", menge: 1, ersteller: "werkstatt", risikostufe: "mittel",
          sofortmassnahme: "Bauteil gekennzeichnet und zurückgestellt.", rolle: "werkstatt"
        }, jz);
        if (a1.ok) {
          abw1 = a1.abweichung;
          Q.sperreNeu(s, { mandantId: mandantId, objektTyp: "Auftragsteil", objektId: aufB.id, abweichungId: abw1.id, grund: "Maßabweichung Pfostenabstand", benutzer: "buero", rolle: "buero" }, jz);
          // Ursachenanalyse: zwei Kandidaten, einer bestätigt (ausdrücklich)
          var k1 = Q.ursacheKandidatHinzufuegen(s, abw1.id, { text: "Anschlag der Schweißvorrichtung verschoben", kategorie: "Maschine", benutzer: "werkstatt", fuenfWhy: ["Abstand zu groß", "Anschlag verschoben", "Fixierung gelöst", "Vibration", "Wartungsintervall zu lang"] }, jz);
          Q.ursacheKandidatHinzufuegen(s, abw1.id, { text: "Zeichnungsmaß falsch abgelesen", kategorie: "Mensch", benutzer: "buero" }, jz);
          if (k1.ok) Q.ursacheBestaetigen(s, abw1.id, k1.kandidat.id, { benutzer: "admin", herkunft: "intern", grund: "Vorrichtung nachgemessen" }, jz);
          // Nacharbeitsfreigabe erfordert das Recht „nacharbeitFreigeben" (nur admin).
          var na1 = Q.nacharbeitNeu(s, { mandantId: mandantId, abweichungId: abw1.id, ursacheText: "Anschlag neu ausgerichtet", herkunft: "intern", taetigkeit: "Pfosten trennen, neu positionieren, schweißen, schleifen", mitarbeitergruppe: "Schweißerei", geplanteZeitStd: 2.5, tatsaechlicheZeitStd: 3, termin: inTagenISO(2), benutzer: "admin", rolle: "admin", freigeben: true }, jz);
          if (na1.ok) {
            Q.kostenErfassen(s, { mandantId: mandantId, abweichungId: abw1.id, nacharbeitId: na1.nacharbeit.id, auftragId: aufB.id, art: "Nacharbeit", betrag: 3 * 48, herkunft: "Nacharbeit Schweißerei", benutzer: "buero" }, jz);
            Q.kostenErfassen(s, { mandantId: mandantId, abweichungId: abw1.id, nacharbeitId: na1.nacharbeit.id, auftragId: aufB.id, art: "Material", betrag: 34.5, herkunft: "Ersatzmaterial", benutzer: "buero" }, jz);
            var np = Q.nachpruefungAnlegen(s, na1.nacharbeit.id, { pruefer: "werkstatt", benutzer: "buero" }, jz);
            if (np.ok) {
              Q.ergebnisErfassen(s, np.pruefauftrag.id, { schrittNummer: 1, wert: 1201, pruefer: "werkstatt" }, jz);
              Q.ergebnisErfassen(s, np.pruefauftrag.id, { schrittNummer: 2, wert: 1002, pruefer: "werkstatt" }, jz);
              Q.ergebnisErfassen(s, np.pruefauftrag.id, { schrittNummer: 3, wert: "io", pruefer: "werkstatt", fotoRef: "foto-nachpruefung" }, jz);
              Q.ergebnisErfassen(s, np.pruefauftrag.id, { schrittNummer: 4, wert: "io", pruefer: "werkstatt" }, jz);
              Q.ergebnisErfassen(s, np.pruefauftrag.id, { schrittNummer: 5, wert: true, pruefer: "buero" }, jz);
              Q.pruefauftragAbschliessen(s, np.pruefauftrag.id, { pruefer: "buero", rolle: "buero" }, jz);
            }
          }
          Q.massnahmeNeu(s, { mandantId: mandantId, abweichungId: abw1.id, beschreibung: "Wartungsintervall der Schweißvorrichtung von 12 auf 6 Monate verkürzen.", verantwortlicher: "buero", frist: inTagenISO(30), benutzer: "admin" }, jz);
        }
      }

      // --- Wareneingangsprüfung mit Teilfreigabe (nutzt den Lagerkern) ---
      var chQS = (lagerSeed.lagerChargen || []).filter(function (c) { return c.chargennummer === "CH-RR-2026-08"; })[0];
      var weQS = (lagerSeed.wareneingaenge || []).filter(function (x) { return x.lieferschein === "LS-2026-103"; })[0];
      if (chQS && weQS) {
        Q.wareneingangsPruefung(s, lagerState, {
          mandantId: mandantId, wareneingangId: weQS.id, artikelId: (weQS.positionen[0] || {}).artikelId,
          chargeId: chQS.id, lieferantId: weQS.lieferantId, gelieferteMenge: 5, freigegebeneMenge: 3, beschaedigteMenge: 1,
          zertifikatOk: false, schaeden: "1 Stange transportbedingt verkratzt; Zertifikat unvollständig.",
          lieferantenfehler: true, pruefer: "buero", lagerplatzId: (weQS.positionen[0] || {}).lagerplatzId
        }, jz);
        // Lieferantenreklamation inkl. direkter Chargensperre
        Q.lieferantenReklamationNeu(s, lagerState, {
          mandantId: mandantId, lieferantId: weQS.lieferantId, wareneingangId: weQS.id, artikelId: (weQS.positionen[0] || {}).artikelId,
          chargeId: chQS.id, lieferschein: weQS.lieferschein, menge: 2, fehler: "Transportschaden + unvollständiges Zertifikat",
          zertifikat: "Werkszeugnis 3.1 unvollständig", geforderteMassnahme: "Ersatzlieferung und vollständiges Zertifikat",
          chargeSperren: true, benutzer: "buero", rolle: "buero"
        }, jz);
      }

      // --- Ausschuss + Sonderfreigabe (getrennte Vorgänge) ---
      var artBlech = (lagerSeed.lagerArtikel || []).filter(function (a) { return a.artikelnummer === "BL-STAHL-2.0"; })[0];
      var pa3 = Q.pruefauftragNeu(s, { mandantId: mandantId, auftragId: aufA.id, kommission: aufA.kommission, bauteil: "Blechzuschnitt A", pruefplanId: pp2.id, pruefer: "werkstatt", benutzer: "buero" }, jz);
      if (pa3.ok) {
        Q.ergebnisErfassen(s, pa3.pruefauftrag.id, { schrittNummer: 1, wert: 496, pruefer: "werkstatt" }, jz);  // außerhalb (−4 > ±1), sperrend
        Q.ergebnisErfassen(s, pa3.pruefauftrag.id, { schrittNummer: 2, wert: 90.5, pruefer: "werkstatt" }, jz);
        Q.pruefauftragAbschliessen(s, pa3.pruefauftrag.id, { pruefer: "buero", rolle: "buero" }, jz);
        var a2 = Q.abweichungNeu(s, { mandantId: mandantId, auftragId: aufA.id, kommission: aufA.kommission, bauteil: "Blechzuschnitt A", arbeitsgang: "zuschnitt", pruefauftragId: pa3.pruefauftrag.id, beschreibung: "Zuschnittlänge 496 mm statt 500 mm.", fehlerart: "Maßabweichung", fehlerklasse: "kritisch", menge: 2, ersteller: "werkstatt", risikostufe: "hoch", rolle: "werkstatt" }, jz);
        if (a2.ok && artBlech) {
          Q.ausschussNeu(s, lagerState, { mandantId: mandantId, abweichungId: a2.abweichung.id, auftragId: aufA.id, bauteil: "Blechzuschnitt A", artikelId: artBlech.id, menge: 2, materialkosten: 112, bearbeitungskosten: 36, maschinenkosten: 24, grund: "Zuschnitt zu kurz – nicht nacharbeitbar", freigegebenVon: "admin", entsorgung: "Schrottcontainer Stahl", ersatzfertigung: true, benutzer: "admin", lagerplatzId: artBlech.standardLagerplatzId }, jz);
        }
        // Sonderfreigabe an einem separaten Fall (Winkel leicht außerhalb, technisch vertretbar)
        var a3 = Q.abweichungNeu(s, { mandantId: mandantId, auftragId: aufA.id, kommission: aufA.kommission, bauteil: "Blechkante B", arbeitsgang: "biegen", beschreibung: "Kantwinkel 91,5° statt 90° ±1°.", fehlerart: "Maßabweichung", fehlerklasse: "nebenfehler", menge: 1, ersteller: "werkstatt", risikostufe: "niedrig", rolle: "werkstatt" }, jz);
        if (a3.ok) {
          Q.sonderfreigabeNeu(s, { mandantId: mandantId, abweichungId: a3.abweichung.id, beurteilung: "Funktion und Optik nicht beeinträchtigt; Anschluss bauseits toleranzausgleichend.", risikostufe: "niedrig", freigebender: "admin", einschraenkungen: "Nur für dieses Bauteil, nicht auf Serie übertragbar.", kundenbestaetigungErforderlich: true, rolle: "admin" }, jz);
        }
      }

      // --- Kundenreklamation (bewusst NICHT bewertet) ---
      var kunde0 = (kunden || [])[0] || {};
      Q.reklamationNeu(s, {
        mandantId: mandantId, kundeId: kunde0.id, kommission: aufA.kommission, auftragId: aufA.id,
        produkt: "Edelstahlgeländer", lieferdatum: vorTagenISO(14), meldedatum: vorTagenISO(3),
        ansprechpartner: kunde0.ansprechpartner || kunde0.name || "Kunde", beschreibung: "Kunde meldet Kratzer an zwei Handlaufabschnitten nach Montage.",
        menge: 2, prioritaet: "hoch", verantwortlicher: "buero", benutzer: "buero", rolle: "buero"
      }, jz);

      return {
        qualStammdaten: s.stammdaten, qualPruefplaene: s.pruefplaene, qualPruefauftraege: s.pruefauftraege,
        qualAbweichungen: s.abweichungen, qualSperren: s.sperren, qualNacharbeiten: s.nacharbeiten,
        qualAusschuss: s.ausschuss, qualSonderfreigaben: s.sonderfreigaben, qualMassnahmen: s.massnahmen,
        qualReklamationen: s.reklamationen, qualLieferantenReklamationen: s.lieferantenReklamationen,
        qualPruefmittel: s.pruefmittel, qualKosten: s.qualitaetskosten, qualAudit: s.audit,
        qualWareneingangspruefungen: s.wareneingangspruefungen, qualKonflikte: s.konflikte
      };
    } catch (e) { return leer; }
  }

  function fresh() {
    var mats = SEED_MATERIAL.map(function (m) {
      return {
        id: uid(),
        name: m.name, typ: m.typ, einheit: m.einheit,
        preis: m.preis, lieferant: m.lieferant,
        kgProEinheit: m.kg != null ? m.kg : null, // Gewicht je Einheit
        preisProKg: null, // optional: wenn gesetzt, wird über Gewicht gerechnet
        lager: null, // optionaler Lagerbestand
        aktualisiert: nowISO(),
        historie: [{ datum: nowISO(), preis: m.preis }]
      };
    });
    var lieferanten = SEED_LIEFERANTEN.map(function (l) { return Object.assign({ id: uid() }, l); });
    var mitarbeiter = SEED_MITARBEITER.map(function (m) { return Object.assign({ id: uid() }, m); });
    var kunden = SEED_KUNDEN.map(function (k) { return Object.assign({ id: uid(), erstellt: nowISO() }, k); });
    var users = SEED_USERS.map(makeUser);
    // Ein Beispielprojekt für den ersten Kunden
    var projekte = [{
      id: uid(), nummer: "P-2026-001", name: "Geländer Terrasse", kundeId: kunden[0].id,
      kommission: "BV Musterstraße", status: "Aktiv", notiz: "", erstellt: nowISO()
    }];
    var settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    var auftraegeSeed = beispielAuftraege(kunden);
    // Produktkonfigurator: Produktgruppen, Vorlagen und Beispielkonfigurationen
    var V = w.Preisschmiede && w.Preisschmiede.Vorlagen;
    var produktgruppen = V ? JSON.parse(JSON.stringify(V.SEED_PRODUKTGRUPPEN)) : [];
    var vorlagen = V ? JSON.parse(JSON.stringify(V.SEED_VORLAGEN)) : [];
    var konfigurationen = [];
    if (V) {
      try {
        konfigurationen = V.beispielKonfigurationen({
          uid: uid, nowISO: nowISO, kunden: kunden, projekte: projekte, settings: settings,
          Konfigurator: w.Preisschmiede.Konfigurator
        });
        settings.konfigZaehler = konfigurationen.length + 1;
      } catch (e) { konfigurationen = []; }
    }
    var kalkulationen = [];
    var Kalk = w.Preisschmiede && w.Preisschmiede.Kalkulation;
    if (Kalk) {
      try {
        kalkulationen = Kalk.beispielKalkulationen({ uid: uid, nowISO: nowISO, num: function (x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }, kunden: kunden, projekte: projekte, konfigurationen: konfigurationen, settings: settings });
        settings.kalkZaehler = kalkulationen.length + 1;
      } catch (e) { kalkulationen = []; }
    }
    // Angebote (Phase 4)
    var Ang = w.Preisschmiede && w.Preisschmiede.Angebot;
    var textbausteine = [], angebote = [];
    if (Ang) {
      settings.angebotVorlagen = [JSON.parse(JSON.stringify(Ang.DEFAULT_VORLAGE))];
      textbausteine = Ang.SEED_TEXTBAUSTEINE.map(function (t, i) { return Object.assign({ id: uid(), aktiv: true, sort: (i + 1) * 10 }, t); });
      try {
        angebote = Ang.beispielAngebote({ uid: uid, nowISO: nowISO, jahr: new Date().getFullYear(), kalkulationen: kalkulationen, Kalkulation: Kalk });
        settings.angebotNummernkreis.laufend = angebote.length + 1;
        settings.angebotZaehler = angebote.length + 1;
      } catch (e) { angebote = []; }
    }

    // ---- Kundenportal-Beispieldaten (Phase 12) ----------------------
    // Reichert das freigegebene Beispielangebot um eine Alternativgruppe an
    // und legt Portalzugang (Konto + Link-Hash), Dokumentfreigabe und eine
    // Kundenfrage an – alles klar als Beispiel markiert.
    var portalUsers = [], portalLinks = [], portalNachrichten = [], dokumentFreigaben = [], zeichnungsFreigaben = [], kundenUploads = [];
    var dokumenteSeed = []; try { dokumenteSeed = beispielDokumente(kunden, auftraegeSeed); } catch (e) { dokumenteSeed = []; }
    var freig = (angebote || []).filter(function (a) { return a.status === "freigegeben"; })[0];
    if (freig) {
      freig.gueltigBisISO = new Date(Date.now() + 30 * 86400000).toISOString();
      freig.ansprechpartner = (kunden[0] && kunden[0].ansprechpartner) || "Herr Huber";
      var maxNr = (freig.positionen || []).reduce(function (m, p) { return Math.max(m, parseInt(p.nummer, 10) || 0); }, 0);
      // Alternativgruppe "Montage" (genau eine wählbar) – nicht vorselektiert
      freig.positionen.push({ nummer: String(maxNr + 1), typ: "alternativ", gruppe: "montage", kurz: "Montage durch uns (Standard)", beschreibung: "Lieferung und Montage vor Ort, Standardanfahrt", menge: 1, einheit: "Pausch.", einzelpreis: 380, mwstProz: 20, aktiv: true, aktiviert: false });
      freig.positionen.push({ nummer: String(maxNr + 2), typ: "alternativ", gruppe: "montage", kurz: "Montage Premium (inkl. Einweisung)", beschreibung: "Montage mit ausführlicher Einweisung und Feinjustierung", menge: 1, einheit: "Pausch.", einzelpreis: 620, mwstProz: 20, aktiv: true, aktiviert: false });

      var kundeP = kunden[0] || { id: "k0", name: "Kunde", email: "kunde@example.at", ansprechpartner: "Herr Huber" };
      var puSalt = makeSalt();
      portalUsers.push({
        id: uid(), kundeId: kundeP.id, ansprechpartnerId: null,
        name: kundeP.ansprechpartner || "Herr Huber", email: (kundeP.email || "office@musterbau.at").toLowerCase(),
        telefon: kundeP.tel || "", rolle: "kundenadmin", status: "aktiv",
        einladungsdatum: nowISO(), letzterLogin: null, emailBestaetigt: true,
        erlaubteProjekte: [], erlaubteAktionen: [],
        passwortSalt: puSalt, passwortHash: hashPin("portal1234", puSalt), beispiel: true
      });
      // Sicherer Demo-Angebotslink: nur Hash des festen Demo-Tokens gespeichert.
      var lkSalt = makeSalt();
      portalLinks.push({
        id: uid(), mandantId: null, angebotId: freig.id, kundeId: kundeP.id,
        ansprechpartner: kundeP.ansprechpartner || "", email: (kundeP.email || "").toLowerCase(),
        tokenSalt: lkSalt, tokenHash: hashPin("DEMO-ANGEBOTSLINK", lkSalt),
        ablauf: new Date(Date.now() + 30 * 86400000).toISOString(),
        einmalig: false, verwendet: false, widerrufen: null,
        emailBestaetigungNoetig: false, emailBestaetigt: true, erstellt: nowISO(), beispiel: true
      });
      portalNachrichten.push({
        id: uid(), angebotId: freig.id, positionNr: null, mandantId: null, kundeId: kundeP.id,
        absender: kundeP.ansprechpartner || "Kunde", empfaenger: "Vertrieb", text: "Ist eine Montage am Wochenende möglich?",
        zeitpunkt: nowISO(), status: "offen", kundeSichtbar: true, intern: false, anhaenge: [], beispiel: true
      });

      // Zeichnungsfreigabe (Phase 12B): aktuelle Revision B sichtbar „zur Prüfung",
      // ältere Revision A eindeutig als „ersetzt" markiert (nicht mehr freigebbar).
      var zRevB = dokumenteSeed.filter(function (dk) { return dk.zeichnungsnummer === "1045" && dk.revision === "B"; })[0];
      var zRevA = dokumenteSeed.filter(function (dk) { return dk.zeichnungsnummer === "1045" && dk.revision === "A"; })[0];
      if (zRevB) {
        zeichnungsFreigaben.push({
          id: uid(), mandantId: null, kundeId: kundeP.id, dokumentId: zRevB.id,
          zeichnungsnummer: "1045", revision: "B", titel: zRevB.beschreibung || "Geländerpfosten", datum: nowISO(),
          sichtbar: true, sichtbarAb: null, sichtbarBis: null, erlaubteAnsprechpartner: [],
          status: "zur Prüfung", aktuell: true, vorgaengerId: zRevA ? zRevA.id : null, entscheidungen: [], erstellt: nowISO(), beispiel: true
        });
      }
      if (zRevA) {
        zeichnungsFreigaben.push({
          id: uid(), mandantId: null, kundeId: kundeP.id, dokumentId: zRevA.id,
          zeichnungsnummer: "1045", revision: "A", titel: (zRevA.beschreibung || "Geländerpfosten") + " (alt)", datum: nowISO(),
          sichtbar: true, sichtbarAb: null, sichtbarBis: null, erlaubteAnsprechpartner: [],
          status: "ersetzt", aktuell: false, vorgaengerId: null, entscheidungen: [], erstellt: nowISO(), beispiel: true
        });
      }
      // Beispiel-Kundenupload (intern „ungeprüft", nie automatisch freigegeben).
      kundenUploads.push({
        id: uid(), mandantId: null, kundeId: kundeP.id, angebotId: freig.id,
        dateiname: "Baustellenfoto_Eingang.jpg", typ: "Foto", mime: "image/jpeg", beschreibung: "Aktuelle Einbausituation vor Ort",
        projekt: freig.bezeichnung || "", kommission: freig.kommission || "", version: 1,
        groesse: 240000, inhalt: null, pruefStatus: "ungeprüft", technischFreigegeben: false, sichtbarIntern: true,
        hochgeladen: nowISO(), beispiel: true
      });
    }

    // ---- Nachträge & Rechnungen (Phase 13A, nur Testumgebung) -------
    var nachtraege = [], rechnungen = [];
    try {
      var R = w.Preisschmiede.Rechnung;
      if (R && auftraegeSeed && auftraegeSeed.length) {
        var auf = auftraegeSeed.filter(function (a) { return a.status === "Beauftragt"; })[0] || auftraegeSeed[0];
        var kId = auf.kundeId, kom = auf.kommission, jahr = new Date().getFullYear();
        var kundeR = kunden.filter(function (k) { return k.id === kId; })[0] || {};
        // Angenommener Nachtrag mit eigenem Soll-Snapshot
        var nt = R.nachtragNeu({ mandantId: null, auftragId: auf.id, kommission: kom, kundeId: kId, bezeichnung: "Zusätzliches Handlaufsegment", ursache: "Kundenwunsch", mwstProz: 20,
          kalk: { material: { menge: 40, einkaufspreis: 6, verschnittProz: 5, frachtanteil: 10, materialaufschlagProz: 15 }, arbeit: { ruestzeit: 0.5, bearbeitungProStk: 6, stueckzahl: 1, anzahlMitarbeiter: 1, internerSatz: 40, verkaufSatz: 70 } }, beispiel: true }, nowISO());
        R.nachtragKalkulieren(nt, nowISO()); R.nachtragStatus(nt, "freigegeben", nowISO()); R.nachtragStatus(nt, "angenommen", nowISO());
        nt.nummer = "NT-" + jahr + "-0001"; nachtraege.push(nt);
        var belegBsp = function (art, positionen, extra) {
          var b = R.belegNeu(Object.assign({ mandantId: null, kundeId: kId, kommission: kom, auftragId: auf.id, art: art, mwstProz: 20, positionen: positionen, beispiel: true, ersteller: "admin" }, extra || {}), nowISO());
          R.belegFreigeben(b, settings, { benutzer: "admin", firma: settings.firma, kunde: kundeR }, nowISO());
          return b;
        };
        var akonto = belegBsp("Akontorechnung", [{ bezeichnung: "Akontozahlung 30 %", menge: 1, einheit: "Pausch.", einzelpreis: 1830, mwstProz: 20 }]);
        R.zahlungErfassen(akonto, { betrag: 1000, art: "Überweisung", referenz: "AZ-1", erfasstVon: "admin" }, nowISO()); // Teilzahlung
        var teil1 = belegBsp("Teilrechnung", [{ bezeichnung: "Fertigung Geländer – Abschnitt 1", menge: 1, einheit: "Pausch.", einzelpreis: 2000, mwstProz: 20, gesamtmenge: 2, bereitsAbgerechnet: 0 }]);
        var teil2 = belegBsp("Teilrechnung", [{ bezeichnung: "Fertigung Geländer – Abschnitt 2", menge: 1, einheit: "Pausch.", einzelpreis: 1200, mwstProz: 20, gesamtmenge: 2, bereitsAbgerechnet: 1 }]);
        var restNetto = R.schlussVorschlagNetto(auf.kalk.netto, nachtraege, [akonto, teil1, teil2]);
        function anr(b) { var s = R.belegSummen(b); return { belegId: b.id, bezeichnung: b.nummer, netto: s.netto, mwst: s.mwst, brutto: s.brutto }; }
        var schluss = belegBsp("Schlussrechnung", [{ bezeichnung: "Schlussrechnung Restleistung inkl. Nachtrag", menge: 1, einheit: "Pausch.", einzelpreis: restNetto, mwstProz: 20 }], { anrechnungen: [anr(akonto), anr(teil1), anr(teil2)] });
        var gut = R.gutschriftZu(teil1, { positionen: [{ bezeichnung: "Teilgutschrift zu " + teil1.nummer, menge: 1, einheit: "Pausch.", einzelpreis: 200, mwstProz: 20 }], grund: "Nachlass nach Rücksprache", ersteller: "admin" }, nowISO());
        R.belegFreigeben(gut, settings, { benutzer: "admin", firma: settings.firma, kunde: kundeR }, nowISO());
        var storno = R.stornoZu(teil2, { grund: "fehlerhafte Position – Neuausstellung", ersteller: "admin" }, nowISO());
        R.belegFreigeben(storno, settings, { benutzer: "admin", firma: settings.firma, kunde: kundeR }, nowISO());
        // Zwei Belege ausdrücklich fürs Kundenportal freigeben (Demo)
        akonto.portalSichtbar = true; schluss.portalSichtbar = true;
        rechnungen.push(akonto, teil1, teil2, schluss, gut, storno);
      }
    } catch (e) { nachtraege = []; rechnungen = []; }

    var lagerSeed = beispielLager(lieferanten, auftraegeSeed, null);
    if (!settings.lager) settings.lager = { bewertungsmethode: "gleitend", zaehler: { artikel: 1, charge: 1, wareneingang: 1, bestellung: 1 } };
    var qualSeed = beispielQualitaet(lagerSeed, auftraegeSeed, kunden, lieferanten, null);
    if (!settings.qualitaet) settings.qualitaet = { stammdaten: qualSeed.qualStammdaten || null, zaehler: { pruefplan: 1, pruefauftrag: 1, abweichung: 1 } };
    return {
      version: 13,
      settings: settings,
      kalkulationen: kalkulationen,
      angebote: angebote,
      textbausteine: textbausteine,
      material: mats,
      kunden: kunden,
      lieferanten: lieferanten,
      mitarbeiter: mitarbeiter,
      projekte: projekte,
      users: users,
      produktgruppen: produktgruppen,
      vorlagen: vorlagen,
      konfigurationen: konfigurationen,
      // benutzerdefinierte Untergruppen je Produkt, z. B. { zaun: ["Doppelstabmattenzaun", ...] }
      untergruppen: {},
      auftraege: auftraegeSeed,
      // Fertigungsplanung (Phase 7C)
      planung: beispielPlanung(auftraegeSeed, settings, mitarbeiter),
      // Dokumente/Zeichnungen/Stücklisten (Phase 7D)
      dokumente: dokumenteSeed,
      // Betrieb/Pilot (Phase 9): Feedback- und Fehlerprotokoll
      feedback: [],
      fehlerlog: [],
      // Kundenportal (Phase 12) – mandantengetrennt; Beispielzugang vorbereitet
      portalUsers: portalUsers,
      portalLinks: portalLinks,
      portalNachrichten: portalNachrichten,
      portalProtokolle: [],
      dokumentFreigaben: dokumentFreigaben,
      zeichnungsFreigaben: zeichnungsFreigaben,
      kundenUploads: kundenUploads,
      portalEreignisse: [],
      // Nachträge & Rechnungen (Phase 13A, nur Testumgebung)
      nachtraege: nachtraege,
      rechnungen: rechnungen,
      erpExporte: [],
      // Ziel der Offline-Synchronisation (Phase 14A)
      offlineBuchungen: [],
      // Lagerkern (Phase 15A) – mandantengetrennt, Journal ist Quelle der Wahrheit
      lagerStandorte: lagerSeed.lagerStandorte,
      lager: lagerSeed.lager,
      lagerBereiche: lagerSeed.lagerBereiche,
      lagerRegale: lagerSeed.lagerRegale,
      lagerplaetze: lagerSeed.lagerplaetze,
      lagerArtikel: lagerSeed.lagerArtikel,
      lagerBewegungen: lagerSeed.lagerBewegungen,
      lagerChargen: lagerSeed.lagerChargen,
      lagerReservierungen: lagerSeed.lagerReservierungen,
      lagerReststuecke: lagerSeed.lagerReststuecke,
      wareneingaenge: lagerSeed.wareneingaenge,
      bestellungen: lagerSeed.bestellungen,
      lagerKonflikte: lagerSeed.lagerKonflikte,
      lagerInventuren: lagerSeed.lagerInventuren || [],
      // Qualitätsmanagement-Kern (Phase 16A) – mandantengetrennt
      qualPruefplaene: qualSeed.qualPruefplaene,
      qualPruefauftraege: qualSeed.qualPruefauftraege,
      qualAbweichungen: qualSeed.qualAbweichungen,
      qualSperren: qualSeed.qualSperren,
      qualNacharbeiten: qualSeed.qualNacharbeiten,
      qualAusschuss: qualSeed.qualAusschuss,
      qualSonderfreigaben: qualSeed.qualSonderfreigaben,
      qualMassnahmen: qualSeed.qualMassnahmen,
      qualReklamationen: qualSeed.qualReklamationen,
      qualLieferantenReklamationen: qualSeed.qualLieferantenReklamationen,
      qualPruefmittel: qualSeed.qualPruefmittel,
      qualKosten: qualSeed.qualKosten,
      qualAudit: qualSeed.qualAudit,
      qualWareneingangspruefungen: qualSeed.qualWareneingangspruefungen,
      qualKonflikte: qualSeed.qualKonflikte,
      // Lernmodell: Korrekturfaktoren je Produkttyp & Arbeitsschritt
      lernen: { faktoren: {}, erkenntnisse: [] }
    };
  }

  var _db = null;

  // Sanfte, idempotente Migration: füllt fehlende Felder feldweise auf,
  // sodass nie ein fehlendes Feld später einen Crash oder eine NaN-
  // Fehlkalkulation auslöst. Gibt null zurück, wenn obj kein Objekt ist.
  function migrate(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    var ds = DEFAULT_SETTINGS;
    if (!obj.settings || typeof obj.settings !== "object") obj.settings = JSON.parse(JSON.stringify(ds));
    var st = obj.settings;
    // Maschinen: altes Objekt {key: satz} -> Liste mit Rüstkosten
    if (st.maschinen && !Array.isArray(st.maschinen)) {
      var alt = st.maschinen;
      var map = {
        saege: ["Säge", "zuschnitt"], laser: ["Laser", "lasern"],
        abkantpresse: ["Abkantpresse", "biegen"], bohrmaschine: ["Bohrmaschine", "bohren"],
        schweissgeraet: ["Schweißgerät", "schweissen"], schleifmaschine: ["Schleifmaschine", "schleifen"]
      };
      st.maschinen = Object.keys(alt).map(function (k) {
        var m = map[k] || [k, ""];
        return { id: "m-" + k, name: m[0], schritt: m[1], stundensatz: alt[k], ruestkosten: 0 };
      });
    }
    if (!Array.isArray(st.maschinen)) st.maschinen = JSON.parse(JSON.stringify(ds.maschinen));
    // Maschinen: altes Feld ruestkosten (pauschal) -> fixeRuestkosten;
    // Rüstzeit/Rüstkostensatz als neue Felder ergänzen.
    st.maschinen.forEach(function (m) {
      if (!m) return;
      if (m.fixeRuestkosten == null) m.fixeRuestkosten = (typeof m.ruestkosten === "number" ? m.ruestkosten : 0);
      if (typeof m.ruestzeitStd !== "number") m.ruestzeitStd = 0;
      if (typeof m.ruestkostensatz !== "number") m.ruestkostensatz = (st.rates && st.rates.fertigung) || 40;
      if (typeof m.stundensatz !== "number") m.stundensatz = 0;
      // Kapazität für Auslastungsanalyse (Phase 7A)
      if (typeof m.arbeitstage !== "number") m.arbeitstage = 220;
      if (typeof m.stundenProTag !== "number") m.stundenProTag = 8;
      if (typeof m.wartungStunden !== "number") m.wartungStunden = 0;
      // Planungsfelder (Phase 7C)
      if (typeof m.maxParallel !== "number") m.maxParallel = 1;
      if (m.standort == null) m.standort = "";
      if (!Array.isArray(m.alternativMaschinen)) m.alternativMaschinen = [];
      if (m.qualifikation == null) m.qualifikation = "";
      delete m.ruestkosten;
    });
    if (st.projektZaehler == null) st.projektZaehler = 1;
    if (!st.firma || typeof st.firma !== "object") st.firma = JSON.parse(JSON.stringify(ds.firma));
    Object.keys(ds.firma).forEach(function (k) { if (st.firma[k] == null) st.firma[k] = ds.firma[k]; });
    // Stundensätze (rates) feldweise auffüllen
    if (!st.rates || typeof st.rates !== "object") st.rates = JSON.parse(JSON.stringify(ds.rates));
    Object.keys(ds.rates).forEach(function (k) { if (typeof st.rates[k] !== "number") st.rates[k] = ds.rates[k]; });
    // alle numerischen Top-Level-Einstellungen (Aufschläge, Gewinn, MwSt, ...) auffüllen
    Object.keys(ds).forEach(function (k) { if (typeof ds[k] === "number" && typeof st[k] !== "number") st[k] = ds[k]; });
    if (st.angebotZaehler == null) st.angebotZaehler = 1;
    if (!obj.lernen || typeof obj.lernen !== "object") obj.lernen = { faktoren: {}, erkenntnisse: [] };
    if (!obj.lernen.faktoren || typeof obj.lernen.faktoren !== "object") obj.lernen.faktoren = {};
    if (!Array.isArray(obj.lernen.erkenntnisse)) obj.lernen.erkenntnisse = [];
    if (!Array.isArray(obj.material)) obj.material = [];
    // Material: Preishistorie sicherstellen (sonst crasht m.historie.push)
    // + frühere Sortiment-Kategorien auf die thesteel.com-Struktur umstellen.
    var KAT_MIG = {
      "Rohre|Rundrohr": ["Rundrohre", "Rundrohr"],
      "Rohre|Vierkantrohr": ["Formrohre & Profile", "Vierkantrohr"],
      "Rohre|Rechteckrohr": ["Formrohre & Profile", "Rechteckrohr"],
      "Vollmaterial|Flachstahl": ["Voll-/Stabmaterial", "Flachstahl"],
      "Vollmaterial|Rundstahl": ["Voll-/Stabmaterial", "Rundstahl"],
      "Vollmaterial|Vierkantstahl": ["Voll-/Stabmaterial", "Vierkantstahl"],
      "Profile|Winkel": ["Voll-/Stabmaterial", "Winkelstahl"],
      "Profile|U-Profil": ["Stahlträger", "U-Stahl"],
      "Träger|IPE": ["Stahlträger", "IPE"],
      "Träger|HEA": ["Stahlträger", "HEA"]
    };
    obj.material.forEach(function (m) {
      if (!m) return;
      if (!Array.isArray(m.historie)) m.historie = (m.preis != null ? [{ datum: nowISO(), preis: m.preis }] : []);
      var mig = KAT_MIG[(m.kategorie || "") + "|" + (m.unterkategorie || "")];
      if (mig) { m.kategorie = mig[0]; m.unterkategorie = mig[1]; }
    });
    if (!Array.isArray(obj.kunden)) obj.kunden = [];
    // Neue Verwaltungs-Entitäten (Betriebsverwaltung)
    if (!Array.isArray(obj.lieferanten)) obj.lieferanten = SEED_LIEFERANTEN.map(function (l) { return Object.assign({ id: uid() }, l); });
    if (!Array.isArray(obj.mitarbeiter)) obj.mitarbeiter = SEED_MITARBEITER.map(function (m) { return Object.assign({ id: uid() }, m); });
    // Planungsfelder für Mitarbeiter (Phase 7C)
    obj.mitarbeiter.forEach(function (m) {
      if (!m) return;
      if (!Array.isArray(m.qualifikationen)) m.qualifikationen = [];
      if (!Array.isArray(m.abwesenheiten)) m.abwesenheiten = [];
      if (!Array.isArray(m.maschinenberechtigungen)) m.maschinenberechtigungen = [];
      if (m.team == null) m.team = "";
      if (m.standort == null) m.standort = "";
      if (m.maxStundenProTag == null) m.maxStundenProTag = 8;
    });
    if (!Array.isArray(obj.projekte)) obj.projekte = [];
    // Produktkonfigurator (Phase 3A)
    var Vor = w.Preisschmiede && w.Preisschmiede.Vorlagen;
    if (!st.dichten || typeof st.dichten !== "object") st.dichten = JSON.parse(JSON.stringify(ds.dichten));
    ["Stahl", "Edelstahl", "Aluminium"].forEach(function (k) { if (typeof st.dichten[k] !== "number") st.dichten[k] = ds.dichten[k]; });
    if (st.konfigZaehler == null) st.konfigZaehler = 1;
    if (!Array.isArray(obj.produktgruppen)) obj.produktgruppen = Vor ? JSON.parse(JSON.stringify(Vor.SEED_PRODUKTGRUPPEN)) : [];
    if (!Array.isArray(obj.vorlagen)) obj.vorlagen = Vor ? JSON.parse(JSON.stringify(Vor.SEED_VORLAGEN)) : [];
    if (!Array.isArray(obj.konfigurationen)) obj.konfigurationen = [];
    // Kalkulationen (Phase 3B)
    if (!Array.isArray(obj.kalkulationen)) obj.kalkulationen = [];
    if (st.kalkZaehler == null) st.kalkZaehler = 1;
    if (!st.toleranzen || typeof st.toleranzen !== "object") st.toleranzen = JSON.parse(JSON.stringify(ds.toleranzen));
    // Angebote (Phase 4)
    var Ang2 = w.Preisschmiede && w.Preisschmiede.Angebot;
    if (!Array.isArray(obj.angebote)) obj.angebote = [];
    if (!Array.isArray(obj.textbausteine)) obj.textbausteine = Ang2 ? Ang2.SEED_TEXTBAUSTEINE.map(function (t, i) { return Object.assign({ id: uid(), aktiv: true, sort: (i + 1) * 10 }, t); }) : [];
    if (!st.angebotNummernkreis || typeof st.angebotNummernkreis !== "object") st.angebotNummernkreis = JSON.parse(JSON.stringify(ds.angebotNummernkreis));
    if (!Array.isArray(st.angebotVorlagen)) st.angebotVorlagen = Ang2 ? [JSON.parse(JSON.stringify(Ang2.DEFAULT_VORLAGE))] : [];
    // Benutzer: es muss immer mindestens ein aktiver Admin existieren (Login)
    if (!Array.isArray(obj.users) || !obj.users.some(function (u) { return u && u.rolle === "admin" && u.aktiv !== false; })) {
      obj.users = SEED_USERS.map(makeUser);
    }
    if (!obj.untergruppen || typeof obj.untergruppen !== "object") obj.untergruppen = {};
    if (!Array.isArray(obj.auftraege)) obj.auftraege = [];
    // Einzelpositions-Aufträge -> positionen-Array (idempotent)
    obj.auftraege.forEach(function (a) {
      if (!a.positionen) {
        a.positionen = [{
          produktKey: a.produktKey, config: a.config,
          freiePositionen: a.freiePositionen, manuelleZeiten: a.manuelleZeiten,
          kalk: a.kalk, ist: a.ist || null,
          label: a.titel || null
        }];
      }
    });
    // Fertigungsplanung (Phase 7C)
    if (!st.planung || typeof st.planung !== "object") st.planung = JSON.parse(JSON.stringify(ds.planung));
    Object.keys(ds.planung).forEach(function (k) { if (st.planung[k] == null) st.planung[k] = JSON.parse(JSON.stringify(ds.planung[k])); });
    if (!Array.isArray(st.qualifikationen)) st.qualifikationen = ds.qualifikationen.slice();
    if (!obj.planung || typeof obj.planung !== "object") obj.planung = { elemente: [], versionen: [], benachrichtigungen: [], montage: [] };
    if (!Array.isArray(obj.planung.elemente)) obj.planung.elemente = [];
    if (!Array.isArray(obj.planung.versionen)) obj.planung.versionen = [];
    if (!Array.isArray(obj.planung.benachrichtigungen)) obj.planung.benachrichtigungen = [];
    if (!Array.isArray(obj.planung.montage)) obj.planung.montage = [];
    // Dokumente (Phase 7D)
    if (!Array.isArray(obj.dokumente)) obj.dokumente = [];
    if (st.dokumentZaehler == null) st.dokumentZaehler = (obj.dokumente.length || 0) + 1;
    // Betrieb/Pilot (Phase 9)
    if (!st.betrieb || typeof st.betrieb !== "object") st.betrieb = JSON.parse(JSON.stringify(ds.betrieb));
    if (st.betrieb.releaseStufe == null) st.betrieb.releaseStufe = "test";
    if (typeof st.betrieb.wartungsmodus !== "boolean") st.betrieb.wartungsmodus = false;
    if (!st.betrieb.backupMeta || typeof st.betrieb.backupMeta !== "object") st.betrieb.backupMeta = JSON.parse(JSON.stringify(ds.betrieb.backupMeta));
    if (st.betrieb.feedbackZaehler == null) st.betrieb.feedbackZaehler = 1;
    if (!st.betrieb.setup || typeof st.betrieb.setup !== "object") st.betrieb.setup = { abgeschlossen: false, uebersprungen: false, schritt: 0 };
    if (!Array.isArray(obj.feedback)) obj.feedback = [];
    if (!Array.isArray(obj.fehlerlog)) obj.fehlerlog = [];
    (obj.users || []).forEach(function (u) { if (u && typeof u.pinGeaendert !== "boolean") u.pinGeaendert = false; });
    // Kundenportal (Phase 12) – additiv, mandantengetrennt
    if (!Array.isArray(obj.portalUsers)) obj.portalUsers = [];
    if (!Array.isArray(obj.portalLinks)) obj.portalLinks = [];
    if (!Array.isArray(obj.portalNachrichten)) obj.portalNachrichten = [];
    if (!Array.isArray(obj.portalProtokolle)) obj.portalProtokolle = [];   // Annahmen/Ablehnungen
    if (!Array.isArray(obj.dokumentFreigaben)) obj.dokumentFreigaben = [];
    if (!Array.isArray(obj.zeichnungsFreigaben)) obj.zeichnungsFreigaben = [];
    if (!Array.isArray(obj.kundenUploads)) obj.kundenUploads = [];
    if (!Array.isArray(obj.portalEreignisse)) obj.portalEreignisse = [];
    // Nachträge & Rechnungskern (Phase 13A) – additiv, mandantengetrennt
    if (!Array.isArray(obj.nachtraege)) obj.nachtraege = [];
    if (!Array.isArray(obj.rechnungen)) obj.rechnungen = [];
    if (!st.rechnung || typeof st.rechnung !== "object") st.rechnung = {};
    if (!st.rechnung.kreise || typeof st.rechnung.kreise !== "object") {
      st.rechnung.kreise = (w.Preisschmiede.Rechnung ? w.Preisschmiede.Rechnung.standardKreise() : { Rechnung: { praefix: "RE", jahr: null, laufend: 1, mindestlaenge: 4 }, Gutschrift: { praefix: "GU", jahr: null, laufend: 1, mindestlaenge: 4 }, Stornobeleg: { praefix: "ST", jahr: null, laufend: 1, mindestlaenge: 4 } });
    }
    if (st.nachtragZaehler == null) st.nachtragZaehler = (obj.nachtraege.length || 0) + 1;
    if (!Array.isArray(obj.erpExporte)) obj.erpExporte = [];
    // Ziel der Offline-Synchronisation (Phase 14A) – zentrale Buchungen aus
    // Offline-Ereignissen; idempotent (je idempotenzKey höchstens einmal).
    if (!Array.isArray(obj.offlineBuchungen)) obj.offlineBuchungen = [];
    // Lagerkern (Phase 15A) – additiv, mandantengetrennt. Bestehende Bestände
    // bleiben unberührt; neue Arrays werden leer angelegt (kein Datenverlust).
    if (!Array.isArray(obj.lagerStandorte)) obj.lagerStandorte = [];
    if (!Array.isArray(obj.lager)) obj.lager = [];
    if (!Array.isArray(obj.lagerBereiche)) obj.lagerBereiche = [];
    if (!Array.isArray(obj.lagerRegale)) obj.lagerRegale = [];
    if (!Array.isArray(obj.lagerplaetze)) obj.lagerplaetze = [];
    if (!Array.isArray(obj.lagerArtikel)) obj.lagerArtikel = [];
    if (!Array.isArray(obj.lagerBewegungen)) obj.lagerBewegungen = [];
    if (!Array.isArray(obj.lagerChargen)) obj.lagerChargen = [];
    if (!Array.isArray(obj.lagerReservierungen)) obj.lagerReservierungen = [];
    if (!Array.isArray(obj.lagerReststuecke)) obj.lagerReststuecke = [];
    if (!Array.isArray(obj.wareneingaenge)) obj.wareneingaenge = [];
    if (!Array.isArray(obj.bestellungen)) obj.bestellungen = [];
    if (!Array.isArray(obj.lagerKonflikte)) obj.lagerKonflikte = [];
    if (!Array.isArray(obj.lagerInventuren)) obj.lagerInventuren = [];
    if (!st.lager || typeof st.lager !== "object") st.lager = { bewertungsmethode: "gleitend", zaehler: { artikel: 1, charge: 1, wareneingang: 1, bestellung: 1 } };
    if (!st.lager.zaehler || typeof st.lager.zaehler !== "object") st.lager.zaehler = { artikel: 1, charge: 1, wareneingang: 1, bestellung: 1 };
    // Qualitätsmanagement (Phase 16A) – additiv, mandantengetrennt. Bestehende
    // Aufträge/Prüfungen bleiben unberührt; neue Arrays werden leer angelegt.
    if (!Array.isArray(obj.qualPruefplaene)) obj.qualPruefplaene = [];
    if (!Array.isArray(obj.qualPruefauftraege)) obj.qualPruefauftraege = [];
    if (!Array.isArray(obj.qualAbweichungen)) obj.qualAbweichungen = [];
    if (!Array.isArray(obj.qualSperren)) obj.qualSperren = [];
    if (!Array.isArray(obj.qualNacharbeiten)) obj.qualNacharbeiten = [];
    if (!Array.isArray(obj.qualAusschuss)) obj.qualAusschuss = [];
    if (!Array.isArray(obj.qualSonderfreigaben)) obj.qualSonderfreigaben = [];
    if (!Array.isArray(obj.qualMassnahmen)) obj.qualMassnahmen = [];
    if (!Array.isArray(obj.qualReklamationen)) obj.qualReklamationen = [];
    if (!Array.isArray(obj.qualLieferantenReklamationen)) obj.qualLieferantenReklamationen = [];
    if (!Array.isArray(obj.qualPruefmittel)) obj.qualPruefmittel = [];
    if (!Array.isArray(obj.qualKosten)) obj.qualKosten = [];
    if (!Array.isArray(obj.qualAudit)) obj.qualAudit = [];
    if (!Array.isArray(obj.qualWareneingangspruefungen)) obj.qualWareneingangspruefungen = [];
    if (!Array.isArray(obj.qualKonflikte)) obj.qualKonflikte = [];
    if (!st.qualitaet || typeof st.qualitaet !== "object") st.qualitaet = { stammdaten: null, zaehler: { pruefplan: 1, pruefauftrag: 1, abweichung: 1 } };
    if (!st.qualitaet.zaehler || typeof st.qualitaet.zaehler !== "object") st.qualitaet.zaehler = { pruefplan: 1, pruefauftrag: 1, abweichung: 1 };
    // Qualitätsstammdaten sind konfigurierbar; Standardvorschlag nur auffüllen.
    if (!st.qualitaet.stammdaten && w.Preisschmiede && w.Preisschmiede.Qualitaet) st.qualitaet.stammdaten = w.Preisschmiede.Qualitaet.standardStammdaten();
    // Schema-Version stempeln + letzte Migration protokollieren (bei Änderung)
    if (obj.version !== 13) { st.betrieb.letzteMigration = nowISO(); obj.version = 13; }
    else if (st.betrieb.letzteMigration == null) st.betrieb.letzteMigration = nowISO();
    return obj;
  }

  // ============================================================
  //  MANDANTEN-REGISTRY (Phase 10) – Datenbank-pro-Mandant
  //  Isolation durch getrennte Speicher-Namespaces:
  //    preisschmiede.mandanten.v1     -> Registry (global)
  //    preisschmiede.tenant.<id>      -> vollständige db je Mandant
  // ============================================================
  var REGKEY = "preisschmiede.mandanten.v1";
  var _reg = null;
  var MANDANT_STATUS = ["Einrichtung", "Testbetrieb", "aktiv", "Zahlung ausstehend", "eingeschränkt", "gesperrt", "gekündigt", "archiviert"];

  function standardTarife() {
    return [
      { key: "basis", name: "Basis", beschreibung: "Kunden, Material, Maschinen, Kalkulation, Angebote", maxBenutzer: 3, maxSpeicherMB: 10, aktiv: true },
      { key: "professional", name: "Professional", beschreibung: "+ Aufträge, Zeiterfassung, Nachkalkulation, Dashboard, Importe, Planung", maxBenutzer: 10, maxSpeicherMB: 25, aktiv: true },
      { key: "intelligent", name: "Intelligent", beschreibung: "+ Lernfunktion, Zeichnungsanalyse, erweiterte Auswertungen, Schnittstellen", maxBenutzer: 25, maxSpeicherMB: 60, aktiv: true }
    ];
  }
  // Feature -> ab welchem Tarif verfügbar (Hierarchie basis<professional<intelligent)
  function standardFeatureFlags() {
    return [
      { key: "kalkulation", name: "Kalkulation", tarif: "basis", aktiv: true, pilot: false, beta: false },
      { key: "angebote", name: "Angebote/PDF", tarif: "basis", aktiv: true, pilot: false, beta: false },
      { key: "auftraege", name: "Aufträge", tarif: "professional", aktiv: true, pilot: false, beta: false },
      { key: "zeiterfassung", name: "Mobile Zeiterfassung", tarif: "professional", aktiv: true, pilot: false, beta: false },
      { key: "nachkalkulation", name: "Nachkalkulation", tarif: "professional", aktiv: true, pilot: false, beta: false },
      { key: "dashboard", name: "Dashboard", tarif: "professional", aktiv: true, pilot: false, beta: false },
      { key: "importe", name: "Importe/Export", tarif: "professional", aktiv: true, pilot: false, beta: false },
      { key: "planung", name: "Fertigungsplanung", tarif: "professional", aktiv: true, pilot: true, beta: false },
      { key: "lernen", name: "Lernfunktion", tarif: "intelligent", aktiv: true, pilot: true, beta: true },
      { key: "dokumente", name: "Zeichnungs-/Stücklistenanalyse", tarif: "intelligent", aktiv: true, pilot: true, beta: false },
      { key: "schnittstellen", name: "Schnittstellen (Frankstahl/KingBill)", tarif: "intelligent", aktiv: false, pilot: false, beta: true }
    ];
  }
  function neuerMandantObj(daten) {
    return Object.assign({
      id: uid(), name: "", kurzname: "", logo: "", anschrift: "", land: "AT",
      sprache: "de", zeitzone: "Europe/Vienna", waehrung: "EUR", ust: 20,
      status: "aktiv", tarif: "professional", erstellt: nowISO(),
      testBis: null, lizenzBeginn: null, lizenzEnde: null,
      maxBenutzer: 10, maxSpeicherMB: 25, aktiv: true, sperrgrund: "",
      kuendigung: null, aufbewahrungTage: 365
    }, daten || {});
  }
  function frischeRegistry() {
    return {
      schemaVersion: 1, aktiv: null, liste: [], zuordnungen: [], einladungen: [],
      tarife: standardTarife(), featureFlags: standardFeatureFlags(),
      systemAdmins: [], supportZugriffe: [], hintergrundaufgaben: [],
      zahlung: { anbieter: null, konfiguriert: false, status: "nicht eingerichtet" }
    };
  }
  function ergaenzeRegistry(r) {
    if (!Array.isArray(r.liste)) r.liste = [];
    if (!Array.isArray(r.zuordnungen)) r.zuordnungen = [];
    if (!Array.isArray(r.einladungen)) r.einladungen = [];
    if (!Array.isArray(r.tarife) || !r.tarife.length) r.tarife = standardTarife();
    if (!Array.isArray(r.featureFlags) || !r.featureFlags.length) r.featureFlags = standardFeatureFlags();
    if (!Array.isArray(r.systemAdmins)) r.systemAdmins = [];
    if (!Array.isArray(r.supportZugriffe)) r.supportZugriffe = [];
    if (!Array.isArray(r.hintergrundaufgaben)) r.hintergrundaufgaben = [];
    if (!r.zahlung || typeof r.zahlung !== "object") r.zahlung = { anbieter: null, konfiguriert: false, status: "nicht eingerichtet" };
    if (!r.aktiv && r.liste[0]) r.aktiv = r.liste[0].id;
    return r;
  }
  function tenantKeyFor(id) { return "preisschmiede.tenant." + id; }
  function aktuellerTenantKey() { var r = ladeRegistry(); return tenantKeyFor(r.aktiv); }

  function ladeRegistry() {
    if (_reg) return _reg;
    try { var raw = w.localStorage.getItem(REGKEY); if (raw) { _reg = ergaenzeRegistry(JSON.parse(raw)); return _reg; } } catch (e) {}
    // Erstinitialisierung: bestehende Einzelinstallation verlustfrei zu Mandant 1
    _reg = frischeRegistry();
    var legacyRaw = null; try { legacyRaw = w.localStorage.getItem(KEY); } catch (e) {}
    var db1;
    if (legacyRaw) { try { db1 = migrate(JSON.parse(legacyRaw)); } catch (e) { db1 = fresh(); } }
    else db1 = fresh();
    var fname = (db1.settings && db1.settings.firma && db1.settings.firma.name) || "Mein Betrieb";
    var m = neuerMandantObj({ name: fname, kurzname: fname.slice(0, 14), ust: (db1.settings && db1.settings.mwst) || 20, status: "aktiv" });
    _reg.liste.push(m); _reg.aktiv = m.id;
    (db1.users || []).forEach(function (u) { _reg.zuordnungen.push({ userId: u.id, benutzername: u.benutzername, mandantId: m.id, rolle: u.rolle, status: "aktiv", eingeladenVon: "", einladungsdatum: null, beitrittsdatum: nowISO(), letzterZugriff: null }); });
    try { w.localStorage.setItem(tenantKeyFor(m.id), JSON.stringify(db1)); } catch (e) {}
    // Legacy-Schlüssel NICHT löschen (Backup); Registry sichern
    try { w.localStorage.setItem(REGKEY, JSON.stringify(_reg)); } catch (e) {}
    return _reg;
  }
  function speichereRegistry() { if (_reg) { try { w.localStorage.setItem(REGKEY, JSON.stringify(_reg)); } catch (e) {} } }

  function mandanten() { return ladeRegistry().liste; }
  function aktiverMandant() { var r = ladeRegistry(); return r.liste.filter(function (m) { return m.id === r.aktiv; })[0] || null; }
  function mandantById(id) { return ladeRegistry().liste.filter(function (m) { return m.id === id; })[0] || null; }
  function neuerMandant(daten, mitBeispiel) {
    var r = ladeRegistry();
    var m = neuerMandantObj(daten || {});
    r.liste.push(m);
    var db2 = mitBeispiel ? fresh() : leereDb();
    if (db2.settings) { db2.settings.firma = db2.settings.firma || {}; db2.settings.firma.name = m.name; db2.settings.mwst = m.ust; }
    try { w.localStorage.setItem(tenantKeyFor(m.id), JSON.stringify(db2)); } catch (e) {}
    speichereRegistry();
    return m;
  }
  // Leere, aber schema-vollständige db (ohne Beispieldaten) via migrate({})
  function leereDb() { var d = migrate({}); return d; }
  function wechsleMandant(id) {
    var r = ladeRegistry();
    if (!r.liste.some(function (m) { return m.id === id; })) return false;
    r.aktiv = id; speichereRegistry();
    _db = null; // Cache leeren -> nächste load() liest den Zielmandanten
    return true;
  }

  function load() {
    if (_db) return _db;
    var KEYX = aktuellerTenantKey();
    var raw = null;
    try {
      raw = w.localStorage.getItem(KEYX);
      if (raw) {
        var m = migrate(JSON.parse(raw));
        if (!m) throw new Error("Datenformat ungültig");
        _db = m;
        return _db;
      }
    } catch (e) {
      // Beschädigte Daten nicht verwerfen, sondern die erste Rettungskopie sichern
      console.warn("Daten beschädigt – starte mit leerer Datenbank:", e);
      try { if (raw && !w.localStorage.getItem(KEYX + ".backup")) w.localStorage.setItem(KEYX + ".backup", raw); } catch (_) {}
    }
    _db = fresh();
    save();
    return _db;
  }

  var _onSave = null;
  function onSave(cb) { _onSave = cb; }
  function save() {
    var ok = true;
    try { w.localStorage.setItem(aktuellerTenantKey(), JSON.stringify(_db)); }
    catch (e) {
      ok = false;
      console.warn("Speichern fehlgeschlagen:", e);
      // Datenverlust ist inakzeptabel – Nutzer sichtbar warnen statt still scheitern
      try { w.alert("⚠️ Daten konnten nicht gespeichert werden (Gerätespeicher voll?).\nBitte exportiere deine Daten zur Sicherung (Stammdaten → Daten sichern)."); } catch (_) {}
    }
    if (_onSave) { try { _onSave(ok); } catch (e) {} }
    return ok;
  }

  function reset() {
    // aktuellen Stand vor dem Löschen sichern (mandantenbezogen)
    try { w.localStorage.setItem(aktuellerTenantKey() + ".prev", JSON.stringify(_db)); } catch (_) {}
    _db = fresh();
    save();
    return _db;
  }

  function exportJSON() { return JSON.stringify(load(), null, 2); }

  function importJSON(text) {
    var obj = JSON.parse(text);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("Ungültige Datei");
    if (!obj.settings && !obj.material && !obj.auftraege) throw new Error("Keine Preisschmiede-Daten erkannt");
    var migrated = migrate(obj);
    if (!migrated) throw new Error("Ungültige Datei");
    // aktuellen Stand vor dem Überschreiben sichern (mandantenbezogen)
    try { w.localStorage.setItem(aktuellerTenantKey() + ".prev", JSON.stringify(_db)); } catch (_) {}
    _db = migrated;
    save();
    return _db;
  }

  w.Preisschmiede = w.Preisschmiede || {};
  w.Preisschmiede.Store = {
    load: load, save: save, reset: reset, onSave: onSave,
    exportJSON: exportJSON, importJSON: importJSON,
    fresh: fresh, migrate: migrate,
    uid: uid, nowISO: nowISO,
    hashPin: hashPin, makeSalt: makeSalt,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    // Mandanten-Registry (Phase 10)
    MANDANT_STATUS: MANDANT_STATUS,
    ladeRegistry: ladeRegistry, speichereRegistry: speichereRegistry,
    mandanten: mandanten, aktiverMandant: aktiverMandant, mandantById: mandantById,
    neuerMandant: neuerMandant, wechsleMandant: wechsleMandant, tenantKeyFor: tenantKeyFor,
    neuerMandantObj: neuerMandantObj
  };
})(window);
