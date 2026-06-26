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
  function navTo(page) {
    $all(".nav li").forEach(function (li) { li.classList.toggle("active", li.dataset.page === page); });
    $all(".page").forEach(function (p) { p.classList.toggle("active", p.id === "page-" + page); });
    if (page === "dashboard") renderDashboard();
    if (page === "stammdaten") renderStammdaten();
    if (page === "material") renderMaterial();
    if (page === "kalkulation") renderKalkulation();
    if (page === "auftraege") renderAuftraege();
    if (page === "lernen") renderLernen();
    w.scrollTo(0, 0);
  }

  // ============================================================
  //  DASHBOARD
  // ============================================================
  function renderDashboard() {
    var root = $("#page-dashboard .content");
    var auftraege = db.auftraege;
    var angebote = auftraege.filter(function (a) { return a.status === "Angebot"; });
    var abgeschlossen = auftraege.filter(function (a) { return a.status === "Abgeschlossen"; });

    var summeNetto = auftraege.reduce(function (s, a) { return s + (a.kalk ? a.kalk.netto : 0); }, 0);
    var summeDB = auftraege.reduce(function (s, a) { return s + (a.kalk ? a.kalk.deckungsbeitrag : 0); }, 0);
    var summeGewinn = auftraege.reduce(function (s, a) { return s + (a.kalk ? a.kalk.gewinn : 0); }, 0);

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
    html += stat("Auftragswert (netto)", fmtEUR(summeNetto), "accent");
    html += stat("Deckungsbeitrag Σ", fmtEUR(summeDB), "green");
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
        html += "<tr><td>" + esc(a.titel) + '<br><span class="muted" style="font-size:11px">' + fmtDate(a.erstellt) + "</span></td>" +
          "<td>" + statusBadge(a.status) + "</td>" +
          '<td class="num">' + fmtEUR(a.kalk ? a.kalk.netto : 0) + "</td>" +
          '<td class="num">' + fmtEUR(a.kalk ? a.kalk.deckungsbeitrag : 0) + "</td></tr>";
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
      '<div class="card" style="margin-top:16px"><h3>Maschinenstundensätze <span class="sub">€ / Stunde – werden zusätzlich zum Lohn berechnet</span></h3>' +
        '<div class="inline">' +
          fld("Säge / Zuschnitt", "masch-saege", s.maschinen.saege, "€/h") +
          fld("Laser", "masch-laser", s.maschinen.laser, "€/h") +
          fld("Abkantpresse", "masch-abkantpresse", s.maschinen.abkantpresse, "€/h") +
        "</div><div class=\"inline\">" +
          fld("Bohrmaschine", "masch-bohrmaschine", s.maschinen.bohrmaschine, "€/h") +
          fld("Schweißgerät", "masch-schweissgeraet", s.maschinen.schweissgeraet, "€/h") +
          fld("Schleifmaschine", "masch-schleifmaschine", s.maschinen.schleifmaschine, "€/h") +
        "</div>" +
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
      s.maschinen.saege = numv("#masch-saege"); s.maschinen.laser = numv("#masch-laser");
      s.maschinen.abkantpresse = numv("#masch-abkantpresse"); s.maschinen.bohrmaschine = numv("#masch-bohrmaschine");
      s.maschinen.schweissgeraet = numv("#masch-schweissgeraet"); s.maschinen.schleifmaschine = numv("#masch-schleifmaschine");
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
      if (m) {
        if (preis !== m.preis) m.historie.push({ datum: Store.nowISO(), preis: preis });
        m.name = name; m.typ = $("#m-typ").value.trim(); m.einheit = $("#m-einheit").value.trim() || "Stk";
        m.preis = preis; m.lieferant = $("#m-lieferant").value.trim(); m.lager = lager; m.aktualisiert = Store.nowISO();
      } else {
        db.material.push({
          id: Store.uid(), name: name, typ: $("#m-typ").value.trim(),
          einheit: $("#m-einheit").value.trim() || "Stk", preis: preis,
          lieferant: $("#m-lieferant").value.trim(), lager: lager, aktualisiert: Store.nowISO(),
          historie: [{ datum: Store.nowISO(), preis: preis }]
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
      tabs +
      '<div class="grid cols-2">' +
        '<div class="card"><h3>1 · Konfiguration</h3><div id="konfig-felder"></div></div>' +
        '<div class="card"><h3>2 · Kalkulation</h3><div id="kalk-ergebnis"><div class="empty">Konfiguration ausfüllen und „Berechnen“ klicken.</div></div></div>' +
      "</div>";

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

    html += '<div class="btn-row" style="margin-top:8px"><button class="btn primary" id="btn-berechnen" type="button">⚡ Berechnen</button></div>';
    wrap.innerHTML = html;

    // Events: Config-Felder
    $all("[data-cfg]", wrap).forEach(function (inp) {
      var ev = inp.type === "checkbox" ? "change" : "input";
      inp.addEventListener(ev, function () {
        entwurf.config[inp.dataset.cfg] = inp.type === "checkbox" ? inp.checked : inp.value;
      });
      // init in config
      entwurf.config[inp.dataset.cfg] = inp.type === "checkbox" ? inp.checked : inp.value;
    });

    if (prod.frei) {
      renderFreiePositionen();
      $("#btn-add-pos").onclick = function () {
        entwurf.freiePositionen.push({ name: "", menge: 1, einheit: "Stk", preis: 0 });
        renderFreiePositionen();
      };
      $all("[data-zeit]", wrap).forEach(function (inp) {
        inp.addEventListener("input", function () {
          var v = parseFloat(inp.value);
          if (isNaN(v)) delete entwurf.manuelleZeiten[inp.dataset.zeit];
          else entwurf.manuelleZeiten[inp.dataset.zeit] = v;
        });
      });
    }

    $("#btn-berechnen").onclick = berechnen;
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
      });
    });
    $all("[data-pos-del]", wrap).forEach(function (b) {
      b.onclick = function () { entwurf.freiePositionen.splice(+b.dataset.posDel, 1); renderFreiePositionen(); };
    });
  }

  function berechnen() {
    var kalk = Calc.kalkuliere(db, entwurf);
    entwurf.letzteKalk = kalk;
    renderKalkErgebnis(kalk);
  }

  function renderKalkErgebnis(kalk) {
    var root = $("#kalk-ergebnis");
    var prod = Products.byKey(entwurf.produktKey);
    var html = "";

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
    html += line("Material inkl. Aufschlag", fmtEUR(kalk.materialMitAufschlag));
    html += line("Lohn / Fertigung", fmtEUR(kalk.lohn));
    if (kalk.maschinenKosten > 0) html += line("Maschinenkosten", fmtEUR(kalk.maschinenKosten));
    html += line("Gemeinkosten", fmtEUR(kalk.gemeinkosten), "sub");
    html += line("Selbstkosten", fmtEUR(kalk.selbstkosten));
    html += line("Gewinn", fmtEUR(kalk.gewinn), "sub");
    html += line("Verkaufspreis netto", fmtEUR(kalk.netto), "total");
    html += line("Deckungsbeitrag", fmtEUR(kalk.deckungsbeitrag) + "  (" + kalk.deckungsbeitragProz + " %)", "sub");
    html += line("Brutto inkl. USt", fmtEUR(kalk.brutto));

    html += '<div class="btn-row" style="margin-top:14px">' +
      '<button class="btn primary" id="btn-angebot" type="button">📄 Als Angebot speichern</button>' +
      '<button class="btn" id="btn-drucken" type="button">🖨️ Angebot drucken / PDF</button>' +
      '<button class="btn" id="btn-angebotstext" type="button">📝 Angebotstext</button>' +
      "</div>";

    root.innerHTML = html;
    $("#btn-angebot").onclick = function () { speichereAngebot(kalk); };
    $("#btn-drucken").onclick = function () { angebotDrucken(entwurf, kalk, null); };
    $("#btn-angebotstext").onclick = function () {
      var txt = Calc.angebotstext(Object.assign({ mwst: db.settings.mwst + " %" }, entwurf), kalk);
      openModal("Angebotstext", '<textarea style="min-height:320px">' + esc(txt) + "</textarea>" +
        '<p class="hint">Text markieren und kopieren (Strg+C).</p>', null, "Schließen");
    };
  }

  // ---- Angebot als druckbares Dokument (PDF über Drucken) ----
  function angebotDrucken(eingabe, kalk, auftrag) {
    var s = db.settings, f = s.firma || {};
    var prod = Products.byKey(eingabe.produktKey);
    var c = eingabe.config || {};
    var nummer = auftrag && auftrag.nummer ? auftrag.nummer : "Vorschau";
    var heute = new Date();
    var gueltig = new Date(heute.getTime() + 30 * 864e5);
    var titel = auftrag ? auftrag.titel : (prod ? prod.name : "Angebot");

    // Leistungsbeschreibung aus Konfiguration
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

    // Materialliste als Leistungsumfang (ohne Preise – Pauschalangebot)
    var leistung = kalk.matZeilen.map(function (m) { return m.name + " (" + m.menge + " " + m.einheit + ")"; });

    function row(l, v, strong) {
      return '<tr class="' + (strong ? "strong" : "") + '"><td>' + esc(l) + '</td><td class="r">' + esc(v) + "</td></tr>";
    }

    var firmaKopf = esc(f.name || "Preisschmiede");
    var absender = [f.inhaber, f.strasse, f.plzOrt, f.tel, f.email].filter(Boolean).map(esc).join(" · ");

    var doc =
      '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Angebot ' + esc(nummer) + '</title><style>' +
      '@page{size:A4;margin:20mm}' +
      '*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a2330;font-size:12px;line-height:1.5;margin:0}' +
      '.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f5a623;padding-bottom:12px;margin-bottom:6px}' +
      '.logo{font-size:24px;font-weight:800;color:#d4820a}' +
      '.absender{font-size:10px;color:#667;margin-bottom:26px}' +
      'h1{font-size:18px;margin:18px 0 4px}.meta{color:#667;margin-bottom:18px}' +
      '.pos{margin:14px 0;padding:12px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd}' +
      '.pos b{font-size:13px}.leist{color:#445;margin-top:6px;font-size:11px}' +
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
      '<h1>Angebot Nr. ' + esc(nummer) + '</h1>' +
      '<div class="meta">Datum: ' + heute.toLocaleDateString("de-AT") + ' &nbsp;·&nbsp; gültig bis: ' + gueltig.toLocaleDateString("de-AT") +
        (auftrag ? ' &nbsp;·&nbsp; Betreff: ' + esc(auftrag.titel) : "") + '</div>' +
      '<p>Sehr geehrte Damen und Herren,<br>vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:</p>' +
      '<div class="pos"><b>Pos. 1 — ' + esc(prod ? prod.name : "Konstruktion") + '</b>' +
        (details.length ? '<div class="leist">' + esc(details.join(", ")) + "</div>" : "") +
        (leistung.length ? '<div class="leist">Leistungsumfang: ' + esc(leistung.join(", ")) + "</div>" : "") +
        '<div class="leist">inkl. Material, Fertigung' + (kalk.zeiten.montage > 0 ? ", Lieferung und Montage" : " und Lieferung") + " — Arbeitszeit ca. " + fmtH(kalk.stundenGesamt) + "</div></div>" +
      '<table>' +
        row("Gesamtpreis netto", fmtEUR(kalk.netto)) +
        row("zzgl. " + s.mwst + " % USt", fmtEUR(kalk.mwst)) +
        row("Gesamtpreis brutto", fmtEUR(kalk.brutto), true) +
      "</table>" +
      '<div class="text">Lieferzeit nach Vereinbarung. Dieses Angebot ist 30 Tage gültig.\nWir freuen uns auf Ihren Auftrag.\n\nMit freundlichen Grüßen\n' + esc(f.inhaber || f.name || "") + "</div>" +
      '<div class="foot">' + firmaKopf + (f.email ? " · " + esc(f.email) : "") +
        " · Erstellt mit Preisschmiede. Interne Kalkulationswerte (Gewinn, Deckungsbeitrag) sind in diesem Kundendokument nicht enthalten.</div>" +
      "</body></html>";

    var w2 = window.open("", "_blank");
    if (!w2) { toast("Bitte Pop-ups für diese Seite erlauben.", "err"); return; }
    w2.document.open(); w2.document.write(doc); w2.document.close();
  }

  function line(label, val, cls) {
    return '<div class="result-line ' + (cls || "") + '"><span>' + esc(label) + '</span><span class="v">' + esc(val) + "</span></div>";
  }

  function speichereAngebot(kalk) {
    var prod = Products.byKey(entwurf.produktKey);
    var c = entwurf.config;
    var titelvorschlag = prod.name + (c.werkstoff ? " " + c.werkstoff : "") + (c.laenge ? " " + c.laenge + "m" : "") + (c.bezeichnung ? " " + c.bezeichnung : "") + (c.stueck ? " (" + c.stueck + " Stk)" : "");
    openModal("Angebot speichern", fld2("Bezeichnung / Kunde", "a-titel", titelvorschlag.trim(), "text") +
      '<p class="hint">Der Vorgang wird als Angebot gespeichert und erscheint in „Aufträge“.</p>', function () {
      var titel = $("#a-titel").value.trim() || titelvorschlag.trim() || "Angebot";
      var jahr = new Date().getFullYear();
      var nummer = "ANG-" + jahr + "-" + String(db.settings.angebotZaehler || 1).padStart(3, "0");
      db.settings.angebotZaehler = (db.settings.angebotZaehler || 1) + 1;
      var auftrag = {
        id: Store.uid(),
        nummer: nummer,
        titel: titel,
        produktKey: entwurf.produktKey,
        config: JSON.parse(JSON.stringify(entwurf.config)),
        freiePositionen: JSON.parse(JSON.stringify(entwurf.freiePositionen)),
        manuelleZeiten: JSON.parse(JSON.stringify(entwurf.manuelleZeiten)),
        kalk: kalk,
        status: "Angebot",
        erstellt: Store.nowISO(),
        ist: null
      };
      db.auftraege.push(auftrag);
      Store.save();
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
    var html = '<div class="card"><div class="table-wrap"><table><thead><tr>' +
      '<th>Bezeichnung</th><th>Produkt</th><th>Status</th><th class="num">Netto</th><th class="num">DB</th><th class="num">Soll/Ist</th><th></th></tr></thead><tbody>';
    db.auftraege.slice().reverse().forEach(function (a) {
      var prod = Products.byKey(a.produktKey);
      var si = Calc.sollIst(a);
      var siTxt = si ? (si.abwProz > 0 ? "+" : "") + si.abwProz + " %" : "—";
      html += "<tr>" +
        "<td><strong>" + esc(a.titel) + '</strong><br><span class="muted" style="font-size:11px">' + fmtDate(a.erstellt) + "</span></td>" +
        "<td>" + (prod ? prod.icon + " " + esc(prod.name) : "-") + "</td>" +
        "<td>" + statusBadge(a.status) + "</td>" +
        '<td class="num">' + fmtEUR(a.kalk ? a.kalk.netto : 0) + "</td>" +
        '<td class="num">' + fmtEUR(a.kalk ? a.kalk.deckungsbeitrag : 0) + "</td>" +
        '<td class="num ' + (si && si.abwProz > 0 ? "" : "") + '">' + siTxt + "</td>" +
        '<td class="num"><button class="btn sm" data-auf="' + a.id + '">Öffnen</button></td></tr>';
    });
    html += "</tbody></table></div></div>";
    root.innerHTML = html;
    $all("[data-auf]").forEach(function (b) { b.onclick = function () { auftragModal(b.dataset.auf); }; });
  }

  function auftragModal(id) {
    var a = db.auftraege.find(function (x) { return x.id === id; });
    if (!a) return;
    var prod = Products.byKey(a.produktKey);
    var si = Calc.sollIst(a);

    var body = '<div class="muted" style="font-size:12px;margin-bottom:10px">' + (a.nummer ? "<strong>" + esc(a.nummer) + "</strong> · " : "") + (prod ? prod.icon + " " + prod.name : "") + " · " + fmtDate(a.erstellt) + " · " + statusBadge(a.status) + "</div>";
    body += '<div class="btn-row" style="margin-bottom:12px"><button class="btn sm" id="btn-auf-druck" type="button">🖨️ Angebot drucken / PDF</button></div>';

    // Status-Wechsel
    body += '<label class="fld"><span class="lbl">Status</span><select id="a-status">' +
      ["Angebot", "Beauftragt", "Abgeschlossen"].map(function (s) { return '<option' + (a.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("") +
      "</select></label>";

    // Kalkulationsübersicht
    body += '<div class="card" style="background:var(--panel-2);margin-bottom:12px">' +
      line("Verkaufspreis netto", fmtEUR(a.kalk.netto)) +
      line("Deckungsbeitrag", fmtEUR(a.kalk.deckungsbeitrag) + " (" + a.kalk.deckungsbeitragProz + " %)", "sub") +
      line("Soll-Stunden gesamt", fmtH(a.kalk.stundenGesamt), "sub") + "</div>";

    // Nachkalkulation – Ist-Zeiten erfassen
    body += '<div class="lbl" style="margin-bottom:8px">Nachkalkulation · Ist-Zeiten erfassen (h)</div>';
    body += '<div class="table-wrap"><table><thead><tr><th>Schritt</th><th class="num">Soll</th><th class="num">Ist</th></tr></thead><tbody>';
    SCHRITTE.forEach(function (s) {
      var soll = a.kalk.zeiten[s.key] || 0;
      if (soll <= 0 && !(a.ist && a.ist.zeiten && a.ist.zeiten[s.key])) return;
      var ist = a.ist && a.ist.zeiten ? (a.ist.zeiten[s.key] || "") : "";
      body += "<tr><td>" + esc(s.label) + '</td><td class="num muted">' + (soll ? fmtH(soll) : "—") +
        '</td><td class="num"><input type="number" step="any" data-ist="' + s.key + '" value="' + esc(ist) + '" placeholder="' + (soll || 0) + '" style="width:90px;text-align:right"></td></tr>';
    });
    body += "</tbody></table></div>";
    body += fld2("Materialverbrauch / Notiz (optional)", "a-matnote", a.ist ? (a.ist.materialKommentar || "") : "", "text");

    if (si) {
      body += '<div class="insight" style="margin-top:12px"><span class="ico">📊</span><span>Ist gesamt: <strong>' + fmtH(si.istStunden) +
        "</strong> vs. Soll " + fmtH(si.sollStunden) + " — Abweichung <strong>" + (si.abwProz > 0 ? "+" : "") + si.abwProz + " %</strong></span></div>";
    }

    openModalWide("Auftrag: " + esc(a.titel), body, function () {
      a.status = $("#a-status").value;
      var istZeiten = {};
      var hatIst = false;
      $all("[data-ist]").forEach(function (inp) {
        var v = parseFloat(inp.value);
        if (!isNaN(v) && v > 0) { istZeiten[inp.dataset.ist] = v; hatIst = true; }
      });
      var matNote = $("#a-matnote").value.trim();
      if (hatIst || matNote) {
        a.ist = { zeiten: istZeiten, materialKommentar: matNote, erfasst: Store.nowISO() };
      }
      // Lernen, wenn abgeschlossen + Ist-Zeiten vorhanden
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
    if ($("#btn-auf-druck")) $("#btn-auf-druck").onclick = function () { angebotDrucken(a, a.kalk, a); };
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
    $("#modal-cancel").onclick = close;
    if ($("#modal-ok")) $("#modal-ok").onclick = function () { if (onOk() !== false) close(); };
    if ($("#modal-extra")) $("#modal-extra").onclick = function () { if (onExtra && onExtra() !== false) close(); };
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
  var UPDATE_VERSION_URL = "https://github.com/" + REPO + "/releases/download/app-latest/version.json";

  function pruefeUpdate() {
    if (!w.fetch) return;
    fetch("assets/build-info.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (lokal) {
        if (!lokal || typeof lokal.build !== "number") return; // Web-Vorschau ohne Build-Info
        return fetch(UPDATE_VERSION_URL, { cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (remote) {
            if (remote && typeof remote.build === "number" && remote.build > lokal.build) {
              zeigeUpdateBanner(remote);
            }
          });
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
    $all(".nav li").forEach(function (li) { li.onclick = function () { navTo(li.dataset.page); }; });
    navTo("dashboard");
    pruefeUpdate();
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();
})(window, document);
