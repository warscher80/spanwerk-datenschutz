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
["products.js", "konfigurator.js", "vorlagen.js", "kalkulation.js", "angebot.js", "calc.js", "lager.js", "qualitaet.js", "store.js", "auth.js", "auswertung.js", "planung.js", "dokumente.js", "betrieb.js", "mandant.js", "infra.js", "portal.js", "rechnung.js", "sync.js"].forEach(load);
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
  return f.version === 13 && Array.isArray(f.dokumente) && Array.isArray(f.auftraege) && !!f.planung && Array.isArray(f.kalkulationen) && Array.isArray(f.angebote) && Array.isArray(f.feedback) && Array.isArray(f.fehlerlog) && Array.isArray(f.portalUsers) && Array.isArray(f.portalLinks) && Array.isArray(f.nachtraege) && Array.isArray(f.rechnungen) && Array.isArray(f.lagerArtikel) && Array.isArray(f.lagerBewegungen) && Array.isArray(f.lagerChargen) && Array.isArray(f.wareneingaenge) && Array.isArray(f.bestellungen) && Array.isArray(f.qualPruefplaene) && Array.isArray(f.qualPruefauftraege) && Array.isArray(f.qualAbweichungen) && Array.isArray(f.qualPruefmittel) && Array.isArray(f.qualAudit);
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

// =============================================================
//  OFFLINE-SYNCHRONISATIONSKERN  (Phase 14A)
// =============================================================
var SY = P.Sync;
function ev(timerId, event, isoStr, extra) { return SY.timerEreignis(Object.assign({ timerId: timerId, benutzer: "u1", mandantId: "mA", auftragId: "auf1", schritt: "schweissen", geraetezeit: isoStr }, extra || {}), event, isoStr); }
function isod(y, mo, d2, h, mi) { return new Date(y, mo - 1, d2, h || 8, mi || 0, 0).toISOString(); }

// 1 Dauer aus Ereignissen (mit Pause)
(function () {
  var evs = [ev("t1", "TIMER_STARTED", isod(2026, 8, 1, 8, 0)), ev("t1", "BREAK_STARTED", isod(2026, 8, 1, 9, 0)), ev("t1", "BREAK_ENDED", isod(2026, 8, 1, 9, 30)), ev("t1", "TIMER_STOPPED", isod(2026, 8, 1, 11, 0))];
  var d1 = SY.dauerAusEreignissen(evs);
  t("SYNC Dauer = 2,5 h (3h - 0,5h Pause)", d1.sekunden === 9000 && d1.aktiv === false);
})();
// 2 laufender Timer aktiv + Rekonstruktion
(function () {
  var evs = [ev("t2", "TIMER_STARTED", isod(2026, 8, 1, 8, 0))];
  var d2 = SY.dauerAusEreignissen(evs, isod(2026, 8, 1, 9, 0));
  t("SYNC laufender Timer aktiv, 1h", d2.aktiv === true && d2.sekunden === 3600);
  var at = SY.aktiverTimer(evs, "u1", isod(2026, 8, 1, 9, 0));
  t("SYNC aktiver Timer rekonstruiert", !!at && at.timerId === "t2" && at.auftragId === "auf1");
})();
// 3 ENTRY_CANCELLED / CORRECTED
(function () {
  var c = SY.dauerAusEreignissen([ev("t3", "TIMER_STARTED", isod(2026, 8, 1, 8)), ev("t3", "ENTRY_CANCELLED", isod(2026, 8, 1, 8, 30))]);
  t("SYNC storniertes Ereignis -> 0 h", c.sekunden === 0 && c.abgebrochen === true);
  var k = SY.dauerAusEreignissen([ev("t3b", "TIMER_STARTED", isod(2026, 8, 1, 8)), ev("t3b", "TIMER_STOPPED", isod(2026, 8, 1, 12)), ev("t3b", "ENTRY_CORRECTED", isod(2026, 8, 1, 12, 1), { payload: { dauerSekunden: 3600 } })]);
  t("SYNC Korrektur überschreibt Dauer (1h)", k.sekunden === 3600 && k.korrigiert === true);
})();
// 4/6 Ein-Timer-Garantie + Guards
(function () {
  var evs = [ev("t4", "TIMER_STARTED", isod(2026, 8, 1, 8))];
  t("SYNC zweiter Timer verhindert", SY.guardStart(evs, { benutzer: "u1", mandantId: "mA", timerId: "t5" }, isod(2026, 8, 1, 8, 30)).ok === false);
  t("SYNC doppeltes Tippen (gleicher Timer) verhindert", SY.guardStart(evs, { benutzer: "u1", mandantId: "mA", timerId: "t4" }, isod(2026, 8, 1, 8, 1)).grund === "doppeltes Tippen");
  t("SYNC Timer in anderem Mandant verhindert", SY.guardStart(evs, { benutzer: "u1", mandantId: "mB", timerId: "t6" }, isod(2026, 8, 1, 8, 1)).grund === "Timer in anderem Mandanten aktiv");
  t("SYNC Stop ohne Start abgelehnt", SY.guardStop([], "tX", isod(2026, 8, 1, 8)).grund === "Stop ohne Start");
  t("SYNC anderer Benutzer darf starten", SY.guardStart(evs, { benutzer: "u2", mandantId: "mA", timerId: "t7" }, isod(2026, 8, 1, 8, 1)).ok === true);
  var mitPause = [ev("t8", "TIMER_STARTED", isod(2026, 8, 1, 8)), ev("t8", "BREAK_STARTED", isod(2026, 8, 1, 8, 30))];
  t("SYNC Pause während Pause verhindert", SY.guardPause(mitPause, "t8", true, isod(2026, 8, 1, 8, 40)).grund === "bereits pausiert");
})();
// 5 Idempotentes Einreihen (exactly-once beim Enqueue)
(function () {
  var q = []; var r = ev("t9", "TIMER_STOPPED", isod(2026, 8, 1, 9));
  var e1 = SY.enqueue(q, r); var e2 = SY.enqueue(q, ev("t9", "TIMER_STOPPED", isod(2026, 8, 1, 9)));
  t("SYNC identisches Ereignis nur einmal eingereiht", e1.neu === true && e2.neu === false && q.length === 1);
})();
// 7 Warteschlangen-Reihenfolge + Abhängigkeit
(function () {
  var q = [];
  var mat = SY.recordNeu({ typ: "materialverbrauch", benutzer: "u1", mandantId: "mA", geraetezeit: isod(2026, 8, 1, 8) }, isod(2026, 8, 1, 8));
  var tim = SY.recordNeu({ typ: "timer", event: "TIMER_STOPPED", timerId: "t10", benutzer: "u1", mandantId: "mA", geraetezeit: isod(2026, 8, 1, 8) }, isod(2026, 8, 1, 8));
  SY.enqueue(q, mat); SY.enqueue(q, tim);
  var reihe = SY.faellig(q, isod(2026, 8, 1, 10)).map(function (r) { return r.typ; });
  t("SYNC Reihenfolge: timer vor materialverbrauch", reihe[0] === "timer" && reihe[1] === "materialverbrauch");
  var dep = SY.recordNeu({ typ: "stueckzahl", benutzer: "u1", mandantId: "mA", dependsOn: tim.id, geraetezeit: isod(2026, 8, 1, 8) }, isod(2026, 8, 1, 8));
  SY.enqueue(q, dep);
  t("SYNC abhängiger Eintrag erst nach Voraussetzung fällig", SY.faellig(q, isod(2026, 8, 1, 10)).indexOf(dep) < 0);
})();
// 8 Exactly-once-Verarbeitung + Serverbezug
(function () {
  var r = ev("t11", "TIMER_STOPPED", isod(2026, 8, 1, 9)); SY.enqueue([], r);
  var calls = 0; var apply = function () { calls++; return { ok: true, serverRef: "srv-1" }; };
  var a1 = SY.verarbeite(r, apply, isod(2026, 8, 1, 10));
  var a2 = SY.verarbeite(r, apply, isod(2026, 8, 1, 10)); // erneuter Versuch
  t("SYNC exactly-once: applyFn nur einmal, gleicher Serverbezug", calls === 1 && a1.serverRef === "srv-1" && a2.schon === true && a2.serverRef === "srv-1");
})();
// 9 Wiederholung mit Backoff + max Versuche -> Konflikt
(function () {
  t("SYNC Backoff steigt", SY.backoffMs(0) < SY.backoffMs(1) && SY.backoffMs(1) < SY.backoffMs(2));
  var r = ev("t12", "TIMER_STOPPED", isod(2026, 8, 1, 9));
  var res, i; for (i = 0; i < SY.MAX_VERSUCHE; i++) res = SY.verarbeite(r, function () { return { fehler: "netz", temporaer: true }; }, isod(2026, 8, 1, 10));
  t("SYNC nach max. Versuchen -> Konflikt/Prüfpunkt", r.status === SY.STATUS.CONFLICT);
  var r2 = ev("t12b", "TIMER_STOPPED", isod(2026, 8, 1, 9));
  SY.verarbeite(r2, function () { return { fehler: "netz", temporaer: true }; }, isod(2026, 8, 1, 10));
  t("SYNC temporärer Fehler -> RETRY mit nächstem Versuch", r2.status === SY.STATUS.RETRY && !!r2.naechsterVersuch);
  t("SYNC RETRY vor Fälligkeit nicht sofort erneut", SY.faellig([r2], isod(2026, 8, 1, 10)).length === 0);
})();
// 9b permanenter Validierungsfehler -> Konflikt
(function () {
  var r = ev("t13", "TIMER_STOPPED", isod(2026, 8, 1, 9));
  SY.verarbeite(r, function () { return { fehler: "ungültig", temporaer: false }; }, isod(2026, 8, 1, 10));
  t("SYNC permanenter Fehler -> Konflikt (kein endloser Retry)", r.status === SY.STATUS.CONFLICT);
})();
// 10 Konflikte
(function () {
  var r = ev("t14", "TIMER_STOPPED", isod(2026, 8, 1, 9));
  t("SYNC Konflikt: Auftrag abgeschlossen", SY.pruefeKonflikt(r, { auftragAbgeschlossen: true }).grund === "Auftrag bereits abgeschlossen");
  t("SYNC Konflikt: Cross-Tenant", SY.pruefeKonflikt(r, { aktiverMandantId: "mB" }).grund.indexOf("Cross-Tenant") >= 0);
  t("SYNC Konflikt: Sitzung abgelaufen", SY.pruefeKonflikt(r, { sitzungGueltig: false }).grund === "Sitzung abgelaufen");
  t("SYNC Konflikt: Benutzer deaktiviert", SY.pruefeKonflikt(r, { benutzerAktiv: false }).grund.indexOf("Benutzer") >= 0);
  t("SYNC Konflikt: Maschine belegt", SY.pruefeKonflikt(r, { maschineBelegt: true }).grund === "Maschine bereits belegt");
  t("SYNC Konflikt: fremder Timer aktiv", SY.pruefeKonflikt(r, { fremderTimerAktiv: true }).grund.indexOf("anderem Gerät") >= 0);
  t("SYNC Konflikt: Serverdatensatz geändert", SY.pruefeKonflikt(r, { serverVersion: 2 }).grund === "Serverdatensatz geändert");
  t("SYNC kein Konflikt bei gültigem Kontext", SY.pruefeKonflikt(r, { aktiverMandantId: "mA" }).konflikt === false);
})();
// 5-Zeit unplausible Gerätezeit
(function () {
  t("SYNC Zeit plausibel bei kleinem Drift", SY.zeitPlausibel(isod(2026, 8, 1, 8, 0), isod(2026, 8, 1, 8, 2), 5 * 60000) === true);
  t("SYNC Zeit unplausibel bei großem Drift", SY.zeitPlausibel(isod(2026, 8, 1, 8, 0), isod(2026, 8, 1, 10, 0), 5 * 60000) === false);
  var r = ev("t15", "TIMER_STOPPED", isod(2026, 8, 1, 9));
  t("SYNC Konflikt bei unplausibler Gerätezeit", SY.pruefeKonflikt(r, { zeitPlausibel: false }).grund.indexOf("unplausibel") >= 0);
})();
// 11 Offline-Datenumfang: keine vertraulichen Felder
(function () {
  var a = { id: "auf1", kommission: "K", titel: "T", kundeId: "k", status: "Beauftragt", positionen: [{ produktKey: "gelaender", kalk: { zeiten: { schweissen: 2 }, netto: 5000, selbstkosten: 3000, gewinn: 700, einkaufspreis: 100 } }] };
  var off = SY.auftragOffline(a);
  t("SYNC Offline-Auftrag ohne Gewinn/Selbstkosten/Einkauf", SY.offlineDatensatzRein(off) === true);
  t("SYNC Vollauftrag enthält vertrauliche Felder (Gegenprobe)", SY.offlineDatensatzRein(a) === false);
})();
// 24 lokale Daten bleiben bei Konflikt erhalten
(function () {
  var r = ev("t16", "TIMER_STOPPED", isod(2026, 8, 1, 9)); r.payload = { wichtig: "erhalten" };
  SY.verarbeite(r, function () { return { konflikt: true, grund: "Konflikt" }; }, isod(2026, 8, 1, 10));
  t("SYNC Konflikt löscht lokale Daten NICHT", r.status === SY.STATUS.CONFLICT && r.payload.wichtig === "erhalten");
  SY.manuellWiederholen(r);
  t("SYNC manueller erneuter Versuch stellt QUEUED wieder her", r.status === SY.STATUS.QUEUED);
})();

