/* ============================================================
   Spanwerk – Produktkonfigurator
   Jeder Produkttyp definiert:
     - fragen:      die abgefragten Konfigurationsfelder
     - zeitmodell:  Basis-Arbeitszeiten (Erfahrungs-Startwerte in h)
     - material:    erzeugt die Materialliste (Positionen)
   Die Startwerte werden durch die Lernfunktion fortlaufend
   verfeinert (siehe calc.js / Nachkalkulation).
   ============================================================ */
(function (w) {
  "use strict";

  // Hilfsfunktionen
  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : (d || 0); }
  function bool(v) { return v === true || v === "true" || v === "on" || v === 1; }

  // Arbeitsschritte (Reihenfolge = Anzeige-Reihenfolge)
  var SCHRITTE = [
    { key: "cad", label: "CAD / Planung", kat: "cad" },
    { key: "zuschnitt", label: "Zuschnitt", kat: "fertigung" },
    { key: "lasern", label: "Lasern", kat: "fertigung" },
    { key: "bohren", label: "Bohren", kat: "fertigung" },
    { key: "schweissen", label: "Schweißen", kat: "fertigung" },
    { key: "schleifen", label: "Schleifen / Finish", kat: "fertigung" },
    { key: "oberflaeche", label: "Oberflächen-Handling", kat: "fertigung" },
    { key: "montage", label: "Montage", kat: "montage" },
    { key: "verpackung", label: "Verpackung", kat: "fertigung" },
    { key: "transport", label: "Transport", kat: "montage" }
  ];

  function leer() {
    var o = {};
    SCHRITTE.forEach(function (s) { o[s.key] = 0; });
    return o;
  }

  // Oberflächen-Zuschlag (Aufwand pro lfm bzw. Pauschale)
  function oberflaecheZeit(art, lfm) {
    switch (art) {
      case "feuerverzinken": return 0.4 + lfm * 0.04; // Handling + Transport zum Verzinker
      case "pulverbeschichten": return 0.5 + lfm * 0.05;
      case "lackieren": return 0.6 + lfm * 0.08;
      default: return 0; // roh
    }
  }

  // ----------------------------------------------------------------
  // GELÄNDER
  // ----------------------------------------------------------------
  var GELAENDER = {
    key: "gelaender",
    name: "Geländer",
    icon: "🛡️",
    fragen: [
      { key: "werkstoff", label: "Werkstoff", typ: "select", optionen: ["Stahl", "Edelstahl"] },
      { key: "profil", label: "Profil", typ: "select", optionen: ["Rundrohr", "Vierkantrohr"] },
      { key: "fuellung", label: "Füllung", typ: "select", optionen: ["Stäbe", "Glas", "Blech"] },
      { key: "bereich", label: "Bereich", typ: "select", optionen: ["Innen", "Außen"] },
      { key: "laenge", label: "Länge", typ: "number", einheit: "m", default: 6 },
      { key: "hoehe", label: "Höhe", typ: "number", einheit: "m", default: 1.0 },
      { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: ["Roh", "Feuerverzinken", "Pulverbeschichten", "Lackieren"] },
      { key: "lasern", label: "Laserschneiden", typ: "check" },
      { key: "kanten", label: "Kanten / Abkanten", typ: "check" },
      { key: "montage", label: "Montage erforderlich", typ: "check", default: true },
      { key: "fundament", label: "Fundamentarbeiten", typ: "check" },
      { key: "entfernung", label: "Entfernung Baustelle (einfach)", typ: "number", einheit: "km", default: 15 }
    ],
    zeitmodell: function (c) {
      var L = num(c.laenge, 6), H = num(c.hoehe, 1);
      var edel = c.werkstoff === "Edelstahl";
      var t = leer();
      // CAD
      t.cad = 1.2 + L * 0.12 + (c.fuellung === "Glas" ? 0.6 : 0);
      // Zuschnitt: Pfosten (~ alle 1,1 m) + Handlauf + Füllung
      var pfosten = Math.max(2, Math.ceil(L / 1.1) + 1);
      t.zuschnitt = 0.15 * pfosten + 0.1 * L;
      // Lasern (optional, z.B. Bodenplatten/Zierteile)
      t.lasern = bool(c.lasern) ? 0.15 * pfosten + 0.2 : 0;
      // Bohren (Befestigung + Glasklemmen)
      t.bohren = 0.08 * pfosten + (c.fuellung === "Glas" ? 0.12 * L : 0);
      // Schweißen: stark abhängig von Füllung
      var schwBasis = c.fuellung === "Stäbe" ? 0.55 : (c.fuellung === "Blech" ? 0.38 : 0.22);
      t.schweissen = schwBasis * L + 0.25 * pfosten;
      if (edel) t.schweissen *= 1.15; // Edelstahl schweißen aufwändiger
      // Schleifen / Finish
      t.schleifen = (edel ? 0.45 : 0.28) * L + 0.1 * pfosten;
      // Oberfläche
      t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), L);
      // Montage
      if (bool(c.montage)) {
        t.montage = 0.35 * L + 0.15 * pfosten + (bool(c.fundament) ? 1.5 + 0.4 * pfosten : 0);
      }
      // Kanten
      if (bool(c.kanten)) t.zuschnitt += 0.15 * L;
      // Verpackung & Transport
      t.verpackung = 0.4 + 0.05 * L;
      t.transport = bool(c.montage) ? Math.max(0.5, num(c.entfernung, 15) / 45) : 0.4;
      return t;
    },
    material: function (c, M) {
      var L = num(c.laenge, 6);
      var edel = c.werkstoff === "Edelstahl";
      var pfosten = Math.max(2, Math.ceil(L / 1.1) + 1);
      var pos = [];
      function find(name) { return M.find(function (m) { return m.name === name; }); }
      // Pfosten + Handlauf (gleiches Profil)
      var profName = (c.profil === "Vierkantrohr")
        ? (edel ? "Vierkantrohr Edelstahl 40 x 40 x 2,0" : "Vierkantrohr Stahl 40 x 40 x 2,0")
        : (edel ? "Rundrohr Edelstahl 42,4 x 2,0 (V2A)" : "Rundrohr Stahl 42,4 x 2,0");
      var prof = find(profName);
      if (prof) {
        var hoehe = num(c.hoehe, 1);
        var profLfm = pfosten * (hoehe + 0.1) + L; // Pfosten + Handlauf
        pos.push({ ref: prof, name: prof.name, menge: round1(profLfm), einheit: "m" });
      }
      // Füllung
      if (c.fuellung === "Stäbe") {
        var stab = find(edel ? "Rundstab Edelstahl 12 mm" : "Rundstab Stahl 12 mm");
        if (stab) {
          var anz = Math.ceil(L / 0.11); // Stababstand ~11 cm
          pos.push({ ref: stab, name: stab.name, menge: round1(anz * num(c.hoehe, 1) * 0.9), einheit: "m" });
        }
      } else if (c.fuellung === "Glas") {
        var glas = find("VSG-Glas 8.8.4 klar");
        if (glas) pos.push({ ref: glas, name: glas.name, menge: round1(L * (num(c.hoehe, 1) - 0.15)), einheit: "m²" });
        var klemme = find("Glasklemme Edelstahl");
        if (klemme) pos.push({ ref: klemme, name: klemme.name, menge: Math.ceil(L / 0.5), einheit: "Stk" });
      } else if (c.fuellung === "Blech") {
        var blech = find(edel ? "Blech Edelstahl 2,0 mm" : "Blech Stahl 2,0 mm");
        if (blech) pos.push({ ref: blech, name: blech.name, menge: round1(L * (num(c.hoehe, 1) - 0.15)), einheit: "m²" });
      }
      // Befestigung
      var anker = find("Pfostenanker / Bodenplatte");
      if (anker) pos.push({ ref: anker, name: anker.name, menge: pfosten, einheit: "Stk" });
      var duebel = find("Chemiedübel-Set M12");
      if (duebel) pos.push({ ref: duebel, name: duebel.name, menge: pfosten * 2, einheit: "Stk" });
      return pos;
    }
  };

  // ----------------------------------------------------------------
  // ZAUN  (vereinfachtes, eigenes Modell)
  // ----------------------------------------------------------------
  var ZAUN = {
    key: "zaun",
    name: "Zaun",
    icon: "🚧",
    fragen: [
      { key: "werkstoff", label: "Werkstoff", typ: "select", optionen: ["Stahl", "Edelstahl"] },
      { key: "laenge", label: "Länge", typ: "number", einheit: "m", default: 20 },
      { key: "hoehe", label: "Höhe", typ: "number", einheit: "m", default: 1.5 },
      { key: "fuellung", label: "Füllung", typ: "select", optionen: ["Stäbe", "Blech"] },
      { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: ["Feuerverzinken", "Pulverbeschichten", "Roh"] },
      { key: "montage", label: "Montage erforderlich", typ: "check", default: true },
      { key: "fundament", label: "Fundamentarbeiten", typ: "check", default: true },
      { key: "entfernung", label: "Entfernung Baustelle (einfach)", typ: "number", einheit: "km", default: 20 }
    ],
    zeitmodell: function (c) {
      var L = num(c.laenge, 20);
      var edel = c.werkstoff === "Edelstahl";
      var felder = Math.ceil(L / 2.5);
      var t = leer();
      t.cad = 1.0 + L * 0.05;
      t.zuschnitt = 0.12 * L + 0.1 * felder;
      t.bohren = 0.06 * felder;
      t.schweissen = (c.fuellung === "Stäbe" ? 0.35 : 0.28) * L * (edel ? 1.15 : 1);
      t.schleifen = (edel ? 0.3 : 0.18) * L;
      t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), L);
      if (bool(c.montage)) t.montage = 0.3 * L + (bool(c.fundament) ? 0.6 * felder : 0);
      t.verpackung = 0.3 + 0.03 * L;
      t.transport = bool(c.montage) ? Math.max(0.6, num(c.entfernung, 20) / 45) : 0.5;
      return t;
    },
    material: function (c, M) {
      var L = num(c.laenge, 20), edel = c.werkstoff === "Edelstahl";
      var felder = Math.ceil(L / 2.5), pfosten = felder + 1;
      var pos = [];
      function find(n) { return M.find(function (m) { return m.name === n; }); }
      var prof = find(edel ? "Vierkantrohr Edelstahl 40 x 40 x 2,0" : "Vierkantrohr Stahl 40 x 40 x 2,0");
      if (prof) pos.push({ ref: prof, name: prof.name, menge: round1(pfosten * (num(c.hoehe, 1.5) + 0.5) + L * 2), einheit: "m" });
      if (c.fuellung === "Stäbe") {
        var stab = find(edel ? "Rundstab Edelstahl 12 mm" : "Rundstab Stahl 12 mm");
        if (stab) pos.push({ ref: stab, name: stab.name, menge: round1(Math.ceil(L / 0.12) * num(c.hoehe, 1.5)), einheit: "m" });
      } else {
        var blech = find(edel ? "Blech Edelstahl 2,0 mm" : "Blech Stahl 2,0 mm");
        if (blech) pos.push({ ref: blech, name: blech.name, menge: round1(L * num(c.hoehe, 1.5)), einheit: "m²" });
      }
      var anker = find("Pfostenanker / Bodenplatte");
      if (anker) pos.push({ ref: anker, name: anker.name, menge: pfosten, einheit: "Stk" });
      return pos;
    }
  };

  // ----------------------------------------------------------------
  // TREPPE
  // ----------------------------------------------------------------
  var TREPPE = {
    key: "treppe",
    name: "Treppe",
    icon: "🪜",
    fragen: [
      { key: "werkstoff", label: "Werkstoff", typ: "select", optionen: ["Stahl", "Edelstahl"] },
      { key: "stufen", label: "Anzahl Stufen", typ: "number", einheit: "Stk", default: 14 },
      { key: "breite", label: "Stufenbreite", typ: "number", einheit: "m", default: 1.0 },
      { key: "gelaender", label: "Geländer beidseitig", typ: "check", default: true },
      { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: ["Feuerverzinken", "Pulverbeschichten", "Roh"] },
      { key: "lasern", label: "Stufen lasern", typ: "check", default: true },
      { key: "montage", label: "Montage erforderlich", typ: "check", default: true },
      { key: "entfernung", label: "Entfernung Baustelle (einfach)", typ: "number", einheit: "km", default: 15 }
    ],
    zeitmodell: function (c) {
      var n = num(c.stufen, 14), b = num(c.breite, 1);
      var edel = c.werkstoff === "Edelstahl";
      var lauf = n * 0.18 * 1.6; // grobe Laufmeter Wangen
      var t = leer();
      t.cad = 2.5 + n * 0.08;
      t.zuschnitt = 0.25 * n + 0.4;
      t.lasern = bool(c.lasern) ? 0.2 * n : 0;
      t.bohren = 0.1 * n;
      t.schweissen = (0.6 * n + 1.5) * (edel ? 1.15 : 1);
      t.schleifen = (edel ? 0.35 : 0.22) * n;
      t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), lauf);
      if (bool(c.gelaender)) { t.schweissen += 0.5 * n; t.schleifen += 0.2 * n; }
      if (bool(c.montage)) t.montage = 2.0 + 0.3 * n;
      t.verpackung = 0.8 + 0.04 * n;
      t.transport = bool(c.montage) ? Math.max(0.8, num(c.entfernung, 15) / 40) : 0.6;
      return t;
    },
    material: function (c, M) {
      var n = num(c.stufen, 14), b = num(c.breite, 1), edel = c.werkstoff === "Edelstahl";
      var pos = [];
      function find(nm) { return M.find(function (m) { return m.name === nm; }); }
      var wange = find(edel ? "Vierkantrohr Edelstahl 40 x 40 x 2,0" : "Vierkantrohr Stahl 40 x 40 x 2,0");
      if (wange) pos.push({ ref: wange, name: wange.name, menge: round1(n * 0.5 + 2), einheit: "m" });
      var stufe = find(edel ? "Blech Edelstahl 2,0 mm" : "Blech Stahl 2,0 mm");
      if (stufe) pos.push({ ref: stufe, name: stufe.name, menge: round1(n * b * 0.28), einheit: "m²" });
      if (bool(c.gelaender)) {
        var prof = find(edel ? "Rundrohr Edelstahl 42,4 x 2,0 (V2A)" : "Rundrohr Stahl 42,4 x 2,0");
        if (prof) pos.push({ ref: prof, name: prof.name, menge: round1(n * 0.18 * 2 + 4), einheit: "m" });
      }
      var duebel = find("Chemiedübel-Set M12");
      if (duebel) pos.push({ ref: duebel, name: duebel.name, menge: 8, einheit: "Stk" });
      return pos;
    }
  };

  // ----------------------------------------------------------------
  // SONDERKONSTRUKTION / EINZELANFERTIGUNG (manuelle Mengen)
  // ----------------------------------------------------------------
  var SONDER = {
    key: "sonder",
    name: "Sonderkonstruktion",
    icon: "🧩",
    frei: true, // freie Materialliste + manuelle Zeiten
    fragen: [
      { key: "werkstoff", label: "Werkstoff (Schwerpunkt)", typ: "select", optionen: ["Stahl", "Edelstahl", "Gemischt"] },
      { key: "gewicht", label: "geschätztes Gewicht", typ: "number", einheit: "kg", default: 80 },
      { key: "komplexitaet", label: "Komplexität", typ: "select", optionen: ["Einfach", "Mittel", "Hoch"] },
      { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: ["Roh", "Feuerverzinken", "Pulverbeschichten", "Lackieren"] },
      { key: "montage", label: "Montage erforderlich", typ: "check" },
      { key: "entfernung", label: "Entfernung Baustelle (einfach)", typ: "number", einheit: "km", default: 10 }
    ],
    zeitmodell: function (c) {
      var g = num(c.gewicht, 80);
      var kFak = c.komplexitaet === "Hoch" ? 1.8 : (c.komplexitaet === "Mittel" ? 1.3 : 1.0);
      var edel = c.werkstoff === "Edelstahl";
      var t = leer();
      // grobe Schätzung über Gewicht & Komplexität (h pro kg)
      t.cad = (0.02 * g + 1) * kFak;
      t.zuschnitt = 0.012 * g * kFak;
      t.bohren = 0.006 * g * kFak;
      t.schweissen = 0.03 * g * kFak * (edel ? 1.15 : 1);
      t.schleifen = 0.02 * g * kFak * (edel ? 1.3 : 1);
      t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), g / 10);
      if (bool(c.montage)) t.montage = 0.015 * g * kFak + 1.5;
      t.verpackung = 0.5 + 0.003 * g;
      t.transport = bool(c.montage) ? Math.max(0.5, num(c.entfernung, 10) / 45) : 0.5;
      return t;
    },
    material: function () { return []; } // freie Positionen über UI
  };

  // ----------------------------------------------------------------
  // SERIENTEIL (Stückzahl, Lerneffekt sehr relevant)
  // ----------------------------------------------------------------
  var SERIE = {
    key: "serie",
    name: "Serienteil",
    icon: "⚙️",
    frei: true,
    fragen: [
      { key: "bezeichnung", label: "Teilbezeichnung", typ: "text", default: "" },
      { key: "werkstoff", label: "Werkstoff", typ: "select", optionen: ["Stahl", "Edelstahl"] },
      { key: "stueck", label: "Stückzahl", typ: "number", einheit: "Stk", default: 100 },
      { key: "gewichtStk", label: "Gewicht je Stück", typ: "number", einheit: "kg", default: 0.8 },
      { key: "lasern", label: "Lasern", typ: "check", default: true },
      { key: "bohren", label: "Bohren", typ: "check", default: true },
      { key: "schweissen", label: "Schweißen", typ: "check" },
      { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: ["Roh", "Feuerverzinken", "Pulverbeschichten"] }
    ],
    zeitmodell: function (c) {
      var n = num(c.stueck, 100), g = num(c.gewichtStk, 0.8);
      var edel = c.werkstoff === "Edelstahl";
      // Rüsten degressiv pro Stück, je größer die Serie desto günstiger/Stk
      var ruest = 0.5 + Math.log10(n + 1) * 0.4;
      var t = leer();
      t.cad = 0.8 + (n > 1 ? 0.2 : 0); // einmalige Programmierung
      t.zuschnitt = ruest * 0.3 + n * 0.004 * (1 + g * 0.05);
      t.lasern = bool(c.lasern) ? ruest * 0.4 + n * 0.006 : 0;
      t.bohren = bool(c.bohren) ? n * 0.003 : 0;
      t.schweissen = bool(c.schweissen) ? n * 0.02 * (edel ? 1.15 : 1) : 0;
      t.schleifen = n * 0.004 * (edel ? 1.3 : 1);
      t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), n * g / 10);
      t.verpackung = 0.3 + n * 0.0015;
      t.transport = 0.3;
      return t;
    },
    material: function () { return []; }
  };

  // ----------------------------------------------------------------
  // REPARATUR / MONTAGE
  // ----------------------------------------------------------------
  var REPARATUR = {
    key: "reparatur",
    name: "Reparatur / Montage",
    icon: "🔧",
    frei: true,
    fragen: [
      { key: "beschreibung", label: "Beschreibung", typ: "text", default: "" },
      { key: "aufwand", label: "geschätzter Werkstattaufwand", typ: "number", einheit: "h", default: 2 },
      { key: "montageStunden", label: "Montage vor Ort", typ: "number", einheit: "h", default: 1.5 },
      { key: "anfahrt", label: "Anzahl Anfahrten", typ: "number", einheit: "x", default: 1 },
      { key: "entfernung", label: "Entfernung (einfach)", typ: "number", einheit: "km", default: 12 }
    ],
    zeitmodell: function (c) {
      var t = leer();
      t.schweissen = num(c.aufwand, 2) * 0.5;
      t.schleifen = num(c.aufwand, 2) * 0.5;
      t.montage = num(c.montageStunden, 1.5) * Math.max(1, num(c.anfahrt, 1));
      t.transport = Math.max(0.4, num(c.entfernung, 12) / 45) * Math.max(1, num(c.anfahrt, 1));
      return t;
    },
    material: function () { return []; }
  };

  function round1(x) { return Math.round(x * 10) / 10; }

  var PRODUKTE = [GELAENDER, TREPPE, ZAUN, SONDER, SERIE, REPARATUR];

  function byKey(k) { return PRODUKTE.find(function (p) { return p.key === k; }); }

  w.Spanwerk = w.Spanwerk || {};
  w.Spanwerk.Products = { list: PRODUKTE, byKey: byKey, SCHRITTE: SCHRITTE };
})(window);
