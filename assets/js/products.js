/* ============================================================
   Preisschmiede – Produktkonfigurator
   Jeder Produkttyp definiert:
     - fragen:      die abgefragten Konfigurationsfelder
     - zeitmodell:  Basis-Arbeitszeiten (Erfahrungs-Startwerte in h)
     - material:    erzeugt die Materialliste (Positionen)
   Die Startwerte werden durch die Lernfunktion fortlaufend und
   segmentiert (Material × Größe) verfeinert (siehe calc.js).
   ============================================================ */
(function (w) {
  "use strict";

  // Hilfsfunktionen
  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : (d || 0); }
  function bool(v) { return v === true || v === "true" || v === "on" || v === 1; }
  function round1(x) { return Math.round(x * 10) / 10; }

  // Arbeitsschritte (Reihenfolge = Anzeige-Reihenfolge)
  // kat   = Lohngruppe (rates),  maschine = Maschinenstundensatz (optional)
  var SCHRITTE = [
    { key: "cad",        label: "CAD / Planung",         kat: "cad" },
    { key: "zuschnitt",  label: "Zuschnitt",             kat: "fertigung", maschine: "saege" },
    { key: "lasern",     label: "Lasern",                kat: "fertigung", maschine: "laser" },
    { key: "biegen",     label: "Biegen / Kanten",       kat: "fertigung", maschine: "abkantpresse" },
    { key: "bohren",     label: "Bohren / Gewinde",      kat: "fertigung", maschine: "bohrmaschine" },
    { key: "schweissen", label: "Schweißen",             kat: "fertigung", maschine: "schweissgeraet" },
    { key: "schleifen",  label: "Schleifen / Finish",    kat: "fertigung", maschine: "schleifmaschine" },
    { key: "oberflaeche",label: "Oberflächenbearbeitung",kat: "fertigung" },
    { key: "montage",    label: "Montage",               kat: "montage" },
    { key: "verpackung", label: "Verpackung",            kat: "fertigung" },
    { key: "transport",  label: "Transport",             kat: "montage" }
  ];

  function leer() {
    var o = {};
    SCHRITTE.forEach(function (s) { o[s.key] = 0; });
    return o;
  }

  // Werkstoff-Multiplikator je Arbeitsschritt
  // (Edelstahl & Aluminium aufwändiger beim Schweißen, Alu leichter beim Zuschnitt)
  function wfak(werkstoff, schritt) {
    var W = {
      "Edelstahl": { schweissen: 1.15, schleifen: 1.30, zuschnitt: 1.05 },
      "Aluminium": { schweissen: 1.25, schleifen: 0.90, zuschnitt: 0.85, biegen: 0.85 },
      "Stahl": {}
    };
    var m = W[werkstoff] || {};
    return m[schritt] || 1;
  }

  // Design-/Komplexitätsfaktor (wirkt auf CAD, Schweißen, Schleifen)
  function designFak(design) {
    switch (design) {
      case "Modern": return 1.15;
      case "Aufwändig": return 1.40;
      default: return 1.0; // Standard
    }
  }

  // Oberflächen-Zuschlag (Aufwand pro lfm bzw. Pauschale)
  function oberflaecheZeit(art, lfm) {
    switch (art) {
      case "feuerverzinken": return 0.4 + lfm * 0.04;
      case "pulverbeschichten": return 0.5 + lfm * 0.05;
      case "verzinkt + pulverbeschichtet": return 0.7 + lfm * 0.07;
      case "lackieren": return 0.6 + lfm * 0.08;
      default: return 0; // roh
    }
  }

  // Gemeinsame Optionen
  var WERKSTOFFE = ["Stahl", "Edelstahl", "Aluminium"];
  var OBERFLAECHEN = ["Roh", "Feuerverzinken", "Pulverbeschichten", "Verzinkt + pulverbeschichtet", "Lackieren"];
  var DESIGNS = ["Standard", "Modern", "Aufwändig"];

  function profName(werkstoff, profil) {
    if (profil === "Vierkantrohr") {
      return werkstoff === "Edelstahl" ? "Vierkantrohr Edelstahl 40 x 40 x 2,0"
        : werkstoff === "Aluminium" ? "Vierkantrohr Aluminium 40 x 40 x 2,0"
        : "Vierkantrohr Stahl 40 x 40 x 2,0";
    }
    return werkstoff === "Edelstahl" ? "Rundrohr Edelstahl 42,4 x 2,0 (V2A)"
      : werkstoff === "Aluminium" ? "Rundrohr Aluminium 42,4 x 2,0"
      : "Rundrohr Stahl 42,4 x 2,0";
  }
  function blechName(werkstoff) {
    return werkstoff === "Edelstahl" ? "Blech Edelstahl 2,0 mm"
      : werkstoff === "Aluminium" ? "Blech Aluminium 2,0 mm"
      : "Blech Stahl 2,0 mm";
  }
  function stabName(werkstoff) {
    return werkstoff === "Edelstahl" ? "Rundstab Edelstahl 12 mm"
      : werkstoff === "Aluminium" ? "Rundstab Aluminium 12 mm"
      : "Rundstab Stahl 12 mm";
  }
  function findM(M, name) { return M.find(function (m) { return m.name === name; }); }

  // ----------------------------------------------------------------
  // GELÄNDER
  // ----------------------------------------------------------------
  var GELAENDER = {
    key: "gelaender", name: "Geländer", icon: "🛡️",
    fragen: [
      { key: "werkstoff", label: "Werkstoff", typ: "select", optionen: WERKSTOFFE },
      { key: "profil", label: "Profil", typ: "select", optionen: ["Rundrohr", "Vierkantrohr"] },
      { key: "fuellung", label: "Füllung", typ: "select", optionen: ["Stäbe", "Glas", "Blech"] },
      { key: "design", label: "Design", typ: "select", optionen: DESIGNS },
      { key: "bereich", label: "Bereich", typ: "select", optionen: ["Innen", "Außen"] },
      { key: "laenge", label: "Länge", typ: "number", einheit: "m", default: 6 },
      { key: "hoehe", label: "Höhe", typ: "number", einheit: "m", default: 1.0 },
      { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: OBERFLAECHEN },
      { key: "lasern", label: "Laserschneiden", typ: "check" },
      { key: "biegen", label: "Biegen / Kanten", typ: "check" },
      { key: "gewinde", label: "Gewinde schneiden", typ: "check" },
      { key: "montage", label: "Montage erforderlich", typ: "check", default: true },
      { key: "fundament", label: "Fundamentarbeiten", typ: "check" },
      { key: "entfernung", label: "Entfernung Baustelle (einfach)", typ: "number", einheit: "km", default: 15 }
    ],
    zeitmodell: function (c) {
      var L = num(c.laenge, 6), H = num(c.hoehe, 1);
      var ws = c.werkstoff || "Stahl";
      var dfak = designFak(c.design);
      var t = leer();
      var pfosten = Math.max(2, Math.ceil(L / 1.1) + 1);
      t.cad = (1.2 + L * 0.12 + (c.fuellung === "Glas" ? 0.6 : 0)) * dfak;
      t.zuschnitt = (0.15 * pfosten + 0.1 * L) * wfak(ws, "zuschnitt");
      t.lasern = bool(c.lasern) ? 0.15 * pfosten + 0.2 : 0;
      t.biegen = bool(c.biegen) ? (0.12 * L + 0.05 * pfosten) * wfak(ws, "biegen") : 0;
      t.bohren = 0.08 * pfosten + (c.fuellung === "Glas" ? 0.12 * L : 0) + (bool(c.gewinde) ? 0.05 * pfosten : 0);
      var schwBasis = c.fuellung === "Stäbe" ? 0.55 : (c.fuellung === "Blech" ? 0.38 : 0.22);
      t.schweissen = (schwBasis * L + 0.25 * pfosten) * wfak(ws, "schweissen") * dfak;
      t.schleifen = (0.28 * L + 0.1 * pfosten) * wfak(ws, "schleifen") * dfak;
      t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), L);
      if (bool(c.montage)) t.montage = 0.35 * L + 0.15 * pfosten + (bool(c.fundament) ? 1.5 + 0.4 * pfosten : 0);
      t.verpackung = 0.4 + 0.05 * L;
      t.transport = bool(c.montage) ? Math.max(0.5, num(c.entfernung, 15) / 45) : 0.4;
      return t;
    },
    material: function (c, M) {
      var L = num(c.laenge, 6), ws = c.werkstoff || "Stahl";
      var pfosten = Math.max(2, Math.ceil(L / 1.1) + 1);
      var pos = [];
      var prof = findM(M, profName(ws, c.profil));
      if (prof) pos.push({ ref: prof, name: prof.name, menge: round1(pfosten * (num(c.hoehe, 1) + 0.1) + L), einheit: "m" });
      if (c.fuellung === "Stäbe") {
        var stab = findM(M, stabName(ws));
        if (stab) pos.push({ ref: stab, name: stab.name, menge: round1(Math.ceil(L / 0.11) * num(c.hoehe, 1) * 0.9), einheit: "m" });
      } else if (c.fuellung === "Glas") {
        var glas = findM(M, "VSG-Glas 8.8.4 klar");
        if (glas) pos.push({ ref: glas, name: glas.name, menge: round1(L * (num(c.hoehe, 1) - 0.15)), einheit: "m²" });
        var klemme = findM(M, "Glasklemme Edelstahl");
        if (klemme) pos.push({ ref: klemme, name: klemme.name, menge: Math.ceil(L / 0.5), einheit: "Stk" });
      } else if (c.fuellung === "Blech") {
        var blech = findM(M, blechName(ws));
        if (blech) pos.push({ ref: blech, name: blech.name, menge: round1(L * (num(c.hoehe, 1) - 0.15)), einheit: "m²" });
      }
      var anker = findM(M, "Pfostenanker / Bodenplatte");
      if (anker) pos.push({ ref: anker, name: anker.name, menge: pfosten, einheit: "Stk" });
      var duebel = findM(M, "Chemiedübel-Set M12");
      if (duebel) pos.push({ ref: duebel, name: duebel.name, menge: pfosten * 2, einheit: "Stk" });
      return pos;
    }
  };

  // ----------------------------------------------------------------
  // BALKON (Geländer + tragende Konstruktion + Boden)
  // ----------------------------------------------------------------
  var BALKON = {
    key: "balkon", name: "Balkon", icon: "🏠",
    fragen: [
      { key: "werkstoff", label: "Werkstoff", typ: "select", optionen: WERKSTOFFE },
      { key: "breite", label: "Breite", typ: "number", einheit: "m", default: 4 },
      { key: "tiefe", label: "Auskragung / Tiefe", typ: "number", einheit: "m", default: 1.5 },
      { key: "fuellung", label: "Geländer-Füllung", typ: "select", optionen: ["Stäbe", "Glas", "Blech"] },
      { key: "boden", label: "Bodenbelag", typ: "select", optionen: ["Gitterrost", "Riffelblech", "ohne"] },
      { key: "design", label: "Design", typ: "select", optionen: DESIGNS },
      { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: OBERFLAECHEN },
      { key: "montage", label: "Montage erforderlich", typ: "check", default: true },
      { key: "entfernung", label: "Entfernung Baustelle (einfach)", typ: "number", einheit: "km", default: 20 }
    ],
    zeitmodell: function (c) {
      var B = num(c.breite, 4), T = num(c.tiefe, 1.5);
      var umfang = B + 2 * T; // Geländerlänge
      var flaeche = B * T;
      var ws = c.werkstoff || "Stahl";
      var dfak = designFak(c.design);
      var t = leer();
      t.cad = (3 + umfang * 0.15 + flaeche * 0.3) * dfak;
      t.zuschnitt = (1.0 + umfang * 0.2 + flaeche * 0.4) * wfak(ws, "zuschnitt");
      t.bohren = 0.3 + umfang * 0.08;
      t.schweissen = (3.5 + umfang * 0.4 + flaeche * 0.8) * wfak(ws, "schweissen") * dfak;
      t.schleifen = (1.5 + umfang * 0.3) * wfak(ws, "schleifen") * dfak;
      t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), umfang + flaeche);
      if (bool(c.montage)) t.montage = 4 + umfang * 0.4 + flaeche * 0.6;
      t.verpackung = 0.8 + 0.05 * umfang;
      t.transport = bool(c.montage) ? Math.max(1.0, num(c.entfernung, 20) / 40) : 0.6;
      return t;
    },
    material: function (c, M) {
      var B = num(c.breite, 4), T = num(c.tiefe, 1.5), ws = c.werkstoff || "Stahl";
      var umfang = B + 2 * T, flaeche = B * T;
      var pos = [];
      var prof = findM(M, profName(ws, "Vierkantrohr"));
      if (prof) pos.push({ ref: prof, name: prof.name, menge: round1(umfang * 2 + flaeche * 2.5 + 6), einheit: "m" });
      if (c.boden !== "ohne") {
        var blech = findM(M, blechName(ws));
        if (blech) pos.push({ ref: blech, name: blech.name, menge: round1(flaeche * 1.1), einheit: "m²" });
      }
      if (c.fuellung === "Glas") {
        var glas = findM(M, "VSG-Glas 8.8.4 klar");
        if (glas) pos.push({ ref: glas, name: glas.name, menge: round1(umfang * 0.95), einheit: "m²" });
      } else if (c.fuellung === "Stäbe") {
        var stab = findM(M, stabName(ws));
        if (stab) pos.push({ ref: stab, name: stab.name, menge: round1(Math.ceil(umfang / 0.11) * 1.0), einheit: "m" });
      }
      var duebel = findM(M, "Chemiedübel-Set M12");
      if (duebel) pos.push({ ref: duebel, name: duebel.name, menge: 8, einheit: "Stk" });
      return pos;
    }
  };

  // ----------------------------------------------------------------
  // ZAUN
  // ----------------------------------------------------------------
  var ZAUN = {
    key: "zaun", name: "Zaun", icon: "🚧",
    fragen: [
      { key: "werkstoff", label: "Werkstoff", typ: "select", optionen: WERKSTOFFE },
      { key: "laenge", label: "Länge", typ: "number", einheit: "m", default: 20 },
      { key: "hoehe", label: "Höhe", typ: "number", einheit: "m", default: 1.5 },
      { key: "fuellung", label: "Füllung", typ: "select", optionen: ["Stäbe", "Blech"] },
      { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: OBERFLAECHEN },
      { key: "montage", label: "Montage erforderlich", typ: "check", default: true },
      { key: "fundament", label: "Fundamentarbeiten", typ: "check", default: true },
      { key: "entfernung", label: "Entfernung Baustelle (einfach)", typ: "number", einheit: "km", default: 20 }
    ],
    zeitmodell: function (c) {
      var L = num(c.laenge, 20), ws = c.werkstoff || "Stahl";
      var felder = Math.ceil(L / 2.5);
      var t = leer();
      t.cad = 1.0 + L * 0.05;
      t.zuschnitt = (0.12 * L + 0.1 * felder) * wfak(ws, "zuschnitt");
      t.bohren = 0.06 * felder;
      t.schweissen = (c.fuellung === "Stäbe" ? 0.35 : 0.28) * L * wfak(ws, "schweissen");
      t.schleifen = 0.18 * L * wfak(ws, "schleifen");
      t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), L);
      if (bool(c.montage)) t.montage = 0.3 * L + (bool(c.fundament) ? 0.6 * felder : 0);
      t.verpackung = 0.3 + 0.03 * L;
      t.transport = bool(c.montage) ? Math.max(0.6, num(c.entfernung, 20) / 45) : 0.5;
      return t;
    },
    material: function (c, M) {
      var L = num(c.laenge, 20), ws = c.werkstoff || "Stahl";
      var felder = Math.ceil(L / 2.5), pfosten = felder + 1, pos = [];
      var prof = findM(M, profName(ws, "Vierkantrohr"));
      if (prof) pos.push({ ref: prof, name: prof.name, menge: round1(pfosten * (num(c.hoehe, 1.5) + 0.5) + L * 2), einheit: "m" });
      if (c.fuellung === "Stäbe") {
        var stab = findM(M, stabName(ws));
        if (stab) pos.push({ ref: stab, name: stab.name, menge: round1(Math.ceil(L / 0.12) * num(c.hoehe, 1.5)), einheit: "m" });
      } else {
        var blech = findM(M, blechName(ws));
        if (blech) pos.push({ ref: blech, name: blech.name, menge: round1(L * num(c.hoehe, 1.5)), einheit: "m²" });
      }
      var anker = findM(M, "Pfostenanker / Bodenplatte");
      if (anker) pos.push({ ref: anker, name: anker.name, menge: pfosten, einheit: "Stk" });
      return pos;
    }
  };

  // ----------------------------------------------------------------
  // TREPPE
  // ----------------------------------------------------------------
  var TREPPE = {
    key: "treppe", name: "Treppe", icon: "🪜",
    fragen: [
      { key: "werkstoff", label: "Werkstoff", typ: "select", optionen: WERKSTOFFE },
      { key: "stufen", label: "Anzahl Stufen", typ: "number", einheit: "Stk", default: 14 },
      { key: "breite", label: "Stufenbreite", typ: "number", einheit: "m", default: 1.0 },
      { key: "design", label: "Design", typ: "select", optionen: DESIGNS },
      { key: "gelaender", label: "Geländer beidseitig", typ: "check", default: true },
      { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: OBERFLAECHEN },
      { key: "lasern", label: "Stufen lasern", typ: "check", default: true },
      { key: "biegen", label: "Stufen kanten", typ: "check", default: true },
      { key: "montage", label: "Montage erforderlich", typ: "check", default: true },
      { key: "entfernung", label: "Entfernung Baustelle (einfach)", typ: "number", einheit: "km", default: 15 }
    ],
    zeitmodell: function (c) {
      var n = num(c.stufen, 14), ws = c.werkstoff || "Stahl";
      var lauf = n * 0.18 * 1.6, dfak = designFak(c.design);
      var t = leer();
      t.cad = (2.5 + n * 0.08) * dfak;
      t.zuschnitt = (0.25 * n + 0.4) * wfak(ws, "zuschnitt");
      t.lasern = bool(c.lasern) ? 0.2 * n : 0;
      t.biegen = bool(c.biegen) ? 0.18 * n * wfak(ws, "biegen") : 0;
      t.bohren = 0.1 * n;
      t.schweissen = (0.6 * n + 1.5) * wfak(ws, "schweissen") * dfak;
      t.schleifen = 0.22 * n * wfak(ws, "schleifen") * dfak;
      t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), lauf);
      if (bool(c.gelaender)) { t.schweissen += 0.5 * n * wfak(ws, "schweissen"); t.schleifen += 0.2 * n; }
      if (bool(c.montage)) t.montage = 2.0 + 0.3 * n;
      t.verpackung = 0.8 + 0.04 * n;
      t.transport = bool(c.montage) ? Math.max(0.8, num(c.entfernung, 15) / 40) : 0.6;
      return t;
    },
    material: function (c, M) {
      var n = num(c.stufen, 14), b = num(c.breite, 1), ws = c.werkstoff || "Stahl", pos = [];
      var wange = findM(M, profName(ws, "Vierkantrohr"));
      if (wange) pos.push({ ref: wange, name: wange.name, menge: round1(n * 0.5 + 2), einheit: "m" });
      var stufe = findM(M, blechName(ws));
      if (stufe) pos.push({ ref: stufe, name: stufe.name, menge: round1(n * b * 0.28), einheit: "m²" });
      if (bool(c.gelaender)) {
        var prof = findM(M, profName(ws, "Rundrohr"));
        if (prof) pos.push({ ref: prof, name: prof.name, menge: round1(n * 0.18 * 2 + 4), einheit: "m" });
      }
      var duebel = findM(M, "Chemiedübel-Set M12");
      if (duebel) pos.push({ ref: duebel, name: duebel.name, menge: 8, einheit: "Stk" });
      return pos;
    }
  };

  // ----------------------------------------------------------------
  // STAHLBAU / EDELSTAHLBAU / SONDERKONSTRUKTION (gewichtsbasiert)
  // ----------------------------------------------------------------
  function gewichtsModell(defaultWerkstoff, werkstoffOptionen) {
    return {
      fragen: [
        { key: "werkstoff", label: "Werkstoff (Schwerpunkt)", typ: "select", optionen: werkstoffOptionen },
        { key: "gewicht", label: "geschätztes Gewicht", typ: "number", einheit: "kg", default: 250 },
        { key: "design", label: "Komplexität", typ: "select", optionen: ["Einfach", "Mittel", "Hoch"] },
        { key: "lasern", label: "Laserteile", typ: "check" },
        { key: "biegen", label: "Biegen / Kanten", typ: "check" },
        { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: OBERFLAECHEN },
        { key: "montage", label: "Montage erforderlich", typ: "check", default: true },
        { key: "entfernung", label: "Entfernung Baustelle (einfach)", typ: "number", einheit: "km", default: 25 }
      ],
      zeitmodell: function (c) {
        var g = num(c.gewicht, 250);
        var kFak = c.design === "Hoch" ? 1.8 : (c.design === "Mittel" ? 1.3 : 1.0);
        var ws = c.werkstoff || defaultWerkstoff;
        var t = leer();
        t.cad = (0.012 * g + 2) * kFak;
        t.zuschnitt = 0.01 * g * kFak * wfak(ws, "zuschnitt");
        t.lasern = bool(c.lasern) ? 0.006 * g : 0;
        t.biegen = bool(c.biegen) ? 0.005 * g * wfak(ws, "biegen") : 0;
        t.bohren = 0.005 * g * kFak;
        t.schweissen = 0.028 * g * kFak * wfak(ws, "schweissen");
        t.schleifen = 0.016 * g * kFak * wfak(ws, "schleifen");
        t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), g / 10);
        if (bool(c.montage)) t.montage = 0.012 * g * kFak + 2;
        t.verpackung = 0.5 + 0.002 * g;
        t.transport = bool(c.montage) ? Math.max(0.6, num(c.entfernung, 25) / 40) : 0.5;
        return t;
      },
      material: function () { return []; } // freie Positionen + ggf. Rohmaterial über kg
    };
  }

  var STAHLBAU = Object.assign({ key: "stahlbau", name: "Stahlbau", icon: "🏗️", frei: true },
    gewichtsModell("Stahl", ["Stahl"]));
  var EDELSTAHLBAU = Object.assign({ key: "edelstahlbau", name: "Edelstahlbau", icon: "✨", frei: true },
    gewichtsModell("Edelstahl", ["Edelstahl"]));
  var SONDER = Object.assign({ key: "sonder", name: "Sonderkonstruktion", icon: "🧩", frei: true },
    gewichtsModell("Stahl", ["Stahl", "Edelstahl", "Aluminium", "Gemischt"]));

  // ----------------------------------------------------------------
  // SERIENTEIL
  // ----------------------------------------------------------------
  var SERIE = {
    key: "serie", name: "Serienteil", icon: "⚙️", frei: true,
    fragen: [
      { key: "bezeichnung", label: "Teilbezeichnung", typ: "text", default: "" },
      { key: "werkstoff", label: "Werkstoff", typ: "select", optionen: WERKSTOFFE },
      { key: "stueck", label: "Stückzahl", typ: "number", einheit: "Stk", default: 100 },
      { key: "gewichtStk", label: "Gewicht je Stück", typ: "number", einheit: "kg", default: 0.8 },
      { key: "lasern", label: "Lasern", typ: "check", default: true },
      { key: "biegen", label: "Biegen / Kanten", typ: "check" },
      { key: "bohren", label: "Bohren / Gewinde", typ: "check", default: true },
      { key: "schweissen", label: "Schweißen", typ: "check" },
      { key: "oberflaeche", label: "Oberfläche", typ: "select", optionen: OBERFLAECHEN }
    ],
    zeitmodell: function (c) {
      var n = num(c.stueck, 100), g = num(c.gewichtStk, 0.8), ws = c.werkstoff || "Stahl";
      var ruest = 0.5 + Math.log10(n + 1) * 0.4; // Rüsten degressiv
      var t = leer();
      t.cad = 0.8 + (n > 1 ? 0.2 : 0);
      t.zuschnitt = (ruest * 0.3 + n * 0.004 * (1 + g * 0.05)) * wfak(ws, "zuschnitt");
      t.lasern = bool(c.lasern) ? ruest * 0.4 + n * 0.006 : 0;
      t.biegen = bool(c.biegen) ? ruest * 0.3 + n * 0.004 : 0;
      t.bohren = bool(c.bohren) ? n * 0.003 : 0;
      t.schweissen = bool(c.schweissen) ? n * 0.02 * wfak(ws, "schweissen") : 0;
      t.schleifen = n * 0.004 * wfak(ws, "schleifen");
      t.oberflaeche = oberflaecheZeit((c.oberflaeche || "Roh").toLowerCase(), n * g / 10);
      t.verpackung = 0.3 + n * 0.0015;
      t.transport = 0.3;
      return t;
    },
    material: function () { return []; }
  };

  // ----------------------------------------------------------------
  // REPARATUR / WARTUNG / MONTAGE
  // ----------------------------------------------------------------
  var REPARATUR = {
    key: "reparatur", name: "Reparatur / Wartung", icon: "🔧", frei: true,
    fragen: [
      { key: "art", label: "Art", typ: "select", optionen: ["Reparatur", "Wartung", "Montage"] },
      { key: "beschreibung", label: "Beschreibung", typ: "text", default: "" },
      { key: "aufwand", label: "geschätzter Werkstattaufwand", typ: "number", einheit: "h", default: 2 },
      { key: "montageStunden", label: "Arbeit vor Ort", typ: "number", einheit: "h", default: 1.5 },
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

  var PRODUKTE = [GELAENDER, TREPPE, BALKON, ZAUN, STAHLBAU, EDELSTAHLBAU, SONDER, SERIE, REPARATUR];

  function byKey(k) { return PRODUKTE.find(function (p) { return p.key === k; }); }

  w.Preisschmiede = w.Preisschmiede || {};
  w.Preisschmiede.Products = { list: PRODUKTE, byKey: byKey, SCHRITTE: SCHRITTE };
})(window);
