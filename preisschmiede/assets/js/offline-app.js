/* ============================================================
   Preisschmiede – Offline-Integration (Phase 14A)
   Verbindet die reine Sync-Engine (sync.js) mit dem dauerhaften
   Speicher (offlinedb.js), dem Service Worker und der zentralen
   Datenhaltung (Store). Registriert den Service Worker, erkennt
   Updates, hält einen neustartfesten In-Memory-Spiegel der Offline-
   Datensätze und synchronisiert idempotent (exactly-once) in die
   aktive Mandanten-db. KEINE reine In-Memory-Haltung: jeder
   Datensatz wird sofort in IndexedDB/localStorage persistiert.
   ============================================================ */
(function (w, d) {
  "use strict";
  var P = w.Preisschmiede || {};
  var Sync = P.Sync, ODB = P.OfflineDB, Store = P.Store, Auth = P.Auth;

  var _records = [];       // neustartfester Spiegel (Quelle: OfflineDB)
  var _geraet = null;
  var _bereit = false;
  var _updateBereit = false;

  function nowISO() { return Store ? Store.nowISO() : new Date().toISOString(); }
  function online() { try { return w.navigator ? w.navigator.onLine !== false : true; } catch (e) { return true; } }
  function benutzer() { var u = Auth && Auth.current(); return u ? u.benutzername : null; }
  function aktiverMandantId() { try { var m = Store.aktiverMandant(); return m ? m.id : null; } catch (e) { return null; } }

  // ---- Geräte-Identität (stabil, lokal) -----------------------------
  function ensureGeraet() {
    return ODB.metaGet("geraet").then(function (m) {
      if (m && m.wert) { _geraet = m.wert; return _geraet; }
      _geraet = "dev-" + Sync.uuid("geraet") + "-" + (Store ? Store.makeSalt() : Math.random().toString(36).slice(2, 8));
      return ODB.metaSet("geraet", _geraet).then(function () { return _geraet; });
    });
  }

  // ---- Serverzeit / Zeitabweichung (offline: Store als Referenz) ----
  function serverzeit() { return nowISO(); }
  function meta() {
    var sz = serverzeit(), gz = new Date().toISOString();
    var drift = Sync.zeitAbweichungMs(gz, sz);
    ODB.metaSet("letzteServerzeit", sz);
    ODB.metaSet("zeitdrift", drift);
    return { geraetezeit: gz, serverzeit: sz, drift: drift, zeitzone: (Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : null };
  }

  // ---- Persistenz ----------------------------------------------------
  function persist(r) { return ODB.speichereRecord(r); }
  function ladeRecords() { return ODB.alleRecords().then(function (arr) { _records = arr || []; return _records; }); }
  function timerEvents() { return _records.filter(function (r) { return r.typ === "timer"; }); }

  // ---- Ereignis erfassen (durabel + eingereiht) ---------------------
  // event: einer aus Sync.EVENTS. daten: {auftragId,posIndex,schritt,typ?,payload?}
  function ereignis(daten, event) {
    if (!_bereit) return { ok: false, grund: "Offline-Speicher nicht bereit" };
    var mz = meta();
    var basis = {
      mandantId: daten.mandantId != null ? daten.mandantId : aktiverMandantId(), benutzer: daten.benutzer || benutzer(), geraet: _geraet,
      typ: daten.typ || "timer", auftragId: daten.auftragId || null, posIndex: daten.posIndex, schritt: daten.schritt || null,
      timerId: daten.timerId || null, geraetezeit: mz.geraetezeit, serverzeitBekannt: mz.serverzeit, zeitzone: mz.zeitzone, payload: daten.payload || {}
    };
    // Guards (Ein-Timer-Garantie / Reihenfolge)
    if (basis.typ === "timer") {
      if (event === "TIMER_STARTED") { var g = Sync.guardStart(_records, basis, mz.geraetezeit); if (!g.ok) return { ok: false, grund: g.grund }; }
      if (event === "TIMER_STOPPED") { var gs = Sync.guardStop(_records, basis.timerId, mz.geraetezeit); if (!gs.ok) return { ok: false, grund: gs.grund }; }
      if (event === "BREAK_STARTED" || event === "BREAK_ENDED") { var gp = Sync.guardPause(_records, basis.timerId, event === "BREAK_STARTED", mz.geraetezeit); if (!gp.ok) return { ok: false, grund: gp.grund }; }
    }
    var rec = basis.typ === "timer" ? Sync.timerEreignis(basis, event, nowISO()) : Sync.recordNeu(Object.assign({}, basis, { event: event }), nowISO());
    var eq = Sync.enqueue(_records, rec);       // Idempotenz beim Einreihen
    persist(eq.record);
    return { ok: true, record: eq.record, neu: eq.neu };
  }
  // Bequeme Timer-Aktionen (liefern timerId zurück)
  function timerStart(daten) { var tid = "t-" + Sync.uuid("timer"); var r = ereignis(Object.assign({}, daten, { timerId: tid, typ: "timer" }), "TIMER_STARTED"); return r.ok ? Object.assign(r, { timerId: tid }) : r; }
  // Kontext (Auftrag/Schritt) aus dem Start-Ereignis des Timers übernehmen.
  function timerKontext(timerId) {
    var start = timerEvents().filter(function (e) { return e.timerId === timerId && e.event === "TIMER_STARTED"; })[0] || {};
    return { auftragId: start.auftragId || null, posIndex: start.posIndex, schritt: start.schritt || null };
  }
  function pauseStart(timerId) { return ereignis(Object.assign({ timerId: timerId, typ: "timer" }, timerKontext(timerId)), "BREAK_STARTED"); }
  function pauseEnde(timerId) { return ereignis(Object.assign({ timerId: timerId, typ: "timer" }, timerKontext(timerId)), "BREAK_ENDED"); }
  function timerStop(timerId) { return ereignis(Object.assign({ timerId: timerId, typ: "timer" }, timerKontext(timerId)), "TIMER_STOPPED"); }
  function aktiverTimer() { return Sync.aktiverTimer(timerEvents(), benutzer(), nowISO()); }

  // ---- Synchronisation (exactly-once) in die aktive Mandanten-db ----
  function kontextFuer(rec, db) {
    var aktivM = aktiverMandantId();
    var auf = (db.auftraege || []).filter(function (a) { return a.id === rec.auftragId; })[0];
    var u = (db.users || []).filter(function (x) { return x.benutzername === rec.benutzer; })[0];
    return {
      sitzungGueltig: !!Auth.current(), benutzerAktiv: !rec.benutzer || (u ? u.aktiv !== false : false),
      geraetAktiv: true, mandantZugeordnet: true, aktiverMandantId: aktivM,
      auftragVorhanden: !rec.auftragId || !!auf, auftragAbgeschlossen: auf ? auf.status === "Abgeschlossen" : false,
      zeitPlausibel: Sync.zeitPlausibel(rec.geraetezeit, rec.serverzeitBekannt, 6 * 60 * 60000)
    };
  }
  // Baut den Lager-Zustandsadapter über die db-Arrays (dieselben Referenzen).
  function lagerState(db) {
    return {
      artikel: db.lagerArtikel, plaetze: db.lagerplaetze, chargen: db.lagerChargen, bewegungen: db.lagerBewegungen,
      reservierungen: db.lagerReservierungen, reststuecke: db.lagerReststuecke, wareneingaenge: db.wareneingaenge,
      bestellungen: db.bestellungen, konflikte: db.lagerKonflikte, inventuren: db.lagerInventuren
    };
  }
  // Zustandsadapter für den Qualitätskern (dieselben db-Arrays).
  function qualState(db) {
    return {
      stammdaten: (db.settings.qualitaet || {}).stammdaten || null,
      pruefplaene: db.qualPruefplaene, pruefauftraege: db.qualPruefauftraege, abweichungen: db.qualAbweichungen,
      sperren: db.qualSperren, nacharbeiten: db.qualNacharbeiten, ausschuss: db.qualAusschuss,
      sonderfreigaben: db.qualSonderfreigaben, massnahmen: db.qualMassnahmen, reklamationen: db.qualReklamationen,
      lieferantenReklamationen: db.qualLieferantenReklamationen, pruefmittel: db.qualPruefmittel,
      qualitaetskosten: db.qualKosten, audit: db.qualAudit, wareneingangspruefungen: db.qualWareneingangspruefungen,
      konflikte: db.qualKonflikte, abnahmen: db.qualAbnahmen, portalFreigaben: db.qualPortalFreigaben
    };
  }
  // Wendet einen (validierten) Datensatz idempotent auf die zentrale db an.
  function anwenden(rec, db) {
    // Lager-Bewegung (Phase 15B, mobil): über den Phase-15A-Lagerkern erneut
    // validieren und idempotent ins Bewegungsjournal übernehmen. KEINE zweite
    // Bestandslogik – exactly-once über denselben Idempotenzschlüssel.
    if (rec.typ === "lager") {
      var Lager = P.Lager; if (!Lager) return { fehler: "Lagerkern nicht geladen", temporaer: true };
      var daten = Object.assign({}, rec.payload || {}, { idempotenzKey: rec.idempotenzKey, mandantId: rec.mandantId, benutzer: rec.benutzer });
      var lres = Lager.uebernehmeOffline(lagerState(db), daten, nowISO());
      if (!lres.ok) return { konflikt: true, grund: lres.grund };
      return { ok: true, serverRef: lres.bewegung ? lres.bewegung.id : null };
    }
    // Qualitäts-Datensatz (Phase 16B, mobil): über den Phase-16A-Qualitätskern
    // erneut validieren, Toleranz ZENTRAL neu berechnen, idempotent übernehmen.
    // KEINE zweite Prüf-/Toleranzlogik, keine automatische Freigabe offline.
    if (rec.typ === "qualitaet") {
      var Qual = P.Qualitaet; if (!Qual) return { fehler: "Qualitätskern nicht geladen", temporaer: true };
      var qs = qualState(db);
      var qdaten = Object.assign({}, rec.payload || {}, { idempotenzKey: rec.idempotenzKey, mandantId: rec.mandantId, benutzer: rec.benutzer });
      // Berechtigung beim Sync erneut prüfen (Offline-Daten sind nicht vertrauenswürdig).
      if (qdaten.rolle && qdaten.aktion === "abweichung" && !Qual.darf(qdaten.rolle, "abweichungAnlegen")) return { konflikt: true, grund: "Keine Berechtigung für Abweichungen" };
      if (qdaten.aktion === "abnahme") {
        var ab = Qual.abnahmeNeu(qs, qdaten, nowISO());
        return ab.ok ? { ok: true, serverRef: ab.abnahme.id } : { konflikt: true, grund: ab.grund };
      }
      var qres = Qual.uebernehmeOffline(qs, qdaten, nowISO());
      if (!qres.ok) return { konflikt: true, grund: qres.grund };
      return { ok: true, serverRef: (qres.ergebnisEintrag && qres.ergebnisEintrag.id) || (qres.abweichung && qres.abweichung.id) || null };
    }
    // Exactly-once auf zentraler Seite: je idempotenzKey höchstens eine Buchung.
    var vorhanden = (db.offlineBuchungen || []).filter(function (b) { return b.idempotenzKey === rec.idempotenzKey; })[0];
    if (vorhanden) return { ok: true, serverRef: vorhanden.id };
    // Für einen Timer-Stopp die Dauer aus der Ereigniskette berechnen.
    var buchung = { id: "ob-" + Sync.uuid("buch"), idempotenzKey: rec.idempotenzKey, typ: rec.typ, event: rec.event, mandantId: rec.mandantId, benutzer: rec.benutzer, geraet: rec.geraet, auftragId: rec.auftragId, schritt: rec.schritt, zeitpunkt: rec.geraetezeit, gebuchtAm: nowISO() };
    if (rec.typ === "timer" && rec.event === "TIMER_STOPPED") {
      var evs = timerEvents().filter(function (e) { return e.timerId === rec.timerId; });
      var dauer = Sync.dauerAusEreignissen(evs, nowISO());
      buchung.sekunden = dauer.sekunden; buchung.stunden = Math.round(dauer.sekunden / 36) / 100;
    }
    (db.offlineBuchungen = db.offlineBuchungen || []).push(buchung);
    return { ok: true, serverRef: buchung.id };
  }
  function synchronisiere() {
    if (!_bereit || !Store) return { ok: false, grund: "nicht bereit" };
    if (!online()) return { ok: false, grund: "offline" };
    var db = Store.load();
    var jetzt = nowISO();
    var liste = Sync.faellig(_records, jetzt);
    var verarbeitet = 0, konflikte = 0;
    liste.forEach(function (rec) {
      // Lager-Datensätze validiert der Lagerkern selbst (in anwenden); die
      // timer-orientierte Konfliktprüfung greift dort nicht.
      var kf = (rec.typ === "lager" || rec.typ === "qualitaet") ? { konflikt: false } : Sync.pruefeKonflikt(rec, kontextFuer(rec, db));
      var applyFn = function (r) { if (kf.konflikt) return { konflikt: true, grund: kf.grund }; return anwenden(r, db); };
      var res = Sync.verarbeite(rec, applyFn, jetzt);
      if (res.status === Sync.STATUS.SYNCED) verarbeitet++;
      else if (res.status === Sync.STATUS.CONFLICT) konflikte++;
      persist(rec);
    });
    Store.save();
    return { ok: true, verarbeitet: verarbeitet, konflikte: konflikte };
  }
  function wiederholen(recordId) { var r = _records.filter(function (x) { return x.id === recordId; })[0]; if (r) { Sync.manuellWiederholen(r); persist(r); } return r; }
  // Lokalen Eintrag kontrolliert stornieren (nur mit ausdrücklicher Bestätigung;
  // Daten werden nicht gelöscht, sondern als CANCELLED markiert und bleiben erhalten).
  function stornieren(recordId) { var r = _records.filter(function (x) { return x.id === recordId; })[0]; if (r) { r.status = Sync.STATUS.CANCELLED; r.geaendert = nowISO(); persist(r); } return r; }
  function record(recordId) { return _records.filter(function (x) { return x.id === recordId; })[0]; }

  function zusammenfassung() {
    var z = Sync.zusammenfassung(_records, timerEvents(), nowISO());
    z.online = online(); z.geraet = _geraet; z.treiber = ODB ? ODB.treiber() : "-"; z.dbVersion = Sync.DB_VERSION;
    z.letzteSync = _letzteSync; z.updateBereit = _updateBereit; z.bereit = _bereit;
    return z;
  }
  function konflikte() { return _records.filter(function (r) { return r.status === Sync.STATUS.CONFLICT; }); }
  var _letzteSync = null;

  // ---- Service Worker ------------------------------------------------
  function registerSW() {
    if (!("serviceWorker" in w.navigator) || w.location.protocol === "file:") return;
    try {
      w.navigator.serviceWorker.register("sw.js").then(function (reg) {
        reg.addEventListener("updatefound", function () {
          var neu = reg.installing; if (!neu) return;
          neu.addEventListener("statechange", function () { if (neu.state === "installed" && w.navigator.serviceWorker.controller) { _updateBereit = true; zeigeUpdateHinweis(reg); } });
        });
        // Von sich aus prüft der Browser nur bei einer Navigation auf eine neue
        // Version. Eine als App installierte PWA wird auf iOS aber tagelang
        // nicht neu geladen – ohne aktives Nachfragen bliebe ein Update dort
        // bis zum nächsten Kaltstart unbemerkt. Darum: beim Zurückholen in den
        // Vordergrund und zusätzlich regelmäßig nachsehen, gedrosselt auf
        // höchstens einmal alle 15 Minuten.
        var letzteFrage = 0;
        function frageNachUpdate() {
          var jetzt = Date.now();
          if (jetzt - letzteFrage < 15 * 60 * 1000) return;
          letzteFrage = jetzt;
          try { reg.update(); } catch (e) {}
        }
        d.addEventListener("visibilitychange", function () { if (!d.hidden) frageNachUpdate(); });
        setInterval(frageNachUpdate, 30 * 60 * 1000);
      }).catch(function () {});
      var reloaded = false;
      w.navigator.serviceWorker.addEventListener("controllerchange", function () { if (reloaded) return; reloaded = true; w.location.reload(); });
    } catch (e) {}
  }
  function zeigeUpdateHinweis(reg) {
    // Kritische Speicherung schützen: Update nur anwenden, wenn kein Timer läuft.
    try {
      var bar = d.getElementById("update-hinweis");
      if (!bar) { bar = d.createElement("div"); bar.id = "update-hinweis"; bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;background:#12181f;color:#fff;padding:10px 14px;font-size:13px;z-index:9999;display:flex;justify-content:space-between;align-items:center;gap:10px"; d.body.appendChild(bar); }
      bar.innerHTML = '<span>Neue Version verfügbar.' + (aktiverTimer() ? " Bitte laufenden Timer zuerst stoppen." : "") + '</span><button id="update-jetzt" style="padding:6px 12px">Aktualisieren</button>';
      d.getElementById("update-jetzt").onclick = function () { if (aktiverTimer()) { alert("Bitte zuerst den laufenden Timer stoppen (Datenschutz vor Datenverlust)."); return; } if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING"); };
    } catch (e) {}
  }

  // ---- Init ----------------------------------------------------------
  function init() {
    if (!Sync || !ODB) return;
    // Sicherheitsnetz: falls der Speicher blockiert/hängt, Betrieb nicht verhindern.
    var fallback = w.setTimeout ? w.setTimeout(function () { if (!_bereit) { _bereit = true; try { w.dispatchEvent(new Event("offline-bereit")); } catch (e) {} } }, 2500) : null;
    ensureGeraet().then(ladeRecords).then(function () { if (fallback) w.clearTimeout(fallback); _bereit = true; try { w.dispatchEvent(new Event("offline-bereit")); } catch (e) {} }).catch(function () { _bereit = true; });
    try { w.addEventListener("online", function () { synchronisiere(); }); } catch (e) {}
    registerSW();
  }

  w.Preisschmiede.Offline = {
    init: init, bereit: function () { return _bereit; }, online: online, geraet: function () { return _geraet; },
    ereignis: ereignis, timerStart: timerStart, pauseStart: pauseStart, pauseEnde: pauseEnde, timerStop: timerStop,
    aktiverTimer: aktiverTimer, synchronisiere: function () { var r = synchronisiere(); if (r.ok) _letzteSync = nowISO(); return r; },
    wiederholen: wiederholen, stornieren: stornieren, record: record, zusammenfassung: zusammenfassung, konflikte: konflikte, ladeRecords: ladeRecords, records: function () { return _records; }, meta: meta
  };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : this, typeof document !== "undefined" ? document : { readyState: "complete", getElementById: function () { return null; }, createElement: function () { return {}; }, body: {}, addEventListener: function () {} });
