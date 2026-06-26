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
      strasse: "", plzOrt: "", tel: "", email: "nicowarscher@gmx.at", uid: ""
    },
    angebotZaehler: 1, // laufende Angebotsnummer
    // Stundenverrechnungssätze je Mitarbeitergruppe (€/h)
    rates: { cad: 65, fertigung: 58, montage: 62, projektleitung: 78 },
    // Maschinen der Firma: je Maschine ein Stundensatz (€/h) und Rüstkosten (€
    // einmalig pro Auftrag), zugeordnet zu einem Arbeitsschritt (schritt-Key).
    maschinen: [
      { id: "m-saege",    name: "Säge",            schritt: "zuschnitt",  stundensatz: 22, ruestkosten: 5 },
      { id: "m-laser",    name: "Laser",           schritt: "lasern",     stundensatz: 95, ruestkosten: 30 },
      { id: "m-abkant",   name: "Abkantpresse",    schritt: "biegen",     stundensatz: 70, ruestkosten: 20 },
      { id: "m-bohr",     name: "Bohrmaschine",    schritt: "bohren",     stundensatz: 18, ruestkosten: 3 },
      { id: "m-schweiss", name: "Schweißgerät",    schritt: "schweissen", stundensatz: 14, ruestkosten: 2 },
      { id: "m-schleif",  name: "Schleifmaschine", schritt: "schleifen",  stundensatz: 10, ruestkosten: 2 }
    ],
    materialAufschlag: 12,  // % auf Materialeinkauf
    gemeinkosten: 14,       // % auf Selbstkosten
    gewinn: 18,             // % Gewinnaufschlag
    verschnitt: 8,          // % Standard-Verschnitt
    mwst: 20,               // % USt
    transportProKm: 0.9,    // €/km (Hin- und Rückfahrt)
    montagePauschaleAnfahrt: 1.0 // h Anfahrt-Rüstzeit pro Montage
  };

  // ---- Beispiel-Materialdatenbank ---------------------------
  // Preise sind realistische Richtwerte (netto) und können
  // jederzeit angepasst oder per Lieferant aktualisiert werden.
  var SEED_MATERIAL = [
    { name: "Rundrohr Stahl 42,4 x 2,0", typ: "Stahl", einheit: "m", preis: 6.40, lieferant: "Frankstahl" },
    { name: "Rundrohr Edelstahl 42,4 x 2,0 (V2A)", typ: "Edelstahl", einheit: "m", preis: 21.80, lieferant: "Frankstahl" },
    { name: "Vierkantrohr Stahl 40 x 40 x 2,0", typ: "Stahl", einheit: "m", preis: 7.10, lieferant: "Frankstahl" },
    { name: "Vierkantrohr Edelstahl 40 x 40 x 2,0", typ: "Edelstahl", einheit: "m", preis: 26.50, lieferant: "Frankstahl" },
    { name: "Flachstahl 40 x 8", typ: "Stahl", einheit: "m", preis: 3.20, lieferant: "Frankstahl" },
    { name: "Rundstab Stahl 12 mm", typ: "Stahl", einheit: "m", preis: 1.10, lieferant: "Frankstahl" },
    { name: "Rundstab Edelstahl 12 mm", typ: "Edelstahl", einheit: "m", preis: 4.60, lieferant: "Frankstahl" },
    { name: "Blech Stahl 2,0 mm", typ: "Stahl", einheit: "m²", preis: 28.0, lieferant: "Frankstahl" },
    { name: "Blech Edelstahl 2,0 mm", typ: "Edelstahl", einheit: "m²", preis: 96.0, lieferant: "Frankstahl" },
    { name: "Rundrohr Aluminium 42,4 x 2,0", typ: "Aluminium", einheit: "m", preis: 12.4, lieferant: "Frankstahl" },
    { name: "Vierkantrohr Aluminium 40 x 40 x 2,0", typ: "Aluminium", einheit: "m", preis: 14.9, lieferant: "Frankstahl" },
    { name: "Rundstab Aluminium 12 mm", typ: "Aluminium", einheit: "m", preis: 2.6, lieferant: "Frankstahl" },
    { name: "Blech Aluminium 2,0 mm", typ: "Aluminium", einheit: "m²", preis: 41.0, lieferant: "Frankstahl" },
    { name: "VSG-Glas 8.8.4 klar", typ: "Glas", einheit: "m²", preis: 145.0, lieferant: "Glas Müller" },
    { name: "Glasklemme Edelstahl", typ: "Beschlag", einheit: "Stk", preis: 14.5, lieferant: "MetallProfi" },
    { name: "Pfostenanker / Bodenplatte", typ: "Beschlag", einheit: "Stk", preis: 9.8, lieferant: "MetallProfi" },
    { name: "Chemiedübel-Set M12", typ: "Befestigung", einheit: "Stk", preis: 2.3, lieferant: "MetallProfi" }
  ];

  function nowISO() { return new Date().toISOString(); }
  function uid() {
    return "id-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function fresh() {
    var mats = SEED_MATERIAL.map(function (m) {
      return {
        id: uid(),
        name: m.name, typ: m.typ, einheit: m.einheit,
        preis: m.preis, lieferant: m.lieferant,
        lager: null, // optionaler Lagerbestand
        aktualisiert: nowISO(),
        historie: [{ datum: nowISO(), preis: m.preis }]
      };
    });
    return {
      version: 1,
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      material: mats,
      auftraege: [],
      // Lernmodell: Korrekturfaktoren je Produkttyp & Arbeitsschritt
      lernen: { faktoren: {}, erkenntnisse: [] }
    };
  }

  var _db = null;

  function load() {
    if (_db) return _db;
    try {
      var raw = w.localStorage.getItem(KEY);
      if (raw) {
        _db = JSON.parse(raw);
        // sanfte Migration fehlender Felder
        if (!_db.settings) _db.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        // Migration: altes Maschinen-Objekt {key: satz} -> Liste mit Rüstkosten
        if (_db.settings.maschinen && !Array.isArray(_db.settings.maschinen)) {
          var alt = _db.settings.maschinen;
          var map = {
            saege: ["Säge", "zuschnitt"], laser: ["Laser", "lasern"],
            abkantpresse: ["Abkantpresse", "biegen"], bohrmaschine: ["Bohrmaschine", "bohren"],
            schweissgeraet: ["Schweißgerät", "schweissen"], schleifmaschine: ["Schleifmaschine", "schleifen"]
          };
          _db.settings.maschinen = Object.keys(alt).map(function (k) {
            var m = map[k] || [k, ""];
            return { id: "m-" + k, name: m[0], schritt: m[1], stundensatz: alt[k], ruestkosten: 0 };
          });
        }
        if (!_db.settings.maschinen) _db.settings.maschinen = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.maschinen));
        if (!_db.settings.firma) _db.settings.firma = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.firma));
        if (_db.settings.angebotZaehler == null) _db.settings.angebotZaehler = 1;
        if (!_db.lernen) _db.lernen = { faktoren: {}, erkenntnisse: [] };
        if (!_db.material) _db.material = [];
        if (!_db.auftraege) _db.auftraege = [];
        return _db;
      }
    } catch (e) { console.warn("Konnte Daten nicht laden:", e); }
    _db = fresh();
    save();
    return _db;
  }

  function save() {
    try { w.localStorage.setItem(KEY, JSON.stringify(_db)); }
    catch (e) { console.warn("Speichern fehlgeschlagen:", e); }
  }

  function reset() {
    _db = fresh();
    save();
    return _db;
  }

  function exportJSON() { return JSON.stringify(load(), null, 2); }

  function importJSON(text) {
    var obj = JSON.parse(text);
    if (!obj || typeof obj !== "object") throw new Error("Ungültige Datei");
    _db = obj;
    save();
    return _db;
  }

  w.Preisschmiede = w.Preisschmiede || {};
  w.Preisschmiede.Store = {
    load: load, save: save, reset: reset,
    exportJSON: exportJSON, importJSON: importJSON,
    uid: uid, nowISO: nowISO,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };
})(window);
