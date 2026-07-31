/* ============================================================
   Preisschmiede – Kalkulationslogik (Phase 3B)
   Zentrale, nachvollziehbare Kalkulation aus Positionen.
   Geldbeträge werden cent-genau gerundet (Decimal-sicher),
   um Gleitkomma-Fehler zu vermeiden.
   ============================================================ */
(function (w) {
  "use strict";

  // ---- Decimal-sichere Rundung (kaufmännisch, 2 Nachkommastellen) ----
  function r2(x) {
    if (!isFinite(x)) return 0;
    var s = x < 0 ? -1 : 1;
    return s * Math.round(Math.abs(x) * 100 + 1e-6) / 100;
  }
  function r4(x) { if (!isFinite(x)) return 0; var s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 10000 + 1e-6) / 10000; }
  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
  // Auf Verpackungseinheit / Standardmenge aufrunden
  function aufrunden(menge, einheit) { var e = num(einheit); if (e <= 0) return r4(menge); return r4(Math.ceil(r4(menge) / e - 1e-9) * e); }

  // ---- Materialposition -------------------------------------
  function material(m) {
    var grund = num(m.menge);
    var netto = grund + num(m.fixeZugabe);
    var mitVerschnitt = netto * (1 + num(m.verschnittProz) / 100);
    var mitAusschuss = mitVerschnitt * (1 + num(m.ausschussProz) / 100);
    var einheitZumRunden = num(m.verpackungseinheit) || num(m.standardmenge) || 0;
    var bestellmenge = einheitZumRunden > 0 ? aufrunden(mitAusschuss, einheitZumRunden) : r4(mitAusschuss);
    if (num(m.mindestbestellmenge) > 0 && bestellmenge < num(m.mindestbestellmenge)) bestellmenge = num(m.mindestbestellmenge);
    var einkauf = r2(bestellmenge * num(m.einkaufspreis));
    var kosten = r2(einkauf + num(m.frachtanteil));
    var verkauf = m.manuellerPreis != null && m.manuellerPreis !== "" ? r2(num(m.manuellerPreis)) : r2(kosten * (1 + num(m.materialaufschlagProz) / 100));
    return {
      bedarfNetto: r4(netto), bedarfInklVerschnitt: r4(mitVerschnitt), bestellmenge: bestellmenge,
      rest: r4(bestellmenge - mitVerschnitt), einkauf: einkauf, kosten: kosten, verkauf: verkauf
    };
  }

  // ---- Arbeitsgang ------------------------------------------
  function arbeit(a) {
    var stueckzeit = num(a.bearbeitungProStk) * num(a.stueckzahl);
    var personenstunden = r4((num(a.ruestzeit) + stueckzeit + num(a.zusatzzeit)) * (num(a.anzahlMitarbeiter) || 1));
    var kosten = r2(personenstunden * num(a.internerSatz));
    var verkauf = a.manuellerPreis != null && a.manuellerPreis !== "" ? r2(num(a.manuellerPreis)) : r2(personenstunden * num(a.verkaufSatz));
    return { stueckzeit: r4(stueckzeit), personenstunden: personenstunden, kosten: kosten, verkauf: verkauf };
  }

  // ---- Maschinenarbeitsgang ---------------------------------
  function maschine(m) {
    var ruestkosten;
    if (m.ruestFix != null && m.ruestFix !== "") ruestkosten = r2(num(m.anzahlRuest) * num(m.ruestFix));
    else ruestkosten = r2(num(m.anzahlRuest) * num(m.ruestzeitProVorgang) * num(m.ruestSatz));
    var laufzeit = r4(num(m.laufzeitProStk) * num(m.stueckzahl) + num(m.zusatzlaufzeit));
    var maschinenkosten = r2(laufzeit * num(m.internerSatz));
    var gesamtkosten = r2(ruestkosten + maschinenkosten + num(m.werkzeugkosten) + num(m.energiezuschlag));
    var verkauf = r2(laufzeit * num(m.verkaufSatz) + ruestkosten);
    if (num(m.mindestverrechnung) > 0 && verkauf < num(m.mindestverrechnung)) verkauf = r2(num(m.mindestverrechnung));
    if (m.manuellerPreis != null && m.manuellerPreis !== "") verkauf = r2(num(m.manuellerPreis));
    return { ruestzeitGesamt: r4(num(m.anzahlRuest) * num(m.ruestzeitProVorgang)), laufzeit: laufzeit, ruestkosten: ruestkosten, maschinenkosten: maschinenkosten, gesamtkosten: gesamtkosten, verkauf: verkauf };
  }

  // ---- Fremdleistung ----------------------------------------
  function fremd(f) {
    var kosten = r2(num(f.einkaufspreis) * (num(f.menge) || 1) + num(f.fracht) + num(f.mindermenge));
    var verkauf = r2(kosten * (1 + num(f.aufschlagProz) / 100));
    return { kosten: kosten, verkauf: verkauf };
  }

  // ---- Montage ----------------------------------------------
  function montage(mo) {
    if (!mo) return { stunden: 0, kostenIntern: 0, verkauf: 0, fahrzeugkosten: 0, fahrtzeit: 0, nebenkosten: 0 };
    var stunden = r4((num(mo.anzahlMonteure) || 0) * num(mo.montagezeit));
    var kostenIntern = r2(stunden * num(mo.internerSatz));
    var verkauf = r2(stunden * num(mo.verkaufSatz));
    var fahrzeugkosten = r2(num(mo.km) * num(mo.kmSatz));
    var neben = r2(num(mo.uebernachtung) + num(mo.taggeld) + num(mo.hebegeraet) + num(mo.verbrauch) + num(mo.fundament) + num(mo.sonstige));
    return { stunden: stunden, kostenIntern: kostenIntern, verkauf: verkauf, fahrzeugkosten: fahrzeugkosten, fahrtzeit: num(mo.fahrtzeit), nebenkosten: neben };
  }

  function transport(t) {
    if (!t) return { kosten: 0 };
    var kosten = r2(num(t.verpackungsmaterial) + num(t.paletten) + num(t.sonderverpackung) + num(t.maut) + num(t.kran) + (num(t.km) * num(t.kmSatz)) + num(t.beladung));
    return { kosten: kosten };
  }

  // ---- Gemeinkosten (konfigurierbar) ------------------------
  // gk: { typ:'prozent'|'fix', basis:'material'|'arbeit'|'herstell'|'direkt', wert }
  function gemeinkosten(gk, basen) {
    if (!gk) return { betrag: 0, basisBetrag: 0, basisName: "–" };
    if (gk.typ === "fix") return { betrag: r2(num(gk.wert)), basisBetrag: 0, basisName: "Fixbetrag" };
    var basisBetrag = 0, name;
    switch (gk.basis) {
      case "material": basisBetrag = basen.material; name = "Materialkosten"; break;
      case "arbeit": basisBetrag = basen.arbeit; name = "Arbeitskosten"; break;
      case "direkt": basisBetrag = basen.direkt; name = "direkte Kosten"; break;
      default: basisBetrag = basen.herstell; name = "Herstellkosten";
    }
    return { betrag: r2(basisBetrag * num(gk.wert) / 100), basisBetrag: r2(basisBetrag), basisName: name };
  }

  // ---- Gesamtkalkulation ------------------------------------
  function berechne(kalk, settings) {
    settings = settings || {};
    var mats = (kalk.material || []).filter(function (p) { return p.aktiv !== false; }).map(function (p) { return { p: p, e: material(p) }; });
    var arb = (kalk.arbeit || []).filter(function (p) { return p.aktiv !== false; }).map(function (p) { return { p: p, e: arbeit(p) }; });
    var mas = (kalk.maschine || []).filter(function (p) { return p.aktiv !== false; }).map(function (p) { return { p: p, e: maschine(p) }; });
    var fre = (kalk.fremd || []).filter(function (p) { return p.aktiv !== false; }).map(function (p) { return { p: p, e: fremd(p) }; });
    var mo = montage(kalk.montage);
    var tr = transport(kalk.transport);

    var materialKosten = r2(mats.reduce(function (s, x) { return s + x.e.kosten; }, 0));
    var materialVerkauf = r2(mats.reduce(function (s, x) { return s + x.e.verkauf; }, 0));
    var arbeitKosten = r2(arb.reduce(function (s, x) { return s + x.e.kosten; }, 0));
    var ruestKosten = r2(mas.reduce(function (s, x) { return s + x.e.ruestkosten; }, 0));
    var maschinenKostenReine = r2(mas.reduce(function (s, x) { return s + x.e.maschinenkosten + num(x.p.werkzeugkosten) + num(x.p.energiezuschlag); }, 0));
    var maschinenKosten = r2(mas.reduce(function (s, x) { return s + x.e.gesamtkosten; }, 0)); // inkl. Rüst
    var fremdKosten = r2(fre.reduce(function (s, x) { return s + x.e.kosten; }, 0));
    var montageKosten = r2(mo.kostenIntern + mo.fahrzeugkosten + mo.nebenkosten);
    var transportKosten = tr.kosten;

    var direkt = r2(materialKosten + arbeitKosten + maschinenKosten + fremdKosten + montageKosten + transportKosten + num(kalk.sonstigeKosten));

    var basen = { material: materialKosten, arbeit: arbeitKosten, direkt: direkt, herstell: direkt };
    var fgk = gemeinkosten(kalk.fertigungsGK || { typ: "prozent", basis: "direkt", wert: num(settings.gemeinkosten) }, basen);
    var herstell = r2(direkt + fgk.betrag);
    basen.herstell = herstell;
    var vvGK = gemeinkosten(kalk.verwaltungsGK || { typ: "prozent", basis: "herstell", wert: 0 }, basen);
    var selbst = r2(herstell + vvGK.betrag);

    // Preis-Wasserfall
    var risikoBasis = selbst;
    var risiko = r2(risikoBasis * num(kalk.risikoProz) / 100);
    var nachRisiko = r2(selbst + risiko);
    var gewinnAufschlag = r2(nachRisiko * num(kalk.gewinnProz) / 100);
    var listenNetto = r2(nachRisiko + gewinnAufschlag + num(kalk.manuellerAufschlag));
    var rabatt = r2(listenNetto * num(kalk.rabattProz) / 100);
    var netto = r2(listenNetto - rabatt);
    var mwstProz = kalk.mwstProz != null ? num(kalk.mwstProz) : num(settings.mwst);
    var mwst = r2(netto * mwstProz / 100);
    var brutto = r2(netto + mwst);

    // Deckungsbeitrag / Gewinn (variable Kosten = direkte Kosten per Default)
    var variableKosten = r2(materialKosten + arbeitKosten + maschinenKosten + fremdKosten + montageKosten + transportKosten);
    var deckungsbeitrag = r2(netto - variableKosten);
    var dbQuote = netto > 0 ? r2(deckungsbeitrag / netto * 100) : 0;
    var gewinn = r2(netto - selbst);
    var gewinnQuote = netto > 0 ? r2(gewinn / netto * 100) : 0;

    // Warnungen
    var warnungen = [];
    if (deckungsbeitrag < 0) warnungen.push("Negativer Deckungsbeitrag!");
    if (gewinn < 0) warnungen.push("Negativer Gewinn – Verkaufspreis unter Selbstkosten!");
    else if (netto < selbst) warnungen.push("Verkaufspreis unter Selbstkosten!");
    if (num(kalk.rabattProz) > 15) warnungen.push("Außergewöhnlich hoher Rabatt (" + num(kalk.rabattProz) + " %).");
    if (arb.some(function (x) { return num(x.p.internerSatz) <= 0 || num(x.p.verkaufSatz) <= 0; })) warnungen.push("Fehlende Stundensätze in mindestens einem Arbeitsgang.");
    if (mats.some(function (x) { return num(x.p.einkaufspreis) <= 0; })) warnungen.push("Fehlende Materialpreise in mindestens einer Position.");
    if (mats.some(function (x) { return x.p.preisdatum && (Date.now() - new Date(x.p.preisdatum).getTime()) > 1000 * 60 * 60 * 24 * 180; })) warnungen.push("Veraltete Materialpreise (älter als 180 Tage).");
    if (mas.length && ruestKosten <= 0) warnungen.push("Maschinen ohne kalkulierte Rüstkosten.");
    // Doppelte Bedienerkosten: Bedienerzeit gesetzt UND separater Arbeitsgang derselben Tätigkeit
    if (mas.some(function (x) { return num(x.p.bedienerZeit) > 0; }) && arb.length) warnungen.push("Bedienerzeit an Maschine gesetzt – bitte prüfen, dass sie nicht zusätzlich als Arbeitsgang gebucht ist (doppelte Bedienerkosten).");

    return {
      material: { kosten: materialKosten, verkauf: materialVerkauf, positionen: mats },
      arbeit: { kosten: arbeitKosten, positionen: arb },
      maschine: { kosten: maschinenKosten, reine: maschinenKostenReine, positionen: mas },
      ruestKosten: ruestKosten, fremdKosten: fremdKosten, montage: mo, montageKosten: montageKosten, transportKosten: transportKosten,
      direkt: direkt, fgk: fgk, herstell: herstell, vvGK: vvGK, selbst: selbst,
      risiko: risiko, nachRisiko: nachRisiko, gewinnAufschlag: gewinnAufschlag, manuellerAufschlag: r2(num(kalk.manuellerAufschlag)),
      listenNetto: listenNetto, rabatt: rabatt, netto: netto, mwst: mwst, mwstProz: mwstProz, brutto: brutto,
      variableKosten: variableKosten, deckungsbeitrag: deckungsbeitrag, dbQuote: dbQuote, gewinn: gewinn, gewinnQuote: gewinnQuote,
      warnungen: warnungen
    };
  }

  // ---- Staffelpreise (Serienteile): Rüstkosten je Stückzahl verteilen ----
  function staffel(kalk, settings, stueckzahlen) {
    var basis = berechne(kalk, settings);
    // variable Kosten je Stück (ohne Rüstkosten) aus einer Referenz-Stückzahl
    var refStk = num(kalk.stueckzahl) || 1;
    var variableGesamt = r2(basis.variableKosten - basis.ruestKosten);
    var variableProStk = refStk > 0 ? r4(variableGesamt / refStk) : 0;
    var ruestGesamt = basis.ruestKosten;
    var aufschlag = (1 + num(kalk.risikoProz) / 100) * (1 + num(kalk.gewinnProz) / 100);
    return (stueckzahlen || [1, 10, 50, 100, 250, 500, 1000]).map(function (n) {
      var ruestProStk = n > 0 ? r4(ruestGesamt / n) : 0;
      var kostenProStk = r4(variableProStk + ruestProStk);
      var preisProStk = r2(kostenProStk * aufschlag);
      return { stueckzahl: n, ruestProStk: r2(ruestProStk), variableProStk: r2(variableProStk), kostenProStk: r2(kostenProStk), preisProStk: preisProStk, gesamt: r2(preisProStk * n) };
    });
  }

  // ---- Preis-Snapshot (Stammdaten einfrieren) ----------------
  function snapshot(settings) {
    return {
      datum: new Date().toISOString(),
      rates: JSON.parse(JSON.stringify(settings.rates || {})),
      maschinen: JSON.parse(JSON.stringify(settings.maschinen || [])),
      materialAufschlag: settings.materialAufschlag, gemeinkosten: settings.gemeinkosten,
      gewinn: settings.gewinn, mwst: settings.mwst, dichten: JSON.parse(JSON.stringify(settings.dichten || {}))
    };
  }

  // ---- Kalkulation aus einer Produktkonfiguration ableiten ---
  // Erzeugt ein Grundgerüst; der Benutzer verfeinert es im Editor.
  function ausKonfiguration(cfg, db) {
    var a = cfg.antworten || {}, b = cfg.berechnet || {};
    var s = db.settings, rates = s.rates || {};
    var mat = [], arb = [], mas = [], fre = [];
    var werk = a.werkstoff || "Stahl";
    var gew = num(b.gesamtgewicht) || num(a.gesamtlaenge) * 2 || 0;
    if (gew > 0) mat.push({ bezeichnung: (werk + " Material"), werkstoff: werk, menge: gew, einheit: "kg", einkaufspreis: (werk === "Edelstahl" ? 5 : werk === "Aluminium" ? 4.5 : 1.4), verschnittProz: num(a.verschnitt) || num(s.verschnitt) || 8, materialaufschlagProz: num(s.materialAufschlag) || 12, preisdatum: new Date().toISOString(), aktiv: true });
    // Bearbeitungen (janein=true) -> Arbeitsgänge mit Vorgabezeiten
    var bearb = { b_saegen: ["Sägen", "fertigung"], b_bohren: ["Bohren", "fertigung"], b_lasern: ["Lasern", "fertigung"], b_schweissen: ["Schweißen", "fertigung"], b_schleifen: ["Schleifen", "fertigung"], entgraten: ["Entgraten", "fertigung"], kanten_noetig: ["Kanten", "fertigung"] };
    Object.keys(bearb).forEach(function (k) {
      if (a[k] === true || a[k] === "ja") { var g = bearb[k][1]; arb.push({ taetigkeit: bearb[k][0], gruppe: g, anzahlMitarbeiter: 1, ruestzeit: 0.2, bearbeitungProStk: 0.3, stueckzahl: num(a.stueckzahl) || 1, internerSatz: (rates[g] || 58) * 0.7, verkaufSatz: rates[g] || 58, aktiv: true }); }
    });
    if (!arb.length) arb.push({ taetigkeit: "Fertigung", gruppe: "fertigung", anzahlMitarbeiter: 1, ruestzeit: 0.2, bearbeitungProStk: 0.5, stueckzahl: num(a.stueckzahl) || 1, internerSatz: (rates.fertigung || 58) * 0.7, verkaufSatz: rates.fertigung || 58, aktiv: true });
    var montageObj = null;
    if (a.montage_noetig === true) montageObj = { anzahlMonteure: num(a.anzahl_monteure) || 2, montagezeit: num(a.montagedauer) || 8, internerSatz: (rates.montage || 62) * 0.7, verkaufSatz: rates.montage || 62, fahrtzeit: num(a.fahrtzeit) || 1, km: num(a.baustellenentfernung) * 2 || 0, kmSatz: num(s.transportProKm) || 0.9 };
    return { material: mat, arbeit: arb, maschine: mas, fremd: fre, montage: montageObj, transport: null, risikoProz: 5, gewinnProz: num(s.gewinn) || 18, rabattProz: 0, manuellerAufschlag: 0, mwstProz: num(s.mwst) || 20, fertigungsGK: { typ: "prozent", basis: "direkt", wert: num(s.gemeinkosten) || 14 } };
  }

  // ---- Beispielkalkulationen (aus den Beispielkonfigurationen) ---
  function beispielKalkulationen(ctx) {
    var db = { settings: ctx.settings };
    var mkNr = function (i) { return "KA-2026-" + ("00" + (i + 1)).slice(-3); };
    function mk(i, cfg, positionen, status) {
      var kalk = Object.assign({
        id: ctx.uid(), nummer: mkNr(i), bezeichnung: cfg ? cfg.bezeichnung : "Beispiel",
        kundeId: cfg ? cfg.kundeId : "", projektId: cfg ? cfg.projektId : "", kommission: cfg ? cfg.kommission : "",
        konfigId: cfg ? cfg.id : "", gruppeKey: cfg ? cfg.gruppeKey : "", kalkVersion: cfg ? cfg.vorlageVersion : null,
        version: 1, status: status || "freigegeben", beispiel: true, stueckzahl: (cfg && cfg.antworten && ctx.num(cfg.antworten.stueckzahl)) || 1,
        erstellt: ctx.nowISO(), geaendert: ctx.nowISO(), bearbeiter: "admin",
        verlauf: [{ datum: ctx.nowISO(), bearbeiter: "admin", grund: "Beispielkalkulation angelegt" }]
      }, positionen);
      kalk.snapshot = snapshot(ctx.settings);
      return kalk;
    }
    var cfgs = ctx.konfigurationen || [];
    var cg = cfgs.filter(function (c) { return c.gruppeKey === "gelaender"; })[0];
    var cb = cfgs.filter(function (c) { return c.gruppeKey === "blecharbeiten"; })[0];
    var cs = cfgs.filter(function (c) { return c.gruppeKey === "serienteile"; })[0];
    var list = [];
    // 1) Edelstahlgeländer mit Glas + Montage
    list.push(mk(0, cg, {
      material: [{ bezeichnung: "Edelstahl Rundrohr 42,4x2", werkstoff: "Edelstahl", menge: 40, einheit: "m", einkaufspreis: 21.8, verschnittProz: 8, materialaufschlagProz: 12, preisdatum: ctx.nowISO(), aktiv: true }],
      arbeit: [
        { taetigkeit: "CAD/Planung", gruppe: "cad", anzahlMitarbeiter: 1, ruestzeit: 0, bearbeitungProStk: 3, stueckzahl: 1, internerSatz: 45, verkaufSatz: 65, aktiv: true },
        { taetigkeit: "Schweißen", gruppe: "fertigung", anzahlMitarbeiter: 1, ruestzeit: 0.5, bearbeitungProStk: 10, stueckzahl: 1, internerSatz: 40, verkaufSatz: 58, aktiv: true },
        { taetigkeit: "Schleifen", gruppe: "fertigung", anzahlMitarbeiter: 1, ruestzeit: 0.2, bearbeitungProStk: 4, stueckzahl: 1, internerSatz: 40, verkaufSatz: 58, aktiv: true }
      ],
      maschine: [], fremd: [{ leistung: "Glasfüllung VSG", beschreibung: "6 Felder VSG-Glas", menge: 1, einheit: "Pos", einkaufspreis: 1350, fracht: 60, mindermenge: 0, aufschlagProz: 15, aktiv: true }],
      montage: { anzahlMonteure: 2, montagezeit: 8, internerSatz: 44, verkaufSatz: 62, fahrtzeit: 1, km: 50, kmSatz: 0.9, hebegeraet: 0 },
      transport: null, risikoProz: 5, gewinnProz: 20, rabattProz: 0, mwstProz: 20, fertigungsGK: { typ: "prozent", basis: "direkt", wert: 14 }
    }));
    // 2) Pulverbeschichtete Blecharbeit
    list.push(mk(1, cb, {
      material: [{ bezeichnung: "Stahlblech 3mm", werkstoff: "Stahl", menge: 236, einheit: "kg", einkaufspreis: 1.4, verschnittProz: 10, materialaufschlagProz: 12, preisdatum: ctx.nowISO(), aktiv: true }],
      arbeit: [{ taetigkeit: "Kanten", gruppe: "fertigung", anzahlMitarbeiter: 1, ruestzeit: 0.3, bearbeitungProStk: 0.25, stueckzahl: 5, internerSatz: 40, verkaufSatz: 58, aktiv: true }, { taetigkeit: "Schweißen", gruppe: "fertigung", anzahlMitarbeiter: 1, ruestzeit: 0.2, bearbeitungProStk: 0.5, stueckzahl: 5, internerSatz: 40, verkaufSatz: 58, aktiv: true }],
      maschine: [{ maschineName: "Laser", vorgang: "Laserschneiden", anzahlRuest: 1, ruestzeitProVorgang: 0.3, ruestSatz: 60, laufzeitProStk: 0.4, stueckzahl: 5, internerSatz: 95, verkaufSatz: 130, werkzeugkosten: 0, energiezuschlag: 8, aktiv: true }],
      fremd: [{ leistung: "Pulverbeschichten RAL 7016", menge: 10, einheit: "m²", einkaufspreis: 18, fracht: 25, mindermenge: 0, aufschlagProz: 15, aktiv: true }],
      transport: { verpackungsmaterial: 30, paletten: 20 }, montage: null, risikoProz: 5, gewinnProz: 18, rabattProz: 0, mwstProz: 20, fertigungsGK: { typ: "prozent", basis: "direkt", wert: 14 }
    }));
    // 3) Serienteil 500 Stück
    list.push(mk(2, cs, {
      stueckzahl: 500,
      material: [{ bezeichnung: "Stahl S235 Zuschnitt", werkstoff: "Stahl", menge: 300, einheit: "kg", einkaufspreis: 1.4, verschnittProz: 12, materialaufschlagProz: 12, preisdatum: ctx.nowISO(), aktiv: true }],
      arbeit: [{ taetigkeit: "Bohren", gruppe: "fertigung", anzahlMitarbeiter: 1, ruestzeit: 0.5, bearbeitungProStk: 0.03, stueckzahl: 500, internerSatz: 40, verkaufSatz: 58, aktiv: true }],
      maschine: [
        { maschineName: "Laser", vorgang: "Laserschneiden", anzahlRuest: 1, ruestFix: 60, laufzeitProStk: 0.02, stueckzahl: 500, internerSatz: 95, verkaufSatz: 130, energiezuschlag: 20, aktiv: true },
        { maschineName: "Abkantpresse", vorgang: "Kanten", anzahlRuest: 1, ruestFix: 40, laufzeitProStk: 0.015, stueckzahl: 500, internerSatz: 70, verkaufSatz: 95, aktiv: true }
      ],
      fremd: [], montage: null, transport: { verpackungsmaterial: 40 }, risikoProz: 3, gewinnProz: 15, rabattProz: 0, mwstProz: 20, fertigungsGK: { typ: "prozent", basis: "direkt", wert: 14 }
    }));
    return list;
  }

  w.Preisschmiede = w.Preisschmiede || {};
  w.Preisschmiede.Kalkulation = {
    r2: r2, r4: r4, num: num, aufrunden: aufrunden,
    material: material, arbeit: arbeit, maschine: maschine, fremd: fremd, montage: montage,
    berechne: berechne, staffel: staffel, snapshot: snapshot,
    ausKonfiguration: ausKonfiguration, beispielKalkulationen: beispielKalkulationen
  };
})(typeof self !== "undefined" ? self : this);
