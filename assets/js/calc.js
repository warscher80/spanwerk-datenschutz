/* ============================================================
   Spanwerk – Kalkulations- & Lern-Engine
   ============================================================ */
(function (w) {
  "use strict";

  var Products = w.Spanwerk.Products;
  var SCHRITTE = Products.SCHRITTE;

  function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

  // ---- Lernfaktor abrufen -----------------------------------
  // Liefert Korrekturfaktor für (Produkttyp, Schritt). 1 = neutral.
  function lernFaktor(db, produktKey, schritt) {
    var f = db.lernen && db.lernen.faktoren && db.lernen.faktoren[produktKey];
    if (f && f[schritt] && isFinite(f[schritt].faktor)) return f[schritt].faktor;
    return 1;
  }

  // ---- Soll-Zeiten berechnen (inkl. Lernfaktoren) -----------
  function berechneZeiten(db, produktKey, config, manuelleZeiten) {
    var prod = Products.byKey(produktKey);
    var basis = prod ? prod.zeitmodell(config) : {};
    var zeiten = {};
    SCHRITTE.forEach(function (s) {
      var b = basis[s.key] || 0;
      // Bei freien Produkten dürfen manuelle Zeiten die Basis überschreiben
      if (manuelleZeiten && typeof manuelleZeiten[s.key] === "number" && !isNaN(manuelleZeiten[s.key])) {
        b = manuelleZeiten[s.key];
      }
      var f = lernFaktor(db, produktKey, s.key);
      zeiten[s.key] = round2(b * f);
    });
    return zeiten;
  }

  // ---- Materialpositionen aufbereiten -----------------------
  function materialPositionen(db, produktKey, config, freiePositionen) {
    var prod = Products.byKey(produktKey);
    var pos = [];
    if (prod && !prod.frei) {
      pos = prod.material(config, db.material) || [];
    }
    if (freiePositionen && freiePositionen.length) {
      freiePositionen.forEach(function (p) {
        if (!p.name) return;
        pos.push({
          name: p.name,
          menge: parseFloat(p.menge) || 0,
          einheit: p.einheit || "Stk",
          preis: parseFloat(p.preis) || 0,
          frei: true
        });
      });
    }
    return pos;
  }

  // ---- Vollständige Kalkulation -----------------------------
  function kalkuliere(db, eingabe) {
    var s = db.settings;
    var verschnitt = (eingabe.verschnitt != null ? eingabe.verschnitt : s.verschnitt) / 100;

    var zeiten = berechneZeiten(db, eingabe.produktKey, eingabe.config, eingabe.manuelleZeiten);
    var positionen = materialPositionen(db, eingabe.produktKey, eingabe.config, eingabe.freiePositionen);

    // Material
    var materialEK = 0;
    var matZeilen = positionen.map(function (p) {
      var ep = p.frei ? p.preis : (p.ref ? p.ref.preis : 0);
      var zeilenMitVerschnitt = ep * p.menge * (1 + verschnitt);
      materialEK += zeilenMitVerschnitt;
      return {
        name: p.name, menge: round2(p.menge), einheit: p.einheit,
        ep: round2(ep), summe: round2(zeilenMitVerschnitt)
      };
    });
    var materialMitAufschlag = materialEK * (1 + s.materialAufschlag / 100);

    // Lohn
    var lohn = 0, stundenGesamt = 0;
    var lohnZeilen = SCHRITTE.map(function (sch) {
      var h = zeiten[sch.key] || 0;
      var satz = s.rates[sch.kat] || 0;
      var summe = h * satz;
      lohn += summe; stundenGesamt += h;
      return { key: sch.key, label: sch.label, stunden: round2(h), satz: satz, summe: round2(summe) };
    }).filter(function (z) { return z.stunden > 0; });

    // Aufbau Verkaufspreis
    var herstellkosten = materialMitAufschlag + lohn;       // direkte Kosten
    var gemeinkosten = herstellkosten * (s.gemeinkosten / 100);
    var selbstkosten = herstellkosten + gemeinkosten;
    var gewinn = selbstkosten * (s.gewinn / 100);
    var netto = selbstkosten + gewinn;
    var mwst = netto * (s.mwst / 100);
    var brutto = netto + mwst;

    // Deckungsbeitrag = Erlös netto - variable Kosten (Material EK + Lohn)
    var variableKosten = materialEK + lohn;
    var deckungsbeitrag = netto - variableKosten;

    return {
      zeiten: zeiten,
      stundenGesamt: round2(stundenGesamt),
      matZeilen: matZeilen,
      lohnZeilen: lohnZeilen,
      materialEK: round2(materialEK),
      materialMitAufschlag: round2(materialMitAufschlag),
      lohn: round2(lohn),
      herstellkosten: round2(herstellkosten),
      gemeinkosten: round2(gemeinkosten),
      selbstkosten: round2(selbstkosten),
      gewinn: round2(gewinn),
      netto: round2(netto),
      mwst: round2(mwst),
      brutto: round2(brutto),
      deckungsbeitrag: round2(deckungsbeitrag),
      deckungsbeitragProz: netto > 0 ? Math.round(deckungsbeitrag / netto * 100) : 0
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
    var beschreibung = prod ? prod.name : "Konstruktion";
    var details = [];
    if (c.werkstoff) details.push(c.werkstoff);
    if (c.profil) details.push(c.profil);
    if (c.fuellung) details.push("Füllung: " + c.fuellung);
    if (c.laenge) details.push("Länge ca. " + c.laenge + " m");
    if (c.hoehe) details.push("Höhe ca. " + c.hoehe + " m");
    if (c.stueck) details.push(c.stueck + " Stück");
    if (c.oberflaeche && c.oberflaeche !== "Roh") details.push("Oberfläche: " + c.oberflaeche);
    teile.push("Pos. 1  " + beschreibung + (details.length ? " (" + details.join(", ") + ")" : ""));
    teile.push("  inkl. Material, Fertigung" + (kalk.zeiten.montage > 0 ? ", Lieferung und Montage" : " und Lieferung"));
    teile.push("");
    teile.push("Gesamtpreis netto:    " + fmtEUR(kalk.netto));
    teile.push("zzgl. USt (" + (eingabe.mwst != null ? eingabe.mwst : "") + "):       " + fmtEUR(kalk.mwst));
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
  //  LERNFUNKTION
  //  Beim Abschluss eines Auftrags werden Ist-Zeiten erfasst.
  //  Pro Produkttyp & Arbeitsschritt wird ein gewichteter
  //  Mittelwert des Verhältnisses Ist/Soll gebildet (Faktor).
  //  Künftige Kalkulationen multiplizieren die Basiszeit damit.
  // ============================================================
  function lerneAusAuftrag(db, auftrag) {
    if (!auftrag || !auftrag.ist || !auftrag.kalk) return;
    var pk = auftrag.produktKey;
    db.lernen = db.lernen || { faktoren: {}, erkenntnisse: [] };
    db.lernen.faktoren[pk] = db.lernen.faktoren[pk] || {};
    var fak = db.lernen.faktoren[pk];

    SCHRITTE.forEach(function (s) {
      var soll = auftrag.kalk.zeiten[s.key] || 0;
      var ist = auftrag.ist.zeiten ? (auftrag.ist.zeiten[s.key] || 0) : 0;
      if (soll <= 0 || ist <= 0) return;
      // "roher" Soll-Wert = soll / aktueller Faktor, damit das Verhältnis
      // gegen die unkorrigierte Basis verglichen wird.
      var aktFaktor = (fak[s.key] && fak[s.key].faktor) || 1;
      var sollBasis = soll / aktFaktor;
      var verhaeltnis = ist / sollBasis;
      if (!isFinite(verhaeltnis) || verhaeltnis <= 0) return;

      var eintrag = fak[s.key] || { faktor: 1, samples: 0 };
      var n = eintrag.samples;
      // gewichteter Mittelwert (mit Dämpfung, max. Einfluss pro Auftrag)
      var neu = (eintrag.faktor * n + verhaeltnis) / (n + 1);
      // Faktor in sinnvollen Grenzen halten
      neu = Math.max(0.5, Math.min(2.0, neu));
      fak[s.key] = { faktor: round2(neu), samples: n + 1 };
    });

    erkenntnisseAktualisieren(db);
  }

  // ---- Klartext-Erkenntnisse generieren ---------------------
  function erkenntnisseAktualisieren(db) {
    var out = [];
    var faktoren = db.lernen.faktoren || {};
    Object.keys(faktoren).forEach(function (pk) {
      var prod = Products.byKey(pk);
      var name = prod ? prod.name : pk;
      SCHRITTE.forEach(function (s) {
        var e = faktoren[pk][s.key];
        if (!e || e.samples < 1) return;
        var abw = Math.round((e.faktor - 1) * 100);
        if (Math.abs(abw) >= 5) {
          var richtung = abw > 0 ? "mehr" : "weniger";
          out.push({
            text: name + ": " + s.label + " benötigt im Schnitt " + Math.abs(abw) + " % " + richtung +
              " Zeit als ursprünglich angesetzt.",
            samples: e.samples
          });
        }
      });
    });
    // Materialverbrauch-Erkenntnisse
    db.auftraege.filter(function (a) { return a.ist && a.ist.materialKommentar; }).forEach(function () {});
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
      sollStunden: round2(sollH),
      istStunden: round2(istH),
      abwStunden: round2(istH - sollH),
      abwProz: sollH > 0 ? Math.round((istH - sollH) / sollH * 100) : 0
    };
  }

  w.Spanwerk = w.Spanwerk || {};
  w.Spanwerk.Calc = {
    kalkuliere: kalkuliere,
    berechneZeiten: berechneZeiten,
    angebotstext: angebotstext,
    lerneAusAuftrag: lerneAusAuftrag,
    erkenntnisseAktualisieren: erkenntnisseAktualisieren,
    sollIst: sollIst,
    fmtEUR: fmtEUR,
    round2: round2
  };
})(window);