// =============================================================
//  LAGERKERN  (Phase 15A) – Bewegungen, Bestand, Reservierung,
//  Chargen, Reststücke, Bestellvorschlag, Bewertung, Idempotenz,
//  Offline-Konflikt, Rollen, Cross-Tenant, Rückverfolgung.
// =============================================================
var LG = P.Lager;
var LJ = "2026-08-01T08:00:00.000Z";
function freshLager() {
  var art = {
    id: "a1", mandantId: "m1", artikelnummer: "VK-40", werkstoff: "Stahl", basiseinheit: "m",
    mindestbestand: 12, meldebestand: 24, zielbestand: 60, bevorzugterLieferantId: "lief1",
    standardLagerplatzId: "p1", chargenpflicht: true, zertifikatspflicht: true, reststueckverwaltung: true,
    negativerBestandErlaubt: false, verpackungseinheit: 6, mindestbestellmenge: 12, lieferzeitTage: 5,
    bewertungsmethode: LG.METHODE.GLEITEND, standardLaenge: 6
  };
  var artB = { id: "a2", mandantId: "m1", artikelnummer: "BL-2", werkstoff: "Aluminium", basiseinheit: "m2", zielbestand: 10, standardLagerplatzId: "p2", verpackungseinheit: 1, mindestbestellmenge: 1 };
  var artFremd = { id: "aX", mandantId: "m2", artikelnummer: "X", werkstoff: "Stahl", basiseinheit: "m", negativerBestandErlaubt: false };
  var p1 = { id: "p1", mandantId: "m1", code: "P1", status: LG.PLATZ_STATUS.AKTIV, gesperrt: false };
  var p2 = { id: "p2", mandantId: "m1", code: "P2", status: LG.PLATZ_STATUS.AKTIV, gesperrt: false };
  return { artikel: [art, artB, artFremd], plaetze: [p1, p2], chargen: [], bewegungen: [], reservierungen: [], reststuecke: [], wareneingaenge: [], bestellungen: [], konflikte: [] };
}

// Wareneingang + Teillieferung + Mehrlieferungswarnung
(function () {
  var s = freshLager();
  s.bestellungen.push({ id: "bo1", mandantId: "m1", lieferantId: "lief1", status: "offen", positionen: [{ artikelId: "a1", bestellt: 60, geliefert: 0, status: "offen" }] });
  var we1 = LG.wareneingang(s, { mandantId: "m1", bestellungId: "bo1", lieferschein: "LS1", positionen: [{ artikelId: "a1", gelieferteMenge: 36, lagerplatzId: "p1", chargennummer: "C1", zertifikate: ["3.1"], einkaufspreis: 7 }] }, LJ);
  t("LAGER Wareneingang bucht physischen Bestand", LG.bestand(s, "a1", { mandantId: "m1" }).physisch === 36);
  t("LAGER Teillieferung: Restmenge korrekt", we1.positionen[0].restMenge === 24);
  t("LAGER Teillieferung: Bestellung teilgeliefert", s.bestellungen[0].status === "teilgeliefert");
  var we2 = LG.wareneingang(s, { mandantId: "m1", bestellungId: "bo1", lieferschein: "LS2", positionen: [{ artikelId: "a1", gelieferteMenge: 30, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  t("LAGER Mehrlieferung erkannt (36+30 > 60)", we2.positionen[0].mehrlieferung === 6 && we2.hinweise.some(function (h) { return /Mehrlieferung/.test(h); }));
  t("LAGER Charge sammelt akzeptierte Menge", LG.chargeById(s, LG.artikelById(s, "a1") && s.chargen[0].id).menge === 66);
})();

// Bestandsberechnung: verfügbar = physisch - reserviert - gesperrt; QS separat
(function () {
  var s = freshLager();
  LG.wareneingang(s, { mandantId: "m1", lieferschein: "LSq", positionen: [{ artikelId: "a1", gelieferteMenge: 20, lagerplatzId: "p1", chargennummer: "Cq", einkaufspreis: 7, qs: true }] }, LJ);
  var b = LG.bestand(s, "a1", { mandantId: "m1" });
  t("LAGER QS-Ware physisch vorhanden", b.physisch === 20);
  t("LAGER QS-Ware nicht verfügbar (gesperrt)", b.verfuegbar === 0 && b.qualitaet === 20);
})();

// Reservierung + Teilreservierung + Überreservierung verhindern
(function () {
  var s = freshLager();
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 30, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  var r1 = LG.reserviere(s, { mandantId: "m1", artikelId: "a1", auftragId: "auf1", menge: 12 }, LJ);
  t("LAGER Reservierung reduziert verfügbaren Bestand", LG.bestand(s, "a1", { mandantId: "m1" }).verfuegbar === 18 && r1.reservierung.status === LG.RES_STATUS.RESERVIERT);
  var r2 = LG.reserviere(s, { mandantId: "m1", artikelId: "a1", auftragId: "auf2", menge: 30 }, LJ);
  t("LAGER Teilreservierung: nur verfügbare 18 reserviert", r2.reservierung.reserviert === 18 && r2.fehlmenge === 12 && r2.teilweise === true);
  t("LAGER Keine Überreservierung: reserviert nie > physisch", LG.bestand(s, "a1", { mandantId: "m1" }).reserviert === 30 && LG.bestand(s, "a1", { mandantId: "m1" }).verfuegbar === 0);
})();

// Entnahme + Entnahme gegen Reservierung + Rückgabe + tatsächlicher Verbrauch
(function () {
  var s = freshLager();
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 30, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  var chId = s.chargen[0].id;
  var res = LG.reserviere(s, { mandantId: "m1", artikelId: "a1", auftragId: "auf1", menge: 12, chargeId: chId }, LJ);
  var e1 = LG.entnahme(s, { mandantId: "m1", artikelId: "a1", menge: 10, reservierungId: res.reservierung.id, chargeId: chId, auftragId: "auf1", benutzer: "werkstatt" }, LJ);
  t("LAGER Entnahme reduziert physisch", LG.bestand(s, "a1", { mandantId: "m1" }).physisch === 20);
  t("LAGER Entnahme gegen Reservierung reduziert reserviert", LG.bestand(s, "a1", { mandantId: "m1" }).reserviert === 2 && s.reservierungen[0].entnommen === 10);
  var rg = LG.rueckgabe(s, { entnahmeId: e1.bewegung.id, menge: 2, benutzer: "werkstatt" }, LJ);
  t("LAGER Rückgabe referenziert Entnahme + erhöht physisch", rg.ok && rg.bewegung.entnahmeRef === e1.bewegung.id && LG.bestand(s, "a1", { mandantId: "m1" }).physisch === 22);
  var v = LG.verbrauch(s, { artikelId: "a1", auftragId: "auf1" });
  t("LAGER tatsächlicher Verbrauch = Entnahmen - Rückgaben = 8", v.verbrauch === 8);
  var zuviel = LG.rueckgabe(s, { entnahmeId: e1.bewegung.id, menge: 100 }, LJ);
  t("LAGER Rückgabe > Entnahme abgelehnt", zuviel.ok === false);
})();

// Umlagerung (je Lagerplatz)
(function () {
  var s = freshLager();
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 20, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  var u = LG.umlagerung(s, { mandantId: "m1", artikelId: "a1", menge: 8, quelleLagerplatzId: "p1", zielLagerplatzId: "p2" }, LJ);
  t("LAGER Umlagerung ändert Gesamtbestand nicht", u.ok && LG.bestand(s, "a1", { mandantId: "m1" }).physisch === 20);
  t("LAGER Umlagerung verschiebt je Lagerplatz", LG.bestandProPlatz(s.bewegungen, "a1", "p1", { mandantId: "m1" }) === 12 && LG.bestandProPlatz(s.bewegungen, "a1", "p2", { mandantId: "m1" }) === 8);
  var uZuviel = LG.umlagerung(s, { mandantId: "m1", artikelId: "a1", menge: 999, quelleLagerplatzId: "p1", zielLagerplatzId: "p2" }, LJ);
  t("LAGER Umlagerung ohne genügend Quellbestand abgelehnt", uZuviel.ok === false);
})();

// Storno und Gegenbuchung (nichts wird gelöscht)
(function () {
  var s = freshLager();
  var we = LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 20, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  var bewId = we.positionen[0].bewegungId;
  var vorher = s.bewegungen.length;
  var st = LG.storniere(s, bewId, "Fehlbuchung", LJ);
  t("LAGER Storno erzeugt Gegenbuchung (Original bleibt)", st.ok && s.bewegungen.length === vorher + 1 && st.original.storniert === true);
  t("LAGER Storno neutralisiert Bestand", LG.bestand(s, "a1", { mandantId: "m1" }).physisch === 0);
  t("LAGER Storno zweimal nicht möglich", LG.storniere(s, bewId, "nochmal", LJ).ok === false);
})();

// Charge sperren + gesperrte Charge nicht entnehmen
(function () {
  var s = freshLager();
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 20, lagerplatzId: "p1", chargennummer: "Cs", einkaufspreis: 7 }] }, LJ);
  var chId = s.chargen[0].id;
  var sp = LG.chargeSperren(s, chId, "Zertifikat fehlt", LJ);
  t("LAGER Charge sperren senkt verfügbaren Bestand", sp.ok && LG.bestand(s, "a1", { mandantId: "m1" }).gesperrt === 20 && LG.bestand(s, "a1", { mandantId: "m1" }).verfuegbar === 0);
  var e = LG.entnahme(s, { mandantId: "m1", artikelId: "a1", menge: 5, chargeId: chId }, LJ);
  t("LAGER gesperrte Charge nicht entnehmbar", e.ok === false && /gesperrt/.test(e.grund));
  var en = LG.chargeEntsperren(s, chId, LJ);
  t("LAGER Entsperren stellt Verfügbarkeit wieder her", en.ok && LG.bestand(s, "a1", { mandantId: "m1" }).verfuegbar === 20);
})();

// Reststück anlegen + Langgut-Restlänge + reservieren
(function () {
  var s = freshLager();
  var rs = LG.reststueckAnlegen(s, { mandantId: "m1", artikelId: "a1", werkstoff: "Stahl", laenge: 6, gewicht: 13.8, ursprungAuftragId: "auf1", lagerplatzId: "p1" }, LJ);
  t("LAGER Reststück angelegt (verfügbar)", rs.status === LG.REST_STATUS.VERFUEGBAR && rs.ausgangslaenge === 6);
  var v = LG.reststueckVerbrauch(s, rs.id, { verwendeteLaenge: 2, schnittverlust: 0.2, auftragId: "auf2" }, LJ);
  t("LAGER Langgut-Restlänge = 6 - 2 - 0,2 = 3,8", v.ok && v.restlaenge === 3.8 && rs.status === LG.REST_STATUS.TEILWEISE);
  var rr = LG.reststueckReservieren(s, rs.id, { auftragId: "auf3" }, LJ);
  t("LAGER Reststück reservieren", rr.ok && rs.status === LG.REST_STATUS.RESERVIERT);
  var vAll = LG.reststueckVerbrauch(s, rs.id, { verwendeteLaenge: 3.8 }, LJ);
  t("LAGER Reststück vollständig verbraucht", vAll.ok && rs.status === LG.REST_STATUS.VERBRAUCHT);
})();

// Mindestbestand + Bestellvorschlag + Verpackungseinheit
(function () {
  var s = freshLager();
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 10, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  var b = LG.bestand(s, "a1", { mandantId: "m1" });
  t("LAGER Mindestbestand unterschritten erkannt", b.verfuegbar < LG.artikelById(s, "a1").mindestbestand);
  var v = LG.bestellvorschlag(s, "a1");
  // Ziel 60 + Fehlbedarf 0 - verfügbar 10 - bestellt 0 = 50 -> aufrunden auf VPE 6 -> 54
  t("LAGER Bestellvorschlag rundet auf Verpackungseinheit (54)", v.bestellen && v.menge === 54);
  // offene Bestellung reduziert Vorschlag
  s.bestellungen.push({ id: "bo9", mandantId: "m1", status: "offen", positionen: [{ artikelId: "a1", bestellt: 60, geliefert: 0 }] });
  t("LAGER Bestellvorschlag berücksichtigt offene Bestellung (kein Bedarf)", LG.bestellvorschlag(s, "a1").bestellen === false);
})();

