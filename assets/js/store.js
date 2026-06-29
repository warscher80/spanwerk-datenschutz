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
        kgProEinheit: m.kg != null ? m.kg : null, // Gewicht je Einheit
        preisProKg: null, // optional: wenn gesetzt, wird über Gewicht gerechnet
        lager: null, // optionaler Lagerbestand
        aktualisiert: nowISO(),
        historie: [{ datum: nowISO(), preis: m.preis }]
      };
    });
    return {
      version: 1,
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      material: mats,
      kunden: [],
      // benutzerdefinierte Untergruppen je Produkt, z. B. { zaun: ["Doppelstabmattenzaun", ...] }
      untergruppen: {},
      auftraege: [],
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
    obj.material.forEach(function (m) {
      if (m && !Array.isArray(m.historie)) m.historie = (m.preis != null ? [{ datum: nowISO(), preis: m.preis }] : []);
    });
    if (!Array.isArray(obj.kunden)) obj.kunden = [];
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
    return obj;
  }

  function load() {
    if (_db) return _db;
    var raw = null;
    try {
      raw = w.localStorage.getItem(KEY);
      if (raw) {
        var m = migrate(JSON.parse(raw));
        if (!m) throw new Error("Datenformat ungültig");
        _db = m;
        return _db;
      }
    } catch (e) {
      // Beschädigte Daten nicht verwerfen, sondern die erste Rettungskopie sichern
      console.warn("Daten beschädigt – starte mit leerer Datenbank:", e);
      try { if (raw && !w.localStorage.getItem(KEY + ".backup")) w.localStorage.setItem(KEY + ".backup", raw); } catch (_) {}
    }
    _db = fresh();
    save();
    return _db;
  }

  var _onSave = null;
  function onSave(cb) { _onSave = cb; }
  function save() {
    var ok = true;
    try { w.localStorage.setItem(KEY, JSON.stringify(_db)); }
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
    // aktuellen Stand vor dem Löschen sichern
    try { w.localStorage.setItem(KEY + ".prev", JSON.stringify(_db)); } catch (_) {}
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
    // aktuellen Stand vor dem Überschreiben sichern
    try { w.localStorage.setItem(KEY + ".prev", JSON.stringify(_db)); } catch (_) {}
    _db = migrated;
    save();
    return _db;
  }

  w.Preisschmiede = w.Preisschmiede || {};
  w.Preisschmiede.Store = {
    load: load, save: save, reset: reset, onSave: onSave,
    exportJSON: exportJSON, importJSON: importJSON,
    uid: uid, nowISO: nowISO,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };
})(window);
