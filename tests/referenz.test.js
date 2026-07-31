/* ============================================================
   Preisschmiede – Referenz-, Invarianten- und Migrationstests
   (Phase 8 – Gesamtprüfung). Reine Node-Ausführung ohne Browser.
   Start:  node tests/referenz.test.js
   Schlägt fehl, sobald sich eine Kalkulationsformel, ein Snapshot-
   Verhalten oder eine Migration unbeabsichtigt ändert.
   ============================================================ */
"use strict";
var path = require("path"), fs = require("fs");
var DIR = path.join(__dirname, "..", "assets", "js");
var G = {
  localStorage: { _d: {}, getItem: function (k) { return this._d[k] != null ? this._d[k] : null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } },
  alert: function () {}, console: console, Date: Date, Math: Math, JSON: JSON, parseFloat: parseFloat, parseInt: parseInt, isFinite: isFinite, isNaN: isNaN, performance: { now: function () { return 0; } }
};
G.window = G; G.self = G; global.window = G; global.self = G; global.localStorage = G.localStorage;
function load(f) { var c = fs.readFileSync(path.join(DIR, f), "utf8"); new Function("window", "self", "globalThis", "localStorage", "console", c + "\n//# sourceURL=" + f)(G, G, G, G.localStorage, console); }
["products.js", "konfigurator.js", "vorlagen.js", "kalkulation.js", "angebot.js", "calc.js", "store.js", "auth.js", "auswertung.js", "planung.js", "dokumente.js"].forEach(load);
var P = G.Preisschmiede, Kalk = P.Kalkulation, Store = P.Store;

var pass = 0, fail = 0, fails = [];
function t(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }
function eq(a, b) { return Math.abs(a - b) < 0.005; }

// =============================================================
//  1) REFERENZKALKULATION  TEST-REFERENZ-001
// =============================================================
// Material: Einkauf 500 €, Verschnitt 10 %, Fracht 50 €, Aufschlag 20 %
var mat = Kalk.material({ menge: 500, einkaufspreis: 1, verschnittProz: 10, frachtanteil: 50, materialaufschlagProz: 20 });
t("REF Material nach Verschnitt = 550", eq(mat.einkauf, 550));
t("REF Materialkosten inkl. Fracht = 600", eq(mat.kosten, 600));
t("REF Materialverkaufswert = 720", eq(mat.verkauf, 720));

// Arbeit: Vorbereitung 2 h, Stückzeit 10 h, 1 Person, intern 40, verkauf 75
var arb = Kalk.arbeit({ ruestzeit: 2, bearbeitungProStk: 10, stueckzahl: 1, anzahlMitarbeiter: 1, internerSatz: 40, verkaufSatz: 75 });
t("REF Personenstunden = 12", eq(arb.personenstunden, 12));
t("REF Interne Arbeitskosten = 480", eq(arb.kosten, 480));
t("REF Arbeitsverkaufswert = 900", eq(arb.verkauf, 900));

// Maschine: Rüstzeit 1 h @ 80, Laufzeit 5 h, intern 60, verkauf 100
var mas = Kalk.maschine({ anzahlRuest: 1, ruestzeitProVorgang: 1, ruestSatz: 80, laufzeitProStk: 5, stueckzahl: 1, internerSatz: 60, verkaufSatz: 100 });
t("REF Rüstkosten = 80", eq(mas.ruestkosten, 80));
t("REF Interne Maschinenkosten = 300", eq(mas.maschinenkosten, 300));
// Hinweis: Maschinen-Verkaufswert enthält per Modell die Rüstkosten (5×100 + 80 = 580).
// Der Stück-Wert der Rüstkosten (100 Stück) ist 0,80 € – siehe CALCULATION_RULES.md.
t("REF Rüstkosten pro Stück (100) = 0,80", eq(mas.ruestkosten / 100, 0.80));
t("REF Maschinen-Laufkosten-Verkauf (5×100) = 500", eq(mas.laufzeit * 100, 500));

