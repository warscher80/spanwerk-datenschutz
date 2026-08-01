/* ============================================================
   Preisschmiede – UI / App-Steuerung
   ============================================================ */
(function (w, d) {
  "use strict";

  var Store = w.Preisschmiede.Store;
  var Auth = w.Preisschmiede.Auth;
  var Calc = w.Preisschmiede.Calc;
  var Konfig = w.Preisschmiede.Konfigurator;
  var Kalk = w.Preisschmiede.Kalkulation;
  var Angebot = w.Preisschmiede.Angebot;
  var Products = w.Preisschmiede.Products;
  var Datanorm = w.Preisschmiede.Datanorm;
  var Ausw = w.Preisschmiede.Auswertung;
  var Plan = w.Preisschmiede.Planung;
  var Dok = w.Preisschmiede.Dokumente;
  var Betrieb = w.Preisschmiede.Betrieb;
  var Mandant = w.Preisschmiede.Mandant;
  var Infra = w.Preisschmiede.Infra;
  var Rechnung = w.Preisschmiede.Rechnung;
  var Offline = w.Preisschmiede.Offline;
  var SCHRITTE = Products.SCHRITTE;
  var fmtEUR = Calc.fmtEUR;

  var db = Store.load();

  // aktueller Kalkulations-Entwurf
  var entwurf = {
    produktKey: "gelaender",
    config: {},
    freiePositionen: [],
    manuelleZeiten: {},
    letzteKalk: null
  };

  // gesammelte Positionen für ein Angebot mit mehreren Positionen
  var sammlung = [];

  // Suche / Filter in der Auftragsliste
  var auftragFilter = { suche: "", status: "" };

  // ---------- Hilfen ----------
  function $(sel, root) { return (root || d).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function el(tag, attrs, html) {
    var e = d.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmtH(x) { return (x || 0).toLocaleString("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " h"; }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString("de-AT"); } catch (e) { return "-"; } }

  function toast(msg, kind) {
    var t = $("#toast");
    if (!t) { return; }
    t.textContent = msg;
    t.className = "toast show " + (kind || "ok");
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.className = "toast"; }, 2600);
  }

  // ---------- Navigation ----------
  var RENDERER = {
    dashboard: function () { renderDashboard(); }, stammdaten: function () { renderStammdaten(); },
    material: function () { renderMaterial(); }, kalkulation: function () { renderKalkulation(); },
    auftraege: function () { renderAuftraege(); }, lernen: function () { renderLernen(); },
    rechnungen: function () { renderRechnungen(); },
    planung: function () { renderPlanung(); },
    dokumente: function () { renderDokumente(); },
    system: function () { renderSystem(); },
    kundenprojekte: function () { renderKundenProjekte(); },
    konfigurator: function () { renderKonfigurator(); },
    kalkulationen: function () { renderKalkulationen(); },
    angebote: function () { renderAngebote(); }
  };
  function navTo(page) {
    // Rollen-Schutz: gesperrte Seiten auf die erste erlaubte umleiten
    if (Auth && Auth.istAngemeldet() && !Auth.darf(page)) {
      try { if (typeof protokolliereFehler === "function") protokolliereFehler({ message: "Zugriff auf gesperrten Bereich „" + page + "\" umgeleitet" }, "berechtigung"); } catch (e) {}
      page = ersteErlaubteSeite();
    }
    $all(".nav li").forEach(function (li) { li.classList.toggle("active", li.dataset.page === page); });
    $all(".page").forEach(function (p) { p.classList.toggle("active", p.id === "page-" + page); });
    try {
      if (RENDERER[page]) RENDERER[page]();
    } catch (e) {
      // Eine fehlerhafte Seite darf die App nicht lahmlegen
      console.error("Render-Fehler (" + page + "):", e);
      var c = $("#page-" + page + " .content");
      if (c) c.innerHTML = '<div class="empty">Diese Ansicht konnte nicht geladen werden. Die übrigen Funktionen sind weiter nutzbar.</div>';
      toast("Hinweis: Eine Ansicht hatte ein Problem und wurde übersprungen.", "err");
    }
    w.scrollTo(0, 0);
  }

  // Rabatt mindert Netto, Deckungsbeitrag und Gewinn um denselben Betrag
  function auftragRabattBetrag(a) { return (a.kalk ? a.kalk.netto : 0) * (a.rabatt || 0) / 100; }
  function auftragNetto(a) { return (a.kalk ? a.kalk.netto : 0) - auftragRabattBetrag(a); }
  // Externe Kosten (Zukauf, Fremdleistungen, Normteile) aus der Nachkalkulation
  function auftragFremd(a) { return Calc.fremdkostenSumme(a); }
  function auftragDB(a) { return (a.kalk ? a.kalk.deckungsbeitrag : 0) - auftragRabattBetrag(a) - auftragFremd(a); }
  function auftragGewinn(a) { return (a.kalk ? a.kalk.gewinn : 0) - auftragRabattBetrag(a) - auftragFremd(a); }

  // ============================================================
  //  DASHBOARD / AUSWERTUNG
  // ============================================================
  // ---- Dashboard-Zustand (Filter + Konfiguration, je Benutzer) --------
  var DASH_PRESETS = [["heute", "Heute"], ["woche", "Diese Woche"], ["monat", "Dieser Monat"], ["quartal", "Dieses Quartal"], ["jahr", "Dieses Jahr"], ["vorjahr", "Vorjahr"], ["gesamt", "Gesamt"], ["custom", "Zeitraum …"]];
  var DASH_KARTEN = [
    { key: "kennzahlen", label: "Hauptkennzahlen", finanz: true },
    { key: "angebote", label: "Angebotsauswertung", finanz: true },
    { key: "auftraege", label: "Aufträge & Warnungen", finanz: false },
    { key: "sollist", label: "Soll-Ist-Auswertung", finanz: true },
    { key: "produktgruppen", label: "Produktgruppenvergleich", finanz: true },
    { key: "kunden", label: "Kundenanalyse", finanz: true },
    { key: "maschinen", label: "Maschinenauslastung", finanz: false },
    { key: "lernen", label: "Lernfunktion", finanz: false }
  ];
  function dashCfgKey() { return "ps.dash." + ((Auth.current() || {}).id || "anon"); }
  function ladeDashCfg() { try { return JSON.parse(w.localStorage.getItem(dashCfgKey())) || {}; } catch (e) { return {}; } }
  function speichereDashCfg(c) { try { w.localStorage.setItem(dashCfgKey(), JSON.stringify(c)); } catch (e) {} }
  var dashState = null;
  function initDashState() {
    var c = ladeDashCfg();
    dashState = {
      preset: c.preset || "jahr", custom: c.custom || { von: "", bis: "" },
      kundeId: "", gruppeKey: "", status: "",
      karten: c.karten || {}, schwellen: c.schwellen || { arbeitAbwProz: 10 }
    };
  }
  function dashKarteSichtbar(key) { return dashState.karten[key] !== false; }
  function dashOpts() { return { preset: dashState.preset, custom: dashState.custom, schwellen: dashState.schwellen }; }
  function dashFilter() { var f = {}; if (dashState.kundeId) f.kundeId = dashState.kundeId; if (dashState.gruppeKey) f.gruppeKey = dashState.gruppeKey; if (dashState.status) f.status = dashState.status; return f; }

  function renderDashboard() {
    if (!dashState) initDashState();
    var root = $("#page-dashboard .content");
    var finanz = Auth.darfFinanzen();
    // Fertigung/Montage: nur operative Ansicht (keine Gewinn-/DB-Daten)
    if (!finanz) { renderDashboardOperativ(root); return; }
    var rep = Ausw.analysiere(db, dashFilter(), dashOpts());
    var html = dashFilterleiste(rep);
    if (dashKarteSichtbar("kennzahlen")) html += dashHauptkennzahlen(rep);
    html += '<div class="grid cols-2" style="margin-top:16px;align-items:start">';
    if (dashKarteSichtbar("angebote")) html += dashAngebote(rep);
    if (dashKarteSichtbar("auftraege")) html += dashAuftraege(rep);
    html += "</div>";
    if (dashKarteSichtbar("produktgruppen")) html += dashProduktgruppen(rep);
    html += '<div class="grid cols-2" style="margin-top:16px;align-items:start">';
    if (dashKarteSichtbar("sollist")) html += dashSollIst(rep);
    if (dashKarteSichtbar("maschinen")) html += dashMaschinen(rep);
    html += "</div>";
    html += '<div class="grid cols-2" style="margin-top:16px;align-items:start">';
    if (dashKarteSichtbar("kunden")) html += dashKunden(rep);
    if (dashKarteSichtbar("lernen")) html += dashLernen(rep);
    html += "</div>";
    html += '<div class="muted" style="font-size:11px;margin-top:14px;text-align:right">Datenstand: ' + fmtDateTime(rep.datenstand) + " · Alle Werte aus real gespeicherten Daten berechnet.</div>";
    root.innerHTML = html;
    verdrahteDashboard(rep);
  }

  function dashFilterleiste(rep) {
    var presetOpt = DASH_PRESETS.map(function (p) { return '<option value="' + p[0] + '"' + (dashState.preset === p[0] ? " selected" : "") + ">" + p[1] + "</option>"; }).join("");
    var kundenOpt = '<option value="">Alle Kunden</option>' + (db.kunden || []).map(function (k) { return '<option value="' + k.id + '"' + (dashState.kundeId === k.id ? " selected" : "") + ">" + esc(k.name) + "</option>"; }).join("");
    var gruppenOpt = '<option value="">Alle Produktgruppen</option>' + (db.produktgruppen || []).map(function (g) { return '<option value="' + g.key + '"' + (dashState.gruppeKey === g.key ? " selected" : "") + ">" + esc(g.name) + "</option>"; }).join("");
    var custom = dashState.preset === "custom" ?
      '<input type="date" id="dash-von" value="' + esc(dashState.custom.von) + '" style="max-width:150px"><input type="date" id="dash-bis" value="' + esc(dashState.custom.bis) + '" style="max-width:150px">' : "";
    // aktive Filter als entfernbare Chips
    var chips = "";
    if (dashState.kundeId) chips += dashChip("Kunde: " + kundeName(dashState.kundeId), "kundeId");
    if (dashState.gruppeKey) chips += dashChip("Gruppe: " + gruppeName(dashState.gruppeKey), "gruppeKey");
    if (dashState.status) chips += dashChip("Status: " + dashState.status, "status");
    return '<div class="card" style="margin-bottom:16px">' +
      '<div class="inline" style="flex-wrap:wrap;gap:8px;align-items:flex-end">' +
        '<label class="fld" style="max-width:180px;margin:0"><span class="lbl">Zeitraum</span><select id="dash-preset">' + presetOpt + "</select></label>" +
        custom +
        '<label class="fld" style="max-width:200px;margin:0"><span class="lbl">Kunde</span><select id="dash-kunde">' + kundenOpt + "</select></label>" +
        '<label class="fld" style="max-width:200px;margin:0"><span class="lbl">Produktgruppe</span><select id="dash-gruppe">' + gruppenOpt + "</select></label>" +
        '<div style="flex:1"></div>' +
        '<button class="btn sm ghost" id="dash-config" type="button">⚙️ Ansicht</button>' +
        '<button class="btn sm ghost" id="dash-export" type="button">⬇️ Export</button>' +
      "</div>" +
      '<div style="margin-top:8px;font-size:12px"><span class="muted">Zeitraum: <strong>' + esc(rep.zeitraum.label) + "</strong> (" + fmtDate(rep.zeitraum.von) + "–" + fmtDate(rep.zeitraum.bis) + ")</span> " + chips + "</div>" +
      "</div>";
  }
  function dashChip(label, feld) { return '<span class="tag" style="cursor:pointer" data-dashchip="' + feld + '" title="Filter entfernen">' + esc(label) + " ✕</span> "; }

  function dashHauptkennzahlen(rep) {
    var hk = rep.hauptkennzahlen;
    function karte(label, kz, fmt, cls, drill) {
      var wert = fmt === "eur" ? fmtEUR(kz.wert) : fmt === "proz" ? Ausw.fmtProz(kz.wert, 1) : fmtZahl(kz.wert);
      var v = kz.vergleich, delta = "";
      if (v && v.vergleichbar && v.proz != null) {
        var pfeil = v.richtung === "auf" ? "▲" : v.richtung === "ab" ? "▼" : "→";
        delta = '<div class="delta ' + (v.richtung === "auf" ? "up" : v.richtung === "ab" ? "down" : "") + '">' + pfeil + " " + Ausw.fmtProz(Math.abs(v.proz), 1) + " ggü. Vorperiode</div>";
      } else { delta = '<div class="delta muted">kein Vergleich</div>'; }
      return '<div class="stat" style="cursor:pointer" data-drill="' + (drill || "") + '"><div class="label">' + esc(label) + '</div><div class="value ' + (cls || "") + '">' + wert + "</div>" + delta + "</div>";
    }
    return '<h3 style="margin:0 0 8px">Betriebswirtschaftliche Lage</h3><div class="grid cols-4">' +
      karte("Offener Angebotswert", hk.offenerAngebotswert, "eur", "accent", "angebote") +
      karte("Angenommener Angebotswert", hk.angenommenerAngebotswert, "eur", "green", "angebote") +
      karte("Auftragswert (netto)", hk.auftragswert, "eur", "", "auftraege") +
      karte("Tatsächl. Selbstkosten", hk.selbstkostenIst, "eur", "", "auftraege") +
      "</div><div class=\"grid cols-4\" style=\"margin-top:14px\">" +
      karte("Deckungsbeitrag", hk.deckungsbeitrag, "eur", "green", "auftraege") +
      karte("Deckungsbeitragsquote", hk.dbQuote, "proz", "", "auftraege") +
      karte("Gewinn (kalkuliert)", hk.gewinnSoll, "eur", "accent", "auftraege") +
      karte("Gewinn (tatsächlich)", hk.gewinnIst, "eur", "accent", "auftraege") +
      "</div><div class=\"grid cols-4\" style=\"margin-top:14px\">" +
      karte("Laufende Aufträge", hk.laufendeAuftraege, "zahl", "", "auftraege") +
      karte("Verspätete Aufträge", hk.verspaeteteAuftraege, "zahl", (hk.verspaeteteAuftraege.wert > 0 ? "warn" : ""), "auftraege") +
      karte("Ø Soll-Ist-Abweichung", hk.avgAbweichung, "proz", "", "sollist") +
      karte("Abschlussquote", hk.abschlussquote, "proz", "", "angebote") +
      "</div>";
  }

  function dashAngebote(rep) {
    var a = rep.angebote;
    var chart = svgBalken([
      { label: "Angenommen", wert: a.angenommen, farbe: "var(--green, #2fbf71)" },
      { label: "Offen", wert: a.offen, farbe: "var(--accent, #f5a623)" },
      { label: "Abgelehnt", wert: a.abgelehnt, farbe: "#e06666" },
      { label: "Abgelaufen", wert: a.abgelaufen, farbe: "#999" }
    ], "Angebote nach Status");
    return '<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">📄 Angebotsauswertung</h3><button class="btn sm ghost" data-drill="angebote" type="button">Details</button></div>' +
      '<div class="grid cols-2" style="margin-top:10px">' +
      stat("Angebotswert", fmtEUR(a.wert), "", a.anzahl + " Angebote") +
      stat("Ø Angebotswert", fmtEUR(a.durchschnittswert)) +
      stat("Abschlussquote (Anzahl)", Ausw.fmtProz(a.abschlussquoteAnzahl, 0), "green") +
      stat("Abschlussquote (Wert)", Ausw.fmtProz(a.abschlussquoteWert, 0), "green") +
      "</div>" + chart +
      '<div class="muted" style="font-size:11px;margin-top:6px">Offene Angebote (' + a.offen + ") werden nicht als abgelehnt gewertet.</div>" +
      "</div>";
  }

  function dashAuftraege(rep) {
    var a = rep.auftraege;
    var warn = rep.warnungen;
    var warnHtml = warn.length ? warn.slice(0, 6).map(function (wn) {
      var ico = wn.prio >= 3 ? "🔴" : wn.prio === 2 ? "🟠" : "🟡";
      return '<div class="insight" style="cursor:pointer" data-warnauftrag="' + wn.auftragId + '"><span class="ico">' + ico + "</span><span>" + esc(wn.text) + "</span></div>";
    }).join("") : '<div class="empty">Keine auffälligen Abweichungen im Zeitraum.</div>';
    return '<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">📁 Aufträge</h3><button class="btn sm ghost" data-drill="auftraege" type="button">Alle Aufträge</button></div>' +
      '<div class="grid cols-3" style="margin-top:10px">' +
      dashMini("Laufend", a.laufend, "auftraege") +
      dashMini("Über Budget", a.ueberBudget, "auftraege", a.ueberBudget > 0 ? "warn" : "") +
      dashMini("Negativer Gewinn", a.negativerGewinn, "auftraege", a.negativerGewinn > 0 ? "warn" : "") +
      dashMini("Ohne Zeiterfassung", a.ohneZeiterfassung, "auftraege") +
      dashMini("Verspätet", a.verspaetet, "auftraege", a.verspaetet > 0 ? "warn" : "") +
      dashMini("Nachkalkuliert", a.anzahlNachkalkuliert, "auftraege") +
      "</div>" +
      '<h4 style="margin:14px 0 6px">Priorisierte Warnungen</h4>' + warnHtml +
      "</div>";
  }
  function dashMini(label, wert, drill, cls) { return '<div class="stat" style="cursor:pointer;padding:8px" data-drill="' + (drill || "") + '"><div class="label">' + esc(label) + '</div><div class="value ' + (cls || "") + '" style="font-size:20px">' + fmtZahl(wert) + "</div></div>"; }

  function dashProduktgruppen(rep) {
    var g = rep.produktgruppen;
    if (!g.length) return '<div class="card" style="margin-top:16px"><h3>🧩 Produktgruppen</h3><div class="empty">Keine beauftragten Aufträge im Zeitraum.</div></div>';
    var rows = g.map(function (x) {
      return '<tr style="cursor:pointer" data-drillgruppe="' + x.key + '"><td><strong>' + esc(x.name) + "</strong>" + (x.belastbar ? "" : ' <span class="tag" title="weniger als 3 Aufträge – statistisch wenig belastbar">wenig Daten</span>') + "</td>" +
        '<td class="num">' + x.anzahl + "</td>" +
        '<td class="num">' + fmtEUR(x.umsatz) + "</td>" +
        '<td class="num">' + fmtEUR(x.db) + "</td>" +
        '<td class="num">' + Ausw.fmtProz(x.dbQuote, 0) + "</td>" +
        '<td class="num">' + fmtEUR(x.gewinn) + "</td>" +
        '<td class="num">' + (x.avgAbweichung != null ? (x.avgAbweichung > 0 ? "+" : "") + Ausw.fmtProz(x.avgAbweichung, 0) : "—") + "</td></tr>";
    }).join("");
    return '<div class="card" style="margin-top:16px"><h3>🧩 Produktgruppenvergleich</h3>' +
      '<div class="table-wrap"><table><thead><tr><th>Gruppe</th><th class="num">Aufträge</th><th class="num">Umsatz</th><th class="num">DB</th><th class="num">DB-Quote</th><th class="num">Gewinn</th><th class="num">Ø Abw.</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  }

  function dashSollIst(rep) {
    var s = rep.sollIst;
    if (!s.zeilen.length) return '<div class="card"><h3>⚖️ Soll-Ist</h3><div class="empty">Noch keine Ist-Zeiten erfasst.</div></div>';
    var rows = s.zeilen.map(function (z) {
      var cls = z.abwProz > 10 ? "warn" : z.abwProz < -10 ? "green" : "";
      return "<tr><td>" + esc(z.label) + '</td><td class="num">' + fmtZahl(z.soll) + '</td><td class="num">' + fmtZahl(z.ist) + '</td><td class="num ' + cls + '">' + (z.abwProz > 0 ? "+" : "") + Ausw.fmtProz(z.abwProz, 0) + "</td></tr>";
    }).join("");
    return '<div class="card"><h3>⚖️ Soll-Ist-Auswertung <span class="sub">' + s.anzahlAuftraege + " Aufträge</span></h3>" +
      '<div class="table-wrap"><table><thead><tr><th>Tätigkeit</th><th class="num">Soll h</th><th class="num">Ist h</th><th class="num">Abw.</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  }

  function dashMaschinen(rep) {
    var m = rep.maschinen.filter(function (x) { return x.hatDaten; });
    if (!m.length) return '<div class="card"><h3>🛠️ Maschinen</h3><div class="empty">Keine Maschinendaten im Zeitraum.</div></div>';
    var rows = m.map(function (x) {
      return "<tr><td>" + esc(x.name) + (x.auffaellig ? ' <span class="tag" title="hohe Rüst-/Zeitabweichung">auffällig</span>' : "") + "</td>" +
        '<td class="num">' + fmtZahl(x.istStunden) + " / " + fmtZahl(x.kapazitaet) + "</td>" +
        '<td class="num">' + Ausw.fmtProz(x.auslastung, 0) + "</td>" +
        '<td class="num ' + (x.ruestabweichung > 15 ? "warn" : "") + '">' + (x.ruestabweichung > 0 ? "+" : "") + Ausw.fmtProz(x.ruestabweichung, 0) + "</td></tr>";
    }).join("");
    return '<div class="card"><h3>🛠️ Maschinenauslastung</h3>' +
      '<div class="table-wrap"><table><thead><tr><th>Maschine</th><th class="num">Ist / Kapaz.</th><th class="num">Auslastung</th><th class="num">Zeitabw.</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="muted" style="font-size:11px;margin-top:4px">Kapazität je Maschine unter Stammdaten pflegbar.</div></div>';
  }

  function dashKunden(rep) {
    var k = rep.kunden.slice(0, 8);
    if (!k.length) return '<div class="card"><h3>👥 Kunden</h3><div class="empty">Keine Kundenaktivität im Zeitraum.</div></div>';
    var rows = k.map(function (x) {
      return "<tr><td><strong>" + esc(x.name) + "</strong></td>" +
        '<td class="num">' + fmtEUR(x.umsatz) + "</td>" +
        '<td class="num">' + fmtEUR(x.deckungsbeitrag) + "</td>" +
        '<td class="num">' + x.auftraege + "</td>" +
        '<td class="num">' + Ausw.fmtProz(x.abschlussquote, 0) + "</td></tr>";
    }).join("");
    return '<div class="card"><h3>👥 Kundenanalyse <span class="sub">Top nach Umsatz</span></h3>' +
      '<div class="table-wrap"><table><thead><tr><th>Kunde</th><th class="num">Umsatz</th><th class="num">DB</th><th class="num">Aufträge</th><th class="num">Abschluss</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  }

  function dashLernen(rep) {
    var l = rep.lernen;
    var gen = l.kalkulationsgenauigkeit != null ? Ausw.fmtProz(l.kalkulationsgenauigkeit, 0) : "—";
    return '<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">🧠 Lernfunktion</h3><button class="btn sm ghost" data-drill="lernen" type="button">Details</button></div>' +
      '<div class="grid cols-2" style="margin-top:10px">' +
      stat("Lernfähige Aufträge", fmtZahl(l.lernfaehigeAuftraege), "", l.belastbar ? "belastbar" : "wenig Daten") +
      stat("Erkannte Muster", fmtZahl(l.erkenntnisse)) +
      stat("Kalkulationsgenauigkeit", gen, "green") +
      stat("Ø Konfidenz", l.avgKonfidenz != null ? Ausw.fmtProz(l.avgKonfidenz, 0) : "—") +
      "</div>" +
      (l.belastbar ? "" : '<div class="muted" style="font-size:11px;margin-top:6px">Genauigkeit wird erst ab 3 nachkalkulierten Aufträgen als belastbar ausgewiesen.</div>') +
      "</div>";
  }

  // Operatives Dashboard für Fertigung/Montage – KEINE Gewinn-/DB-Daten
  function renderDashboardOperativ(root) {
    var offene = (db.auftraege || []).filter(function (a) { return a.status !== "Abgeschlossen" && a.status !== "abgeschlossen"; });
    var html = '<div class="card"><h3>🔧 Meine Aufträge</h3><p class="muted" style="font-size:12px">Zugewiesene Aufträge, Kommissionen und Arbeitsgänge.</p>';
    if (!offene.length) html += '<div class="empty">Aktuell keine offenen Aufträge.</div>';
    else {
      html += '<div class="table-wrap"><table><thead><tr><th>Auftrag</th><th>Kommission</th><th>Status</th><th class="num">Soll/Ist h</th></tr></thead><tbody>';
      offene.slice().reverse().forEach(function (a) {
        var si = Calc.sollIst(a);
        html += "<tr><td><strong>" + esc(a.titel || a.bezeichnung || "—") + "</strong></td>" +
          "<td>" + (a.kommission ? '<span class="tag">' + esc(a.kommission) + "</span>" : "—") + "</td>" +
          "<td>" + statusBadge(a.status) + "</td>" +
          '<td class="num">' + (si ? fmtZahl(si.sollStunden) + " / " + fmtZahl(si.istStunden) : "—") + "</td></tr>";
      });
      html += "</tbody></table></div>";
    }
    html += "</div>";
    root.innerHTML = html;
  }

  // ---- Einfaches, offlinefähiges SVG-Balkendiagramm ------------------
  function svgBalken(daten, titel) {
    var max = Math.max(1, Math.max.apply(null, daten.map(function (d) { return d.wert; })));
    var bw = 46, gap = 22, h = 90, pad = 18;
    var breite = daten.length * (bw + gap) + gap;
    var balken = daten.map(function (d, i) {
      var bh = Math.round(d.wert / max * h);
      var x = gap + i * (bw + gap), y = pad + (h - bh);
      return '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="4" fill="' + d.farbe + '"><title>' + esc(d.label) + ": " + d.wert + "</title></rect>" +
        '<text x="' + (x + bw / 2) + '" y="' + (pad + h + 14) + '" text-anchor="middle" font-size="10" fill="currentColor">' + esc(d.label) + "</text>" +
        '<text x="' + (x + bw / 2) + '" y="' + (y - 4) + '" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">' + d.wert + "</text>";
    }).join("");
    return '<div style="margin-top:10px;overflow-x:auto"><svg role="img" aria-label="' + esc(titel) + '" viewBox="0 0 ' + breite + " " + (h + pad + 22) + '" style="max-width:100%;height:auto;color:var(--text,#333)">' + balken + "</svg></div>";
  }

  function fmtZahl(n) { return (typeof n === "number" ? n : parseFloat(n) || 0).toLocaleString("de-AT", { maximumFractionDigits: 1 }); }
  function fmtDateTime(iso) { try { return new Date(iso).toLocaleString("de-AT"); } catch (e) { return "—"; } }

  // ---- Verdrahtung: Filter, Drill-down, Export, Konfiguration ---------
  function verdrahteDashboard(rep) {
    var ps = $("#dash-preset"); if (ps) ps.onchange = function () { dashState.preset = this.value; persistDash(); renderDashboard(); };
    var vo = $("#dash-von"); if (vo) vo.onchange = function () { dashState.custom.von = this.value; persistDash(); renderDashboard(); };
    var bi = $("#dash-bis"); if (bi) bi.onchange = function () { dashState.custom.bis = this.value; persistDash(); renderDashboard(); };
    var ku = $("#dash-kunde"); if (ku) ku.onchange = function () { dashState.kundeId = this.value; renderDashboard(); };
    var gr = $("#dash-gruppe"); if (gr) gr.onchange = function () { dashState.gruppeKey = this.value; renderDashboard(); };
    $all("[data-dashchip]").forEach(function (c) { c.onclick = function () { dashState[c.dataset.dashchip] = ""; renderDashboard(); }; });
    $all("[data-drill]").forEach(function (el2) { el2.onclick = function () { dashDrill(el2.dataset.drill); }; });
    $all("[data-drillgruppe]").forEach(function (el2) { el2.onclick = function () { dashState.gruppeKey = el2.dataset.drillgruppe; renderDashboard(); }; });
    $all("[data-warnauftrag]").forEach(function (el2) { el2.onclick = function () { dashOeffneAuftrag(el2.dataset.warnauftrag); }; });
    var cfg = $("#dash-config"); if (cfg) cfg.onclick = dashConfigModal;
    var exp = $("#dash-export"); if (exp) exp.onclick = function () { dashExportModal(rep); };
  }
  function persistDash() { var c = ladeDashCfg(); c.preset = dashState.preset; c.custom = dashState.custom; c.karten = dashState.karten; c.schwellen = dashState.schwellen; speichereDashCfg(c); }
  function dashDrill(ziel) {
    if (ziel === "angebote") navTo("angebote");
    else if (ziel === "auftraege") navTo("auftraege");
    else if (ziel === "lernen") navTo("lernen");
    else if (ziel === "sollist") navTo("auftraege");
  }
  function dashOeffneAuftrag(id) {
    var a = (db.auftraege || []).filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    auftragFilter.suche = a.titel || a.nummer || ""; auftragFilter.status = "";
    navTo("auftraege");
  }

  function dashConfigModal() {
    var boxes = DASH_KARTEN.map(function (k) {
      return '<label class="check"><input type="checkbox" data-dk="' + k.key + '"' + (dashKarteSichtbar(k.key) ? " checked" : "") + "> " + esc(k.label) + "</label>";
    }).join("");
    var presetOpt = DASH_PRESETS.map(function (p) { return '<option value="' + p[0] + '"' + (dashState.preset === p[0] ? " selected" : "") + ">" + p[1] + "</option>"; }).join("");
    var body = '<p class="muted" style="font-size:12px">Karten ein-/ausblenden (nur für dich gespeichert).</p><div class="check-grid">' + boxes + "</div>" +
      '<label class="fld" style="margin-top:12px"><span class="lbl">Standard-Zeitraum</span><select id="dk-preset">' + presetOpt + "</select></label>" +
      fld2("Warnschwelle Arbeitsabweichung %", "dk-schwelle", dashState.schwellen.arbeitAbwProz, "number");
    openModal("Dashboard-Ansicht", body, function () {
      $all("[data-dk]").forEach(function (b) { dashState.karten[b.dataset.dk] = b.checked; });
      dashState.preset = $("#dk-preset").value;
      dashState.schwellen.arbeitAbwProz = leseZahl0($("#dk-schwelle").value) || 10;
      persistDash(); renderDashboard();
      return true;
    });
  }

  function dashExportModal(rep) {
    var body = '<p class="muted" style="font-size:12px">Bericht für Zeitraum <strong>' + esc(rep.zeitraum.label) + '</strong>' + (dashState.kundeId ? " · Kunde: " + esc(kundeName(dashState.kundeId)) : "") + (dashState.gruppeKey ? " · Gruppe: " + esc(gruppeName(dashState.gruppeKey)) : "") + ".</p>" +
      '<div class="btn-row" style="flex-wrap:wrap">' +
      '<button class="btn sm" data-rep="angebote" type="button">Angebotsbericht CSV</button>' +
      '<button class="btn sm" data-rep="auftraege" type="button">Auftragsbericht CSV</button>' +
      '<button class="btn sm" data-rep="sollist" type="button">Soll-Ist CSV</button>' +
      '<button class="btn sm" data-rep="produktgruppen" type="button">Produktgruppen CSV</button>' +
      '<button class="btn sm" data-rep="maschinen" type="button">Maschinen CSV</button>' +
      '<button class="btn sm" data-rep="kunden" type="button">Kunden CSV</button>' +
      '<button class="btn sm ghost" data-rep="print" type="button">🖨️ Druckansicht</button>' +
      "</div>";
    openModal("Bericht exportieren", body, null, "Schließen");
    $all("[data-rep]").forEach(function (b) { b.onclick = function () { dashExport(b.dataset.rep, rep); }; });
  }
  function dashExport(typ, rep) {
    var kopf = "Bericht: " + typ + ";Zeitraum: " + rep.zeitraum.label + " (" + fmtDate(rep.zeitraum.von) + "-" + fmtDate(rep.zeitraum.bis) + ");Erstellt: " + fmtDateTime(rep.datenstand);
    var zeilen = [], titel = "Bericht";
    if (typ === "angebote") { titel = "Angebotsbericht"; var a = rep.angebote; zeilen = [["Kennzahl", "Wert"], ["Anzahl", a.anzahl], ["Angebotswert", a.wert], ["Angenommen", a.angenommen], ["Abgelehnt", a.abgelehnt], ["Offen", a.offen], ["Abschlussquote Anzahl %", a.abschlussquoteAnzahl], ["Abschlussquote Wert %", a.abschlussquoteWert]]; }
    else if (typ === "auftraege") { titel = "Auftragsbericht"; zeilen = [["Nummer", "Titel", "Status", "Netto", "SelbstSoll", "SelbstIst", "DB", "GewinnSoll", "GewinnIst", "AbwProz"]].concat(rep.auftraege.alle.map(function (x) { return [x.nummer, x.titel, x.status, x.netto, x.selbstSoll, x.selbstIst != null ? x.selbstIst : "", x.dbSoll, x.gewinnSoll, x.gewinnIst != null ? x.gewinnIst : "", x.abwProz != null ? x.abwProz : ""]; })); }
    else if (typ === "sollist") { titel = "SollIst-Bericht"; zeilen = [["Taetigkeit", "Soll_h", "Ist_h", "AbwAbs", "AbwProz"]].concat(rep.sollIst.zeilen.map(function (z) { return [z.label, z.soll, z.ist, z.abwAbs, z.abwProz]; })); }
    else if (typ === "produktgruppen") { titel = "Produktgruppenbericht"; zeilen = [["Gruppe", "Auftraege", "Umsatz", "Selbst", "DB", "DBQuote", "Gewinn", "GewinnQuote", "AvgAbw", "Belastbar"]].concat(rep.produktgruppen.map(function (g) { return [g.name, g.anzahl, g.umsatz, g.selbst, g.db, g.dbQuote, g.gewinn, g.gewinnQuote, g.avgAbweichung != null ? g.avgAbweichung : "", g.belastbar ? "ja" : "nein"]; })); }
    else if (typ === "maschinen") { titel = "Maschinenbericht"; zeilen = [["Maschine", "Kapazitaet_h", "Ist_h", "Auslastung", "Ruestabweichung", "Auftraege", "Maschinenkosten"]].concat(rep.maschinen.map(function (m) { return [m.name, m.kapazitaet, m.istStunden, m.auslastung, m.ruestabweichung, m.anzahlAuftraege, m.maschinenkosten]; })); }
    else if (typ === "kunden") { titel = "Kundenbericht"; zeilen = [["Kunde", "Angebote", "Angebotswert", "Auftraege", "Umsatz", "DB", "Gewinn", "Abschlussquote"]].concat(rep.kunden.map(function (k) { return [k.name, k.angebote, k.angebotswert, k.auftraege, k.umsatz, k.deckungsbeitrag, k.gewinn, k.abschlussquote]; })); }
    else if (typ === "print") { dashDruck(rep); return; }
    csvDownload(titel + "_" + rep.zeitraum.label.replace(/\s+/g, "_") + ".csv", kopf, zeilen);
  }
  // CSV mit Schutz gegen Formula-Injection (=,+,-,@ am Zellanfang)
  function csvZelle(v) { var s = String(v == null ? "" : v); if (/^[=+\-@]/.test(s)) s = "'" + s; if (/[";\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; return s; }
  function csvDownload(dateiname, kopf, zeilen) {
    var body = zeilen.map(function (z) { return z.map(csvZelle).join(";"); }).join("\r\n");
    var inhalt = "﻿" + kopf + "\r\n\r\n" + body;
    try {
      var blob = new Blob([inhalt], { type: "text/csv;charset=utf-8" });
      var url = w.URL.createObjectURL(blob);
      var a = d.createElement("a"); a.href = url; a.download = dateiname; d.body.appendChild(a); a.click();
      setTimeout(function () { d.body.removeChild(a); w.URL.revokeObjectURL(url); }, 100);
      toast("Export erstellt: " + dateiname);
    } catch (e) { toast("Export nicht möglich.", "err"); }
  }
  function dashDruck(rep) {
    var a = rep.auftraege, an = rep.angebote;
    var html = '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Management-Bericht</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}h1{font-size:18px}h2{font-size:14px;margin-top:18px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;margin-top:6px}td,th{border:1px solid #ddd;padding:4px 6px;text-align:left}.num{text-align:right}.noprint{position:fixed;top:8px;right:8px}@media print{.noprint{display:none}}</style></head><body>' +
      '<div class="noprint"><button onclick="window.print()">Drucken / PDF</button></div>' +
      "<h1>Management-Bericht</h1><p>Zeitraum: <strong>" + esc(rep.zeitraum.label) + "</strong> (" + fmtDate(rep.zeitraum.von) + "–" + fmtDate(rep.zeitraum.bis) + ")" + (dashState.kundeId ? " · Kunde: " + esc(kundeName(dashState.kundeId)) : "") + "<br>Erstellt: " + fmtDateTime(rep.datenstand) + " · Interner Bericht – kein Kundenangebot.</p>" +
      "<h2>Angebote</h2><table><tr><th>Kennzahl</th><th class='num'>Wert</th></tr>" +
      "<tr><td>Angebotswert</td><td class='num'>" + fmtEUR(an.wert) + "</td></tr><tr><td>Angenommen / Abgelehnt / Offen</td><td class='num'>" + an.angenommen + " / " + an.abgelehnt + " / " + an.offen + "</td></tr><tr><td>Abschlussquote (Anzahl)</td><td class='num'>" + Ausw.fmtProz(an.abschlussquoteAnzahl, 0) + "</td></tr></table>" +
      "<h2>Aufträge</h2><table><tr><th>Kennzahl</th><th class='num'>Wert</th></tr>" +
      "<tr><td>Auftragswert netto</td><td class='num'>" + fmtEUR(a.auftragswertNetto) + "</td></tr><tr><td>Deckungsbeitrag</td><td class='num'>" + fmtEUR(a.deckungsbeitrag) + "</td></tr><tr><td>Gewinn (Soll / Ist)</td><td class='num'>" + fmtEUR(a.gewinnSoll) + " / " + fmtEUR(a.gewinnIst) + "</td></tr><tr><td>Ø Soll-Ist-Abweichung</td><td class='num'>" + Ausw.fmtProz(a.avgAbweichung, 0) + "</td></tr></table>" +
      "<h2>Produktgruppen</h2><table><tr><th>Gruppe</th><th class='num'>Umsatz</th><th class='num'>DB</th><th class='num'>Gewinn</th></tr>" +
      rep.produktgruppen.map(function (g) { return "<tr><td>" + esc(g.name) + "</td><td class='num'>" + fmtEUR(g.umsatz) + "</td><td class='num'>" + fmtEUR(g.db) + "</td><td class='num'>" + fmtEUR(g.gewinn) + "</td></tr>"; }).join("") + "</table>" +
      "</body></html>";
    var wp = w.open("", "_blank"); if (!wp) { toast("Bitte Pop-ups erlauben.", "err"); return; }
    wp.document.open(); wp.document.write(html); wp.document.close();
  }

  // ---- Performance-Testdaten (Admin, klar gekennzeichnet) ------------
  function perfTestdaten(n) {
    if (!Auth.istAdmin()) { toast("Nur für Administratoren.", "err"); return; }
    n = Math.max(10, Math.min(5000, n | 0));
    if (!w.confirm("Es werden ~" + n + " Test-Aufträge und ~" + (n * 2) + " Test-Angebote erzeugt (mit _testdaten markiert). Fortfahren?")) return;
    var gruppen = (db.produktgruppen || []).map(function (g) { return g.key; }); if (!gruppen.length) gruppen = ["gelaender"];
    var kunden = db.kunden || []; var jetzt = Date.now(); var t0 = jetzt;
    for (var i = 0; i < n; i++) {
      var gk = gruppen[i % gruppen.length]; var k = kunden[i % Math.max(1, kunden.length)];
      var netto = 1500 + (i * 137 % 9000); var sollH = 20 + i % 60; var faktor = 0.85 + (i % 40) / 100; var istH = sollH * faktor;
      var abgeschlossen = i % 3 !== 0; var erstellt = new Date(jetzt - (i % 330) * 86400000).toISOString();
      db.auftraege.push({
        id: Store.uid(), _testdaten: true, erstellt: erstellt, status: abgeschlossen ? "Abgeschlossen" : "Beauftragt",
        titel: "TEST " + gk + " #" + (i + 1), kundeId: k ? k.id : null, kommission: "TEST-" + (i + 1), gruppeKey: gk, nettowert: netto,
        positionen: [{ produktKey: gk, kalk: { zeiten: { cad: sollH * 0.1, schweissen: sollH * 0.6, montage: sollH * 0.3 }, netto: netto }, ist: abgeschlossen ? { zeiten: { cad: istH * 0.1, schweissen: istH * 0.6, montage: istH * 0.3 } } : null }],
        kalk: { netto: netto, selbstkosten: netto * 0.72, deckungsbeitrag: netto * 0.28, gewinn: netto * 0.12, stundenGesamt: sollH }, fremdkosten: []
      });
    }
    var statuses = ["angenommen", "abgelehnt", "versendet", "Entwurf", "abgelaufen"];
    for (var j = 0; j < n * 2; j++) {
      var gk2 = gruppen[j % gruppen.length]; var k2 = kunden[j % Math.max(1, kunden.length)]; var netto2 = 1000 + (j * 97 % 8000);
      db.angebote.push({
        id: Store.uid(), _testdaten: true, nummer: "TESTAN-" + (j + 1), version: 1, status: statuses[j % statuses.length],
        erstellt: new Date(jetzt - (j % 330) * 86400000).toISOString(), kundeId: k2 ? k2.id : null, kommission: "TEST-" + (j + 1), gruppeKey: gk2, nettowert: netto2,
        positionen: [{ typ: "normal", kurz: "Testposition", menge: 1, einheit: "Pos", einzelpreis: netto2, mwstProz: 20 }]
      });
    }
    Store.save();
    var t1 = Date.now(); Ausw.analysiere(db, {}, { preset: "jahr" }); var t2 = Date.now();
    renderStammdaten();
    toast(n + " Test-Aufträge erzeugt (" + (t1 - t0) + " ms). Dashboard-Aggregation: " + (t2 - t1) + " ms.");
  }
  function perfTestdatenEntfernen() {
    if (!w.confirm("Alle mit _testdaten markierten Datensätze entfernen?")) return;
    db.auftraege = (db.auftraege || []).filter(function (a) { return !a._testdaten; });
    db.angebote = (db.angebote || []).filter(function (a) { return !a._testdaten; });
    Store.save(); renderStammdaten(); toast("Testdaten entfernt.");
  }

  // ============================================================
  //  FERTIGUNGSPLANUNG (Phase 7C)
  // ============================================================
  var PLAN_STATUS = ["geplant", "material fehlt", "bereit", "in Arbeit", "pausiert", "Qualitätsprüfung", "fertig", "bereit zur Montage"];
  var PLAN_VIEWS = [["uebersicht", "📋 Übersicht"], ["maschinen", "🛠️ Maschinen"], ["mitarbeiter", "👷 Team"], ["gantt", "📊 Gantt"], ["kanban", "🗂️ Kanban"], ["montage", "🚚 Montage"], ["werkstatt", "🏭 Werkstatt"]];
  var planState = { view: "uebersicht", filter: { kommission: "", auftragId: "", maschineId: "", status: "" } };

  function planElemente() { return (db.planung && db.planung.elemente) || (db.planung = db.planung || { elemente: [], versionen: [], benachrichtigungen: [], montage: [] }).elemente; }
  function planSettings() { return db.settings; }
  function maschineNameP(id) { var m = (db.settings.maschinen || []).filter(function (x) { return x.id === id; })[0]; return m ? m.name : (id || "—"); }
  function maNamen(ids) { return (ids || []).map(function (id) { var m = (db.mitarbeiter || []).filter(function (x) { return x.id === id; })[0]; return m ? m.name : id; }).join(", ") || "—"; }
  function fmtDT(iso) { if (!iso) return "—"; try { var d = new Date(iso); return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return "—"; } }
  function planAuftragName(id) { var a = (db.auftraege || []).filter(function (x) { return x.id === id; })[0]; return a ? (a.titel || a.nummer || "—") : "—"; }

  function planGefiltert() {
    var f = planState.filter;
    return planElemente().filter(function (e) {
      if (f.kommission && (e.kommission || "").toLowerCase().indexOf(f.kommission.toLowerCase()) < 0) return false;
      if (f.auftragId && e.auftragId !== f.auftragId) return false;
      if (f.maschineId && e.maschineId !== f.maschineId) return false;
      if (f.status && e.status !== f.status) return false;
      return true;
    });
  }

  function renderPlanung() {
    var root = $("#page-planung .content");
    if (!Auth.darfFinanzen()) { renderPlanungWerkstatt(root); return; }
    var alle = planElemente();
    var konf = Plan.konflikte(alle, db, planSettings());
    var opt = Plan.ruestOptimierung(alle, db, planSettings());
    var offeneAuftr = (db.auftraege || []).filter(function (a) { return a.status === "Beauftragt" || a.status === "angelegt"; });
    // Kopf: Tabs + Aktionen
    var tabs = PLAN_VIEWS.map(function (v) { return '<button class="btn sm ' + (planState.view === v[0] ? "primary" : "ghost") + '" data-planview="' + v[0] + '" type="button">' + v[1] + "</button>"; }).join(" ");
    var html = '<div class="card" style="margin-bottom:14px"><div class="btn-row" style="flex-wrap:wrap;gap:6px">' + tabs + "</div>";
    html += planFilterleiste();
    html += "</div>";
    // Konflikt- & Optimierungspanel
    html += '<div class="grid cols-2" style="align-items:start;margin-bottom:14px">';
    html += planKonfliktPanel(konf);
    html += planOptPanel(opt);
    html += "</div>";
    // Ansicht
    if (planState.view === "uebersicht") html += planUebersicht(konf);
    else if (planState.view === "maschinen") html += planMaschinenbelegung();
    else if (planState.view === "mitarbeiter") html += planTeambelegung();
    else if (planState.view === "gantt") html += planGantt(konf);
    else if (planState.view === "kanban") html += planKanban();
    else if (planState.view === "montage") html += planMontage();
    else if (planState.view === "werkstatt") html += planWerkstattVorschau();
    root.innerHTML = html;
    verdrahtePlanung(offeneAuftr);
  }

  function planFilterleiste() {
    var f = planState.filter;
    var auftrOpt = '<option value="">Alle Aufträge</option>' + (db.auftraege || []).map(function (a) { return '<option value="' + a.id + '"' + (f.auftragId === a.id ? " selected" : "") + ">" + esc(a.titel || a.nummer) + "</option>"; }).join("");
    var maschOpt = '<option value="">Alle Maschinen</option>' + (db.settings.maschinen || []).map(function (m) { return '<option value="' + m.id + '"' + (f.maschineId === m.id ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("");
    var statusOpt = '<option value="">Alle Status</option>' + PLAN_STATUS.map(function (s) { return '<option value="' + s + '"' + (f.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("");
    return '<div class="inline" style="flex-wrap:wrap;gap:8px;margin-top:10px">' +
      '<input id="plan-komm" placeholder="🔍 Kommission" value="' + esc(f.kommission) + '" style="flex:1;min-width:160px">' +
      '<select id="plan-auftrag" style="flex:1;min-width:160px">' + auftrOpt + "</select>" +
      '<select id="plan-maschine" style="flex:1;min-width:140px">' + maschOpt + "</select>" +
      '<select id="plan-status" style="flex:1;min-width:130px">' + statusOpt + "</select>" +
      '<button class="btn sm" id="plan-auto" type="button">🤖 Auto-Vorschlag</button>' +
      '<button class="btn sm ghost" id="plan-export" type="button">⬇️ Export</button>' +
      "</div>";
  }

  function planKonfliktPanel(konf) {
    if (!konf.length) return '<div class="card"><h3>✅ Konflikte</h3><div class="empty">Keine Konflikte im aktuellen Plan.</div></div>';
    var rows = konf.slice(0, 12).map(function (k) {
      var ico = k.schwere >= 3 ? "🔴" : k.schwere === 2 ? "🟠" : "🟡";
      return '<div class="insight"><span class="ico">' + ico + '</span><span>' + esc(k.text) + "</span></div>";
    }).join("");
    return '<div class="card"><h3>⚠️ Konflikte <span class="sub">' + konf.length + "</span></h3>" + rows + "</div>";
  }
  function planOptPanel(opt) {
    if (!opt.length) return '<div class="card"><h3>♻️ Rüstoptimierung</h3><div class="empty">Kein Optimierungspotenzial erkannt.</div></div>';
    var rows = opt.slice(0, 6).map(function (o) { return '<div class="insight"><span class="ico">💡</span><span>' + esc(o.text) + "</span></div>"; }).join("");
    return '<div class="card"><h3>♻️ Rüstoptimierung</h3>' + rows + "</div>";
  }

  function konfliktFuer(id, konf) { return konf.filter(function (k) { return (k.elemente || []).indexOf(id) >= 0; }); }

  function planUebersicht(konf) {
    var list = planGefiltert();
    if (!list.length) return '<div class="card"><div class="empty">Keine Planungselemente. Erzeuge über „Auto-Vorschlag" eine Planung aus einem beauftragten Auftrag.</div></div>';
    var rows = list.map(function (e) {
      var kf = konfliktFuer(e.id, konf);
      var badge = kf.length ? ' <span class="tag" style="background:#e06666;color:#fff" title="' + esc(kf.map(function (k) { return k.text; }).join("\n")) + '">' + kf.length + " Konflikt" + (kf.length > 1 ? "e" : "") + "</span>" : "";
      var matBadge = e.material && (e.material.status === "verspätet" || e.material.status === "nicht verfügbar") ? ' <span class="tag" style="background:#e0a000;color:#fff">Material ' + esc(e.material.status) + "</span>" : "";
      return "<tr><td>" + (e.kommission ? '<span class="tag">' + esc(e.kommission) + "</span>" : "—") + "</td>" +
        "<td><strong>" + esc(e.bezeichnung || e.arbeitsgang) + "</strong>" + badge + matBadge + '<br><span class="muted" style="font-size:11px">' + esc(planAuftragName(e.auftragId)) + "</span></td>" +
        "<td>" + esc(maschineNameP(e.maschineId)) + "</td>" +
        "<td>" + esc(maNamen(e.mitarbeiterIds)) + "</td>" +
        "<td>" + fmtDT(e.start) + "<br><span class=\"muted\" style=\"font-size:11px\">" + fmtDT(e.ende) + "</span></td>" +
        '<td class="num">' + fmtZahl(e.planWert || e.dauerStd) + " h</td>" +
        "<td>" + planStatusBadge(e.status) + "</td>" +
        '<td class="num"><button class="btn sm ghost" data-planedit="' + e.id + '" type="button">✏️</button></td></tr>';
    }).join("");
    return '<div class="card"><h3>Arbeitsgänge <span class="sub">' + list.length + "</span></h3>" +
      '<div class="table-wrap"><table><thead><tr><th>Kommission</th><th>Arbeitsgang</th><th>Maschine</th><th>Team</th><th>Beginn/Ende</th><th class="num">Dauer</th><th>Status</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  }
  function planStatusBadge(s) {
    var farbe = { "geplant": "#888", "material fehlt": "#e0a000", "bereit": "#3a7", "in Arbeit": "#2b8", "pausiert": "#e0a000", "Qualitätsprüfung": "#5a9", "fertig": "#2fbf71", "bereit zur Montage": "#39c" }[s] || "#888";
    return '<span class="badge" style="background:' + farbe + ';color:#fff">' + esc(s || "—") + "</span>";
  }

  function planMaschinenbelegung() {
    var list = planGefiltert().filter(function (e) { return e.maschineId; });
    var grp = {};
    list.forEach(function (e) { (grp[e.maschineId] = grp[e.maschineId] || []).push(e); });
    var html = '<div class="card"><h3>🛠️ Maschinenbelegung</h3>';
    (db.settings.maschinen || []).forEach(function (m) {
      var els = (grp[m.id] || []).sort(function (a, b) { return new Date(a.start || 0) - new Date(b.start || 0); });
      if (!els.length) return;
      var kap = Plan.maschineKapazitaetStunden(m);
      var geplant = els.reduce(function (s, e) { return s + Ausw.num(e.planWert || e.dauerStd); }, 0);
      html += '<div style="margin:10px 0 4px"><strong>' + esc(m.name) + '</strong> <span class="muted" style="font-size:12px">· ' + esc(m.standort || "") + " · " + fmtZahl(geplant) + " h geplant · Kapazität " + fmtZahl(kap) + " h/Jahr</span></div>";
      html += '<div class="table-wrap"><table><tbody>' + els.map(function (e) {
        return "<tr><td>" + (e.kommission ? '<span class="tag">' + esc(e.kommission) + "</span> " : "") + esc(e.bezeichnung || e.arbeitsgang) + "</td><td>" + fmtDT(e.start) + " – " + fmtDT(e.ende) + '</td><td class="num">' + fmtZahl(e.planWert || e.dauerStd) + " h</td></tr>";
      }).join("") + "</tbody></table></div>";
    });
    html += "</div>";
    return html;
  }

  function planTeambelegung() {
    var list = planGefiltert();
    var grp = {};
    list.forEach(function (e) { (e.mitarbeiterIds || []).forEach(function (mid) { (grp[mid] = grp[mid] || []).push(e); }); });
    var html = '<div class="card"><h3>👷 Team- & Mitarbeiterbelegung</h3>';
    (db.mitarbeiter || []).forEach(function (ma) {
      var els = (grp[ma.id] || []).sort(function (a, b) { return new Date(a.start || 0) - new Date(b.start || 0); });
      if (!els.length) return;
      html += '<div style="margin:10px 0 4px"><strong>' + esc(ma.name) + '</strong> <span class="muted" style="font-size:12px">· ' + esc(ma.team || "") + " · Qualifikationen: " + esc((ma.qualifikationen || []).join(", ") || "—") + "</span></div>";
      html += '<div class="table-wrap"><table><tbody>' + els.map(function (e) {
        return "<tr><td>" + esc(e.bezeichnung || e.arbeitsgang) + "</td><td>" + fmtDT(e.start) + " – " + fmtDT(e.ende) + "</td><td>" + esc(maschineNameP(e.maschineId)) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    });
    if (html.indexOf("<tr>") < 0) html += '<div class="empty">Noch keine Mitarbeiter zugewiesen.</div>';
    html += "</div>";
    return html;
  }

  function planGantt(konf) {
    var list = planGefiltert().filter(function (e) { return e.start && e.ende; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
    if (!list.length) return '<div class="card"><h3>📊 Gantt</h3><div class="empty">Keine terminierten Arbeitsgänge. Auf kleinen Bildschirmen dient die Übersicht als Liste.</div></div>';
    var min = Math.min.apply(null, list.map(function (e) { return new Date(e.start).getTime(); }));
    var max = Math.max.apply(null, list.map(function (e) { return new Date(e.ende).getTime(); }));
    var span = Math.max(1, max - min);
    var rows = list.map(function (e) {
      var l = (new Date(e.start).getTime() - min) / span * 100;
      var b = Math.max(1.5, (new Date(e.ende).getTime() - new Date(e.start).getTime()) / span * 100);
      var konfl = konfliktFuer(e.id, konf).length > 0;
      var farbe = konfl ? "#e06666" : e.typ === "montage" ? "#39c" : "var(--accent, #f5a623)";
      return '<div style="display:flex;align-items:center;gap:8px;margin:3px 0">' +
        '<div style="width:150px;flex:none;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(e.bezeichnung || "") + '">' + (e.kommission ? esc(e.kommission) + ": " : "") + esc(e.arbeitsgang) + "</div>" +
        '<div style="flex:1;position:relative;height:18px;background:var(--panel-2,#f0f0f0);border-radius:4px">' +
          '<div title="' + esc((e.bezeichnung || "") + " · " + fmtDT(e.start) + "–" + fmtDT(e.ende)) + '" style="position:absolute;left:' + l + "%;width:" + b + "%;top:2px;height:14px;background:" + farbe + ';border-radius:3px"></div>' +
        "</div></div>";
    }).join("");
    return '<div class="card"><h3>📊 Gantt-Ansicht <span class="sub">' + fmtDate(new Date(min).toISOString()) + " – " + fmtDate(new Date(max).toISOString()) + "</span></h3>" +
      '<div style="overflow-x:auto">' + rows + "</div>" +
      '<div class="muted" style="font-size:11px;margin-top:6px">Rot = Arbeitsgang mit Konflikt · Blau = Montage. Terminverschiebung über „Übersicht → ✏️".</div></div>';
  }

  function planKanban() {
    var list = planGefiltert();
    var html = '<div class="card"><h3>🗂️ Fertigungs-Kanban</h3><div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px">';
    PLAN_STATUS.forEach(function (st) {
      var els = list.filter(function (e) { return (e.status || "geplant") === st || (st === "material fehlt" && e.material && e.material.status === "verspätet" && e.status === "geplant"); });
      html += '<div style="flex:0 0 220px;min-width:220px"><div style="font-weight:700;font-size:12px;margin-bottom:6px">' + planStatusBadge(st) + " <span class=\"muted\">" + els.length + "</span></div>";
      html += els.map(function (e) {
        var kb = e.material && e.material.status === "verspätet" ? '<div style="font-size:10px;color:#e0a000">⚠ Material verspätet</div>' : "";
        return '<div class="card" style="padding:8px;margin-bottom:6px;cursor:pointer" data-planedit="' + e.id + '"><strong style="font-size:12px">' + esc(e.arbeitsgang) + "</strong>" +
          (e.kommission ? ' <span class="tag" style="font-size:10px">' + esc(e.kommission) + "</span>" : "") +
          '<div style="font-size:11px;color:var(--muted,#777)">' + esc(planAuftragName(e.auftragId)) + "</div>" +
          '<div style="font-size:10px">' + esc(maschineNameP(e.maschineId)) + " · " + fmtZahl(e.planWert || e.dauerStd) + " h · " + fmtDT(e.start) + "</div>" + kb + "</div>";
      }).join("") || '<div class="muted" style="font-size:11px">—</div>';
      html += "</div>";
    });
    html += "</div></div>";
    return html;
  }

  function planMontage() {
    var list = planGefiltert().filter(function (e) { return e.typ === "montage"; });
    var html = '<div class="card"><h3>🚚 Montageplanung</h3>';
    if (!list.length) html += '<div class="empty">Keine Montageeinsätze geplant.</div>';
    else {
      html += '<div class="table-wrap"><table><thead><tr><th>Kommission</th><th>Auftrag</th><th>Team</th><th>Beginn</th><th class="num">Dauer</th><th>Material</th><th></th></tr></thead><tbody>';
      html += list.map(function (e) {
        return "<tr><td>" + (e.kommission ? '<span class="tag">' + esc(e.kommission) + "</span>" : "—") + "</td><td>" + esc(planAuftragName(e.auftragId)) + "</td><td>" + esc(maNamen(e.mitarbeiterIds)) + "</td><td>" + fmtDT(e.start) + '</td><td class="num">' + fmtZahl(e.planWert || e.dauerStd) + " h</td><td>" + esc((e.material && e.material.status) || "—") + '</td><td class="num"><button class="btn sm ghost" data-planedit="' + e.id + '" type="button">✏️</button></td></tr>';
      }).join("");
      html += "</tbody></table></div>";
    }
    html += '<div class="muted" style="font-size:11px;margin-top:6px">Montageeinsätze prüfen Team-, Fahrzeug- und Hebegerätverfügbarkeit gegen andere Termine.</div></div>';
    return html;
  }

  // Werkstattansicht (auch als eigene Rolle) – KEINE Finanzdaten
  function planWerkstattVorschau() { return planWerkstattHTML(); }
  function renderPlanungWerkstatt(root) { root.innerHTML = planWerkstattHTML(); verdrahtePlanungWerkstatt(); }
  function planWerkstattHTML() {
    var heute = new Date(); heute.setHours(0, 0, 0, 0);
    var morgen = new Date(heute.getTime() + 86400000);
    var alle = planElemente();
    var heuteEls = alle.filter(function (e) { return e.start && new Date(e.start) >= heute && new Date(e.start) < morgen; });
    var naechste = alle.filter(function (e) { return e.start && new Date(e.start) >= morgen && (e.status !== "fertig"); }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); }).slice(0, 8);
    function zeile(e) {
      var mat = e.material && e.material.status === "verspätet" ? ' <span class="tag" style="background:#e0a000;color:#fff">Material fehlt</span>' : "";
      return "<tr><td>" + (e.kommission ? '<span class="tag">' + esc(e.kommission) + "</span>" : "—") + "</td>" +
        "<td><strong>" + esc(e.arbeitsgang) + "</strong>" + mat + "</td>" +
        "<td>" + esc(maschineNameP(e.maschineId)) + "</td><td>" + esc(maNamen(e.mitarbeiterIds)) + "</td>" +
        '<td class="num">' + fmtZahl(e.planWert || e.dauerStd) + " h</td><td>" + planStatusBadge(e.status) + "</td>" +
        '<td class="num"><button class="btn sm primary" data-planstart="' + e.id + '" type="button">▶ Start</button></td></tr>';
    }
    var html = '<div class="card"><h3>🏭 Werkstatt – heute</h3>';
    if (!heuteEls.length) html += '<div class="empty">Für heute sind keine Arbeitsgänge geplant.</div>';
    else html += '<div class="table-wrap"><table><thead><tr><th>Kommission</th><th>Arbeitsgang</th><th>Maschine</th><th>Team</th><th class="num">Soll</th><th>Status</th><th></th></tr></thead><tbody>' + heuteEls.map(zeile).join("") + "</tbody></table></div>";
    html += "</div>";
    html += '<div class="card" style="margin-top:12px"><h3>Nächste Arbeitsgänge</h3>';
    html += naechste.length ? '<div class="table-wrap"><table><tbody>' + naechste.map(function (e) { return "<tr><td>" + (e.kommission ? '<span class="tag">' + esc(e.kommission) + "</span> " : "") + esc(e.arbeitsgang) + "</td><td>" + fmtDT(e.start) + "</td><td>" + esc(maschineNameP(e.maschineId)) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">—</div>';
    html += '<div class="muted" style="font-size:11px;margin-top:6px">Werkstattansicht – nur operative Fertigungsdaten, keine vertraulichen Kennzahlen.</div></div>';
    return html;
  }
  function verdrahtePlanungWerkstatt() {
    $all("[data-planstart]").forEach(function (b) { b.onclick = function () { planStart(b.dataset.planstart); }; });
  }
  function planStart(id) {
    var e = planElemente().filter(function (x) { return x.id === id; })[0]; if (!e) return;
    e.status = "in Arbeit"; e.startIst = e.startIst || Store.nowISO(); Store.save();
    toast("Arbeitsgang gestartet – Zeiterfassung läuft.");
    if (Auth.darfFinanzen()) renderPlanung(); else renderPlanungWerkstatt($("#page-planung .content"));
  }

  function verdrahtePlanung(offeneAuftr) {
    $all("[data-planview]").forEach(function (b) { b.onclick = function () { planState.view = b.dataset.planview; renderPlanung(); }; });
    var pk = $("#plan-komm"); if (pk) pk.addEventListener("input", function () { planState.filter.kommission = this.value; renderPlanung(); });
    var pa = $("#plan-auftrag"); if (pa) pa.onchange = function () { planState.filter.auftragId = this.value; renderPlanung(); };
    var pm = $("#plan-maschine"); if (pm) pm.onchange = function () { planState.filter.maschineId = this.value; renderPlanung(); };
    var pst = $("#plan-status"); if (pst) pst.onchange = function () { planState.filter.status = this.value; renderPlanung(); };
    var pauto = $("#plan-auto"); if (pauto) pauto.onclick = function () { planAutoDialog(offeneAuftr); };
    var pexp = $("#plan-export"); if (pexp) pexp.onclick = planExport;
    $all("[data-planedit]").forEach(function (b) { b.onclick = function () { planElementModal(b.dataset.planedit); }; });
    $all("[data-planstart]").forEach(function (b) { b.onclick = function () { planStart(b.dataset.planstart); }; });
  }

  // ---- Element bearbeiten (konfliktgeprüft) -------------------------
  function planElementModal(id) {
    var e = planElemente().filter(function (x) { return x.id === id; })[0]; if (!e) return;
    var maschOpt = '<option value="">— keine —</option>' + (db.settings.maschinen || []).map(function (m) { return '<option value="' + m.id + '"' + (e.maschineId === m.id ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("");
    var maBoxes = (db.mitarbeiter || []).map(function (m) { return '<label class="check"><input type="checkbox" data-planma="' + m.id + '"' + ((e.mitarbeiterIds || []).indexOf(m.id) >= 0 ? " checked" : "") + "> " + esc(m.name) + "</label>"; }).join("");
    var statusOpt = PLAN_STATUS.map(function (s) { return '<option value="' + s + '"' + (e.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("");
    var matOpt = ["nicht geprüft", "verfügbar", "teilweise verfügbar", "bestellt", "verspätet", "gesperrt", "nicht verfügbar"].map(function (s) { return '<option value="' + s + '"' + (e.material && e.material.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("");
    var startVal = e.start ? new Date(e.start).toISOString().slice(0, 16) : "";
    var body = '<div class="muted" style="font-size:12px">' + esc(e.bezeichnung || e.arbeitsgang) + " · " + esc(planAuftragName(e.auftragId)) + "</div>" +
      '<div class="inline"><label class="fld"><span class="lbl">Beginn</span><input type="datetime-local" id="pe-start" value="' + startVal + '"></label>' + fld2("Dauer (h)", "pe-dauer", e.planWert || e.dauerStd, "number") + "</div>" +
      '<div class="inline"><label class="fld"><span class="lbl">Maschine</span><select id="pe-maschine">' + maschOpt + '</select></label><label class="fld"><span class="lbl">Status</span><select id="pe-status">' + statusOpt + "</select></label></div>" +
      '<label class="fld"><span class="lbl">Materialstatus</span><select id="pe-material">' + matOpt + "</select></label>" +
      '<div class="inline"><label class="fld"><span class="lbl">Fixtermin (nicht verschiebbar)</span><select id="pe-fix"><option value="0">nein</option><option value="1"' + (e.fixtermin ? " selected" : "") + ">ja</option></select></label></div>" +
      '<div class="fld"><span class="lbl">Mitarbeiter / Team</span><div class="check-grid">' + maBoxes + "</div></div>";
    openModal("Arbeitsgang planen", body, function () {
      var kopie = JSON.parse(JSON.stringify(e));
      var startISO = $("#pe-start").value ? new Date($("#pe-start").value).toISOString() : null;
      kopie.start = startISO;
      kopie.planWert = leseZahl0($("#pe-dauer").value) || kopie.planWert;
      if (startISO) kopie.ende = Plan.addArbeitsstunden(startISO, kopie.planWert, planSettings()).toISOString();
      kopie.maschineId = $("#pe-maschine").value || null;
      kopie.status = $("#pe-status").value;
      kopie.material = { status: $("#pe-material").value, werkstoff: (e.material || {}).werkstoff };
      kopie.fixtermin = $("#pe-fix").value === "1"; kopie.verschiebbar = !kopie.fixtermin;
      kopie.mitarbeiterIds = $all("[data-planma]").filter(function (b) { return b.checked; }).map(function (b) { return b.dataset.planma; });
      // Konfliktprüfung mit der geänderten Kopie
      var probe = planElemente().map(function (x) { return x.id === id ? kopie : x; });
      var neueKonf = Plan.konflikte(probe, db, planSettings()).filter(function (k) { return (k.elemente || []).indexOf(id) >= 0; });
      if (neueKonf.length && !confirm("Diese Änderung erzeugt Konflikte:\n- " + neueKonf.map(function (k) { return k.text; }).join("\n- ") + "\n\nTrotzdem speichern?")) return false;
      Object.keys(kopie).forEach(function (k) { e[k] = kopie[k]; });
      Store.save(); toast("Planung gespeichert."); renderPlanung();
      return true;
    });
  }

  // ---- Automatischer Planungsvorschlag (nicht-destruktiv) ----------
  function planAutoDialog(offeneAuftr) {
    if (!offeneAuftr.length) { toast("Keine beauftragten Aufträge zum Einplanen.", "err"); return; }
    var opt = offeneAuftr.map(function (a) { return '<option value="' + a.id + '">' + esc(a.titel || a.nummer) + (a.kommission ? " · " + esc(a.kommission) : "") + "</option>"; }).join("");
    var body = '<label class="fld"><span class="lbl">Auftrag</span><select id="pa-auftrag">' + opt + "</select></label>" +
      '<label class="fld"><span class="lbl">Frühester Start</span><input type="date" id="pa-start" value="' + new Date().toISOString().slice(0, 10) + '"></label>' +
      '<p class="hint">Der Vorschlag terminiert die Arbeitsgänge nach Ablaufreihenfolge und Maschinenkapazität. Bestehende Planungen werden erst nach ausdrücklicher Übernahme ersetzt.</p>';
    openModal("Automatischer Planungsvorschlag", body, function () {
      var aid = $("#pa-auftrag").value;
      var a = (db.auftraege || []).filter(function (x) { return x.id === aid; })[0]; if (!a) return false;
      var startAb = $("#pa-start").value ? new Date($("#pa-start").value + "T07:00:00").toISOString() : null;
      // vorhandene Elemente dieses Auftrags oder neu aus Kalkulation
      var bestehend = planElemente().filter(function (e) { return e.auftragId === aid; });
      var basis = bestehend.length ? JSON.parse(JSON.stringify(bestehend)) : Plan.planAusAuftrag(a, db, planSettings());
      var vor = Plan.autoPlan(basis, db, planSettings(), startAb);
      if (!vor.ok) { toast(vor.grund, "err"); return false; }
      // Zweites Modal (Vorschlag) ersetzt den Inhalt – nicht automatisch schließen,
      // sonst würde das gerade geöffnete Vorschlagsmodal wieder versteckt.
      planVorschlagAnzeigen(a, vor, bestehend.length > 0);
      return false;
    }, "Vorschlag erstellen");
  }
  function planVorschlagAnzeigen(auftrag, vor, ersetzt) {
    var rows = vor.elemente.map(function (e) {
      var kf = (vor.konflikte || []).filter(function (k) { return (k.elemente || []).indexOf(e.id) >= 0; });
      return "<tr><td>" + esc(e.arbeitsgang) + "</td><td>" + esc(maschineNameP(e.maschineId)) + "</td><td>" + fmtDT(e.start) + "</td><td>" + fmtDT(e.ende) + "</td><td>" + (kf.length ? '<span style="color:#e06666">' + kf.length + " ⚠</span>" : "✓") + "</td></tr>";
    }).join("");
    var konfHinweis = (vor.konflikte && vor.konflikte.length) ? '<div class="fehler-box" style="margin-top:8px">' + vor.konflikte.length + " Konflikt(e) im Vorschlag: " + esc(vor.konflikte.slice(0, 4).map(function (k) { return k.text; }).join(" · ")) + "</div>" : '<div class="muted" style="font-size:12px;margin-top:6px">Keine Konflikte im Vorschlag.</div>';
    var body = '<p class="muted" style="font-size:12px">' + esc(vor.grund) + "</p>" +
      '<div class="table-wrap"><table><thead><tr><th>Arbeitsgang</th><th>Maschine</th><th>Beginn</th><th>Ende</th><th>Konflikt</th></tr></thead><tbody>' + rows + "</tbody></table></div>" + konfHinweis;
    openModal("Vorschlag für " + (auftrag.titel || auftrag.nummer), body, function () {
      // Übernehmen: bestehende Elemente des Auftrags ersetzen, Version protokollieren
      db.planung.elemente = planElemente().filter(function (e) { return e.auftragId !== auftrag.id; }).concat(vor.elemente);
      (db.planung.versionen = db.planung.versionen || []).push({ datum: Store.nowISO(), benutzer: (Auth.current() || {}).benutzername || "", auftragId: auftrag.id, grund: "Automatischer Planungsvorschlag übernommen", anzahl: vor.elemente.length });
      (db.planung.benachrichtigungen = db.planung.benachrichtigungen || []).push({ id: Store.uid(), typ: "planaenderung", text: "Planung für " + (auftrag.titel || auftrag.nummer) + " aktualisiert.", datum: Store.nowISO(), gelesen: false });
      Store.save(); toast("Planungsvorschlag übernommen."); planState.filter.auftragId = auftrag.id; renderPlanung();
      return true;
    }, "Vorschlag übernehmen");
  }

  function planExport() {
    var list = planGefiltert();
    var zeilen = [["Kommission", "Auftrag", "Arbeitsgang", "Maschine", "Team", "Beginn", "Ende", "Dauer_h", "Status", "Material"]].concat(list.map(function (e) {
      return [e.kommission, planAuftragName(e.auftragId), e.arbeitsgang, maschineNameP(e.maschineId), maNamen(e.mitarbeiterIds), e.start || "", e.ende || "", e.planWert || e.dauerStd, e.status, (e.material && e.material.status) || ""];
    }));
    csvDownload("Fertigungsplan.csv", "Fertigungsplan;Erstellt: " + fmtDateTime(new Date().toISOString()) + ";Filter Kommission: " + (planState.filter.kommission || "alle"), zeilen);
  }

  // ============================================================
  //  DOKUMENTE / ZEICHNUNGEN / STÜCKLISTEN (Phase 7D)
  // ============================================================
  var dokState = { selId: null, filter: { suche: "", typ: "" }, analyse: null };
  function dokListe() { return db.dokumente || (db.dokumente = []); }
  function dokById(id) { return dokListe().filter(function (x) { return x.id === id; })[0] || null; }

  function renderDokumente() {
    var root = $("#page-dokumente .content");
    if (dokState.selId && dokById(dokState.selId)) renderDokDetail(root, dokById(dokState.selId));
    else renderDokListe(root);
  }

  function renderDokListe(root) {
    var f = dokState.filter;
    var typOpt = '<option value="">Alle Typen</option>' + Dok.DOKUMENTTYPEN.map(function (t) { return '<option value="' + t + '"' + (f.typ === t ? " selected" : "") + ">" + t + "</option>"; }).join("");
    var liste = dokListe().filter(function (d) {
      if (f.typ && d.typ !== f.typ) return false;
      if (f.suche) { var hay = [d.nummer, d.dateiname, d.zeichnungsnummer, d.beschreibung, d.kommission].filter(Boolean).join(" ").toLowerCase(); if (hay.indexOf(f.suche.toLowerCase()) < 0) return false; }
      return true;
    });
    var rows = liste.length ? liste.slice().reverse().map(function (d) {
      var real = d.format && d.format.real;
      return "<tr><td><strong>" + esc(d.nummer) + "</strong>" + (d._beispiel ? ' <span class="tag">Beispiel</span>' : "") + "</td>" +
        "<td>" + esc(d.typ) + "</td>" +
        "<td>" + esc(d.dateiname) + (real ? "" : ' <span class="tag" style="background:#e0a000;color:#fff" title="' + esc(d.format ? d.format.label : "") + '">nur Ablage</span>') + "</td>" +
        "<td>" + (d.zeichnungsnummer ? esc(d.zeichnungsnummer) + (d.revision ? " · Rev " + esc(d.revision) : "") : "—") + "</td>" +
        "<td>" + (d.kommission ? '<span class="tag">' + esc(d.kommission) + "</span>" : "—") + "</td>" +
        '<td class="num">v' + (d.version || 1) + "</td>" +
        '<td class="num"><button class="btn sm" data-dokopen="' + d.id + '" type="button">Öffnen</button></td></tr>';
    }).join("") : '<tr><td colspan="7" class="muted" style="text-align:center;padding:16px">Keine Dokumente.</td></tr>';
    root.innerHTML = '<div class="card"><div class="btn-row" style="margin-bottom:10px"><button class="btn primary sm" id="dok-upload" type="button">⬆️ Dokument hochladen</button></div>' +
      '<div class="inline" style="margin-bottom:10px"><input id="dok-suche" placeholder="🔍 Nummer, Zeichnung, Kommission, Dateiname" value="' + esc(f.suche) + '" style="flex:2"><select id="dok-typ" style="flex:1;min-width:150px">' + typOpt + "</select></div>" +
      '<div class="table-wrap"><table><thead><tr><th>Nummer</th><th>Typ</th><th>Datei</th><th>Zeichnung</th><th>Kommission</th><th class="num">Ver.</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<p class="hint">Unterstützt: PDF (eingebetteter Text), CSV-Stücklisten, Bilder, ASCII-DXF. XLSX bitte als CSV exportieren. DWG/STEP/OCR sind nicht konfiguriert und werden nicht vorgetäuscht.</p></div>';
    $("#dok-upload").onclick = function () { dokUploadDialog(); };
    $("#dok-suche").addEventListener("input", function () { dokState.filter.suche = this.value; renderDokumente(); });
    $("#dok-typ").onchange = function () { dokState.filter.typ = this.value; renderDokumente(); };
    $all("[data-dokopen]", root).forEach(function (b) { b.onclick = function () { dokState.selId = b.dataset.dokopen; dokState.analyse = null; renderDokumente(); }; });
  }

  var dokUploadStaging = null;
  function dokUploadDialog(revisionVon) {
    var typOpt = Dok.DOKUMENTTYPEN.map(function (t) { return "<option>" + t + "</option>"; }).join("");
    var kundenOpt = '<option value="">— Kunde —</option>' + (db.kunden || []).map(function (k) { return '<option value="' + k.id + '">' + esc(k.name) + "</option>"; }).join("");
    var vorgaenger = revisionVon ? dokById(revisionVon) : null;
    var body = '<input type="file" id="dok-file" accept=".pdf,.csv,.png,.jpg,.jpeg,.dxf,.xlsx" style="margin-bottom:8px">' +
      '<div id="dok-pruef" class="muted" style="font-size:12px;margin-bottom:8px"></div>' +
      '<label class="fld"><span class="lbl">Dokumenttyp</span><select id="dok-d-typ">' + typOpt + "</select></label>" +
      '<div class="inline">' + fld2("Zeichnungsnummer", "dok-znr", vorgaenger ? vorgaenger.zeichnungsnummer : "", "text") + fld2("Revision", "dok-rev", "", "text") + "</div>" +
      '<div class="inline"><label class="fld"><span class="lbl">Kunde</span><select id="dok-kunde">' + kundenOpt + "</select></label>" + fld2("Kommission", "dok-komm", vorgaenger ? vorgaenger.kommission : "", "text") + "</div>" +
      fld2("Beschreibung", "dok-besch", "", "text") +
      (vorgaenger ? '<p class="hint">Neue Revision zu ' + esc(vorgaenger.nummer) + " (" + esc(vorgaenger.zeichnungsnummer) + ").</p>" : "");
    dokUploadStaging = null;
    openModal(vorgaenger ? "Neue Revision hochladen" : "Dokument hochladen", body, function () {
      if (!dokUploadStaging) { toast("Bitte zuerst eine Datei wählen.", "err"); return false; }
      if (!dokUploadStaging.pruefung.ok) { toast("Datei nicht zulässig: " + dokUploadStaging.pruefung.fehler.join(" "), "err"); return false; }
      var znr = $("#dok-znr").value.trim();
      var nummer = "DOK-" + new Date().getFullYear() + "-" + ("000" + (db.settings.dokumentZaehler || 1)).slice(-3);
      var dok = {
        id: Store.uid(), nummer: nummer, typ: $("#dok-d-typ").value, dateiname: dokUploadStaging.name,
        format: dokUploadStaging.format, groesse: dokUploadStaging.groesse, pruefsumme: dokUploadStaging.pruefsumme,
        zeichnungsnummer: znr, revision: $("#dok-rev").value.trim(), beschreibung: $("#dok-besch").value.trim(),
        ersteller: (Auth.current() || {}).benutzername || "", hochgeladen: Store.nowISO(), status: "hochgeladen", analysezustand: "nicht analysiert",
        kundeId: $("#dok-kunde").value || null, auftragId: null, kommission: $("#dok-komm").value.trim(),
        version: vorgaenger ? (vorgaenger.version || 1) + 1 : 1, vorgaengerId: vorgaenger ? vorgaenger.id : null, aktuell: true,
        inhalt: dokUploadStaging.inhalt || "", dataUrl: dokUploadStaging.dataUrl || null, analysen: []
      };
      if (vorgaenger) { vorgaenger.aktuell = false; }
      db.settings.dokumentZaehler = (db.settings.dokumentZaehler || 1) + 1;
      dokListe().push(dok); Store.save();
      toast("Dokument gespeichert."); dokState.selId = dok.id; dokState.analyse = null; renderDokumente();
      return true;
    });
    // Datei lesen (asynchron) und validieren
    var fileInput = $("#dok-file");
    if (fileInput) fileInput.onchange = function () {
      var file = this.files && this.files[0]; if (!file) return;
      var fmt = Dok.formatInfo(file.name);
      var reader = new FileReader();
      reader.onload = function () {
        var inhalt = "", dataUrl = null;
        if (fmt.art === "bild") dataUrl = reader.result;
        else inhalt = reader.result;
        var pruefsumme = Dok.pruefsumme(typeof inhalt === "string" && inhalt ? inhalt : file.name + ":" + file.size);
        var pruefung = Dok.pruefeDatei({ name: file.name, groesse: file.size, pruefsumme: pruefsumme }, dokListe());
        dokUploadStaging = { name: file.name, groesse: file.size, inhalt: inhalt, dataUrl: dataUrl, pruefsumme: pruefsumme, format: fmt, pruefung: pruefung };
        var box = $("#dok-pruef"); if (box) {
          box.innerHTML = (pruefung.ok ? "✅ " : "⚠️ ") + esc(fmt.label) + " · " + (file.size / 1024).toFixed(1) + " kB" +
            (pruefung.fehler.length ? '<div style="color:#c00">' + pruefung.fehler.map(esc).join("<br>") + "</div>" : "") +
            (pruefung.warnungen.length ? '<div style="color:#c80">' + pruefung.warnungen.map(esc).join("<br>") + "</div>" : "");
        }
        // Zeichnungsnummer/Revision aus Text vorschlagen (nur Vorschlag)
        if (fmt.art === "pdf" && typeof inhalt === "string") {
          var kopf = Dok.kopfErkennung(Dok.pdfText(inhalt).text);
          var znrV = kopf.filter(function (x) { return x.feld === "zeichnungsnummer"; })[0];
          var revV = kopf.filter(function (x) { return x.feld === "revision"; })[0];
          if (znrV && $("#dok-znr") && !$("#dok-znr").value) $("#dok-znr").value = znrV.wert;
          if (revV && $("#dok-rev") && !$("#dok-rev").value) $("#dok-rev").value = revV.wert;
        }
      };
      if (fmt.art === "bild") reader.readAsDataURL(file); else reader.readAsText(file);
    };
  }

  function renderDokDetail(root, d) {
    var real = d.format && d.format.real;
    var versionen = dokListe().filter(function (x) { return d.zeichnungsnummer && x.zeichnungsnummer === d.zeichnungsnummer; }).sort(function (a, b) { return (a.version || 1) - (b.version || 1); });
    var vorgaenger = d.vorgaengerId ? dokById(d.vorgaengerId) : null;
    var html = '<div class="card"><div class="btn-row" style="margin-bottom:8px;flex-wrap:wrap">' +
      '<button class="btn sm ghost" id="dok-zurueck" type="button">← Liste</button>' +
      (real ? '<button class="btn sm primary" id="dok-analyse" type="button">🔎 Analysieren</button>' : "") +
      (d.zeichnungsnummer ? '<button class="btn sm" id="dok-neurev" type="button">＋ Neue Revision</button>' : "") +
      (vorgaenger ? '<button class="btn sm" id="dok-revcmp" type="button">🔀 Revisionsvergleich</button>' : "") +
      '<button class="btn sm danger" id="dok-del" type="button">🗑️</button></div>';
    html += "<h3>" + esc(d.nummer) + ' <span class="sub">' + esc(d.typ) + "</span></h3>";
    html += '<div class="table-wrap"><table><tbody>' +
      dokZeile("Datei", esc(d.dateiname) + " · " + (d.groesse ? (d.groesse / 1024).toFixed(1) + " kB" : "—")) +
      dokZeile("Format", esc(d.format ? d.format.label : "—") + (real ? "" : ' <span class="tag" style="background:#e0a000;color:#fff">nur Ablage</span>')) +
      dokZeile("Zeichnungsnummer", esc(d.zeichnungsnummer || "—") + (d.revision ? " · Revision " + esc(d.revision) : "")) +
      dokZeile("Kommission", esc(d.kommission || "—")) +
      dokZeile("Prüfsumme", esc(d.pruefsumme)) +
      dokZeile("Version", "v" + (d.version || 1) + (vorgaenger ? " (Vorgänger: " + esc(vorgaenger.nummer) + ")" : "")) +
      dokZeile("Hochgeladen", fmtDate(d.hochgeladen) + " · " + esc(d.ersteller || "")) +
      "</tbody></table></div>";
    // Versionshistorie
    if (versionen.length > 1) {
      html += '<div style="margin-top:10px"><strong>Versionshistorie</strong>' + versionen.map(function (v) {
        return '<div class="zeile"><span>' + esc(v.nummer) + " · Rev " + esc(v.revision || "—") + "</span><strong>" + (v.aktuell ? "aktuell" : "früher") + "</strong></div>";
      }).join("") + "</div>";
    }
    html += "</div>";
    // Vorschau
    html += '<div class="card" style="margin-top:12px"><h3>Vorschau</h3>' + dokVorschauHTML(d) + "</div>";
    // Analyse-Bereich
    if (dokState.analyse && dokState.analyse.dokId === d.id) html += dokAnalyseHTML(d);
    root.innerHTML = html;
    $("#dok-zurueck").onclick = function () { dokState.selId = null; dokState.analyse = null; renderDokumente(); };
    if ($("#dok-analyse")) $("#dok-analyse").onclick = function () { dokAnalyseStart(d); };
    if ($("#dok-neurev")) $("#dok-neurev").onclick = function () { dokUploadDialog(d.id); };
    if ($("#dok-revcmp")) $("#dok-revcmp").onclick = function () { dokRevisionsvergleich(d); };
    $("#dok-del").onclick = function () { if (confirm("Dokument löschen?")) { db.dokumente = dokListe().filter(function (x) { return x.id !== d.id; }); Store.save(); dokState.selId = null; renderDokumente(); } };
    dokAnalyseVerdrahten(d);
  }
  function dokZeile(l, v) { return "<tr><td class=\"muted\" style=\"width:160px\">" + esc(l) + "</td><td>" + v + "</td></tr>"; }

  function dokVorschauHTML(d) {
    var art = d.format ? d.format.art : "";
    if (art === "bild" && d.dataUrl) return '<img src="' + d.dataUrl + '" alt="' + esc(d.dateiname) + '" style="max-width:100%;border-radius:6px">';
    if (art === "pdf") {
      var r = Dok.pdfText(d.inhalt || "");
      if (r.verschluesselt) return '<div class="fehler-box">🔒 ' + esc(r.hinweis) + "</div>";
      if (!r.text) return '<div class="muted">' + esc(r.hinweis) + "</div>";
      return '<div class="muted" style="font-size:12px;margin-bottom:4px">Eingebetteter Text (' + r.seiten + " Seite(n), Sicherheit niedrig):</div><pre style=\"white-space:pre-wrap;font-size:12px;background:var(--panel-2);padding:8px;border-radius:6px;overflow-x:auto\">" + esc(r.text) + "</pre>";
    }
    if (art === "bom") {
      var rows = Dok.parseCSV(d.inhalt || "");
      return '<div class="table-wrap"><table>' + rows.slice(0, 12).map(function (r, i) { return "<tr>" + r.map(function (c) { return (i === 0 ? "<th>" : "<td>") + esc(c) + (i === 0 ? "</th>" : "</td>"); }).join("") + "</tr>"; }).join("") + "</table></div>";
    }
    if (art === "dxf") {
      var dx = Dok.dxfParse(d.inhalt || "");
      if (!dx.ok) return '<div class="fehler-box">' + esc(dx.grund) + "</div>";
      return '<div class="muted" style="font-size:12px">Einheit: ' + esc(dx.units) + " · Entities: " + dx.anzahlEntities + " · Bohrungen (Kreise): " + dx.bohrungen + (dx.bbox ? " · Begrenzung: " + dx.bbox.breite + " × " + dx.bbox.hoehe : "") + "</div>" +
        (dx.warnungen.length ? '<div class="fehler-box" style="margin-top:6px">' + dx.warnungen.map(esc).join("<br>") + "</div>" : "") +
        '<div class="hint">' + esc(dx.hinweis) + "</div>";
    }
    return '<div class="muted">Keine Vorschau für dieses Format. ' + esc(d.format ? d.format.label : "") + "</div>";
  }

  // ---- Analyse (PDF-Kopf / CSV-Stückliste) --------------------------
  function dokAnalyseStart(d) {
    var art = d.format ? d.format.art : "";
    if (art === "pdf") {
      var r = Dok.pdfText(d.inhalt || "");
      if (!r.text) { toast(r.hinweis, "err"); return; }
      dokState.analyse = { dokId: d.id, art: "pdf", werte: Dok.kopfErkennung(r.text), text: r.text };
    } else if (art === "bom") {
      var rows = Dok.parseCSV(d.inhalt || "");
      var mapping = Dok.autoMapping(rows[0] || []);
      var bom = Dok.validiereBom(Dok.bomAusTabelle(rows, mapping, 0));
      dokState.analyse = { dokId: d.id, art: "bom", rows: rows, mapping: mapping, bom: bom, header: 0 };
    } else if (art === "dxf") {
      var dx = Dok.dxfParse(d.inhalt || "");
      var werte = [];
      if (dx.bbox) { werte.push(Dok.erkennungsWert("breite", dx.bbox.breite, dx.units, "dxf", 0.7)); werte.push(Dok.erkennungsWert("laenge", dx.bbox.hoehe, dx.units, "dxf", 0.7)); }
      werte.push(Dok.erkennungsWert("bohrungen", dx.bohrungen, "Stk", "dxf", 0.8));
      dokState.analyse = { dokId: d.id, art: "dxf", werte: werte, dxf: dx };
    } else { toast("Für dieses Format ist keine Analyse verfügbar.", "err"); return; }
    d.analysezustand = "analysiert"; Store.save();
    renderDokumente();
  }
  function dokAnalyseHTML(d) {
    var a = dokState.analyse;
    if (a.art === "bom") return dokBomHTML(d, a);
    // Werte-Tabelle (pdf/dxf)
    var rows = a.werte.map(function (v, i) {
      var st = v.status === "bestätigt" ? '<span class="tag" style="background:#2fbf71;color:#fff">bestätigt</span>' : v.status === "korrigiert" ? '<span class="tag" style="background:#39c;color:#fff">korrigiert</span>' : v.status === "abgelehnt" ? '<span class="tag" style="background:#e06666;color:#fff">abgelehnt</span>' : '<span class="tag">ungeprüft</span>';
      var warn = v.warnungen && v.warnungen.length ? ' <span title="' + esc(v.warnungen.join(", ")) + '" style="color:#e0a000">⚠</span>' : "";
      return "<tr><td>" + esc(v.feld) + "</td><td><strong>" + esc(String(v.wert)) + "</strong> " + esc(v.einheit || "") + warn + '<br><span class="muted" style="font-size:10px">' + esc(v.methode) + " · Konfidenz " + Math.round(v.konfidenz * 100) + "%</span></td><td>" + st + "</td>" +
        '<td class="num" style="white-space:nowrap"><button class="btn sm" data-dokbest="' + i + '" type="button">✓</button> <button class="btn sm ghost" data-dokkorr="' + i + '" type="button">✎</button> <button class="btn sm danger" data-dokab="' + i + '" type="button">✕</button></td></tr>';
    }).join("");
    return '<div class="card" style="margin-top:12px"><h3>🔎 Erkannte Werte <span class="sub">bitte prüfen</span></h3>' +
      '<div class="fehler-box" style="margin-bottom:8px">Automatisch erkannte Werte sind ungeprüft. Sie werden erst nach Bestätigung übernommen und niemals automatisch in eine freigegebene Kalkulation geschrieben.</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Feld</th><th>Erkannt</th><th>Status</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="btn-row" style="margin-top:10px"><button class="btn primary sm" id="dok-uebernahme" type="button">→ Bestätigte in Konfiguration übernehmen</button></div></div>';
  }
  function dokBomHTML(d, a) {
    var headOpt = (a.rows[0] || []).map(function (h, i) { return { h: h, i: i }; });
    function selFor(feld) {
      return '<select data-dokmap="' + feld + '" style="font-size:11px"><option value="">—</option>' + headOpt.map(function (o) { return '<option value="' + o.i + '"' + (a.mapping[feld] === o.i ? " selected" : "") + ">" + esc(o.h) + "</option>"; }).join("") + "</select>";
    }
    var mapRows = ["bezeichnung", "werkstoff", "abmessung", "menge", "einheit", "staerke"].map(function (feld) { return '<div style="display:inline-block;margin:2px 8px 2px 0;font-size:12px">' + feld + ": " + selFor(feld) + "</div>"; }).join("");
    var bomRows = a.bom.map(function (p, i) {
      var mm = Dok.materialMatch(p, db.material);
      var matBadge = mm.status === "eindeutig" ? '<span class="tag" style="background:#2fbf71;color:#fff">' + esc(mm.treffer[0].name) + "</span>" : mm.status === "mehrere" ? '<span class="tag" style="background:#e0a000;color:#fff">' + mm.treffer.length + " mögliche</span>" : '<span class="tag" style="background:#e06666;color:#fff">kein Treffer</span>';
      var fehler = p._fehler && p._fehler.length ? ' <span title="' + esc(p._fehler.join(", ")) + '" style="color:#e06666">⚠</span>' : "";
      return "<tr><td>" + esc(p.position || (i + 1)) + "</td><td>" + esc(p.bezeichnung || "—") + fehler + "</td><td>" + esc(p.werkstoff || "—") + "</td><td>" + esc(p.abmessung || (p.laenge || "") ) + '</td><td class="num">' + esc(String(p._menge != null ? p._menge : "")) + " " + esc(p.einheit || "") + "</td><td>" + matBadge + (mm.hinweise.length ? ' <span title="' + esc(mm.hinweise.join(", ")) + '" style="color:#e0a000">ⓘ</span>' : "") + "</td></tr>";
    }).join("");
    return '<div class="card" style="margin-top:12px"><h3>📄 Stückliste <span class="sub">' + a.bom.length + " Positionen</span></h3>" +
      '<div style="margin-bottom:8px">Spaltenzuordnung: ' + mapRows + "</div>" +
      '<div class="table-wrap"><table><thead><tr><th>Pos</th><th>Bezeichnung</th><th>Werkstoff</th><th>Abmessung</th><th class="num">Menge</th><th>Material-Treffer</th></tr></thead><tbody>' + bomRows + "</tbody></table></div>" +
      '<p class="hint">Mehrdeutige Treffer werden nicht automatisch zusammengeführt. Neue Materialien können als Vorschlag angelegt werden.</p>' +
      '<div class="btn-row" style="margin-top:8px"><button class="btn primary sm" id="dok-bom-konfig" type="button">→ Als Produktkonfiguration übernehmen</button></div></div>';
  }
  function dokAnalyseVerdrahten(d) {
    var a = dokState.analyse; if (!a || a.dokId !== d.id) return;
    $all("[data-dokbest]").forEach(function (b) { b.onclick = function () { Dok.bestaetige(a.werte[+b.dataset.dokbest]); renderDokumente(); }; });
    $all("[data-dokab]").forEach(function (b) { b.onclick = function () { Dok.lehneAb(a.werte[+b.dataset.dokab]); renderDokumente(); }; });
    $all("[data-dokkorr]").forEach(function (b) { b.onclick = function () { var v = a.werte[+b.dataset.dokkorr]; var neu = prompt("Wert korrigieren für „" + v.feld + '":', String(v.wert)); if (neu != null) { Dok.korrigiere(v, neu); renderDokumente(); } }; });
    $all("[data-dokmap]").forEach(function (s) { s.onchange = function () { a.mapping[s.dataset.dokmap] = this.value === "" ? undefined : +this.value; a.bom = Dok.validiereBom(Dok.bomAusTabelle(a.rows, a.mapping, a.header)); renderDokumente(); }; });
    if ($("#dok-uebernahme")) $("#dok-uebernahme").onclick = function () { dokUebernahmeDialog(d, a); };
    if ($("#dok-bom-konfig")) $("#dok-bom-konfig").onclick = function () { dokBomUebernahme(d, a); };
  }

  function dokUebernahmeDialog(d, a) {
    var bestaetigt = Dok.nurBestaetigte(a.werte);
    if (!bestaetigt.length) { toast("Bitte zuerst mindestens einen Wert bestätigen.", "err"); return; }
    var ziele = (db.konfigurationen || []).filter(function (c) { return c.status !== "Archiviert"; });
    var zielOpt = '<option value="__neu">＋ Neue Produktkonfiguration</option>' + ziele.map(function (c) { return '<option value="' + c.id + '">' + esc((c.nummer || "") + " · " + (c.bezeichnung || "")) + "</option>"; }).join("");
    var vorschau = bestaetigt.map(function (v) { return "<tr><td>" + esc(v.feld) + '</td><td class="num">' + esc(String(v.wert)) + " " + esc(v.einheit || "") + "</td></tr>"; }).join("");
    var body = '<label class="fld"><span class="lbl">Ziel</span><select id="dok-ziel">' + zielOpt + "</select></label>" +
      '<div class="muted" style="font-size:12px;margin:6px 0">Zu übernehmende, bestätigte Werte:</div><div class="table-wrap"><table><tbody>' + vorschau + "</tbody></table></div>" +
      '<p class="hint">Es werden nur bestätigte/korrigierte Werte übernommen. Freigegebene Kalkulationen bleiben unverändert.</p>';
    openModal("Werte übernehmen", body, function () {
      var ziel = $("#dok-ziel").value;
      var protokoll = Dok.protokoll(d, a.werte, ziel === "__neu" ? "neue Konfiguration" : ziel);
      protokoll.zeitpunkt = Store.nowISO(); protokoll.benutzer = (Auth.current() || {}).benutzername || "";
      var felder = {};
      bestaetigt.forEach(function (v) { felder[v.feld] = v.wert; });
      // In dieser Version: als Notiz/Vorschlag am Dokument protokolliert (kein
      // automatischer Schreibzugriff auf freigegebene Objekte).
      (d.analysen = d.analysen || []).push(protokoll);
      Store.save();
      toast("Übernahme protokolliert (" + bestaetigt.length + " Werte).");
      renderDokumente();
      return true;
    }, "Übernehmen");
  }

  function dokBomUebernahme(d, a) {
    var gueltig = a.bom.filter(function (p) { return !(p._fehler && p._fehler.length); });
    if (!gueltig.length) { toast("Keine gültigen Stücklistenpositionen.", "err"); return; }
    var body = '<p class="muted" style="font-size:12px">' + gueltig.length + " Positionen werden als neue Produktkonfiguration (Entwurf) angelegt. Materialzuordnung bleibt zur Prüfung offen.</p>" +
      fld2("Bezeichnung der Konfiguration", "dok-cfgname", "Aus Stückliste " + (d.zeichnungsnummer || d.nummer), "text");
    openModal("Als Produktkonfiguration übernehmen", body, function () {
      var cfg = {
        id: Store.uid(), nummer: "KF-" + new Date().getFullYear() + "-" + ("000" + ((db.settings.konfigZaehler || 1))).slice(-3),
        bezeichnung: $("#dok-cfgname").value.trim(), gruppeKey: "blecharbeiten", status: "Entwurf",
        antworten: {}, stueckliste: gueltig.map(function (p) { return { bezeichnung: p.bezeichnung, werkstoff: p.werkstoff, abmessung: p.abmessung, menge: p._menge, einheit: p.einheit }; }),
        quelleDokument: d.id, erstellt: Store.nowISO()
      };
      db.settings.konfigZaehler = (db.settings.konfigZaehler || 1) + 1;
      (db.konfigurationen = db.konfigurationen || []).push(cfg);
      var protokoll = Dok.protokoll(d, [], "neue Konfiguration " + cfg.nummer); protokoll.zeitpunkt = Store.nowISO(); protokoll.positionen = gueltig.length;
      (d.analysen = d.analysen || []).push(protokoll);
      Store.save();
      toast("Konfiguration " + cfg.nummer + " als Entwurf angelegt.");
      renderDokumente();
      return true;
    }, "Übernehmen");
  }

  function dokRevisionsvergleich(d) {
    var vorg = dokById(d.vorgaengerId); if (!vorg) { toast("Kein Vorgänger vorhanden.", "err"); return; }
    var altKopf = Dok.kopfErkennung(Dok.pdfText(vorg.inhalt || "").text);
    var neuKopf = Dok.kopfErkennung(Dok.pdfText(d.inhalt || "").text);
    var rv = Dok.revisionsvergleich(altKopf, neuKopf, [], []);
    var rows = rv.kopf.map(function (k) {
      var farbe = k.status === "geändert" ? "#e0a000" : k.status === "hinzugefügt" ? "#2fbf71" : k.status === "entfernt" ? "#e06666" : "#888";
      return "<tr><td>" + esc(k.feld) + "</td><td>" + esc(String(k.alt == null ? "—" : k.alt)) + "</td><td>" + esc(String(k.neu == null ? "—" : k.neu)) + '</td><td><span class="tag" style="background:' + farbe + ';color:#fff">' + k.status + "</span></td></tr>";
    }).join("");
    var body = '<div class="table-wrap"><table><thead><tr><th>Feld</th><th>' + esc(vorg.revision || "alt") + "</th><th>" + esc(d.revision || "neu") + "</th><th>Status</th></tr></thead><tbody>" + rows + "</tbody></table></div>" +
      (rv.relevant ? '<div class="fehler-box" style="margin-top:8px">Relevante Änderung erkannt. Betroffene Kalkulationen sollten als möglicherweise veraltet geprüft werden – keine automatische Neuberechnung.</div>' : '<div class="muted" style="margin-top:8px">Keine kalkulationsrelevante Änderung erkannt.</div>');
    openModal("Revisionsvergleich " + esc(vorg.revision || "") + " → " + esc(d.revision || ""), body, null, "Schließen");
  }

  // ============================================================
  //  ERSTEINRICHTUNGS-ASSISTENT (Phase 9)
  // ============================================================
  var setupState = { schritt: 0 };
  function setupCfg() { return (db.settings.betrieb.setup = db.settings.betrieb.setup || { abgeschlossen: false, uebersprungen: false, schritt: 0 }); }
  // Wird beim Admin-Login angeboten, solange nicht abgeschlossen/übersprungen
  // und die Firmendaten unvollständig sind. Jederzeit über System/Stammdaten
  // erneut startbar.
  function setupBeiBedarf() {
    var c = setupCfg();
    if (!Auth.istAdmin()) return;
    if (c.abgeschlossen || c.uebersprungen) return;
    // Nur bei wirklich leerer Installation automatisch anbieten (kein
    // Firmenname). Beispiel-/Bestandsdaten werden nicht unterbrochen; die
    // Einrichtung ist dort jederzeit über die System-Seite startbar.
    if (db.settings.firma && db.settings.firma.name) return;
    setTimeout(function () { starteSetup(c.schritt || 0); }, 500);
  }
  var SETUP_SCHRITTE = [
    {
      titel: "Willkommen", render: function () {
        return '<p>Dieser Assistent richtet die wichtigsten Grunddaten ein. Du kannst ihn jederzeit <strong>überspringen</strong> und später unter <em>System</em> oder <em>Stammdaten</em> fortsetzen.</p>' +
          '<p class="muted" style="font-size:12px">Schritte: Firma · Kalkulationsbasis · Maschinen · Material &amp; Lieferanten · Benutzer &amp; Freigabestufe · Zusammenfassung.</p>';
      }, sammle: function () {}
    },
    {
      titel: "Firmendaten", render: function () {
        var f = db.settings.firma || {};
        return '<div class="inline">' + fld2("Firmenname", "su-name", f.name || "", "text") + fld2("Inhaber", "su-inhaber", f.inhaber || "", "text") + "</div>" +
          '<div class="inline">' + fld2("Straße", "su-strasse", f.strasse || "", "text") + fld2("PLZ / Ort", "su-plzort", f.plzOrt || "", "text") + "</div>" +
          '<div class="inline">' + fld2("UID-Nr.", "su-uid", f.uid || "", "text") + fld2("IBAN", "su-iban", f.iban || "", "text") + "</div>" +
          '<p class="hint">Firmenname und UID werden für Angebote benötigt.</p>';
      }, sammle: function () {
        var f = db.settings.firma = db.settings.firma || {};
        f.name = $("#su-name").value.trim(); f.inhaber = $("#su-inhaber").value.trim();
        f.strasse = $("#su-strasse").value.trim(); f.plzOrt = $("#su-plzort").value.trim();
        f.uid = $("#su-uid").value.trim(); f.iban = $("#su-iban").value.trim();
      }
    },
    {
      titel: "Kalkulationsbasis", render: function () {
        var s = db.settings, r = s.rates || {};
        return '<div class="inline">' + fld2("USt %", "su-mwst", s.mwst, "number") + fld2("Gemeinkosten %", "su-gk", s.gemeinkosten, "number") + fld2("Gewinn %", "su-gewinn", s.gewinn, "number") + "</div>" +
          '<div class="inline">' + fld2("CAD €/h", "su-cad", r.cad, "number") + fld2("Fertigung €/h", "su-fert", r.fertigung, "number") + "</div>" +
          '<div class="inline">' + fld2("Montage €/h", "su-mont", r.montage, "number") + fld2("Projektleitung €/h", "su-pl", r.projektleitung, "number") + fld2("Verschnitt %", "su-versch", s.verschnitt, "number") + "</div>";
      }, sammle: function () {
        var s = db.settings; s.rates = s.rates || {};
        s.mwst = leseZahl0($("#su-mwst").value); s.gemeinkosten = leseZahl0($("#su-gk").value); s.gewinn = leseZahl0($("#su-gewinn").value);
        s.rates.cad = leseZahl0($("#su-cad").value); s.rates.fertigung = leseZahl0($("#su-fert").value);
        s.rates.montage = leseZahl0($("#su-mont").value); s.rates.projektleitung = leseZahl0($("#su-pl").value);
        s.verschnitt = leseZahl0($("#su-versch").value);
      }
    },
    {
      titel: "Maschinen & Rüstkosten", render: function () {
        var m = (db.settings.maschinen || []);
        return '<p>Aktuell hinterlegt: <strong>' + m.length + " Maschine(n)</strong>.</p>" +
          '<p class="muted" style="font-size:12px">Jede Maschine benötigt Maschinenstundensatz und Rüstkosten (Rüstzeit × Rüstkostensatz + fixe Rüstkosten). Die Pflege erfolgt unter Stammdaten → Maschinen.</p>' +
          '<button class="btn sm" id="su-goto-maschinen" type="button">Zu den Maschinen (Assistent pausieren)</button>';
      }, sammle: function () {}
    },
    {
      titel: "Material & Lieferanten", render: function () {
        return '<p>Material: <strong>' + (db.material || []).length + "</strong> · Lieferanten: <strong>" + (db.lieferanten || []).length + "</strong>.</p>" +
          '<p class="muted" style="font-size:12px">Materialien und Preise unter Material pflegen oder per CSV/DATANORM importieren (immer Backup vor dem Import).</p>' +
          '<button class="btn sm" id="su-goto-material" type="button">Zum Material (Assistent pausieren)</button>';
      }, sammle: function () {}
    },
    {
      titel: "Benutzer & Freigabestufe", render: function () {
        var stufeOpt = Betrieb.RELEASE_STUFEN.map(function (x) { return '<option value="' + x.key + '"' + ((db.settings.betrieb.releaseStufe || "test") === x.key ? " selected" : "") + ">" + esc(x.label) + "</option>"; }).join("");
        return '<p>Benutzer: <strong>' + (db.users || []).length + "</strong>. Lege für den Pilot eigene Benutzer an (Stammdaten → Benutzer) und vergib eigene PINs – keine Standard-PIN.</p>" +
          '<label class="fld"><span class="lbl">Freigabestufe</span><select id="su-stufe">' + stufeOpt + "</select></label>" +
          '<p class="hint">Ab Stufe „Pilot" wird beim ersten Login ein PIN-Wechsel verlangt.</p>' +
          '<button class="btn sm" id="su-goto-benutzer" type="button">Zu den Benutzern (Assistent pausieren)</button>';
      }, sammle: function () { if ($("#su-stufe")) { db.settings.betrieb.releaseStufe = $("#su-stufe").value; aktualisiereReleaseBanner(); markierePilotFunktionen(); } }
    },
    {
      titel: "Zusammenfassung", render: function () {
        var f = db.settings.firma || {};
        function zeile(ok, t) { return '<div class="zeile"><span>' + esc(t) + "</span><strong>" + (ok ? "✅" : "⚠️") + "</strong></div>"; }
        return '<p>Prüfe den Einrichtungsstand:</p>' +
          zeile(!!f.name, "Firmenname") + zeile(!!f.uid, "UID-Nr.") +
          zeile(db.settings.mwst > 0, "USt gesetzt") + zeile((db.settings.rates || {}).fertigung > 0, "Stundensätze gesetzt") +
          zeile((db.settings.maschinen || []).length > 0, "Mindestens eine Maschine") + zeile((db.material || []).length > 0, "Material vorhanden") +
          zeile((db.users || []).length > 0, "Benutzer vorhanden") +
          '<p class="hint" style="margin-top:8px">Mit „Fertig" wird die Einrichtung als abgeschlossen markiert. Danach jederzeit unter System erneut startbar.</p>';
      }, sammle: function () {}
    }
  ];
  function starteSetup(ab) {
    setupState.schritt = Math.max(0, Math.min(SETUP_SCHRITTE.length - 1, ab || 0));
    zeigeSetupSchritt();
  }
  function zeigeSetupSchritt() {
    var i = setupState.schritt, s = SETUP_SCHRITTE[i], bg = $("#modal-bg");
    var letzter = i === SETUP_SCHRITTE.length - 1;
    bg.innerHTML = '<div class="modal"><h3>Ersteinrichtung <span class="sub">Schritt ' + (i + 1) + " / " + SETUP_SCHRITTE.length + " · " + esc(s.titel) + "</span></h3>" +
      '<div id="su-body">' + s.render() + "</div>" +
      '<div class="btn-row" style="justify-content:space-between;margin-top:16px">' +
        '<button class="btn ghost" id="su-spaeter" type="button">Später</button>' +
        '<span>' + (i > 0 ? '<button class="btn ghost" id="su-zurueck" type="button">Zurück</button> ' : "") +
        '<button class="btn primary" id="su-weiter" type="button">' + (letzter ? "Fertig" : "Weiter") + "</button></span>" +
      "</div></div>";
    bg.classList.add("show");
    function speichereSchritt() { try { s.sammle(); Store.save(); } catch (e) { protokolliereFehler(e, "setup"); } }
    $("#su-spaeter").onclick = function () { speichereSchritt(); var c = setupCfg(); c.uebersprungen = true; c.schritt = i; Store.save(); bg.classList.remove("show"); toast("Einrichtung pausiert – später unter System fortsetzbar."); };
    if ($("#su-zurueck")) $("#su-zurueck").onclick = function () { speichereSchritt(); setupState.schritt = i - 1; zeigeSetupSchritt(); };
    $("#su-weiter").onclick = function () {
      speichereSchritt();
      if (letzter) { var c = setupCfg(); c.abgeschlossen = true; c.uebersprungen = false; c.schritt = i; Store.save(); bg.classList.remove("show"); toast("Ersteinrichtung abgeschlossen. ✅"); if (Auth.darf("system")) renderSystem(); return; }
      setupState.schritt = i + 1; zeigeSetupSchritt();
    };
    // Sprung-Buttons: Assistent pausieren und zur jeweiligen Seite
    function sprung(id, seite) { var b = $(id); if (b) b.onclick = function () { speichereSchritt(); var c = setupCfg(); c.uebersprungen = true; c.schritt = i; Store.save(); bg.classList.remove("show"); navTo(seite); }; }
    sprung("#su-goto-maschinen", "stammdaten"); sprung("#su-goto-material", "material"); sprung("#su-goto-benutzer", "stammdaten");
  }

  // ============================================================
  //  BETRIEB / SYSTEM / FEEDBACK / FEHLERLOG (Phase 9)
  // ============================================================
  function buildInfo() { return (w.PS_BUILD || { version: (db.settings.appVersion || "Web-Vorschau"), build: "—" }); }
  // In-App-Versions-/Änderungsübersicht (Änderungs-/Versionsverwaltung)
  var VERSION_INFO = {
    version: "9 (Pilot)", datum: "Phase 9",
    neu: ["System-/Betriebsseite mit Healthchecks & Backup-Überwachung", "Feedback-Funktion & Fehlerprotokoll mit Fehler-ID", "Freigabestufen + First-Login-PIN-Pflicht ab Pilot"],
    behoben: ["Angebots-Snapshot friert Firma/Kunde jetzt als Kopie ein (kein nachträgliches Ändern alter Angebote)", "Responsive-Überlauf auf Tablet/kleinen Handys behoben"],
    grenzen: ["Offline-/Einzelplatzbetrieb, Datenabgleich per Backup/WLAN", "Fremdsysteme (Frankstahl/KingBill/OCR) nicht angebunden", "Details siehe KNOWN_LIMITATIONS.md"]
  };

  // Technisches Fehlerprotokoll (Ringpuffer, KEINE Secrets/Personendaten)
  function protokolliereFehler(err, modul) {
    try {
      var eintrag = Betrieb.fehlerEintrag({
        modul: modul || "", nachricht: (err && err.message) || String(err || "Fehler"),
        kontext: (err && err.stack ? String(err.stack).split("\n")[1] || "" : "").trim().slice(0, 160),
        browser: (w.navigator && w.navigator.userAgent || "").slice(0, 160),
        rolle: (Auth.current() || {}).rolle || "", zeitpunkt: Store.nowISO()
      }, Date.now());
      db.fehlerlog = db.fehlerlog || [];
      db.fehlerlog.push(eintrag);
      if (db.fehlerlog.length > 200) db.fehlerlog = db.fehlerlog.slice(-200);
      Store.save();
      return eintrag.id;
    } catch (e) { return "ERR-000000"; }
  }

  // ---- Feedback (für alle angemeldeten Rollen) ----------------------
  function feedbackModal(kontextModul) {
    var katOpt = Betrieb.FEEDBACK_KATEGORIEN.map(function (k) { return "<option>" + esc(k) + "</option>"; }).join("");
    var body = '<div class="inline"><label class="fld"><span class="lbl">Kategorie</span><select id="fb-kat">' + katOpt + '</select></label><label class="fld"><span class="lbl">Priorität</span><select id="fb-prio"><option>niedrig</option><option selected>mittel</option><option>hoch</option></select></label></div>' +
      fld2("Betroffener Bereich / Kommission", "fb-modul", kontextModul || "", "text") +
      '<label class="fld"><span class="lbl">Beschreibung</span><textarea id="fb-text" rows="4" style="width:100%" placeholder="Was ist passiert? Was war zu erwarten?"></textarea></label>' +
      '<p class="hint">Es werden keine Passwörter oder vertraulichen Kalkulationsinhalte übertragen. Diese Meldung bleibt lokal in der App.</p>';
    openModal("Feedback / Problem melden", body, function () {
      var text = $("#fb-text").value.trim(); if (!text) { toast("Bitte eine Beschreibung eingeben.", "err"); return false; }
      var nk = db.settings.betrieb.feedbackZaehler || 1;
      var fb = Betrieb.feedbackNeu({
        nummer: "FB-" + ("000" + nk).slice(-3), kategorie: $("#fb-kat").value, prioritaet: $("#fb-prio").value,
        beschreibung: text, modul: $("#fb-modul").value.trim(), kommission: $("#fb-modul").value.trim(),
        benutzer: (Auth.current() || {}).benutzername || "", zeitpunkt: Store.nowISO(),
        kontext: (w.navigator && w.navigator.userAgent || "").slice(0, 120)
      }, Date.now());
      db.feedback = db.feedback || []; db.feedback.push(fb);
      db.settings.betrieb.feedbackZaehler = nk + 1; Store.save();
      toast("Danke! Meldung " + fb.nummer + " gespeichert.");
      if (Auth.darf("system") && $("#page-system.active")) renderSystem();
      return true;
    }, "Senden");
  }
  // Globaler Feedback-Knopf (einmalig), für alle angemeldeten Benutzer
  function initFeedbackButton() {
    if ($("#fab-feedback")) return;
    var btn = el("button", { id: "fab-feedback", type: "button", title: "Feedback / Problem melden", "aria-label": "Feedback melden" }, "💬");
    btn.className = "fab-feedback";
    btn.onclick = function () { feedbackModal(""); };
    d.body.appendChild(btn);
  }

  // ---- System-/Betriebsseite (nur Administration) -------------------
  function renderSystem() {
    var root = $("#page-system .content");
    if (!Auth.darf("system")) { root.innerHTML = '<div class="empty">Kein Zugriff.</div>'; return; }
    var now = Date.now();
    var status = Betrieb.systemstatus(db, buildInfo(), now);
    var hc = Betrieb.healthchecks(db);
    var bk = Betrieb.backupStatus(db, now);
    var warn = Betrieb.betriebswarnungen(db, now);
    var pk = Betrieb.pilotKennzahlen(db, now);
    var st = Betrieb.stufe(status.releaseStufeKey);
    var stufeOpt = Betrieb.RELEASE_STUFEN.map(function (s) { return '<option value="' + s.key + '"' + (s.key === status.releaseStufeKey ? " selected" : "") + ">" + esc(s.label) + "</option>"; }).join("");
    function healthBadge(s) { var f = s === "healthy" ? "#2fbf71" : s === "degraded" ? "#e0a000" : s === "unhealthy" ? "#e06666" : "#888"; return '<span class="badge" style="background:' + f + ';color:#fff">' + esc(s) + "</span>"; }

    var html = '<div class="card" style="border-left:4px solid ' + st.farbe + '"><div class="inline" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<div><strong style="font-size:15px">Freigabestufe: ' + esc(st.label) + "</strong>" + (status.wartungsmodus ? ' <span class="tag" style="background:#e06666;color:#fff">WARTUNGSMODUS</span>' : "") + "</div>" +
      '<div class="inline" style="flex:0"><select id="sys-stufe" style="min-width:200px">' + stufeOpt + '</select><button class="btn sm" id="sys-stufe-set" type="button">Stufe setzen</button>' +
      '<button class="btn sm ' + (status.wartungsmodus ? "danger" : "ghost") + '" id="sys-wartung" type="button">' + (status.wartungsmodus ? "Wartung beenden" : "Wartungsmodus") + '</button>' +
      '<button class="btn sm" id="sys-setup" type="button">🧭 Ersteinrichtung</button></div></div>' +
      '<div class="muted" style="font-size:11px;margin-top:4px">Ersteinrichtung: ' + (db.settings.betrieb.setup && db.settings.betrieb.setup.abgeschlossen ? "abgeschlossen ✅" : (db.settings.betrieb.setup && db.settings.betrieb.setup.uebersprungen ? "pausiert – fortsetzbar" : "offen")) + "</div></div>";

    // Systemstatus + Health
    html += '<div class="grid cols-2" style="align-items:start;margin-top:12px">';
    html += '<div class="card"><h3>🩺 Systemstatus</h3><div class="table-wrap"><table><tbody>' +
      dokZeile("App-Version", esc(status.appVersion) + " · Build " + esc(status.build)) +
      dokZeile("Datenschema", "v" + status.schemaVersion) +
      dokZeile("Speicher", status.speicher.genutztKB + " / " + status.speicher.limitKB + " kB (" + status.speicher.prozent + " %) " + healthBadge(status.speicher.status)) +
      dokZeile("Letztes Backup", bk.letztes ? (fmtDateTime(bk.letztes) + " · " + (bk.alterTage != null ? bk.alterTage + " T alt" : "")) : '<span style="color:#e06666">keins</span>') +
      dokZeile("Letztes fehlgeschl. Backup", status.letztesBackupFehlgeschlagen ? fmtDateTime(status.letztesBackupFehlgeschlagen) : "—") +
      dokZeile("Letzte Migration", status.letzteMigration ? fmtDateTime(status.letzteMigration) : "—") +
      dokZeile("Hintergrundaufgaben", esc(status.hintergrundaufgaben) + " · fehlgeschlagen: " + status.fehlgeschlageneAufgaben) +
      dokZeile("Materialpreis-Sync", esc(status.materialpreisSync)) +
      dokZeile("Datensätze", status.zaehler.kunden + " Kunden · " + status.zaehler.kalkulationen + " Kalk. · " + status.zaehler.angebote + " Angebote · " + status.zaehler.auftraege + " Aufträge") +
      "</tbody></table></div></div>";
    html += '<div class="card"><h3>❤️ Healthchecks <span class="sub">' + healthBadge(hc.gesamt) + "</span></h3>" +
      hc.checks.map(function (c) { return '<div class="zeile"><span>' + esc(c.name) + " <span class=\"muted\" style=\"font-size:11px\">" + esc(c.detail) + "</span></span><strong>" + healthBadge(c.status) + "</strong></div>"; }).join("") +
      '<div class="muted" style="font-size:11px;margin:8px 0 2px">Nicht konfigurierte Schnittstellen (kein Systemfehler):</div>' +
      hc.adapter.map(function (a) { return '<div class="zeile"><span>' + esc(a.name) + '</span><strong><span class="tag">' + esc(a.status) + "</span></strong></div>"; }).join("") +
      "</div>";
    html += "</div>";

    // Version & Änderungen (Änderungs-/Versionsverwaltung)
    function liste(arr) { return "<ul style=\"margin:4px 0 0 18px;padding:0\">" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; }
    html += '<div class="card" style="margin-top:12px"><h3>🆕 Version & Änderungen</h3>' +
      '<div class="muted" style="font-size:12px">Aktuelle Version: <strong>' + esc(VERSION_INFO.version) + "</strong> · " + esc(VERSION_INFO.datum) + " · Datenschema v" + status.schemaVersion + "</div>" +
      '<div class="grid cols-3" style="margin-top:8px"><div><strong>Neu</strong>' + liste(VERSION_INFO.neu) + "</div><div><strong>Behobene Fehler</strong>" + liste(VERSION_INFO.behoben) + "</div><div><strong>Bekannte Einschränkungen</strong>" + liste(VERSION_INFO.grenzen) + "</div></div></div>";

    // Backup-Überwachung
    html += '<div class="card" style="margin-top:12px"><h3>💾 Backup-Überwachung</h3>' +
      '<div class="grid cols-3">' +
      stat("Letztes Backup", bk.letztes ? fmtDate(bk.letztes) : "—", bk.letztes ? "" : "warn") +
      stat("Status", esc(bk.status)) +
      stat("Restore getestet", bk.restoreGetestet ? "ja" : "nein", bk.restoreGetestet ? "green" : "warn") +
      "</div>" +
      (bk.warnungen.length ? bk.warnungen.map(function (wn) { return '<div class="insight"><span class="ico">' + (wn.schwere >= 3 ? "🔴" : wn.schwere === 2 ? "🟠" : "🟡") + "</span><span>" + esc(wn.text) + "</span></div>"; }).join("") : '<div class="muted" style="font-size:12px">Keine Backup-Warnungen.</div>') +
      '<div class="btn-row" style="margin-top:8px"><button class="btn sm" id="sys-backup-jetzt" type="button">⬇️ Backup erstellen &amp; protokollieren</button><button class="btn sm ghost" id="sys-restore-getestet" type="button">Wiederherstellung als getestet markieren</button></div>' +
      '<p class="hint">Es wird kein echter Restore auf die aktive Datenbank ausgeführt. Restore-Test bitte in einem separaten Browserprofil gemäß BACKUP_RESTORE.md.</p></div>';

    // Betriebswarnungen
    html += '<div class="card" style="margin-top:12px"><h3>⚠️ Betriebswarnungen <span class="sub">' + warn.length + "</span></h3>" +
      (warn.length ? warn.slice(0, 20).map(function (wn) { return '<div class="insight"><span class="ico">' + (wn.schwere >= 3 ? "🔴" : wn.schwere === 2 ? "🟠" : "🟡") + "</span><span>" + esc(wn.text) + "</span></div>"; }).join("") : '<div class="empty">Keine offenen Betriebswarnungen.</div>') + "</div>";

    // Pilot-Kennzahlen (echte Zahlen)
    html += '<div class="card" style="margin-top:12px"><h3>🧪 Pilot-Kennzahlen</h3><div class="grid cols-4">' +
      stat("Aktive Benutzer", pk.benutzer) + stat("Kalkulationen", pk.kalkulationen) + stat("Angebote", pk.angebote) + stat("Aufträge", pk.auftraege) +
      "</div><div class=\"grid cols-4\" style=\"margin-top:10px\">" +
      stat("Nachkalkuliert", pk.nachkalkuliert) + stat("Zeitbuchungen", pk.erfassteZeitbuchungen) + stat("Offene Timer", pk.offeneTimer, pk.offeneTimer ? "warn" : "") + stat("Feedback offen", pk.offeneFeedback) +
      "</div><div class=\"muted\" style=\"font-size:11px;margin-top:6px\">Nur reale Zählwerte – keine künstlichen Erfolgskennzahlen.</div></div>";

    // Feedback-Liste
    var fbs = (db.feedback || []).slice().reverse();
    html += '<div class="card" style="margin-top:12px"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">💬 Feedback (' + fbs.length + ')</h3><button class="btn sm" id="sys-fb-neu" type="button">+ Meldung</button></div>';
    html += fbs.length ? '<div class="table-wrap"><table><thead><tr><th>Nr.</th><th>Kategorie</th><th>Prio</th><th>Beschreibung</th><th>Status</th></tr></thead><tbody>' +
      fbs.slice(0, 30).map(function (f) {
        var stsOpt = Betrieb.FEEDBACK_STATUS.map(function (s) { return '<option value="' + s + '"' + (f.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("");
        return "<tr><td>" + esc(f.nummer || f.id) + "</td><td>" + esc(f.kategorie) + "</td><td>" + esc(f.prioritaet) + "</td><td>" + esc((f.beschreibung || "").slice(0, 70)) + "</td>" +
          '<td><select data-fbstatus="' + f.id + '" style="font-size:11px">' + stsOpt + "</select></td></tr>";
      }).join("") + "</tbody></table></div>" : '<div class="muted" style="font-size:12px">Noch keine Meldungen.</div>';
    html += "</div>";

    // Fehlerprotokoll + Support-Paket
    var fl = (db.fehlerlog || []).slice().reverse().slice(0, 20);
    html += '<div class="card" style="margin-top:12px"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">🧾 Fehlerprotokoll (' + (db.fehlerlog || []).length + ')</h3><div class="inline" style="flex:0"><button class="btn sm" id="sys-support" type="button">📦 Support-Paket</button><button class="btn sm ghost" id="sys-log-clear" type="button">Log leeren</button></div></div>';
    html += fl.length ? '<div class="table-wrap"><table><thead><tr><th>Fehler-ID</th><th>Zeit</th><th>Modul</th><th>Nachricht</th></tr></thead><tbody>' +
      fl.map(function (f) { return "<tr><td><code>" + esc(f.id) + "</code></td><td>" + fmtDateTime(f.zeitpunkt) + "</td><td>" + esc(f.modul || "—") + "</td><td>" + esc((f.nachricht || "").slice(0, 80)) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="muted" style="font-size:12px">Keine Fehler protokolliert.</div>';
    html += '<p class="hint">Protokoll enthält keine Passwörter, Tokens oder vollständigen Personendaten. Bei einem Problem die Fehler-ID dem Administrator nennen.</p></div>';

    // Mandanten (Firmen) – Wechsel, Verwaltung, Tarif/Lizenz/Nutzung
    html += mandantenCardHtml(now);

    // Infrastruktur & Produktion (Adapter, Alarme, geplante Jobs) – Phase 11
    html += infraCardHtml(now);

    // Kundenportal – interne Prüf-/Verwaltungsansicht (Phase 12B)
    html += portalAdminCardHtml(now);

    // Rechnungswesen – schreibgeschützte Vorschau (Phase 13A)
    html += rechnungVorschauCardHtml(now);

    // Offline-Synchronisation – kompakte Diagnose (Phase 14A)
    html += offlineDiagnoseCardHtml();

    root.innerHTML = html;
    verdrahteOfflineDiagnose();
    verdrahteMandantenCard(now);
    verdrahteInfraCard(now);
    verdrahtePortalAdminCard();
    // Verdrahtung
    $("#sys-stufe-set").onclick = function () { db.settings.betrieb.releaseStufe = $("#sys-stufe").value; Store.save(); aktualisiereReleaseBanner(); markierePilotFunktionen(); renderSystem(); toast("Freigabestufe gesetzt."); };
    $("#sys-wartung").onclick = function () { db.settings.betrieb.wartungsmodus = !db.settings.betrieb.wartungsmodus; Store.save(); aktualisiereReleaseBanner(); renderSystem(); };
    if ($("#sys-setup")) $("#sys-setup").onclick = function () { starteSetup(0); };
    $("#sys-backup-jetzt").onclick = function () { systemBackup(); };
    $("#sys-restore-getestet").onclick = function () { db.settings.betrieb.backupMeta.restoreGetestet = true; db.settings.betrieb.backupMeta.letzterRestoreTest = Store.nowISO(); Store.save(); renderSystem(); toast("Restore-Test vermerkt."); };
    $("#sys-fb-neu").onclick = function () { feedbackModal(""); };
    $("#sys-support").onclick = function () { supportPaketDialog(); };
    $("#sys-log-clear").onclick = function () { if (confirm("Fehlerprotokoll leeren?")) { db.fehlerlog = []; Store.save(); renderSystem(); } };
    $all("[data-fbstatus]").forEach(function (s) { s.onchange = function () { var f = (db.feedback || []).filter(function (x) { return x.id === s.dataset.fbstatus; })[0]; if (f) { f.status = this.value; f.bearbeiter = (Auth.current() || {}).benutzername || ""; Store.save(); } }; });
  }

  // ============================================================
  //  MANDANTENVERWALTUNG (Phase 10) – nur Administration
  //  Isolation durch getrennte Speicher-Namespaces (Datenbank-pro-
  //  Mandant). Aktiver Mandant kommt aus Registry/Sitzung, nie aus
  //  URL/Formular. Firmenwechsel setzt Sitzung zurück (Re-Login).
  // ============================================================
  function tarifName(reg, key) { var t = (reg.tarife || []).filter(function (x) { return x.key === key; })[0]; return t ? t.name : (key || "—"); }
  function mandantStatusBadge(status) {
    var rot = ["gesperrt", "archiviert"], gelb = ["Zahlung ausstehend", "eingeschränkt", "gekündigt", "Einrichtung", "Testbetrieb"];
    var f = rot.indexOf(status) >= 0 ? "#e06666" : gelb.indexOf(status) >= 0 ? "#e0a000" : "#2fbf71";
    return '<span class="badge" style="background:' + f + ';color:#fff">' + esc(status) + "</span>";
  }
  function mandantenCardHtml(now) {
    if (!Mandant) return "";
    var reg = Store.ladeRegistry();
    var aktiv = Store.aktiverMandant() || {};
    var liz = Mandant.lizenz(aktiv);
    var nz = Mandant.nutzung(aktiv, db);
    var testmodus = ["test", "entwicklung"].indexOf((db.settings.betrieb && db.settings.betrieb.releaseStufe) || "test") >= 0;

    // Aktiver Mandant + Lizenz + Nutzung
    function warnFarbe(stufe) { return stufe >= 100 ? "#e06666" : stufe >= 90 ? "#e0a000" : stufe >= 80 ? "#e0a000" : "#2fbf71"; }
    var html = '<div class="card" style="margin-top:12px;border-left:4px solid #3d7bd6"><div class="inline" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<h3 style="margin:0">🏢 Mandanten (Firmen)</h3>' +
      '<div class="inline" style="flex:0"><button class="btn sm" id="mt-neu" type="button">+ Neue Firma</button>' +
      (testmodus ? '<button class="btn sm ghost" id="mt-beispiel" type="button">🧪 2 Test-Firmen anlegen</button>' : "") +
      '<button class="btn sm ghost" id="mt-export" type="button">⬇️ Mandant exportieren</button></div></div>';

    html += '<div class="grid cols-3" style="margin-top:10px;align-items:start">';
    html += '<div class="card"><div class="muted" style="font-size:11px">Aktive Firma</div><strong style="font-size:15px">' + esc(aktiv.name || "—") + "</strong> " + mandantStatusBadge(aktiv.status || "aktiv") +
      '<div class="muted" style="font-size:11px;margin-top:4px">Tarif: <strong>' + esc(tarifName(reg, aktiv.tarif)) + "</strong></div>" +
      (liz.hinweis ? '<div class="insight" style="margin-top:6px"><span class="ico">⚠️</span><span>' + esc(liz.hinweis) + "</span></div>" : '<div class="muted" style="font-size:11px;margin-top:4px">Schreibzugriff: aktiv</div>') + "</div>";
    html += '<div class="card"><div class="muted" style="font-size:11px">Benutzer</div><strong style="font-size:15px;color:' + warnFarbe(nz.benutzerWarn) + '">' + nz.benutzer + " / " + (nz.maxBenutzer || "∞") + "</strong>" +
      (nz.benutzerWarn ? '<div class="muted" style="font-size:11px">Auslastung ≥ ' + nz.benutzerWarn + " %</div>" : "") + "</div>";
    html += '<div class="card"><div class="muted" style="font-size:11px">Speicher (Mandant)</div><strong style="font-size:15px;color:' + warnFarbe(nz.speicherWarn) + '">' + nz.speicherMB + " / " + (nz.maxSpeicherMB || "∞") + " MB</strong>" +
      (nz.speicherWarn ? '<div class="muted" style="font-size:11px">Auslastung ≥ ' + nz.speicherWarn + " %</div>" : "") + "</div>";
    html += "</div>";

    // Feature-Verfügbarkeit für den aktiven Tarif
    html += '<div class="muted" style="font-size:11px;margin:10px 0 4px">Freigeschaltete Funktionen im Tarif „' + esc(tarifName(reg, aktiv.tarif)) + "“:</div><div class=\"inline\" style=\"flex-wrap:wrap;gap:6px\">";
    (reg.featureFlags || []).forEach(function (f) {
      var ok = Mandant.darfFeature(reg, aktiv, f.key);
      html += '<span class="tag" style="background:' + (ok ? "#e8f5ec" : "#f3f3f3") + ";color:" + (ok ? "#1f7a3d" : "#999") + '">' + (ok ? "✓ " : "· ") + esc(f.name) + (f.aktiv === false ? " (aus)" : f.beta ? " (Beta)" : "") + "</span>";
    });
    html += "</div>";

    // Mandantenliste
    html += '<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Firma</th><th>Tarif</th><th>Status</th><th>Benutzer</th><th></th></tr></thead><tbody>';
    (reg.liste || []).forEach(function (m) {
      var isAktiv = m.id === reg.aktiv;
      var anzahlU = (reg.zuordnungen || []).filter(function (z) { return z.mandantId === m.id && z.status !== "entzogen"; }).length;
      html += "<tr" + (isAktiv ? ' style="background:var(--panel-2)"' : "") + "><td><strong>" + esc(m.name) + "</strong>" + (isAktiv ? ' <span class="tag" style="background:#3d7bd6;color:#fff">aktiv</span>' : "") + "</td>" +
        "<td>" + esc(tarifName(reg, m.tarif)) + "</td><td>" + mandantStatusBadge(m.status) + "</td><td>" + anzahlU + "</td>" +
        '<td class="num"><div class="inline" style="flex:0;justify-content:flex-end">' +
        (isAktiv ? '<span class="muted" style="font-size:11px">aktuelle Firma</span>' : '<button class="btn sm" data-mt-wechsel="' + esc(m.id) + '" type="button">Wechseln</button>') +
        '<button class="btn sm ghost" data-mt-edit="' + esc(m.id) + '" type="button">Bearbeiten</button></div></td></tr>';
    });
    html += "</tbody></table></div>";
    html += '<p class="hint">Firmendaten sind durch getrennte Speicherbereiche isoliert (Datenbank-pro-Mandant); gleiche Nummern in verschiedenen Firmen kollidieren nicht. Der aktive Mandant wird aus der Sitzung bestimmt. Ein Firmenwechsel setzt die Anmeldung zurück (Re-Login). Serverseitige Erzwingung erfordert ein Backend – siehe MULTITENANCY.md / SECURITY.md.</p>';
    return html;
  }
  function verdrahteMandantenCard(now) {
    if (!Mandant) return;
    if ($("#mt-neu")) $("#mt-neu").onclick = function () { mandantEditModal(null); };
    if ($("#mt-beispiel")) $("#mt-beispiel").onclick = function () { erstelleBeispielMandanten(); };
    if ($("#mt-export")) $("#mt-export").onclick = function () { mandantExportieren(); };
    $all("[data-mt-wechsel]").forEach(function (b) { b.onclick = function () { mandantWechselFlow(b.getAttribute("data-mt-wechsel")); }; });
    $all("[data-mt-edit]").forEach(function (b) { b.onclick = function () { mandantEditModal(b.getAttribute("data-mt-edit")); }; });
  }

  // ============================================================
  //  INFRASTRUKTUR & PRODUKTION (Phase 11) – nur Administration
  //  Zeigt ehrlich den Status der (noch nicht konfigurierten)
  //  Adapter, interne Alarme und fällige geplante Aufgaben.
  // ============================================================
  function infraAdapterConfig() {
    // Aus Umgebungs-/Build-Schaltern; offline i. d. R. nicht konfiguriert.
    var b = (w.PSBUILD || {});
    return {
      email: { provider: b.EMAIL_PROVIDER || "none", apiKey: b.EMAIL_API_KEY || "", from: b.EMAIL_FROM || "" },
      zahlung: { provider: b.PAYMENT_PROVIDER || "none", webhookSecret: b.PAYMENT_WEBHOOK_SECRET || "" },
      monitoring: { url: b.MONITORING_URL || "", dsn: b.ERROR_TRACKING_DSN || "" }
    };
  }
  function infraAlarmQuelle(now) {
    var bk = Betrieb.backupStatus(db, now);
    var status = Betrieb.systemstatus(db, buildInfo(), now);
    return {
      appErreichbar: true, dbErreichbar: true,
      backupFehlerFolge: (db.settings.betrieb.backupMeta && db.settings.betrieb.backupMeta.status === "fehlgeschlagen") ? 1 : 0,
      speicherKnapp: status.speicher && status.speicher.prozent >= 90,
      emailGestoert: false,
      anmeldeFehler: (db.fehlerlog || []).filter(function (f) { return f.modul === "anmeldung"; }).length
    };
  }
  function infraCardHtml(now) {
    if (!Infra) return "";
    var cfg = infraAdapterConfig();
    var email = Infra.emailAdapter(cfg.email);
    var zahlung = Infra.zahlungAdapter(cfg.zahlung);
    var monKonf = !!(cfg.monitoring.url || cfg.monitoring.dsn);
    function badge(ok, textOk, textNok) { var f = ok ? "#2fbf71" : "#888"; return '<span class="badge" style="background:' + f + ';color:#fff">' + esc(ok ? textOk : textNok) + "</span>"; }

    var html = '<div class="card" style="margin-top:12px;border-left:4px solid #6b7cff"><div class="inline" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<h3 style="margin:0">🛰️ Infrastruktur &amp; Produktion</h3>' +
      '<div class="inline" style="flex:0"><button class="btn sm" id="infra-mailvorschau" type="button">✉️ E-Mail-Vorschau</button></div></div>';

    // Adapter-Status
    html += '<div class="grid cols-3" style="margin-top:10px;align-items:start">';
    html += '<div class="card"><div class="muted" style="font-size:11px">E-Mail-Dienst</div>' + badge(email.konfiguriert, "konfiguriert", "nicht konfiguriert") +
      '<div class="muted" style="font-size:11px;margin-top:4px">' + (email.konfiguriert ? "Versand über Backend" : "Vorschaumodus – kein Versand, keine vorgetäuschte Zustellung") + "</div></div>";
    html += '<div class="card"><div class="muted" style="font-size:11px">Zahlungsanbieter</div>' + badge(zahlung.konfiguriert, "konfiguriert", zahlung.status === "manuell" ? "manuell" : "nicht konfiguriert") +
      '<div class="muted" style="font-size:11px;margin-top:4px">' + (zahlung.konfiguriert ? "Abo aktiv" : "Keine echte Abbuchung · manuelle Lizenzverwaltung") + "</div></div>";
    html += '<div class="card"><div class="muted" style="font-size:11px">Monitoring / Fehlertracking</div>' + badge(monKonf, "extern aktiv", "intern (extern optional)") +
      '<div class="muted" style="font-size:11px;margin-top:4px">Interne Statusansicht aktiv; externer Dienst nur mit Konfiguration (ohne PII).</div></div>';
    html += "</div>";

    // Interne Alarme
    var alarme = Infra.alarme(infraAlarmQuelle(now));
    html += '<div class="muted" style="font-size:11px;margin:12px 0 4px">Alarme (intern sichtbar, kein externer Versand):</div>';
    html += alarme.length
      ? alarme.slice(0, 8).map(function (a) { return '<div class="insight"><span class="ico">' + (a.rang >= 3 ? "🔴" : a.rang === 2 ? "🟠" : "🟡") + "</span><span><strong>" + esc(a.stufe) + ":</strong> " + esc(a.text) + "</span></div>"; }).join("")
      : '<div class="muted" style="font-size:12px">Keine offenen Alarme.</div>';

    // Fällige geplante Aufgaben
    var plan = (db.settings.betrieb && db.settings.betrieb.jobPlan) || {};
    var faellig = Infra.faelligeJobs(plan, now, 0);
    html += '<div class="muted" style="font-size:11px;margin:12px 0 4px">Geplante Aufgaben (' + faellig.length + " fällig, mandantengetrennt, Zeitzone berücksichtigt):</div>";
    html += '<div class="inline" style="flex-wrap:wrap;gap:6px">' + Infra.GEPLANTE_JOBS.map(function (j) {
      var f = faellig.indexOf(j.key) >= 0;
      return '<span class="tag" style="background:' + (f ? "#fff3e0" : "#eef") + ";color:" + (f ? "#a15c00" : "#556") + '">' + (f ? "⏰ " : "· ") + esc(j.name) + "</span>";
    }).join("") + "</div>";

    html += '<p class="hint">Diese App läuft offline (localStorage). E-Mail-, Zahlungs- und externe Monitoring-Dienste erfordern ein Backend und sind bewusst NICHT als funktionsfähig ausgegeben. Reproduzierbares Hosting (Docker/nginx + managed static), CI-Gates und Env-Validierung siehe PRODUCTION_INFRASTRUCTURE.md.</p></div>';
    return html;
  }
  function verdrahteInfraCard(now) {
    if (!Infra) return;
    if ($("#infra-mailvorschau")) $("#infra-mailvorschau").onclick = function () { infraMailVorschau(); };
  }

  // ============================================================
  //  KUNDENPORTAL – interne Prüf-/Verwaltungsansicht (Phase 12B)
  //  Arbeitet auf der aktiven Mandanten-db. Kundenuploads prüfen,
  //  Zeichnungsfreigaben verwalten, Portal-Ereignisse sehen.
  // ============================================================
  function kundenName(id) { var k = (db.kunden || []).filter(function (x) { return x.id === id; })[0]; return k ? k.name : (id || "—"); }
  function portalAdminCardHtml(now) {
    if (!w.Preisschmiede.Portal) return "";
    var ups = (db.kundenUploads || []).slice().reverse();
    var zfs = (db.zeichnungsFreigaben || []).slice();
    var evs = (db.portalEreignisse || []).slice().reverse().slice(0, 8);
    var offeneUp = ups.filter(function (u) { return u.pruefStatus === "ungeprüft"; }).length;

    var html = '<div class="card" style="margin-top:12px;border-left:4px solid #5a9d7a"><h3>📨 Kundenportal – Uploads &amp; Zeichnungsfreigaben</h3>';
    // Kundenuploads
    html += '<h4 style="margin:8px 0 4px">Kundenuploads (' + offeneUp + ' ungeprüft)</h4>';
    html += ups.length ? '<div class="table-wrap"><table><thead><tr><th>Datei</th><th>Typ</th><th>Kunde</th><th>Kommission</th><th>Größe</th><th>Status</th><th></th></tr></thead><tbody>' +
      ups.slice(0, 20).map(function (u) {
        var tag = u.technischFreigegeben ? '<span class="tag" style="background:#2fbf71;color:#fff">freigegeben</span>' : u.pruefStatus === "abgelehnt" ? '<span class="tag" style="background:#e06666;color:#fff">abgelehnt</span>' : '<span class="tag" style="background:#e0a000;color:#fff">' + esc(u.pruefStatus) + "</span>";
        var akt = u.pruefStatus === "ungeprüft" ? '<button class="btn sm" data-up-ok="' + esc(u.id) + '" type="button">Freigeben</button> <button class="btn sm ghost" data-up-no="' + esc(u.id) + '" type="button">Ablehnen</button>' : "—";
        return "<tr><td>" + esc(u.dateiname) + "</td><td>" + esc(u.typ || "") + "</td><td>" + esc(kundenName(u.kundeId)) + "</td><td>" + esc(u.kommission || "") + "</td><td>" + Math.round((u.groesse || 0) / 1024) + " kB</td><td>" + tag + "</td><td>" + akt + "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<div class="muted" style="font-size:12px">Noch keine Kundenuploads.</div>';
    html += '<p class="hint">Kundenuploads gelten nie automatisch als technisch freigegeben. Ausführbare/aktive Dateitypen werden bereits beim Upload abgelehnt.</p>';

    // Zeichnungsfreigaben
    html += '<h4 style="margin:12px 0 4px">Zeichnungsfreigaben</h4>';
    html += zfs.length ? '<div class="table-wrap"><table><thead><tr><th>Zeichnung</th><th>Rev.</th><th>Kunde</th><th>Sichtbar</th><th>Status</th><th>Kundenentscheidung</th><th></th></tr></thead><tbody>' +
      zfs.map(function (z) {
        var letzte = (z.entscheidungen || [])[z.entscheidungen.length - 1];
        var ent = letzte ? esc(letzte.entscheidung) + (letzte.kommentar ? " – " + esc(letzte.kommentar) : "") + " (" + esc(letzte.person || "") + ")" : "—";
        var tog = z.status === "ersetzt" ? "—" : '<button class="btn sm ghost" data-zf-tog="' + esc(z.id) + '" type="button">' + (z.sichtbar ? "Verbergen" : "Sichtbar") + "</button>";
        return "<tr><td>" + esc(z.zeichnungsnummer) + " " + esc(z.titel || "") + "</td><td>" + esc(z.revision) + "</td><td>" + esc(kundenName(z.kundeId)) + "</td><td>" + (z.sichtbar ? "ja" : "nein") + "</td><td>" + esc(z.status) + "</td><td>" + ent + "</td><td>" + tog + "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<div class="muted" style="font-size:12px">Keine Zeichnungsfreigaben angelegt. (Zeichnungen werden auf der Dokumentenseite freigegeben.)</div>';
    html += '<p class="hint">Kundenentscheidungen sind dokumentierte Zustimmungen, keine qualifizierte E-Signatur und ersetzen keine technische Prüfung. Ersetzte Revisionen können nicht mehr freigegeben werden.</p>';

    // Ereignisse
    html += '<h4 style="margin:12px 0 4px">Portal-Ereignisse</h4>';
    html += evs.length ? evs.map(function (e) { return '<div class="zeile"><span>' + esc(e.text || e.typ) + '</span><span class="muted" style="font-size:11px">' + fmtDateTime(e.zeitpunkt) + "</span></div>"; }).join("") : '<div class="muted" style="font-size:12px">Keine Ereignisse.</div>';
    html += "</div>";
    return html;
  }
  function verdrahtePortalAdminCard() {
    $all("[data-up-ok]").forEach(function (b) { b.onclick = function () { var u = (db.kundenUploads || []).filter(function (x) { return x.id === b.getAttribute("data-up-ok"); })[0]; if (u) { u.pruefStatus = "freigegeben"; u.technischFreigegeben = true; u.geprueftVon = (Auth.current() || {}).benutzername || ""; Store.save(); renderSystem(); toast("Upload freigegeben."); } }; });
    $all("[data-up-no]").forEach(function (b) { b.onclick = function () { var u = (db.kundenUploads || []).filter(function (x) { return x.id === b.getAttribute("data-up-no"); })[0]; if (u) { u.pruefStatus = "abgelehnt"; u.technischFreigegeben = false; u.geprueftVon = (Auth.current() || {}).benutzername || ""; Store.save(); renderSystem(); toast("Upload abgelehnt."); } }; });
    $all("[data-zf-tog]").forEach(function (b) { b.onclick = function () { var z = (db.zeichnungsFreigaben || []).filter(function (x) { return x.id === b.getAttribute("data-zf-tog"); })[0]; if (z && z.status !== "ersetzt") { z.sichtbar = !z.sichtbar; Store.save(); renderSystem(); toast(z.sichtbar ? "Zeichnung im Portal sichtbar." : "Zeichnung verborgen."); } }; });
  }

  // ============================================================
  //  RECHNUNGSWESEN – schreibgeschützte Vorschau (Phase 13A)
  //  Nur Anzeige der Engine-Ergebnisse zur technischen Prüfung;
  //  bewusst KEINE Aktions-Schaltflächen (Rechnungs-UI folgt später).
  // ============================================================
  function rechnungVorschauCardHtml(now) {
    var R = w.Preisschmiede.Rechnung; if (!R) return "";
    var nts = db.nachtraege || [], belege = db.rechnungen || [];
    if (!nts.length && !belege.length) return "";
    var html = '<div class="card" style="margin-top:12px;border-left:4px solid #9d7a5a"><h3>🧾 Rechnungswesen – Vorschau (Phase 13A)</h3>' +
      '<p class="hint">Schreibgeschützte Vorschau der Belegdaten und Berechnungen. Keine steuerliche/rechtliche Wertung, kein Versand, keine ERP-Übertragung. Prüfung durch Steuer-/Rechtsberatung erforderlich.</p>';
    // Nachträge
    html += '<h4 style="margin:8px 0 4px">Nachträge (' + nts.length + ")</h4>";
    html += nts.length ? '<div class="table-wrap"><table><thead><tr><th>Nummer</th><th>Bezeichnung</th><th>Kommission</th><th>Status</th><th class="num">Netto</th></tr></thead><tbody>' +
      nts.map(function (n) { return "<tr><td>" + esc(n.nummer || "(Entwurf)") + "</td><td>" + esc(n.bezeichnung || "") + "</td><td>" + esc(n.kommission || "") + "</td><td>" + esc(n.status) + '</td><td class="num">' + fmtEUR(n.sollSnapshot ? n.sollSnapshot.netto : 0) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="muted" style="font-size:12px">Keine Nachträge.</div>';
    // Auftragswert inkl. Nachtrag (Beispielauftrag der Nachträge)
    if (nts.length && nts[0].auftragId) {
      var auf = (db.auftraege || []).filter(function (a) { return a.id === nts[0].auftragId; })[0];
      if (auf && auf.kalk) {
        var st = R.abrechnungsstand(auf.kalk.netto, nts.filter(function (n) { return n.auftragId === auf.id; }), belege.filter(function (b) { return b.auftragId === auf.id; }));
        html += '<div class="grid cols-4" style="margin-top:8px">' + stat("Ursprung netto", fmtEUR(st.ursprungNetto)) + stat("Nachträge netto", fmtEUR(st.nachtragNetto)) + stat("Aktuell netto", fmtEUR(st.gesamtNetto)) + stat("Offen netto", fmtEUR(st.offenNetto), st.offenNetto > 0.005 ? "warn" : "green") + "</div>";
      }
    }
    // Belege
    html += '<h4 style="margin:12px 0 4px">Belege (' + belege.length + ")</h4>";
    html += belege.length ? '<div class="table-wrap"><table><thead><tr><th>Nummer</th><th>Art</th><th>Datum</th><th>Fällig</th><th class="num">Netto</th><th class="num">USt</th><th class="num">Brutto</th><th>Zahlung</th></tr></thead><tbody>' +
      belege.map(function (b) { var s = R.belegSummen(b); return "<tr><td>" + esc(b.nummer || "(Entwurf)") + "</td><td>" + esc(b.art) + "</td><td>" + fmtDate(b.rechnungsdatum) + "</td><td>" + (b.faelligkeit ? fmtDate(b.faelligkeit) : "—") + '</td><td class="num">' + fmtEUR(s.netto) + '</td><td class="num">' + fmtEUR(s.mwst) + '</td><td class="num">' + fmtEUR(s.brutto) + "</td><td>" + esc(b.zahlungstatus) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="muted" style="font-size:12px">Keine Belege.</div>';
    html += "</div>";
    return html;
  }
  // E-Mail-Vorschau: baut eine echte Nachricht aus den Vorlagen, zeigt sie an
  // und macht transparent, dass OHNE Dienst NICHTS versendet wird.
  function infraMailVorschau() {
    var m = Store.aktiverMandant() || {};
    var cfg = infraAdapterConfig();
    var ad = Infra.emailAdapter(cfg.email);
    var msg = Infra.buildMessage("angebot", "kunde@example.at", {
      mandant: m, angebotNr: "ANG-2026-0001", kunde: "Beispiel Kunde", ansprechpartner: "Frau Muster",
      projekt: "Geländer Terrasse", kommission: "BV Beispiel", nachricht: "Vielen Dank für Ihre Anfrage."
    }, { from: cfg.email.from });
    var res = ad.send(msg, { idempotenzKey: "vorschau" });
    var body = '<div class="muted" style="font-size:12px;margin-bottom:6px">Status: <strong>' + esc(res.status) + "</strong> – " +
      (res.gesendet ? "gesendet" : "es wird nichts versendet (Vorschau).") + "</div>" +
      '<label class="fld"><span class="lbl">Betreff</span><input value="' + esc(msg.betreff) + '" readonly></label>' +
      '<label class="fld"><span class="lbl">Textvorschau</span><textarea rows="8" readonly style="font-family:monospace;font-size:12px">' + esc(msg.text) + "</textarea></label>" +
      '<p class="hint">E-Mail-Vorlagen enthalten keine internen Kalkulationswerte/Secrets. Ohne konfigurierten E-Mail-Dienst wird keine Zustellung vorgetäuscht (Status „nicht gesendet – Dienst nicht konfiguriert").</p>';
    openModalWide("E-Mail-Vorschau (Angebot)", body, null, null, null);
  }

  // Firmenwechsel: Timer-Wächter -> Sitzung zurücksetzen -> Namespace wechseln
  // -> Cache leeren -> Re-Login im Zielmandanten.
  function mandantWechselFlow(zielId) {
    var ziel = Store.mandantById(zielId); if (!ziel) { toast("Firma nicht gefunden.", "err"); return; }
    // Timer-Wächter: laufende Zeiterfassung darf nicht über Firmen hinweg verloren gehen
    if (db.aktiverTimer) {
      openModal("Firmenwechsel nicht möglich",
        '<div class="fehler-box">Es läuft eine Zeiterfassung (Timer). Bitte zuerst im aktuellen Auftrag stoppen und buchen, dann die Firma wechseln.</div>',
        null, "Verstanden");
      return;
    }
    var body = '<p>Zur Firma <strong>' + esc(ziel.name) + '</strong> wechseln?</p>' +
      '<p class="muted" style="font-size:12px">Aus Sicherheitsgründen wird die aktuelle Anmeldung beendet. Danach ist eine erneute Anmeldung mit einem Benutzer der Zielfirma nötig. Es werden ausschließlich die Daten der Zielfirma geladen.</p>';
    openModal("Firma wechseln", body, function () {
      // 1) Sitzung beenden (kein Benutzer wandert zwischen Firmen)
      try { Auth.logout(); } catch (e) {}
      // 2) Aktiven Mandanten umsetzen (Cache wird in Store geleert)
      if (!Store.wechsleMandant(zielId)) { toast("Wechsel fehlgeschlagen.", "err"); return true; }
      // 3) App-db neu aus dem Ziel-Namespace laden
      db = Store.load();
      // 4) Anzeigen aktualisieren + Re-Login der Zielfirma erzwingen
      aktualisiereMandantAnzeige();
      aktualisiereReleaseBanner();
      markierePilotFunktionen();
      zeigeLogin();
      toast("Firma gewechselt – bitte neu anmelden.");
      return true;
    }, "Wechseln & abmelden");
  }

  function mandantEditModal(id) {
    var reg = Store.ladeRegistry();
    var m = id ? Store.mandantById(id) : null;
    var neu = !m;
    var tarifOpt = (reg.tarife || []).map(function (t) { return '<option value="' + t.key + '"' + ((m && m.tarif === t.key) || (!m && t.key === "professional") ? " selected" : "") + ">" + esc(t.name) + " (max " + t.maxBenutzer + " Benutzer)</option>"; }).join("");
    var statusOpt = Store.MANDANT_STATUS.map(function (s) { return '<option value="' + s + '"' + ((m && m.status === s) || (!m && s === "aktiv") ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("");
    var body = '<label class="fld"><span class="lbl">Firmenname</span><input id="mt-name" value="' + esc(m ? m.name : "") + '"></label>' +
      '<div class="grid cols-2"><label class="fld"><span class="lbl">Tarif</span><select id="mt-tarif">' + tarifOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Lizenzstatus</span><select id="mt-status">' + statusOpt + "</select></label></div>" +
      '<div class="grid cols-2"><label class="fld"><span class="lbl">Max. Benutzer</span><input id="mt-maxu" type="number" min="1" value="' + esc(m ? m.maxBenutzer : 10) + '"></label>' +
      '<label class="fld"><span class="lbl">Max. Speicher (MB)</span><input id="mt-maxmb" type="number" min="1" value="' + esc(m ? m.maxSpeicherMB : 25) + '"></label></div>' +
      (neu ? '<p class="hint">Neue Firma startet mit einer leeren, getrennten Datenbank (keine Beispieldaten, keine Datenvermischung).</p>'
           : '<p class="hint">Änderungen betreffen nur Tarif/Lizenz/Limits dieser Firma. Firmendaten werden nicht verändert.</p>');
    openModal(neu ? "Neue Firma anlegen" : "Firma bearbeiten", body, function () {
      var name = ($("#mt-name").value || "").trim();
      if (!name) { toast("Firmenname erforderlich.", "err"); return false; }
      var daten = { name: name, kurzname: name.slice(0, 14), tarif: $("#mt-tarif").value, status: $("#mt-status").value, maxBenutzer: parseInt($("#mt-maxu").value, 10) || 1, maxSpeicherMB: parseInt($("#mt-maxmb").value, 10) || 1 };
      if (neu) {
        Store.neuerMandant(daten, false);
        toast("Firma „" + name + "“ angelegt.");
      } else {
        // Nur Registry-Felder ändern; Firmendaten (Namespace) bleiben unberührt
        Object.keys(daten).forEach(function (k) { m[k] = daten[k]; });
        Store.speichereRegistry();
        toast("Firma aktualisiert.");
      }
      renderSystem();
      return true;
    }, neu ? "Anlegen" : "Speichern");
  }

  // Zwei Testfirmen mit ABSICHTLICH gleichen Nummern – nur im Testmodus.
  function erstelleBeispielMandanten() {
    var body = '<p>Legt zwei getrennte Testfirmen mit <strong>absichtlich gleichen</strong> Kunden-/Angebotsnummern an, um die Isolation zu prüfen.</p>' +
      '<p class="muted" style="font-size:12px">Nur im Test-/Entwicklungsmodus. Bestehende Firmen bleiben unverändert. Es werden keine echten Firmendaten überschrieben.</p>';
    openModal("Test-Firmen anlegen", body, function () {
      var reg = Store.ladeRegistry();
      var vorher = (reg.liste || []).length;
      var a = Store.neuerMandant({ name: "Testfirma Alpha", kurzname: "Alpha", tarif: "professional", status: "Testbetrieb" }, false);
      var b = Store.neuerMandant({ name: "Testfirma Beta", kurzname: "Beta", tarif: "basis", status: "Testbetrieb" }, false);
      // Namespace A befüllen
      var aktivVorher = Store.aktiverMandant().id;
      Store.wechsleMandant(a.id);
      var dbA = Store.load();
      dbA.kunden.push({ id: Store.uid(), nummer: "KUN-0001", name: "Alpha Kunde 1", erstellt: Store.nowISO() });
      dbA.angebote.push({ id: Store.uid(), nummer: "ANG-2026-0001", kommission: "Geländer", betragNetto: 1111, positionen: [], erstellt: Store.nowISO() });
      dbA.settings.firma.name = "Testfirma Alpha";
      Store.save();
      // Namespace B – gleiche Nummern
      Store.wechsleMandant(b.id);
      var dbB = Store.load();
      dbB.kunden.push({ id: Store.uid(), nummer: "KUN-0001", name: "Beta Kunde 1", erstellt: Store.nowISO() });
      dbB.angebote.push({ id: Store.uid(), nummer: "ANG-2026-0001", kommission: "Geländer", betragNetto: 2222, positionen: [], erstellt: Store.nowISO() });
      dbB.settings.firma.name = "Testfirma Beta";
      Store.save();
      // Zurück auf die ursprünglich aktive Firma – ohne Sitzung zu wechseln
      Store.wechsleMandant(aktivVorher);
      db = Store.load();
      toast("Zwei Testfirmen mit gleichen Nummern angelegt (" + (vorher) + " → " + ((reg.liste || []).length) + ").");
      renderSystem();
      return true;
    }, "Test-Firmen anlegen");
  }

  function mandantExportieren() {
    if (!Mandant) return;
    var aktiv = Store.aktiverMandant() || {};
    try {
      var paket = Mandant.mandantExport(aktiv, db, Store.nowISO());
      var json = JSON.stringify(paket, null, 2);
      var blob = new Blob([json], { type: "application/json" });
      var url = w.URL.createObjectURL(blob);
      var a = el("a"); a.href = url; a.download = "mandant-" + (aktiv.kurzname || "export") + ".json"; d.body.appendChild(a); a.click(); d.body.removeChild(a); w.URL.revokeObjectURL(url);
      toast("Mandantendaten exportiert (nur eigene Firma).");
    } catch (e) { toast("Export fehlgeschlagen (ID " + protokolliereFehler(e, "mandant-export") + ").", "err"); }
  }

  // Aktive Firma in der Seitenleiste anzeigen (nur bei mehreren Mandanten)
  function aktualisiereMandantAnzeige() {
    var box = $("#brand-mandant"); if (!box || !Mandant) return;
    try {
      var reg = Store.ladeRegistry();
      var aktiv = Store.aktiverMandant();
      if (aktiv && (reg.liste || []).length > 1) {
        box.textContent = "🏢 " + aktiv.name;
        box.hidden = false;
      } else { box.hidden = true; }
    } catch (e) { box.hidden = true; }
  }

  // ============================================================
  //  RECHNUNGEN & NACHTRÄGE – vollständige UI (Phase 13B)
  //  Nutzt ausschließlich die zentrale Engine (Rechnung.*). Keine
  //  parallele UI-Formel. Keine steuerliche/rechtliche Wertung,
  //  kein Versand, keine Live-ERP-Übertragung.
  // ============================================================
  var rz = { tab: "rechnungen", mode: "liste", belegId: null, ntId: null, filter: { kunde: "", kommission: "", art: "", status: "", von: "", bis: "", ueberfaellig: false }, wizard: null };
  function rzKunde(id) { var k = (db.kunden || []).filter(function (x) { return x.id === id; })[0]; return k ? k.name : "—"; }
  function rzAuftrag(id) { return (db.auftraege || []).filter(function (a) { return a.id === id; })[0]; }
  function rzSum(b) { return Rechnung.belegSummen(b); }
  function rzOffen(b) { return Rechnung.offenerBetrag(b); }
  function rzRolle() { return (Auth.current() || {}).rolle; }

  function renderRechnungen() {
    var root = $("#page-rechnungen .content");
    if (!Auth.darf("rechnungen") || !Rechnung) { root.innerHTML = '<div class="empty">Kein Zugriff. Rechnungsdaten sind nur für Büro/Administration sichtbar.</div>'; return; }
    var tabs = '<div class="inline" style="gap:6px;margin-bottom:12px;flex-wrap:wrap">' +
      rzTabBtn("rechnungen", "🧾 Rechnungen") + rzTabBtn("nachtraege", "➕ Nachträge") + rzTabBtn("erp", "📤 ERP-Export") + "</div>";
    var body;
    if (rz.wizard) body = rzWizardHtml();
    else if (rz.tab === "nachtraege") body = rz.mode === "ntdetail" ? rzNachtragDetailHtml() : rzNachtraegeListeHtml();
    else if (rz.tab === "erp") body = rzErpHtml();
    else body = rz.mode === "detail" ? rzBelegDetailHtml() : rzRechnungenListeHtml();
    root.innerHTML = tabs + '<p class="hint">Offline-Prüfsummen sind nicht kryptografisch manipulationssicher. Keine steuerliche/rechtliche Konformität, kein Rechnungsversand, keine Live-ERP-Übertragung.</p>' + body;
    rzWire();
  }
  function rzTabBtn(key, label) { return '<button class="btn sm ' + (rz.tab === key && !rz.wizard ? "" : "ghost") + '" data-rztab="' + key + '" type="button">' + esc(label) + "</button>"; }

  // ---------- Rechnungsübersicht ----------
  function rzRechnungenListeHtml() {
    var belege = (db.rechnungen || []).slice().reverse();
    var f = rz.filter, now = Date.now();
    var gefiltert = belege.filter(function (b) {
      if (f.kunde && b.kundeId !== f.kunde) return false;
      if (f.kommission && (b.kommission || "").toLowerCase().indexOf(f.kommission.toLowerCase()) < 0) return false;
      if (f.art && b.art !== f.art) return false;
      if (f.status && b.zahlungstatus !== f.status) return false;
      if (f.von && new Date(b.rechnungsdatum) < new Date(f.von)) return false;
      if (f.bis && new Date(b.rechnungsdatum) > new Date(f.bis + "T23:59:59")) return false;
      if (f.ueberfaellig && !Rechnung.ueberfaellig(b, new Date(now).toISOString())) return false;
      return true;
    });
    var kundenOpt = '<option value="">Alle Kunden</option>' + (db.kunden || []).map(function (k) { return '<option value="' + esc(k.id) + '"' + (f.kunde === k.id ? " selected" : "") + ">" + esc(k.name) + "</option>"; }).join("");
    var artOpt = '<option value="">Alle Arten</option>' + Rechnung.RECHNUNGSARTEN.map(function (a) { return '<option value="' + esc(a) + '"' + (f.art === a ? " selected" : "") + ">" + esc(a) + "</option>"; }).join("");
    var statusOpt = '<option value="">Alle Zahlungsstatus</option>' + Rechnung.ZAHLUNGSTATUS.map(function (s) { return '<option value="' + esc(s) + '"' + (f.status === s ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("");
    var html = '<div class="card"><div class="inline" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h3 style="margin:0">Rechnungsbelege (' + gefiltert.length + ")</h3>" +
      (Rechnung.darfBeleg(rzRolle(), "entwurf") ? '<button class="btn sm" id="rz-neu" type="button">+ Neue Rechnung (Assistent)</button>' : "") + "</div>" +
      '<div class="grid cols-4" style="margin-top:10px;gap:8px">' +
      '<select id="rz-f-kunde">' + kundenOpt + "</select>" +
      '<input id="rz-f-kommission" placeholder="Kommission" value="' + esc(f.kommission) + '">' +
      '<select id="rz-f-art">' + artOpt + "</select>" +
      '<select id="rz-f-status">' + statusOpt + "</select></div>" +
      '<div class="grid cols-4" style="margin-top:8px;gap:8px"><label class="fld"><span class="lbl">von</span><input type="date" id="rz-f-von" value="' + esc(f.von) + '"></label>' +
      '<label class="fld"><span class="lbl">bis</span><input type="date" id="rz-f-bis" value="' + esc(f.bis) + '"></label>' +
      '<label class="inline" style="gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="rz-f-ueberfaellig"' + (f.ueberfaellig ? " checked" : "") + "> nur überfällig</label>" +
      '<button class="btn sm ghost" id="rz-f-reset" type="button">Filter zurücksetzen</button></div>';
    html += gefiltert.length ? '<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Nummer</th><th>Art</th><th>Kunde</th><th>Kommission</th><th>Datum</th><th>Fällig</th><th class="num">Netto</th><th class="num">USt</th><th class="num">Brutto</th><th class="num">Offen</th><th>Zahlung</th><th>ERP</th></tr></thead><tbody>' +
      gefiltert.map(function (b) {
        var s = rzSum(b); var ueb = Rechnung.ueberfaellig(b, new Date(now).toISOString()) && b.zahlungstatus !== "bezahlt";
        return '<tr data-rz-open="' + esc(b.id) + '" style="cursor:pointer">' +
          "<td>" + esc(b.nummer || "(Entwurf)") + "</td><td>" + esc(b.art) + "</td><td>" + esc(rzKunde(b.kundeId)) + "</td><td>" + esc(b.kommission || "") + "</td><td>" + fmtDate(b.rechnungsdatum) + "</td><td" + (ueb ? ' style="color:#e06666"' : "") + ">" + (b.faelligkeit ? fmtDate(b.faelligkeit) : "—") + '</td><td class="num">' + fmtEUR(s.netto) + '</td><td class="num">' + fmtEUR(s.mwst) + '</td><td class="num">' + fmtEUR(s.brutto) + '</td><td class="num">' + (Rechnung.TEILARTEN.indexOf(b.art) >= 0 || b.art === "Schlussrechnung" ? fmtEUR(rzOffen(b)) : "—") + "</td><td>" + esc(b.zahlungstatus) + "</td><td>" + (b.erpExportId ? '<span class="tag" style="background:#5a9d7a;color:#fff">exportiert</span>' : "—") + "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<div class="muted" style="font-size:12px;margin-top:10px">Keine Belege gefunden.</div>';
    html += "</div>";
    return html;
  }

  // ---------- Belegdetail ----------
  function rzBelegDetailHtml() {
    var b = (db.rechnungen || []).filter(function (x) { return x.id === rz.belegId; })[0];
    if (!b) { rz.mode = "liste"; return rzRechnungenListeHtml(); }
    var s = rzSum(b); var rolle = rzRolle();
    var kunde = (db.kunden || []).filter(function (k) { return k.id === b.kundeId; })[0] || {};
    var html = '<div class="card"><div class="inline" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><button class="btn sm ghost" id="rz-back" type="button">‹ Übersicht</button>' +
      '<div class="inline" style="gap:6px;flex-wrap:wrap">';
    html += '<button class="btn sm" id="rz-pdf" type="button">📄 PDF</button>';
    if (!b.freigegeben && Rechnung.darfBeleg(rolle, "freigeben")) html += '<button class="btn sm" id="rz-freigabe" type="button">✅ Prüfen &amp; freigeben</button>';
    if (!b.freigegeben && Rechnung.darfBeleg(rolle, "bearbeiten")) html += '<button class="btn sm ghost" id="rz-edit" type="button">✏️ Positionen bearbeiten</button>';
    if (b.freigegeben && Rechnung.TEILARTEN.concat(["Schlussrechnung"]).indexOf(b.art) >= 0 && Rechnung.darfBeleg(rolle, "zahlung")) html += '<button class="btn sm" id="rz-zahlung" type="button">💶 Zahlung erfassen</button>';
    if (b.freigegeben && Rechnung.NEGATIVE_ARTEN.indexOf(b.art) < 0 && Rechnung.darfBeleg(rolle, "gutschrift")) html += '<button class="btn sm ghost" id="rz-gutschrift" type="button">Gutschrift</button><button class="btn sm ghost" id="rz-storno" type="button">Storno</button>';
    if (b.freigegeben) html += '<button class="btn sm ' + (b.portalSichtbar ? "" : "ghost") + '" id="rz-portal" type="button">' + (b.portalSichtbar ? "Im Portal sichtbar ✓" : "Für Portal freigeben") + "</button>";
    html += "</div></div>";
    html += '<h3 style="margin:10px 0 4px">' + esc(b.nummer || "(Entwurf)") + " · " + esc(b.art) + (b.freigegeben ? ' <span class="tag" style="background:#2fbf71;color:#fff">freigegeben</span>' : ' <span class="tag" style="background:#e0a000;color:#fff">Entwurf</span>') + "</h3>";
    html += '<div class="table-wrap"><table><tbody>' +
      dokZeile("Kunde", esc(kunde.name || "—") + (kunde.ansprechpartner ? " · " + esc(kunde.ansprechpartner) : "")) +
      dokZeile("Kommission / Projekt", esc(b.kommission || "—")) +
      dokZeile("Auftrag", esc((rzAuftrag(b.auftragId) || {}).titel || b.auftragId || "—")) +
      dokZeile("Rechnungsdatum", fmtDate(b.rechnungsdatum)) + dokZeile("Leistungszeitraum", (b.leistungszeitraum && b.leistungszeitraum.von ? fmtDate(b.leistungszeitraum.von) + " – " + fmtDate(b.leistungszeitraum.bis) : "—")) +
      dokZeile("Fälligkeit", b.faelligkeit ? fmtDate(b.faelligkeit) : "—") +
      dokZeile("Steuerart", b.reverseCharge ? "Reverse Charge" + (b.reverseChargeBestaetigt ? " (bestätigt)" : " – NICHT bestätigt") : "Regelbesteuerung") +
      "</tbody></table></div>";
    // Positionen
    html += '<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Pos</th><th>Bezeichnung</th><th class="num">Menge</th><th>Einh.</th><th class="num">Einzel</th><th class="num">Rabatt</th><th class="num">USt</th><th class="num">Netto</th></tr></thead><tbody>' +
      (b.positionen || []).map(function (p) { return "<tr><td>" + esc(p.nummer) + "</td><td>" + esc(p.bezeichnung) + (p.gesamtmenge ? '<br><span class="muted" style="font-size:11px">Gesamt ' + p.gesamtmenge + " · bisher " + p.bereitsAbgerechnet + " · Rest " + Rechnung.positionRest(p) + "</span>" : "") + '</td><td class="num">' + p.menge + "</td><td>" + esc(p.einheit || "") + '</td><td class="num">' + fmtEUR(p.einzelpreis) + '</td><td class="num">' + (p.rabattProz || 0) + '%</td><td class="num">' + (p.mwstProz != null ? p.mwstProz : b.mwstProz) + '%</td><td class="num">' + fmtEUR(Rechnung.posNetto(p)) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    // Anrechnungen
    if ((b.anrechnungen || []).length) html += '<div class="muted" style="font-size:12px;margin-top:6px">Anrechnung früherer Rechnungen: ' + b.anrechnungen.map(function (a) { return esc(a.bezeichnung) + " (" + fmtEUR(a.brutto) + ")"; }).join(", ") + "</div>";
    // Summen
    html += '<div class="grid cols-2" style="margin-top:10px"><div></div><div class="card">' +
      s.steuerZeilen.map(function (z) { return '<div class="zeile"><span>Netto ' + z.satz + "%</span><span>" + fmtEUR(z.netto) + "</span></div><div class=\"zeile\"><span>USt " + z.satz + "%</span><span>" + fmtEUR(z.steuer) + "</span></div>"; }).join("") +
      '<div class="zeile"><strong>Netto</strong><strong>' + fmtEUR(s.netto) + "</strong></div>" +
      '<div class="zeile"><span>USt gesamt</span><span>' + fmtEUR(s.mwst) + "</span></div>" +
      (s.angerechnetBrutto ? '<div class="zeile"><span>abzügl. Anrechnung</span><span>-' + fmtEUR(s.angerechnetBrutto) + "</span></div>" : "") +
      '<div class="zeile" style="font-size:16px"><strong>Brutto</strong><strong>' + fmtEUR(s.brutto) + "</strong></div>" +
      (Rechnung.TEILARTEN.concat(["Schlussrechnung"]).indexOf(b.art) >= 0 ? '<div class="zeile"><span>bereits bezahlt</span><span>' + fmtEUR(Rechnung.bezahltBetrag(b)) + '</span></div><div class="zeile"><strong>offen</strong><strong>' + fmtEUR(rzOffen(b)) + "</strong></div>" : "") +
      "</div></div>";
    if (b.reverseCharge && b.reverseChargeBestaetigt) html += '<div class="insight"><span class="ico">ℹ️</span><span>' + esc(Rechnung.reverseChargePruefung(b).hinweis) + "</span></div>";
    // Zahlungen
    if ((b.zahlungen || []).length) html += '<h4 style="margin:12px 0 4px">Zahlungen</h4><div class="table-wrap"><table><thead><tr><th>Datum</th><th>Referenz</th><th>Art</th><th class="num">Betrag</th></tr></thead><tbody>' + b.zahlungen.map(function (z) { return "<tr><td>" + fmtDate(z.datum) + "</td><td>" + esc(z.referenz || "") + "</td><td>" + esc(z.art) + '</td><td class="num">' + fmtEUR(z.betrag) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    html += "</div>";
    return html;
  }

  // ---------- Nachträge ----------
  function rzNachtraegeListeHtml() {
    var nts = (db.nachtraege || []).slice().reverse();
    var html = '<div class="card"><div class="inline" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Nachträge (' + nts.length + ")</h3>" +
      (Rechnung.darfBeleg(rzRolle(), "entwurf") ? '<button class="btn sm" id="nt-neu" type="button">+ Neuer Nachtrag</button>' : "") + "</div>";
    html += nts.length ? '<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Nummer</th><th>Bezeichnung</th><th>Kommission</th><th>Ursache</th><th>Status</th><th class="num">Netto</th></tr></thead><tbody>' +
      nts.map(function (n) { return '<tr data-nt-open="' + esc(n.id) + '" style="cursor:pointer"><td>' + esc(n.nummer || "(Entwurf)") + "</td><td>" + esc(n.bezeichnung || "") + "</td><td>" + esc(n.kommission || "") + "</td><td>" + esc(n.ursache || "") + "</td><td>" + esc(n.status) + '</td><td class="num">' + fmtEUR(n.sollSnapshot ? n.sollSnapshot.netto : 0) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="muted" style="font-size:12px;margin-top:10px">Noch keine Nachträge.</div>';
    html += "</div>";
    return html;
  }
  function rzNachtragDetailHtml() {
    var n = (db.nachtraege || []).filter(function (x) { return x.id === rz.ntId; })[0];
    if (!n) { rz.mode = "liste"; return rzNachtraegeListeHtml(); }
    var auf = rzAuftrag(n.auftragId) || {}; var rolle = rzRolle();
    var aw = Rechnung.auftragswert(auf.kalk ? auf.kalk.netto : 0, (db.nachtraege || []).filter(function (x) { return x.auftragId === n.auftragId; }));
    var html = '<div class="card"><div class="inline" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><button class="btn sm ghost" id="nt-back" type="button">‹ Nachträge</button><div class="inline" style="gap:6px;flex-wrap:wrap">';
    if (n.status !== "angenommen" && n.status !== "abgerechnet") html += '<button class="btn sm" id="nt-kalk" type="button">🧮 (Neu) kalkulieren</button>';
    if (n.status === "kalkuliert") html += '<button class="btn sm" id="nt-frei" type="button">Intern freigeben</button>';
    if (n.status === "freigegeben") html += '<button class="btn sm" id="nt-ang" type="button">Angenommen</button><button class="btn sm ghost" id="nt-abl" type="button">Abgelehnt</button>';
    html += '<button class="btn sm ghost" id="nt-zusatz" type="button">+ Zusatzleistung</button></div></div>';
    html += '<h3 style="margin:10px 0">' + esc(n.nummer || "(Entwurf)") + " · " + esc(n.bezeichnung || "") + ' <span class="tag" style="background:#888;color:#fff">' + esc(n.status) + "</span></h3>";
    html += '<div class="grid cols-3"><div class="card"><div class="muted" style="font-size:11px">Hauptauftrag</div><strong>' + esc(auf.titel || n.auftragId || "—") + "</strong><div class=\"muted\" style=\"font-size:11px\">Kunde " + esc(rzKunde(n.kundeId)) + " · " + esc(n.kommission || "") + "</div></div>" +
      '<div class="card"><div class="muted" style="font-size:11px">Nachtragssumme (netto)</div><strong style="font-size:16px">' + fmtEUR(n.sollSnapshot ? n.sollSnapshot.netto : 0) + "</strong></div>" +
      '<div class="card"><div class="muted" style="font-size:11px">Ursache · Terminwirkung</div><strong>' + esc(n.ursache || "—") + "</strong><div class=\"muted\" style=\"font-size:11px\">" + esc(n.gewuenschterTermin ? fmtDate(n.gewuenschterTermin) : "keine Terminangabe") + "</div></div></div>";
    html += '<div class="grid cols-3" style="margin-top:8px">' + stat("Ursprünglicher Auftragswert", fmtEUR(aw.ursprungNetto)) + stat("Angenommene Nachträge", fmtEUR(aw.nachtragNetto)) + stat("Aktueller Auftragswert", fmtEUR(aw.aktuellNetto)) + "</div>";
    if (n.sollSnapshot) { var ts = n.sollSnapshot.teile || {}; html += '<div class="muted" style="font-size:12px;margin-top:8px">Kalkulation: Material ' + fmtEUR(ts.material) + " · Arbeit " + fmtEUR(ts.arbeit) + " · Maschine " + fmtEUR(ts.maschine) + " · Rüst " + fmtEUR(ts.ruest) + " · Montage " + fmtEUR(ts.montage) + " · Fremd " + fmtEUR(ts.fremd) + "</div>"; }
    if (n.beschreibung) html += '<p style="margin-top:8px">' + esc(n.beschreibung) + "</p>";
    if ((n.zusatzleistungen || []).length) html += '<h4 style="margin:10px 0 4px">Zusatzleistungen aus Zeiterfassung</h4>' + n.zusatzleistungen.map(function (z) { return '<div class="zeile"><span>' + esc(z.beschreibung) + "</span><span class=\"muted\">" + (z.stunden || 0) + " h</span></div>"; }).join("");
    if ((n.aenderungsverlauf || []).length) html += '<h4 style="margin:10px 0 4px">Änderungsverlauf</h4>' + n.aenderungsverlauf.map(function (v) { return '<div class="zeile"><span>' + esc(v.aktion) + (v.notiz ? " – " + esc(v.notiz) : "") + '</span><span class="muted" style="font-size:11px">' + fmtDateTime(v.datum) + "</span></div>"; }).join("");
    html += "</div>";
    return html;
  }

  // ---------- ERP-Dateiexport ----------
  function rzErpHtml() {
    var freig = (db.rechnungen || []).filter(function (b) { return b.freigegeben; });
    var html = '<div class="card"><h3>ERP-/KingBill-Dateiexport (CSV)</h3><p class="hint">Nur Dateiexport – keine aktive KingBill-API. Doppelter Export wird erkannt (Prüfsumme/Belege).</p>';
    if (!Rechnung.darfBeleg(rzRolle(), "erp_export")) { html += '<div class="muted">Keine Berechtigung für ERP-Export.</div></div>'; return html; }
    html += freig.length ? '<div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="erp-all"></th><th>Nummer</th><th>Art</th><th>Kunde</th><th class="num">Brutto</th><th>ERP-Status</th></tr></thead><tbody>' +
      freig.map(function (b) { return '<tr><td><input type="checkbox" data-erp-sel="' + esc(b.id) + '"></td><td>' + esc(b.nummer) + "</td><td>" + esc(b.art) + "</td><td>" + esc(rzKunde(b.kundeId)) + '</td><td class="num">' + fmtEUR(rzSum(b).brutto) + "</td><td>" + (b.erpExportId ? '<span class="tag" style="background:#5a9d7a;color:#fff">' + esc(b.erpExportId) + "</span>" : '<span class="muted">offen</span>') + "</td></tr>"; }).join("") + "</tbody></table></div>" +
      '<div class="btn-row" style="margin-top:10px"><button class="btn sm" id="erp-preview" type="button">Vorschau</button><button class="btn sm" id="erp-export" type="button">Exportdatei erzeugen</button></div>' +
      '<div id="erp-preview-box"></div>' : '<div class="muted" style="font-size:12px">Keine freigegebenen Belege für den Export.</div>';
    // Export-Log
    var log = db.erpExporte || [];
    if (log.length) html += '<h4 style="margin:12px 0 4px">Export-Verlauf</h4><div class="table-wrap"><table><thead><tr><th>Export-ID</th><th>Zeit</th><th>Belege</th><th>Zeilen</th><th>Prüfsumme</th></tr></thead><tbody>' + log.slice().reverse().slice(0, 12).map(function (e) { return "<tr><td><code>" + esc(e.exportId) + "</code></td><td>" + fmtDateTime(e.erstellt) + "</td><td>" + (e.belegNummern || []).join(", ") + "</td><td>" + e.zeilen + "</td><td><code>" + esc((e.pruefsumme || "").slice(0, 10)) + "</code></td></tr>"; }).join("") + "</tbody></table></div>";
    html += "</div>";
    return html;
  }

  // ---------- Verdrahtung ----------
  function rzWire() {
    $all("[data-rztab]").forEach(function (b) { b.onclick = function () { rz.tab = b.getAttribute("data-rztab"); rz.mode = "liste"; rz.wizard = null; renderRechnungen(); }; });
    // Liste
    if ($("#rz-neu")) $("#rz-neu").onclick = rzWizardStart;
    $all("[data-rz-open]").forEach(function (r) { r.onclick = function () { rz.belegId = r.getAttribute("data-rz-open"); rz.mode = "detail"; renderRechnungen(); }; });
    ["kunde", "kommission", "art", "status", "von", "bis"].forEach(function (k) { var el = $("#rz-f-" + k); if (el) el.onchange = function () { rz.filter[k] = el.value; renderRechnungen(); }; });
    if ($("#rz-f-ueberfaellig")) $("#rz-f-ueberfaellig").onchange = function () { rz.filter.ueberfaellig = this.checked; renderRechnungen(); };
    if ($("#rz-f-reset")) $("#rz-f-reset").onclick = function () { rz.filter = { kunde: "", kommission: "", art: "", status: "", von: "", bis: "", ueberfaellig: false }; renderRechnungen(); };
    // Belegdetail
    if ($("#rz-back")) $("#rz-back").onclick = function () { rz.mode = "liste"; renderRechnungen(); };
    if ($("#rz-pdf")) $("#rz-pdf").onclick = function () { rechnungPdf(rzCurrentBeleg()); };
    if ($("#rz-freigabe")) $("#rz-freigabe").onclick = function () { rzFreigabeDialog(rzCurrentBeleg()); };
    if ($("#rz-edit")) $("#rz-edit").onclick = function () { rzWizardEdit(rzCurrentBeleg()); };
    if ($("#rz-zahlung")) $("#rz-zahlung").onclick = function () { rzZahlungDialog(rzCurrentBeleg()); };
    if ($("#rz-gutschrift")) $("#rz-gutschrift").onclick = function () { rzKorrekturDialog(rzCurrentBeleg(), "Gutschrift"); };
    if ($("#rz-storno")) $("#rz-storno").onclick = function () { rzKorrekturDialog(rzCurrentBeleg(), "Stornobeleg"); };
    if ($("#rz-portal")) $("#rz-portal").onclick = function () { var b = rzCurrentBeleg(); b.portalSichtbar = !b.portalSichtbar; Store.save(); renderRechnungen(); toast(b.portalSichtbar ? "Rechnung im Kundenportal sichtbar." : "Aus Portal entfernt."); };
    // Nachträge
    if ($("#nt-neu")) $("#nt-neu").onclick = function () { rzNachtragModal(null); };
    $all("[data-nt-open]").forEach(function (r) { r.onclick = function () { rz.ntId = r.getAttribute("data-nt-open"); rz.mode = "ntdetail"; renderRechnungen(); }; });
    if ($("#nt-back")) $("#nt-back").onclick = function () { rz.mode = "liste"; renderRechnungen(); };
    if ($("#nt-kalk")) $("#nt-kalk").onclick = function () { var n = rzCurrentNt(); Rechnung.nachtragKalkulieren(n, Store.nowISO()); Store.save(); renderRechnungen(); toast("Nachtrag kalkuliert."); };
    if ($("#nt-frei")) $("#nt-frei").onclick = function () { Rechnung.nachtragStatus(rzCurrentNt(), "freigegeben", Store.nowISO()); Store.save(); renderRechnungen(); toast("Nachtrag intern freigegeben."); };
    if ($("#nt-ang")) $("#nt-ang").onclick = function () { Rechnung.nachtragStatus(rzCurrentNt(), "angenommen", Store.nowISO()); Store.save(); renderRechnungen(); toast("Nachtrag als angenommen markiert."); };
    if ($("#nt-abl")) $("#nt-abl").onclick = function () { Rechnung.nachtragStatus(rzCurrentNt(), "abgelehnt", Store.nowISO()); Store.save(); renderRechnungen(); toast("Nachtrag abgelehnt."); };
    if ($("#nt-zusatz")) $("#nt-zusatz").onclick = function () { rzZusatzDialog(rzCurrentNt()); };
    if ($("#nt-edit")) $("#nt-edit").onclick = function () { rzNachtragModal(rzCurrentNt()); };
    // ERP
    if ($("#erp-all")) $("#erp-all").onchange = function () { var c = this.checked; $all("[data-erp-sel]").forEach(function (x) { x.checked = c; }); };
    if ($("#erp-preview")) $("#erp-preview").onclick = function () { rzErpPreview(false); };
    if ($("#erp-export")) $("#erp-export").onclick = function () { rzErpPreview(true); };
    // Wizard
    rzWizardWire();
  }
  function rzCurrentBeleg() { return (db.rechnungen || []).filter(function (x) { return x.id === rz.belegId; })[0]; }
  function rzCurrentNt() { return (db.nachtraege || []).filter(function (x) { return x.id === rz.ntId; })[0]; }

  // ---------- Rechnungsassistent (Wizard) ----------
  function rzWizardStart() {
    rz.wizard = { schritt: 1, editBelegId: null, auftragId: "", art: "Teilrechnung", positionen: [], nachtragIds: [], anrechnungen: [], mwstProz: 20, rabattProz: 0, zahlungszielTage: 14, skontoProz: 0, skontoTage: 0, reverseCharge: false, reverseChargeBestaetigt: false, reverseChargeHinweis: "Steuerschuldnerschaft des Leistungsempfängers.", steuerBestaetigt: false, leistungVon: "", leistungBis: "" };
    renderRechnungen();
  }
  function rzWizardEdit(b) {
    rz.wizard = { schritt: 2, editBelegId: b.id, auftragId: b.auftragId || "", art: b.art, positionen: JSON.parse(JSON.stringify(b.positionen || [])), nachtragIds: [], anrechnungen: (b.anrechnungen || []).slice(), mwstProz: b.mwstProz, rabattProz: b.rabattProz, zahlungszielTage: b.zahlungszielTage, skontoProz: b.skontoProz, skontoTage: b.skontoTage, reverseCharge: b.reverseCharge, reverseChargeBestaetigt: b.reverseChargeBestaetigt, reverseChargeHinweis: b.reverseChargeHinweis, steuerBestaetigt: true, leistungVon: (b.leistungszeitraum || {}).von || "", leistungBis: (b.leistungszeitraum || {}).bis || "" };
    renderRechnungen();
  }
  // Temporären Beleg aus dem Wizard bauen (für Engine-Summen; keine UI-Formel).
  function rzWizardBeleg() {
    var wz = rz.wizard;
    return Rechnung.belegNeu({ mandantId: null, kundeId: rzWizardKundeId(), kommission: (rzAuftrag(wz.auftragId) || {}).kommission || "", auftragId: wz.auftragId, art: wz.art, mwstProz: wz.mwstProz, rabattProz: wz.rabattProz, zahlungszielTage: wz.zahlungszielTage, skontoProz: wz.skontoProz, skontoTage: wz.skontoTage, reverseCharge: wz.reverseCharge, reverseChargeBestaetigt: wz.reverseChargeBestaetigt, reverseChargeHinweis: wz.reverseChargeHinweis, positionen: wz.positionen, anrechnungen: wz.anrechnungen, leistungszeitraum: { von: wz.leistungVon || null, bis: wz.leistungBis || null } }, Store.nowISO());
  }
  function rzWizardKundeId() { var a = rzAuftrag(rz.wizard.auftragId); return a ? a.kundeId : null; }
  function rzWizardHtml() {
    var wz = rz.wizard; var schritt = wz.schritt;
    var kopf = '<div class="card"><div class="inline" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h3 style="margin:0">' + (wz.editBelegId ? "Positionen bearbeiten" : "Rechnungsassistent") + " – Schritt " + schritt + "/4</h3><button class=\"btn sm ghost\" id=\"wz-cancel\" type=\"button\">Abbrechen</button></div>";
    var body = "";
    if (schritt === 1) {
      var aufOpt = '<option value="">— Auftrag wählen —</option>' + (db.auftraege || []).map(function (a) { return '<option value="' + esc(a.id) + '"' + (wz.auftragId === a.id ? " selected" : "") + ">" + esc(a.titel || a.id) + " · " + esc(a.kommission || "") + "</option>"; }).join("");
      var artOpt = ["Akontorechnung", "Abschlagsrechnung", "Teilrechnung", "Schlussrechnung"].map(function (a) { return '<option value="' + a + '"' + (wz.art === a ? " selected" : "") + ">" + a + "</option>"; }).join("");
      body = '<label class="fld"><span class="lbl">1. Auftrag auswählen</span><select id="wz-auftrag">' + aufOpt + "</select></label>" +
        '<label class="fld"><span class="lbl">2. Rechnungsart</span><select id="wz-art">' + artOpt + "</select></label>";
    } else if (schritt === 2) {
      body = rzPositionEditorHtml() + rzNachtragAuswahlHtml();
    } else if (schritt === 3) {
      body = rzFruehereRechnungenHtml() + rzSteuerZahlungHtml();
    } else {
      body = rzWizardVorschauHtml();
    }
    var nav = '<div class="btn-row" style="margin-top:14px">' + (schritt > 1 ? '<button class="btn ghost" id="wz-back" type="button">‹ Zurück</button>' : "") + (schritt < 4 ? '<button class="btn primary" id="wz-next" type="button">Weiter ›</button>' : '<button class="btn ghost" id="wz-entwurf" type="button">Als Entwurf speichern</button><button class="btn primary" id="wz-freigabe" type="button">Prüfen &amp; freigeben</button>') + "</div>";
    return kopf + body + nav + "</div>";
  }
  function rzPositionEditorHtml() {
    var wz = rz.wizard;
    var rows = wz.positionen.map(function (p, i) {
      return '<tr><td><input data-wzp="bezeichnung" data-i="' + i + '" value="' + esc(p.bezeichnung) + '" style="min-width:160px"></td>' +
        '<td><input data-wzp="menge" data-i="' + i + '" type="number" step="any" value="' + esc(p.menge) + '" style="width:70px"></td>' +
        '<td><input data-wzp="einheit" data-i="' + i + '" value="' + esc(p.einheit || "") + '" style="width:60px"></td>' +
        '<td><input data-wzp="einzelpreis" data-i="' + i + '" type="number" step="any" value="' + esc(p.einzelpreis) + '" style="width:90px"></td>' +
        '<td><input data-wzp="rabattProz" data-i="' + i + '" type="number" step="any" value="' + esc(p.rabattProz || 0) + '" style="width:60px"></td>' +
        '<td><input data-wzp="mwstProz" data-i="' + i + '" type="number" step="any" value="' + esc(p.mwstProz != null ? p.mwstProz : wz.mwstProz) + '" style="width:60px"></td>' +
        '<td><input data-wzp="gesamtmenge" data-i="' + i + '" type="number" step="any" value="' + esc(p.gesamtmenge != null ? p.gesamtmenge : "") + '" style="width:70px" placeholder="—"></td>' +
        '<td><input data-wzp="bereitsAbgerechnet" data-i="' + i + '" type="number" step="any" value="' + esc(p.bereitsAbgerechnet || 0) + '" style="width:70px"></td>' +
        '<td class="num">' + fmtEUR(Rechnung.posNetto(p)) + "</td>" +
        '<td class="inline" style="gap:2px"><button class="btn sm ghost" data-wzp-up="' + i + '" type="button" title="hoch">↑</button><button class="btn sm ghost" data-wzp-dup="' + i + '" type="button" title="duplizieren">⧉</button><button class="btn sm danger" data-wzp-del="' + i + '" type="button" title="entfernen">✕</button></td></tr>';
    }).join("");
    return '<h4 style="margin:6px 0">3. Abzurechnende Positionen</h4><div class="table-wrap"><table><thead><tr><th>Bezeichnung</th><th>Menge</th><th>Einh.</th><th>Einzel</th><th>Rab%</th><th>USt%</th><th>Gesamtmg.</th><th>bisher</th><th class="num">Netto</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="10" class="muted">Noch keine Positionen.</td></tr>') + '</tbody></table></div><button class="btn sm" id="wz-addpos" type="button">+ Position</button>' +
      '<p class="hint">Teilmenge: „Gesamtmg." und „bisher" bestimmen die verbleibende abrechenbare Menge. Beträge werden zentral über die Engine berechnet.</p>';
  }
  function rzNachtragAuswahlHtml() {
    var wz = rz.wizard;
    var nts = (db.nachtraege || []).filter(function (n) { return n.auftragId === wz.auftragId && n.status === "angenommen"; });
    if (!nts.length) return '<div class="muted" style="font-size:12px;margin-top:8px">Keine angenommenen Nachträge für diesen Auftrag.</div>';
    return '<h4 style="margin:10px 0 4px">Angenommene Nachträge übernehmen</h4>' + nts.map(function (n) { return '<label class="inline" style="gap:8px;align-items:center;font-size:13px;display:flex;margin:4px 0"><input type="checkbox" data-wz-nt="' + esc(n.id) + '"> ' + esc(n.nummer || "") + " · " + esc(n.bezeichnung) + " (" + fmtEUR(n.sollSnapshot ? n.sollSnapshot.netto : 0) + ")</label>"; }).join("");
  }
  function rzFruehereRechnungenHtml() {
    var wz = rz.wizard;
    var frueher = (db.rechnungen || []).filter(function (b) { return b.freigegeben && b.auftragId === wz.auftragId && Rechnung.NEGATIVE_ARTEN.indexOf(b.art) < 0 && b.id !== wz.editBelegId; });
    var aw = rzAuftrag(wz.auftragId);
    var stand = aw && aw.kalk ? Rechnung.abrechnungsstand(aw.kalk.netto, (db.nachtraege || []).filter(function (n) { return n.auftragId === wz.auftragId; }), frueher) : null;
    var html = "<h4 style=\"margin:6px 0\">4. Frühere Rechnungen berücksichtigen</h4>";
    if (stand) html += '<div class="grid cols-4">' + stat("Auftragswert aktuell", fmtEUR(stand.gesamtNetto)) + stat("bereits verrechnet", fmtEUR(stand.verrechnetNetto)) + stat("offen (netto)", fmtEUR(stand.offenNetto)) + stat("Vorschlag Schluss", fmtEUR(Rechnung.schlussVorschlagNetto(aw.kalk.netto, (db.nachtraege || []).filter(function (n) { return n.auftragId === wz.auftragId; }), frueher))) + "</div>";
    html += frueher.length ? frueher.map(function (b) { var s = rzSum(b); var checked = wz.anrechnungen.some(function (a) { return a.belegId === b.id; }); return '<label class="inline" style="gap:8px;align-items:center;font-size:13px;display:flex;margin:4px 0"><input type="checkbox" data-wz-anr="' + esc(b.id) + '"' + (checked ? " checked" : "") + "> " + esc(b.nummer) + " · " + esc(b.art) + " (" + fmtEUR(s.brutto) + ")</label>"; }).join("") : '<div class="muted" style="font-size:12px">Keine früheren Rechnungen.</div>';
    return html;
  }
  function rzSteuerZahlungHtml() {
    var wz = rz.wizard;
    return '<h4 style="margin:10px 0 4px">5. Steuerart bestätigen &amp; Zahlungsbedingungen</h4>' +
      '<label class="inline" style="gap:8px;align-items:center;font-size:13px;display:flex;margin:4px 0"><input type="checkbox" id="wz-rc"' + (wz.reverseCharge ? " checked" : "") + "> Reverse Charge (Steuerschuldnerschaft des Leistungsempfängers)</label>" +
      '<label class="inline" style="gap:8px;align-items:center;font-size:13px;display:flex;margin:4px 0"><input type="checkbox" id="wz-steuer"' + (wz.steuerBestaetigt ? " checked" : "") + "> Ich habe die Steuerart geprüft und bestätige sie ausdrücklich (keine automatische steuerliche Beurteilung).</label>" +
      '<div class="grid cols-3" style="margin-top:6px"><label class="fld"><span class="lbl">Zahlungsziel (Tage)</span><input type="number" id="wz-ziel" value="' + esc(wz.zahlungszielTage) + '"></label>' +
      '<label class="fld"><span class="lbl">Skonto %</span><input type="number" step="any" id="wz-skontop" value="' + esc(wz.skontoProz) + '"></label>' +
      '<label class="fld"><span class="lbl">Skonto Tage</span><input type="number" id="wz-skontot" value="' + esc(wz.skontoTage) + '"></label></div>' +
      '<div class="grid cols-2"><label class="fld"><span class="lbl">Leistungszeitraum von</span><input type="date" id="wz-lvon" value="' + esc(wz.leistungVon) + '"></label><label class="fld"><span class="lbl">bis</span><input type="date" id="wz-lbis" value="' + esc(wz.leistungBis) + '"></label></div>';
  }
  function rzWizardVorschauHtml() {
    var b = rzWizardBeleg(); var s = rzSum(b); var wz = rz.wizard;
    var aw = rzAuftrag(wz.auftragId);
    var frueher = (db.rechnungen || []).filter(function (x) { return x.freigegeben && x.auftragId === wz.auftragId && Rechnung.NEGATIVE_ARTEN.indexOf(x.art) < 0 && x.id !== wz.editBelegId; });
    var ueber = aw && aw.kalk ? Rechnung.pruefeUeberrechnung(Rechnung.auftragswert(aw.kalk.netto, (db.nachtraege || []).filter(function (n) { return n.auftragId === wz.auftragId; })).aktuellNetto, Rechnung.verrechnetNetto(frueher), s.netto, false) : { ueberrechnet: false };
    var html = '<h4 style="margin:6px 0">6. Vorschau</h4>';
    if (ueber.ueberrechnet) html += '<div class="fehler-box">⚠️ Überrechnung: Diese Rechnung überschreitet den Auftragswert um ' + fmtEUR(ueber.ueberschussNetto) + " (netto). Freigabe nur mit Begründung/Berechtigung.</div>";
    if (b.reverseCharge && !wz.steuerBestaetigt) html += '<div class="fehler-box">Steuerart nicht bestätigt.</div>';
    html += '<div class="table-wrap"><table><thead><tr><th>Pos</th><th>Bezeichnung</th><th class="num">Menge</th><th class="num">Einzel</th><th class="num">Netto</th></tr></thead><tbody>' +
      b.positionen.map(function (p) { return "<tr><td>" + esc(p.nummer) + "</td><td>" + esc(p.bezeichnung) + '</td><td class="num">' + p.menge + '</td><td class="num">' + fmtEUR(p.einzelpreis) + '</td><td class="num">' + fmtEUR(Rechnung.posNetto(p)) + "</td></tr>"; }).join("") + "</tbody></table></div>" +
      '<div class="grid cols-2"><div></div><div class="card">' + s.steuerZeilen.map(function (z) { return '<div class="zeile"><span>USt ' + z.satz + "%</span><span>" + fmtEUR(z.steuer) + "</span></div>"; }).join("") +
      '<div class="zeile"><strong>Netto</strong><strong>' + fmtEUR(s.netto) + "</strong></div><div class=\"zeile\"><span>USt</span><span>" + fmtEUR(s.mwst) + "</span></div>" +
      (s.angerechnetBrutto ? '<div class="zeile"><span>abzügl. Anrechnung</span><span>-' + fmtEUR(s.angerechnetBrutto) + "</span></div>" : "") +
      '<div class="zeile" style="font-size:16px"><strong>Brutto</strong><strong>' + fmtEUR(s.brutto) + "</strong></div></div></div>";
    rz.wizard._ueber = ueber.ueberrechnet;
    return html;
  }
  function rzWizardWire() {
    var wz = rz.wizard; if (!wz) return;
    if ($("#wz-cancel")) $("#wz-cancel").onclick = function () { rz.wizard = null; renderRechnungen(); };
    if ($("#wz-back")) $("#wz-back").onclick = function () { wz.schritt = Math.max(1, wz.schritt - 1); renderRechnungen(); };
    if ($("#wz-next")) $("#wz-next").onclick = function () { rzWizardCollect(); if (wz.schritt === 1 && !wz.auftragId) { toast("Bitte einen Auftrag wählen.", "err"); return; } if (wz.schritt === 1 && !wz.positionen.length) rzWizardPrefill(); wz.schritt = Math.min(4, wz.schritt + 1); renderRechnungen(); };
    if ($("#wz-auftrag")) $("#wz-auftrag").onchange = function () { wz.auftragId = this.value; };
    if ($("#wz-art")) $("#wz-art").onchange = function () { wz.art = this.value; };
    // Positionseditor
    $all("[data-wzp]").forEach(function (inp) { inp.onchange = function () { var i = +inp.getAttribute("data-i"); var key = inp.getAttribute("data-wzp"); var v = inp.value; wz.positionen[i][key] = (["menge", "einzelpreis", "rabattProz", "mwstProz", "gesamtmenge", "bereitsAbgerechnet"].indexOf(key) >= 0) ? (v === "" ? (key === "gesamtmenge" ? null : 0) : parseFloat(v)) : v; renderRechnungen(); }; });
    $all("[data-wzp-del]").forEach(function (b2) { b2.onclick = function () { wz.positionen.splice(+b2.getAttribute("data-wzp-del"), 1); renderRechnungen(); }; });
    $all("[data-wzp-dup]").forEach(function (b2) { b2.onclick = function () { var i = +b2.getAttribute("data-wzp-dup"); wz.positionen.splice(i + 1, 0, JSON.parse(JSON.stringify(wz.positionen[i]))); rzRenumber(); renderRechnungen(); }; });
    $all("[data-wzp-up]").forEach(function (b2) { b2.onclick = function () { var i = +b2.getAttribute("data-wzp-up"); if (i > 0) { var t = wz.positionen[i - 1]; wz.positionen[i - 1] = wz.positionen[i]; wz.positionen[i] = t; rzRenumber(); renderRechnungen(); } }; });
    if ($("#wz-addpos")) $("#wz-addpos").onclick = function () { wz.positionen.push({ nummer: String(wz.positionen.length + 1), bezeichnung: "", menge: 1, einheit: "", einzelpreis: 0, rabattProz: 0, mwstProz: wz.mwstProz, gesamtmenge: null, bereitsAbgerechnet: 0 }); renderRechnungen(); };
    $all("[data-wz-nt]").forEach(function (cb) { cb.onchange = function () { var n = (db.nachtraege || []).filter(function (x) { return x.id === cb.getAttribute("data-wz-nt"); })[0]; if (cb.checked && n) { wz.positionen.push({ nummer: String(wz.positionen.length + 1), bezeichnung: "Nachtrag " + (n.nummer || "") + " – " + n.bezeichnung, menge: 1, einheit: "Pausch.", einzelpreis: n.sollSnapshot ? n.sollSnapshot.netto : 0, rabattProz: 0, mwstProz: n.mwstProz, gesamtmenge: null, bereitsAbgerechnet: 0, bezug: { nachtragId: n.id } }); renderRechnungen(); } }; });
    $all("[data-wz-anr]").forEach(function (cb) { cb.onchange = function () { var b3 = (db.rechnungen || []).filter(function (x) { return x.id === cb.getAttribute("data-wz-anr"); })[0]; var s = rzSum(b3); if (cb.checked) wz.anrechnungen.push({ belegId: b3.id, bezeichnung: b3.nummer, netto: s.netto, mwst: s.mwst, brutto: s.brutto }); else wz.anrechnungen = wz.anrechnungen.filter(function (a) { return a.belegId !== b3.id; }); renderRechnungen(); }; });
    if ($("#wz-rc")) $("#wz-rc").onchange = function () { wz.reverseCharge = this.checked; };
    if ($("#wz-steuer")) $("#wz-steuer").onchange = function () { wz.steuerBestaetigt = this.checked; wz.reverseChargeBestaetigt = this.checked && wz.reverseCharge; };
    if ($("#wz-entwurf")) $("#wz-entwurf").onclick = function () { rzWizardSpeichern(false); };
    if ($("#wz-freigabe")) $("#wz-freigabe").onclick = function () { rzWizardSpeichern(true); };
  }
  function rzWizardCollect() {
    var wz = rz.wizard;
    if ($("#wz-ziel")) wz.zahlungszielTage = parseFloat($("#wz-ziel").value) || 0;
    if ($("#wz-skontop")) wz.skontoProz = parseFloat($("#wz-skontop").value) || 0;
    if ($("#wz-skontot")) wz.skontoTage = parseFloat($("#wz-skontot").value) || 0;
    if ($("#wz-lvon")) wz.leistungVon = $("#wz-lvon").value;
    if ($("#wz-lbis")) wz.leistungBis = $("#wz-lbis").value;
    if ($("#wz-auftrag")) wz.auftragId = $("#wz-auftrag").value;
    if ($("#wz-art")) wz.art = $("#wz-art").value;
  }
  function rzRenumber() { rz.wizard.positionen.forEach(function (p, i) { p.nummer = String(i + 1); }); }
  function rzWizardPrefill() {
    var wz = rz.wizard; var a = rzAuftrag(wz.auftragId); if (!a) return;
    var basis = a.kalk ? a.kalk.netto : 0;
    var titel = wz.art === "Akontorechnung" ? "Akontozahlung" : wz.art === "Schlussrechnung" ? "Schlussrechnung Restleistung" : "Teilleistung lt. Auftrag";
    wz.positionen = [{ nummer: "1", bezeichnung: titel + " – " + (a.titel || ""), menge: 1, einheit: "Pausch.", einzelpreis: basis, rabattProz: 0, mwstProz: wz.mwstProz, gesamtmenge: null, bereitsAbgerechnet: 0 }];
  }
  function rzWizardSpeichern(freigeben) {
    rzWizardCollect(); var wz = rz.wizard;
    if (!wz.positionen.length) { toast("Bitte mindestens eine Position.", "err"); return; }
    if (freigeben && !wz.steuerBestaetigt) { toast("Bitte Steuerart ausdrücklich bestätigen.", "err"); return; }
    if (freigeben && wz._ueber && !w.confirm("Achtung: Der Auftragswert wird überrechnet. Trotzdem freigeben (Begründung liegt vor)?")) return;
    var b;
    if (wz.editBelegId) { b = (db.rechnungen || []).filter(function (x) { return x.id === wz.editBelegId; })[0]; if (!b || b.freigegeben) { toast("Beleg nicht bearbeitbar.", "err"); return; }
      var neu = rzWizardBeleg(); b.positionen = neu.positionen; b.anrechnungen = neu.anrechnungen; b.mwstProz = wz.mwstProz; b.rabattProz = wz.rabattProz; b.zahlungszielTage = wz.zahlungszielTage; b.skontoProz = wz.skontoProz; b.skontoTage = wz.skontoTage; b.reverseCharge = wz.reverseCharge; b.reverseChargeBestaetigt = wz.reverseChargeBestaetigt; b.leistungszeitraum = neu.leistungszeitraum; b.geaendert = Store.nowISO();
    } else { b = rzWizardBeleg(); b.ersteller = (Auth.current() || {}).benutzername || ""; (db.rechnungen = db.rechnungen || []).push(b); }
    if (freigeben) {
      var r = Rechnung.belegFreigeben(b, db.settings, { benutzer: (Auth.current() || {}).benutzername || "", firma: db.settings.firma, kunde: (db.kunden || []).filter(function (k) { return k.id === b.kundeId; })[0] || {} }, Store.nowISO());
      if (!r.ok) { toast("Freigabe nicht möglich: " + r.grund, "err"); Store.save(); return; }
      toast("Rechnung " + r.nummer + " freigegeben.");
    } else toast("Entwurf gespeichert.");
    Store.save(); rz.wizard = null; rz.belegId = b.id; rz.mode = "detail"; rz.tab = "rechnungen"; renderRechnungen();
  }

  // ---------- Freigabe-Prüfdialog ----------
  function rzFreigabeDialog(b) {
    var s = rzSum(b); var kunde = (db.kunden || []).filter(function (k) { return k.id === b.kundeId; })[0] || {};
    var body = '<p class="muted" style="font-size:12px">Bitte vor Freigabe prüfen. Nach Freigabe ist der Beleg unveränderbar (Korrektur nur über Gutschrift/Storno).</p>' +
      '<div class="table-wrap"><table><tbody>' + dokZeile("Kunde", esc(kunde.name || "—")) + dokZeile("Firma", esc((db.settings.firma || {}).name || "—")) + dokZeile("Positionen", (b.positionen || []).length) + dokZeile("Steuerart", b.reverseCharge ? "Reverse Charge" + (b.reverseChargeBestaetigt ? " (bestätigt)" : " NICHT bestätigt") : "Regelbesteuerung") + dokZeile("Netto/USt/Brutto", fmtEUR(s.netto) + " / " + fmtEUR(s.mwst) + " / " + fmtEUR(s.brutto)) + dokZeile("Zahlungsziel", b.zahlungszielTage + " Tage") + "</tbody></table></div>" +
      (b.reverseCharge && !b.reverseChargeBestaetigt ? '<div class="fehler-box">Reverse Charge nicht bestätigt – Freigabe gesperrt.</div>' : "");
    openModal("Rechnung prüfen & freigeben", body, function () {
      var r = Rechnung.belegFreigeben(b, db.settings, { benutzer: (Auth.current() || {}).benutzername || "", firma: db.settings.firma, kunde: kunde }, Store.nowISO());
      if (!r.ok) { toast("Freigabe nicht möglich: " + r.grund, "err"); return false; }
      Store.save(); renderRechnungen(); toast("Rechnung " + r.nummer + " freigegeben."); return true;
    }, "Endgültig freigeben");
  }

  // ---------- Zahlung ----------
  function rzZahlungDialog(b) {
    var offen = rzOffen(b);
    var body = '<div class="muted" style="font-size:12px;margin-bottom:6px">Offener Betrag: <strong>' + fmtEUR(offen) + "</strong> von " + fmtEUR(rzSum(b).brutto) + "</div>" +
      '<div class="grid cols-2"><label class="fld"><span class="lbl">Betrag</span><input type="number" step="any" id="zz-betrag" value="' + esc(offen) + '"></label>' +
      '<label class="fld"><span class="lbl">Datum</span><input type="date" id="zz-datum" value="' + new Date().toISOString().slice(0, 10) + '"></label></div>' +
      '<div class="grid cols-2"><label class="fld"><span class="lbl">Zahlungsart</span><input id="zz-art" value="Überweisung"></label><label class="fld"><span class="lbl">Referenz</span><input id="zz-ref"></label></div>' +
      '<label class="fld"><span class="lbl">Notiz</span><input id="zz-notiz"></label>';
    openModal("Zahlung erfassen", body, function () {
      var betrag = parseFloat($("#zz-betrag").value); if (!(betrag > 0)) { toast("Betrag ungültig.", "err"); return false; }
      Rechnung.zahlungErfassen(b, { betrag: betrag, datum: $("#zz-datum").value ? new Date($("#zz-datum").value).toISOString() : Store.nowISO(), art: $("#zz-art").value, referenz: $("#zz-ref").value, notiz: $("#zz-notiz").value, erfasstVon: (Auth.current() || {}).benutzername || "" }, Store.nowISO());
      Store.save(); renderRechnungen(); toast("Zahlung erfasst (" + b.zahlungstatus + ")."); return true;
    }, "Zahlung speichern");
  }

  // ---------- Gutschrift / Storno ----------
  function rzKorrekturDialog(b, art) {
    var voll = art === "Stornobeleg";
    var body = '<p class="muted" style="font-size:12px">' + (voll ? "Storno kehrt den gesamten Beleg um." : "Gutschrift zu " + esc(b.nummer) + ".") + " Der Originalbeleg bleibt unverändert erhalten.</p>" +
      (voll ? "" : '<label class="fld"><span class="lbl">Gutschriftbetrag (netto)</span><input type="number" step="any" id="ko-betrag" value="' + esc(rzSum(b).netto) + '"></label>') +
      '<label class="fld"><span class="lbl">Grund</span><input id="ko-grund" value=""></label>';
    openModal(art + " erstellen", body, function () {
      var neu;
      if (voll) neu = Rechnung.stornoZu(b, { grund: $("#ko-grund").value, ersteller: (Auth.current() || {}).benutzername || "" }, Store.nowISO());
      else { var betrag = parseFloat($("#ko-betrag").value) || 0; neu = Rechnung.gutschriftZu(b, { positionen: [{ bezeichnung: "Gutschrift zu " + b.nummer + (($("#ko-grund").value) ? " – " + $("#ko-grund").value : ""), menge: 1, einheit: "Pausch.", einzelpreis: betrag, mwstProz: b.mwstProz }], grund: $("#ko-grund").value, ersteller: (Auth.current() || {}).benutzername || "" }, Store.nowISO()); }
      (db.rechnungen = db.rechnungen || []).push(neu);
      var r = Rechnung.belegFreigeben(neu, db.settings, { benutzer: (Auth.current() || {}).benutzername || "", firma: db.settings.firma, kunde: (db.kunden || []).filter(function (k) { return k.id === b.kundeId; })[0] || {} }, Store.nowISO());
      Store.save(); rz.belegId = neu.id; renderRechnungen(); toast(art + " " + (r.nummer || "") + " erstellt."); return true;
    }, art + " freigeben");
  }

  // ---------- Nachtrag anlegen/bearbeiten ----------
  function rzNachtragModal(n) {
    var neu = !n;
    var aufOpt = (db.auftraege || []).map(function (a) { return '<option value="' + esc(a.id) + '"' + (n && n.auftragId === a.id ? " selected" : "") + ">" + esc(a.titel || a.id) + "</option>"; }).join("");
    var ursOpt = Rechnung.NACHTRAG_URSACHEN.map(function (u) { return '<option value="' + esc(u) + '"' + (n && n.ursache === u ? " selected" : "") + ">" + esc(u) + "</option>"; }).join("");
    var k = n ? n.kalk : {};
    var mat = (k && k.material) || {}, arb = (k && k.arbeit) || {};
    var body = '<label class="fld"><span class="lbl">Hauptauftrag</span><select id="nt-auftrag">' + aufOpt + "</select></label>" +
      '<div class="grid cols-2"><label class="fld"><span class="lbl">Bezeichnung</span><input id="nt-bez" value="' + esc(n ? n.bezeichnung : "") + '"></label><label class="fld"><span class="lbl">Ursache</span><select id="nt-urs">' + ursOpt + "</select></label></div>" +
      '<label class="fld"><span class="lbl">Beschreibung</span><textarea id="nt-beschr" rows="2">' + esc(n ? n.beschreibung : "") + "</textarea></label>" +
      '<div class="muted" style="font-size:12px;margin:6px 0">Kalkulationszeilen (Verkaufswerte werden über die zentrale Engine berechnet):</div>' +
      '<div class="grid cols-3"><label class="fld"><span class="lbl">Material Menge</span><input type="number" step="any" id="nt-m-menge" value="' + esc(mat.menge || "") + '"></label><label class="fld"><span class="lbl">Material EK/Einh.</span><input type="number" step="any" id="nt-m-ek" value="' + esc(mat.einkaufspreis || "") + '"></label><label class="fld"><span class="lbl">Materialaufschlag %</span><input type="number" step="any" id="nt-m-auf" value="' + esc(mat.materialaufschlagProz || "") + '"></label></div>' +
      '<div class="grid cols-3"><label class="fld"><span class="lbl">Arbeit Std.</span><input type="number" step="any" id="nt-a-std" value="' + esc(arb.bearbeitungProStk || "") + '"></label><label class="fld"><span class="lbl">interner Satz</span><input type="number" step="any" id="nt-a-int" value="' + esc(arb.internerSatz || 40) + '"></label><label class="fld"><span class="lbl">Verkaufssatz</span><input type="number" step="any" id="nt-a-vk" value="' + esc(arb.verkaufSatz || 70) + '"></label></div>';
    openModal(neu ? "Neuer Nachtrag" : "Nachtrag bearbeiten", body, function () {
      var bez = ($("#nt-bez").value || "").trim(); if (!bez) { toast("Bezeichnung erforderlich.", "err"); return false; }
      var auf = rzAuftrag($("#nt-auftrag").value) || {};
      var kalk = { material: { menge: parseFloat($("#nt-m-menge").value) || 0, einkaufspreis: parseFloat($("#nt-m-ek").value) || 0, materialaufschlagProz: parseFloat($("#nt-m-auf").value) || 0, verschnittProz: 0, frachtanteil: 0 }, arbeit: { ruestzeit: 0, bearbeitungProStk: parseFloat($("#nt-a-std").value) || 0, stueckzahl: 1, anzahlMitarbeiter: 1, internerSatz: parseFloat($("#nt-a-int").value) || 0, verkaufSatz: parseFloat($("#nt-a-vk").value) || 0 } };
      if (neu) {
        var obj = Rechnung.nachtragNeu({ mandantId: null, auftragId: auf.id, kommission: auf.kommission, kundeId: auf.kundeId, bezeichnung: bez, beschreibung: $("#nt-beschr").value, ursache: $("#nt-urs").value, gemeldetVon: (Auth.current() || {}).benutzername || "", mwstProz: (db.settings || {}).mwst || 20, kalk: kalk }, Store.nowISO());
        obj.nummer = "NT-" + new Date().getFullYear() + "-" + ("000" + (((db.settings.nachtragZaehler || 1))) ).slice(-4); db.settings.nachtragZaehler = (db.settings.nachtragZaehler || 1) + 1;
        (db.nachtraege = db.nachtraege || []).push(obj); rz.ntId = obj.id; rz.mode = "ntdetail";
      } else { n.bezeichnung = bez; n.beschreibung = $("#nt-beschr").value; n.ursache = $("#nt-urs").value; n.auftragId = auf.id; n.kommission = auf.kommission; n.kundeId = auf.kundeId; n.kalk = kalk; n.sollSnapshot = null; n.status = "in Prüfung"; }
      Store.save(); renderRechnungen(); toast(neu ? "Nachtrag angelegt." : "Nachtrag aktualisiert."); return true;
    }, neu ? "Anlegen" : "Speichern");
  }
  function rzZusatzDialog(n) {
    openModal("Zusatzleistung aus Zeiterfassung", '<label class="fld"><span class="lbl">Beschreibung</span><input id="zl-beschr"></label><label class="fld"><span class="lbl">Stunden</span><input type="number" step="any" id="zl-std" value="1"></label>', function () {
      Rechnung.zusatzUebernehmen(n, { beschreibung: $("#zl-beschr").value, stunden: parseFloat($("#zl-std").value) || 0 }, Store.nowISO());
      Store.save(); renderRechnungen(); toast("Zusatzleistung übernommen (Prüfliste)."); return true;
    }, "Übernehmen");
  }

  // ---------- ERP-Vorschau/Export ----------
  function rzErpAuswahl() { return $all("[data-erp-sel]").filter(function (x) { return x.checked; }).map(function (x) { return (db.rechnungen || []).filter(function (b) { return b.id === x.getAttribute("data-erp-sel"); })[0]; }).filter(Boolean); }
  function rzErpPreview(exportieren) {
    var belege = rzErpAuswahl();
    if (!belege.length) { toast("Bitte Belege auswählen.", "err"); return; }
    var lookup = {}; (db.kunden || []).forEach(function (k) { lookup[k.id] = k.name; });
    var exp = Rechnung.erpExport(belege, lookup, Rechnung.standardMappingProfil(), Store.nowISO());
    var dop = Rechnung.erpDoppelt(db.erpExporte || [], exp);
    var box = $("#erp-preview-box");
    if (!exportieren) {
      if (box) box.innerHTML = '<div class="card" style="margin-top:10px"><h4>Vorschau (' + exp.zeilen + ' Zeilen)</h4>' + (dop.doppelt ? '<div class="fehler-box">Doppelter Export erkannt: ' + esc(dop.grund) + " (früher: " + esc(dop.frueher) + ")</div>" : "") + '<pre style="white-space:pre-wrap;font-size:11px;background:var(--panel-2);padding:8px;border-radius:6px;max-height:260px;overflow:auto">' + esc(exp.csv.slice(0, 4000)) + "</pre></div>";
      return;
    }
    if (dop.doppelt && !w.confirm("Achtung: " + dop.grund + " (früher: " + dop.frueher + "). Trotzdem erneut exportieren?")) return;
    // Datei herunterladen
    try { var blob = new Blob([exp.csv], { type: "text/csv;charset=utf-8" }); var url = w.URL.createObjectURL(blob); var a = el("a"); a.href = url; a.download = exp.dateiname; d.body.appendChild(a); a.click(); d.body.removeChild(a); w.URL.revokeObjectURL(url); } catch (e) {}
    (db.erpExporte = db.erpExporte || []).push({ exportId: exp.exportId, pruefsumme: exp.pruefsumme, belege: exp.belege, belegNummern: exp.belegNummern, zeilen: exp.zeilen, erstellt: exp.erstellt, status: exp.status });
    belege.forEach(function (b) { b.erpExportId = exp.exportId; b.erpStatus = "Dateiexport"; });
    Store.save(); renderRechnungen(); toast("ERP-Datei erzeugt (" + exp.exportId + ").");
  }

  // ---------- Rechnungs-PDF (A4, Druckfenster) ----------
  function rechnungPdf(b) {
    if (!b) return;
    var s = rzSum(b); var firma = db.settings.firma || {}; var kunde = (db.kunden || []).filter(function (k) { return k.id === b.kundeId; })[0] || {};
    var auf = rzAuftrag(b.auftragId) || {};
    var kennung = (b.nummer || "ENTWURF") + (b.snapshot && b.snapshot.pruefsumme ? "-" + b.snapshot.pruefsumme.slice(0, 8) : "");
    var posRows = (b.positionen || []).map(function (p) {
      var satz = b.reverseCharge ? 0 : (p.mwstProz != null ? p.mwstProz : b.mwstProz);
      return "<tr><td>" + esc(p.nummer) + "</td><td>" + esc(p.bezeichnung) + (p.beschreibung ? '<br><span class="muted">' + esc(p.beschreibung) + "</span>" : "") + '</td><td class="num">' + p.menge + "</td><td>" + esc(p.einheit || "") + '</td><td class="num">' + fmtEUR(p.einzelpreis) + '</td><td class="num">' + (p.rabattProz || 0) + '%</td><td class="num">' + satz + '%</td><td class="num">' + fmtEUR(Rechnung.posNetto(p)) + "</td></tr>";
    }).join("");
    var steuer = s.steuerZeilen.map(function (z) { return '<div class="t"><span>Nettobetrag ' + z.satz + "%</span><span>" + fmtEUR(z.netto) + "</span></div><div class=\"t\"><span>zzgl. USt " + z.satz + "%</span><span>" + fmtEUR(z.steuer) + "</span></div>"; }).join("");
    var anr = (b.anrechnungen || []).length ? '<div style="margin-top:8px"><strong>Bereits berechnet:</strong><table>' + b.anrechnungen.map(function (a) { return "<tr><td>" + esc(a.bezeichnung || "") + "</td><td class='num'>" + fmtEUR(a.brutto) + "</td></tr>"; }).join("") + "</table></div>" : "";
    var bezahlt = Rechnung.bezahltBetrag(b), offen = rzOffen(b);
    var inner = '<div style="display:flex;justify-content:space-between"><div><strong style="font-size:16px">' + esc(firma.name || "") + "</strong><br><span class='muted'>" + esc([firma.strasse, firma.plzOrt].filter(Boolean).join(", ")) + "</span></div>" +
      "<div style='text-align:right'><span class='muted'>" + esc(b.art) + "</span><br><strong style='font-size:15px'>" + esc(b.nummer || "(Entwurf)") + "</strong></div></div><hr>" +
      "<div style='display:flex;justify-content:space-between'><div>" + esc(kunde.name || "") + "<br><span class='muted'>" + esc([kunde.strasse, kunde.plzOrt].filter(Boolean).join(", ")) + "</span></div>" +
      "<div style='text-align:right' class='muted'>Datum: " + fmtDate(b.rechnungsdatum) + "<br>" + (b.faelligkeit ? "Fällig: " + fmtDate(b.faelligkeit) + "<br>" : "") + (b.leistungszeitraum && b.leistungszeitraum.von ? "Leistung: " + fmtDate(b.leistungszeitraum.von) + "–" + fmtDate(b.leistungszeitraum.bis) + "<br>" : "") + "Projekt/Kommission: " + esc(b.kommission || "") + "<br>Auftrag: " + esc(auf.titel || b.auftragId || "") + "</div></div>" +
      '<table style="margin-top:10px"><thead><tr><th>Pos</th><th>Bezeichnung</th><th class="num">Menge</th><th>Einh.</th><th class="num">Einzel</th><th class="num">Rab.</th><th class="num">USt</th><th class="num">Netto</th></tr></thead><tbody>' + posRows + "</tbody></table>" +
      '<div style="margin-left:auto;max-width:340px;margin-top:10px">' + steuer + '<div class="t g"><span>Rechnungsbetrag (brutto)</span><span>' + fmtEUR(s.brutto) + "</span></div>" + anr +
      (Rechnung.TEILARTEN.concat(["Schlussrechnung"]).indexOf(b.art) >= 0 ? '<div class="t"><span>bereits bezahlt</span><span>' + fmtEUR(bezahlt) + '</span></div><div class="t g"><span>offener Betrag</span><span>' + fmtEUR(offen) + "</span></div>" : "") + "</div>" +
      (b.reverseCharge && b.reverseChargeBestaetigt ? '<p class="muted">' + esc(b.reverseChargeHinweis || "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).") + "</p>" : "") +
      '<p class="muted">Zahlbar innerhalb ' + (b.zahlungszielTage || 0) + " Tagen" + (b.skontoProz ? ", " + b.skontoProz + "% Skonto binnen " + b.skontoTage + " Tagen" : "") + ". Bankverbindung: " + esc(firma.bank || "") + " · IBAN " + esc(firma.iban || "") + " · BIC " + esc(firma.bic || "") + (firma.uid ? " · UID " + esc(firma.uid) : "") + "</p>" +
      '<p class="muted" style="margin-top:6px">Belegkennung: ' + esc(kennung) + " · Keine steuerliche/rechtliche Konformitätsaussage.</p>";
    pdfFensterRechnung("Rechnung " + (b.nummer || ""), firma, inner);
  }
  function pdfFensterRechnung(titel, firma, innerHtml) {
    var wnd = w.open("", "_blank"); if (!wnd) { toast("Bitte Pop-ups erlauben.", "err"); return; }
    var doc = '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>' + esc(titel) + '</title><style>' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#1c2530;max-width:800px;margin:22px auto;padding:0 20px;font-size:12px}hr{border:none;border-top:1px solid #ccc;margin:10px 0}' +
      'table{width:100%;border-collapse:collapse;margin:4px 0}th,td{text-align:left;padding:5px 7px;border-bottom:1px solid #e2e2e2;font-size:11.5px}td.num,th.num{text-align:right;white-space:nowrap}.muted{color:#667;font-size:11px}' +
      '.t{display:flex;justify-content:space-between;padding:3px 0}.t.g{font-weight:700;font-size:14px;border-top:2px solid #333;margin-top:4px;padding-top:6px}' +
      '@media print{.noprint{display:none}} @page{margin:16mm}</style></head><body>' + innerHtml +
      '<div class="noprint" style="margin:16px 0"><button onclick="window.print()" style="padding:10px 16px;font-size:14px">🖨️ Drucken / als PDF speichern</button></div></body></html>';
    wnd.document.open(); wnd.document.write(doc); wnd.document.close();
  }

  // ============================================================
  //  OFFLINE-SYNCHRONISATION – kompakte Diagnose (Phase 14A)
  //  Nur Anzeige + ein funktionierender „Jetzt synchronisieren"-
  //  Knopf. Keine unfertigen Aktions-Schaltflächen.
  // ============================================================
  function offlineDiagnoseCardHtml() {
    if (!Offline) return "";
    var z;
    try { z = Offline.zusammenfassung(); } catch (e) { return ""; }
    var badge = function (ok, t, f) { return '<span class="badge" style="background:' + (ok ? "#2fbf71" : "#888") + ';color:#fff">' + esc(ok ? t : f) + "</span>"; };
    var at = z.aktiverTimer;
    var html = '<div class="card" style="margin-top:12px;border-left:4px solid #7a9d5a"><div class="inline" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h3 style="margin:0">📶 Offline-Synchronisation</h3>' +
      '<div class="inline" style="flex:0">' + badge(z.online, "online", "offline") + '<button class="btn sm" id="off-sync" type="button"' + (z.online ? "" : " disabled") + ">↻ Jetzt synchronisieren</button></div></div>";
    html += '<div class="grid cols-4" style="margin-top:10px">' +
      stat("Aktiver Timer", at ? "läuft" : "keiner", at ? "warn" : "") +
      stat("Lokale/wartende", z.wartend) + stat("Synchronisiert", z.synchronisiert) + stat("Konflikte", z.konflikte, z.konflikte ? "warn" : "green") + "</div>";
    html += '<div class="table-wrap" style="margin-top:8px"><table><tbody>' +
      dokZeile("Speicher-Treiber", esc(z.treiber) + " · DB v" + z.dbVersion) +
      dokZeile("Gerät", esc(z.geraet || "—")) +
      dokZeile("Letzte Synchronisation", z.letzteSync ? fmtDateTime(z.letzteSync) : "—") +
      dokZeile("App-Version", esc((buildInfo() || {}).version || "—")) +
      (at ? dokZeile("Timer seit", fmtDateTime(at.seit) + (at.aufPause ? " (pausiert)" : "") + " · Auftrag " + esc(at.auftragId || "—")) : "") +
      "</tbody></table></div>";
    var kfl = Offline.konflikte();
    if (kfl.length) html += '<h4 style="margin:10px 0 4px">Konflikte (lokale Daten bleiben erhalten)</h4>' + kfl.slice(0, 10).map(function (r) { return '<div class="insight"><span class="ico">🔴</span><span>' + esc(r.typ) + "/" + esc(r.event || "") + " – " + esc(r.fehler || "") + '</span></div>'; }).join("");
    html += '<p class="hint">Offline erfasste Ereignisse werden dauerhaft gespeichert (IndexedDB/localStorage) und exakt einmal in die aktive Mandanten-db übernommen. Offline-Daten gelten bei der Übernahme als nicht vertrauenswürdig und werden erneut geprüft. Keine vertraulichen Kosten/Margen werden offline gehalten.</p></div>';
    return html;
  }
  function verdrahteOfflineDiagnose() {
    if (!Offline) return;
    if ($("#off-sync")) $("#off-sync").onclick = function () { var r = Offline.synchronisiere(); if (r.ok) { db = Store.load(); toast("Synchronisiert: " + r.verarbeitet + " übernommen" + (r.konflikte ? ", " + r.konflikte + " Konflikt(e)" : "") + "."); } else toast("Synchronisation: " + r.grund, "err"); renderSystem(); };
  }

  function systemBackup() {
    try {
      var json = Store.exportJSON();
      var blob = new Blob([json], { type: "application/json" });
      var url = w.URL.createObjectURL(blob);
      var a = el("a"); a.href = url; a.download = "preisschmiede-backup.json"; d.body.appendChild(a); a.click(); d.body.removeChild(a); w.URL.revokeObjectURL(url);
      db.settings.betrieb.backupMeta = db.settings.betrieb.backupMeta || {};
      db.settings.betrieb.backupMeta.letztes = Store.nowISO();
      db.settings.betrieb.backupMeta.status = "ok";
      db.settings.betrieb.backupMeta.groesseKB = Math.round(json.length / 1024);
      Store.save(); renderSystem(); toast("Backup erstellt und protokolliert.");
    } catch (e) { db.settings.betrieb.backupMeta.status = "fehlgeschlagen"; Store.save(); toast("Backup fehlgeschlagen (ID " + protokolliereFehler(e, "backup") + ").", "err"); }
  }

  function supportPaketDialog() {
    var paket = Betrieb.supportPaket(db, buildInfo(), (w.navigator && w.navigator.userAgent) || "", Date.now());
    var sensibel = Betrieb.enthaeltSensibles(paket);
    var vorschau = JSON.stringify(paket, null, 2);
    var body = '<p class="muted" style="font-size:12px">Vorschau des Support-Pakets. Enthält KEINE Passwörter, Tokens, Secrets, vollständigen Kundendaten oder vertraulichen Kalkulationen.</p>' +
      (sensibel.length ? '<div class="fehler-box">Achtung: potenziell sensible Felder erkannt (' + esc(sensibel.join(", ")) + ") – Export blockiert.</div>" : "") +
      '<pre style="white-space:pre-wrap;font-size:11px;background:var(--panel-2);padding:8px;border-radius:6px;max-height:320px;overflow:auto">' + esc(vorschau) + "</pre>";
    openModalWide("Support-Paket – Vorschau", body, sensibel.length ? null : function () {
      var blob = new Blob([vorschau], { type: "application/json" });
      var url = w.URL.createObjectURL(blob);
      var a = el("a"); a.href = url; a.download = "preisschmiede-support.json"; d.body.appendChild(a); a.click(); d.body.removeChild(a); w.URL.revokeObjectURL(url);
      toast("Support-Paket exportiert."); return true;
    }, null, null);
  }

  // Release-Stufen-Banner (nur für Administration sichtbar)
  function aktualisiereReleaseBanner() {
    var alt = $("#release-banner"); if (alt) alt.parentNode.removeChild(alt);
    if (!Auth.istAngemeldet() || !Auth.darf("system")) return;
    var b = (db.settings.betrieb) || {}; var st = Betrieb.stufe(b.releaseStufe);
    if (st.key === "produktion" && !b.wartungsmodus) return; // im Vollbetrieb dezent
    var bar = el("div", { id: "release-banner" }, (b.wartungsmodus ? "🛠️ WARTUNGSMODUS · " : "") + "Stufe: " + esc(st.label));
    bar.className = "release-banner";
    bar.style.background = st.farbe;
    d.body.appendChild(bar);
  }

  function stat(label, value, cls, delta) {
    return '<div class="stat"><div class="label">' + esc(label) + '</div><div class="value ' + (cls || "") + '">' +
      esc(value) + "</div>" + (delta ? '<div class="delta">' + esc(delta) + "</div>" : "") + "</div>";
  }
  function statusBadge(s) {
    var cls = s === "Abgeschlossen" ? "abgeschlossen" : (s === "Beauftragt" ? "beauftragt" : "angebot");
    return '<span class="badge ' + cls + '">' + esc(s) + "</span>";
  }
  function erkenntnisseHTML(limit) {
    var ek = (db.lernen && db.lernen.erkenntnisse) || [];
    if (!ek.length) {
      return '<div class="empty">Noch keine Muster erkannt. Schließe Aufträge mit Ist-Zeiten ab, damit die App lernt.</div>';
    }
    return ek.slice(0, limit || 99).map(function (e) {
      return '<div class="insight"><span class="ico">💡</span><span>' + esc(e.text) +
        ' <span class="muted">(' + e.samples + ' Aufträge)</span></span></div>';
    }).join("");
  }

  // ============================================================
  //  STAMMDATEN
  // ============================================================
  function renderStammdaten() {
    var s = db.settings;
    var f = s.firma || {};
    var root = $("#page-stammdaten .content");
    root.innerHTML =
      '<div class="card" style="margin-bottom:16px"><h3>Firmendaten <span class="sub">erscheinen im Angebots-Briefkopf</span></h3>' +
        '<div class="inline">' +
          fld2("Firmenname", "firma-name", f.name, "text") +
          fld2("Inhaber", "firma-inhaber", f.inhaber, "text") +
        "</div><div class=\"inline\">" +
          fld2("Straße", "firma-strasse", f.strasse, "text") +
          fld2("PLZ / Ort", "firma-plzOrt", f.plzOrt, "text") +
        "</div><div class=\"inline\">" +
          fld2("Telefon", "firma-tel", f.tel, "text") +
          fld2("E-Mail", "firma-email", f.email, "text") +
        "</div><div class=\"inline\">" +
          fld2("Web", "firma-web", f.web, "text") +
          fld2("UID-Nr.", "firma-uid", f.uid, "text") +
        "</div><div class=\"inline\">" +
          fld2("IBAN", "firma-iban", f.iban, "text") +
          fld2("BIC", "firma-bic", f.bic, "text") +
          fld2("Bank", "firma-bank", f.bank, "text") +
        "</div>" +
      "</div>" +
      '<div class="grid cols-2">' +
        '<div class="card"><h3>Stundenverrechnungssätze <span class="sub">€ / Stunde</span></h3>' +
          fld("Planung / CAD", "rate-cad", s.rates.cad, "€/h") +
          fld("Fertigung", "rate-fertigung", s.rates.fertigung, "€/h") +
          fld("Montage", "rate-montage", s.rates.montage, "€/h") +
          fld("Projektleitung", "rate-projektleitung", s.rates.projektleitung, "€/h") +
        "</div>" +
        '<div class="card"><h3>Zuschläge & Kalkulation <span class="sub">in %</span></h3>' +
          fld("Materialaufschlag", "set-materialAufschlag", s.materialAufschlag, "%") +
          fld("Gemeinkosten", "set-gemeinkosten", s.gemeinkosten, "%") +
          fld("Gewinnaufschlag", "set-gewinn", s.gewinn, "%") +
          fld("Standard-Verschnitt", "set-verschnitt", s.verschnitt, "%") +
          fld("Umsatzsteuer", "set-mwst", s.mwst, "%") +
        "</div>" +
      "</div>" +
      '<div class="card" style="margin-top:16px"><h3>Mitarbeiter <span class="sub">Stundenverrechnungssätze je Mitarbeiter</span></h3>' +
        '<div id="mitarbeiter-bereich"></div>' +
      "</div>" +
      '<div class="card" style="margin-top:16px"><h3>Maschinen der Firma <span class="sub">Maschinenstundensatz (€/h) + Rüstzeit/-kosten – werden zusätzlich zum Lohn berechnet</span></h3>' +
        '<div id="maschinen-bereich"></div>' +
      "</div>" +
      '<div class="card" style="margin-top:16px"><h3>Lieferanten <span class="sub">Bezugsquellen für Material</span></h3>' +
        '<div id="lieferanten-bereich"></div>' +
      "</div>" +
      (Auth && Auth.istAdmin() ? '<div class="card" style="margin-top:16px"><h3>Benutzer &amp; Rollen <span class="sub">Anmeldung &amp; Berechtigungen</span></h3><div id="benutzer-bereich"></div></div>' : "") +
      '<div class="btn-row" style="margin-top:16px">' +
        '<button class="btn primary" id="btn-save-stammdaten">Stammdaten speichern</button>' +
        '<button class="btn ghost" id="btn-reset-stammdaten">Auf Standard zurücksetzen</button>' +
      "</div>" +
      '<hr class="sep">' +
      '<div class="card"><h3>Daten-Verwaltung</h3>' +
        '<p class="muted" style="font-size:13px">Alle Daten liegen ausschließlich lokal in diesem Browser. Erstelle ein Backup oder übertrage deine Daten auf ein anderes Gerät.</p>' +
        '<div class="btn-row">' +
          '<button class="btn primary" id="btn-sync">📡 Geräte-Sync (WLAN)</button>' +
          '<button class="btn" id="btn-export">⬇️ Backup exportieren</button>' +
          '<button class="btn" id="btn-import">⬆️ Backup importieren</button>' +
          '<button class="btn danger" id="btn-reset-all">Alle Daten löschen</button>' +
        "</div>" +
        '<p class="hint">Geräte-Sync: PC und Handy im selben WLAN verbinden und alle Daten übertragen.</p>' +
        '<input type="file" id="file-import" accept="application/json" style="display:none">' +
      "</div>" +
      (Auth.istAdmin() ?
        '<hr class="sep"><div class="card" style="border-left:3px solid #e0a000"><h3>🧪 Performance-Testdaten <span class="sub">nur für Entwicklung/Test</span></h3>' +
        '<p class="muted" style="font-size:13px">Erzeugt viele klar gekennzeichnete Testaufträge/-angebote, um die Dashboard-Performance zu prüfen. Diese Daten sind mit <code>_testdaten</code> markiert und werden nicht automatisch in einer Produktivumgebung angelegt.</p>' +
        '<div class="inline" style="align-items:flex-end"><label class="fld" style="max-width:160px"><span class="lbl">Umfang (Aufträge)</span><input id="perf-n" type="number" value="1000" min="10" max="5000"></label>' +
        '<button class="btn" id="btn-perf-gen" type="button">Testdaten erzeugen</button>' +
        '<button class="btn danger" id="btn-perf-del" type="button">Testdaten entfernen</button></div>' +
        '<div id="perf-info" class="muted" style="font-size:12px;margin-top:6px"></div></div>'
        : "");
    $("#btn-sync").onclick = syncModal;
    if ($("#btn-perf-gen")) $("#btn-perf-gen").onclick = function () { perfTestdaten(leseZahl0($("#perf-n").value) || 1000); };
    if ($("#btn-perf-del")) $("#btn-perf-del").onclick = perfTestdatenEntfernen;
    if ($("#perf-info")) $("#perf-info").textContent = "Aktuell " + (db.auftraege || []).filter(function (a) { return a._testdaten; }).length + " Test-Aufträge, " + (db.angebote || []).filter(function (a) { return a._testdaten; }).length + " Test-Angebote.";

    $("#btn-save-stammdaten").onclick = function () {
      s.rates.cad = numv("#rate-cad"); s.rates.fertigung = numv("#rate-fertigung");
      s.rates.montage = numv("#rate-montage"); s.rates.projektleitung = numv("#rate-projektleitung");
      s.materialAufschlag = numv("#set-materialAufschlag"); s.gemeinkosten = numv("#set-gemeinkosten");
      s.gewinn = numv("#set-gewinn"); s.verschnitt = numv("#set-verschnitt"); s.mwst = numv("#set-mwst");
      s.firma = {
        name: $("#firma-name").value.trim(), inhaber: $("#firma-inhaber").value.trim(),
        strasse: $("#firma-strasse").value.trim(), plzOrt: $("#firma-plzOrt").value.trim(),
        tel: $("#firma-tel").value.trim(), email: $("#firma-email").value.trim(),
        web: $("#firma-web").value.trim(), uid: $("#firma-uid").value.trim(),
        iban: $("#firma-iban").value.trim(), bic: $("#firma-bic").value.trim(), bank: $("#firma-bank").value.trim()
      };
      Store.save();
      toast("Stammdaten gespeichert.");
    };
    $("#btn-reset-stammdaten").onclick = function () {
      db.settings = JSON.parse(JSON.stringify(Store.DEFAULT_SETTINGS));
      Store.save(); renderStammdaten(); toast("Stammdaten zurückgesetzt.");
    };
    $("#btn-export").onclick = function () {
      var blob = new Blob([Store.exportJSON()], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = el("a"); a.href = url; a.download = "preisschmiede-backup.json"; a.click();
      URL.revokeObjectURL(url);
    };
    $("#btn-import").onclick = function () { $("#file-import").click(); };
    $("#file-import").onchange = function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { db = Store.importJSON(r.result); toast("Backup importiert."); navTo("dashboard"); }
        catch (e) { toast("Import fehlgeschlagen: " + e.message, "err"); }
      };
      r.readAsText(f);
    };
    $("#btn-reset-all").onclick = function () {
      if (confirm("Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.")) {
        db = Store.reset(); toast("Alle Daten gelöscht."); navTo("dashboard");
      }
    };
    renderMitarbeiter();
    renderMaschinen();
    renderLieferanten();
    if (Auth && Auth.istAdmin()) renderBenutzer();
  }

  // ---- Kunden-Verwaltung --------------------------------------
  function kundeZeile(k) {
    return [k.name, k.plzOrt].filter(Boolean).join(" · ");
  }
  function renderKunden() {
    var wrap = $("#kunden-bereich");
    if (!wrap) return;
    var liste = db.kunden || [];
    var html = '<div class="btn-row" style="margin-bottom:12px"><button class="btn primary sm" id="btn-add-kunde" type="button">+ Kunde anlegen</button></div>';
    if (!liste.length) {
      html += '<div class="empty">Noch keine Kunden. Lege Kunden an, um sie schnell ins Angebot zu übernehmen.</div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr><th>Kunde</th><th>Ansprechpartner</th><th>Ort</th><th class="num">Aktion</th></tr></thead><tbody>';
      liste.forEach(function (k) {
        html += "<tr><td><strong>" + esc(k.name) + "</strong></td>" +
          "<td>" + esc(k.ansprechpartner || "—") + "</td>" +
          "<td>" + esc(k.plzOrt || "—") + "</td>" +
          '<td class="num"><button class="btn sm ghost" data-kedit="' + k.id + '" type="button">✏️</button> ' +
            '<button class="btn sm danger" data-kdel="' + k.id + '" type="button">🗑️</button></td></tr>';
      });
      html += "</tbody></table></div>";
    }
    wrap.innerHTML = html;
    $("#btn-add-kunde").onclick = function () { kundeModal(null); };
    $all("[data-kedit]", wrap).forEach(function (b) { b.onclick = function () { kundeModal(b.dataset.kedit); }; });
    $all("[data-kdel]", wrap).forEach(function (b) {
      b.onclick = function () {
        if (confirm("Kunde löschen?")) {
          db.kunden = db.kunden.filter(function (k) { return k.id !== b.dataset.kdel; });
          Store.save(); renderKunden();
        }
      };
    });
  }

  function kundeModal(id, onSave) {
    var liste = db.kunden || (db.kunden = []);
    var k = id ? liste.filter(function (x) { return x.id === id; })[0] : null;
    var body =
      fld2("Name / Firma", "k-name", k ? k.name : "", "text") +
      fld2("Ansprechpartner", "k-ap", k ? k.ansprechpartner : "", "text") +
      fld2("Straße", "k-strasse", k ? k.strasse : "", "text") +
      fld2("PLZ / Ort", "k-plzOrt", k ? k.plzOrt : "", "text") +
      '<div class="inline">' +
        fld2("Telefon", "k-tel", k ? k.tel : "", "text") +
        fld2("E-Mail", "k-email", k ? k.email : "", "text") +
      "</div>";
    openModal(k ? "Kunde bearbeiten" : "Kunde anlegen", body, function () {
      var name = $("#k-name").value.trim();
      if (!name) { toast("Bitte Name / Firma angeben.", "err"); return false; }
      var daten = {
        name: name, ansprechpartner: $("#k-ap").value.trim(),
        strasse: $("#k-strasse").value.trim(), plzOrt: $("#k-plzOrt").value.trim(),
        tel: $("#k-tel").value.trim(), email: $("#k-email").value.trim()
      };
      var ziel = k;
      if (k) { Object.keys(daten).forEach(function (key) { k[key] = daten[key]; }); }
      else { daten.id = Store.uid(); daten.erstellt = Store.nowISO(); liste.push(daten); ziel = daten; }
      Store.save(); renderKunden(); toast("Kunde gespeichert.");
      if (onSave) onSave(ziel);
      return true;
    });
  }

  // ============================================================
  //  KUNDEN & PROJEKTE (eigene Seite)
  // ============================================================
  function renderKundenProjekte() {
    var root = $("#page-kundenprojekte .content");
    root.innerHTML =
      '<div class="card" style="margin-bottom:16px"><h3>Kunden <span class="sub">Auftraggeber &amp; Empfänger-Anschrift</span></h3><div id="kunden-bereich"></div></div>' +
      '<div class="card"><h3>Projekte &amp; Kommissionen <span class="sub">Bauvorhaben, einem Kunden zugeordnet</span></h3><div id="projekte-bereich"></div></div>';
    renderKunden();
    renderProjekte();
  }

  function naechsteProjektNr() {
    var jahr = new Date().getFullYear();
    var n = (db.settings && db.settings.projektZaehler) || 1;
    return "P-" + jahr + "-" + ("00" + n).slice(-3);
  }
  function kundeName(id) { var k = (db.kunden || []).filter(function (x) { return x.id === id; })[0]; return k ? k.name : "—"; }

  function renderProjekte() {
    var wrap = $("#projekte-bereich"); if (!wrap) return;
    var liste = db.projekte || (db.projekte = []);
    var html = '<div class="btn-row" style="margin-bottom:12px"><button class="btn primary sm" id="btn-add-projekt" type="button">+ Projekt anlegen</button></div>';
    if (!liste.length) { html += '<div class="empty">Noch keine Projekte. Lege ein Projekt / eine Kommission an und ordne ihm Aufträge zu.</div>'; }
    else {
      html += '<div class="table-wrap"><table><thead><tr><th>Nr.</th><th>Projekt</th><th>Kunde</th><th>Kommission</th><th>Status</th><th class="num">Aktion</th></tr></thead><tbody>';
      liste.forEach(function (p) {
        html += "<tr><td>" + esc(p.nummer || "—") + "</td><td><strong>" + esc(p.name) + "</strong></td><td>" + esc(kundeName(p.kundeId)) + "</td>" +
          "<td>" + (p.kommission ? '<span class="tag">' + esc(p.kommission) + "</span>" : "—") + "</td><td>" + esc(p.status || "Aktiv") + "</td>" +
          '<td class="num"><button class="btn sm ghost" data-pedit="' + p.id + '" type="button">✏️</button> ' +
            '<button class="btn sm danger" data-pdel="' + p.id + '" type="button">🗑️</button></td></tr>';
      });
      html += "</tbody></table></div>";
    }
    wrap.innerHTML = html;
    $("#btn-add-projekt").onclick = function () { projektModal(null); };
    $all("[data-pedit]", wrap).forEach(function (b) { b.onclick = function () { projektModal(b.dataset.pedit); }; });
    $all("[data-pdel]", wrap).forEach(function (b) {
      b.onclick = function () {
        if (confirm("Projekt löschen?")) { db.projekte = db.projekte.filter(function (p) { return p.id !== b.dataset.pdel; }); Store.save(); renderProjekte(); }
      };
    });
  }
  function projektModal(id, onSave) {
    var liste = db.projekte || (db.projekte = []);
    var p = id ? liste.filter(function (x) { return x.id === id; })[0] : null;
    var kundeOpt = '<option value="">— kein Kunde —</option>' + (db.kunden || []).map(function (k) { return '<option value="' + k.id + '"' + (p && p.kundeId === k.id ? " selected" : "") + ">" + esc(k.name) + "</option>"; }).join("");
    var statusOpt = ["Aktiv", "Angebot", "Abgeschlossen", "Storniert"].map(function (s) { return "<option" + (p && p.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("");
    var body =
      '<div class="inline">' + fld2("Projektname", "p-name", p ? p.name : "", "text") + fld2("Projekt-Nr.", "p-nummer", p ? p.nummer : naechsteProjektNr(), "text") + "</div>" +
      '<label class="fld"><span class="lbl">Kunde</span><select id="p-kunde">' + kundeOpt + "</select></label>" +
      '<div class="inline">' + fld2("Kommission / Baustelle", "p-kommission", p ? p.kommission : "", "text") +
        '<label class="fld"><span class="lbl">Status</span><select id="p-status">' + statusOpt + "</select></label>" + "</div>" +
      fld2("Notiz", "p-notiz", p ? p.notiz : "", "text");
    openModal(p ? "Projekt bearbeiten" : "Projekt anlegen", body, function () {
      var name = $("#p-name").value.trim();
      if (!name) { toast("Bitte Projektnamen angeben.", "err"); return false; }
      var daten = { nummer: $("#p-nummer").value.trim(), name: name, kundeId: $("#p-kunde").value, kommission: $("#p-kommission").value.trim(), status: $("#p-status").value, notiz: $("#p-notiz").value.trim() };
      var ziel = p;
      if (p) { Object.keys(daten).forEach(function (k) { p[k] = daten[k]; }); }
      else { daten.id = Store.uid(); daten.erstellt = Store.nowISO(); liste.push(daten); ziel = daten; db.settings.projektZaehler = (db.settings.projektZaehler || 1) + 1; }
      Store.save(); renderProjekte(); toast("Projekt gespeichert.");
      if (onSave) onSave(ziel);
      return true;
    });
  }

  // ============================================================
  //  PRODUKTKONFIGURATOR (Phase 3A)
  // ============================================================
  var TAET_LABEL = {
    cad: "CAD/Planung", projektleitung: "Projektleitung", arbeitsvorbereitung: "Arbeitsvorbereitung",
    zuschnitt: "Zuschnitt", saegen: "Sägen", lasern: "Lasern", plasma: "Plasmaschneiden", bohren: "Bohren",
    stanzen: "Stanzen", kanten: "Kanten", schweissen: "Schweißen", schleifen: "Schleifen", entgraten: "Entgraten",
    oberflaeche: "Oberflächenbearbeitung", qualitaet: "Qualitätskontrolle", verpackung: "Verpackung",
    beladung: "Beladung", montage: "Montage", fahrtzeit: "Fahrtzeit", dokumentation: "Dokumentation"
  };
  function taetLabel(k) { return TAET_LABEL[k] || k; }
  function alleGruppen() { return db.produktgruppen || (db.produktgruppen = []); }
  function aktiveGruppen() { return alleGruppen().filter(function (g) { return g.aktiv !== false && !g.archiviert; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }); }
  function gruppeByKey(key) { return alleGruppen().filter(function (g) { return g.key === key; })[0] || null; }
  function gruppeName(key) { var g = gruppeByKey(key); return g ? g.name : (key || "—"); }
  function vorlageFuer(gruppeKey) {
    var vs = (db.vorlagen || []).filter(function (v) { return v.gruppeKey === gruppeKey && v.aktiv !== false; });
    return vs.sort(function (a, b) { return (b.version || 0) - (a.version || 0); })[0] || null;
  }
  // Für eine bestehende Konfiguration die eingefrorene Vorlage verwenden
  function vorlageDerKonfig(cfg) {
    if (cfg && cfg.vorlageSnapshot && cfg.vorlageSnapshot.length) {
      return { id: cfg.vorlageId, gruppeKey: cfg.gruppeKey, version: cfg.vorlageVersion, felder: cfg.vorlageSnapshot };
    }
    return vorlageFuer(cfg ? cfg.gruppeKey : null);
  }
  function naechsteKonfigNr() {
    var jahr = new Date().getFullYear();
    var n = (db.settings.konfigZaehler || 1);
    return "K-" + jahr + "-" + ("00" + n).slice(-3);
  }

  var kfState = null; // { config, vorlage, schritt, istBearbeitung }

  function renderKonfigurator() {
    if (kfState) renderWizard();
    else renderKonfigListe();
  }

  // ---- Liste aller Produktkonfigurationen -------------------
  var konfigFilter = { suche: "", gruppe: "", status: "" };
  function renderKonfigListe() {
    var root = $("#page-konfigurator .content");
    var liste = db.konfigurationen || (db.konfigurationen = []);
    var statusOpt = ["", "Entwurf", "Fertig"].map(function (s) { return '<option value="' + s + '"' + (konfigFilter.status === s ? " selected" : "") + ">" + (s || "Alle Status") + "</option>"; }).join("");
    var gruppenOpt = '<option value="">Alle Produktgruppen</option>' + aktiveGruppen().map(function (g) { return '<option value="' + esc(g.key) + '"' + (konfigFilter.gruppe === g.key ? " selected" : "") + ">" + esc(g.name) + "</option>"; }).join("");
    var html = '<div class="card">' +
      '<div class="btn-row" style="margin-bottom:12px"><button class="btn primary sm" id="btn-konfig-neu" type="button">+ Neue Konfiguration</button>' +
      (Auth.darf("produktgruppen") ? ' <button class="btn sm" id="btn-produktgruppen" type="button">🗂️ Produktgruppen verwalten</button>' : "") + "</div>" +
      '<div class="inline" style="margin-bottom:10px">' +
        '<input id="konfig-suche" placeholder="🔍 Suche: Bezeichnung, Nr., Kommission, Kunde" value="' + esc(konfigFilter.suche) + '" style="flex:2">' +
        '<select id="konfig-gruppe" style="flex:1;min-width:150px">' + gruppenOpt + "</select>" +
        '<select id="konfig-status" style="flex:1;min-width:120px">' + statusOpt + "</select>" +
      "</div>" +
      '<div id="konfig-liste"></div></div>';
    root.innerHTML = html;
    $("#btn-konfig-neu").onclick = function () { konfigNeu(); };
    var bpg = $("#btn-produktgruppen"); if (bpg) bpg.onclick = function () { renderProduktgruppen(); };
    $("#konfig-suche").addEventListener("input", function () { konfigFilter.suche = this.value; zeichneKonfigListe(); });
    $("#konfig-gruppe").addEventListener("change", function () { konfigFilter.gruppe = this.value; zeichneKonfigListe(); });
    $("#konfig-status").addEventListener("change", function () { konfigFilter.status = this.value; zeichneKonfigListe(); });
    zeichneKonfigListe();
  }
  function zeichneKonfigListe() {
    var ziel = $("#konfig-liste"); if (!ziel) return;
    var suche = (konfigFilter.suche || "").toLowerCase().trim();
    var liste = (db.konfigurationen || []).filter(function (c) {
      if (konfigFilter.gruppe && c.gruppeKey !== konfigFilter.gruppe) return false;
      if (konfigFilter.status && (c.status || "Entwurf") !== konfigFilter.status) return false;
      if (!suche) return true;
      var hay = [c.bezeichnung, c.nummer, c.kommission, kundeName(c.kundeId)].filter(Boolean).join(" ").toLowerCase();
      return hay.indexOf(suche) >= 0;
    });
    if (!liste.length) { ziel.innerHTML = '<div class="empty">Keine Konfigurationen. Lege mit „+ Neue Konfiguration" die erste an.</div>'; return; }
    // Karten-Darstellung (mobiltauglich) + Tabelle am Desktop via CSS
    var html = '<div class="table-wrap"><table><thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Produktgruppe</th><th>Kunde</th><th>Kommission</th><th>Status</th><th class="num">Aktion</th></tr></thead><tbody>';
    liste.slice().reverse().forEach(function (c) {
      html += "<tr><td>" + esc(c.nummer || "—") + "</td>" +
        "<td><strong>" + esc(c.bezeichnung || "(ohne Bezeichnung)") + "</strong>" + (c.beispiel ? ' <span class="tag">Beispiel</span>' : "") + "</td>" +
        "<td>" + esc(gruppeName(c.gruppeKey)) + "</td>" +
        "<td>" + esc(kundeName(c.kundeId)) + "</td>" +
        "<td>" + (c.kommission ? '<span class="tag">' + esc(c.kommission) + "</span>" : "—") + "</td>" +
        "<td>" + ((c.status || "Entwurf") === "Entwurf" ? '<span class="muted">Entwurf</span>' : "Fertig") + "</td>" +
        '<td class="num" style="white-space:nowrap">' +
          '<button class="btn sm" data-kopen="' + c.id + '" type="button">Öffnen</button> ' +
          '<button class="btn sm ghost" data-kdup="' + c.id + '" type="button" title="Duplizieren">📋</button> ' +
          '<button class="btn sm danger" data-kdel="' + c.id + '" type="button">🗑️</button></td></tr>';
    });
    html += "</tbody></table></div>";
    ziel.innerHTML = html;
    $all("[data-kopen]", ziel).forEach(function (b) { b.onclick = function () { konfigOeffnen(b.dataset.kopen); }; });
    $all("[data-kdup]", ziel).forEach(function (b) { b.onclick = function () { konfigDuplizieren(b.dataset.kdup); }; });
    $all("[data-kdel]", ziel).forEach(function (b) {
      b.onclick = function () {
        if (confirm("Konfiguration löschen?")) { db.konfigurationen = db.konfigurationen.filter(function (c) { return c.id !== b.dataset.kdel; }); Store.save(); zeichneKonfigListe(); }
      };
    });
  }
  function konfigOeffnen(id) {
    var c = (db.konfigurationen || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    if ((c.status || "Entwurf") === "Entwurf") konfigStart(c); // Entwurf fortsetzen
    else konfigDetail(id);
  }

  // ---- Assistent (Wizard) -----------------------------------
  function konfigNeu() {
    var c = {
      id: Store.uid(), nummer: naechsteKonfigNr(), bezeichnung: "",
      kundeId: "", projektId: "", kommission: "", gruppeKey: "", vorlageId: "", vorlageVersion: null,
      vorlageSnapshot: null, antworten: {}, berechnet: {}, status: "Entwurf",
      erstellt: Store.nowISO(), geaendert: Store.nowISO(), bearbeiter: (Auth.current() || {}).benutzername || "", verlauf: []
    };
    db.konfigurationen.push(c);
    db.settings.konfigZaehler = (db.settings.konfigZaehler || 1) + 1;
    Store.save();
    konfigStart(c);
  }
  function konfigStart(cfg) {
    kfState = { config: cfg, vorlage: cfg.gruppeKey ? vorlageDerKonfig(cfg) : null, schritt: 0, istBearbeitung: (cfg.status === "Fertig") };
    navTo("konfigurator");
  }
  function konfigBearbeiten(id) {
    var c = (db.konfigurationen || []).filter(function (x) { return x.id === id; })[0];
    if (c) konfigStart(c);
  }
  function konfigDuplizieren(id) {
    var c = (db.konfigurationen || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var kopie = JSON.parse(JSON.stringify(c));
    kopie.id = Store.uid(); kopie.nummer = naechsteKonfigNr();
    kopie.bezeichnung = (c.bezeichnung || "") + " (Kopie)"; kopie.status = "Entwurf"; kopie.beispiel = false;
    kopie.erstellt = Store.nowISO(); kopie.geaendert = Store.nowISO();
    kopie.verlauf = [{ datum: Store.nowISO(), bearbeiter: (Auth.current() || {}).benutzername || "", grund: "Aus " + (c.nummer || "Konfiguration") + " dupliziert (Kommission übernommen)" }];
    db.konfigurationen.push(kopie);
    db.settings.konfigZaehler = (db.settings.konfigZaehler || 1) + 1;
    Store.save();
    toast("Konfiguration dupliziert.");
    konfigStart(kopie);
  }

  function wizardSchritte() {
    var s = [{ key: "start", titel: "Auftraggeber & Kommission" }, { key: "gruppe", titel: "Produktgruppe" }];
    if (kfState.vorlage) {
      Konfig.abschnitte(kfState.vorlage).forEach(function (ab, i) { s.push({ key: "sec" + i, titel: ab.titel, abschnitt: ab }); });
    }
    s.push({ key: "zusammen", titel: "Zusammenfassung" });
    return s;
  }

  function renderWizard() {
    var root = $("#page-konfigurator .content");
    var schritte = wizardSchritte();
    if (kfState.schritt >= schritte.length) kfState.schritt = schritte.length - 1;
    var akt = schritte[kfState.schritt];
    var pct = Math.round((kfState.schritt) / (schritte.length - 1) * 100);
    var html = '<div class="card">';
    html += '<div class="wizard-head"><strong>' + esc(kfState.config.nummer) + "</strong> · Schritt " + (kfState.schritt + 1) + " von " + schritte.length + " – " + esc(akt.titel) + "</div>";
    html += '<div class="progress"><div class="progress-bar" style="width:' + pct + '%"></div></div>';
    html += '<div id="wizard-body"></div>';
    html += '<div id="wizard-fehler"></div>';
    html += '<div class="btn-row wizard-nav">' +
      '<button class="btn ghost" id="wz-abbruch" type="button">Speichern & schließen</button>' +
      (kfState.schritt > 0 ? '<button class="btn" id="wz-zurueck" type="button">← Zurück</button>' : "") +
      (kfState.schritt < schritte.length - 1 ? '<button class="btn primary" id="wz-weiter" type="button">Weiter →</button>'
        : '<button class="btn primary" id="wz-speichern" type="button">✓ Konfiguration speichern</button>') +
      "</div></div>";
    root.innerHTML = html;
    renderWizardBody(akt);
    $("#wz-abbruch").onclick = function () { wizardSammle(akt); konfigAutosave(); kfState = null; toast("Als Entwurf gespeichert."); renderKonfigurator(); };
    if ($("#wz-zurueck")) $("#wz-zurueck").onclick = function () { wizardSammle(akt); konfigAutosave(); kfState.schritt--; renderWizard(); };
    if ($("#wz-weiter")) $("#wz-weiter").onclick = function () {
      wizardSammle(akt); konfigAutosave();
      var f = schrittFehler(akt);
      if (f.length) { zeigeWizardFehler(f); return; }
      kfState.schritt++; renderWizard();
    };
    if ($("#wz-speichern")) $("#wz-speichern").onclick = function () { wizardSammle(akt); konfigSpeichern(); };
  }

  function renderWizardBody(akt) {
    var host = $("#wizard-body");
    var cfg = kfState.config;
    if (akt.key === "start") {
      var kundenOpt = '<option value="">— Kunde wählen —</option>' + (db.kunden || []).map(function (k) { return '<option value="' + k.id + '"' + (cfg.kundeId === k.id ? " selected" : "") + ">" + esc(k.name) + "</option>"; }).join("");
      var projOpt = '<option value="">— kein Projekt —</option>' + (db.projekte || []).map(function (p) { return '<option value="' + p.id + '"' + (cfg.projektId === p.id ? " selected" : "") + ">" + esc(p.nummer ? p.nummer + " · " : "") + esc(p.name) + "</option>"; }).join("");
      host.innerHTML =
        fld2("Bezeichnung der Konfiguration", "wz-bez", cfg.bezeichnung, "text") +
        '<div class="inline" style="align-items:flex-end">' +
          '<label class="fld" style="flex:1"><span class="lbl">Kunde</span><select id="wz-kunde">' + kundenOpt + "</select></label>" +
          '<button class="btn sm" id="wz-kunde-neu" type="button" style="margin-bottom:14px">+ Kunde</button>' + "</div>" +
        '<div class="inline" style="align-items:flex-end">' +
          '<label class="fld" style="flex:1"><span class="lbl">Projekt</span><select id="wz-projekt">' + projOpt + "</select></label>" +
          '<button class="btn sm" id="wz-projekt-neu" type="button" style="margin-bottom:14px">+ Projekt</button>' + "</div>" +
        fld2("Kommission / Baustelle", "wz-kommission", cfg.kommission, "text") +
        '<p class="hint">Die Kommission ist durchsuchbar, filterbar und wird beim Duplizieren übernommen.</p>';
      $("#wz-kunde-neu").onclick = function () { wizardSammle(akt); kundeModal(null, function (k) { cfg.kundeId = k.id; konfigAutosave(); renderWizard(); }); };
      $("#wz-projekt-neu").onclick = function () { wizardSammle(akt); projektModal(null, function (p) { cfg.projektId = p.id; if (p.kommission && !cfg.kommission) cfg.kommission = p.kommission; konfigAutosave(); renderWizard(); }); };
      return;
    }
    if (akt.key === "gruppe") {
      host.innerHTML = '<p class="hint">Produktgruppe wählen – danach erscheinen nur die dafür relevanten Fragen.</p><div class="gruppen-grid" id="wz-gruppen"></div>';
      var grid = $("#wz-gruppen");
      grid.innerHTML = aktiveGruppen().map(function (g) {
        var hatVorlage = !!vorlageFuer(g.key);
        return '<button class="gruppe-karte' + (cfg.gruppeKey === g.key ? " aktiv" : "") + (hatVorlage ? "" : " leer") + '" data-gk="' + esc(g.key) + '" type="button">' +
          '<span class="gk-icon">' + esc(g.icon || "📦") + "</span><span class=\"gk-name\">" + esc(g.name) + "</span>" +
          (hatVorlage ? "" : '<span class="gk-hint">noch keine Vorlage</span>') + "</button>";
      }).join("");
      $all("[data-gk]", grid).forEach(function (b) {
        b.onclick = function () {
          var gk = b.dataset.gk;
          cfg.gruppeKey = gk;
          var vl = vorlageFuer(gk);
          cfg.vorlageId = vl ? vl.id : ""; cfg.vorlageVersion = vl ? vl.version : null;
          kfState.vorlage = vl ? { id: vl.id, gruppeKey: gk, version: vl.version, felder: JSON.parse(JSON.stringify(vl.felder)) } : null;
          konfigAutosave(); renderWizard();
        };
      });
      return;
    }
    if (akt.key === "zusammen") { renderWizardZusammenfassung(host); return; }
    // Abschnitts-Schritt: dynamische Felder rendern (nur sichtbare)
    var felder = (akt.abschnitt.felder || []).filter(function (f) { return Konfig.feldSichtbar(f, cfg.antworten); });
    if (!felder.length) { host.innerHTML = '<p class="hint">Für diesen Abschnitt sind aktuell keine Felder relevant.</p>'; return; }
    host.innerHTML = felder.map(function (f) { return wizardFeldHTML(f); }).join("");
    // Änderungen an Auswahl/Ja-Nein lösen Neu-Rendern aus (Abhängigkeiten)
    $all("[data-fk]", host).forEach(function (inp) {
      var typ = inp.getAttribute("data-typ");
      if (typ === "einfach" || typ === "janein" || typ === "material" || typ === "maschine") {
        inp.addEventListener("change", function () { wizardSammle(akt); konfigAutosave(); renderWizard(); });
      }
    });
  }

  function wizardFeldHTML(f) {
    var cfg = kfState.config;
    var v = cfg.antworten[f.key];
    var t = Konfig.FELDTYPEN[f.typ] || {};
    var lbl = esc(f.frage) + (f.pflicht ? ' <span style="color:var(--red)">*</span>' : "") + (f.einheit ? ' <span class="muted">(' + esc(f.einheit) + ")</span>" : "");
    var hilfe = f.hilfe ? '<span class="lbl-hilfe">' + esc(f.hilfe) + "</span>" : "";
    function wrap(inner) { return '<label class="fld"><span class="lbl">' + lbl + hilfe + "</span>" + inner + "</label>"; }
    var attr = 'data-fk="' + esc(f.key) + '" data-typ="' + esc(f.typ) + '"';
    if (f.typ === "hinweis") return '<p class="hint" style="margin:10px 0">' + esc(f.frage) + "</p>";
    if (f.typ === "textarea") return wrap('<textarea ' + attr + ' rows="2" style="width:100%">' + esc(v == null ? (f.standard || "") : v) + "</textarea>");
    if (t.numerisch) {
      var nv = v == null ? (f.standard != null ? f.standard : "") : v;
      return wrap('<input type="text" inputmode="decimal" ' + attr + ' value="' + esc(nv) + '">');
    }
    if (f.typ === "datum") return wrap('<input type="date" ' + attr + ' value="' + esc(v || "") + '">');
    if (f.typ === "janein") { var an = (v === true || v === "ja"); return wrap('<select ' + attr + '><option value="nein"' + (an ? "" : " selected") + ">Nein</option><option value=\"ja\"" + (an ? " selected" : "") + ">Ja</option></select>"); }
    if (f.typ === "einfach") {
      var opts = (f.optionen || []).map(function (o) { var val = o.wert != null ? o.wert : o; return '<option value="' + esc(val) + '"' + (String(v == null ? f.standard : v) === String(val) ? " selected" : "") + ">" + esc(o.label || val) + "</option>"; }).join("");
      return wrap('<select ' + attr + '><option value="">— bitte wählen —</option>' + opts + "</select>");
    }
    if (f.typ === "material") {
      var mopts = (db.material || []).map(function (m) { return '<option value="' + m.id + '"' + (v === m.id ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("");
      return wrap('<select ' + attr + '><option value="">— Material wählen —</option>' + mopts + "</select>");
    }
    if (f.typ === "maschine") {
      var maopts = (db.settings.maschinen || []).map(function (m) { return '<option value="' + m.id + '"' + (v === m.id ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("");
      return wrap('<select ' + attr + '><option value="">— Maschine wählen —</option>' + maopts + "</select>");
    }
    if (f.typ === "mehrfach") {
      var quelle = f.quelle;
      var eintraege;
      if (quelle === "maschine") eintraege = (db.settings.maschinen || []).map(function (m) { return { wert: m.id, label: m.name }; });
      else if (quelle === "taetigkeit") eintraege = Konfig.TAETIGKEITEN.map(function (k) { return { wert: k, label: taetLabel(k) }; });
      else if (quelle === "material") eintraege = (db.material || []).map(function (m) { return { wert: m.id, label: m.name }; });
      else eintraege = (f.optionen || []).map(function (o) { return { wert: o.wert != null ? o.wert : o, label: o.label || o.wert || o }; });
      var sel = Array.isArray(v) ? v : [];
      var boxes = eintraege.map(function (e) {
        return '<label class="check"><input type="checkbox" data-mf="' + esc(f.key) + '" value="' + esc(e.wert) + '"' + (sel.map(String).indexOf(String(e.wert)) >= 0 ? " checked" : "") + "> " + esc(e.label) + "</label>";
      }).join("");
      return '<div class="fld"><span class="lbl">' + lbl + hilfe + '</span><div class="check-grid" data-fk="' + esc(f.key) + '" data-typ="mehrfach">' + boxes + "</div></div>";
    }
    // Standard: kurzer Text
    return wrap('<input type="text" ' + attr + ' value="' + esc(v == null ? (f.standard || "") : v) + '">');
  }

  function wizardSammle(akt) {
    var cfg = kfState.config;
    if (akt.key === "start") {
      cfg.bezeichnung = ($("#wz-bez") || {}).value != null ? $("#wz-bez").value.trim() : cfg.bezeichnung;
      if ($("#wz-kunde")) cfg.kundeId = $("#wz-kunde").value;
      if ($("#wz-projekt")) cfg.projektId = $("#wz-projekt").value;
      if ($("#wz-kommission")) cfg.kommission = $("#wz-kommission").value.trim();
      return;
    }
    if (akt.key === "gruppe" || akt.key === "zusammen") return;
    var host = $("#wizard-body"); if (!host) return;
    $all("[data-fk]", host).forEach(function (el) {
      var key = el.getAttribute("data-fk"), typ = el.getAttribute("data-typ");
      var t = Konfig.FELDTYPEN[typ] || {};
      if (typ === "mehrfach") {
        var werte = $all('[data-mf="' + key + '"]', el).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
        cfg.antworten[key] = werte;
      } else if (typ === "janein") {
        cfg.antworten[key] = (el.value === "ja");
      } else if (t.numerisch) {
        var raw = el.value.trim();
        cfg.antworten[key] = raw === "" ? "" : leseZahl0(raw);
      } else {
        cfg.antworten[key] = el.value;
      }
    });
  }

  // Fehler nur für die sichtbaren Pflichtfelder des aktuellen Schritts
  function schrittFehler(akt) {
    var cfg = kfState.config;
    if (akt.key === "start") { return cfg.bezeichnung ? [] : [{ text: "Bitte eine Bezeichnung angeben." }]; }
    if (akt.key === "gruppe") { return cfg.gruppeKey && kfState.vorlage ? [] : [{ text: "Bitte eine Produktgruppe mit Vorlage wählen." }]; }
    if (!akt.abschnitt) return [];
    var fehler = [];
    akt.abschnitt.felder.forEach(function (f) {
      if (!Konfig.feldSichtbar(f, cfg.antworten)) return;
      if (!f.pflicht) return;
      var v = cfg.antworten[f.key];
      if (v == null || v === "" || (Array.isArray(v) && !v.length)) fehler.push({ text: '„' + f.frage + '" ist ein Pflichtfeld.' });
    });
    return fehler;
  }
  function zeigeWizardFehler(f) {
    var box = $("#wizard-fehler"); if (!box) return;
    box.innerHTML = '<div class="fehler-box">⚠️ Bitte prüfen:<ul>' + f.map(function (x) { return "<li>" + esc(x.text) + "</li>"; }).join("") + "</ul></div>";
    try { box.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }

  function konfigAutosave() {
    if (kfState.vorschau) return; // Vorschau wird nicht gespeichert
    var cfg = kfState.config;
    cfg.geaendert = Store.nowISO();
    if (kfState.vorlage) { cfg.vorlageId = kfState.vorlage.id; cfg.vorlageVersion = kfState.vorlage.version; }
    if (cfg.gruppeKey) cfg.berechnet = Konfig.berechne(vorlageDerKonfig(cfg), cfg.antworten, db.settings);
    if (!db.konfigurationen.some(function (c) { return c.id === cfg.id; })) db.konfigurationen.push(cfg);
    Store.save();
  }

  function konfigSpeichern() {
    if (kfState.vorschau) { kfState = null; toast("Vorschau beendet."); renderProduktgruppen(); return; }
    var cfg = kfState.config;
    var vl = vorlageDerKonfig(cfg);
    var fehler = Konfig.validiere(vl, cfg.antworten);
    if (fehler.length) { zeigeWizardFehler(fehler); return; }
    // Snapshot der Vorlage einfrieren (schützt vor späteren Vorlagenänderungen)
    if (!cfg.vorlageSnapshot || !cfg.vorlageSnapshot.length) cfg.vorlageSnapshot = Konfig.snapshot(kfState.vorlage || vl);
    cfg.berechnet = Konfig.berechne(vl, cfg.antworten, db.settings);
    var warVorher = cfg.status;
    cfg.status = "Fertig";
    cfg.geaendert = Store.nowISO();
    cfg.verlauf = cfg.verlauf || [];
    cfg.verlauf.push({ datum: Store.nowISO(), bearbeiter: (Auth.current() || {}).benutzername || "", grund: warVorher === "Fertig" ? "Konfiguration bearbeitet" : "Konfiguration gespeichert" });
    Store.save();
    var id = cfg.id;
    kfState = null;
    toast("Produktkonfiguration gespeichert. ✅");
    konfigDetail(id);
  }

  function renderWizardZusammenfassung(host) {
    var cfg = kfState.config;
    var vl = vorlageDerKonfig(cfg);
    var html = '<div class="zusammen">';
    html += '<div class="zeile"><span>Kunde</span><strong>' + esc(kundeName(cfg.kundeId)) + "</strong></div>";
    html += '<div class="zeile"><span>Projekt</span><strong>' + esc((db.projekte || []).filter(function (p) { return p.id === cfg.projektId; }).map(function (p) { return p.name; })[0] || "—") + "</strong></div>";
    html += '<div class="zeile"><span>Kommission</span><strong>' + esc(cfg.kommission || "—") + "</strong></div>";
    html += '<div class="zeile"><span>Produktgruppe</span><strong>' + esc(gruppeName(cfg.gruppeKey)) + "</strong></div>";
    html += "</div>";
    Konfig.abschnitte(vl).forEach(function (ab) {
      var felder = ab.felder.filter(function (f) { return Konfig.feldSichtbar(f, cfg.antworten) && Konfig.FELDTYPEN[f.typ] && (Konfig.FELDTYPEN[f.typ].input || Konfig.FELDTYPEN[f.typ].berechnet); });
      var zeilen = felder.map(function (f) {
        var wert = Konfig.FELDTYPEN[f.typ].berechnet ? cfg.berechnet[f.key] : cfg.antworten[f.key];
        return '<div class="zeile"><span>' + esc(f.frage) + "</span><strong>" + esc(antwortText(f, wert)) + (f.einheit ? " " + esc(f.einheit) : "") + "</strong></div>";
      }).join("");
      if (zeilen) html += '<div class="zusammen-block"><div class="zb-titel">' + esc(ab.titel) + "</div>" + zeilen + "</div>";
    });
    var fehler = Konfig.validiere(vl, cfg.antworten);
    if (fehler.length) html += '<div class="fehler-box" style="margin-top:12px">⚠️ Vor dem Speichern zu ergänzen:<ul>' + fehler.map(function (x) { return "<li>" + esc(x.text) + "</li>"; }).join("") + "</ul></div>";
    host.innerHTML = html;
  }
  function antwortText(f, v) {
    if (v == null || v === "") return "—";
    if (f.typ === "janein") return (v === true || v === "ja") ? "Ja" : "Nein";
    if (Array.isArray(v)) return v.map(function (x) { return mehrfachLabel(f, x); }).join(", ") || "—";
    if (f.typ === "material") { var m = (db.material || []).filter(function (x) { return x.id === v; })[0]; return m ? m.name : v; }
    if (f.typ === "maschine") { var ma = (db.settings.maschinen || []).filter(function (x) { return x.id === v; })[0]; return ma ? ma.name : v; }
    if (Konfig.FELDTYPEN[f.typ] && Konfig.FELDTYPEN[f.typ].numerisch) return fmtZahl(v);
    return String(v);
  }
  function mehrfachLabel(f, wert) {
    if (f.quelle === "taetigkeit") return taetLabel(wert);
    if (f.quelle === "maschine") { var m = (db.settings.maschinen || []).filter(function (x) { return x.id === wert; })[0]; return m ? m.name : wert; }
    if (f.quelle === "material") { var mt = (db.material || []).filter(function (x) { return x.id === wert; })[0]; return mt ? mt.name : wert; }
    return wert;
  }
  function fmtZahl(v) { var n = parseFloat(v); return isFinite(n) ? n.toLocaleString("de-AT", { maximumFractionDigits: 3 }) : String(v); }

  // ---- Detailansicht einer Konfiguration --------------------
  function konfigDetail(id) {
    var cfg = (db.konfigurationen || []).filter(function (x) { return x.id === id; })[0];
    if (!cfg) { renderKonfigListe(); return; }
    kfState = null;
    var root = $("#page-konfigurator .content");
    var vl = vorlageDerKonfig(cfg);
    var html = '<div class="card"><div class="btn-row" style="margin-bottom:10px">' +
      '<button class="btn sm ghost" id="btn-konfig-zurueck" type="button">← Liste</button>' +
      '<button class="btn sm" id="btn-konfig-edit" type="button">✏️ Bearbeiten</button>' +
      '<button class="btn sm" id="btn-konfig-dup" type="button">📋 Duplizieren</button>' +
      (Auth.darf("kalkulationen") && cfg.status === "Fertig" ? '<button class="btn primary sm" id="btn-konfig-kalk" type="button">🧮 Kalkulation erstellen</button>' : "") + "</div>";
    html += "<h3>" + esc(cfg.bezeichnung || "(ohne Bezeichnung)") + ' <span class="sub">' + esc(cfg.nummer || "") + " · " + esc(gruppeName(cfg.gruppeKey)) + "</span></h3>";
    html += '<div class="zusammen">' +
      '<div class="zeile"><span>Kunde</span><strong>' + esc(kundeName(cfg.kundeId)) + "</strong></div>" +
      '<div class="zeile"><span>Kommission</span><strong>' + esc(cfg.kommission || "—") + "</strong></div>" +
      '<div class="zeile"><span>Status</span><strong>' + esc(cfg.status || "Entwurf") + "</strong></div>" +
      '<div class="zeile"><span>Vorlage-Version</span><strong>v' + esc(cfg.vorlageVersion || "?") + " (Snapshot gesichert)</strong></div>" +
      "</div>";
    Konfig.abschnitte(vl).forEach(function (ab) {
      var felder = ab.felder.filter(function (f) { return Konfig.feldSichtbar(f, cfg.antworten) && Konfig.FELDTYPEN[f.typ] && (Konfig.FELDTYPEN[f.typ].input || Konfig.FELDTYPEN[f.typ].berechnet); });
      var zeilen = felder.map(function (f) {
        var wert = Konfig.FELDTYPEN[f.typ].berechnet ? cfg.berechnet[f.key] : cfg.antworten[f.key];
        return '<div class="zeile"><span>' + esc(f.frage) + "</span><strong>" + esc(antwortText(f, wert)) + (f.einheit ? " " + esc(f.einheit) : "") + "</strong></div>";
      }).join("");
      if (zeilen) html += '<div class="zusammen-block"><div class="zb-titel">' + esc(ab.titel) + "</div>" + zeilen + "</div>";
    });
    if (cfg.verlauf && cfg.verlauf.length) {
      html += '<div class="zusammen-block"><div class="zb-titel">Änderungsverlauf</div>' +
        cfg.verlauf.slice().reverse().map(function (v) { return '<div class="zeile"><span>' + fmtDate(v.datum) + " · " + esc(v.bearbeiter || "") + "</span><strong>" + esc(v.grund || "") + "</strong></div>"; }).join("") + "</div>";
    }
    html += "</div>";
    root.innerHTML = html;
    $("#btn-konfig-zurueck").onclick = function () { renderKonfigListe(); };
    $("#btn-konfig-edit").onclick = function () { konfigBearbeiten(id); };
    $("#btn-konfig-dup").onclick = function () { konfigDuplizieren(id); };
    var bk = $("#btn-konfig-kalk"); if (bk) bk.onclick = function () { kalkAusKonfig(cfg); };
  }

  // ============================================================
  //  KALKULATION (Phase 3B)
  // ============================================================
  var kalkState = null; // { id }  -> Editor aktiv
  function naechsteKalkNr() { return "KA-" + new Date().getFullYear() + "-" + ("00" + (db.settings.kalkZaehler || 1)).slice(-3); }
  function kalkById(id) { return (db.kalkulationen || []).filter(function (k) { return k.id === id; })[0] || null; }
  function kalkBer(k) { return Kalk.berechne(k, db.settings); }

  function renderKalkulationen() {
    if (kalkState && kalkById(kalkState.id)) renderKalkEditor();
    else { kalkState = null; renderKalkListe(); }
  }

  var kalkFilter = { suche: "", status: "" };
  function renderKalkListe() {
    var root = $("#page-kalkulationen .content");
    var liste = db.kalkulationen || (db.kalkulationen = []);
    // Kennzahlen
    var offen = 0, freigegeben = 0;
    liste.forEach(function (k) { var r = kalkBer(k); if (k.status === "freigegeben") freigegeben += r.netto; else offen += r.netto; });
    var statusOpt = ["", "Entwurf", "freigegeben", "archiviert"].map(function (s) { return '<option value="' + s + '"' + (kalkFilter.status === s ? " selected" : "") + ">" + (s || "Alle Status") + "</option>"; }).join("");
    var html = '<div class="grid cols-3" style="margin-bottom:14px">' +
      stat("Kalkulationen", liste.length, "", "gesamt") +
      stat("Offen (Entwurf)", fmtEUR(offen), "", "Netto-Summe") +
      stat("Freigegeben", fmtEUR(freigegeben), "", "Netto-Summe") + "</div>";
    html += '<div class="card"><div class="btn-row" style="margin-bottom:10px"><button class="btn primary sm" id="btn-kalk-neu" type="button">+ Neue Kalkulation</button></div>' +
      '<div class="inline" style="margin-bottom:10px">' +
        '<input id="kalk-suche" placeholder="🔍 Suche: Nr., Bezeichnung, Kunde, Kommission" value="' + esc(kalkFilter.suche) + '" style="flex:2">' +
        '<select id="kalk-status" style="flex:1;min-width:130px">' + statusOpt + "</select></div>" +
      '<div id="kalk-liste"></div></div>';
    root.innerHTML = html;
    $("#btn-kalk-neu").onclick = function () { kalkNeuDialog(); };
    $("#kalk-suche").addEventListener("input", function () { kalkFilter.suche = this.value; zeichneKalkListe(); });
    $("#kalk-status").addEventListener("change", function () { kalkFilter.status = this.value; zeichneKalkListe(); });
    zeichneKalkListe();
  }
  function zeichneKalkListe() {
    var ziel = $("#kalk-liste"); if (!ziel) return;
    var suche = (kalkFilter.suche || "").toLowerCase().trim();
    var liste = (db.kalkulationen || []).filter(function (k) {
      if (kalkFilter.status && (k.status || "Entwurf") !== kalkFilter.status) return false;
      if (!suche) return true;
      return [k.nummer, k.bezeichnung, k.kommission, kundeName(k.kundeId)].filter(Boolean).join(" ").toLowerCase().indexOf(suche) >= 0;
    });
    if (!liste.length) { ziel.innerHTML = '<div class="empty">Keine Kalkulationen. Erstelle eine – am besten aus einer fertigen Produktkonfiguration.</div>'; return; }
    var html = '<div class="table-wrap"><table><thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Kunde</th><th>Kommission</th><th class="num">Netto</th><th class="num">DB</th><th class="num">Gewinn</th><th>Status</th><th class="num">Aktion</th></tr></thead><tbody>';
    liste.slice().reverse().forEach(function (k) {
      var r = kalkBer(k);
      html += "<tr><td>" + esc(k.nummer) + (k.version > 1 ? " v" + k.version : "") + "</td>" +
        "<td><strong>" + esc(k.bezeichnung || "—") + "</strong>" + (k.beispiel ? ' <span class="tag">Beispiel</span>' : "") + "</td>" +
        "<td>" + esc(kundeName(k.kundeId)) + "</td>" +
        "<td>" + (k.kommission ? '<span class="tag">' + esc(k.kommission) + "</span>" : "—") + "</td>" +
        '<td class="num">' + fmtEUR(r.netto) + "</td>" +
        '<td class="num">' + r.dbQuote + "%</td>" +
        '<td class="num" style="color:' + (r.gewinn < 0 ? "var(--red)" : "var(--green)") + '">' + fmtEUR(r.gewinn) + "</td>" +
        "<td>" + statusBadgeKalk(k.status) + "</td>" +
        '<td class="num" style="white-space:nowrap"><button class="btn sm" data-kalkopen="' + k.id + '" type="button">Öffnen</button> ' +
          '<button class="btn sm ghost" data-kalkdup="' + k.id + '" type="button" title="Duplizieren">📋</button> ' +
          '<button class="btn sm danger" data-kalkdel="' + k.id + '" type="button">🗑️</button></td></tr>';
    });
    html += "</tbody></table></div>";
    ziel.innerHTML = html;
    $all("[data-kalkopen]", ziel).forEach(function (b) { b.onclick = function () { var k = kalkById(b.dataset.kalkopen); if (k && k.status === "freigegeben") kalkDetail(k.id); else { kalkState = { id: b.dataset.kalkopen }; renderKalkEditor(); } }; });
    $all("[data-kalkdup]", ziel).forEach(function (b) { b.onclick = function () { kalkDuplizieren(b.dataset.kalkdup); }; });
    $all("[data-kalkdel]", ziel).forEach(function (b) { b.onclick = function () { if (confirm("Kalkulation löschen?")) { db.kalkulationen = db.kalkulationen.filter(function (k) { return k.id !== b.dataset.kalkdel; }); Store.save(); zeichneKalkListe(); } }; });
  }
  function statusBadgeKalk(s) { s = s || "Entwurf"; var c = s === "freigegeben" ? "var(--green)" : s === "archiviert" ? "var(--muted)" : "var(--accent)"; return '<span class="tag" style="color:' + c + '">' + esc(s) + "</span>"; }

  function kalkNeuDialog() {
    var fertige = (db.konfigurationen || []).filter(function (c) { return c.status === "Fertig"; });
    var opt = '<option value="">— leere Kalkulation —</option>' + fertige.map(function (c) { return '<option value="' + c.id + '">' + esc(c.nummer + " · " + (c.bezeichnung || "")) + "</option>"; }).join("");
    var body = '<label class="fld"><span class="lbl">Aus Produktkonfiguration übernehmen (optional)</span><select id="kn-konfig">' + opt + "</select></label>" +
      fld2("Bezeichnung", "kn-bez", "", "text");
    openModal("Neue Kalkulation", body, function () {
      var cfgId = $("#kn-konfig").value;
      var cfg = cfgId ? (db.konfigurationen || []).filter(function (c) { return c.id === cfgId; })[0] : null;
      var bez = $("#kn-bez").value.trim() || (cfg ? cfg.bezeichnung : "Neue Kalkulation");
      var basis = cfg ? Kalk.ausKonfiguration(cfg, db) : { material: [], arbeit: [], maschine: [], fremd: [], montage: null, transport: null, risikoProz: 5, gewinnProz: num(db.settings.gewinn) || 18, rabattProz: 0, manuellerAufschlag: 0, mwstProz: num(db.settings.mwst) || 20, fertigungsGK: { typ: "prozent", basis: "direkt", wert: num(db.settings.gemeinkosten) || 14 } };
      var k = Object.assign({
        id: Store.uid(), nummer: naechsteKalkNr(), bezeichnung: bez,
        kundeId: cfg ? cfg.kundeId : "", projektId: cfg ? cfg.projektId : "", kommission: cfg ? cfg.kommission : "",
        konfigId: cfg ? cfg.id : "", gruppeKey: cfg ? cfg.gruppeKey : "", stueckzahl: cfg && cfg.antworten ? (num(cfg.antworten.stueckzahl) || 1) : 1,
        version: 1, status: "Entwurf", erstellt: Store.nowISO(), geaendert: Store.nowISO(), bearbeiter: (Auth.current() || {}).benutzername || "", verlauf: []
      }, basis);
      db.kalkulationen.push(k);
      db.settings.kalkZaehler = (db.settings.kalkZaehler || 1) + 1;
      Store.save();
      kalkState = { id: k.id }; renderKalkEditor();
      return true;
    }, "Erstellen");
  }
  function kalkAusKonfig(cfg) {
    var basis = Kalk.ausKonfiguration(cfg, db);
    var k = Object.assign({
      id: Store.uid(), nummer: naechsteKalkNr(), bezeichnung: cfg.bezeichnung,
      kundeId: cfg.kundeId, projektId: cfg.projektId, kommission: cfg.kommission,
      konfigId: cfg.id, gruppeKey: cfg.gruppeKey, stueckzahl: cfg.antworten ? (num(cfg.antworten.stueckzahl) || 1) : 1,
      version: 1, status: "Entwurf", erstellt: Store.nowISO(), geaendert: Store.nowISO(), bearbeiter: (Auth.current() || {}).benutzername || "", verlauf: [{ datum: Store.nowISO(), bearbeiter: (Auth.current() || {}).benutzername || "", grund: "Aus Konfiguration " + cfg.nummer + " erstellt" }]
    }, basis);
    db.kalkulationen.push(k);
    db.settings.kalkZaehler = (db.settings.kalkZaehler || 1) + 1;
    Store.save();
    toast("Kalkulation aus Konfiguration erstellt.");
    kalkState = { id: k.id }; navTo("kalkulationen");
  }
  function kalkDuplizieren(id) {
    var k = kalkById(id); if (!k) return;
    var kop = JSON.parse(JSON.stringify(k));
    kop.id = Store.uid(); kop.nummer = naechsteKalkNr(); kop.bezeichnung = (k.bezeichnung || "") + " (Kopie)"; kop.status = "Entwurf"; kop.version = 1; kop.beispiel = false; kop.snapshot = null;
    kop.erstellt = Store.nowISO(); kop.geaendert = Store.nowISO();
    kop.verlauf = [{ datum: Store.nowISO(), bearbeiter: (Auth.current() || {}).benutzername || "", grund: "Aus " + k.nummer + " dupliziert" }];
    db.kalkulationen.push(kop); db.settings.kalkZaehler = (db.settings.kalkZaehler || 1) + 1; Store.save();
    toast("Kalkulation dupliziert."); kalkState = { id: kop.id }; renderKalkEditor();
  }

  function renderKalkEditor() {
    var k = kalkById(kalkState.id); if (!k) { kalkState = null; renderKalkListe(); return; }
    var root = $("#page-kalkulationen .content");
    var r = kalkBer(k);
    var html = '<div class="card"><div class="btn-row" style="margin-bottom:8px">' +
      '<button class="btn sm ghost" id="btn-kalk-zurueck" type="button">← Liste</button>' +
      '<button class="btn sm" id="btn-kalk-detail" type="button">📊 Kostenübersicht</button>' +
      (k.status === "Entwurf" ? '<button class="btn primary sm" id="btn-kalk-freigabe" type="button">✓ Freigeben</button>' : "") + "</div>";
    html += "<h3>" + esc(k.bezeichnung || "Kalkulation") + ' <span class="sub">' + esc(k.nummer) + " · v" + k.version + " · " + statusBadgeKalk(k.status) + "</span></h3>";
    html += '<div class="muted" style="font-size:12px;margin-bottom:10px">' + esc(kundeName(k.kundeId)) + (k.kommission ? " · Kommission: " + esc(k.kommission) : "") + "</div>";
    // Positionsbereiche
    html += kalkBereich("Material", "material", k, [["Bezeichnung", "bezeichnung"], ["Menge", "menge"], ["EK", "einkaufspreis"]], function (p, e) { return fmtEUR(e.kosten) + " → " + fmtEUR(e.verkauf); });
    html += kalkBereich("Arbeit", "arbeit", k, [["Tätigkeit", "taetigkeit"], ["Std", null]], function (p, e) { return e.personenstunden + " h · " + fmtEUR(e.kosten) + " → " + fmtEUR(e.verkauf); });
    html += kalkBereich("Maschine", "maschine", k, [["Vorgang", "vorgang"]], function (p, e) { return "Rüst " + fmtEUR(e.ruestkosten) + " · " + fmtEUR(e.gesamtkosten); });
    html += kalkBereich("Fremdleistungen", "fremd", k, [["Leistung", "leistung"]], function (p, e) { return fmtEUR(e.kosten) + " → " + fmtEUR(e.verkauf); });
    // Montage (einzeln)
    html += '<div class="card" style="background:var(--panel-2);margin-top:10px"><div class="btn-row" style="justify-content:space-between"><strong>Montage & Transport</strong><button class="btn sm ghost" id="btn-kalk-montage" type="button">bearbeiten</button></div>' +
      '<div class="muted" style="font-size:12px;margin-top:6px">' + (k.montage ? (r.montage.stunden + " h Montage · " + fmtEUR(r.montageKosten)) : "keine Montage") + " · Transport " + fmtEUR(r.transportKosten) + "</div></div>";
    // Zuschläge (live)
    html += '<div class="card" style="margin-top:10px"><strong>Zuschläge & Preis</strong><div class="inline" style="margin-top:8px">' +
      fld2("Gemeinkosten %", "z-gk", (k.fertigungsGK && k.fertigungsGK.wert) || 0, "number") +
      fld2("Risiko %", "z-risiko", k.risikoProz || 0, "number") +
      fld2("Gewinn %", "z-gewinn", k.gewinnProz || 0, "number") + "</div><div class=\"inline\">" +
      fld2("Man. Aufschlag €", "z-aufschlag", k.manuellerAufschlag || 0, "number") +
      fld2("Rabatt %", "z-rabatt", k.rabattProz || 0, "number") +
      fld2("USt %", "z-mwst", k.mwstProz != null ? k.mwstProz : num(db.settings.mwst), "number") + "</div></div>";
    // Live-Zusammenfassung
    html += '<div id="kalk-summary">' + kalkSummaryHTML(r) + "</div>";
    html += "</div>";
    root.innerHTML = html;
    $("#btn-kalk-zurueck").onclick = function () { kalkState = null; renderKalkListe(); };
    $("#btn-kalk-detail").onclick = function () { kalkDetail(k.id); };
    var bf = $("#btn-kalk-freigabe"); if (bf) bf.onclick = function () { kalkFreigeben(k.id); };
    $("#btn-kalk-montage").onclick = function () { montageModal(k.id); };
    // Positions-Buttons
    $all("[data-kalkadd]", root).forEach(function (b) { b.onclick = function () { posModal(k.id, b.dataset.kalkadd, -1); }; });
    $all("[data-kalkedit]", root).forEach(function (b) { b.onclick = function () { var pr = b.dataset.kalkedit.split(":"); posModal(k.id, pr[0], +pr[1]); }; });
    $all("[data-kalkdelpos]", root).forEach(function (b) { b.onclick = function () { var pr = b.dataset.kalkdelpos.split(":"); k[pr[0]].splice(+pr[1], 1); Store.save(); renderKalkEditor(); }; });
    // Zuschläge live
    [["z-gk", function (v) { k.fertigungsGK = k.fertigungsGK || { typ: "prozent", basis: "direkt" }; k.fertigungsGK.wert = v; }], ["z-risiko", function (v) { k.risikoProz = v; }], ["z-gewinn", function (v) { k.gewinnProz = v; }], ["z-aufschlag", function (v) { k.manuellerAufschlag = v; }], ["z-rabatt", function (v) { k.rabattProz = v; }], ["z-mwst", function (v) { k.mwstProz = v; }]].forEach(function (pair) {
      var el = $("#" + pair[0]); if (!el) return;
      el.addEventListener("change", function () { pair[1](leseZahl0(el.value)); k.geaendert = Store.nowISO(); Store.save(); $("#kalk-summary").innerHTML = kalkSummaryHTML(kalkBer(k)); });
    });
  }
  function kalkBereich(titel, feld, k, spalten, wertFn) {
    var liste = k[feld] || [];
    var rows = liste.map(function (p, i) {
      var e = feld === "material" ? Kalk.material(p) : feld === "arbeit" ? Kalk.arbeit(p) : feld === "maschine" ? Kalk.maschine(p) : Kalk.fremd(p);
      var label = p.bezeichnung || p.taetigkeit || p.vorgang || p.leistung || "Position";
      return '<tr><td>' + esc(label) + '</td><td class="num">' + esc(wertFn(p, e)) + '</td>' +
        '<td class="num" style="white-space:nowrap"><button class="btn sm ghost" data-kalkedit="' + feld + ":" + i + '" type="button">✏️</button> <button class="btn sm danger" data-kalkdelpos="' + feld + ":" + i + '" type="button">🗑️</button></td></tr>';
    }).join("");
    return '<div class="card" style="background:var(--panel-2);margin-top:10px"><div class="btn-row" style="justify-content:space-between;margin-bottom:6px"><strong>' + esc(titel) + ' <span class="muted" style="font-weight:400">(' + liste.length + ')</span></strong><button class="btn sm" data-kalkadd="' + feld + '" type="button">+ Position</button></div>' +
      (liste.length ? '<div class="table-wrap"><table><tbody>' + rows + "</tbody></table></div>" : '<div class="muted" style="font-size:12px">keine Positionen</div>') + "</div>";
  }
  function kalkSummaryHTML(r) {
    var warn = r.warnungen.length ? '<div class="fehler-box" style="margin-bottom:10px">⚠️ ' + r.warnungen.map(esc).join("<br>⚠️ ") + "</div>" : "";
    return warn + '<div class="card" style="margin-top:10px;background:var(--panel-2)"><strong>Kostenstruktur & Preis</strong>' +
      line("Materialkosten", fmtEUR(r.material.kosten), "sub") +
      line("Arbeitskosten", fmtEUR(r.arbeit.kosten), "sub") +
      line("Maschinenkosten (inkl. Rüsten " + fmtEUR(r.ruestKosten) + ")", fmtEUR(r.maschine.kosten), "sub") +
      line("Fremdleistungen", fmtEUR(r.fremdKosten), "sub") +
      line("Montage & Transport", fmtEUR(r.montageKosten + r.transportKosten), "sub") +
      line("= Direkte Kosten", fmtEUR(r.direkt)) +
      line("+ Gemeinkosten (" + r.fgk.basisName + ")", fmtEUR(r.fgk.betrag), "sub") +
      line("= Herstell-/Selbstkosten", fmtEUR(r.selbst)) +
      line("+ Risiko", fmtEUR(r.risiko), "sub") +
      line("+ Gewinn", fmtEUR(r.gewinnAufschlag), "sub") +
      (r.rabatt ? line("− Rabatt", "−" + fmtEUR(r.rabatt), "sub") : "") +
      line("Nettoverkaufspreis", fmtEUR(r.netto)) +
      line("+ USt " + r.mwstProz + " %", fmtEUR(r.mwst), "sub") +
      line("Bruttoverkaufspreis", fmtEUR(r.brutto)) +
      '<hr class="sep">' +
      line("Deckungsbeitrag (" + r.dbQuote + " %)", fmtEUR(r.deckungsbeitrag), "sub") +
      '<div class="result-line" style="color:' + (r.gewinn < 0 ? "var(--red)" : "var(--green)") + '"><span>Kalkulierter Gewinn (' + r.gewinnQuote + " %)</span><span class=\"v\">" + fmtEUR(r.gewinn) + "</span></div>" +
      "</div>";
  }

  function kalkFreigeben(id) {
    var k = kalkById(id); if (!k) return;
    var r = kalkBer(k);
    var probleme = [];
    if (!k.material.length && !k.arbeit.length && !k.maschine.length && !k.fremd.length) probleme.push("Keine Positionen vorhanden.");
    if (r.netto <= 0) probleme.push("Nettoverkaufspreis ist 0.");
    if (r.warnungen.length) probleme.push("Warnungen: " + r.warnungen.join(" "));
    var txt = "Kalkulation freigeben?\n\nNach der Freigabe sind Preise und Werte per Snapshot eingefroren. Änderungen erzeugen eine neue Version.";
    if (probleme.length) txt = "Hinweise:\n- " + probleme.join("\n- ") + "\n\nTrotzdem freigeben?";
    if (!confirm(txt)) return;
    k.snapshot = Kalk.snapshot(db.settings);
    k.ergebnis = { netto: r.netto, brutto: r.brutto, selbst: r.selbst, deckungsbeitrag: r.deckungsbeitrag, gewinn: r.gewinn };
    k.status = "freigegeben"; k.geaendert = Store.nowISO();
    (k.verlauf = k.verlauf || []).push({ datum: Store.nowISO(), bearbeiter: (Auth.current() || {}).benutzername || "", grund: "Freigegeben (v" + k.version + ")" });
    Store.save(); toast("Kalkulation freigegeben. ✅"); kalkState = null; kalkDetail(id);
  }
  function kalkNeueVersion(id) {
    var k = kalkById(id); if (!k) return;
    k.status = "Entwurf"; k.version = (k.version || 1) + 1; k.geaendert = Store.nowISO();
    (k.verlauf = k.verlauf || []).push({ datum: Store.nowISO(), bearbeiter: (Auth.current() || {}).benutzername || "", grund: "Neue Version " + k.version + " zur Bearbeitung" });
    Store.save(); kalkState = { id: id }; renderKalkEditor();
  }

  function kalkDetail(id) {
    var k = kalkById(id); if (!k) { renderKalkListe(); return; }
    kalkState = null;
    var root = $("#page-kalkulationen .content");
    var r = kalkBer(k);
    var html = '<div class="card"><div class="btn-row" style="margin-bottom:8px">' +
      '<button class="btn sm ghost" id="btn-kalk-zurueck" type="button">← Liste</button>' +
      (k.status === "freigegeben" ? '<button class="btn sm" id="btn-kalk-version" type="button">✏️ Neue Version bearbeiten</button>' : '<button class="btn sm" id="btn-kalk-edit" type="button">✏️ Bearbeiten</button>') +
      '<button class="btn sm ghost" id="btn-kalk-dup2" type="button">📋 Duplizieren</button></div>';
    html += "<h3>" + esc(k.bezeichnung || "Kalkulation") + ' <span class="sub">' + esc(k.nummer) + " · v" + k.version + " · " + statusBadgeKalk(k.status) + "</span></h3>";
    html += '<div class="muted" style="font-size:12px;margin-bottom:10px">' + esc(kundeName(k.kundeId)) + (k.kommission ? " · Kommission: " + esc(k.kommission) : "") + (k.snapshot ? " · Preis-Snapshot vom " + fmtDate(k.snapshot.datum) : "") + "</div>";
    html += kalkSummaryHTML(r);
    // Staffelpreise bei Serienteilen / Stückzahl > 1
    if ((k.gruppeKey === "serienteile") || (num(k.stueckzahl) > 1)) {
      var st = Kalk.staffel(k, db.settings);
      html += '<div class="card" style="margin-top:10px;background:var(--panel-2)"><strong>Staffelpreise</strong><div class="table-wrap"><table><thead><tr><th class="num">Stück</th><th class="num">Rüst/Stk</th><th class="num">Kosten/Stk</th><th class="num">Preis/Stk</th><th class="num">Gesamt</th></tr></thead><tbody>' +
        st.map(function (s) { return '<tr><td class="num">' + s.stueckzahl + '</td><td class="num">' + fmtEUR(s.ruestProStk) + '</td><td class="num">' + fmtEUR(s.kostenProStk) + '</td><td class="num"><strong>' + fmtEUR(s.preisProStk) + '</strong></td><td class="num">' + fmtEUR(s.gesamt) + "</td></tr>"; }).join("") + "</tbody></table></div></div>";
    }
    if (k.verlauf && k.verlauf.length) html += '<div class="card" style="margin-top:10px;background:var(--panel-2)"><strong>Änderungsverlauf</strong>' + k.verlauf.slice().reverse().map(function (v) { return '<div class="zeile"><span>' + fmtDate(v.datum) + " · " + esc(v.bearbeiter || "") + "</span><strong>" + esc(v.grund || "") + "</strong></div>"; }).join("") + "</div>";
    html += "</div>";
    root.innerHTML = html;
    $("#btn-kalk-zurueck").onclick = function () { renderKalkListe(); };
    if ($("#btn-kalk-edit")) $("#btn-kalk-edit").onclick = function () { kalkState = { id: id }; renderKalkEditor(); };
    if ($("#btn-kalk-version")) $("#btn-kalk-version").onclick = function () { kalkNeueVersion(id); };
    $("#btn-kalk-dup2").onclick = function () { kalkDuplizieren(id); };
  }

  // Positions-Modals (Material/Arbeit/Maschine/Fremd)
  function posModal(kalkId, feld, index) {
    var k = kalkById(kalkId); if (!k) return;
    var p = index >= 0 ? k[feld][index] : {};
    var titel = { material: "Materialposition", arbeit: "Arbeitsgang", maschine: "Maschinenarbeitsgang", fremd: "Fremdleistung" }[feld];
    var body = "";
    if (feld === "material") {
      body = fld2("Bezeichnung", "p-bez", p.bezeichnung || "", "text") +
        '<div class="inline">' + fld2("Werkstoff", "p-werk", p.werkstoff || "Stahl", "text") + fld2("Einheit", "p-einh", p.einheit || "kg", "text") + "</div>" +
        '<div class="inline">' + fld2("Menge (Grundbedarf)", "p-menge", p.menge != null ? p.menge : "", "number") + fld2("Fixe Zugabe", "p-fix", p.fixeZugabe || 0, "number") + "</div>" +
        '<div class="inline">' + fld2("Verschnitt %", "p-versch", p.verschnittProz || 0, "number") + fld2("Ausschuss %", "p-aus", p.ausschussProz || 0, "number") + "</div>" +
        '<div class="inline">' + fld2("Verpackungseinheit", "p-ve", p.verpackungseinheit || "", "number") + fld2("Mindestbestellmenge", "p-mbm", p.mindestbestellmenge || "", "number") + "</div>" +
        '<div class="inline">' + fld2("Einkaufspreis €", "p-ek", p.einkaufspreis != null ? p.einkaufspreis : "", "number") + fld2("Frachtanteil €", "p-fracht", p.frachtanteil || 0, "number") + "</div>" +
        '<div class="inline">' + fld2("Materialaufschlag %", "p-auf", p.materialaufschlagProz != null ? p.materialaufschlagProz : (num(db.settings.materialAufschlag) || 12), "number") + fld2("Man. Verkaufspreis € (optional)", "p-man", p.manuellerPreis != null ? p.manuellerPreis : "", "number") + "</div>" +
        fld2("Begründung der Preisänderung", "p-grund", p.aenderungsgrund || "", "text");
    } else if (feld === "arbeit") {
      var grpOpt = GRUPPEN.map(function (g) { return '<option value="' + g[0] + '"' + (p.gruppe === g[0] ? " selected" : "") + ">" + esc(g[1]) + "</option>"; }).join("");
      body = fld2("Tätigkeit", "p-taet", p.taetigkeit || "", "text") +
        '<label class="fld"><span class="lbl">Mitarbeitergruppe</span><select id="p-grp">' + grpOpt + "</select></label>" +
        '<div class="inline">' + fld2("Anzahl Mitarbeiter", "p-anz", p.anzahlMitarbeiter || 1, "number") + fld2("Stückzahl", "p-stk", p.stueckzahl || 1, "number") + "</div>" +
        '<div class="inline">' + fld2("Rüst-/Vorbereitungszeit h", "p-ruest", p.ruestzeit || 0, "number") + fld2("Bearbeitungszeit/Stück h", "p-bearb", p.bearbeitungProStk || 0, "number") + "</div>" +
        '<div class="inline">' + fld2("Zusätzliche Zeit h", "p-zus", p.zusatzzeit || 0, "number") + fld2("", "p-spacer", "", "text") + "</div>" +
        '<div class="inline">' + fld2("Interner Kostensatz €/h", "p-ik", p.internerSatz != null ? p.internerSatz : "", "number") + fld2("Verkaufsstundensatz €/h", "p-vk", p.verkaufSatz != null ? p.verkaufSatz : "", "number") + "</div>";
    } else if (feld === "maschine") {
      var maOpt = '<option value="">— frei —</option>' + (db.settings.maschinen || []).map(function (m) { return '<option value="' + m.id + '"' + (p.maschineId === m.id ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("");
      body = '<label class="fld"><span class="lbl">Maschine</span><select id="p-maid">' + maOpt + "</select></label>" +
        fld2("Vorgang", "p-vorg", p.vorgang || "", "text") +
        '<div class="inline">' + fld2("Anzahl Rüstvorgänge", "p-anr", p.anzahlRuest || 0, "number") + fld2("Rüstzeit je Vorgang h", "p-rzv", p.ruestzeitProVorgang || 0, "number") + "</div>" +
        '<div class="inline">' + fld2("Rüstkostensatz €/h", "p-rks", p.ruestSatz != null ? p.ruestSatz : "", "number") + fld2("Fixer Rüstpreis € (optional)", "p-rfix", p.ruestFix != null ? p.ruestFix : "", "number") + "</div>" +
        '<div class="inline">' + fld2("Laufzeit/Stück h", "p-lz", p.laufzeitProStk || 0, "number") + fld2("Stückzahl", "p-mstk", p.stueckzahl || 1, "number") + "</div>" +
        '<div class="inline">' + fld2("Interner Maschinensatz €/h", "p-mik", p.internerSatz != null ? p.internerSatz : "", "number") + fld2("Verkaufssatz €/h", "p-mvk", p.verkaufSatz != null ? p.verkaufSatz : "", "number") + "</div>" +
        '<div class="inline">' + fld2("Werkzeugkosten €", "p-wz", p.werkzeugkosten || 0, "number") + fld2("Energiezuschlag €", "p-en", p.energiezuschlag || 0, "number") + "</div>" +
        '<div class="inline">' + fld2("Mindestverrechnung €", "p-mv", p.mindestverrechnung || 0, "number") + fld2("Bedienerzeit h (Warnung)", "p-bed", p.bedienerZeit || 0, "number") + "</div>";
    } else {
      var liefOpt = '<option value="">— frei —</option>' + (db.lieferanten || []).map(function (l) { return '<option value="' + l.id + '"' + (p.lieferantId === l.id ? " selected" : "") + ">" + esc(l.name) + "</option>"; }).join("");
      body = fld2("Leistung", "p-leist", p.leistung || "", "text") +
        '<label class="fld"><span class="lbl">Lieferant</span><select id="p-lief">' + liefOpt + "</select></label>" +
        fld2("Beschreibung", "p-besch", p.beschreibung || "", "text") +
        '<div class="inline">' + fld2("Menge", "p-fmenge", p.menge || 1, "number") + fld2("Einheit", "p-feinh", p.einheit || "Pos", "text") + "</div>" +
        '<div class="inline">' + fld2("Einkaufspreis €", "p-fek", p.einkaufspreis != null ? p.einkaufspreis : "", "number") + fld2("Fracht €", "p-ffracht", p.fracht || 0, "number") + "</div>" +
        '<div class="inline">' + fld2("Mindermengenzuschlag €", "p-fmm", p.mindermenge || 0, "number") + fld2("Aufschlag %", "p-fauf", p.aufschlagProz != null ? p.aufschlagProz : 15, "number") + "</div>";
    }
    openModal((index >= 0 ? titel + " bearbeiten" : titel + " hinzufügen"), body, function () {
      var neu = index >= 0 ? p : { aktiv: true };
      if (feld === "material") {
        neu.bezeichnung = $("#p-bez").value.trim(); neu.werkstoff = $("#p-werk").value.trim(); neu.einheit = $("#p-einh").value.trim();
        neu.menge = leseZahl0($("#p-menge").value); neu.fixeZugabe = leseZahl0($("#p-fix").value); neu.verschnittProz = leseZahl0($("#p-versch").value); neu.ausschussProz = leseZahl0($("#p-aus").value);
        var ve = $("#p-ve").value.trim(); neu.verpackungseinheit = ve === "" ? "" : leseZahl0(ve); var mbm = $("#p-mbm").value.trim(); neu.mindestbestellmenge = mbm === "" ? "" : leseZahl0(mbm);
        neu.einkaufspreis = leseZahl0($("#p-ek").value); neu.frachtanteil = leseZahl0($("#p-fracht").value); neu.materialaufschlagProz = leseZahl0($("#p-auf").value);
        var man = $("#p-man").value.trim(); neu.manuellerPreis = man === "" ? "" : leseZahl0(man); neu.aenderungsgrund = $("#p-grund").value.trim();
        if (!neu.preisdatum) neu.preisdatum = Store.nowISO();
      } else if (feld === "arbeit") {
        neu.taetigkeit = $("#p-taet").value.trim(); neu.gruppe = $("#p-grp").value; neu.anzahlMitarbeiter = leseZahl0($("#p-anz").value); neu.stueckzahl = leseZahl0($("#p-stk").value);
        neu.ruestzeit = leseZahl0($("#p-ruest").value); neu.bearbeitungProStk = leseZahl0($("#p-bearb").value); neu.zusatzzeit = leseZahl0($("#p-zus").value);
        neu.internerSatz = leseZahl0($("#p-ik").value); neu.verkaufSatz = leseZahl0($("#p-vk").value);
      } else if (feld === "maschine") {
        neu.maschineId = $("#p-maid").value; var mm = (db.settings.maschinen || []).filter(function (x) { return x.id === neu.maschineId; })[0]; neu.maschineName = mm ? mm.name : (neu.maschineName || "");
        neu.vorgang = $("#p-vorg").value.trim(); neu.anzahlRuest = leseZahl0($("#p-anr").value); neu.ruestzeitProVorgang = leseZahl0($("#p-rzv").value); neu.ruestSatz = leseZahl0($("#p-rks").value);
        var rf = $("#p-rfix").value.trim(); neu.ruestFix = rf === "" ? "" : leseZahl0(rf);
        neu.laufzeitProStk = leseZahl0($("#p-lz").value); neu.stueckzahl = leseZahl0($("#p-mstk").value); neu.internerSatz = leseZahl0($("#p-mik").value); neu.verkaufSatz = leseZahl0($("#p-mvk").value);
        neu.werkzeugkosten = leseZahl0($("#p-wz").value); neu.energiezuschlag = leseZahl0($("#p-en").value); neu.mindestverrechnung = leseZahl0($("#p-mv").value); neu.bedienerZeit = leseZahl0($("#p-bed").value);
      } else {
        neu.leistung = $("#p-leist").value.trim(); neu.lieferantId = $("#p-lief").value; neu.beschreibung = $("#p-besch").value.trim();
        neu.menge = leseZahl0($("#p-fmenge").value); neu.einheit = $("#p-feinh").value.trim(); neu.einkaufspreis = leseZahl0($("#p-fek").value); neu.fracht = leseZahl0($("#p-ffracht").value);
        neu.mindermenge = leseZahl0($("#p-fmm").value); neu.aufschlagProz = leseZahl0($("#p-fauf").value);
      }
      if (index < 0) (k[feld] = k[feld] || []).push(neu);
      k.geaendert = Store.nowISO(); Store.save(); renderKalkEditor();
      return true;
    });
  }
  function montageModal(kalkId) {
    var k = kalkById(kalkId); if (!k) return;
    var m = k.montage || {};
    var body = '<p class="hint">Montagezeit und Fahrtzeit werden getrennt geführt.</p>' +
      '<div class="inline">' + fld2("Anzahl Monteure", "mo-anz", m.anzahlMonteure || 0, "number") + fld2("Montagezeit h", "mo-zeit", m.montagezeit || 0, "number") + "</div>" +
      '<div class="inline">' + fld2("Interner Satz €/h", "mo-ik", m.internerSatz || 0, "number") + fld2("Verkaufssatz €/h", "mo-vk", m.verkaufSatz || 0, "number") + "</div>" +
      '<div class="inline">' + fld2("Fahrtzeit h", "mo-fz", m.fahrtzeit || 0, "number") + fld2("Kilometer", "mo-km", m.km || 0, "number") + "</div>" +
      '<div class="inline">' + fld2("Kilometersatz €", "mo-kms", m.kmSatz != null ? m.kmSatz : (num(db.settings.transportProKm) || 0.9), "number") + fld2("Hebegerät €", "mo-heb", m.hebegeraet || 0, "number") + "</div>" +
      '<div class="inline">' + fld2("Übernachtung €", "mo-ueb", m.uebernachtung || 0, "number") + fld2("Taggeld €", "mo-tag", m.taggeld || 0, "number") + "</div>" +
      '<div class="inline">' + fld2("Verbrauchsmaterial €", "mo-verb", m.verbrauch || 0, "number") + fld2("Sonstige €", "mo-son", m.sonstige || 0, "number") + "</div>" +
      '<hr class="sep"><div class="lbl">Transport/Verpackung</div>' +
      '<div class="inline">' + fld2("Verpackungsmaterial €", "tr-verp", (k.transport && k.transport.verpackungsmaterial) || 0, "number") + fld2("Paletten €", "tr-pal", (k.transport && k.transport.paletten) || 0, "number") + "</div>";
    openModal("Montage & Transport", body, function () {
      k.montage = { anzahlMonteure: leseZahl0($("#mo-anz").value), montagezeit: leseZahl0($("#mo-zeit").value), internerSatz: leseZahl0($("#mo-ik").value), verkaufSatz: leseZahl0($("#mo-vk").value), fahrtzeit: leseZahl0($("#mo-fz").value), km: leseZahl0($("#mo-km").value), kmSatz: leseZahl0($("#mo-kms").value), hebegeraet: leseZahl0($("#mo-heb").value), uebernachtung: leseZahl0($("#mo-ueb").value), taggeld: leseZahl0($("#mo-tag").value), verbrauch: leseZahl0($("#mo-verb").value), sonstige: leseZahl0($("#mo-son").value) };
      k.transport = { verpackungsmaterial: leseZahl0($("#tr-verp").value), paletten: leseZahl0($("#tr-pal").value) };
      k.geaendert = Store.nowISO(); Store.save(); renderKalkEditor();
      return true;
    });
  }
  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }

  // ============================================================
  //  ANGEBOTE (Phase 4)
  // ============================================================
  var angebotState = null; // { id, view }
  var angebotFilter = { suche: "", status: "" };
  var ANG_STATUS = ["Entwurf", "interne Prüfung", "freigegeben", "versendet", "angesehen", "in Verhandlung", "angenommen", "teilweise angenommen", "abgelehnt", "abgelaufen", "storniert", "in Auftrag umgewandelt"];

  function angebotById(id) { return (db.angebote || []).filter(function (a) { return a.id === id; })[0] || null; }
  function angebotKontext(a) {
    var kunde = (db.kunden || []).filter(function (k) { return k.id === a.kundeId; })[0] || {};
    var projekt = (db.projekte || []).filter(function (p) { return p.id === a.projektId; })[0];
    var erstellt = a.erstellt ? new Date(a.erstellt) : new Date();
    var gueltig = new Date(erstellt.getTime()); gueltig.setDate(gueltig.getDate() + (a.gueltigTage || 30));
    return { firma: db.settings.firma, kunde: kunde, kundeName: kunde.name || "", ansprechpartner: a.ansprechpartner || (kunde.ansprechpartner || ""), projekt: projekt ? projekt.name : "", datum: fmtDate(a.erstellt), gueltigBis: gueltig.toLocaleDateString("de-AT"), fmtEUR: fmtEUR };
  }
  function naechsteAngebotNr() {
    var nk = db.settings.angebotNummernkreis || { praefix: "AN", laufend: 1, mindestlaenge: 4 };
    return Angebot.naechsteNummer({ praefix: nk.praefix, jahr: new Date().getFullYear(), laufend: nk.laufend, mindestlaenge: nk.mindestlaenge });
  }

  function renderAngebote() {
    if (angebotState && angebotById(angebotState.id)) { if (angebotState.view === "detail") angebotDetail(angebotState.id); else angebotEditor(angebotState.id); }
    else { angebotState = null; renderAngebotListe(); }
  }
  function renderAngebotListe() {
    var root = $("#page-angebote .content");
    var liste = db.angebote || (db.angebote = []);
    var offen = 0, angenommen = 0, abgelehnt = 0, entschieden = 0, gewonnen = 0;
    liste.forEach(function (a) { var s = Angebot.summen(a); if (/angenommen/.test(a.status) || a.status === "in Auftrag umgewandelt") { angenommen += s.netto; entschieden++; gewonnen++; } else if (a.status === "abgelehnt") { abgelehnt += s.netto; entschieden++; } else if (a.status !== "storniert") offen += s.netto; });
    var quote = entschieden > 0 ? Math.round(gewonnen / entschieden * 100) : 0;
    var statusOpt = '<option value="">Alle Status</option>' + ANG_STATUS.map(function (s) { return '<option value="' + s + '"' + (angebotFilter.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("");
    var html = '<div class="grid cols-4" style="margin-bottom:14px">' +
      stat("Offene Angebote", fmtEUR(offen), "", "Netto") + stat("Angenommen", fmtEUR(angenommen), "", "Netto") +
      stat("Abgelehnt", fmtEUR(abgelehnt), "", "Netto") + stat("Abschlussquote", quote + " %", "", entschieden + " entschieden") + "</div>";
    html += '<div class="card"><div class="btn-row" style="margin-bottom:10px"><button class="btn primary sm" id="btn-ang-neu" type="button">+ Neues Angebot</button>' +
      (Auth.darf("textbausteine") ? ' <button class="btn sm" id="btn-textbausteine" type="button">📝 Textbausteine</button>' : "") + "</div>" +
      '<div class="inline" style="margin-bottom:10px"><input id="ang-suche" placeholder="🔍 Nr., Kunde, Kommission, Bezeichnung" value="' + esc(angebotFilter.suche) + '" style="flex:2"><select id="ang-status" style="flex:1;min-width:150px">' + statusOpt + "</select></div>" +
      '<div id="ang-liste"></div></div>';
    root.innerHTML = html;
    $("#btn-ang-neu").onclick = function () { angebotNeuDialog(); };
    var bt = $("#btn-textbausteine"); if (bt) bt.onclick = function () { renderTextbausteine(); };
    $("#ang-suche").addEventListener("input", function () { angebotFilter.suche = this.value; zeichneAngebotListe(); });
    $("#ang-status").addEventListener("change", function () { angebotFilter.status = this.value; zeichneAngebotListe(); });
    zeichneAngebotListe();
  }
  function zeichneAngebotListe() {
    var ziel = $("#ang-liste"); if (!ziel) return;
    var suche = (angebotFilter.suche || "").toLowerCase().trim();
    var liste = (db.angebote || []).filter(function (a) {
      if (angebotFilter.status && a.status !== angebotFilter.status) return false;
      if (!suche) return true;
      return [a.nummer, a.bezeichnung, a.kommission, kundeName(a.kundeId)].filter(Boolean).join(" ").toLowerCase().indexOf(suche) >= 0;
    });
    if (!liste.length) { ziel.innerHTML = '<div class="empty">Keine Angebote. Erstelle eines aus einer freigegebenen Kalkulation.</div>'; return; }
    var html = '<div class="table-wrap"><table><thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Kunde</th><th>Kommission</th><th class="num">Netto</th><th>Status</th><th class="num">Aktion</th></tr></thead><tbody>';
    liste.slice().reverse().forEach(function (a) {
      var s = Angebot.summen(a);
      html += "<tr><td>" + esc(a.nummer) + (a.version > 1 ? " v" + a.version : "") + "</td>" +
        "<td><strong>" + esc(a.bezeichnung || "—") + "</strong>" + (a.beispiel ? ' <span class="tag">Beispiel</span>' : "") + "</td>" +
        "<td>" + esc(kundeName(a.kundeId)) + "</td>" +
        "<td>" + (a.kommission ? '<span class="tag">' + esc(a.kommission) + "</span>" : "—") + "</td>" +
        '<td class="num">' + fmtEUR(s.netto) + "</td><td>" + statusBadgeKalk(a.status) + "</td>" +
        '<td class="num" style="white-space:nowrap"><button class="btn sm" data-angopen="' + a.id + '" type="button">Öffnen</button> ' +
          '<button class="btn sm ghost" data-angpdf="' + a.id + '" type="button" title="PDF">🖨️</button> ' +
          '<button class="btn sm ghost" data-angdup="' + a.id + '" type="button" title="Duplizieren">📋</button> ' +
          '<button class="btn sm danger" data-angdel="' + a.id + '" type="button">🗑️</button></td></tr>';
    });
    html += "</tbody></table></div>";
    ziel.innerHTML = html;
    $all("[data-angopen]", ziel).forEach(function (b) { b.onclick = function () { var a = angebotById(b.dataset.angopen); angebotState = { id: b.dataset.angopen, view: (a.status === "Entwurf" || a.status === "interne Prüfung") ? "editor" : "detail" }; renderAngebote(); }; });
    $all("[data-angpdf]", ziel).forEach(function (b) { b.onclick = function () { angebotPDF(b.dataset.angpdf); }; });
    $all("[data-angdup]", ziel).forEach(function (b) { b.onclick = function () { angebotDuplizieren(b.dataset.angdup); }; });
    $all("[data-angdel]", ziel).forEach(function (b) { b.onclick = function () { if (confirm("Angebot löschen?")) { db.angebote = db.angebote.filter(function (a) { return a.id !== b.dataset.angdel; }); Store.save(); zeichneAngebotListe(); } }; });
  }

  function angebotNeuDialog() {
    var frei = (db.kalkulationen || []).filter(function (k) { return k.status === "freigegeben"; });
    if (!frei.length) { toast("Keine freigegebene Kalkulation vorhanden. Bitte zuerst eine Kalkulation freigeben.", "err"); return; }
    var kalkOpt = frei.map(function (k) { return '<option value="' + k.id + '">' + esc(k.nummer + " · " + (k.bezeichnung || "")) + "</option>"; }).join("");
    var body = '<label class="fld"><span class="lbl">Freigegebene Kalkulation</span><select id="an-kalk">' + kalkOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Angebotsart</span><select id="an-modus"><option value="detail">Detailliert</option><option value="zusammen">Zusammengefasst</option><option value="pauschal">Pauschalangebot</option></select></label>';
    openModal("Neues Angebot aus Kalkulation", body, function () {
      var k = (db.kalkulationen || []).filter(function (x) { return x.id === $("#an-kalk").value; })[0];
      if (!k) return false;
      var std = {}; (db.textbausteine || []).forEach(function (t) { if (t.standard) std[t.kategorie] = t.text; });
      var a = {
        id: Store.uid(), nummer: naechsteAngebotNr(), bezeichnung: k.bezeichnung, kundeId: k.kundeId, projektId: k.projektId, kommission: k.kommission,
        ansprechpartner: "", lieferadresse: "", kalkId: k.id, kalkVersion: k.version, betreff: k.bezeichnung,
        einleitung: std["Einleitung"] || "", positionen: Angebot.ausKalkulation(k, Kalk, $("#an-modus").value),
        rabattProz: 0, mwstProz: k.mwstProz || 20, zahlungsbedingungen: std["Zahlungsbedingungen"] || "", lieferbedingungen: std["Lieferbedingungen"] || "",
        ausfuehrungszeitraum: std["Ausführungszeit"] || "", voraussetzungen: "", ausschluesse: "", schlusstext: std["Schlussformel"] || "",
        vorlageId: "vorlage-standard", status: "Entwurf", version: 1, gueltigTage: 30, erstellt: Store.nowISO(), geaendert: Store.nowISO(), ersteller: (Auth.current() || {}).benutzername || "", statusVerlauf: [{ datum: Store.nowISO(), von: "", zu: "Entwurf", benutzer: (Auth.current() || {}).benutzername || "", notiz: "Aus Kalkulation " + k.nummer + " erstellt" }]
      };
      db.angebote.push(a);
      var nk = db.settings.angebotNummernkreis; nk.laufend = (nk.laufend || 1) + 1;
      Store.save(); angebotState = { id: a.id, view: "editor" }; renderAngebote();
      return true;
    }, "Erstellen");
  }
  function angebotDuplizieren(id) {
    var a = angebotById(id); if (!a) return;
    var k = JSON.parse(JSON.stringify(a));
    k.id = Store.uid(); k.nummer = naechsteAngebotNr(); k.bezeichnung = (a.bezeichnung || "") + " (Kopie)"; k.status = "Entwurf"; k.version = 1; k.beispiel = false; k.auftragId = null;
    k.erstellt = Store.nowISO(); k.geaendert = Store.nowISO();
    k.statusVerlauf = [{ datum: Store.nowISO(), von: "", zu: "Entwurf", benutzer: (Auth.current() || {}).benutzername || "", notiz: "Aus " + a.nummer + " dupliziert" }];
    db.angebote.push(k); var nk = db.settings.angebotNummernkreis; nk.laufend = (nk.laufend || 1) + 1; Store.save();
    toast("Angebot dupliziert."); angebotState = { id: k.id, view: "editor" }; renderAngebote();
  }

  function angebotEditor(id) {
    var a = angebotById(id); if (!a) { angebotState = null; renderAngebotListe(); return; }
    var root = $("#page-angebote .content");
    var s = Angebot.summen(a);
    var ktx = angebotKontext(a);
    // offene Platzhalter prüfen
    var werte = Angebot.platzhalterWerte(a, ktx);
    var alleTexte = [a.betreff, a.einleitung, a.zahlungsbedingungen, a.lieferbedingungen, a.ausfuehrungszeitraum, a.schlusstext].join(" ");
    var offen = Angebot.offenePlatzhalter(alleTexte, werte);
    var html = '<div class="card"><div class="btn-row" style="margin-bottom:8px">' +
      '<button class="btn sm ghost" id="btn-ang-zurueck" type="button">← Liste</button>' +
      '<button class="btn sm" id="btn-ang-pdf" type="button">🖨️ PDF/Vorschau</button>' +
      '<button class="btn primary sm" id="btn-ang-freigabe" type="button">✓ Freigeben</button></div>';
    html += "<h3>" + esc(a.bezeichnung || "Angebot") + ' <span class="sub">' + esc(a.nummer) + " · v" + a.version + " · " + statusBadgeKalk(a.status) + "</span></h3>";
    if (offen.length) html += '<div class="fehler-box" style="margin-bottom:10px">⚠️ Offene Platzhalter: ' + offen.map(function (x) { return "{{" + esc(x) + "}}"; }).join(", ") + " – werden im PDF leer dargestellt.</div>";
    html += '<div class="inline">' + fld2("Betreff", "ae-betreff", a.betreff || "", "text") + fld2("Ansprechpartner", "ae-ap", a.ansprechpartner || "", "text") + "</div>";
    html += '<div class="inline">' + fld2("Kommission", "ae-komm", a.kommission || "", "text") + fld2("Gültig (Tage)", "ae-gueltig", a.gueltigTage || 30, "number") + fld2("Rabatt %", "ae-rabatt", a.rabattProz || 0, "number") + "</div>";
    // Positionen
    html += '<div class="card" style="background:var(--panel-2);margin-top:10px"><div class="btn-row" style="justify-content:space-between;margin-bottom:6px"><strong>Positionen (' + (a.positionen || []).length + ')</strong><button class="btn sm" id="btn-ang-pos-add" type="button">+ Position</button></div>';
    html += '<div class="table-wrap"><table><thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Typ</th><th class="num">Menge</th><th class="num">EP</th><th class="num">GP</th><th class="num"></th></tr></thead><tbody>';
    (a.positionen || []).forEach(function (p, i) {
      var t = Angebot.POSTYPEN[p.typ] || {};
      var gp = t.rechnet ? Angebot.posSumme(p) : (t.optional || t.alternativ ? Angebot.posSumme(p) : null);
      html += "<tr" + (t.struktur ? ' style="opacity:.8"' : "") + "><td>" + esc(p.nummer || "") + "</td>" +
        "<td>" + esc(p.kurz || "") + (t.optional ? ' <span class="tag">optional</span>' : t.alternativ ? ' <span class="tag">Alt.</span>' : "") + "</td>" +
        "<td>" + esc(t.label || p.typ) + "</td>" +
        '<td class="num">' + (p.menge != null && t.rechnet ? fmtZahl(p.menge) : "—") + "</td>" +
        '<td class="num">' + (t.rechnet || t.optional || t.alternativ ? fmtEUR(p.einzelpreis) : "—") + "</td>" +
        '<td class="num">' + (gp != null ? fmtEUR(gp) : "—") + "</td>" +
        '<td class="num" style="white-space:nowrap"><button class="btn sm ghost" data-angposedit="' + i + '" type="button">✏️</button> <button class="btn sm danger" data-angposdel="' + i + '" type="button">🗑️</button></td></tr>';
    });
    html += "</tbody></table></div></div>";
    // Texte
    html += '<div class="card" style="margin-top:10px"><strong>Texte</strong>' +
      textFeld("Einleitung", "ae-einl", a.einleitung, "Einleitung") +
      textFeld("Zahlungsbedingungen", "ae-zahl", a.zahlungsbedingungen, "Zahlungsbedingungen") +
      textFeld("Lieferbedingungen", "ae-lief", a.lieferbedingungen, "Lieferbedingungen") +
      textFeld("Ausführungszeitraum", "ae-ausf", a.ausfuehrungszeitraum, "Ausführungszeit") +
      textFeld("Schlusstext", "ae-schluss", a.schlusstext, "Schlussformel") + "</div>";
    html += '<div id="ang-summary">' + angebotSummaryHTML(s) + "</div></div>";
    root.innerHTML = html;
    $("#btn-ang-zurueck").onclick = function () { angebotState = null; renderAngebotListe(); };
    $("#btn-ang-pdf").onclick = function () { angebotSammle(a); angebotPDF(id); };
    $("#btn-ang-freigabe").onclick = function () { angebotSammle(a); angebotFreigeben(id); };
    $("#btn-ang-pos-add").onclick = function () { angebotSammle(a); posAngebotModal(id, -1); };
    $all("[data-angposedit]", root).forEach(function (b) { b.onclick = function () { angebotSammle(a); posAngebotModal(id, +b.dataset.angposedit); }; });
    $all("[data-angposdel]", root).forEach(function (b) { b.onclick = function () { angebotSammle(a); a.positionen.splice(+b.dataset.angposdel, 1); Store.save(); angebotEditor(id); }; });
    // Live: Rabatt/Gültig ändern -> Summary neu
    ["ae-rabatt", "ae-gueltig"].forEach(function (fid) { var el = $("#" + fid); if (el) el.addEventListener("change", function () { angebotSammle(a); $("#ang-summary").innerHTML = angebotSummaryHTML(Angebot.summen(a)); }); });
    // Textbaustein-Buttons
    $all("[data-tb]", root).forEach(function (b) { b.onclick = function () { textbausteinWaehlen(b.dataset.tb, b.dataset.tbfield); }; });
  }
  function textFeld(label, id, val, kategorie) {
    return '<label class="fld"><span class="lbl">' + esc(label) + ' <button class="btn sm ghost" data-tb="' + esc(kategorie) + '" data-tbfield="' + id + '" type="button" style="padding:1px 6px;font-size:11px">Baustein</button></span><textarea id="' + id + '" rows="2" style="width:100%">' + esc(val || "") + "</textarea></label>";
  }
  function textbausteinWaehlen(kategorie, fieldId) {
    var bausteine = (db.textbausteine || []).filter(function (t) { return t.kategorie === kategorie && t.aktiv !== false; });
    if (!bausteine.length) { toast("Keine Textbausteine in dieser Kategorie.", "err"); return; }
    var body = bausteine.map(function (t, i) { return '<label class="check"><input type="radio" name="tbw" value="' + i + '"' + (i === 0 ? " checked" : "") + "> <strong>" + esc(t.titel) + "</strong></label><div class=\"muted\" style=\"font-size:12px;margin:2px 0 10px 24px\">" + esc(t.text.slice(0, 120)) + "</div>"; }).join("");
    openModal("Textbaustein: " + kategorie, body, function () {
      var sel = $all('input[name="tbw"]').filter(function (r) { return r.checked; })[0];
      if (sel) { var el = $("#" + fieldId); if (el) el.value = bausteine[+sel.value].text; }
      return true;
    }, "Übernehmen");
  }
  function angebotSammle(a) {
    if ($("#ae-betreff")) a.betreff = $("#ae-betreff").value.trim();
    if ($("#ae-ap")) a.ansprechpartner = $("#ae-ap").value.trim();
    if ($("#ae-komm")) a.kommission = $("#ae-komm").value.trim();
    if ($("#ae-gueltig")) a.gueltigTage = leseZahl0($("#ae-gueltig").value) || 30;
    if ($("#ae-rabatt")) a.rabattProz = leseZahl0($("#ae-rabatt").value);
    if ($("#ae-einl")) a.einleitung = $("#ae-einl").value;
    if ($("#ae-zahl")) a.zahlungsbedingungen = $("#ae-zahl").value;
    if ($("#ae-lief")) a.lieferbedingungen = $("#ae-lief").value;
    if ($("#ae-ausf")) a.ausfuehrungszeitraum = $("#ae-ausf").value;
    if ($("#ae-schluss")) a.schlusstext = $("#ae-schluss").value;
    a.geaendert = Store.nowISO(); Store.save();
  }
  function angebotSummaryHTML(s) {
    var html = '<div class="card" style="margin-top:10px;background:var(--panel-2)"><strong>Summen</strong>' +
      line("Zwischensumme", fmtEUR(s.zwischensumme), "sub") +
      (s.zuschlaege ? line("Zuschläge", fmtEUR(s.zuschlaege), "sub") : "") +
      (s.rabatt ? line("Rabatt", "−" + fmtEUR(s.rabatt), "sub") : "") +
      line("Nettosumme", fmtEUR(s.netto));
    s.steuerZeilen.forEach(function (z) { html += line("USt " + z.satz + " %", fmtEUR(z.steuer), "sub"); });
    html += line("Bruttosumme", fmtEUR(s.brutto));
    if (s.optionalSumme) html += '<hr class="sep">' + line("Optionale Positionen (nicht enthalten)", fmtEUR(s.optionalSumme), "sub") + line("Gesamt mit Optionen (netto)", fmtEUR(s.nettoMitOptionen), "sub");
    return html + "</div>";
  }
  function posAngebotModal(id, index) {
    var a = angebotById(id); if (!a) return;
    var p = index >= 0 ? a.positionen[index] : { typ: "normal", aktiv: true };
    var typOpt = Object.keys(Angebot.POSTYPEN).map(function (t) { return '<option value="' + t + '"' + (p.typ === t ? " selected" : "") + ">" + esc(Angebot.POSTYPEN[t].label) + "</option>"; }).join("");
    var body = '<div class="inline">' + fld2("Positionsnummer", "ap-nr", p.nummer || "", "text") + '<label class="fld"><span class="lbl">Positionsart</span><select id="ap-typ">' + typOpt + "</select></label></div>" +
      fld2("Kurzbezeichnung", "ap-kurz", p.kurz || "", "text") +
      '<label class="fld"><span class="lbl">Ausführliche Beschreibung</span><textarea id="ap-besch" rows="2" style="width:100%">' + esc(p.beschreibung || "") + "</textarea></label>" +
      '<div class="inline">' + fld2("Menge", "ap-menge", p.menge != null ? p.menge : 1, "number") + fld2("Einheit", "ap-einh", p.einheit || "Pos", "text") + "</div>" +
      '<div class="inline">' + fld2("Einzelpreis €", "ap-ep", p.einzelpreis != null ? p.einzelpreis : "", "number") + fld2("USt %", "ap-mwst", p.mwstProz != null ? p.mwstProz : (a.mwstProz || 20), "number") + "</div>" +
      '<div class="inline">' +
        '<label class="fld"><span class="lbl">Optional aktiviert (in Summe)</span><select id="ap-aktiviert"><option value="0">nein</option><option value="1"' + (p.aktiviert ? " selected" : "") + ">ja</option></select></label>" +
        '<label class="fld"><span class="lbl">Seitenumbruch davor</span><select id="ap-umbruch"><option value="0">nein</option><option value="1"' + (p.seitenumbruch ? " selected" : "") + ">ja</option></select></label>" +
      "</div>";
    openModal(index >= 0 ? "Position bearbeiten" : "Position hinzufügen", body, function () {
      var neu = index >= 0 ? p : { aktiv: true };
      neu.nummer = $("#ap-nr").value.trim(); neu.typ = $("#ap-typ").value; neu.kurz = $("#ap-kurz").value.trim(); neu.beschreibung = $("#ap-besch").value.trim();
      neu.menge = leseZahl0($("#ap-menge").value); neu.einheit = $("#ap-einh").value.trim(); neu.einzelpreis = leseZahl0($("#ap-ep").value); neu.mwstProz = leseZahl0($("#ap-mwst").value);
      neu.aktiviert = $("#ap-aktiviert").value === "1"; neu.seitenumbruch = $("#ap-umbruch").value === "1";
      if (index < 0) { if (!neu.nummer) neu.nummer = String((a.positionen || []).filter(function (x) { return (Angebot.POSTYPEN[x.typ] || {}).rechnet; }).length + 1); (a.positionen = a.positionen || []).push(neu); }
      Store.save(); angebotEditor(id);
      return true;
    });
  }

  function angebotFreigeben(id) {
    var a = angebotById(id); if (!a) return;
    var s = Angebot.summen(a); var ktx = angebotKontext(a);
    var werte = Angebot.platzhalterWerte(a, ktx);
    var probleme = [];
    if (!a.kundeId) probleme.push("Kein Empfänger/Kunde ausgewählt.");
    if (!(a.positionen || []).some(function (p) { return (Angebot.POSTYPEN[p.typ] || {}).rechnet; })) probleme.push("Keine berechnende Position vorhanden.");
    if (s.netto <= 0) probleme.push("Nettosumme ist 0.");
    var offen = Angebot.offenePlatzhalter([a.betreff, a.einleitung, a.zahlungsbedingungen, a.lieferbedingungen, a.schlusstext].join(" "), werte);
    if (offen.length) probleme.push("Ungelöste Platzhalter: " + offen.map(function (x) { return "{{" + x + "}}"; }).join(", "));
    if (!db.settings.firma.uid) probleme.push("Firmen-UID fehlt (Stammdaten).");
    if (probleme.length && !confirm("Vor der Freigabe:\n- " + probleme.join("\n- ") + "\n\nTrotzdem freigeben?")) return;
    // Snapshot der Ausgabe einfrieren
    a.snapshot = { ausgabe: Angebot.kundenAusgabe(a, ktx), summen: s, datum: Store.nowISO(), vorlageId: a.vorlageId };
    angebotSetStatus(a, "freigegeben", "Freigegeben (v" + a.version + ")");
    Store.save(); toast("Angebot freigegeben. ✅"); angebotState = { id: id, view: "detail" }; renderAngebote();
  }
  function angebotSetStatus(a, neu, notiz) {
    (a.statusVerlauf = a.statusVerlauf || []).push({ datum: Store.nowISO(), von: a.status, zu: neu, benutzer: (Auth.current() || {}).benutzername || "", notiz: notiz || "" });
    a.status = neu; a.geaendert = Store.nowISO();
  }
  function angebotVersionNeu(id) {
    var a = angebotById(id); if (!a) return;
    a.version = (a.version || 1) + 1; a.snapshot = null;
    angebotSetStatus(a, "Entwurf", "Neue Version " + a.version + " zur Bearbeitung");
    Store.save(); angebotState = { id: id, view: "editor" }; renderAngebote();
  }

  function angebotDetail(id) {
    var a = angebotById(id); if (!a) { renderAngebotListe(); return; }
    var root = $("#page-angebote .content");
    var s = Angebot.summen(a);
    var statusOpt = ANG_STATUS.map(function (st) { return '<option value="' + st + '"' + (a.status === st ? " selected" : "") + ">" + st + "</option>"; }).join("");
    var html = '<div class="card"><div class="btn-row" style="margin-bottom:8px">' +
      '<button class="btn sm ghost" id="btn-ang-zurueck" type="button">← Liste</button>' +
      '<button class="btn sm" id="btn-ang-pdf" type="button">🖨️ PDF</button>' +
      (a.status === "Entwurf" || a.status === "interne Prüfung" ? '<button class="btn sm" id="btn-ang-edit" type="button">✏️ Bearbeiten</button>' : '<button class="btn sm" id="btn-ang-version" type="button">✏️ Neue Version</button>') +
      (/angenommen/.test(a.status) ? '<button class="btn primary sm" id="btn-ang-auftrag" type="button">➡️ In Auftrag umwandeln</button>' : "") + "</div>";
    html += "<h3>" + esc(a.bezeichnung || "Angebot") + ' <span class="sub">' + esc(a.nummer) + " · v" + a.version + "</span></h3>";
    html += '<div class="inline" style="align-items:flex-end;margin-bottom:8px"><label class="fld" style="max-width:220px"><span class="lbl">Status</span><select id="ang-status-sel">' + statusOpt + '</select></label><button class="btn sm" id="btn-ang-status" type="button" style="margin-bottom:14px">Status setzen</button></div>';
    html += '<div class="muted" style="font-size:12px;margin-bottom:10px">' + esc(kundeName(a.kundeId)) + (a.kommission ? " · Kommission: " + esc(a.kommission) : "") + "</div>";
    html += angebotSummaryHTML(s);
    if (a.auftragId) html += '<div class="insight" style="margin-top:10px"><span class="ico">➡️</span><span>In Auftrag umgewandelt.</span></div>';
    if (a.statusVerlauf && a.statusVerlauf.length) html += '<div class="card" style="margin-top:10px;background:var(--panel-2)"><strong>Statusverlauf</strong>' + a.statusVerlauf.slice().reverse().map(function (v) { return '<div class="zeile"><span>' + fmtDate(v.datum) + " · " + esc(v.benutzer || "") + "</span><strong>" + esc(v.zu) + (v.notiz ? " – " + esc(v.notiz) : "") + "</strong></div>"; }).join("") + "</div>";
    html += "</div>";
    root.innerHTML = html;
    $("#btn-ang-zurueck").onclick = function () { angebotState = null; renderAngebotListe(); };
    $("#btn-ang-pdf").onclick = function () { angebotPDF(id); };
    if ($("#btn-ang-edit")) $("#btn-ang-edit").onclick = function () { angebotState = { id: id, view: "editor" }; renderAngebote(); };
    if ($("#btn-ang-version")) $("#btn-ang-version").onclick = function () { angebotVersionNeu(id); };
    if ($("#btn-ang-auftrag")) $("#btn-ang-auftrag").onclick = function () { angebotZuAuftrag(id); };
    $("#btn-ang-status").onclick = function () { angebotSetStatus(a, $("#ang-status-sel").value, "Status geändert"); Store.save(); angebotDetail(id); };
  }

  function angebotZuAuftrag(id) {
    var a = angebotById(id); if (!a) return;
    if (a.auftragId && (db.auftraege || []).some(function (x) { return x.id === a.auftragId; })) { if (!confirm("Dieses Angebot wurde bereits in einen Auftrag umgewandelt. Erneut umwandeln?")) return; }
    var kalk = (db.kalkulationen || []).filter(function (k) { return k.id === a.kalkId; })[0];
    var auftrag = {
      id: Store.uid(), nummer: "AU-" + new Date().getFullYear() + "-" + ("000" + ((db.auftraege || []).length + 1)).slice(-4),
      titel: a.bezeichnung, kundeId: a.kundeId, projektId: a.projektId, kommission: a.kommission,
      angebotId: a.id, angebotVersion: a.version, kalkId: a.kalkId, kalkVersion: a.kalkVersion,
      sollSnapshot: kalk ? { kalk: JSON.parse(JSON.stringify(kalk)), ergebnis: kalk.ergebnis || Kalk.berechne(kalk, db.settings), datum: Store.nowISO() } : null,
      nettowert: Angebot.summen(a).netto, status: "angelegt", erstellt: Store.nowISO(),
      // Kompatibel zum Legacy-Auftragsmodell (positionen/kalk für sollIst)
      positionen: kalk ? [{ produktKey: kalk.gruppeKey, kalk: { zeiten: {}, netto: Angebot.summen(a).netto }, ist: null, label: a.bezeichnung }] : [],
      kalk: { netto: Angebot.summen(a).netto, stundenGesamt: 0, selbstkosten: kalk && kalk.ergebnis ? kalk.ergebnis.selbst : 0, deckungsbeitrag: kalk && kalk.ergebnis ? kalk.ergebnis.deckungsbeitrag : 0, gewinn: kalk && kalk.ergebnis ? kalk.ergebnis.gewinn : 0 }
    };
    db.auftraege.push(auftrag);
    a.auftragId = auftrag.id;
    angebotSetStatus(a, "in Auftrag umgewandelt", "Auftrag " + auftrag.nummer + " erstellt");
    Store.save(); toast("Auftrag " + auftrag.nummer + " erstellt. ✅"); angebotDetail(id);
  }

  // ---- PDF / Druckvorschau (kundensicher) -------------------
  function angebotPDF(id) {
    var a = angebotById(id); if (!a) return;
    var ktx = angebotKontext(a);
    // Bei freigegebenem Angebot den eingefrorenen Snapshot verwenden
    var ausgabe = (a.snapshot && a.snapshot.ausgabe) ? a.snapshot.ausgabe : Angebot.kundenAusgabe(a, ktx);
    // Sicherheitsnetz: interne Daten dürfen nicht enthalten sein
    var leaks = Angebot.enthaeltInterne(ausgabe);
    if (leaks.length) { toast("PDF abgebrochen: interne Daten erkannt (" + leaks.join(", ") + ").", "err"); return; }
    var vorlage = (db.settings.angebotVorlagen || []).filter(function (v) { return v.id === a.vorlageId; })[0] || (db.settings.angebotVorlagen || [])[0] || {};
    var html = angebotDruckHTML(ausgabe, vorlage, Angebot.dateiname(a, a.kommission));
    var wpdf = w.open("", "_blank");
    if (!wpdf) { toast("Bitte Pop-ups erlauben, um das PDF zu erzeugen.", "err"); return; }
    wpdf.document.open(); wpdf.document.write(html); wpdf.document.close();
  }
  function angebotDruckHTML(o, vorlage, dateiname) {
    var akz = vorlage.akzentfarbe || "#f5a623";
    var f = o.firma || {};
    function e(x) { return esc(x == null ? "" : x); }
    function absatz(t) { return t ? '<p>' + e(t).replace(/\n/g, "<br>") + "</p>" : ""; }
    var posRows = o.positionen.map(function (p) {
      if (p.typ === "ueberschrift") return '<tr class="ueber"><td colspan="5"><strong>' + e(p.kurz) + "</strong></td></tr>";
      if (p.typ === "text") return '<tr class="txt"><td colspan="5">' + e(p.kurz) + (p.beschreibung ? "<br><span class='klein'>" + e(p.beschreibung) + "</span>" : "") + "</td></tr>";
      if (p.typ === "zwischensumme") return '<tr class="zwsum"><td colspan="4">Zwischensumme</td><td class="r">' + fmtEUR(p.gesamtpreis || 0) + "</td></tr>";
      var opt = p.optional ? " (optional)" : p.alternativ ? " (Alternative)" : "";
      return (p.seitenumbruch ? '<tr class="umbruch"><td colspan="5"></td></tr>' : "") + "<tr><td class='r'>" + e(p.nummer) + "</td><td><strong>" + e(p.kurz) + "</strong>" + opt + (p.beschreibung ? "<br><span class='klein'>" + e(p.beschreibung) + "</span>" : "") + "</td><td class='r'>" + (p.menge != null ? fmtZahl(p.menge) + " " + e(p.einheit) : "") + "</td><td class='r'>" + (p.einzelpreis != null ? fmtEUR(p.einzelpreis) : "") + "</td><td class='r'>" + (p.optional || p.alternativ ? "<em>optional</em>" : fmtEUR(p.gesamtpreis || 0)) + "</td></tr>";
    }).join("");
    var steuer = o.summen.steuerZeilen.map(function (z) { return '<tr><td>zzgl. USt ' + z.satz + " %</td><td class='r'>" + fmtEUR(z.steuer) + "</td></tr>"; }).join("");
    var optBlock = o.summen.optionalSumme ? '<div class="hinweis">Optionale Positionen (' + fmtEUR(o.summen.optionalSumme) + ' netto) sind nicht im Angebotspreis enthalten. Gesamtpreis mit Optionen: ' + fmtEUR(o.summen.nettoMitOptionen) + " netto.</div>" : "";
    return '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>' + e(dateiname) + '</title><style>' +
      '@page{size:A4;margin:18mm 16mm 20mm;}@media print{.noprint{display:none}}' +
      'body{font-family:' + (vorlage.schrift || "Helvetica,Arial,sans-serif") + ';color:#1a1a1a;font-size:11px;line-height:1.5;margin:0;}' +
      '.kopf{display:flex;justify-content:space-between;border-bottom:2px solid ' + akz + ';padding-bottom:8px;margin-bottom:14px;}' +
      '.logo{font-size:22px;font-weight:800;color:' + akz + ';}.firma-klein{font-size:10px;color:#555;text-align:right;}' +
      '.empf{margin:10px 0 4px;}.meta{float:right;text-align:right;font-size:10px;color:#444;}' +
      'h1{font-size:15px;margin:16px 0 6px;}table.pos{width:100%;border-collapse:collapse;margin:8px 0;}' +
      'table.pos th{background:' + akz + '22;text-align:left;padding:5px;border-bottom:1px solid ' + akz + ';font-size:10px;}' +
      'table.pos td{padding:5px;border-bottom:1px solid #eee;vertical-align:top;}.r{text-align:right;}.klein{color:#666;font-size:10px;}' +
      'tr.ueber td{background:#f5f5f5;padding-top:8px;}tr.zwsum td{border-top:1px solid #ccc;font-weight:600;}tr.umbruch{page-break-before:always;}' +
      '.summen{width:52%;margin-left:auto;margin-top:8px;}.summen table{width:100%;border-collapse:collapse;}.summen td{padding:3px 5px;}' +
      '.summen tr.netto td,.summen tr.brutto td{font-weight:700;border-top:1px solid #333;}.hinweis{font-size:10px;color:#555;margin-top:6px;}' +
      '.block{margin-top:12px;}.block h2{font-size:12px;color:' + akz + ';margin:0 0 3px;}.fuss{margin-top:24px;border-top:1px solid #ccc;padding-top:6px;font-size:9px;color:#666;display:flex;justify-content:space-between;}' +
      '.unter{margin-top:30px;display:flex;justify-content:space-between;}.unter div{width:45%;border-top:1px solid #333;padding-top:4px;text-align:center;font-size:10px;}' +
      '.noprint{position:fixed;top:8px;right:8px;}.btn{background:' + akz + ';border:none;padding:8px 14px;border-radius:6px;font-weight:700;cursor:pointer;}' +
      '</style></head><body>' +
      '<div class="noprint"><button class="btn" onclick="window.print()">Als PDF drucken/speichern</button></div>' +
      '<div class="kopf"><div class="logo">' + e(f.name || "Firma") + '</div><div class="firma-klein">' + e(f.strasse) + "<br>" + e(f.plzOrt) + "<br>" + e(f.tel) + " · " + e(f.email) + (f.uid ? "<br>UID: " + e(f.uid) : "") + "</div></div>" +
      '<div class="meta">Angebot <strong>' + e(o.nummer) + "</strong><br>Datum: " + e(o.datum) + "<br>Gültig bis: " + e(o.gueltigBis) + (o.kommission ? "<br>Kommission: " + e(o.kommission) : "") + "</div>" +
      '<div class="empf"><strong>' + e(o.kunde.name) + "</strong>" + (o.ansprechpartner ? "<br>z. Hd. " + e(o.ansprechpartner) : "") + "<br>" + e(o.kunde.strasse) + "<br>" + e(o.kunde.plzOrt) + "</div>" +
      "<h1>" + e(o.betreff || "Angebot") + "</h1>" + absatz(o.einleitung) +
      '<table class="pos"><thead><tr><th>Pos</th><th>Leistung</th><th class="r">Menge</th><th class="r">Einzel</th><th class="r">Gesamt</th></tr></thead><tbody>' + posRows + "</tbody></table>" +
      '<div class="summen"><table><tr><td>Zwischensumme</td><td class="r">' + fmtEUR(o.summen.zwischensumme) + "</td></tr>" +
        (o.summen.zuschlaege ? '<tr><td>Zuschläge</td><td class="r">' + fmtEUR(o.summen.zuschlaege) + "</td></tr>" : "") +
        (o.summen.rabatt ? '<tr><td>Rabatt</td><td class="r">−' + fmtEUR(o.summen.rabatt) + "</td></tr>" : "") +
        '<tr class="netto"><td>Nettosumme</td><td class="r">' + fmtEUR(o.summen.netto) + "</td></tr>" + steuer +
        '<tr class="brutto"><td>Bruttosumme</td><td class="r">' + fmtEUR(o.summen.brutto) + "</td></tr></table>" + optBlock + "</div>" +
      (o.zahlungsbedingungen ? '<div class="block"><h2>Zahlungsbedingungen</h2>' + absatz(o.zahlungsbedingungen) + "</div>" : "") +
      (o.lieferbedingungen ? '<div class="block"><h2>Lieferbedingungen</h2>' + absatz(o.lieferbedingungen) + "</div>" : "") +
      (o.ausfuehrungszeitraum ? '<div class="block"><h2>Ausführungszeitraum</h2>' + absatz(o.ausfuehrungszeitraum) + "</div>" : "") +
      (o.ausschluesse ? '<div class="block"><h2>Ausschlüsse</h2>' + absatz(o.ausschluesse) + "</div>" : "") +
      absatz(o.schlusstext) +
      '<div class="unter"><div>Ort, Datum</div><div>' + e(f.name) + "</div></div>" +
      '<div class="fuss"><span>' + e(f.name) + " · " + e(f.plzOrt) + (f.uid ? " · UID " + e(f.uid) : "") + (vorlage.zeigeBank && f.iban ? " · " + e(f.iban) : "") + "</span><span>" + e(o.nummer) + "</span></div>" +
      "</body></html>";
  }

  // ---- Textbausteine-Verwaltung -----------------------------
  function renderTextbausteine() {
    var root = $("#page-angebote .content");
    var liste = (db.textbausteine || []).slice().sort(function (a, b) { return (a.kategorie || "").localeCompare(b.kategorie || "") || (a.sort || 0) - (b.sort || 0); });
    var html = '<div class="card"><div class="btn-row" style="margin-bottom:10px"><button class="btn sm ghost" id="btn-tb-zurueck" type="button">← Angebote</button><button class="btn primary sm" id="btn-tb-neu" type="button">+ Textbaustein</button></div><h3>Textbausteine</h3>';
    html += '<div class="table-wrap"><table><thead><tr><th>Kategorie</th><th>Titel</th><th>Standard</th><th>Status</th><th class="num">Aktion</th></tr></thead><tbody>';
    liste.forEach(function (t) {
      html += "<tr><td>" + esc(t.kategorie) + "</td><td><strong>" + esc(t.titel) + "</strong></td><td>" + (t.standard ? "★" : "—") + "</td><td>" + (t.aktiv === false ? '<span class="muted">inaktiv</span>' : "aktiv") + "</td>" +
        '<td class="num"><button class="btn sm ghost" data-tbedit="' + t.id + '" type="button">✏️</button> <button class="btn sm danger" data-tbdel="' + t.id + '" type="button">🗑️</button></td></tr>';
    });
    html += "</tbody></table></div></div>";
    root.innerHTML = html;
    $("#btn-tb-zurueck").onclick = function () { renderAngebotListe(); };
    $("#btn-tb-neu").onclick = function () { textbausteinModal(null); };
    $all("[data-tbedit]", root).forEach(function (b) { b.onclick = function () { textbausteinModal(b.dataset.tbedit); }; });
    $all("[data-tbdel]", root).forEach(function (b) { b.onclick = function () { if (confirm("Textbaustein löschen?")) { db.textbausteine = db.textbausteine.filter(function (t) { return t.id !== b.dataset.tbdel; }); Store.save(); renderTextbausteine(); } }; });
  }
  function textbausteinModal(id) {
    var t = id ? (db.textbausteine || []).filter(function (x) { return x.id === id; })[0] : null;
    var kats = ["Einleitung", "Leistungsbeschreibung", "Zahlungsbedingungen", "Lieferbedingungen", "Ausführungszeit", "Montagebedingungen", "Bauseitige Leistungen", "Gewährleistung", "Ausschlüsse", "Schlussformel", "Datenschutz", "Individuell"];
    var katOpt = kats.map(function (k) { return '<option' + (t && t.kategorie === k ? " selected" : "") + ">" + esc(k) + "</option>"; }).join("");
    var body = '<div class="inline"><label class="fld"><span class="lbl">Kategorie</span><select id="tb-kat">' + katOpt + "</select></label>" + fld2("Titel", "tb-titel", t ? t.titel : "", "text") + "</div>" +
      '<label class="fld"><span class="lbl">Text (Platzhalter: {{kunde}}, {{projekt}}, {{kommission}}, {{angebotsnummer}} …)</span><textarea id="tb-text" rows="4" style="width:100%">' + esc(t ? t.text : "") + "</textarea></label>" +
      '<label class="fld"><span class="lbl">Als Standard verwenden</span><select id="tb-std"><option value="0">nein</option><option value="1"' + (t && t.standard ? " selected" : "") + ">ja</option></select></label>";
    openModal(t ? "Textbaustein bearbeiten" : "Textbaustein anlegen", body, function () {
      var titel = $("#tb-titel").value.trim(); if (!titel) { toast("Bitte Titel angeben.", "err"); return false; }
      var std = $("#tb-std").value === "1", kat = $("#tb-kat").value;
      if (std) (db.textbausteine || []).forEach(function (x) { if (x.kategorie === kat && (!t || x.id !== t.id)) x.standard = false; });
      if (t) { t.kategorie = kat; t.titel = titel; t.text = $("#tb-text").value; t.standard = std; }
      else db.textbausteine.push({ id: Store.uid(), kategorie: kat, titel: titel, text: $("#tb-text").value, standard: std, aktiv: true, sort: 999 });
      Store.save(); renderTextbausteine(); toast("Textbaustein gespeichert.");
      return true;
    });
  }

  // ---- Produktgruppen-Verwaltung (Admin) --------------------
  function produktgruppeVerwendet(key) { return (db.konfigurationen || []).some(function (c) { return c.gruppeKey === key; }); }
  function renderProduktgruppen() {
    if (!Auth.darf("produktgruppen")) { renderKonfigListe(); return; }
    var root = $("#page-konfigurator .content");
    var liste = alleGruppen().slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    var html = '<div class="card"><div class="btn-row" style="margin-bottom:12px">' +
      '<button class="btn sm ghost" id="btn-pg-zurueck" type="button">← Konfigurator</button>' +
      '<button class="btn primary sm" id="btn-pg-neu" type="button">+ Produktgruppe</button></div>' +
      '<h3>Produktgruppen <span class="sub">' + liste.length + " Gruppen</span></h3>";
    html += '<div class="table-wrap"><table><thead><tr><th></th><th>Produktgruppe</th><th>Vorlage</th><th>Verwendung</th><th>Status</th><th class="num">Aktion</th></tr></thead><tbody>';
    liste.forEach(function (g, i) {
      var vl = vorlageFuer(g.key);
      var verw = (db.konfigurationen || []).filter(function (c) { return c.gruppeKey === g.key; }).length;
      var status = g.archiviert ? '<span class="muted">archiviert</span>' : (g.aktiv === false ? '<span class="muted">inaktiv</span>' : "aktiv");
      html += "<tr><td>" + esc(g.icon || "📦") + "</td>" +
        "<td><strong>" + esc(g.name) + "</strong></td>" +
        "<td>" + (vl ? "v" + vl.version + " · " + (vl.felder || []).length + " Felder" : '<span class="muted">keine</span>') + "</td>" +
        '<td class="num">' + verw + "</td>" +
        "<td>" + status + "</td>" +
        '<td class="num" style="white-space:nowrap">' +
          '<button class="btn sm ghost" data-pgup="' + g.id + '" type="button" title="nach oben"' + (i === 0 ? " disabled" : "") + ">▲</button> " +
          '<button class="btn sm ghost" data-pgdown="' + g.id + '" type="button" title="nach unten"' + (i === liste.length - 1 ? " disabled" : "") + ">▼</button> " +
          '<button class="btn sm" data-pgfelder="' + esc(g.key) + '" type="button" title="Fragen bearbeiten">🖉 Fragen</button> ' +
          '<button class="btn sm ghost" data-pgedit="' + g.id + '" type="button">✏️</button> ' +
          '<button class="btn sm ghost" data-pgdup="' + g.id + '" type="button" title="Duplizieren">📋</button> ' +
          '<button class="btn sm ghost" data-pgtoggle="' + g.id + '" type="button">' + (g.aktiv === false ? "aktivieren" : "deaktiv.") + "</button> " +
          '<button class="btn sm ghost" data-pgarch="' + g.id + '" type="button">' + (g.archiviert ? "wiederherst." : "archiv.") + "</button></td></tr>";
    });
    html += "</tbody></table></div><p class=\"hint\">Verwendete Produktgruppen können nicht gelöscht, aber deaktiviert oder archiviert werden – bestehende Konfigurationen bleiben unverändert.</p></div>";
    root.innerHTML = html;
    $("#btn-pg-zurueck").onclick = function () { renderKonfigListe(); };
    $("#btn-pg-neu").onclick = function () { produktgruppeModal(null); };
    $all("[data-pgedit]", root).forEach(function (b) { b.onclick = function () { produktgruppeModal(b.dataset.pgedit); }; });
    $all("[data-pgfelder]", root).forEach(function (b) { b.onclick = function () { renderFeldEditor(b.dataset.pgfelder); }; });
    $all("[data-pgdup]", root).forEach(function (b) { b.onclick = function () { produktgruppeDuplizieren(b.dataset.pgdup); }; });
    $all("[data-pgtoggle]", root).forEach(function (b) { b.onclick = function () { var g = gruppeById(b.dataset.pgtoggle); if (g) { g.aktiv = g.aktiv === false; Store.save(); renderProduktgruppen(); } }; });
    $all("[data-pgarch]", root).forEach(function (b) { b.onclick = function () { var g = gruppeById(b.dataset.pgarch); if (g) { g.archiviert = !g.archiviert; Store.save(); renderProduktgruppen(); } }; });
    $all("[data-pgup]", root).forEach(function (b) { b.onclick = function () { verschiebeGruppe(b.dataset.pgup, -1); }; });
    $all("[data-pgdown]", root).forEach(function (b) { b.onclick = function () { verschiebeGruppe(b.dataset.pgdown, 1); }; });
  }
  function gruppeById(id) { return alleGruppen().filter(function (g) { return g.id === id; })[0] || null; }
  function verschiebeGruppe(id, richtung) {
    var liste = alleGruppen().slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    var idx = liste.findIndex(function (g) { return g.id === id; });
    var ziel = idx + richtung;
    if (idx < 0 || ziel < 0 || ziel >= liste.length) return;
    var a = liste[idx].sort || 0, b = liste[ziel].sort || 0;
    liste[idx].sort = b; liste[ziel].sort = a;
    Store.save(); renderProduktgruppen();
  }
  function produktgruppeDuplizieren(id) {
    var g = gruppeById(id); if (!g) return;
    var kopie = Object.assign({}, g, { id: Store.uid(), key: g.key + "-kopie-" + Math.random().toString(36).slice(2, 6), name: g.name + " (Kopie)", sort: (g.sort || 0) + 5, archiviert: false });
    db.produktgruppen.push(kopie);
    // zugehörige Vorlage mitkopieren
    var vl = vorlageFuer(g.key);
    if (vl) { var vk = JSON.parse(JSON.stringify(vl)); vk.id = "vl-" + kopie.key; vk.gruppeKey = kopie.key; vk.version = 1; db.vorlagen.push(vk); }
    Store.save(); renderProduktgruppen(); toast("Produktgruppe dupliziert.");
  }
  function produktgruppeModal(id) {
    var g = id ? gruppeById(id) : null;
    var body =
      '<div class="inline">' + fld2("Name", "pg-name", g ? g.name : "", "text") + fld2("Icon (Emoji)", "pg-icon", g ? g.icon : "📦", "text") + "</div>" +
      (g ? "" : '<p class="hint">Für die neue Gruppe wird automatisch eine leere Vorlage angelegt, deren Fragen du anschließend im Fragen-Editor definierst.</p>');
    openModal(g ? "Produktgruppe bearbeiten" : "Produktgruppe anlegen", body, function () {
      var name = $("#pg-name").value.trim();
      if (!name) { toast("Bitte Namen angeben.", "err"); return false; }
      if (g) { g.name = name; g.icon = $("#pg-icon").value.trim() || "📦"; }
      else {
        var key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || ("grp-" + Math.random().toString(36).slice(2, 6));
        if (gruppeByKey(key)) key = key + "-" + Math.random().toString(36).slice(2, 5);
        var maxSort = alleGruppen().reduce(function (m, x) { return Math.max(m, x.sort || 0); }, 0);
        db.produktgruppen.push({ id: Store.uid(), key: key, name: name, icon: $("#pg-icon").value.trim() || "📦", aktiv: true, archiviert: false, sort: maxSort + 10 });
        db.vorlagen.push({ id: "vl-" + key, gruppeKey: key, version: 1, aktiv: true, erstellt: Store.nowISO(), felder: [] });
      }
      Store.save(); renderProduktgruppen(); toast("Produktgruppe gespeichert.");
      return true;
    });
  }

  // ---- Feld-Editor (Konfiguratorfragen) ---------------------
  function renderFeldEditor(gruppeKey) {
    var vl = vorlageFuer(gruppeKey);
    var root = $("#page-konfigurator .content");
    if (!vl) { toast("Keine Vorlage vorhanden.", "err"); renderProduktgruppen(); return; }
    var felder = (vl.felder || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    var html = '<div class="card"><div class="btn-row" style="margin-bottom:12px">' +
      '<button class="btn sm ghost" id="btn-fe-zurueck" type="button">← Produktgruppen</button>' +
      '<button class="btn primary sm" id="btn-fe-neu" type="button">+ Feld</button>' +
      '<button class="btn sm" id="btn-fe-vorschau" type="button">👁 Vorschau</button></div>' +
      "<h3>Fragen-Editor: " + esc(gruppeName(gruppeKey)) + ' <span class="sub">Vorlage v' + vl.version + " · " + felder.length + " Felder</span></h3>";
    html += '<div class="table-wrap"><table><thead><tr><th></th><th>Frage</th><th>Feldschlüssel</th><th>Typ</th><th>Pflicht</th><th>Abhängig</th><th class="num">Aktion</th></tr></thead><tbody>';
    felder.forEach(function (f, i) {
      html += "<tr><td>" + (f.typ === "ueberschrift" ? "▸" : f.typ === "hinweis" ? "💬" : "") + "</td>" +
        "<td><strong>" + esc(f.frage) + "</strong></td>" +
        '<td><span class="muted" style="font-size:11px">' + esc(f.key) + "</span></td>" +
        "<td>" + esc((Konfig.FELDTYPEN[f.typ] || {}).label || f.typ) + "</td>" +
        "<td>" + (f.pflicht ? "ja" : "—") + "</td>" +
        "<td>" + (f.abh && f.abh.feld ? esc(f.abh.feld) : "—") + "</td>" +
        '<td class="num" style="white-space:nowrap">' +
          '<button class="btn sm ghost" data-feup="' + i + '" type="button"' + (i === 0 ? " disabled" : "") + ">▲</button> " +
          '<button class="btn sm ghost" data-fedown="' + i + '" type="button"' + (i === felder.length - 1 ? " disabled" : "") + ">▼</button> " +
          '<button class="btn sm ghost" data-feedit="' + esc(f.key) + '" type="button">✏️</button> ' +
          '<button class="btn sm danger" data-fedel="' + esc(f.key) + '" type="button">🗑️</button></td></tr>';
    });
    html += "</tbody></table></div><p class=\"hint\">Änderungen erhöhen die Vorlagen-Version. Bereits gespeicherte Konfigurationen behalten ihren eingefrorenen Stand (Snapshot).</p></div>";
    root.innerHTML = html;
    $("#btn-fe-zurueck").onclick = function () { renderProduktgruppen(); };
    $("#btn-fe-neu").onclick = function () { feldModal(gruppeKey, null); };
    $("#btn-fe-vorschau").onclick = function () { konfigVorschau(gruppeKey); };
    $all("[data-feedit]", root).forEach(function (b) { b.onclick = function () { feldModal(gruppeKey, b.dataset.feedit); }; });
    $all("[data-fedel]", root).forEach(function (b) {
      b.onclick = function () {
        if (confirm("Feld löschen?")) { vl.felder = vl.felder.filter(function (x) { return x.key !== b.dataset.fedel; }); vl.version = (vl.version || 1) + 1; Store.save(); renderFeldEditor(gruppeKey); }
      };
    });
    $all("[data-feup]", root).forEach(function (b) { b.onclick = function () { verschiebeFeld(vl, +b.dataset.feup, -1, gruppeKey); }; });
    $all("[data-fedown]", root).forEach(function (b) { b.onclick = function () { verschiebeFeld(vl, +b.dataset.fedown, 1, gruppeKey); }; });
  }
  function verschiebeFeld(vl, idx, richtung, gruppeKey) {
    var felder = (vl.felder || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    var ziel = idx + richtung;
    if (ziel < 0 || ziel >= felder.length) return;
    var a = felder[idx].sort || 0, b = felder[ziel].sort || 0;
    felder[idx].sort = b; felder[ziel].sort = a;
    vl.version = (vl.version || 1) + 1; Store.save(); renderFeldEditor(gruppeKey);
  }
  function feldModal(gruppeKey, feldKey) {
    var vl = vorlageFuer(gruppeKey);
    var f = feldKey ? (vl.felder || []).filter(function (x) { return x.key === feldKey; })[0] : null;
    var typOpt = Object.keys(Konfig.FELDTYPEN).map(function (t) { return '<option value="' + t + '"' + (f && f.typ === t ? " selected" : "") + ">" + esc(Konfig.FELDTYPEN[t].label) + "</option>"; }).join("");
    var andereFelder = (vl.felder || []).filter(function (x) { return x.key !== feldKey && Konfig.FELDTYPEN[x.typ] && Konfig.FELDTYPEN[x.typ].input; });
    var abhOpt = '<option value="">— keine —</option>' + andereFelder.map(function (x) { return '<option value="' + esc(x.key) + '"' + (f && f.abh && f.abh.feld === x.key ? " selected" : "") + ">" + esc(x.frage) + "</option>"; }).join("");
    var opOpt = ["=", "!=", "wahr", "gesetzt", "in", ">", "<"].map(function (o) { return '<option value="' + o + '"' + (f && f.abh && f.abh.op === o ? " selected" : "") + ">" + o + "</option>"; }).join("");
    var body =
      '<div class="inline">' + fld2("Sichtbare Frage", "fe-frage", f ? f.frage : "", "text") + fld2("Interne Bezeichnung (Schlüssel)", "fe-key", f ? f.key : "", "text") + "</div>" +
      '<label class="fld"><span class="lbl">Feldtyp</span><select id="fe-typ">' + typOpt + "</select></label>" +
      fld2("Hilfetext / Beschreibung", "fe-hilfe", f ? f.hilfe : "", "text") +
      '<div class="inline">' + fld2("Einheit", "fe-einheit", f ? f.einheit : "", "text") + fld2("Standardwert", "fe-standard", f && f.standard != null ? f.standard : "", "text") + "</div>" +
      '<div class="inline">' + fld2("Minimalwert", "fe-min", f && f.min != null ? f.min : "", "text") + fld2("Maximalwert", "fe-max", f && f.max != null ? f.max : "", "text") + "</div>" +
      '<div class="inline">' +
        '<label class="fld"><span class="lbl">Pflichtfeld</span><select id="fe-pflicht"><option value="0">Nein</option><option value="1"' + (f && f.pflicht ? " selected" : "") + ">Ja</option></select></label>" +
        '<label class="fld"><span class="lbl">Anzeige</span><select id="fe-aktiv"><option value="1">aktiv</option><option value="0"' + (f && f.aktiv === false ? " selected" : "") + ">inaktiv</option></select></label>" +
      "</div>" +
      fld2("Auswahloptionen (bei Auswahl, mit Komma getrennt)", "fe-optionen", f && f.optionen ? f.optionen.map(function (o) { return o.wert != null ? o.wert : o; }).join(", ") : "", "text") +
      fld2("Formel (bei berechnetem Feld, z. B. laenge/1000*breite/1000)", "fe-formel", f ? f.formel : "", "text") +
      '<div class="lbl" style="margin:8px 0 4px">Sichtbarkeit (Abhängigkeit)</div>' +
      '<div class="inline">' +
        '<label class="fld"><span class="lbl">Nur anzeigen, wenn Feld</span><select id="fe-abhfeld">' + abhOpt + "</select></label>" +
        '<label class="fld" style="max-width:110px"><span class="lbl">Bedingung</span><select id="fe-abhop">' + opOpt + "</select></label>" +
        fld2("Wert", "fe-abhwert", f && f.abh ? (Array.isArray(f.abh.wert) ? f.abh.wert.join(", ") : f.abh.wert) : "", "text") +
      "</div>";
    openModal(f ? "Feld bearbeiten" : "Feld anlegen", body, function () {
      var frage = $("#fe-frage").value.trim();
      var key = $("#fe-key").value.trim() || frage.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      if (!frage) { toast("Bitte eine Frage angeben.", "err"); return false; }
      if (!key) { toast("Bitte einen Feldschlüssel angeben.", "err"); return false; }
      if ((!f || f.key !== key) && (vl.felder || []).some(function (x) { return x.key === key; })) { toast("Feldschlüssel bereits vergeben.", "err"); return false; }
      var typ = $("#fe-typ").value;
      var neu = f || { sort: ((vl.felder || []).reduce(function (m, x) { return Math.max(m, x.sort || 0); }, 0)) + 10 };
      neu.key = key; neu.typ = typ; neu.frage = frage;
      neu.hilfe = $("#fe-hilfe").value.trim() || undefined;
      neu.einheit = $("#fe-einheit").value.trim() || undefined;
      var std = $("#fe-standard").value.trim(); neu.standard = std === "" ? undefined : (Konfig.FELDTYPEN[typ].numerisch ? leseZahl0(std) : std);
      var mn = $("#fe-min").value.trim(); neu.min = mn === "" ? undefined : leseZahl0(mn);
      var mx = $("#fe-max").value.trim(); neu.max = mx === "" ? undefined : leseZahl0(mx);
      neu.pflicht = $("#fe-pflicht").value === "1";
      neu.aktiv = $("#fe-aktiv").value === "1";
      var optRaw = $("#fe-optionen").value.trim();
      neu.optionen = optRaw ? optRaw.split(",").map(function (s) { return { wert: s.trim() }; }).filter(function (o) { return o.wert; }) : undefined;
      neu.formel = $("#fe-formel").value.trim() || undefined;
      var abhf = $("#fe-abhfeld").value;
      if (abhf) {
        var op = $("#fe-abhop").value, wertRaw = $("#fe-abhwert").value.trim();
        var wert = op === "in" ? wertRaw.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : wertRaw;
        neu.abh = { feld: abhf, op: op, wert: wert };
      } else neu.abh = undefined;
      if (!f) (vl.felder = vl.felder || []).push(neu);
      vl.version = (vl.version || 1) + 1;
      Store.save(); renderFeldEditor(gruppeKey); toast("Feld gespeichert.");
      return true;
    });
    setTimeout(function () { var ts = $("#fe-typ"); if (ts && f) ts.value = f.typ; var ps = $("#fe-pflicht"); if (ps) ps.value = f && f.pflicht ? "1" : "0"; }, 0);
  }
  function konfigVorschau(gruppeKey) {
    var vl = vorlageFuer(gruppeKey);
    if (!vl) { toast("Keine Vorlage.", "err"); return; }
    var temp = {
      id: "vorschau", nummer: "Vorschau", bezeichnung: "Vorschau " + gruppeName(gruppeKey),
      kundeId: "", projektId: "", kommission: "", gruppeKey: gruppeKey, vorlageId: vl.id, vorlageVersion: vl.version,
      vorlageSnapshot: null, antworten: {}, berechnet: {}, status: "Entwurf", verlauf: []
    };
    kfState = { config: temp, vorlage: { id: vl.id, gruppeKey: gruppeKey, version: vl.version, felder: JSON.parse(JSON.stringify(vl.felder)) }, schritt: 2, istBearbeitung: false, vorschau: true };
    renderWizard();
  }

  // ---- Maschinen-Verwaltung -----------------------------------
  function schrittLabel(key) {
    var s = SCHRITTE.filter(function (x) { return x.key === key; })[0];
    return s ? s.label : "—";
  }
  // Rüstkosten je Auftrag = Rüstzeit (h) × Rüstkostensatz (€/h) + fixe Rüstkosten (€)
  function maschineRuest(m) {
    return (parseFloat(m.ruestzeitStd) || 0) * (parseFloat(m.ruestkostensatz) || 0) +
      (parseFloat(m.fixeRuestkosten != null ? m.fixeRuestkosten : m.ruestkosten) || 0);
  }
  function renderMaschinen() {
    var wrap = $("#maschinen-bereich");
    if (!wrap) return;
    var liste = db.settings.maschinen || [];
    var html = '<div class="btn-row" style="margin-bottom:12px"><button class="btn primary sm" id="btn-add-maschine" type="button">+ Maschine anlegen</button></div>';
    if (!liste.length) {
      html += '<div class="empty">Noch keine Maschinen. Lege die Maschinen deiner Firma an.</div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr><th>Maschine</th><th>Arbeitsschritt</th><th class="num">Stundensatz</th><th class="num">Rüstkosten/Auftrag</th><th class="num">Aktion</th></tr></thead><tbody>';
      liste.forEach(function (m) {
        html += "<tr><td><strong>" + esc(m.name) + "</strong></td>" +
          "<td>" + esc(schrittLabel(m.schritt)) + "</td>" +
          '<td class="num">' + fmtEUR(m.stundensatz) + "/h</td>" +
          '<td class="num">' + fmtEUR(maschineRuest(m)) + "</td>" +
          '<td class="num"><button class="btn sm ghost" data-medit="' + m.id + '" type="button">✏️</button> ' +
            '<button class="btn sm danger" data-mdel="' + m.id + '" type="button">🗑️</button></td></tr>';
      });
      html += "</tbody></table></div>";
    }
    wrap.innerHTML = html;
    $("#btn-add-maschine").onclick = function () { maschineModal(null); };
    $all("[data-medit]", wrap).forEach(function (b) { b.onclick = function () { maschineModal(b.dataset.medit); }; });
    $all("[data-mdel]", wrap).forEach(function (b) {
      b.onclick = function () {
        if (confirm("Maschine löschen?")) {
          db.settings.maschinen = db.settings.maschinen.filter(function (m) { return m.id !== b.dataset.mdel; });
          Store.save(); renderMaschinen();
        }
      };
    });
  }

  function maschineModal(id) {
    var liste = db.settings.maschinen || (db.settings.maschinen = []);
    var m = id ? liste.filter(function (x) { return x.id === id; })[0] : null;
    var schrittOpt = '<option value="">— kein Arbeitsschritt —</option>' +
      SCHRITTE.map(function (s) {
        return '<option value="' + s.key + '"' + (m && m.schritt === s.key ? " selected" : "") + ">" + esc(s.label) + "</option>";
      }).join("");
    var rz = m && m.ruestzeitStd != null ? m.ruestzeitStd : 0;
    var rks = m && m.ruestkostensatz != null ? m.ruestkostensatz : ((db.settings.rates && db.settings.rates.fertigung) || 40);
    var fix = m ? (m.fixeRuestkosten != null ? m.fixeRuestkosten : m.ruestkosten) : 0;
    var body =
      fld2("Maschinenname", "ma-name", m ? m.name : "", "text") +
      '<label class="fld"><span class="lbl">Arbeitsschritt (für automatische Zuordnung)</span><select id="ma-schritt">' + schrittOpt + "</select></label>" +
      '<div class="inline">' +
        fld2("Maschinenstundensatz (€/h)", "ma-satz", m ? m.stundensatz : "", "number") +
        fld2("Rüstzeit (h je Auftrag)", "ma-rzeit", rz, "number") +
      "</div>" +
      '<div class="inline">' +
        fld2("Rüstkostensatz (€/h)", "ma-rksatz", rks, "number") +
        fld2("Fixe Rüstkosten (€ je Auftrag)", "ma-rfix", fix, "number") +
      "</div>" +
      '<h4 style="margin:12px 0 4px">Kapazität (für Auslastungsanalyse)</h4>' +
      '<div class="inline">' +
        fld2("Arbeitstage / Jahr", "ma-tage", m && m.arbeitstage != null ? m.arbeitstage : 220, "number") +
        fld2("Stunden / Tag", "ma-stdtag", m && m.stundenProTag != null ? m.stundenProTag : 8, "number") +
        fld2("Wartung/Stillstand (h/Jahr)", "ma-wartung", m && m.wartungStunden != null ? m.wartungStunden : 0, "number") +
      "</div>" +
      '<p class="hint">Rüstkosten je Auftrag = Rüstzeit × Rüstkostensatz + fixe Rüstkosten. Verfügbare Kapazität = Arbeitstage × Stunden/Tag − Wartung.</p>';
    openModal(m ? "Maschine bearbeiten" : "Maschine anlegen", body, function () {
      var name = $("#ma-name").value.trim();
      if (!name) { toast("Bitte Maschinennamen angeben.", "err"); return false; }
      var daten = {
        name: name, schritt: $("#ma-schritt").value,
        stundensatz: leseZahl0($("#ma-satz").value),
        ruestzeitStd: leseZahl0($("#ma-rzeit").value),
        ruestkostensatz: leseZahl0($("#ma-rksatz").value),
        fixeRuestkosten: leseZahl0($("#ma-rfix").value),
        arbeitstage: leseZahl0($("#ma-tage").value) || 220,
        stundenProTag: leseZahl0($("#ma-stdtag").value) || 8,
        wartungStunden: leseZahl0($("#ma-wartung").value)
      };
      if (m) { m.name = daten.name; m.schritt = daten.schritt; m.stundensatz = daten.stundensatz; m.ruestzeitStd = daten.ruestzeitStd; m.ruestkostensatz = daten.ruestkostensatz; m.fixeRuestkosten = daten.fixeRuestkosten; m.arbeitstage = daten.arbeitstage; m.stundenProTag = daten.stundenProTag; m.wartungStunden = daten.wartungStunden; delete m.ruestkosten; }
      else { daten.id = Store.uid(); liste.push(daten); }
      Store.save(); renderMaschinen(); toast("Maschine gespeichert.");
      return true;
    });
  }

  // ---- Mitarbeiter-Verwaltung ---------------------------------
  var GRUPPEN = [["cad", "Planung / CAD"], ["fertigung", "Fertigung"], ["montage", "Montage"], ["projektleitung", "Projektleitung"]];
  function gruppeLabel(g) { var x = GRUPPEN.filter(function (p) { return p[0] === g; })[0]; return x ? x[1] : (g || "—"); }
  function renderMitarbeiter() {
    var wrap = $("#mitarbeiter-bereich"); if (!wrap) return;
    var liste = db.mitarbeiter || (db.mitarbeiter = []);
    var html = '<div class="btn-row" style="margin-bottom:12px"><button class="btn primary sm" id="btn-add-ma" type="button">+ Mitarbeiter anlegen</button></div>';
    if (!liste.length) { html += '<div class="empty">Noch keine Mitarbeiter angelegt.</div>'; }
    else {
      html += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Gruppe</th><th class="num">Stundensatz</th><th>Status</th><th class="num">Aktion</th></tr></thead><tbody>';
      liste.forEach(function (m) {
        html += "<tr><td><strong>" + esc(m.name) + "</strong></td>" +
          "<td>" + esc(gruppeLabel(m.gruppe)) + "</td>" +
          '<td class="num">' + fmtEUR(m.stundensatz) + "/h</td>" +
          "<td>" + (m.aktiv === false ? '<span class="muted">inaktiv</span>' : "aktiv") + "</td>" +
          '<td class="num"><button class="btn sm ghost" data-maedit="' + m.id + '" type="button">✏️</button> ' +
            '<button class="btn sm danger" data-madel="' + m.id + '" type="button">🗑️</button></td></tr>';
      });
      html += "</tbody></table></div>";
    }
    wrap.innerHTML = html;
    $("#btn-add-ma").onclick = function () { mitarbeiterModal(null); };
    $all("[data-maedit]", wrap).forEach(function (b) { b.onclick = function () { mitarbeiterModal(b.dataset.maedit); }; });
    $all("[data-madel]", wrap).forEach(function (b) {
      b.onclick = function () {
        if (confirm("Mitarbeiter löschen?")) { db.mitarbeiter = db.mitarbeiter.filter(function (m) { return m.id !== b.dataset.madel; }); Store.save(); renderMitarbeiter(); }
      };
    });
  }
  function mitarbeiterModal(id) {
    var liste = db.mitarbeiter || (db.mitarbeiter = []);
    var m = id ? liste.filter(function (x) { return x.id === id; })[0] : null;
    var grpOpt = GRUPPEN.map(function (g) { return '<option value="' + g[0] + '"' + (m && m.gruppe === g[0] ? " selected" : "") + ">" + esc(g[1]) + "</option>"; }).join("");
    var body =
      fld2("Name", "ma-mname", m ? m.name : "", "text") +
      '<label class="fld"><span class="lbl">Gruppe (bestimmt den Vorgabe-Stundensatz)</span><select id="ma-grp">' + grpOpt + "</select></label>" +
      '<div class="inline">' +
        fld2("Stundenverrechnungssatz (€/h)", "ma-msatz", m ? m.stundensatz : "", "number") +
        '<label class="fld"><span class="lbl">Status</span><select id="ma-aktiv"><option value="1"' + (!m || m.aktiv !== false ? " selected" : "") + ">aktiv</option><option value=\"0\"" + (m && m.aktiv === false ? " selected" : "") + ">inaktiv</option></select></label>" +
      "</div>";
    openModal(m ? "Mitarbeiter bearbeiten" : "Mitarbeiter anlegen", body, function () {
      var name = $("#ma-mname").value.trim();
      if (!name) { toast("Bitte Namen angeben.", "err"); return false; }
      var daten = { name: name, gruppe: $("#ma-grp").value, stundensatz: leseZahl0($("#ma-msatz").value), aktiv: $("#ma-aktiv").value === "1" };
      if (m) { Object.keys(daten).forEach(function (k) { m[k] = daten[k]; }); }
      else { daten.id = Store.uid(); liste.push(daten); }
      Store.save(); renderMitarbeiter(); toast("Mitarbeiter gespeichert.");
      return true;
    });
  }

  // ---- Lieferanten-Verwaltung ---------------------------------
  function renderLieferanten() {
    var wrap = $("#lieferanten-bereich"); if (!wrap) return;
    var liste = db.lieferanten || (db.lieferanten = []);
    var html = '<div class="btn-row" style="margin-bottom:12px"><button class="btn primary sm" id="btn-add-lief" type="button">+ Lieferant anlegen</button></div>';
    if (!liste.length) { html += '<div class="empty">Noch keine Lieferanten angelegt.</div>'; }
    else {
      html += '<div class="table-wrap"><table><thead><tr><th>Lieferant</th><th>Ansprechpartner</th><th>Kontakt</th><th class="num">Aktion</th></tr></thead><tbody>';
      liste.forEach(function (l) {
        html += "<tr><td><strong>" + esc(l.name) + "</strong>" + (l.kundennummer ? ' <span class="tag muted">Kd. ' + esc(l.kundennummer) + "</span>" : "") +
          (l.notiz ? '<br><span class="muted" style="font-size:11px">' + esc(l.notiz) + "</span>" : "") + "</td>" +
          "<td>" + esc(l.ansprechpartner || "—") + "</td>" +
          "<td>" + [l.tel, l.email].filter(Boolean).map(esc).join("<br>") + (l.tel || l.email ? "" : "—") + "</td>" +
          '<td class="num"><button class="btn sm ghost" data-ledit="' + l.id + '" type="button">✏️</button> ' +
            '<button class="btn sm danger" data-ldel="' + l.id + '" type="button">🗑️</button></td></tr>';
      });
      html += "</tbody></table></div>";
    }
    wrap.innerHTML = html;
    $("#btn-add-lief").onclick = function () { lieferantModal(null); };
    $all("[data-ledit]", wrap).forEach(function (b) { b.onclick = function () { lieferantModal(b.dataset.ledit); }; });
    $all("[data-ldel]", wrap).forEach(function (b) {
      b.onclick = function () {
        if (confirm("Lieferant löschen?")) { db.lieferanten = db.lieferanten.filter(function (l) { return l.id !== b.dataset.ldel; }); Store.save(); renderLieferanten(); }
      };
    });
  }
  function lieferantModal(id) {
    var liste = db.lieferanten || (db.lieferanten = []);
    var l = id ? liste.filter(function (x) { return x.id === id; })[0] : null;
    var body =
      '<div class="inline">' + fld2("Name", "l-name", l ? l.name : "", "text") + fld2("Kundennummer (bei uns)", "l-kdnr", l ? l.kundennummer : "", "text") + "</div>" +
      fld2("Ansprechpartner", "l-ap", l ? l.ansprechpartner : "", "text") +
      '<div class="inline">' + fld2("Telefon", "l-tel", l ? l.tel : "", "text") + fld2("E-Mail", "l-email", l ? l.email : "", "text") + "</div>" +
      '<div class="inline">' + fld2("Web", "l-web", l ? l.web : "", "text") + fld2("Notiz", "l-notiz", l ? l.notiz : "", "text") + "</div>";
    openModal(l ? "Lieferant bearbeiten" : "Lieferant anlegen", body, function () {
      var name = $("#l-name").value.trim();
      if (!name) { toast("Bitte Namen angeben.", "err"); return false; }
      var daten = { name: name, kundennummer: $("#l-kdnr").value.trim(), ansprechpartner: $("#l-ap").value.trim(), tel: $("#l-tel").value.trim(), email: $("#l-email").value.trim(), web: $("#l-web").value.trim(), notiz: $("#l-notiz").value.trim() };
      if (l) { Object.keys(daten).forEach(function (k) { l[k] = daten[k]; }); }
      else { daten.id = Store.uid(); liste.push(daten); }
      Store.save(); renderLieferanten(); toast("Lieferant gespeichert.");
      return true;
    });
  }

  // ---- Benutzer-Verwaltung (nur Admin) ------------------------
  function renderBenutzer() {
    var wrap = $("#benutzer-bereich"); if (!wrap) return;
    var liste = (db.users || []);
    var html = '<div class="btn-row" style="margin-bottom:12px"><button class="btn primary sm" id="btn-add-user" type="button">+ Benutzer anlegen</button></div>';
    html += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Benutzer</th><th>Rolle</th><th>Status</th><th class="num">Aktion</th></tr></thead><tbody>';
    liste.forEach(function (u) {
      var istIch = Auth.current() && u.id === Auth.current().id;
      html += "<tr><td><strong>" + esc(u.name) + "</strong>" + (istIch ? ' <span class="tag">Sie</span>' : "") + "</td>" +
        "<td>" + esc(u.benutzername) + "</td>" +
        "<td>" + esc(Auth.rolleLabel(u.rolle)) + "</td>" +
        "<td>" + (u.aktiv === false ? '<span class="muted">inaktiv</span>' : "aktiv") + "</td>" +
        '<td class="num"><button class="btn sm ghost" data-uedit="' + u.id + '" type="button">✏️</button> ' +
          '<button class="btn sm danger" data-udel="' + u.id + '" type="button">🗑️</button></td></tr>';
    });
    html += "</tbody></table></div><p class=\"hint\">Rollen: Administrator (alles), Büro/Kalkulation (ohne Benutzerverwaltung), Werkstatt/Montage (Dashboard &amp; Aufträge).</p>";
    wrap.innerHTML = html;
    $("#btn-add-user").onclick = function () { benutzerModal(null); };
    $all("[data-uedit]", wrap).forEach(function (b) { b.onclick = function () { benutzerModal(b.dataset.uedit); }; });
    $all("[data-udel]", wrap).forEach(function (b) {
      b.onclick = function () {
        if (confirm("Benutzer löschen?")) {
          if (!Auth.loescheUser(b.dataset.udel)) { toast("Der letzte Administrator kann nicht gelöscht werden.", "err"); return; }
          renderBenutzer();
        }
      };
    });
  }
  function benutzerModal(id) {
    var u = id ? (db.users || []).filter(function (x) { return x.id === id; })[0] : null;
    var rollen = Object.keys(Auth.ROLLEN);
    var rolleOpt = rollen.map(function (r) { return '<option value="' + r + '"' + (u && u.rolle === r ? " selected" : (!u && r === "buero" ? " selected" : "")) + ">" + esc(Auth.ROLLEN[r]) + "</option>"; }).join("");
    var body =
      '<div class="inline">' + fld2("Name", "u-name", u ? u.name : "", "text") + fld2("Benutzername", "u-benutzer", u ? u.benutzername : "", "text") + "</div>" +
      '<div class="inline">' +
        '<label class="fld"><span class="lbl">Rolle</span><select id="u-rolle">' + rolleOpt + "</select></label>" +
        '<label class="fld"><span class="lbl">Status</span><select id="u-aktiv"><option value="1"' + (!u || u.aktiv !== false ? " selected" : "") + ">aktiv</option><option value=\"0\"" + (u && u.aktiv === false ? " selected" : "") + ">inaktiv</option></select></label>" +
      "</div>" +
      fld2(u ? "Neuer PIN (leer = unverändert)" : "PIN (Standard 1234)", "u-pin", "", "text") +
      '<p class="hint">Der PIN wird gesalzen gehasht gespeichert – niemals im Klartext.</p>';
    openModal(u ? "Benutzer bearbeiten" : "Benutzer anlegen", body, function () {
      var name = $("#u-name").value.trim(), benutzer = $("#u-benutzer").value.trim().toLowerCase();
      if (!name || !benutzer) { toast("Bitte Name und Benutzername angeben.", "err"); return false; }
      var vorhanden = Auth.findByName(benutzer);
      if (vorhanden && (!u || vorhanden.id !== u.id)) { toast("Benutzername bereits vergeben.", "err"); return false; }
      var pin = $("#u-pin").value.trim();
      if (!u && !pin) pin = "1234";
      Auth.speichereUser({ id: u ? u.id : null, name: name, benutzername: benutzer, rolle: $("#u-rolle").value, aktiv: $("#u-aktiv").value === "1" }, pin || null);
      renderBenutzer(); aktualisiereUserBox(); toast("Benutzer gespeichert.");
      return true;
    });
  }

  // Zahlfeld: Text + inputmode=decimal, damit das deutsche Komma erhalten
  // bleibt (type=number verwirft "12,5" je nach Gerät zu "12" oder "").
  function fld(label, id, val, suffix) {
    var inner = '<input type="text" inputmode="decimal" id="' + id + '" value="' + esc(val) + '">';
    if (suffix) inner = '<div class="suffix-grp">' + inner + '<span class="suffix">' + suffix + "</span></div>";
    return '<label class="fld"><span class="lbl">' + esc(label) + "</span>" + inner + "</label>";
  }
  function numv(sel) { var e = $(sel); return e ? leseZahl0(e.value) : 0; }

  // ============================================================
  //  MATERIAL
  // ============================================================
  // Filterzustand der Materialdatenbank
  var materialFilter = { suche: "", kategorie: "", typ: "" };
  // Hauptkategorien in der Reihenfolge von thesteel.com (Frankstahl-Shop);
  // Unbekanntes/„Sonstiges" landet am Ende.
  var KAT_ORDER = ["Stahlträger", "Voll-/Stabmaterial", "Bleche", "Formrohre & Profile", "Rundrohre"];
  function matKat(m) { return (m.kategorie && String(m.kategorie).trim()) || "Sonstiges"; }
  function matUnterkat(m) { return (m.unterkategorie && String(m.unterkategorie).trim()) || "—"; }

  function renderMaterial() {
    var root = $("#page-material .content");
    // vorhandene Kategorien & Werkstoffe für die Filter-Dropdowns
    var katSet = {}, typSet = {};
    db.material.forEach(function (m) { katSet[matKat(m)] = true; if (m.typ) typSet[m.typ] = true; });
    var kats = Object.keys(katSet).sort(katSort);
    var typen = Object.keys(typSet).sort();
    function opt(val, label, sel) { return '<option value="' + esc(val) + '"' + (sel === val ? " selected" : "") + ">" + esc(label) + "</option>"; }

    var html = '<div class="card"><h3>Materialdatenbank <span class="sub">' + db.material.length + ' Artikel</span></h3>';
    html += '<div class="btn-row" style="margin-bottom:12px"><button class="btn primary sm" id="btn-add-material">+ Material anlegen</button> <button class="btn sm" id="btn-import-datanorm">📥 DATANORM / Preisliste importieren</button> <button class="btn sm" id="btn-sortiment">📦 Standard-Sortiment laden</button></div>';
    html += '<div class="inline" style="margin-bottom:8px">' +
      '<input id="mat-suche" placeholder="🔍 Suche: Bezeichnung, Nr., Lieferant" value="' + esc(materialFilter.suche) + '" style="flex:2">' +
      '<select id="mat-kat" style="flex:1;min-width:130px"><option value="">Alle Kategorien</option>' +
        kats.map(function (k) { return opt(k, k, materialFilter.kategorie); }).join("") + "</select>" +
      '<select id="mat-typ" style="flex:1;min-width:120px"><option value="">Alle Werkstoffe</option>' +
        typen.map(function (t) { return opt(t, t, materialFilter.typ); }).join("") + "</select>" +
      "</div>";
    html += '<div id="mat-liste"></div></div>';
    root.innerHTML = html;

    $("#btn-add-material").onclick = function () { materialModal(null); };
    var bImp = $("#btn-import-datanorm"); if (bImp) bImp.onclick = datanormImportModal;
    var bSort = $("#btn-sortiment"); if (bSort) bSort.onclick = ladeSortiment;
    $("#mat-suche").addEventListener("input", function () { materialFilter.suche = this.value; renderMaterialListe(); });
    $("#mat-kat").addEventListener("change", function () { materialFilter.kategorie = this.value; renderMaterialListe(); });
    $("#mat-typ").addEventListener("change", function () { materialFilter.typ = this.value; renderMaterialListe(); });
    renderMaterialListe();
  }

  function katSort(a, b) {
    var ia = KAT_ORDER.indexOf(a), ib = KAT_ORDER.indexOf(b);
    if (ia < 0) ia = 99; if (ib < 0) ib = 99;
    return ia !== ib ? ia - ib : a.localeCompare(b, "de");
  }

  function renderMaterialListe() {
    var ziel = $("#mat-liste"); if (!ziel) return;
    var suche = (materialFilter.suche || "").toLowerCase().trim();
    var gefiltert = db.material.filter(function (m) {
      if (materialFilter.kategorie && matKat(m) !== materialFilter.kategorie) return false;
      if (materialFilter.typ && (m.typ || "") !== materialFilter.typ) return false;
      if (!suche) return true;
      var hay = [m.name, m.artikelnummer, m.lieferant, m.unterkategorie].filter(Boolean).join(" ").toLowerCase();
      return hay.indexOf(suche) >= 0;
    });
    if (!gefiltert.length) {
      ziel.innerHTML = '<div class="empty">Keine Treffer. Filter ändern oder Material anlegen / Sortiment laden.</div>';
      return;
    }
    // nach Hauptkategorie -> Unterkategorie gruppieren
    var gruppen = {};
    gefiltert.forEach(function (m) {
      var k = matKat(m), u = matUnterkat(m);
      (gruppen[k] = gruppen[k] || {})[u] = (gruppen[k][u] || []);
      gruppen[k][u].push(m);
    });
    var html = "";
    Object.keys(gruppen).sort(katSort).forEach(function (k) {
      var unter = gruppen[k];
      var anzahl = Object.keys(unter).reduce(function (s, u) { return s + unter[u].length; }, 0);
      html += '<details class="mat-gruppe" open><summary style="cursor:pointer;font-weight:700;padding:8px 4px;font-size:15px">' +
        esc(k) + ' <span class="muted" style="font-weight:400">(' + anzahl + ")</span></summary>";
      Object.keys(unter).sort(function (a, b) { return a.localeCompare(b, "de"); }).forEach(function (u) {
        if (u !== "—") html += '<div class="muted" style="font-size:12px;font-weight:600;margin:8px 0 2px 4px">' + esc(u) + "</div>";
        html += '<div class="table-wrap"><table><tbody>';
        unter[u].sort(function (a, b) { return (a.name || "").localeCompare(b.name || "", "de", { numeric: true }); }).forEach(function (m) {
          html += "<tr>" +
            "<td>" + esc(m.name) +
              (m.artikelnummer ? ' <span class="tag muted">Nr. ' + esc(m.artikelnummer) + "</span>" : "") +
              (m.historie && m.historie.length > 1 ? ' <span class="tag">' + m.historie.length + " Preise</span>" : "") +
              '<br><span class="muted" style="font-size:11px">' + esc(m.typ || "-") + " · " + esc(m.lieferant || "—") +
              (m.lager != null && m.lager !== "" ? " · Lager " + esc(m.lager) + " " + esc(m.einheit) : "") + "</span></td>" +
            '<td class="num" style="white-space:nowrap">' + fmtEUR(m.preis) + " /" + esc(m.einheit) + "</td>" +
            '<td class="num" style="white-space:nowrap"><button class="btn sm ghost" data-edit="' + m.id + '">✏️</button> ' +
              '<button class="btn sm danger" data-del="' + m.id + '">🗑️</button></td></tr>';
        });
        html += "</tbody></table></div>";
      });
      html += "</details>";
    });
    ziel.innerHTML = html;

    $all("[data-edit]", ziel).forEach(function (b) { b.onclick = function () { materialModal(b.dataset.edit); }; });
    $all("[data-del]", ziel).forEach(function (b) {
      b.onclick = function () {
        if (confirm("Material löschen?")) {
          db.material = db.material.filter(function (m) { return m.id !== b.dataset.del; });
          Store.save(); renderMaterial();
        }
      };
    });
  }

  function materialModal(id) {
    var m = id ? db.material.find(function (x) { return x.id === id; }) : null;
    // Vorschläge für Kategorie/Unterkategorie aus vorhandenen Daten + Sortiment
    var katVor = {}, unterVor = {};
    db.material.forEach(function (x) { if (x.kategorie) katVor[x.kategorie] = true; if (x.unterkategorie) unterVor[x.unterkategorie] = true; });
    (w.Preisschmiede && w.Preisschmiede.Sortiment || []).forEach(function (x) { katVor[x.kategorie] = true; unterVor[x.unterkategorie] = true; });
    function datalist(id, obj) { return '<datalist id="' + id + '">' + Object.keys(obj).sort().map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("") + "</datalist>"; }
    function fldList(label, fid, val, listId) {
      return '<label class="fld"><span class="lbl">' + esc(label) + '</span><input type="text" id="' + fid + '" list="' + listId + '" value="' + esc(val == null ? "" : val) + '"></label>';
    }

    var body =
      fld2("Bezeichnung", "m-name", m ? m.name : "", "text") +
      '<div class="inline">' +
        fldList("Kategorie", "m-kategorie", m ? m.kategorie : "", "dl-kat") +
        fldList("Unterkategorie", "m-unterkategorie", m ? m.unterkategorie : "", "dl-unter") +
      "</div>" +
      datalist("dl-kat", katVor) + datalist("dl-unter", unterVor) +
      '<div class="inline">' +
        fld2("Werkstoff (Typ)", "m-typ", m ? m.typ : "Stahl", "text") +
        fld2("Einheit", "m-einheit", m ? m.einheit : "m", "text") +
      "</div>" +
      '<div class="inline">' +
        fld2("Preis (netto)", "m-preis", m ? m.preis : "", "number") +
        fld2("Lieferant", "m-lieferant", m ? m.lieferant : "", "text") +
      "</div>" +
      '<div class="inline">' +
        fld2("Gewicht (kg je Einheit)", "m-kg", m && m.kgProEinheit != null ? m.kgProEinheit : "", "number") +
        fld2("Preis pro kg (optional)", "m-preisProKg", m && m.preisProKg != null ? m.preisProKg : "", "number") +
      "</div>" +
      '<p class="hint">Sind Gewicht und „Preis pro kg" gesetzt, wird der Materialpreis daraus berechnet (genauer bei schwankenden Stahlpreisen). Sonst gilt der Preis je Einheit.</p>' +
      '<div class="inline">' +
        fld2("Lagerbestand (optional)", "m-lager", m && m.lager != null ? m.lager : "", "number") +
        '<div style="flex:1"></div>' +
      "</div>";
    if (m && m.historie && m.historie.length) {
      body += '<hr class="sep"><div class="muted" style="font-size:12px;margin-bottom:6px">Preishistorie</div>';
      body += '<div class="table-wrap"><table><tbody>';
      m.historie.slice().reverse().forEach(function (h) {
        body += "<tr><td>" + fmtDate(h.datum) + '</td><td class="num">' + fmtEUR(h.preis) + "</td></tr>";
      });
      body += "</tbody></table></div>";
    }
    openModal(m ? "Material bearbeiten" : "Material anlegen", body, function () {
      var name = $("#m-name").value.trim();
      if (!name) { toast("Bitte Bezeichnung angeben.", "err"); return false; }
      var preis = leseZahl0($("#m-preis").value);
      var lagerRaw = $("#m-lager").value.trim();
      var lager = lagerRaw === "" ? null : leseZahl0(lagerRaw);
      var kgRaw = $("#m-kg").value.trim();
      var kg = kgRaw === "" ? null : leseZahl0(kgRaw);
      var ppkRaw = $("#m-preisProKg").value.trim();
      var ppk = ppkRaw === "" ? null : leseZahl0(ppkRaw);
      // "Preis pro kg" wirkt nur zusammen mit dem Gewicht – sonst still ignoriert
      if (ppk != null && ppk > 0 && !(kg != null && kg > 0)) {
        toast('„Preis pro kg" wirkt nur mit Gewicht (kg je Einheit). Bitte Gewicht eintragen.', "err");
        return false;
      }
      var kategorie = $("#m-kategorie").value.trim();
      var unterkategorie = $("#m-unterkategorie").value.trim();
      if (m) {
        if (preis !== m.preis) (m.historie = m.historie || []).push({ datum: Store.nowISO(), preis: preis });
        m.name = name; m.typ = $("#m-typ").value.trim(); m.einheit = $("#m-einheit").value.trim() || "Stk";
        m.kategorie = kategorie; m.unterkategorie = unterkategorie;
        m.preis = preis; m.lieferant = $("#m-lieferant").value.trim(); m.lager = lager;
        m.kgProEinheit = kg; m.preisProKg = ppk; m.aktualisiert = Store.nowISO();
      } else {
        db.material.push({
          id: Store.uid(), name: name, typ: $("#m-typ").value.trim(),
          kategorie: kategorie, unterkategorie: unterkategorie,
          einheit: $("#m-einheit").value.trim() || "Stk", preis: preis,
          lieferant: $("#m-lieferant").value.trim(), kgProEinheit: kg, preisProKg: ppk, lager: lager,
          aktualisiert: Store.nowISO(), historie: [{ datum: Store.nowISO(), preis: preis }]
        });
      }
      Store.save(); renderMaterial(); toast("Material gespeichert.");
      return true;
    });
  }

  function fld2(label, id, val, typ) {
    // "number" wird bewusst als Text+inputmode=decimal gerendert (Komma-Schutz).
    var attrs = (typ === "number") ? 'type="text" inputmode="decimal"' : 'type="' + (typ || "text") + '"';
    return '<label class="fld"><span class="lbl">' + esc(label) + "</span><input " + attrs +
      ' id="' + id + '" value="' + esc(val == null ? "" : val) + '"></label>';
  }

  // Eine Eingabezeile für eine externe Kostenposition (Zukauf/Fremdleistung).
  // Betrag als Text-Feld mit inputmode="decimal", damit das Komma (z. B.
  // "35,50") zuverlässig erhalten bleibt – type=number verwirft es je nach Gerät.
  function fremdZeile(bez, betrag) {
    return '<div class="inline fremd-row" style="gap:8px;margin-bottom:6px">' +
      '<input type="text" class="f-bez" placeholder="z. B. Pulverbeschichten RAL 7016 / Edelstahlschrauben" value="' + esc(bez || "") + '" style="flex:2">' +
      '<input type="text" inputmode="decimal" class="f-betrag" placeholder="€" value="' + esc(betrag != null ? betrag : "") + '" style="flex:1;min-width:90px;text-align:right">' +
      '<button class="btn sm danger f-del" type="button" title="Entfernen">✕</button>' +
      "</div>";
  }

  // Zahl aus Texteingabe robust lesen – mit deutschem Komma UND Tausenderpunkt:
  // "35,50" -> 35.5 · "1.250,00" -> 1250 · "1.250" -> 1250 · "58.50" -> 58.5
  function leseZahl(s) {
    var t = String(s == null ? "" : s).trim().replace(/\s/g, "");
    if (!t) return NaN;
    if (t.indexOf(",") >= 0) {
      // Komma ist Dezimaltrenner; Punkte sind Tausendertrenner
      t = t.replace(/\./g, "");
      var i = t.lastIndexOf(",");
      t = t.slice(0, i).replace(/,/g, "") + "." + t.slice(i + 1);
    } else if ((t.match(/\./g) || []).length > 1) {
      // mehrere Punkte ohne Komma -> Tausendertrenner
      t = t.replace(/\./g, "");
    } else if (/^-?\d{1,3}\.\d{3}$/.test(t)) {
      // ein Punkt + genau 3 Nachstellen (z. B. "1.250") -> Tausendertrenner
      t = t.replace(".", "");
    }
    var v = parseFloat(t);
    return isFinite(v) ? v : NaN;
  }
  // Wie leseZahl, aber mit 0 als Fallback (für Pflicht-Zahlfelder).
  function leseZahl0(s) { var v = leseZahl(s); return isFinite(v) ? v : 0; }

  // ---- DATANORM-/Preislisten-Import (PC & Handy, komplett offline) ----
  function datanormImportModal() {
    if (!Datanorm) { toast("Import-Modul nicht geladen.", "err"); return; }
    var geparst = null; // Ergebnis des letzten Einlesens
    var body =
      '<p class="hint">Datei vom Stahlhändler (DATANORM 4.0, z. B. von Frankstahl / thesteel.com) wählen. ' +
      'Artikel werden über die <strong>Artikelnummer</strong> abgeglichen: vorhandene Preise werden aktualisiert ' +
      '(Preishistorie bleibt erhalten), neue Artikel werden angelegt. Alles geschieht lokal auf dem Gerät.</p>' +
      '<label class="fld"><span class="lbl">DATANORM-Datei</span>' +
        '<input type="file" id="dn-file" accept=".001,.002,.003,.004,.005,.dat,.dn,.txt,.csv,.print,text/plain"></label>' +
      '<div class="inline">' +
        '<label class="fld"><span class="lbl">Preis-Nachkommastellen</span><select id="dn-nk">' +
          '<option value="2">2 (Standard / Cent)</option><option value="4">4</option>' +
          '<option value="3">3</option><option value="0">0 (ganze €)</option></select></label>' +
        '<label class="fld"><span class="lbl">Zeichensatz</span><select id="dn-enc">' +
          '<option value="ISO-8859-1">Westeuropäisch (Standard)</option><option value="UTF-8">UTF-8</option>' +
        "</select></label>" +
      "</div>" +
      fld2("Lieferant", "dn-lieferant", "Frankstahl", "text") +
      '<div class="btn-row" style="margin:10px 0"><button class="btn sm" id="dn-read" type="button">📄 Datei einlesen & Vorschau</button></div>' +
      '<div id="dn-vorschau"></div>';

    openModal("Material-Datei importieren (DATANORM)", body, function () {
      if (!geparst || !geparst.artikel.length) { toast("Bitte zuerst eine Datei einlesen.", "err"); return false; }
      var lief = ($("#dn-lieferant").value || "").trim() || "Frankstahl";
      var res = mergeDatanorm(geparst.artikel, lief);
      renderMaterial();
      toast(res.neu + " neu, " + res.akt + " aktualisiert" + (res.unv ? ", " + res.unv + " unverändert" : "") + ".", "ok");
      return true;
    }, "Übernehmen");

    var btn = $("#dn-read");
    if (btn) btn.onclick = function () {
      var inp = $("#dn-file");
      if (!inp || !inp.files || !inp.files[0]) { toast("Bitte eine Datei wählen.", "err"); return; }
      var nk = parseInt($("#dn-nk").value, 10); if (!(nk >= 0)) nk = 2;
      var enc = $("#dn-enc").value || "ISO-8859-1";
      var rd = new FileReader();
      rd.onload = function () {
        try {
          geparst = Datanorm.parse(String(rd.result || ""), { nachkomma: nk });
          zeigeDatanormVorschau(geparst);
        } catch (e) { console.error(e); toast("Datei konnte nicht gelesen werden.", "err"); }
      };
      rd.onerror = function () { toast("Datei konnte nicht gelesen werden.", "err"); };
      try { rd.readAsText(inp.files[0], enc); } catch (e) { rd.readAsText(inp.files[0]); }
    };
  }

  // Metallbau-Grundsortiment (gängige Profile/Bleche) als Startbasis laden.
  function ladeSortiment() {
    var liste = w.Preisschmiede && w.Preisschmiede.Sortiment;
    if (!liste || !liste.length) { toast("Standard-Sortiment nicht verfügbar.", "err"); return; }
    var vorhanden = {};
    db.material.forEach(function (m) { vorhanden[(m.name || "").toLowerCase().trim()] = true; });
    var neu = liste.filter(function (a) { return !vorhanden[(a.name || "").toLowerCase().trim()]; });
    if (!neu.length) { toast("Alle Artikel des Standard-Sortiments sind bereits vorhanden.", "ok"); return; }
    if (!confirm(neu.length + " Artikel aus dem Metallbau-Grundsortiment hinzufügen?\n\nGewichte sind exakt berechnet, die Preise sind €/kg-RICHTWERTE – bitte mit deinen Konditionen bzw. per DATANORM-Import aktualisieren.")) return;
    var jetzt = Store.nowISO();
    neu.forEach(function (a) {
      db.material.push({
        id: Store.uid(), name: a.name, typ: a.typ, einheit: a.einheit,
        kategorie: a.kategorie || "", unterkategorie: a.unterkategorie || "",
        preis: a.preis, lieferant: "Frankstahl",
        kgProEinheit: a.kgProEinheit != null ? a.kgProEinheit : null,
        preisProKg: a.preisProKg != null ? a.preisProKg : null,
        lager: null, aktualisiert: jetzt,
        historie: [{ datum: jetzt, preis: a.preis }]
      });
    });
    Store.save(); renderMaterial();
    toast(neu.length + " Artikel hinzugefügt. Preise sind Richtwerte – bitte prüfen. ✅", "ok");
  }

  function zeigeDatanormVorschau(g) {
    var v = $("#dn-vorschau"); if (!v) return;
    var n = g.artikel.length;
    if (!n) {
      v.innerHTML = '<p class="hint" style="color:#c0392b">Keine Artikel erkannt. Stimmt das Format/der Zeichensatz? ' +
        "DATANORM-Sätze müssen mit A/B/P beginnen und per Semikolon getrennt sein.</p>";
      return;
    }
    var mitKg = g.artikel.filter(function (a) { return a.kg != null; }).length;
    var rows = g.artikel.slice(0, 12).map(function (a) {
      return "<tr><td>" + esc(a.artikelnummer) + "</td><td>" + esc(a.name) + '</td><td class="num">' + fmtEUR(a.preis) +
        "</td><td>/" + esc(a.einheit) + '</td><td class="num">' + (a.kg != null ? esc(a.kg) : "—") + "</td></tr>";
    }).join("");
    v.innerHTML =
      '<div class="hint" style="margin:6px 0">Erkannt: <strong>' + n + "</strong> Artikel (" + mitKg + " mit Gewicht). " +
        "Vorschau der ersten " + Math.min(12, n) + ":</div>" +
      '<div class="table-wrap"><table><thead><tr><th>Art.-Nr.</th><th>Bezeichnung</th><th class="num">Preis</th><th>Einh.</th><th class="num">kg</th></tr></thead><tbody>' +
        rows + "</tbody></table></div>" +
      '<p class="hint">Stimmen die Preise? Liegen sie um Faktor 10/100 daneben, „Preis-Nachkommastellen" anpassen und erneut einlesen. ' +
      'Sind Umlaute zerstückelt, den Zeichensatz wechseln. Mit „Übernehmen" werden die Daten gespeichert.</p>';
  }

  function mergeDatanorm(liste, lieferant) {
    var neu = 0, akt = 0, unv = 0;
    liste.forEach(function (a) {
      if (!a.artikelnummer) return;
      var preis = Math.round((a.preis || 0) * 100) / 100;
      var m = db.material.find(function (x) { return x.artikelnummer && x.artikelnummer === a.artikelnummer; });
      if (m) {
        var changed = false;
        if (preis > 0 && preis !== m.preis) { (m.historie = m.historie || []).push({ datum: Store.nowISO(), preis: preis }); m.preis = preis; changed = true; }
        if (a.name && a.name !== m.name) { m.name = a.name; changed = true; }
        if (a.einheit && a.einheit !== m.einheit) { m.einheit = a.einheit; changed = true; }
        if (a.kg != null && a.kg !== m.kgProEinheit) { m.kgProEinheit = a.kg; changed = true; }
        if (changed) { m.lieferant = lieferant || m.lieferant; m.aktualisiert = Store.nowISO(); akt++; } else { unv++; }
      } else {
        db.material.push({
          id: Store.uid(), artikelnummer: a.artikelnummer, name: a.name,
          typ: "", kategorie: a.warengruppe || "Import (DATANORM)", unterkategorie: a.warengruppe || "",
          einheit: a.einheit || "Stk", preis: preis,
          lieferant: lieferant || "Frankstahl", kgProEinheit: a.kg != null ? a.kg : null,
          preisProKg: null, lager: null, aktualisiert: Store.nowISO(),
          historie: [{ datum: Store.nowISO(), preis: preis }]
        });
        neu++;
      }
    });
    Store.save();
    return { neu: neu, akt: akt, unv: unv };
  }

  // ============================================================
  //  KALKULATION (Produktkonfigurator)
  // ============================================================
  function renderKalkulation() {
    var root = $("#page-kalkulation .content");
    // Produktauswahl
    var tabs = '<div class="pill-tabs">' + Products.list.map(function (p) {
      return '<button data-prod="' + p.key + '" class="' + (entwurf.produktKey === p.key ? "active" : "") + '">' +
        p.icon + " " + esc(p.name) + "</button>";
    }).join("") + "</div>";

    root.innerHTML =
      '<div id="sammlung-panel"></div>' +
      tabs +
      '<div class="grid cols-2">' +
        '<div class="card"><h3>1 · Konfiguration</h3><div id="konfig-felder"></div></div>' +
        '<div class="card"><h3>2 · Kalkulation</h3><div id="kalk-ergebnis"><div class="empty">Konfiguration ausfüllen und „Berechnen“ klicken.</div></div></div>' +
      "</div>";
    renderSammlung();

    $all("[data-prod]").forEach(function (b) {
      b.onclick = function () {
        entwurf.produktKey = b.dataset.prod;
        entwurf.config = {}; entwurf.freiePositionen = []; entwurf.manuelleZeiten = {}; entwurf.letzteKalk = null;
        renderKalkulation();
      };
    });

    renderKonfigFelder();
  }

  function renderKonfigFelder() {
    var prod = Products.byKey(entwurf.produktKey);
    var wrap = $("#konfig-felder");
    var html = "";
    // Untergruppe / Variante (benutzerdefiniert, je Produkt)
    var ugs = (db.untergruppen && db.untergruppen[entwurf.produktKey]) || [];
    var curUg = entwurf.config.untergruppe || "";
    html += '<label class="fld"><span class="lbl">Untergruppe / Variante</span>' +
      '<select data-cfg="untergruppe">' +
        '<option value="">— keine —</option>' +
        ugs.map(function (u) { return "<option" + (curUg === u ? " selected" : "") + ">" + esc(u) + "</option>"; }).join("") +
      "</select></label>" +
      '<button class="btn sm ghost" id="btn-add-ug" type="button" style="margin:-6px 0 14px">+ Untergruppe anlegen</button>';
    prod.fragen.forEach(function (q) {
      var cur = entwurf.config[q.key] != null ? entwurf.config[q.key] : (q.default != null ? q.default : "");
      if (q.typ === "select") {
        html += '<label class="fld"><span class="lbl">' + esc(q.label) + "</span><select data-cfg=\"" + q.key + '">' +
          q.optionen.map(function (o) { return '<option' + (String(cur) === o ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") +
          "</select></label>";
      } else if (q.typ === "check") {
        var checked = (cur === true || cur === "true" || (q.default && cur === "")) ? "checked" : "";
        if (cur === "" && q.default) checked = "checked";
        html += '<label class="checkrow"><input type="checkbox" data-cfg="' + q.key + '" ' + checked + '><span>' + esc(q.label) + "</span></label>";
      } else if (q.typ === "number") {
        html += '<label class="fld"><span class="lbl">' + esc(q.label) + (q.einheit ? " (" + q.einheit + ")" : "") +
          '</span><input type="text" inputmode="decimal" data-cfg="' + q.key + '" value="' + esc(cur) + '"></label>';
      } else {
        html += '<label class="fld"><span class="lbl">' + esc(q.label) + '</span><input type="text" data-cfg="' + q.key + '" value="' + esc(cur) + '"></label>';
      }
    });

    // Freie Materialpositionen (für Sonder/Serie/Reparatur)
    if (prod.frei) {
      html += '<hr class="sep"><div class="lbl" style="margin-bottom:8px">Materialpositionen (manuell)</div>';
      html += '<div id="freie-positionen"></div>';
      html += '<button class="btn sm" id="btn-add-pos" type="button">+ Position</button>';
      html += '<hr class="sep"><div class="lbl" style="margin-bottom:8px">Arbeitszeiten manuell überschreiben (optional, in h)</div>';
      html += '<div class="inline" style="flex-wrap:wrap">';
      SCHRITTE.forEach(function (s) {
        var mv = entwurf.manuelleZeiten[s.key];
        html += '<label class="fld" style="min-width:120px;flex:0 0 31%"><span class="lbl">' + esc(s.label) +
          '</span><input type="text" inputmode="decimal" data-zeit="' + s.key + '" value="' + (mv != null ? esc(mv) : "") + '" placeholder="auto"></label>';
      });
      html += "</div>";
    }

    wrap.innerHTML = html;

    // Events: Config-Felder (Sofort-Berechnung bei jeder Änderung)
    $all("[data-cfg]", wrap).forEach(function (inp) {
      var ev = inp.type === "checkbox" ? "change" : "input";
      inp.addEventListener(ev, function () {
        entwurf.config[inp.dataset.cfg] = inp.type === "checkbox" ? inp.checked : inp.value;
        liveBerechnen();
      });
      // init in config
      entwurf.config[inp.dataset.cfg] = inp.type === "checkbox" ? inp.checked : inp.value;
    });

    if (prod.frei) {
      renderFreiePositionen();
      $("#btn-add-pos").onclick = function () {
        entwurf.freiePositionen.push({ name: "", menge: 1, einheit: "Stk", preis: 0 });
        renderFreiePositionen(); liveBerechnen();
      };
      $all("[data-zeit]", wrap).forEach(function (inp) {
        inp.addEventListener("input", function () {
          var v = leseZahl(inp.value);
          if (isNaN(v)) delete entwurf.manuelleZeiten[inp.dataset.zeit];
          else entwurf.manuelleZeiten[inp.dataset.zeit] = v;
          liveBerechnen();
        });
      });
    }

    $("#btn-add-ug").onclick = function () { untergruppeAnlegen(entwurf.produktKey); };
    liveBerechnen(); // Ergebnis sofort anzeigen
  }

  // Neue Untergruppe für ein Produkt anlegen
  function untergruppeAnlegen(produktKey) {
    var prod = Products.byKey(produktKey);
    openModal("Untergruppe für " + esc(prod.name) + " anlegen",
      fld2("Bezeichnung der Untergruppe", "ug-name", "", "text") +
      '<p class="hint">Beispiel Zaun: „Doppelstabmattenzaun", „Maschendrahtzaun". Die Untergruppe erscheint in der Auswahl und auf dem Angebot.</p>', function () {
      var name = $("#ug-name").value.trim();
      if (!name) { toast("Bitte Bezeichnung angeben.", "err"); return false; }
      db.untergruppen[produktKey] = db.untergruppen[produktKey] || [];
      if (db.untergruppen[produktKey].indexOf(name) < 0) db.untergruppen[produktKey].push(name);
      entwurf.config.untergruppe = name;
      Store.save();
      renderKonfigFelder();
      toast("Untergruppe angelegt.");
      return true;
    });
  }

  function renderFreiePositionen() {
    var wrap = $("#freie-positionen");
    if (!wrap) return;
    if (!entwurf.freiePositionen.length) { wrap.innerHTML = '<div class="muted" style="font-size:12px;margin-bottom:8px">Noch keine Positionen.</div>'; return; }
    var html = "";
    entwurf.freiePositionen.forEach(function (p, i) {
      html += '<div class="inline" style="margin-bottom:8px;align-items:flex-end">' +
        '<input data-pos="' + i + '-name" placeholder="Bezeichnung" value="' + esc(p.name) + '" style="flex:2">' +
        '<input data-pos="' + i + '-menge" type="text" inputmode="decimal" placeholder="Menge" value="' + esc(p.menge) + '" style="flex:.8">' +
        '<input data-pos="' + i + '-einheit" placeholder="Einh." value="' + esc(p.einheit) + '" style="flex:.6">' +
        '<input data-pos="' + i + '-preis" type="text" inputmode="decimal" placeholder="€/Einh." value="' + esc(p.preis) + '" style="flex:.9">' +
        '<button class="btn sm danger" data-pos-del="' + i + '" type="button">✕</button></div>';
    });
    wrap.innerHTML = html;
    $all("[data-pos]", wrap).forEach(function (inp) {
      inp.addEventListener("input", function () {
        var parts = inp.dataset.pos.split("-"); var idx = +parts[0]; var key = parts[1];
        entwurf.freiePositionen[idx][key] = (key === "menge" || key === "preis") ? leseZahl0(inp.value) : inp.value;
        liveBerechnen();
      });
    });
    $all("[data-pos-del]", wrap).forEach(function (b) {
      b.onclick = function () { entwurf.freiePositionen.splice(+b.dataset.posDel, 1); renderFreiePositionen(); liveBerechnen(); };
    });
  }

  function berechnen() {
    var kalk = Calc.kalkuliere(db, entwurf);
    entwurf.letzteKalk = kalk;
    renderKalkErgebnis(kalk);
  }
  var _liveTimer = null;
  function liveBerechnen() {
    clearTimeout(_liveTimer);
    _liveTimer = setTimeout(berechnen, 160);
  }

  function renderKalkErgebnis(kalk) {
    var root = $("#kalk-ergebnis");
    var prod = Products.byKey(entwurf.produktKey);
    var html = "";

    // Erfahrungs-Anzeige (auf wie vielen echten Aufträgen beruht die Schätzung?)
    var erf = Calc.erfahrung(db, entwurf.produktKey, entwurf.config);
    if (erf.samples === 0) {
      html += '<div class="insight" style="border-left-color:var(--muted)"><span class="ico">📋</span><span>Schätzung beruht auf <strong>Standardwerten</strong>. Schließe Aufträge mit Ist-Zeiten ab — dann wird die App genauer.</span></div>';
    } else {
      var stufeTxt = erf.stufe === "sicher" ? "gut abgesichert" : "erste Erfahrungswerte";
      html += '<div class="insight"><span class="ico">🧠</span><span>Erfahrung: beruht auf <strong>' + erf.samples + " nachkalkulierten Auftrag" + (erf.samples > 1 ? "en" : "") +
        "</strong> (" + erf.ebene + ") — <strong>" + stufeTxt + "</strong>.</span></div>";
    }

    // Arbeitszeiten
    html += '<div class="lbl">Arbeitszeiten (Soll, inkl. Lernfaktoren)</div>';
    html += '<div class="table-wrap"><table><tbody>';
    kalk.lohnZeilen.forEach(function (z) {
      html += "<tr><td>" + esc(z.label) + '</td><td class="num">' + fmtH(z.stunden) + '</td><td class="num muted">' + z.satz + ' €/h</td><td class="num">' + fmtEUR(z.summe) + "</td></tr>";
    });
    html += '<tr><td><strong>Summe</strong></td><td class="num"><strong>' + fmtH(kalk.stundenGesamt) + '</strong></td><td></td><td class="num"><strong>' + fmtEUR(kalk.lohn) + "</strong></td></tr>";
    html += "</tbody></table></div>";

    // Material
    if (kalk.matZeilen.length) {
      html += '<div class="lbl" style="margin-top:14px">Materialliste</div>';
      html += '<div class="table-wrap"><table><tbody>';
      kalk.matZeilen.forEach(function (m) {
        html += "<tr><td>" + esc(m.name) + '</td><td class="num muted">' + m.menge + " " + esc(m.einheit) + '</td><td class="num">' + fmtEUR(m.summe) + "</td></tr>";
      });
      html += "</tbody></table></div>";
    }

    // Preisaufbau
    html += '<hr class="sep">';
    html += line("Material (EK inkl. Verschnitt)", fmtEUR(kalk.materialEK), "sub");
    if (kalk.gesamtGewicht > 0) html += line("Materialgewicht gesamt", kalk.gesamtGewicht.toLocaleString("de-AT", { maximumFractionDigits: 1 }) + " kg", "sub");
    html += line("Material inkl. Aufschlag", fmtEUR(kalk.materialMitAufschlag));
    html += line("Lohn / Fertigung", fmtEUR(kalk.lohn));
    if (kalk.maschinenKosten > 0) html += line("Maschinenkosten", fmtEUR(kalk.maschinenKosten));
    if (kalk.ruestKosten > 0) html += line("Rüstkosten", fmtEUR(kalk.ruestKosten));
    html += line("Gemeinkosten", fmtEUR(kalk.gemeinkosten), "sub");
    html += line("Selbstkosten", fmtEUR(kalk.selbstkosten));
    html += line("Gewinn", fmtEUR(kalk.gewinn), "sub");
    html += line("Verkaufspreis netto", fmtEUR(kalk.netto), "total");
    html += line("Deckungsbeitrag", fmtEUR(kalk.deckungsbeitrag) + "  (" + kalk.deckungsbeitragProz + " %)", "sub");
    html += line("Brutto inkl. USt", fmtEUR(kalk.brutto));

    html += '<div class="btn-row" style="margin-top:14px">' +
      '<button class="btn primary" id="btn-angebot" type="button">📄 Als Angebot speichern</button>' +
      '<button class="btn" id="btn-add-position" type="button">➕ Position sammeln</button>' +
      '<button class="btn" id="btn-drucken" type="button">🖨️ Drucken / PDF</button>' +
      '<button class="btn" id="btn-angebotstext" type="button">📝 Text</button>' +
      "</div>" +
      '<p class="hint">„Position sammeln" fügt diese Position einem Angebot mit mehreren Positionen hinzu.</p>';

    root.innerHTML = html;
    $("#btn-angebot").onclick = function () { speichereAngebot(kalk); };
    $("#btn-add-position").onclick = function () { positionHinzufuegen(kalk); };
    $("#btn-drucken").onclick = function () { angebotDrucken([aktuellePosition(kalk)], null); };
    $("#btn-angebotstext").onclick = function () {
      var txt = Calc.angebotstext(Object.assign({ mwst: db.settings.mwst + " %" }, entwurf), kalk);
      openModal("Angebotstext", '<textarea style="min-height:320px">' + esc(txt) + "</textarea>" +
        '<p class="hint">Text markieren und kopieren (Strg+C).</p>', null, "Schließen");
    };
  }

  // ---- Leistungsbeschreibung einer Position (für PDF) -------
  function positionsBeschreibung(pos) {
    var c = pos.config || {};
    var details = [];
    if (c.werkstoff) details.push(c.werkstoff);
    if (c.profil) details.push(c.profil);
    if (c.fuellung) details.push("Füllung: " + c.fuellung);
    if (c.design && c.design !== "Standard") details.push("Design: " + c.design);
    if (c.laenge) details.push("Länge ca. " + c.laenge + " m");
    if (c.breite) details.push("Breite ca. " + c.breite + " m");
    if (c.hoehe) details.push("Höhe ca. " + c.hoehe + " m");
    if (c.gewicht) details.push("ca. " + c.gewicht + " kg");
    if (c.stueck) details.push(c.stueck + " Stück");
    if (c.oberflaeche && c.oberflaeche !== "Roh") details.push("Oberfläche: " + c.oberflaeche);
    var leistung = ((pos.kalk && pos.kalk.matZeilen) || []).map(function (m) { return m.name + " (" + m.menge + " " + m.einheit + ")"; });
    var prod = Products.byKey(pos.produktKey);
    var titel = c.untergruppe ? c.untergruppe : (prod ? prod.name : "Konstruktion");
    return { prod: prod, titel: titel, details: details, leistung: leistung };
  }

  // ---- Angebot als druckbares Dokument (eine oder mehrere Positionen) ----
  function angebotDrucken(positionen, auftrag) {
    var s = db.settings, f = s.firma || {};
    var nummer = auftrag && auftrag.nummer ? auftrag.nummer : "Vorschau";
    var heute = new Date();
    var gueltig = new Date(heute.getTime() + 30 * 864e5);
    var kunde = auftrag && auftrag.kunde ? auftrag.kunde : null;
    var anrede = (kunde && kunde.ansprechpartner) ? "Sehr geehrte/r " + kunde.ansprechpartner + "," : "Sehr geehrte Damen und Herren,";
    var gesamt = Calc.aggregiere(positionen.map(function (p) { return p.kalk; }));
    var mehrere = positionen.length > 1;
    var rabatt = auftrag && auftrag.rabatt ? auftrag.rabatt : 0;
    var nettoEnd = gesamt.netto * (1 - rabatt / 100);
    var mwstEnd = nettoEnd * s.mwst / 100;
    var bruttoEnd = nettoEnd + mwstEnd;

    function row(l, v, strong) {
      return '<tr class="' + (strong ? "strong" : "") + '"><td>' + esc(l) + '</td><td class="r">' + esc(v) + "</td></tr>";
    }
    var firmaKopf = esc(f.name || "Preisschmiede");
    var absender = [f.inhaber, f.strasse, f.plzOrt, f.tel, f.email].filter(Boolean).map(esc).join(" · ");

    var posHtml = positionen.map(function (p, i) {
      var b = positionsBeschreibung(p);
      var hatMontage = p.kalk.zeiten && p.kalk.zeiten.montage > 0;
      return '<div class="pos"><div style="display:flex;justify-content:space-between"><b>Pos. ' + (i + 1) + " — " + esc(b.titel) +
        "</b><b>" + fmtEUR(p.kalk.netto) + "</b></div>" +
        (b.details.length ? '<div class="leist">' + esc(b.details.join(", ")) + "</div>" : "") +
        (b.leistung.length ? '<div class="leist">Leistungsumfang: ' + esc(b.leistung.join(", ")) + "</div>" : "") +
        '<div class="leist">inkl. Material, Fertigung' + (hatMontage ? ", Lieferung und Montage" : " und Lieferung") + "</div></div>";
    }).join("");

    var doc =
      '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Angebot ' + esc(nummer) + '</title><style>' +
      '@page{size:A4;margin:20mm}' +
      '*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a2330;font-size:12px;line-height:1.5;margin:0}' +
      '.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f5a623;padding-bottom:12px;margin-bottom:6px}' +
      '.logo{font-size:24px;font-weight:800;color:#d4820a}' +
      '.absender{font-size:10px;color:#667;margin-bottom:8px}' +
      '.empfaenger{margin:18px 0 26px;font-size:13px;line-height:1.5}' +
      'h1{font-size:18px;margin:18px 0 4px}.meta{color:#667;margin-bottom:18px}' +
      '.pos{margin:10px 0;padding:10px 0;border-top:1px solid #ddd}.pos b{font-size:13px}.leist{color:#445;margin-top:5px;font-size:11px}' +
      'table{width:100%;border-collapse:collapse;margin-top:14px}td{padding:5px 0}td.r{text-align:right;font-variant-numeric:tabular-nums}' +
      'tr.strong td{font-weight:700;font-size:14px;border-top:2px solid #1a2330;padding-top:8px}' +
      '.text{margin-top:20px;white-space:pre-line}.foot{margin-top:30px;font-size:10px;color:#889;border-top:1px solid #ddd;padding-top:8px}' +
      '@media print{.noprint{display:none}}' +
      '.noprint{position:fixed;top:10px;right:10px}.btn{background:#f5a623;border:none;padding:10px 18px;border-radius:6px;font-weight:700;cursor:pointer}' +
      '</style></head><body>' +
      '<div class="noprint"><button class="btn" onclick="window.print()">🖨️ Drucken / als PDF speichern</button></div>' +
      '<div class="head"><div class="logo">' + firmaKopf + '</div><div style="text-align:right;font-size:11px">' +
        (f.tel ? "Tel: " + esc(f.tel) + "<br>" : "") + (f.email ? esc(f.email) + "<br>" : "") + (f.uid ? "UID: " + esc(f.uid) : "") +
      '</div></div>' +
      '<div class="absender">' + (absender || "") + '</div>' +
      (kunde ? '<div class="empfaenger">' +
        (kunde.name ? "<strong>" + esc(kunde.name) + "</strong><br>" : "") +
        (kunde.ansprechpartner ? esc(kunde.ansprechpartner) + "<br>" : "") +
        (kunde.strasse ? esc(kunde.strasse) + "<br>" : "") +
        (kunde.plzOrt ? esc(kunde.plzOrt) : "") +
        "</div>" : "") +
      '<h1>Angebot Nr. ' + esc(nummer) + '</h1>' +
      '<div class="meta">Datum: ' + heute.toLocaleDateString("de-AT") + ' &nbsp;·&nbsp; gültig bis: ' + gueltig.toLocaleDateString("de-AT") +
        (auftrag ? ' &nbsp;·&nbsp; Betreff: ' + esc(auftrag.titel) : "") +
        (auftrag && auftrag.kommission ? ' &nbsp;·&nbsp; Kommission: ' + esc(auftrag.kommission) : "") + '</div>' +
      '<p>' + anrede + '<br>vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:</p>' +
      posHtml +
      '<table>' +
        (rabatt ? row("Zwischensumme netto", fmtEUR(gesamt.netto)) + row("abzgl. Rabatt " + rabatt + " %", "− " + fmtEUR(gesamt.netto - nettoEnd)) : "") +
        row(rabatt ? "Endpreis netto" : (mehrere ? "Summe netto" : "Gesamtpreis netto"), fmtEUR(nettoEnd)) +
        row("zzgl. " + s.mwst + " % USt", fmtEUR(mwstEnd)) +
        row("Gesamtpreis brutto", fmtEUR(bruttoEnd), true) +
      "</table>" +
      '<div class="text">Lieferzeit nach Vereinbarung. Dieses Angebot ist 30 Tage gültig.\nWir freuen uns auf Ihren Auftrag.\n\nMit freundlichen Grüßen\n' + esc(f.inhaber || f.name || "") + "</div>" +
      '<div class="foot">' + firmaKopf + (f.email ? " · " + esc(f.email) : "") +
        " · Erstellt mit Preisschmiede. Interne Kalkulationswerte (Gewinn, Deckungsbeitrag) sind in diesem Kundendokument nicht enthalten.</div>" +
      "</body></html>";

    var w2 = window.open("", "_blank");
    if (!w2) { toast("Bitte Pop-ups für diese Seite erlauben.", "err"); return; }
    w2.document.open(); w2.document.write(doc); w2.document.close();
  }

  // ---- internes Druckgerüst (Arbeitszettel / Bestellliste) ----
  function oeffneDruck(title, innerHtml, extraStyle) {
    var f = db.settings.firma || {};
    var firmaKopf = esc(f.name || "Preisschmiede");
    var doc = '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>' + esc(title) + "</title><style>" +
      "@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a2330;font-size:12px;line-height:1.45;margin:0}" +
      "h1{font-size:19px;margin:0 0 2px}.sub{color:#667;margin-bottom:14px;font-size:12px}" +
      "table{width:100%;border-collapse:collapse;margin:8px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd}th{background:#f3f5f8;font-size:11px;text-transform:uppercase;letter-spacing:.4px}" +
      "td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}.posh{font-weight:700;font-size:13px;margin:16px 0 4px;color:#111}" +
      ".head{display:flex;justify-content:space-between;border-bottom:3px solid #f5a623;padding-bottom:8px;margin-bottom:12px}.logo{font-size:20px;font-weight:800;color:#d4820a}" +
      ".foot{margin-top:24px;font-size:10px;color:#889;border-top:1px solid #ddd;padding-top:6px}" +
      "@media print{.noprint{display:none}}.noprint{position:fixed;top:10px;right:10px}.btn{background:#f5a623;border:none;padding:10px 18px;border-radius:6px;font-weight:700;cursor:pointer}" +
      (extraStyle || "") + '</style></head><body>' +
      '<div class="noprint"><button class="btn" onclick="window.print()">🖨️ Drucken / als PDF speichern</button></div>' +
      '<div class="head"><div class="logo">' + firmaKopf + '</div><div style="font-size:11px;text-align:right">' + esc(title) + "</div></div>" +
      innerHtml +
      '<div class="foot">' + firmaKopf + " · Erstellt mit Preisschmiede</div></body></html>";
    var w2 = window.open("", "_blank");
    if (!w2) { toast("Bitte Pop-ups für diese Seite erlauben.", "err"); return; }
    w2.document.open(); w2.document.write(doc); w2.document.close();
  }

  function auftragKopfText(a) {
    return (a.nummer ? esc(a.nummer) + " · " : "") + esc(a.titel) +
      (a.kommission ? " · Kommission: " + esc(a.kommission) : "") +
      (a.kunde && a.kunde.name ? " · " + esc(a.kunde.name) : "") +
      " · " + new Date().toLocaleDateString("de-AT");
  }

  // ---- Arbeitszettel / Fertigungsauftrag --------------------
  function arbeitszettelDrucken(a) {
    var positionen = auftragPositionen(a);
    var html = '<h1>Arbeitszettel</h1><div class="sub">' + auftragKopfText(a) + "</div>";
    positionen.forEach(function (p, i) {
      var b = positionsBeschreibung(p);
      html += '<div class="posh">Pos. ' + (i + 1) + " — " + esc(b.titel) + "</div>";
      if (b.details.length) html += '<div style="font-size:11px;color:#445;margin-bottom:4px">' + esc(b.details.join(", ")) + "</div>";
      html += '<table><thead><tr><th>Arbeitsschritt</th><th class="r">Soll (h)</th><th class="r">Ist (h)</th><th>erledigt</th></tr></thead><tbody>';
      var hat = false;
      SCHRITTE.forEach(function (s) {
        var soll = (p.kalk.zeiten && p.kalk.zeiten[s.key]) || 0;
        if (soll <= 0) return;
        hat = true;
        html += "<tr><td>" + esc(s.label) + '</td><td class="r">' + soll.toLocaleString("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) +
          '</td><td class="r">_______</td><td>☐</td></tr>';
      });
      if (!hat) html += '<tr><td colspan="4" style="color:#889">keine Soll-Zeiten</td></tr>';
      html += "</tbody></table>";
      if (b.leistung.length) html += '<div style="font-size:11px;color:#445">Material: ' + esc(b.leistung.join(", ")) + "</div>";
    });
    oeffneDruck("Arbeitszettel " + (a.nummer || ""), html);
  }

  // Material aller Positionen zusammenfassen (für Bestellliste)
  function sammleMaterial(positionen) {
    var verschnitt = (db.settings.verschnitt || 0) / 100;
    var map = {};
    positionen.forEach(function (p) {
      ((p.kalk && p.kalk.matZeilen) || []).forEach(function (m) {
        if (!map[m.name]) {
          var ref = db.material.filter(function (x) { return x.name === m.name; })[0];
          map[m.name] = { name: m.name, menge: 0, einheit: m.einheit, lieferant: (ref && ref.lieferant) || "—" };
        }
        map[m.name].menge += m.menge * (1 + verschnitt);
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  // ---- Materialbestellliste (nach Lieferant) ----------------
  function bestelllisteDrucken(a) {
    var positionen = auftragPositionen(a);
    var mats = sammleMaterial(positionen);
    var html = '<h1>Materialbestellliste</h1><div class="sub">' + auftragKopfText(a) + " · Mengen inkl. Verschnitt</div>";
    if (!mats.length) { html += "<p>Keine Materialpositionen in diesem Auftrag.</p>"; oeffneDruck("Bestellliste", html); return; }
    var nachLief = {};
    mats.forEach(function (m) { (nachLief[m.lieferant] = nachLief[m.lieferant] || []).push(m); });
    Object.keys(nachLief).sort().forEach(function (lief) {
      html += '<div class="posh">Lieferant: ' + esc(lief) + "</div>";
      html += '<table><thead><tr><th>Material</th><th class="r">Menge</th><th>Einheit</th><th>bestellt</th></tr></thead><tbody>';
      nachLief[lief].forEach(function (m) {
        html += "<tr><td>" + esc(m.name) + '</td><td class="r">' + m.menge.toLocaleString("de-AT", { maximumFractionDigits: 1 }) +
          "</td><td>" + esc(m.einheit) + "</td><td>☐</td></tr>";
      });
      html += "</tbody></table>";
    });
    oeffneDruck("Bestellliste " + (a.nummer || ""), html);
  }

  function line(label, val, cls) {
    return '<div class="result-line ' + (cls || "") + '"><span>' + esc(label) + '</span><span class="v">' + esc(val) + "</span></div>";
  }

  // ---- Position aus dem aktuellen Entwurf erzeugen ----------
  function positionLabel(produktKey, c) {
    var prod = Products.byKey(produktKey);
    var basis = c.untergruppe ? c.untergruppe : prod.name;
    return (basis + (c.werkstoff ? " " + c.werkstoff : "") + (c.laenge ? " " + c.laenge + "m" : "") +
      (c.bezeichnung ? " " + c.bezeichnung : "") + (c.stueck ? " (" + c.stueck + " Stk)" : "")).trim();
  }
  function aktuellePosition(kalk) {
    return {
      produktKey: entwurf.produktKey,
      config: JSON.parse(JSON.stringify(entwurf.config)),
      freiePositionen: JSON.parse(JSON.stringify(entwurf.freiePositionen)),
      manuelleZeiten: JSON.parse(JSON.stringify(entwurf.manuelleZeiten)),
      kalk: kalk,
      label: positionLabel(entwurf.produktKey, entwurf.config),
      ist: null
    };
  }

  // ---- Positionssammlung (Angebot mit mehreren Positionen) ----
  function positionHinzufuegen(kalk) {
    sammlung.push(aktuellePosition(kalk));
    toast("Position hinzugefügt (" + sammlung.length + " gesamt).");
    renderSammlung();
  }
  function renderSammlung() {
    var wrap = $("#sammlung-panel");
    if (!wrap) return;
    if (!sammlung.length) { wrap.innerHTML = ""; return; }
    var gesamt = Calc.aggregiere(sammlung.map(function (p) { return p.kalk; }));
    var html = '<div class="card" style="border-left:3px solid var(--accent);margin-bottom:16px"><h3>🧾 Angebot mit ' + sammlung.length + ' Position' + (sammlung.length > 1 ? "en" : "") + "</h3>";
    html += '<div class="table-wrap"><table><tbody>';
    sammlung.forEach(function (p, i) {
      html += "<tr><td>" + (i + 1) + ". " + esc(p.label) + '</td><td class="num">' + fmtEUR(p.kalk.netto) +
        '</td><td class="num"><button class="btn sm danger" data-samdel="' + i + '" type="button">✕</button></td></tr>';
    });
    html += '<tr><td><strong>Summe netto</strong></td><td class="num"><strong>' + fmtEUR(gesamt.netto) + '</strong></td><td></td></tr>';
    html += "</tbody></table></div>";
    html += '<div class="btn-row" style="margin-top:10px">' +
      '<button class="btn primary" id="btn-save-sammlung" type="button">📄 Angebot speichern (' + sammlung.length + " Pos.)</button>" +
      '<button class="btn" id="btn-print-sammlung" type="button">🖨️ Vorschau drucken</button>' +
      '<button class="btn ghost" id="btn-clear-sammlung" type="button">Verwerfen</button></div></div>';
    wrap.innerHTML = html;
    $all("[data-samdel]", wrap).forEach(function (b) { b.onclick = function () { sammlung.splice(+b.dataset.samdel, 1); renderSammlung(); }; });
    $("#btn-save-sammlung").onclick = function () { speichereAuftrag(sammlung.slice()); };
    $("#btn-print-sammlung").onclick = function () { angebotDrucken(sammlung, null); };
    $("#btn-clear-sammlung").onclick = function () { if (confirm("Alle gesammelten Positionen verwerfen?")) { sammlung = []; renderSammlung(); } };
  }

  // ---- Angebot speichern (eine Einzelposition) --------------
  function speichereAngebot(kalk) {
    speichereAuftrag([aktuellePosition(kalk)]);
  }

  // ---- Auftrag mit beliebig vielen Positionen speichern -----
  function speichereAuftrag(positionen) {
    if (!positionen.length) return;
    var titelvorschlag = positionen.length === 1 ? positionen[0].label : positionen.length + " Positionen";
    var kundenOpt = '<option value="">— kein Kunde —</option>' + (db.kunden || []).map(function (k) {
      return '<option value="' + k.id + '">' + esc(k.name) + (k.plzOrt ? ", " + esc(k.plzOrt) : "") + "</option>";
    }).join("");
    openModal("Angebot speichern",
      fld2("Bezeichnung / Projekt", "a-titel", titelvorschlag, "text") +
      '<label class="fld"><span class="lbl">Kunde (Empfänger auf dem Angebot)</span><select id="a-kunde">' + kundenOpt + "</select></label>" +
      '<div class="inline">' +
        fld2("Kommission (Auftrags-Nr. / Baustelle)", "a-kommission", "", "text") +
        fld2("Rabatt (%)", "a-rabatt", "0", "number") +
      "</div>" +
      '<p class="hint">' + positionen.length + ' Position' + (positionen.length > 1 ? "en" : "") + '. Kunden legst du in den Stammdaten an.</p>', function () {
      var titel = $("#a-titel").value.trim() || titelvorschlag || "Angebot";
      var jahr = new Date().getFullYear();
      var nummer = "ANG-" + jahr + "-" + String(db.settings.angebotZaehler || 1).padStart(3, "0");
      db.settings.angebotZaehler = (db.settings.angebotZaehler || 1) + 1;
      var kundeId = $("#a-kunde").value;
      var kunde = kundeId ? (db.kunden || []).filter(function (k) { return k.id === kundeId; })[0] : null;
      var auftrag = {
        id: Store.uid(), nummer: nummer, titel: titel,
        kunde: kunde ? JSON.parse(JSON.stringify(kunde)) : null,
        kommission: $("#a-kommission").value.trim(),
        rabatt: leseZahl0($("#a-rabatt").value),
        positionen: JSON.parse(JSON.stringify(positionen)),
        kalk: Calc.aggregiere(positionen.map(function (p) { return p.kalk; })),
        status: "Angebot", erstellt: Store.nowISO()
      };
      db.auftraege.push(auftrag);
      Store.save();
      sammlung = [];
      toast("Angebot gespeichert.");
      navTo("auftraege");
      return true;
    });
  }

  // ============================================================
  //  AUFTRÄGE / NACHKALKULATION
  // ============================================================
  function renderAuftraege() {
    var root = $("#page-auftraege .content");
    if (!db.auftraege.length) {
      root.innerHTML = '<div class="empty">Noch keine Aufträge. Erstelle in „Kalkulation“ ein Angebot.</div>';
      return;
    }
    var statusOpt = [["", "Alle Status"], ["Angebot", "Angebot"], ["Beauftragt", "Beauftragt"], ["Abgeschlossen", "Abgeschlossen"]]
      .map(function (o) { return '<option value="' + o[0] + '"' + (auftragFilter.status === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("");
    root.innerHTML = '<div class="card">' +
      '<div class="inline" style="margin-bottom:14px">' +
        '<input id="auf-suche" placeholder="🔍 Suche: Bezeichnung, Kunde, Kommission, Nr." value="' + esc(auftragFilter.suche) + '" style="flex:2">' +
        '<select id="auf-status" style="flex:1;max-width:180px">' + statusOpt + "</select>" +
      "</div>" +
      '<div class="table-wrap"><table><thead><tr>' +
        '<th>Bezeichnung</th><th>Kommission</th><th>Produkt</th><th>Status</th><th class="num">Netto</th><th class="num">DB</th><th class="num">Soll/Ist</th><th></th>' +
      '</tr></thead><tbody id="auf-tbody"></tbody></table></div></div>';
    $("#auf-suche").addEventListener("input", function () { auftragFilter.suche = this.value; renderAuftragsZeilen(); });
    $("#auf-status").addEventListener("change", function () { auftragFilter.status = this.value; renderAuftragsZeilen(); });
    renderAuftragsZeilen();
  }

  function renderAuftragsZeilen() {
    var tbody = $("#auf-tbody");
    if (!tbody) return;
    var suche = (auftragFilter.suche || "").toLowerCase().trim();
    var gefiltert = db.auftraege.filter(function (a) {
      if (auftragFilter.status && a.status !== auftragFilter.status) return false;
      if (!suche) return true;
      var hay = [a.titel, a.nummer, a.kommission, a.kunde && a.kunde.name].filter(Boolean).join(" ").toLowerCase();
      return hay.indexOf(suche) >= 0;
    });
    if (!gefiltert.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:18px">Keine Treffer.</td></tr>';
      return;
    }
    var html = "";
    gefiltert.slice().reverse().forEach(function (a) {
      var si = Calc.sollIst(a);
      var siTxt = si ? (si.abwProz > 0 ? "+" : "") + si.abwProz + " %" : "—";
      html += "<tr>" +
        "<td><strong>" + esc(a.titel) + "</strong>" + (a.kunde && a.kunde.name ? ' <span class="muted">· ' + esc(a.kunde.name) + "</span>" : "") +
          '<br><span class="muted" style="font-size:11px">' + (a.nummer ? esc(a.nummer) + " · " : "") + fmtDate(a.erstellt) + "</span></td>" +
        "<td>" + (a.kommission ? '<span class="tag">' + esc(a.kommission) + "</span>" : '<span class="muted">—</span>') + "</td>" +
        "<td>" + auftragProduktLabel(a) + "</td>" +
        "<td>" + statusBadge(a.status) + "</td>" +
        '<td class="num">' + fmtEUR(auftragNetto(a)) + (a.rabatt ? ' <span class="muted" style="font-size:10px">−' + a.rabatt + "%</span>" : "") + "</td>" +
        '<td class="num">' + fmtEUR(auftragDB(a)) + "</td>" +
        '<td class="num">' + siTxt + "</td>" +
        '<td class="num"><button class="btn sm" data-auf="' + a.id + '">Öffnen</button></td></tr>';
    });
    tbody.innerHTML = html;
    $all("[data-auf]", tbody).forEach(function (b) { b.onclick = function () { auftragModal(b.dataset.auf); }; });
  }

  // ---- Auftrag als Vorlage duplizieren ----------------------
  function dupliziereAuftrag(a) {
    var positionen = auftragPositionen(a);
    var p0 = positionen[0];
    entwurf.produktKey = p0.produktKey;
    entwurf.config = JSON.parse(JSON.stringify(p0.config || {}));
    entwurf.freiePositionen = JSON.parse(JSON.stringify(p0.freiePositionen || []));
    entwurf.manuelleZeiten = JSON.parse(JSON.stringify(p0.manuelleZeiten || {}));
    sammlung = positionen.slice(1).map(function (p) { var c = JSON.parse(JSON.stringify(p)); c.ist = null; return c; });
    toast("Auftrag als Vorlage geladen — anpassen und speichern.");
    navTo("kalkulation");
  }

  // Positionen eines Auftrags (setzt a.positionen bei Altdaten)
  function auftragPositionen(a) {
    if (!a.positionen || !a.positionen.length) {
      a.positionen = [{
        produktKey: a.produktKey, config: a.config, freiePositionen: a.freiePositionen,
        manuelleZeiten: a.manuelleZeiten, kalk: a.kalk, ist: a.ist || null, label: a.titel
      }];
    }
    return a.positionen;
  }
  function auftragProduktLabel(a) {
    var pos = auftragPositionen(a);
    if (pos.length > 1) return "🧾 " + pos.length + " Positionen";
    var prod = Products.byKey(pos[0].produktKey);
    return prod ? prod.icon + " " + esc(prod.name) : "-";
  }

  function auftragModal(id) {
    var a = db.auftraege.find(function (x) { return x.id === id; });
    if (!a) return;
    var positionen = auftragPositionen(a);
    var si = Calc.sollIst(a);

    var body = '<div class="muted" style="font-size:12px;margin-bottom:10px">' + (a.nummer ? "<strong>" + esc(a.nummer) + "</strong> · " : "") + auftragProduktLabel(a) + " · " + fmtDate(a.erstellt) + " · " + statusBadge(a.status) +
      (a.kunde && a.kunde.name ? '<br>👤 Kunde: <strong>' + esc(a.kunde.name) + "</strong>" : "") + "</div>";
    body += '<div class="btn-row" style="margin-bottom:12px">' +
      '<button class="btn sm" id="btn-auf-druck" type="button">🖨️ Angebot</button>' +
      '<button class="btn sm" id="btn-auf-zettel" type="button">🛠️ Arbeitszettel</button>' +
      '<button class="btn sm" id="btn-auf-bestell" type="button">📦 Bestellliste</button>' +
      '<button class="btn sm" id="btn-auf-dup" type="button">📋 Duplizieren</button>' +
      "</div>";

    // Timer-Leiste (wenn eine Zeiterfassung für diesen Auftrag läuft)
    if (db.aktiverTimer && db.aktiverTimer.auftragId === a.id) {
      body += '<div class="insight" style="border-left-color:var(--green);margin-bottom:12px"><span class="ico">⏱</span><span>Zeit läuft: <strong>' +
        esc(schrittLabel(db.aktiverTimer.schritt)) + '</strong> — <span id="timer-live" style="font-variant-numeric:tabular-nums">00:00:00</span></span></div>';
    }

    // Kommission + Rabatt + Status
    body += '<div class="inline">' +
      fld2("Kommission (Auftrags-Nr. / Baustelle)", "a-kommission", a.kommission || "", "text") +
      fld2("Rabatt (%)", "a-rabatt", a.rabatt || 0, "number") +
      '<label class="fld"><span class="lbl">Status</span><select id="a-status">' +
        ["Angebot", "Beauftragt", "Abgeschlossen"].map(function (s) { return '<option' + (a.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("") +
      "</select></label>" +
      "</div>";

    // Kalkulationsübersicht (Gesamt, inkl. Rabatt)
    var rab = a.rabatt || 0;
    var nettoEnd = auftragNetto(a);
    body += '<div class="card" style="background:var(--panel-2);margin-bottom:12px">' +
      line(rab ? "Verkaufspreis netto (Liste)" : "Verkaufspreis netto", fmtEUR(a.kalk.netto)) +
      (rab ? line("abzgl. Rabatt " + rab + " %", "−" + fmtEUR(auftragRabattBetrag(a)), "sub") + line("Endpreis netto", fmtEUR(nettoEnd)) : "") +
      (auftragFremd(a) ? line("abzgl. externe Kosten (Zukauf/Fremd)", "−" + fmtEUR(auftragFremd(a)), "sub") : "") +
      line("Deckungsbeitrag", fmtEUR(auftragDB(a)), "sub") +
      line("Soll-Stunden gesamt", fmtH(a.kalk.stundenGesamt), "sub") +
      (nettoEnd < a.kalk.selbstkosten ? '<div class="result-line" style="color:var(--red)"><span>⚠️ Unter Selbstkosten!</span><span class="v">' + fmtEUR(a.kalk.selbstkosten) + "</span></div>" : "") +
      "</div>";

    // Nachkalkulation – Ist-Zeiten erfassen (je Position)
    body += '<div class="lbl" style="margin-bottom:8px">Nachkalkulation · Ist-Zeiten erfassen (h)</div>';
    positionen.forEach(function (p, pi) {
      if (positionen.length > 1) {
        body += '<div style="font-weight:700;color:var(--accent);font-size:13px;margin:12px 0 6px">' + (pi + 1) + ". " + esc(p.label || (Products.byKey(p.produktKey) || {}).name || "Position") + "</div>";
      }
      var zeiten = (p.kalk && p.kalk.zeiten) || {};
      body += '<div class="table-wrap"><table><thead><tr><th>Schritt</th><th class="num">Soll</th><th class="num">Ist</th><th class="num">Timer</th></tr></thead><tbody>';
      SCHRITTE.forEach(function (s) {
        var soll = zeiten[s.key] || 0;
        var istV = p.ist && p.ist.zeiten ? (p.ist.zeiten[s.key] || "") : "";
        if (soll <= 0 && istV === "") return;
        var laeuft = db.aktiverTimer && db.aktiverTimer.auftragId === a.id && db.aktiverTimer.posIndex === pi && db.aktiverTimer.schritt === s.key;
        body += "<tr><td>" + esc(s.label) + '</td><td class="num muted">' + (soll ? fmtH(soll) : "—") +
          '</td><td class="num"><input type="text" inputmode="decimal" data-ist="' + pi + ":" + s.key + '" value="' + esc(istV) + '" placeholder="' + (soll || 0) + '" style="width:80px;text-align:right"></td>' +
          '<td class="num"><button class="btn sm ' + (laeuft ? "danger" : "ghost") + '" data-timer="' + pi + ":" + s.key + '" type="button">' + (laeuft ? "⏹ Stopp" : "▶") + "</button></td></tr>";
      });
      body += "</tbody></table></div>";
    });
    // Fremdleistungen & Zukauf – externe Kosten als Preis statt Zeit
    body += '<div class="lbl" style="margin:16px 0 4px">Fremdleistungen & Zukauf (extern, €)</div>';
    body += '<p class="hint" style="margin-top:0">Zugekaufte Teile, Normteile oder externe Beschichtung – hier als <strong>Preis</strong> statt als Zeit erfassen. Sie mindern den Gewinn der Nachkalkulation.</p>';
    body += '<div id="fremd-liste">';
    (a.fremdkosten || []).forEach(function (f) { body += fremdZeile(f.bezeichnung, f.betrag); });
    body += "</div>";
    body += '<div class="btn-row" style="margin:4px 0 2px"><button class="btn sm ghost" id="btn-fremd-add" type="button">+ Posten</button></div>';

    body += fld2("Materialverbrauch / Notiz (optional)", "a-matnote", a.materialKommentar || "", "text");

    if (si) {
      var box = "";
      if (si.hatZeiten) {
        box += "Ist gesamt: <strong>" + fmtH(si.istStunden) + "</strong> vs. Soll " + fmtH(si.sollStunden) +
          " — Abweichung <strong>" + (si.abwProz > 0 ? "+" : "") + si.abwProz + " %</strong>";
      }
      if (si.fremdkosten > 0) {
        box += (box ? "<br>" : "") + "Externe Kosten: <strong>" + fmtEUR(si.fremdkosten) +
          "</strong> → Gewinn nach externen Kosten: <strong>" + fmtEUR(auftragGewinn(a)) + "</strong>";
      }
      body += '<div class="insight" style="margin-top:12px"><span class="ico">📊</span><span>' + box + "</span></div>";
    }

    openModalWide("Auftrag: " + esc(a.titel), body, function () {
      a.status = $("#a-status").value;
      a.kommission = $("#a-kommission").value.trim();
      a.rabatt = leseZahl0($("#a-rabatt").value);
      var istProPos = {};
      $all("[data-ist]").forEach(function (inp) {
        var v = leseZahl(inp.value);
        if (isNaN(v) || v <= 0) return;
        var parts = inp.dataset.ist.split(":"); var pi = parts[0], key = parts[1];
        (istProPos[pi] = istProPos[pi] || {})[key] = v;
      });
      var hatIst = false;
      positionen.forEach(function (p, pi) {
        if (istProPos[pi]) { p.ist = { zeiten: istProPos[pi], erfasst: Store.nowISO() }; hatIst = true; }
      });
      // Fremdleistungen / Zukauf einlesen (negative Beträge werden auf 0 geklemmt)
      a.fremdkosten = leseFremdkosten();
      a.materialKommentar = $("#a-matnote").value.trim();
      if (a.status === "Abgeschlossen" && hatIst) {
        Calc.lerneAusAuftrag(db, a);
        toast("Auftrag abgeschlossen — App hat dazugelernt. 🧠");
      } else {
        toast("Auftrag gespeichert.");
      }
      Store.save();
      renderAuftraege();
      return true;
    }, "Löschen", function () {
      if (confirm("Auftrag wirklich löschen?")) {
        db.auftraege = db.auftraege.filter(function (x) { return x.id !== id; });
        Store.save(); renderAuftraege(); return true;
      }
      return false;
    });
    if ($("#btn-auf-druck")) $("#btn-auf-druck").onclick = function () { angebotDrucken(positionen, a); };
    if ($("#btn-auf-zettel")) $("#btn-auf-zettel").onclick = function () { arbeitszettelDrucken(a); };
    if ($("#btn-auf-bestell")) $("#btn-auf-bestell").onclick = function () { bestelllisteDrucken(a); };
    if ($("#btn-auf-dup")) $("#btn-auf-dup").onclick = function () { $("#modal-bg").classList.remove("show"); dupliziereAuftrag(a); };
    $all("[data-timer]").forEach(function (b) {
      b.onclick = function () {
        var parts = b.dataset.timer.split(":");
        timerKlick(a, +parts[0], parts[1]);
      };
    });
    function bindFremdDel() {
      $all("#fremd-liste .f-del").forEach(function (b) {
        b.onclick = function () { var row = b.parentNode; if (row) row.parentNode.removeChild(row); };
      });
    }
    if ($("#btn-fremd-add")) $("#btn-fremd-add").onclick = function () {
      var liste = $("#fremd-liste");
      var tmp = d.createElement("div");
      tmp.innerHTML = fremdZeile("", "");
      liste.appendChild(tmp.firstChild);
      bindFremdDel();
    };
    bindFremdDel();
    tickTimer();
  }

  // Fremdkosten aus dem offenen Auftrag-Modal lesen (negative -> 0).
  function leseFremdkosten() {
    var fremd = [];
    $all("#fremd-liste .fremd-row").forEach(function (row) {
      var bez = (row.querySelector(".f-bez").value || "").trim();
      var betrag = leseZahl(row.querySelector(".f-betrag").value);
      betrag = isFinite(betrag) ? Math.max(0, Math.round(betrag * 100) / 100) : 0;
      if (!bez && !(betrag > 0)) return;
      fremd.push({ bezeichnung: bez, betrag: betrag });
    });
    return fremd;
  }

  // ---- Zeiterfassung (Timer, nur einer gleichzeitig) --------
  // Sichert ALLE Eingaben des offenen Auftrag-Modals, damit ein Timer-Klick
  // (der das Modal neu aufbaut) keine ungespeicherten Werte verwirft.
  function istAusDomSpeichern(a) {
    var positionen = auftragPositionen(a);
    $all("[data-ist]").forEach(function (inp) {
      var v = leseZahl(inp.value);
      var parts = inp.dataset.ist.split(":"); var pi = +parts[0], key = parts[1];
      var p = positionen[pi]; if (!p) return;
      if (!isNaN(v) && v > 0) { p.ist = p.ist || { zeiten: {}, erfasst: Store.nowISO() }; p.ist.zeiten[key] = v; }
    });
    if ($("#fremd-liste")) a.fremdkosten = leseFremdkosten();
    if ($("#a-kommission")) a.kommission = $("#a-kommission").value.trim();
    if ($("#a-rabatt")) a.rabatt = leseZahl0($("#a-rabatt").value);
    if ($("#a-status")) a.status = $("#a-status").value;
    if ($("#a-matnote")) a.materialKommentar = $("#a-matnote").value.trim();
  }
  function timerBuchen() {
    var t = db.aktiverTimer; if (!t) return;
    var a = db.auftraege.filter(function (x) { return x.id === t.auftragId; })[0];
    var dauerH = (Date.now() - new Date(t.startISO).getTime()) / 3600000;
    if (!isFinite(dauerH) || dauerH < 0) dauerH = 0;
    // Verwaister/vergessener Timer (z. B. über Nacht offen) nicht still als
    // viele Stunden buchen – sonst werden Nachkalkulation und Lernfaktoren verfälscht.
    if (dauerH > 16) {
      var antwort = w.prompt("Der Timer lief " + dauerH.toFixed(1) + " h – vermutlich vergessen.\nWie viele Stunden tatsächlich buchen? (0 = nichts)", "0");
      if (antwort === null) return; // Abbruch: Timer läuft weiter
      var manuell = leseZahl(antwort);
      dauerH = (isFinite(manuell) && manuell >= 0) ? manuell : 0;
    }
    if (a && dauerH > 0) {
      var p = auftragPositionen(a)[t.posIndex];
      if (p) { p.ist = p.ist || { zeiten: {}, erfasst: Store.nowISO() }; p.ist.zeiten[t.schritt] = Calc.round2((p.ist.zeiten[t.schritt] || 0) + dauerH); }
    }
    db.aktiverTimer = null;
  }
  function timerKlick(a, pi, key) {
    istAusDomSpeichern(a);
    var t = db.aktiverTimer;
    var selbe = t && t.auftragId === a.id && t.posIndex === pi && t.schritt === key;
    if (t) timerBuchen();           // laufenden Timer immer zuerst buchen
    if (!selbe) {                   // war es ein anderer Schritt -> neuen Timer starten
      db.aktiverTimer = { auftragId: a.id, posIndex: pi, schritt: key, startISO: new Date().toISOString() };
    }
    Store.save();
    $("#modal-bg").classList.remove("show");
    auftragModal(a.id);
  }
  function tickTimer() {
    var el = $("#timer-live");
    if (!el || !db.aktiverTimer) return;
    var sek = Math.max(0, Math.floor((Date.now() - new Date(db.aktiverTimer.startISO).getTime()) / 1000));
    var h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = sek % 60;
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    el.textContent = p2(h) + ":" + p2(m) + ":" + p2(s);
  }

  // ============================================================
  //  LERNEN / KI
  // ============================================================
  function renderLernen() {
    var root = $("#page-lernen .content");
    var html = '<div class="grid cols-2">';
    html += '<div class="card"><h3>🧠 Erkannte Muster</h3>' + erkenntnisseHTML(99) + "</div>";

    // Faktor-Tabelle
    html += '<div class="card"><h3>Lern-Korrekturfaktoren</h3>';
    var faktoren = db.lernen.faktoren || {};
    var keys = Object.keys(faktoren);
    if (!keys.length) {
      html += '<div class="empty">Noch keine Lerndaten. Die Faktoren entstehen automatisch aus abgeschlossenen Aufträgen mit erfassten Ist-Zeiten.</div>';
    } else {
      html += '<p class="hint">Segmentiert nach Produkt × Werkstoff × Größe. Faktor &gt; 1,00 = tatsächlicher Aufwand höher als ursprünglich kalkuliert. Wird automatisch auf neue Kalkulationen angewendet.</p>';
      html += '<div class="table-wrap"><table><thead><tr><th>Segment / Schritt</th><th class="num">Faktor</th><th class="num">Aufträge</th></tr></thead><tbody>';
      // spezifischere Segmente (mit "|") zuerst
      keys.sort(function (a, b) { return b.split("|").length - a.split("|").length; });
      keys.forEach(function (pk) {
        SCHRITTE.forEach(function (s) {
          var e = faktoren[pk][s.key];
          if (!e) return;
          html += "<tr><td>" + esc(Calc.segLabel(pk)) + " · " + esc(s.label) + '</td><td class="num">' +
            e.faktor.toLocaleString("de-AT", { minimumFractionDigits: 2 }) + '</td><td class="num muted">' + e.samples + "</td></tr>";
        });
      });
      html += "</tbody></table></div>";
    }
    html += "</div></div>";

    html += '<div class="card" style="margin-top:16px"><h3>Wie die Lernfunktion arbeitet</h3>' +
      '<p style="font-size:13px" class="muted">Bei jedem abgeschlossenen Auftrag vergleicht Preisschmiede die kalkulierten Soll-Zeiten mit den erfassten Ist-Zeiten. ' +
      'Pro Produkttyp und Arbeitsschritt wird ein gewichteter Korrekturfaktor gebildet. Je mehr Aufträge erfasst werden, desto genauer werden die automatischen Schätzungen für CAD, Zuschnitt, Schweißen, Montage usw. ' +
      'So nähert sich die App schrittweise dem Ziel, aus wenigen Eckdaten ein realistisches Angebot zu erzeugen.</p></div>';

    root.innerHTML = html;
  }

  // ============================================================
  //  MODAL
  // ============================================================
  function openModal(title, bodyHTML, onOk, okLabel) {
    _openModal(title, bodyHTML, onOk, okLabel || "Speichern", false);
  }
  function openModalWide(title, bodyHTML, onOk, extraLabel, onExtra) {
    _openModal(title, bodyHTML, onOk, "Speichern", true, extraLabel, onExtra);
  }
  function _openModal(title, bodyHTML, onOk, okLabel, wide, extraLabel, onExtra) {
    var bg = $("#modal-bg");
    var foot = onOk
      ? '<button class="btn ghost" id="modal-cancel">Abbrechen</button>' +
        (extraLabel ? '<button class="btn danger" id="modal-extra">' + esc(extraLabel) + "</button>" : "") +
        '<button class="btn primary" id="modal-ok">' + esc(okLabel) + "</button>"
      : '<button class="btn primary" id="modal-cancel">' + esc(okLabel) + "</button>";
    bg.innerHTML = '<div class="modal"><h3>' + esc(title) + "</h3><div>" + bodyHTML + "</div>" +
      '<div class="btn-row" style="justify-content:flex-end;margin-top:16px">' + foot + "</div></div>";
    bg.classList.add("show");
    function close() { bg.classList.remove("show"); }
    function safe(fn) {
      return function () {
        try { if (fn() !== false) close(); }
        catch (e) { console.error("Aktion fehlgeschlagen:", e); var id = protokolliereFehler(e, "modal"); toast("Aktion fehlgeschlagen (ID " + id + ") — bitte Eingaben prüfen.", "err"); }
      };
    }
    $("#modal-cancel").onclick = close;
    if ($("#modal-ok")) $("#modal-ok").onclick = safe(onOk);
    if ($("#modal-extra")) $("#modal-extra").onclick = safe(onExtra || function () {});
    bg.onclick = function (e) { if (e.target === bg) close(); };
  }

  // ============================================================
  //  GERÄTE-SYNC (PC ↔ Handy über lokales WLAN)
  // ============================================================
  function normAddr(a) { return (a || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, ""); }
  function schliesseModal() { $("#modal-bg").classList.remove("show"); }

  function zeichneQR(el, text) {
    if (!el) return;
    if (!w.qrcode) { el.innerHTML = '<div class="muted">QR nicht verfügbar.</div>'; return; }
    try {
      var qr = w.qrcode(0, "M"); qr.addData(text); qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2 });
      var svg = el.querySelector("svg");
      if (svg) { svg.removeAttribute("width"); svg.removeAttribute("height"); svg.style.cssText = "width:220px;height:220px;background:#fff;padding:10px;border-radius:10px"; }
    } catch (e) { el.innerHTML = '<div class="muted">QR konnte nicht erzeugt werden.</div>'; }
  }

  function syncModal() {
    if (w.electronAPI && w.electronAPI.isDesktop) syncModalPC();
    else syncModalHandy();
  }

  // PC-Seite (Electron): startet den WLAN-Server und zeigt QR + Adresse
  function syncModalPC() {
    try { w.electronAPI.setData(Store.exportJSON()); } catch (e) {}
    w.electronAPI.startServer().then(function (info) {
      var ips = (info && info.ips) || [];
      var port = (info && info.port) || 8765;
      if (!ips.length) {
        openModal("Geräte-Sync", '<div class="empty">Keine WLAN-Verbindung gefunden. Bitte den PC mit dem Netzwerk verbinden.</div>', null, "Schließen");
        return;
      }
      var addr = ips[0] + ":" + port;
      var pin = (info && info.token) || "";
      var qrUrl = "http://" + addr + (pin ? "?t=" + pin : "");
      var body = '<p>PC und Handy müssen im <strong>selben WLAN</strong> sein. Am Handy: Stammdaten → Geräte-Sync → „QR-Code scannen".</p>' +
        '<div id="qr-box" style="text-align:center;margin:14px 0"></div>' +
        '<div style="text-align:center;font-size:17px;font-weight:700">' + esc(addr) + "</div>" +
        (pin ? '<div style="text-align:center;margin-top:6px">Kopplungs-PIN: <strong style="font-size:20px;letter-spacing:2px">' + esc(pin) + "</strong></div>" : "") +
        (ips.length > 1 ? '<p class="hint" style="text-align:center">Alternative Adressen: ' + ips.slice(1).map(function (i) { return esc(i + ":" + port); }).join(", ") + "</p>" : "") +
        '<p class="hint">Scannen überträgt Adresse und PIN automatisch. Bei manueller Eingabe den PIN am Handy mit eintippen. Der PC bleibt empfangsbereit, solange dieses Fenster offen ist; eine Firewall-Abfrage bitte zulassen.</p>';
      openModal("📡 Geräte-Sync – dieser PC", body, null, "Fertig");
      zeichneQR($("#qr-box"), qrUrl);
    }).catch(function (e) { toast("Server-Start fehlgeschlagen: " + (e && e.message || e), "err"); });
  }

  // Handy-Seite: Adresse scannen/eingeben, Daten holen oder senden
  function syncModalHandy() {
    var last = "";
    try { last = w.localStorage.getItem("ps.sync.addr") || ""; } catch (e) {}
    var body = "<p>Daten mit dem PC abgleichen – beide im <strong>selben WLAN</strong>. Am PC: Stammdaten → Geräte-Sync.</p>" +
      fld2("PC-Adresse (z. B. 192.168.0.10:8765)", "sync-addr", last, "text") +
      fld2("Kopplungs-PIN (vom PC)", "sync-pin", "", "text") +
      '<div class="btn-row" style="margin-bottom:8px"><button class="btn sm" id="sync-scan" type="button">📷 QR-Code scannen</button></div>' +
      '<div id="scan-box" style="text-align:center"></div>' +
      '<hr class="sep">' +
      '<div class="btn-row">' +
        '<button class="btn primary" id="sync-pull" type="button">⬇️ Daten vom PC holen</button>' +
        '<button class="btn" id="sync-push" type="button">⬆️ Daten an PC senden</button>' +
      "</div>" +
      '<p class="hint">Der QR-Code überträgt Adresse und PIN automatisch. „Holen" überschreibt die Daten auf diesem Gerät, „Senden" die auf dem PC.</p>';
    openModal("📡 Geräte-Sync", body, null, "Schließen");
    var pinFeld = $("#sync-pin");
    $("#sync-scan").onclick = function () { starteScan($("#scan-box"), $("#sync-addr"), pinFeld); };
    $("#sync-pull").onclick = function () { syncPull($("#sync-addr").value, pinFeld.value); };
    $("#sync-push").onclick = function () { syncPush($("#sync-addr").value, pinFeld.value); };
  }

  function syncPull(addr, pin) {
    addr = normAddr(addr); pin = (pin || "").trim();
    if (!addr) { toast("Bitte PC-Adresse eingeben oder scannen.", "err"); return; }
    if (!pin) { toast("Bitte den Kopplungs-PIN vom PC eingeben (oder QR scannen).", "err"); return; }
    if (!confirm("Daten vom PC holen? Die Daten auf DIESEM Gerät werden überschrieben.")) return;
    try { w.localStorage.setItem("ps.sync.addr", addr); } catch (e) {}
    fetch("http://" + addr + "/pull?t=" + encodeURIComponent(pin), { cache: "no-store" })
      .then(function (r) { if (r.status === 403) throw new Error("PIN falsch"); if (!r.ok) throw new Error("PC antwortet nicht"); return r.text(); })
      .then(function (text) { var neu = Store.importJSON(text); db = neu; toast("Daten vom PC übernommen. ✅"); schliesseModal(); navTo("dashboard"); })
      .catch(function (e) { toast("Holen fehlgeschlagen: " + (e && e.message || e) + ". Gleiches WLAN? Adresse/PIN korrekt?", "err"); });
  }

  function syncPush(addr, pin) {
    addr = normAddr(addr); pin = (pin || "").trim();
    if (!addr) { toast("Bitte PC-Adresse eingeben oder scannen.", "err"); return; }
    if (!pin) { toast("Bitte den Kopplungs-PIN vom PC eingeben (oder QR scannen).", "err"); return; }
    if (!confirm("Daten an den PC senden? Die Daten auf dem PC werden überschrieben.")) return;
    try { w.localStorage.setItem("ps.sync.addr", addr); } catch (e) {}
    fetch("http://" + addr + "/push?t=" + encodeURIComponent(pin), { method: "POST", headers: { "Content-Type": "application/json" }, body: Store.exportJSON() })
      .then(function (r) { if (r.status === 403) throw new Error("PIN falsch"); if (!r.ok) throw new Error("PC antwortet nicht"); return r.text(); })
      .then(function () { toast("Daten an PC gesendet. ✅"); })
      .catch(function (e) { toast("Senden fehlgeschlagen: " + (e && e.message || e) + ". Gleiches WLAN? PIN korrekt?", "err"); });
  }

  // QR-Inhalt in Adresse + PIN zerlegen (URL mit ?t= oder reine Adresse).
  function uebernehmeScan(data, addrInput, pinInput) {
    try {
      var url = new URL(data);
      addrInput.value = normAddr(url.host);
      var t = url.searchParams.get("t");
      if (t && pinInput) pinInput.value = t;
    } catch (e) {
      addrInput.value = normAddr(data);
    }
  }

  // QR-Scan per Kamera (jsQR); manuelle Eingabe bleibt als Rückfallebene
  var _scanStop = false;
  function starteScan(box, addrInput, pinInput) {
    if (!w.jsQR || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast("Kamera nicht verfügbar – bitte Adresse manuell eingeben.", "err"); return;
    }
    box.innerHTML = '<video id="scan-video" playsinline muted style="width:100%;max-width:300px;border-radius:8px;background:#000"></video><canvas id="scan-canvas" style="display:none"></canvas>';
    var video = $("#scan-video", box), canvas = $("#scan-canvas", box), cx = canvas.getContext("2d");
    var stream = null; _scanStop = false;
    function ende() { _scanStop = true; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); box.innerHTML = ""; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (s) {
      stream = s; video.srcObject = s; video.setAttribute("playsinline", true); video.play();
      function tick() {
        if (_scanStop) return;
        // Modal geschlossen? -> Kamera freigeben statt endlos weiterzulaufen
        if (!d.body.contains(video)) { ende(); return; }
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          cx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            var img = cx.getImageData(0, 0, canvas.width, canvas.height);
            var code = w.jsQR(img.data, img.width, img.height);
            if (code && code.data) { uebernehmeScan(code.data, addrInput, pinInput); toast("Code erkannt: " + addrInput.value); ende(); return; }
          } catch (e) {}
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }).catch(function () { toast("Kamerazugriff nicht möglich – bitte Adresse manuell eingeben.", "err"); });
  }

  // ============================================================
  //  UPDATE-PRÜFUNG
  //  Vergleicht die eingebettete Build-Nummer (assets/build-info.json)
  //  mit der neuesten veröffentlichten Version (version.json im Release).
  //  Ist eine neuere Version verfügbar, erscheint ein Hinweis-Banner.
  // ============================================================
  var REPO = "warscher80/spanwerk-datenschutz";
  var UPDATE_APK_URL = "https://github.com/" + REPO + "/releases/download/app-latest/preisschmiede.apk";
  var UPDATE_EXE_URL = "https://github.com/" + REPO + "/releases/download/app-latest/preisschmiede-setup.exe";
  // GitHub-API (sendet CORS-Header, funktioniert daher in der App-WebView)
  var UPDATE_API_URL = "https://api.github.com/repos/" + REPO + "/releases/tags/app-latest";

  // Am PC (Electron) das Windows-Setup anbieten, am Handy die Android-APK.
  function istDesktop() { return !!(w.electronAPI && w.electronAPI.isDesktop); }
  function updateDownloadURL() { return istDesktop() ? UPDATE_EXE_URL : UPDATE_APK_URL; }
  function updateDownloadLabel() { return istDesktop() ? "Windows-Update laden" : "Jetzt aktualisieren"; }

  // Version "1.2.3" -> [1,2,3]; vergleicht major.minor.patch numerisch.
  function versionTupel(s) {
    var m = /(\d+)\.(\d+)\.(\d+)/.exec(String(s == null ? "" : s));
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  function versionNeuer(remote, lokal) {
    for (var i = 0; i < 3; i++) { if (remote[i] !== lokal[i]) return remote[i] > lokal[i]; }
    return false;
  }

  function pruefeUpdate() {
    // Eigene Version wird vom eingebetteten build-info.js gesetzt (window.PSBUILD).
    // Fehlt sie (z. B. Web-Vorschau), wird der Check still übersprungen.
    var lokal = w.PSBUILD;
    if (!lokal || typeof lokal.build !== "number" || !w.fetch) return;
    var lokalV = versionTupel(lokal.version) || [1, 0, lokal.build];
    fetch(UPDATE_API_URL, { cache: "no-store", headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rel) {
        if (!rel || !rel.body) return;
        var m = /Version\s+(\d+\.\d+\.\d+)/.exec(rel.body);
        if (!m) return;
        var remoteV = versionTupel(m[1]);
        if (remoteV && versionNeuer(remoteV, lokalV)) {
          zeigeUpdateBanner({ version: remoteV.join(".") });
        }
      })
      .catch(function () { /* offline o. ä. – still ignorieren, App läuft normal weiter */ });
  }

  function zeigeUpdateBanner(remote) {
    if ($("#update-banner")) return;
    var b = el("div", { id: "update-banner", class: "update-banner" });
    b.innerHTML = '<span>🔄 Neue Version verfügbar' + (remote.version ? " (" + esc(remote.version) + ")" : "") + "</span>" +
      '<div class="ub-actions">' +
        '<a class="btn primary sm" id="update-download" href="' + updateDownloadURL() + '" target="_blank" rel="noopener">' + updateDownloadLabel() + "</a>" +
        '<button class="btn ghost sm" id="update-later">Später</button>' +
      "</div>";
    d.body.appendChild(b);
    // Am PC den Download im Standardbrowser öffnen (Electron blockt target=_blank sonst).
    if (istDesktop() && w.electronAPI && w.electronAPI.openExternal) {
      $("#update-download").onclick = function (ev) {
        ev.preventDefault();
        try { w.electronAPI.openExternal(updateDownloadURL()); } catch (e) {}
      };
    }
    $("#update-later").onclick = function () { b.remove(); };
  }

  // ============================================================
  //  INIT
  // ============================================================
  // ============================================================
  //  ANMELDUNG & ROLLEN (UI)
  // ============================================================
  function ersteErlaubteSeite() {
    var kandidaten = ["dashboard", "auftraege", "kalkulation", "material", "kundenprojekte", "stammdaten", "lernen"];
    for (var i = 0; i < kandidaten.length; i++) { if (!Auth || Auth.darf(kandidaten[i])) return kandidaten[i]; }
    return "dashboard";
  }
  function wendeRollenNavAn() {
    $all(".nav li").forEach(function (li) {
      var erlaubt = !Auth || Auth.darf(li.dataset.page);
      li.hidden = !erlaubt;
      li.style.display = erlaubt ? "" : "none";
    });
    markierePilotFunktionen();
  }
  // Kennzeichnet Funktionen mit Pilotstatus (ab Freigabestufe Pilot) im Menü.
  var PILOT_NAV_SEITEN = { lernen: 1, planung: 1, dokumente: 1 };
  function markierePilotFunktionen() {
    var stufe = (db.settings.betrieb && db.settings.betrieb.releaseStufe) || "test";
    var aktiv = ["pilot", "eingeschraenkt"].indexOf(stufe) >= 0;
    $all(".nav li").forEach(function (li) {
      var alt = li.querySelector(".pilot-mark"); if (alt) alt.parentNode.removeChild(alt);
      if (aktiv && PILOT_NAV_SEITEN[li.dataset.page]) {
        var b = el("span", { title: "Pilotfunktion – im Pilot optional" }, "Pilot");
        b.className = "pilot-mark"; li.appendChild(b);
      }
    });
  }
  function aktualisiereUserBox() {
    var u = Auth && Auth.current();
    var box = $("#user-box");
    if (box) {
      box.innerHTML = u ? ('<div class="user-name">👤 ' + esc(u.name) + '</div>' +
        '<div class="user-rolle">' + esc(Auth.rolleLabel(u.rolle)) + "</div>" +
        '<button class="btn ghost sm" id="btn-logout" type="button">Abmelden</button>') : "";
      var lb = $("#btn-logout"); if (lb) lb.onclick = function () { Auth.logout(); zeigeLogin(); };
    }
    // Handy: Name in der Topbar + Abmelden-Button (Sidebar-Fuß ist mobil ausgeblendet)
    var um = $("#user-mobile"); if (um) um.textContent = u ? u.name : "";
    var lbm = $("#btn-logout-mobile");
    if (lbm) { lbm.hidden = !u; lbm.onclick = function () { Auth.logout(); zeigeLogin(); }; }
  }
  function verbergeLogin() { var o = $("#login-overlay"); if (o) o.hidden = true; }
  function zeigeLogin() {
    var o = $("#login-overlay"); if (!o) return;
    var sel = $("#login-user");
    var users = (Store.load().users || []).filter(function (x) { return x.aktiv !== false; });
    sel.innerHTML = users.map(function (x) { return '<option value="' + esc(x.benutzername) + '">' + esc(x.name) + " – " + esc(Auth.rolleLabel(x.rolle)) + "</option>"; }).join("");
    $("#login-pin").value = "";
    $("#login-fehler").hidden = true;
    o.hidden = false;
    try { $("#login-pin").focus(); } catch (e) {}
  }
  function starteNachLogin() {
    verbergeLogin();
    aktualisiereUserBox();
    aktualisiereMandantAnzeige();
    wendeRollenNavAn();
    initFeedbackButton();
    aktualisiereReleaseBanner();
    navTo(ersteErlaubteSeite());
    ersterLoginPinCheck();
    setupBeiBedarf();
  }
  // Beim ersten Login mit noch nicht geänderter PIN zum Wechsel auffordern.
  // Erzwungen erst ab Freigabestufe Pilot (in Entwicklung/Test nicht, damit
  // Demo-/Beispielbenutzer ungestört bleiben).
  function ersterLoginPinCheck() {
    var u = Auth.current(); if (!u || u.pinGeaendert) return;
    var stufe = (db.settings.betrieb && db.settings.betrieb.releaseStufe) || "test";
    if (["pilot", "eingeschraenkt", "produktion"].indexOf(stufe) < 0) return;
    setTimeout(function () {
      var body = '<p class="muted" style="font-size:13px">Bitte vergib zum Schutz deiner Daten eine eigene PIN (mind. 4 Ziffern). Die Standard-PIN ist unsicher.</p>' +
        '<label class="fld"><span class="lbl">Neue PIN</span><input type="password" id="pin-neu" inputmode="numeric" autocomplete="off"></label>' +
        '<label class="fld"><span class="lbl">Neue PIN wiederholen</span><input type="password" id="pin-neu2" inputmode="numeric" autocomplete="off"></label>';
      openModal("PIN ändern (Erst-Login)", body, function () {
        var p1 = $("#pin-neu").value, p2 = $("#pin-neu2").value;
        if (!/^\d{4,}$/.test(p1)) { toast("Mindestens 4 Ziffern.", "err"); return false; }
        if (p1 !== p2) { toast("PINs stimmen nicht überein.", "err"); return false; }
        if (p1 === "1234") { toast("Bitte nicht die Standard-PIN verwenden.", "err"); return false; }
        Auth.speichereUser({ id: u.id, name: u.name, benutzername: u.benutzername, rolle: u.rolle, aktiv: u.aktiv }, p1);
        var uu = Store.load().users.filter(function (x) { return x.id === u.id; })[0]; if (uu) { uu.pinGeaendert = true; Store.save(); }
        toast("PIN geändert. ✅"); return true;
      }, "PIN speichern");
    }, 400);
  }
  function initLogin() {
    var btn = $("#login-btn"); if (!btn) return;
    function versuch() {
      var benutzer = $("#login-user").value;
      var ok = Auth.login(benutzer, $("#login-pin").value);
      if (ok) { starteNachLogin(); }
      else {
        $("#login-fehler").hidden = false; $("#login-pin").value = ""; try { $("#login-pin").focus(); } catch (e) {}
        // Fehlgeschlagene Anmeldung protokollieren (ohne PIN)
        try { protokolliereFehler({ message: "Fehlgeschlagene Anmeldung für Benutzer „" + String(benutzer) + "\"" }, "anmeldung"); } catch (e) {}
      }
    }
    btn.onclick = versuch;
    $("#login-pin").addEventListener("keydown", function (e) { if (e.key === "Enter") versuch(); });
  }

  function init() {
    // Globale Fehlerabfangung: Die App soll nie komplett einfrieren; Fehler
    // werden ohne Secrets protokolliert und mit einer Fehler-ID versehen.
    w.addEventListener("error", function (ev) { console.error("Fehler abgefangen:", ev.error || ev.message); try { protokolliereFehler(ev.error || { message: ev.message }, "global"); } catch (e) {} });
    w.addEventListener("unhandledrejection", function (ev) { console.error("Hintergrund-Fehler abgefangen:", ev.reason); try { protokolliereFehler(ev.reason || { message: "unhandledrejection" }, "async"); } catch (e) {} });

    $all(".nav li").forEach(function (li) { li.onclick = function () { navTo(li.dataset.page); }; });
    var vtext = (w.PSBUILD && w.PSBUILD.version) ? "Version " + w.PSBUILD.version : "Web-Version";
    $all(".app-version").forEach(function (e) { e.textContent = vtext; });
    // Desktop (Electron): Daten an den Sync-Server spiegeln und Empfang verarbeiten
    if (w.electronAPI && w.electronAPI.isDesktop) {
      try {
        Store.onSave(function () { try { w.electronAPI.setData(Store.exportJSON()); } catch (e) {} });
        w.electronAPI.setData(Store.exportJSON());
        w.electronAPI.onPush(function (json) {
          if (confirm("Ein Gerät möchte Daten an diesen PC übertragen. Vorhandene Daten überschreiben?")) {
            try { db = Store.importJSON(json); toast("Daten vom Gerät übernommen. ✅"); navTo("dashboard"); }
            catch (e) { toast("Empfang fehlgeschlagen: " + (e && e.message || e), "err"); }
          }
        });
      } catch (e) { console.error(e); }
    }

    // Anmeldung: gemerkte Sitzung wiederherstellen, sonst Login-Overlay zeigen
    initLogin();
    var angemeldet = Auth && Auth.restore();
    if (angemeldet) { starteNachLogin(); }
    else { wendeRollenNavAn(); zeigeLogin(); }

    try { pruefeUpdate(); } catch (e) { console.error(e); }
    setInterval(function () { try { tickTimer(); } catch (e) { /* Timer-Tick darf nie stören */ } }, 1000);
  }

  function start() { try { init(); } catch (e) { console.error("Start-Fehler:", e); } }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start);
  else start();
})(window, document);
