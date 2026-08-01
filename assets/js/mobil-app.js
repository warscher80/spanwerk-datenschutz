/* ============================================================
   Preisschmiede – Mobile Werkstatt/Montage-PWA (Phase 14B)
   Mobile Oberfläche, verbunden mit dem Phase-14A-Offline-Kern
   (Sync/OfflineDB/Offline). KEINE zweite Offline-Logik. Zeigt für
   Werkstatt/Montage KEINE Preise/Margen/Gewinne/Rechnungsdaten.
   Über localhost/HTTPS mit IndexedDB; file:// nur Fallback (nicht
   produktiv). Bucht ausschließlich über Offline.ereignis (exactly
   once). Keine vorgetäuschte Speicherung, keine stillen Löschungen.
   ============================================================ */
(function (w, d) {
  "use strict";
  var P = w.Preisschmiede || {};
  var Store = P.Store, Auth = P.Auth, Offline = P.Offline, Sync = P.Sync, Mandant = P.Mandant;

  var NAV = [
    { key: "heute", ic: "🏠", label: "Heute" }, { key: "auftraege", ic: "📁", label: "Aufträge" },
    { key: "zeit", ic: "⏱️", label: "Zeit" }, { key: "maschine", ic: "🛠️", label: "Maschine" },
    { key: "material", ic: "🧱", label: "Material" }, { key: "montage", ic: "🚚", label: "Montage" },
    { key: "dokumente", ic: "📎", label: "Doku" }, { key: "sync", ic: "🔄", label: "Sync" }, { key: "profil", ic: "👤", label: "Profil" }
  ];
  var STILLSTAND = ["Material fehlt", "Werkzeugwechsel", "Störung", "Programmierung", "Qualitätsproblem", "Freigabe fehlt", "sonstiges"];

  var S = { view: "heute", auftragId: null, terminal: false, tick: null, inaktiv: null, suche: "", favoriten: [] };

  // ---- Hilfen ----
  function root() { return d.getElementById("m-root"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function nowISO() { return Store.nowISO(); }
  function online() { return Offline ? Offline.online() : true; }
  function db() { return Store.load(); }
  function benutzer() { var u = Auth.current(); return u ? u.benutzername : null; }
  function rolle() { var u = Auth.current(); return u ? u.rolle : null; }
  function mandantName() { try { var m = Store.aktiverMandant(); return m ? m.name : ""; } catch (e) { return ""; } }
  function toast(msg, kind) { var t = d.getElementById("m-toast"); t.textContent = msg; t.className = "m-toast show " + (kind || ""); clearTimeout(t._tm); t._tm = setTimeout(function () { t.className = "m-toast"; }, 2800); }
  function fmtDur(sek) { sek = Math.max(0, sek | 0); var h = (sek / 3600) | 0, m = ((sek % 3600) / 60) | 0, s = sek % 60; function p(n) { return (n < 10 ? "0" : "") + n; } return p(h) + ":" + p(m) + ":" + p(s); }
  function fmtDate(iso) { try { return iso ? new Date(iso).toLocaleDateString("de-AT") : "—"; } catch (e) { return "—"; } }
  function fmtDT(iso) { try { return iso ? new Date(iso).toLocaleString("de-AT") : "—"; } catch (e) { return "—"; } }
  function auftrag(id) { return (db().auftraege || []).filter(function (a) { return a.id === id; })[0]; }
  function auftragNr(a) { return a ? (a.nummer || a.titel || a.id) : "—"; }
  // Aktiver Auftragskontext: gewählter Auftrag, sonst der eines laufenden Timers
  // (z. B. nach einem Reload, bei dem die In-Memory-Auswahl verloren geht).
  function aktAuftragId() { if (S.auftragId) return S.auftragId; var at = Offline.aktiverTimer(); return at ? at.auftragId : null; }

  // Offline-Buchungen dieses Records-Typs für einen Auftrag (aus Queue+Sync)
  function recordsFuer(typ, auftragId) { return (Offline.records() || []).filter(function (r) { return r.typ === typ && (!auftragId || r.auftragId === auftragId) && r.status !== Sync.STATUS.CANCELLED; }); }

  // ---- Modal / Zahleneingabe ----
  function modal(title, bodyHtml, buttons) {
    var bg = d.getElementById("m-modal");
    var btns = (buttons || []).map(function (b, i) { return '<button class="m-btn ' + (b.cls || "ghost") + '" data-mi="' + i + '">' + esc(b.label) + "</button>"; }).join("");
    bg.innerHTML = '<div class="m-modal"><h3>' + esc(title) + "</h3><div>" + bodyHtml + '</div><div style="display:grid;gap:10px;margin-top:14px">' + btns + "</div></div>";
    bg.classList.add("show"); bg.hidden = false;
    function close() { bg.classList.remove("show"); bg.hidden = true; }
    bg.onclick = function (e) { if (e.target === bg) close(); };
    (buttons || []).forEach(function (b, i) { var el = bg.querySelector('[data-mi="' + i + '"]'); if (el) el.onclick = function () { var r = b.fn ? b.fn() : true; if (r !== false) close(); }; });
    return { close: close };
  }
  function numField(id, label, val) { return '<label class="m-field"><span>' + esc(label) + '</span><div class="m-num"><button type="button" data-nminus="' + id + '">−</button><input id="' + id + '" type="number" inputmode="numeric" value="' + (val != null ? val : 0) + '"><button type="button" data-nplus="' + id + '">+</button></div></label>'; }
  function wireNum(scope) { (scope || d).querySelectorAll("[data-nplus]").forEach(function (b) { b.onclick = function () { var i = d.getElementById(b.getAttribute("data-nplus")); i.value = (parseFloat(i.value) || 0) + 1; }; }); (scope || d).querySelectorAll("[data-nminus]").forEach(function (b) { b.onclick = function () { var i = d.getElementById(b.getAttribute("data-nminus")); i.value = Math.max(0, (parseFloat(i.value) || 0) - 1); }; }); }

  // ============================================================
  //  ANMELDUNG (inkl. Terminalmodus)
  // ============================================================
  function renderLogin() {
    stopTick();
    var users = (db().users || []).filter(function (u) { return u.aktiv !== false; });
    var html = '<div class="m-top"><div class="m-title">Preisschmiede · Werkstatt</div><span class="m-chip ' + (online() ? "on" : "off") + '">' + (online() ? "online" : "offline") + '</span></div><div class="m-wrap">';
    html += '<div class="m-card"><h2>Anmelden</h2><div class="m-muted">Firma: ' + esc(mandantName() || "—") + "</div>";
    if (S.terminal) {
      html += '<div class="m-muted" style="margin:8px 0">Terminalmodus – Mitarbeiter wählen:</div><div class="m-grid">' +
        users.map(function (u) { return '<button class="m-btn" data-tuser="' + esc(u.benutzername) + '">' + esc(u.name) + "</button>"; }).join("") + "</div>";
    } else {
      var opts = users.map(function (u) { return '<option value="' + esc(u.benutzername) + '">' + esc(u.name) + " – " + esc(Auth.rolleLabel(u.rolle)) + "</option>"; }).join("");
      html += '<label class="m-field"><span>Mitarbeiter</span><select id="m-user">' + opts + '</select></label>' +
        '<label class="m-field"><span>PIN</span><input id="m-pin" type="password" inputmode="numeric"></label>' +
        '<button class="m-btn accent xl" id="m-login">Anmelden</button>';
    }
    html += '<button class="m-btn ghost" id="m-terminal-toggle" style="margin-top:10px">' + (S.terminal ? "Einzel-Anmeldung" : "🖥️ Terminalmodus (gemeinsames Tablet)") + "</button>";
    html += '<div class="m-note" style="margin-top:12px">Testzugang: PIN <b>1234</b>. Werkstatt/Montage sehen keine Preise oder Finanzdaten.</div></div></div>';
    root().innerHTML = html;
    var lg = d.getElementById("m-login"); if (lg) lg.onclick = function () { versuch(d.getElementById("m-user").value, d.getElementById("m-pin").value); };
    var pin = d.getElementById("m-pin"); if (pin) pin.addEventListener("keydown", function (e) { if (e.key === "Enter") versuch(d.getElementById("m-user").value, pin.value); });
    d.getElementById("m-terminal-toggle").onclick = function () { S.terminal = !S.terminal; renderLogin(); };
    root().querySelectorAll("[data-tuser]").forEach(function (b) { b.onclick = function () { terminalPin(b.getAttribute("data-tuser")); }; });
  }
  function terminalPin(bn) {
    modal("PIN eingeben", '<label class="m-field"><span>PIN für ' + esc(bn) + '</span><input id="tp" type="password" inputmode="numeric"></label>', [
      { label: "Abbrechen", cls: "ghost" }, { label: "Anmelden", cls: "accent", fn: function () { if (!versuch(bn, d.getElementById("tp").value)) { toast("PIN falsch.", "err"); return false; } return true; } }
    ]);
  }
  function versuch(bn, pin) {
    var ok = Auth.login(bn, pin);
    if (!ok) { toast("Anmeldung fehlgeschlagen.", "err"); return false; }
    S.view = "heute"; render(); if (S.terminal) starteInaktivitaet(); return true;
  }
  function starteInaktivitaet() { clearTimeout(S.inaktiv); if (!S.terminal) return; S.inaktiv = setTimeout(function () { if (!Offline.aktiverTimer()) { Auth.logout(); renderLogin(); toast("Automatische Rückkehr (Inaktivität)."); } else starteInaktivitaet(); }, 120000); }

  // ============================================================
  //  APP-SHELL (Kopf + Bottom-Nav)
  // ============================================================
  function shell(inner) {
    var z = Offline.zusammenfassung();
    var top = '<div class="m-top"><div class="m-title">' + esc(NAV.filter(function (n) { return n.key === S.view; })[0] ? NAV.filter(function (n) { return n.key === S.view; })[0].label : "Werkstatt") + '</div>' +
      '<span class="m-chip ' + (z.online ? "on" : "off") + '">' + (z.online ? "online" : "offline") + "</span></div>";
    var nav = '<div class="m-nav">' + NAV.map(function (n) {
      var badge = n.key === "sync" && (z.wartend || z.konflikte) ? '<span class="badge">' + (z.wartend + z.konflikte) + "</span>" : "";
      return '<button data-nav="' + n.key + '" class="' + (S.view === n.key ? "active" : "") + '" style="position:relative"><span class="ic">' + n.ic + "</span>" + badge + esc(n.label) + "</button>";
    }).join("") + "</div>";
    return top + '<div class="m-wrap">' + inner + "</div>" + nav;
  }
  function render() {
    if (!Auth.current()) { renderLogin(); return; }
    stopTick();
    var inner;
    switch (S.view) {
      case "auftraege": inner = viewAuftraege(); break;
      case "zeit": inner = viewZeit(); break;
      case "maschine": inner = viewMaschine(); break;
      case "material": inner = viewMaterial(); break;
      case "montage": inner = viewMontage(); break;
      case "dokumente": inner = viewDokumente(); break;
      case "sync": inner = viewSync(); break;
      case "konflikt": inner = viewKonflikt(); break;
      case "profil": inner = viewProfil(); break;
      default: inner = viewHeute();
    }
    root().innerHTML = shell(inner);
    root().querySelectorAll("[data-nav]").forEach(function (b) { b.onclick = function () { S.view = b.getAttribute("data-nav"); render(); resetInaktiv(); }; });
    wireView();
    if (S.view === "zeit" || S.view === "heute" || S.view === "maschine") startTick();
  }
  function resetInaktiv() { if (S.terminal) starteInaktivitaet(); }
  function startTick() { stopTick(); S.tick = setInterval(function () { var at = Offline.aktiverTimer(); var el = d.getElementById("m-live"); if (el && at) el.textContent = fmtDur(at.sekunden); var ml = d.getElementById("m-mlive"); if (ml) ml.textContent = maschineLive(); }, 1000); }
  function stopTick() { if (S.tick) { clearInterval(S.tick); S.tick = null; } }

  // ============================================================
  //  HEUTE
  // ============================================================
  function letzteAuftraege() {
    var ids = {}; (Offline.records() || []).slice().reverse().forEach(function (r) { if (r.auftragId) ids[r.auftragId] = true; });
    var liste = Object.keys(ids).map(auftrag).filter(Boolean);
    if (!liste.length) liste = (db().auftraege || []).filter(function (a) { return a.status === "Beauftragt" || a.status === "In Fertigung"; }).slice(0, 5);
    return liste.slice(0, 6);
  }
  function heutePlan() {
    var pl = (db().planung && db().planung.elemente) || [];
    return pl.filter(function (e) { return e.status === "geplant" || e.status === "in Arbeit"; }).slice(0, 6);
  }
  function viewHeute() {
    var u = Auth.current(); var at = Offline.aktiverTimer(); var z = Offline.zusammenfassung();
    var html = '<div class="m-card"><div class="m-kv"><span>Mitarbeiter</span><span>' + esc(u.name) + " · " + esc(Auth.rolleLabel(u.rolle)) + "</span></div>" +
      '<div class="m-kv"><span>Firma</span><span>' + esc(mandantName()) + "</span></div>" +
      '<div class="m-kv"><span>Status</span><span><span class="m-dot ' + (z.online ? "ok" : "warn") + '">' + (z.online ? "online" : "offline") + "</span> · " + z.wartend + " wartend · " + z.konflikte + " Konflikt</span></div></div>";
    if (at) {
      var a = auftrag(at.auftragId);
      html += '<div class="m-card"><h3>Laufender Timer</h3><div class="m-timer' + (at.aufPause ? " pause" : "") + '"><div class="big" id="m-live">' + fmtDur(at.sekunden) + '</div><div class="m-muted">' + esc(auftragNr(a)) + " · " + esc(at.schritt || "") + (at.aufPause ? " · PAUSE" : "") + '</div></div><button class="m-btn accent" data-nav-go="zeit">Zeit öffnen</button></div>';
    }
    html += '<div class="m-card"><h3>Schnellaktionen</h3><div class="m-grid">' +
      '<button class="m-btn accent" data-act="start">▶ Arbeit starten</button>' +
      '<button class="m-btn ' + (at ? "warn" : "") + '" data-act="stop"' + (at ? "" : " disabled") + '>⏹ Beenden</button>' +
      '<button class="m-btn" data-nav-go="material">🧱 Material</button>' +
      '<button class="m-btn" data-nav-go="maschine">🛠️ Maschine</button>' +
      '<button class="m-btn" data-nav-go="montage">🚚 Montage</button>' +
      '<button class="m-btn" data-act="problem">⚠️ Problem melden</button></div></div>';
    var plan = heutePlan();
    html += '<div class="m-card"><h3>Heute geplant</h3>' + (plan.length ? plan.map(function (e) { var a = auftrag(e.auftragId); return '<div class="m-item" data-auf="' + esc(e.auftragId) + '"><div class="m-item-main"><div class="m-item-t">' + esc(auftragNr(a)) + '</div><div class="m-item-s">' + esc(e.schritt || e.arbeitsgang || "") + " · " + esc((a && a.kommission) || "") + '</div></div><span class="m-tag ' + (e.status === "in Arbeit" ? "wait" : "") + '">' + esc(e.status) + "</span></div>"; }).join("") : '<div class="m-muted">Keine geplanten Arbeitsgänge.</div>') + "</div>";
    var letzte = letzteAuftraege();
    html += '<div class="m-card"><h3>Zuletzt verwendet</h3>' + (letzte.length ? letzte.map(auftragItem).join("") : '<div class="m-muted">—</div>') + "</div>";
    return html;
  }
  function auftragItem(a) { return '<div class="m-item" data-auf="' + esc(a.id) + '"><div class="m-item-main"><div class="m-item-t">' + esc(auftragNr(a)) + '</div><div class="m-item-s">' + esc(a.kommission || "") + " · " + esc(a.status || "") + '</div></div><span class="m-tag">' + esc(a.status || "") + "</span></div>"; }

  // ============================================================
  //  AUFTRÄGE (Suche/Auswahl)
  // ============================================================
  function viewAuftraege() {
    var q = (S.suche || "").toLowerCase();
    var geplant = {}; ((db().planung && db().planung.elemente) || []).forEach(function (e) { if (e.status === "geplant" || e.status === "in Arbeit") geplant[e.auftragId] = true; });
    function rang(a) { if (a.status === "In Fertigung") return 0; if (geplant[a.id]) return 1; if (a.status === "Beauftragt") return 2; if (a.status === "Abgeschlossen") return 4; return 3; }
    var alle = (db().auftraege || []).filter(function (a) {
      if (!q) return true;
      return [a.nummer, a.titel, a.kommission, a.id].filter(Boolean).join(" ").toLowerCase().indexOf(q) >= 0;
    }).slice().sort(function (a, b) { return rang(a) - rang(b); });
    var html = '<div class="m-card"><label class="m-field"><span>Suche (Nummer, Kommission, Projekt, Arbeitsgang)</span><input id="m-suche" value="' + esc(S.suche) + '" placeholder="z. B. Geländer oder BV…"></label>' +
      '<div class="m-muted" style="margin-bottom:6px">' + alle.length + ' Aufträge · zugewiesen &amp; heute geplant zuerst</div>';
    html += alle.slice(0, 40).map(auftragItem).join("") || '<div class="m-muted">Keine Treffer.</div>';
    html += "</div>";
    return html;
  }

  // ============================================================
  //  ZEIT (Timer)
  // ============================================================
  function schrittWahl(a) { var p = (a && a.positionen && a.positionen[0]) || {}; var z = (p.kalk && p.kalk.zeiten) || {}; var keys = Object.keys(z); return keys.length ? keys : ["schweissen", "montage", "zuschnitt"]; }
  function viewZeit() {
    var at = Offline.aktiverTimer();
    var a = at ? auftrag(at.auftragId) : (S.auftragId ? auftrag(S.auftragId) : null);
    var html = "";
    if (!a && !at) { html += '<div class="m-card"><div class="m-muted">Kein Auftrag gewählt.</div><button class="m-btn accent" data-nav-go="auftraege">Auftrag wählen</button></div>'; return html; }
    if (at) {
      var aa = auftrag(at.auftragId);
      html += '<div class="m-card"><div class="m-kv"><span>Auftrag</span><span>' + esc(auftragNr(aa)) + '</span></div><div class="m-kv"><span>Kommission</span><span>' + esc((aa && aa.kommission) || "") + '</span></div><div class="m-kv"><span>Arbeitsgang</span><span>' + esc(at.schritt || "") + '</span></div>' +
        '<div class="m-timer' + (at.aufPause ? " pause" : "") + '"><div class="big" id="m-live">' + fmtDur(at.sekunden) + '</div><div class="m-muted">Start ' + fmtDT(at.seit) + (at.aufPause ? " · PAUSE" : "") + '</div></div>' +
        '<div class="m-grid">' + (at.aufPause ? '<button class="m-btn ok xl" data-act="resume">▶ Fortsetzen</button>' : '<button class="m-btn warn xl" data-act="pause">⏸ Pause</button>') +
        '<button class="m-btn err xl" data-act="stop">⏹ Beenden</button></div></div>';
    } else {
      var schritte = schrittWahl(a);
      html += '<div class="m-card"><div class="m-kv"><span>Auftrag</span><span>' + esc(auftragNr(a)) + '</span></div><div class="m-kv"><span>Kommission</span><span>' + esc(a.kommission || "") + '</span></div>' +
        '<label class="m-field"><span>Tätigkeit / Arbeitsgang</span><select id="m-schritt">' + schritte.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join("") + '</select></label>' +
        '<button class="m-btn accent xl" data-act="start">▶ Arbeit starten</button></div>';
    }
    return html;
  }

  // ============================================================
  //  MASCHINE / RÜSTZEIT
  // ============================================================
  function maschineLive() {
    var recs = recordsFuer("maschinenzeit", aktAuftragId());
    var offen = null; recs.slice().reverse().forEach(function (r) { if (!offen && /_START$/.test(r.event || "")) { var typ = r.event.replace(/_START$/, ""); var ende = recs.some(function (x) { return x.event === typ + "_ENDE" && new Date(x.geraetezeit) > new Date(r.geraetezeit); }); if (!ende) offen = r; } });
    if (!offen) return "—";
    return fmtDur(Math.round((Date.now() - new Date(offen.geraetezeit).getTime()) / 1000)) + " (" + offen.event.replace(/_START$/, "") + ")";
  }
  function viewMaschine() {
    var a = aktAuftragId() ? auftrag(aktAuftragId()) : null;
    if (!a) return '<div class="m-card"><div class="m-muted">Bitte zuerst einen Auftrag wählen.</div><button class="m-btn accent" data-nav-go="auftraege">Auftrag wählen</button></div>';
    var maschinen = (db().settings.maschinen || []);
    var html = '<div class="m-card"><div class="m-kv"><span>Auftrag</span><span>' + esc(auftragNr(a)) + '</span></div>' +
      '<label class="m-field"><span>Maschine</span><select id="m-masch">' + maschinen.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + "</option>"; }).join("") + '</select></label>' +
      '<div class="m-kv"><span>Aktuell offen</span><span id="m-mlive">' + maschineLive() + '</span></div></div>';
    html += '<div class="m-card"><h3>Rüsten</h3><div class="m-grid"><button class="m-btn" data-masch="RUEST_START">Rüsten Start</button><button class="m-btn" data-masch="RUEST_ENDE">Rüsten Ende</button></div></div>';
    html += '<div class="m-card"><h3>Maschinenlauf</h3><div class="m-grid"><button class="m-btn accent" data-masch="LAUF_START">Lauf Start</button><button class="m-btn warn" data-masch="LAUF_PAUSE">Pause</button><button class="m-btn err" data-masch="LAUF_ENDE">Lauf Ende</button><button class="m-btn" data-act="stueck">Stückzahl</button></div></div>';
    html += '<div class="m-card"><h3>Stillstand</h3><button class="m-btn" data-act="stillstand">Stillstand erfassen</button></div>';
    var recs = recordsFuer("maschinenzeit", a.id).slice(-6).reverse();
    if (recs.length) html += '<div class="m-card"><h3>Letzte Buchungen</h3>' + recs.map(function (r) { return '<div class="m-row"><span>' + esc(r.event || r.typ) + (r.payload && r.payload.grund ? " · " + esc(r.payload.grund) : "") + '</span><span class="m-muted">' + fmtDT(r.geraetezeit) + " " + statusTag(r) + "</span></div>"; }).join("") + "</div>";
    return html;
  }

  // ============================================================
  //  MATERIAL
  // ============================================================
  function materialErfasst(auftragId, materialId) { return recordsFuer("materialverbrauch", auftragId).filter(function (r) { return r.payload && r.payload.materialId === materialId; }).reduce(function (s, r) { return s + (r.payload.art === "rueckgabe" ? -1 : 1) * (parseFloat(r.payload.menge) || 0); }, 0); }
  function viewMaterial() {
    var a = aktAuftragId() ? auftrag(aktAuftragId()) : null;
    if (!a) return '<div class="m-card"><div class="m-muted">Bitte zuerst einen Auftrag wählen.</div><button class="m-btn accent" data-nav-go="auftraege">Auftrag wählen</button></div>';
    var html = '<div class="m-card"><div class="m-kv"><span>Auftrag</span><span>' + esc(auftragNr(a)) + '</span></div><button class="m-btn accent" data-act="material">＋ Material erfassen</button></div>';
    var recs = recordsFuer("materialverbrauch", a.id).slice(-10).reverse();
    html += '<div class="m-card"><h3>Erfasste Buchungen</h3>' + (recs.length ? recs.map(function (r) { var p = r.payload || {}; return '<div class="m-row"><span>' + esc(p.material || "") + " · " + esc(p.art || "") + '</span><span>' + esc(p.menge) + " " + esc(p.einheit || "") + " " + statusTag(r) + "</span></div>"; }).join("") : '<div class="m-muted">Noch nichts erfasst.</div>') + "</div>";
    return html;
  }
  function materialDialog(a) {
    var mats = (db().material || []);
    var opts = mats.map(function (m) { return '<option value="' + esc(m.id) + '" data-einheit="' + esc(m.einheit || "Stk") + '">' + esc(m.bezeichnung || m.name || m.id) + "</option>"; }).join("");
    var body = '<label class="m-field"><span>Material</span><select id="mm-mat">' + opts + '</select></label>' +
      '<label class="m-field"><span>Art</span><select id="mm-art"><option value="entnahme">Entnahme</option><option value="rueckgabe">Rückgabe</option><option value="ausschuss">Ausschuss</option><option value="reststueck">Reststück</option></select></label>' +
      numField("mm-menge", "Menge", 1) +
      '<label class="m-field"><span>Notiz</span><input id="mm-notiz"></label>';
    modal("Material erfassen", body, [
      { label: "Abbrechen", cls: "ghost" },
      { label: "Buchen", cls: "accent", fn: function () {
        var sel = d.getElementById("mm-mat"); var matId = sel.value; var matName = sel.options[sel.selectedIndex].text; var einheit = sel.options[sel.selectedIndex].getAttribute("data-einheit");
        var menge = parseFloat(d.getElementById("mm-menge").value) || 0;
        if (menge <= 0) { toast("Menge muss > 0 sein.", "err"); return false; }
        if (menge > 1000) { if (!w.confirm("Ungewöhnlich hohe Menge (" + menge + "). Trotzdem buchen? (Bestand wird bei der Synchronisation erneut geprüft.)")) return false; }
        buche("materialverbrauch", { auftragId: a.id, schritt: null, payload: { materialId: matId, material: matName, einheit: einheit, art: d.getElementById("mm-art").value, menge: menge, notiz: d.getElementById("mm-notiz").value } });
        toast("Material erfasst (offline gespeichert)."); render(); return true;
      } }
    ]);
    wireNum(d.getElementById("m-modal"));
  }

  // ============================================================
  //  MONTAGE
  // ============================================================
  function viewMontage() {
    var a = aktAuftragId() ? auftrag(aktAuftragId()) : null;
    if (!a) return '<div class="m-card"><div class="m-muted">Bitte zuerst einen Auftrag wählen.</div><button class="m-btn accent" data-nav-go="auftraege">Auftrag wählen</button></div>';
    var html = '<div class="m-card"><div class="m-kv"><span>Auftrag</span><span>' + esc(auftragNr(a)) + '</span></div><div class="m-kv"><span>Kommission/Baustelle</span><span>' + esc(a.kommission || "") + '</span></div>' +
      '<button class="m-btn accent" data-act="montage">📋 Tagesbericht erfassen</button><button class="m-btn" data-act="foto">📷 Foto hinzufügen</button></div>';
    var recs = recordsFuer("montage", a.id).slice(-6).reverse();
    if (recs.length) html += '<div class="m-card"><h3>Berichte</h3>' + recs.map(function (r) { var p = r.payload || {}; return '<div class="m-row"><span>' + esc(fmtDate(p.datum || r.geraetezeit)) + " · " + esc(p.taetigkeit || "") + '</span><span>' + statusTag(r) + "</span></div>"; }).join("") + "</div>";
    var fotos = recordsFuer("foto", a.id).slice(-6).reverse();
    if (fotos.length) html += '<div class="m-card"><h3>Fotos</h3>' + fotos.map(function (r) { var p = r.payload || {}; return '<div class="m-row"><span>' + (p.dataUrl ? '<img src="' + p.dataUrl + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;vertical-align:middle"> ' : "") + esc(p.name || "Foto") + '</span><span>' + statusTag(r) + (r.status !== Sync.STATUS.SYNCED ? ' <button class="m-tag" data-retry="' + esc(r.id) + '">erneut</button>' : "") + "</span></div>"; }).join("") + "</div>";
    return html;
  }
  function montageDialog(a) {
    var body = '<label class="m-field"><span>Tätigkeit</span><input id="mo-tat" placeholder="z. B. Geländermontage"></label>' +
      '<div class="m-grid">' + numField("mo-montage", "Montagezeit (h)", 0) + numField("mo-fahrt", "Fahrtzeit (h)", 0) + '</div>' +
      '<div class="m-grid">' + numField("mo-warte", "Wartezeit (h)", 0) + numField("mo-km", "Kilometer", 0) + '</div>' +
      '<label class="m-field"><span>Team</span><input id="mo-team" value="' + esc(Auth.current().name) + '"></label>' +
      '<label class="m-field"><span>Offene Punkte / Behinderung</span><textarea id="mo-offen" rows="2"></textarea></label>' +
      '<label class="m-field"><span>Notiz</span><textarea id="mo-notiz" rows="2"></textarea></label>';
    modal("Montage-Tagesbericht", body, [
      { label: "Abbrechen", cls: "ghost" },
      { label: "Speichern (offline)", cls: "accent", fn: function () {
        var tat = (d.getElementById("mo-tat").value || "").trim(); if (!tat) { toast("Tätigkeit angeben.", "err"); return false; }
        buche("montage", { auftragId: a.id, payload: { datum: nowISO(), taetigkeit: tat, montageStd: +d.getElementById("mo-montage").value || 0, fahrtStd: +d.getElementById("mo-fahrt").value || 0, warteStd: +d.getElementById("mo-warte").value || 0, km: +d.getElementById("mo-km").value || 0, team: d.getElementById("mo-team").value, offen: d.getElementById("mo-offen").value, notiz: d.getElementById("mo-notiz").value } });
        toast("Tagesbericht offline gespeichert."); render(); return true;
      } }
    ]);
    wireNum(d.getElementById("m-modal"));
  }
  function fotoDialog(a) {
    var body = '<label class="m-field"><span>Foto aufnehmen/auswählen</span><input type="file" id="fo-file" accept="image/*" capture="environment"></label>' +
      '<label class="m-field"><span>Kategorie</span><select id="fo-kat"><option>Baustelle</option><option>Schaden</option><option>Fortschritt</option><option>Abnahme</option><option>sonstiges</option></select></label>' +
      '<label class="m-field"><span>Beschreibung</span><input id="fo-beschr"></label><div id="fo-status" class="m-muted"></div>';
    modal("Foto hinzufügen", body, [
      { label: "Abbrechen", cls: "ghost" },
      { label: "Speichern (nur lokal)", cls: "accent", fn: function () {
        var f = d.getElementById("fo-file").files[0]; if (!f) { toast("Bitte Foto wählen.", "err"); return false; }
        d.getElementById("fo-status").textContent = "Wird lokal optimiert …";
        komprimiere(f, 1280, 0.7, function (dataUrl, groesse) {
          buche("foto", { auftragId: a.id, payload: { name: f.name, groesse: groesse, mime: "image/jpeg", kategorie: d.getElementById("fo-kat").value, beschreibung: d.getElementById("fo-beschr").value, dataUrl: dataUrl, uploadStatus: "nur_lokal" } });
          d.getElementById("m-modal").classList.remove("show"); d.getElementById("m-modal").hidden = true;
          toast("Foto lokal gespeichert (noch nicht synchronisiert)."); render();
        });
        return false;
      } }
    ]);
  }
  function komprimiere(file, maxPx, q, cb) {
    try {
      var fr = new w.FileReader();
      fr.onload = function () {
        var img = new w.Image();
        img.onload = function () {
          var scale = Math.min(1, maxPx / Math.max(img.width, img.height));
          var cv = d.createElement("canvas"); cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          var url = cv.toDataURL("image/jpeg", q); cb(url, url.length);
        };
        img.onerror = function () { cb(fr.result, (fr.result || "").length); };
        img.src = fr.result;
      };
      fr.onerror = function () { cb(null, file.size); };
      fr.readAsDataURL(file);
    } catch (e) { cb(null, file.size); }
  }

  // ============================================================
  //  DOKUMENTE (freigegebene Zeichnungen offline verfügbar)
  // ============================================================
  var _offlineDocs = {};
  function viewDokumente() {
    var docs = (db().dokumente || []).filter(function (dk) { return dk.aktuell !== false && (dk.typ === "technische Zeichnung" || dk.typ === "Stückliste" || dk.typ === "Montageplan" || dk.zeichnungsnummer); });
    var html = '<div class="m-card"><h3>Freigegebene Dokumente</h3><div class="m-muted" style="margin-bottom:6px">Nur aktuelle, freigegebene Zeichnungen/Pläne. Interne/nicht freigegebene werden nicht angezeigt.</div>';
    html += docs.length ? docs.map(function (dk) {
      var neuer = (db().dokumente || []).some(function (x) { return x.zeichnungsnummer === dk.zeichnungsnummer && x.vorgaengerId === dk.id; });
      var off = !!_offlineDocs[dk.id];
      return '<div class="m-card" style="background:var(--m-card2)"><div class="m-item-t">' + esc(dk.zeichnungsnummer || dk.nummer || dk.dateiname) + " · Rev. " + esc(dk.revision || "-") + (neuer ? ' <span class="m-tag warn">veraltet</span>' : "") + '</div><div class="m-item-s">' + esc(dk.beschreibung || "") + " · " + Math.round(((dk.inhalt || "").length || 0) / 1024) + " kB</div>" +
        '<div class="m-grid" style="margin-top:8px">' + (dk.inhalt ? '<button class="m-btn" data-dokopen="' + esc(dk.id) + '">Öffnen</button>' : '<button class="m-btn" disabled>Keine Datei</button>') +
        '<button class="m-btn ' + (off ? "ok" : "") + '" data-dokoff="' + esc(dk.id) + '">' + (off ? "offline ✓ (entfernen)" : "offline verfügbar") + "</button></div></div>";
    }).join("") : '<div class="m-muted">Keine freigegebenen Dokumente.</div>';
    html += "</div>";
    return html;
  }

  // ============================================================
  //  SYNC-ANSICHT
  // ============================================================
  function statusTag(r) {
    var st = r.status; var map = { LOCAL_ONLY: ["wait", "nur lokal"], QUEUED: ["wait", "wartet"], SYNCING: ["wait", "läuft"], SYNCED: ["ok", "sync"], RETRY: ["warn", "erneut"], CONFLICT: ["err", "Konflikt"], CANCELLED: ["", "storniert"] };
    var m = map[st] || ["", st]; return '<span class="m-tag ' + m[0] + '">' + m[1] + "</span>";
  }
  function viewSync() {
    var z = Offline.zusammenfassung(); var recs = (Offline.records() || []).slice().reverse();
    var html = '<div class="m-card"><div class="m-kv"><span>Verbindung</span><span><span class="m-dot ' + (z.online ? "ok" : "warn") + '">' + (z.online ? "online" : "offline") + '</span></span></div>' +
      '<div class="m-kv"><span>Letzte Synchronisation</span><span>' + (z.letzteSync ? fmtDT(z.letzteSync) : "—") + '</span></div>' +
      '<div class="m-grid g3" style="margin-top:8px"><div class="m-card" style="text-align:center;margin:0"><div class="big" style="font-size:22px;font-weight:800">' + z.wartend + '</div><div class="m-muted">wartend</div></div>' +
      '<div class="m-card" style="text-align:center;margin:0"><div class="big" style="font-size:22px;font-weight:800;color:var(--m-ok)">' + z.synchronisiert + '</div><div class="m-muted">sync</div></div>' +
      '<div class="m-card" style="text-align:center;margin:0"><div class="big" style="font-size:22px;font-weight:800;color:var(--m-err)">' + z.konflikte + '</div><div class="m-muted">Konflikte</div></div></div>' +
      '<button class="m-btn accent" data-act="sync"' + (z.online ? "" : " disabled") + '>↻ Jetzt synchronisieren</button>' +
      (z.konflikte ? '<button class="m-btn err" data-nav-go="konflikt">Konflikte öffnen (' + z.konflikte + ")</button>" : "") + "</div>";
    html += '<div class="m-card"><h3>Lokale Einträge</h3>' + (recs.length ? recs.slice(0, 20).map(function (r) { return '<div class="m-row"><span>' + esc(r.typ) + (r.event ? " · " + esc(r.event) : "") + '<br><span class="m-muted">' + fmtDT(r.geraetezeit) + '</span></span><span>' + statusTag(r) + (r.status === "RETRY" || r.status === "CONFLICT" ? ' <button class="m-tag" data-retry="' + esc(r.id) + '">erneut</button>' : "") + "</span></div>"; }).join("") : '<div class="m-muted">Keine lokalen Einträge.</div>') + '<div class="m-note" style="margin-top:8px">Lokale Daten werden nie ohne Bestätigung gelöscht.</div></div>';
    return html;
  }
  function viewKonflikt() {
    var kfl = Offline.konflikte();
    var html = '<div class="m-card"><button class="m-btn ghost" data-nav-go="sync">‹ Zurück</button><h3 style="margin-top:10px">Konflikte (' + kfl.length + ")</h3>";
    html += kfl.length ? kfl.map(function (r) { var a = auftrag(r.auftragId);
      return '<div class="m-card" style="background:var(--m-card2)"><div class="m-item-t">' + esc(r.typ) + (r.event ? " · " + esc(r.event) : "") + '</div><div class="m-item-s">Auftrag ' + esc(auftragNr(a)) + " · " + esc((a && a.kommission) || "") + '</div>' +
        '<div class="m-kv"><span>Grund</span><span>' + esc(r.fehler || "") + '</span></div><div class="m-kv"><span>Lokal erfasst</span><span>' + fmtDT(r.geraetezeit) + '</span></div>' +
        '<div class="m-grid" style="margin-top:8px"><button class="m-btn" data-retry="' + esc(r.id) + '">Erneut einreichen</button><button class="m-btn err" data-storno="' + esc(r.id) + '">Lokal stornieren</button></div>' +
        '<div class="m-muted" style="margin-top:6px">Konflikte werden nicht automatisch gelöst; lokale Daten bleiben erhalten.</div></div>';
    }).join("") : '<div class="m-muted">Keine Konflikte.</div>';
    html += "</div>";
    return html;
  }

  // ============================================================
  //  PROFIL / ABMELDUNG
  // ============================================================
  function viewProfil() {
    var u = Auth.current(); var z = Offline.zusammenfassung();
    var speicher = JSON.stringify(Offline.records() || []).length;
    var html = '<div class="m-card"><h3>Profil</h3>' +
      '<div class="m-kv"><span>Benutzer</span><span>' + esc(u.name) + '</span></div>' +
      '<div class="m-kv"><span>Rolle</span><span>' + esc(Auth.rolleLabel(u.rolle)) + '</span></div>' +
      '<div class="m-kv"><span>Firma (Mandant)</span><span>' + esc(mandantName()) + '</span></div>' +
      '<div class="m-kv"><span>Gerät</span><span style="font-size:11px">' + esc(z.geraet || "—") + '</span></div>' +
      '<div class="m-kv"><span>App-Version</span><span>' + esc((w.PSBUILD && w.PSBUILD.version) || "Web") + '</span></div>' +
      '<div class="m-kv"><span>Speicher-Treiber · DB</span><span>' + esc(z.treiber) + " · v" + z.dbVersion + '</span></div>' +
      '<div class="m-kv"><span>Letzter Sync</span><span>' + (z.letzteSync ? fmtDT(z.letzteSync) : "—") + '</span></div>' +
      '<div class="m-kv"><span>Lokaler Speicher</span><span>' + Math.round(speicher / 1024) + ' kB · ' + (Offline.records() || []).length + ' Einträge</span></div>' +
      '<div class="m-kv"><span>Offene lokale Einträge</span><span>' + z.wartend + " wartend · " + z.konflikte + ' Konflikt</span></div></div>';
    html += '<div class="m-card"><button class="m-btn err" data-act="logout">Abmelden</button></div>';
    return html;
  }
  function abmelden() {
    var z = Offline.zusammenfassung(); var at = Offline.aktiverTimer();
    var offeneFotos = (Offline.records() || []).filter(function (r) { return r.typ === "foto" && r.status !== Sync.STATUS.SYNCED; }).length;
    var warnungen = [];
    if (at) warnungen.push("Es läuft ein Timer.");
    if (z.wartend) warnungen.push(z.wartend + " nicht synchronisierte Einträge.");
    if (z.konflikte) warnungen.push(z.konflikte + " offene Konflikte.");
    if (offeneFotos) warnungen.push(offeneFotos + " noch nicht hochgeladene Fotos.");
    var body = warnungen.length ? '<div class="m-note">' + warnungen.map(esc).join("<br>") + "<br><br>Diese lokalen Daten bleiben auf dem Gerät erhalten und werden beim nächsten Login synchronisiert.</div>" : '<div class="m-muted">Keine offenen lokalen Daten.</div>';
    modal("Abmelden?", body, [
      { label: "Abbrechen", cls: "ghost" },
      { label: at ? "Timer stoppen &amp; abmelden" : "Abmelden", cls: "err", fn: function () { if (at) beendenDialog(true); else { Auth.logout(); renderLogin(); } return true; } }
    ]);
  }

  // ============================================================
  //  AKTIONEN / BUCHUNG (über Offline-Kern)
  // ============================================================
  function buche(typ, daten) {
    var r = Offline.ereignis({ typ: typ, auftragId: daten.auftragId || aktAuftragId(), posIndex: daten.posIndex, schritt: daten.schritt || null, payload: daten.payload || {} }, daten.event || null);
    if (!r.ok) { toast("Nicht möglich: " + r.grund, "err"); return null; }
    // Bei Online-Verbindung sofort versuchen zu synchronisieren.
    if (online()) { var s = Offline.synchronisiere(); }
    return r;
  }
  function startDialog() {
    var a = S.auftragId ? auftrag(S.auftragId) : null;
    if (!a) { toast("Bitte zuerst einen Auftrag wählen.", "err"); S.view = "auftraege"; render(); return; }
    if (Offline.aktiverTimer()) { toast("Es läuft bereits ein Timer.", "err"); return; }
    var schritte = schrittWahl(a);
    modal("Arbeit starten", '<div class="m-muted">Auftrag ' + esc(auftragNr(a)) + '</div><label class="m-field"><span>Tätigkeit</span><select id="st-schritt">' + schritte.map(function (s) { return '<option>' + esc(s) + "</option>"; }).join("") + "</select></label>", [
      { label: "Abbrechen", cls: "ghost" },
      { label: "▶ Starten", cls: "accent", fn: function () { var r = Offline.timerStart({ auftragId: a.id, schritt: d.getElementById("st-schritt").value }); if (!r.ok) { toast("Start nicht möglich: " + r.grund, "err"); return false; } toast("Timer gestartet."); S.view = "zeit"; render(); return true; } }
    ]);
  }
  function beendenDialog(danachLogout) {
    var at = Offline.aktiverTimer(); if (!at) { toast("Kein laufender Timer.", "err"); return; }
    var body = '<div class="m-muted">' + fmtDur(at.sekunden) + " · " + esc(at.schritt || "") + "</div>" +
      '<div class="m-grid">' + numField("end-gut", "Gutteile", 0) + numField("end-aus", "Ausschuss", 0) + '</div>' +
      '<div class="m-grid">' + numField("end-nach", "Nacharbeit", 0) + '<label class="m-field"><span>abgeschlossen?</span><select id="end-fertig"><option value="nein">nein</option><option value="ja">ja</option></select></label></div>' +
      '<label class="m-field"><span>Notiz</span><input id="end-notiz"></label>';
    modal("Arbeit beenden", body, [
      { label: "Abbrechen", cls: "ghost" },
      { label: "⏹ Beenden", cls: "err", fn: function () {
        var gut = +d.getElementById("end-gut").value || 0, aus = +d.getElementById("end-aus").value || 0, nach = +d.getElementById("end-nach").value || 0;
        Offline.timerStop(at.timerId);
        if (gut || aus || nach) buche("stueckzahl", { auftragId: at.auftragId, schritt: at.schritt, payload: { gut: gut, ausschuss: aus, nacharbeit: nach, timerId: at.timerId } });
        if (d.getElementById("end-notiz").value || d.getElementById("end-fertig").value === "ja") buche("notiz", { auftragId: at.auftragId, schritt: at.schritt, payload: { notiz: d.getElementById("end-notiz").value, abgeschlossen: d.getElementById("end-fertig").value === "ja" } });
        if (online()) Offline.synchronisiere();
        toast("Arbeit beendet und gespeichert.");
        if (danachLogout) { Auth.logout(); renderLogin(); } else { S.view = "heute"; render(); }
        return true;
      } }
    ]);
    wireNum(d.getElementById("m-modal"));
  }
  function stueckDialog() {
    var a = S.auftragId ? auftrag(S.auftragId) : (Offline.aktiverTimer() ? auftrag(Offline.aktiverTimer().auftragId) : null);
    if (!a) { toast("Bitte Auftrag wählen.", "err"); return; }
    modal("Stückzahl melden", '<div class="m-grid">' + numField("s-gut", "Gutteile", 0) + numField("s-aus", "Ausschuss", 0) + '</div>' + numField("s-nach", "Nacharbeit", 0), [
      { label: "Abbrechen", cls: "ghost" },
      { label: "Melden", cls: "accent", fn: function () { var gut = +d.getElementById("s-gut").value || 0, aus = +d.getElementById("s-aus").value || 0, nach = +d.getElementById("s-nach").value || 0; if (gut < 0 || aus < 0 || nach < 0) { toast("Keine negativen Mengen.", "err"); return false; } if (!(gut + aus + nach)) { toast("Bitte Menge eingeben.", "err"); return false; } buche("stueckzahl", { auftragId: a.id, payload: { gut: gut, ausschuss: aus, nacharbeit: nach } }); toast("Stückzahl gemeldet."); render(); return true; } }
    ]);
    wireNum(d.getElementById("m-modal"));
  }
  function stillstandDialog() {
    var a = S.auftragId ? auftrag(S.auftragId) : null; if (!a) return;
    modal("Stillstand erfassen", '<label class="m-field"><span>Grund</span><select id="ss-grund">' + STILLSTAND.map(function (g) { return "<option>" + esc(g) + "</option>"; }).join("") + '</select></label>' + numField("ss-min", "Dauer (Minuten)", 0) + '<label class="m-field"><span>Notiz</span><input id="ss-notiz"></label>', [
      { label: "Abbrechen", cls: "ghost" }, { label: "Buchen", cls: "accent", fn: function () { buche("maschinenzeit", { auftragId: a.id, event: "STILLSTAND", payload: { grund: d.getElementById("ss-grund").value, minuten: +d.getElementById("ss-min").value || 0, notiz: d.getElementById("ss-notiz").value, maschineId: (d.getElementById("m-masch") || {}).value } }); toast("Stillstand erfasst."); render(); return true; } }
    ]);
    wireNum(d.getElementById("m-modal"));
  }
  function problemDialog() {
    modal("Problem melden", '<label class="m-field"><span>Beschreibung</span><textarea id="pr-text" rows="3"></textarea></label>', [
      { label: "Abbrechen", cls: "ghost" }, { label: "Melden", cls: "warn", fn: function () { var t = (d.getElementById("pr-text").value || "").trim(); if (!t) return false; buche("problem", { auftragId: S.auftragId, payload: { text: t } }); toast("Problem gemeldet (offline gespeichert)."); return true; } }
    ]);
  }

  // ---- Verdrahtung je View ----
  function wireView() {
    root().querySelectorAll("[data-nav-go]").forEach(function (b) { b.onclick = function () { S.view = b.getAttribute("data-nav-go"); render(); }; });
    root().querySelectorAll("[data-auf]").forEach(function (b) { b.onclick = function () { S.auftragId = b.getAttribute("data-auf"); S.view = "zeit"; render(); toast("Auftrag gewählt."); }; });
    var su = d.getElementById("m-suche"); if (su) su.oninput = function () { S.suche = su.value; var box = root(); /* leichte Live-Suche */ clearTimeout(su._t); su._t = setTimeout(render, 250); };
    root().querySelectorAll("[data-act]").forEach(function (b) { b.onclick = function () { var act = b.getAttribute("data-act"); resetInaktiv();
      if (act === "start") startDialog();
      else if (act === "stop") beendenDialog(false);
      else if (act === "pause") { var at = Offline.aktiverTimer(); if (at) { Offline.pauseStart(at.timerId); render(); toast("Pause."); } }
      else if (act === "resume") { var at2 = Offline.aktiverTimer(); if (at2) { Offline.pauseEnde(at2.timerId); render(); toast("Fortgesetzt."); } }
      else if (act === "material") materialDialog(auftrag(aktAuftragId()));
      else if (act === "montage") montageDialog(auftrag(aktAuftragId()));
      else if (act === "foto") fotoDialog(auftrag(aktAuftragId()));
      else if (act === "stueck") stueckDialog();
      else if (act === "stillstand") stillstandDialog();
      else if (act === "problem") problemDialog();
      else if (act === "sync") { var r = Offline.synchronisiere(); if (r.ok) toast("Sync: " + r.verarbeitet + " übernommen" + (r.konflikte ? ", " + r.konflikte + " Konflikt(e)" : "") + "."); else toast("Sync: " + r.grund, "err"); render(); }
      else if (act === "logout") abmelden();
    }; });
    root().querySelectorAll("[data-masch]").forEach(function (b) { b.onclick = function () { var mid = (d.getElementById("m-masch") || {}).value; buche("maschinenzeit", { auftragId: aktAuftragId(), event: b.getAttribute("data-masch"), payload: { maschineId: mid } }); toast("Maschinenbuchung erfasst."); render(); }; });
    root().querySelectorAll("[data-retry]").forEach(function (b) { b.onclick = function () { Offline.wiederholen(b.getAttribute("data-retry")); if (online()) Offline.synchronisiere(); render(); toast("Erneuter Versuch eingereiht."); }; });
    root().querySelectorAll("[data-storno]").forEach(function (b) { b.onclick = function () { if (w.confirm("Diesen lokalen Eintrag stornieren? Er wird als storniert markiert (nicht gelöscht).")) { Offline.stornieren(b.getAttribute("data-storno")); render(); toast("Eintrag storniert."); } }; });
    root().querySelectorAll("[data-dokoff]").forEach(function (b) { b.onclick = function () { var id = b.getAttribute("data-dokoff"); _offlineDocs[id] = !_offlineDocs[id]; render(); toast(_offlineDocs[id] ? "Offline verfügbar gemacht." : "Offline-Kopie entfernt."); }; });
    root().querySelectorAll("[data-dokopen]").forEach(function (b) { b.onclick = function () { var dk = (db().dokumente || []).filter(function (x) { return x.id === b.getAttribute("data-dokopen"); })[0]; if (dk && dk.inhalt) { var win = w.open(); if (win) win.document.write('<iframe src="' + dk.inhalt + '" style="border:0;position:fixed;inset:0;width:100%;height:100%"></iframe>'); } }; });
  }

  // ---- Installationshinweis (iOS/Android) ----
  var _installEvt = null;
  function installHinweis() {
    try {
      w.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); _installEvt = e; zeigeInstall("android"); });
      var iOS = /iphone|ipad|ipod/i.test(w.navigator.userAgent) && !w.navigator.standalone;
      var standalone = w.matchMedia && w.matchMedia("(display-mode: standalone)").matches;
      if (iOS && !standalone) zeigeInstall("ios");
    } catch (e) {}
  }
  function zeigeInstall(art) {
    if (d.getElementById("m-install") || (w.sessionStorage && w.sessionStorage.getItem("m-install-zu"))) return;
    var bar = d.createElement("div"); bar.id = "m-install"; bar.className = "m-install";
    bar.innerHTML = "<span>" + (art === "ios" ? 'Zum Installieren: Teilen-Symbol → „Zum Home-Bildschirm".' : "App installieren für Offline-Nutzung.") + '</span>' + (art === "android" ? '<button class="m-btn accent" id="m-inst-go" style="width:auto;min-height:40px">Installieren</button>' : "") + '<button class="m-btn ghost" id="m-inst-x" style="width:auto;min-height:40px">✕</button>';
    d.body.appendChild(bar);
    var go = d.getElementById("m-inst-go"); if (go) go.onclick = function () { if (_installEvt) { _installEvt.prompt(); } bar.remove(); };
    d.getElementById("m-inst-x").onclick = function () { try { w.sessionStorage.setItem("m-install-zu", "1"); } catch (e) {} bar.remove(); };
  }

  // ---- Start ----
  function boot() {
    if (!Store || !Offline || !Sync) { root().innerHTML = '<div class="m-loading">Fehler: Kern nicht geladen.</div>'; return; }
    try { Store.ladeRegistry(); } catch (e) {}
    installHinweis();
    if (Auth.restore && Auth.restore()) { render(); } else renderLogin();
    w.addEventListener("online", function () { render(); });
    w.addEventListener("offline", function () { render(); });
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot); else boot();
})(window, document);
