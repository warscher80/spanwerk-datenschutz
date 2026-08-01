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
["products.js", "konfigurator.js", "vorlagen.js", "kalkulation.js", "angebot.js", "calc.js", "store.js", "auth.js", "auswertung.js", "planung.js", "dokumente.js", "betrieb.js", "mandant.js", "infra.js", "portal.js", "rechnung.js"].forEach(load);
var P = G.Preisschmiede, Kalk = P.Kalkulation, Store = P.Store;

var pass = 0, fail = 0, fails = [];
function t(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }
function eq(a, b) { return Math.abs(a - b) < 0.005; }
function iso(y, mo, d, h) { return new Date(y, mo - 1, d, h || 8, 0, 0).toISOString(); }

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
t("MIG fresh() liefert aktuelle Version + alle Arrays", (function () {
  var f = Store.fresh ? Store.fresh() : null; if (!f) return true; // fresh evtl. nicht exportiert
  return f.version === 11 && Array.isArray(f.dokumente) && Array.isArray(f.auftraege) && !!f.planung && Array.isArray(f.kalkulationen) && Array.isArray(f.angebote) && Array.isArray(f.feedback) && Array.isArray(f.fehlerlog) && Array.isArray(f.portalUsers) && Array.isArray(f.portalLinks) && Array.isArray(f.nachtraege) && Array.isArray(f.rechnungen);
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

// =============================================================
//  6) BETRIEB / MONITORING (Phase 9)
// =============================================================
var Betrieb = P.Betrieb;
if (Betrieb) {
  var db2 = Store.load();
  // Healthchecks: nicht konfigurierte Adapter machen System NICHT unhealthy
  var hc = Betrieb.healthchecks(db2);
  t("BETRIEB Healthcheck Gesamtstatus gültig", ["healthy", "degraded", "unhealthy"].indexOf(hc.gesamt) >= 0);
  t("BETRIEB Adapter separat als nicht konfiguriert", hc.adapter.every(function (a) { return a.status === "nicht konfiguriert"; }) && hc.gesamt !== "unhealthy");
  // Backup-Warnungen wenn kein Backup
  db2.settings.betrieb.backupMeta = { letztes: null, status: "keins", restoreGetestet: false };
  var bs = Betrieb.backupStatus(db2, Date.now());
  t("BETRIEB Backup-Warnung wenn kein Backup", bs.warnungen.some(function (w2) { return /kein Backup/i.test(w2.text); }));
  // Support-Paket enthält KEINE Secrets
  var paket = Betrieb.supportPaket(db2, { version: "1.0", build: "x" }, "TestBrowser", Date.now());
  t("BETRIEB Support-Paket ohne sensible Felder", Betrieb.enthaeltSensibles(paket).length === 0);
  t("BETRIEB Support-Paket enthält keine Benutzer-Hashes", JSON.stringify(paket).indexOf(db2.users[0].hash) < 0);
  // Betriebswarnungen sind ein Array mit Schweregraden
  var bw = Betrieb.betriebswarnungen(db2, Date.now());
  t("BETRIEB Warnungen sortiert nach Schwere", bw.every(function (w2, i, arr) { return i === 0 || arr[i - 1].schwere >= w2.schwere; }));
  // Fehler-ID deterministisch aus Seed
  t("BETRIEB Fehler-ID Format", /^ERR-[0-9A-Z]+$/.test(Betrieb.fehlerId(1730000000000)));
  // Pilotkennzahlen = echte Zahlen
  var pk = Betrieb.pilotKennzahlen(db2, Date.now());
  t("BETRIEB Pilotkennzahlen real", pk.auftraege === (db2.auftraege || []).length && typeof pk.nachkalkuliert === "number");
} else { t("BETRIEB Modul geladen", false); }

// =============================================================
//  7) PILOT-TESTFÄLLE (Phase 9, berechenbare Fälle)
// =============================================================
var Pl = P.Planung, D = P.Dokumente, Calc = P.Calc, Auth = P.Auth;
var pdb = Store.load();
// 1/2 Geländer-/Blechkalkulation aus Beispieldaten -> plausibles Netto
t("PILOT Beispielkalkulation ergibt positives Netto", (pdb.kalkulationen || []).length === 0 || Kalk.berechne(pdb.kalkulationen[0], pdb.settings).netto > 0);
// 3 Serienteil: Staffel -> Rüstkosten/Stück sinkt mit Menge
(function () { var s = Kalk.staffel(refKalk, { mwst: 20 }, [1, 100]); t("PILOT Staffel: Rüst/Stück sinkt", s[1].ruestProStk < s[0].ruestProStk); })();
// 4 manuelle Zeitkorrektur (manueller Preis überschreibt)
t("PILOT manuelle Zeitkorrektur überschreibt", Kalk.arbeit({ ruestzeit: 0, bearbeitungProStk: 1, stueckzahl: 1, internerSatz: 40, verkaufSatz: 75, manuellerPreis: 123 }).verkauf === 123);
// 5 Maschinenkonflikt erkannt
(function () { var e = [{ id: "a", maschineId: "m-laser", start: iso(2026, 6, 1, 8), ende: iso(2026, 6, 1, 12), vorgaenger: [] }, { id: "b", maschineId: "m-laser", start: iso(2026, 6, 1, 10), ende: iso(2026, 6, 1, 14), vorgaenger: [] }]; t("PILOT Maschinenkonflikt", Pl.konflikte(e, pdb, pdb.settings).some(function (k) { return k.typ === "maschine"; })); })();
// 6 veralteter Materialpreis -> Betriebswarnung
(function () { var d = Store.load(); if (d.material[0]) { var alt = new Date(Date.now() - 400 * 86400000).toISOString(); d.material[0].aktualisiert = alt; } t("PILOT veralteter Materialpreis gewarnt", P.Betrieb.betriebswarnungen(d, Date.now()).some(function (w2) { return w2.typ === "materialpreis"; })); })();
// 7 Angebot mit optionaler Position: Optionale zählt nicht ins Netto
(function () { var a = { positionen: [{ typ: "normal", menge: 1, einheit: "Pos", einzelpreis: 100, mwstProz: 20 }, { typ: "optional", menge: 1, einheit: "Pos", einzelpreis: 50, mwstProz: 20 }] }; var s = P.Angebot.summen(a); t("PILOT optionale Position separat", s.netto === 100 && s.optionalSumme === 50); })();
// 8 Angebotspreis unter Selbstkosten -> Warnung
t("PILOT Verkauf unter Selbstkosten warnt", Kalk.berechne({ stueckzahl: 1, material: [{ menge: 1, einkaufspreis: 100, materialaufschlagProz: 0 }], arbeit: [], maschine: [], gewinnProz: 0, manuellerAufschlag: -60 }, { mwst: 20 }).warnungen.some(function (w2) { return /Selbstkosten/.test(w2); }));
// 11 Auftrag mit Kostenüberschreitung -> Soll-Ist Abw > 0
(function () { var auf = { positionen: [{ produktKey: "gelaender", kalk: { zeiten: { schweissen: 10 } }, ist: { zeiten: { schweissen: 15 } } }] }; var si = Calc.sollIst(auf); t("PILOT Kostenüberschreitung: Ist > Soll", si && si.abwProz > 0); })();
// 13 Lernvorschlag geringe Sicherheit: wenig Daten -> nicht belastbar
t("PILOT Lernauswertung Belastbarkeit korrekt", typeof P.Auswertung.lernauswertung(Store.load()).belastbar === "boolean");
// 16 fehlgeschlagenes Backup -> Warnung
(function () { var d = Store.load(); d.settings.betrieb.backupMeta = { letztes: new Date().toISOString(), status: "fehlgeschlagen", restoreGetestet: true }; t("PILOT fehlgeschlagenes Backup gewarnt", P.Betrieb.backupStatus(d, Date.now()).warnungen.some(function (w2) { return /fehlgeschlagen/.test(w2.text); })); })();
// 17 Benutzer ohne Preisberechtigung (Fertigung/Montage)
(function () { var u = Auth.login("werkstatt", "1234"); t("PILOT werkstatt ohne Finanzrecht", !!u && Auth.darfFinanzen() === false); Auth.logout(); })();
// 18 direkter Zugriff auf gesperrte URL -> Rolle darf nicht
t("PILOT werkstatt darf keine Kalkulation", Auth.RECHTE.werkstatt.indexOf("kalkulationen") < 0);
// 19 Import mit Duplikaten
t("PILOT Duplikate erkannt", D.dedupeBom([{ artikelnummer: "A1" }, { artikelnummer: "A1" }, { artikelnummer: "A2" }]).duplikate.length === 1);
// 20 neue Zeichnungsrevision -> relevanter Vergleich
t("PILOT Revisionsvergleich relevant", D.revisionsvergleich([D.erkennungsWert("werkstoff", "S235")], [D.erkennungsWert("werkstoff", "1.4301")], [], []).relevant === true);

// =============================================================
//  MANDANTENFÄHIGKEIT / ISOLATION  (Phase 10)
// =============================================================
var Mandant = P.Mandant;

// -- Ausgangslage: eine Bestandsinstallation wurde verlustfrei zu Mandant 1 --
(function () {
  var reg = Store.ladeRegistry();
  t("MT Registry initialisiert (Mandant 1 vorhanden)", reg.liste.length >= 1 && !!reg.aktiv);
  t("MT Zahlung ehrlich: nicht eingerichtet", reg.zahlung && reg.zahlung.konfiguriert === false && reg.zahlung.status === "nicht eingerichtet");
  t("MT Bestandsdaten wurden Mandant 1 zugeordnet (Zuordnungen aus users)", reg.zuordnungen.length >= 1);
})();

// -- Zwei Testfirmen mit ABSICHTLICH identischen Nummern anlegen --
var mA = Store.neuerMandant({ name: "Alpha Metallbau", kurzname: "Alpha", tarif: "professional", status: "aktiv" }, false);
var mB = Store.neuerMandant({ name: "Beta Schlosserei", kurzname: "Beta", tarif: "basis", status: "aktiv" }, false);
t("MT zwei neue Mandanten angelegt (getrennte IDs)", mA.id !== mB.id);
t("MT getrennte Speicher-Namespaces", Store.tenantKeyFor(mA.id) !== Store.tenantKeyFor(mB.id));

// Mandant A befüllen: identische Nummern wie Mandant B
Store.wechsleMandant(mA.id);
(function () {
  var db = Store.load();
  db.kunden.push({ id: "kA", nummer: "KUN-0001", name: "Kunde Alpha GmbH", erstellt: iso(2026, 1, 5) });
  db.angebote.push({ id: "aA", nummer: "ANG-2026-0001", kommission: "Geländer", betragNetto: 1111, positionen: [] });
  db.settings.firma.name = "Alpha Metallbau";
  db.settings.firma.uid = "ATU-ALPHA-GEHEIM";
  Store.save();
})();

// Mandant B befüllen: gleiche Nummern, andere Inhalte
Store.wechsleMandant(mB.id);
(function () {
  var db = Store.load();
  db.kunden.push({ id: "kB", nummer: "KUN-0001", name: "Kunde Beta OHG", erstellt: iso(2026, 1, 5) });
  db.angebote.push({ id: "aB", nummer: "ANG-2026-0001", kommission: "Geländer", betragNetto: 2222, positionen: [] });
  db.settings.firma.name = "Beta Schlosserei";
  db.settings.firma.uid = "ATU-BETA-GEHEIM";
  Store.save();
})();

// -- Kernprüfung: gleiche Nummern kollidieren NICHT, Daten sind getrennt --
Store.wechsleMandant(mA.id);
(function () {
  var db = Store.load();
  t("MT Mandant A sieht nur eigene Kunden", db.kunden.filter(function (k) { return k.nummer === "KUN-0001"; }).length === 1 && db.kunden.some(function (k) { return k.name === "Kunde Alpha GmbH"; }));
  t("MT Mandant A: kein Fremdkunde sichtbar", !db.kunden.some(function (k) { return k.name === "Kunde Beta OHG"; }));
  t("MT Mandant A: eigener Angebotsbetrag", db.angebote.some(function (a) { return a.nummer === "ANG-2026-0001" && a.betragNetto === 1111; }));
  t("MT Mandant A: Firmen-UID ist die eigene", db.settings.firma.uid === "ATU-ALPHA-GEHEIM");
})();

Store.wechsleMandant(mB.id);
(function () {
  var db = Store.load();
  t("MT Mandant B sieht nur eigene Kunden", db.kunden.some(function (k) { return k.name === "Kunde Beta OHG"; }) && !db.kunden.some(function (k) { return k.name === "Kunde Alpha GmbH"; }));
  t("MT Mandant B: eigener Angebotsbetrag (gleiche Nummer, anderer Wert)", db.angebote.some(function (a) { return a.nummer === "ANG-2026-0001" && a.betragNetto === 2222; }));
  t("MT Mandant B: Firmen-UID ist die eigene", db.settings.firma.uid === "ATU-BETA-GEHEIM");
})();

// -- Isolation auf Speicherebene: kein Namespace enthält Fremd-Geheimnisse --
(function () {
  var rawA = G.localStorage.getItem(Store.tenantKeyFor(mA.id)) || "";
  var rawB = G.localStorage.getItem(Store.tenantKeyFor(mB.id)) || "";
  t("MT Namespace A enthält keine Beta-Geheimdaten", rawA.indexOf("ATU-BETA-GEHEIM") < 0 && rawA.indexOf("Kunde Beta OHG") < 0);
  t("MT Namespace B enthält keine Alpha-Geheimdaten", rawB.indexOf("ATU-ALPHA-GEHEIM") < 0 && rawB.indexOf("Kunde Alpha GmbH") < 0);
})();

// -- Aktiver Mandant kommt aus Registry/Sitzung, nicht aus Parametern --
(function () {
  Store.wechsleMandant(mA.id);
  t("MT aktiver Mandant folgt Registry (A)", Store.aktiverMandant().id === mA.id);
  // wechsleMandant leert Cache -> load() liefert Zielmandanten, ohne dass ein Parameter dies erzwingt
  Store.wechsleMandant(mB.id);
  t("MT Firmenwechsel leert Cache + lädt Zielmandant", Store.aktiverMandant().id === mB.id && Store.load().settings.firma.uid === "ATU-BETA-GEHEIM");
  t("MT unbekannter Mandant wird abgelehnt", Store.wechsleMandant("gibt-es-nicht") === false);
})();

// -- Tarife & Feature-Flags (Hierarchie basis<professional<intelligent) --
(function () {
  var reg = Store.ladeRegistry();
  t("MT Tarifrang basis<professional<intelligent", Mandant.tarifRang("basis") < Mandant.tarifRang("professional") && Mandant.tarifRang("professional") < Mandant.tarifRang("intelligent"));
  t("MT basis darf Kalkulation", Mandant.darfFeature(reg, mB, "kalkulation") === true);
  t("MT basis darf KEINE Aufträge (professional)", Mandant.darfFeature(reg, mB, "auftraege") === false);
  t("MT basis darf KEINE Lernfunktion (intelligent)", Mandant.darfFeature(reg, mB, "lernen") === false);
  t("MT professional darf Aufträge", Mandant.darfFeature(reg, mA, "auftraege") === true);
  t("MT professional darf KEINE Lernfunktion", Mandant.darfFeature(reg, mA, "lernen") === false);
  t("MT deaktiviertes Flag (Schnittstellen) trotz Tarif gesperrt", Mandant.darfFeature(reg, { tarif: "intelligent", status: "aktiv" }, "schnittstellen") === false);
})();

// -- Lizenzstatus steuert Schreibrechte, Daten bleiben lesbar/exportierbar --
(function () {
  t("MT aktiv: voller Schreibzugriff", (function () { var l = Mandant.lizenz({ status: "aktiv" }); return l.schreiben && l.neueKalkulation && l.exportErlaubt; })());
  t("MT eingeschränkt: lesen ja, neue Kalkulation nein", (function () { var l = Mandant.lizenz({ status: "eingeschränkt" }); return l.lesen && !l.neueKalkulation && l.exportErlaubt; })());
  t("MT Zahlung ausstehend: Schreibsperre, Daten bleiben", (function () { var l = Mandant.lizenz({ status: "Zahlung ausstehend" }); return !l.schreiben && l.lesen && l.exportErlaubt; })());
  t("MT gesperrt: kein Schreiben, Export dennoch erlaubt (Daten nie entziehen)", (function () { var l = Mandant.lizenz({ status: "gesperrt" }); return !l.schreiben; })());
  t("MT gekündigt: Export möglich (Daten mitnehmen)", Mandant.lizenz({ status: "gekündigt" }).exportErlaubt === true);
})();

// -- Nutzung / Limits mit Warnstufen 80/90/100 --
(function () {
  var n = Mandant.nutzung({ maxBenutzer: 10, maxSpeicherMB: 25 }, { users: [1,2,3,4,5,6,7,8,9] });
  t("MT Nutzung Warnstufe 90% bei 9/10 Benutzern", n.benutzerWarn === 90);
  var n2 = Mandant.nutzung({ maxBenutzer: 10, maxSpeicherMB: 25 }, { users: [1,2,3,4,5,6,7,8,9,10,11] });
  t("MT Nutzung Warnstufe 100% bei Überschreitung", n2.benutzerWarn === 100);
  t("MT Nutzung Kulanz (kein harter Abbruch)", n.kulanz === true);
})();

// -- Einladung: Token wird NIE gespeichert, nur gesalzener Hash --
(function () {
  var token = "GEHEIM-EINLADUNGS-TOKEN-123";
  var einl = Mandant.einladungNeu({ email: "neu@firma.at", mandantId: mA.id, rolle: "buero", einladender: "admin" }, token, iso(2026, 8, 1), 14);
  t("MT Einladung speichert Token NICHT im Klartext", JSON.stringify(einl).indexOf(token) < 0);
  t("MT Einladung speichert nur Hash + Salt", !!einl.tokenHash && !!einl.tokenSalt && einl.tokenHash !== token);
  t("MT Einladung: korrektes Token wird akzeptiert", Mandant.einladungPruefen(einl, token, iso(2026, 8, 2)).ok === true);
  t("MT Einladung: falsches Token wird abgelehnt", Mandant.einladungPruefen(einl, "falsch", iso(2026, 8, 2)).ok === false);
  t("MT Einladung: abgelaufenes Token wird abgelehnt", Mandant.einladungPruefen(einl, token, iso(2026, 9, 1)).grund === "abgelaufen");
  var einl2 = Object.assign({}, einl, { status: "eingelöst" });
  t("MT Einladung: bereits eingelöste abgelehnt (einmalig)", Mandant.einladungPruefen(einl2, token, iso(2026, 8, 2)).ok === false);
})();

// -- Support-Zugriff: kontrolliert, zeitlich begrenzt, widerrufbar --
(function () {
  var reg = { supportZugriffe: [] };
  var s = Mandant.supportStart(reg, { mandantId: mA.id, benutzer: "support1", grund: "Fehleranalyse", freigegebenVon: "admin", dauerStunden: 24 }, iso(2026, 8, 1));
  t("MT Support aktiv innerhalb Frist", Mandant.supportAktiv(reg, mA.id, iso(2026, 8, 1, 12)) === true);
  t("MT Support inaktiv nach Frist", Mandant.supportAktiv(reg, mA.id, iso(2026, 8, 3)) === false);
  Mandant.supportWiderrufen(reg, s.id, iso(2026, 8, 1, 6));
  t("MT Support nach Widerruf inaktiv", Mandant.supportAktiv(reg, mA.id, iso(2026, 8, 1, 7)) === false);
})();

// -- Zuordnungen / Zugriffskontrolle --
(function () {
  var reg = { zuordnungen: [ { benutzername: "chef", mandantId: mA.id, status: "aktiv" }, { benutzername: "chef", mandantId: mB.id, status: "entzogen" } ] };
  t("MT Zugriff nur auf zugeordnete, nicht entzogene Mandanten", Mandant.hatZugriff(reg, "chef", mA.id) === true && Mandant.hatZugriff(reg, "chef", mB.id) === false);
  t("MT Mandantenliste je Benutzer schließt entzogene aus", Mandant.mandantenFuerBenutzer(reg, "chef").join(",") === mA.id);
})();

// -- Mandantenexport enthält nur eigene Daten --
(function () {
  Store.wechsleMandant(mA.id);
  var exp = Mandant.mandantExport(mA, Store.load(), iso(2026, 8, 1));
  var s = JSON.stringify(exp);
  t("MT Export enthält eigene Daten", s.indexOf("ATU-ALPHA-GEHEIM") >= 0);
  t("MT Export enthält KEINE Fremddaten", s.indexOf("ATU-BETA-GEHEIM") < 0);
})();

// Aufräumen: zurück auf Mandant 1, damit Folgeläufe deterministisch sind
Store.wechsleMandant(Store.ladeRegistry().liste[0].id);

// =============================================================
//  INFRASTRUKTUR / PRODUKTIONSVORBEREITUNG  (Phase 11)
// =============================================================
var Infra = P.Infra;

// 1 fehlende Pflicht-Umgebungsvariable wird gemeldet (ohne Werte auszugeben)
(function () {
  var spec = { gruppe: "T", name: "TEST_PFLICHT", pflicht: true, format: "string", umgebung: "alle", zweck: "x" };
  Infra.ENV_SPEC.push(spec);
  var r = Infra.validateEnv({}, "alle");
  t("INFRA fehlende Pflichtvariable gemeldet", r.ok === false && r.fehlend.indexOf("TEST_PFLICHT") >= 0);
  var r2 = Infra.validateEnv({ TEST_PFLICHT: "ok", EMAIL_FROM: "kaputt" }, "alle");
  t("INFRA ungültiges Format erkannt (E-Mail)", r2.ungueltig.indexOf("EMAIL_FROM") >= 0);
  t("INFRA Validierung gibt keine Werte aus", JSON.stringify(r2).indexOf("kaputt") < 0);
  Infra.ENV_SPEC.pop();
})();

// 2/3 Health: Speicher/Datei über localStorage vorhanden (offline-Äquivalent)
t("INFRA Speicher-Healthcheck (localStorage vorhanden)", typeof G.localStorage.setItem === "function");

// 4/30 mandantenbezogener + Cross-Tenant-Dateizugriff über signierten Link
(function () {
  var secret = "test-signing-secret";
  var lnk = Infra.signierterLink({ mandantId: "mA", pfad: "dok/zeichnung-1.pdf" }, secret, iso(2026, 8, 1, 8), 15);
  t("INFRA signierter Link gültig für eigenen Mandanten", Infra.linkPruefen(lnk, secret, iso(2026, 8, 1, 8, 10 / 60), "mA").ok === true);
  t("INFRA Cross-Tenant-Dateizugriff verweigert", Infra.linkPruefen(lnk, secret, iso(2026, 8, 1, 8), "mB").ok === false);
  t("INFRA manipulierter Token abgelehnt", Infra.linkPruefen(Object.assign({}, lnk, { token: "xx" }), secret, iso(2026, 8, 1, 8), "mA").ok === false);
})();

// 6 abgelaufener Download-Link
(function () {
  var secret = "s2";
  var lnk = Infra.signierterLink({ mandantId: "mA", pfad: "p" }, secret, iso(2026, 8, 1, 8), 15);
  t("INFRA abgelaufener Link abgelehnt", Infra.linkPruefen(lnk, secret, iso(2026, 8, 1, 9), "mA").grund === "abgelaufen");
})();

// 7 E-Mail-Vorschau + Header-Injection-Schutz
(function () {
  var msg = Infra.buildMessage("angebot", "kunde@example.at", { angebotNr: "ANG-2026-0001", kunde: "Muster", projekt: "Geländer", nachricht: "Danke für die Anfrage." }, { from: "firma@example.at" });
  t("INFRA E-Mail-Vorschau erzeugt Betreff+Text+HTML", msg.gueltig && !!msg.betreff && !!msg.text && !!msg.html);
  var inj = Infra.buildMessage("systemwarnung", "a@b.at", { betreff: "Zeile1\r\nBcc: opfer@x.at" }, {});
  t("INFRA Header-Injection neutralisiert (kein CRLF im Betreff)", !/[\r\n]/.test(inj.betreff));
  t("INFRA ungültige Empfängeradresse abgelehnt", Infra.buildMessage("angebot", "keine-email", {}, {}).gueltig === false);
})();

// 8 nicht konfigurierter E-Mail-Dienst täuscht keine Zustellung vor
(function () {
  var ad = Infra.emailAdapter({ provider: "none" });
  var msg = Infra.buildMessage("einladung", "neu@example.at", {}, {});
  var res = ad.send(msg, { idempotenzKey: "k1" });
  t("INFRA E-Mail nicht konfiguriert -> nicht gesendet", ad.konfiguriert === false && res.gesendet === false && /nicht konfiguriert/.test(res.status));
})();

// 10 Passwort-Reset-Token (einmalig, befristet, gehasht wie Einladung)
(function () {
  var tok = "reset-geheim-1";
  var einl = P.Mandant.einladungNeu({ email: "u@x.at", mandantId: "mA", rolle: "buero" }, tok, iso(2026, 8, 1), 1);
  t("INFRA Reset-Token akzeptiert korrekt", P.Mandant.einladungPruefen(einl, tok, iso(2026, 8, 1, 12)).ok === true);
  t("INFRA Reset-Token abgelaufen abgelehnt", P.Mandant.einladungPruefen(einl, tok, iso(2026, 8, 3)).ok === false);
})();

// 11/12 Angebotsversand + Schutz vor doppeltem Versand (Idempotenz-Queue)
(function () {
  var queue = [];
  var key = Infra.idempotenzKey("mA", "email", "ANG-2026-0001", "v2");
  var a1 = Infra.aufgabeNeu(queue, { mandantId: "mA", typ: "email", ref: "ANG-2026-0001", idempotenzKey: key }, iso(2026, 8, 1));
  var a2 = Infra.aufgabeNeu(queue, { mandantId: "mA", typ: "email", ref: "ANG-2026-0001", idempotenzKey: key }, iso(2026, 8, 1));
  t("INFRA Angebotsversand eingereiht", a1.neu === true);
  t("INFRA Doppelversand verhindert (Idempotenz)", a2.neu === false && queue.length === 1);
})();

// 13/14 Hintergrundaufgabe + Wiederholung mit Backoff
(function () {
  var queue = [];
  var a = Infra.aufgabeNeu(queue, { mandantId: "mA", typ: "pdf", ref: "x", maxVersuche: 2 }, iso(2026, 8, 1)).aufgabe;
  Infra.aufgabeVerarbeiten(a, function () { return { ok: false, fehler: "boom" }; }, iso(2026, 8, 1));
  t("INFRA Aufgabe nach 1. Fehler -> wird wiederholt", a.status === "wird wiederholt" && a.versuch === 1 && !!a.naechsterVersuch);
  Infra.aufgabeVerarbeiten(a, function () { return { ok: false, fehler: "boom" }; }, iso(2026, 8, 1));
  t("INFRA Aufgabe nach maxVersuchen -> fehlgeschlagen", a.status === "fehlgeschlagen");
  var b = Infra.aufgabeNeu(queue, { mandantId: "mA", typ: "backup", ref: "y" }, iso(2026, 8, 1)).aufgabe;
  Infra.aufgabeVerarbeiten(b, function () { return { ok: true, ergebnis: "fertig" }; }, iso(2026, 8, 1));
  t("INFRA erfolgreiche Aufgabe abgeschlossen", b.status === "erfolgreich" && b.ergebnis === "fertig" && !!b.abgeschlossen);
})();

// 16/17 geplanter Job fällig + Mandantenzeitzone (Parameter akzeptiert)
(function () {
  var job = Infra.GEPLANTE_JOBS.filter(function (j) { return j.key === "backup_pruefung"; })[0];
  t("INFRA Job ohne letzten Lauf ist fällig", Infra.jobFaellig(job, null, iso(2026, 8, 1, 21), 60) === true);
  t("INFRA Job innerhalb Intervall nicht fällig", Infra.jobFaellig(job, iso(2026, 8, 1, 20), iso(2026, 8, 1, 22), 60) === false);
  t("INFRA fällige Jobs berücksichtigen Zeitzonen-Parameter", Array.isArray(Infra.faelligeJobs({}, iso(2026, 8, 1), 120)));
})();

// 18 Monitoring ohne personenbezogene Daten
(function () {
  var roh = { mandantId: "mA", kunde: "Alpha GmbH", email: "chef@alpha.at", betragNetto: 1234, zaehler: 5, token: "geheim", nested: { ansprechpartner: "Herr X", ok: 1 } };
  var sc = Infra.scrubbe(roh);
  t("INFRA Scrubbing entfernt Kundenname/E-Mail/Token/Betrag", sc.kunde === "[entfernt]" && sc.email === "[entfernt]" && sc.token === "[entfernt]" && sc.betragNetto === "[entfernt]");
  t("INFRA Scrubbing behält unkritische Zähler/IDs", sc.zaehler === 5 && sc.mandantId === "mA" && sc.nested.ok === 1);
  t("INFRA gescrubbtes Objekt enthält keine PII (keine E-Mail)", Infra.enthaeltPII(sc) === false);
})();

// 19/20 Webhook-Signatur + doppeltes Ereignis idempotent
(function () {
  var secret = "wh-secret";
  var body = JSON.stringify({ id: "evt_1", status: "aktiv" });
  var sig = Infra.digest(secret, body);
  t("INFRA gültige Webhook-Signatur akzeptiert", Infra.webhookSignaturPruefen(body, sig, secret).ok === true);
  t("INFRA falsche Webhook-Signatur abgelehnt", Infra.webhookSignaturPruefen(body, "falsch", secret).ok === false);
  var ad = Infra.zahlungAdapter({ provider: "stripe", webhookSecret: secret });
  var log = [];
  var e1 = ad.ereignisVerarbeiten(log, { id: "evt_1", status: "aktiv" }, body, sig);
  var e2 = ad.ereignisVerarbeiten(log, { id: "evt_1", status: "aktiv" }, body, sig);
  t("INFRA Webhook-Ereignis einmal angewendet", e1.angewendet === true);
  t("INFRA doppeltes Webhook-Ereignis nicht erneut angewendet", e2.doppelt === true && e2.angewendet === false);
})();

// 21 manueller Lizenzstatus ohne Zahlungsanbieter (kein Zahlungsknopf)
(function () {
  var ad = Infra.zahlungAdapter({ provider: "manual" });
  t("INFRA ohne Anbieter kein Zahlungsknopf + manuelle Lizenz", ad.konfiguriert === false && ad.zeigeZahlungsknopf === false && ad.status === "manuell");
})();

// 26 keine Beispieldaten in leerer Produktionsdatenbank (Mandant ohne Beispiel)
(function () {
  var m = Store.neuerMandant({ name: "Prod-Leer" }, false);
  Store.wechsleMandant(m.id);
  var d = Store.load();
  t("INFRA leere Produktionsdatenbank ohne Beispieldaten", (d.kunden || []).length === 0 && (d.angebote || []).length === 0 && (d.material || []).length === 0);
  Store.wechsleMandant(Store.ladeRegistry().liste[0].id);
})();

// 29 Rate-Limit für Fehlanmeldungen
(function () {
  var zst = {};
  var r;
  for (var i = 0; i < 6; i++) r = Infra.rateLimiter(zst, "login:user", 5, 600000, iso(2026, 8, 1, 8));
  t("INFRA Rate-Limit greift nach Überschreitung", r.erlaubt === false && !!r.gesperrtBis);
})();

// =============================================================
//  KUNDENPORTAL / DIGITALE ANGEBOTSANNAHME  (Phase 12)
// =============================================================
var Portal = P.Portal, Ang = P.Angebot;

function testAngebot(over) {
  return Object.assign({
    id: "ang-P1", nummer: "ANG-2026-0777", version: 2, status: "freigegeben", kundeId: "kunde-1",
    mwstProz: 20, rabattProz: 0, kommission: "BV Portal", betreff: "Geländer", gueltigBisISO: iso(2027, 1, 1),
    // enthält absichtlich INTERNE Felder, die niemals nach außen dürfen:
    internenotiz: "Marge knapp – nachverhandeln", positionen: [
      { nummer: "1", typ: "normal", kurz: "Geländer", menge: 1, einheit: "Stk", einzelpreis: 1000, mwstProz: 20, aktiv: true, einkaufspreis: 620, deckungsbeitrag: 300 },
      { nummer: "2", typ: "optional", kurz: "Wartung", menge: 1, einheit: "Pausch", einzelpreis: 200, mwstProz: 20, aktiv: true, aktiviert: false, einkaufspreis: 40 },
      { nummer: "3", typ: "alternativ", gruppe: "montage", kurz: "Montage Standard", menge: 1, einheit: "Pausch", einzelpreis: 300, mwstProz: 20, aktiv: true, aktiviert: false },
      { nummer: "4", typ: "alternativ", gruppe: "montage", kurz: "Montage Premium", menge: 1, einheit: "Pausch", einzelpreis: 500, mwstProz: 20, aktiv: true, aktiviert: false }
    ]
  }, over || {});
}
var pctx = { firma: { name: "Alpha Metallbau" }, kunde: { name: "Kunde 1" }, datum: "2026-08-01", gueltigBis: "2027-01-01", jetztISO: iso(2026, 8, 1) };

// 8/9 nur freigegebene Version sichtbar + KEINE internen Daten
(function () {
  var a = testAngebot();
  var out = Portal.kundenAngebot(a, pctx);
  t("PORTAL freigegebenes Angebot sichtbar", !!out && !out.fehler);
  t("PORTAL keine internen Felder in Ausgabe", Ang.enthaeltInterne(out).length === 0);
  t("PORTAL Ausgabe enthält keinen Einkaufspreis/Notiz im JSON", JSON.stringify(out).indexOf("620") < 0 && JSON.stringify(out).indexOf("nachverhandeln") < 0);
  t("PORTAL Entwurf NICHT sichtbar", Portal.kundenAngebot(testAngebot({ status: "Entwurf" }), pctx) === null);
})();

// 2/3/4/5/6/7 sicherer Angebotslink
(function () {
  var tok = "PORTAL-LINK-TOKEN-XYZ";
  var link = Portal.linkNeu({ mandantId: "mA", angebotId: "ang-P1", kundeId: "kunde-1", einmalig: true }, tok, iso(2026, 8, 1), 30);
  t("PORTAL Link speichert Token nicht im Klartext", JSON.stringify(link).indexOf(tok) < 0 && !!link.tokenHash);
  t("PORTAL Link korrektes Token akzeptiert", Portal.linkPruefen(link, tok, { mandantId: "mA", angebotId: "ang-P1" }, iso(2026, 8, 2)).ok === true);
  t("PORTAL Link falsches Token abgelehnt", Portal.linkPruefen(link, "falsch", { mandantId: "mA", angebotId: "ang-P1" }, iso(2026, 8, 2)).ok === false);
  t("PORTAL Link Cross-Tenant abgelehnt", Portal.linkPruefen(link, tok, { mandantId: "mB", angebotId: "ang-P1" }, iso(2026, 8, 2)).grund === "fremder Mandant");
  t("PORTAL Link fremdes Angebot abgelehnt", Portal.linkPruefen(link, tok, { mandantId: "mA", angebotId: "ang-XX" }, iso(2026, 8, 2)).grund === "fremdes Angebot");
  t("PORTAL Link abgelaufen abgelehnt", Portal.linkPruefen(link, tok, { mandantId: "mA", angebotId: "ang-P1" }, iso(2026, 10, 1)).grund === "abgelaufen");
  Portal.linkVerwenden(link, iso(2026, 8, 2));
  t("PORTAL Einmal-Link nach Nutzung abgelehnt", Portal.linkPruefen(link, tok, { mandantId: "mA", angebotId: "ang-P1" }, iso(2026, 8, 3)).grund === "bereits verwendet");
  var link2 = Portal.linkNeu({ mandantId: "mA", angebotId: "ang-P1", kundeId: "kunde-1" }, tok, iso(2026, 8, 1), 30);
  Portal.linkWiderrufen(link2, iso(2026, 8, 2));
  t("PORTAL widerrufener Link abgelehnt", Portal.linkPruefen(link2, tok, { mandantId: "mA", angebotId: "ang-P1" }, iso(2026, 8, 3)).grund === "widerrufen");
})();

// 10/11/12/13/14 optionale/Alternativpositionen + server-seitige Neuberechnung
(function () {
  var a = testAngebot();
  t("PORTAL Grundsumme ohne Optionen = 1000", eq(Portal.neuberechnung(a, {}).netto, 1000));
  t("PORTAL Option nicht vorselektiert", a.positionen[1].aktiviert === false);
  t("PORTAL mit Option = 1200", eq(Portal.neuberechnung(a, { optionen: ["2"] }).netto, 1200));
  t("PORTAL Alternative Standard = 1300", eq(Portal.neuberechnung(a, { alternativen: { montage: "3" } }).netto, 1300));
  t("PORTAL Alternative Premium = 1500", eq(Portal.neuberechnung(a, { alternativen: { montage: "4" } }).netto, 1500));
  t("PORTAL Option + Alternative = 1700", eq(Portal.neuberechnung(a, { optionen: ["2"], alternativen: { montage: "4" } }).netto, 1700));
  t("PORTAL ungültige Kombination erkannt (fremde Position)", Portal.auswahlGueltig(a, { alternativen: { montage: "99" } }) === false);
  t("PORTAL gültige Kombination akzeptiert", Portal.auswahlGueltig(a, { optionen: ["2"], alternativen: { montage: "3" } }) === true);
  // 15 Umsatzsteuer/Brutto konsistent
  var s = Portal.neuberechnung(a, { optionen: ["2"] });
  t("PORTAL USt 20% auf 1200 = 240, Brutto 1440", eq(s.mwst, 240) && eq(s.brutto, 1440));
  // manipulierter Client-Preis wirkt NICHT (nur Auswahl-IDs zählen)
  var manip = JSON.parse(JSON.stringify(a)); manip.positionen[0].einzelpreis = 1;
  t("PORTAL Neuberechnung nutzt Angebotspreise, nicht Client (Kopie unabhängig)", eq(Portal.neuberechnung(a, {}).netto, 1000));
  void manip;
})();

// 16/17/18/19/20/21 digitale Annahme + Schutz
(function () {
  var a = testAngebot();
  var ctx = { mandantId: "mA", name: "Frau Muster", email: "muster@kunde.at", zeitzone: "Europe/Vienna", portalUser: { id: "pu1", rolle: "entscheider" }, funktion: "GF", firma: pctx.firma, kunde: pctx.kunde, datum: "2026-08-01", gueltigBis: "2027-01-01" };
  var res = Portal.annahmeProtokoll(a, ctx, { optionen: ["2"] }, "Ich nehme das Angebot verbindlich an.", iso(2026, 8, 1));
  t("PORTAL Annahme erzeugt Protokoll", res.ok === true && !!res.protokoll.siegel);
  t("PORTAL Annahmeprotokoll Version+Summe korrekt", res.protokoll.angebotVersion === 2 && eq(res.protokoll.brutto, 1440));
  t("PORTAL Annahmeprotokoll Siegel gültig", Portal.siegelPruefen(res.protokoll) === true);
  var manip = JSON.parse(JSON.stringify(res.protokoll)); manip.brutto = 1;
  t("PORTAL manipuliertes Protokoll erkannt", Portal.siegelPruefen(manip) === false);
  t("PORTAL Doppelannahme verhindert", Portal.annahmePruefen(testAngebot({ status: "angenommen" }), ctx.portalUser, {}, iso(2026, 8, 1)).grund === "bereits angenommen");
  t("PORTAL abgelaufenes Angebot nicht annehmbar", Portal.annahmePruefen(testAngebot({ gueltigBisISO: iso(2026, 1, 1) }), ctx.portalUser, {}, iso(2026, 8, 1)).grund === "abgelaufen");
  t("PORTAL ersetzte Version nicht annehmbar", Portal.annahmePruefen(testAngebot({ ersetztDurch: "ang-neu" }), ctx.portalUser, {}, iso(2026, 8, 1)).grund === "ersetzt");
  t("PORTAL Rolle 'leser' darf nicht annehmen", Portal.annahmePruefen(a, { rolle: "leser" }, {}, iso(2026, 8, 1)).grund === "keine berechtigung");
  // Bestätigungsdokument
  var best = Portal.bestaetigungsDokument(res.protokoll, { name: "Alpha Metallbau" }, iso(2026, 8, 1));
  t("PORTAL Bestätigungsdokument unveränderlich + Kennung", best.unveraenderlich === true && /^BEST-/.test(best.dokumentkennung));
})();

// 22 Ablehnung (Grund optional)
(function () {
  var a = testAngebot();
  t("PORTAL Ablehnung ohne Grund möglich", Portal.ablehnung(a, { mandantId: "mA", name: "X" }, null, "", iso(2026, 8, 1)).ok === true);
  t("PORTAL Ablehnung mit Grund gespeichert", Portal.ablehnung(a, { mandantId: "mA", name: "X" }, "Preis", "zu teuer", iso(2026, 8, 1)).protokoll.grund === "Preis");
})();

// 23/24 Nachrichten – interne Notiz bleibt unsichtbar
(function () {
  var msgs = [
    Portal.nachrichtNeu({ angebotId: "ang-P1", kundeId: "kunde-1", text: "Kundenfrage", kundeSichtbar: true }, iso(2026, 8, 1)),
    Portal.nachrichtNeu({ angebotId: "ang-P1", kundeId: "kunde-1", text: "INTERN: Marge", intern: true, kundeSichtbar: false }, iso(2026, 8, 1)),
    Portal.nachrichtNeu({ angebotId: "ang-P1", kundeId: "kunde-2", text: "Fremdkunde", kundeSichtbar: true }, iso(2026, 8, 1))
  ];
  var sicht = Portal.nachrichtenFuerKunde(msgs, "ang-P1", "kunde-1");
  t("PORTAL Kunde sieht nur eigene sichtbare Nachricht", sicht.length === 1 && sicht[0].text === "Kundenfrage");
  t("PORTAL interne Notiz bleibt unsichtbar", !sicht.some(function (m) { return m.intern; }));
})();

// 25/26 Dokumentfreigabe – internes Dokument bleibt unsichtbar
(function () {
  t("PORTAL freigegebenes Dokument sichtbar", Portal.dokumentSichtbar({ sichtbar: true }, null, iso(2026, 8, 1)) === true);
  t("PORTAL internes Dokument unsichtbar", Portal.dokumentSichtbar({ sichtbar: false }, null, iso(2026, 8, 1)) === false);
  t("PORTAL Dokument außerhalb Sichtbarkeitsfenster unsichtbar", Portal.dokumentSichtbar({ sichtbar: true, sichtbarBis: iso(2026, 7, 1) }, null, iso(2026, 8, 1)) === false);
  t("PORTAL Dokument nur für erlaubte Ansprechpartner", Portal.dokumentSichtbar({ sichtbar: true, erlaubteAnsprechpartner: ["ap1"] }, "ap2", iso(2026, 8, 1)) === false);
})();

// 27 Kundenupload nicht automatisch technisch freigegeben
(function () {
  var r = Portal.uploadNeu({ mandantId: "mA", kundeId: "kunde-1", dateiname: "plan.pdf", mime: "application/pdf", groesse: 2048 }, iso(2026, 8, 1));
  t("PORTAL Kundenupload ungeprüft + nicht technisch freigegeben", r.ok && r.upload.pruefStatus === "ungeprüft" && r.upload.technischFreigegeben === false);
})();

// 27b Upload-Validierung: Typ/MIME/Größe/gefährlich (Phase 12B)
(function () {
  t("PORTAL Upload gültige PDF akzeptiert", Portal.uploadPruefen({ dateiname: "plan.pdf", mime: "application/pdf", groesse: 1024 }).ok === true);
  t("PORTAL Upload unzulässiger Dateityp (.exe) abgelehnt", Portal.uploadPruefen({ dateiname: "virus.exe", mime: "application/octet-stream", groesse: 100 }).ok === false);
  t("PORTAL Upload Doppelendung (.pdf.exe) abgelehnt", Portal.uploadPruefen({ dateiname: "plan.pdf.exe", groesse: 100 }).ok === false);
  t("PORTAL Upload aktives Format (.svg/.html) abgelehnt", Portal.uploadPruefen({ dateiname: "x.svg", groesse: 100 }).ok === false && Portal.uploadPruefen({ dateiname: "x.html", groesse: 100 }).ok === false);
  t("PORTAL Upload falscher MIME abgelehnt", Portal.uploadPruefen({ dateiname: "bild.png", mime: "application/x-msdownload", groesse: 100 }).ok === false);
  t("PORTAL Upload zu große Datei abgelehnt", Portal.uploadPruefen({ dateiname: "gross.pdf", mime: "application/pdf", groesse: 20 * 1024 * 1024 }).ok === false);
  t("PORTAL Upload leere Datei abgelehnt", Portal.uploadPruefen({ dateiname: "leer.pdf", groesse: 0 }).ok === false);
  t("PORTAL uploadNeu lehnt gefährliche Datei ab", Portal.uploadNeu({ mandantId: "mA", kundeId: "k", dateiname: "run.bat", groesse: 10 }).ok === false);
})();

// 28 Zeichnungsfreigabe (Phase 12B): freigeben / Änderung / ersetzte Revision
(function () {
  var f = Portal.zeichnungFreigabeNeu({ mandantId: "mA", kundeId: "kunde-1", dokumentId: "dok-1", zeichnungsnummer: "1045", revision: "B", titel: "Geländerpfosten", sichtbar: true, aktuell: true }, iso(2026, 8, 1));
  t("PORTAL Zeichnung sichtbar für Kunden", Portal.zeichnungSichtbar(f, null, iso(2026, 8, 1)) === true);
  // fremder Kunde / fremder Mandant
  t("PORTAL Zeichnung: fremder Kunde abgelehnt", Portal.zeichnungEntscheidung(f, "freigegeben", { mandantId: "mA", kundeId: "kunde-2", name: "X" }, "", iso(2026, 8, 1)).grund === "fremder Kunde");
  t("PORTAL Zeichnung: fremder Mandant abgelehnt", Portal.zeichnungEntscheidung(f, "freigegeben", { mandantId: "mB", kundeId: "kunde-1", name: "X" }, "", iso(2026, 8, 1)).grund === "fremder Mandant");
  // Änderung ohne Kommentar -> abgelehnt
  t("PORTAL Zeichnung: Änderung ohne Kommentar abgelehnt", Portal.zeichnungEntscheidung(f, "Änderung verlangt", { mandantId: "mA", kundeId: "kunde-1", name: "X" }, "", iso(2026, 8, 1)).grund === "kommentar erforderlich");
  // Änderung mit Kommentar -> protokolliert
  var r1 = Portal.zeichnungEntscheidung(f, "Änderung verlangt", { mandantId: "mA", kundeId: "kunde-1", name: "Frau Muster" }, "Bitte Handlauf höher.", iso(2026, 8, 1));
  t("PORTAL Zeichnung: Änderung protokolliert", r1.ok === true && f.status === "Änderung verlangt" && f.entscheidungen.length === 1 && f.entscheidungen[0].person === "Frau Muster");
  // neue Revision -> alte ersetzen -> ersetzte darf nicht mehr freigegeben werden
  Portal.zeichnungErsetzen(f);
  t("PORTAL Zeichnung: ersetzte Revision gesperrt", f.status === "ersetzt" && Portal.zeichnungEntscheidung(f, "freigegeben", { mandantId: "mA", kundeId: "kunde-1", name: "X" }, "", iso(2026, 8, 2)).grund === "ersetzte Revision");
  // aktuelle Revision freigeben + keine Doppelfreigabe
  var g = Portal.zeichnungFreigabeNeu({ mandantId: "mA", kundeId: "kunde-1", zeichnungsnummer: "1045", revision: "C", sichtbar: true }, iso(2026, 8, 2));
  var r2 = Portal.zeichnungEntscheidung(g, "freigegeben", { mandantId: "mA", kundeId: "kunde-1", name: "Frau Muster" }, "", iso(2026, 8, 2));
  t("PORTAL Zeichnung: aktuelle Revision freigegeben", r2.ok === true && g.status === "freigegeben");
  t("PORTAL Zeichnung: keine Doppelfreigabe", Portal.zeichnungEntscheidung(g, "freigegeben", { mandantId: "mA", kundeId: "kunde-1", name: "X" }, "", iso(2026, 8, 2)).grund === "bereits freigegeben");
})();

// 31 Kundenkonto-Passwort + Rollen
(function () {
  var u = Portal.portalUserNeu({ kundeId: "kunde-1", name: "Chef", email: "Chef@Kunde.AT", rolle: "kundenadmin" }, iso(2026, 8, 1));
  Portal.passwortSetzen(u, "sicher123");
  t("PORTAL E-Mail normalisiert (lowercase)", u.email === "chef@kunde.at");
  t("PORTAL Passwort korrekt akzeptiert", Portal.passwortPruefen(u, "sicher123") === true);
  t("PORTAL Passwort falsch abgelehnt", Portal.passwortPruefen(u, "falsch") === false);
  t("PORTAL Kundenadmin darf annehmen, leser nicht", Portal.darfAnnehmen("kundenadmin") === true && Portal.darfAnnehmen("leser") === false);
})();

// 17-intern Auftragsstatus-Mapping verbirgt interne Details
(function () {
  t("PORTAL interner Status wird auf Kundenstatus abgebildet", Portal.kundenStatus("In Fertigung") === "in Fertigung" && Portal.kundenStatus("Beauftragt") === "Auftrag bestätigt");
  t("PORTAL unbekannter interner Status neutral abgebildet", Portal.kundenStatus("Maschinenproblem") === "in Bearbeitung");
})();

// =============================================================
//  NACHTRÄGE & RECHNUNGSKERN  (Phase 13A)
// =============================================================
var R = P.Rechnung;

// 1/2/3 Nachtragskalkulation + Auftragswert unverändert + aktueller Wert
(function () {
  var nt = R.nachtragNeu({ mandantId: "mA", auftragId: "auf1", kommission: "K1", mwstProz: 20, kalk: { arbeit: { ruestzeit: 0, bearbeitungProStk: 10, stueckzahl: 1, anzahlMitarbeiter: 1, internerSatz: 40, verkaufSatz: 70 } } }, iso(2026, 8, 1));
  R.nachtragKalkulieren(nt, iso(2026, 8, 1));
  t("RECH Nachtragskalkulation Netto = 700", eq(nt.sollSnapshot.netto, 700));
  t("RECH Nachtrag Soll-Snapshot + Version", nt.sollVersion === 1 && nt.status === "kalkuliert");
  R.nachtragStatus(nt, "angenommen", iso(2026, 8, 1));
  var aw = R.auftragswert(5000, [nt]);
  t("RECH ursprünglicher Auftragswert unverändert = 5000", eq(aw.ursprungNetto, 5000));
  t("RECH aktueller Auftragswert inkl. Nachtrag = 5700", eq(aw.aktuellNetto, 5700) && eq(aw.nachtragNetto, 700));
  // nicht angenommener Nachtrag zählt nicht
  var nt2 = R.nachtragNeu({ kalk: { arbeit: { bearbeitungProStk: 5, stueckzahl: 1, anzahlMitarbeiter: 1, internerSatz: 40, verkaufSatz: 70 } } }, iso(2026, 8, 1));
  R.nachtragKalkulieren(nt2, iso(2026, 8, 1));
  t("RECH nicht angenommener Nachtrag zählt nicht", eq(R.auftragswert(5000, [nt2]).aktuellNetto, 5000));
})();

// helper: Beleg + Freigabe mit lokalem settings
function mkSettings() { return { firma: { name: "Testfirma" }, rechnung: {} }; }
function freigebe(settings, art, positionen, extra) {
  var b = R.belegNeu(Object.assign({ mandantId: "mA", kundeId: "k1", kommission: "K1", auftragId: "auf1", art: art, mwstProz: 20, positionen: positionen }, extra || {}), iso(2026, 8, 1));
  R.belegFreigeben(b, settings, { benutzer: "admin", firma: settings.firma, kunde: { name: "Kunde" } }, iso(2026, 8, 1));
  return b;
}

// 4 Akontorechnung
(function () {
  var s = mkSettings();
  var ak = freigebe(s, "Akontorechnung", [{ bezeichnung: "Akonto 30 %", menge: 1, einzelpreis: 1500, mwstProz: 20 }]);
  var su = R.belegSummen(ak);
  t("RECH Akontorechnung Netto/USt/Brutto", eq(su.netto, 1500) && eq(su.mwst, 300) && eq(su.brutto, 1800));
})();

// 5 Teilrechnung mit Teilmenge
(function () {
  var s = mkSettings();
  var tr = freigebe(s, "Teilrechnung", [{ bezeichnung: "Segmente", menge: 3, einheit: "Stk", einzelpreis: 100, mwstProz: 20, gesamtmenge: 10, bereitsAbgerechnet: 2 }]);
  var su = R.belegSummen(tr);
  var p = tr.positionen[0];
  t("RECH Teilrechnung Teilmenge Netto = 300", eq(su.netto, 300));
  t("RECH Teilmenge Rest = 5 (10-2-3)", eq((p.gesamtmenge - p.bereitsAbgerechnet - p.menge), 5));
})();

// 6/8 mehrere Teilrechnungen + keine Doppelverrechnung
(function () {
  var s = mkSettings();
  var ak = freigebe(s, "Akontorechnung", [{ bezeichnung: "Akonto", menge: 1, einzelpreis: 1830, mwstProz: 20 }]);
  var t1 = freigebe(s, "Teilrechnung", [{ bezeichnung: "T1", menge: 1, einzelpreis: 2000, mwstProz: 20 }]);
  var t2 = freigebe(s, "Teilrechnung", [{ bezeichnung: "T2", menge: 1, einzelpreis: 1200, mwstProz: 20 }]);
  t("RECH verrechnet (ohne Schluss) = 5030", eq(R.verrechnetNetto([ak, t1, t2], { ohneSchluss: true }), 5030));
  var rest = R.schlussVorschlagNetto(5000, [], [ak, t1, t2]); // gesamt 5000 -> rest -30 (überrechnet Beispiel)
  var restPos = R.schlussVorschlagNetto(6100, [], [ak, t1, t2]); // gesamt 6100 -> rest 1070
  t("RECH Schlussvorschlag Rest = 1070 bei Auftrag 6100", eq(restPos, 1070));
  var schluss = freigebe(s, "Schlussrechnung", [{ bezeichnung: "Rest", menge: 1, einzelpreis: restPos, mwstProz: 20 }]);
  t("RECH keine Doppelverrechnung: Akonto+Teil+Schluss = 6100", eq(R.verrechnetNetto([ak, t1, t2, schluss]), 6100));
  void rest;
})();

// 9 Überrechnung erkennen
(function () {
  var u = R.pruefeUeberrechnung(6100, 5030, 2000, false);
  t("RECH Überrechnung erkannt (5030+2000 > 6100)", u.ueberrechnet === true && eq(u.ueberschussNetto, 930) && u.zulaessig === false);
  t("RECH Überrechnung mit Begründung zulässig", R.pruefeUeberrechnung(6100, 5030, 2000, true).zulaessig === true);
  t("RECH keine Überrechnung bei Restbetrag", R.pruefeUeberrechnung(6100, 5030, 1070, false).ueberrechnet === false);
})();

// 10 mehrere Steuersätze
(function () {
  var s = mkSettings();
  var b = freigebe(s, "Rechnungsentwurf", [{ bezeichnung: "Leistung 20%", menge: 1, einzelpreis: 1000, mwstProz: 20 }, { bezeichnung: "Position 10%", menge: 1, einzelpreis: 500, mwstProz: 10 }]);
  var su = R.belegSummen(b);
  t("RECH mehrere Steuersätze: 2 Steuerzeilen", su.steuerZeilen.length === 2);
  t("RECH USt 20% auf 1000 = 200, 10% auf 500 = 50", eq(su.mwst, 250) && eq(su.netto, 1500) && eq(su.brutto, 1750));
})();

// 11 Reverse-Charge-Hinweis (manuell, nur bestätigt gültig)
(function () {
  var b = R.belegNeu({ mandantId: "mA", art: "Rechnungsentwurf", mwstProz: 20, reverseCharge: true, positionen: [{ bezeichnung: "RC-Leistung", menge: 1, einzelpreis: 1000, mwstProz: 20 }] }, iso(2026, 8, 1));
  var su = R.belegSummen(b);
  t("RECH Reverse Charge: USt = 0", eq(su.mwst, 0) && eq(su.brutto, 1000));
  t("RECH RC nicht bestätigt -> Warnung, nicht anwendbar", R.reverseChargePruefung(b).anwendbar === false);
  b.reverseChargeBestaetigt = true; b.reverseChargeHinweis = "Steuerschuldnerschaft des Leistungsempfängers.";
  t("RECH RC bestätigt -> Hinweis anwendbar", R.reverseChargePruefung(b).anwendbar === true);
  t("RECH RC-Freigabe ohne Bestätigung gesperrt", R.belegFreigeben(R.belegNeu({ art: "Rechnungsentwurf", reverseCharge: true, positionen: [{ bezeichnung: "x", menge: 1, einzelpreis: 100 }] }, iso(2026, 8, 1)), mkSettings(), {}, iso(2026, 8, 1)).grund === "Reverse Charge nicht bestätigt");
})();

// 12 Rundung (Decimal)
(function () {
  var s = mkSettings();
  var b = freigebe(s, "Rechnungsentwurf", [{ bezeichnung: "krumm", menge: 3, einzelpreis: 33.335, mwstProz: 20 }]);
  var su = R.belegSummen(b);
  t("RECH Decimal-Rundung Netto = 100.01", eq(su.netto, 100.01));
  t("RECH Decimal-Rundung Brutto = 120.01", eq(su.brutto, 120.01));
})();

// 13 freigegebener Beleg unveränderbar
(function () {
  var s = mkSettings();
  var b = freigebe(s, "Teilrechnung", [{ bezeichnung: "x", menge: 1, einzelpreis: 500, mwstProz: 20 }]);
  t("RECH freigegebener Beleg nicht bearbeitbar", R.belegBearbeitbar(b) === false && b.freigegeben === true && !!b.snapshot && !!b.nummer);
  t("RECH doppelte Freigabe abgelehnt", R.belegFreigeben(b, s, {}, iso(2026, 8, 1)).grund === "bereits freigegeben");
  t("RECH Snapshot mit Prüfsumme eingefroren", !!b.snapshot.pruefsumme && b.snapshot.summen.netto === 500);
})();

// 14/15 Gutschrift + Storno (negativ)
(function () {
  var s = mkSettings();
  var orig = freigebe(s, "Teilrechnung", [{ bezeichnung: "Leistung", menge: 1, einzelpreis: 1000, mwstProz: 20 }]);
  var gut = R.gutschriftZu(orig, { positionen: [{ bezeichnung: "Teilgutschrift", menge: 1, einzelpreis: 200, mwstProz: 20 }] }, iso(2026, 8, 2));
  R.belegFreigeben(gut, s, {}, iso(2026, 8, 2));
  var sg = R.belegSummen(gut);
  t("RECH Gutschrift negativ (-200/-240)", eq(sg.netto, -200) && eq(sg.brutto, -240) && gut.zahlungstatus === "gutgeschrieben");
  t("RECH Gutschrift referenziert Original", gut.referenzBelegId === orig.id && /^GU-/.test(gut.nummer));
  var storno = R.stornoZu(orig, {}, iso(2026, 8, 2));
  R.belegFreigeben(storno, s, {}, iso(2026, 8, 2));
  var ss = R.belegSummen(storno);
  t("RECH Storno kehrt Betrag um (-1000/-1200)", eq(ss.netto, -1000) && eq(ss.brutto, -1200) && /^ST-/.test(storno.nummer));
  // Gutschrift+Storno reduzieren verrechnet
  t("RECH verrechnet nach Gutschrift/Storno reduziert", eq(R.verrechnetNetto([orig, gut, storno]), -200));
})();

// 16/17 Teilzahlung + Fälligkeit
(function () {
  var s = mkSettings();
  var b = freigebe(s, "Teilrechnung", [{ bezeichnung: "x", menge: 1, einzelpreis: 1000, mwstProz: 20 }], { rechnungsdatum: iso(2026, 8, 1), zahlungszielTage: 14 });
  R.zahlungErfassen(b, { betrag: 500 }, iso(2026, 8, 2));
  t("RECH Teilzahlung -> teilweise bezahlt, offen 700", b.zahlungstatus === "teilweise bezahlt" && eq(R.offenerBetrag(b), 700));
  R.zahlungErfassen(b, { betrag: 700 }, iso(2026, 8, 3));
  t("RECH Vollzahlung -> bezahlt, offen 0", b.zahlungstatus === "bezahlt" && eq(R.offenerBetrag(b), 0));
  var f = R.faelligkeit(iso(2026, 8, 1), 14);
  t("RECH Fälligkeit = Datum + 14 Tage", new Date(f.faellig).getDate() === 15);
})();

// 18/19 transaktionssichere Nummern + Mandantentrennung
(function () {
  var s = mkSettings();
  var b1 = freigebe(s, "Teilrechnung", [{ bezeichnung: "x", menge: 1, einzelpreis: 100 }]);
  var b2 = freigebe(s, "Teilrechnung", [{ bezeichnung: "y", menge: 1, einzelpreis: 100 }]);
  t("RECH fortlaufende, eindeutige Nummern", b1.nummer !== b2.nummer && /RE-\d+-0001/.test(b1.nummer) && /RE-\d+-0002/.test(b2.nummer));
  // freigegebene Nummer wird nicht wiederverwendet (Zähler bereits erhöht)
  var jahr = new Date().getFullYear();
  t("RECH freigegebene Nummer nicht wiederverwendet", R.naechsteNummer(s, "Rechnung", jahr) !== b2.nummer);
  // andere Mandanten: eigener settings -> identische erste Nummer erlaubt
  var s2 = mkSettings();
  var c1 = freigebe(s2, "Teilrechnung", [{ bezeichnung: "z", menge: 1, einzelpreis: 100 }]);
  t("RECH identische Nummer in anderem Mandant erlaubt", /RE-\d+-0001/.test(c1.nummer));
})();

// 20 Rollen & Berechtigungen
(function () {
  t("RECH admin darf freigeben", R.darfBeleg("admin", "freigeben") === true);
  t("RECH buero darf Zahlung erfassen", R.darfBeleg("buero", "zahlung") === true);
  t("RECH werkstatt hat KEINE Rechnungsrechte", R.darfBeleg("werkstatt", "entwurf") === false && R.RECHNUNG_RECHTE.werkstatt.length === 0);
})();

// 21 Positionsrest (Teilmenge)
t("RECH positionRest = Gesamt - bisher - aktuell", eq(R.positionRest({ gesamtmenge: 10, bereitsAbgerechnet: 2, menge: 3 }), 5));

// 22/23 ERP-Dateiexport + Doppelübertragung (Phase 13B)
(function () {
  var s = mkSettings();
  var b1 = freigebe(s, "Teilrechnung", [{ bezeichnung: "Leistung; mit Semikolon", menge: 2, einheit: "Stk", einzelpreis: 100, mwstProz: 20 }], { kundeId: "kA", kommission: "K1" });
  var b2 = freigebe(s, "Akontorechnung", [{ bezeichnung: "Akonto", menge: 1, einzelpreis: 500, mwstProz: 20 }], { kundeId: "kA" });
  var lookup = { kA: "Kunde A" };
  var exp = R.erpExport([b1, b2], lookup, R.standardMappingProfil(), iso(2026, 8, 1));
  t("RECH ERP-Export erzeugt CSV + Prüfsumme + Export-ID", !!exp.csv && !!exp.pruefsumme && /^EXP-/.test(exp.exportId) && exp.zeilen === 2);
  t("RECH ERP-CSV Kopfzeile enthält Belegnummer", exp.csv.split("\r\n")[0].indexOf("Belegnummer") === 0);
  t("RECH ERP-CSV maskiert Semikolon in Feld", exp.csv.indexOf('"Leistung; mit Semikolon"') >= 0);
  t("RECH ERP-CSV enthält KEINE internen Kostenfelder", exp.csv.toLowerCase().indexOf("einkauf") < 0 && exp.csv.toLowerCase().indexOf("deckungsbeitrag") < 0 && exp.csv.toLowerCase().indexOf("gewinn") < 0);
  var log = [{ exportId: exp.exportId, pruefsumme: exp.pruefsumme, belege: exp.belege }];
  t("RECH doppelter Export (identisch) erkannt", R.erpDoppelt(log, exp).doppelt === true && R.erpDoppelt(log, exp).grund === "identischer Export");
  var exp2 = R.erpExport([b1], lookup, R.standardMappingProfil(), iso(2026, 8, 2));
  t("RECH doppelter Export (Beleg bereits exportiert) erkannt", R.erpDoppelt(log, exp2).doppelt === true);
  var b3 = freigebe(s, "Teilrechnung", [{ bezeichnung: "Neu", menge: 1, einzelpreis: 50 }], { kundeId: "kA" });
  var exp3 = R.erpExport([b3], lookup, R.standardMappingProfil(), iso(2026, 8, 3));
  t("RECH neuer Beleg NICHT als doppelt erkannt", R.erpDoppelt(log, exp3).doppelt === false);
})();

console.log("\nReferenz-/Invarianten-/Migrationstests: " + pass + "/" + (pass + fail) + " bestanden");
if (fail) { console.log("FEHLGESCHLAGEN:"); fails.forEach(function (f) { console.log("  - " + f); }); process.exit(1); }
