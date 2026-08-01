/* ============================================================
   Preisschmiede – Qualitätsoberfläche (Phase 16B, Desktop)
   Vollständige QM-UI auf Basis des Phase-16A-Qualitätskerns
   (window.Preisschmiede.Qualitaet). KEINE zweite Prüf-, Toleranz-,
   Sperr- oder Reklamationslogik: jede Bewertung/Buchung läuft über
   die Engine. Bestände ausschließlich über den Lagerkern.
   EHRLICH: keine Normkonformität, keine Zertifizierung, keine
   automatische Schuldzuweisung, keine qualifizierte Signatur.
   ============================================================ */
(function (w, d) {
  "use strict";
  var P = w.Preisschmiede = w.Preisschmiede || {};
  function Store() { return P.Store; }
  function Q() { return P.Qualitaet; }
  function L() { return P.Lager; }
  function Auth() { return P.Auth; }
  function UI() { return P.UI || {}; }

  var TAB = "dashboard";
  var _root = null;
  var filter = { von: "", bis: "", kommission: "", produktgruppeKey: "", maschineId: "", artikelId: "", chargeId: "", pruefstatus: "", fehlerart: "", verantwortlicher: "" };
  var planEdit = null;   // { plan, schritte } im Editor
  var pruefLauf = null;  // { paId, index }

  // ---- Hilfen ----
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
  function fmt(n) { return (Math.round(num(n) * 1000) / 1000).toLocaleString("de-AT"); }
  function fmtEUR(n) { return num(n).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
  function fmtDate(iso) { try { return iso ? new Date(iso).toLocaleDateString("de-AT") : "—"; } catch (e) { return "—"; } }
  function fmtDT(iso) { try { return iso ? new Date(iso).toLocaleString("de-AT") : "—"; } catch (e) { return "—"; } }
  function toast(m, k) { if (UI().toast) UI().toast(m, k); }
  function rolle() { var a = Auth(); return a && a.current() ? a.current().rolle : null; }
  function benutzer() { var a = Auth(); return a && a.current() ? a.current().benutzername : null; }
  function darf(r) { return Q().darf(rolle(), r); }
  function kurz(id) { return String(id || "").replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase(); }

  function st() {
    var db = Store().load();
    return {
      _db: db, stammdaten: (db.settings.qualitaet || {}).stammdaten || Q().standardStammdaten(),
      pruefplaene: db.qualPruefplaene, pruefauftraege: db.qualPruefauftraege, abweichungen: db.qualAbweichungen,
      sperren: db.qualSperren, nacharbeiten: db.qualNacharbeiten, ausschuss: db.qualAusschuss,
      sonderfreigaben: db.qualSonderfreigaben, massnahmen: db.qualMassnahmen, reklamationen: db.qualReklamationen,
      lieferantenReklamationen: db.qualLieferantenReklamationen, pruefmittel: db.qualPruefmittel,
      qualitaetskosten: db.qualKosten, audit: db.qualAudit, wareneingangspruefungen: db.qualWareneingangspruefungen,
      konflikte: db.qualKonflikte, abnahmen: db.qualAbnahmen, portalFreigaben: db.qualPortalFreigaben
    };
  }
  function lagerState() {
    var db = Store().load();
    return { artikel: db.lagerArtikel, plaetze: db.lagerplaetze, chargen: db.lagerChargen, bewegungen: db.lagerBewegungen, reservierungen: db.lagerReservierungen, reststuecke: db.lagerReststuecke, wareneingaenge: db.wareneingaenge, bestellungen: db.bestellungen, konflikte: db.lagerKonflikte, inventuren: db.lagerInventuren };
  }
  function save() { Store().save(); }
  function refresh() { if (_root) render(_root); }
  function jetzt() { return Store().nowISO(); }

  function tableWrap(headers, rows) {
    if (!rows.length) return '<div class="empty">Keine Einträge.</div>';
    return '<div class="table-wrap"><table class="table"><thead><tr>' + headers.map(function (x) { return "<th>" + x + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  // Status nie NUR über Farbe: immer Symbol + Text.
  function statusTag(text, art) {
    var sym = { ok: "✓", err: "✕", warn: "!", info: "•", wait: "…" }[art || "info"] || "•";
    return '<span class="tag ' + (art === "ok" ? "" : art === "err" ? "warn" : art || "") + '">' + sym + " " + esc(text) + "</span>";
  }
  function ergebnisTag(erg) {
    var T = Q().TOLERANZ_ERGEBNIS;
    if (erg === T.INNERHALB) return statusTag("bestanden", "ok");
    if (erg === T.AUSSERHALB) return statusTag("außerhalb Toleranz", "err");
    if (erg === T.NACHPRUEFUNG) return statusTag("Nachprüfung erforderlich", "warn");
    return statusTag("nicht bewertbar", "info");
  }
  function csvDownload(name, csv) {
    try {
      var blob = new w.Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      var url = w.URL.createObjectURL(blob); var a = d.createElement("a"); a.href = url; a.download = name; d.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { w.URL.revokeObjectURL(url); }, 1000);
      toast("CSV exportiert: " + name);
    } catch (e) { toast("Export nicht möglich.", "err"); }
  }

  // ---- PDF/Druckansicht (A4, mehrseitig, Kopf/Fuß, Seitenzahlen) ----
  function pdfFenster(titel, kennung, innerHtml, meta) {
    var db = st()._db; var firma = (db.settings.firma || {});
    var win = w.open("", "_blank"); if (!win) { toast("Pop-up blockiert – bitte erlauben.", "err"); return; }
    var kopf = '<div class="qhead"><div><div class="qfirma">' + esc(firma.name || "Preisschmiede") + "</div>" +
      '<div class="qsmall">' + esc(firma.strasse || "") + " " + esc(firma.plz || "") + " " + esc(firma.ort || "") + "</div></div>" +
      '<div style="text-align:right"><div class="qtitel">' + esc(titel) + '</div><div class="qsmall">Dokument ' + esc(kennung) + " · " + fmtDate(jetzt()) + "</div></div></div>";
    var metaHtml = (meta || []).length ? '<table class="qmeta"><tbody>' + (meta || []).map(function (m) { return "<tr><th>" + esc(m[0]) + "</th><td>" + (m[1] == null ? "—" : m[1]) + "</td></tr>"; }).join("") + "</tbody></table>" : "";
    var css = "@page{size:A4;margin:18mm 16mm 22mm}" +
      "*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#15202b;font-size:11.5px;line-height:1.45;margin:0}" +
      ".qhead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #15202b;padding-bottom:8px;margin-bottom:12px}" +
      ".qfirma{font-weight:800;font-size:15px}.qtitel{font-weight:800;font-size:16px}.qsmall{font-size:10px;color:#556}" +
      "table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #c3ccd6;padding:4px 6px;text-align:left;vertical-align:top}" +
      "thead th{background:#eef2f6}.qmeta th{width:32%;background:#f6f8fa}" +
      "h2{font-size:13px;margin:14px 0 4px;border-bottom:1px solid #c3ccd6;padding-bottom:3px}" +
      ".ok{color:#166534;font-weight:700}.err{color:#9a1c13;font-weight:700}.warn{color:#8a5a00;font-weight:700}" +
      ".qfoot{position:fixed;bottom:8mm;left:16mm;right:16mm;font-size:9px;color:#667;border-top:1px solid #c3ccd6;padding-top:4px;display:flex;justify-content:space-between}" +
      ".qhinweis{background:#fff7e6;border:1px solid #e0b050;padding:6px 8px;font-size:10px;margin:8px 0}" +
      "tr,table{page-break-inside:auto}td,th{page-break-inside:avoid}h2{page-break-after:avoid}" +
      // Druck-Button unten rechts, damit er die Kopfzeile nie überdeckt
      ".noprint{position:fixed;bottom:14px;right:14px;z-index:99;padding:10px 16px;border:1px solid #15202b;border-radius:6px;background:#f5a623;font-weight:700;cursor:pointer}" +
      "@media print{.noprint{display:none}.qfoot{position:fixed}}";
    var fuss = '<div class="qfoot"><span>' + esc(firma.name || "Preisschmiede") + " · " + esc(kennung) + '</span><span class="qseite"></span></div>';
    win.document.write('<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>' + esc(titel) + " " + esc(kennung) + "</title><style>" + css + "</style></head><body>" +
      '<button class="noprint" onclick="window.print()">Drucken / PDF</button>' + kopf + metaHtml + innerHtml + fuss +
      '<script>document.querySelector(".qseite").textContent="Seite 1 von "+Math.max(1,Math.ceil(document.body.scrollHeight/1050));<\/script></body></html>');
    win.document.close(); win.focus();
  }

  // ============================================================
  //  RENDER + SUB-NAV
  // ============================================================
  var TABS = [
    ["dashboard", "Dashboard"], ["pruefplaene", "Prüfpläne"], ["pruefauftraege", "Prüfaufträge"],
    ["abweichungen", "Abweichungen"], ["sperren", "Sperren"], ["nacharbeit", "Nacharbeit"],
    ["ausschuss", "Ausschuss"], ["reklamationen", "Reklamationen"], ["lieferanten", "Lieferanten"],
    ["massnahmen", "Maßnahmen"], ["pruefmittel", "Prüfmittel"], ["abnahmen", "Abnahmen"],
    ["portal", "Portalfreigaben"], ["berichte", "Berichte"], ["hinweise", "Lernhinweise"]
  ];
  function render(root) {
    _root = root;
    if (!Q()) { root.innerHTML = '<div class="empty">Qualitätskern nicht geladen.</div>'; return; }
    var nav = '<div class="inline" style="flex-wrap:wrap;gap:6px;margin-bottom:14px">' + TABS.map(function (t) {
      return '<button class="btn sm ' + (TAB === t[0] ? "primary" : "ghost") + '" data-qtab="' + t[0] + '">' + esc(t[1]) + "</button>";
    }).join("") + "</div>";
    var body = "";
    try {
      body = ({
        dashboard: viewDashboard, pruefplaene: viewPruefplaene, pruefauftraege: viewPruefauftraege,
        abweichungen: viewAbweichungen, sperren: viewSperren, nacharbeit: viewNacharbeit,
        ausschuss: viewAusschuss, reklamationen: viewReklamationen, lieferanten: viewLieferanten,
        massnahmen: viewMassnahmen, pruefmittel: viewPruefmittel, abnahmen: viewAbnahmen,
        portal: viewPortal, berichte: viewBerichte, hinweise: viewHinweise
      }[TAB] || viewDashboard)();
    } catch (e) { body = '<div class="empty">Ansicht konnte nicht geladen werden.</div>'; console.error(e); }
    root.innerHTML = nav + body;
    root.querySelectorAll("[data-qtab]").forEach(function (b) { b.onclick = function () { TAB = b.getAttribute("data-qtab"); render(root); }; });
    try { wire(root); } catch (e) { console.error(e); }
  }

  // ============================================================
  //  1) QUALITÄTSDASHBOARD
  // ============================================================
  function statCard(label, wert, cls) { return '<div class="stat"><div class="label">' + esc(label) + '</div><div class="value ' + (cls || "") + '">' + wert + "</div></div>"; }
  function filterLeiste() {
    var s = st(); var db = s._db;
    var kommissionen = {}; (db.auftraege || []).forEach(function (a) { if (a.kommission) kommissionen[a.kommission] = true; });
    var fehlerarten = (s.stammdaten.fehlerarten || []);
    var maschinen = ((db.settings || {}).maschinen || []);
    var opt = function (arr, sel, leer) { return '<option value="">' + leer + "</option>" + arr.map(function (x) { var v = typeof x === "string" ? x : x.id, l = typeof x === "string" ? x : (x.name || x.id); return '<option value="' + esc(v) + '"' + (sel === v ? " selected" : "") + ">" + esc(l) + "</option>"; }).join(""); };
    return '<div class="card"><div class="inline" style="flex-wrap:wrap;gap:8px;align-items:flex-end">' +
      '<label class="fld" style="margin:0;max-width:150px"><span class="lbl">Von</span><input type="date" id="qf-von" value="' + esc(filter.von) + '"></label>' +
      '<label class="fld" style="margin:0;max-width:150px"><span class="lbl">Bis</span><input type="date" id="qf-bis" value="' + esc(filter.bis) + '"></label>' +
      '<label class="fld" style="margin:0;max-width:180px"><span class="lbl">Kommission</span><select id="qf-komm">' + opt(Object.keys(kommissionen), filter.kommission, "alle") + "</select></label>" +
      '<label class="fld" style="margin:0;max-width:170px"><span class="lbl">Produktgruppe</span><select id="qf-pg">' + opt((db.produktgruppen || []).map(function (g) { return { id: g.key, name: g.name }; }), filter.produktgruppeKey, "alle") + "</select></label>" +
      '<label class="fld" style="margin:0;max-width:160px"><span class="lbl">Maschine</span><select id="qf-masch">' + opt(maschinen, filter.maschineId, "alle") + "</select></label>" +
      '<label class="fld" style="margin:0;max-width:160px"><span class="lbl">Material</span><select id="qf-art">' + opt((db.lagerArtikel || []).map(function (a) { return { id: a.id, name: a.artikelnummer }; }), filter.artikelId, "alle") + "</select></label>" +
      '<label class="fld" style="margin:0;max-width:160px"><span class="lbl">Charge</span><select id="qf-ch">' + opt((db.lagerChargen || []).map(function (c) { return { id: c.id, name: c.chargennummer }; }), filter.chargeId, "alle") + "</select></label>" +
      '<label class="fld" style="margin:0;max-width:170px"><span class="lbl">Prüfstatus</span><select id="qf-status">' + opt(Object.keys(Q().PA_STATUS).map(function (k) { return Q().PA_STATUS[k]; }), filter.pruefstatus, "alle") + "</select></label>" +
      '<label class="fld" style="margin:0;max-width:170px"><span class="lbl">Fehlerart</span><select id="qf-fa">' + opt(fehlerarten, filter.fehlerart, "alle") + "</select></label>" +
      '<label class="fld" style="margin:0;max-width:160px"><span class="lbl">Verantwortlicher</span><select id="qf-ver">' + opt((db.users || []).map(function (u) { return { id: u.benutzername, name: u.name }; }), filter.verantwortlicher, "alle") + "</select></label>" +
      '<button class="btn sm ghost" id="qf-reset" style="flex:0 0 auto">Filter zurücksetzen</button>' +
      "</div></div>";
  }
  function viewDashboard() {
    var s = st(); var dash = Q().dashboard(s, filter, jetzt());
    var kosten = darf("qualitaetskostenSehen") ? statCard("Qualitätskosten", fmtEUR(dash.qualitaetskosten), "accent") : statCard("Qualitätskosten", "🔒 gesperrt");
    var html = filterLeiste();
    html += '<div class="card"><h3>Prüfungen</h3><div class="grid cols-4">' +
      statCard("Offene Prüfaufträge", dash.offenePruefauftraege) +
      statCard("Überfällige Prüfungen", dash.ueberfaelligePruefungen, dash.ueberfaelligePruefungen ? "warn" : "") +
      statCard("Bestanden", dash.bestanden, "green") +
      statCard("Nicht bestanden", dash.nichtBestanden, dash.nichtBestanden ? "warn" : "") +
      '</div><div class="grid cols-4" style="margin-top:12px">' +
      statCard("Offene Abweichungen", dash.offeneAbweichungen, dash.offeneAbweichungen ? "warn" : "") +
      statCard("Gesperrte Bauteile", dash.gesperrteBauteile, dash.gesperrteBauteile ? "warn" : "") +
      statCard("Gesperrte Chargen", dash.gesperrteChargen, dash.gesperrteChargen ? "warn" : "") +
      statCard("Offene Nachprüfungen", dash.offeneNachpruefungen) + "</div></div>";
    html += '<div class="card"><h3>Nacharbeit, Ausschuss &amp; Kosten</h3><div class="grid cols-4">' +
      statCard("Offene Nacharbeiten", dash.offeneNacharbeiten) +
      statCard("Nacharbeitsstunden", fmt(dash.nacharbeitsstunden) + " h") +
      statCard("Ausschussquote", fmt(dash.ausschussquoteProz) + " %", dash.ausschussquoteProz > 5 ? "warn" : "") +
      kosten + "</div></div>";
    html += '<div class="card"><h3>Reklamationen, Prüfmittel &amp; Maßnahmen</h3><div class="grid cols-4">' +
      statCard("Kundenreklamationen", dash.kundenreklamationen, dash.kundenreklamationen ? "warn" : "") +
      statCard("Lieferantenreklamationen", dash.lieferantenreklamationen) +
      statCard("Fällige Prüfmittel", dash.faelligePruefmittel, dash.faelligePruefmittel ? "warn" : "") +
      statCard("Offene Korrekturmaßnahmen", dash.offeneKorrekturmassnahmen) + "</div>" +
      (dash.ueberfaelligeMassnahmen ? '<div class="insight" style="margin-top:10px"><span class="ico">⚠️</span><span>' + dash.ueberfaelligeMassnahmen + " Korrekturmaßnahme(n) sind überfällig.</span></div>" : "") + "</div>";
    html += '<div class="insight"><span class="ico">ℹ️</span><span>Es werden bewusst <strong>keine Mitarbeiter-Ranglisten</strong> dargestellt. Kennzahlen sind Auswertungen, keine Leistungsbewertung einzelner Personen.</span></div>';
    return html;
  }

  // ============================================================
  //  2) PRÜFPLANVERWALTUNG
  // ============================================================
  function viewPruefplaene() {
    if (planEdit) return viewPlanEditor();
    var s = st();
    var rows = s.pruefplaene.slice().reverse().map(function (p) {
      var acts = '<button class="btn xs ghost" data-ppview="' + esc(p.id) + '">Vorschau</button> ';
      if (darf("pruefplanErstellen")) acts += '<button class="btn xs" data-ppedit="' + esc(p.id) + '">Bearbeiten</button> ';
      if (darf("pruefplanErstellen")) acts += '<button class="btn xs" data-ppver="' + esc(p.id) + '">Neue Version</button> ';
      if (darf("pruefplanFreigeben") && p.freigabestatus !== Q().FREIGABE_STATUS.FREIGEGEBEN) acts += '<button class="btn xs primary" data-ppfrei="' + esc(p.id) + '">Freigeben</button> ';
      if (darf("pruefplanErstellen")) acts += '<button class="btn xs ghost" data-ppakt="' + esc(p.id) + '">' + (p.aktiv ? "Deaktivieren" : "Aktivieren") + "</button> ";
      if (p.vorgaengerId) acts += '<button class="btn xs ghost" data-ppdiff="' + esc(p.id) + '">Vergleich</button>';
      return [esc(p.nummer), esc(p.bezeichnung), "v" + p.version, esc(p.produktgruppeKey || "—") + " / " + esc(p.arbeitsgang || "—"),
        p.freigabestatus === Q().FREIGABE_STATUS.FREIGEGEBEN ? statusTag("freigegeben", "ok") : statusTag(p.freigabestatus, "wait"),
        p.aktiv ? statusTag("aktiv", "ok") : statusTag("inaktiv", "info"), p.schritte.length, acts];
    });
    var head = darf("pruefplanErstellen") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-ppneu="1">+ Neuer Prüfplan</button></div><div class="muted" style="font-size:12px;margin-top:6px">Normen und Prüfvorschriften sind reine Freitext-Referenzen – es wird keine Normkonformität behauptet. Bestehende Auftrags-Snapshots bleiben bei Änderungen unverändert.</div></div>' : "";
    return head + '<div class="card"><h3>Prüfpläne</h3>' + tableWrap(["Nummer", "Bezeichnung", "Version", "Gruppe/Arbeitsgang", "Freigabe", "Aktiv", "Schritte", "Aktion"], rows) + "</div>";
  }
  function planEditorOeffnen(planId, alsNeueVersion) {
    var s = st();
    if (planId) {
      var p = Q().pruefplanById(s, planId);
      planEdit = { id: alsNeueVersion ? null : p.id, quelleId: p.id, neueVersion: !!alsNeueVersion, daten: JSON.parse(JSON.stringify(p)) };
    } else {
      planEdit = { id: null, quelleId: null, neueVersion: false, daten: { nummer: "", bezeichnung: "", produktgruppeKey: "", arbeitsgang: "", kundeId: "", verantwortlicheRolle: "", beschreibung: "", referenz: "", schritte: [] } };
    }
    refresh();
  }
  function viewPlanEditor() {
    var s = st(); var db = s._db; var pd = planEdit.daten;
    var gruppen = (db.produktgruppen || []).map(function (g) { return '<option value="' + esc(g.key) + '"' + (pd.produktgruppeKey === g.key ? " selected" : "") + ">" + esc(g.name) + "</option>"; }).join("");
    var schritte = (P.Products ? P.Products.SCHRITTE : []).map(function (x) { return '<option value="' + esc(x.key) + '"' + (pd.arbeitsgang === x.key ? " selected" : "") + ">" + esc(x.label) + "</option>"; }).join("");
    var kunden = (db.kunden || []).map(function (k) { return '<option value="' + esc(k.id) + '"' + (pd.kundeId === k.id ? " selected" : "") + ">" + esc(k.name) + "</option>"; }).join("");
    var titel = planEdit.neueVersion ? "Neue Version von " + esc(pd.nummer) + " (v" + (num(pd.version) + 1) + ")" : (planEdit.id ? "Prüfplan bearbeiten" : "Neuer Prüfplan");
    var html = '<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">' + titel + '</h3><button class="btn sm ghost" id="pe-back">‹ Zurück</button></div>' +
      '<div class="grid cols-2" style="margin-top:10px">' +
      '<label class="fld"><span class="lbl">Prüfplannummer</span><input id="pe-nummer" value="' + esc(pd.nummer || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Bezeichnung</span><input id="pe-bez" value="' + esc(pd.bezeichnung || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Produktgruppe</span><select id="pe-pg"><option value="">—</option>' + gruppen + "</select></label>" +
      '<label class="fld"><span class="lbl">Arbeitsgang</span><select id="pe-ag"><option value="">—</option>' + schritte + "</select></label>" +
      '<label class="fld"><span class="lbl">Kunde (optional)</span><select id="pe-kunde"><option value="">—</option>' + kunden + "</select></label>" +
      '<label class="fld"><span class="lbl">Verantwortliche Rolle</span><select id="pe-rolle"><option value="">—</option><option value="werkstatt"' + (pd.verantwortlicheRolle === "werkstatt" ? " selected" : "") + '>Werkstatt</option><option value="buero"' + (pd.verantwortlicheRolle === "buero" ? " selected" : "") + '>Büro</option><option value="admin"' + (pd.verantwortlicheRolle === "admin" ? " selected" : "") + ">Administration</option></select></label>" +
      '<label class="fld"><span class="lbl">Beschreibung</span><input id="pe-beschr" value="' + esc(pd.beschreibung || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Norm-/Kundenreferenz (Freitext)</span><input id="pe-ref" value="' + esc(pd.referenz || "") + '" placeholder="z. B. Kundenvorgabe BV …"></label>' +
      '</div><div class="insight"><span class="ico">ℹ️</span><span>Die Referenz ist ein <strong>reiner Freitext</strong>. Es wird keine Normkonformität oder Zertifizierung behauptet.</span></div></div>';
    var srows = (pd.schritte || []).map(function (x, i) {
      return [x.nummer, esc(x.bezeichnung || "—"), esc(x.pruefzeitpunkt || "—"), esc(x.merkmalTyp),
        (x.sollwert != null ? fmt(x.sollwert) + " " + esc(x.einheit || "") : "—"),
        (x.obereToleranz != null || x.untereToleranz != null ? "+" + fmt(x.obereToleranz) + " / −" + fmt(Math.abs(num(x.untereToleranz))) : "—"),
        (x.pflicht !== false ? "Pflicht " : "") + (x.beiFehlerSperren ? "· sperrt " : "") + (x.fotoErforderlich ? "· Foto " : "") + (x.dokumentErforderlich ? "· Dok " : "") + (x.freigabeErforderlich ? "· Freigabe" : ""),
        '<button class="btn xs" data-seedit="' + i + '">Bearbeiten</button> <button class="btn xs ghost" data-seddel="' + i + '">Entfernen</button>'];
    });
    html += '<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">Prüfschritte</h3><button class="btn sm" id="pe-schritt-neu">+ Prüfschritt</button></div>' +
      tableWrap(["Nr.", "Bezeichnung", "Zeitpunkt", "Typ", "Soll", "Toleranz", "Optionen", "Aktion"], srows) + "</div>";
    html += '<div class="card"><div class="btn-row"><button class="btn primary" id="pe-save">Speichern</button><button class="btn ghost" id="pe-cancel">Abbrechen</button></div></div>';
    return html;
  }
  function schrittDialog(index) {
    editorFelderUebernehmen();
    var pd = planEdit.daten;
    var x = index != null ? pd.schritte[index] : { nummer: (pd.schritte.length + 1), merkmalTyp: "mass", pflicht: true, stichprobe: 1 };
    var s = st();
    var zpOpt = Q().PRUEFZEITPUNKT.map(function (z) { return '<option' + (x.pruefzeitpunkt === z ? " selected" : "") + ">" + esc(z) + "</option>"; }).join("");
    var typOpt = Q().MERKMAL_TYP.map(function (z) { return '<option value="' + z + '"' + (x.merkmalTyp === z ? " selected" : "") + ">" + esc(z) + "</option>"; }).join("");
    var merkOpt = '<option value="">—</option>' + (s.stammdaten.pruefmerkmale || []).map(function (z) { return '<option' + (x.merkmal === z ? " selected" : "") + ">" + esc(z) + "</option>"; }).join("");
    var methOpt = '<option value="">—</option>' + (s.stammdaten.pruefmethoden || []).map(function (z) { return '<option' + (x.methode === z ? " selected" : "") + ">" + esc(z) + "</option>"; }).join("");
    var pmOpt = '<option value="">—</option>' + s.pruefmittel.map(function (p) { return '<option value="' + esc(p.id) + '"' + (x.pruefmittelId === p.id ? " selected" : "") + ">" + esc(p.nummer + " " + p.bezeichnung) + "</option>"; }).join("");
    var chk = function (id, label, val) { return '<label class="inline" style="gap:6px;font-size:13px;margin-right:12px"><input type="checkbox" id="' + id + '"' + (val ? " checked" : "") + "> " + label + "</label>"; };
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Nummer</span><input id="se-nr" type="number" min="1" value="' + num(x.nummer) + '"></label>' +
      '<label class="fld"><span class="lbl">Bezeichnung</span><input id="se-bez" value="' + esc(x.bezeichnung || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Beschreibung</span><input id="se-beschr" value="' + esc(x.beschreibung || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Prüfzeitpunkt</span><select id="se-zp">' + zpOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Merkmal</span><select id="se-merk">' + merkOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Merkmaltyp</span><select id="se-typ">' + typOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Sollwert</span><input id="se-soll" type="number" step="any" value="' + (x.sollwert != null ? x.sollwert : "") + '"></label>' +
      '<label class="fld"><span class="lbl">Einheit</span><input id="se-einheit" value="' + esc(x.einheit || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Obere Toleranz</span><input id="se-ot" type="number" step="any" value="' + (x.obereToleranz != null ? x.obereToleranz : "") + '"></label>' +
      '<label class="fld"><span class="lbl">Untere Toleranz</span><input id="se-ut" type="number" step="any" value="' + (x.untereToleranz != null ? x.untereToleranz : "") + '"></label>' +
      '<label class="fld"><span class="lbl">Methode</span><select id="se-meth">' + methOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Prüfmittel</span><select id="se-pm">' + pmOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Stichprobengröße</span><input id="se-stich" type="number" min="1" value="' + num(x.stichprobe || 1) + '"></label>' +
      '<label class="fld"><span class="lbl">Verantwortliche Rolle</span><input id="se-rolle" value="' + esc(x.rolle || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Auswahlwerte (Komma, nur Typ „auswahl")</span><input id="se-ausw" value="' + esc((x.auswahl || []).join(", ")) + '"></label>' +
      "</div><div style='margin-top:6px'>" + chk("se-pflicht", "Pflichtprüfung", x.pflicht !== false) + chk("se-foto", "Foto erforderlich", x.fotoErforderlich) +
      chk("se-dok", "Dokument erforderlich", x.dokumentErforderlich) + chk("se-frei", "Freigabe erforderlich", x.freigabeErforderlich) +
      chk("se-sperr", "bei Fehler sperren", x.beiFehlerSperren) + "</div>";
    UI().openModalWide("Prüfschritt", body, function () {
      var neu = {
        nummer: num(d.getElementById("se-nr").value) || 1, bezeichnung: d.getElementById("se-bez").value, beschreibung: d.getElementById("se-beschr").value,
        pruefzeitpunkt: d.getElementById("se-zp").value, merkmal: d.getElementById("se-merk").value || null, merkmalTyp: d.getElementById("se-typ").value,
        sollwert: d.getElementById("se-soll").value !== "" ? num(d.getElementById("se-soll").value) : null, einheit: d.getElementById("se-einheit").value || null,
        obereToleranz: d.getElementById("se-ot").value !== "" ? num(d.getElementById("se-ot").value) : null,
        untereToleranz: d.getElementById("se-ut").value !== "" ? num(d.getElementById("se-ut").value) : null,
        methode: d.getElementById("se-meth").value || null, pruefmittelId: d.getElementById("se-pm").value || null,
        stichprobe: num(d.getElementById("se-stich").value) || 1, rolle: d.getElementById("se-rolle").value || null,
        auswahl: d.getElementById("se-ausw").value ? d.getElementById("se-ausw").value.split(",").map(function (z) { return z.trim(); }).filter(Boolean) : null,
        pflicht: d.getElementById("se-pflicht").checked, fotoErforderlich: d.getElementById("se-foto").checked,
        dokumentErforderlich: d.getElementById("se-dok").checked, freigabeErforderlich: d.getElementById("se-frei").checked,
        beiFehlerSperren: d.getElementById("se-sperr").checked
      };
      if (index != null) pd.schritte[index] = neu; else pd.schritte.push(neu);
      pd.schritte.sort(function (a, b) { return num(a.nummer) - num(b.nummer); });
      refresh(); return true;
    }, "", null);
  }
  // Kopffelder in den Editor-Zustand übernehmen, BEVOR neu gerendert wird –
  // sonst gingen Eingaben beim Öffnen des Prüfschritt-Dialogs verloren.
  function editorFelderUebernehmen() {
    if (!planEdit) return;
    var pd = planEdit.daten;
    var v = function (id) { var el = d.getElementById(id); return el ? el.value : null; };
    if (v("pe-nummer") !== null) pd.nummer = v("pe-nummer");
    if (v("pe-bez") !== null) pd.bezeichnung = v("pe-bez");
    if (v("pe-pg") !== null) pd.produktgruppeKey = v("pe-pg") || null;
    if (v("pe-ag") !== null) pd.arbeitsgang = v("pe-ag") || null;
    if (v("pe-kunde") !== null) pd.kundeId = v("pe-kunde") || null;
    if (v("pe-rolle") !== null) pd.verantwortlicheRolle = v("pe-rolle") || null;
    if (v("pe-beschr") !== null) pd.beschreibung = v("pe-beschr");
    if (v("pe-ref") !== null) pd.referenz = v("pe-ref");
  }
  function planSpeichern() {
    var s = st();
    editorFelderUebernehmen();
    var pd = planEdit.daten;
    if (!pd.bezeichnung) { toast("Bezeichnung erforderlich.", "err"); return; }
    if (planEdit.neueVersion) {
      var r = Q().pruefplanNeueVersion(s, planEdit.quelleId, { benutzer: benutzer(), bezeichnung: pd.bezeichnung, beschreibung: pd.beschreibung, referenz: pd.referenz, produktgruppeKey: pd.produktgruppeKey, arbeitsgang: pd.arbeitsgang, kundeId: pd.kundeId, verantwortlicheRolle: pd.verantwortlicheRolle, schritte: pd.schritte }, jetzt());
      if (!r.ok) { toast(r.grund, "err"); return; }
      toast("Version v" + r.pruefplan.version + " angelegt (Vorgänger unverändert).");
    } else if (planEdit.id) {
      var p = Q().pruefplanById(s, planEdit.id);
      ["nummer", "bezeichnung", "produktgruppeKey", "arbeitsgang", "kundeId", "verantwortlicheRolle", "beschreibung", "referenz"].forEach(function (k) { p[k] = pd[k]; });
      p.schritte = pd.schritte.map(Q().schrittNeu); p.geaendert = jetzt();
      Q().audit(s, { mandantId: p.mandantId, benutzer: benutzer(), aktion: "pruefplan.bearbeitet", referenzTyp: "pruefplan", referenzId: p.id, nachher: p.nummer }, jetzt());
      toast("Prüfplan gespeichert (bestehende Auftrags-Snapshots bleiben unverändert).");
    } else {
      Q().pruefplanNeu(s, { mandantId: null, nummer: pd.nummer, bezeichnung: pd.bezeichnung, produktgruppeKey: pd.produktgruppeKey, arbeitsgang: pd.arbeitsgang, kundeId: pd.kundeId, verantwortlicheRolle: pd.verantwortlicheRolle, beschreibung: pd.beschreibung, referenz: pd.referenz, schritte: pd.schritte, benutzer: benutzer() }, jetzt());
      toast("Prüfplan angelegt (Entwurf – Freigabe separat).");
    }
    save(); planEdit = null; refresh();
  }
  function planVorschau(planId) {
    var s = st(); var p = Q().pruefplanById(s, planId); if (!p) return;
    var rows = p.schritte.map(function (x) {
      return "<tr><td>" + x.nummer + "</td><td>" + esc(x.bezeichnung) + "</td><td>" + esc(x.pruefzeitpunkt) + "</td><td>" + esc(x.merkmalTyp) + "</td><td>" +
        (x.sollwert != null ? fmt(x.sollwert) + " " + esc(x.einheit || "") : "—") + "</td><td>" +
        (x.obereToleranz != null || x.untereToleranz != null ? "+" + fmt(x.obereToleranz) + " / −" + fmt(Math.abs(num(x.untereToleranz))) : "—") + "</td><td>" +
        (x.pflicht !== false ? "Pflicht" : "optional") + (x.beiFehlerSperren ? ", sperrt" : "") + "</td></tr>";
    }).join("");
    pdfFenster("Prüfplan " + p.nummer + " v" + p.version, "PP-" + kurz(p.id), "<h2>Prüfschritte</h2><table><thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Zeitpunkt</th><th>Typ</th><th>Soll</th><th>Toleranz</th><th>Optionen</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      '<div class="qhinweis">Norm-/Kundenreferenz: ' + esc(p.referenz || "—") + " — reine Freitext-Referenz. Es wird <strong>keine Normkonformität und keine Zertifizierung</strong> behauptet.</div>",
      [["Bezeichnung", esc(p.bezeichnung)], ["Produktgruppe / Arbeitsgang", esc(p.produktgruppeKey || "—") + " / " + esc(p.arbeitsgang || "—")], ["Version", "v" + p.version], ["Freigabestatus", esc(p.freigabestatus)], ["Beschreibung", esc(p.beschreibung || "—")]]);
  }
  function planVergleich(planId) {
    var s = st(); var neu = Q().pruefplanById(s, planId); if (!neu || !neu.vorgaengerId) { toast("Kein Vorgänger vorhanden.", "err"); return; }
    var alt = Q().pruefplanById(s, neu.vorgaengerId);
    var nummern = {}; (alt.schritte || []).forEach(function (x) { nummern[x.nummer] = { alt: x }; });
    (neu.schritte || []).forEach(function (x) { nummern[x.nummer] = Object.assign(nummern[x.nummer] || {}, { neu: x }); });
    var rows = Object.keys(nummern).sort(function (a, b) { return num(a) - num(b); }).map(function (n) {
      var e = nummern[n]; var a = e.alt, b = e.neu;
      function tol(x) { return x ? ("+" + fmt(x.obereToleranz) + " / −" + fmt(Math.abs(num(x.untereToleranz)))) : "—"; }
      function soll(x) { return x ? (x.sollwert != null ? fmt(x.sollwert) + " " + (x.einheit || "") : "—") : "—"; }
      var geaendert = !a || !b || soll(a) !== soll(b) || tol(a) !== tol(b) || (a.bezeichnung !== b.bezeichnung);
      return [n, esc((a && a.bezeichnung) || "—") + " → " + esc((b && b.bezeichnung) || "entfernt"), soll(a) + " → " + soll(b), tol(a) + " → " + tol(b),
        geaendert ? statusTag(!a ? "neu" : !b ? "entfernt" : "geändert", "warn") : statusTag("unverändert", "ok")];
    });
    UI().openModalWide("Versionsvergleich v" + alt.version + " → v" + neu.version, tableWrap(["Nr.", "Bezeichnung", "Sollwert", "Toleranz", "Status"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Bestehende Prüfauftrags-Snapshots bleiben von Versionsänderungen unberührt.</div>', null, "", null);
  }

  // ============================================================
  //  3)+4) PRÜFAUFTRÄGE UND PRÜFUNGSASSISTENT
  // ============================================================
  function viewPruefauftraege() {
    if (pruefLauf) return viewPruefAssistent();
    var s = st();
    var liste = s.pruefauftraege.filter(function (p) { return !filter.pruefstatus || p.status === filter.pruefstatus; }).slice().reverse();
    var rows = liste.map(function (pa) {
      var art = pa.status === Q().PA_STATUS.BESTANDEN ? "ok" : (pa.status === Q().PA_STATUS.GESPERRT || pa.status === Q().PA_STATUS.NICHT_BESTANDEN) ? "err" : pa.status === Q().PA_STATUS.NACHPRUEFUNG ? "warn" : "wait";
      var acts = "";
      if (darf("pruefungDurchfuehren") && [Q().PA_STATUS.ABGESCHLOSSEN].indexOf(pa.status) < 0) acts += '<button class="btn xs primary" data-pastart="' + esc(pa.id) + '">Prüfung starten</button> ';
      if (darf("pruefungFreigeben")) acts += '<button class="btn xs" data-pazuweisen="' + esc(pa.id) + '">Prüfer</button> ';
      acts += '<button class="btn xs ghost" data-padetail="' + esc(pa.id) + '">Detail</button> ';
      acts += '<button class="btn xs ghost" data-paprot="' + esc(pa.id) + '">Protokoll</button>';
      if ((pa.abweichungIds || []).length) acts += ' <button class="btn xs" data-paabw="' + esc(pa.id) + '">Abweichungen (' + pa.abweichungIds.length + ")</button>";
      return [esc(pa.nummer), esc(pa.auftragId || "—"), esc(pa.kommission || "—"), esc(pa.bauteil || "—"), esc(pa.arbeitsgang || "—"),
        "v" + pa.pruefplanVersion, esc(pa.pruefer || "—"), fmtDate(pa.geplantesDatum), statusTag(pa.status, art), (pa.abweichungIds || []).length, acts];
    });
    return '<div class="card"><h3>Prüfaufträge <span class="sub">' + liste.length + "</span></h3>" +
      tableWrap(["Nummer", "Auftrag", "Kommission", "Bauteil", "Arbeitsgang", "Plan", "Prüfer", "Termin", "Status", "Abw.", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Alle Ergebnisse werden zentral im Qualitätskern berechnet – nicht in der Oberfläche.</div></div>';
  }
  function viewPruefAssistent() {
    var s = st(); var pa = Q().pruefauftragById(s, pruefLauf.paId);
    if (!pa) { pruefLauf = null; return viewPruefauftraege(); }
    var schritte = pa.pruefplanSnapshot.schritte || [];
    var idx = Math.max(0, Math.min(pruefLauf.index, schritte.length - 1));
    var x = schritte[idx];
    var erfasst = (pa.ergebnisse || []).filter(function (e) { return e.schrittNummer === x.nummer; });
    var letzte = erfasst[erfasst.length - 1];
    var pmOpt = '<option value="">— kein Prüfmittel —</option>' + s.pruefmittel.map(function (p) {
      var g = Q().pruefmittelGueltig(p, jetzt());
      var sel = (letzte && letzte.pruefmittelId === p.id) || (!letzte && x.pruefmittelId === p.id);
      // Gesperrte/abgelaufene Prüfmittel nur mit Sonderberechtigung wählbar
      var disabled = !g.gueltig && !darf("pruefmittelVerwalten");
      return '<option value="' + esc(p.id) + '"' + (sel ? " selected" : "") + (disabled ? " disabled" : "") + ">" + esc(p.nummer + " " + p.bezeichnung) + (g.gueltig ? "" : " ⚠ " + esc(g.grund)) + "</option>";
    }).join("");
    var fortschritt = schritte.map(function (sx, i) {
      var e = (pa.ergebnisse || []).filter(function (z) { return z.schrittNummer === sx.nummer; })[0];
      var mark = e ? (e.ergebnis === Q().TOLERANZ_ERGEBNIS.INNERHALB ? "✓" : e.ergebnis === Q().TOLERANZ_ERGEBNIS.AUSSERHALB ? "✕" : "!") : "○";
      return '<button class="btn xs ' + (i === idx ? "primary" : "ghost") + '" data-pgoto="' + i + '">' + mark + " " + sx.nummer + "</button>";
    }).join(" ");
    var eingabe;
    var typ = x.merkmalTyp;
    if (["mass", "zahl", "winkel", "gewicht", "stueckzahl"].indexOf(typ) >= 0) {
      eingabe = '<label class="fld"><span class="lbl">Istwert' + (x.einheit ? " (" + esc(x.einheit) + ")" : "") + '</span><input id="pw-wert" type="number" step="any" value="' + (letzte ? letzte.wert : "") + '" style="font-size:22px;font-weight:700"></label>';
    } else if (["jaNein", "bestanden", "sicht", "bestaetigung"].indexOf(typ) >= 0) {
      eingabe = '<label class="fld"><span class="lbl">Ergebnis</span><select id="pw-wert" style="font-size:18px"><option value="">— wählen —</option><option value="io"' + (letzte && letzte.wert === "io" ? " selected" : "") + '>in Ordnung</option><option value="nio"' + (letzte && letzte.wert === "nio" ? " selected" : "") + ">nicht in Ordnung</option></select></label>";
    } else if (typ === "auswahl") {
      eingabe = '<label class="fld"><span class="lbl">Auswahl</span><select id="pw-wert">' + (x.auswahl || []).map(function (z) { return '<option' + (letzte && letzte.wert === z ? " selected" : "") + ">" + esc(z) + "</option>"; }).join("") + "</select></label>";
    } else {
      eingabe = '<label class="fld"><span class="lbl">Wert</span><input id="pw-wert" value="' + esc(letzte ? letzte.wert : "") + '"></label>';
    }
    var soll = x.sollwert != null ? fmt(x.sollwert) + " " + esc(x.einheit || "") : "—";
    var tol = "—";
    if (x.obereToleranz != null || x.untereToleranz != null) {
      var g = Q().toleranzGrenzen(x.sollwert, x.obereToleranz, x.untereToleranz);
      tol = "+" + fmt(x.obereToleranz) + " / −" + fmt(Math.abs(num(x.untereToleranz))) + "  →  " + fmt(g.unten) + " … " + fmt(g.oben) + " " + esc(x.einheit || "");
    }
    var html = '<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">Prüfung ' + esc(pa.nummer) + ' <span class="sub">Auftrag ' + esc(pa.auftragId || "—") + " · " + esc(pa.kommission || "") + ' · Plan v' + pa.pruefplanVersion + '</span></h3><button class="btn sm ghost" id="pw-back">‹ Übersicht</button></div>' +
      '<div style="margin-top:8px">' + fortschritt + "</div></div>";
    html += '<div class="card"><h3>Schritt ' + x.nummer + ": " + esc(x.bezeichnung) + "</h3>" +
      '<div class="muted" style="font-size:12px;margin-bottom:8px">' + esc(x.beschreibung || "") + " · Zeitpunkt: " + esc(x.pruefzeitpunkt) + " · Methode: " + esc(x.methode || "—") + " · Stichprobe: " + fmt(x.stichprobe || 1) + "</div>" +
      '<div class="grid cols-2"><div class="kv"><span>Sollwert</span><strong>' + soll + '</strong></div><div class="kv"><span>Toleranz / Grenzen</span><strong>' + tol + "</strong></div></div>" +
      '<div class="grid cols-2" style="margin-top:8px">' + eingabe +
      '<label class="fld"><span class="lbl">Prüfmittel</span><select id="pw-pm">' + pmOpt + "</select></label></div>" +
      '<div class="grid cols-2"><label class="fld"><span class="lbl">Foto-Referenz' + (x.fotoErforderlich ? " (erforderlich)" : "") + '</span><input id="pw-foto" value="' + esc(letzte ? (letzte.fotoRef || "") : "") + '" placeholder="z. B. foto-1"></label>' +
      '<label class="fld"><span class="lbl">Dokument' + (x.dokumentErforderlich ? " (erforderlich)" : "") + '</span><select id="pw-dok"><option value="">—</option>' + (s._db.dokumente || []).map(function (dk) { return '<option value="' + esc(dk.id) + '"' + (letzte && letzte.dokumentId === dk.id ? " selected" : "") + ">" + esc(dk.nummer || dk.dateiname) + "</option>"; }).join("") + "</select></label></div>" +
      '<label class="fld"><span class="lbl">Notiz</span><input id="pw-notiz" placeholder="optional"></label>' +
      '<div class="btn-row"><button class="btn primary" id="pw-save">Ergebnis übernehmen</button>' +
      (idx > 0 ? '<button class="btn ghost" id="pw-prev">‹ Vorheriger</button>' : "") +
      (idx < schritte.length - 1 ? '<button class="btn" id="pw-next">Nächster ›</button>' : "") +
      '<button class="btn" id="pw-abw">Abweichung erfassen</button>' +
      (darf("pruefungFreigeben") ? '<button class="btn primary" id="pw-finish">Prüfung abschließen</button>' : "") + "</div>";
    if (letzte) html += '<div style="margin-top:10px">Letztes Ergebnis: ' + ergebnisTag(letzte.ergebnis) + " · Istwert <strong>" + esc(String(letzte.wert)) + "</strong>" +
      (letzte.abweichung != null ? " · Abweichung <strong>" + fmt(letzte.abweichung) + "</strong>" : "") +
      (letzte.pruefmittelGueltig === false ? " · " + statusTag("Prüfmittel ungültig", "warn") : "") +
      ((letzte.fehlendeNachweise || []).length ? " · " + statusTag("fehlend: " + letzte.fehlendeNachweise.join(", "), "warn") : "") + "</div>";
    html += "</div>";
    var a = Q().pruefauftragAuswerten(s, pa.id);
    html += '<div class="card"><h3>Zwischenstand</h3><div class="grid cols-4">' +
      statCard("Offene Pflichtschritte", a.offenePflichtschritte.length, a.offenePflichtschritte.length ? "warn" : "green") +
      statCard("Außerhalb Toleranz", a.ausserhalb, a.ausserhalb ? "warn" : "") +
      statCard("Nachprüfung", a.nachpruefung, a.nachpruefung ? "warn" : "") +
      statCard("Sperrende Fehler", a.sperrend, a.sperrend ? "warn" : "") + "</div></div>";
    return html;
  }
  function ergebnisSpeichern() {
    var s = st(); var pa = Q().pruefauftragById(s, pruefLauf.paId);
    var schritte = pa.pruefplanSnapshot.schritte || [];
    var x = schritte[pruefLauf.index];
    var el = d.getElementById("pw-wert");
    var wert = el ? el.value : "";
    if (wert === "") { toast("Bitte einen Wert erfassen.", "err"); return; }
    var r = Q().ergebnisErfassen(s, pa.id, {
      schrittNummer: x.nummer, wert: wert, pruefer: benutzer(),
      pruefmittelId: d.getElementById("pw-pm").value || null,
      fotoRef: d.getElementById("pw-foto").value || null,
      dokumentId: d.getElementById("pw-dok").value || null,
      notiz: d.getElementById("pw-notiz").value || null,
      idempotenzKey: Q().idempotenzKey("ui", pa.id, x.nummer, jetzt())
    }, jetzt());
    if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return; }
    save();
    var t = r.bewertung.ergebnis;
    toast("Ergebnis: " + t + (r.fehlendeNachweise.length ? " · fehlend: " + r.fehlendeNachweise.join(", ") : ""), t === Q().TOLERANZ_ERGEBNIS.INNERHALB ? "" : "err");
    refresh();
  }

  // ============================================================
  //  7) ABWEICHUNGEN
  // ============================================================
  function viewAbweichungen() {
    var s = st();
    var liste = s.abweichungen.filter(function (a) { return !filter.fehlerart || a.fehlerart === filter.fehlerart; }).slice().reverse();
    var rows = liste.map(function (a) {
      var art = a.status === Q().ABW_STATUS.ABGESCHLOSSEN ? "ok" : a.status === Q().ABW_STATUS.GESPERRT ? "err" : "warn";
      return [esc(a.nummer), esc(a.auftragId || "—") + (a.kommission ? " · " + esc(a.kommission) : ""), esc(a.bauteil || "—"),
        esc(a.fehlerart || "—") + " / " + esc(a.fehlerklasse || "—"), fmt(a.menge), esc(a.risikostufe || "—"),
        statusTag(a.status, art), esc(a.herkunft), '<button class="btn xs" data-abwdet="' + esc(a.id) + '">Detail</button>'];
    });
    var head = darf("abweichungAnlegen") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-abwneu="1">+ Neue Abweichung</button></div></div>' : "";
    return head + '<div class="card"><h3>Abweichungen <span class="sub">' + liste.length + "</span></h3>" +
      tableWrap(["Nummer", "Auftrag/Kommission", "Bauteil", "Fehlerart/-klasse", "Menge", "Risiko", "Status", "Herkunft", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Die Herkunft ist standardmäßig „ungeklärt" – es erfolgt <strong>keine automatische Schuldzuweisung</strong>.</div></div>';
  }
  function abweichungDetail(id) {
    var s = st(); var ls = lagerState(); var a = Q().abweichungById(s, id); if (!a) return;
    var kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + "</span><strong>" + v + "</strong></div>"; };
    // Betroffene Vorgänge aus allen Sperren dieser Abweichung
    var betroffen = { reservierungen: [], entnahmen: [], auftraege: [], kommissionen: [], pruefauftraege: [] };
    (a.sperrIds || []).forEach(function (sid) {
      var sp = s.sperren.filter(function (x) { return x.id === sid; })[0];
      if (!sp) return; var b = Q().betroffeneVorgaenge(s, ls, sp);
      ["reservierungen", "entnahmen", "auftraege", "kommissionen", "pruefauftraege"].forEach(function (k) { betroffen[k] = betroffen[k].concat(b[k]); });
    });
    var body = '<div class="grid cols-2">' + kv("Nummer", esc(a.nummer)) + kv("Status", statusTag(a.status, a.status === Q().ABW_STATUS.GESPERRT ? "err" : "warn")) +
      kv("Auftrag / Kommission", esc(a.auftragId || "—") + " / " + esc(a.kommission || "—")) + kv("Bauteil / Arbeitsgang", esc(a.bauteil || "—") + " / " + esc(a.arbeitsgang || "—")) +
      kv("Material / Charge", esc(a.artikelId || "—") + " / " + esc(a.chargeId || "—")) + kv("Maschine", esc(a.maschineId || "—")) +
      kv("Fehlerart / -klasse", esc(a.fehlerart || "—") + " / " + esc(a.fehlerklasse || "—")) + kv("Menge / Risiko", fmt(a.menge) + " / " + esc(a.risikostufe || "—")) +
      kv("Erkannt am / durch", fmtDT(a.erkanntAm) + " / " + esc(a.ersteller || "—")) + kv("Herkunft", esc(a.herkunft)) + "</div>" +
      '<div class="kv"><span>Beschreibung</span><strong>' + esc(a.beschreibung || "—") + "</strong></div>" +
      '<div class="kv"><span>Sofortmaßnahme</span><strong>' + esc(a.sofortmassnahme || "—") + "</strong></div>";
    body += "<h4 style='margin:12px 0 4px'>Betroffene Vorgänge</h4><div class='grid cols-2'>" +
      kv("Reservierungen", betroffen.reservierungen.length) + kv("Entnahmen", betroffen.entnahmen.length) +
      kv("Aufträge", esc(betroffen.auftraege.join(", ") || "—")) + kv("Kommissionen", esc(betroffen.kommissionen.join(", ") || "—")) +
      kv("Prüfaufträge", betroffen.pruefauftraege.length) + kv("Sperren", (a.sperrIds || []).length) + "</div>";
    // Ursachenanalyse
    body += "<h4 style='margin:12px 0 4px'>Ursachenanalyse</h4>";
    body += a.ursachenKandidaten.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Kandidat</th><th>Kategorie</th><th>5-Why</th><th>Sicherheit</th><th></th></tr></thead><tbody>' +
      a.ursachenKandidaten.map(function (k) {
        return "<tr><td>" + esc(k.text) + "</td><td>" + esc(k.kategorie || "—") + "</td><td>" + esc((k.fuenfWhy || []).join(" → ") || "—") + "</td><td>" +
          (k.bestaetigt ? statusTag("bestätigt", "ok") : statusTag("Vermutung", "info")) + "</td><td>" +
          (k.bestaetigt ? "" : '<button class="btn xs" data-urskonf="' + esc(a.id) + "|" + esc(k.id) + '">bestätigen</button>') + "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<div class="muted">Noch keine Ursachenkandidaten.</div>';
    body += '<div class="btn-row" style="margin-top:6px"><button class="btn sm" data-ursneu="' + esc(a.id) + '">+ Ursachenkandidat</button></div>' +
      '<div class="muted" style="font-size:12px">Kandidaten sind <strong>Vermutungen</strong>. Die bestätigte Ursache wird getrennt gespeichert und muss ausdrücklich gesetzt werden.</div>';
    // Audit
    var aud = s.audit.filter(function (x) { return x.referenzId === a.id; });
    body += "<h4 style='margin:12px 0 4px'>Audit-Verlauf</h4>" + tableWrap(["Zeitpunkt", "Aktion", "Benutzer", "Vorher", "Nachher", "Grund"],
      aud.map(function (x) { return [fmtDT(x.zeitpunkt), esc(x.aktion), esc(x.benutzer || "—"), esc(String(x.vorher == null ? "—" : x.vorher)), esc(String(x.nachher == null ? "—" : x.nachher)), esc(x.grund || "—")]; }));
    // Aktionen
    var acts = '<div class="btn-row" style="margin-top:10px">';
    if (darf("chargeSperren")) acts += '<button class="btn" data-abwsperr="' + esc(a.id) + '">Sperren</button>';
    if (darf("nacharbeitFreigeben")) acts += '<button class="btn" data-abwna="' + esc(a.id) + '">Nacharbeit</button>';
    if (darf("sonderfreigabe")) acts += '<button class="btn" data-abwsf="' + esc(a.id) + '">Sonderfreigabe</button>';
    if (darf("abweichungAnlegen")) acts += '<button class="btn" data-abwaus="' + esc(a.id) + '">Ausschuss</button>';
    acts += '<button class="btn ghost" data-abwpdf="' + esc(a.id) + '">Abweichungsbericht</button>';
    acts += '<button class="btn ghost" data-abwstatus="' + esc(a.id) + '">Status ändern</button>';
    acts += "</div>";
    UI().openModalWide("Abweichung " + a.nummer, body + acts, null, "", null);
  }

  // ============================================================
  //  8) SPERREN
  // ============================================================
  function viewSperren() {
    var s = st(); var ls = lagerState();
    var rows = s.sperren.slice().reverse().map(function (sp) {
      var b = Q().betroffeneVorgaenge(s, ls, sp);
      var abw = sp.abweichungId ? Q().abweichungById(s, sp.abweichungId) : null;
      var acts = "";
      if (sp.aktiv && darf("sperrungAufheben")) acts += '<button class="btn xs primary" data-spauf="' + esc(sp.id) + '">Entsperren</button> ';
      acts += '<button class="btn xs ghost" data-spdet="' + esc(sp.id) + '">Details</button>';
      return [esc(sp.objektTyp), esc(kurz(sp.objektId)), esc(sp.grund), esc((abw && abw.risikostufe) || "—"), esc(sp.benutzer), fmtDT(sp.zeitpunkt),
        b.auftraege.length + " Aufträge · " + b.reservierungen.length + " Res. · " + b.entnahmen.length + " Entn.",
        sp.aktiv ? statusTag("gesperrt", "err") : statusTag("aufgehoben", "ok"), acts];
    });
    return '<div class="card"><h3>Sperren</h3>' + tableWrap(["Objekt", "Referenz", "Grund", "Risiko", "Benutzer", "Zeitpunkt", "Betroffene Vorgänge", "Status", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Sperren/Entsperren laufen ausschließlich über den Qualitätskern – mit Berechtigung, Grund und Audit-Protokoll. Keine direkte Statusmanipulation.</div></div>';
  }
  function sperreDetail(id) {
    var s = st(); var ls = lagerState(); var sp = s.sperren.filter(function (x) { return x.id === id; })[0]; if (!sp) return;
    var b = Q().betroffeneVorgaenge(s, ls, sp);
    var kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + "</span><strong>" + v + "</strong></div>"; };
    var naechste = sp.aktiv ? (darf("sperrungAufheben") ? "Entsperren (mit Grund), Nacharbeit anlegen, Sonderfreigabe beantragen, Ausschuss buchen" : "Nur Berechtigte dürfen entsperren. Möglich: Nacharbeit/Sonderfreigabe beantragen.") : "Sperre ist aufgehoben – keine weiteren Aktionen erforderlich.";
    var body = '<div class="grid cols-2">' + kv("Gesperrtes Objekt", esc(sp.objektTyp) + " · " + esc(kurz(sp.objektId))) + kv("Status", sp.aktiv ? statusTag("gesperrt", "err") : statusTag("aufgehoben", "ok")) +
      kv("Grund", esc(sp.grund)) + kv("Benutzer / Zeitpunkt", esc(sp.benutzer) + " · " + fmtDT(sp.zeitpunkt)) + "</div>" +
      "<h4 style='margin:12px 0 4px'>Betroffene Vorgänge</h4><div class='grid cols-2'>" +
      kv("Aufträge", esc(b.auftraege.join(", ") || "—")) + kv("Kommissionen", esc(b.kommissionen.join(", ") || "—")) +
      kv("Reservierungen", b.reservierungen.length) + kv("Entnahmen", b.entnahmen.length) + kv("Prüfaufträge", b.pruefauftraege.length) + "</div>" +
      '<div class="insight"><span class="ico">➡️</span><span><strong>Erlaubte nächste Aktionen:</strong> ' + esc(naechste) + "</span></div>" +
      (sp.aufgehoben ? '<div class="kv"><span>Aufgehoben durch</span><strong>' + esc(sp.aufgehoben.benutzer) + " · " + esc(sp.aufgehoben.grund) + " · " + fmtDT(sp.aufgehoben.zeitpunkt) + "</strong></div>" : "");
    UI().openModalWide("Sperre " + sp.objektTyp, body, null, "", null);
  }

  // ============================================================
  //  9)-11) NACHARBEIT / AUSSCHUSS / SONDERFREIGABE
  // ============================================================
  function viewNacharbeit() {
    var s = st();
    var rows = s.nacharbeiten.slice().reverse().map(function (n) {
      var abw = n.abweichungId ? Q().abweichungById(s, n.abweichungId) : null;
      var kosten = Q().kostenSumme(s, { abweichungId: n.abweichungId });
      var acts = "";
      if (!n.nachpruefungPruefauftragId && darf("pruefungDurchfuehren")) acts += '<button class="btn xs primary" data-nanp="' + esc(n.id) + '">Nachprüfung erzeugen</button> ';
      if (n.nachpruefungPruefauftragId) acts += statusTag("Nachprüfung angelegt", "ok") + " ";
      acts += '<button class="btn xs ghost" data-napdf="' + esc(n.id) + '">Bericht</button>';
      return [esc(n.nummer), esc((abw && abw.nummer) || "—"), esc(n.taetigkeit || "—"), esc(n.herkunft), esc(n.mitarbeitergruppe || "—"),
        fmt(n.geplanteZeitStd) + " h → " + fmt(n.tatsaechlicheZeitStd) + " h",
        darf("qualitaetskostenSehen") ? fmtEUR(kosten.gesamt) : "🔒", fmtDate(n.termin),
        n.freigegeben ? statusTag("freigegeben", "ok") : statusTag("offen", "wait"), acts];
    });
    return '<div class="card"><h3>Nacharbeiten</h3>' + tableWrap(["Nummer", "Abweichung", "Tätigkeit", "Herkunft", "Gruppe", "Zeit geplant → ist", "Kosten", "Termin", "Status", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Nacharbeitskosten werden getrennt als Qualitätskosten geführt. Die Herkunft wird nie automatisch zugewiesen.</div></div>';
  }
  function viewAusschuss() {
    var s = st();
    var rows = s.ausschuss.slice().reverse().map(function (a) {
      return [esc(a.nummer), esc(a.auftragId || "—"), esc(a.bauteil || "—"), fmt(a.menge),
        darf("qualitaetskostenSehen") ? fmtEUR(num(a.materialkosten) + num(a.bearbeitungskosten) + num(a.maschinenkosten)) : "🔒",
        esc(a.grund || "—"), esc(a.entsorgung || "—"), a.ersatzfertigung ? statusTag("Ersatz geplant", "warn") : "—",
        a.bewegungId ? statusTag("Lager gebucht", "ok") : statusTag("ohne Lagerbezug", "info")];
    });
    var head = darf("abweichungAnlegen") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-ausneu="1">+ Ausschuss buchen</button></div><div class="muted" style="font-size:12px;margin-top:6px">Vor der Buchung wird eine Auswirkungsvorschau angezeigt.</div></div>' : "";
    return head + '<div class="card"><h3>Ausschuss</h3>' + tableWrap(["Nummer", "Auftrag", "Bauteil", "Menge", "Kosten", "Grund", "Entsorgung", "Ersatz", "Lager"], rows) + "</div>";
  }
  function ausschussDialog(abwId) {
    var s = st(); var ls = lagerState(); var db = s._db;
    var artOpt = '<option value="">—</option>' + (db.lagerArtikel || []).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.artikelnummer) + "</option>"; }).join("");
    var chOpt = '<option value="">—</option>' + (db.lagerChargen || []).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.chargennummer) + "</option>"; }).join("");
    var aufOpt = '<option value="">—</option>' + (db.auftraege || []).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.nummer || a.titel || a.id) + "</option>"; }).join("");
    var abw = abwId ? Q().abweichungById(s, abwId) : null;
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Auftrag</span><select id="au-auf">' + aufOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Bauteil</span><input id="au-bauteil" value="' + esc((abw && abw.bauteil) || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Material</span><select id="au-art">' + artOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Charge</span><select id="au-ch">' + chOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Menge</span><input id="au-menge" type="number" step="any" min="0" value="1"></label>' +
      '<label class="fld"><span class="lbl">Materialkosten</span><input id="au-km" type="number" step="0.01" min="0" value="0"></label>' +
      '<label class="fld"><span class="lbl">Bearbeitungskosten</span><input id="au-kb" type="number" step="0.01" min="0" value="0"></label>' +
      '<label class="fld"><span class="lbl">Maschinenkosten</span><input id="au-kma" type="number" step="0.01" min="0" value="0"></label>' +
      '<label class="fld"><span class="lbl">Grund</span><input id="au-grund"></label>' +
      '<label class="fld"><span class="lbl">Entsorgung</span><input id="au-ents"></label>' +
      '</div><label class="inline" style="gap:6px;font-size:13px"><input type="checkbox" id="au-ersatz"> Ersatzfertigung erforderlich</label>' +
      '<div id="au-vorschau" class="insight" style="margin-top:10px"><span class="ico">🔎</span><span>Auswirkungsvorschau erscheint hier.</span></div>';
    UI().openModalWide("Ausschuss buchen", body, function () {
      var artId = d.getElementById("au-art").value;
      var menge = num(d.getElementById("au-menge").value);
      if (menge <= 0) { toast("Menge muss > 0 sein.", "err"); return false; }
      var r = Q().ausschussNeu(s, ls, {
        mandantId: null, abweichungId: abwId || null, auftragId: d.getElementById("au-auf").value || null,
        bauteil: d.getElementById("au-bauteil").value, artikelId: artId || null, chargeId: d.getElementById("au-ch").value || null,
        menge: menge, materialkosten: num(d.getElementById("au-km").value), bearbeitungskosten: num(d.getElementById("au-kb").value),
        maschinenkosten: num(d.getElementById("au-kma").value), grund: d.getElementById("au-grund").value,
        entsorgung: d.getElementById("au-ents").value, ersatzfertigung: d.getElementById("au-ersatz").checked,
        freigegebenVon: benutzer(), benutzer: benutzer()
      }, jetzt());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save(); toast("Ausschuss gebucht (Lagerbestand und Qualitätskosten aktualisiert)."); refresh(); return true;
    }, "", null);
    setTimeout(function () {
      function upd() {
        var artId = d.getElementById("au-art").value; var menge = num(d.getElementById("au-menge").value);
        var box = d.getElementById("au-vorschau");
        var teile = [];
        if (artId && L()) {
          var b = L().bestand(ls, artId, {});
          teile.push("Lagerbestand physisch " + fmt(b.physisch) + " → <strong>" + fmt(b.physisch - menge) + "</strong>");
          teile.push("verfügbar " + fmt(b.verfuegbar) + " → <strong>" + fmt(Math.max(0, b.verfuegbar - menge)) + "</strong>");
        } else teile.push("Kein Material gewählt – keine Lagerwirkung.");
        teile.push("Fertigungsmenge sinkt um <strong>" + fmt(menge) + "</strong>");
        var k = num(d.getElementById("au-km").value) + num(d.getElementById("au-kb").value) + num(d.getElementById("au-kma").value);
        if (darf("qualitaetskostenSehen")) teile.push("Nachkalkulation: zusätzliche Qualitätskosten <strong>" + fmtEUR(k) + "</strong>");
        teile.push("Ersatzbedarf: <strong>" + (d.getElementById("au-ersatz").checked ? fmt(menge) + " Stück" : "keiner") + "</strong>");
        box.innerHTML = '<span class="ico">🔎</span><span><strong>Auswirkungsvorschau:</strong><br>' + teile.join("<br>") + "</span>";
      }
      ["au-art", "au-menge", "au-km", "au-kb", "au-kma", "au-ersatz"].forEach(function (id) { var el = d.getElementById(id); if (el) { el.oninput = upd; el.onchange = upd; } });
      upd();
    }, 60);
  }

  // ============================================================
  //  12)-14) REKLAMATIONEN + MASSNAHMEN
  // ============================================================
  function viewReklamationen() {
    var s = st(); var db = s._db;
    var rows = s.reklamationen.slice().reverse().map(function (r) {
      var kunde = (db.kunden || []).filter(function (k) { return k.id === r.kundeId; })[0];
      var bwArt = r.berechtigung === "berechtigt" ? "err" : r.berechtigung === "unberechtigt" ? "ok" : "info";
      return [esc(r.nummer), esc(kunde ? kunde.name : "—"), esc(r.auftragId || "—") + (r.kommission ? " · " + esc(r.kommission) : ""),
        esc(r.produkt || "—"), fmt(r.menge), esc(r.prioritaet), statusTag(r.status, r.status === Q().REKL_STATUS.ABGESCHLOSSEN ? "ok" : "warn"),
        statusTag(r.berechtigung, bwArt), fmtDate(r.meldedatum),
        '<button class="btn xs" data-rkdet="' + esc(r.id) + '">Detail</button> <button class="btn xs ghost" data-rkpdf="' + esc(r.id) + '">Bericht</button>'];
    });
    var head = darf("reklamationBearbeiten") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-rkneu="1">+ Neue Reklamation</button></div></div>' : "";
    return head + '<div class="card"><h3>Kundenreklamationen</h3>' + tableWrap(["Nummer", "Kunde", "Auftrag/Kommission", "Produkt", "Menge", "Priorität", "Status", "Bewertung", "gemeldet", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Jede Reklamation startet neutral als „nicht bewertet". Eine Bewertung erfordert Benutzer und Begründung – <strong>keine automatische Schuldzuweisung</strong>.</div></div>';
  }
  function viewLieferanten() {
    var s = st(); var db = s._db;
    var rows = s.lieferantenReklamationen.slice().reverse().map(function (r) {
      var lief = (db.lieferanten || []).filter(function (l) { return l.id === r.lieferantId; })[0];
      var ch = (db.lagerChargen || []).filter(function (c) { return c.id === r.chargeId; })[0];
      var acts = '<button class="btn xs" data-lrdet="' + esc(r.id) + '">Detail</button>';
      if (!r.sperrId && r.chargeId && darf("chargeSperren")) acts += ' <button class="btn xs" data-lrsperr="' + esc(r.id) + '">Charge sperren</button>';
      return [esc(r.nummer), esc(lief ? lief.name : "—"), esc(r.lieferschein || "—"), esc(ch ? ch.chargennummer : "—"), fmt(r.menge),
        esc(r.fehler || "—"), esc(r.geforderteMassnahme || "—"), statusTag(r.status, "warn"),
        r.sperrId ? statusTag("Charge gesperrt", "err") : statusTag("nicht gesperrt", "info"), acts];
    });
    var head = darf("reklamationBearbeiten") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-lrneu="1">+ Lieferantenreklamation</button></div></div>' : "";
    return head + '<div class="card"><h3>Lieferantenreklamationen</h3>' + tableWrap(["Nummer", "Lieferant", "Lieferschein", "Charge", "Menge", "Fehler", "Geforderte Maßnahme", "Status", "Sperre", "Aktion"], rows) + "</div>";
  }
  function viewMassnahmen() {
    var s = st(); var jz = new Date(jetzt()).getTime();
    var SP = [Q().MASSNAHME_STATUS.GEPLANT, Q().MASSNAHME_STATUS.FREIGEGEBEN, Q().MASSNAHME_STATUS.UMSETZUNG, Q().MASSNAHME_STATUS.UMGESETZT, Q().MASSNAHME_STATUS.WIRKSAMKEIT, Q().MASSNAHME_STATUS.WIRKSAM, Q().MASSNAHME_STATUS.NICHT_WIRKSAM, Q().MASSNAHME_STATUS.ABGESCHLOSSEN];
    var html = '<div class="card"><h3>Korrekturmaßnahmen <span class="sub">Kanban</span></h3><div class="table-wrap"><div style="display:flex;gap:10px;min-width:900px;align-items:flex-start">';
    SP.forEach(function (stat) {
      var liste = s.massnahmen.filter(function (m) { return m.status === stat; });
      html += '<div style="flex:1 0 150px;background:var(--card2,#232d38);border-radius:10px;padding:8px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">' + esc(stat) + " (" + liste.length + ")</div>";
      html += liste.map(function (m) {
        var ueber = m.frist && new Date(m.frist).getTime() < jz && [Q().MASSNAHME_STATUS.WIRKSAM, Q().MASSNAHME_STATUS.ABGESCHLOSSEN].indexOf(m.status) < 0;
        var abw = m.abweichungId ? Q().abweichungById(s, m.abweichungId) : null;
        return '<div style="background:var(--card,#1a222c);border-radius:8px;padding:8px;margin-bottom:6px;font-size:12px;cursor:pointer" data-madet="' + esc(m.id) + '">' +
          "<strong>" + esc(m.nummer) + "</strong><br>" + esc((m.beschreibung || "").slice(0, 60)) + "<br>" +
          '<span class="muted">' + esc(m.verantwortlicher || "—") + " · " + fmtDate(m.frist) + "</span>" +
          (ueber ? "<br>" + statusTag("überfällig", "err") : "") +
          (abw ? '<br><span class="muted">↳ ' + esc(abw.nummer) + "</span>" : "") +
          (m.wirksamkeitspruefung ? "<br>" + statusTag(m.wirksamkeitspruefung.ergebnis, m.wirksamkeitspruefung.ergebnis === Q().MASSNAHME_STATUS.WIRKSAM ? "ok" : "err") : "") + "</div>";
      }).join("") || '<div class="muted" style="font-size:11px">—</div>';
      html += "</div>";
    });
    html += "</div></div>";
    var head = darf("reklamationBearbeiten") ? '<div class="btn-row" style="margin-top:10px"><button class="btn sm primary" data-maneu="1">+ Maßnahme</button></div>' : "";
    return html + head + "</div>";
  }

  // ============================================================
  //  15) PRÜFMITTELVERWALTUNG
  // ============================================================
  function viewPruefmittel() {
    var s = st();
    var rows = s.pruefmittel.map(function (pm) {
      var g = Q().pruefmittelGueltig(pm, jetzt());
      var bald = Q().kalibrierungBaldFaellig(pm, 30, jetzt());
      var warn = !g.gueltig ? statusTag(g.grund, "err") : bald ? statusTag("läuft bald ab", "warn") : statusTag("gültig", "ok");
      var betroffen = Q().betroffenePruefungen(s, pm.id).length;
      var acts = "";
      if (darf("pruefmittelVerwalten")) acts += '<button class="btn xs primary" data-pmkal="' + esc(pm.id) + '">Kalibrierung</button> ';
      if (betroffen) acts += '<button class="btn xs" data-pmbetr="' + esc(pm.id) + '">Betroffene Prüfungen (' + betroffen + ")</button> ";
      if (darf("pruefmittelVerwalten")) acts += '<button class="btn xs ghost" data-pmsperr="' + esc(pm.id) + '">' + (pm.status === Q().PM_STATUS.GESPERRT ? "Entsperren" : "Sperren") + "</button>";
      return [esc(pm.nummer), esc(pm.bezeichnung), esc(pm.seriennummer || "—"), esc(pm.messbereich || "—") + " / " + esc(pm.genauigkeit || "—"),
        fmtDate(pm.letzteKalibrierung), fmtDate(pm.naechsteKalibrierung), esc(pm.status), warn, acts];
    });
    var faellig = s.pruefmittel.filter(function (pm) { return !Q().pruefmittelGueltig(pm, jetzt()).gueltig; });
    var bald = s.pruefmittel.filter(function (pm) { return Q().kalibrierungBaldFaellig(pm, 30, jetzt()); });
    var warnBox = "";
    if (faellig.length) warnBox += '<div class="insight"><span class="ico">⚠️</span><span><strong>' + faellig.length + ' Prüfmittel nicht einsatzbereit</strong> (Kalibrierung abgelaufen, gesperrt oder defekt). Messungen damit ergeben „Nachprüfung erforderlich"; bereits erfasste Prüfungen sind möglicherweise betroffen.</span></div>';
    if (bald.length) warnBox += '<div class="insight"><span class="ico">🕒</span><span>' + bald.length + " Prüfmittel: Kalibrierung läuft in den nächsten 30 Tagen ab.</span></div>";
    var head = darf("pruefmittelVerwalten") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-pmneu="1">+ Prüfmittel</button><button class="btn ghost" data-pmpdf="1">Prüfmittelübersicht (PDF)</button></div></div>' : "";
    return head + warnBox + '<div class="card"><h3>Prüfmittel</h3>' + tableWrap(["Nummer", "Bezeichnung", "Serien-Nr.", "Bereich/Genauigkeit", "Letzte Kal.", "Nächste Kal.", "Status", "Bewertung", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Gesperrte oder abgelaufene Prüfmittel sind im Prüfungsassistenten nur mit Sonderberechtigung („Prüfmittel verwalten") wählbar.</div></div>';
  }

  // ============================================================
  //  17) ABNAHMEN
  // ============================================================
  function viewAbnahmen() {
    var s = st();
    var rows = (s.abnahmen || []).slice().reverse().map(function (ab) {
      var acts = '<button class="btn xs ghost" data-abnpdf="' + esc(ab.id) + '">Protokoll</button> ';
      if (darf("qualitaetsberichteExportieren")) acts += '<button class="btn xs" data-abnportal="' + esc(ab.id) + '">' + (ab.portalFreigegeben ? "Portal: sichtbar" : "Für Portal freigeben") + "</button>";
      return [esc(ab.nummer), esc(ab.auftragId || "—"), esc(ab.kommission || "—"), esc(ab.baustelle || "—"), fmtDate(ab.datum),
        (ab.maengel || []).length, (ab.restarbeiten || []).length, fmtDate(ab.nachtermin),
        ab.kenntnisnahme ? statusTag("Kenntnisnahme bestätigt", "ok") : statusTag("offen", "wait"), acts];
    });
    var head = darf("pruefungDurchfuehren") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-abnneu="1">+ Montage-/Kundenabnahme</button></div></div>' : "";
    return head + '<div class="card"><h3>Abnahmen</h3>' + tableWrap(["Nummer", "Auftrag", "Kommission", "Baustelle", "Datum", "Mängel", "Restarbeiten", "Nachtermin", "Bestätigung", "Aktion"], rows) +
      '<div class="insight"><span class="ico">ℹ️</span><span>Die Bestätigung ist eine <strong>Kenntnisnahme</strong> – ausdrücklich <strong>keine qualifizierte elektronische Signatur</strong>.</span></div></div>';
  }

  // ============================================================
  //  19) PORTALFREIGABEN
  // ============================================================
  function viewPortal() {
    var s = st(); var db = s._db;
    var rows = (s.portalFreigaben || []).slice().reverse().map(function (f) {
      var kunde = (db.kunden || []).filter(function (k) { return k.id === f.kundeId; })[0];
      return [esc(f.typ), esc(f.titel || kurz(f.referenzId)), esc(kunde ? kunde.name : "alle Kunden"), esc(f.freigegebenVon), fmtDT(f.freigegebenAm),
        f.sichtbar ? statusTag("sichtbar", "ok") : statusTag("verborgen", "info"),
        darf("qualitaetsberichteExportieren") ? '<button class="btn xs ghost" data-pfwiderruf="' + esc(f.id) + '">' + (f.sichtbar ? "Verbergen" : "Sichtbar machen") + "</button>" : "—"];
    });
    return '<div class="card"><h3>Kundenportal – freigegebene Qualitätsbelege</h3>' +
      tableWrap(["Typ", "Beleg", "Kunde", "Freigegeben von", "Zeitpunkt", "Status", "Aktion"], rows) +
      '<div class="insight"><span class="ico">🔒</span><span>Im Portal werden <strong>nur ausdrücklich freigegebene</strong> Belege angezeigt. Interne Ursachenanalysen, Mitarbeiterdaten, Qualitätskosten, interne Bewertungen und nicht freigegebene Lieferanteninformationen bleiben unsichtbar.</span></div></div>';
  }

  // ============================================================
  //  20) BERICHTE  +  21) LERNHINWEISE
  // ============================================================
  function viewBerichte() {
    if (!darf("qualitaetsberichteExportieren")) return '<div class="insight"><span class="ico">🔒</span><span>Keine Berechtigung für Qualitätsberichte/Exporte.</span></div>';
    var arten = [["pruefstatus", "Prüfstatusbericht"], ["abweichungen", "Abweichungsbericht"], ["nacharbeit", "Nacharbeitsbericht"], ["ausschuss", "Ausschussbericht"],
      ["reklamationen", "Reklamationsbericht"], ["lieferantenqualitaet", "Lieferantenqualitätsbericht"], ["pruefmittel", "Prüfmittelbericht"], ["qualitaetskosten", "Qualitätskostenbericht"]];
    return '<div class="card"><h3>Qualitätsberichte</h3><div class="muted" style="font-size:12px">CSV, druckbare Ansicht oder PDF. Der Qualitätskostenbericht benötigt zusätzlich das Recht „Qualitätskosten sehen".</div>' +
      '<div class="table-wrap" style="margin-top:10px"><table class="table"><tbody>' + arten.map(function (b) {
        var gesperrt = b[0] === "qualitaetskosten" && !darf("qualitaetskostenSehen");
        return "<tr><td><strong>" + esc(b[1]) + "</strong></td><td style='text-align:right'>" +
          (gesperrt ? '<span class="muted">🔒 keine Berechtigung</span>' :
            '<button class="btn xs" data-qrep="' + b[0] + '|csv">CSV</button> <button class="btn xs ghost" data-qrep="' + b[0] + '|print">Druck/PDF</button>') + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
  }
  function viewHinweise() {
    var s = st(); var hinweise = Q().lernhinweise(s, filter);
    var rows = hinweise.map(function (h) {
      var vArt = h.vertrauen === "hoch" ? "ok" : h.vertrauen === "mittel" ? "warn" : "info";
      return [esc(h.text), h.datenmenge, h.zeitraum ? fmtDate(h.zeitraum.von) + " – " + fmtDate(h.zeitraum.bis) : "—",
        statusTag("Vertrauen: " + h.vertrauen, vArt), esc(h.grundlage), esc(h.hinweis)];
    });
    return '<div class="card"><h3>Lernhinweise <span class="sub">statistische Auffälligkeiten</span></h3>' +
      tableWrap(["Hinweis", "Datenmenge", "Zeitraum", "Vertrauen", "Grundlage", "Einordnung"], rows) +
      '<div class="insight"><span class="ico">ℹ️</span><span>Alle Hinweise beschreiben <strong>Korrelationen, keine gesicherten Ursachen</strong>. Es findet <strong>keine Bewertung einzelner Mitarbeiter</strong> statt.</span></div></div>';
  }

  // ============================================================
  //  PDF-ERZEUGUNG (Prüfprotokoll, Abweichung, Nacharbeit, …)
  // ============================================================
  function pdfPruefprotokoll(paId) {
    var s = st(); var db = s._db; var pa = Q().pruefauftragById(s, paId); if (!pa) return;
    var auf = (db.auftraege || []).filter(function (a) { return a.id === pa.auftragId; })[0];
    var kunde = auf ? (db.kunden || []).filter(function (k) { return k.id === auf.kundeId; })[0] : null;
    var schritte = pa.pruefplanSnapshot.schritte || [];
    var rows = schritte.map(function (x) {
      var e = (pa.ergebnisse || []).filter(function (z) { return z.schrittNummer === x.nummer; }).slice(-1)[0];
      var cls = !e ? "" : e.ergebnis === Q().TOLERANZ_ERGEBNIS.INNERHALB ? "ok" : e.ergebnis === Q().TOLERANZ_ERGEBNIS.AUSSERHALB ? "err" : "warn";
      var symbol = !e ? "○ offen" : e.ergebnis === Q().TOLERANZ_ERGEBNIS.INNERHALB ? "✓ bestanden" : e.ergebnis === Q().TOLERANZ_ERGEBNIS.AUSSERHALB ? "✕ außerhalb" : "! " + e.ergebnis;
      return "<tr><td>" + x.nummer + "</td><td>" + esc(x.bezeichnung) + "</td><td>" + esc(x.pruefzeitpunkt) + "</td><td>" +
        (x.sollwert != null ? fmt(x.sollwert) + " " + esc(x.einheit || "") : "—") + "</td><td>" +
        (x.obereToleranz != null ? "+" + fmt(x.obereToleranz) + " / −" + fmt(Math.abs(num(x.untereToleranz))) : "—") + "</td><td>" +
        (e ? esc(String(e.wert)) : "—") + "</td><td>" + (e && e.abweichung != null ? fmt(e.abweichung) : "—") + '</td><td class="' + cls + '">' + symbol + "</td></tr>";
    }).join("");
    var abwRows = (pa.abweichungIds || []).map(function (id) {
      var a = Q().abweichungById(s, id); if (!a) return "";
      return "<tr><td>" + esc(a.nummer) + "</td><td>" + esc(a.beschreibung) + "</td><td>" + esc(a.fehlerart || "—") + "</td><td>" + fmt(a.menge) + "</td><td>" + esc(a.status) + "</td></tr>";
    }).join("");
    var fotos = (pa.ergebnisse || []).filter(function (e) { return e.fotoRef; });
    var inner = "<h2>Prüfergebnisse</h2><table><thead><tr><th>Nr.</th><th>Prüfschritt</th><th>Zeitpunkt</th><th>Sollwert</th><th>Toleranz</th><th>Istwert</th><th>Abw.</th><th>Ergebnis</th></tr></thead><tbody>" + rows + "</tbody></table>";
    if (abwRows) inner += "<h2>Abweichungen</h2><table><thead><tr><th>Nummer</th><th>Beschreibung</th><th>Fehlerart</th><th>Menge</th><th>Status</th></tr></thead><tbody>" + abwRows + "</tbody></table>";
    if (fotos.length) inner += "<h2>Fotonachweise</h2><table><thead><tr><th>Prüfschritt</th><th>Referenz</th></tr></thead><tbody>" + fotos.map(function (e) { return "<tr><td>" + e.schrittNummer + "</td><td>" + esc(e.fotoRef) + "</td></tr>"; }).join("") + "</tbody></table>";
    inner += "<h2>Freigaben</h2><table><thead><tr><th>Rolle</th><th>Person</th><th>Zeitpunkt</th><th>Ergebnis</th></tr></thead><tbody><tr><td>Prüfer</td><td>" + esc(pa.pruefer || "—") + "</td><td>" + fmtDT(pa.tatsaechlichesDatum) + "</td><td>" + esc(pa.status) + "</td></tr></tbody></table>";
    inner += '<div class="qhinweis">Prüfplan-Referenz: ' + esc(pa.pruefplanSnapshot.referenz || "—") + " — reine Freitext-Referenz. Dieses Protokoll <strong>bestätigt keine Normkonformität und keine Zertifizierung</strong>.</div>";
    pdfFenster("Prüfprotokoll", "PR-" + kurz(pa.id), inner, [
      ["Kunde", kunde ? esc(kunde.name) : "—"], ["Projekt / Kommission", esc((auf && auf.titel) || "—") + " / " + esc(pa.kommission || "—")],
      ["Auftrag", esc(pa.auftragId || "—")], ["Bauteil / Arbeitsgang", esc(pa.bauteil || "—") + " / " + esc(pa.arbeitsgang || "—")],
      ["Prüfplan / Version", esc(pa.pruefplanSnapshot.nummer) + " · v" + pa.pruefplanVersion],
      ["Prüfer", esc(pa.pruefer || "—")], ["Status", esc(pa.status)]
    ]);
  }
  function pdfAbweichung(abwId) {
    var s = st(); var a = Q().abweichungById(s, abwId); if (!a) return;
    var ursachen = a.ursachenKandidaten.map(function (k) { return "<tr><td>" + esc(k.text) + "</td><td>" + esc(k.kategorie || "—") + "</td><td>" + (k.bestaetigt ? "bestätigt" : "Vermutung") + "</td></tr>"; }).join("");
    var hist = (a.historie || []).map(function (h) { return "<tr><td>" + fmtDT(h.zeitpunkt) + "</td><td>" + esc(h.status) + "</td><td>" + esc(h.benutzer || "—") + "</td><td>" + esc(h.grund || "—") + "</td></tr>"; }).join("");
    var inner = "<h2>Beschreibung</h2><p>" + esc(a.beschreibung || "—") + "</p><p><strong>Sofortmaßnahme:</strong> " + esc(a.sofortmassnahme || "—") + "</p>" +
      "<h2>Ursachenanalyse</h2><table><thead><tr><th>Möglicher Grund</th><th>Kategorie</th><th>Status</th></tr></thead><tbody>" + (ursachen || "<tr><td colspan='3'>—</td></tr>") + "</tbody></table>" +
      '<div class="qhinweis">Ursachenkandidaten sind <strong>Vermutungen</strong>. Bestätigte Ursache: ' + esc((a.bestaetigteUrsache && a.bestaetigteUrsache.text) || "keine") + ". Es erfolgt <strong>keine automatische Schuldzuweisung</strong>.</div>" +
      "<h2>Verlauf</h2><table><thead><tr><th>Zeitpunkt</th><th>Status</th><th>Benutzer</th><th>Grund</th></tr></thead><tbody>" + hist + "</tbody></table>";
    pdfFenster("Abweichungsbericht", "AB-" + kurz(a.id), inner, [
      ["Abweichung", esc(a.nummer)], ["Auftrag / Kommission", esc(a.auftragId || "—") + " / " + esc(a.kommission || "—")],
      ["Bauteil / Arbeitsgang", esc(a.bauteil || "—") + " / " + esc(a.arbeitsgang || "—")],
      ["Fehlerart / -klasse", esc(a.fehlerart || "—") + " / " + esc(a.fehlerklasse || "—")],
      ["Menge / Risikostufe", fmt(a.menge) + " / " + esc(a.risikostufe || "—")], ["Status / Herkunft", esc(a.status) + " / " + esc(a.herkunft)]
    ]);
  }
  function pdfNacharbeit(naId) {
    var s = st(); var n = s.nacharbeiten.filter(function (x) { return x.id === naId; })[0]; if (!n) return;
    var abw = n.abweichungId ? Q().abweichungById(s, n.abweichungId) : null;
    var k = Q().kostenSumme(s, { abweichungId: n.abweichungId });
    var kostenTab = darf("qualitaetskostenSehen")
      ? "<h2>Qualitätskosten</h2><table><thead><tr><th>Kostenart</th><th>Betrag</th></tr></thead><tbody>" +
        Object.keys(k.proArt).map(function (art) { return "<tr><td>" + esc(art) + "</td><td>" + fmtEUR(k.proArt[art]) + "</td></tr>"; }).join("") +
        "<tr><th>Gesamt</th><th>" + fmtEUR(k.gesamt) + "</th></tr></tbody></table>"
      : '<div class="qhinweis">Qualitätskosten werden für Ihre Rolle nicht ausgewiesen.</div>';
    var inner = "<h2>Nacharbeit</h2><table><tbody><tr><th>Tätigkeit</th><td>" + esc(n.taetigkeit || "—") + "</td></tr>" +
      "<tr><th>Ursache (Freitext)</th><td>" + esc(n.ursacheText || "—") + "</td></tr>" +
      "<tr><th>Herkunft</th><td>" + esc(n.herkunft) + "</td></tr>" +
      "<tr><th>Mitarbeitergruppe / Maschine</th><td>" + esc(n.mitarbeitergruppe || "—") + " / " + esc(n.maschineId || "—") + "</td></tr>" +
      "<tr><th>Zeit geplant / tatsächlich</th><td>" + fmt(n.geplanteZeitStd) + " h / " + fmt(n.tatsaechlicheZeitStd) + " h</td></tr>" +
      "<tr><th>Termin</th><td>" + fmtDate(n.termin) + "</td></tr>" +
      "<tr><th>Nachprüfung</th><td>" + (n.nachpruefungPruefauftragId ? "angelegt" : "offen") + "</td></tr></tbody></table>" + kostenTab +
      '<div class="qhinweis">Die Herkunft der Nacharbeit wird nie automatisch zugewiesen; „ungeklärt" ist ein gültiger Zustand. Keine automatische Kostenweitergabe.</div>';
    pdfFenster("Nacharbeitsbericht", "NA-" + kurz(n.id), inner, [["Nacharbeit", esc(n.nummer)], ["Abweichung", esc((abw && abw.nummer) || "—")], ["Auftrag", esc((abw && abw.auftragId) || "—")]]);
  }
  function pdfAbnahme(abId) {
    var s = st(); var db = s._db; var pr = Q().abnahmeProtokoll(s, abId); if (!pr) return;
    var ab = (s.abnahmen || []).filter(function (x) { return x.id === abId; })[0];
    var kunde = (db.kunden || []).filter(function (k) { return k.id === ab.kundeId; })[0];
    function liste(titel, arr) { return "<h2>" + titel + "</h2>" + ((arr || []).length ? "<ul>" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<p>—</p>"); }
    var inner = "<h2>Ausgeführte Leistungen</h2><p>" + esc(pr.ausgefuehrteLeistungen || "—") + "</p>" +
      liste("Mängel", pr.maengel) + liste("Offene Punkte", pr.offenePunkte) + liste("Restarbeiten", pr.restarbeiten) +
      "<h2>Anwesende Personen</h2><p>" + esc((pr.anwesende || []).join(", ") || "—") + "</p>" +
      "<h2>Kundenkommentar</h2><p>" + esc(pr.kundenkommentar || "—") + "</p>" +
      "<h2>Bestätigung</h2><table><tbody><tr><th>Kenntnisnahme</th><td>" + (pr.kenntnisnahme ? "bestätigt" : "nicht bestätigt") + "</td></tr>" +
      "<tr><th>Name</th><td>" + esc(pr.kenntnisnahmeName || "—") + "</td></tr><tr><th>Zeitpunkt</th><td>" + fmtDT(pr.kenntnisnahmeAm) + "</td></tr>" +
      "<tr><th>Fotos</th><td>" + pr.fotos + "</td></tr></tbody></table>" +
      '<div class="qhinweis">' + esc(pr.signaturHinweis) + " Dieses Protokoll ist eine Dokumentation der Abnahme, <strong>keine Normkonformitätsbestätigung</strong>.</div>";
    pdfFenster("Abnahmeprotokoll", pr.dokumentkennung, inner, [
      ["Kunde", kunde ? esc(kunde.name) : "—"], ["Auftrag / Kommission", esc(pr.auftragId || "—") + " / " + esc(pr.kommission || "—")],
      ["Baustelle", esc(pr.baustelle || "—")], ["Datum", fmtDate(pr.datum)], ["Nachtermin", fmtDate(pr.nachtermin)]
    ]);
  }
  function pdfReklamation(rkId) {
    var s = st(); var db = s._db; var r = s.reklamationen.filter(function (x) { return x.id === rkId; })[0]; if (!r) return;
    var kunde = (db.kunden || []).filter(function (k) { return k.id === r.kundeId; })[0];
    var hist = (r.historie || []).map(function (h) { return "<tr><td>" + fmtDT(h.zeitpunkt) + "</td><td>" + esc(h.status) + "</td><td>" + esc(h.benutzer || "—") + "</td><td>" + esc(h.grund || "—") + "</td></tr>"; }).join("");
    var k = Q().kostenSumme(s, { auftragId: r.auftragId });
    var inner = "<h2>Beschreibung</h2><p>" + esc(r.beschreibung || "—") + "</p>" +
      "<h2>Bewertung</h2><table><tbody><tr><th>Berechtigung</th><td>" + esc(r.berechtigung) + "</td></tr>" +
      "<tr><th>Bewertet von / am</th><td>" + esc(r.bewertetVon || "—") + " · " + fmtDT(r.bewertetAm) + "</td></tr>" +
      "<tr><th>Begründung</th><td>" + esc(r.bewertungBegruendung || "—") + "</td></tr></tbody></table>" +
      (darf("qualitaetskostenSehen") ? "<h2>Zugeordnete Qualitätskosten</h2><p>" + fmtEUR(k.gesamt) + "</p>" : "") +
      "<h2>Verlauf</h2><table><thead><tr><th>Zeitpunkt</th><th>Status</th><th>Benutzer</th><th>Grund</th></tr></thead><tbody>" + hist + "</tbody></table>" +
      '<div class="qhinweis">Eine Reklamation startet neutral als „nicht bewertet". Es erfolgt <strong>keine automatische Bewertung als berechtigt oder unberechtigt</strong>.</div>';
    pdfFenster("Reklamationsbericht", "RK-" + kurz(r.id), inner, [
      ["Reklamation", esc(r.nummer)], ["Kunde", kunde ? esc(kunde.name) : "—"], ["Auftrag / Kommission", esc(r.auftragId || "—") + " / " + esc(r.kommission || "—")],
      ["Produkt / Menge", esc(r.produkt || "—") + " / " + fmt(r.menge)], ["Gemeldet / Priorität", fmtDate(r.meldedatum) + " / " + esc(r.prioritaet)], ["Status", esc(r.status)]
    ]);
  }
  function pdfPruefmittel() {
    var s = st();
    var rows = s.pruefmittel.map(function (pm) {
      var g = Q().pruefmittelGueltig(pm, jetzt());
      return "<tr><td>" + esc(pm.nummer) + "</td><td>" + esc(pm.bezeichnung) + "</td><td>" + esc(pm.seriennummer || "—") + "</td><td>" +
        esc(pm.messbereich || "—") + "</td><td>" + fmtDate(pm.letzteKalibrierung) + "</td><td>" + fmtDate(pm.naechsteKalibrierung) + "</td><td>" +
        esc(pm.status) + '</td><td class="' + (g.gueltig ? "ok" : "err") + '">' + (g.gueltig ? "✓ gültig" : "✕ " + esc(g.grund)) + "</td></tr>";
    }).join("");
    pdfFenster("Prüfmittelübersicht", "PM-" + kurz(String(s.pruefmittel.length)), "<h2>Prüfmittel</h2><table><thead><tr><th>Nummer</th><th>Bezeichnung</th><th>Serien-Nr.</th><th>Messbereich</th><th>Letzte Kal.</th><th>Nächste Kal.</th><th>Status</th><th>Bewertung</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      '<div class="qhinweis">Kalibrierzertifikate werden als Referenz geführt. Diese Übersicht ist <strong>kein Kalibriernachweis und keine Zertifizierung</strong>.</div>', []);
  }
  function berichtAusfuehren(art, format) {
    var s = st();
    var rep = Q().bericht(s, art, Object.assign({}, filter, { jetztISO: jetzt() }));
    if (!rep) { toast("Bericht unbekannt.", "err"); return; }
    if (art === "qualitaetskosten" && !darf("qualitaetskostenSehen")) { toast("Keine Berechtigung für Qualitätskosten.", "err"); return; }
    if (format === "csv") { csvDownload("qualitaet-" + art + ".csv", rep.csv); return; }
    var rows = rep.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + esc(c == null ? "—" : c) + "</td>"; }).join("") + "</tr>"; }).join("");
    pdfFenster("Qualitätsbericht: " + art, "QB-" + art.toUpperCase(), "<h2>" + esc(art) + " (" + rep.rows.length + " Einträge)</h2><table><thead><tr>" +
      rep.headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody></table>", []);
  }

  // ============================================================
  //  DIALOGE
  // ============================================================
  function abweichungDialog(paId) {
    var s = st(); var db = s._db;
    var pa = paId ? Q().pruefauftragById(s, paId) : null;
    var faOpt = (s.stammdaten.fehlerarten || []).map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("");
    var fkOpt = (s.stammdaten.fehlerklassen || []).map(function (x) { return '<option value="' + esc(x.key) + '">' + esc(x.name) + "</option>"; }).join("");
    var rsOpt = (s.stammdaten.risikostufen || []).map(function (x) { return '<option value="' + esc(x.key) + '">' + esc(x.name) + "</option>"; }).join("");
    var aufOpt = '<option value="">—</option>' + (db.auftraege || []).map(function (a) { return '<option value="' + esc(a.id) + '"' + (pa && pa.auftragId === a.id ? " selected" : "") + ">" + esc(a.nummer || a.titel || a.id) + "</option>"; }).join("");
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Auftrag</span><select id="ab-auf">' + aufOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Bauteil</span><input id="ab-bauteil" value="' + esc((pa && pa.bauteil) || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Arbeitsgang</span><input id="ab-ag" value="' + esc((pa && pa.arbeitsgang) || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Fehlerart</span><select id="ab-fa">' + faOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Fehlerklasse</span><select id="ab-fk">' + fkOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Risikostufe</span><select id="ab-rs">' + rsOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Menge</span><input id="ab-menge" type="number" step="any" min="0" value="1"></label>' +
      '<label class="fld"><span class="lbl">Maschine</span><select id="ab-masch"><option value="">—</option>' + ((db.settings || {}).maschinen || []).map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + "</option>"; }).join("") + "</select></label>" +
      '</div><label class="fld"><span class="lbl">Beschreibung</span><input id="ab-beschr"></label>' +
      '<label class="fld"><span class="lbl">Sofortmaßnahme</span><input id="ab-sofort"></label>' +
      '<label class="fld"><span class="lbl">Foto-Referenz</span><input id="ab-foto"></label>';
    UI().openModalWide("Neue Abweichung", body, function () {
      var r = Q().abweichungNeu(s, {
        mandantId: null, auftragId: d.getElementById("ab-auf").value || null,
        kommission: ((db.auftraege || []).filter(function (a) { return a.id === d.getElementById("ab-auf").value; })[0] || {}).kommission || null,
        bauteil: d.getElementById("ab-bauteil").value, arbeitsgang: d.getElementById("ab-ag").value,
        pruefauftragId: paId || null, beschreibung: d.getElementById("ab-beschr").value,
        fehlerart: d.getElementById("ab-fa").value, fehlerklasse: d.getElementById("ab-fk").value,
        risikostufe: d.getElementById("ab-rs").value, menge: num(d.getElementById("ab-menge").value),
        maschineId: d.getElementById("ab-masch").value || null, sofortmassnahme: d.getElementById("ab-sofort").value,
        fotoRefs: d.getElementById("ab-foto").value ? [d.getElementById("ab-foto").value] : [],
        ersteller: benutzer(), rolle: rolle()
      }, jetzt());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save(); toast(r.neu ? "Abweichung " + r.abweichung.nummer + " angelegt." : "Abweichung bereits vorhanden (keine Dublette)."); refresh(); return true;
    }, "", null);
  }
  function sperrenDialog(abwId) {
    var s = st(); var abw = abwId ? Q().abweichungById(s, abwId) : null;
    var typOpt = Q().SPERR_OBJEKT.map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
    var body = '<label class="fld"><span class="lbl">Sperrgegenstand</span><select id="sp-typ">' + typOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Referenz (Auftrag/Charge/Bauteil)</span><input id="sp-ref" value="' + esc((abw && (abw.chargeId || abw.auftragId)) || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Grund (Pflicht)</span><input id="sp-grund"></label>';
    UI().openModal("Sperren", body, function () {
      var grund = d.getElementById("sp-grund").value;
      if (!grund) { toast("Grund erforderlich.", "err"); return false; }
      var r = Q().sperreNeu(s, { mandantId: null, objektTyp: d.getElementById("sp-typ").value, objektId: d.getElementById("sp-ref").value, abweichungId: abwId || null, grund: grund, benutzer: benutzer(), rolle: rolle() }, jetzt());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save(); toast("Gesperrt (mit Grund und Audit-Protokoll)."); refresh(); return true;
    }, "Sperren");
  }
  function entsperrenDialog(spId) {
    var s = st();
    var body = '<div class="insight"><span class="ico">⚠️</span><span>Die Entsperrung wird mit Benutzer, Grund und Zeitpunkt protokolliert.</span></div>' +
      '<label class="fld"><span class="lbl">Grund (Pflicht)</span><input id="se-grund"></label>' +
      '<label class="inline" style="gap:6px;font-size:13px"><input type="checkbox" id="se-best"> Ich bestätige, dass die Ursache behoben bzw. geprüft wurde.</label>';
    UI().openModal("Sperre aufheben", body, function () {
      if (!d.getElementById("se-best").checked) { toast("Bitte bestätigen.", "err"); return false; }
      var r = Q().sperreAufheben(s, spId, { benutzer: benutzer(), grund: d.getElementById("se-grund").value, rolle: rolle() }, jetzt());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save(); toast("Sperre aufgehoben (protokolliert)."); refresh(); return true;
    }, "Entsperren");
  }
  function nacharbeitDialog(abwId) {
    var s = st(); var db = s._db;
    var hOpt = Q().URSACHE_HERKUNFT.map(function (h) { return "<option>" + esc(h) + "</option>"; }).join("");
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Tätigkeit</span><input id="na-tat"></label>' +
      '<label class="fld"><span class="lbl">Ursache (Freitext)</span><input id="na-urs"></label>' +
      '<label class="fld"><span class="lbl">Herkunft</span><select id="na-herk">' + hOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Mitarbeitergruppe</span><input id="na-gruppe"></label>' +
      '<label class="fld"><span class="lbl">Maschine</span><select id="na-masch"><option value="">—</option>' + ((db.settings || {}).maschinen || []).map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span class="lbl">Material</span><input id="na-mat"></label>' +
      '<label class="fld"><span class="lbl">Geplante Zeit (h)</span><input id="na-geplant" type="number" step="0.25" min="0" value="0"></label>' +
      '<label class="fld"><span class="lbl">Tatsächliche Zeit (h)</span><input id="na-ist" type="number" step="0.25" min="0" value="0"></label>' +
      '<label class="fld"><span class="lbl">Termin</span><input id="na-termin" type="date"></label>' +
      '<label class="fld"><span class="lbl">Kosten (€)</span><input id="na-kosten" type="number" step="0.01" min="0" value="0"></label>' +
      '</div><label class="inline" style="gap:6px;font-size:13px"><input type="checkbox" id="na-frei" checked> Nacharbeit freigeben (erfordert Berechtigung)</label>' +
      '<div class="muted" style="font-size:12px;margin-top:6px">Die Herkunft ist standardmäßig „ungeklärt" – es erfolgt keine automatische Schuldzuweisung.</div>';
    UI().openModalWide("Nacharbeit anlegen", body, function () {
      var r = Q().nacharbeitNeu(s, {
        mandantId: null, abweichungId: abwId, taetigkeit: d.getElementById("na-tat").value, ursacheText: d.getElementById("na-urs").value,
        herkunft: d.getElementById("na-herk").value, mitarbeitergruppe: d.getElementById("na-gruppe").value,
        maschineId: d.getElementById("na-masch").value || null, materialId: d.getElementById("na-mat").value || null,
        geplanteZeitStd: num(d.getElementById("na-geplant").value), tatsaechlicheZeitStd: num(d.getElementById("na-ist").value),
        termin: d.getElementById("na-termin").value || null, benutzer: benutzer(), rolle: rolle(), freigeben: d.getElementById("na-frei").checked
      }, jetzt());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      var kosten = num(d.getElementById("na-kosten").value);
      if (kosten > 0) Q().kostenErfassen(s, { mandantId: null, abweichungId: abwId, nacharbeitId: r.nacharbeit.id, art: "Nacharbeit", betrag: kosten, benutzer: benutzer() }, jetzt());
      save(); toast("Nacharbeit angelegt."); refresh(); return true;
    }, "", null);
  }
  function sonderfreigabeDialog(abwId) {
    var s = st();
    var rsOpt = (s.stammdaten.risikostufen || []).map(function (x) { return '<option value="' + esc(x.key) + '">' + esc(x.name) + "</option>"; }).join("");
    var body = '<div class="insight"><span class="ico">⚠️</span><span>Eine Sonderfreigabe ist eine <strong>ausdrückliche technische Einzelfallentscheidung</strong> und <strong>keine Bestätigung von Normkonformität</strong>. Sie wird niemals automatisch erteilt.</span></div>' +
      '<label class="fld"><span class="lbl">Technische Beurteilung (Pflicht)</span><input id="sf-beurt"></label>' +
      '<div class="grid cols-2"><label class="fld"><span class="lbl">Risikostufe</span><select id="sf-rs">' + rsOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Einschränkungen</span><input id="sf-eins"></label></div>' +
      '<label class="inline" style="gap:6px;font-size:13px"><input type="checkbox" id="sf-kunde"> Kundenbestätigung erforderlich</label>';
    UI().openModalWide("Sonderfreigabe", body, function () {
      var r = Q().sonderfreigabeNeu(s, {
        mandantId: null, abweichungId: abwId, beurteilung: d.getElementById("sf-beurt").value,
        risikostufe: d.getElementById("sf-rs").value, einschraenkungen: d.getElementById("sf-eins").value,
        kundenbestaetigungErforderlich: d.getElementById("sf-kunde").checked, freigebender: benutzer(), rolle: rolle()
      }, jetzt());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save(); toast("Sonderfreigabe erteilt (dokumentiert)."); refresh(); return true;
    }, "", null);
  }
  function reklamationDialog() {
    var s = st(); var db = s._db;
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Kunde</span><select id="rk-kunde">' + (db.kunden || []).map(function (k) { return '<option value="' + esc(k.id) + '">' + esc(k.name) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span class="lbl">Auftrag</span><select id="rk-auf"><option value="">—</option>' + (db.auftraege || []).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.nummer || a.titel || a.id) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span class="lbl">Produkt</span><input id="rk-produkt"></label>' +
      '<label class="fld"><span class="lbl">Menge</span><input id="rk-menge" type="number" step="any" min="0" value="1"></label>' +
      '<label class="fld"><span class="lbl">Lieferdatum</span><input id="rk-lief" type="date"></label>' +
      '<label class="fld"><span class="lbl">Priorität</span><select id="rk-prio"><option>niedrig</option><option selected>mittel</option><option>hoch</option></select></label>' +
      '<label class="fld"><span class="lbl">Ansprechpartner</span><input id="rk-ap"></label>' +
      '<label class="fld"><span class="lbl">Verantwortlicher</span><input id="rk-ver" value="' + esc(benutzer() || "") + '"></label>' +
      '</div><label class="fld"><span class="lbl">Beschreibung</span><input id="rk-beschr"></label>' +
      '<div class="muted" style="font-size:12px">Die Reklamation startet neutral als „nicht bewertet".</div>';
    UI().openModalWide("Neue Kundenreklamation", body, function () {
      var auf = (db.auftraege || []).filter(function (a) { return a.id === d.getElementById("rk-auf").value; })[0];
      var r = Q().reklamationNeu(s, {
        mandantId: null, kundeId: d.getElementById("rk-kunde").value, auftragId: (auf && auf.id) || null, kommission: (auf && auf.kommission) || null,
        produkt: d.getElementById("rk-produkt").value, menge: num(d.getElementById("rk-menge").value),
        lieferdatum: d.getElementById("rk-lief").value || null, prioritaet: d.getElementById("rk-prio").value,
        ansprechpartner: d.getElementById("rk-ap").value, verantwortlicher: d.getElementById("rk-ver").value,
        beschreibung: d.getElementById("rk-beschr").value, benutzer: benutzer(), rolle: rolle()
      }, jetzt());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save(); toast("Reklamation " + r.reklamation.nummer + " angelegt (nicht bewertet)."); refresh(); return true;
    }, "", null);
  }
  function reklamationDetail(id) {
    var s = st(); var r = s.reklamationen.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var statusOpt = Object.keys(Q().REKL_STATUS).map(function (k) { var v = Q().REKL_STATUS[k]; return '<option value="' + esc(v) + '"' + (r.status === v ? " selected" : "") + ">" + esc(v) + "</option>"; }).join("");
    var kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + "</span><strong>" + v + "</strong></div>"; };
    var k = Q().kostenSumme(s, { auftragId: r.auftragId });
    var body = '<div class="grid cols-2">' + kv("Nummer", esc(r.nummer)) + kv("Status", statusTag(r.status, "warn")) +
      kv("Auftrag / Kommission", esc(r.auftragId || "—") + " / " + esc(r.kommission || "—")) + kv("Produkt / Menge", esc(r.produkt || "—") + " / " + fmt(r.menge)) +
      kv("Gemeldet", fmtDate(r.meldedatum)) + kv("Bewertung", statusTag(r.berechtigung, r.berechtigung === "nicht bewertet" ? "info" : "warn")) +
      (darf("qualitaetskostenSehen") ? kv("Qualitätskosten (Auftrag)", fmtEUR(k.gesamt)) : "") + "</div>" +
      '<div class="kv"><span>Beschreibung</span><strong>' + esc(r.beschreibung || "—") + "</strong></div>" +
      '<div class="grid cols-2" style="margin-top:10px"><label class="fld"><span class="lbl">Status ändern</span><select id="rd-status">' + statusOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Grund</span><input id="rd-grund"></label></div>' +
      '<div class="btn-row"><button class="btn" id="rd-save">Status speichern</button></div>' +
      '<h4 style="margin:12px 0 4px">Bewertung (ausdrücklich)</h4>' +
      '<div class="grid cols-2"><label class="fld"><span class="lbl">Berechtigung</span><select id="rd-bw"><option>nicht bewertet</option><option>berechtigt</option><option>teilweise berechtigt</option><option>unberechtigt</option></select></label>' +
      '<label class="fld"><span class="lbl">Begründung (Pflicht)</span><input id="rd-bwg"></label></div>' +
      '<div class="btn-row"><button class="btn" id="rd-bwsave">Bewertung speichern</button></div>' +
      '<div class="muted" style="font-size:12px">Es erfolgt keine automatische Bewertung als berechtigt oder unberechtigt.</div>';
    UI().openModalWide("Reklamation " + r.nummer, body, null, "", null);
    setTimeout(function () {
      var b1 = d.getElementById("rd-save");
      if (b1) b1.onclick = function () {
        var res = Q().reklamationStatus(s, r.id, d.getElementById("rd-status").value, { benutzer: benutzer(), grund: d.getElementById("rd-grund").value }, jetzt());
        if (!res.ok) { toast(res.grund, "err"); return; } save(); toast("Status gespeichert."); UI().closeModal(); refresh();
      };
      var b2 = d.getElementById("rd-bwsave");
      if (b2) b2.onclick = function () {
        var res = Q().reklamationBewerten(s, r.id, d.getElementById("rd-bw").value, { benutzer: benutzer(), begruendung: d.getElementById("rd-bwg").value }, jetzt());
        if (!res.ok) { toast(res.grund, "err"); return; } save(); toast("Bewertung gespeichert."); UI().closeModal(); refresh();
      };
    }, 60);
  }
  function lieferantenDialog() {
    var s = st(); var db = s._db;
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Lieferant</span><select id="lr-lief">' + (db.lieferanten || []).map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.name) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span class="lbl">Wareneingang</span><select id="lr-we"><option value="">—</option>' + (db.wareneingaenge || []).map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.lieferschein || x.id) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span class="lbl">Material</span><select id="lr-art"><option value="">—</option>' + (db.lagerArtikel || []).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.artikelnummer) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span class="lbl">Charge</span><select id="lr-ch"><option value="">—</option>' + (db.lagerChargen || []).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.chargennummer) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span class="lbl">Menge</span><input id="lr-menge" type="number" step="any" min="0" value="1"></label>' +
      '<label class="fld"><span class="lbl">Zertifikat</span><input id="lr-zert"></label>' +
      '</div><label class="fld"><span class="lbl">Fehler</span><input id="lr-fehler"></label>' +
      '<label class="fld"><span class="lbl">Geforderte Maßnahme</span><input id="lr-mass"></label>' +
      '<label class="inline" style="gap:6px;font-size:13px"><input type="checkbox" id="lr-sperr" checked> Betroffene Charge sofort sperren</label>';
    UI().openModalWide("Lieferantenreklamation", body, function () {
      var r = Q().lieferantenReklamationNeu(s, lagerState(), {
        mandantId: null, lieferantId: d.getElementById("lr-lief").value, wareneingangId: d.getElementById("lr-we").value || null,
        artikelId: d.getElementById("lr-art").value || null, chargeId: d.getElementById("lr-ch").value || null,
        menge: num(d.getElementById("lr-menge").value), fehler: d.getElementById("lr-fehler").value,
        zertifikat: d.getElementById("lr-zert").value, geforderteMassnahme: d.getElementById("lr-mass").value,
        chargeSperren: d.getElementById("lr-sperr").checked, benutzer: benutzer(), rolle: rolle()
      }, jetzt());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save(); toast("Lieferantenreklamation angelegt" + (r.lieferantenReklamation.sperrId ? " · Charge gesperrt." : ".")); refresh(); return true;
    }, "", null);
  }
  function massnahmeDialog() {
    var s = st();
    var abwOpt = '<option value="">—</option>' + s.abweichungen.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.nummer) + "</option>"; }).join("");
    var rkOpt = '<option value="">—</option>' + s.reklamationen.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.nummer) + "</option>"; }).join("");
    var body = '<label class="fld"><span class="lbl">Beschreibung</span><input id="ma-beschr"></label>' +
      '<div class="grid cols-2"><label class="fld"><span class="lbl">Abweichung</span><select id="ma-abw">' + abwOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Reklamation</span><select id="ma-rk">' + rkOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Verantwortlicher</span><input id="ma-ver" value="' + esc(benutzer() || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Frist</span><input id="ma-frist" type="date"></label></div>';
    UI().openModalWide("Korrekturmaßnahme", body, function () {
      var r = Q().massnahmeNeu(s, { mandantId: null, beschreibung: d.getElementById("ma-beschr").value, abweichungId: d.getElementById("ma-abw").value || null, reklamationId: d.getElementById("ma-rk").value || null, verantwortlicher: d.getElementById("ma-ver").value, frist: d.getElementById("ma-frist").value || null, benutzer: benutzer() }, jetzt());
      if (!r.ok) { toast(r.grund, "err"); return false; }
      save(); toast("Maßnahme angelegt."); refresh(); return true;
    }, "", null);
  }
  function massnahmeDetail(id) {
    var s = st(); var m = s.massnahmen.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    var opts = Object.keys(Q().MASSNAHME_STATUS).map(function (k) { var v = Q().MASSNAHME_STATUS[k]; return '<option value="' + esc(v) + '"' + (m.status === v ? " selected" : "") + ">" + esc(v) + "</option>"; }).join("");
    var abw = m.abweichungId ? Q().abweichungById(s, m.abweichungId) : null;
    var rk = m.reklamationId ? s.reklamationen.filter(function (x) { return x.id === m.reklamationId; })[0] : null;
    var kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + "</span><strong>" + v + "</strong></div>"; };
    var body = '<div class="grid cols-2">' + kv("Nummer", esc(m.nummer)) + kv("Status", statusTag(m.status, "wait")) +
      kv("Verantwortlicher", esc(m.verantwortlicher || "—")) + kv("Frist", fmtDate(m.frist)) +
      kv("Abweichung", esc((abw && abw.nummer) || "—")) + kv("Reklamation", esc((rk && rk.nummer) || "—")) + "</div>" +
      '<div class="kv"><span>Beschreibung</span><strong>' + esc(m.beschreibung) + "</strong></div>" +
      (m.wirksamkeitspruefung ? '<div class="kv"><span>Wirksamkeitsprüfung</span><strong>' + esc(m.wirksamkeitspruefung.ergebnis) + " · " + esc(m.wirksamkeitspruefung.geprueftVon) + " · " + fmtDT(m.wirksamkeitspruefung.zeitpunkt) + "</strong></div>" : "") +
      '<div class="grid cols-2" style="margin-top:10px"><label class="fld"><span class="lbl">Neuer Status</span><select id="md-status">' + opts + "</select></label>" +
      '<label class="fld"><span class="lbl">Bemerkung/Grund</span><input id="md-grund"></label></div>' +
      '<div class="btn-row"><button class="btn primary" id="md-save">Status speichern</button></div>' +
      "<h4 style='margin:12px 0 4px'>Verlauf</h4>" + tableWrap(["Zeitpunkt", "Status", "Benutzer", "Grund"], (m.historie || []).map(function (h) { return [fmtDT(h.zeitpunkt), esc(h.status), esc(h.benutzer || "—"), esc(h.grund || "—")]; }));
    UI().openModalWide("Maßnahme " + m.nummer, body, null, "", null);
    setTimeout(function () {
      var b = d.getElementById("md-save");
      if (b) b.onclick = function () {
        var r = Q().massnahmeStatus(s, m.id, d.getElementById("md-status").value, { benutzer: benutzer(), grund: d.getElementById("md-grund").value, bemerkung: d.getElementById("md-grund").value }, jetzt());
        if (!r.ok) { toast(r.grund, "err"); return; } save(); toast("Status gespeichert."); UI().closeModal(); refresh();
      };
    }, 60);
  }
  function pruefmittelDialog() {
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Nummer</span><input id="pm-nr"></label>' +
      '<label class="fld"><span class="lbl">Bezeichnung</span><input id="pm-bez"></label>' +
      '<label class="fld"><span class="lbl">Hersteller</span><input id="pm-her"></label>' +
      '<label class="fld"><span class="lbl">Modell</span><input id="pm-mod"></label>' +
      '<label class="fld"><span class="lbl">Seriennummer</span><input id="pm-sn"></label>' +
      '<label class="fld"><span class="lbl">Messbereich</span><input id="pm-mb"></label>' +
      '<label class="fld"><span class="lbl">Genauigkeit</span><input id="pm-gen"></label>' +
      '<label class="fld"><span class="lbl">Standort</span><input id="pm-ort"></label>' +
      '<label class="fld"><span class="lbl">Verantwortlicher</span><input id="pm-ver"></label>' +
      '<label class="fld"><span class="lbl">Kalibrierintervall (Tage)</span><input id="pm-int" type="number" min="1" value="365"></label>' +
      '<label class="fld"><span class="lbl">Letzte Kalibrierung</span><input id="pm-let" type="date"></label>' +
      '<label class="fld"><span class="lbl">Zertifikat</span><input id="pm-zert"></label></div>';
    UI().openModalWide("Neues Prüfmittel", body, function () {
      var s = st();
      Q().pruefmittelNeu(s, {
        mandantId: null, nummer: d.getElementById("pm-nr").value, bezeichnung: d.getElementById("pm-bez").value,
        hersteller: d.getElementById("pm-her").value, modell: d.getElementById("pm-mod").value, seriennummer: d.getElementById("pm-sn").value,
        messbereich: d.getElementById("pm-mb").value, genauigkeit: d.getElementById("pm-gen").value, standort: d.getElementById("pm-ort").value,
        verantwortlicher: d.getElementById("pm-ver").value, kalibrierintervallTage: num(d.getElementById("pm-int").value),
        letzteKalibrierung: d.getElementById("pm-let").value || null, zertifikat: d.getElementById("pm-zert").value
      }, jetzt());
      Q().pruefmittelStatusAktualisieren(s, jetzt());
      save(); toast("Prüfmittel angelegt."); refresh(); return true;
    }, "", null);
  }
  function kalibrierungDialog(pmId) {
    var s = st(); var pm = Q().pruefmittelById(s, pmId);
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Kalibrierdatum</span><input id="kb-datum" type="date"></label>' +
      '<label class="fld"><span class="lbl">Intervall (Tage)</span><input id="kb-int" type="number" min="1" value="' + num(pm.kalibrierintervallTage) + '"></label>' +
      '<label class="fld"><span class="lbl">Kalibrierzertifikat</span><input id="kb-zert" value="' + esc(pm.zertifikat || "") + '"></label></div>' +
      '<div class="muted" style="font-size:12px">Die Eintragung ist eine interne Dokumentation – <strong>keine akkreditierte Kalibrierbescheinigung</strong>.</div>';
    UI().openModal("Neue Kalibrierung – " + pm.nummer, body, function () {
      var datum = d.getElementById("kb-datum").value;
      var r = Q().kalibrierungNeu(s, pmId, { datum: datum ? new Date(datum).toISOString() : jetzt(), intervallTage: num(d.getElementById("kb-int").value), zertifikat: d.getElementById("kb-zert").value, benutzer: benutzer(), rolle: rolle() }, jetzt());
      if (!r.ok) { toast(r.grund, "err"); return false; }
      save(); toast("Kalibrierung eingetragen – nächste am " + fmtDate(r.pruefmittel.naechsteKalibrierung) + "."); refresh(); return true;
    }, "Speichern");
  }
  function betroffenePruefungenDialog(pmId) {
    var s = st(); var liste = Q().betroffenePruefungen(s, pmId);
    var rows = liste.map(function (x) { return [esc(x.nummer), esc(x.auftragId || "—"), x.schrittNummer, fmtDT(x.zeitpunkt), ergebnisTag(x.ergebnis)]; });
    UI().openModalWide("Möglicherweise betroffene Prüfungen", tableWrap(["Prüfauftrag", "Auftrag", "Schritt", "Zeitpunkt", "Ergebnis"], rows) +
      '<div class="insight"><span class="ico">ℹ️</span><span>Diese Prüfungen wurden mit dem gewählten Prüfmittel durchgeführt. Es findet <strong>keine automatische Neubewertung</strong> statt – bitte fachlich entscheiden, ob eine Nachprüfung nötig ist.</span></div>', null, "", null);
  }
  function abnahmeDialog() {
    var s = st(); var db = s._db;
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Auftrag</span><select id="an-auf">' + (db.auftraege || []).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.nummer || a.titel || a.id) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span class="lbl">Baustelle</span><input id="an-bs"></label>' +
      '<label class="fld"><span class="lbl">Datum</span><input id="an-datum" type="date"></label>' +
      '<label class="fld"><span class="lbl">Nachtermin</span><input id="an-nt" type="date"></label>' +
      '<label class="fld"><span class="lbl">Anwesende (Komma)</span><input id="an-anw"></label>' +
      '<label class="fld"><span class="lbl">Name Kenntnisnahme</span><input id="an-name"></label></div>' +
      '<label class="fld"><span class="lbl">Ausgeführte Leistungen</span><input id="an-leist"></label>' +
      '<label class="fld"><span class="lbl">Mängel (Komma)</span><input id="an-maengel"></label>' +
      '<label class="fld"><span class="lbl">Offene Punkte (Komma)</span><input id="an-offen"></label>' +
      '<label class="fld"><span class="lbl">Restarbeiten (Komma)</span><input id="an-rest"></label>' +
      '<label class="fld"><span class="lbl">Kundenkommentar</span><input id="an-komm"></label>' +
      '<label class="inline" style="gap:6px;font-size:13px"><input type="checkbox" id="an-kn"> Kenntnisnahme bestätigt</label>' +
      '<div class="insight"><span class="ico">ℹ️</span><span>Die Bestätigung ist eine <strong>Kenntnisnahme</strong> – <strong>keine qualifizierte elektronische Signatur</strong>.</span></div>';
    UI().openModalWide("Montage-/Kundenabnahme", body, function () {
      var auf = (db.auftraege || []).filter(function (a) { return a.id === d.getElementById("an-auf").value; })[0] || {};
      var split = function (id) { var v = d.getElementById(id).value; return v ? v.split(",").map(function (x) { return x.trim(); }).filter(Boolean) : []; };
      var r = Q().abnahmeNeu(s, {
        mandantId: null, auftragId: auf.id, kommission: auf.kommission, kundeId: auf.kundeId,
        baustelle: d.getElementById("an-bs").value, datum: d.getElementById("an-datum").value ? new Date(d.getElementById("an-datum").value).toISOString() : jetzt(),
        anwesende: split("an-anw"), ausgefuehrteLeistungen: d.getElementById("an-leist").value,
        maengel: split("an-maengel"), offenePunkte: split("an-offen"), restarbeiten: split("an-rest"),
        nachtermin: d.getElementById("an-nt").value ? new Date(d.getElementById("an-nt").value).toISOString() : null,
        kundenkommentar: d.getElementById("an-komm").value, kenntnisnahme: d.getElementById("an-kn").checked,
        kenntnisnahmeName: d.getElementById("an-name").value, benutzer: benutzer()
      }, jetzt());
      if (!r.ok) { toast(r.grund, "err"); return false; }
      save(); toast("Abnahmeprotokoll " + r.abnahme.nummer + " erstellt."); refresh(); return true;
    }, "", null);
  }

  // ============================================================
  //  EVENT-VERDRAHTUNG
  // ============================================================
  function wire(root) {
    var bind = function (id, fn) { var el = d.getElementById(id); if (el) fn(el); };
    var on = function (sel, attr, fn) { root.querySelectorAll(sel).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); fn(b.getAttribute(attr), b); }; }); };
    // Filterleiste
    var fset = function (id, key, ev) { bind(id, function (el) { el[ev || "onchange"] = function () { filter[key] = el.value; refresh(); }; }); };
    fset("qf-von", "von"); fset("qf-bis", "bis"); fset("qf-komm", "kommission"); fset("qf-pg", "produktgruppeKey");
    fset("qf-masch", "maschineId"); fset("qf-art", "artikelId"); fset("qf-ch", "chargeId");
    fset("qf-status", "pruefstatus"); fset("qf-fa", "fehlerart"); fset("qf-ver", "verantwortlicher");
    bind("qf-reset", function (el) { el.onclick = function () { Object.keys(filter).forEach(function (k) { filter[k] = ""; }); refresh(); }; });
    // Prüfpläne
    on("[data-ppneu]", "data-ppneu", function () { planEditorOeffnen(null, false); });
    on("[data-ppedit]", "data-ppedit", function (id) { planEditorOeffnen(id, false); });
    on("[data-ppver]", "data-ppver", function (id) { planEditorOeffnen(id, true); });
    on("[data-ppview]", "data-ppview", planVorschau);
    on("[data-ppdiff]", "data-ppdiff", planVergleich);
    on("[data-ppfrei]", "data-ppfrei", function (id) { var s = st(); var r = Q().pruefplanFreigeben(s, id, benutzer(), rolle(), jetzt()); if (!r.ok) { toast(r.grund, "err"); return; } save(); toast("Prüfplan freigegeben."); refresh(); });
    on("[data-ppakt]", "data-ppakt", function (id) { var s = st(); var p = Q().pruefplanById(s, id); p.aktiv = !p.aktiv; Q().audit(s, { mandantId: p.mandantId, benutzer: benutzer(), aktion: "pruefplan.aktiv", referenzTyp: "pruefplan", referenzId: p.id, nachher: p.aktiv ? "aktiv" : "inaktiv" }, jetzt()); save(); toast(p.aktiv ? "Aktiviert." : "Deaktiviert."); refresh(); });
    bind("pe-back", function (el) { el.onclick = function () { planEdit = null; refresh(); }; });
    bind("pe-cancel", function (el) { el.onclick = function () { planEdit = null; refresh(); }; });
    bind("pe-save", function (el) { el.onclick = planSpeichern; });
    bind("pe-schritt-neu", function (el) { el.onclick = function () { schrittDialog(null); }; });
    on("[data-seedit]", "data-seedit", function (i) { schrittDialog(num(i)); });
    on("[data-seddel]", "data-seddel", function (i) { if (w.confirm("Prüfschritt entfernen?")) { editorFelderUebernehmen(); planEdit.daten.schritte.splice(num(i), 1); refresh(); } });
    // Prüfaufträge / Assistent
    on("[data-pastart]", "data-pastart", function (id) { pruefLauf = { paId: id, index: 0 }; refresh(); });
    on("[data-padetail]", "data-padetail", function (id) { pruefLauf = { paId: id, index: 0 }; refresh(); });
    on("[data-paprot]", "data-paprot", pdfPruefprotokoll);
    on("[data-paabw]", "data-paabw", function (id) { TAB = "abweichungen"; refresh(); });
    on("[data-pazuweisen]", "data-pazuweisen", function (id) {
      var s = st(); var db = s._db; var pa = Q().pruefauftragById(s, id);
      UI().openModal("Prüfer zuweisen", '<label class="fld"><span class="lbl">Prüfer</span><select id="pz-user">' + (db.users || []).map(function (u) { return '<option value="' + esc(u.benutzername) + '"' + (pa.pruefer === u.benutzername ? " selected" : "") + ">" + esc(u.name) + "</option>"; }).join("") + "</select></label>", function () {
        pa.pruefer = d.getElementById("pz-user").value; pa.geaendert = jetzt();
        Q().audit(s, { mandantId: pa.mandantId, benutzer: benutzer(), aktion: "pruefauftrag.pruefer", referenzTyp: "pruefauftrag", referenzId: pa.id, nachher: pa.pruefer }, jetzt());
        save(); toast("Prüfer zugewiesen."); refresh(); return true;
      }, "Zuweisen");
    });
    bind("pw-back", function (el) { el.onclick = function () { pruefLauf = null; refresh(); }; });
    bind("pw-save", function (el) { el.onclick = ergebnisSpeichern; });
    bind("pw-prev", function (el) { el.onclick = function () { pruefLauf.index--; refresh(); }; });
    bind("pw-next", function (el) { el.onclick = function () { pruefLauf.index++; refresh(); }; });
    bind("pw-abw", function (el) { el.onclick = function () { abweichungDialog(pruefLauf.paId); }; });
    on("[data-pgoto]", "data-pgoto", function (i) { pruefLauf.index = num(i); refresh(); });
    bind("pw-finish", function (el) {
      el.onclick = function () {
        var s = st(); var a = Q().pruefauftragAuswerten(s, pruefLauf.paId);
        var body = '<div class="grid cols-2"><div class="kv"><span>Offene Pflichtschritte</span><strong>' + a.offenePflichtschritte.length + '</strong></div><div class="kv"><span>Außerhalb Toleranz</span><strong>' + a.ausserhalb + '</strong></div><div class="kv"><span>Nachprüfung</span><strong>' + a.nachpruefung + '</strong></div><div class="kv"><span>Sperrende Fehler</span><strong>' + a.sperrend + "</strong></div></div>" +
          (a.ausserhalb ? '<label class="inline" style="gap:6px;font-size:13px;margin-top:8px"><input type="checkbox" id="pf-mab"> Trotz Abweichung als „mit Abweichung bestanden" abschließen (nur mit Begründung)</label><label class="fld"><span class="lbl">Begründung</span><input id="pf-grund"></label>' : "");
        UI().openModal("Prüfung abschließen", body, function () {
          var mab = d.getElementById("pf-mab") && d.getElementById("pf-mab").checked;
          var grund = d.getElementById("pf-grund") ? d.getElementById("pf-grund").value : "";
          if (mab && !grund) { toast("Begründung erforderlich.", "err"); return false; }
          var r = Q().pruefauftragAbschliessen(s, pruefLauf.paId, { pruefer: benutzer(), rolle: rolle(), mitAbweichungBestanden: mab, grund: grund }, jetzt());
          if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
          save(); toast("Prüfung abgeschlossen: " + r.status); pruefLauf = null; refresh(); return true;
        }, "Abschließen");
      };
    });
    // Abweichungen
    on("[data-abwneu]", "data-abwneu", function () { abweichungDialog(null); });
    on("[data-abwdet]", "data-abwdet", abweichungDetail);
    on("[data-abwsperr]", "data-abwsperr", sperrenDialog);
    on("[data-abwna]", "data-abwna", nacharbeitDialog);
    on("[data-abwsf]", "data-abwsf", sonderfreigabeDialog);
    on("[data-abwaus]", "data-abwaus", ausschussDialog);
    on("[data-abwpdf]", "data-abwpdf", pdfAbweichung);
    on("[data-abwstatus]", "data-abwstatus", function (id) {
      var s = st();
      var opts = Object.keys(Q().ABW_STATUS).map(function (k) { var v = Q().ABW_STATUS[k]; return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join("");
      UI().openModal("Status der Abweichung ändern", '<label class="fld"><span class="lbl">Status</span><select id="as-status">' + opts + '</select></label><label class="fld"><span class="lbl">Grund</span><input id="as-grund"></label>', function () {
        var r = Q().abweichungStatus(s, id, d.getElementById("as-status").value, { benutzer: benutzer(), grund: d.getElementById("as-grund").value }, jetzt());
        if (!r.ok) { toast(r.grund, "err"); return false; } save(); toast("Status gespeichert."); refresh(); return true;
      }, "Speichern");
    });
    on("[data-ursneu]", "data-ursneu", function (id) {
      var s = st();
      var katOpt = Q().URSACHE_KATEGORIE.map(function (k) { return "<option>" + esc(k) + "</option>"; }).join("");
      UI().openModalWide("Ursachenkandidat (Vermutung)", '<label class="fld"><span class="lbl">Möglicher Grund</span><input id="uk-text"></label>' +
        '<label class="fld"><span class="lbl">Kategorie</span><select id="uk-kat"><option value="">—</option>' + katOpt + "</select></label>" +
        '<label class="fld"><span class="lbl">5-Why (mit → oder Komma trennen)</span><input id="uk-why" placeholder="Warum 1 → Warum 2 → …"></label>' +
        '<div class="muted" style="font-size:12px">Kandidaten sind Vermutungen und werden nie automatisch als gesicherte Ursache dargestellt.</div>', function () {
          var why = d.getElementById("uk-why").value; var arr = why ? why.split(/→|,/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
          var r = Q().ursacheKandidatHinzufuegen(s, id, { text: d.getElementById("uk-text").value, kategorie: d.getElementById("uk-kat").value || null, fuenfWhy: arr, benutzer: benutzer() }, jetzt());
          if (!r.ok) { toast(r.grund, "err"); return false; } save(); toast("Ursachenkandidat ergänzt."); refresh(); return true;
        }, "", null);
    });
    on("[data-urskonf]", "data-urskonf", function (v) {
      var parts = v.split("|"); var s = st();
      var hOpt = Q().URSACHE_HERKUNFT.map(function (h) { return "<option>" + esc(h) + "</option>"; }).join("");
      UI().openModal("Ursache bestätigen", '<div class="insight"><span class="ico">⚠️</span><span>Die Bestätigung ist eine ausdrückliche fachliche Entscheidung.</span></div>' +
        '<label class="fld"><span class="lbl">Herkunft (optional)</span><select id="ub-herk">' + hOpt + '</select></label><label class="fld"><span class="lbl">Grund/Nachweis</span><input id="ub-grund"></label>', function () {
          var r = Q().ursacheBestaetigen(s, parts[0], parts[1], { benutzer: benutzer(), herkunft: d.getElementById("ub-herk").value, grund: d.getElementById("ub-grund").value }, jetzt());
          if (!r.ok) { toast(r.grund, "err"); return false; } save(); toast("Ursache bestätigt."); refresh(); return true;
        }, "Bestätigen");
    });
    // Sperren
    on("[data-spauf]", "data-spauf", entsperrenDialog);
    on("[data-spdet]", "data-spdet", sperreDetail);
    // Nacharbeit / Ausschuss
    on("[data-nanp]", "data-nanp", function (id) {
      var s = st(); var r = Q().nachpruefungAnlegen(s, id, { pruefer: benutzer(), benutzer: benutzer() }, jetzt());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return; }
      save(); toast("Nachprüfung " + r.pruefauftrag.nummer + " aus demselben Prüfplan-Snapshot erzeugt."); TAB = "pruefauftraege"; refresh();
    });
    on("[data-napdf]", "data-napdf", pdfNacharbeit);
    on("[data-ausneu]", "data-ausneu", function () { ausschussDialog(null); });
    // Reklamationen
    on("[data-rkneu]", "data-rkneu", reklamationDialog);
    on("[data-rkdet]", "data-rkdet", reklamationDetail);
    on("[data-rkpdf]", "data-rkpdf", pdfReklamation);
    on("[data-lrneu]", "data-lrneu", lieferantenDialog);
    on("[data-lrdet]", "data-lrdet", function (id) {
      var s = st(); var r = s.lieferantenReklamationen.filter(function (x) { return x.id === id; })[0]; if (!r) return;
      var kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + "</span><strong>" + v + "</strong></div>"; };
      UI().openModalWide("Lieferantenreklamation " + r.nummer, '<div class="grid cols-2">' + kv("Lieferant", esc(r.lieferantId || "—")) + kv("Wareneingang", esc(r.wareneingangId || "—")) +
        kv("Charge", esc(r.chargeId || "—")) + kv("Menge", fmt(r.menge)) + kv("Fehler", esc(r.fehler || "—")) + kv("Zertifikat", esc(r.zertifikat || "—")) +
        kv("Geforderte Maßnahme", esc(r.geforderteMassnahme || "—")) + kv("Status", esc(r.status)) + kv("Charge gesperrt", r.sperrId ? "ja" : "nein") + "</div>", null, "", null);
    });
    on("[data-lrsperr]", "data-lrsperr", function (id) {
      var s = st(); var r = s.lieferantenReklamationen.filter(function (x) { return x.id === id; })[0];
      var sp = Q().sperreNeu(s, { mandantId: null, objektTyp: "Materialcharge", objektId: r.chargeId, grund: "Lieferantenreklamation " + r.nummer, benutzer: benutzer(), rolle: rolle() }, jetzt());
      if (!sp.ok) { toast(sp.grund, "err"); return; }
      r.sperrId = sp.sperre.id;
      if (L()) { try { L().chargeSperren(lagerState(), r.chargeId, "QM: " + r.nummer, jetzt()); } catch (e) {} }
      save(); toast("Charge gesperrt (Qualitäts- und Lagerkern)."); refresh();
    });
    // Maßnahmen
    on("[data-maneu]", "data-maneu", massnahmeDialog);
    on("[data-madet]", "data-madet", massnahmeDetail);
    // Prüfmittel
    on("[data-pmneu]", "data-pmneu", pruefmittelDialog);
    on("[data-pmkal]", "data-pmkal", kalibrierungDialog);
    on("[data-pmbetr]", "data-pmbetr", betroffenePruefungenDialog);
    on("[data-pmpdf]", "data-pmpdf", pdfPruefmittel);
    on("[data-pmsperr]", "data-pmsperr", function (id) {
      var s = st(); var pm = Q().pruefmittelById(s, id);
      pm.status = pm.status === Q().PM_STATUS.GESPERRT ? Q().PM_STATUS.VERFUEGBAR : Q().PM_STATUS.GESPERRT;
      Q().pruefmittelStatusAktualisieren(s, jetzt());
      Q().audit(s, { mandantId: pm.mandantId, benutzer: benutzer(), aktion: "pruefmittel.status", referenzTyp: "pruefmittel", referenzId: pm.id, nachher: pm.status }, jetzt());
      save(); toast("Prüfmittel: " + pm.status); refresh();
    });
    // Abnahmen / Portal
    on("[data-abnneu]", "data-abnneu", abnahmeDialog);
    on("[data-abnpdf]", "data-abnpdf", pdfAbnahme);
    on("[data-abnportal]", "data-abnportal", function (id) {
      var s = st(); var ab = (s.abnahmen || []).filter(function (x) { return x.id === id; })[0];
      var r = Q().portalFreigabe(s, { mandantId: null, typ: "abnahme", referenzId: id, kundeId: ab.kundeId, benutzer: benutzer(), rolle: rolle(), sichtbar: !ab.portalFreigegeben, titel: "Abnahmeprotokoll " + ab.nummer }, jetzt());
      if (!r.ok) { toast(r.grund, "err"); return; }
      save(); toast(r.freigabe.sichtbar ? "Für Kundenportal freigegeben." : "Aus dem Portal entfernt."); refresh();
    });
    on("[data-pfwiderruf]", "data-pfwiderruf", function (id) {
      var s = st(); var f = (s.portalFreigaben || []).filter(function (x) { return x.id === id; })[0];
      f.sichtbar = !f.sichtbar;
      if (f.typ === "abnahme") { var ab = (s.abnahmen || []).filter(function (x) { return x.id === f.referenzId; })[0]; if (ab) ab.portalFreigegeben = f.sichtbar; }
      Q().audit(s, { mandantId: f.mandantId, benutzer: benutzer(), aktion: "portal.sichtbarkeit", referenzTyp: f.typ, referenzId: f.referenzId, nachher: f.sichtbar ? "sichtbar" : "verborgen" }, jetzt());
      save(); toast(f.sichtbar ? "Wieder sichtbar." : "Verborgen."); refresh();
    });
    // Berichte
    on("[data-qrep]", "data-qrep", function (v) { var p = v.split("|"); berichtAusfuehren(p[0], p[1]); });
  }

  P.QualitaetUI = { render: render };
})(window, document);