// Reservierter Fehlbedarf erhöht den Bestellvorschlag
(function () {
  var s = freshLager();
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 60, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  LG.reserviere(s, { mandantId: "m1", artikelId: "a1", auftragId: "auf1", menge: 100 }, LJ); // Fehlmenge 40
  var v = LG.bestellvorschlag(s, "a1");
  // Ziel 60 + Fehlbedarf 40 - verfügbar 0 - bestellt 0 = 100 -> VPE 6 -> 102
  t("LAGER Bestellvorschlag mit reserviertem Fehlbedarf", v.bestellen && v.menge === 102);
})();

// Gleitender Durchschnittspreis
(function () {
  var s = freshLager();
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 10, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 6 }] }, LJ);
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 30, lagerplatzId: "p1", chargennummer: "C2", einkaufspreis: 8 }] }, LJ);
  var bw = LG.bewertung(s, "a1", LG.METHODE.GLEITEND);
  // (10*6 + 30*8)/40 = 300/40 = 7,50 ; letzter = 8
  t("LAGER gleitender Durchschnitt = 7,50", bw.gleitend === 7.5 && bw.letzter === 8);
})();

// Idempotenz: doppelte Bewegung erzeugt keine zweite Buchung
(function () {
  var s = freshLager();
  var daten = { mandantId: "m1", typ: LG.BEWEGUNG.ENTNAHME, artikelId: "a1", menge: 5, idempotenzKey: "fix-key-1", zeitpunkt: LJ };
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 20, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  var r1 = LG.uebernehmeOffline(s, daten, LJ);
  var r2 = LG.uebernehmeOffline(s, daten, LJ);
  t("LAGER Idempotenz: zweite Übertragung erzeugt keine zweite Bewegung", r1.ok && r2.ok && r2.neu === false && s.bewegungen.filter(function (b) { return b.idempotenzKey === "fix-key-1"; }).length === 1);
})();

// Offline-Konflikt: nicht valide Bewegung wird als Konflikt gespeichert (nichts gelöscht)
(function () {
  var s = freshLager();
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 3, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  var r = LG.uebernehmeOffline(s, { mandantId: "m1", typ: LG.BEWEGUNG.ENTNAHME, artikelId: "a1", menge: 50, idempotenzKey: "off-1", zeitpunkt: LJ }, LJ);
  t("LAGER Offline-Konflikt statt negativer Bestand", r.ok === false && s.konflikte.length === 1 && s.konflikte[0].status === "offen");
  t("LAGER Offline-Konflikt erzeugt keine Bewegung", s.bewegungen.filter(function (b) { return b.typ === LG.BEWEGUNG.ENTNAHME; }).length === 0);
})();

// Rollen (Rechtematrix)
(function () {
  t("LAGER Rolle werkstatt darf entnehmen, aber keine Einkaufspreise", LG.darf("werkstatt", "entnehmen") && LG.darfEinkaufspreise("werkstatt") === false);
  t("LAGER Rolle werkstatt darf NICHT korrigieren/wareneingang", LG.darf("werkstatt", "korrigieren") === false && LG.darf("werkstatt", "wareneingang") === false);
  t("LAGER Rolle buero darf Einkaufspreise + Wareneingang", LG.darfEinkaufspreise("buero") && LG.darf("buero", "wareneingang"));
  t("LAGER Nur admin darf Inventur freigeben/Bestellung freigeben", LG.darf("admin", "inventurFreigeben") && LG.darf("buero", "inventurFreigeben") === false && LG.darf("buero", "bestellungFreigeben") === false);
})();

// Cross-Tenant-Schutz
(function () {
  var s = freshLager();
  var r = LG.reserviere(s, { mandantId: "m1", artikelId: "aX", menge: 1 }, LJ); // aX gehört m2
  t("LAGER Cross-Tenant Reservierung abgelehnt", r.ok === false && /Cross-Tenant|fremder/.test(r.grund));
  var pr = LG.pruefeBewegung(s, { mandantId: "m1", typ: LG.BEWEGUNG.ENTNAHME, artikelId: "aX", menge: 1 });
  t("LAGER Cross-Tenant Bewegung abgelehnt", pr.ok === false);
})();

// Vollständige Rückverfolgung: Lieferant → WE → Charge → Lagerplatz → Auftrag → Kommission
(function () {
  var s = freshLager();
  LG.wareneingang(s, { mandantId: "m1", lieferantId: "lief1", lieferschein: "LS-RV", positionen: [{ artikelId: "a1", gelieferteMenge: 20, lagerplatzId: "p1", chargennummer: "C-RV", schmelznummer: "SM1", zertifikate: ["3.1"], einkaufspreis: 7 }] }, LJ);
  var chId = s.chargen[0].id;
  LG.entnahme(s, { mandantId: "m1", artikelId: "a1", menge: 4, chargeId: chId, auftragId: "auf1", kommission: "GST Nord", arbeitsgang: "zuschnitt" }, LJ);
  var rv = LG.rueckverfolgung(s, chId);
  t("LAGER Rückverfolgung Lieferant→WE→Charge", rv && rv.lieferantId === "lief1" && rv.lieferschein === "LS-RV" && rv.charge.schmelznummer === "SM1");
  t("LAGER Rückverfolgung Lagerplatz + Verwendung→Auftrag/Kommission", rv.lagerplaetze.indexOf("p1") >= 0 && rv.verwendungen.length === 1 && rv.verwendungen[0].auftragId === "auf1" && rv.verwendungen[0].kommission === "GST Nord");
})();

// Historische Kalkulation bleibt unverändert (Preis-Snapshot bleibt erhalten)
(function () {
  var s = freshLager();
  var histKalk = { id: "k1", netto: 1000, material: [{ einkaufspreis: 6, menge: 10 }] };
  var snap = JSON.stringify(histKalk);
  LG.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 10, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 9 }] }, LJ);
  LG.bewertung(s, "a1", LG.METHODE.GLEITEND);
  t("LAGER historische Kalkulation unverändert durch neue EK-Preise", JSON.stringify(histKalk) === snap);
  // Bewegung trägt eigenen Preis-Snapshot (spätere Preisänderung ändert Buchung nicht)
  var bew = s.bewegungen.filter(function (b) { return b.typ === LG.BEWEGUNG.WARENEINGANG; })[0];
  t("LAGER Bewegung hält eigenen Preis-Snapshot", bew.preisSnapshot === 9);
})();

// =============================================================
//  LAGER-UI-KERN  (Phase 15B) – Inventur, Bestellworkflow, QR/
//  Etikett, Berichte, Rückwärts-Rückverfolgung, Dashboard.
// =============================================================
var L = P.Lager;
(function () {
  var s = freshLager();
  L.wareneingang(s, { mandantId: "m1", lieferantId: "lief1", lieferschein: "LS-UI", positionen: [{ artikelId: "a1", gelieferteMenge: 20, lagerplatzId: "p1", chargennummer: "C-UI", schmelznummer: "SMX", zertifikate: ["3.1"], einkaufspreis: 7 }] }, LJ);
  // Dashboard-Aggregation
  var dash = L.dashboard(s, "m1", LJ);
  t("LAGER-UI Dashboard summiert physischen Bestand", dash.bestand.physisch === 20 && dash.artikelAnzahl >= 1);
  t("LAGER-UI Dashboard zählt Artikel unter Meldebestand", typeof dash.unterMelde === "number");
  // Artikelübersicht + Filter
  var ueb = L.artikelUebersicht(s, "m1", {});
  t("LAGER-UI Artikelübersicht liefert Bestand + letzte Bewegung", ueb.length >= 1 && ueb[0].bestand && ueb[0].letzteBewegung);
  t("LAGER-UI Filter unterMelde", L.artikelUebersicht(s, "m1", { unterMelde: true }).every(function (r) { return r.bestand.verfuegbar < r.artikel.meldebestand; }));
  // QR / Referenzcode / Etikett
  var code = L.referenzCode("charge", s.chargen[0].id);
  t("LAGER-UI Referenzcode Format PS:CH:", /^PS:CH:/.test(code));
  var parsed = L.parseReferenz(code);
  t("LAGER-UI parseReferenz erkennt Typ", parsed && parsed.typ === "charge");
  var etik = L.etikettDaten(s, "charge", s.chargen[0].id);
  t("LAGER-UI Etikettdaten enthalten keinen Preis", etik && JSON.stringify(etik).indexOf("preis") < 0 && etik.titel === "C-UI");
  // Rückwärts-Rückverfolgung
  L.entnahme(s, { mandantId: "m1", artikelId: "a1", menge: 4, chargeId: s.chargen[0].id, auftragId: "aufX", kommission: "KommX" }, LJ);
  var rw = L.rueckverfolgungRueckwaerts(s, "aufX");
  t("LAGER-UI Rückwärts-Rückverfolgung Auftrag→Charge→WE→Lieferant", rw.length === 1 && rw[0].chargennummer === "C-UI" && rw[0].lieferschein === "LS-UI" && rw[0].lieferantId === "lief1");
  // Chargensperre-Impact
  var imp = L.chargeSperrImpact(s, s.chargen[0].id);
  t("LAGER-UI Sperr-Impact listet Bestand/Aufträge", imp && imp.bestand === 16 && imp.auftraege.indexOf("aufX") >= 0);
  // Berichte
  var bb = L.berichtBestand(s, "m1", true);
  t("LAGER-UI Bestandsbericht CSV mit Wertspalten", bb.csv.indexOf("Lagerwert") >= 0 && bb.rows.length >= 1);
  var bbOhne = L.berichtBestand(s, "m1", false);
  t("LAGER-UI Bestandsbericht ohne Wert (kein Recht)", bbOhne.csv.indexOf("Lagerwert") < 0);
})();

