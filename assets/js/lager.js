/* ============================================================
   Preisschmiede – Lagerkern (Phase 15A)
   Reine, testbare Lagerlogik (ohne UI, ohne Netzwerk): Lager-
   struktur, Lagerartikel, zentrale Bestandsberechnung, ein
   unveränderbares Bewegungsjournal, Wareneingang mit Teil-/
   Mehr-/Minderlieferung, Chargen + Rückverfolgung, Reservierungen,
   Entnahme/Rückgabe, Reststücke (inkl. Langgut-Restlänge),
   Mindestbestand/Bestellvorschlag, technische Bestandsbewertung,
   Idempotenz + Offline-Neuvalidierung, Mandantentrennung + Rechte.

   EHRLICH / GRENZEN:
   - Keine Bewegung wird je gelöscht; Fehler nur per Storno/Gegen-
     buchung. Das Journal ist die Quelle der Wahrheit für den Bestand.
   - Keine steuerrechtlich verbindliche Lagerbewertung (nur technische
     Vorbereitung: letzter EK / gleitender Durchschnitt / Charge).
   - Keine echte ERP-Lageranbindung, keine Live-Bestellung.
   - Offline-Bewegungen gelten als nicht vertrauenswürdig und werden
     bei der Übernahme erneut validiert (Konflikt statt stiller Fehler).
   ============================================================ */
