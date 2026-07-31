/* ============================================================
   Preisschmiede – Betrieb, Monitoring & Pilot (Phase 9)
   Reine, testbare Betriebs-Engine: Release-Stufen, Systemstatus,
   Healthchecks, Backup-Überwachung, aggregierte Betriebswarnungen,
   anonymisiertes Support-Paket, Feedback-/Fehlerlog-Modelle,
   Pilotkennzahlen.
   GRUNDSATZ: niemals Passwörter, Salts/Hashes, Tokens, vollständige
   Kundendaten oder vertrauliche Kalkulationsinhalte in Logs/Support-Paket.
   ============================================================ */
(function (w) {
  "use strict";
  w.Preisschmiede = w.Preisschmiede || {};

  var SCHEMA_VERSION = 9;
  var STORAGE_LIMIT = 5 * 1024 * 1024; // konservativ ~5 MB localStorage

  var RELEASE_STUFEN = [
    { key: "entwicklung", label: "Entwicklung", farbe: "#888" },
    { key: "test", label: "Interner Test", farbe: "#39c" },
    { key: "pilot", label: "Pilot", farbe: "#e0a000" },
    { key: "eingeschraenkt", label: "Eingeschränkter Produktivbetrieb", farbe: "#7a5" },
    { key: "produktion", label: "Produktivbetrieb", farbe: "#2fbf71" }
  ];
  function stufe(key) { return RELEASE_STUFEN.filter(function (s) { return s.key === key; })[0] || RELEASE_STUFEN[0]; }
  // Funktionen mit Pilotstatus (in der UI zu kennzeichnen)
  var PILOT_FUNKTIONEN = ["lernen", "planung-auto", "dokumente-erkennung", "lieferantenadapter", "kingbill", "bestellvorschlag"];

  var FEEDBACK_KATEGORIEN = ["Fehler", "Bedienung unklar", "fehlende Funktion", "falscher Kalkulationsvorschlag", "falscher Materialpreis", "Zeiterfassung", "PDF-Problem", "Verbesserungsvorschlag"];
  var FEEDBACK_STATUS = ["neu", "bestätigt", "in Bearbeitung", "behoben", "getestet", "geschlossen", "abgelehnt"];

  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
  function tageAlt(iso, now) { if (!iso) return Infinity; return (now - new Date(iso).getTime()) / 86400000; }

  // ---- Speicher- / Systemstatus ------------------------------------
  function speicherStatus(db) {
    var bytes = 0; try { bytes = JSON.stringify(db).length; } catch (e) { bytes = 0; }
    var prozent = Math.round(bytes / STORAGE_LIMIT * 1000) / 10;
    return { genutztBytes: bytes, genutztKB: Math.round(bytes / 1024), limitKB: Math.round(STORAGE_LIMIT / 1024), prozent: prozent, status: prozent > 95 ? "unhealthy" : prozent > 80 ? "degraded" : "healthy" };
  }
  function systemstatus(db, buildInfo, now) {
    var b = db.settings && db.settings.betrieb || {};
    return {
      appVersion: (buildInfo && buildInfo.version) || "—",
      build: (buildInfo && buildInfo.build) || "—",
      schemaVersion: db.version || SCHEMA_VERSION,
      releaseStufe: stufe(b.releaseStufe).label,
      releaseStufeKey: b.releaseStufe || "entwicklung",
      wartungsmodus: !!b.wartungsmodus,
      speicher: speicherStatus(db),
      letztesBackup: (b.backupMeta && b.backupMeta.letztes) || null,
      zaehler: {
        kunden: (db.kunden || []).length, material: (db.material || []).length,
        kalkulationen: (db.kalkulationen || []).length, angebote: (db.angebote || []).length,
        auftraege: (db.auftraege || []).length, dokumente: (db.dokumente || []).length,
        benutzer: (db.users || []).length, feedback: (db.feedback || []).length, fehler: (db.fehlerlog || []).length
      },
      zeitpunkt: now ? new Date(now).toISOString() : null
    };
  }

  // ---- Healthchecks ------------------------------------------------
  // Nicht konfigurierte Fremd-Adapter dürfen das Gesamtsystem NICHT als
  // unhealthy markieren – sie erscheinen als eigener „nicht konfiguriert"-Status.
  function healthchecks(db) {
    var sp = speicherStatus(db);
    var checks = [
      { name: "Anwendung", status: "healthy", detail: "geladen" },
      { name: "Datenspeicher (localStorage)", status: sp.status, detail: sp.prozent + " % belegt" },
      { name: "PDF-Erzeugung", status: (typeof w.open === "function") ? "healthy" : "degraded", detail: "Druckvorschau" },
      { name: "Datensicherung", status: (db.settings && db.settings.betrieb && db.settings.betrieb.backupMeta && db.settings.betrieb.backupMeta.letztes) ? "healthy" : "degraded", detail: "siehe Backup-Überwachung" }
    ];
    // Kern-Gesamtstatus = schlechtester Kern-Check (Adapter zählen NICHT)
    var rang = { healthy: 0, degraded: 1, unhealthy: 2 };
    var gesamt = checks.reduce(function (m, c) { return rang[c.status] > rang[m] ? c.status : m; }, "healthy");
    // Adapter-Status separat, informativ
    var adapter = [
      { name: "Frankstahl-API", status: "nicht konfiguriert" },
      { name: "KingBill-Export", status: "nicht konfiguriert" },
      { name: "OCR-Dienst", status: "nicht konfiguriert" }
    ];
    return { gesamt: gesamt, checks: checks, adapter: adapter };
  }

  // ---- Backup-Überwachung ------------------------------------------
  function backupStatus(db, now) {
    var meta = (db.settings && db.settings.betrieb && db.settings.betrieb.backupMeta) || {};
    var warnungen = [];
    var alter = tageAlt(meta.letztes, now);
    if (!meta.letztes) warnungen.push({ schwere: 3, text: "Noch kein Backup vorhanden." });
    else if (alter > 7) warnungen.push({ schwere: 2, text: "Letztes Backup ist " + Math.round(alter) + " Tage alt." });
    if (meta.status === "fehlgeschlagen") warnungen.push({ schwere: 3, text: "Letztes Backup ist fehlgeschlagen." });
    if (!meta.restoreGetestet) warnungen.push({ schwere: 1, text: "Wiederherstellung wurde noch nie getestet." });
    var sp = speicherStatus(db);
    if (sp.status !== "healthy") warnungen.push({ schwere: 2, text: "Lokaler Speicher zu " + sp.prozent + " % belegt." });
    return {
      letztes: meta.letztes || null, status: meta.status || (meta.letztes ? "ok" : "keins"),
      groesseKB: meta.groesseKB || null, aufbewahrungTage: meta.aufbewahrungTage || 30,
      restoreGetestet: !!meta.restoreGetestet, letzterRestoreTest: meta.letzterRestoreTest || null,
      alterTage: isFinite(alter) ? Math.round(alter) : null, warnungen: warnungen
    };
  }

  // ---- Aggregierte Betriebswarnungen -------------------------------
  function betriebswarnungen(db, now) {
    now = now || Date.now();
    var out = [];
    function add(schwere, typ, text) { out.push({ schwere: schwere, typ: typ, text: text }); }
    // veraltete Materialpreise (> 180 Tage)
    var alteMat = (db.material || []).filter(function (m) { return m.aktualisiert && tageAlt(m.aktualisiert, now) > 180; });
    if (alteMat.length) add(2, "materialpreis", alteMat.length + " Materialpreis(e) älter als 180 Tage.");
    var ohnePreis = (db.material || []).filter(function (m) { return !(num(m.preis) > 0) && !(num(m.preisProKg) > 0); });
    if (ohnePreis.length) add(2, "materialpreis", ohnePreis.length + " Material(ien) ohne Preis.");
    // Maschinen ohne Stundensatz / ohne Rüstkosten
    var mOhneSatz = (db.settings && db.settings.maschinen || []).filter(function (m) { return !(num(m.stundensatz) > 0); });
    if (mOhneSatz.length) add(2, "maschine", mOhneSatz.length + " Maschine(n) ohne Maschinenstundensatz.");
    var mOhneRuest = (db.settings && db.settings.maschinen || []).filter(function (m) { return !(num(m.fixeRuestkosten) > 0) && !(num(m.ruestzeitStd) > 0); });
    if (mOhneRuest.length) add(1, "ruestkosten", mOhneRuest.length + " Maschine(n) ohne hinterlegte Rüstkosten.");
    // fehlende Stundensätze (rates)
    var rates = (db.settings && db.settings.rates) || {};
    if (["cad", "fertigung", "montage", "projektleitung"].some(function (k) { return !(num(rates[k]) > 0); })) add(2, "stundensatz", "Mindestens ein Stundenverrechnungssatz fehlt.");
    // Pflichtdaten Firma
    if (!(db.settings && db.settings.firma && db.settings.firma.uid)) add(1, "stammdaten", "Firmen-UID fehlt (für Angebote nötig).");
    // negative Marge in Kalkulationen
    var Kalk = w.Preisschmiede.Kalkulation;
    if (Kalk) {
      var negativ = (db.kalkulationen || []).filter(function (k) { try { var r = k.ergebnis || Kalk.berechne(k, db.settings); return r && r.gewinn < 0; } catch (e) { return false; } });
      if (negativ.length) add(3, "marge", negativ.length + " Kalkulation(en) mit negativem Gewinn.");
    }
    // auslaufende Angebote (Gültigkeit < 7 Tage, noch offen)
    var offeneStatus = ["versendet", "angesehen", "in Verhandlung", "freigegeben"];
    var auslaufend = (db.angebote || []).filter(function (a) {
      if (offeneStatus.indexOf(a.status) < 0) return false;
      var g = a.erstellt ? new Date(a.erstellt).getTime() + (num(a.gueltigTage) || 30) * 86400000 : 0;
      return g && (g - now) / 86400000 < 7 && g > now;
    });
    if (auslaufend.length) add(1, "angebot", auslaufend.length + " Angebot(e) laufen in weniger als 7 Tagen aus.");
    // gefährdete Liefertermine + offene Timer + unvollständige Nachkalkulation (Aufträge)
    var offeneTimer = 0, unvollstaendig = 0, verspaetet = 0;
    (db.auftraege || []).forEach(function (a) {
      if (a.liefertermin && a.status !== "Abgeschlossen" && a.status !== "abgeschlossen" && new Date(a.liefertermin).getTime() < now) verspaetet++;
      var abg = a.status === "Abgeschlossen" || a.status === "abgeschlossen";
      var hatIst = (a.positionen || []).some(function (p) { return p.ist && p.ist.zeiten; });
      if (abg && !hatIst) unvollstaendig++;
    });
    (db.planung && db.planung.elemente || []).forEach(function (e) { if (e.status === "in Arbeit" && e.startIst && !e.endeIst) offeneTimer++; });
    if (verspaetet) add(3, "liefertermin", verspaetet + " Auftrag/Aufträge über dem Liefertermin.");
    if (offeneTimer) add(1, "timer", offeneTimer + " offene(r) Timer in der Fertigung.");
    if (unvollstaendig) add(2, "nachkalkulation", unvollstaendig + " abgeschlossene(r) Auftrag/Aufträge ohne vollständige Nachkalkulation.");
    // offene kritische Fehlermeldungen / Feedback
    var kritFb = (db.feedback || []).filter(function (f) { return f.prioritaet === "hoch" && ["neu", "bestätigt", "in Bearbeitung"].indexOf(f.status) >= 0; });
    if (kritFb.length) add(2, "feedback", kritFb.length + " offene Feedback-Meldung(en) mit hoher Priorität.");
    // Backup
    backupStatus(db, now).warnungen.forEach(function (wn) { add(wn.schwere, "backup", wn.text); });
    return out.sort(function (a, b) { return b.schwere - a.schwere; });
  }

  // ---- Fehlerlog & Feedback (Modelle) ------------------------------
  // Fehler-ID: kurz, für Benutzer nennbar. seed = Date.now (aus UI übergeben).
  function fehlerId(seed) { return "ERR-" + (Number(seed) || 0).toString(36).toUpperCase().slice(-6); }
  function fehlerEintrag(daten, seed) {
    return {
      id: fehlerId(seed), zeitpunkt: daten.zeitpunkt || null, modul: daten.modul || "", // wird in UI gestempelt
      nachricht: String(daten.nachricht || "").slice(0, 300), // gekürzt, keine Secrets
      kontext: daten.kontext || "", browser: daten.browser || "", benutzerRolle: daten.rolle || ""
    };
  }
  function feedbackNeu(daten, seed) {
    return {
      id: "FB-" + (Number(seed) || 0).toString(36).toUpperCase().slice(-6),
      nummer: daten.nummer || null, kategorie: daten.kategorie || "Fehler",
      beschreibung: String(daten.beschreibung || "").slice(0, 2000),
      modul: daten.modul || "", kommission: daten.kommission || "", prioritaet: daten.prioritaet || "mittel",
      benutzer: daten.benutzer || "", zeitpunkt: daten.zeitpunkt || null, kontext: daten.kontext || "",
      status: "neu", bearbeiter: "", loesung: ""
    };
  }

  // ---- Support-Paket (anonymisiert, ohne Secrets) ------------------
  // Enthält NIE: Passwörter, Salts/Hashes, Tokens, vollständige Kundendaten,
  // vertrauliche Kalkulationen, personenbezogene Mitarbeiterdaten.
  function supportPaket(db, buildInfo, browser, now) {
    var status = systemstatus(db, buildInfo, now);
    delete status.zaehler; // knapp halten; einzeln unten
    return {
      erstellt: now ? new Date(now).toISOString() : null,
      appVersion: status.appVersion, build: status.build, schemaVersion: status.schemaVersion,
      releaseStufe: status.releaseStufe, wartungsmodus: status.wartungsmodus,
      speicher: speicherStatus(db),
      health: healthchecks(db),
      backup: (function () { var b = backupStatus(db, now); return { letztes: b.letztes, status: b.status, alterTage: b.alterTage, restoreGetestet: b.restoreGetestet, warnungen: b.warnungen.length }; })(),
      anzahl: { kunden: (db.kunden || []).length, kalkulationen: (db.kalkulationen || []).length, angebote: (db.angebote || []).length, auftraege: (db.auftraege || []).length },
      // Nur technische Fehler-IDs + gekürzte Nachrichten, keine Personendaten
      letzteFehler: (db.fehlerlog || []).slice(-15).map(function (f) { return { id: f.id, zeitpunkt: f.zeitpunkt, modul: f.modul, nachricht: String(f.nachricht || "").slice(0, 160), rolle: f.benutzerRolle || "" }; }),
      offeneFeedback: (db.feedback || []).filter(function (f) { return ["neu", "bestätigt", "in Bearbeitung"].indexOf(f.status) >= 0; }).length,
      browser: String(browser || "").slice(0, 200),
      fehlerIds: (db.fehlerlog || []).slice(-15).map(function (f) { return f.id; })
    };
  }
  // Sicherheitsnetz: prüft, dass ein Objekt keine sensiblen Schlüssel/Muster enthält.
  function enthaeltSensibles(obj) {
    var treffer = [], verboten = ["pin", "hash", "salt", "token", "passwort", "password", "secret", "apikey", "api_key"];
    (function scan(o) {
      if (!o || typeof o !== "object") return;
      Object.keys(o).forEach(function (k) { if (verboten.indexOf(String(k).toLowerCase()) >= 0) treffer.push(k); scan(o[k]); });
    })(obj);
    return treffer;
  }

  // ---- Pilotkennzahlen (echte Zahlen, keine Erfolgs-Fiktion) -------
  function pilotKennzahlen(db, now) {
    now = now || Date.now();
    var auftraege = db.auftraege || [];
    var nachkalkuliert = auftraege.filter(function (a) { return (a.positionen || []).some(function (p) { return p.ist && p.ist.zeiten; }); }).length;
    var offeneTimer = (db.planung && db.planung.elemente || []).filter(function (e) { return e.status === "in Arbeit" && e.startIst && !e.endeIst; }).length;
    var erfassteZeiten = 0;
    auftraege.forEach(function (a) { (a.positionen || []).forEach(function (p) { if (p.ist && p.ist.zeiten) erfassteZeiten += Object.keys(p.ist.zeiten).length; }); });
    return {
      benutzer: (db.users || []).filter(function (u) { return u.aktiv !== false; }).length,
      kalkulationen: (db.kalkulationen || []).length,
      angebote: (db.angebote || []).length,
      auftraege: auftraege.length,
      nachkalkuliert: nachkalkuliert,
      erfassteZeitbuchungen: erfassteZeiten,
      offeneTimer: offeneTimer,
      feedback: (db.feedback || []).length,
      offeneFeedback: (db.feedback || []).filter(function (f) { return ["neu", "bestätigt", "in Bearbeitung"].indexOf(f.status) >= 0; }).length,
      fehler: (db.fehlerlog || []).length
    };
  }

  w.Preisschmiede.Betrieb = {
    SCHEMA_VERSION: SCHEMA_VERSION, STORAGE_LIMIT: STORAGE_LIMIT,
    RELEASE_STUFEN: RELEASE_STUFEN, stufe: stufe, PILOT_FUNKTIONEN: PILOT_FUNKTIONEN,
    FEEDBACK_KATEGORIEN: FEEDBACK_KATEGORIEN, FEEDBACK_STATUS: FEEDBACK_STATUS,
    speicherStatus: speicherStatus, systemstatus: systemstatus, healthchecks: healthchecks,
    backupStatus: backupStatus, betriebswarnungen: betriebswarnungen,
    fehlerId: fehlerId, fehlerEintrag: fehlerEintrag, feedbackNeu: feedbackNeu,
    supportPaket: supportPaket, enthaeltSensibles: enthaeltSensibles, pilotKennzahlen: pilotKennzahlen
  };
})(typeof self !== "undefined" ? self : this);