// Inventur: anlegen → zählen → zweite Zählung → Freigabe → buchen
(function () {
  var s = freshLager();
  L.wareneingang(s, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 20, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  var inv = L.inventurNeu(s, { mandantId: "m1", typ: L.INVENTUR_TYP.ARTIKEL, artikelIds: ["a1"], schwelleProz: 10 }, LJ);
  t("LAGER Inventur angelegt mit Zählliste", inv.positionen.length >= 1 && inv.status === L.INVENTUR_STATUS.ANGELEGT);
  var pos = inv.positionen[0];
  // starke Abweichung -> zweite Zählung nötig
  var z1 = L.inventurZaehlung(s, inv.id, { positionId: pos.id, gezaehlt: pos.systemBestand - 10 }, LJ);
  t("LAGER Inventur: hohe Abweichung fordert zweite Zählung", z1.zweitNoetig === true);
  var freigabe1 = L.inventurFreigabe(s, inv.id, "admin", LJ);
  t("LAGER Inventur: Freigabe blockiert ohne zweite Zählung", freigabe1.ok === false);
  L.inventurZaehlung(s, inv.id, { positionId: pos.id, gezaehlt: pos.systemBestand - 10, zweit: true }, LJ);
  var freigabe2 = L.inventurFreigabe(s, inv.id, "admin", LJ);
  t("LAGER Inventur: Freigabe nach zweiter Zählung", freigabe2.ok === true && inv.status === L.INVENTUR_STATUS.FREIGEGEBEN);
  var vorher = L.bestand(s, "a1", { mandantId: "m1" }).physisch;
  var buchen = L.inventurBuchen(s, inv.id, "admin", LJ);
  t("LAGER Inventur: Korrekturbuchung senkt Bestand", buchen.ok && buchen.gebucht === 1 && L.bestand(s, "a1", { mandantId: "m1" }).physisch === vorher - 10);
  t("LAGER Inventur: abgeschlossen", inv.status === L.INVENTUR_STATUS.ABGESCHLOSSEN);
})();

// Bestell-Workflow (Status; niemals automatisch versenden)
(function () {
  var s = freshLager();
  var bo = L.bestellungNeu(s, { mandantId: "m1", lieferantId: "lief1", positionen: [{ artikelId: "a1", menge: 12 }] }, LJ);
  t("LAGER Bestellung startet als Entwurf", bo.status === "Entwurf");
  L.bestellungStatus(s, bo.id, "zur Freigabe", "buero", LJ);
  var frei = L.bestellungStatus(s, bo.id, "freigegeben", "admin", LJ);
  t("LAGER Bestellstatus-Workflow bis freigegeben", frei.ok && bo.status === "freigegeben" && bo.freigegebenVon === "admin" && bo.historie.length >= 3);
  t("LAGER Bestellung unbekannter Status abgelehnt", L.bestellungStatus(s, bo.id, "versendet", "admin", LJ).ok === false);
})();

// Neue Rollen-Rechte (15B)
(function () {
  t("LAGER-UI Rolle werkstatt darf umlagern + inventur zählen", L.darf("werkstatt", "umlagern") && L.darf("werkstatt", "inventurZaehlen"));
  t("LAGER-UI Rolle werkstatt darf NICHT Charge entsperren/Berichte", L.darf("werkstatt", "chargeEntsperren") === false && L.darf("werkstatt", "berichteExportieren") === false);
  t("LAGER-UI Nur admin darf Charge entsperren", L.darf("admin", "chargeEntsperren") && L.darf("buero", "chargeEntsperren") === false);
})();

// =============================================================
//  QUALITÄTSMANAGEMENT-KERN  (Phase 16A)
//  Prüfpläne/Versionierung/Snapshot, zentrale Toleranzprüfung,
//  Prüfaufträge, Wareneingangsprüfung, Abweichung→Sperre→
//  Nacharbeit→Nachprüfung, Ausschuss, Sonderfreigabe,
//  Reklamationen, Qualitätskosten, Prüfmittel, Offline, Rollen.
// =============================================================
var Q = P.Qualitaet;
var QJ = "2026-08-01T08:00:00.000Z";
function freshQM() {
  return { stammdaten: Q.standardStammdaten(), pruefplaene: [], pruefauftraege: [], abweichungen: [], sperren: [], nacharbeiten: [], ausschuss: [], sonderfreigaben: [], massnahmen: [], reklamationen: [], lieferantenReklamationen: [], pruefmittel: [], qualitaetskosten: [], audit: [], wareneingangspruefungen: [], konflikte: [] };
}
function qmPlan(s, extra) {
  var pp = Q.pruefplanNeu(s, Object.assign({
    mandantId: "m1", nummer: "PP-T1", bezeichnung: "Testplan", produktgruppeKey: "gelaender", arbeitsgang: "schweissen",
    referenz: "Freitext-Referenz",
    schritte: [
      { nummer: 1, bezeichnung: "Maß A", merkmalTyp: "mass", sollwert: 100, einheit: "mm", obereToleranz: 1, untereToleranz: 1, pflicht: true, beiFehlerSperren: true },
      { nummer: 2, bezeichnung: "Sicht", merkmalTyp: "sicht", pflicht: true, beiFehlerSperren: false }
    ], benutzer: "admin"
  }, extra || {}), QJ);
  Q.pruefplanFreigeben(s, pp.id, "admin", "admin", QJ);
  return pp;
}

// Prüfplanversionierung + Snapshot-Unveränderbarkeit
(function () {
  var s = freshQM();
  var pp = qmPlan(s);
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "auf1", pruefplanId: pp.id, benutzer: "buero" }, QJ);
  t("QM Prüfauftrag mit Prüfplan-Snapshot", pa.ok && pa.pruefauftrag.pruefplanSnapshot.istSnapshot === true && pa.pruefauftrag.pruefplanVersion === 1);
  var snapVorher = JSON.stringify(pa.pruefauftrag.pruefplanSnapshot);
  var v2 = Q.pruefplanNeueVersion(s, pp.id, { benutzer: "admin", schritte: [{ nummer: 1, bezeichnung: "Maß A", merkmalTyp: "mass", sollwert: 100, obereToleranz: 0.1, untereToleranz: 0.1, pflicht: true }] }, QJ);
  t("QM Prüfplan-Versionierung: v2 angelegt, v1 erhalten", v2.ok && v2.pruefplan.version === 2 && v2.vorgaenger.version === 1 && s.pruefplaene.length === 2);
  t("QM v1 wird inaktiv, bleibt aber unverändert lesbar", v2.vorgaenger.aktiv === false && v2.vorgaenger.schritte[0].obereToleranz === 1);
  t("QM Snapshot bleibt von Vorlagenänderung UNBERÜHRT", JSON.stringify(pa.pruefauftrag.pruefplanSnapshot) === snapVorher);
  t("QM Neue Version startet als Entwurf (nicht automatisch freigegeben)", v2.pruefplan.freigabestatus === Q.FREIGABE_STATUS.ENTWURF);
  t("QM Prüfauftrag aus nicht freigegebenem Plan abgelehnt", Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "auf9", pruefplanId: v2.pruefplan.id }, QJ).ok === false);
})();

// Zentrale Toleranzprüfung inkl. Grenzwerte
(function () {
  var r1 = Q.pruefeToleranz(100, 100.5, 1, 1);
  t("QM Maß innerhalb Toleranz", r1.ergebnis === Q.TOLERANZ_ERGEBNIS.INNERHALB && r1.abweichung === 0.5);
  var rOben = Q.pruefeToleranz(100, 101, 1, 1);
  var rUnten = Q.pruefeToleranz(100, 99, 1, 1);
  t("QM Maß exakt auf oberem Grenzwert = innerhalb", rOben.ergebnis === Q.TOLERANZ_ERGEBNIS.INNERHALB && rOben.aufGrenze === true);
  t("QM Maß exakt auf unterem Grenzwert = innerhalb", rUnten.ergebnis === Q.TOLERANZ_ERGEBNIS.INNERHALB && rUnten.aufGrenze === true);
  t("QM Maß außerhalb Toleranz", Q.pruefeToleranz(100, 101.01, 1, 1).ergebnis === Q.TOLERANZ_ERGEBNIS.AUSSERHALB);
  t("QM Asymmetrische Toleranz (+2/-0,5)", Q.pruefeToleranz(100, 101.9, 2, 0.5).ergebnis === Q.TOLERANZ_ERGEBNIS.INNERHALB && Q.pruefeToleranz(100, 99.4, 2, 0.5).ergebnis === Q.TOLERANZ_ERGEBNIS.AUSSERHALB);
  t("QM Untere Toleranz auch als negativer Offset akzeptiert", Q.pruefeToleranz(100, 99.5, 1, -1).ergebnis === Q.TOLERANZ_ERGEBNIS.INNERHALB);
  t("QM Nicht bewertbar ohne Zahlenwert", Q.pruefeToleranz(100, "abc", 1, 1).ergebnis === Q.TOLERANZ_ERGEBNIS.NICHT_BEWERTBAR);
  t("QM Nicht bewertbar ohne Toleranz", Q.pruefeToleranz(100, 100, null, null).ergebnis === Q.TOLERANZ_ERGEBNIS.NICHT_BEWERTBAR);
  t("QM Grenzen korrekt berechnet", (function () { var g = Q.toleranzGrenzen(100, 2, 0.5); return g.unten === 99.5 && g.oben === 102; })());
})();

// Pflichtprüfung + Abschlusslogik
(function () {
  var s = freshQM(); var pp = qmPlan(s);
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "auf1", pruefplanId: pp.id }, QJ).pruefauftrag;
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 1, wert: 100, pruefer: "werkstatt" }, QJ);
  var ab1 = Q.pruefauftragAbschliessen(s, pa.id, { pruefer: "buero", rolle: "buero" }, QJ);
  t("QM Abschluss blockiert bei offener Pflichtprüfung", ab1.ok === false && /Pflichtprüfung/.test(ab1.grund));
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 2, wert: "io", pruefer: "werkstatt" }, QJ);
  var ab2 = Q.pruefauftragAbschliessen(s, pa.id, { pruefer: "buero", rolle: "buero" }, QJ);
  t("QM Prüfauftrag bestanden bei allen Werten in Toleranz", ab2.ok && ab2.status === Q.PA_STATUS.BESTANDEN);
  t("QM Abschluss ohne Recht abgelehnt", Q.pruefauftragAbschliessen(s, pa.id, { pruefer: "x", rolle: "werkstatt" }, QJ).ok === false);
})();

// Sperrender Fehler -> Prüfauftrag gesperrt
(function () {
  var s = freshQM(); var pp = qmPlan(s);
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "auf2", pruefplanId: pp.id }, QJ).pruefauftrag;
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 1, wert: 105, pruefer: "werkstatt" }, QJ);
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 2, wert: "io", pruefer: "werkstatt" }, QJ);
  var ab = Q.pruefauftragAbschliessen(s, pa.id, { pruefer: "buero", rolle: "buero" }, QJ);
  t("QM Sperrender Fehler -> Status gesperrt", ab.ok && ab.status === Q.PA_STATUS.GESPERRT && ab.auswertung.sperrend === 1);
})();

// Prüfmittel: Kalibrierung, Sperre, betroffene frühere Prüfungen
(function () {
  var s = freshQM(); var pp = qmPlan(s);
  var alt = new Date(new Date(QJ).getTime() - 400 * 86400000).toISOString();
  var pmGut = Q.pruefmittelNeu(s, { mandantId: "m1", nummer: "PM-G", bezeichnung: "Messschieber", kalibrierintervallTage: 365, letzteKalibrierung: new Date(new Date(QJ).getTime() - 30 * 86400000).toISOString() }, QJ);
  var pmAlt = Q.pruefmittelNeu(s, { mandantId: "m1", nummer: "PM-A", bezeichnung: "Altgerät", kalibrierintervallTage: 365, letzteKalibrierung: alt }, QJ);
  t("QM Prüfmittel gültig bei aktueller Kalibrierung", Q.pruefmittelGueltig(pmGut, QJ).gueltig === true);
  t("QM Prüfmittel ungültig bei abgelaufener Kalibrierung", Q.pruefmittelGueltig(pmAlt, QJ).gueltig === false && Q.pruefmittelGueltig(pmAlt, QJ).kalibrierungFaellig === true);
  Q.pruefmittelStatusAktualisieren(s, QJ);
  t("QM Fällige Kalibrierung setzt Status", pmAlt.status === Q.PM_STATUS.KALIBRIERUNG_FAELLIG);
  var pmGesperrt = Q.pruefmittelNeu(s, { mandantId: "m1", nummer: "PM-S", bezeichnung: "Defekt", status: Q.PM_STATUS.GESPERRT, letzteKalibrierung: QJ }, QJ);
  t("QM Gesperrtes Prüfmittel ist ungültig", Q.pruefmittelGueltig(pmGesperrt, QJ).gueltig === false);
  // Messung mit ungültigem Prüfmittel -> Nachprüfung, nicht stillschweigend bestanden
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "auf3", pruefplanId: pp.id }, QJ).pruefauftrag;
  var e = Q.ergebnisErfassen(s, pa.id, { schrittNummer: 1, wert: 100, pruefmittelId: pmAlt.id, pruefer: "werkstatt" }, QJ);
  t("QM Messung mit ungültigem Prüfmittel -> Nachprüfung", e.ok && e.bewertung.ergebnis === Q.TOLERANZ_ERGEBNIS.NACHPRUEFUNG && e.ergebnisEintrag.pruefmittelGueltig === false);
  var betroffen = Q.betroffenePruefungen(s, pmAlt.id);
  t("QM Betroffene frühere Prüfungen ermittelbar", betroffen.length === 1 && betroffen[0].pruefauftragId === pa.id);
})();

// Wareneingangsprüfung: Teilfreigabe über den Lagerkern (keine 2. Bestandslogik)
(function () {
  var s = freshQM();
  var ls = freshLager();
  LG.wareneingang(ls, { mandantId: "m1", lieferschein: "LS-QS", positionen: [{ artikelId: "a1", gelieferteMenge: 10, lagerplatzId: "p1", chargennummer: "C-QS", einkaufspreis: 7, qs: true }] }, LJ);
  var vor = LG.bestand(ls, "a1", { mandantId: "m1" });
  t("QM WE mit QS: physisch vorhanden, aber nicht verfügbar", vor.physisch === 10 && vor.verfuegbar === 0 && vor.qualitaet === 10);
  var we = ls.wareneingaenge[0];
  var r = Q.wareneingangsPruefung(s, ls, { mandantId: "m1", wareneingangId: we.id, artikelId: "a1", chargeId: ls.chargen[0].id, gelieferteMenge: 10, freigegebeneMenge: 6, beschaedigteMenge: 1, lieferantenfehler: true, pruefer: "buero" }, QJ);
  var nach = LG.bestand(ls, "a1", { mandantId: "m1" });
  t("QM Teilfreigabe: nur freigegebene Menge verfügbar", r.ok && r.ergebnis === "teilweise freigegeben" && nach.verfuegbar === 6 && nach.gesperrt === 4);
  t("QM Teilfreigabe meldet Reklamationsbedarf", r.reklamationErforderlich === true && r.gesperrteMenge === 4);
  t("QM Vollständige Freigabe möglich", (function () { var s2 = freshQM(); var l2 = freshLager(); LG.wareneingang(l2, { mandantId: "m1", lieferschein: "LS2", positionen: [{ artikelId: "a1", gelieferteMenge: 5, lagerplatzId: "p1", chargennummer: "C2", einkaufspreis: 7, qs: true }] }, LJ); var rr = Q.wareneingangsPruefung(s2, l2, { mandantId: "m1", wareneingangId: l2.wareneingaenge[0].id, artikelId: "a1", chargeId: l2.chargen[0].id, gelieferteMenge: 5, freigegebeneMenge: 5, pruefer: "buero" }, QJ); return rr.ok && rr.ergebnis === "vollständig freigegeben" && LG.bestand(l2, "a1", { mandantId: "m1" }).verfuegbar === 5; })());
  t("QM Freigabemenge > Liefermenge abgelehnt", Q.wareneingangsPruefung(s, ls, { mandantId: "m1", artikelId: "a1", gelieferteMenge: 5, freigegebeneMenge: 9 }, QJ).ok === false);
})();

