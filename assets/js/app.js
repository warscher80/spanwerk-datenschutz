/* ============================================================
   Preisschmiede – UI / App-Steuerung
   ============================================================ */
(function (w, d) {
  "use strict";

  var Store = w.Preisschmiede.Store;
  var Auth = w.Preisschmiede.Auth;
  var Calc = w.Preisschmiede.Calc;
  var Konfig = w.Preisschmiede.Konfigurator;
  var Products = w.Preisschmiede.Products;
  var Datanorm = w.Preisschmiede.Datanorm;
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
    kundenprojekte: function () { renderKundenProjekte(); },
    konfigurator: function () { renderKonfigurator(); }
  };
  function navTo(page) {
    // Rollen-Schutz: gesperrte Seiten auf die erste erlaubte umleiten
    if (Auth && Auth.istAngemeldet() && !Auth.darf(page)) page = ersteErlaubteSeite();
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
  function renderDashboard() {
    var root = $("#page-dashboard .content");
    var auftraege = db.auftraege;
    var angebote = auftraege.filter(function (a) { return a.status === "Angebot"; });
    var abgeschlossen = auftraege.filter(function (a) { return a.status === "Abgeschlossen"; });
    var beauftragt = auftraege.filter(function (a) { return a.status === "Beauftragt" || a.status === "Abgeschlossen"; });

    var summeNetto = auftraege.reduce(function (s, a) { return s + auftragNetto(a); }, 0);
    var umsatz = beauftragt.reduce(function (s, a) { return s + auftragNetto(a); }, 0);
    var summeDB = auftraege.reduce(function (s, a) { return s + auftragDB(a); }, 0);
    var gewinnUmsatz = beauftragt.reduce(function (s, a) { return s + auftragGewinn(a); }, 0);
    var erfolg = auftraege.length ? Math.round(beauftragt.length / auftraege.length * 100) : 0;
    // Ø Deckungsbeitrag % über Aufträge mit Netto
    var dbProzListe = auftraege.map(function (a) { var n = auftragNetto(a); return n > 0 ? auftragDB(a) / n * 100 : null; }).filter(function (x) { return x != null; });
    var avgDBproz = dbProzListe.length ? Math.round(dbProzListe.reduce(function (s, x) { return s + x; }, 0) / dbProzListe.length) : 0;

    // Genauigkeit aus abgeschlossenen Aufträgen
    var genauigkeit = "—";
    var abwListe = abgeschlossen.map(function (a) { var si = Calc.sollIst(a); return si ? Math.abs(si.abwProz) : null; }).filter(function (x) { return x != null; });
    if (abwListe.length) {
      var avgAbw = Math.round(abwListe.reduce(function (s, x) { return s + x; }, 0) / abwListe.length);
      genauigkeit = (100 - avgAbw) + " %";
    }

    var html = "";
    html += '<div class="grid cols-4">';
    html += stat("Aufträge / Angebote", auftraege.length + " / " + angebote.length);
    html += stat("Angebotswert (netto)", fmtEUR(summeNetto), "accent", "alle Vorgänge");
    html += stat("Umsatz (beauftragt)", fmtEUR(umsatz), "green", beauftragt.length + " Aufträge");
    html += stat("Erfolgsquote", erfolg + " %", "", "beauftragt / alle");
    html += "</div>";
    html += '<div class="grid cols-4" style="margin-top:16px">';
    html += stat("Deckungsbeitrag Σ", fmtEUR(summeDB), "green");
    html += stat("Gewinn (beauftragt)", fmtEUR(gewinnUmsatz), "accent");
    html += stat("Ø Deckungsbeitrag", avgDBproz + " %");
    html += stat("Kalkulations-Genauigkeit", genauigkeit, "", abgeschlossen.length + " nachkalkuliert");
    html += "</div>";

    // Erkenntnisse
    html += '<div class="grid cols-2" style="margin-top:16px">';
    html += '<div class="card"><h3>🧠 Was die App gelernt hat</h3>' + erkenntnisseHTML(4) + "</div>";

    // Letzte Aufträge
    html += '<div class="card"><h3>Letzte Vorgänge</h3>';
    if (!auftraege.length) {
      html += '<div class="empty">Noch keine Aufträge. Lege in „Kalkulation“ deinen ersten Vorgang an.</div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr><th>Bezeichnung</th><th>Status</th><th class="num">Netto</th><th class="num">DB</th></tr></thead><tbody>';
      auftraege.slice().reverse().slice(0, 6).forEach(function (a) {
        html += "<tr><td>" + esc(a.titel) + (a.kommission ? ' <span class="tag">' + esc(a.kommission) + "</span>" : "") +
          '<br><span class="muted" style="font-size:11px">' + fmtDate(a.erstellt) + "</span></td>" +
          "<td>" + statusBadge(a.status) + "</td>" +
          '<td class="num">' + fmtEUR(auftragNetto(a)) + "</td>" +
          '<td class="num">' + fmtEUR(auftragDB(a)) + "</td></tr>";
      });
      html += "</tbody></table></div>";
    }
    html += "</div></div>";

    root.innerHTML = html;
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
      "</div>";
    $("#btn-sync").onclick = syncModal;

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
      '<button class="btn sm" id="btn-konfig-dup" type="button">📋 Duplizieren</button></div>';
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
      '<p class="hint">Rüstkosten je Auftrag = Rüstzeit × Rüstkostensatz + fixe Rüstkosten. Werden einmal berechnet, sobald der zugeordnete Arbeitsschritt anfällt.</p>';
    openModal(m ? "Maschine bearbeiten" : "Maschine anlegen", body, function () {
      var name = $("#ma-name").value.trim();
      if (!name) { toast("Bitte Maschinennamen angeben.", "err"); return false; }
      var daten = {
        name: name, schritt: $("#ma-schritt").value,
        stundensatz: leseZahl0($("#ma-satz").value),
        ruestzeitStd: leseZahl0($("#ma-rzeit").value),
        ruestkostensatz: leseZahl0($("#ma-rksatz").value),
        fixeRuestkosten: leseZahl0($("#ma-rfix").value)
      };
      if (m) { m.name = daten.name; m.schritt = daten.schritt; m.stundensatz = daten.stundensatz; m.ruestzeitStd = daten.ruestzeitStd; m.ruestkostensatz = daten.ruestkostensatz; m.fixeRuestkosten = daten.fixeRuestkosten; delete m.ruestkosten; }
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
        catch (e) { console.error("Aktion fehlgeschlagen:", e); toast("Aktion fehlgeschlagen — bitte Eingaben prüfen.", "err"); }
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
    wendeRollenNavAn();
    navTo(ersteErlaubteSeite());
  }
  function initLogin() {
    var btn = $("#login-btn"); if (!btn) return;
    function versuch() {
      var ok = Auth.login($("#login-user").value, $("#login-pin").value);
      if (ok) { starteNachLogin(); }
      else { $("#login-fehler").hidden = false; $("#login-pin").value = ""; try { $("#login-pin").focus(); } catch (e) {} }
    }
    btn.onclick = versuch;
    $("#login-pin").addEventListener("keydown", function (e) { if (e.key === "Enter") versuch(); });
  }

  function init() {
    // Globale Fehlerabfangung: Die App soll nie komplett einfrieren
    w.addEventListener("error", function (ev) { console.error("Fehler abgefangen:", ev.error || ev.message); });
    w.addEventListener("unhandledrejection", function (ev) { console.error("Hintergrund-Fehler abgefangen:", ev.reason); });

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
