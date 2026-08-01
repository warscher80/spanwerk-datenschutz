/* ============================================================
   Preisschmiede – Offline-Synchronisationskern (Phase 14A)
   Reine, testbare Logik (ohne IndexedDB/Netzwerk): ereignis-
   basierte Zeiterfassung, Idempotenz, Synchronisationswarte-
   schlange, Wiederholungsstrategie, Konfliktprüfung, Geräte-/
   Serverzeit-Abweichung, Ein-Timer-Garantie, Offline-Datenumfang.
   Die IndexedDB-Anbindung liegt in offlinedb.js, das Ausführen in
   offline-app.js. Zielspeicher der Synchronisation ist die
   bestehende zentrale Datenhaltung (Store). EHRLICH: kein echter
   Server; Offline-Daten gelten bei der Synchronisation immer als
   nicht vertrauenswürdig und werden erneut validiert.
   ============================================================ */
(function (w) {
  "use strict";
  w.Preisschmiede = w.Preisschmiede || {};
  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
  function ms(iso) { return new Date(iso).getTime(); }

  // Stabile lokale UUID (deterministisch genug offline; kein Krypto-Zufall nötig).
  var _c = 0;
  function uuid(seed) { _c = (_c + 1) % 1e6; return "loc-" + (seed != null ? String(seed) + "-" : "") + Math.abs(hashStr(String(seed) + "|" + _c)).toString(36); }
  function hashStr(s) { var h = 0x811c9dc5 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  // Stabiler Idempotenzschlüssel aus fachlichen Bestandteilen (nicht aus Zufall).
  function idempotenzKey() { return Array.prototype.slice.call(arguments).map(function (x) { return String(x == null ? "" : x); }).join("::"); }

  var STATUS = { LOCAL_ONLY: "LOCAL_ONLY", QUEUED: "QUEUED", SYNCING: "SYNCING", SYNCED: "SYNCED", RETRY: "RETRY", CONFLICT: "CONFLICT", CANCELLED: "CANCELLED" };
  var EVENTS = ["TIMER_STARTED", "BREAK_STARTED", "BREAK_ENDED", "TIMER_STOPPED", "ENTRY_CORRECTED", "ENTRY_CANCELLED"];
  // Synchronisationsreihenfolge (kleinere Zahl zuerst)
  var TYP_PRIO = { timer: 1, maschinenzeit: 2, ruestzeit: 2, stueckzahl: 3, ausschuss: 3, materialverbrauch: 4, montage: 5 };
  var MAX_VERSUCHE = 5;
  var DB_VERSION = 1; // IndexedDB-Schema-Version (Migration in offlinedb.js)

  // ---- Datensatz -----------------------------------------------------
  function recordNeu(daten, jetztISO) {
    daten = daten || {};
    var geraetezeit = daten.geraetezeit || jetztISO;
    var key = daten.idempotenzKey || idempotenzKey(daten.typ, daten.event || "", daten.timerId || "", daten.auftragId || "", daten.schritt || "", geraetezeit);
    return {
      id: daten.id || uuid(key), mandantId: daten.mandantId || null, benutzer: daten.benutzer || null, geraet: daten.geraet || null,
      typ: daten.typ || "timer", event: daten.event || null, timerId: daten.timerId || null,
      auftragId: daten.auftragId || null, posIndex: daten.posIndex != null ? daten.posIndex : null, schritt: daten.schritt || null,
      geraetezeit: geraetezeit, serverzeitBekannt: daten.serverzeitBekannt || null, zeitzone: daten.zeitzone || null,
      payload: daten.payload || {}, dependsOn: daten.dependsOn || null,
      erstellt: jetztISO, geaendert: jetztISO, idempotenzKey: key,
      status: STATUS.LOCAL_ONLY, versuch: 0, naechsterVersuch: null, serverRef: null, version: 1, fehler: null
    };
  }
  function timerEreignis(daten, event, jetztISO) { return recordNeu(Object.assign({}, daten, { typ: "timer", event: event }), jetztISO); }

  // ---- Dauer aus Ereignissen (unveränderbare Ereigniskette) ---------
  // events: alle Ereignisse EINES Timers. jetztISO: für laufenden Timer.
  function dauerAusEreignissen(events, jetztISO) {
    var evs = (events || []).slice().sort(function (a, b) { return ms(a.geraetezeit) - ms(b.geraetezeit); });
    var start = null, pauseStart = null, pausenMs = 0, stop = null, cancelled = false, corrected = null, aufPause = false;
    evs.forEach(function (e) {
      if (e.event === "TIMER_STARTED" && start == null) start = e.geraetezeit;
      else if (e.event === "BREAK_STARTED" && pauseStart == null) { pauseStart = e.geraetezeit; aufPause = true; }
      else if (e.event === "BREAK_ENDED" && pauseStart != null) { pausenMs += ms(e.geraetezeit) - ms(pauseStart); pauseStart = null; aufPause = false; }
      else if (e.event === "TIMER_STOPPED") stop = e.geraetezeit;
      else if (e.event === "ENTRY_CANCELLED") cancelled = true;
      else if (e.event === "ENTRY_CORRECTED") corrected = num(e.payload && e.payload.dauerSekunden);
    });
    if (start == null) return { sekunden: 0, aktiv: false, gestartet: false, aufPause: false };
    if (cancelled) return { sekunden: 0, aktiv: false, gestartet: true, abgebrochen: true, aufPause: false };
    var aktiv = stop == null;
    if (corrected != null) return { sekunden: Math.max(0, corrected), aktiv: aktiv, gestartet: true, korrigiert: true, aufPause: aufPause };
    var ende = stop != null ? ms(stop) : ms(jetztISO || new Date().toISOString());
    var offenePause = pauseStart != null ? (ende - ms(pauseStart)) : 0;
    var laufMs = ende - ms(start) - pausenMs - offenePause;
    return { sekunden: Math.max(0, Math.round(laufMs / 1000)), aktiv: aktiv, gestartet: true, aufPause: aufPause, gestartetAm: start, gestopptAm: stop };
  }

  // Gruppiert Timer-Ereignisse nach timerId.
  function timerGruppen(events) {
    var g = {}; (events || []).filter(function (e) { return e.typ === "timer"; }).forEach(function (e) { (g[e.timerId] = g[e.timerId] || []).push(e); }); return g;
  }
  // Rekonstruiert den (höchstens einen) aktiven Timer eines Benutzers.
  function aktiverTimer(events, benutzer, jetztISO) {
    var g = timerGruppen(events); var treffer = null;
    Object.keys(g).forEach(function (tid) {
      var evs = g[tid]; var b = (evs[0] || {}).benutzer;
      if (benutzer != null && b !== benutzer) return;
      var d = dauerAusEreignissen(evs, jetztISO);
      if (d.aktiv) { var first = evs[0]; treffer = { timerId: tid, benutzer: b, mandantId: first.mandantId, auftragId: first.auftragId, posIndex: first.posIndex, schritt: first.schritt, seit: d.gestartetAm, aufPause: d.aufPause, sekunden: d.sekunden }; }
    });
    return treffer;
  }

  // ---- Ein-Timer-Garantie + Guards ----------------------------------
  function guardStart(events, daten, jetztISO) {
    var aktiv = aktiverTimer(events, daten.benutzer, jetztISO);
    if (aktiv) {
      if (aktiv.timerId === daten.timerId) return { ok: false, grund: "doppeltes Tippen" };
      if (aktiv.mandantId !== daten.mandantId) return { ok: false, grund: "Timer in anderem Mandanten aktiv" };
      return { ok: false, grund: "bereits ein Timer aktiv" };
    }
    return { ok: true };
  }
  function guardStop(events, timerId, jetztISO) {
    var g = timerGruppen(events)[timerId];
    if (!g || !g.some(function (e) { return e.event === "TIMER_STARTED"; })) return { ok: false, grund: "Stop ohne Start" };
    var d = dauerAusEreignissen(g, jetztISO);
    if (!d.aktiv) return { ok: false, grund: "Timer bereits beendet" };
    return { ok: true };
  }
  function guardPause(events, timerId, starten, jetztISO) {
    var g = timerGruppen(events)[timerId]; if (!g) return { ok: false, grund: "kein Timer" };
    var d = dauerAusEreignissen(g, jetztISO);
    if (!d.aktiv) return { ok: false, grund: "Timer nicht aktiv" };
    if (starten && d.aufPause) return { ok: false, grund: "bereits pausiert" };
    if (!starten && !d.aufPause) return { ok: false, grund: "keine laufende Pause" };
    return { ok: true };
  }

  // ---- Synchronisationswarteschlange --------------------------------
  // Idempotentes Einreihen: gleicher Idempotenzschlüssel wird nicht doppelt eingereiht.
  function enqueue(queue, record) {
    queue = queue || [];
    var vorhanden = queue.filter(function (r) { return r.idempotenzKey === record.idempotenzKey; })[0];
    if (vorhanden) return { record: vorhanden, neu: false };
    record.status = STATUS.QUEUED; queue.push(record);
    return { record: record, neu: true };
  }
  function backoffMs(versuch) { var stufen = [1000, 5000, 15000, 60000, 300000]; return stufen[Math.min(versuch, stufen.length - 1)]; }
  // Nächste synchronisierbare Einträge in korrekter Reihenfolge, nur wenn
  // Abhängigkeiten (dependsOn) bereits SYNCED sind und der Retry fällig ist.
  function faellig(queue, jetztISO) {
    var jetzt = ms(jetztISO || new Date().toISOString());
    var syncedIds = {}; (queue || []).forEach(function (r) { if (r.status === STATUS.SYNCED) syncedIds[r.id] = true; });
    return (queue || []).filter(function (r) {
      if (r.status !== STATUS.QUEUED && r.status !== STATUS.RETRY) return false;
      if (r.status === STATUS.RETRY && r.naechsterVersuch && ms(r.naechsterVersuch) > jetzt) return false;
      if (r.dependsOn && !syncedIds[r.dependsOn]) return false;
      return true;
    }).sort(function (a, b) { return (TYP_PRIO[a.typ] || 9) - (TYP_PRIO[b.typ] || 9) || ms(a.erstellt) - ms(b.erstellt); });
  }
  // Verarbeitet EINEN Datensatz. applyFn(record) -> {ok, serverRef} |
  // {konflikt, grund} | {fehler, temporaer}. Exactly-once: bereits SYNCED ->
  // vorhandener Serverbezug wird zurückgegeben, kein zweiter Datensatz.
  function verarbeite(record, applyFn, jetztISO) {
    if (record.status === STATUS.SYNCED) return { schon: true, serverRef: record.serverRef };
    if (record.status === STATUS.CANCELLED || record.status === STATUS.CONFLICT) return { uebersprungen: true, status: record.status };
    record.status = STATUS.SYNCING; record.versuch += 1; record.geaendert = jetztISO;
    var r; try { r = applyFn(record); } catch (e) { r = { fehler: (e && e.message) || "Fehler", temporaer: true }; }
    if (r && r.ok) { record.status = STATUS.SYNCED; record.serverRef = r.serverRef != null ? r.serverRef : record.serverRef; record.fehler = null; record.naechsterVersuch = null; }
    else if (r && r.konflikt) { record.status = STATUS.CONFLICT; record.fehler = r.grund || "Konflikt"; }
    else {
      record.fehler = (r && (r.fehler || r.grund)) || "unbekannt";
      if (r && r.temporaer === false) { record.status = STATUS.CONFLICT; } // permanenter Validierungsfehler -> Prüfpunkt
      else if (record.versuch < MAX_VERSUCHE) { record.status = STATUS.RETRY; record.naechsterVersuch = new Date(ms(jetztISO) + backoffMs(record.versuch)).toISOString(); }
      else { record.status = STATUS.CONFLICT; record.fehler = "max. Versuche erreicht: " + record.fehler; }
    }
    return { status: record.status, serverRef: record.serverRef, fehler: record.fehler };
  }
  function manuellWiederholen(record) { if (record.status === STATUS.RETRY || record.status === STATUS.CONFLICT) { record.status = STATUS.QUEUED; record.naechsterVersuch = null; } return record; }

  // ---- Geräte-/Serverzeit -------------------------------------------
  function zeitAbweichungMs(geraetezeit, serverzeit) { if (!geraetezeit || !serverzeit) return 0; return ms(geraetezeit) - ms(serverzeit); }
  function zeitPlausibel(geraetezeit, serverzeit, maxDriftMs) { if (!serverzeit) return true; return Math.abs(zeitAbweichungMs(geraetezeit, serverzeit)) <= (maxDriftMs || 5 * 60000); }

  // ---- Konfliktprüfung (bei Synchronisation) ------------------------
  // Offline-Daten sind nicht vertrauenswürdig -> gegen aktuellen Kontext prüfen.
  function pruefeKonflikt(record, kontext) {
    kontext = kontext || {};
    if (kontext.sitzungGueltig === false) return { konflikt: true, grund: "Sitzung abgelaufen" };
    if (kontext.benutzerAktiv === false) return { konflikt: true, grund: "Benutzer deaktiviert/entfernt" };
    if (kontext.geraetAktiv === false) return { konflikt: true, grund: "Gerät deaktiviert" };
    if (kontext.mandantZugeordnet === false) return { konflikt: true, grund: "Mandantenzuordnung geändert" };
    if (record.mandantId != null && kontext.aktiverMandantId != null && record.mandantId !== kontext.aktiverMandantId) return { konflikt: true, grund: "Cross-Tenant – fremder Mandant" };
    if (kontext.auftragVorhanden === false) return { konflikt: true, grund: "Arbeitsgang/Auftrag nicht mehr vorhanden" };
    if (kontext.auftragAbgeschlossen === true) return { konflikt: true, grund: "Auftrag bereits abgeschlossen" };
    if (kontext.maschineBelegt === true) return { konflikt: true, grund: "Maschine bereits belegt" };
    if (kontext.materialArchiviert === true) return { konflikt: true, grund: "Material archiviert" };
    if (kontext.serverVersion != null && record.version != null && kontext.serverVersion > record.version) return { konflikt: true, grund: "Serverdatensatz geändert" };
    if (kontext.fremderTimerAktiv === true) return { konflikt: true, grund: "Timer auf anderem Gerät aktiv" };
    if (kontext.zeitPlausibel === false) return { konflikt: true, grund: "Gerätezeit unplausibel – manuelle Prüfung" };
    return { konflikt: false };
  }

  // ---- Offline-Datenumfang (Whitelist; keine vertraulichen Felder) --
  var OFFLINE_VERBOTEN = ["gewinn", "deckungsbeitrag", "selbst", "selbstkosten", "einkauf", "einkaufspreis", "materialaufschlag", "internerSatz", "internenotiz"];
  // Reduziert einen Auftrag auf die für die Werkstatt nötigen Felder.
  function auftragOffline(a) {
    if (!a) return null;
    var pos = (a.positionen || []).map(function (p) { return { produktKey: p.produktKey, label: p.label, kalk: p.kalk && p.kalk.zeiten ? { zeiten: p.kalk.zeiten } : { zeiten: {} } }; });
    return { id: a.id, kommission: a.kommission, titel: a.titel, kundeId: a.kundeId, status: a.status, positionen: pos, mandantId: a.mandantId || null };
  }
  function offlineDatensatzRein(obj) {
    var s = JSON.stringify(obj || {});
    return !OFFLINE_VERBOTEN.some(function (k) { return new RegExp('"' + k + '"\\s*:').test(s); });
  }

  // ---- Zusammenfassung / Diagnose -----------------------------------
  function zusammenfassung(queue, events, jetztISO) {
    queue = queue || [];
    function count(st) { return queue.filter(function (r) { return r.status === st; }).length; }
    return {
      lokal: queue.filter(function (r) { return r.status === STATUS.LOCAL_ONLY || r.status === STATUS.QUEUED; }).length,
      wartend: count(STATUS.QUEUED) + count(STATUS.RETRY), synchronisiert: count(STATUS.SYNCED),
      konflikte: count(STATUS.CONFLICT), retry: count(STATUS.RETRY),
      aktiverTimer: aktiverTimer(events, null, jetztISO), dbVersion: DB_VERSION
    };
  }

  w.Preisschmiede.Sync = {
    STATUS: STATUS, EVENTS: EVENTS, TYP_PRIO: TYP_PRIO, MAX_VERSUCHE: MAX_VERSUCHE, DB_VERSION: DB_VERSION,
    uuid: uuid, idempotenzKey: idempotenzKey, recordNeu: recordNeu, timerEreignis: timerEreignis,
    dauerAusEreignissen: dauerAusEreignissen, timerGruppen: timerGruppen, aktiverTimer: aktiverTimer,
    guardStart: guardStart, guardStop: guardStop, guardPause: guardPause,
    enqueue: enqueue, backoffMs: backoffMs, faellig: faellig, verarbeite: verarbeite, manuellWiederholen: manuellWiederholen,
    zeitAbweichungMs: zeitAbweichungMs, zeitPlausibel: zeitPlausibel, pruefeKonflikt: pruefeKonflikt,
    auftragOffline: auftragOffline, offlineDatensatzRein: offlineDatensatzRein, OFFLINE_VERBOTEN: OFFLINE_VERBOTEN,
    zusammenfassung: zusammenfassung
  };
})(typeof self !== "undefined" ? self : this);