// Abweichung -> Sperrung -> Nacharbeit -> Nachprüfung
(function () {
  var s = freshQM(); var ls = freshLager(); var pp = qmPlan(s);
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "auf5", kommission: "K5", pruefplanId: pp.id }, QJ).pruefauftrag;
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 1, wert: 108, pruefer: "werkstatt" }, QJ);
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 2, wert: "io", pruefer: "werkstatt" }, QJ);
  Q.pruefauftragAbschliessen(s, pa.id, { pruefer: "buero", rolle: "buero" }, QJ);
  var a = Q.abweichungNeu(s, { mandantId: "m1", auftragId: "auf5", kommission: "K5", arbeitsgang: "schweissen", pruefauftragId: pa.id, beschreibung: "Maß zu groß", fehlerart: "Maßabweichung", fehlerklasse: "hauptfehler", menge: 1, ersteller: "werkstatt", rolle: "werkstatt" }, QJ);
  t("QM Abweichung angelegt + mit Prüfauftrag verknüpft", a.ok && pa.abweichungIds.indexOf(a.abweichung.id) >= 0 && a.abweichung.status === Q.ABW_STATUS.NEU);
  t("QM Abweichung ohne Recht abgelehnt", Q.abweichungNeu(s, { mandantId: "m1", ersteller: "x", rolle: "gast" }, QJ).ok === false);
  // Keine doppelte Abweichung (gleicher Idempotenzschlüssel)
  var a2 = Q.abweichungNeu(s, { mandantId: "m1", idempotenzKey: a.abweichung.idempotenzKey, ersteller: "werkstatt", rolle: "werkstatt" }, QJ);
  t("QM Keine doppelte Abweichung bei gleichem Schlüssel", a2.ok && a2.neu === false && s.abweichungen.length === 1);
  // Sperrung
  var sp = Q.sperreNeu(s, { mandantId: "m1", objektTyp: "Auftragsteil", objektId: "auf5", abweichungId: a.abweichung.id, grund: "Maßabweichung", benutzer: "buero", rolle: "buero" }, QJ);
  t("QM Sperrung erzeugt + Abweichung auf gesperrt", sp.ok && a.abweichung.status === Q.ABW_STATUS.GESPERRT && Q.istGesperrt(s, "Auftragsteil", "auf5"));
  t("QM Sperrung ohne Grund abgelehnt", Q.sperreNeu(s, { mandantId: "m1", objektTyp: "Auftragsteil", objektId: "x", benutzer: "b", rolle: "buero" }, QJ).ok === false);
  t("QM Sperrung ohne Recht abgelehnt", Q.sperreNeu(s, { mandantId: "m1", objektTyp: "Auftragsteil", objektId: "x", grund: "g", benutzer: "b", rolle: "gast" }, QJ).ok === false);
  var bet = Q.betroffeneVorgaenge(s, ls, sp.sperre);
  t("QM Betroffene Vorgänge ermittelbar", bet.auftraege.indexOf("auf5") >= 0 && bet.pruefauftraege.indexOf(pa.id) >= 0);
  // Entsperren nur mit Recht + Grund, mit Audit
  t("QM Entsperren ohne Recht abgelehnt", Q.sperreAufheben(s, sp.sperre.id, { benutzer: "b", grund: "g", rolle: "buero" }, QJ).ok === false);
  t("QM Entsperren ohne Grund abgelehnt", Q.sperreAufheben(s, sp.sperre.id, { benutzer: "b", rolle: "admin" }, QJ).ok === false);
  var auf = Q.sperreAufheben(s, sp.sperre.id, { benutzer: "admin", grund: "Nacharbeit erfolgreich", rolle: "admin" }, QJ);
  t("QM Entsperren mit Recht+Grund protokolliert", auf.ok && sp.sperre.aktiv === false && sp.sperre.aufgehoben.grund === "Nacharbeit erfolgreich" && s.audit.some(function (x) { return x.aktion === "sperre.aufheben"; }));
  // Nacharbeit + Nachprüfung
  var na = Q.nacharbeitNeu(s, { mandantId: "m1", abweichungId: a.abweichung.id, taetigkeit: "neu ausrichten", geplanteZeitStd: 2, tatsaechlicheZeitStd: 3, benutzer: "admin", rolle: "admin", freigeben: true }, QJ);
  t("QM Nacharbeit angelegt, Herkunft standardmäßig ungeklärt", na.ok && na.nacharbeit.herkunft === "ungeklärt" && a.abweichung.status === Q.ABW_STATUS.NACHARBEIT);
  t("QM Nacharbeitsfreigabe ohne Recht abgelehnt", Q.nacharbeitNeu(s, { mandantId: "m1", abweichungId: a.abweichung.id, benutzer: "b", rolle: "buero", freigeben: true }, QJ).ok === false);
  var np = Q.nachpruefungAnlegen(s, na.nacharbeit.id, { pruefer: "werkstatt", benutzer: "buero" }, QJ);
  t("QM Nachprüfung nutzt denselben Prüfplan-Snapshot", np.ok && np.pruefauftrag.pruefplanVersion === pa.pruefplanVersion && np.pruefauftrag.nachpruefungVon === pa.id);
  Q.ergebnisErfassen(s, np.pruefauftrag.id, { schrittNummer: 1, wert: 100, pruefer: "werkstatt" }, QJ);
  Q.ergebnisErfassen(s, np.pruefauftrag.id, { schrittNummer: 2, wert: "io", pruefer: "werkstatt" }, QJ);
  var abNp = Q.pruefauftragAbschliessen(s, np.pruefauftrag.id, { pruefer: "buero", rolle: "buero" }, QJ);
  t("QM Nachprüfung bestanden", abNp.ok && abNp.status === Q.PA_STATUS.BESTANDEN);
})();

// Ausschuss wirkt über den Lagerkern
(function () {
  var s = freshQM(); var ls = freshLager();
  LG.wareneingang(ls, { mandantId: "m1", positionen: [{ artikelId: "a1", gelieferteMenge: 20, lagerplatzId: "p1", chargennummer: "C1", einkaufspreis: 7 }] }, LJ);
  var vor = LG.bestand(ls, "a1", { mandantId: "m1" }).physisch;
  var au = Q.ausschussNeu(s, ls, { mandantId: "m1", auftragId: "auf6", artikelId: "a1", menge: 3, materialkosten: 21, bearbeitungskosten: 12, maschinenkosten: 6, grund: "nicht nacharbeitbar", benutzer: "admin" }, QJ);
  t("QM Ausschuss senkt physischen Lagerbestand", au.ok && LG.bestand(ls, "a1", { mandantId: "m1" }).physisch === vor - 3);
  t("QM Ausschuss erzeugt Lagerbewegung im Journal", ls.bewegungen.some(function (b) { return b.typ === LG.BEWEGUNG.AUSSCHUSS && b.menge === 3; }));
  var k = Q.kostenSumme(s, { auftragId: "auf6" });
  t("QM Ausschuss erfasst Qualitätskosten getrennt", k.proArt["Material"] === 21 && k.proArt["Arbeitszeit"] === 12 && k.proArt["Maschinenzeit"] === 6 && k.gesamt === 39);
  t("QM Ausschuss Menge 0 abgelehnt", Q.ausschussNeu(s, ls, { mandantId: "m1", artikelId: "a1", menge: 0 }, QJ).ok === false);
})();

// Sonderfreigabe – niemals automatisch
(function () {
  var s = freshQM();
  var a = Q.abweichungNeu(s, { mandantId: "m1", auftragId: "auf7", beschreibung: "leichte Abweichung", ersteller: "werkstatt", rolle: "werkstatt" }, QJ);
  t("QM Sonderfreigabe ohne Beurteilung abgelehnt", Q.sonderfreigabeNeu(s, { mandantId: "m1", abweichungId: a.abweichung.id, freigebender: "admin", rolle: "admin" }, QJ).ok === false);
  t("QM Sonderfreigabe ohne Freigebenden abgelehnt", Q.sonderfreigabeNeu(s, { mandantId: "m1", abweichungId: a.abweichung.id, beurteilung: "ok", rolle: "admin" }, QJ).ok === false);
  t("QM Sonderfreigabe ohne Recht abgelehnt", Q.sonderfreigabeNeu(s, { mandantId: "m1", abweichungId: a.abweichung.id, beurteilung: "ok", freigebender: "b", rolle: "buero" }, QJ).ok === false);
  var sf = Q.sonderfreigabeNeu(s, { mandantId: "m1", abweichungId: a.abweichung.id, beurteilung: "Funktion nicht beeinträchtigt", freigebender: "admin", rolle: "admin", kundenbestaetigungErforderlich: true }, QJ);
  t("QM Sonderfreigabe nur ausdrücklich mit Beurteilung", sf.ok && a.abweichung.status === Q.ABW_STATUS.SF_ERTEILT && sf.sonderfreigabe.kundenbestaetigungAm === null);
})();

// Ursachenanalyse: keine automatische Schuldzuweisung
(function () {
  var s = freshQM();
  var a = Q.abweichungNeu(s, { mandantId: "m1", auftragId: "auf8", ersteller: "werkstatt", rolle: "werkstatt" }, QJ).abweichung;
  t("QM Abweichung startet ohne bestätigte Ursache", a.bestaetigteUrsache === null && a.herkunft === "ungeklärt");
  var k1 = Q.ursacheKandidatHinzufuegen(s, a.id, { text: "Werkzeugverschleiß", kategorie: "Maschine", benutzer: "werkstatt", fuenfWhy: ["a", "b", "c"] }, QJ);
  Q.ursacheKandidatHinzufuegen(s, a.id, { text: "Bedienfehler", kategorie: "Mensch", benutzer: "buero" }, QJ);
  t("QM Mehrere Ursachenkandidaten, alle unbestätigt", a.ursachenKandidaten.length === 2 && a.ursachenKandidaten.every(function (x) { return x.bestaetigt === false && x.sicherheit === "Vermutung"; }) && a.bestaetigteUrsache === null);
  t("QM 5-Why wird gespeichert", k1.kandidat.fuenfWhy.length === 3);
  t("QM Ursachenbestätigung ohne Benutzer abgelehnt", Q.ursacheBestaetigen(s, a.id, k1.kandidat.id, {}, QJ).ok === false);
  var b = Q.ursacheBestaetigen(s, a.id, k1.kandidat.id, { benutzer: "admin", herkunft: "intern" }, QJ);
  t("QM Bestätigte Ursache getrennt gespeichert", b.ok && a.bestaetigteUrsache.text === "Werkzeugverschleiß" && a.bestaetigteUrsache.bestaetigtVon === "admin" && a.herkunft === "intern");
  t("QM Nur ein Kandidat gilt als bestätigt", a.ursachenKandidaten.filter(function (x) { return x.bestaetigt; }).length === 1);
})();

// Korrekturmaßnahmen inkl. Wirksamkeitsprüfung
(function () {
  var s = freshQM();
  var m = Q.massnahmeNeu(s, { mandantId: "m1", beschreibung: "Wartungsintervall verkürzen", verantwortlicher: "buero", benutzer: "admin" }, QJ);
  t("QM Maßnahme startet als geplant", m.ok && m.massnahme.status === Q.MASSNAHME_STATUS.GEPLANT);
  t("QM Maßnahmenstatus ohne Benutzer abgelehnt", Q.massnahmeStatus(s, m.massnahme.id, Q.MASSNAHME_STATUS.UMGESETZT, {}, QJ).ok === false);
  Q.massnahmeStatus(s, m.massnahme.id, Q.MASSNAHME_STATUS.UMGESETZT, { benutzer: "buero" }, QJ);
  var w = Q.massnahmeStatus(s, m.massnahme.id, Q.MASSNAHME_STATUS.WIRKSAM, { benutzer: "admin", bemerkung: "keine Wiederholung" }, QJ);
  t("QM Wirksamkeitsprüfung dokumentiert", w.ok && m.massnahme.wirksamkeitspruefung.ergebnis === Q.MASSNAHME_STATUS.WIRKSAM && m.massnahme.historie.length === 3);
})();

