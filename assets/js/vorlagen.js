/* ============================================================
   Preisschmiede – Produktgruppen & Konfigurator-Vorlagen (Seed)
   Vorlagen sind Daten (nicht fest im Frontend). Admins können sie
   später bearbeiten; bestehende Konfigurationen werden per Snapshot
   geschützt.
   ============================================================ */
(function (w) {
  "use strict";

  // ---- Produktgruppen (Beispieldaten) -----------------------
  var SEED_PRODUKTGRUPPEN = [
    { id: "pg-serienteile", key: "serienteile", name: "Serienteile", icon: "🔩", aktiv: true, archiviert: false, sort: 10 },
    { id: "pg-gelaender", key: "gelaender", name: "Geländer", icon: "🚧", aktiv: true, archiviert: false, sort: 20 },
    { id: "pg-treppen", key: "treppen", name: "Treppen", icon: "🪜", aktiv: true, archiviert: false, sort: 30 },
    { id: "pg-zaeune", key: "zaeune", name: "Zäune", icon: "🔲", aktiv: true, archiviert: false, sort: 40 },
    { id: "pg-tore", key: "tore", name: "Tore", icon: "🚪", aktiv: true, archiviert: false, sort: 50 },
    { id: "pg-vordaecher", key: "vordaecher", name: "Vordächer", icon: "⛱️", aktiv: true, archiviert: false, sort: 60 },
    { id: "pg-sonder", key: "sonderkonstruktionen", name: "Sonderkonstruktionen", icon: "🏗️", aktiv: true, archiviert: false, sort: 70 },
    { id: "pg-einzel", key: "einzelanfertigungen", name: "Einzelanfertigungen", icon: "✨", aktiv: true, archiviert: false, sort: 80 },
    { id: "pg-reparaturen", key: "reparaturen", name: "Reparaturen", icon: "🛠️", aktiv: true, archiviert: false, sort: 90 },
    { id: "pg-montagen", key: "montagen", name: "Montagen", icon: "🧰", aktiv: true, archiviert: false, sort: 100 },
    { id: "pg-blech", key: "blecharbeiten", name: "Blecharbeiten", icon: "📐", aktiv: true, archiviert: false, sort: 110 }
  ];

  // ---- Feld-Builder -----------------------------------------
  function F(key, typ, frage, extra) { return Object.assign({ key: key, typ: typ, frage: frage, aktiv: true }, extra || {}); }
  function H(key, frage) { return { key: key, typ: "ueberschrift", frage: frage, aktiv: true }; }
  function baue(id, gruppeKey, felder) {
    felder.forEach(function (f, i) { f.sort = (i + 1) * 10; });
    return { id: id, gruppeKey: gruppeKey, version: 1, aktiv: true, erstellt: null, felder: felder };
  }

  var WERK = [{ wert: "Stahl" }, { wert: "Edelstahl" }, { wert: "Aluminium" }];

  // ---- Vorlage: Geländer ------------------------------------
  var VL_GELAENDER = baue("vl-gelaender-1", "gelaender", [
    H("h_allg", "Allgemein"),
    F("bezeichnung", "text", "Bezeichnung", { pflicht: true }),
    F("gesamtlaenge", "mass", "Gesamtlänge", { einheit: "m", pflicht: true, min: 0 }),
    F("gelaenderhoehe", "mass", "Geländerhöhe", { einheit: "mm", standard: 1000 }),
    F("anzahl_felder", "zahl", "Anzahl Geländerfelder", { min: 0 }),
    F("anzahl_ecken", "zahl", "Anzahl Ecken", { min: 0 }),
    F("bereich", "einfach", "Innen- oder Außenbereich", { optionen: [{ wert: "Innen" }, { wert: "Außen" }], standard: "Außen" }),
    F("stueckzahl", "stueckzahl", "Stückzahl", { standard: 1, min: 1, pflicht: true }),
    F("notizen", "textarea", "Notizen"),

    H("h_material", "Material und Konstruktion"),
    F("werkstoff", "einfach", "Werkstoff", { optionen: WERK, pflicht: true, standard: "Stahl" }),
    F("materialguete", "text", "Materialgüte", { hilfe: "z. B. S235JR, 1.4301" }),
    F("profilart", "einfach", "Profilart", { optionen: [{ wert: "Rundrohr" }, { wert: "Vierkantrohr" }, { wert: "Rechteckrohr" }, { wert: "Flachstahl" }] }),
    F("profilabmessung", "text", "Profilabmessungen", { hilfe: "z. B. 42,4 x 2,0" }),
    F("pfostenanzahl", "zahl", "Pfostenanzahl", { min: 0 }),
    F("pfostenabstand", "mass", "Pfostenabstand", { einheit: "mm" }),
    F("handlaufart", "text", "Handlaufart"),
    F("fuellungsart", "einfach", "Füllungsart", { optionen: [{ wert: "Stäbe" }, { wert: "Glas" }, { wert: "Blech" }, { wert: "Seile" }, { wert: "ohne Füllung" }, { wert: "benutzerdefiniert" }], standard: "Stäbe" }),
    F("glasstaerke", "mass", "Glasstärke", { einheit: "mm", abh: { feld: "fuellungsart", op: "=", wert: "Glas" } }),
    F("fuellung_custom", "text", "Beschreibung Füllung", { abh: { feld: "fuellungsart", op: "=", wert: "benutzerdefiniert" } }),

    H("h_bearb", "Bearbeitung"),
    F("b_saegen", "janein", "Sägen"),
    F("b_bohren", "janein", "Bohren"),
    F("b_lasern", "janein", "Laserschneiden"),
    F("kanten_noetig", "janein", "Kanten erforderlich"),
    F("anzahl_kantungen", "zahl", "Anzahl Kantungen", { min: 0, abh: { feld: "kanten_noetig", op: "wahr" } }),
    F("b_schweissen", "janein", "Schweißen", { standard: true }),
    F("b_schleifen", "janein", "Schleifen"),
    F("b_entgraten", "janein", "Entgraten"),

    H("h_ober", "Oberfläche"),
    F("oberflaeche", "einfach", "Oberfläche", { optionen: [{ wert: "roh" }, { wert: "Feuerverzinken" }, { wert: "Pulverbeschichten" }, { wert: "Lackieren" }, { wert: "Beizen" }, { wert: "Passivieren" }, { wert: "geschliffen" }], standard: "roh" }),
    F("farbton", "text", "Farbton", { abh: { feld: "oberflaeche", op: "in", wert: ["Pulverbeschichten", "Lackieren"] } }),

    H("h_montage", "Montage"),
    F("montage_noetig", "janein", "Montage erforderlich"),
    F("befestigungsart", "text", "Befestigungsart", { abh: { feld: "montage_noetig", op: "wahr" } }),
    F("anzahl_bohrungen", "zahl", "Anzahl Bohrungen", { min: 0, abh: { feld: "montage_noetig", op: "wahr" } }),
    F("anzahl_anker", "zahl", "Anzahl Anker", { min: 0, abh: { feld: "montage_noetig", op: "wahr" } }),
    F("fundament_noetig", "janein", "Fundamentarbeiten", { abh: { feld: "montage_noetig", op: "wahr" } }),
    F("fundamentart", "text", "Fundamentart", { abh: { feld: "fundament_noetig", op: "wahr" } }),
    F("hebegeraet", "janein", "Hebegerät erforderlich", { abh: { feld: "montage_noetig", op: "wahr" } }),
    F("baustellenentfernung", "mass", "Baustellenentfernung", { einheit: "km", min: 0, abh: { feld: "montage_noetig", op: "wahr" } }),
    F("anzahl_monteure", "zahl", "Anzahl Monteure", { min: 0, standard: 2, abh: { feld: "montage_noetig", op: "wahr" } }),
    F("montagedauer", "zahl", "Geplante Montagedauer", { einheit: "h", min: 0, abh: { feld: "montage_noetig", op: "wahr" } }),
    F("fahrtzeit", "zahl", "Fahrtzeit", { einheit: "h", min: 0, abh: { feld: "montage_noetig", op: "wahr" } }),
    F("transportfahrzeug", "text", "Transportfahrzeug", { abh: { feld: "montage_noetig", op: "wahr" } })
  ]);

  // ---- Vorlage: Blecharbeiten -------------------------------
  var VL_BLECH = baue("vl-blech-1", "blecharbeiten", [
    H("h_grund", "Grunddaten"),
    F("bezeichnung", "text", "Bezeichnung", { pflicht: true }),
    F("werkstoff", "einfach", "Werkstoff", { optionen: WERK, pflicht: true, standard: "Stahl" }),
    F("materialguete", "text", "Materialgüte"),
    F("blechstaerke", "mass", "Blechstärke", { einheit: "mm", pflicht: true, min: 0 }),
    F("laenge", "mass", "Länge", { einheit: "mm", pflicht: true, min: 0 }),
    F("breite", "mass", "Breite", { einheit: "mm", pflicht: true, min: 0 }),
    F("stueckzahl", "stueckzahl", "Stückzahl", { standard: 1, min: 1, pflicht: true }),
    F("format", "einfach", "Format", { optionen: [{ wert: "Standardformat" }, { wert: "Sonderformat" }], standard: "Sonderformat" }),
    F("verschnitt", "prozent", "Verschnitt", { standard: 10, min: 0, max: 100 }),
    F("zeichnungsnummer", "text", "Zeichnungsnummer"),
    F("notizen", "textarea", "Notizen"),
    // Automatische Felder
    F("flaeche_stueck", "berechnet", "Fläche pro Teil", { einheit: "m²", formel: "laenge / 1000 * breite / 1000" }),
    F("gesamtflaeche", "berechnet", "Gesamtfläche", { einheit: "m²", formel: "flaeche_stueck * stueckzahl" }),
    F("gewicht_stueck", "berechnet", "Gewicht pro Teil", { einheit: "kg", formel: "flaeche_stueck * blechstaerke * dichte" }),
    F("gesamtgewicht", "berechnet", "Gesamtgewicht", { einheit: "kg", formel: "gewicht_stueck * stueckzahl" }),
    F("materialbedarf", "berechnet", "Materialbedarf inkl. Verschnitt", { einheit: "kg", formel: "gesamtgewicht * (1 + verschnitt / 100)" }),

    H("h_bearb", "Bearbeitungen"),
    F("b_lasern", "janein", "Laserschneiden", { standard: true }),
    F("b_plasma", "janein", "Plasmaschneiden"),
    F("b_saegen", "janein", "Sägen"),
    F("b_stanzen", "janein", "Stanzen"),
    F("b_bohren", "janein", "Bohren"),
    F("anzahl_bohrungen", "zahl", "Anzahl Bohrungen", { min: 0, abh: { feld: "b_bohren", op: "wahr" } }),
    F("gewinde", "janein", "Gewinde schneiden"),
    F("entgraten", "janein", "Entgraten", { standard: true }),
    F("kanten_noetig", "janein", "Kanten"),
    F("anzahl_kantungen", "zahl", "Anzahl Kantungen", { min: 0, abh: { feld: "kanten_noetig", op: "wahr" } }),
    F("kantlaenge", "mass", "Gesamte Kantlänge", { einheit: "mm", abh: { feld: "kanten_noetig", op: "wahr" } }),
    F("b_schweissen", "janein", "Schweißen"),
    F("schweissnahtlaenge", "mass", "Schweißnahtlänge", { einheit: "mm", abh: { feld: "b_schweissen", op: "wahr" } }),
    F("b_schleifen", "janein", "Schleifen"),
    F("verpacken", "janein", "Verpacken", { standard: true }),

    H("h_ober", "Oberfläche"),
    F("oberflaeche", "einfach", "Oberfläche", { optionen: [{ wert: "roh" }, { wert: "verzinkt" }, { wert: "pulverbeschichtet" }, { wert: "lackiert" }, { wert: "gebeizt" }, { wert: "passiviert" }, { wert: "geschliffen" }], standard: "roh" }),
    F("farbton", "text", "Farbton", { abh: { feld: "oberflaeche", op: "in", wert: ["pulverbeschichtet", "lackiert"] } }),

    H("h_log", "Logistik"),
    F("lieferung", "janein", "Lieferung"),
    F("montage_noetig", "janein", "Montage"),
    F("entfernung", "mass", "Entfernung", { einheit: "km", min: 0, abh: { feld: "lieferung", op: "wahr" } }),
    F("verpackungsart", "text", "Verpackungsart"),
    F("transportmittel", "text", "Transportmittel")
  ]);

  // ---- Vorlage: Serienteile ---------------------------------
  var VL_SERIE = baue("vl-serie-1", "serienteile", [
    H("h_grund", "Grunddaten"),
    F("artikelbezeichnung", "text", "Artikelbezeichnung", { pflicht: true }),
    F("artikelnummer", "text", "Interne Artikelnummer"),
    F("zeichnungsnummer", "text", "Zeichnungsnummer"),
    F("werkstoff", "einfach", "Werkstoff", { optionen: WERK, standard: "Stahl" }),
    F("abmessungen", "text", "Abmessungen"),
    F("stueckzahl", "stueckzahl", "Stückzahl", { standard: 1, min: 1, pflicht: true }),
    F("losgroesse", "zahl", "Losgröße", { min: 0 }),
    F("anzahl_lose", "zahl", "Anzahl Fertigungslose", { min: 0 }),
    F("material", "material", "Material"),

    H("h_fertigung", "Fertigung"),
    F("maschinen", "mehrfach", "Benötigte Maschinen", { quelle: "maschine" }),
    F("bearbeitungsschritte", "mehrfach", "Bearbeitungsschritte", { quelle: "taetigkeit" }),
    F("ruestvorgaenge", "zahl", "Rüstvorgänge", { min: 0, standard: 1 }),
    F("pruefaufwand", "zahl", "Prüfaufwand", { einheit: "h", min: 0 }),
    F("verpackung", "text", "Verpackung"),
    F("ausschussfaktor", "prozent", "Ausschussfaktor", { min: 0, max: 100, standard: 2 }),

    H("h_wieder", "Wiederholung"),
    F("wiederholauftrag", "janein", "Wiederholauftrag"),
    F("referenzauftrag", "text", "Referenz zu früherem Auftrag", { abh: { feld: "wiederholauftrag", op: "wahr" } })
  ]);

  var SEED_VORLAGEN = [VL_GELAENDER, VL_BLECH, VL_SERIE];

  // ---- Beispiel-Produktkonfigurationen ----------------------
  // ctx: { uid, nowISO, kunden[], projekte[], settings, berechne }
  function beispielKonfigurationen(ctx) {
    var K = ctx.Konfigurator;
    var findVL = function (id) { return SEED_VORLAGEN.filter(function (v) { return v.id === id; })[0]; };
    function mk(nummer, vlId, bez, kundeId, projektId, kommission, antworten) {
      var vl = findVL(vlId);
      var berechnet = K ? K.berechne(vl, antworten, ctx.settings) : {};
      return {
        id: ctx.uid(), nummer: nummer, bezeichnung: bez,
        kundeId: kundeId || "", projektId: projektId || "", kommission: kommission || "",
        gruppeKey: vl.gruppeKey, vorlageId: vl.id, vorlageVersion: vl.version,
        vorlageSnapshot: JSON.parse(JSON.stringify(vl.felder)),
        antworten: antworten, berechnet: berechnet,
        status: "Fertig", beispiel: true,
        erstellt: ctx.nowISO(), geaendert: ctx.nowISO(), bearbeiter: "admin",
        verlauf: [{ datum: ctx.nowISO(), bearbeiter: "admin", grund: "Beispieldaten angelegt" }]
      };
    }
    var k0 = (ctx.kunden[0] || {}).id, k1 = (ctx.kunden[1] || {}).id;
    var p0 = (ctx.projekte[0] || {}).id;
    return [
      mk("K-2026-001", "vl-gelaender-1", "Edelstahlgeländer mit Glasfüllung", k0, p0, "Wohnanlage Sonnengarten – Balkongeländer", {
        bezeichnung: "Balkongeländer Glas", gesamtlaenge: 12, gelaenderhoehe: 1000, anzahl_felder: 6, anzahl_ecken: 2,
        bereich: "Außen", stueckzahl: 1, werkstoff: "Edelstahl", materialguete: "1.4301", profilart: "Rundrohr",
        profilabmessung: "42,4 x 2,0", pfostenanzahl: 7, pfostenabstand: 1800, handlaufart: "Rundrohr Ø42,4",
        fuellungsart: "Glas", glasstaerke: 12, b_schweissen: true, b_schleifen: true, oberflaeche: "geschliffen",
        montage_noetig: true, befestigungsart: "Chemieanker M12", anzahl_bohrungen: 14, anzahl_anker: 14,
        hebegeraet: false, baustellenentfernung: 25, anzahl_monteure: 2, montagedauer: 8, fahrtzeit: 1, transportfahrzeug: "Sprinter"
      }),
      mk("K-2026-002", "vl-blech-1", "Pulverbeschichtete Stahlblecharbeit", k0, "", "Maschinenbau Huber – Abdeckbleche", {
        bezeichnung: "Abdeckblech", werkstoff: "Stahl", materialguete: "DC01", blechstaerke: 3, laenge: 2000, breite: 1000,
        stueckzahl: 5, format: "Sonderformat", verschnitt: 10, zeichnungsnummer: "ZB-1042",
        b_lasern: true, kanten_noetig: true, anzahl_kantungen: 4, kantlaenge: 8000, b_schweissen: true, schweissnahtlaenge: 1200,
        entgraten: true, verpacken: true, oberflaeche: "pulverbeschichtet", farbton: "RAL 7016", verpackungsart: "Palette"
      }),
      mk("K-2026-003", "vl-serie-1", "Serienteil ST-500 Haltewinkel", k1, "", "Serienteil ST-500 – Haltewinkel", {
        artikelbezeichnung: "Haltewinkel", artikelnummer: "ST-500", zeichnungsnummer: "ZW-500", werkstoff: "Stahl",
        abmessungen: "80 x 60 x 5", stueckzahl: 500, losgroesse: 100, anzahl_lose: 5,
        bearbeitungsschritte: ["lasern", "kanten", "bohren"], ruestvorgaenge: 3, pruefaufwand: 2,
        verpackung: "Karton à 50 Stück", ausschussfaktor: 2, wiederholauftrag: true, referenzauftrag: "K-2025-217"
      })
    ];
  }

  w.Preisschmiede = w.Preisschmiede || {};
  w.Preisschmiede.Vorlagen = {
    SEED_PRODUKTGRUPPEN: SEED_PRODUKTGRUPPEN,
    SEED_VORLAGEN: SEED_VORLAGEN,
    beispielKonfigurationen: beispielKonfigurationen
  };
})(typeof self !== "undefined" ? self : this);
