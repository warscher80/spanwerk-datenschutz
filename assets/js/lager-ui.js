/* ============================================================
   Preisschmiede – Lageroberfläche (Phase 15B, Desktop)
   Vollständige Lager-UI auf Basis des Phase-15A-Lagerkerns
   (window.Preisschmiede.Lager). KEINE zweite Bestandslogik:
   jede Buchung/Berechnung läuft über die Engine; die Töpfe
   kommen aus dem unveränderbaren Bewegungsjournal. Preise/
   Lagerwerte nur für berechtigte Rollen. Keine Löschung von
   Bewegungen; Korrektur nur per Storno/Gegenbuchung. Keine
   echte Bestellung wird versendet, keine ERP-Anbindung.
   ============================================================ */
(function (w, d) {
  "use strict";
  var P = w.Preisschmiede = w.Preisschmiede || {};
  function Store() { return P.Store; }
  function L() { return P.Lager; }
  function Auth() { return P.Auth; }
  function UI() { return P.UI || {}; }

  var TAB = "dashboard";
  var _root = null;
  var journalFilter = { q: "", typ: "" };
  var artikelFilter = { q: "", werkstoff: "", unterMelde: false, gesperrt: false, mitRest: false, ohnePreis: false };
  var restFilter = { q: "", werkstoff: "", status: "" };
  var traceRichtung = "vor";

  // ---- Hilfen ----
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
  function fmt(n) { return (Math.round(num(n) * 1000) / 1000).toLocaleString("de-AT"); }
  function fmtEUR(n) { return num(n).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
  function fmtDT(iso) { try { return iso ? new Date(iso).toLocaleString("de-AT") : "—"; } catch (e) { return "—"; } }
  function fmtDate(iso) { try { return iso ? new Date(iso).toLocaleDateString("de-AT") : "—"; } catch (e) { return "—"; } }
  function kurzNr(id) { return String(id || "").replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase(); }
  function toast(m, k) { if (UI().toast) UI().toast(m, k); }
  function rolle() { var a = Auth(); return a && a.current() ? a.current().rolle : null; }
  function benutzer() { var a = Auth(); return a && a.current() ? a.current().benutzername : null; }
  function darf(recht) { return L().darf(rolle(), recht); }
  function darfWert() { return L().darfEinkaufspreise(rolle()); }
  function mandantId() { return null; } // Beispieldaten mandantenneutral; Isolation über Speicher-Namespace

  function st() {
    var db = Store().load();
    return {
      _db: db, artikel: db.lagerArtikel, plaetze: db.lagerplaetze, chargen: db.lagerChargen, bewegungen: db.lagerBewegungen,
      reservierungen: db.lagerReservierungen, reststuecke: db.lagerReststuecke, wareneingaenge: db.wareneingaenge,
      bestellungen: db.bestellungen, konflikte: db.lagerKonflikte, inventuren: db.lagerInventuren,
      standorte: db.lagerStandorte, lager: db.lager, bereiche: db.lagerBereiche, regale: db.lagerRegale
    };
  }
  function save() { Store().save(); }
  function refresh() { if (_root) render(_root); }
  function artName(s, id) { var a = L().artikelById(s, id); return a ? a.artikelnummer : (id || "—"); }
  function platzName(s, id) { var p = L().platzById(s, id); return p ? p.code : (id || "—"); }
  function chargeName(s, id) { var c = id ? L().chargeById(s, id) : null; return c ? c.chargennummer : "—"; }

  function tableWrap(headers, rows) {
    if (!rows.length) return '<div class="empty">Keine Einträge.</div>';
    var h = "<thead><tr>" + headers.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr></thead>";
    var b = "<tbody>" + rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody>";
    return '<div class="table-wrap"><table class="table">' + h + b + "</table></div>";
  }
  function csvDownload(name, csv) {
    try {
      var blob = new w.Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      var url = w.URL.createObjectURL(blob); var a = d.createElement("a"); a.href = url; a.download = name; d.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { w.URL.revokeObjectURL(url); }, 1000);
      toast("CSV exportiert: " + name);
    } catch (e) { toast("Export nicht möglich.", "err"); }
  }
  function printWindow(title, innerHtml) {
    var win = w.open("", "_blank"); if (!win) { toast("Pop-up blockiert.", "err"); return; }
    win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:system-ui,Arial,sans-serif;margin:24px;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}.lbl{background:#fff;border:1px solid #333;border-radius:8px;padding:10px;display:inline-block;margin:6px;width:230px;vertical-align:top}.qr svg{width:150px;height:150px}</style></head><body>' +
      innerHtml + "</body></html>");
    win.document.close(); win.focus(); setTimeout(function () { try { win.print(); } catch (e) {} }, 300);
  }
  function qrSvg(text) {
    if (!w.qrcode) return '<div class="muted">QR n/v</div>';
    try { var q = w.qrcode(0, "M"); q.addData(text); q.make(); return '<div class="qr">' + q.createSvgTag({ cellSize: 3, margin: 1 }) + "</div>"; } catch (e) { return ""; }
  }

  // ============================================================
  //  RENDER + SUB-NAV
  // ============================================================
  var TABS = [
    ["dashboard", "Dashboard"], ["artikel", "Bestand"], ["struktur", "Struktur"], ["journal", "Journal"],
    ["wareneingang", "Wareneingang"], ["reservierung", "Reservierung"], ["entnahme", "Entnahme"], ["rueckgabe", "Rückgabe"],
    ["umlagerung", "Umlagerung"], ["reststuecke", "Reststücke"], ["chargen", "Chargen"], ["inventur", "Inventur"],
    ["bestellungen", "Bestellungen"], ["etiketten", "QR/Etiketten"], ["berichte", "Berichte"]
  ];
  function render(root) {
    _root = root;
    if (!L()) { root.innerHTML = '<div class="empty">Lagerkern nicht geladen.</div>'; return; }
    var nav = '<div class="inline" style="flex-wrap:wrap;gap:6px;margin-bottom:14px">' + TABS.map(function (t) {
      return '<button class="btn sm ' + (TAB === t[0] ? "primary" : "ghost") + '" data-ltab="' + t[0] + '">' + esc(t[1]) + "</button>";
    }).join("") + "</div>";
    var body = "";
    try { body = ({
      dashboard: viewDashboard, artikel: viewArtikel, struktur: viewStruktur, journal: viewJournal,
      wareneingang: viewWareneingang, reservierung: viewReservierung, entnahme: viewEntnahme, rueckgabe: viewRueckgabe,
      umlagerung: viewUmlagerung, reststuecke: viewReststuecke, chargen: viewChargen, inventur: viewInventur,
      bestellungen: viewBestellungen, etiketten: viewEtiketten, berichte: viewBerichte
    }[TAB] || viewDashboard)(); } catch (e) { body = '<div class="empty">Ansicht konnte nicht geladen werden.</div>'; console.error(e); }
    root.innerHTML = nav + body;
    root.querySelectorAll("[data-ltab]").forEach(function (b) { b.onclick = function () { TAB = b.getAttribute("data-ltab"); render(root); }; });
    try { wire(root); } catch (e) { console.error(e); }
  }

  // ============================================================
  //  1) DASHBOARD
  // ============================================================
  function statCard(label, wert, cls) { return '<div class="stat"><div class="label">' + esc(label) + '</div><div class="value ' + (cls || "") + '">' + wert + "</div></div>"; }
  function viewDashboard() {
    var s = st(); var db = s._db; var dash = L().dashboard(s, mandantId(), Store().nowISO());
    var b = dash.bestand;
    var wert = "";
    if (darfWert()) { var gesamt = 0; s.artikel.forEach(function (a) { var bb = L().bestand(s, a.id, {}); gesamt += bb.physisch * L().bewertung(s, a.id).gleitend; }); wert = statCard("Lagerwert (Ø-EK)", fmtEUR(gesamt), "accent"); }
    var html = '<div class="card"><h3>Lagerbestand (aus echten Buchungen)</h3><div class="grid cols-4">' +
      statCard("Physischer Bestand", fmt(b.physisch)) + statCard("Verfügbar", fmt(b.verfuegbar), "green") +
      statCard("Reserviert", fmt(b.reserviert)) + statCard("Bestellt", fmt(b.bestellt)) +
      '</div><div class="grid cols-4" style="margin-top:12px">' +
      statCard("Gesperrt", fmt(b.gesperrt), b.gesperrt > 0 ? "warn" : "") + statCard("Qualitätsprüfung", fmt(b.qualitaet)) +
      statCard("Reststücke", fmt(b.reststueck)) + (wert || statCard("Artikel", fmt(dash.artikelAnzahl))) + "</div></div>";
    html += '<div class="card"><h3>Warnungen &amp; offene Vorgänge</h3><div class="grid cols-4">' +
      statCard("Unter Meldebestand", dash.unterMelde, dash.unterMelde ? "warn" : "") +
      statCard("Offene Bestellungen", dash.offeneBestellungen) +
      statCard("Verspätete Lieferungen", dash.verspaeteteLieferungen, dash.verspaeteteLieferungen ? "warn" : "") +
      statCard("Gesperrte Chargen", dash.gesperrteChargen, dash.gesperrteChargen ? "warn" : "") +
      '</div><div class="grid cols-4" style="margin-top:12px">' +
      statCard("Offene Lagerkonflikte", dash.offeneKonflikte, dash.offeneKonflikte ? "warn" : "") +
      statCard("Inventurdifferenzen", dash.inventurdifferenzen, dash.inventurdifferenzen ? "warn" : "") + "</div></div>";
    if (!darfWert()) html += '<div class="insight"><span class="ico">🔒</span><span>Preise und Lagerwerte sind für Ihre Rolle ausgeblendet.</span></div>';
    return html;
  }

  // ============================================================
  //  2) ARTIKEL / BESTANDSÜBERSICHT
  // ============================================================
  function viewArtikel() {
    var s = st();
    var werkstoffe = {}; s.artikel.forEach(function (a) { if (a.werkstoff) werkstoffe[a.werkstoff] = true; });
    var rows = L().artikelUebersicht(s, mandantId(), artikelFilter).map(function (r) {
      var a = r.artikel, b = r.bestand;
      return [
        '<a href="#" data-art="' + esc(a.id) + '"><strong>' + esc(a.artikelnummer) + "</strong></a>",
        esc(a.werkstoff) + (a.abmessung ? " · " + esc(a.abmessung) : ""), esc(a.basiseinheit),
        fmt(b.physisch), fmt(b.reserviert), '<strong class="' + (b.verfuegbar < num(a.meldebestand) ? "warn" : "") + '">' + fmt(b.verfuegbar) + "</strong>",
        fmt(b.bestellt), (b.gesperrt > 0 ? '<span class="tag warn">' + fmt(b.gesperrt) + "</span>" : "—"),
        fmt(a.meldebestand) + " / " + fmt(a.zielbestand),
        r.chargen.length + " Ch · " + r.reststuecke.length + " RST",
        r.letzteBewegung ? fmtDate(r.letzteBewegung.zeitpunkt) : "—"
      ];
    });
    var flt = '<div class="card"><div class="inline" style="flex-wrap:wrap;gap:8px;align-items:flex-end">' +
      '<label class="fld" style="margin:0;max-width:220px"><span class="lbl">Suche</span><input id="af-q" value="' + esc(artikelFilter.q) + '" placeholder="Artikelnr., Werkstoff, Maß"></label>' +
      '<label class="fld" style="margin:0;max-width:160px"><span class="lbl">Werkstoff</span><select id="af-ws"><option value="">alle</option>' + Object.keys(werkstoffe).map(function (x) { return '<option' + (artikelFilter.werkstoff === x ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select></label>" +
      '<label class="inline" style="gap:6px;font-size:13px"><input type="checkbox" id="af-melde"' + (artikelFilter.unterMelde ? " checked" : "") + "> unter Meldebestand</label>" +
      '<label class="inline" style="gap:6px;font-size:13px"><input type="checkbox" id="af-gesp"' + (artikelFilter.gesperrt ? " checked" : "") + "> gesperrt</label>" +
      '<label class="inline" style="gap:6px;font-size:13px"><input type="checkbox" id="af-rest"' + (artikelFilter.mitRest ? " checked" : "") + "> mit Reststücken</label>" +
      '<label class="inline" style="gap:6px;font-size:13px"><input type="checkbox" id="af-preis"' + (artikelFilter.ohnePreis ? " checked" : "") + "> ohne Preis</label>" +
      "</div></div>";
    return flt + '<div class="card"><h3>Artikel &amp; Bestand <span class="sub">' + rows.length + " Artikel</span></h3>" +
      tableWrap(["Artikel", "Werkstoff/Maß", "Einh.", "phys.", "res.", "verf.", "best.", "gesp.", "Melde/Ziel", "Ch/RST", "letzte Bew."], rows) + "</div>";
  }
  function artikelDetail(id) {
    var s = st(); var a = L().artikelById(s, id); if (!a) return;
    var b = L().bestand(s, id, {}); var bw = L().bewertung(s, id);
    var plaetze = {}; s.bewegungen.forEach(function (x) { if (x.artikelId === id) { var p = x.zielLagerplatzId || x.quelleLagerplatzId; if (p) plaetze[p] = true; } });
    var chargen = s.chargen.filter(function (c) { return s.bewegungen.some(function (x) { return x.artikelId === id && x.chargeId === c.id; }); });
    var rst = s.reststuecke.filter(function (r) { return r.artikelId === id; });
    var kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + "</span><strong>" + v + "</strong></div>"; };
    var body = '<div class="grid cols-2">' +
      kv("Artikelnummer", esc(a.artikelnummer)) + kv("Werkstoff", esc(a.werkstoff)) +
      kv("Abmessung", esc(a.abmessung || "—")) + kv("Einheit", esc(a.basiseinheit)) +
      kv("Physisch", fmt(b.physisch)) + kv("Verfügbar", fmt(b.verfuegbar)) +
      kv("Reserviert", fmt(b.reserviert)) + kv("Bestellt", fmt(b.bestellt)) +
      kv("Gesperrt", fmt(b.gesperrt)) + kv("Qualitätsprüfung", fmt(b.qualitaet)) +
      kv("Mindest/Melde/Ziel", fmt(a.mindestbestand) + " / " + fmt(a.meldebestand) + " / " + fmt(a.zielbestand)) +
      kv("Lagerplätze", Object.keys(plaetze).map(function (p) { return platzName(s, p); }).join(", ") || "—") +
      (darfWert() ? kv("Ø-EK / letzter EK", fmtEUR(bw.gleitend) + " / " + fmtEUR(bw.letzter)) : "") +
      kv("Chargen", chargen.map(function (c) { return esc(c.chargennummer); }).join(", ") || "—") +
      kv("Reststücke", rst.length) + "</div>";
    UI().openModal("Artikel " + a.artikelnummer, body, null, "Schließen");
  }

  // ============================================================
  //  3) STRUKTUR (Standort/Lager/Bereich/Regal/Lagerplatz)
  // ============================================================
  function viewStruktur() {
    var s = st();
    function liste(titel, arr, cols) {
      var rows = arr.map(cols); return '<div class="card"><h3>' + titel + ' <span class="sub">' + arr.length + "</span></h3>" + rows.join("") + "</div>";
    }
    var plaetzeVerwendet = {}; s.bewegungen.forEach(function (b) { [b.quelleLagerplatzId, b.zielLagerplatzId].forEach(function (p) { if (p) plaetzeVerwendet[p] = true; }); });
    var html = "";
    if (darf("korrigieren") || rolle() === "admin") html += '<div class="card"><div class="btn-row"><button class="btn sm primary" data-neu="standort">+ Standort</button><button class="btn sm" data-neu="lager">+ Lager</button><button class="btn sm" data-neu="bereich">+ Bereich</button><button class="btn sm" data-neu="regal">+ Regal</button><button class="btn sm" data-neu="platz">+ Lagerplatz</button></div></div>';
    html += liste("Standorte", s.standorte, function (x) { return '<div class="m-row2">' + esc(x.code) + " · " + esc(x.name) + '</div>'; });
    html += liste("Lager", s.lager, function (x) { return '<div class="m-row2">' + esc(x.code) + " · " + esc(x.name) + " <span class='muted'>(" + esc((s.standorte.filter(function (z) { return z.id === x.standortId; })[0] || {}).name || "—") + ")</span></div>"; });
    var pr = s.plaetze.map(function (p) {
      var verwendet = plaetzeVerwendet[p.id];
      var acts = "";
      if (darf("korrigieren") || rolle() === "admin") {
        acts += '<button class="btn xs" data-pedit="' + esc(p.id) + '">Bearbeiten</button> ';
        acts += '<button class="btn xs" data-psperr="' + esc(p.id) + '">' + (p.gesperrt ? "Entsperren" : "Sperren") + "</button> ";
      }
      acts += '<button class="btn xs ghost" data-petikett="' + esc(p.id) + '">Etikett</button>';
      return [
        "<strong>" + esc(p.code) + "</strong>", esc(p.bezeichnung || "—"),
        '<span class="tag ' + (p.gesperrt ? "warn" : "") + '">' + (p.gesperrt ? "gesperrt" : esc(p.status)) + "</span>",
        esc((p.erlaubteMaterialgruppen || []).join(", ") || "—"), verwendet ? "ja" : "nein", acts
      ];
    });
    html += '<div class="card"><h3>Lagerplätze <span class="sub">' + s.plaetze.length + "</span></h3>" +
      tableWrap(["Code", "Bezeichnung", "Status", "Materialgruppen", "belegt", "Aktion"], pr) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Belegte Lagerplätze werden nicht endgültig gelöscht, sondern deaktiviert/gesperrt.</div></div>';
    return html;
  }

  // ============================================================
  //  4) JOURNAL (unveränderbar)
  // ============================================================
  function viewJournal() {
    var s = st();
    var typen = {}; s.bewegungen.forEach(function (b) { typen[b.typ] = true; });
    var liste = s.bewegungen.slice().reverse().filter(function (b) {
      if (journalFilter.typ && b.typ !== journalFilter.typ) return false;
      if (journalFilter.q) { var hay = (b.typ + " " + artName(s, b.artikelId) + " " + (b.auftragId || "") + " " + (b.kommission || "") + " " + chargeName(s, b.chargeId) + " " + (b.grund || "")).toLowerCase(); if (hay.indexOf(journalFilter.q.toLowerCase()) < 0) return false; }
      return true;
    });
    var rows = liste.slice(0, 300).map(function (b) {
      var acts = "";
      if ((darf("korrigieren") || rolle() === "admin") && !b.storniert && b.typ !== L().BEWEGUNG.STORNO) acts += '<button class="btn xs" data-gegen="' + esc(b.id) + '">Gegenbuchung</button> ';
      acts += '<button class="btn xs ghost" data-bewdet="' + esc(b.id) + '">Detail</button>';
      return [
        esc(kurzNr(b.id)), '<span class="tag">' + esc(b.typ) + "</span>" + (b.storniert ? ' <span class="tag warn">storniert</span>' : ""),
        esc(artName(s, b.artikelId)), fmt(b.menge) + " " + esc(b.einheit || ""),
        esc(platzName(s, b.quelleLagerplatzId) === "—" ? "—" : platzName(s, b.quelleLagerplatzId)), esc(b.zielLagerplatzId ? platzName(s, b.zielLagerplatzId) : "—"),
        esc(b.auftragId || "—") + (b.kommission ? " · " + esc(b.kommission) : ""), esc(chargeName(s, b.chargeId)),
        esc(b.benutzer || "—"), fmtDT(b.zeitpunkt), acts
      ];
    });
    var flt = '<div class="card"><div class="inline" style="gap:8px;align-items:flex-end">' +
      '<label class="fld" style="margin:0;max-width:240px"><span class="lbl">Suche</span><input id="jf-q" value="' + esc(journalFilter.q) + '" placeholder="Artikel, Auftrag, Charge, Grund"></label>' +
      '<label class="fld" style="margin:0;max-width:200px"><span class="lbl">Art</span><select id="jf-typ"><option value="">alle</option>' + Object.keys(typen).map(function (x) { return '<option' + (journalFilter.typ === x ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select></label>" +
      '<div style="flex:1"></div>' + (darf("berichteExportieren") ? '<button class="btn sm" data-jexport="1" style="flex:0 0 auto">⬇️ CSV</button>' : "") + "</div></div>";
    return flt + '<div class="card"><h3>Bewegungsjournal <span class="sub">' + liste.length + " Einträge · unveränderbar</span></h3>" +
      tableWrap(["Nr.", "Art", "Artikel", "Menge", "Quelle", "Ziel", "Auftrag/Komm.", "Charge", "Benutzer", "Zeitpunkt", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Keine Löschung möglich – Korrektur nur per Storno/Gegenbuchung.</div></div>';
  }
  function bewegungDetail(id) {
    var s = st(); var b = s.bewegungen.filter(function (x) { return x.id === id; })[0]; if (!b) return;
    var kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + "</span><strong>" + esc(v) + "</strong></div>"; };
    var body = '<div class="grid cols-2">' + kv("Bewegungsnummer", b.id) + kv("Art", b.typ) + kv("Artikel", artName(s, b.artikelId)) +
      kv("Menge", fmt(b.menge) + " " + (b.einheit || "")) + kv("Quelle", platzName(s, b.quelleLagerplatzId)) + kv("Ziel", b.zielLagerplatzId ? platzName(s, b.zielLagerplatzId) : "—") +
      kv("Auftrag", b.auftragId || "—") + kv("Kommission", b.kommission || "—") + kv("Charge", chargeName(s, b.chargeId)) +
      kv("Benutzer", b.benutzer || "—") + kv("Zeitpunkt", fmtDT(b.zeitpunkt)) + kv("Grund", b.grund || "—") +
      kv("Idempotenzschlüssel", (b.idempotenzKey || "").slice(0, 40)) + kv("Storno von", b.stornoVon || "—") + "</div>";
    UI().openModal("Bewegung " + kurzNr(b.id), body, null, "Schließen");
  }

  // ============================================================
  //  5) WARENEINGANG (Assistent)
  // ============================================================
  function viewWareneingang() {
    var s = st();
    var rows = s.wareneingaenge.slice().reverse().slice(0, 30).map(function (we) {
      var lief = (s._db.lieferanten || []).filter(function (l) { return l.id === we.lieferantId; })[0];
      return [esc(we.lieferschein || "—"), esc(lief ? lief.name : "—"), fmtDate(we.datum), we.positionen.length + " Pos.", (we.hinweise && we.hinweise.length ? '<span class="tag warn">' + we.hinweise.length + " Hinweis(e)</span>" : "—")];
    });
    var head = "";
    if (darf("wareneingang")) head = '<div class="card"><div class="btn-row"><button class="btn primary" data-we-neu="1">📥 Neuer Wareneingang</button></div><div class="muted" style="font-size:12px;margin-top:6px">Teillieferungen werden fortgeschrieben; Mehrlieferung wird gewarnt.</div></div>';
    else head = '<div class="insight"><span class="ico">🔒</span><span>Keine Berechtigung zum Buchen von Wareneingängen.</span></div>';
    return head + '<div class="card"><h3>Letzte Wareneingänge</h3>' + tableWrap(["Lieferschein", "Lieferant", "Datum", "Positionen", "Hinweise"], rows) + "</div>";
  }
  function wareneingangAssistent() {
    var s = st(); var db = s._db;
    var offeneBest = s.bestellungen.filter(function (b) { return ["geliefert", "storniert", "Entwurf"].indexOf(b.status) < 0; });
    var boOpt = '<option value="">— ohne Bestellung —</option>' + offeneBest.map(function (b) { var l = (db.lieferanten || []).filter(function (x) { return x.id === b.lieferantId; })[0]; return '<option value="' + b.id + '">' + esc(b.nummer || b.id) + " · " + esc(l ? l.name : "") + "</option>"; }).join("");
    var liefOpt = (db.lieferanten || []).map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + "</option>"; }).join("");
    var artOpt = s.artikel.map(function (a) { return '<option value="' + a.id + '">' + esc(a.artikelnummer) + " · " + esc(a.werkstoff) + "</option>"; }).join("");
    var platzOpt = s.plaetze.filter(function (p) { return !p.gesperrt; }).map(function (p) { return '<option value="' + p.id + '">' + esc(p.code) + "</option>"; }).join("");
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Bestellung</span><select id="we-bo">' + boOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Lieferant</span><select id="we-lief">' + liefOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Lieferschein-Nr.</span><input id="we-ls" placeholder="LS-…"></label>' +
      '<label class="fld"><span class="lbl">Artikel</span><select id="we-art">' + artOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Gelieferte Menge</span><input id="we-menge" type="number" min="0" step="0.001" value="0"></label>' +
      '<label class="fld"><span class="lbl">davon beschädigt</span><input id="we-besch" type="number" min="0" step="0.001" value="0"></label>' +
      '<label class="fld"><span class="lbl">Charge-Nr.</span><input id="we-charge" placeholder="CH-…"></label>' +
      '<label class="fld"><span class="lbl">Schmelznummer</span><input id="we-schmelz"></label>' +
      '<label class="fld"><span class="lbl">Zertifikat</span><input id="we-zert" placeholder="z. B. Werkszeugnis 3.1"></label>' +
      '<label class="fld"><span class="lbl">Qualitätsstatus</span><select id="we-qs"><option value="frei">freigegeben</option><option value="qs">in Prüfung (QS)</option></select></label>' +
      '<label class="fld"><span class="lbl">Lagerplatz</span><select id="we-platz">' + platzOpt + "</select></label>" +
      (darfWert() ? '<label class="fld"><span class="lbl">Einkaufspreis (Snapshot)</span><input id="we-preis" type="number" min="0" step="0.01" value="0"></label>' : "") +
      "</div><div id='we-info' class='muted' style='font-size:12px'></div>";
    UI().openModal("Wareneingang buchen", body, function () {
      var artId = d.getElementById("we-art").value;
      var menge = num(d.getElementById("we-menge").value);
      if (menge <= 0) { toast("Liefermenge muss > 0 sein.", "err"); return false; }
      var boId = d.getElementById("we-bo").value;
      var bo = boId ? s.bestellungen.filter(function (x) { return x.id === boId; })[0] : null;
      var bp = bo ? (bo.positionen || []).filter(function (x) { return x.artikelId === artId; })[0] : null;
      if (bp) { var rest = num(bp.bestellt) - num(bp.geliefert); if (menge > rest && !w.confirm("Mehrlieferung: geliefert (" + (num(bp.geliefert) + menge) + ") übersteigt bestellt (" + bp.bestellt + "). Trotzdem buchen (Freigabe)?")) return false; }
      var pos = {
        artikelId: artId, gelieferteMenge: menge, beschaedigteMenge: num(d.getElementById("we-besch").value),
        lagerplatzId: d.getElementById("we-platz").value, chargennummer: d.getElementById("we-charge").value || null,
        schmelznummer: d.getElementById("we-schmelz").value || null, zertifikate: d.getElementById("we-zert").value ? [d.getElementById("we-zert").value] : [],
        qs: d.getElementById("we-qs").value === "qs", einkaufspreis: darfWert() && d.getElementById("we-preis") ? num(d.getElementById("we-preis").value) : 0
      };
      var we = L().wareneingang(s, { mandantId: mandantId(), bestellungId: boId || null, lieferantId: d.getElementById("we-lief").value, lieferschein: d.getElementById("we-ls").value, benutzer: benutzer(), positionen: [pos] }, Store().nowISO());
      save();
      var hinweis = we.hinweise && we.hinweise.length ? " – " + we.hinweise.join("; ") : "";
      toast("Wareneingang gebucht" + hinweis + ".");
      var etik = we.positionen[0]; if (etik && etik.chargeId) { setTimeout(function () { if (w.confirm("Etikett für die Charge erzeugen?")) etikettModal("charge", etik.chargeId); }, 100); }
      refresh(); return true;
    }, "Buchen");
    setTimeout(function () {
      var bo = d.getElementById("we-bo"), art = d.getElementById("we-art"), info = d.getElementById("we-info");
      function upd() {
        var boId = bo.value, artId = art.value; var b = boId ? s.bestellungen.filter(function (x) { return x.id === boId; })[0] : null;
        var bp = b ? (b.positionen || []).filter(function (x) { return x.artikelId === artId; })[0] : null;
        if (bp) info.textContent = "Bestellt: " + bp.bestellt + " · bisher geliefert: " + bp.geliefert + " · Restmenge: " + (num(bp.bestellt) - num(bp.geliefert));
        else info.textContent = "Freier Wareneingang ohne Bestellbezug.";
        if (b && !d.getElementById("we-lief").value) d.getElementById("we-lief").value = b.lieferantId || "";
      }
      if (bo) bo.onchange = upd; if (art) art.onchange = upd; upd();
    }, 60);
  }

  // ============================================================
  //  6) RESERVIERUNG
  // ============================================================
  function viewReservierung() {
    var s = st();
    var rows = s.reservierungen.slice().reverse().map(function (r) {
      return [esc(artName(s, r.artikelId)), esc(r.auftragId || "—") + (r.kommission ? " · " + esc(r.kommission) : ""), fmt(r.benoetigt), fmt(r.reserviert),
        (r.fehlmenge > 0 ? '<span class="tag warn">' + fmt(r.fehlmenge) + "</span>" : "0"), '<span class="tag">' + esc(r.status) + "</span>", r.benoetigtBis ? fmtDate(r.benoetigtBis) : "—",
        (r.fehlmenge > 0 && darf("bestellungErstellen") ? '<button class="btn xs" data-resbestell="' + esc(r.artikelId) + '">Bestellvorschlag</button> ' : "") +
        (r.status !== L().RES_STATUS.FREIGEGEBEN && r.status !== L().RES_STATUS.ENTNOMMEN ? '<button class="btn xs ghost" data-resauf="' + esc(r.id) + '">Auflösen</button>' : "")];
    });
    var head = darf("reservieren") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-res-neu="1">🔖 Neue Reservierung</button></div></div>' : "";
    return head + '<div class="card"><h3>Reservierungen</h3>' + tableWrap(["Artikel", "Auftrag/Komm.", "benötigt", "reserviert", "Fehlmenge", "Status", "bis", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Keine stille Überreservierung – es wird höchstens der verfügbare Bestand reserviert.</div></div>';
  }
  function reservierungModal() {
    var s = st(); var db = s._db;
    var artOpt = s.artikel.map(function (a) { var b = L().bestand(s, a.id, {}); return '<option value="' + a.id + '">' + esc(a.artikelnummer) + " · verfügbar " + fmt(b.verfuegbar) + "</option>"; }).join("");
    var aufOpt = '<option value="">—</option>' + (db.auftraege || []).map(function (a) { return '<option value="' + a.id + '">' + esc(a.nummer || a.titel || a.id) + (a.kommission ? " · " + esc(a.kommission) : "") + "</option>"; }).join("");
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Artikel</span><select id="rs-art">' + artOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Auftrag</span><select id="rs-auf">' + aufOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Menge</span><input id="rs-menge" type="number" min="0" step="0.001" value="0"></label>' +
      '<label class="fld"><span class="lbl">benötigt bis</span><input id="rs-bis" type="date"></label>' +
      '<label class="fld"><span class="lbl">Priorität (1 hoch)</span><input id="rs-prio" type="number" min="1" max="9" value="3"></label>' +
      "</div><div id='rs-info' class='muted' style='font-size:12px'></div>";
    UI().openModal("Reservierung anlegen", body, function () {
      var artId = d.getElementById("rs-art").value; var menge = num(d.getElementById("rs-menge").value);
      if (menge <= 0) { toast("Menge muss > 0 sein.", "err"); return false; }
      var auf = (db.auftraege || []).filter(function (a) { return a.id === d.getElementById("rs-auf").value; })[0];
      var r = L().reserviere(s, { mandantId: mandantId(), artikelId: artId, auftragId: auf ? auf.id : null, kommission: auf ? auf.kommission : null, menge: menge, benoetigtBis: d.getElementById("rs-bis").value || null, prioritaet: num(d.getElementById("rs-prio").value) }, Store().nowISO());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save();
      toast(r.teilweise ? "Teilreservierung: " + fmt(r.reservierung.reserviert) + " reserviert, Fehlmenge " + fmt(r.fehlmenge) + "." : "Reserviert.");
      refresh(); return true;
    }, "Reservieren");
    setTimeout(function () {
      var art = d.getElementById("rs-art"), info = d.getElementById("rs-info");
      function upd() { var b = L().bestand(s, art.value, {}); var rst = s.reststuecke.filter(function (r) { return r.artikelId === art.value && r.status === L().REST_STATUS.VERFUEGBAR; }); info.innerHTML = "Verfügbar: <strong>" + fmt(b.verfuegbar) + "</strong> · reserviert " + fmt(b.reserviert) + (rst.length ? " · " + rst.length + " passende(s) Reststück(e) (Eignung manuell prüfen)" : ""); }
      if (art) art.onchange = upd; upd();
    }, 60);
  }

  // ============================================================
  //  7) ENTNAHME
  // ============================================================
  function viewEntnahme() {
    var s = st();
    var ent = s.bewegungen.filter(function (b) { return b.typ === L().BEWEGUNG.ENTNAHME; }).slice().reverse().slice(0, 30).map(function (b) {
      return [esc(artName(s, b.artikelId)), fmt(b.menge) + " " + esc(b.einheit || ""), esc(b.auftragId || "—") + (b.kommission ? " · " + esc(b.kommission) : ""), esc(chargeName(s, b.chargeId)), esc(b.benutzer || "—"), fmtDT(b.zeitpunkt)];
    });
    var head = darf("entnehmen") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-ent-neu="1">📤 Material entnehmen</button></div></div>' : '<div class="insight"><span class="ico">🔒</span><span>Keine Entnahmeberechtigung.</span></div>';
    return head + '<div class="card"><h3>Letzte Entnahmen</h3>' + tableWrap(["Artikel", "Menge", "Auftrag/Komm.", "Charge", "Benutzer", "Zeitpunkt"], ent) + "</div>";
  }
  function entnahmeModal() {
    var s = st(); var db = s._db;
    var resOffen = s.reservierungen.filter(function (r) { return num(r.reserviert) - num(r.entnommen) > 0; });
    var resOpt = '<option value="">— ohne Reservierung —</option>' + resOffen.map(function (r) { return '<option value="' + r.id + '">' + esc(artName(s, r.artikelId)) + " · offen " + fmt(num(r.reserviert) - num(r.entnommen)) + (r.auftragId ? " · " + esc(r.auftragId) : "") + "</option>"; }).join("");
    var artOpt = s.artikel.map(function (a) { return '<option value="' + a.id + '">' + esc(a.artikelnummer) + "</option>"; }).join("");
    var aufOpt = '<option value="">—</option>' + (db.auftraege || []).map(function (a) { return '<option value="' + a.id + '">' + esc(a.nummer || a.titel || a.id) + "</option>"; }).join("");
    var chOpt = '<option value="">—</option>' + s.chargen.map(function (c) { return '<option value="' + c.id + '"' + (c.gesperrt ? " disabled" : "") + ">" + esc(c.chargennummer) + (c.gesperrt ? " (gesperrt)" : "") + "</option>"; }).join("");
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Reservierung</span><select id="en-res">' + resOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Artikel</span><select id="en-art">' + artOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Auftrag/Kommission</span><select id="en-auf">' + aufOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Arbeitsgang</span><input id="en-ag" placeholder="z. B. zuschnitt"></label>' +
      '<label class="fld"><span class="lbl">Charge</span><select id="en-charge">' + chOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Entnahmemenge</span><input id="en-menge" type="number" min="0" step="0.001" value="0"></label>' +
      "</div><div id='en-info' class='muted' style='font-size:12px'></div>";
    UI().openModal("Entnahme buchen", body, function () {
      var res = s.reservierungen.filter(function (r) { return r.id === d.getElementById("en-res").value; })[0];
      var artId = res ? res.artikelId : d.getElementById("en-art").value;
      var menge = num(d.getElementById("en-menge").value);
      if (menge <= 0) { toast("Menge muss > 0 sein.", "err"); return false; }
      var b = L().bestand(s, artId, {});
      var geplant = res ? num(res.reserviert) - num(res.entnommen) : b.verfuegbar;
      if (menge > geplant * 2 && menge > geplant + 5) { if (!w.confirm("Ungewöhnlich hohe Entnahme (" + fmt(menge) + " gegenüber geplant/verfügbar " + fmt(geplant) + "). Fortfahren?")) return false; }
      var auf = (db.auftraege || []).filter(function (a) { return a.id === d.getElementById("en-auf").value; })[0];
      var r = L().entnahme(s, { mandantId: mandantId(), artikelId: artId, menge: menge, reservierungId: res ? res.id : null, chargeId: (res && res.chargeId) || d.getElementById("en-charge").value || null, auftragId: (res && res.auftragId) || (auf && auf.id) || null, kommission: (res && res.kommission) || (auf && auf.kommission) || null, arbeitsgang: d.getElementById("en-ag").value || null, benutzer: benutzer() }, Store().nowISO());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save(); toast("Entnahme gebucht (Abweichung " + fmt(menge - geplant) + ").");
      refresh(); return true;
    }, "Entnehmen");
    setTimeout(function () {
      var res = d.getElementById("en-res"), art = d.getElementById("en-art"), info = d.getElementById("en-info");
      function upd() {
        var r = s.reservierungen.filter(function (x) { return x.id === res.value; })[0];
        if (r) { art.value = r.artikelId; art.disabled = true; var offen = num(r.reserviert) - num(r.entnommen); var b = L().bestand(s, r.artikelId, {}); info.innerHTML = "Reserviert offen: <strong>" + fmt(offen) + "</strong> · verfügbar " + fmt(b.verfuegbar); }
        else { art.disabled = false; var bb = L().bestand(s, art.value, {}); info.innerHTML = "Verfügbar: <strong>" + fmt(bb.verfuegbar) + "</strong> · gesperrt " + fmt(bb.gesperrt); }
      }
      if (res) res.onchange = upd; if (art) art.onchange = upd; upd();
    }, 60);
  }

  // ============================================================
  //  8) RÜCKGABE
  // ============================================================
  function viewRueckgabe() {
    var s = st();
    var ent = s.bewegungen.filter(function (b) { return b.typ === L().BEWEGUNG.ENTNAHME; });
    var rows = ent.slice().reverse().slice(0, 40).map(function (b) {
      var zurueck = s.bewegungen.filter(function (x) { return x.typ === L().BEWEGUNG.RUECKGABE && x.entnahmeRef === b.id; }).reduce(function (a, x) { return a + num(x.menge); }, 0);
      var offen = num(b.menge) - zurueck;
      return [esc(kurzNr(b.id)), esc(artName(s, b.artikelId)), fmt(b.menge), fmt(zurueck), fmt(offen), esc(b.auftragId || "—"), (offen > 0 && darf("zurueckgeben") ? '<button class="btn xs" data-rueck="' + esc(b.id) + '">Rückgabe</button>' : "—")];
    });
    return '<div class="card"><h3>Rückgabe aus Entnahme</h3>' + tableWrap(["Entnahme", "Artikel", "entnommen", "zurück", "offen", "Auftrag", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Tatsächlicher Verbrauch = Entnahmen − Rückgaben (wird sofort aktualisiert).</div></div>';
  }
  function rueckgabeModal(entId) {
    var s = st(); var b = s.bewegungen.filter(function (x) { return x.id === entId; })[0]; if (!b) return;
    var zurueck = s.bewegungen.filter(function (x) { return x.typ === L().BEWEGUNG.RUECKGABE && x.entnahmeRef === b.id; }).reduce(function (a, x) { return a + num(x.menge); }, 0);
    var offen = num(b.menge) - zurueck;
    var platzOpt = s.plaetze.map(function (p) { return '<option value="' + p.id + '"' + (p.id === b.quelleLagerplatzId ? " selected" : "") + ">" + esc(p.code) + "</option>"; }).join("");
    var body = '<div class="muted" style="font-size:12px">Artikel ' + esc(artName(s, b.artikelId)) + " · Charge " + esc(chargeName(s, b.chargeId)) + " · offen: <strong>" + fmt(offen) + "</strong></div>" +
      '<div class="grid cols-2" style="margin-top:8px">' +
      '<label class="fld"><span class="lbl">Menge</span><input id="rg-menge" type="number" min="0" step="0.001" value="' + offen + '"></label>' +
      '<label class="fld"><span class="lbl">Lagerplatz</span><select id="rg-platz">' + platzOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Zustand</span><select id="rg-zust"><option value="verwendbar">verwendbar (normales Material)</option><option value="reststueck">als Reststück einlagern</option><option value="unbrauchbar">nicht verwendbar</option></select></label>' +
      '<label class="fld"><span class="lbl">Notiz</span><input id="rg-notiz"></label></div>';
    UI().openModal("Rückgabe", body, function () {
      var menge = num(d.getElementById("rg-menge").value); if (menge <= 0) { toast("Menge muss > 0 sein.", "err"); return false; }
      var zust = d.getElementById("rg-zust").value;
      var r = L().rueckgabe(s, { entnahmeId: b.id, menge: menge, lagerplatzId: d.getElementById("rg-platz").value, benutzer: benutzer(), grund: "Rückgabe (" + zust + ") " + (d.getElementById("rg-notiz").value || "") }, Store().nowISO());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      if (zust === "reststueck") { L().reststueckAnlegen(s, { mandantId: mandantId(), artikelId: b.artikelId, werkstoff: (L().artikelById(s, b.artikelId) || {}).werkstoff, chargeId: b.chargeId, gewicht: menge, ursprungAuftragId: b.auftragId, kommission: b.kommission, lagerplatzId: d.getElementById("rg-platz").value }, Store().nowISO()); }
      save(); toast("Rückgabe gebucht. Verbrauch aktualisiert.");
      refresh(); return true;
    }, "Zurückgeben");
  }

  // ============================================================
  //  9) UMLAGERUNG
  // ============================================================
  function viewUmlagerung() {
    var s = st();
    var rows = s.bewegungen.filter(function (b) { return b.typ === L().BEWEGUNG.UMLAGERUNG; }).slice().reverse().slice(0, 20).map(function (b) {
      return [esc(artName(s, b.artikelId)), fmt(b.menge), esc(platzName(s, b.quelleLagerplatzId)), esc(platzName(s, b.zielLagerplatzId)), esc(b.benutzer || "—"), fmtDT(b.zeitpunkt)];
    });
    var head = darf("umlagern") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-uml-neu="1">🔀 Umlagern</button></div></div>' : "";
    return head + '<div class="card"><h3>Umlagerungen</h3>' + tableWrap(["Artikel", "Menge", "Quelle", "Ziel", "Benutzer", "Zeitpunkt"], rows) + "</div>";
  }
  function umlagerungModal() {
    var s = st();
    var artOpt = s.artikel.map(function (a) { return '<option value="' + a.id + '">' + esc(a.artikelnummer) + "</option>"; }).join("");
    var platzOpt = s.plaetze.map(function (p) { return '<option value="' + p.id + '">' + esc(p.code) + "</option>"; }).join("");
    var chOpt = '<option value="">—</option>' + s.chargen.map(function (c) { return '<option value="' + c.id + '">' + esc(c.chargennummer) + "</option>"; }).join("");
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Artikel</span><select id="um-art">' + artOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Charge</span><select id="um-charge">' + chOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Quelllagerplatz</span><select id="um-q">' + platzOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Ziellagerplatz</span><select id="um-z">' + platzOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Menge</span><input id="um-menge" type="number" min="0" step="0.001" value="0"></label>' +
      "</div><div id='um-info' class='muted' style='font-size:12px'></div>";
    UI().openModal("Umlagerung", body, function () {
      var artId = d.getElementById("um-art").value, q = d.getElementById("um-q").value, z = d.getElementById("um-z").value;
      if (q === z) { toast("Quelle und Ziel müssen verschieden sein.", "err"); return false; }
      var r = L().umlagerung(s, { mandantId: mandantId(), artikelId: artId, menge: num(d.getElementById("um-menge").value), quelleLagerplatzId: q, zielLagerplatzId: z, chargeId: d.getElementById("um-charge").value || null, benutzer: benutzer() }, Store().nowISO());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save(); toast("Umlagerung gebucht (Quelle und Ziel im Journal)."); refresh(); return true;
    }, "Umlagern");
    setTimeout(function () {
      var art = d.getElementById("um-art"), q = d.getElementById("um-q"), info = d.getElementById("um-info");
      function upd() { info.textContent = "Bestand am Quellplatz: " + fmt(L().bestandProPlatz(s.bewegungen, art.value, q.value, {})); }
      if (art) art.onchange = upd; if (q) q.onchange = upd; upd();
    }, 60);
  }

  // ============================================================
  //  10) RESTSTÜCKE (inkl. Langgut/Bleche)
  // ============================================================
  function viewReststuecke() {
    var s = st();
    var werkstoffe = {}; s.reststuecke.forEach(function (r) { if (r.werkstoff) werkstoffe[r.werkstoff] = true; });
    var liste = s.reststuecke.filter(function (r) {
      if (restFilter.werkstoff && r.werkstoff !== restFilter.werkstoff) return false;
      if (restFilter.status && r.status !== restFilter.status) return false;
      if (restFilter.q) { var hay = (r.reststuecknummer + " " + (r.werkstoff || "") + " " + (r.lagerplatzId || "")).toLowerCase(); if (hay.indexOf(restFilter.q.toLowerCase()) < 0) return false; }
      return true;
    });
    var rows = liste.slice().reverse().map(function (r) {
      var mass = r.laenge != null ? (fmt(r.laenge) + (r.breite != null ? " × " + fmt(r.breite) : "") + (r.staerke != null ? " × " + fmt(r.staerke) : "")) : (r.durchmesser != null ? "Ø" + fmt(r.durchmesser) : "—");
      var acts = "";
      if (darf("reservieren") && r.status === L().REST_STATUS.VERFUEGBAR) acts += '<button class="btn xs" data-rstres="' + esc(r.id) + '">reservieren</button> ';
      if (darf("entnehmen") && (r.status === L().REST_STATUS.VERFUEGBAR || r.status === L().REST_STATUS.RESERVIERT || r.status === L().REST_STATUS.TEILWEISE)) acts += '<button class="btn xs" data-rstuse="' + esc(r.id) + '">verwenden</button> ';
      if (darf("korrigieren")) acts += '<button class="btn xs ghost" data-rstscrap="' + esc(r.id) + '">verschrotten</button> ';
      acts += '<button class="btn xs ghost" data-rstetikett="' + esc(r.id) + '">Etikett</button>';
      return [esc(r.reststuecknummer), esc(r.werkstoff || "—"), mass, r.gewicht != null ? fmt(r.gewicht) + " kg" : "—", esc(platzName(s, r.lagerplatzId)), esc(chargeName(s, r.chargeId)), '<span class="tag ' + (r.status === L().REST_STATUS.GESPERRT || r.status === L().REST_STATUS.VERSCHROTTET ? "warn" : "") + '">' + esc(r.status) + "</span>", acts];
    });
    var head = darf("wareneingang") || darf("zurueckgeben") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-rst-neu="1">+ Reststück (Langgut/Blech)</button></div></div>' : "";
    var flt = '<div class="card"><div class="inline" style="gap:8px;align-items:flex-end">' +
      '<label class="fld" style="margin:0;max-width:200px"><span class="lbl">Suche</span><input id="rf-q" value="' + esc(restFilter.q) + '"></label>' +
      '<label class="fld" style="margin:0;max-width:150px"><span class="lbl">Werkstoff</span><select id="rf-ws"><option value="">alle</option>' + Object.keys(werkstoffe).map(function (x) { return '<option' + (restFilter.werkstoff === x ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld" style="margin:0;max-width:170px"><span class="lbl">Status</span><select id="rf-status"><option value="">alle</option>' + Object.keys(L().REST_STATUS).map(function (k) { var v = L().REST_STATUS[k]; return '<option value="' + v + '"' + (restFilter.status === v ? " selected" : "") + ">" + esc(v) + "</option>"; }).join("") + "</select></label>" +
      "</div></div>";
    return head + flt + '<div class="card"><h3>Reststücke <span class="sub">' + liste.length + "</span></h3>" +
      tableWrap(["Nr.", "Werkstoff", "Maß (L×B×S / Ø)", "Gewicht", "Lagerplatz", "Charge", "Status", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Technische Eignung wird nie automatisch bestätigt. Keine geometrische Nesting-Funktion.</div></div>';
  }
  function reststueckModal() {
    var s = st();
    var artOpt = '<option value="">—</option>' + s.artikel.map(function (a) { return '<option value="' + a.id + '">' + esc(a.artikelnummer) + " · " + esc(a.werkstoff) + "</option>"; }).join("");
    var platzOpt = s.plaetze.map(function (p) { return '<option value="' + p.id + '">' + esc(p.code) + "</option>"; }).join("");
    var chOpt = '<option value="">—</option>' + s.chargen.map(function (c) { return '<option value="' + c.id + '">' + esc(c.chargennummer) + "</option>"; }).join("");
    var body = '<div class="grid cols-2">' +
      '<label class="fld"><span class="lbl">Form</span><select id="rn-form"><option value="langgut">Langgut (L)</option><option value="blech">Blech (L×B×S)</option><option value="rund">Rund (Ø)</option></select></label>' +
      '<label class="fld"><span class="lbl">Artikel</span><select id="rn-art">' + artOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Werkstoff</span><input id="rn-ws"></label>' +
      '<label class="fld"><span class="lbl">Charge</span><select id="rn-ch">' + chOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Länge (m)</span><input id="rn-l" type="number" min="0" step="0.001"></label>' +
      '<label class="fld"><span class="lbl">Breite (mm)</span><input id="rn-b" type="number" min="0" step="0.1"></label>' +
      '<label class="fld"><span class="lbl">Stärke (mm)</span><input id="rn-s" type="number" min="0" step="0.1"></label>' +
      '<label class="fld"><span class="lbl">Durchmesser (mm)</span><input id="rn-dm" type="number" min="0" step="0.1"></label>' +
      '<label class="fld"><span class="lbl">Gewicht (kg)</span><input id="rn-g" type="number" min="0" step="0.001"></label>' +
      '<label class="fld"><span class="lbl">Lagerplatz</span><select id="rn-platz">' + platzOpt + "</select></label>" +
      "</div>";
    UI().openModal("Reststück anlegen", body, function () {
      var form = d.getElementById("rn-form").value;
      var rs = L().reststueckAnlegen(s, {
        mandantId: mandantId(), artikelId: d.getElementById("rn-art").value || null, werkstoff: d.getElementById("rn-ws").value || null,
        chargeId: d.getElementById("rn-ch").value || null, laenge: form !== "rund" && d.getElementById("rn-l").value ? num(d.getElementById("rn-l").value) : (form === "langgut" ? num(d.getElementById("rn-l").value) : null),
        breite: form === "blech" ? num(d.getElementById("rn-b").value) : null, staerke: form === "blech" ? num(d.getElementById("rn-s").value) : null,
        durchmesser: form === "rund" ? num(d.getElementById("rn-dm").value) : null, gewicht: d.getElementById("rn-g").value ? num(d.getElementById("rn-g").value) : null,
        lagerplatzId: d.getElementById("rn-platz").value
      }, Store().nowISO());
      save(); toast("Reststück " + rs.reststuecknummer + " angelegt."); refresh(); return true;
    }, "Anlegen");
  }
  function reststueckVerwenden(id) {
    var s = st(); var r = s.reststuecke.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var langgut = r.laenge != null;
    var body = '<div class="muted" style="font-size:12px">' + esc(r.reststuecknummer) + " · " + esc(r.werkstoff || "") + (langgut ? " · Restlänge aktuell <strong>" + fmt(r.laenge) + " m</strong>" : "") + "</div>" +
      '<div class="grid cols-2" style="margin-top:8px">' +
      (langgut ? '<label class="fld"><span class="lbl">verwendete Länge (m)</span><input id="rv-l" type="number" min="0" step="0.001" value="0"></label><label class="fld"><span class="lbl">Schnittverlust (m)</span><input id="rv-s" type="number" min="0" step="0.001" value="0"></label>' : "") +
      '<label class="fld"><span class="lbl">Auftrag/Kommission</span><input id="rv-auf" placeholder="Auftrag"></label>' +
      '<label class="fld"><span class="lbl">Aktion</span><select id="rv-act"><option value="teil">verwenden (Rest einlagern)</option><option value="voll">vollständig verbraucht</option></select></label></div>' +
      (langgut ? '<div id="rv-info" class="muted" style="font-size:12px"></div>' : "");
    UI().openModal("Reststück verwenden", body, function () {
      var opt = { auftragId: d.getElementById("rv-auf").value || null };
      if (langgut) { opt.verwendeteLaenge = num(d.getElementById("rv-l").value); opt.schnittverlust = num(d.getElementById("rv-s").value); if (d.getElementById("rv-act").value === "voll") opt.verwendeteLaenge = r.laenge; }
      else if (d.getElementById("rv-act").value === "voll") { r.status = L().REST_STATUS.VERBRAUCHT; }
      var res = langgut ? L().reststueckVerbrauch(s, id, opt, Store().nowISO()) : { ok: true };
      if (langgut && !res.ok) { toast("Nicht möglich: " + res.grund, "err"); return false; }
      save(); toast(langgut ? "Restlänge jetzt " + fmt(res.restlaenge) + " m (Status " + r.status + ")." : "Reststück verbraucht."); refresh(); return true;
    }, "Buchen");
    if (langgut) setTimeout(function () { var l = d.getElementById("rv-l"), sV = d.getElementById("rv-s"), info = d.getElementById("rv-info"); function upd() { info.innerHTML = "Restlänge = " + fmt(r.laenge) + " − " + fmt(num(l.value)) + " − " + fmt(num(sV.value)) + " = <strong>" + fmt(r.laenge - num(l.value) - num(sV.value)) + " m</strong>"; } if (l) l.oninput = upd; if (sV) sV.oninput = upd; upd(); }, 60);
  }

  // ============================================================
  //  11) CHARGEN (Rückverfolgung vor/rück + Sperre)
  // ============================================================
  function viewChargen() {
    var s = st();
    var rows = s.chargen.map(function (c) {
      var acts = '<button class="btn xs" data-trace="' + esc(c.id) + '">Rückverfolgung</button> ';
      if (c.gesperrt) { if (darf("chargeEntsperren")) acts += '<button class="btn xs" data-chentsperr="' + esc(c.id) + '">Entsperren</button>'; }
      else if (darf("chargeSperren")) acts += '<button class="btn xs" data-chsperr="' + esc(c.id) + '">Sperren</button>';
      var lief = (s._db.lieferanten || []).filter(function (l) { return l.id === c.lieferantId; })[0];
      return [esc(c.chargennummer), esc(c.schmelznummer || "—"), esc(c.werkstoff || "—"), esc(lief ? lief.name : "—"), fmt(c.menge), '<span class="tag ' + (c.gesperrt ? "warn" : "") + '">' + esc(c.pruefstatus) + "</span>", esc((c.zertifikate || []).join(", ") || "—"), acts];
    });
    return '<div class="card"><h3>Chargen</h3>' + tableWrap(["Charge", "Schmelze", "Werkstoff", "Lieferant", "Menge", "Prüfstatus", "Zertifikate", "Aktion"], rows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Gesperrte Chargen können nicht neu entnommen/reserviert werden. Entsperren nur mit Berechtigung, Grund und Protokoll.</div></div>';
  }
  function traceModal(chargeId) {
    var s = st();
    var vor = L().rueckverfolgung(s, chargeId);
    var tabBtns = '<div class="inline" style="gap:6px;margin-bottom:10px"><button class="btn xs ' + (traceRichtung === "vor" ? "primary" : "ghost") + '" id="tr-vor">Vorwärts</button><button class="btn xs ' + (traceRichtung === "rueck" ? "primary" : "ghost") + '" id="tr-rueck">Rückwärts (je Auftrag)</button></div>';
    var body;
    if (traceRichtung === "vor") {
      var lief = (s._db.lieferanten || []).filter(function (l) { return l.id === vor.lieferantId; })[0];
      var verw = vor.verwendungen.map(function (v) { return "<tr><td>" + esc(v.typ) + "</td><td>" + fmt(v.menge) + "</td><td>" + esc(v.auftragId || "—") + "</td><td>" + esc(v.kommission || "—") + "</td><td>" + esc(platzName(s, v.lagerplatzId)) + "</td></tr>"; }).join("");
      body = tabBtns + '<div class="muted" style="font-size:13px">Lieferant <strong>' + esc(lief ? lief.name : "—") + "</strong> → Wareneingang <strong>" + esc(vor.lieferschein || "—") + "</strong> → Charge <strong>" + esc(vor.charge.chargennummer) + "</strong> (Schmelze " + esc(vor.charge.schmelznummer || "—") + ") → Lagerplätze " + esc(vor.lagerplaetze.map(function (p) { return platzName(s, p); }).join(", ") || "—") + "</div>" +
        '<h4 style="margin:12px 0 6px">Verwendungen → Auftrag/Kommission</h4><div class="table-wrap"><table class="table"><thead><tr><th>Art</th><th>Menge</th><th>Auftrag</th><th>Kommission</th><th>Lagerplatz</th></tr></thead><tbody>' + (verw || '<tr><td colspan="5">keine</td></tr>') + "</tbody></table></div>";
    } else {
      var auftraege = {}; s.bewegungen.forEach(function (b) { if (b.chargeId === chargeId && b.auftragId) auftraege[b.auftragId] = true; });
      var blocks = Object.keys(auftraege).map(function (aid) {
        var chain = L().rueckverfolgungRueckwaerts(s, aid).filter(function (x) { return true; });
        var rows = chain.map(function (x) { return "<tr><td>" + esc(x.artikelId ? artName(s, x.artikelId) : "—") + "</td><td>" + fmt(x.menge) + "</td><td>" + esc(x.chargennummer || "—") + "</td><td>" + esc(x.lieferschein || "—") + "</td><td>" + esc(x.kommission || "—") + "</td></tr>"; }).join("");
        return "<h4 style='margin:10px 0 4px'>Auftrag " + esc(aid) + "</h4><div class='table-wrap'><table class='table'><thead><tr><th>Artikel</th><th>Menge</th><th>Charge</th><th>WE</th><th>Kommission</th></tr></thead><tbody>" + (rows || "<tr><td colspan='5'>—</td></tr>") + "</tbody></table></div>";
      }).join("");
      body = tabBtns + (blocks || '<div class="muted">Keine Aufträge mit dieser Charge.</div>');
    }
    UI().openModal("Chargenrückverfolgung " + esc(vor.charge.chargennummer), body, null, "Schließen");
    setTimeout(function () { var v = d.getElementById("tr-vor"), r = d.getElementById("tr-rueck"); if (v) v.onclick = function () { traceRichtung = "vor"; traceModal(chargeId); }; if (r) r.onclick = function () { traceRichtung = "rueck"; traceModal(chargeId); }; }, 40);
  }
  function chargeSperrenModal(chargeId) {
    var s = st(); var imp = L().chargeSperrImpact(s, chargeId); if (!imp) return;
    var body = '<div class="insight"><span class="ico">⚠️</span><span>Vor dem Sperren – betroffener Bestand und Vorgänge:</span></div>' +
      '<div class="grid cols-2"><div class="kv"><span>Bestand</span><strong>' + fmt(imp.bestand) + "</strong></div><div class='kv'><span>Lagerplätze</span><strong>" + esc(imp.lagerplaetze.map(function (p) { return platzName(s, p); }).join(", ") || "—") + "</strong></div>" +
      "<div class='kv'><span>Reservierungen</span><strong>" + imp.reservierungen + "</strong></div><div class='kv'><span>Entnahmen</span><strong>" + imp.entnahmen + "</strong></div>" +
      "<div class='kv'><span>Betroffene Aufträge</span><strong>" + esc(imp.auftraege.join(", ") || "—") + "</strong></div><div class='kv'><span>Kommissionen</span><strong>" + esc(imp.kommissionen.join(", ") || "—") + "</strong></div>" +
      "<div class='kv'><span>Zertifikate</span><strong>" + esc(imp.zertifikate.join(", ") || "—") + "</strong></div></div>" +
      '<label class="fld" style="margin-top:10px"><span class="lbl">Grund der Sperrung</span><input id="cs-grund" placeholder="z. B. Zertifikat unklar"></label>';
    UI().openModal("Charge sperren " + esc(imp.chargennummer), body, function () {
      var grund = d.getElementById("cs-grund").value; if (!grund) { toast("Grund erforderlich.", "err"); return false; }
      L().chargeSperren(s, chargeId, grund, Store().nowISO()); save(); toast("Charge gesperrt – kein neuer Zugriff möglich."); refresh(); return true;
    }, "Sperren");
  }
  function chargeEntsperrenModal(chargeId) {
    var s = st();
    var body = '<div class="muted" style="font-size:12px">Entsperren wird protokolliert (Audit).</div><label class="fld" style="margin-top:8px"><span class="lbl">Grund der Entsperrung</span><input id="ce-grund"></label>';
    UI().openModal("Charge entsperren", body, function () {
      var grund = d.getElementById("ce-grund").value; if (!grund) { toast("Grund erforderlich.", "err"); return false; }
      var r = L().chargeEntsperrenAudit(s, chargeId, { grund: grund, benutzer: benutzer() }, Store().nowISO());
      if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
      save(); toast("Charge entsperrt (protokolliert)."); refresh(); return true;
    }, "Entsperren");
  }

  // ============================================================
  //  12) INVENTUR
  // ============================================================
  function viewInventur() {
    var s = st();
    var rows = (s.inventuren || []).slice().reverse().map(function (inv) {
      var offen = inv.positionen.filter(function (p) { return p.gezaehlt == null; }).length;
      var diff = inv.positionen.filter(function (p) { return p.differenz; }).length;
      var acts = '<button class="btn xs" data-invopen="' + esc(inv.id) + '">Öffnen</button>';
      return [esc(inv.nummer), esc(inv.typ), '<span class="tag">' + esc(inv.status) + "</span>", inv.positionen.length, offen, diff, esc(inv.pruefer || "—"), acts];
    });
    var head = darf("inventurZaehlen") ? '<div class="card"><div class="btn-row"><button class="btn primary" data-inv-neu="1">🧮 Neue Inventur</button></div><div class="muted" style="font-size:12px;margin-top:6px">Voll-, Lagerplatz-, Artikel- oder Stichprobeninventur. Zweite Zählung bei hoher Abweichung.</div></div>' : "";
    return head + '<div class="card"><h3>Inventuren</h3>' + tableWrap(["Nr.", "Typ", "Status", "Positionen", "offen", "Differenzen", "Prüfer", "Aktion"], rows) + "</div>";
  }
  function inventurNeuModal() {
    var s = st();
    var artOpt = s.artikel.map(function (a) { return '<option value="' + a.id + '">' + esc(a.artikelnummer) + "</option>"; }).join("");
    var body = '<label class="fld"><span class="lbl">Typ</span><select id="in-typ"><option value="voll">Vollinventur</option><option value="artikel">Artikelinventur</option><option value="lagerplatz">Lagerplatzinventur</option><option value="stichprobe">Stichprobeninventur</option></select></label>' +
      '<label class="fld"><span class="lbl">Artikel (nur Artikelinventur, Mehrfachauswahl)</span><select id="in-art" multiple size="4" style="height:auto">' + artOpt + "</select></label>" +
      '<label class="fld"><span class="lbl">Abweichungsschwelle für 2. Zählung (%)</span><input id="in-schwelle" type="number" min="0" value="10"></label>';
    UI().openModal("Inventur anlegen", body, function () {
      var typ = d.getElementById("in-typ").value;
      var artIds = Array.prototype.slice.call(d.getElementById("in-art").selectedOptions || []).map(function (o) { return o.value; });
      var inv = L().inventurNeu(s, { mandantId: mandantId(), typ: typ, artikelIds: artIds.length ? artIds : null, schwelleProz: num(d.getElementById("in-schwelle").value) }, Store().nowISO());
      save(); toast("Inventur " + inv.nummer + " angelegt (" + inv.positionen.length + " Positionen)."); refresh();
      setTimeout(function () { inventurOeffnen(inv.id); }, 150); return true;
    }, "Anlegen");
  }
  function inventurOeffnen(invId) {
    var s = st(); var inv = (s.inventuren || []).filter(function (x) { return x.id === invId; })[0]; if (!inv) return;
    var kannFreigeben = darf("inventurFreigeben");
    var rows = inv.positionen.map(function (p) {
      var eingabe = '<input class="inv-cnt" data-pos="' + esc(p.id) + '" type="number" step="0.001" style="width:90px" value="' + (p.gezaehlt != null ? p.gezaehlt : "") + '"' + (inv.status === L().INVENTUR_STATUS.ABGESCHLOSSEN ? " disabled" : "") + ">";
      var zweit = p.zweitZaehlungNoetig ? '<input class="inv-cnt2" data-pos="' + esc(p.id) + '" type="number" step="0.001" style="width:90px" placeholder="2. Zählung" value="' + (p.zweitZaehlung != null ? p.zweitZaehlung : "") + '">' : "—";
      return [esc(artName(s, p.artikelId)), esc(platzName(s, p.lagerplatzId)), fmt(p.systemBestand), eingabe, (p.differenz != null ? '<strong class="' + (p.differenz ? "warn" : "") + '">' + fmt(p.differenz) + "</strong>" : "—"), zweit, esc(p.grund || "")];
    });
    var foot = "";
    if (inv.status !== L().INVENTUR_STATUS.ABGESCHLOSSEN) {
      foot += '<button class="btn" id="inv-save">Zählung speichern</button> ';
      if (inv.status === L().INVENTUR_STATUS.FREIGEGEBEN) { foot += '<button class="btn primary" id="inv-buchen">Korrekturen buchen</button>'; }
      else if (kannFreigeben) foot += '<button class="btn primary" id="inv-freigabe">Freigeben</button>';
      else foot += '<span class="muted" style="font-size:12px">Freigabe nur durch Berechtigte.</span>';
    }
    var body = '<div class="muted" style="font-size:12px">' + esc(inv.nummer) + " · " + esc(inv.typ) + " · Status " + esc(inv.status) + " · Schwelle " + inv.schwelleProz + "%</div>" +
      tableWrap(["Artikel", "Lagerplatz", "System", "gezählt", "Differenz", "2. Zählung", "Grund"], rows) +
      '<div class="btn-row" style="margin-top:10px">' + foot + "</div>";
    UI().openModalWide("Inventur " + esc(inv.nummer), body, null, "", null);
    setTimeout(function () {
      var save1 = d.getElementById("inv-save");
      if (save1) save1.onclick = function () {
        d.querySelectorAll(".inv-cnt").forEach(function (i) { if (i.value !== "") L().inventurZaehlung(s, inv.id, { positionId: i.getAttribute("data-pos"), gezaehlt: num(i.value), benutzer: benutzer() }, Store().nowISO()); });
        d.querySelectorAll(".inv-cnt2").forEach(function (i) { if (i.value !== "") L().inventurZaehlung(s, inv.id, { positionId: i.getAttribute("data-pos"), gezaehlt: num(i.value), zweit: true, benutzer: benutzer() }, Store().nowISO()); });
        save(); toast("Zählung gespeichert."); inventurOeffnen(inv.id); refresh();
      };
      var fr = d.getElementById("inv-freigabe");
      if (fr) fr.onclick = function () { var r = L().inventurFreigabe(s, inv.id, benutzer(), Store().nowISO()); if (!r.ok) { toast(r.grund, "err"); return; } save(); toast("Inventur freigegeben."); inventurOeffnen(inv.id); refresh(); };
      var bu = d.getElementById("inv-buchen");
      if (bu) bu.onclick = function () { var r = L().inventurBuchen(s, inv.id, benutzer(), Store().nowISO()); if (!r.ok) { toast(r.grund, "err"); return; } save(); toast(r.gebucht + " Korrekturbuchung(en) erstellt."); UI().closeModal(); refresh(); };
    }, 60);
  }

  // ============================================================
  //  13) BESTELLUNGEN + MINDESTBESTAND
  // ============================================================
  function viewBestellungen() {
    var s = st();
    var vorschlaege = L().bestellvorschlaege(s, mandantId());
    var vRows = vorschlaege.map(function (v) {
      var lief = (s._db.lieferanten || []).filter(function (l) { return l.id === v.lieferantId; })[0];
      return [esc(v.artikelnummer), fmt(v.verfuegbar), fmt(v.bestellt), fmt(v.fehlbedarf), '<strong>' + fmt(v.menge) + "</strong>", "VPE " + fmt(v.verpackungseinheit) + " · min " + fmt(v.mindestbestellmenge), esc(lief ? lief.name : "—"),
        (darf("bestellungErstellen") ? '<button class="btn xs" data-vorschlag="' + esc(v.artikelId) + '">Bestellung erstellen</button>' : "—")];
    });
    var boRows = s.bestellungen.slice().reverse().map(function (bo) {
      var lief = (s._db.lieferanten || []).filter(function (l) { return l.id === bo.lieferantId; })[0];
      var next = "";
      var flow = { "Entwurf": "zur Freigabe", "zur Freigabe": "freigegeben", "freigegeben": "bestellt", "bestellt": "bestätigt", "bestätigt": "teilweise geliefert" };
      if (bo.status === "zur Freigabe" && darf("bestellungFreigeben")) next = '<button class="btn xs primary" data-bostatus="' + esc(bo.id) + '|freigegeben">Freigeben</button>';
      else if (flow[bo.status] && darf("bestellungErstellen") && bo.status !== "zur Freigabe") next = '<button class="btn xs" data-bostatus="' + esc(bo.id) + "|" + flow[bo.status] + '">→ ' + flow[bo.status] + "</button>";
      if (["Entwurf", "zur Freigabe", "freigegeben"].indexOf(bo.status) >= 0 && darf("bestellungErstellen")) next += ' <button class="btn xs ghost" data-bostatus="' + esc(bo.id) + '|storniert">Stornieren</button>';
      return [esc(bo.nummer || bo.id.slice(-6)), esc(lief ? lief.name : "—"), (bo.positionen || []).map(function (p) { return artName(s, p.artikelId) + " (" + fmt(p.bestellt) + ")"; }).join(", "), '<span class="tag">' + esc(bo.status) + "</span>", esc(bo.liefertermin ? fmtDate(bo.liefertermin) : "—"), next || "—"];
    });
    var html = '<div class="card"><h3>Bestellvorschläge <span class="sub">Ziel + Fehlbedarf − verfügbar − bestellt</span></h3>' +
      tableWrap(["Artikel", "verfügbar", "bestellt", "Fehlbedarf", "Vorschlag", "VPE/Min", "Lieferant", "Aktion"], vRows) + "</div>";
    html += '<div class="card"><h3>Bestellungen</h3>' + tableWrap(["Nr.", "Lieferant", "Positionen", "Status", "Liefertermin", "Aktion"], boRows) +
      '<div class="muted" style="font-size:12px;margin-top:8px">Keine Bestellung wird automatisch versendet (kein Live-ERP). Status ist ein interner Workflow.</div></div>';
    return html;
  }

  // ============================================================
  //  14) QR / ETIKETTEN
  // ============================================================
  function viewEtiketten() {
    var s = st();
    var typOpt = [["lagerplatz", "Lagerplatz"], ["artikel", "Artikel"], ["charge", "Charge"], ["reststueck", "Reststück"], ["bestellung", "Bestellung"]].map(function (t) { return '<option value="' + t[0] + '">' + t[1] + "</option>"; }).join("");
    return '<div class="card"><h3>QR-Codes &amp; Etiketten</h3><div class="muted" style="font-size:12px">QR enthält nur einen sicheren Referenzcode (keine Preise). Etikett je nach Typ.</div>' +
      '<div class="inline" style="gap:8px;align-items:flex-end;margin-top:10px"><label class="fld" style="margin:0;max-width:180px"><span class="lbl">Typ</span><select id="et-typ">' + typOpt + "</select></label>" +
      '<label class="fld" style="margin:0;max-width:280px"><span class="lbl">Objekt</span><select id="et-id"></select></label>' +
      '<button class="btn" id="et-show">Etikett anzeigen</button><button class="btn ghost" id="et-print-all">Alle Lagerplätze drucken</button></div>' +
      '<div id="et-preview" style="margin-top:14px"></div></div>';
  }
  function etikettOptions(typ) {
    var s = st();
    if (typ === "lagerplatz") return s.plaetze.map(function (p) { return [p.id, p.code + " · " + (p.bezeichnung || "")]; });
    if (typ === "artikel") return s.artikel.map(function (a) { return [a.id, a.artikelnummer]; });
    if (typ === "charge") return s.chargen.map(function (c) { return [c.id, c.chargennummer]; });
    if (typ === "reststueck") return s.reststuecke.map(function (r) { return [r.id, r.reststuecknummer]; });
    if (typ === "bestellung") return s.bestellungen.map(function (b) { return [b.id, b.nummer || b.id]; });
    return [];
  }
  function etikettHtml(typ, id) {
    var s = st(); var e = L().etikettDaten(s, typ, id); if (!e) return "";
    return '<div class="lbl">' + qrSvg(e.code) + '<div style="font-weight:700;margin-top:6px">' + esc(e.titel) + "</div>" +
      e.zeilen.map(function (z) { return '<div style="font-size:12px"><span class="muted">' + esc(z[0]) + ":</span> " + esc(z[1] == null ? "—" : z[1]) + "</div>"; }).join("") +
      '<div style="font-size:10px;color:#666;margin-top:4px">' + esc(e.code) + "</div></div>";
  }
  function etikettModal(typ, id) {
    var body = etikettHtml(typ, id) + '<div class="btn-row" style="margin-top:10px"><button class="btn" id="et-print">Drucken</button></div>';
    UI().openModal("Etikett", body, null, "Schließen");
    setTimeout(function () { var p = d.getElementById("et-print"); if (p) p.onclick = function () { printWindow("Etikett", etikettHtml(typ, id)); }; }, 40);
  }

  // ============================================================
  //  15) BERICHTE / EXPORTE
  // ============================================================
  function viewBerichte() {
    var s = st();
    if (!darf("berichteExportieren")) return '<div class="insight"><span class="ico">🔒</span><span>Keine Berechtigung für Berichte/Exporte.</span></div>';
    var berichte = [
      ["bestand", "Bestandsbericht"], ["bewegungen", "Bewegungsbericht"], ["fehlmengen", "Fehlmengenbericht"], ["inventur", "Inventurbericht (aktuellste)"]
    ];
    return '<div class="card"><h3>Berichte &amp; Exporte</h3><div class="muted" style="font-size:12px">CSV oder druckbare Ansicht. Werte nur mit Preisrecht. Keine Live-ERP-Verbindung.</div>' +
      '<div class="table-wrap" style="margin-top:10px"><table class="table"><tbody>' + berichte.map(function (b) {
        return "<tr><td><strong>" + esc(b[1]) + '</strong></td><td style="text-align:right"><button class="btn xs" data-report="' + b[0] + '|csv">CSV</button> <button class="btn xs ghost" data-report="' + b[0] + '|print">Drucken</button></td></tr>';
      }).join("") + "</tbody></table></div></div>";
  }
  function reportRun(key, format) {
    var s = st(); var rep = null, name = key;
    if (key === "bestand") rep = L().berichtBestand(s, mandantId(), darfWert());
    else if (key === "bewegungen") rep = L().berichtBewegungen(s, mandantId());
    else if (key === "fehlmengen") rep = L().berichtFehlmengen(s, mandantId());
    else if (key === "inventur") { var inv = (s.inventuren || [])[s.inventuren.length - 1]; if (!inv) { toast("Keine Inventur vorhanden.", "err"); return; } rep = L().berichtInventur(s, inv.id, darfWert()); }
    if (!rep) return;
    if (format === "csv") csvDownload("lager-" + name + ".csv", rep.csv);
    else printWindow("Lagerbericht: " + name, "<h1>Lagerbericht: " + esc(name) + "</h1>" + tableWrap(rep.headers.map(esc), rep.rows.map(function (r) { return r.map(function (c) { return esc(c); }); })));
  }

  // ============================================================
  //  STRUKTUR-DIALOGE (erstellen/bearbeiten/sperren)
  // ============================================================
  function strukturNeu(art) {
    var s = st(); var db = s._db;
    var felder, titel;
    if (art === "standort") { titel = "Standort"; felder = '<label class="fld"><span class="lbl">Code</span><input id="sk-code"></label><label class="fld"><span class="lbl">Name</span><input id="sk-name"></label><label class="fld"><span class="lbl">Adresse</span><input id="sk-adr"></label>'; }
    else if (art === "lager") { titel = "Lager"; felder = '<label class="fld"><span class="lbl">Standort</span><select id="sk-parent">' + s.standorte.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + "</option>"; }).join("") + '</select></label><label class="fld"><span class="lbl">Code</span><input id="sk-code"></label><label class="fld"><span class="lbl">Name</span><input id="sk-name"></label>'; }
    else if (art === "bereich") { titel = "Bereich"; felder = '<label class="fld"><span class="lbl">Lager</span><select id="sk-parent">' + s.lager.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + "</option>"; }).join("") + '</select></label><label class="fld"><span class="lbl">Code</span><input id="sk-code"></label><label class="fld"><span class="lbl">Name</span><input id="sk-name"></label>'; }
    else if (art === "regal") { titel = "Regal"; felder = '<label class="fld"><span class="lbl">Bereich</span><select id="sk-parent">' + s.bereiche.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + "</option>"; }).join("") + '</select></label><label class="fld"><span class="lbl">Code</span><input id="sk-code"></label><label class="fld"><span class="lbl">Name</span><input id="sk-name"></label>'; }
    else { titel = "Lagerplatz"; felder = '<label class="fld"><span class="lbl">Regal</span><select id="sk-parent">' + s.regale.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + "</option>"; }).join("") + '</select></label><label class="fld"><span class="lbl">Code</span><input id="sk-code"></label><label class="fld"><span class="lbl">Bezeichnung</span><input id="sk-name"></label><label class="fld"><span class="lbl">Erlaubte Materialgruppen (Komma)</span><input id="sk-grp" placeholder="Stahl, Edelstahl"></label>'; }
    UI().openModal("Neuer " + titel, felder, function () {
      var code = d.getElementById("sk-code").value; if (!code) { toast("Code erforderlich.", "err"); return false; }
      var uid = Store().uid(); var parent = d.getElementById("sk-parent") ? d.getElementById("sk-parent").value : null;
      var name = d.getElementById("sk-name").value;
      if (art === "standort") db.lagerStandorte.push({ id: uid, mandantId: mandantId(), code: code, name: name, adresse: d.getElementById("sk-adr").value, aktiv: true });
      else if (art === "lager") db.lager.push({ id: uid, mandantId: mandantId(), standortId: parent, code: code, name: name, aktiv: true });
      else if (art === "bereich") db.lagerBereiche.push({ id: uid, mandantId: mandantId(), lagerId: parent, code: code, name: name });
      else if (art === "regal") db.lagerRegale.push({ id: uid, mandantId: mandantId(), bereichId: parent, code: code, name: name });
      else db.lagerplaetze.push({ id: uid, mandantId: mandantId(), regalId: parent, code: code, bezeichnung: name, status: L().PLATZ_STATUS.AKTIV, erlaubteMaterialgruppen: (d.getElementById("sk-grp").value || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean), gesperrt: false, sperrgrund: null, notiz: null });
      save(); toast(titel + " angelegt."); refresh(); return true;
    }, "Anlegen");
  }
  function platzBearbeiten(id) {
    var s = st(); var p = L().platzById(s, id); if (!p) return;
    var body = '<label class="fld"><span class="lbl">Code</span><input id="pe-code" value="' + esc(p.code) + '"></label>' +
      '<label class="fld"><span class="lbl">Bezeichnung</span><input id="pe-name" value="' + esc(p.bezeichnung || "") + '"></label>' +
      '<label class="fld"><span class="lbl">Materialgruppen (Komma)</span><input id="pe-grp" value="' + esc((p.erlaubteMaterialgruppen || []).join(", ")) + '"></label>' +
      '<label class="fld"><span class="lbl">Status</span><select id="pe-status"><option value="aktiv"' + (p.status === "aktiv" ? " selected" : "") + ">aktiv</option><option value=\"inaktiv\"" + (p.status === "inaktiv" ? " selected" : "") + ">inaktiv</option></select></label>";
    UI().openModal("Lagerplatz bearbeiten", body, function () {
      p.code = d.getElementById("pe-code").value || p.code; p.bezeichnung = d.getElementById("pe-name").value;
      p.erlaubteMaterialgruppen = (d.getElementById("pe-grp").value || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      p.status = d.getElementById("pe-status").value; save(); toast("Lagerplatz gespeichert."); refresh(); return true;
    }, "Speichern");
  }

  // ============================================================
  //  EVENT-VERDRAHTUNG
  // ============================================================
  function wire(root) {
    // Tab-übergreifende Filter
    var bind = function (id, fn) { var el = d.getElementById(id); if (el) fn(el); };
    bind("af-q", function (el) { el.oninput = function () { artikelFilter.q = el.value; clearTimeout(el._t); el._t = setTimeout(refresh, 250); }; });
    bind("af-ws", function (el) { el.onchange = function () { artikelFilter.werkstoff = el.value; refresh(); }; });
    bind("af-melde", function (el) { el.onchange = function () { artikelFilter.unterMelde = el.checked; refresh(); }; });
    bind("af-gesp", function (el) { el.onchange = function () { artikelFilter.gesperrt = el.checked; refresh(); }; });
    bind("af-rest", function (el) { el.onchange = function () { artikelFilter.mitRest = el.checked; refresh(); }; });
    bind("af-preis", function (el) { el.onchange = function () { artikelFilter.ohnePreis = el.checked; refresh(); }; });
    bind("jf-q", function (el) { el.oninput = function () { journalFilter.q = el.value; clearTimeout(el._t); el._t = setTimeout(refresh, 250); }; });
    bind("jf-typ", function (el) { el.onchange = function () { journalFilter.typ = el.value; refresh(); }; });
    bind("rf-q", function (el) { el.oninput = function () { restFilter.q = el.value; clearTimeout(el._t); el._t = setTimeout(refresh, 250); }; });
    bind("rf-ws", function (el) { el.onchange = function () { restFilter.werkstoff = el.value; refresh(); }; });
    bind("rf-status", function (el) { el.onchange = function () { restFilter.status = el.value; refresh(); }; });
    // Buttons
    var on = function (sel, attr, fn) { root.querySelectorAll(sel).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); fn(b.getAttribute(attr), b); }; }); };
    on("[data-art]", "data-art", artikelDetail);
    on("[data-neu]", "data-neu", strukturNeu);
    on("[data-pedit]", "data-pedit", platzBearbeiten);
    on("[data-psperr]", "data-psperr", function (id) { var s = st(); var p = L().platzById(s, id); if (p) { p.gesperrt = !p.gesperrt; p.status = p.gesperrt ? "gesperrt" : "aktiv"; save(); toast(p.gesperrt ? "Lagerplatz gesperrt." : "Lagerplatz entsperrt."); refresh(); } });
    on("[data-petikett]", "data-petikett", function (id) { etikettModal("lagerplatz", id); });
    on("[data-bewdet]", "data-bewdet", bewegungDetail);
    on("[data-gegen]", "data-gegen", function (id) { var s = st(); var r = L().storniere(s, id, { grund: "Gegenbuchung (UI)", benutzer: benutzer() }, Store().nowISO()); if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return; } save(); toast("Gegenbuchung erstellt (Original bleibt erhalten)."); refresh(); });
    bind("jexport-dummy", function () {});
    on("[data-jexport]", "data-jexport", function () { var s = st(); csvDownload("lager-journal.csv", L().berichtBewegungen(s, mandantId()).csv); });
    on("[data-we-neu]", "data-we-neu", wareneingangAssistent);
    on("[data-res-neu]", "data-res-neu", reservierungModal);
    on("[data-resauf]", "data-resauf", function (id) { var s = st(); L().reservierungAufloesen(s, id, Store().nowISO()); save(); toast("Reservierung aufgelöst."); refresh(); });
    on("[data-resbestell]", "data-resbestell", function (id) { var s = st(); var bo = L().bestellungAusVorschlag(s, id, benutzer(), Store().nowISO()); if (bo) { save(); toast("Bestellung (Entwurf) aus Fehlmenge erstellt."); TAB = "bestellungen"; refresh(); } else toast("Kein Bestellbedarf.", "err"); });
    on("[data-ent-neu]", "data-ent-neu", entnahmeModal);
    on("[data-rueck]", "data-rueck", rueckgabeModal);
    on("[data-uml-neu]", "data-uml-neu", umlagerungModal);
    on("[data-rst-neu]", "data-rst-neu", reststueckModal);
    on("[data-rstres]", "data-rstres", function (id) { var s = st(); L().reststueckReservieren(s, id, {}, Store().nowISO()); save(); toast("Reststück reserviert."); refresh(); });
    on("[data-rstuse]", "data-rstuse", reststueckVerwenden);
    on("[data-rstscrap]", "data-rstscrap", function (id) { var s = st(); var r = s.reststuecke.filter(function (x) { return x.id === id; })[0]; if (r && w.confirm("Reststück verschrotten?")) { r.status = L().REST_STATUS.VERSCHROTTET; save(); toast("Reststück verschrottet."); refresh(); } });
    on("[data-rstetikett]", "data-rstetikett", function (id) { etikettModal("reststueck", id); });
    on("[data-trace]", "data-trace", function (id) { traceRichtung = "vor"; traceModal(id); });
    on("[data-chsperr]", "data-chsperr", chargeSperrenModal);
    on("[data-chentsperr]", "data-chentsperr", chargeEntsperrenModal);
    on("[data-inv-neu]", "data-inv-neu", inventurNeuModal);
    on("[data-invopen]", "data-invopen", inventurOeffnen);
    on("[data-vorschlag]", "data-vorschlag", function (id) { var s = st(); var bo = L().bestellungAusVorschlag(s, id, benutzer(), Store().nowISO()); if (bo) { save(); toast("Bestellung (Entwurf) erstellt."); refresh(); } });
    on("[data-bostatus]", "data-bostatus", function (v) { var parts = v.split("|"); var s = st(); var r = L().bestellungStatus(s, parts[0], parts[1], benutzer(), Store().nowISO()); if (!r.ok) { toast(r.grund, "err"); return; } save(); toast("Status: " + parts[1] + " (nicht versendet)."); refresh(); });
    on("[data-report]", "data-report", function (v) { var parts = v.split("|"); reportRun(parts[0], parts[1]); });
    // Etiketten-Tab
    bind("et-typ", function (el) { var idSel = d.getElementById("et-id"); function fill() { idSel.innerHTML = etikettOptions(el.value).map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + "</option>"; }).join(""); } el.onchange = fill; fill(); });
    bind("et-show", function (el) { el.onclick = function () { d.getElementById("et-preview").innerHTML = etikettHtml(d.getElementById("et-typ").value, d.getElementById("et-id").value); }; });
    bind("et-print-all", function (el) { el.onclick = function () { var s = st(); printWindow("Lagerplatz-Etiketten", s.plaetze.map(function (p) { return etikettHtml("lagerplatz", p.id); }).join("")); }; });
  }

  P.LagerUI = { render: render };
})(window, document);