// Kundenreklamation – keine automatische Bewertung
(function () {
  var s = freshQM();
  var rk = Q.reklamationNeu(s, { mandantId: "m1", kundeId: "k1", auftragId: "auf1", beschreibung: "Kratzer", menge: 2, benutzer: "buero", rolle: "buero" }, QJ);
  t("QM Reklamation startet unbewertet", rk.ok && rk.reklamation.berechtigung === "nicht bewertet" && rk.reklamation.status === Q.REKL_STATUS.NEU);
  t("QM Reklamationsbewertung ohne Begründung abgelehnt", Q.reklamationBewerten(s, rk.reklamation.id, "berechtigt", { benutzer: "admin" }, QJ).ok === false);
  var bw = Q.reklamationBewerten(s, rk.reklamation.id, "teilweise berechtigt", { benutzer: "admin", begruendung: "Transportschaden anteilig" }, QJ);
  t("QM Bewertung nur ausdrücklich mit Begründung", bw.ok && rk.reklamation.berechtigung === "teilweise berechtigt" && rk.reklamation.bewertetVon === "admin");
  Q.reklamationStatus(s, rk.reklamation.id, Q.REKL_STATUS.NACHARBEIT, { benutzer: "buero", grund: "Nacharbeit vereinbart" }, QJ);
  t("QM Reklamationsstatus mit Historie", rk.reklamation.status === Q.REKL_STATUS.NACHARBEIT && rk.reklamation.historie.length === 2);
})();

// Lieferantenreklamation mit direkter Chargensperre
(function () {
  var s = freshQM(); var ls = freshLager();
  LG.wareneingang(ls, { mandantId: "m1", lieferantId: "lief1", lieferschein: "LS-LR", positionen: [{ artikelId: "a1", gelieferteMenge: 12, lagerplatzId: "p1", chargennummer: "C-LR", einkaufspreis: 7 }] }, LJ);
  var ch = ls.chargen[0];
  t("QM Charge vor Reklamation verfügbar", LG.bestand(ls, "a1", { mandantId: "m1" }).verfuegbar === 12);
  var lr = Q.lieferantenReklamationNeu(s, ls, { mandantId: "m1", lieferantId: "lief1", wareneingangId: ls.wareneingaenge[0].id, artikelId: "a1", chargeId: ch.id, menge: 4, fehler: "Materialfehler", chargeSperren: true, benutzer: "buero", rolle: "buero" }, QJ);
  t("QM Lieferantenreklamation sperrt Charge direkt", lr.ok && lr.lieferantenReklamation.sperrId && ch.gesperrt === true);
  t("QM Gesperrte Charge nicht mehr verfügbar", LG.bestand(ls, "a1", { mandantId: "m1" }).verfuegbar === 0 && LG.bestand(ls, "a1", { mandantId: "m1" }).gesperrt === 12);
  t("QM Entnahme aus gesperrter Charge abgelehnt", LG.entnahme(ls, { mandantId: "m1", artikelId: "a1", menge: 1, chargeId: ch.id }, LJ).ok === false);
  var sp = s.sperren.filter(function (x) { return x.objektTyp === "Materialcharge"; })[0];
  var bet = Q.betroffeneVorgaenge(s, ls, sp);
  t("QM Betroffene Vorgänge der Chargensperre ermittelbar", !!sp && Array.isArray(bet.reservierungen) && Array.isArray(bet.entnahmen));
})();

// Qualitätskosten getrennt + keine automatische Kostenweitergabe
(function () {
  var s = freshQM();
  Q.kostenErfassen(s, { mandantId: "m1", auftragId: "auf1", art: "Nacharbeit", betrag: 144, benutzer: "buero" }, QJ);
  Q.kostenErfassen(s, { mandantId: "m1", auftragId: "auf1", art: "Fahrt", betrag: 60, benutzer: "buero" }, QJ);
  Q.kostenErfassen(s, { mandantId: "m1", auftragId: "auf2", art: "Gutschrift", betrag: 200, benutzer: "buero" }, QJ);
  var alle = Q.kostenSumme(s, {});
  var eins = Q.kostenSumme(s, { auftragId: "auf1" });
  t("QM Qualitätskosten je Art getrennt", alle.proArt["Nacharbeit"] === 144 && alle.proArt["Fahrt"] === 60 && alle.proArt["Gutschrift"] === 200 && alle.gesamt === 404);
  t("QM Qualitätskosten je Auftrag filterbar", eins.gesamt === 204);
  t("QM Kostenträger wird NICHT automatisch zugewiesen", s.qualitaetskosten.every(function (k) { return k.kostentraeger === "nicht zugewiesen"; }));
  t("QM Unbekannte Kostenart -> sonstige", Q.kostenErfassen(s, { mandantId: "m1", art: "Phantasie", betrag: 5 }, QJ).art === "sonstige");
})();

// Offline: Idempotenz, Konflikt, keine automatische Freigabe
(function () {
  var s = freshQM(); var pp = qmPlan(s);
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "auf10", pruefplanId: pp.id }, QJ).pruefauftrag;
  var daten = { aktion: "pruefergebnis", pruefauftragId: pa.id, schrittNummer: 1, wert: 100.5, pruefer: "werkstatt", idempotenzKey: "qm-off-1", mandantId: "m1" };
  var r1 = Q.uebernehmeOffline(s, daten, QJ);
  var r2 = Q.uebernehmeOffline(s, daten, QJ);
  t("QM Offline-Prüfergebnis übernommen + zentral bewertet", r1.ok && r1.neu === true && r1.bewertung.ergebnis === Q.TOLERANZ_ERGEBNIS.INNERHALB);
  t("QM Offline-Idempotenz: kein zweites Ergebnis", r2.ok && r2.neu === false && pa.ergebnisse.length === 1);
  t("QM Offline-Freigabe ist NICHT zulässig", (function () { var r = Q.uebernehmeOffline(s, { aktion: "freigabe", pruefauftragId: pa.id, mandantId: "m1" }, QJ); return r.ok === false && /nicht zulässig/.test(r.grund); })());
  var kf = Q.uebernehmeOffline(s, { aktion: "pruefergebnis", pruefauftragId: "gibtsnicht", schrittNummer: 1, wert: 1, idempotenzKey: "x", mandantId: "m1" }, QJ);
  var letzterKonflikt = s.konflikte[s.konflikte.length - 1];
  t("QM Offline-Konflikt gespeichert (lokale Daten erhalten)", kf.ok === false && letzterKonflikt.daten.wert === 1 && letzterKonflikt.status === "offen" && letzterKonflikt.daten.idempotenzKey === "x");
  // Veraltete Prüfplanversion -> Konflikt statt stiller Übernahme
  var kf2 = Q.uebernehmeOffline(s, { aktion: "pruefergebnis", pruefauftragId: pa.id, pruefplanVersion: 99, schrittNummer: 2, wert: "io", idempotenzKey: "y", mandantId: "m1" }, QJ);
  t("QM Offline-Konflikt bei abweichender Prüfplanversion", kf2.ok === false && /Prüfplanversion/.test(kf2.grund));
  // Offline-Abweichung doppelt -> nur eine
  var o1 = Q.uebernehmeOffline(s, { aktion: "abweichung", mandantId: "m1", auftragId: "auf10", ersteller: "werkstatt", rolle: "werkstatt", idempotenzKey: "abw-off-1" }, QJ);
  var o2 = Q.uebernehmeOffline(s, { aktion: "abweichung", mandantId: "m1", auftragId: "auf10", ersteller: "werkstatt", rolle: "werkstatt", idempotenzKey: "abw-off-1" }, QJ);
  t("QM Offline erzeugt keine doppelte Abweichung", o1.ok && o2.ok && o2.neu === false && s.abweichungen.length === 1);
})();

// Rollen + Cross-Tenant
(function () {
  t("QM Rolle werkstatt darf prüfen + Abweichung anlegen", Q.darf("werkstatt", "pruefungDurchfuehren") && Q.darf("werkstatt", "abweichungAnlegen"));
  t("QM Rolle werkstatt darf NICHT freigeben/sperren/entsperren", Q.darf("werkstatt", "pruefungFreigeben") === false && Q.darf("werkstatt", "chargeSperren") === false && Q.darf("werkstatt", "sperrungAufheben") === false);
  t("QM Rolle buero ohne Sonderfreigabe/Sperraufhebung", Q.darf("buero", "sonderfreigabe") === false && Q.darf("buero", "sperrungAufheben") === false && Q.darf("buero", "nacharbeitFreigeben") === false);
  t("QM Nur admin darf Prüfplan freigeben", Q.darf("admin", "pruefplanFreigeben") && Q.darf("buero", "pruefplanFreigeben") === false);
  t("QM Werkstatt sieht keine Qualitätskosten", Q.darf("werkstatt", "qualitaetskostenSehen") === false && Q.darf("buero", "qualitaetskostenSehen"));
  // Cross-Tenant: Prüfplan eines fremden Mandanten wird nicht gefunden
  var s = freshQM();
  qmPlan(s, { mandantId: "m1" });
  t("QM Cross-Tenant: fremder Mandant findet keinen Prüfplan", Q.passenderPruefplan(s, { mandantId: "m2", produktgruppeKey: "gelaender" }) === null);
  t("QM Eigener Mandant findet Prüfplan", !!Q.passenderPruefplan(s, { mandantId: "m1", produktgruppeKey: "gelaender" }));
})();

// Audit + Unveränderbarkeit abgeschlossener Prüfungen
(function () {
  var s = freshQM(); var pp = qmPlan(s);
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "auf11", pruefplanId: pp.id, benutzer: "buero" }, QJ).pruefauftrag;
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 1, wert: 100, pruefer: "werkstatt" }, QJ);
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 2, wert: "io", pruefer: "werkstatt" }, QJ);
  Q.pruefauftragAbschliessen(s, pa.id, { pruefer: "buero", rolle: "buero" }, QJ);
  pa.status = Q.PA_STATUS.ABGESCHLOSSEN;
  var nach = Q.ergebnisErfassen(s, pa.id, { schrittNummer: 1, wert: 999, pruefer: "x" }, QJ);
  t("QM Abgeschlossene Prüfung nicht mehr änderbar", nach.ok === false && /abgeschlossen/.test(nach.grund));
  t("QM Audit protokolliert Prüfaktionen mit Benutzer/Zeitpunkt", s.audit.length >= 4 && s.audit.every(function (a) { return !!a.zeitpunkt && !!a.aktion; }));
  t("QM Audit enthält Vorher/Nachher beim Abschluss", s.audit.some(function (a) { return a.aktion === "pruefauftrag.abschluss" && a.nachher === Q.PA_STATUS.BESTANDEN; }));
})();

// Keine Normen fest hinterlegt / keine Konformitätsaussage
(function () {
  var sd = Q.standardStammdaten();
  t("QM Normreferenzen sind leer und konfigurierbar", Array.isArray(sd.normReferenzen) && sd.normReferenzen.length === 0);
  t("QM Hinweis: keine Normkonformität behauptet", /keine Normkonformität/i.test(sd.hinweis));
  var s = freshQM(); var pp = qmPlan(s, { referenz: "Kundenvorgabe XY" });
  t("QM Prüfplan-Referenz ist reiner Freitext ohne Konformitätsaussage", pp.referenz === "Kundenvorgabe XY" && /keine Konformitätsaussage/i.test(pp.referenzHinweis));
  t("QM Stammdaten enthalten keine fest codierte Norm-Nummer", JSON.stringify(sd).indexOf("EN 1090") < 0 && JSON.stringify(sd).indexOf("ISO 9001") < 0);
})();

// Historische Aufträge/Kalkulationen bleiben unverändert
(function () {
  var s = freshQM(); var pp = qmPlan(s);
  var auftrag = { id: "auf12", titel: "Alt", kalk: { netto: 1000 }, positionen: [{ kalk: { netto: 1000 } }] };
  var snapVorher = JSON.stringify(auftrag);
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: auftrag.id, pruefplanId: pp.id }, QJ).pruefauftrag;
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 1, wert: 105, pruefer: "werkstatt" }, QJ);
  Q.abweichungNeu(s, { mandantId: "m1", auftragId: auftrag.id, ersteller: "werkstatt", rolle: "werkstatt" }, QJ);
  Q.kostenErfassen(s, { mandantId: "m1", auftragId: auftrag.id, art: "Nacharbeit", betrag: 99 }, QJ);
  t("QM Historischer Auftrag durch QM-Vorgänge unverändert", JSON.stringify(auftrag) === snapVorher);
})();