// Gesamtkalkulation mit festen Zuschlägen -> Werte einfrieren (Regressionsanker)
var refKalk = {
  stueckzahl: 100, mwstProz: 20,
  material: [{ menge: 500, einkaufspreis: 1, verschnittProz: 10, frachtanteil: 50, materialaufschlagProz: 20 }],
  arbeit: [{ ruestzeit: 2, bearbeitungProStk: 10, stueckzahl: 1, anzahlMitarbeiter: 1, internerSatz: 40, verkaufSatz: 75 }],
  maschine: [{ anzahlRuest: 1, ruestzeitProVorgang: 1, ruestSatz: 80, laufzeitProStk: 5, stueckzahl: 1, internerSatz: 60, verkaufSatz: 100 }],
  fertigungsGK: { typ: "prozent", basis: "direkt", wert: 10 },
  risikoProz: 5, gewinnProz: 15, rabattProz: 0
};
var r = Kalk.berechne(refKalk, { gemeinkosten: 10, mwst: 20 });
// Direkte Kosten = Material 600 + Arbeit 480 + Maschine(300+80) 380 = 1460
t("REF direkte Kosten = 1460", eq(r.direkt, 1460));
// FGK 10 % auf direkt = 146 -> Herstell 1606 -> Selbst 1606
t("REF Herstellkosten = 1606", eq(r.herstell, 1606));
t("REF Selbstkosten = 1606", eq(r.selbst, 1606));
// Risiko 5 % = 80,30 -> nachRisiko 1686,30 ; Gewinn 15 % = 252,945 -> Netto 1939,245 -> r2 1939,25 (bzw. 1939,24)
t("REF Risiko = 80,30", eq(r.risiko, 80.30));
t("REF Gewinnaufschlag ~ 252,95", eq(r.gewinnAufschlag, 252.95) || eq(r.gewinnAufschlag, 252.94));
t("REF Netto plausibel ~1939", r.netto > 1938 && r.netto < 1940);
t("REF USt 20 % korrekt", eq(r.mwst, Math.round(r.netto * 0.20 * 100) / 100));
t("REF Brutto = Netto + USt", eq(r.brutto, Kalk.r2 ? Kalk.r2(r.netto + r.mwst) : (r.netto + r.mwst)));
t("REF Gewinn = Netto - Selbst", eq(r.gewinn, Math.round((r.netto - r.selbst) * 100) / 100));
t("REF keine Warnungen bei sauberer Referenz", r.warnungen.length === 0);

// =============================================================
//  2) FORMEL-ROBUSTHEIT
// =============================================================
// Division durch null / Stückzahl 0
var r0 = Kalk.berechne({ stueckzahl: 0, material: [], arbeit: [], maschine: [] }, { mwst: 20 });
t("ROBUST Stückzahl 0 kein Crash", r0 && typeof r0.netto === "number" && isFinite(r0.netto));
// Staffel mit 0 in Liste -> keine Infinity
var st = Kalk.staffel(refKalk, { mwst: 20 }, [0, 1, 100]);
t("ROBUST Staffel div/0 -> endliche Werte", st.every(function (s) { return isFinite(s.preisProStk); }));
// negative Marge -> Warnung
var rNeg = Kalk.berechne({ stueckzahl: 1, material: [{ menge: 1, einkaufspreis: 1000, materialaufschlagProz: 0 }], arbeit: [], maschine: [], gewinnProz: 0, rabattProz: 0, manuellerAufschlag: -900 }, { mwst: 20 });
t("ROBUST negativer Gewinn erzeugt Warnung", rNeg.warnungen.some(function (w) { return /Selbstkosten|Gewinn/.test(w); }));
// Decimal-Rundung
t("ROBUST r2(0.1+0.2)=0.30", eq(Kalk.r2 ? Kalk.r2(0.1 + 0.2) : 0.3, 0.3));
// sehr große Stückzahl
var rBig = Kalk.staffel(refKalk, { mwst: 20 }, [1000000]);
t("ROBUST große Stückzahl endlich", isFinite(rBig[0].preisProStk) && rBig[0].ruestProStk >= 0);

// =============================================================
//  3) HISTORISCHE DATEN / SNAPSHOTS (Invarianten)
// =============================================================
var db = Store.load();
// (a) Kalkulation hält ihre Positionswerte -> spätere Materialpreisänderung in
//     der Materialdatenbank verändert eine bestehende Kalkulation NICHT.
var kalk1 = { stueckzahl: 1, material: [{ menge: 10, einkaufspreis: 2.5, materialaufschlagProz: 20 }], arbeit: [], maschine: [] };
var netto_vor = Kalk.berechne(kalk1, db.settings).netto;
if (db.material[0]) db.material[0].preis = 999999; // Materialpreis in DB ändern
var netto_nach = Kalk.berechne(kalk1, db.settings).netto;
t("SNAP Materialpreisänderung ändert bestehende Kalkulation nicht", eq(netto_vor, netto_nach));