(function (w) {
  "use strict";
  w.Preisschmiede = w.Preisschmiede || {};

  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
  function r2(x) { if (!isFinite(x)) return 0; var s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 100 + 1e-6) / 100; }
  function r3(x) { if (!isFinite(x)) return 0; var s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 1000 + 1e-6) / 1000; }

  // Stabile lokale ID + Idempotenzschlüssel (kein Krypto-Zufall nötig; offline stabil).
  var _c = 0;
  function hashStr(s) { var h = 0x811c9dc5 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  function uid(seed) { _c = (_c + 1) % 1e6; return "lg-" + (seed != null ? String(seed) + "-" : "") + Math.abs(hashStr(String(seed) + "|" + _c)).toString(36); }
  function idempotenzKey() { return Array.prototype.slice.call(arguments).map(function (x) { return String(x == null ? "" : x); }).join("::"); }

  // ---- Konstanten ----------------------------------------------------
  // Bewegungsarten (immer additiv verbucht; Korrektur nur per Storno/Gegenbuchung)
  var BEWEGUNG = {
    WARENEINGANG: "WARENEINGANG", ENTNAHME: "ENTNAHME", RUECKGABE: "RUECKGABE",
    RESERVIERUNG: "RESERVIERUNG", RESERVIERUNG_AUF: "RESERVIERUNG_AUF",
    UMLAGERUNG: "UMLAGERUNG", KORREKTUR: "KORREKTUR", INVENTURDIFFERENZ: "INVENTURDIFFERENZ",
    AUSSCHUSS: "AUSSCHUSS", RESTSTUECK_ZUGANG: "RESTSTUECK_ZUGANG", RESTSTUECK_VERBRAUCH: "RESTSTUECK_VERBRAUCH",
    SPERRUNG: "SPERRUNG", ENTSPERRUNG: "ENTSPERRUNG", LIEFERANTENRETOURE: "LIEFERANTENRETOURE", STORNO: "STORNO"
  };
  var RES_STATUS = { VORGEMERKT: "vorgemerkt", RESERVIERT: "reserviert", TEILWEISE: "teilweise reserviert", ENTNOMMEN: "entnommen", FREIGEGEBEN: "freigegeben", ABGELAUFEN: "abgelaufen", STORNIERT: "storniert" };
  var REST_STATUS = { VERFUEGBAR: "verfügbar", RESERVIERT: "reserviert", TEILWEISE: "teilweise verwendet", VERBRAUCHT: "verbraucht", GESPERRT: "gesperrt", VERSCHROTTET: "verschrottet" };
  var PRUEF_STATUS = { OFFEN: "offen", PRUEFUNG: "in Prüfung", FREIGEGEBEN: "freigegeben", GESPERRT: "gesperrt" };
  var PLATZ_STATUS = { AKTIV: "aktiv", INAKTIV: "inaktiv", GESPERRT: "gesperrt" };
  var METHODE = { LETZTER: "letzter", GLEITEND: "gleitend", CHARGE: "charge" };

  // Rechtematrix Lager (zentral geprüft; UI erzwingt zusätzlich)
  var LAGER_RECHTE = {
    admin: ["bestandSehen", "einkaufspreiseSehen", "wareneingang", "reservieren", "entnehmen", "zurueckgeben", "umlagern", "korrigieren", "chargeSperren", "chargeEntsperren", "inventurZaehlen", "inventurFreigeben", "bestellungErstellen", "bestellungFreigeben", "berichteExportieren"],
    buero: ["bestandSehen", "einkaufspreiseSehen", "wareneingang", "reservieren", "entnehmen", "zurueckgeben", "umlagern", "korrigieren", "chargeSperren", "inventurZaehlen", "bestellungErstellen", "berichteExportieren"],
    werkstatt: ["bestandSehen", "entnehmen", "zurueckgeben", "umlagern", "inventurZaehlen"]
  };
  var BESTELL_STATUS = ["Entwurf", "zur Freigabe", "freigegeben", "exportiert", "bestellt", "bestätigt", "teilweise geliefert", "geliefert", "storniert"];
  var INVENTUR_TYP = { VOLL: "voll", LAGERPLATZ: "lagerplatz", ARTIKEL: "artikel", STICHPROBE: "stichprobe" };
  var INVENTUR_STATUS = { ANGELEGT: "angelegt", ZAEHLUNG: "in Zählung", PRUEFUNG: "in Prüfung", FREIGEGEBEN: "freigegeben", ABGESCHLOSSEN: "abgeschlossen" };
  function darf(rolle, recht) { return (LAGER_RECHTE[rolle] || []).indexOf(recht) >= 0; }
  function darfEinkaufspreise(rolle) { return darf(rolle, "einkaufspreiseSehen"); }

  // ============================================================
  //  BEWEGUNGSJOURNAL (unveränderbar)
  // ============================================================
  // Wirkung einer Bewegung auf die Bestandstöpfe. menge > 0 (außer Korrektur/
  // Inventurdifferenz, die vorzeichenbehaftet sein dürfen). QS-Ware wird als
  // physisch UND gesperrt (Topf „quali") gebucht, sodass die Formel
  // verfuegbar = physisch - reserviert - gesperrt exakt bleibt.
  function deltas(typ, menge, opts) {
    opts = opts || {};
    var m = num(menge);
    var z = { physisch: 0, reserviert: 0, gesperrt: 0, quali: 0, rest: 0 };
    switch (typ) {
      case BEWEGUNG.WARENEINGANG:
        z.physisch = m; if (opts.qs) { z.gesperrt = m; z.quali = m; } break;
      case BEWEGUNG.ENTNAHME:
        z.physisch = -m; if (opts.reservierungId) z.reserviert = -m; break;
      case BEWEGUNG.RUECKGABE: z.physisch = m; break;
      case BEWEGUNG.RESERVIERUNG: z.reserviert = m; break;
      case BEWEGUNG.RESERVIERUNG_AUF: z.reserviert = -m; break;
      case BEWEGUNG.UMLAGERUNG: z.physisch = 0; break; // netto 0 (je Lagerplatz siehe bucketProPlatz)
      case BEWEGUNG.KORREKTUR: z.physisch = m; break; // m darf negativ sein
      case BEWEGUNG.INVENTURDIFFERENZ: z.physisch = m; break; // m darf negativ sein
      case BEWEGUNG.AUSSCHUSS: z.physisch = -m; break;
      case BEWEGUNG.RESTSTUECK_ZUGANG: z.rest = m; break;
      case BEWEGUNG.RESTSTUECK_VERBRAUCH: z.rest = -m; break;
      case BEWEGUNG.SPERRUNG: z.gesperrt = m; break;
      case BEWEGUNG.ENTSPERRUNG: z.gesperrt = -m; break;
      case BEWEGUNG.LIEFERANTENRETOURE: z.physisch = -m; break;
      case BEWEGUNG.STORNO: break; // Storno trägt die invertierten Deltas des Originals (siehe storniere)
    }
    return z;
  }

  function bewegungNeu(daten, jetztISO) {
    daten = daten || {};
    var zeit = daten.zeitpunkt || jetztISO;
    var key = daten.idempotenzKey || idempotenzKey("bew", daten.mandantId, daten.typ, daten.artikelId, daten.menge, daten.quelleLagerplatzId || "", daten.zielLagerplatzId || "", daten.auftragId || "", daten.chargeId || "", zeit);
    var eff = daten.deltas || deltas(daten.typ, daten.menge, { qs: daten.qs, reservierungId: daten.reservierungId });
    return {
      id: daten.id || uid(key), mandantId: daten.mandantId || null, typ: daten.typ,
      artikelId: daten.artikelId || null, menge: num(daten.menge), einheit: daten.einheit || null,
      quelleLagerplatzId: daten.quelleLagerplatzId || null, zielLagerplatzId: daten.zielLagerplatzId || null,
      auftragId: daten.auftragId || null, projektId: daten.projektId || null, kommission: daten.kommission || null,
      arbeitsgang: daten.arbeitsgang || null, chargeId: daten.chargeId || null, reservierungId: daten.reservierungId || null,
      reststueckId: daten.reststueckId || null, entnahmeRef: daten.entnahmeRef || null,
      benutzer: daten.benutzer || null, zeitpunkt: zeit, grund: daten.grund || null,
      preisSnapshot: daten.preisSnapshot != null ? num(daten.preisSnapshot) : null,
      idempotenzKey: key, stornoVon: daten.stornoVon || null, storniert: false,
      deltas: eff, erstellt: jetztISO, quelle: daten.quelle || null, ziel: daten.ziel || null
    };
  }

  // Fügt eine Bewegung idempotent in das Journal ein (kein zweiter Eintrag bei
  // gleichem Idempotenzschlüssel). Gibt {record, neu} zurück.
  function journalPush(bewegungen, rec) {
    bewegungen = bewegungen || [];
    var da = bewegungen.filter(function (b) { return b.idempotenzKey === rec.idempotenzKey; })[0];
    if (da) return { record: da, neu: false };
    bewegungen.push(rec);
    return { record: rec, neu: true };
  }

  // ============================================================
  //  BESTANDSBERECHNUNG (zentral, aus dem Journal)
  // ============================================================
  function passt(b, artikelId, opts) {
    if (b.artikelId !== artikelId) return false;
    if (opts && opts.mandantId != null && b.mandantId !== opts.mandantId) return false;
    if (opts && opts.chargeId != null && b.chargeId !== opts.chargeId) return false;
    return true;
  }
  // Summiert die Bestandstöpfe für einen Artikel (optional je Charge/Mandant).
  function toepfe(bewegungen, artikelId, opts) {
    var s = { physisch: 0, reserviert: 0, gesperrt: 0, quali: 0, rest: 0 };
    (bewegungen || []).forEach(function (b) {
      if (!passt(b, artikelId, opts)) return;
      var dz = b.deltas || deltas(b.typ, b.menge, {});
      s.physisch += num(dz.physisch); s.reserviert += num(dz.reserviert);
      s.gesperrt += num(dz.gesperrt); s.quali += num(dz.quali); s.rest += num(dz.rest);
    });
    s.physisch = r3(s.physisch); s.reserviert = r3(s.reserviert); s.gesperrt = r3(s.gesperrt);
    s.quali = r3(s.quali); s.rest = r3(s.rest);
    return s;
  }
  // Bestand je Lagerplatz (berücksichtigt Umlagerung quelle/ziel).
  function bestandProPlatz(bewegungen, artikelId, lagerplatzId, opts) {
    var phys = 0;
    (bewegungen || []).forEach(function (b) {
      if (!passt(b, artikelId, opts)) return;
      var dz = b.deltas || deltas(b.typ, b.menge, {});
      if (b.typ === BEWEGUNG.UMLAGERUNG) {
        if (b.quelleLagerplatzId === lagerplatzId) phys -= num(b.menge);
        if (b.zielLagerplatzId === lagerplatzId) phys += num(b.menge);
        return;
      }
      var platz = b.zielLagerplatzId || b.quelleLagerplatzId;
      if (platz === lagerplatzId) phys += num(dz.physisch);
    });
    return r3(phys);
  }
  // Bereits bestellte, aber noch nicht gelieferte Menge (kein physischer Bestand).
  function bestelltMenge(bestellungen, artikelId, opts) {
    var offen = 0;
    (bestellungen || []).forEach(function (bo) {
      if (opts && opts.mandantId != null && bo.mandantId !== opts.mandantId) return;
      if (bo.status === "storniert" || bo.status === "abgeschlossen") return;
      (bo.positionen || []).forEach(function (p) {
        if (p.artikelId !== artikelId) return;
        var rest = num(p.bestellt) - num(p.geliefert);
        if (rest > 0) offen += rest;
      });
    });
    return r3(offen);
  }
  // Vollständiger Bestand inkl. verfügbar/bestellt.
  function bestand(state, artikelId, opts) {
    opts = opts || {};
    var t = toepfe(state.bewegungen, artikelId, opts);
    var bestellt = bestelltMenge(state.bestellungen, artikelId, opts);
    var verfuegbar = r3(t.physisch - t.reserviert - t.gesperrt);
    return {
      artikelId: artikelId, physisch: t.physisch, reserviert: t.reserviert,
      gesperrt: t.gesperrt, qualitaet: t.quali, reststueck: t.rest,
      bestellt: bestellt, verfuegbar: verfuegbar
    };
  }
  function verfuegbar(state, artikelId, opts) { return bestand(state, artikelId, opts).verfuegbar; }

  // ============================================================
  //  VALIDIERUNG (auch für Offline-Neuvalidierung bei Sync)
  // ============================================================
  function artikelById(state, id) { return (state.artikel || []).filter(function (a) { return a.id === id; })[0] || null; }
  function chargeById(state, id) { return (state.chargen || []).filter(function (c) { return c.id === id; })[0] || null; }
  function platzById(state, id) { return (state.plaetze || []).filter(function (p) { return p.id === id; })[0] || null; }

  // Prüft eine geplante/übertragene Bewegung gegen den aktuellen Zustand.
  // Gibt {ok:true} oder {ok:false, grund}. Offline-Daten werden hierüber
  // erneut validiert – nichts wird still akzeptiert.
  function pruefeBewegung(state, daten) {
    var art = artikelById(state, daten.artikelId);
    if (!art) return { ok: false, grund: "Artikel nicht vorhanden" };
    if (daten.mandantId != null && art.mandantId != null && daten.mandantId !== art.mandantId) return { ok: false, grund: "Cross-Tenant – fremder Mandant" };
    if (daten.chargeId) {
      var ch = chargeById(state, daten.chargeId);
      if (!ch) return { ok: false, grund: "Charge nicht vorhanden" };
      if (ch.mandantId != null && art.mandantId != null && ch.mandantId !== art.mandantId) return { ok: false, grund: "Charge fremder Mandant" };
      var entnahmeArten = [BEWEGUNG.ENTNAHME, BEWEGUNG.RESERVIERUNG, BEWEGUNG.RESTSTUECK_VERBRAUCH];
      if ((ch.gesperrt || ch.pruefstatus === PRUEF_STATUS.GESPERRT) && entnahmeArten.indexOf(daten.typ) >= 0) return { ok: false, grund: "Charge gesperrt" };
    }
    if (daten.zielLagerplatzId) { var pz = platzById(state, daten.zielLagerplatzId); if (pz && (pz.gesperrt || pz.status === PLATZ_STATUS.GESPERRT) && daten.typ === BEWEGUNG.WARENEINGANG) return { ok: false, grund: "Ziel-Lagerplatz gesperrt" }; }
    // Bestandsabgänge: kein negativer Bestand, außer der Artikel erlaubt es ausdrücklich.
    var abgang = [BEWEGUNG.ENTNAHME, BEWEGUNG.AUSSCHUSS, BEWEGUNG.LIEFERANTENRETOURE];
    if (abgang.indexOf(daten.typ) >= 0) {
      var b = bestand(state, daten.artikelId, { mandantId: art.mandantId });
      var basis = daten.typ === BEWEGUNG.ENTNAHME ? (daten.reservierungId ? b.physisch : b.verfuegbar) : b.physisch;
      if (!art.negativerBestandErlaubt && num(daten.menge) > basis + 1e-9) return { ok: false, grund: "Nicht genügend Bestand (verfügbar " + basis + ")", fehlmenge: r3(num(daten.menge) - basis) };
    }
    return { ok: true };
  }

  // ============================================================
  //  WARENEINGANG (Teil-/Mehr-/Minderlieferung, Charge, QS, Preis-Snapshot)
  // ============================================================
  // pos: { artikelId, bestellMenge, gelieferteMenge, beschaedigteMenge?, lagerplatzId,
  //        chargennummer?, schmelznummer?, zertifikate?, einkaufspreis, qs?, herstellerName? }
  function wareneingang(state, kopf, jetztISO) {
    kopf = kopf || {}; jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var bo = kopf.bestellungId ? (state.bestellungen || []).filter(function (x) { return x.id === kopf.bestellungId; })[0] : null;
    var we = {
      id: uid("we"), mandantId: kopf.mandantId || null, bestellungId: kopf.bestellungId || null,
      lieferantId: kopf.lieferantId || (bo ? bo.lieferantId : null), lieferschein: kopf.lieferschein || null,
      datum: kopf.datum || jetztISO, benutzer: kopf.benutzer || null, positionen: [], hinweise: []
    };
    (kopf.positionen || []).forEach(function (p) {
      var art = artikelById(state, p.artikelId);
      var geliefert = num(p.gelieferteMenge);
      var beschaedigt = num(p.beschaedigteMenge);
      var akzeptiert = r3(Math.max(0, geliefert - beschaedigt));
      var bestellPos = bo ? (bo.positionen || []).filter(function (x) { return x.artikelId === p.artikelId; })[0] : null;
      var bestellt = num(p.bestellMenge != null ? p.bestellMenge : (bestellPos ? bestellPos.bestellt : geliefert));
      var bisher = bestellPos ? num(bestellPos.geliefert) : 0;
      var restVorher = Math.max(0, bestellt - bisher);
      // Charge anlegen/finden
      var charge = null;
      if (p.chargennummer || art && art.chargenpflicht) {
        var chNr = p.chargennummer || ("CH-" + (art ? art.artikelnummer : p.artikelId) + "-" + (we.lieferschein || we.datum));
        charge = (state.chargen || []).filter(function (c) { return c.chargennummer === chNr && c.mandantId === we.mandantId; })[0];
        if (!charge) {
          charge = {
            id: uid("ch"), mandantId: we.mandantId, chargennummer: chNr, schmelznummer: p.schmelznummer || null,
            lieferantId: we.lieferantId, herstellerName: p.herstellerName || null, wareneingangId: we.id,
            werkstoff: (art && art.werkstoff) || p.werkstoff || null, menge: 0,
            pruefstatus: p.qs ? PRUEF_STATUS.PRUEFUNG : PRUEF_STATUS.FREIGEGEBEN, gesperrt: false,
            zertifikate: (p.zertifikate || []).slice(), lagerplaetze: [], erstellt: jetztISO
          };
          (state.chargen || (state.chargen = [])).push(charge);
        }
        charge.menge = r3(num(charge.menge) + akzeptiert);
        if (p.lagerplatzId && charge.lagerplaetze.indexOf(p.lagerplatzId) < 0) charge.lagerplaetze.push(p.lagerplatzId);
        (p.zertifikate || []).forEach(function (z) { if (charge.zertifikate.indexOf(z) < 0) charge.zertifikate.push(z); });
      }
      // Bewegung buchen (nur akzeptierte Menge wird eingelagert)
      var bew = null;
      if (akzeptiert > 0) {
        bew = bewegungNeu({
          mandantId: we.mandantId, typ: BEWEGUNG.WARENEINGANG, artikelId: p.artikelId, menge: akzeptiert,
          einheit: art ? art.basiseinheit : p.einheit, zielLagerplatzId: p.lagerplatzId || (art ? art.standardLagerplatzId : null),
          chargeId: charge ? charge.id : null, benutzer: we.benutzer, zeitpunkt: we.datum,
          grund: "Wareneingang" + (we.lieferschein ? " " + we.lieferschein : ""), preisSnapshot: p.einkaufspreis,
          qs: !!p.qs, quelle: we.lieferantId, ziel: p.lagerplatzId
        }, jetztISO);
        journalPush(state.bewegungen, bew);
      }
      // Bestellfortschritt aktualisieren
      if (bestellPos) { bestellPos.geliefert = r3(bisher + geliefert); if (bestellPos.geliefert >= bestellPos.bestellt - 1e-9) bestellPos.status = "geliefert"; else bestellPos.status = "teilgeliefert"; }
      var restNachher = r3(Math.max(0, bestellt - (bisher + geliefert)));
      var mehr = r3(Math.max(0, (bisher + geliefert) - bestellt));
      if (mehr > 0) we.hinweise.push("Mehrlieferung Artikel " + (art ? art.artikelnummer : p.artikelId) + ": +" + mehr);
      if (restNachher > 0) we.hinweise.push("Teil-/Minderlieferung Artikel " + (art ? art.artikelnummer : p.artikelId) + ": Restmenge " + restNachher);
      we.positionen.push({
        artikelId: p.artikelId, bestellt: bestellt, bisherGeliefert: bisher, gelieferteMenge: geliefert,
        restMenge: restNachher, mehrlieferung: mehr, beschaedigteMenge: beschaedigt, akzeptierteMenge: akzeptiert,
        chargeId: charge ? charge.id : null, einkaufspreis: num(p.einkaufspreis), qualitaetsstatus: p.qs ? PRUEF_STATUS.PRUEFUNG : PRUEF_STATUS.FREIGEGEBEN,
        lagerplatzId: p.lagerplatzId || null, bewegungId: bew ? bew.id : null
      });
    });
    // Bestellstatus fortschreiben
    if (bo) { var alle = (bo.positionen || []); var fertig = alle.every(function (x) { return num(x.geliefert) >= num(x.bestellt) - 1e-9; }); bo.status = fertig ? "abgeschlossen" : "teilgeliefert"; }
    (state.wareneingaenge || (state.wareneingaenge = [])).push(we);
    return we;
  }

  // ============================================================
  //  RESERVIERUNGEN (keine stille Überreservierung)
  // ============================================================
  function reserviere(state, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var art = artikelById(state, daten.artikelId);
    if (!art) return { ok: false, grund: "Artikel nicht vorhanden" };
    if (daten.mandantId != null && art.mandantId != null && daten.mandantId !== art.mandantId) return { ok: false, grund: "Cross-Tenant – fremder Mandant" };
    var benoetigt = num(daten.menge);
    if (benoetigt <= 0) return { ok: false, grund: "Menge muss > 0 sein" };
    if (daten.chargeId) { var ch = chargeById(state, daten.chargeId); if (ch && (ch.gesperrt || ch.pruefstatus === PRUEF_STATUS.GESPERRT)) return { ok: false, grund: "Charge gesperrt" }; }
    var frei = verfuegbar(state, daten.artikelId, { mandantId: art.mandantId });
    var reservierbar = r3(Math.max(0, Math.min(benoetigt, frei)));
    var fehlmenge = r3(Math.max(0, benoetigt - reservierbar));
    var status = reservierbar <= 0 ? RES_STATUS.VORGEMERKT : (fehlmenge > 0 ? RES_STATUS.TEILWEISE : RES_STATUS.RESERVIERT);
    var res = {
      id: uid("res"), mandantId: art.mandantId, artikelId: daten.artikelId, auftragId: daten.auftragId || null,
      projektId: daten.projektId || null, kommission: daten.kommission || null, arbeitsgang: daten.arbeitsgang || null,
      chargeId: daten.chargeId || null, lagerplatzId: daten.lagerplatzId || null,
      benoetigt: benoetigt, reserviert: reservierbar, entnommen: 0, fehlmenge: fehlmenge,
      benoetigtBis: daten.benoetigtBis || null, prioritaet: daten.prioritaet != null ? daten.prioritaet : 3,
      status: status, benutzer: daten.benutzer || null, erstellt: jetztISO, geaendert: jetztISO
    };
    (state.reservierungen || (state.reservierungen = [])).push(res);
    var bew = null;
    if (reservierbar > 0) {
      bew = bewegungNeu({ mandantId: art.mandantId, typ: BEWEGUNG.RESERVIERUNG, artikelId: daten.artikelId, menge: reservierbar, einheit: art.basiseinheit, chargeId: daten.chargeId, zielLagerplatzId: daten.lagerplatzId, auftragId: daten.auftragId, kommission: daten.kommission, arbeitsgang: daten.arbeitsgang, reservierungId: res.id, benutzer: daten.benutzer, zeitpunkt: jetztISO, grund: "Reservierung" }, jetztISO);
      journalPush(state.bewegungen, bew);
    }
    return { ok: true, reservierung: res, bewegung: bew, fehlmenge: fehlmenge, teilweise: fehlmenge > 0 };
  }
  function reservierungAufloesen(state, resId, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var res = (state.reservierungen || []).filter(function (r) { return r.id === resId; })[0];
    if (!res) return { ok: false, grund: "Reservierung nicht vorhanden" };
    var offen = r3(num(res.reserviert) - num(res.entnommen));
    if (offen > 0) {
      var bew = bewegungNeu({ mandantId: res.mandantId, typ: BEWEGUNG.RESERVIERUNG_AUF, artikelId: res.artikelId, menge: offen, chargeId: res.chargeId, auftragId: res.auftragId, reservierungId: res.id, zeitpunkt: jetztISO, grund: "Reservierung aufgelöst" }, jetztISO);
      journalPush(state.bewegungen, bew);
    }
    res.reserviert = num(res.entnommen); res.fehlmenge = 0; res.status = res.entnommen > 0 ? RES_STATUS.ENTNOMMEN : RES_STATUS.FREIGEGEBEN; res.geaendert = jetztISO;
    return { ok: true, reservierung: res };
  }

  // ============================================================
  //  ENTNAHME / RÜCKGABE
  // ============================================================
  function entnahme(state, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var art = artikelById(state, daten.artikelId);
    if (!art) return { ok: false, grund: "Artikel nicht vorhanden" };
    var res = daten.reservierungId ? (state.reservierungen || []).filter(function (r) { return r.id === daten.reservierungId; })[0] : null;
    var menge = num(daten.menge);
    if (menge <= 0) return { ok: false, grund: "Menge muss > 0 sein" };
    var pr = pruefeBewegung(state, { mandantId: art.mandantId, typ: BEWEGUNG.ENTNAHME, artikelId: daten.artikelId, menge: menge, chargeId: daten.chargeId, reservierungId: daten.reservierungId });
    if (!pr.ok) return { ok: false, grund: pr.grund, fehlmenge: pr.fehlmenge };
    if (res) {
      var offenRes = r3(num(res.reserviert) - num(res.entnommen));
      if (menge > offenRes + 1e-9) return { ok: false, grund: "Entnahme übersteigt Reservierung (offen " + offenRes + ")" };
    }
    var bew = bewegungNeu({
      mandantId: art.mandantId, typ: BEWEGUNG.ENTNAHME, artikelId: daten.artikelId, menge: menge, einheit: art.basiseinheit,
      quelleLagerplatzId: daten.lagerplatzId || art.standardLagerplatzId, chargeId: daten.chargeId,
      auftragId: daten.auftragId, projektId: daten.projektId, kommission: daten.kommission, arbeitsgang: daten.arbeitsgang,
      reservierungId: daten.reservierungId, benutzer: daten.benutzer, zeitpunkt: daten.zeitpunkt || jetztISO,
      grund: daten.grund || "Entnahme", preisSnapshot: daten.preisSnapshot, idempotenzKey: daten.idempotenzKey
    }, jetztISO);
    var pushed = journalPush(state.bewegungen, bew);
    if (!pushed.neu) return { ok: true, bewegung: pushed.record, neu: false };
    if (res) { res.entnommen = r3(num(res.entnommen) + menge); res.geaendert = jetztISO; if (res.entnommen >= res.reserviert - 1e-9 && res.fehlmenge <= 0) res.status = RES_STATUS.ENTNOMMEN; }
    return { ok: true, bewegung: pushed.record, neu: true };
  }
  function rueckgabe(state, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var ent = (state.bewegungen || []).filter(function (b) { return b.id === daten.entnahmeId && b.typ === BEWEGUNG.ENTNAHME; })[0];
    if (!ent) return { ok: false, grund: "Ursprüngliche Entnahme nicht gefunden" };
    var menge = num(daten.menge);
    if (menge <= 0) return { ok: false, grund: "Menge muss > 0 sein" };
    // nicht mehr zurückgeben als (netto) entnommen wurde
    var bereitsZurueck = (state.bewegungen || []).filter(function (b) { return b.typ === BEWEGUNG.RUECKGABE && b.entnahmeRef === ent.id; }).reduce(function (s, b) { return s + num(b.menge); }, 0);
    if (menge > num(ent.menge) - bereitsZurueck + 1e-9) return { ok: false, grund: "Rückgabe übersteigt Entnahme" };
    var bew = bewegungNeu({
      mandantId: ent.mandantId, typ: BEWEGUNG.RUECKGABE, artikelId: ent.artikelId, menge: menge, einheit: ent.einheit,
      zielLagerplatzId: daten.lagerplatzId || ent.quelleLagerplatzId, chargeId: ent.chargeId, auftragId: ent.auftragId,
      kommission: ent.kommission, arbeitsgang: ent.arbeitsgang, entnahmeRef: ent.id, benutzer: daten.benutzer,
      zeitpunkt: daten.zeitpunkt || jetztISO, grund: daten.grund || "Rückgabe", preisSnapshot: ent.preisSnapshot
    }, jetztISO);
    var pushed = journalPush(state.bewegungen, bew);
    return { ok: true, bewegung: pushed.record, neu: pushed.neu };
  }
  // Tatsächlicher Verbrauch = Entnahmen - Rückgaben (optional je Auftrag/Artikel).
  function verbrauch(state, filter) {
    filter = filter || {};
    var ent = 0, ret = 0;
    (state.bewegungen || []).forEach(function (b) {
      if (filter.artikelId && b.artikelId !== filter.artikelId) return;
      if (filter.auftragId && b.auftragId !== filter.auftragId) return;
      if (filter.mandantId != null && b.mandantId !== filter.mandantId) return;
      if (b.typ === BEWEGUNG.ENTNAHME) ent += num(b.menge);
      else if (b.typ === BEWEGUNG.RUECKGABE) ret += num(b.menge);
    });
    return { entnommen: r3(ent), zurueck: r3(ret), verbrauch: r3(ent - ret) };
  }

  // ============================================================
  //  UMLAGERUNG / KORREKTUR / INVENTUR / STORNO
  // ============================================================
  function umlagerung(state, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var art = artikelById(state, daten.artikelId); if (!art) return { ok: false, grund: "Artikel nicht vorhanden" };
    var menge = num(daten.menge); if (menge <= 0) return { ok: false, grund: "Menge muss > 0 sein" };
    var amQuelle = bestandProPlatz(state.bewegungen, daten.artikelId, daten.quelleLagerplatzId, { mandantId: art.mandantId });
    if (!art.negativerBestandErlaubt && menge > amQuelle + 1e-9) return { ok: false, grund: "Nicht genügend Bestand am Quell-Lagerplatz (" + amQuelle + ")" };
    var bew = bewegungNeu({ mandantId: art.mandantId, typ: BEWEGUNG.UMLAGERUNG, artikelId: daten.artikelId, menge: menge, einheit: art.basiseinheit, quelleLagerplatzId: daten.quelleLagerplatzId, zielLagerplatzId: daten.zielLagerplatzId, chargeId: daten.chargeId, benutzer: daten.benutzer, zeitpunkt: jetztISO, grund: daten.grund || "Umlagerung" }, jetztISO);
    var pushed = journalPush(state.bewegungen, bew);
    return { ok: true, bewegung: pushed.record, neu: pushed.neu };
  }
  function korrektur(state, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var art = artikelById(state, daten.artikelId); if (!art) return { ok: false, grund: "Artikel nicht vorhanden" };
    var typ = daten.inventur ? BEWEGUNG.INVENTURDIFFERENZ : BEWEGUNG.KORREKTUR;
    var bew = bewegungNeu({ mandantId: art.mandantId, typ: typ, artikelId: daten.artikelId, menge: num(daten.menge), einheit: art.basiseinheit, zielLagerplatzId: daten.lagerplatzId, chargeId: daten.chargeId, benutzer: daten.benutzer, zeitpunkt: jetztISO, grund: daten.grund || (daten.inventur ? "Inventurdifferenz" : "Korrektur") }, jetztISO);
    var pushed = journalPush(state.bewegungen, bew);
    return { ok: true, bewegung: pushed.record, neu: pushed.neu };
  }
  // Storniert eine Bewegung durch eine Gegenbuchung (Original bleibt erhalten).
  function storniere(state, bewegungId, grund, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var orig = (state.bewegungen || []).filter(function (b) { return b.id === bewegungId; })[0];
    if (!orig) return { ok: false, grund: "Bewegung nicht vorhanden" };
    if (orig.storniert) return { ok: false, grund: "Bereits storniert" };
    var inv = { physisch: -num(orig.deltas.physisch), reserviert: -num(orig.deltas.reserviert), gesperrt: -num(orig.deltas.gesperrt), quali: -num(orig.deltas.quali), rest: -num(orig.deltas.rest) };
    var gegen = bewegungNeu({
      mandantId: orig.mandantId, typ: BEWEGUNG.STORNO, artikelId: orig.artikelId, menge: orig.menge, einheit: orig.einheit,
      quelleLagerplatzId: orig.zielLagerplatzId, zielLagerplatzId: orig.quelleLagerplatzId, chargeId: orig.chargeId,
      auftragId: orig.auftragId, kommission: orig.kommission, benutzer: (grund && grund.benutzer) || null,
      zeitpunkt: jetztISO, grund: (typeof grund === "string" ? grund : (grund && grund.grund)) || "Storno", stornoVon: orig.id, deltas: inv,
      idempotenzKey: idempotenzKey("storno", orig.id)
    }, jetztISO);
    // Umlagerung invertiert: Quelle/Ziel sind im Gegen-Datensatz bereits getauscht
    if (orig.typ === BEWEGUNG.UMLAGERUNG) gegen.deltas = { physisch: 0, reserviert: 0, gesperrt: 0, quali: 0, rest: 0 };
    var pushed = journalPush(state.bewegungen, gegen);
    if (pushed.neu) orig.storniert = true;
    return { ok: pushed.neu, bewegung: pushed.record, original: orig };
  }

  // ============================================================
  //  CHARGEN (sperren/entsperren + Rückverfolgung)
  // ============================================================
  // Summiert einen Bestandstopf je Artikel für die Bewegungen einer Charge.
  function chargeToepfeProArtikel(state, chargeId, feld) {
    var proArt = {};
    (state.bewegungen || []).forEach(function (b) {
      if (b.chargeId !== chargeId || !b.artikelId) return;
      var dz = b.deltas || {}; proArt[b.artikelId] = num(proArt[b.artikelId]) + num(dz[feld]);
    });
    return proArt;
  }
  function chargeSperren(state, chargeId, grund, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var ch = chargeById(state, chargeId); if (!ch) return { ok: false, grund: "Charge nicht vorhanden" };
    ch.gesperrt = true; ch.pruefstatus = PRUEF_STATUS.GESPERRT; ch.gesperrtGrund = grund || null;
    // Verfügbaren (physisch minus bereits gesperrt) Bestand dieser Charge je Artikel sperren.
    var phys = chargeToepfeProArtikel(state, chargeId, "physisch");
    var gesp = chargeToepfeProArtikel(state, chargeId, "gesperrt");
    var bewegungen = [], gesamt = 0;
    Object.keys(phys).forEach(function (aid) {
      var offen = r3(Math.max(0, num(phys[aid]) - num(gesp[aid])));
      if (offen > 0) { var bew = bewegungNeu({ mandantId: ch.mandantId, typ: BEWEGUNG.SPERRUNG, artikelId: aid, menge: offen, chargeId: chargeId, zeitpunkt: jetztISO, grund: "Charge gesperrt: " + (grund || "") }, jetztISO); journalPush(state.bewegungen, bew); bewegungen.push(bew); gesamt += offen; }
    });
    return { ok: true, charge: ch, bewegungen: bewegungen, gesperrteMenge: r3(gesamt) };
  }
  function chargeEntsperren(state, chargeId, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var ch = chargeById(state, chargeId); if (!ch) return { ok: false, grund: "Charge nicht vorhanden" };
    var gesp = chargeToepfeProArtikel(state, chargeId, "gesperrt");
    ch.gesperrt = false; ch.pruefstatus = PRUEF_STATUS.FREIGEGEBEN; ch.gesperrtGrund = null;
    var bewegungen = [];
    Object.keys(gesp).forEach(function (aid) {
      var offen = r3(Math.max(0, num(gesp[aid])));
      if (offen > 0) { var bew = bewegungNeu({ mandantId: ch.mandantId, typ: BEWEGUNG.ENTSPERRUNG, artikelId: aid, menge: offen, chargeId: chargeId, zeitpunkt: jetztISO, grund: "Charge entsperrt" }, jetztISO); journalPush(state.bewegungen, bew); bewegungen.push(bew); }
    });
    return { ok: true, charge: ch, bewegungen: bewegungen };
  }
  // Rückverfolgung: Lieferant → Wareneingang → Charge → Lagerplatz → Auftrag → Kommission.
  function rueckverfolgung(state, chargeId) {
    var ch = chargeById(state, chargeId); if (!ch) return null;
    var we = (state.wareneingaenge || []).filter(function (x) { return x.id === ch.wareneingangId; })[0] || null;
    var verwendungen = (state.bewegungen || []).filter(function (b) { return b.chargeId === chargeId && (b.typ === BEWEGUNG.ENTNAHME || b.typ === BEWEGUNG.RESTSTUECK_VERBRAUCH); }).map(function (b) {
      return { bewegungId: b.id, typ: b.typ, menge: b.menge, auftragId: b.auftragId, kommission: b.kommission, arbeitsgang: b.arbeitsgang, lagerplatzId: b.quelleLagerplatzId, zeitpunkt: b.zeitpunkt };
    });
    return {
      lieferantId: ch.lieferantId, wareneingangId: ch.wareneingangId, lieferschein: we ? we.lieferschein : null,
      charge: { id: ch.id, chargennummer: ch.chargennummer, schmelznummer: ch.schmelznummer, werkstoff: ch.werkstoff, pruefstatus: ch.pruefstatus, zertifikate: ch.zertifikate },
      lagerplaetze: ch.lagerplaetze.slice(), verwendungen: verwendungen
    };
  }

  // ============================================================
  //  RESTSTÜCKE (inkl. Langgut-Restlänge)
  // ============================================================
  function reststueckAnlegen(state, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var rs = {
      id: uid("rs"), mandantId: daten.mandantId || null, reststuecknummer: daten.reststuecknummer || ("RST-" + uid("n").slice(-6)),
      materialId: daten.materialId || null, artikelId: daten.artikelId || null, werkstoff: daten.werkstoff || null, chargeId: daten.chargeId || null,
      laenge: daten.laenge != null ? num(daten.laenge) : null, breite: daten.breite != null ? num(daten.breite) : null,
      staerke: daten.staerke != null ? num(daten.staerke) : null, durchmesser: daten.durchmesser != null ? num(daten.durchmesser) : null,
      gewicht: daten.gewicht != null ? num(daten.gewicht) : null, ursprungAuftragId: daten.ursprungAuftragId || null, kommission: daten.kommission || null,
      lagerplatzId: daten.lagerplatzId || null, qualitaetsstatus: daten.qualitaetsstatus || PRUEF_STATUS.FREIGEGEBEN,
      status: REST_STATUS.VERFUEGBAR, fotoRef: daten.fotoRef || null, qrRef: daten.qrRef || null,
      ausgangslaenge: daten.laenge != null ? num(daten.laenge) : null, verwendungen: [], erstellt: jetztISO
    };
    (state.reststuecke || (state.reststuecke = [])).push(rs);
    if (daten.artikelId) { var bew = bewegungNeu({ mandantId: rs.mandantId, typ: BEWEGUNG.RESTSTUECK_ZUGANG, artikelId: daten.artikelId, menge: daten.gewicht != null ? num(daten.gewicht) : 1, chargeId: daten.chargeId, zielLagerplatzId: daten.lagerplatzId, reststueckId: rs.id, auftragId: daten.ursprungAuftragId, zeitpunkt: jetztISO, grund: "Reststückzugang" }, jetztISO); journalPush(state.bewegungen, bew); }
    return rs;
  }
  function reststueckReservieren(state, rsId, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var rs = (state.reststuecke || []).filter(function (r) { return r.id === rsId; })[0];
    if (!rs) return { ok: false, grund: "Reststück nicht vorhanden" };
    if (rs.status === REST_STATUS.VERBRAUCHT || rs.status === REST_STATUS.GESPERRT || rs.status === REST_STATUS.VERSCHROTTET) return { ok: false, grund: "Reststück nicht verfügbar (" + rs.status + ")" };
    rs.status = REST_STATUS.RESERVIERT; rs.reserviertFuer = { auftragId: (daten || {}).auftragId || null, kommission: (daten || {}).kommission || null }; rs.geaendert = jetztISO;
    return { ok: true, reststueck: rs };
  }
  // Langgut: Restlänge = Ausgangslänge - verwendete Länge - Schnittverlust.
  function reststueckVerbrauch(state, rsId, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var rs = (state.reststuecke || []).filter(function (r) { return r.id === rsId; })[0];
    if (!rs) return { ok: false, grund: "Reststück nicht vorhanden" };
    if (rs.status === REST_STATUS.GESPERRT || rs.status === REST_STATUS.VERSCHROTTET) return { ok: false, grund: "Reststück gesperrt/verschrottet" };
    var verwendet = num((daten || {}).verwendeteLaenge);
    var schnitt = num((daten || {}).schnittverlust);
    if (rs.laenge != null) {
      var neu = r3(rs.laenge - verwendet - schnitt);
      if (neu < -1e-9) return { ok: false, grund: "Verwendete Länge übersteigt Restlänge" };
      rs.laenge = Math.max(0, neu);
      rs.status = rs.laenge <= 0 ? REST_STATUS.VERBRAUCHT : REST_STATUS.TEILWEISE;
    } else {
      rs.status = REST_STATUS.VERBRAUCHT;
    }
    rs.verwendungen.push({ auftragId: (daten || {}).auftragId || null, kommission: (daten || {}).kommission || null, verwendeteLaenge: verwendet, schnittverlust: schnitt, zeitpunkt: jetztISO });
    rs.geaendert = jetztISO;
    if (rs.artikelId) { var bew = bewegungNeu({ mandantId: rs.mandantId, typ: BEWEGUNG.RESTSTUECK_VERBRAUCH, artikelId: rs.artikelId, menge: (daten || {}).gewicht != null ? num(daten.gewicht) : 1, chargeId: rs.chargeId, quelleLagerplatzId: rs.lagerplatzId, reststueckId: rs.id, auftragId: (daten || {}).auftragId, kommission: (daten || {}).kommission, zeitpunkt: jetztISO, grund: "Reststückverbrauch" }, jetztISO); journalPush(state.bewegungen, bew); }
    return { ok: true, reststueck: rs, restlaenge: rs.laenge };
  }

  // ============================================================
  //  MINDESTBESTAND / BESTELLVORSCHLAG
  // ============================================================
  // reservierter Fehlbedarf = Summe offener Fehlmengen aus Reservierungen.
  function reservierterFehlbedarf(state, artikelId, opts) {
    var f = 0;
    (state.reservierungen || []).forEach(function (r) {
      if (r.artikelId !== artikelId) return;
      if (opts && opts.mandantId != null && r.mandantId !== opts.mandantId) return;
      if (r.status === RES_STATUS.STORNIERT || r.status === RES_STATUS.FREIGEGEBEN || r.status === RES_STATUS.ABGELAUFEN) return;
      f += num(r.fehlmenge);
    });
    return r3(f);
  }
  function bestellvorschlag(state, artikelId) {
    var art = artikelById(state, artikelId); if (!art) return null;
    var b = bestand(state, artikelId, { mandantId: art.mandantId });
    var fehl = reservierterFehlbedarf(state, artikelId, { mandantId: art.mandantId });
    var ziel = num(art.zielbestand);
    var roh = r3(ziel + fehl - b.verfuegbar - b.bestellt);
    if (roh <= 0) return { artikelId: artikelId, artikelnummer: art.artikelnummer, menge: 0, bestellen: false, verfuegbar: b.verfuegbar, bestellt: b.bestellt, ziel: ziel, fehlbedarf: fehl, unterMindest: b.verfuegbar < num(art.mindestbestand), unterMelde: b.verfuegbar < num(art.meldebestand) };
    // Verpackungseinheit + Mindestbestellmenge berücksichtigen (aufrunden).
    var vpe = num(art.verpackungseinheit) > 0 ? num(art.verpackungseinheit) : 1;
    var mbm = num(art.mindestbestellmenge);
    var menge = Math.ceil((roh - 1e-9) / vpe) * vpe;
    if (menge < mbm) menge = Math.ceil((mbm - 1e-9) / vpe) * vpe;
    return {
      artikelId: artikelId, artikelnummer: art.artikelnummer, menge: r3(menge), bestellen: true,
      verfuegbar: b.verfuegbar, bestellt: b.bestellt, ziel: ziel, fehlbedarf: fehl,
      lieferantId: art.bevorzugterLieferantId || null, lieferzeitTage: num(art.lieferzeitTage),
      verpackungseinheit: vpe, mindestbestellmenge: mbm,
      unterMindest: b.verfuegbar < num(art.mindestbestand), unterMelde: b.verfuegbar < num(art.meldebestand)
    };
  }
  function bestellvorschlaege(state, mandantId) {
    return (state.artikel || []).filter(function (a) { return mandantId == null || a.mandantId === mandantId; })
      .map(function (a) { return bestellvorschlag(state, a.id); }).filter(function (v) { return v && v.bestellen; });
  }

  // ============================================================
  //  BESTANDSBEWERTUNG (technisch; nicht steuerrechtlich verbindlich)
  // ============================================================
  function bewertung(state, artikelId, methode) {
    var art = artikelById(state, artikelId);
    methode = methode || (art && art.bewertungsmethode) || METHODE.GLEITEND;
    var eingaenge = [];
    (state.wareneingaenge || []).forEach(function (we) { (we.positionen || []).forEach(function (p) { if (p.artikelId === artikelId && p.akzeptierteMenge > 0) eingaenge.push({ menge: num(p.akzeptierteMenge), preis: num(p.einkaufspreis), chargeId: p.chargeId, datum: we.datum }); }); });
    var letzter = eingaenge.length ? eingaenge[eingaenge.length - 1].preis : (art ? num(art.letzterEinkaufspreis) : 0);
    var summeMenge = 0, summeWert = 0;
    eingaenge.forEach(function (e) { summeMenge += e.menge; summeWert += e.menge * e.preis; });
    var gleitend = summeMenge > 0 ? r2(summeWert / summeMenge) : letzter;
    var proCharge = {};
    eingaenge.forEach(function (e) { if (e.chargeId) proCharge[e.chargeId] = e.preis; });
    var gewaehlt = methode === METHODE.LETZTER ? letzter : (methode === METHODE.CHARGE ? null : gleitend);
    return { methode: methode, letzter: r2(letzter), gleitend: gleitend, proCharge: proCharge, wert: gewaehlt, hinweis: "Technische Bewertung – keine steuerrechtlich verbindliche Lagerbewertung." };
  }

  // ============================================================
  //  OFFLINE-KONFLIKT (nichts still löschen / keine negative Menge)
  // ============================================================
  // Wendet eine (offline erzeugte) Bewegung nur an, wenn sie erneut valide ist.
  // Sonst wird ein Konflikt zur Prüfung gespeichert (kein stilles Löschen).
  function uebernehmeOffline(state, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    // Idempotenz: bereits vorhandener Schlüssel -> keine zweite Bewegung
    var key = daten.idempotenzKey;
    if (key) { var da = (state.bewegungen || []).filter(function (b) { return b.idempotenzKey === key; })[0]; if (da) return { ok: true, bewegung: da, neu: false }; }
    // Mobile Inventurzählung: Differenz gegen den AKTUELLEN Systembestand
    // berechnen (nicht gegen einen möglicherweise veralteten Offline-Bestand).
    if (daten.aktion === "inventurzaehlung") {
      var art0 = artikelById(state, daten.artikelId); if (!art0) { var kf0 = { id: uid("kf"), mandantId: daten.mandantId || null, grund: "Artikel nicht vorhanden", daten: daten, status: "offen", erstellt: jetztISO }; (state.konflikte || (state.konflikte = [])).push(kf0); return { ok: false, konflikt: kf0, grund: "Artikel nicht vorhanden" }; }
      var sys = bestandProPlatz(state.bewegungen, daten.artikelId, daten.lagerplatzId, { mandantId: art0.mandantId });
      var diff = r3(num(daten.gezaehlt) - sys);
      if (diff === 0) return { ok: true, bewegung: null, neu: false };
      var ib = bewegungNeu({ mandantId: art0.mandantId, typ: BEWEGUNG.INVENTURDIFFERENZ, artikelId: daten.artikelId, menge: diff, einheit: art0.basiseinheit, zielLagerplatzId: daten.lagerplatzId, chargeId: daten.chargeId || null, benutzer: daten.benutzer, zeitpunkt: jetztISO, grund: "Mobile Inventurzählung (gegen aktuellen Bestand " + sys + ")", idempotenzKey: key }, jetztISO);
      var ip = journalPush(state.bewegungen, ib);
      return { ok: true, bewegung: ip.record, neu: ip.neu };
    }
    var pr = pruefeBewegung(state, daten);
    if (!pr.ok) {
      var kf = { id: uid("kf"), mandantId: daten.mandantId || null, grund: pr.grund, fehlmenge: pr.fehlmenge != null ? pr.fehlmenge : null, daten: daten, status: "offen", erstellt: jetztISO };
      (state.konflikte || (state.konflikte = [])).push(kf);
      return { ok: false, konflikt: kf, grund: pr.grund };
    }
    var bew = bewegungNeu(daten, jetztISO);
    var pushed = journalPush(state.bewegungen, bew);
    return { ok: true, bewegung: pushed.record, neu: pushed.neu };
  }

  // ============================================================
  //  RÜCKWÄRTS-RÜCKVERFOLGUNG  (Auftrag → Verbrauch → Charge → WE → Lieferant)
  // ============================================================
  function rueckverfolgungRueckwaerts(state, auftragId) {
    var verbraeuche = (state.bewegungen || []).filter(function (b) { return b.auftragId === auftragId && (b.typ === BEWEGUNG.ENTNAHME || b.typ === BEWEGUNG.RESTSTUECK_VERBRAUCH); });
    return verbraeuche.map(function (b) {
      var ch = b.chargeId ? chargeById(state, b.chargeId) : null;
      var we = ch ? (state.wareneingaenge || []).filter(function (x) { return x.id === ch.wareneingangId; })[0] : null;
      return {
        bewegungId: b.id, typ: b.typ, artikelId: b.artikelId, menge: b.menge, kommission: b.kommission, arbeitsgang: b.arbeitsgang, zeitpunkt: b.zeitpunkt,
        chargennummer: ch ? ch.chargennummer : null, schmelznummer: ch ? ch.schmelznummer : null,
        wareneingangId: we ? we.id : null, lieferschein: we ? we.lieferschein : null, lieferantId: ch ? ch.lieferantId : null
      };
    });
  }

  // ============================================================
  //  CHARGENSPERRE – Auswirkungsanalyse (vor dem Sperren anzeigen)
  // ============================================================
  function chargeSperrImpact(state, chargeId) {
    var ch = chargeById(state, chargeId); if (!ch) return null;
    var proArt = chargeToepfeProArtikel(state, chargeId, "physisch");
    var bestand = 0; Object.keys(proArt).forEach(function (k) { bestand += num(proArt[k]); });
    var reservierungen = (state.reservierungen || []).filter(function (r) { return r.chargeId === chargeId && r.status !== RES_STATUS.STORNIERT && r.status !== RES_STATUS.FREIGEGEBEN; });
    var entnahmen = (state.bewegungen || []).filter(function (b) { return b.chargeId === chargeId && b.typ === BEWEGUNG.ENTNAHME; });
    var auftraege = {}, kommissionen = {};
    entnahmen.concat(reservierungen).forEach(function (x) { if (x.auftragId) auftraege[x.auftragId] = true; if (x.kommission) kommissionen[x.kommission] = true; });
    return {
      chargennummer: ch.chargennummer, bestand: r3(bestand), lagerplaetze: ch.lagerplaetze.slice(),
      reservierungen: reservierungen.length, entnahmen: entnahmen.length,
      auftraege: Object.keys(auftraege), kommissionen: Object.keys(kommissionen), zertifikate: ch.zertifikate.slice()
    };
  }
  // Entsperren nur mit Grund + Audit (Protokoll bleibt an der Charge erhalten).
  function chargeEntsperrenAudit(state, chargeId, opts, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    opts = opts || {};
    if (!opts.grund) return { ok: false, grund: "Grund erforderlich" };
    var res = chargeEntsperren(state, chargeId, jetztISO);
    if (!res.ok) return res;
    var ch = res.charge;
    if (!Array.isArray(ch.entsperrHistorie)) ch.entsperrHistorie = [];
    ch.entsperrHistorie.push({ grund: opts.grund, benutzer: opts.benutzer || null, zeitpunkt: jetztISO });
    return res;
  }

  // ============================================================
  //  BESTELLUNGEN (Status-Workflow; niemals automatisch versenden)
  // ============================================================
  function bestellungNeu(state, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var bo = {
      id: uid("bo"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("BST-" + uid("n").slice(-6)),
      lieferantId: daten.lieferantId || null, status: "Entwurf", lieferzeitTage: num(daten.lieferzeitTage),
      liefertermin: daten.liefertermin || null, erstellt: jetztISO, freigegebenVon: null, historie: [{ status: "Entwurf", zeitpunkt: jetztISO, benutzer: daten.benutzer || null }],
      positionen: (daten.positionen || []).map(function (p) { return { artikelId: p.artikelId, bestellt: num(p.menge != null ? p.menge : p.bestellt), geliefert: 0, status: "offen", einzelpreis: p.einzelpreis != null ? num(p.einzelpreis) : null }; })
    };
    (state.bestellungen || (state.bestellungen = [])).push(bo);
    return bo;
  }
  function bestellungStatus(state, boId, status, benutzer, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var bo = (state.bestellungen || []).filter(function (x) { return x.id === boId; })[0];
    if (!bo) return { ok: false, grund: "Bestellung nicht vorhanden" };
    if (BESTELL_STATUS.indexOf(status) < 0) return { ok: false, grund: "Unbekannter Status" };
    bo.status = status; if (status === "freigegeben") bo.freigegebenVon = benutzer || null;
    if (!Array.isArray(bo.historie)) bo.historie = [];
    bo.historie.push({ status: status, zeitpunkt: jetztISO, benutzer: benutzer || null });
    return { ok: true, bestellung: bo };
  }
  function bestellungAusVorschlag(state, artikelId, benutzer, jetztISO) {
    var v = bestellvorschlag(state, artikelId); if (!v || !v.bestellen) return null;
    var art = artikelById(state, artikelId);
    return bestellungNeu(state, { mandantId: art.mandantId, lieferantId: v.lieferantId, lieferzeitTage: v.lieferzeitTage, benutzer: benutzer, positionen: [{ artikelId: artikelId, menge: v.menge }] }, jetztISO);
  }
  // Verspätete Lieferungen: offene Bestellungen mit überschrittenem Liefertermin.
  function verspaeteteLieferungen(state, mandantId, jetztISO) {
    var jetzt = jetztISO ? new Date(jetztISO).getTime() : (w.Preisschmiede.Store ? new Date(w.Preisschmiede.Store.nowISO()).getTime() : Date.now());
    return (state.bestellungen || []).filter(function (bo) {
      if (mandantId != null && bo.mandantId !== mandantId) return false;
      if (["geliefert", "storniert", "Entwurf"].indexOf(bo.status) >= 0) return false;
      return bo.liefertermin && new Date(bo.liefertermin).getTime() < jetzt;
    });
  }

  // ============================================================
  //  INVENTUR (Voll/Lagerplatz/Artikel/Stichprobe)
  // ============================================================
  function inventurNeu(state, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var typ = daten.typ || INVENTUR_TYP.VOLL;
    var mandantId = daten.mandantId || null;
    var artikelListe = (state.artikel || []).filter(function (a) { return mandantId == null || a.mandantId === mandantId; });
    if (typ === INVENTUR_TYP.ARTIKEL && daten.artikelIds) artikelListe = artikelListe.filter(function (a) { return daten.artikelIds.indexOf(a.id) >= 0; });
    // Zählliste je (Artikel × Lagerplatz mit Bestand > 0) aufbauen.
    var positionen = [];
    artikelListe.forEach(function (a) {
      var plaetze = {};
      (state.bewegungen || []).forEach(function (b) { if (b.artikelId !== a.id) return; var p = b.zielLagerplatzId || b.quelleLagerplatzId; if (p) plaetze[p] = true; });
      if (a.standardLagerplatzId) plaetze[a.standardLagerplatzId] = true;
      Object.keys(plaetze).forEach(function (pid) {
        if (typ === INVENTUR_TYP.LAGERPLATZ && daten.lagerplatzIds && daten.lagerplatzIds.indexOf(pid) < 0) return;
        var sys = bestandProPlatz(state.bewegungen, a.id, pid, { mandantId: a.mandantId });
        positionen.push({ id: uid("ip"), artikelId: a.id, lagerplatzId: pid, systemBestand: sys, gezaehlt: null, differenz: null, zweitZaehlung: null, chargeId: null, grund: null, geprueft: false });
      });
    });
    if (typ === INVENTUR_TYP.STICHPROBE) {
      var n = daten.stichprobe || Math.max(1, Math.ceil(positionen.length * 0.2));
      positionen = positionen.slice(0, n); // deterministische Stichprobe (kein Zufall im reinen Kern)
    }
    var inv = { id: uid("inv"), mandantId: mandantId, nummer: daten.nummer || ("INV-" + uid("n").slice(-6)), typ: typ, status: INVENTUR_STATUS.ANGELEGT, umfang: daten.umfang || typ, schwelleProz: daten.schwelleProz != null ? num(daten.schwelleProz) : 10, positionen: positionen, erstellt: jetztISO, pruefer: null, freigabe: null };
    (state.inventuren || (state.inventuren = [])).push(inv);
    return inv;
  }
  function inventurZaehlung(state, invId, daten, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var inv = (state.inventuren || []).filter(function (x) { return x.id === invId; })[0];
    if (!inv) return { ok: false, grund: "Inventur nicht vorhanden" };
    if (inv.status === INVENTUR_STATUS.ABGESCHLOSSEN) return { ok: false, grund: "Inventur abgeschlossen" };
    var pos = inv.positionen.filter(function (p) { return p.id === daten.positionId; })[0];
    if (!pos) return { ok: false, grund: "Position nicht vorhanden" };
    var gez = num(daten.gezaehlt);
    var zweit = !!daten.zweit;
    if (zweit) pos.zweitZaehlung = gez; else pos.gezaehlt = gez;
    pos.chargeId = daten.chargeId || pos.chargeId; pos.grund = daten.grund || pos.grund; pos.benutzer = daten.benutzer || pos.benutzer;
    var mass = zweit ? gez : pos.gezaehlt;
    pos.differenz = r3(num(mass) - num(pos.systemBestand));
    // Zweite Zählung bei hoher Abweichung anfordern.
    var basis = Math.max(1, Math.abs(num(pos.systemBestand)));
    pos.zweitZaehlungNoetig = !zweit && Math.abs(pos.differenz) / basis * 100 > inv.schwelleProz;
    pos.geprueft = zweit || !pos.zweitZaehlungNoetig;
    if (inv.status === INVENTUR_STATUS.ANGELEGT) inv.status = INVENTUR_STATUS.ZAEHLUNG;
    return { ok: true, position: pos, zweitNoetig: pos.zweitZaehlungNoetig };
  }
  function inventurFreigabe(state, invId, benutzer, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var inv = (state.inventuren || []).filter(function (x) { return x.id === invId; })[0];
    if (!inv) return { ok: false, grund: "Inventur nicht vorhanden" };
    var offen = inv.positionen.filter(function (p) { return p.gezaehlt == null; });
    if (offen.length) return { ok: false, grund: offen.length + " Position(en) noch nicht gezählt" };
    var strittig = inv.positionen.filter(function (p) { return p.zweitZaehlungNoetig && p.zweitZaehlung == null; });
    if (strittig.length) return { ok: false, grund: strittig.length + " Position(en) benötigen zweite Zählung" };
    inv.status = INVENTUR_STATUS.FREIGEGEBEN; inv.pruefer = benutzer || null; inv.freigabe = jetztISO;
    return { ok: true, inventur: inv };
  }
  // Korrekturbuchungen aus Differenzen (INVENTURDIFFERENZ; nichts wird gelöscht).
  function inventurBuchen(state, invId, benutzer, jetztISO) {
    jetztISO = jetztISO || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString());
    var inv = (state.inventuren || []).filter(function (x) { return x.id === invId; })[0];
    if (!inv) return { ok: false, grund: "Inventur nicht vorhanden" };
    if (inv.status !== INVENTUR_STATUS.FREIGEGEBEN) return { ok: false, grund: "Inventur nicht freigegeben" };
    var gebucht = 0;
    inv.positionen.forEach(function (p) {
      if (!p.differenz) return;
      var art = artikelById(state, p.artikelId); if (!art) return;
      var bew = bewegungNeu({ mandantId: art.mandantId, typ: BEWEGUNG.INVENTURDIFFERENZ, artikelId: p.artikelId, menge: p.differenz, einheit: art.basiseinheit, zielLagerplatzId: p.lagerplatzId, chargeId: p.chargeId, benutzer: benutzer, zeitpunkt: jetztISO, grund: "Inventur " + inv.nummer + (p.grund ? ": " + p.grund : ""), idempotenzKey: idempotenzKey("inv", inv.id, p.id) }, jetztISO);
      if (journalPush(state.bewegungen, bew).neu) { p.bewegungId = bew.id; gebucht++; }
    });
    inv.status = INVENTUR_STATUS.ABGESCHLOSSEN; inv.abgeschlossen = jetztISO;
    return { ok: true, inventur: inv, gebucht: gebucht };
  }

  // ============================================================
  //  QR-CODES / ETIKETTEN  (nur sichere Referenz, KEINE Preise)
  // ============================================================
  var REF_PREFIX = { lagerplatz: "LP", artikel: "AR", charge: "CH", reststueck: "RS", bestellung: "BO", wareneingang: "WE" };
  function referenzCode(typ, id) { return "PS:" + (REF_PREFIX[typ] || "XX") + ":" + String(id || ""); }
  function parseReferenz(code) { var m = /^PS:([A-Z]{2}):(.+)$/.exec(String(code || "")); if (!m) return null; var typ = { LP: "lagerplatz", AR: "artikel", CH: "charge", RS: "reststueck", BO: "bestellung", WE: "wareneingang" }[m[1]]; return typ ? { typ: typ, id: m[2] } : null; }
  // Etikettdaten je Typ – niemals Preise/Margen.
  function etikettDaten(state, typ, id) {
    var code = referenzCode(typ, id);
    if (typ === "lagerplatz") { var p = platzById(state, id); return p ? { typ: typ, code: code, titel: p.code, zeilen: [["Bezeichnung", p.bezeichnung], ["Status", p.status], ["Gruppen", (p.erlaubteMaterialgruppen || []).join(", ")]] } : null; }
    if (typ === "artikel") { var a = artikelById(state, id); return a ? { typ: typ, code: code, titel: a.artikelnummer, zeilen: [["Werkstoff", a.werkstoff], ["Abmessung", a.abmessung || "—"], ["Einheit", a.basiseinheit], ["Standardplatz", a.standardLagerplatzId || "—"]] } : null; }
    if (typ === "charge") { var c = chargeById(state, id); return c ? { typ: typ, code: code, titel: c.chargennummer, zeilen: [["Schmelze", c.schmelznummer || "—"], ["Werkstoff", c.werkstoff || "—"], ["Prüfstatus", c.pruefstatus], ["Zertifikate", (c.zertifikate || []).join(", ") || "—"]] } : null; }
    if (typ === "reststueck") { var r = (state.reststuecke || []).filter(function (x) { return x.id === id; })[0]; return r ? { typ: typ, code: code, titel: r.reststuecknummer, zeilen: [["Werkstoff", r.werkstoff || "—"], ["Maß", [r.laenge, r.breite, r.staerke].filter(function (v) { return v != null; }).join(" × ") || (r.durchmesser != null ? "Ø" + r.durchmesser : "—")], ["Gewicht", r.gewicht != null ? r.gewicht + " kg" : "—"], ["Lagerplatz", r.lagerplatzId || "—"]] } : null; }
    if (typ === "bestellung") { var bo = (state.bestellungen || []).filter(function (x) { return x.id === id; })[0]; return bo ? { typ: typ, code: code, titel: bo.nummer || bo.id, zeilen: [["Status", bo.status], ["Positionen", String((bo.positionen || []).length)]] } : null; }
    return { typ: typ, code: code, titel: String(id), zeilen: [] };
  }

  // ============================================================
  //  BERICHTE / CSV  (Werte nur mit Recht; keine Live-ERP-Verbindung)
  // ============================================================
  // CSV-Zelle: Formula-Injection verhindern (führendes =,+,-,@ wird
  // durch einen Apostroph neutralisiert), danach normal quoten.
  function csvEscape(v) { var s = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function zuCSV(headers, rows) { return [headers.join(";")].concat(rows.map(function (r) { return r.map(csvEscape).join(";"); })).join("\n"); }
  function berichtBestand(state, mandantId, mitWert) {
    var rows = (state.artikel || []).filter(function (a) { return mandantId == null || a.mandantId === mandantId; }).map(function (a) {
      var b = bestand(state, a.id, { mandantId: a.mandantId });
      var row = [a.artikelnummer, a.werkstoff, a.basiseinheit, b.physisch, b.reserviert, b.verfuegbar, b.gesperrt, b.qualitaet, b.bestellt, a.mindestbestand, a.meldebestand, a.zielbestand];
      if (mitWert) { var bw = bewertung(state, a.id); row.push(bw.gleitend, r2(b.physisch * bw.gleitend)); }
      return row;
    });
    var head = ["Artikelnummer", "Werkstoff", "Einheit", "physisch", "reserviert", "verfügbar", "gesperrt", "QS", "bestellt", "Mindest", "Melde", "Ziel"];
    if (mitWert) head.push("Ø-EK", "Lagerwert");
    return { headers: head, rows: rows, csv: zuCSV(head, rows) };
  }
  function berichtBewegungen(state, mandantId) {
    var head = ["Zeitpunkt", "Art", "Artikel", "Menge", "Einheit", "Quelle", "Ziel", "Auftrag", "Kommission", "Charge", "Benutzer", "Grund", "Storno-von"];
    var rows = (state.bewegungen || []).filter(function (b) { return mandantId == null || b.mandantId === mandantId; }).map(function (b) {
      var a = artikelById(state, b.artikelId); var c = b.chargeId ? chargeById(state, b.chargeId) : null;
      return [b.zeitpunkt, b.typ, a ? a.artikelnummer : b.artikelId, b.menge, b.einheit, b.quelleLagerplatzId, b.zielLagerplatzId, b.auftragId, b.kommission, c ? c.chargennummer : "", b.benutzer, b.grund, b.stornoVon];
    });
    return { headers: head, rows: rows, csv: zuCSV(head, rows) };
  }
  function berichtFehlmengen(state, mandantId) {
    var head = ["Artikel", "verfügbar", "Meldebestand", "reservierter Fehlbedarf", "Vorschlagsmenge"];
    var rows = (state.artikel || []).filter(function (a) { return mandantId == null || a.mandantId === mandantId; }).map(function (a) {
      var v = bestellvorschlag(state, a.id); var b = bestand(state, a.id, { mandantId: a.mandantId });
      return { unter: b.verfuegbar < num(a.meldebestand) || (v && v.fehlbedarf > 0), row: [a.artikelnummer, b.verfuegbar, a.meldebestand, v ? v.fehlbedarf : 0, v ? v.menge : 0] };
    }).filter(function (x) { return x.unter; }).map(function (x) { return x.row; });
    return { headers: head, rows: rows, csv: zuCSV(head, rows) };
  }
  function berichtInventur(state, invId, mitWert) {
    var inv = (state.inventuren || []).filter(function (x) { return x.id === invId; })[0]; if (!inv) return null;
    var head = ["Artikel", "Lagerplatz", "System", "gezählt", "Differenz", "Grund", "geprüft"];
    if (mitWert) head.push("Differenzwert");
    var rows = inv.positionen.map(function (p) {
      var a = artikelById(state, p.artikelId);
      var row = [a ? a.artikelnummer : p.artikelId, p.lagerplatzId, p.systemBestand, p.gezaehlt, p.differenz, p.grund, p.geprueft ? "ja" : "nein"];
      if (mitWert) { var bw = bewertung(state, p.artikelId); row.push(r2(num(p.differenz) * bw.gleitend)); }
      return row;
    });
    return { headers: head, rows: rows, csv: zuCSV(head, rows), inventur: inv };
  }

  // ============================================================
  //  DASHBOARD-AGGREGATION (aus echten Lagerdaten)
  // ============================================================
  function dashboard(state, mandantId, jetztISO) {
    var art = (state.artikel || []).filter(function (a) { return mandantId == null || a.mandantId === mandantId; });
    var sum = { physisch: 0, reserviert: 0, verfuegbar: 0, bestellt: 0, gesperrt: 0, qualitaet: 0, reststueck: 0 };
    var unterMelde = 0;
    art.forEach(function (a) {
      var b = bestand(state, a.id, { mandantId: a.mandantId });
      sum.physisch += b.physisch; sum.reserviert += b.reserviert; sum.verfuegbar += b.verfuegbar;
      sum.bestellt += b.bestellt; sum.gesperrt += b.gesperrt; sum.qualitaet += b.qualitaet; sum.reststueck += b.reststueck;
      if (b.verfuegbar < num(a.meldebestand)) unterMelde++;
    });
    Object.keys(sum).forEach(function (k) { sum[k] = r3(sum[k]); });
    var offeneBestellungen = (state.bestellungen || []).filter(function (bo) { return (mandantId == null || bo.mandantId === mandantId) && ["geliefert", "storniert"].indexOf(bo.status) < 0; }).length;
    var gesperrteChargen = (state.chargen || []).filter(function (c) { return (mandantId == null || c.mandantId === mandantId) && c.gesperrt; }).length;
    var offeneKonflikte = (state.konflikte || []).filter(function (k) { return (mandantId == null || k.mandantId === mandantId) && k.status === "offen"; }).length;
    var inventurdiff = 0; (state.inventuren || []).forEach(function (inv) { if (mandantId != null && inv.mandantId !== mandantId) return; inv.positionen.forEach(function (p) { if (p.differenz) inventurdiff++; }); });
    return {
      bestand: sum, unterMelde: unterMelde, offeneBestellungen: offeneBestellungen,
      verspaeteteLieferungen: verspaeteteLieferungen(state, mandantId, jetztISO).length,
      gesperrteChargen: gesperrteChargen, offeneKonflikte: offeneKonflikte, inventurdifferenzen: inventurdiff,
      artikelAnzahl: art.length
    };
  }
  // Artikelübersicht mit Bestand + letzter Bewegung (für Tabellen/Filter).
  function artikelUebersicht(state, mandantId, filter) {
    filter = filter || {};
    return (state.artikel || []).filter(function (a) { return mandantId == null || a.mandantId === mandantId; }).map(function (a) {
      var b = bestand(state, a.id, { mandantId: a.mandantId });
      var bews = (state.bewegungen || []).filter(function (x) { return x.artikelId === a.id; });
      var letzte = bews.length ? bews[bews.length - 1] : null;
      var chargen = {}; bews.forEach(function (x) { if (x.chargeId) chargen[x.chargeId] = true; });
      var reststuecke = (state.reststuecke || []).filter(function (r) { return r.artikelId === a.id && r.status !== REST_STATUS.VERBRAUCHT && r.status !== REST_STATUS.VERSCHROTTET; });
      var bw = bewertung(state, a.id);
      return { artikel: a, bestand: b, letzteBewegung: letzte, chargen: Object.keys(chargen), reststuecke: reststuecke, hatPreis: bews.some(function (x) { return x.typ === BEWEGUNG.WARENEINGANG && x.preisSnapshot > 0; }) || bw.letzter > 0, bewertung: bw };
    }).filter(function (row) {
      var a = row.artikel, b = row.bestand;
      if (filter.werkstoff && a.werkstoff !== filter.werkstoff) return false;
      if (filter.unterMelde && !(b.verfuegbar < num(a.meldebestand))) return false;
      if (filter.gesperrt && !(b.gesperrt > 0)) return false;
      if (filter.mitRest && !row.reststuecke.length) return false;
      if (filter.ohnePreis && row.hatPreis) return false;
      if (filter.q) { var hay = (a.artikelnummer + " " + a.werkstoff + " " + (a.abmessung || "")).toLowerCase(); if (hay.indexOf(String(filter.q).toLowerCase()) < 0) return false; }
      return true;
    });
  }

  w.Preisschmiede.Lager = {
    BEWEGUNG: BEWEGUNG, RES_STATUS: RES_STATUS, REST_STATUS: REST_STATUS, PRUEF_STATUS: PRUEF_STATUS, PLATZ_STATUS: PLATZ_STATUS,
    BESTELL_STATUS: BESTELL_STATUS, INVENTUR_TYP: INVENTUR_TYP, INVENTUR_STATUS: INVENTUR_STATUS,
    rueckverfolgungRueckwaerts: rueckverfolgungRueckwaerts, chargeSperrImpact: chargeSperrImpact, chargeEntsperrenAudit: chargeEntsperrenAudit,
    bestellungNeu: bestellungNeu, bestellungStatus: bestellungStatus, bestellungAusVorschlag: bestellungAusVorschlag, verspaeteteLieferungen: verspaeteteLieferungen,
    inventurNeu: inventurNeu, inventurZaehlung: inventurZaehlung, inventurFreigabe: inventurFreigabe, inventurBuchen: inventurBuchen,
    referenzCode: referenzCode, parseReferenz: parseReferenz, etikettDaten: etikettDaten,
    zuCSV: zuCSV, berichtBestand: berichtBestand, berichtBewegungen: berichtBewegungen, berichtFehlmengen: berichtFehlmengen, berichtInventur: berichtInventur,
    dashboard: dashboard, artikelUebersicht: artikelUebersicht,
    METHODE: METHODE, LAGER_RECHTE: LAGER_RECHTE, darf: darf, darfEinkaufspreise: darfEinkaufspreise,
    num: num, r2: r2, r3: r3, uid: uid, idempotenzKey: idempotenzKey,
    deltas: deltas, bewegungNeu: bewegungNeu, journalPush: journalPush,
    toepfe: toepfe, bestandProPlatz: bestandProPlatz, bestelltMenge: bestelltMenge, bestand: bestand, verfuegbar: verfuegbar,
    pruefeBewegung: pruefeBewegung, wareneingang: wareneingang,
    reserviere: reserviere, reservierungAufloesen: reservierungAufloesen, reservierterFehlbedarf: reservierterFehlbedarf,
    entnahme: entnahme, rueckgabe: rueckgabe, verbrauch: verbrauch,
    umlagerung: umlagerung, korrektur: korrektur, storniere: storniere,
    chargeSperren: chargeSperren, chargeEntsperren: chargeEntsperren, rueckverfolgung: rueckverfolgung,
    reststueckAnlegen: reststueckAnlegen, reststueckReservieren: reststueckReservieren, reststueckVerbrauch: reststueckVerbrauch,
    bestellvorschlag: bestellvorschlag, bestellvorschlaege: bestellvorschlaege, bewertung: bewertung,
    uebernehmeOffline: uebernehmeOffline,
    artikelById: artikelById, chargeById: chargeById, platzById: platzById
  };
})(typeof window !== "undefined" ? window : this);