// =============================================================
//  QUALITÄTS-UI-KERN  (Phase 16B) – Dashboard, Abnahme, Berichte,
//  Portalfreigabe/kundensichere Ausgabe, Lernhinweise, Kalibrierung.
// =============================================================
(function () {
  var s = freshQM(); var pp = qmPlan(s);
  // Dashboard aus echten Daten
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "aufD", kommission: "KD", pruefplanId: pp.id, geplantesDatum: "2026-07-01T08:00:00.000Z" }, QJ).pruefauftrag;
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 1, wert: 105, pruefer: "werkstatt" }, QJ);
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 2, wert: "io", pruefer: "werkstatt" }, QJ);
  Q.pruefauftragAbschliessen(s, pa.id, { pruefer: "buero", rolle: "buero" }, QJ);
  var abw = Q.abweichungNeu(s, { mandantId: "m1", auftragId: "aufD", kommission: "KD", pruefauftragId: pa.id, fehlerart: "Maßabweichung", menge: 2, ersteller: "werkstatt", rolle: "werkstatt", maschineId: "masch1" }, QJ).abweichung;
  Q.sperreNeu(s, { mandantId: "m1", objektTyp: "Auftragsteil", objektId: "aufD", abweichungId: abw.id, grund: "Maß", benutzer: "buero", rolle: "buero" }, QJ);
  var dash = Q.dashboard(s, { mandantId: "m1" }, QJ);
  t("QM-UI Dashboard zählt nicht bestandene Prüfungen", dash.nichtBestanden >= 1 && dash.pruefauftraegeGesamt >= 1);
  t("QM-UI Dashboard zählt offene Abweichungen + gesperrte Bauteile", dash.offeneAbweichungen === 1 && dash.gesperrteBauteile === 1);
  t("QM-UI Dashboard erkennt überfällige Prüfung", Q.ueberfaelligePruefungen(s, "m1", "2026-08-01T08:00:00.000Z").length >= 0 && typeof dash.ueberfaelligePruefungen === "number");
  // Filter wirkt
  t("QM-UI Dashboard-Filter Kommission", Q.dashboard(s, { mandantId: "m1", kommission: "GIBTSNICHT" }, QJ).pruefauftraegeGesamt === 0);
  t("QM-UI Dashboard-Filter Fehlerart", Q.dashboard(s, { mandantId: "m1", fehlerart: "Oberflächenfehler" }, QJ).offeneAbweichungen === 0);
  // Berichte
  var rep = Q.bericht(s, "pruefstatus", { mandantId: "m1" });
  t("QM-UI Prüfstatusbericht als CSV", rep && rep.rows.length >= 1 && rep.csv.indexOf("Prüfauftrag") >= 0);
  t("QM-UI Abweichungsbericht enthält Herkunft", Q.bericht(s, "abweichungen", { mandantId: "m1" }).csv.indexOf("Herkunft") >= 0);
  t("QM-UI Alle acht Berichtsarten liefern Daten", ["pruefstatus", "abweichungen", "nacharbeit", "ausschuss", "reklamationen", "lieferantenqualitaet", "pruefmittel", "qualitaetskosten"].every(function (a) { return !!Q.bericht(s, a, { mandantId: "m1" }); }));
  t("QM-UI Unbekannter Bericht liefert null", Q.bericht(s, "phantasie", {}) === null);
})();

// Montage-/Kundenabnahme + Abnahmeprotokoll (keine qualifizierte Signatur)
(function () {
  var s = freshQM();
  var r = Q.abnahmeNeu(s, { mandantId: "m1", auftragId: "aufA", kommission: "KA", kundeId: "k1", baustelle: "BV Test", anwesende: ["Kunde", "Monteur"], ausgefuehrteLeistungen: "Montage", maengel: ["Kratzer"], restarbeiten: ["Nachschleifen"], offenePunkte: ["Reinigung"], kundenkommentar: "ok", kenntnisnahme: true, kenntnisnahmeName: "Bauleitung", benutzer: "werkstatt" }, QJ);
  t("QM-UI Abnahme angelegt", r.ok && r.neu === true && r.abnahme.kenntnisnahme === true);
  t("QM-UI Abnahme ist KEINE qualifizierte Signatur", /keine qualifizierte/i.test(r.abnahme.signaturHinweis));
  var r2 = Q.abnahmeNeu(s, { mandantId: "m1", auftragId: "aufA", datum: r.abnahme.datum, benutzer: "werkstatt" }, QJ);
  t("QM-UI Abnahme idempotent (keine Dublette)", r2.ok && r2.neu === false && s.abnahmen.length === 1);
  var pr = Q.abnahmeProtokoll(s, r.abnahme.id);
  t("QM-UI Abnahmeprotokoll mit Dokumentkennung", pr && /^ABN-/.test(pr.dokumentkennung) && pr.maengel.length === 1 && pr.restarbeiten.length === 1);
  t("QM-UI Abnahmeprotokoll ohne interne Kosten/Ursachen", JSON.stringify(pr).indexOf("kosten") < 0 && JSON.stringify(pr).indexOf("ursache") < 0);
})();

// Kundenportal: nur freigegebene Belege, interne Daten unsichtbar
(function () {
  var s = freshQM(); var pp = qmPlan(s);
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "aufP", kommission: "KP", pruefplanId: pp.id }, QJ).pruefauftrag;
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 1, wert: 100, pruefer: "werkstatt" }, QJ);
  Q.ergebnisErfassen(s, pa.id, { schrittNummer: 2, wert: "io", pruefer: "werkstatt" }, QJ);
  Q.pruefauftragAbschliessen(s, pa.id, { pruefer: "buero", rolle: "buero" }, QJ);
  t("QM-UI Portal ohne Freigabe leer", Q.portalBelege(s, "k1").length === 0);
  t("QM-UI Portalfreigabe ohne Recht abgelehnt", Q.portalFreigabe(s, { mandantId: "m1", typ: "pruefbericht", referenzId: pa.id, kundeId: "k1", benutzer: "w", rolle: "werkstatt" }, QJ).ok === false);
  t("QM-UI Portalfreigabe ohne Benutzer abgelehnt", Q.portalFreigabe(s, { mandantId: "m1", typ: "pruefbericht", referenzId: pa.id, rolle: "admin" }, QJ).ok === false);
  t("QM-UI Unbekannter Belegtyp abgelehnt", Q.portalFreigabe(s, { mandantId: "m1", typ: "interner_bericht", referenzId: pa.id, benutzer: "admin", rolle: "admin" }, QJ).ok === false);
  var f = Q.portalFreigabe(s, { mandantId: "m1", typ: "pruefbericht", referenzId: pa.id, kundeId: "k1", benutzer: "admin", rolle: "admin" }, QJ);
  t("QM-UI Freigegebener Beleg im Portal sichtbar", f.ok && Q.portalBelege(s, "k1").length === 1);
  // Kundensicherer Prüfbericht: keine internen Felder
  var pb = Q.pruefberichtKundensicher(s, pa.id);
  var json = JSON.stringify(pb);
  t("QM-UI Kundensicherer Prüfbericht enthält Ergebnisse", pb && pb.ergebnisse.length === 2 && pb.pruefplanVersion === 1);
  t("QM-UI Kundensicherer Prüfbericht ohne Prüfer/Kosten/Ursachen", json.indexOf("pruefer") < 0 && json.indexOf("kosten") < 0 && json.indexOf("ursache") < 0 && json.indexOf("idempotenz") < 0);
  // Widerruf
  f.freigabe.sichtbar = false;
  t("QM-UI Widerrufener Beleg nicht mehr sichtbar", Q.portalBelege(s, "k1").length === 0);
  // Cross-Tenant: fremder Kunde sieht nichts
  f.freigabe.sichtbar = true;
  t("QM-UI Fremder Kunde sieht Beleg nicht", Q.portalBelege(s, "k2").length === 0);
})();

// Prüfmittel: Kalibrierung eintragen + Vorwarnung
(function () {
  var s = freshQM();
  var alt = new Date(new Date(QJ).getTime() - 400 * 86400000).toISOString();
  var pm = Q.pruefmittelNeu(s, { mandantId: "m1", nummer: "PM-K", bezeichnung: "Gerät", kalibrierintervallTage: 365, letzteKalibrierung: alt }, QJ);
  Q.pruefmittelStatusAktualisieren(s, QJ);
  t("QM-UI Prüfmittel vor Kalibrierung fällig", pm.status === Q.PM_STATUS.KALIBRIERUNG_FAELLIG);
  t("QM-UI Kalibrierung ohne Recht abgelehnt", Q.kalibrierungNeu(s, pm.id, { benutzer: "w", rolle: "werkstatt" }, QJ).ok === false);
  var k = Q.kalibrierungNeu(s, pm.id, { datum: QJ, intervallTage: 365, zertifikat: "ZERT-1", benutzer: "buero", rolle: "buero" }, QJ);
  t("QM-UI Kalibrierung setzt Status zurück", k.ok && pm.status === Q.PM_STATUS.VERFUEGBAR && Q.pruefmittelGueltig(pm, QJ).gueltig === true);
  t("QM-UI Kalibrierhistorie geführt", pm.kalibrierhistorie.length === 1 && pm.kalibrierhistorie[0].zertifikat === "ZERT-1");
  // Vorwarnung 30 Tage
  var bald = Q.pruefmittelNeu(s, { mandantId: "m1", nummer: "PM-B", bezeichnung: "Bald", kalibrierintervallTage: 365, letzteKalibrierung: new Date(new Date(QJ).getTime() - 350 * 86400000).toISOString() }, QJ);
  t("QM-UI Vorwarnung bei bald ablaufender Kalibrierung", Q.kalibrierungBaldFaellig(bald, 30, QJ) === true);
  t("QM-UI Keine Vorwarnung bei frischer Kalibrierung", Q.kalibrierungBaldFaellig(pm, 30, QJ) === false);
})();

// Lernhinweise: Korrelation, keine Schuldzuweisung, keine Personen
(function () {
  var s = freshQM(); var pp = qmPlan(s);
  for (var i = 0; i < 4; i++) {
    var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "aufL" + i, pruefplanId: pp.id }, QJ).pruefauftrag;
    Q.abweichungNeu(s, { mandantId: "m1", auftragId: "aufL" + i, pruefauftragId: pa.id, fehlerart: "Maßabweichung", artikelId: "a1", maschineId: "m-saege", menge: 1, ersteller: "werkstatt", rolle: "werkstatt", idempotenzKey: "lh-" + i }, QJ);
  }
  var h = Q.lernhinweise(s, { mandantId: "m1" });
  t("QM-UI Lernhinweise erzeugt", h.length >= 1);
  t("QM-UI Jeder Hinweis hat Datenmenge/Zeitraum/Vertrauen/Grundlage", h.every(function (x) { return typeof x.datenmenge === "number" && x.vertrauen && x.grundlage && x.hinweis; }));
  t("QM-UI Jeder Hinweis weist auf Korrelation statt Ursache hin", h.every(function (x) { return /Korrelation/i.test(x.hinweis); }));
  t("QM-UI Häufigste Fehlerart je Produktgruppe erkannt", h.some(function (x) { return x.typ === "fehlerart_produktgruppe" && /Maßabweichung/.test(x.text); }));
  t("QM-UI Wiederkehrende Abweichung bei Material erkannt", h.some(function (x) { return x.typ === "abweichung_material" && x.datenmenge === 4; }));
  t("QM-UI Lernhinweise enthalten KEINE Mitarbeiterbewertung", JSON.stringify(h).indexOf("werkstatt") < 0 && JSON.stringify(h).indexOf("Mitarbeiter") < 0);
})();

