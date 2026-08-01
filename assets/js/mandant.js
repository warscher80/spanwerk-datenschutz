/* ============================================================
   Preisschmiede – Mandanten-Engine (Phase 10)
   Reine, testbare Logik für Tarife, Feature-Flags, Lizenzstatus,
   Nutzungslimits, Einladungen (manuell/sicher), Supportzugriff,
   Mandantenexport. Arbeitet auf der Registry (global) und der db
   eines Mandanten. Isolation selbst erfolgt durch getrennte
   Speicher-Namespaces in store.js (Datenbank-pro-Mandant).
   EHRLICH: Offline-App ohne Server – keine serverseitige Erzwingung,
   keine echte Zahlung/E-Mail (Status „nicht eingerichtet").
   ============================================================ */
(function (w) {
  "use strict";
  w.Preisschmiede = w.Preisschmiede || {};

  var TARIF_RANG = { basis: 0, professional: 1, intelligent: 2 };
  // Lizenzstatus, der Schreibzugriff einschränkt
  var SPERRT_SCHREIBEN = ["Zahlung ausstehend", "eingeschränkt", "gesperrt", "gekündigt", "archiviert"];
  var SPERRT_ALLES = ["gesperrt", "archiviert"];

  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }

  // ---- Tarife / Feature-Flags --------------------------------------
  function tarifRang(key) { return TARIF_RANG[key] != null ? TARIF_RANG[key] : 0; }
  function flagByKey(registry, key) { return (registry.featureFlags || []).filter(function (f) { return f.key === key; })[0] || null; }
  // Darf ein Mandant eine Funktion nutzen? Tarif UND Flag-Aktivierung UND Lizenz.
  function darfFeature(registry, mandant, featureKey) {
    var f = flagByKey(registry, featureKey);
    if (!f) return false;
    if (f.aktiv === false) return false;
    if (tarifRang(mandant.tarif) < tarifRang(f.tarif)) return false;
    // Bei stark eingeschränkter Lizenz keine (neuen) Funktionen
    if (SPERRT_ALLES.indexOf(mandant.status) >= 0) return false;
    return true;
  }

  // ---- Lizenzstatus / Schreibrechte --------------------------------
  function lizenz(mandant) {
    var status = mandant.status || "aktiv";
    var lesen = SPERRT_ALLES.indexOf(status) < 0 || status === "archiviert"; // archiviert: nur Export/lesen
    var schreiben = SPERRT_SCHREIBEN.indexOf(status) < 0;
    var neueKalkulation = schreiben; // eingeschränkt sperrt neue Kalkulationen
    var exportErlaubt = status !== "gesperrt"; // Export bleibt möglich (Daten nie ganz entziehen)
    var hinweis = "";
    if (status === "eingeschränkt") hinweis = "Eingeschränkter Lizenzstatus: Daten lesbar und exportierbar, neue Kalkulationen gesperrt.";
    else if (status === "Zahlung ausstehend") hinweis = "Zahlung ausstehend – bitte Lizenz prüfen. Daten bleiben erhalten.";
    else if (status === "gesperrt") hinweis = "Konto gesperrt. Bitte Administrator/Support kontaktieren.";
    else if (status === "gekündigt") hinweis = "Konto gekündigt – bitte Daten exportieren.";
    return { status: status, lesen: lesen, schreiben: schreiben, neueKalkulation: neueKalkulation, exportErlaubt: exportErlaubt, hinweis: hinweis };
  }

  // ---- Nutzung / Limits + Warnstufen -------------------------------
  function speicherBytes(db) { try { return JSON.stringify(db).length; } catch (e) { return 0; } }
  function nutzung(mandant, db) {
    var users = (db.users || []).length;
    var mb = Math.round(speicherBytes(db) / 1024 / 1024 * 100) / 100;
    var maxU = num(mandant.maxBenutzer) || 0, maxMB = num(mandant.maxSpeicherMB) || 0;
    function stufe(w2, max) { if (!max) return 0; var p = w2 / max * 100; return p >= 100 ? 100 : p >= 90 ? 90 : p >= 80 ? 80 : 0; }
    return {
      benutzer: users, maxBenutzer: maxU, benutzerWarn: stufe(users, maxU),
      speicherMB: mb, maxSpeicherMB: maxMB, speicherWarn: stufe(mb, maxMB),
      projekte: (db.projekte || []).length, kalkulationen: (db.kalkulationen || []).length,
      dokumente: (db.dokumente || []).length, dokumentanalysen: (db.dokumente || []).reduce(function (s, d) { return s + ((d.analysen || []).length); }, 0),
      // Kulanz: Limit macht laufende Prozesse nicht unbrauchbar – nur Warnung.
      kulanz: true
    };
  }

  // ---- Einladungen (manuell/sicher; kein E-Mail-Dienst) ------------
  // Token wird NIE gespeichert/geloggt – nur der gesalzene Hash.
  function einladungNeu(daten, token, jetztISO, ablaufTage) {
    var Store = w.Preisschmiede.Store;
    var salt = Store.makeSalt();
    var ablauf = new Date(new Date(jetztISO || Store.nowISO()).getTime() + (ablaufTage || 14) * 86400000).toISOString();
    return {
      id: Store.uid(), email: (daten.email || "").trim(), mandantId: daten.mandantId, rolle: daten.rolle || "buero",
      tokenSalt: salt, tokenHash: Store.hashPin(String(token), salt), ablauf: ablauf,
      status: "offen", einladender: daten.einladender || "", erstellt: jetztISO || Store.nowISO()
    };
  }
  function einladungPruefen(einladung, token, jetztISO) {
    var Store = w.Preisschmiede.Store;
    if (!einladung) return { ok: false, grund: "unbekannt" };
    if (einladung.status !== "offen") return { ok: false, grund: einladung.status };
    if (new Date(einladung.ablauf).getTime() < new Date(jetztISO || Store.nowISO()).getTime()) return { ok: false, grund: "abgelaufen" };
    if (Store.hashPin(String(token), einladung.tokenSalt) !== einladung.tokenHash) return { ok: false, grund: "token ungültig" };
    return { ok: true };
  }

  // ---- Support-Zugriff (kontrolliert, protokolliert) ---------------
  function supportStart(registry, daten, jetztISO) {
    var Store = w.Preisschmiede.Store;
    var eintrag = {
      id: Store.uid(), mandantId: daten.mandantId, benutzer: daten.benutzer || "", grund: daten.grund || "",
      freigegebenVon: daten.freigegebenVon || "", von: jetztISO || Store.nowISO(),
      bis: daten.bis || new Date(new Date(jetztISO || Store.nowISO()).getTime() + (daten.dauerStunden || 24) * 3600000).toISOString(),
      aktiv: true, widerrufen: null
    };
    (registry.supportZugriffe = registry.supportZugriffe || []).push(eintrag);
    return eintrag;
  }
  function supportAktiv(registry, mandantId, jetztISO) {
    var Store = w.Preisschmiede.Store; var jetzt = new Date(jetztISO || Store.nowISO()).getTime();
    return (registry.supportZugriffe || []).some(function (s) { return s.mandantId === mandantId && s.aktiv && !s.widerrufen && new Date(s.bis).getTime() > jetzt; });
  }
  function supportWiderrufen(registry, id, jetztISO) {
    var Store = w.Preisschmiede.Store;
    (registry.supportZugriffe || []).forEach(function (s) { if (s.id === id) { s.aktiv = false; s.widerrufen = jetztISO || Store.nowISO(); } });
  }

  // ---- Mandantenexport (nur eigene Daten) --------------------------
  function mandantExport(mandant, db, jetztISO) {
    return {
      mandant: { id: mandant.id, name: mandant.name, tarif: mandant.tarif, status: mandant.status },
      exportiert: jetztISO || (w.Preisschmiede.Store && w.Preisschmiede.Store.nowISO()),
      daten: JSON.parse(JSON.stringify(db))
    };
  }

  // ---- Hintergrundaufgaben mit Mandantenkontext --------------------
  function aufgabe(registry, daten, jetztISO) {
    var Store = w.Preisschmiede.Store;
    var a = { id: Store.uid(), mandantId: daten.mandantId, benutzer: daten.benutzer || "", typ: daten.typ || "", status: daten.status || "erledigt", start: daten.start || jetztISO || Store.nowISO(), ende: daten.ende || jetztISO || Store.nowISO(), ergebnis: daten.ergebnis || "", fehlerId: daten.fehlerId || null };
    (registry.hintergrundaufgaben = registry.hintergrundaufgaben || []).push(a);
    if (registry.hintergrundaufgaben.length > 200) registry.hintergrundaufgaben = registry.hintergrundaufgaben.slice(-200);
    return a;
  }

  // ---- Zuordnungen (Benutzer ↔ Mandant) ----------------------------
  function mandantenFuerBenutzer(registry, benutzername) {
    return (registry.zuordnungen || []).filter(function (z) { return z.benutzername === benutzername && z.status !== "entzogen"; }).map(function (z) { return z.mandantId; });
  }
  function hatZugriff(registry, benutzername, mandantId) {
    return (registry.zuordnungen || []).some(function (z) { return z.benutzername === benutzername && z.mandantId === mandantId && z.status !== "entzogen"; });
  }

  w.Preisschmiede.Mandant = {
    TARIF_RANG: TARIF_RANG, SPERRT_SCHREIBEN: SPERRT_SCHREIBEN, SPERRT_ALLES: SPERRT_ALLES,
    tarifRang: tarifRang, flagByKey: flagByKey, darfFeature: darfFeature,
    lizenz: lizenz, nutzung: nutzung,
    einladungNeu: einladungNeu, einladungPruefen: einladungPruefen,
    supportStart: supportStart, supportAktiv: supportAktiv, supportWiderrufen: supportWiderrufen,
    mandantExport: mandantExport, aufgabe: aufgabe,
    mandantenFuerBenutzer: mandantenFuerBenutzer, hatZugriff: hatZugriff
  };
})(typeof self !== "undefined" ? self : this);
