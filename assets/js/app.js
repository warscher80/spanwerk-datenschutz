/* ============================================================
   Preisschmiede – UI / App-Steuerung
   ============================================================ */
(function (w, d) {
  "use strict";

  var Store = w.Preisschmiede.Store;
  var Calc = w.Preisschmiede.Calc;
  var Products = w.Preisschmiede.Products;
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
    t.textContent = msg;
    t.className = "toast show " + (kind || "ok");
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.className = "toast"; }, 2600);
  }

  // ---------- Navigation ----------
  var RENDERER = {
    dashboard: function () { renderDashboard(); }, stammdaten: function () { renderStammdaten(); },
    material: function () { renderMaterial(); }, kalkulation: function () { renderKalkulation(); },
    auftraege: function () { renderAuftraege(); }, lernen: function () { renderLernen(); }
  };
  function navTo(page) {
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
  function auftragDB(a) { return (a.kalk ? a.kalk.deckungsbeitrag : 0) - auftragRabattBetrag(a); }
  function auftragGewinn(a) { return (a.kalk ? a.kalk.gewinn : 0) - auftragRabattBetrag(a); }

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
          fld2("UID-Nr.", "firma-uid", f.uid, "text") +
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
      '<div class="card" style="margin-top:16px"><h3>Maschinen der Firma <span class="sub">Stundensatz (€/h) + Rüstkosten (€ je Auftrag) – werden zusätzlich zum Lohn berechnet</span></h3>' +
        '<div id="maschinen-bereich"></div>' +
      "</div>" +
      '<div class="card" style="margin-top:16px"><h3>Kunden <span class="sub">erscheinen als Empfänger-Anschrift auf dem Angebot</span></h3>' +
        '<div id="kunden-bereich"></div>' +
      "</div>" +
      '<div class="btn-row" style="margin-top:16px">' +
        '<button class="btn primary" id="btn-save-stammdaten">Stammdaten speichern</button>' +
        '<button class="btn ghost" id="btn-reset-stammdaten">Auf Standard zurücksetzen</button>' +
      "</div>" +
      '<hr class="sep">' +
      '<div class="card"><h3>Daten-Verwaltung</h3>' +
        '<p class="muted" style="font-size:13px">Alle Daten liegen ausschließlich lokal in diesem Browser. Erstelle ein Backup oder übertrage deine Daten auf ein anderes Gerät.</p>' +
        '<div class="btn-row">' +
          '<button class="btn" id="btn-export">⬇️ Backup exportieren</button>' +
          '<button class="btn" id="btn-import">⬆️ Backup importieren</button>' +
          '<button class="btn danger" id="btn-reset-all">Alle Daten löschen</button>' +
        "</div>" +
        '<input type="file" id="file-import" accept="application/json" style="display:none">' +
      "</div>";

    $("#btn-save-stammdaten").onclick = function () {
      s.rates.cad = numv("#rate-cad"); s.rates.fertigung = numv("#rate-fertigung");
      s.rates.montage = numv("#rate-montage"); s.rates.projektleitung = numv("#rate-projektleitung");
      s.materialAufschlag = numv("#set-materialAufschlag"); s.gemeinkosten = numv("#set-gemeinkosten");
      s.gewinn = numv("#set-gewinn"); s.verschnitt = numv("#set-verschnitt"); s.mwst = numv("#set-mwst");
      s.firma = {
        name: $("#firma-name").value.trim(), inhaber: $("#firma-inhaber").value.trim(),
        strasse: $("#firma-strasse").value.trim(), plzOrt: $("#firma-plzOrt").value.trim(),
        tel: $("#firma-tel").value.trim(), email: $("#firma-email").value.trim(), uid: $("#firma-uid").value.trim()
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
    renderMaschinen();
    renderKunden();
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

  function kundeModal(id) {
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
      if (k) { Object.keys(daten).forEach(function (key) { k[key] = daten[key]; }); }
      else { daten.id = Store.uid(); liste.push(daten); }
      Store.save(); renderKunden(); toast("Kunde gespeichert.");
      return true;
    });
  }

  // ---- Maschinen-Verwaltung -----------------------------------
  function schrittLabel(key) {
    var s = SCHRITTE.filter(function (x) { return x.key === key; })[0];
    return s ? s.label : "—";
  }
  function renderMaschinen() {
    var wrap = $("#maschinen-bereich");
    if (!wrap) return;
    var liste = db.settings.maschinen || [];
    var html = '<div class="btn-row" style="margin-bottom:12px"><button class="btn primary sm" id="btn-add-maschine" type="button">+ Maschine anlegen</button></div>';
    if (!liste.length) {
      html += '<div class="empty">Noch keine Maschinen. Lege die Maschinen deiner Firma an.</div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr><th>Maschine</th><th>Arbeitsschritt</th><th class="num">Stundensatz</th><th class="num">Rüstkosten</th><th class="num">Aktion</th></tr></thead><tbody>';
      liste.forEach(function (m) {
        html += "<tr><td><strong>" + esc(m.name) + "</strong></td>" +
          "<td>" + esc(schrittLabel(m.schritt)) + "</td>" +
          '<td class="num">' + fmtEUR(m.stundensatz) + "/h</td>" +
          '<td class="num">' + fmtEUR(m.ruestkosten) + "</td>" +
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
    var body =
      fld2("Maschinenname", "ma-name", m ? m.name : "", "text") +
      '<label class="fld"><span class="lbl">Arbeitsschritt (für automatische Zuordnung)</span><select id="ma-schritt">' + schrittOpt + "</select></label>" +
      '<div class="inline">' +
        fld2("Stundensatz (€/h)", "ma-satz", m ? m.stundensatz : "", "number") +
        fld2("Rüstkosten (€ je Auftrag)", "ma-ruest", m ? m.ruestkosten : 0, "number") +
      "</div>" +
      '<p class="hint">Die Rüstkosten werden je Auftrag einmal berechnet, sobald der zugeordnete Arbeitsschritt anfällt.</p>';
    openModal(m ? "Maschine bearbeiten" : "Maschine anlegen", body, function () {
      var name = $("#ma-name").value.trim();
      if (!name) { toast("Bitte Maschinennamen angeben.", "err"); return false; }
      var daten = {
        name: name, schritt: $("#ma-schritt").value,
        stundensatz: parseFloat($("#ma-satz").value) || 0,
        ruestkosten: parseFloat($("#ma-ruest").value) || 0
      };
      if (m) { m.name = daten.name; m.schritt = daten.schritt; m.stundensatz = daten.stundensatz; m.ruestkosten = daten.ruestkosten; }
      else { daten.id = Store.uid(); liste.push(daten); }
      Store.save(); renderMaschinen(); toast("Maschine gespeichert.");
      return true;
    });
  }

  function fld(label, id, val, suffix) {
    var inner = '<input type="number" step="any" id="' + id + '" value="' + esc(val) + '">';
    if (suffix) inner = '<div class="suffix-grp">' + inner + '<span class="suffix">' + suffix + "</span></div>";
    return '<label class="fld"><span class="lbl">' + esc(label) + "</span>" + inner + "</label>";
  }
  function numv(sel) { return parseFloat($(sel).value) || 0; }

  // ============================================================
  //  MATERIAL
  // ============================================================
  function renderMaterial() {
    var root = $("#page-material .content");
    var html = '<div class="card"><h3>Materialdatenbank <span class="sub">' + db.material.length + ' Positionen</span></h3>';
    html += '<div class="btn-row" style="margin-bottom:14px"><button class="btn primary sm" id="btn-add-material">+ Material anlegen</button></div>';
    html += '<div class="table-wrap"><table><thead><tr><th>Bezeichnung</th><th>Typ</th><th>Lieferant</th><th class="num">Preis</th><th>Einheit</th><th class="num">Lager</th><th class="num">Aktion</th></tr></thead><tbody>';
    db.material.forEach(function (m) {
      html += "<tr>" +
        "<td>" + esc(m.name) + (m.historie && m.historie.length > 1 ? ' <span class="tag">' + m.historie.length + " Preise</span>" : "") + "</td>" +
        "<td>" + esc(m.typ || "-") + "</td>" +
        "<td>" + esc(m.lieferant || "-") + "</td>" +
        '<td class="num">' + fmtEUR(m.preis) + "</td>" +
        "<td>/" + esc(m.einheit) + "</td>" +
        '<td class="num muted">' + (m.lager != null && m.lager !== "" ? esc(m.lager) + " " + esc(m.einheit) : "—") + "</td>" +
        '<td class="num"><button class="btn sm ghost" data-edit="' + m.id + '">✏️</button> ' +
          '<button class="btn sm danger" data-del="' + m.id + '">🗑️</button></td></tr>';
    });
    html += "</tbody></table></div></div>";
    root.innerHTML = html;

    $("#btn-add-material").onclick = function () { materialModal(null); };
    $all("[data-edit]").forEach(function (b) { b.onclick = function () { materialModal(b.dataset.edit); }; });
    $all("[data-del]").forEach(function (b) {
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
    var body =
      fld2("Bezeichnung", "m-name", m ? m.name : "", "text") +
      '<div class="inline">' +
        fld2("Typ", "m-typ", m ? m.typ : "Stahl", "text") +
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
      var preis = parseFloat($("#m-preis").value) || 0;
      var lagerRaw = $("#m-lager").value.trim();
      var lager = lagerRaw === "" ? null : (parseFloat(lagerRaw) || 0);
      var kgRaw = $("#m-kg").value.trim();
      var kg = kgRaw === "" ? null : (parseFloat(kgRaw) || 0);
      var ppkRaw = $("#m-preisProKg").value.trim();
      var ppk = ppkRaw === "" ? null : (parseFloat(ppkRaw) || 0);
      if (m) {
        if (preis !== m.preis) m.historie.push({ datum: Store.nowISO(), preis: preis });
        m.name = name; m.typ = $("#m-typ").value.trim(); m.einheit = $("#m-einheit").value.trim() || "Stk";
        m.preis = preis; m.lieferant = $("#m-lieferant").value.trim(); m.lager = lager;
        m.kgProEinheit = kg; m.preisProKg = ppk; m.aktualisiert = Store.nowISO();
      } else {
        db.material.push({
          id: Store.uid(), name: name, typ: $("#m-typ").value.trim(),
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
    return '<label class="fld"><span class="lbl">' + esc(label) + '</span><input type="' + (typ || "text") +
      '" id="' + id + '" value="' + esc(val == null ? "" : val) + '"' + (typ === "number" ? ' step="any"' : "") + "></label>";
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
          '</span><input type="number" step="any" data-cfg="' + q.key + '" value="' + esc(cur) + '"></label>';
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
          '</span><input type="number" step="any" data-zeit="' + s.key + '" value="' + (mv != null ? esc(mv) : "") + '" placeholder="auto"></label>';
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
          var v = parseFloat(inp.value);
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
        '<input data-pos="' + i + '-menge" type="number" step="any" placeholder="Menge" value="' + esc(p.menge) + '" style="flex:.8">' +
        '<input data-pos="' + i + '-einheit" placeholder="Einh." value="' + esc(p.einheit) + '" style="flex:.6">' +
        '<input data-pos="' + i + '-preis" type="number" step="any" placeholder="€/Einh." value="' + esc(p.preis) + '" style="flex:.9">' +
        '<button class="btn sm danger" data-pos-del="' + i + '" type="button">✕</button></div>';
    });
    wrap.innerHTML = html;
    $all("[data-pos]", wrap).forEach(function (inp) {
      inp.addEventListener("input", function () {
        var parts = inp.dataset.pos.split("-"); var idx = +parts[0]; var key = parts[1];
        entwurf.freiePositionen[idx][key] = (key === "menge" || key === "preis") ? parseFloat(inp.value) || 0 : inp.value;
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
        rabatt: parseFloat($("#a-rabatt").value) || 0,
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
          '</td><td class="num"><input type="number" step="any" data-ist="' + pi + ":" + s.key + '" value="' + esc(istV) + '" placeholder="' + (soll || 0) + '" style="width:80px;text-align:right"></td>' +
          '<td class="num"><button class="btn sm ' + (laeuft ? "danger" : "ghost") + '" data-timer="' + pi + ":" + s.key + '" type="button">' + (laeuft ? "⏹ Stopp" : "▶") + "</button></td></tr>";
      });
      body += "</tbody></table></div>";
    });
    body += fld2("Materialverbrauch / Notiz (optional)", "a-matnote", a.materialKommentar || "", "text");

    if (si) {
      body += '<div class="insight" style="margin-top:12px"><span class="ico">📊</span><span>Ist gesamt: <strong>' + fmtH(si.istStunden) +
        "</strong> vs. Soll " + fmtH(si.sollStunden) + " — Abweichung <strong>" + (si.abwProz > 0 ? "+" : "") + si.abwProz + " %</strong></span></div>";
    }

    openModalWide("Auftrag: " + esc(a.titel), body, function () {
      a.status = $("#a-status").value;
      a.kommission = $("#a-kommission").value.trim();
      a.rabatt = parseFloat($("#a-rabatt").value) || 0;
      var istProPos = {};
      $all("[data-ist]").forEach(function (inp) {
        var v = parseFloat(inp.value);
        if (isNaN(v) || v <= 0) return;
        var parts = inp.dataset.ist.split(":"); var pi = parts[0], key = parts[1];
        (istProPos[pi] = istProPos[pi] || {})[key] = v;
      });
      var hatIst = false;
      positionen.forEach(function (p, pi) {
        if (istProPos[pi]) { p.ist = { zeiten: istProPos[pi], erfasst: Store.nowISO() }; hatIst = true; }
      });
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
    tickTimer();
  }

  // ---- Zeiterfassung (Timer, nur einer gleichzeitig) --------
  function istAusDomSpeichern(a) {
    var positionen = auftragPositionen(a);
    $all("[data-ist]").forEach(function (inp) {
      var v = parseFloat(inp.value);
      var parts = inp.dataset.ist.split(":"); var pi = +parts[0], key = parts[1];
      var p = positionen[pi]; if (!p) return;
      if (!isNaN(v) && v > 0) { p.ist = p.ist || { zeiten: {}, erfasst: Store.nowISO() }; p.ist.zeiten[key] = v; }
    });
  }
  function timerBuchen() {
    var t = db.aktiverTimer; if (!t) return;
    var a = db.auftraege.filter(function (x) { return x.id === t.auftragId; })[0];
    var dauerH = (Date.now() - new Date(t.startISO).getTime()) / 3600000;
    if (a) {
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
  //  UPDATE-PRÜFUNG
  //  Vergleicht die eingebettete Build-Nummer (assets/build-info.json)
  //  mit der neuesten veröffentlichten Version (version.json im Release).
  //  Ist eine neuere Version verfügbar, erscheint ein Hinweis-Banner.
  // ============================================================
  var REPO = "warscher80/spanwerk-datenschutz";
  var UPDATE_APK_URL = "https://github.com/" + REPO + "/releases/download/app-latest/preisschmiede.apk";
  // GitHub-API (sendet CORS-Header, funktioniert daher in der App-WebView)
  var UPDATE_API_URL = "https://api.github.com/repos/" + REPO + "/releases/tags/app-latest";

  function pruefeUpdate() {
    // Eigene Version wird vom eingebetteten build-info.js gesetzt (window.PSBUILD).
    // Fehlt sie (z. B. Web-Vorschau), wird der Check still übersprungen.
    var lokal = w.PSBUILD;
    if (!lokal || typeof lokal.build !== "number" || !w.fetch) return;
    fetch(UPDATE_API_URL, { cache: "no-store", headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rel) {
        if (!rel || !rel.body) return;
        var m = /Version\s+\d+\.\d+\.(\d+)/.exec(rel.body);
        if (!m) return;
        var remoteBuild = parseInt(m[1], 10);
        if (isFinite(remoteBuild) && remoteBuild > lokal.build) {
          zeigeUpdateBanner({ version: "1.0." + remoteBuild });
        }
      })
      .catch(function () { /* offline o. ä. – still ignorieren, App läuft normal weiter */ });
  }

  function zeigeUpdateBanner(remote) {
    if ($("#update-banner")) return;
    var b = el("div", { id: "update-banner", class: "update-banner" });
    b.innerHTML = '<span>🔄 Neue Version verfügbar' + (remote.version ? " (" + esc(remote.version) + ")" : "") + "</span>" +
      '<div class="ub-actions">' +
        '<a class="btn primary sm" href="' + UPDATE_APK_URL + '" target="_blank" rel="noopener">Jetzt aktualisieren</a>' +
        '<button class="btn ghost sm" id="update-later">Später</button>' +
      "</div>";
    d.body.appendChild(b);
    $("#update-later").onclick = function () { b.remove(); };
  }

  // ============================================================
  //  INIT
  // ============================================================
  function init() {
    // Globale Fehlerabfangung: Die App soll nie komplett einfrieren
    w.addEventListener("error", function (ev) { console.error("Fehler abgefangen:", ev.error || ev.message); });
    w.addEventListener("unhandledrejection", function (ev) { console.error("Hintergrund-Fehler abgefangen:", ev.reason); });

    $all(".nav li").forEach(function (li) { li.onclick = function () { navTo(li.dataset.page); }; });
    var vtext = (w.PSBUILD && w.PSBUILD.version) ? "Version " + w.PSBUILD.version : "Web-Version";
    $all(".app-version").forEach(function (e) { e.textContent = vtext; });
    navTo("dashboard");
    try { pruefeUpdate(); } catch (e) { console.error(e); }
    setInterval(function () { try { tickTimer(); } catch (e) { /* Timer-Tick darf nie stören */ } }, 1000);
  }

  function start() { try { init(); } catch (e) { console.error("Start-Fehler:", e); } }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start);
  else start();
})(window, document);