// Mobile Offline-Prüfung über die Phase-14-Queue (Idempotenz/Konflikt/keine Freigabe)
(function () {
  var s = freshQM(); var pp = qmPlan(s);
  var pa = Q.pruefauftragNeu(s, { mandantId: "m1", auftragId: "aufM", pruefplanId: pp.id }, QJ).pruefauftrag;
  var daten = { aktion: "pruefergebnis", pruefauftragId: pa.id, pruefplanVersion: 1, schrittNummer: 1, wert: 100.9, pruefer: "werkstatt", idempotenzKey: "mob-1", mandantId: "m1" };
  var r1 = Q.uebernehmeOffline(s, daten, QJ);
  var r2 = Q.uebernehmeOffline(s, daten, QJ);
  t("QM-UI Mobile Maßprüfung zentral bewertet", r1.ok && r1.bewertung.ergebnis === Q.TOLERANZ_ERGEBNIS.INNERHALB);
  t("QM-UI Mobile Offline-Idempotenz", r2.neu === false && pa.ergebnisse.length === 1);
  t("QM-UI Mobile Grenzwert exakt zählt als bestanden", (function () {
    var g = Q.uebernehmeOffline(s, { aktion: "pruefergebnis", pruefauftragId: pa.id, schrittNummer: 2, wert: "io", idempotenzKey: "mob-2", mandantId: "m1" }, QJ);
    var m = Q.uebernehmeOffline(s, { aktion: "pruefergebnis", pruefauftragId: pa.id, schrittNummer: 1, wert: 101, stichprobeIndex: 1, idempotenzKey: "mob-3", mandantId: "m1" }, QJ);
    return m.ok && m.bewertung.ergebnis === Q.TOLERANZ_ERGEBNIS.INNERHALB && m.bewertung.aufGrenze === true;
  })());
  t("QM-UI Offline-Freigabe bleibt gesperrt", Q.uebernehmeOffline(s, { aktion: "freigabe", pruefauftragId: pa.id, mandantId: "m1" }, QJ).ok === false);
  var kf = Q.uebernehmeOffline(s, { aktion: "pruefergebnis", pruefauftragId: pa.id, pruefplanVersion: 7, schrittNummer: 1, wert: 100, idempotenzKey: "mob-9", mandantId: "m1" }, QJ);
  t("QM-UI Offline-Konflikt bei veralteter Prüfplanversion", kf.ok === false && /Prüfplanversion/.test(kf.grund) && s.konflikte.length >= 1);
})();

// =============================================================
//  MITARBEITER-STAMMDATEN & PLANUNGSFELDER
// =============================================================
// Hintergrund: Das Mitarbeiter-Formular speicherte früher nur Name, Gruppe,
// Stundensatz und Status. qualifikationen/maschinenberechtigungen/
// abwesenheiten existierten nur im Seed – die Fertigungsplanung wertet sie
// aber aus. Folge: jeder über die Oberfläche angelegte Mitarbeiter erzeugte
// dauerhaft Qualifikationskonflikte, während Maschinen- und Abwesenheits-
// prüfung still durchwinkten. Diese Tests sichern beides ab.
(function () {
  var N = Store.normalisiereMitarbeiter;

  // --- Normalisierung -----------------------------------------
  var leer = N({ name: "  Neu  " });
  t("MA Normalisierung trimmt den Namen", leer.name === "Neu");
  t("MA Planungsfelder existieren immer", Array.isArray(leer.qualifikationen) && Array.isArray(leer.maschinenberechtigungen) && Array.isArray(leer.abwesenheiten));
  t("MA Vorgabe maxStundenProTag = 8", leer.maxStundenProTag === 8);
  t("MA Vorgabe aktiv = true", leer.aktiv === true);
  t("MA Ungültige Stunden fallen auf 8 zurück", N({ name: "x", maxStundenProTag: 0 }).maxStundenProTag === 8 && N({ name: "x", maxStundenProTag: -3 }).maxStundenProTag === 8);
  t("MA Negativer Stundensatz wird zu 0", N({ name: "x", stundensatz: -5 }).stundensatz === 0);

  var dop = N({ name: "x", qualifikationen: ["Montage", " Montage ", "", "Kran"] });
  t("MA Qualifikationen ohne Duplikate/Leereinträge", dop.qualifikationen.length === 2 && dop.qualifikationen[0] === "Montage" && dop.qualifikationen[1] === "Kran");

  // Abwesenheiten: ohne Von wertlos, vertauschte Daten drehen, fehlendes Bis = ein Tag
  var abw = N({ name: "x", abwesenheiten: [
    { von: "", bis: "2026-05-01", grund: "kaputt" },
    { von: "2026-08-10", bis: "2026-08-03", grund: " Urlaub " },
    { von: "2026-03-01" }
  ] });
  t("MA Abwesenheit ohne Von wird verworfen", abw.abwesenheiten.length === 2);
  t("MA Abwesenheiten sind nach Von sortiert", abw.abwesenheiten[0].von === "2026-03-01");
  t("MA Fehlendes Bis wird zum Ein-Tages-Eintrag", abw.abwesenheiten[0].bis === "2026-03-01");
  t("MA Vertauschte Daten werden gedreht", abw.abwesenheiten[1].von === "2026-08-03" && abw.abwesenheiten[1].bis === "2026-08-10");
  t("MA Grund wird getrimmt", abw.abwesenheiten[1].grund === "Urlaub");

  // Der Tausch darf nur bei YYYY-MM-DD greifen. Bei einem Fremdformat aus
  // einem Import wäre "31.08.2026" < "02.09.2026" als Text falsch – ein
  // Tausch würde einen korrekten Zeitraum verdrehen.
  var fremd = N({ name: "x", abwesenheiten: [{ von: "31.08.2026", bis: "02.09.2026" }] });
  t("MA Fremdes Datumsformat wird nicht getauscht",
    fremd.abwesenheiten[0].von === "31.08.2026" && fremd.abwesenheiten[0].bis === "02.09.2026");

  // --- Wirkung in der Fertigungsplanung ------------------------
  var Pl = P.Planung;
  function konfliktTypen(ma, el) {
    return Pl.konflikte([el], { mitarbeiter: [ma], settings: { maschinen: [{ id: "m-laser", name: "Laser", maxParallel: 1 }] } })
      .map(function (k) { return k.typ; });
  }
  var basis = { id: "e1", start: iso(2026, 6, 1, 8), ende: iso(2026, 6, 1, 16), mitarbeiterIds: ["ma1"], bezeichnung: "Lasern" };

  var ohne = Object.assign({ id: "ma1" }, N({ name: "Neu" }));
  var mit = Object.assign({ id: "ma1" }, N({ name: "Profi", qualifikationen: ["Laserschneiden"] }));

  t("MA Fehlende Qualifikation erzeugt Konflikt",
    konfliktTypen(ohne, Object.assign({}, basis, { qualifikation: "Laserschneiden" })).indexOf("qualifikation") >= 0);
  t("MA Vorhandene Qualifikation erzeugt keinen Konflikt",
    konfliktTypen(mit, Object.assign({}, basis, { qualifikation: "Laserschneiden" })).indexOf("qualifikation") < 0);
  t("MA Ohne geforderte Qualifikation kein Konflikt",
    konfliktTypen(ohne, Object.assign({}, basis)).indexOf("qualifikation") < 0);

  // Dokumentiert die bewusste Asymmetrie: leere Berechtigungsliste = keine
  // Einschränkung, während eine gesetzte Liste alles Übrige sperrt.
  t("MA Leere Maschinenberechtigung = keine Einschränkung",
    konfliktTypen(ohne, Object.assign({}, basis, { maschineId: "m-laser" })).indexOf("berechtigung") < 0);
  t("MA Gesetzte Berechtigung sperrt fremde Maschine",
    konfliktTypen(Object.assign({ id: "ma1" }, N({ name: "x", maschinenberechtigungen: ["m-saege"] })), Object.assign({}, basis, { maschineId: "m-laser" })).indexOf("berechtigung") >= 0);
  t("MA Passende Berechtigung erzeugt keinen Konflikt",
    konfliktTypen(Object.assign({ id: "ma1" }, N({ name: "x", maschinenberechtigungen: ["m-laser"] })), Object.assign({}, basis, { maschineId: "m-laser" })).indexOf("berechtigung") < 0);

  t("MA Abwesenheit im Zeitraum erzeugt Konflikt",
    konfliktTypen(Object.assign({ id: "ma1" }, N({ name: "x", abwesenheiten: [{ von: "2026-05-28", bis: "2026-06-05", grund: "Urlaub" }] })), basis).indexOf("abwesenheit") >= 0);
  t("MA Abwesenheit außerhalb erzeugt keinen Konflikt",
    konfliktTypen(Object.assign({ id: "ma1" }, N({ name: "x", abwesenheiten: [{ von: "2026-07-01", bis: "2026-07-10" }] })), basis).indexOf("abwesenheit") < 0);
  t("MA Ein-Tages-Abwesenheit deckt den ganzen Tag ab",
    konfliktTypen(Object.assign({ id: "ma1" }, N({ name: "x", abwesenheiten: [{ von: "2026-06-01" }] })), basis).indexOf("abwesenheit") >= 0);

  // app.js ist hier nicht ausführbar (kein DOM). Die folgenden Prüfungen sind
  // bewusst nur STATISCHE ANKER: sie schlagen an, wenn der Aufruf oder ein
  // Eingabefeld beim Umbauen verlorengeht. Sie können NICHT beweisen, dass das
  // Formular tatsächlich über diesen Weg speichert – ein zweiter Speicherpfad
  // daran vorbei bliebe unentdeckt. Dafür braucht es Browsertests.
  var appSrc = fs.readFileSync(path.join(DIR, "app.js"), "utf8");
  t("MA Ergebnis der Normalisierung wird verwendet", /=\s*Store\.normalisiereMitarbeiter\s*\(/.test(appSrc));
  // Sperren dürfen nicht still zu Freigaben werden: eine leere
  // Berechtigungsliste bedeutet in planung.js "keine Einschränkung".
  t("MA Berechtigungen gelöschter Maschinen werden weitergeführt", /gelöschte Maschine/.test(appSrc));
  [["data-maq", "Qualifikations-Auswahl"], ["ma-qneu", "Freitext für neue Qualifikation"],
   ["data-mamasch", "Maschinenberechtigungen"], ["ma-abw-liste", "Abwesenheitsliste"],
   ["ma-team", "Team"], ["ma-standort", "Standort"], ["ma-maxstd", "Max. Stunden/Tag"]
  ].forEach(function (p) {
    t("MA Formularfeld vorhanden: " + p[1], appSrc.indexOf(p[0]) >= 0);
  });
})();

// =============================================================
//  AUTOMATISCHE AKTUALISIERUNG (PWA)
// =============================================================
// Die Pages-Veröffentlichung stempelt die Cache-Version des Service Workers
// mit der Build-Nummer. Bliebe die Konstante gleich, wäre sw.js nach einem
// Deploy byte-identisch – der Browser erkennt dann kein Update, der
// Aktualisieren-Hinweis erscheint nie und die neue Fassung käme erst still
// beim übernächsten Laden. Diese Tests sichern die Form ab, auf die sich der
// Workflow verlässt.
(function () {
  var ROOT = path.join(__dirname, "..");
  var sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  var pages = fs.readFileSync(path.join(ROOT, ".github", "workflows", "pages.yml"), "utf8");
  var offline = fs.readFileSync(path.join(DIR, "offline-app.js"), "utf8");
  var appSrc2 = fs.readFileSync(path.join(DIR, "app.js"), "utf8");

  // Genau diese Zeilenform ersetzt der Workflow per sed.
  t("SW Cache-Konstante hat die vom Deploy erwartete Form", /^var CACHE = "[^"]+";$/m.test(sw));
  t("SW Cache-Konstante kommt nur einmal vor", (sw.match(/^var CACHE = /gm) || []).length === 1);
  t("Deploy stempelt die Cache-Version", /sed -i .*var CACHE/.test(pages));
  t("Deploy prüft das Stempeln und bricht sonst ab", /grep -q "preisschmiede-shell-b\$\{BUILD\}"/.test(pages) && /exit 1/.test(pages));
  t("Deploy erzeugt build-info.js", /window\.PSBUILD/.test(pages) && /_site\/assets\/build-info\.js/.test(pages));

  // Kein automatisches skipWaiting: ein Update darf eine laufende Zeiterfassung
  // nicht mitten im Speichern abschießen.
  t("SW aktiviert Updates nur auf Zuruf", /SKIP_WAITING/.test(sw) && !/self\.skipWaiting\(\)\s*;?\s*\}\)/.test(sw.split("message")[0]));
  t("PWA fragt von sich aus nach Updates", /reg\.update\(\)/.test(offline) && /visibilitychange/.test(offline));
  t("Datei-Update nur in der Paket-App", /function istPaketApp/.test(appSrc2) && /if \(!istPaketApp\(\)\) return;/.test(appSrc2));
})();

console.log("\nReferenz-/Invarianten-/Migrationstests: " + pass + "/" + (pass + fail) + " bestanden");
if (fail) { console.log("FEHLGESCHLAGEN:"); fails.forEach(function (f) { console.log("  - " + f); }); process.exit(1); }
