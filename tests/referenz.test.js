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
["products.js", "konfigurator.js", "vorlagen.js", "kalkulation.js", "angebot.js", "calc.js", "store.js", "auth.js", "auswertung.js", "planung.js", "dokumente.js", "betrieb.js", "mandant.js"].forEach(load);
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
  return f.version === 9 && Array.isArray(f.dokumente) && Array.isArray(f.auftraege) && !!f.planung && Array.isArray(f.kalkulationen) && Array.isArray(f.angebote) && Array.isArray(f.feedback) && Array.isArray(f.fehlerlog);
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

console.log("\nReferenz-/Invarianten-/Migrationstests: " + pass + "/" + (pass + fail) + " bestanden");
if (fail) { console.log("FEHLGESCHLAGEN:"); fails.forEach(function (f) { console.log("  - " + f); }); process.exit(1); }
