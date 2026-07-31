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
    maschinen: [
      { id: "m-saege",    name: "Säge",            schritt: "zuschnitt",  stundensatz: 22, ruestzeitStd: 0.15, ruestkostensatz: 40, fixeRuestkosten: 2 },
      { id: "m-laser",    name: "Laser",           schritt: "lasern",     stundensatz: 95, ruestzeitStd: 0.30, ruestkostensatz: 60, fixeRuestkosten: 12 },
      { id: "m-abkant",   name: "Abkantpresse",    schritt: "biegen",     stundensatz: 70, ruestzeitStd: 0.25, ruestkostensatz: 55, fixeRuestkosten: 6 },
      { id: "m-bohr",     name: "Bohrmaschine",    schritt: "bohren",     stundensatz: 18, ruestzeitStd: 0.10, ruestkostensatz: 40, fixeRuestkosten: 1 },
      { id: "m-schweiss", name: "Schweißgerät",    schritt: "schweissen", stundensatz: 14, ruestzeitStd: 0.05, ruestkostensatz: 40, fixeRuestkosten: 1 },
      { id: "m-schleif",  name: "Schleifmaschine", schritt: "schleifen",  stundensatz: 10, ruestzeitStd: 0.05, ruestkostensatz: 40, fixeRuestkosten: 1 }
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
    toleranzen: { gruen: 5, gelb: 15 }
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
    { name: "Nico Warscher", gruppe: "projektleitung", stundensatz: 78, aktiv: true },
    { name: "CAD / Planung", gruppe: "cad", stundensatz: 65, aktiv: true },
    { name: "Werkstatt 1", gruppe: "fertigung", stundensatz: 58, aktiv: true },
    { name: "Monteur 1", gruppe: "montage", stundensatz: 62, aktiv: true }
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
    return {
      version: 4,
      settings: settings,
      kalkulationen: kalkulationen,
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
    // Maschinen: altes Feld ruestkosten (pauschal) -> fixeRuestkosten;
    // Rüstzeit/Rüstkostensatz als neue Felder ergänzen.
    st.maschinen.forEach(function (m) {
      if (!m) return;
      if (m.fixeRuestkosten == null) m.fixeRuestkosten = (typeof m.ruestkosten === "number" ? m.ruestkosten : 0);
      if (typeof m.ruestzeitStd !== "number") m.ruestzeitStd = 0;
      if (typeof m.ruestkostensatz !== "number") m.ruestkostensatz = (st.rates && st.rates.fertigung) || 40;
      if (typeof m.stundensatz !== "number") m.stundensatz = 0;
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
    hashPin: hashPin, makeSalt: makeSalt,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };
})(window);