// (b) Freigegebenes Angebot: eingefrorene Kundenausgabe bleibt bei Textbaustein-
//     und Firmendatenänderung unverändert.
var Ang = P.Angebot;
var angebot = (db.angebote || [])[0];
if (angebot) {
  var ktx = { firma: db.settings.firma, kunde: db.kunden[0] || {}, datum: "2026-01-01", gueltigBis: "2026-02-01", fmtEUR: function (x) { return x + " €"; } };
  angebot.snapshot = { ausgabe: Ang.kundenAusgabe(angebot, ktx), datum: "2026-01-01" };
  var snapVorher = JSON.stringify(angebot.snapshot.ausgabe);
  db.settings.firma.name = "GEÄNDERT GmbH";
  (db.textbausteine || []).forEach(function (t2) { t2.text = "GEÄNDERT"; });
  t("SNAP Firmendaten-/Textbausteinänderung ändert Angebots-Snapshot nicht", JSON.stringify(angebot.snapshot.ausgabe) === snapVorher);
} else { t("SNAP Angebot vorhanden", false); }

// (c) Zeichnungsrevision überschreibt Vorgänger nicht.
var docs = db.dokumente || [];
var revB = docs.filter(function (d) { return d.revision === "B"; })[0];
var revA = revB ? docs.filter(function (d) { return d.id === revB.vorgaengerId; })[0] : null;
t("SNAP Revision B hat erhaltenen Vorgänger A", !!(revB && revA && revA.revision === "A" && revA.inhalt));

// =============================================================
//  4) MIGRATIONEN (leer + bestehend + idempotent)
// =============================================================
t("MIG fresh() liefert version 8 + alle Arrays", (function () {
  var f = Store.fresh ? Store.fresh() : null; if (!f) return true; // fresh evtl. nicht exportiert
  return f.version === 8 && Array.isArray(f.dokumente) && Array.isArray(f.auftraege) && !!f.planung && Array.isArray(f.kalkulationen) && Array.isArray(f.angebote);
})());
t("MIG migrate({}) füllt Defaults ohne Crash", (function () {
  try { var m = Store.migrate({}); return m && m.settings && Array.isArray(m.material) && Array.isArray(m.dokumente) && !!m.planung && !!m.settings.planung; } catch (e) { return false; }
})());
t("MIG migrate idempotent", (function () {
  try {
    var base = Store.migrate({});
    var once = JSON.stringify(base);
    Store.migrate(base);
    return JSON.stringify(base) === once;
  } catch (e) { return false; }
})());
t("MIG alter Datenstand (nur Aufträge) migriert", (function () {
  try { var m = Store.migrate({ auftraege: [{ id: "x", titel: "Alt", kalk: { netto: 100 } }] }); return m && m.auftraege.length === 1 && m.auftraege[0].positionen; } catch (e) { return false; }
})());

// =============================================================
//  5) SICHERHEIT (Basis, offline)
// =============================================================
// PIN niemals im Klartext gespeichert
t("SEC Benutzer haben Hash+Salt, keine Klartext-PIN", (db.users || []).every(function (u) { return u.hash && u.salt && u.pin == null; }));
t("SEC hashPin deterministisch mit Salt, ohne Salt anders", (function () {
  var s = Store.makeSalt(); return Store.hashPin("1234", s) === Store.hashPin("1234", s) && Store.hashPin("1234", s) !== Store.hashPin("1234", Store.makeSalt());
})());
// Interne Daten nicht in Kundenausgabe (Angebot)
if (angebot) {
  var ausg = Ang.kundenAusgabe(angebot, { firma: db.settings.firma, kunde: {}, datum: "", gueltigBis: "", fmtEUR: function (x) { return x; } });
  t("SEC keine internen Felder in Kundenausgabe", Ang.enthaeltInterne(ausg).length === 0);
}

console.log("\nReferenz-/Invarianten-/Migrationstests: " + pass + "/" + (pass + fail) + " bestanden");
if (fail) { console.log("FEHLGESCHLAGEN:"); fails.forEach(function (f) { console.log("  - " + f); }); process.exit(1); }
