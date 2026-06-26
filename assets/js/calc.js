/* ============================================================
   Spanwerk – Kalkulations- & Lern-Engine
   Segmentiertes Lernen: Korrekturfaktoren werden je
   Produkttyp × Werkstoff × Größenklasse gebildet, mit
   Rückfall auf gröbere Segmente, wenn noch wenig Daten da sind.
   ============================================================ */
(function (w) {
  "use strict";

  var Products = w.Spanwerk.Products;
  var SCHRITTE = Products.SCHRITTE;

  function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
  function clamp(lo, hi, x) { return Math.max(lo, Math.min(hi, x)); }

  // ---- Basiszeiten (ohne Lernfaktor, mit manuellen Overrides) ----
  function basisZeiten(produktKey, config, manuelleZeiten) {
    var prod = Products.byKey(produktKey);
    var basis = prod ? prod.zeitmodell(config || {}) : {};
    var o = {};
    SCHRITTE.forEach(function (s) {
      var b = basis[s.key] || 0;
      if (manuelleZeiten && typeof manuelleZeiten[s.key] === "number" && !isNaN(manuelleZeiten[s.key])) {
        b = manuelleZeiten[s.key];
      }
      o[s.key] = b;
    });
    return o;
  }

  // ---- Größenklasse aus den Basis-Stunden ableiten ----------
  function groessenklasse(produktKey, config) {
    var basis = basisZeiten(produktKey, config, null);
    var sum = 0;
    SCHRITTE.forEach(function (s) { sum += basis[s.key] || 0; });
    return sum < 8 ? "S" : (sum <= 25 ? "M" : "L");
  }

  // ---- Segment-Schlüssel (spezifisch -> mittel -> allgemein) -
  function segmentKeys(produktKey, config) {
    var ws = (config && config.werkstoff) ? config.werkstoff : "allg";
    var g = groessenklasse(produktKey, config);
    return {
      spez: produktKey + "|" + ws + "|" + g,
      mat: produktKey + "|" + ws,
      allg: produktKey
    };
  }

  // ---- Lernfaktor abrufen (mit Fallback-Hierarchie) ---------
  function lernFaktorAusKeys(db, keys, schritt) {
    var F = (db.lernen && db.lernen.faktoren) || {};
    function get(k) { var e = F[k] && F[k][schritt]; return (e && isFinite(e.faktor)) ? e : null; }
    var e = get(keys.spez); if (e && e.samples >= 2) return e.faktor;
    e = get(keys.mat); if (e && e.samples >= 1) return e.faktor;
    e = get(keys.allg); if (e) return e.faktor;
    return 1;
  }

  // ---- Soll-Zeiten berechnen (inkl. segmentierter Lernfaktoren)
  function berechneZeiten(db, produktKey, config, manuelleZeiten) {
    var basis = basisZeiten(produktKey, config, manuelleZeiten);
    var keys = segmentKeys(produktKey, config);
    var zeiten = {};
    SCHRITTE.forEach(function (s) {
      var f = lernFaktorAusKeys(db, keys, s.key);
      zeiten[s.key] = round2(basis[s.key] * f);
    });
    return zeiten;
  }

  // ---- Materialpositionen aufbereiten -----------------------
  function materialPositionen(db, produktKey, config, freiePositionen) {
    var prod = Products.byKey(produktKey);
    var pos = [];
    if (prod && !prod.frei) pos = prod.material(config, db.material) || [];
    if (freiePositionen && freiePositionen.length) {
      freiePositionen.forEach(function (p) {
        if (!p.name) return;
        pos.push({
          name: p.name, menge: parseFloat(p.menge) || 0,
          einheit: p.einheit || "Stk", preis: parseFloat(p.preis) || 0, frei: true
        });
      });
    }
    return pos;
  }

  // ---- Vollständige Kalkulation -----------------------------
  function kalkuliere(db, eingabe) {
    var s = db.settings;
    var maschinen = s.maschinen || {};
    var verschnitt = (eingabe.verschnitt != null ? eingabe.verschnitt : s.verschnitt) / 100;

    var zeiten = berechneZeiten(db, eingabe.produktKey, eingabe.config, eingabe.manuelleZeiten);
    var positionen = materialPositionen(db, eingabe.produktKey, eingabe.config, eingabe.freiePositionen);

    // Material
    var materialEK = 0;
    var matZeilen = positionen.map(function (p) {
      var ep = p.frei ? p.preis : (p.ref ? p.ref.preis : 0);
      var summe = ep * p.menge * (1 + verschnitt);
      materialEK += summe;
      return { name: p.name, menge: round2(p.menge), einheit: p.einheit, ep: round2(ep), summe: round2(summe) };
    });
    var materialMitAufschlag = materialEK * (1 + s.materialAufschlag / 100);

    // Lohn + Maschinen
    var lohn = 0, maschinenKosten = 0, stundenGesamt = 0;
    var lohnZeilen = SCHRITTE.map(function (sch) {
      var h = zeiten[sch.key] || 0;
      var satz = s.rates[sch.kat] || 0;
      var lohnSumme = h * satz;
      var mSatz = sch.maschine ? (maschinen[sch.maschine] || 0) : 0;
      var mSumme = h * mSatz;
      lohn += lohnSumme; maschinenKosten += mSumme; stundenGesamt += h;
      return {
        key: sch.key, label: sch.label, stunden: round2(h),
        satz: satz, summe: round2(lohnSumme),
        maschine: sch.maschine || null, maschinenSatz: mSatz, maschinenSumme: round2(mSumme)
      };
    }).filter(function (z) { return z.stunden > 0; });

    // Preisaufbau
    var herstellkosten = materialMitAufschlag + lohn + maschinenKosten;
    var gemeinkosten = herstellkosten * (s.gemeinkosten / 100);
    var selbstkosten = herstellkosten + gemeinkosten;
    var gewinn = selbstkosten * (s.gewinn / 100);
    var netto = selbstkosten + gewinn;
    var mwst = netto * (s.mwst / 100);
    var brutto = netto + mwst;

    var variableKosten = materialEK + lohn + maschinenKosten;
    var deckungsbeitrag = netto - variableKosten;

    return {
      zeiten: zeiten, stundenGesamt: round2(stundenGesamt),
      matZeilen: matZeilen, lohnZeilen: lohnZeilen,
      materialEK: round2(materialEK), materialMitAufschlag: round2(materialMitAufschlag),
      lohn: round2(lohn), maschinenKosten: round2(maschinenKosten),
      herstellkosten: round2(herstellkosten), gemeinkosten: round2(gemeinkosten),
      selbstkosten: round2(selbstkosten), gewinn: round2(gewinn),
      netto: round2(netto), mwst: round2(mwst), brutto: round2(brutto),
      deckungsbeitrag: round2(deckungsbeitrag),
      deckungsbeitragProz: netto > 0 ? Math.round(deckungsbeitrag / netto * 100) : 0,
      segment: segmentKeys(eingabe.produktKey, eingabe.config)
    };
  }

  // ---- Angebotstext erzeugen --------------------------------
  function angebotstext(eingabe, kalk) {
    var prod = Products.byKey(eingabe.produktKey);
    var c = eingabe.config || {};
    var teile = [];
    teile.push("Sehr geehrte Damen und Herren,");
    teile.push("");
    teile.push("vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen wie folgt an:");
    teile.push("");
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
    teile.push("Pos. 1  " + (prod ? prod.name : "Konstruktion") + (details.length ? " (" + details.join(", ") + ")" : ""));
    teile.push("  inkl. Material, Fertigung" + (kalk.zeiten.montage > 0 ? ", Lieferung und Montage" : " und Lieferung"));
    teile.push("");
    teile.push("Gesamtpreis netto:    " + fmtEUR(kalk.netto));
    teile.push("zzgl. USt:            " + fmtEUR(kalk.mwst));
    teile.push("Gesamtpreis brutto:   " + fmtEUR(kalk.brutto));
    teile.push("");
    teile.push("Lieferzeit nach Vereinbarung. Das Angebot ist 30 Tage gültig.");
    teile.push("Wir freuen uns auf Ihren Auftrag.");
    teile.push("");
    teile.push("Mit freundlichen Grüßen");
    return teile.join("\n");
  }

  function fmtEUR(x) {
    return (x || 0).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  // ============================================================
  //  LERNFUNKTION (segmentiert)
  //  Pro Auftrag werden alle drei Segment-Ebenen aktualisiert:
  //  Produkt|Werkstoff|Größe, Produkt|Werkstoff, Produkt.
  //  Verhältnis = Ist / Basiszeit (unkorrigiert) je Arbeitsschritt.
  // ============================================================
  function lerneAusAuftrag(db, auftrag) {
    if (!auftrag || !auftrag.ist || !auftrag.ist.zeiten) return;
    db.lernen = db.lernen || { faktoren: {}, erkenntnisse: [] };
    var F = db.lernen.faktoren;
    var basis = basisZeiten(auftrag.produktKey, auftrag.config, auftrag.manuelleZeiten);
    var keys = segmentKeys(auftrag.produktKey, auftrag.config);
    var ebenen = [keys.spez, keys.mat, keys.allg];

    SCHRITTE.forEach(function (s) {
      var b = basis[s.key] || 0;
      var ist = auftrag.ist.zeiten[s.key] || 0;
      if (b <= 0 || ist <= 0) return;
      var v = ist / b;
      if (!isFinite(v) || v <= 0) return;
      ebenen.forEach(function (k) {
        F[k] = F[k] || {};
        var e = F[k][s.key] || { faktor: 1, samples: 0 };
        var neu = clamp(0.5, 2.0, (e.faktor * e.samples + v) / (e.samples + 1));
        F[k][s.key] = { faktor: round2(neu), samples: e.samples + 1 };
      });
    });
    erkenntnisseAktualisieren(db);
  }

  // ---- Lesbares Label für einen Segment-Schlüssel -----------
  function segLabel(key) {
    var p = key.split("|");
    var prod = Products.byKey(p[0]);
    var name = prod ? prod.name : p[0];
    if (p[1] && p[1] !== "allg") name += " · " + p[1];
    if (p[2]) name += " · " + ({ S: "klein", M: "mittel", L: "groß" }[p[2]] || p[2]);
    return name;
  }

  // ---- Klartext-Erkenntnisse generieren ---------------------
  function erkenntnisseAktualisieren(db) {
    var out = [];
    var F = db.lernen.faktoren || {};
    Object.keys(F).forEach(function (key) {
      var spezifisch = key.indexOf("|") >= 0;
      SCHRITTE.forEach(function (s) {
        var e = F[key][s.key];
        if (!e) return;
        // genug Belege je nach Ebene
        var minSamples = (key.split("|").length === 3) ? 2 : 1;
        if (e.samples < minSamples) return;
        var abw = Math.round((e.faktor - 1) * 100);
        if (Math.abs(abw) >= 5) {
          out.push({
            text: segLabel(key) + ": " + s.label + " benötigt im Schnitt " +
              Math.abs(abw) + " % " + (abw > 0 ? "mehr" : "weniger") + " Zeit als ursprünglich angesetzt.",
            samples: e.samples, abw: Math.abs(abw), spezifisch: spezifisch
          });
        }
      });
    });
    // spezifische & große Abweichungen zuerst
    out.sort(function (a, b) { return (b.spezifisch - a.spezifisch) || (b.abw - a.abw); });
    db.lernen.erkenntnisse = out;
    return out;
  }

  // ---- Soll/Ist-Abweichung eines Auftrags -------------------
  function sollIst(auftrag) {
    if (!auftrag.ist || !auftrag.ist.zeiten) return null;
    var sollH = 0, istH = 0;
    SCHRITTE.forEach(function (s) {
      sollH += auftrag.kalk.zeiten[s.key] || 0;
      istH += auftrag.ist.zeiten[s.key] || 0;
    });
    return {
      sollStunden: round2(sollH), istStunden: round2(istH),
      abwStunden: round2(istH - sollH),
      abwProz: sollH > 0 ? Math.round((istH - sollH) / sollH * 100) : 0
    };
  }

  w.Spanwerk = w.Spanwerk || {};
  w.Spanwerk.Calc = {
    kalkuliere: kalkuliere, berechneZeiten: berechneZeiten, basisZeiten: basisZeiten,
    segmentKeys: segmentKeys, groessenklasse: groessenklasse, segLabel: segLabel,
    angebotstext: angebotstext, lerneAusAuftrag: lerneAusAuftrag,
    erkenntnisseAktualisieren: erkenntnisseAktualisieren,
    sollIst: sollIst, fmtEUR: fmtEUR, round2: round2
  };
})(window);
