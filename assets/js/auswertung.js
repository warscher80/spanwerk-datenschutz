/* ============================================================
   Preisschmiede – Auswertungs-/Analyse-Engine (Phase 7A)
   Reine, testbare Kennzahlen-Berechnung für das Management-Dashboard.
   KEINE DOM-Zugriffe, KEINE zufälligen oder fest verdrahteten Werte –
   jede Kennzahl wird aus den real gespeicherten Daten berechnet.
   Läuft im Browser (window) und unter Node (self) für Tests.
   ============================================================ */
(function (w) {
  "use strict";
  w.Preisschmiede = w.Preisschmiede || {};

  // ---- Decimal-sichere Helfer -------------------------------
  function num(x) { if (typeof x === "number") return isFinite(x) ? x : 0; var v = parseFloat(String(x == null ? "" : x).replace(/\s/g, "").replace(",", ".")); return isFinite(v) ? v : 0; }
  function r2(n) { n = num(n); return Math.round((n + (n >= 0 ? 1 : -1) * 1e-9) * 100) / 100; }
  // Prozent mit Division-durch-Null-Schutz (0 statt NaN/Infinity)
  function pct(teil, ganz) { ganz = num(ganz); if (ganz === 0) return 0; return r2(num(teil) / ganz * 100); }
  function summe(arr, f) { return arr.reduce(function (s, x) { return s + num(f ? f(x) : x); }, 0); }
  function mittel(arr) { return arr.length ? r2(summe(arr) / arr.length) : 0; }

  // Veränderung gegenüber Vorperiode. vergleichbar=false, wenn keine
  // Vorperiodendaten vorliegen – dann KEINE irreführende Prozentangabe.
  function veraenderung(aktuell, vorher, hatVordaten) {
    aktuell = num(aktuell); vorher = num(vorher);
    var vergleichbar = hatVordaten !== false && !(vorher === 0 && aktuell === 0);
    var abs = r2(aktuell - vorher);
    var proz = null;
    if (vergleichbar && vorher !== 0) proz = r2((aktuell - vorher) / Math.abs(vorher) * 100);
    return { abs: abs, proz: proz, vergleichbar: vergleichbar, richtung: abs > 0 ? "auf" : abs < 0 ? "ab" : "gleich" };
  }

  // ---- Zeitraum-Presets -------------------------------------
  // ref = Referenzdatum (Date). Rückgabe {von,bis,label,vorVon,vorBis}.
  // von/bis inklusive (bis = Ende des Tages).
  function tag(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function ende(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
  function zeitraum(preset, ref, custom) {
    ref = ref ? new Date(ref) : new Date();
    var y = ref.getFullYear(), m = ref.getMonth(), d = ref.getDate();
    var von, bis, label, vorVon, vorBis;
    function spanne(a, b) { von = a; bis = b; var laenge = bis - von; vorBis = new Date(von.getTime() - 1); vorVon = new Date(von.getTime() - 1 - laenge); }
    switch (preset) {
      case "heute": spanne(tag(ref), ende(ref)); label = "Heute"; break;
      case "woche": { var wd = (ref.getDay() + 6) % 7; var mo = new Date(y, m, d - wd); spanne(tag(mo), ende(new Date(y, m, d - wd + 6))); label = "Diese Woche"; break; }
      case "monat": spanne(new Date(y, m, 1), ende(new Date(y, m + 1, 0))); label = "Dieser Monat"; break;
      case "quartal": { var q = Math.floor(m / 3); spanne(new Date(y, q * 3, 1), ende(new Date(y, q * 3 + 3, 0))); label = "Dieses Quartal"; break; }
      case "jahr": spanne(new Date(y, 0, 1), ende(new Date(y, 11, 31))); label = "Dieses Jahr"; break;
      case "vorjahr": spanne(new Date(y - 1, 0, 1), ende(new Date(y - 1, 11, 31))); label = "Vorjahr"; break;
      case "custom": {
        von = custom && custom.von ? new Date(custom.von) : new Date(y, 0, 1);
        bis = custom && custom.bis ? ende(new Date(custom.bis)) : ende(ref);
        var l2 = bis - von; vorBis = new Date(von.getTime() - 1); vorVon = new Date(von.getTime() - 1 - l2); label = "Zeitraum"; break;
      }
      default: spanne(new Date(y - 5, 0, 1), ende(new Date(y + 1, 11, 31))); label = "Gesamt"; vorVon = null; vorBis = null;
    }
    return { von: von, bis: bis, label: label, vorVon: vorVon, vorBis: vorBis };
  }
  function imZeitraum(iso, zr) { if (!zr || !zr.von) return true; if (!iso) return false; var t = new Date(iso).getTime(); return t >= zr.von.getTime() && t <= zr.bis.getTime(); }

  // ---- Normalisierung: beide Auftrags-Formen vereinheitlichen
  // (Legacy-„Vorgang" mit status Angebot/Beauftragt/Abgeschlossen UND
  //  neue Aufträge aus Phase 4 mit sollSnapshot).
  function gruppenMap(db) { var m = {}; (db.produktgruppen || []).forEach(function (g) { m[g.key] = g.name; }); return m; }
  function kalkById(db, id) { return (db.kalkulationen || []).filter(function (k) { return k.id === id; })[0] || null; }

  function normAuftrag(a, db) {
    var kalk = a.kalk || {};
    var erg = (a.sollSnapshot && a.sollSnapshot.ergebnis) || null;
    // Produktgruppe ermitteln
    var gruppeKey = a.gruppeKey || (a.positionen && a.positionen[0] && a.positionen[0].produktKey) || null;
    if (!gruppeKey && a.kalkId) { var k = kalkById(db, a.kalkId); if (k) gruppeKey = k.gruppeKey; }
    var netto = a.nettowert != null ? num(a.nettowert) : num(kalk.netto);
    var rabatt = num(kalk.netto) * num(a.rabatt) / 100;
    netto = r2(netto - rabatt);
    var selbstSoll = r2(erg ? erg.selbst : (kalk.selbstkosten != null ? kalk.selbstkosten : 0));
    var dbSoll = r2((erg ? erg.deckungsbeitrag : num(kalk.deckungsbeitrag)) - rabatt);
    var gewinnSoll = r2((erg ? erg.gewinn : num(kalk.gewinn)) - rabatt);
    // Soll-Ist über gemeinsame Calc.sollIst (liest positionen[].ist.zeiten)
    var Calc = w.Preisschmiede.Calc;
    var si = Calc && Calc.sollIst ? Calc.sollIst(a) : null;
    var hatIst = !!(si && (si.hatZeiten || si.fremdkosten > 0));
    // tatsächliche Selbstkosten/Gewinn nur wenn Ist-Daten existieren
    var stundensatz = num((db.settings && db.settings.rates && db.settings.rates.werkstatt) || 45);
    var selbstIst = null, gewinnIst = null;
    if (hatIst && si) {
      var mehrKosten = r2((si.istStunden - si.sollStunden) * stundensatz + si.fremdkosten);
      selbstIst = r2(selbstSoll + mehrKosten);
      gewinnIst = r2(gewinnSoll - mehrKosten);
    }
    return {
      id: a.id, nummer: a.nummer || "", titel: a.titel || a.bezeichnung || "",
      kundeId: a.kundeId || null, kommission: a.kommission || "", gruppeKey: gruppeKey,
      datum: a.erstellt || a.datum || null, status: a.status || "",
      abgeschlossen: a.status === "Abgeschlossen" || a.status === "abgeschlossen" || a.status === "geliefert",
      beauftragt: a.status === "Beauftragt" || a.status === "beauftragt" || a.status === "angelegt" || a.status === "in Fertigung" || a.status === "Abgeschlossen" || a.status === "abgeschlossen",
      netto: netto, selbstSoll: selbstSoll, selbstIst: selbstIst,
      dbSoll: dbSoll, gewinnSoll: gewinnSoll, gewinnIst: gewinnIst,
      sollStunden: si ? si.sollStunden : 0, istStunden: si ? si.istStunden : null,
      abwProz: si && si.hatZeiten && si.sollStunden > 0 ? si.abwProz : null,
      fremd: si ? si.fremdkosten : 0, hatIst: hatIst,
      liefertermin: a.liefertermin || a.termin || null,
      verspaetet: !!(a.liefertermin && !(a.status === "Abgeschlossen" || a.status === "abgeschlossen" || a.status === "geliefert") && new Date(a.liefertermin).getTime() < Date.now()),
      raw: a
    };
  }

  function auftraegeGefiltert(db, filter, zr) {
    var list = (db.auftraege || []).map(function (a) { return normAuftrag(a, db); });
    return list.filter(function (a) {
      if (zr && !imZeitraum(a.datum, zr)) return false;
      if (filter.kundeId && a.kundeId !== filter.kundeId) return false;
      if (filter.gruppeKey && a.gruppeKey !== filter.gruppeKey) return false;
      if (filter.kommission && a.kommission !== filter.kommission) return false;
      if (filter.status && a.status !== filter.status) return false;
      return true;
    });
  }

  // ---- Angebotsauswertung -----------------------------------
  function angebotNetto(a) { var Ang = w.Preisschmiede.Angebot; if (Ang && Ang.summen) { try { return num(Ang.summen(a).netto); } catch (e) {} } return num(a.nettowert || (a.summen && a.summen.netto)); }
  function angebotGruppe(db, a) { if (a.gruppeKey) return a.gruppeKey; var k = kalkById(db, a.kalkId); return k ? k.gruppeKey : null; }
  function istAngenommen(s) { return /angenommen/.test(s) || s === "in Auftrag umgewandelt"; }
  function istAbgelehnt(s) { return s === "abgelehnt"; }

  function angebotsauswertung(db, filter, zr) {
    var alle = (db.angebote || []).filter(function (a) {
      if (zr && !imZeitraum(a.erstellt, zr)) return false;
      if (filter.kundeId && a.kundeId !== filter.kundeId) return false;
      if (filter.gruppeKey && angebotGruppe(db, a) !== filter.gruppeKey) return false;
      if (filter.kommission && a.kommission !== filter.kommission) return false;
      return true;
    });
    var g = { anzahl: alle.length, wert: 0, angenommen: 0, abgelehnt: 0, offen: 0, abgelaufen: 0, storniert: 0, wertAngenommen: 0, wertAbgelehnt: 0, wertOffen: 0 };
    var proGruppe = {}, proKunde = {};
    alle.forEach(function (a) {
      var n = angebotNetto(a); g.wert += n;
      var s = a.status || "";
      var gk = angebotGruppe(db, a) || "—";
      proGruppe[gk] = proGruppe[gk] || { anzahl: 0, angenommen: 0, abgelehnt: 0, wert: 0, wertAng: 0 };
      proKunde[a.kundeId] = proKunde[a.kundeId] || { anzahl: 0, angenommen: 0, abgelehnt: 0, wert: 0, wertAng: 0 };
      proGruppe[gk].anzahl++; proGruppe[gk].wert += n;
      proKunde[a.kundeId].anzahl++; proKunde[a.kundeId].wert += n;
      if (istAngenommen(s)) { g.angenommen++; g.wertAngenommen += n; proGruppe[gk].angenommen++; proGruppe[gk].wertAng += n; proKunde[a.kundeId].angenommen++; proKunde[a.kundeId].wertAng += n; }
      else if (istAbgelehnt(s)) { g.abgelehnt++; g.wertAbgelehnt += n; proGruppe[gk].abgelehnt++; proKunde[a.kundeId].abgelehnt++; }
      else if (s === "abgelaufen") { g.abgelaufen++; }
      else if (s === "storniert") { g.storniert++; }
      else { g.offen++; g.wertOffen += n; } // offen wird NIE als abgelehnt gewertet
    });
    var entschiedenAnzahl = g.angenommen + g.abgelehnt;
    var entschiedenWert = g.wertAngenommen + g.wertAbgelehnt;
    return {
      anzahl: g.anzahl, wert: r2(g.wert),
      angenommen: g.angenommen, abgelehnt: g.abgelehnt, offen: g.offen, abgelaufen: g.abgelaufen, storniert: g.storniert,
      wertAngenommen: r2(g.wertAngenommen), wertAbgelehnt: r2(g.wertAbgelehnt), wertOffen: r2(g.wertOffen),
      durchschnittswert: g.anzahl ? r2(g.wert / g.anzahl) : 0,
      abschlussquoteAnzahl: pct(g.angenommen, entschiedenAnzahl),
      abschlussquoteWert: pct(g.wertAngenommen, entschiedenWert),
      proGruppe: proGruppe, proKunde: proKunde
    };
  }

  // ---- Auftrags-/Soll-Ist-Auswertung ------------------------
  function auftragsauswertung(db, filter, zr) {
    var alle = auftraegeGefiltert(db, filter, zr);
    var beauftragt = alle.filter(function (a) { return a.beauftragt; });
    var abgeschlossen = alle.filter(function (a) { return a.abgeschlossen; });
    var laufend = beauftragt.filter(function (a) { return !a.abgeschlossen; });
    var mitIst = alle.filter(function (a) { return a.hatIst; });
    var negativ = alle.filter(function (a) { return (a.gewinnIst != null ? a.gewinnIst : a.gewinnSoll) < 0; });
    var ueberBudget = mitIst.filter(function (a) { return a.abwProz != null && a.abwProz > 0; });
    var ohneZeit = beauftragt.filter(function (a) { return !a.hatIst; });
    var abwWerte = abgeschlossen.map(function (a) { return a.abwProz; }).filter(function (x) { return x != null; });
    return {
      alle: alle, gesamt: alle.length,
      laufend: laufend.length, abgeschlossen: abgeschlossen.length,
      verspaetet: alle.filter(function (a) { return a.verspaetet; }).length,
      ueberBudget: ueberBudget.length, negativerGewinn: negativ.length,
      ohneZeiterfassung: ohneZeit.length,
      auftragswertNetto: r2(summe(beauftragt, function (a) { return a.netto; })),
      selbstkostenSoll: r2(summe(beauftragt, function (a) { return a.selbstSoll; })),
      selbstkostenIst: r2(summe(mitIst, function (a) { return a.selbstIst != null ? a.selbstIst : a.selbstSoll; })),
      deckungsbeitrag: r2(summe(beauftragt, function (a) { return a.dbSoll; })),
      gewinnSoll: r2(summe(beauftragt, function (a) { return a.gewinnSoll; })),
      gewinnIst: r2(summe(mitIst, function (a) { return a.gewinnIst != null ? a.gewinnIst : a.gewinnSoll; })),
      dbQuote: pct(summe(beauftragt, function (a) { return a.dbSoll; }), summe(beauftragt, function (a) { return a.netto; })),
      gewinnQuote: pct(summe(beauftragt, function (a) { return a.gewinnSoll; }), summe(beauftragt, function (a) { return a.netto; })),
      avgAbweichung: mittel(abwWerte),
      anzahlNachkalkuliert: mitIst.length,
      fertigstellungsgrad: alle.length ? pct(abgeschlossen.length, alle.length) : 0
    };
  }

  // Priorisierte Warnliste (jede Warnung mit auftragId für Drill-down)
  function warnungen(db, filter, zr, schwellen) {
    schwellen = schwellen || {};
    var arbeitAbw = num(schwellen.arbeitAbwProz != null ? schwellen.arbeitAbwProz : 10);
    var list = auftraegeGefiltert(db, filter, zr);
    var out = [];
    list.forEach(function (a) {
      if (a.abwProz != null && a.abwProz > arbeitAbw) out.push({ prio: Math.min(3, 1 + Math.floor(a.abwProz / 25)), auftragId: a.id, typ: "arbeit", text: "Auftrag " + (a.nummer || a.titel) + " liegt " + a.abwProz + " % über den geplanten Arbeitsstunden." });
      if ((a.gewinnIst != null ? a.gewinnIst : a.gewinnSoll) < 0) out.push({ prio: 3, auftragId: a.id, typ: "gewinn", text: "Auftrag " + (a.nummer || a.titel) + " weist einen negativen Gewinn auf." });
      if (a.beauftragt && !a.abgeschlossen && !a.hatIst) out.push({ prio: 1, auftragId: a.id, typ: "zeit", text: "Für Auftrag " + (a.nummer || a.titel) + " fehlen Ist-Zeitdaten." });
      if (a.verspaetet) out.push({ prio: 2, auftragId: a.id, typ: "termin", text: "Auftrag " + (a.nummer || a.titel) + " ist über dem Liefertermin." });
    });
    out.sort(function (x, y) { return y.prio - x.prio; });
    return out;
  }

  // Soll-Ist je Kategorie (Stunden + Fremdkosten, aus real erfassten Ist-Daten)
  function sollIstAuswertung(db, filter, zr) {
    var Calc = w.Preisschmiede.Calc;
    var SCHRITTE = (w.Preisschmiede.Products && w.Preisschmiede.Products.SCHRITTE) || [];
    var list = auftraegeGefiltert(db, filter, zr).filter(function (a) { return a.hatIst; });
    var kat = {};
    SCHRITTE.forEach(function (s) { kat[s.key] = { label: s.label || s.key, soll: 0, ist: 0 }; });
    list.forEach(function (a) {
      (a.raw.positionen || []).forEach(function (p) {
        var z = (p.kalk && p.kalk.zeiten) || {}, iz = (p.ist && p.ist.zeiten) || {};
        SCHRITTE.forEach(function (s) { if (kat[s.key]) { kat[s.key].soll += num(z[s.key]); kat[s.key].ist += num(iz[s.key]); } });
      });
    });
    var zeilen = Object.keys(kat).map(function (k) {
      var c = kat[k];
      return { key: k, label: c.label, soll: r2(c.soll), ist: r2(c.ist), abwAbs: r2(c.ist - c.soll), abwProz: pct(c.ist - c.soll, c.soll), trend: c.ist > c.soll ? "auf" : c.ist < c.soll ? "ab" : "gleich" };
    }).filter(function (z) { return z.soll > 0 || z.ist > 0; });
    return { zeilen: zeilen, anzahlAuftraege: list.length };
  }

  // ---- Produktgruppenvergleich ------------------------------
  function produktgruppenvergleich(db, filter, zr) {
    var gm = gruppenMap(db);
    var list = auftraegeGefiltert(db, filter, zr).filter(function (a) { return a.beauftragt; });
    var grp = {};
    list.forEach(function (a) {
      var k = a.gruppeKey || "—";
      grp[k] = grp[k] || { key: k, name: gm[k] || k, anzahl: 0, umsatz: 0, selbst: 0, db: 0, gewinn: 0, abw: [] };
      grp[k].anzahl++; grp[k].umsatz += a.netto; grp[k].selbst += a.selbstSoll; grp[k].db += a.dbSoll; grp[k].gewinn += a.gewinnSoll;
      if (a.abwProz != null) grp[k].abw.push(a.abwProz);
    });
    return Object.keys(grp).map(function (k) {
      var g = grp[k];
      return {
        key: g.key, name: g.name, anzahl: g.anzahl,
        umsatz: r2(g.umsatz), selbst: r2(g.selbst), db: r2(g.db), gewinn: r2(g.gewinn),
        dbQuote: pct(g.db, g.umsatz), gewinnQuote: pct(g.gewinn, g.umsatz),
        durchschnitt: g.anzahl ? r2(g.umsatz / g.anzahl) : 0,
        avgAbweichung: g.abw.length ? mittel(g.abw) : null,
        belastbar: g.anzahl >= 3 // statistische Belastbarkeit erst ab 3 Aufträgen
      };
    }).sort(function (x, y) { return y.umsatz - x.umsatz; });
  }

  // ---- Kundenanalyse ----------------------------------------
  function kundenanalyse(db, filter, zr) {
    var au = angebotsauswertung(db, filter, zr);
    var auftraege = auftraegeGefiltert(db, filter, zr);
    var out = (db.kunden || []).map(function (k) {
      var ang = au.proKunde[k.id] || { anzahl: 0, angenommen: 0, abgelehnt: 0, wert: 0, wertAng: 0 };
      var meine = auftraege.filter(function (a) { return a.kundeId === k.id && a.beauftragt; });
      var letzte = null;
      (db.angebote || []).concat(db.auftraege || []).forEach(function (x) { if (x.kundeId === k.id) { var d = x.geaendert || x.erstellt; if (d && (!letzte || new Date(d) > new Date(letzte))) letzte = d; } });
      return {
        id: k.id, name: k.name || "",
        angebote: ang.anzahl, angebotswert: r2(ang.wert),
        auftraege: meine.length, umsatz: r2(summe(meine, function (a) { return a.netto; })),
        deckungsbeitrag: r2(summe(meine, function (a) { return a.dbSoll; })),
        gewinn: r2(summe(meine, function (a) { return a.gewinnSoll; })),
        abschlussquote: pct(ang.angenommen, ang.angenommen + ang.abgelehnt),
        offeneAngebote: ang.anzahl - ang.angenommen - ang.abgelehnt,
        letzteAktivitaet: letzte
      };
    }).filter(function (k) { return k.angebote > 0 || k.auftraege > 0; });
    return out.sort(function (a, b) { return b.umsatz - a.umsatz; });
  }

  // ---- Maschinenanalyse -------------------------------------
  // Verfügbare Kapazität aus Maschinenstammdaten (Arbeitstage, Std/Tag,
  // Wartung). Ist-Maschinenstunden aus erfassten Ist-Zeiten der Aufträge.
  function maschinenKapazitaet(m) {
    var tage = num(m.arbeitstage != null ? m.arbeitstage : 220);
    var stdTag = num(m.stundenProTag != null ? m.stundenProTag : 8);
    var wartung = num(m.wartungStunden);
    return r2(Math.max(0, tage * stdTag - wartung));
  }
  function maschinenauswertung(db, filter, zr) {
    var maschinen = (db.settings && db.settings.maschinen) || [];
    var list = auftraegeGefiltert(db, filter, zr);
    // Ist-Maschinenzeit je Maschinenschritt (soweit erfasst)
    var proSchritt = {};
    list.forEach(function (a) {
      (a.raw.positionen || []).forEach(function (p) {
        var z = (p.kalk && p.kalk.zeiten) || {}, iz = (p.ist && p.ist.zeiten) || {};
        Object.keys(z).forEach(function (k) { proSchritt[k] = proSchritt[k] || { soll: 0, ist: 0, auftr: {} }; proSchritt[k].soll += num(z[k]); proSchritt[k].ist += num(iz[k]); if (num(iz[k]) > 0) proSchritt[k].auftr[a.id] = true; });
      });
    });
    return maschinen.map(function (m) {
      var s = proSchritt[m.schritt] || { soll: 0, ist: 0, auftr: {} };
      var kap = maschinenKapazitaet(m);
      var istH = r2(s.ist), sollH = r2(s.soll);
      return {
        id: m.id, name: m.name, schritt: m.schritt,
        kapazitaet: kap, sollStunden: sollH, istStunden: istH,
        auslastung: pct(istH, kap),
        ruestabweichung: pct(istH - sollH, sollH),
        anzahlAuftraege: Object.keys(s.auftr).length,
        maschinenkosten: r2(istH * num(m.stundensatz)),
        auffaellig: sollH > 0 && pct(istH - sollH, sollH) > 15,
        hatDaten: sollH > 0 || istH > 0
      };
    });
  }

  // ---- Lernfunktions-Auswertung -----------------------------
  function lernauswertung(db) {
    var l = db.lernen || { faktoren: {}, erkenntnisse: [] };
    var mitIst = (db.auftraege || []).map(function (a) { return normAuftrag(a, db); }).filter(function (a) { return a.hatIst; });
    var faktoren = l.faktoren || {};
    var samples = [], konf = [];
    Object.keys(faktoren).forEach(function (k) {
      var f = faktoren[k]; if (f && typeof f === "object") { if (f.samples != null) samples.push(num(f.samples)); if (f.konfidenz != null) konf.push(num(f.konfidenz)); }
    });
    return {
      lernfaehigeAuftraege: mitIst.length,
      erkenntnisse: (l.erkenntnisse || []).length,
      faktoren: Object.keys(faktoren).length,
      avgSamples: samples.length ? mittel(samples) : 0,
      avgKonfidenz: konf.length ? mittel(konf) : null,
      // Nur echte, messbare Aussage: Genauigkeit aus tatsächlichen Ist-Abweichungen
      kalkulationsgenauigkeit: mitIst.length ? r2(100 - mittel(mitIst.map(function (a) { return Math.abs(a.abwProz || 0); }))) : null,
      belastbar: mitIst.length >= 3
    };
  }

  // ---- Hauptkennzahlen inkl. Vorperiodenvergleich -----------
  function hauptkennzahlen(db, filter, zr) {
    function block(zeitr) {
      var ang = angebotsauswertung(db, filter, zeitr);
      var auf = auftragsauswertung(db, filter, zeitr);
      return {
        offenerAngebotswert: ang.wertOffen, angenommenerAngebotswert: ang.wertAngenommen,
        auftragswert: auf.auftragswertNetto, selbstkostenIst: auf.selbstkostenIst,
        deckungsbeitrag: auf.deckungsbeitrag, dbQuote: auf.dbQuote,
        gewinnSoll: auf.gewinnSoll, gewinnIst: auf.gewinnIst, gewinnQuote: auf.gewinnQuote,
        laufendeAuftraege: auf.laufend, verspaeteteAuftraege: auf.verspaetet,
        avgAbweichung: auf.avgAbweichung, abschlussquote: ang.abschlussquoteAnzahl
      };
    }
    var jetzt = block(zr);
    var hatVor = !!(zr && zr.vorVon);
    var vor = hatVor ? block({ von: zr.vorVon, bis: zr.vorBis }) : null;
    var kennz = {};
    Object.keys(jetzt).forEach(function (k) {
      kennz[k] = { wert: jetzt[k], vergleich: vor ? veraenderung(jetzt[k], vor[k], true) : veraenderung(jetzt[k], 0, false) };
    });
    return kennz;
  }

  // ---- Gesamtreport -----------------------------------------
  function analysiere(db, filter, opts) {
    filter = filter || {};
    opts = opts || {};
    var zr = zeitraum(opts.preset || "jahr", opts.ref, opts.custom);
    return {
      zeitraum: zr,
      datenstand: opts.ref ? new Date(opts.ref).toISOString() : new Date().toISOString(),
      hauptkennzahlen: hauptkennzahlen(db, filter, zr),
      angebote: angebotsauswertung(db, filter, zr),
      auftraege: auftragsauswertung(db, filter, zr),
      warnungen: warnungen(db, filter, zr, opts.schwellen),
      sollIst: sollIstAuswertung(db, filter, zr),
      produktgruppen: produktgruppenvergleich(db, filter, zr),
      kunden: kundenanalyse(db, filter, zr),
      maschinen: maschinenauswertung(db, filter, zr),
      lernen: lernauswertung(db)
    };
  }

  // ---- Formatierung (Euro / Prozent) ------------------------
  function fmtEUR(n) { return num(n).toLocaleString("de-AT", { style: "currency", currency: "EUR" }); }
  function fmtProz(n, dez) { return num(n).toLocaleString("de-AT", { minimumFractionDigits: dez || 0, maximumFractionDigits: dez != null ? dez : 1 }) + " %"; }

  w.Preisschmiede.Auswertung = {
    num: num, r2: r2, pct: pct, summe: summe, mittel: mittel,
    veraenderung: veraenderung, zeitraum: zeitraum, imZeitraum: imZeitraum,
    normAuftrag: normAuftrag, auftraegeGefiltert: auftraegeGefiltert,
    angebotsauswertung: angebotsauswertung, auftragsauswertung: auftragsauswertung,
    warnungen: warnungen, sollIstAuswertung: sollIstAuswertung,
    produktgruppenvergleich: produktgruppenvergleich, kundenanalyse: kundenanalyse,
    maschinenauswertung: maschinenauswertung, maschinenKapazitaet: maschinenKapazitaet,
    lernauswertung: lernauswertung, hauptkennzahlen: hauptkennzahlen,
    analysiere: analysiere, gruppenMap: gruppenMap,
    fmtEUR: fmtEUR, fmtProz: fmtProz
  };
})(typeof self !== "undefined" ? self : this);
