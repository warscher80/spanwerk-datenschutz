/* ============================================================
   Spanwerk – Datenhaltung (localStorage)
   Alle Daten bleiben lokal auf dem Gerät (siehe Datenschutz).
   ============================================================ */
(function (w) {
  "use strict";

  var KEY = "spanwerk.kalkulation.v1";

  // ---- Standard-Stammdaten ----------------------------------
  var DEFAULT_SETTINGS = {
    rates: { cad: 65, fertigung: 58, montage: 62, projektleitung: 78 }, // €/h
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

  w.Spanwerk = w.Spanwerk || {};
  w.Spanwerk.Store = {
    load: load, save: save, reset: reset,
    exportJSON: exportJSON, importJSON: importJSON,
    uid: uid, nowISO: nowISO,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };
})(window);
