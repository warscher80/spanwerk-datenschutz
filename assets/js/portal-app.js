/* ============================================================
   Preisschmiede – Kundenportal-Oberfläche (Phase 12)
   Eigene, mobil-first UI für Kunden. Nutzt ausschließlich die
   bestehenden Engines (Store, Angebot, Portal) und deren Sicher-
   heitslogik. Zeigt NIE interne Kosten/Margen/Kalkulationsdaten.
   Arbeitet je Mandant getrennt (eigener localStorage-Namespace);
   ein Kunde sieht ausschließlich seine eigenen freigegebenen Daten.
   Kein echter E-Mail-Versand, keine qualifizierte E-Signatur.
   ============================================================ */
(function (w, d) {
  "use strict";
  var P = w.Preisschmiede || {};
  var Store = P.Store, Angebot = P.Angebot, Portal = P.Portal, Calc = P.Calc;

  var ANNAHME_ERKLAERUNG = "Ich nehme das oben dargestellte Angebot in der angezeigten Version mit den gewählten Optionen zum genannten Gesamtbetrag verbindlich an. Mir ist bewusst, dass dies eine dokumentierte digitale Zustimmung und keine qualifizierte elektronische Signatur ist.";

  // ---- Zustand -----------------------------------------------------
  var S = { view: "login", tenantId: null, db: null, brand: null, zugang: null, portalUser: null, kundeId: null, angebotId: null, angebot: null, auswahl: { optionen: [], alternativen: {} } };

  // ---- Hilfen ------------------------------------------------------
  function root() { return d.getElementById("portal-root"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function money(n) { try { return Calc && Calc.fmtEUR ? Calc.fmtEUR(n) : (Number(n).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"); } catch (e) { return n + " €"; } }
  function nowISO() { return Store.nowISO(); }
  function fmtDate(iso) { try { return iso ? new Date(iso).toLocaleDateString("de-AT") : "-"; } catch (e) { return "-"; } }
  function fmtDT(iso) { try { return iso ? new Date(iso).toLocaleString("de-AT") : "-"; } catch (e) { return "-"; } }
  function toast(msg, kind) { var t = d.getElementById("portal-toast"); t.textContent = msg; t.className = "pp-toast show " + (kind || ""); clearTimeout(t._tm); t._tm = setTimeout(function () { t.className = "pp-toast"; }, 3000); }

  function tKey(id) { return Store.tenantKeyFor(id); }
  function loadTenant(id) {
    try {
      var raw = w.localStorage.getItem(tKey(id)); if (!raw) return null;
      var db = Store.migrate(JSON.parse(raw));
      (db.portalLinks || []).forEach(function (l) { if (l.mandantId == null) l.mandantId = id; });
      (db.portalNachrichten || []).forEach(function (m) { if (m.mandantId == null) m.mandantId = id; });
      return db;
    } catch (e) { return null; }
  }
  function saveTenant(id, db) { try { w.localStorage.setItem(tKey(id), JSON.stringify(db)); return true; } catch (e) { return false; } }

  // ---- Branding je Mandant ----------------------------------------
  var FARBEN = ["#2b6cb0", "#2f8f5b", "#8a5a2b", "#7a3f9d"];
  function ensureDemoTenants() {
    Store.ladeRegistry();
    var list = Store.mandanten();
    if (list.length < 2) {
      try { Store.neuerMandant({ name: "Edelstahl Berger GmbH", kurzname: "Berger", tarif: "professional", status: "aktiv" }, true); } catch (e) {}
      list = Store.mandanten();
    }
    // Branding-Defaults + realistische Kontaktdaten setzen (nur falls leer)
    var kontakte = [
      { kontakt: "Preisschmiede Metallbau · 9500 Villach · +43 4242 000", support: "support@example.at", fuss: "Metallbau &amp; Schlosserei", datenschutz: "datenschutz.html" },
      { kontakt: "Edelstahl Berger GmbH · 9220 Velden · +43 4274 000", support: "office@berger.example", fuss: "Edelstahl- und Geländerbau", datenschutz: "datenschutz.html" }
    ];
    list.forEach(function (m, i) {
      if (!m.farbe) m.farbe = FARBEN[i % FARBEN.length];
      var k = kontakte[i] || kontakte[0];
      if (!m.kontakt) m.kontakt = i === 0 ? kontakte[0].kontakt : k.kontakt;
      if (!m.support) m.support = k.support;
      if (!m.fuss) m.fuss = k.fuss;
      if (!m.datenschutz) m.datenschutz = "datenschutz.html";
    });
    Store.speichereRegistry();
  }
  function brandFor(tenantId) {
    var m = Store.mandantById(tenantId) || {};
    var b = Portal.branding(m); b.farbe = m.farbe || "#3d7bd6"; return b;
  }
  function applyBrand(brand) {
    d.documentElement.style.setProperty("--brand", brand.farbe || "#3d7bd6");
    try { var mt = d.querySelector('meta[name="theme-color"]'); if (mt) mt.setAttribute("content", brand.farbe || "#3d7bd6"); } catch (e) {}
  }

  // ---- Modal -------------------------------------------------------
  function modal(title, bodyHtml, buttons) {
    var bg = d.getElementById("portal-modal");
    var btns = (buttons || []).map(function (b, i) { return '<button class="pp-btn ' + (b.cls || "") + '" data-mi="' + i + '">' + esc(b.label) + "</button>"; }).join("");
    bg.innerHTML = '<div class="pp-modal"><h3>' + esc(title) + "</h3><div>" + bodyHtml + '</div><div class="pp-btnrow" style="margin-top:16px">' + btns + "</div></div>";
    bg.classList.add("show"); bg.hidden = false;
    function close() { bg.classList.remove("show"); bg.hidden = true; }
    bg.onclick = function (e) { if (e.target === bg) close(); };
    (buttons || []).forEach(function (b, i) {
      var el = bg.querySelector('[data-mi="' + i + '"]'); if (!el) return;
      el.onclick = function () { var r = b.fn ? b.fn() : true; if (r !== false) close(); };
    });
    return { close: close };
  }

  // ---- PDF (Druckfenster, ehrlich – Browser „Als PDF speichern") ----
  function pdfWindow(titel, brand, innerHtml) {
    var wnd = w.open("", "_blank");
    if (!wnd) { toast("Bitte Pop-ups erlauben, um das PDF zu öffnen.", "err"); return; }
    var doc = '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>' + esc(titel) + '</title>' +
      '<style>body{font-family:Arial,Helvetica,sans-serif;color:#1c2530;max-width:800px;margin:24px auto;padding:0 18px;font-size:13px}' +
      'h1{font-size:19px;margin:0 0 4px}.brand{border-bottom:3px solid ' + esc(brand.farbe || "#3d7bd6") + ';padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end;gap:10px}' +
      'table{width:100%;border-collapse:collapse;margin:10px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;font-size:12px}td.num,th.num{text-align:right;white-space:nowrap}' +
      '.tot{display:flex;justify-content:space-between;padding:3px 0}.tot.g{font-weight:700;font-size:15px;border-top:2px solid #333;margin-top:6px;padding-top:8px}' +
      '.muted{color:#667;font-size:11px}.noprint{margin:16px 0}@media print{.noprint{display:none}}</style></head><body>' +
      '<div class="brand"><div><h1>' + esc(brand.name || "") + '</h1><div class="muted">' + esc(brand.kontakt || "") + '</div></div></div>' +
      innerHtml +
      '<div class="noprint"><button onclick="window.print()" style="padding:10px 16px;font-size:14px">🖨️ Drucken / als PDF speichern</button></div>' +
      '<p class="muted">Erstellt über das Kundenportal. Digitale Zustimmung ist keine qualifizierte elektronische Signatur.</p></body></html>';
    wnd.document.open(); wnd.document.write(doc); wnd.document.close();
  }

  // ================================================================
  //  LOGIN / ZUGANG
  // ================================================================
  function renderLogin(preTenantId, tab) {
    S.view = "login";
    var list = Store.mandanten();
    var tid = preTenantId || (list[0] && list[0].id);
    var brand = brandFor(tid); applyBrand(brand);
    var opts = list.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === tid ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("");
    var t = tab || "konto";
    var html = '' +
      '<div class="pp-header"><div class="pp-logo">' + (brand.logo ? '<img src="' + esc(brand.logo) + '">' : esc((brand.name || "P").slice(0, 1))) + '</div>' +
      '<div><div class="pp-firma">' + esc(brand.name || "Kundenportal") + '</div><div class="pp-sub">Kundenportal</div></div></div>' +
      '<div class="pp-wrap">' +
      '<div class="pp-note">Testumgebung – Demo-Zugänge: Konto <strong>' + demoEmail(tid) + '</strong> / Passwort <strong>portal1234</strong> · oder Angebotslink-Token <strong>DEMO-ANGEBOTSLINK</strong>. Es werden keine echten E-Mails versendet.</div>' +
      '<div class="pp-card">' +
      '<label class="pp-field"><span>Firma (Portal-Branding)</span><select id="pp-firma">' + opts + '</select></label>' +
      '<div class="pp-tabs"><button data-tab="konto" class="' + (t === "konto" ? "active" : "") + '">Portal-Konto</button><button data-tab="link" class="' + (t === "link" ? "active" : "") + '">Angebotslink</button></div>';
    if (t === "konto") {
      html += '<label class="pp-field"><span>E-Mail</span><input id="pp-email" type="email" autocomplete="username" placeholder="name@firma.at"></label>' +
        '<label class="pp-field"><span>Passwort</span><input id="pp-pw" type="password" autocomplete="current-password"></label>' +
        '<button class="pp-btn brand full lg" id="pp-login-konto">Anmelden</button>';
    } else {
      html += '<label class="pp-field"><span>Angebotslink-Token</span><input id="pp-token" type="text" placeholder="Token aus Ihrer Einladung"></label>' +
        '<button class="pp-btn ghost full" id="pp-demo-token" type="button">Demo-Token einsetzen</button>' +
        '<button class="pp-btn brand full lg" id="pp-login-link" style="margin-top:10px">Angebot öffnen</button>';
    }
    html += '</div><div class="pp-footer">' + esc(brand.fuss || "") + ' · ' + esc(brand.kontakt || "") + '</div></div>';
    root().innerHTML = html;

    d.getElementById("pp-firma").onchange = function () { renderLogin(this.value, t); };
    Array.prototype.forEach.call(root().querySelectorAll("[data-tab]"), function (b) { b.onclick = function () { renderLogin(d.getElementById("pp-firma").value, b.getAttribute("data-tab")); }; });
    if (d.getElementById("pp-login-konto")) d.getElementById("pp-login-konto").onclick = function () { doAccountLogin(d.getElementById("pp-firma").value, (d.getElementById("pp-email").value || "").trim(), d.getElementById("pp-pw").value); };
    if (d.getElementById("pp-demo-token")) d.getElementById("pp-demo-token").onclick = function () { d.getElementById("pp-token").value = "DEMO-ANGEBOTSLINK"; };
    if (d.getElementById("pp-login-link")) d.getElementById("pp-login-link").onclick = function () { doLinkLogin(d.getElementById("pp-firma").value, (d.getElementById("pp-token").value || "").trim()); };
  }
  function demoEmail(tid) { var db = loadTenant(tid); var u = (db && db.portalUsers || [])[0]; return u ? esc(u.email) : "—"; }

  function doAccountLogin(tenantId, email, pw) {
    var db = loadTenant(tenantId);
    if (!db) { toast("Firma nicht verfügbar.", "err"); return; }
    var u = (db.portalUsers || []).filter(function (x) { return x.email === (email || "").toLowerCase() && x.status !== "gesperrt"; })[0];
    if (!u || !Portal.passwortPruefen(u, pw)) { toast("E-Mail oder Passwort falsch.", "err"); return; }
    u.letzterLogin = nowISO(); saveTenant(tenantId, db);
    S.tenantId = tenantId; S.db = db; S.brand = brandFor(tenantId); S.zugang = "konto"; S.portalUser = u; S.kundeId = u.kundeId; S.angebotId = null;
    applyBrand(S.brand); renderDashboard();
  }
  function doLinkLogin(tenantId, token) {
    var db = loadTenant(tenantId);
    if (!db) { toast("Firma nicht verfügbar.", "err"); return; }
    // Alle Links dieses Mandanten prüfen (nur der zum Token passende öffnet).
    var jetzt = nowISO(), gefunden = null, grund = "kein passender Link";
    (db.portalLinks || []).some(function (l) {
      var r = Portal.linkPruefen(l, token, { mandantId: tenantId, angebotId: l.angebotId }, jetzt);
      if (r.ok) { gefunden = l; return true; } grund = r.grund; return false;
    });
    if (!gefunden) { toast("Zugang nicht möglich: " + grund + ".", "err"); return; }
    Portal.linkVerwenden(gefunden, jetzt); saveTenant(tenantId, db);
    S.tenantId = tenantId; S.db = db; S.brand = brandFor(tenantId); S.zugang = "link"; S.portalUser = null; S.kundeId = gefunden.kundeId; S.angebotId = gefunden.angebotId; S.linkId = gefunden.id;
    applyBrand(S.brand); openAngebot(gefunden.angebotId);
  }
  function logout() { S = { view: "login", tenantId: null, db: null, brand: null, zugang: null, portalUser: null, kundeId: null, angebotId: null, angebot: null, auswahl: { optionen: [], alternativen: {} } }; renderLogin(); }

  // ================================================================
  //  KOPF
  // ================================================================
  function header() {
    var b = S.brand || {};
    var wer = S.portalUser ? esc(S.portalUser.name) : "Angebotszugang";
    return '<div class="pp-header"><div class="pp-logo">' + (b.logo ? '<img src="' + esc(b.logo) + '">' : esc((b.name || "P").slice(0, 1))) + '</div>' +
      '<div><div class="pp-firma">' + esc(b.name || "") + '</div><div class="pp-sub">' + wer + '</div></div><div class="pp-spacer"></div>' +
      '<button class="pp-btn-logout" id="pp-logout">Abmelden</button></div>';
  }
  function wireHeader() { var l = d.getElementById("pp-logout"); if (l) l.onclick = logout; }

  // ================================================================
  //  DASHBOARD (nur Konto-Zugang)
  // ================================================================
  function meineAngebote() {
    return (S.db.angebote || []).filter(function (a) { return a.kundeId === S.kundeId && a.status !== "Entwurf"; });
  }
  function statusGruppe(a) {
    if (a.status === "angenommen") return "angenommen";
    if (a.status === "abgelehnt") return "abgelehnt";
    if (Portal.abgelaufen(a, nowISO())) return "abgelaufen";
    return "offen";
  }
  function renderDashboard() {
    S.view = "dashboard";
    var angebote = meineAngebote();
    var gruppen = { offen: [], angenommen: [], abgelehnt: [], abgelaufen: [] };
    angebote.forEach(function (a) { gruppen[statusGruppe(a)].push(a); });
    function liste(arr, leer) {
      if (!arr.length) return '<div class="pp-muted">' + leer + "</div>";
      return arr.map(function (a) {
        var g = statusGruppe(a); var tag = g === "angenommen" ? "ok" : g === "abgelehnt" ? "err" : g === "abgelaufen" ? "warn" : "info";
        return '<div class="pp-list-item" data-ang="' + esc(a.id) + '"><div class="pp-li-main"><div class="pp-li-titel">' + esc(a.nummer) + " – " + esc(a.betreff || a.bezeichnung || "") + '</div>' +
          '<div class="pp-li-sub">' + esc(a.kommission || "") + " · Stand " + fmtDate(a.geaendert || a.erstellt) + '</div></div><span class="pp-tag ' + tag + '">' + g + '</span></div>';
      }).join("");
    }
    var freigDok = (S.db.dokumentFreigaben || []).filter(function (f) { return Portal.dokumentSichtbar(f, S.portalUser && S.portalUser.ansprechpartnerId, nowISO()); });
    var b = S.brand || {};
    var html = header() + '<div class="pp-wrap">' +
      '<div class="pp-card"><h2>Meine Angebote</h2>' +
      '<h3>Offen (' + gruppen.offen.length + ')</h3>' + liste(gruppen.offen, "Keine offenen Angebote.") +
      (gruppen.angenommen.length ? '<h3 style="margin-top:12px">Angenommen</h3>' + liste(gruppen.angenommen, "") : "") +
      (gruppen.abgelehnt.length ? '<h3 style="margin-top:12px">Abgelehnt</h3>' + liste(gruppen.abgelehnt, "") : "") +
      (gruppen.abgelaufen.length ? '<h3 style="margin-top:12px">Abgelaufen</h3>' + liste(gruppen.abgelaufen, "") : "") +
      '</div>' +
      '<div class="pp-card"><div class="pp-btnrow" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Zeichnungen &amp; Dokumente</h2><button class="pp-btn brand" id="pp-open-dok" type="button">Öffnen ›</button></div>' +
      '<div class="pp-muted" style="margin-top:6px">' + meineZeichnungen().length + ' freigegebene Zeichnung(en) · ' + meineUploads().length + ' eigene(r) Upload(s)</div></div>' +
      meineRechnungenHtml() +
      '<div class="pp-footer">' + esc(b.name || "") + ' · ' + esc(b.kontakt || "") + ' · <a href="' + esc(b.datenschutz || "datenschutz.html") + '">Datenschutz</a></div></div>';
    root().innerHTML = html; wireHeader();
    Array.prototype.forEach.call(root().querySelectorAll("[data-ang]"), function (li) { li.onclick = function () { openAngebot(li.getAttribute("data-ang")); }; });
    if (d.getElementById("pp-open-dok")) d.getElementById("pp-open-dok").onclick = function () { renderDokumente("dashboard"); };
    Array.prototype.forEach.call(root().querySelectorAll("[data-repdf]"), function (bt) { bt.onclick = function () { rechnungPdfKunde(bt.getAttribute("data-repdf")); }; });
  }

  // Nur ausdrücklich freigegebene UND fürs Portal sichtbare Rechnungen (Phase 13B).
  function meineRechnungen() {
    var R = P.Rechnung; if (!R) return [];
    return (S.db.rechnungen || []).filter(function (b) { return b.freigegeben && b.portalSichtbar && b.kundeId === S.kundeId; });
  }
  function meineRechnungenHtml() {
    var R = P.Rechnung; if (!R) return "";
    var res = meineRechnungen();
    var html = '<div class="pp-card"><h2>Meine Rechnungen</h2>';
    html += res.length ? res.map(function (b) {
      var s = R.belegSummen(b); var tag = b.zahlungstatus === "bezahlt" ? "ok" : b.zahlungstatus === "überfällig" ? "err" : "info";
      return '<div class="pp-list-item" style="cursor:default"><div class="pp-li-main"><div class="pp-li-titel">' + esc(b.nummer) + " · " + esc(b.art) + '</div>' +
        '<div class="pp-li-sub">' + esc(b.kommission || "") + " · " + fmtDate(b.rechnungsdatum) + (b.faelligkeit ? " · fällig " + fmtDate(b.faelligkeit) : "") + " · " + money(s.brutto) + '</div></div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end"><span class="pp-tag ' + tag + '">' + esc(b.zahlungstatus) + '</span><button class="pp-btn" style="min-height:34px;padding:6px 10px;font-size:13px" data-repdf="' + esc(b.id) + '">PDF</button></div></div>';
    }).join("") : '<div class="pp-muted">Aktuell sind keine Rechnungen für Sie freigegeben.</div>';
    html += '<div class="pp-muted" style="margin-top:6px">Es werden keine internen Kalkulations- oder Kostendaten angezeigt.</div></div>';
    return html;
  }
  function rechnungPdfKunde(belegId) {
    var R = P.Rechnung; var b = meineRechnungen().filter(function (x) { return x.id === belegId; })[0];
    if (!b) { toast("Rechnung nicht verfügbar.", "err"); return; }
    var s = R.belegSummen(b);
    var rows = (b.positionen || []).map(function (p) { return "<tr><td>" + esc(p.bezeichnung) + '</td><td class="num">' + p.menge + " " + esc(p.einheit || "") + '</td><td class="num">' + money(p.einzelpreis) + '</td><td class="num">' + money(R.posNetto(p)) + "</td></tr>"; }).join("");
    var inner = '<h2 style="font-size:16px">' + esc(b.art) + " " + esc(b.nummer) + '</h2><div class="muted">Kommission ' + esc(b.kommission || "-") + " · Datum " + esc(fmtDate(b.rechnungsdatum)) + (b.faelligkeit ? " · fällig " + esc(fmtDate(b.faelligkeit)) : "") + '</div>' +
      '<table><thead><tr><th>Leistung</th><th class="num">Menge</th><th class="num">Einzel</th><th class="num">Netto</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      '<div style="max-width:320px;margin-left:auto">' + s.steuerZeilen.map(function (z) { return '<div class="tot"><span>USt ' + z.satz + "%</span><span>" + money(z.steuer) + "</span></div>"; }).join("") +
      '<div class="tot"><span>Netto</span><span>' + money(s.netto) + '</span></div><div class="tot g"><span>Brutto</span><span>' + money(s.brutto) + "</span></div>" +
      (R.TEILARTEN.concat(["Schlussrechnung"]).indexOf(b.art) >= 0 ? '<div class="tot"><span>offen</span><span>' + money(R.offenerBetrag(b)) + "</span></div>" : "") + "</div>";
    pdfWindow(b.art + " " + b.nummer, S.brand, inner);
  }

  // ================================================================
  //  ANGEBOTSANSICHT
  // ================================================================
  function findAngebot(id) { return (S.db.angebote || []).filter(function (a) { return a.id === id; })[0]; }
  function angebotCtx() {
    var kunde = (S.db.kunden || []).filter(function (k) { return k.id === S.kundeId; })[0] || {};
    return {
      firma: { name: S.brand.name, kontakt: S.brand.kontakt }, kunde: { name: kunde.name, ansprechpartner: kunde.ansprechpartner },
      datum: fmtDate(S.angebot && S.angebot.erstellt), gueltigBis: fmtDate(S.angebot && S.angebot.gueltigBisISO),
      fmtEUR: money, jetztISO: nowISO(), mandantId: S.tenantId
    };
  }
  function openAngebot(id) {
    var a = findAngebot(id);
    // Zugriffsschutz: nur eigenes, freigegebenes Angebot; Link nur sein Angebot.
    if (!a || a.kundeId !== S.kundeId) { toast("Angebot nicht verfügbar.", "err"); if (S.zugang === "konto") renderDashboard(); return; }
    if (S.zugang === "link" && S.angebotId && a.id !== S.angebotId) { toast("Dieser Link gilt für ein anderes Angebot.", "err"); return; }
    if (!Portal.istFreigegeben(a)) { toast("Dieses Angebot ist (noch) nicht freigegeben.", "err"); if (S.zugang === "konto") renderDashboard(); return; }
    S.angebot = a; S.angebotId = a.id;
    // vorhandene Aktivierung übernehmen (keine Vorselektion von Optionen)
    S.auswahl = { optionen: [], alternativen: {} };
    renderAngebot();
  }
  function renderAngebot() {
    S.view = "angebot"; var a = S.angebot; var ctx = angebotCtx();
    var out = Portal.kundenAngebot(a, ctx);
    if (!out || out.fehler) { toast("Angebot kann nicht sicher angezeigt werden.", "err"); return; }
    var abgelaufen = out.abgelaufen, angenommen = a.status === "angenommen", ersetzt = out.ersetzt;
    var back = S.zugang === "konto" ? '<button class="pp-btn ghost" id="pp-back">‹ Übersicht</button>' : "";
    var pos = out.positionen || [];
    // Positionen nach Art
    var fest = pos.filter(function (p) { return !p.optional && !p.alternativ && p.gesamtpreis != null; });
    var strukturLose = pos.filter(function (p) { return !p.optional && !p.alternativ && p.gesamtpreis == null && (p.kurz || p.beschreibung); });
    var optionen = pos.filter(function (p) { return p.optional; });
    var altGruppen = {};
    pos.filter(function (p) { return p.alternativ; }).forEach(function (p) { var g = grpOf(a, p.nummer); (altGruppen[g] = altGruppen[g] || []).push(p); });

    var html = header() + '<div class="pp-wrap">' + (back ? '<div class="pp-noprint" style="margin-bottom:10px">' + back + "</div>" : "") +
      (angenommen ? '<div class="pp-note" style="background:#e4f6ea;border-color:#bfe6cd;color:#1f7a3d">Dieses Angebot wurde bereits angenommen.</div>' : "") +
      (ersetzt ? '<div class="pp-note">Dieses Angebot wurde durch eine neuere Version ersetzt.</div>' : "") +
      (abgelaufen && !angenommen ? '<div class="pp-note">Die Gültigkeit dieses Angebots ist abgelaufen. Bitte fordern Sie bei Bedarf eine Verlängerung an.</div>' : "") +
      '<div class="pp-card"><h2>' + esc(out.nummer) + " – " + esc(out.betreff || "") + '</h2>' +
      '<div class="pp-muted">Version ' + esc(out.version) + " · Kommission " + esc(out.kommission || "-") + " · Projekt " + esc(out.projekt || "-") + '</div>' +
      '<div class="pp-muted">Datum ' + esc(out.datum) + " · Gültig bis " + esc(out.gueltigBis || "-") + '</div>' +
      (out.einleitung ? '<p style="margin-top:10px">' + esc(out.einleitung) + "</p>" : "") + '</div>';

    // Verbindliche Positionen
    html += '<div class="pp-card"><h3>Leistungen</h3>';
    strukturLose.concat(fest).forEach(function (p) { html += posZeile(p, null); });
    html += "</div>";

    // Optionale Positionen
    if (optionen.length) {
      html += '<div class="pp-card"><h3>Optionale Positionen</h3><div class="pp-muted" style="margin-bottom:6px">Optionen sind nicht vorausgewählt. Wählen Sie, was Sie wünschen.</div>';
      optionen.forEach(function (p) { html += posZeile(p, "opt"); });
      html += "</div>";
    }
    // Alternativgruppen
    Object.keys(altGruppen).forEach(function (g) {
      html += '<div class="pp-card"><h3>Alternative: ' + esc(g) + '</h3><div class="pp-muted" style="margin-bottom:6px">Bitte höchstens eine Variante wählen.</div>';
      html += '<label class="pp-pos"><input type="radio" name="alt-' + esc(g) + '" value="" checked data-altnone="' + esc(g) + '"><div class="pp-pos-main"><div class="pp-pos-titel">Keine dieser Varianten</div></div></label>';
      altGruppen[g].forEach(function (p) { html += posZeile(p, "alt:" + g); });
      html += "</div>";
    });

    // Summen (server-seitig berechnet)
    html += '<div class="pp-card" id="pp-summen">' + summenHtml(Portal.neuberechnung(a, S.auswahl)) + '</div>';

    // Konditionen
    html += '<div class="pp-card"><h3>Konditionen</h3>' +
      kv("Zahlungsbedingungen", out.zahlungsbedingungen) + kv("Lieferbedingungen", out.lieferbedingungen) +
      kv("Ausführungszeit", out.ausfuehrungszeitraum) + kv("Nicht enthalten", out.ausschluesse) + '</div>';

    // Aktionen
    html += '<div class="pp-card pp-noprint"><div class="pp-btnrow">' +
      '<button class="pp-btn" id="pp-pdf">📄 Angebot als PDF</button>' +
      '<button class="pp-btn" id="pp-frage">✉️ Frage stellen</button>' +
      '<button class="pp-btn" id="pp-dok">📁 Zeichnungen &amp; Uploads</button></div>' +
      (angenommen || ersetzt ? "" : '<div class="pp-btnrow" style="margin-top:10px"><button class="pp-btn danger" id="pp-ablehnen">Ablehnen</button><button class="pp-btn brand lg" id="pp-annehmen"' + (abgelaufen ? " disabled" : "") + '>Angebot annehmen</button></div>') +
      '</div>';

    // Nachrichten
    var msgs = Portal.nachrichtenFuerKunde(S.db.portalNachrichten || [], a.id, S.kundeId);
    html += '<div class="pp-card"><h3>Fragen &amp; Nachrichten</h3>' + (msgs.length ? msgs.map(function (m) { return '<div class="pp-msg"><div>' + esc(m.text) + '</div><div class="pp-msg-meta">' + esc(m.absender || "Kunde") + " · " + fmtDT(m.zeitpunkt) + " · " + esc(m.status) + "</div></div>"; }).join("") : '<div class="pp-muted">Noch keine Nachrichten.</div>') + '</div>';

    html += '<div class="pp-footer">' + esc(S.brand.name || "") + " · " + esc(S.brand.kontakt || "") + "</div></div>";
    root().innerHTML = html; wireHeader();

    if (d.getElementById("pp-back")) d.getElementById("pp-back").onclick = renderDashboard;
    // Auswahl-Interaktion
    Array.prototype.forEach.call(root().querySelectorAll("[data-optnr]"), function (cb) { cb.onchange = function () { setzeOption(cb.getAttribute("data-optnr"), cb.checked); }; });
    Array.prototype.forEach.call(root().querySelectorAll("[data-altnr]"), function (rb) { rb.onchange = function () { if (rb.checked) setzeAlternative(rb.getAttribute("data-altgrp"), rb.getAttribute("data-altnr")); }; });
    Array.prototype.forEach.call(root().querySelectorAll("[data-altnone]"), function (rb) { rb.onchange = function () { if (rb.checked) setzeAlternative(rb.getAttribute("data-altnone"), null); }; });
    if (d.getElementById("pp-pdf")) d.getElementById("pp-pdf").onclick = angebotPdf;
    if (d.getElementById("pp-frage")) d.getElementById("pp-frage").onclick = frageStellen;
    if (d.getElementById("pp-dok")) d.getElementById("pp-dok").onclick = function () { renderDokumente("angebot"); };
    if (d.getElementById("pp-annehmen")) d.getElementById("pp-annehmen").onclick = annahmeDialog;
    if (d.getElementById("pp-ablehnen")) d.getElementById("pp-ablehnen").onclick = ablehnenDialog;
  }
  function grpOf(a, nummer) { var p = (a.positionen || []).filter(function (x) { return x.nummer === nummer; })[0]; return (p && p.gruppe) || "Variante"; }
  function kv(l, v) { return v ? '<div style="margin-bottom:6px"><div class="pp-muted">' + esc(l) + '</div><div>' + esc(v) + "</div></div>" : ""; }
  function posZeile(p, mode) {
    var control = "";
    if (mode === "opt") control = '<input type="checkbox" data-optnr="' + esc(p.nummer) + '">';
    else if (mode && mode.indexOf("alt:") === 0) { var g = mode.slice(4); control = '<input type="radio" name="alt-' + esc(g) + '" data-altgrp="' + esc(g) + '" data-altnr="' + esc(p.nummer) + '">'; }
    var preis = p.gesamtpreis != null ? money(p.gesamtpreis) : "";
    return '<label class="pp-pos">' + control + '<div class="pp-pos-main"><div class="pp-pos-titel">' + esc(p.kurz || "") + '</div>' +
      (p.beschreibung ? '<div class="pp-pos-beschr">' + esc(p.beschreibung) + "</div>" : "") +
      (p.menge != null && p.einzelpreis != null ? '<div class="pp-muted">' + esc(p.menge) + " " + esc(p.einheit || "") + " × " + money(p.einzelpreis) + "</div>" : "") +
      '</div><div class="pp-pos-preis">' + preis + "</div></label>";
  }
  function summenHtml(s) {
    var zeilen = '<div class="pp-summe"><span>Zwischensumme</span><span>' + money(s.zwischensumme) + "</span></div>";
    if (s.rabatt) zeilen += '<div class="pp-summe"><span>Rabatt</span><span>-' + money(s.rabatt) + "</span></div>";
    zeilen += '<div class="pp-summe"><span>Netto</span><span>' + money(s.netto) + "</span></div>";
    (s.steuerZeilen || []).forEach(function (z) { zeilen += '<div class="pp-summe"><span>USt ' + esc(z.satz) + "%</span><span>" + money(z.steuer) + "</span></div>"; });
    zeilen += '<div class="pp-summe gross"><span>Gesamt (brutto)</span><span>' + money(s.brutto) + "</span></div>";
    return '<h3>Gesamtsumme</h3>' + zeilen + '<div class="pp-muted" style="margin-top:6px">Die Summe wird bei jeder Auswahl neu berechnet.</div>';
  }
  function refreshSummen() { var box = d.getElementById("pp-summen"); if (box) box.innerHTML = summenHtml(Portal.neuberechnung(S.angebot, S.auswahl)); }
  function setzeOption(nr, an) { var i = S.auswahl.optionen.indexOf(nr); if (an && i < 0) S.auswahl.optionen.push(nr); else if (!an && i >= 0) S.auswahl.optionen.splice(i, 1); refreshSummen(); }
  function setzeAlternative(grp, nr) { if (nr) S.auswahl.alternativen[grp] = nr; else delete S.auswahl.alternativen[grp]; refreshSummen(); }

  // ---- PDF: Angebot ------------------------------------------------
  function angebotPdf() {
    var out = Portal.kundenAngebot(Portal.auswahlAnwenden(S.angebot, S.auswahl), angebotCtx());
    var s = out.summen;
    var rows = (out.positionen || []).filter(function (p) { return p.gesamtpreis != null && (!p.optional && !p.alternativ || p.aktiviert); }).map(function (p) {
      return "<tr><td>" + esc(p.kurz || "") + (p.beschreibung ? '<br><span class="muted">' + esc(p.beschreibung) + "</span>" : "") + "</td><td class='num'>" + (p.menge != null ? esc(p.menge) + " " + esc(p.einheit || "") : "") + "</td><td class='num'>" + (p.einzelpreis != null ? money(p.einzelpreis) : "") + "</td><td class='num'>" + money(p.gesamtpreis) + "</td></tr>";
    }).join("");
    var inner = '<h2 style="font-size:16px">Angebot ' + esc(out.nummer) + " – Version " + esc(out.version) + '</h2>' +
      '<div class="muted">' + esc(out.betreff || "") + " · Kommission " + esc(out.kommission || "-") + " · Datum " + esc(out.datum) + " · gültig bis " + esc(out.gueltigBis || "-") + '</div>' +
      '<table><thead><tr><th>Leistung</th><th class="num">Menge</th><th class="num">Einzel</th><th class="num">Gesamt</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      '<div style="max-width:320px;margin-left:auto">' +
      '<div class="tot"><span>Netto</span><span>' + money(s.netto) + "</span></div>" +
      (s.steuerZeilen || []).map(function (z) { return '<div class="tot"><span>USt ' + esc(z.satz) + "%</span><span>" + money(z.steuer) + "</span></div>"; }).join("") +
      '<div class="tot g"><span>Gesamt</span><span>' + money(s.brutto) + "</span></div></div>" +
      (out.zahlungsbedingungen ? '<p class="muted">Zahlung: ' + esc(out.zahlungsbedingungen) + "</p>" : "");
    pdfWindow("Angebot " + out.nummer, S.brand, inner);
  }

  // ---- Frage stellen ----------------------------------------------
  function frageStellen() {
    modal("Frage zum Angebot", '<label class="pp-field"><span>Ihre Nachricht</span><textarea id="pp-fragetext" rows="4" placeholder="Ihre Frage an den Anbieter …"></textarea></label>', [
      { label: "Abbrechen", cls: "ghost" },
      { label: "Senden", cls: "brand", fn: function () {
        var txt = (d.getElementById("pp-fragetext").value || "").trim(); if (!txt) { toast("Bitte Text eingeben.", "err"); return false; }
        var m = Portal.nachrichtNeu({ angebotId: S.angebot.id, mandantId: S.tenantId, kundeId: S.kundeId, absender: (S.portalUser && S.portalUser.name) || "Kunde", empfaenger: "Vertrieb", text: txt, kundeSichtbar: true, intern: false }, nowISO());
        (S.db.portalNachrichten = S.db.portalNachrichten || []).push(m);
        (S.db.portalEreignisse = S.db.portalEreignisse || []).push(Portal.ereignis({ typ: "frage_gestellt", mandantId: S.tenantId, kundeId: S.kundeId, angebotId: S.angebot.id, text: "Neue Kundenfrage" }, nowISO()));
        saveTenant(S.tenantId, S.db); toast("Nachricht gesendet."); renderAngebot(); return true;
      } }
    ]);
  }

  // ---- Annahme -----------------------------------------------------
  function annahmeDialog() {
    var a = S.angebot;
    if (!Portal.auswahlGueltig(a, S.auswahl)) { toast("Ungültige Auswahl.", "err"); return; }
    var pruef = Portal.annahmePruefen(a, S.portalUser, S.auswahl, nowISO());
    if (!pruef.ok) { toast("Annahme nicht möglich: " + pruef.grund + ".", "err"); return; }
    var s = Portal.neuberechnung(a, S.auswahl);
    var optTxt = (S.auswahl.optionen || []).map(function (nr) { return posName(a, nr); }).concat(Object.keys(S.auswahl.alternativen).map(function (g) { return posName(a, S.auswahl.alternativen[g]); })).filter(Boolean);
    var body = '<div class="pp-muted">Angebot ' + esc(a.nummer) + " · Version " + esc(a.version) + '</div>' +
      '<div class="pp-summe gross" style="margin:8px 0"><span>Verbindliche Gesamtsumme</span><span>' + money(s.brutto) + "</span></div>" +
      '<div class="pp-muted">Netto ' + money(s.netto) + " · USt " + money(s.mwst) + "</div>" +
      (optTxt.length ? '<div style="margin:8px 0"><strong>Gewählte Optionen:</strong><br>' + optTxt.map(esc).join("<br>") + "</div>" : '<div class="pp-muted" style="margin:8px 0">Keine optionalen Positionen gewählt.</div>') +
      '<label class="pp-field"><span>Name der annehmenden Person *</span><input id="pp-an-name" value="' + esc((S.portalUser && S.portalUser.name) || "") + '"></label>' +
      '<label class="pp-field"><span>E-Mail *</span><input id="pp-an-email" type="email" value="' + esc((S.portalUser && S.portalUser.email) || "") + '"></label>' +
      '<label class="pp-field"><span>Funktion (optional)</span><input id="pp-an-funktion"></label>' +
      '<label class="pp-field"><span>Bestellnummer (optional)</span><input id="pp-an-bestellnr"></label>' +
      '<label class="pp-field"><span>Kommentar (optional)</span><textarea id="pp-an-kommentar" rows="2"></textarea></label>' +
      '<label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;margin:8px 0"><input type="checkbox" id="pp-an-zustimmung" style="width:22px;height:22px"><span>' + esc(ANNAHME_ERKLAERUNG) + "</span></label>";
    modal("Angebot verbindlich annehmen", body, [
      { label: "Abbrechen", cls: "ghost" },
      { label: "Verbindlich annehmen", cls: "brand", fn: function () {
        var name = (d.getElementById("pp-an-name").value || "").trim();
        var email = (d.getElementById("pp-an-email").value || "").trim();
        if (!name || !email) { toast("Name und E-Mail sind Pflicht.", "err"); return false; }
        if (!d.getElementById("pp-an-zustimmung").checked) { toast("Bitte der Annahmeerklärung zustimmen.", "err"); return false; }
        var ctx = { mandantId: S.tenantId, name: name, email: email, funktion: (d.getElementById("pp-an-funktion").value || ""), bestellnummer: (d.getElementById("pp-an-bestellnr").value || ""), kommentar: (d.getElementById("pp-an-kommentar").value || ""), zeitzone: "Europe/Vienna", portalUser: S.portalUser, linkId: S.linkId || null, firma: { name: S.brand.name }, kunde: {}, datum: fmtDate(a.erstellt), gueltigBis: fmtDate(a.gueltigBisISO) };
        var res = Portal.annahmeProtokoll(a, ctx, S.auswahl, ANNAHME_ERKLAERUNG, nowISO());
        if (!res.ok) { toast("Annahme abgelehnt: " + res.grund, "err"); return false; }
        // Persistieren + Angebotsstatus setzen (freigegebene Version bleibt erhalten)
        (S.db.portalProtokolle = S.db.portalProtokolle || []).push(res.protokoll);
        a.status = "angenommen"; a.geaendert = nowISO();
        (a.statusVerlauf = a.statusVerlauf || []).push({ datum: nowISO(), von: "freigegeben", zu: "angenommen", benutzer: "Kundenportal", notiz: "Digitale Annahme (" + res.protokoll.transaktionsId.slice(0, 8) + ")" });
        (S.db.portalEreignisse = S.db.portalEreignisse || []).push(Portal.ereignis({ typ: "angebot_angenommen", mandantId: S.tenantId, kundeId: S.kundeId, angebotId: a.id, text: "Angebot angenommen" }, nowISO()));
        saveTenant(S.tenantId, S.db);
        renderBestaetigung(res.protokoll); return true;
      } }
    ]);
  }
  function posName(a, nr) { var p = (a.positionen || []).filter(function (x) { return x.nummer === nr; })[0]; return p ? (p.kurz || ("Position " + nr)) : null; }

  // ---- Ablehnung ---------------------------------------------------
  function ablehnenDialog() {
    var opts = Portal.ABLEHNGRUENDE.map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + "</option>"; }).join("");
    modal("Angebot ablehnen", '<label class="pp-field"><span>Grund (optional)</span><select id="pp-ab-grund"><option value="">— keine Angabe —</option>' + opts + '</select></label><label class="pp-field"><span>Kommentar (optional)</span><textarea id="pp-ab-kommentar" rows="3"></textarea></label>', [
      { label: "Abbrechen", cls: "ghost" },
      { label: "Angebot ablehnen", cls: "danger", fn: function () {
        var res = Portal.ablehnung(S.angebot, { mandantId: S.tenantId, name: (S.portalUser && S.portalUser.name) || "Kunde" }, d.getElementById("pp-ab-grund").value || "keine Angabe", d.getElementById("pp-ab-kommentar").value || "", nowISO());
        if (!res.ok) { toast("Ablehnung nicht möglich: " + res.grund, "err"); return false; }
        (S.db.portalProtokolle = S.db.portalProtokolle || []).push(res.protokoll);
        S.angebot.status = "abgelehnt"; S.angebot.geaendert = nowISO();
        (S.db.portalEreignisse = S.db.portalEreignisse || []).push(Portal.ereignis({ typ: "angebot_abgelehnt", mandantId: S.tenantId, kundeId: S.kundeId, angebotId: S.angebot.id, text: "Angebot abgelehnt" }, nowISO()));
        saveTenant(S.tenantId, S.db);
        toast("Angebot abgelehnt. Vielen Dank für Ihre Rückmeldung.");
        if (S.zugang === "konto") renderDashboard(); else renderAngebot(); return true;
      } }
    ]);
  }

  // ---- Bestätigungsansicht + PDF ----------------------------------
  function renderBestaetigung(protokoll) {
    S.view = "bestaetigung";
    var best = Portal.bestaetigungsDokument(protokoll, { name: S.brand.name }, nowISO());
    var html = header() + '<div class="pp-wrap"><div class="pp-card" style="border-top:4px solid var(--brand)">' +
      '<h2>✅ Angebot angenommen</h2><div class="pp-muted">Vielen Dank. Ihre Annahme wurde dokumentiert.</div>' +
      '<div style="margin-top:12px">' +
      row("Angebot", protokoll.angebotNr + " · Version " + protokoll.angebotVersion) +
      row("Verbindliche Summe", money(protokoll.brutto) + " (brutto)") +
      row("Angenommen von", protokoll.annehmenderName) +
      row("Zeitpunkt", fmtDT(protokoll.zeitpunkt)) +
      row("Dokumentkennung", best.dokumentkennung) +
      row("Transaktions-ID", protokoll.transaktionsId.slice(0, 12)) +
      "</div>" +
      '<div class="pp-btnrow pp-noprint" style="margin-top:14px"><button class="pp-btn brand lg" id="pp-best-pdf">📄 Bestätigungs-PDF</button>' + (S.zugang === "konto" ? '<button class="pp-btn ghost" id="pp-best-back">Zur Übersicht</button>' : "") + "</div>" +
      '<div class="pp-muted" style="margin-top:10px">Dies ist eine dokumentierte digitale Zustimmung, keine qualifizierte elektronische Signatur.</div>' +
      '</div><div class="pp-footer">' + esc(S.brand.name || "") + "</div></div>";
    root().innerHTML = html; wireHeader();
    d.getElementById("pp-best-pdf").onclick = function () { bestaetigungPdf(protokoll, best); };
    if (d.getElementById("pp-best-back")) d.getElementById("pp-best-back").onclick = renderDashboard;
  }
  function row(l, v) { return '<div class="pp-summe"><span class="pp-muted">' + esc(l) + '</span><span>' + esc(v) + "</span></div>"; }
  function bestaetigungPdf(protokoll, best) {
    var inner = '<h2 style="font-size:16px">Auftrags-/Annahmebestätigung</h2>' +
      '<div class="muted">' + esc(best.dokumentkennung) + "</div>" +
      "<table><tbody>" +
      "<tr><td>Angebot</td><td class='num'>" + esc(protokoll.angebotNr) + " · Version " + esc(protokoll.angebotVersion) + "</td></tr>" +
      "<tr><td>Verbindliche Summe (brutto)</td><td class='num'>" + money(protokoll.brutto) + "</td></tr>" +
      "<tr><td>Netto / USt</td><td class='num'>" + money(protokoll.netto) + " / " + money(protokoll.mwst) + "</td></tr>" +
      "<tr><td>Angenommen von</td><td class='num'>" + esc(protokoll.annehmenderName) + "</td></tr>" +
      "<tr><td>Zeitpunkt</td><td class='num'>" + esc(fmtDT(protokoll.zeitpunkt)) + " (" + esc(protokoll.zeitzone) + ")</td></tr>" +
      "<tr><td>Transaktions-ID</td><td class='num'>" + esc(protokoll.transaktionsId) + "</td></tr>" +
      "<tr><td>PDF-Prüfsumme</td><td class='num'>" + esc((protokoll.pdfPruefsumme || "").slice(0, 16)) + "</td></tr>" +
      "</tbody></table>" +
      '<p>' + esc(protokoll.erklaerung) + "</p>";
    pdfWindow("Bestätigung " + protokoll.angebotNr, S.brand, inner);
  }

  // ================================================================
  //  DOKUMENTE: Zeichnungsfreigabe + Kundenuploads (Phase 12B)
  // ================================================================
  function meineZeichnungen() {
    return (S.db.zeichnungsFreigaben || []).filter(function (z) {
      return z.kundeId === S.kundeId && Portal.zeichnungSichtbar(z, S.portalUser && S.portalUser.ansprechpartnerId, nowISO());
    });
  }
  function meineUploads() {
    return (S.db.kundenUploads || []).filter(function (u) { return u.kundeId === S.kundeId; });
  }
  function zeichnungTag(status) {
    var c = status === "freigegeben" ? "ok" : status === "Änderung verlangt" ? "warn" : status === "ersetzt" ? "err" : "info";
    return '<span class="pp-tag ' + c + '">' + esc(status) + "</span>";
  }
  function renderDokumente(zurueck) {
    S.view = "dokumente";
    var zeich = meineZeichnungen();
    var uploads = meineUploads();
    var back = zurueck === "angebot" && S.angebot ? '<button class="pp-btn ghost" id="pp-dok-back">‹ Zurück zum Angebot</button>' : '<button class="pp-btn ghost" id="pp-dok-back">‹ Übersicht</button>';
    var html = header() + '<div class="pp-wrap"><div class="pp-noprint" style="margin-bottom:10px">' + back + "</div>";

    // Zeichnungsübersicht
    html += '<div class="pp-card"><h2>Zeichnungen zur Freigabe</h2><div class="pp-muted" style="margin-bottom:6px">Sie sehen ausschließlich ausdrücklich für Sie freigegebene Zeichnungen.</div>';
    html += zeich.length ? zeich.map(function (z) {
      return '<div class="pp-list-item" data-zeich="' + esc(z.id) + '"><div class="pp-li-main"><div class="pp-li-titel">Zeichnung ' + esc(z.zeichnungsnummer) + " · Rev. " + esc(z.revision) + '</div>' +
        '<div class="pp-li-sub">' + esc(z.titel || "") + " · " + fmtDate(z.datum) + '</div></div>' + zeichnungTag(z.status) + "</div>";
    }).join("") : '<div class="pp-muted">Derzeit sind keine Zeichnungen für Sie freigegeben.</div>';
    html += "</div>";

    // Uploads
    html += '<div class="pp-card"><div class="pp-btnrow" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Meine Uploads</h2><button class="pp-btn brand" id="pp-upload-neu" type="button">＋ Datei hochladen</button></div>';
    html += uploads.length ? uploads.map(function (u) {
      var tag = u.technischFreigegeben ? '<span class="pp-tag ok">freigegeben</span>' : u.pruefStatus === "abgelehnt" ? '<span class="pp-tag err">abgelehnt</span>' : '<span class="pp-tag warn">' + esc(u.pruefStatus) + "</span>";
      return '<div class="pp-list-item" style="cursor:default"><div class="pp-li-main"><div class="pp-li-titel">' + esc(u.dateiname) + '</div>' +
        '<div class="pp-li-sub">' + esc(u.typ || "") + " · " + esc(u.kommission || u.projekt || "") + " · " + Math.round((u.groesse || 0) / 1024) + " kB · " + fmtDT(u.hochgeladen) + '</div></div>' + tag + "</div>";
    }).join("") : '<div class="pp-muted" style="margin-top:8px">Noch keine Uploads. Sie können z. B. Bestellunterlagen, Fotos oder freigegebene Zeichnungen hochladen.</div>';
    html += '<div class="pp-muted" style="margin-top:8px">Hochgeladene Dateien werden intern geprüft. Sie gelten nicht automatisch als technisch freigegeben.</div></div>';

    html += '<div class="pp-footer">' + esc(S.brand.name || "") + " · " + esc(S.brand.kontakt || "") + "</div></div>";
    root().innerHTML = html; wireHeader();
    d.getElementById("pp-dok-back").onclick = function () { if (zurueck === "angebot" && S.angebot) renderAngebot(); else renderDashboard(); };
    Array.prototype.forEach.call(root().querySelectorAll("[data-zeich]"), function (li) { li.onclick = function () { renderZeichnung(li.getAttribute("data-zeich"), zurueck); }; });
    if (d.getElementById("pp-upload-neu")) d.getElementById("pp-upload-neu").onclick = function () { uploadDialog(zurueck); };
  }

  function findDokument(id) { return (S.db.dokumente || []).filter(function (x) { return x.id === id; })[0]; }
  function renderZeichnung(freigabeId, zurueck) {
    var z = (S.db.zeichnungsFreigaben || []).filter(function (x) { return x.id === freigabeId; })[0];
    if (!z || z.kundeId !== S.kundeId || !Portal.zeichnungSichtbar(z, S.portalUser && S.portalUser.ansprechpartnerId, nowISO())) { toast("Zeichnung nicht verfügbar.", "err"); renderDokumente(zurueck); return; }
    var dok = z.dokumentId ? findDokument(z.dokumentId) : null;
    var ersetzt = z.status === "ersetzt" || z.aktuell === false;
    var freigegeben = z.status === "freigegeben";
    var entsch = (z.entscheidungen || []);
    var html = header() + '<div class="pp-wrap"><div class="pp-noprint" style="margin-bottom:10px"><button class="pp-btn ghost" id="pp-z-back">‹ Zeichnungen</button></div>' +
      (ersetzt ? '<div class="pp-note">Diese Revision wurde durch eine neuere Version ersetzt. Eine Freigabe ist nicht mehr möglich.</div>' : "") +
      '<div class="pp-card"><h2>Zeichnung ' + esc(z.zeichnungsnummer) + " · Revision " + esc(z.revision) + '</h2>' +
      '<div class="pp-muted">' + esc(z.titel || "") + " · Datum " + fmtDate(z.datum) + '</div><div style="margin-top:6px">' + zeichnungTag(z.status) + "</div>" +
      '<div class="pp-btnrow" style="margin-top:12px">' + (dok && dok.inhalt ? '<button class="pp-btn" id="pp-z-open">📄 Öffnen / Herunterladen</button>' : '<button class="pp-btn" id="pp-z-open" disabled>Keine Datei hinterlegt</button>') + '</div></div>';

    if (!ersetzt && !freigegeben) {
      html += '<div class="pp-card pp-noprint"><h3>Ihre Entscheidung</h3><div class="pp-muted" style="margin-bottom:8px">Bitte prüfen Sie die Zeichnung. Ihre Rückmeldung ist eine dokumentierte Zustimmung, keine qualifizierte elektronische Signatur und ersetzt keine technische/statische Prüfung.</div>' +
        '<div class="pp-btnrow"><button class="pp-btn danger" id="pp-z-aenderung">Änderung erforderlich</button><button class="pp-btn brand lg" id="pp-z-frei">Zeichnung freigeben</button></div></div>';
    } else if (freigegeben) {
      html += '<div class="pp-card"><div class="pp-tag ok">Von Ihnen freigegeben</div></div>';
    }

    if (entsch.length) {
      html += '<div class="pp-card"><h3>Verlauf</h3>' + entsch.map(function (e) { return '<div class="pp-msg"><div><strong>' + esc(e.entscheidung) + "</strong>" + (e.kommentar ? " – " + esc(e.kommentar) : "") + '</div><div class="pp-msg-meta">' + esc(e.person || "") + " · Rev. " + esc(e.revision) + " · " + fmtDT(e.zeitpunkt) + "</div></div>"; }).join("") + "</div>";
    }
    html += '<div class="pp-footer">' + esc(S.brand.name || "") + "</div></div>";
    root().innerHTML = html; wireHeader();
    d.getElementById("pp-z-back").onclick = function () { renderDokumente(zurueck); };
    if (dok && dok.inhalt && d.getElementById("pp-z-open")) d.getElementById("pp-z-open").onclick = function () { var win = w.open(); if (win) win.document.write('<iframe src="' + dok.inhalt + '" style="border:0;position:fixed;inset:0;width:100%;height:100%"></iframe>'); };
    if (d.getElementById("pp-z-frei")) d.getElementById("pp-z-frei").onclick = function () { zeichnungEntscheidung(z, "freigegeben", zurueck); };
    if (d.getElementById("pp-z-aenderung")) d.getElementById("pp-z-aenderung").onclick = function () { zeichnungAenderung(z, zurueck); };
  }
  function zeichnungEntscheidung(z, entscheidung, zurueck) {
    var ctx = { mandantId: S.tenantId, kundeId: S.kundeId, name: (S.portalUser && S.portalUser.name) || "Kunde", ansprechpartnerId: S.portalUser && S.portalUser.ansprechpartnerId, portalUser: S.portalUser, linkId: S.linkId || null };
    var r = Portal.zeichnungEntscheidung(z, entscheidung, ctx, "", nowISO());
    if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return; }
    (S.db.portalEreignisse = S.db.portalEreignisse || []).push(Portal.ereignis({ typ: "zeichnung_freigegeben", mandantId: S.tenantId, kundeId: S.kundeId, text: "Zeichnung " + z.zeichnungsnummer + " Rev. " + z.revision + " freigegeben" }, nowISO()));
    saveTenant(S.tenantId, S.db); toast("Zeichnung freigegeben. Vielen Dank."); renderZeichnung(z.id, zurueck);
  }
  function zeichnungAenderung(z, zurueck) {
    modal("Änderung erforderlich", '<label class="pp-field"><span>Was soll geändert werden? *</span><textarea id="pp-z-kommentar" rows="4" placeholder="Bitte beschreiben Sie den Änderungswunsch …"></textarea></label>', [
      { label: "Abbrechen", cls: "ghost" },
      { label: "Änderung anfordern", cls: "danger", fn: function () {
        var k = (d.getElementById("pp-z-kommentar").value || "").trim(); if (!k) { toast("Bitte Kommentar eingeben.", "err"); return false; }
        var ctx = { mandantId: S.tenantId, kundeId: S.kundeId, name: (S.portalUser && S.portalUser.name) || "Kunde", ansprechpartnerId: S.portalUser && S.portalUser.ansprechpartnerId, portalUser: S.portalUser, linkId: S.linkId || null };
        var r = Portal.zeichnungEntscheidung(z, "Änderung verlangt", ctx, k, nowISO());
        if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return false; }
        (S.db.portalEreignisse = S.db.portalEreignisse || []).push(Portal.ereignis({ typ: "zeichnung_aenderung", mandantId: S.tenantId, kundeId: S.kundeId, text: "Änderung an Zeichnung " + z.zeichnungsnummer + " verlangt" }, nowISO()));
        saveTenant(S.tenantId, S.db); toast("Änderungswunsch übermittelt."); renderZeichnung(z.id, zurueck); return true;
      } }
    ]);
  }

  function uploadDialog(zurueck) {
    var projekte = {};
    (S.db.angebote || []).filter(function (a) { return a.kundeId === S.kundeId; }).forEach(function (a) { if (a.kommission) projekte[a.kommission] = a.bezeichnung || a.betreff || ""; });
    var komOpts = '<option value="">— keine —</option>' + Object.keys(projekte).map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + "</option>"; }).join("");
    var typOpts = Portal.UPLOAD_DOKTYPEN.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("");
    var body = '<label class="pp-field"><span>Datei * (max ' + Math.round(Portal.UPLOAD_MAX_BYTES / 1024 / 1024) + ' MB; erlaubt: ' + Portal.ERLAUBTE_EXT.join(", ") + ')</span><input type="file" id="pp-up-file"></label>' +
      '<label class="pp-field"><span>Dokumenttyp</span><select id="pp-up-typ">' + typOpts + "</select></label>" +
      '<label class="pp-field"><span>Kommission / Projekt</span><select id="pp-up-kom">' + komOpts + "</select></label>" +
      '<label class="pp-field"><span>Beschreibung</span><textarea id="pp-up-beschr" rows="2"></textarea></label>' +
      '<div id="pp-up-status" class="pp-muted"></div>';
    modal("Datei hochladen", body, [
      { label: "Abbrechen", cls: "ghost" },
      { label: "Hochladen", cls: "brand", fn: function () {
        var inp = d.getElementById("pp-up-file"); var f = inp && inp.files && inp.files[0];
        if (!f) { toast("Bitte Datei wählen.", "err"); return false; }
        var meta = { dateiname: f.name, mime: f.type || "", groesse: f.size };
        var pruef = Portal.uploadPruefen(meta);
        if (!pruef.ok) { d.getElementById("pp-up-status").innerHTML = '<span style="color:#a93232">Abgelehnt: ' + esc(pruef.grund) + "</span>"; return false; }
        d.getElementById("pp-up-status").textContent = "Wird verarbeitet …";
        // Datei lokal einlesen (kleine Dateien mit Inhalt, große nur Metadaten)
        var fertig = function (inhalt) {
          var r = Portal.uploadNeu({ mandantId: S.tenantId, kundeId: S.kundeId, dateiname: f.name, mime: f.type, groesse: f.size, typ: d.getElementById("pp-up-typ").value, kommission: d.getElementById("pp-up-kom").value, projekt: projekte[d.getElementById("pp-up-kom").value] || "", beschreibung: d.getElementById("pp-up-beschr").value, inhalt: inhalt }, nowISO());
          if (!r.ok) { toast("Abgelehnt: " + r.grund, "err"); return; }
          (S.db.kundenUploads = S.db.kundenUploads || []).push(r.upload);
          (S.db.portalEreignisse = S.db.portalEreignisse || []).push(Portal.ereignis({ typ: "dokument_hochgeladen", mandantId: S.tenantId, kundeId: S.kundeId, text: "Kundenupload: " + f.name }, nowISO()));
          saveTenant(S.tenantId, S.db);
          d.getElementById("portal-modal").classList.remove("show"); d.getElementById("portal-modal").hidden = true;
          toast("Datei hochgeladen (wird intern geprüft)."); renderDokumente(zurueck);
        };
        if (f.size <= 1024 * 1024) { var fr = new w.FileReader(); fr.onload = function () { fertig(fr.result); }; fr.onerror = function () { fertig(null); }; fr.readAsDataURL(f); }
        else fertig(null);
        return false; // Modal offen lassen; schließt nach Abschluss selbst
      } }
    ]);
  }

  // ================================================================
  //  START
  // ================================================================
  function start() {
    if (!Store || !Portal || !Angebot) { root().innerHTML = '<div class="pp-loading">Fehler: Engines nicht geladen.</div>'; return; }
    try { ensureDemoTenants(); } catch (e) { /* Demo-Setup darf Start nicht verhindern */ }
    renderLogin();
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start); else start();
})(window, document);
