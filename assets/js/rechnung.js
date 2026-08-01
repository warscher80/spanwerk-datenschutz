/* ============================================================
   Preisschmiede – Nachträge & Rechnungskern (Phase 13A)
   Reine, testbare Logik. Nutzt dieselbe Decimal-sichere Rundung
   und die bestehende Kalkulationslogik (Kalkulation.*). Arbeitet
   je Mandant getrennt (Namespace in store.js).

   EHRLICH: KEINE steuerliche/rechtliche Beurteilung, KEINE echte
   ERP-/Zahlungs-/E-Mail-Anbindung, KEIN Rechnungsversand. Reverse
   Charge nur als MANUELL bestätigte Option. Steuerliche/rechtliche
   Ausgestaltung ist von Steuer-/Rechtsberatung zu prüfen.
   ============================================================ */
(function (w) {
  "use strict";
  w.Preisschmiede = w.Preisschmiede || {};
  function Store() { return w.Preisschmiede.Store; }
  function Kalk() { return w.Preisschmiede.Kalkulation; }
  function nowISO(j) { return j || (Store() && Store().nowISO()); }
  function uid() { return Store() ? Store().uid() : "id-" + Math.random().toString(36).slice(2, 9); }
  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
  // Decimal-sichere Rundung – identisch zur Angebots-/Kalkulationslogik.
  function r2(x) { if (!isFinite(x)) return 0; var s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 100 + 1e-6) / 100; }

  // =============================================================
  //  NACHTRÄGE
  // =============================================================
  var NACHTRAG_STATUS = ["erkannt", "in Prüfung", "kalkuliert", "freigegeben", "angenommen", "abgelehnt", "abgerechnet"];
  var NACHTRAG_URSACHEN = ["Kundenwunsch", "Planänderung", "zusätzliche Menge", "unvorhergesehene Baustellensituation", "fehlende Vorleistung", "Materialänderung", "technische Notwendigkeit", "Fehlerkorrektur", "sonstiger Grund"];

  function nachtragNeu(daten, jetztISO) {
    daten = daten || {};
    return {
      id: uid(), mandantId: daten.mandantId, nummer: daten.nummer || null,
      auftragId: daten.auftragId || null, projektId: daten.projektId || null, kommission: daten.kommission || "", kundeId: daten.kundeId || null,
      bezeichnung: daten.bezeichnung || "", beschreibung: daten.beschreibung || "", ursache: daten.ursache || "sonstiger Grund", gemeldetVon: daten.gemeldetVon || "",
      gewuenschterTermin: daten.gewuenschterTermin || null, status: "erkannt",
      mwstProz: daten.mwstProz != null ? num(daten.mwstProz) : 20, gemeinkostenProz: num(daten.gemeinkostenProz), gewinnProz: num(daten.gewinnProz),
      kalk: daten.kalk || {}, sollSnapshot: null, sollVersion: 0, aenderungsverlauf: [],
      zusatzleistungen: daten.zusatzleistungen || [],
      erstellt: jetztISO || nowISO(), geaendert: jetztISO || nowISO(), beispiel: !!daten.beispiel
    };
  }

  // Nachtragskalkulation: dieselbe Logik wie ein Auftrag (Material, Arbeit,
  // Maschine inkl. Rüstkosten, Montage, Fremdleistung). Liefert einen eigenen
  // Soll-Snapshot; die ursprüngliche Auftragskalkulation bleibt unberührt.
  function nachtragKalkulation(nachtrag) {
    var K = Kalk(); var t = nachtrag.kalk || {};
    var material = (K && t.material) ? K.material(t.material) : { kosten: 0, verkauf: 0 };
    var arbeit = (K && t.arbeit) ? K.arbeit(t.arbeit) : { kosten: 0, verkauf: 0 };
    var maschine = (K && t.maschine) ? K.maschine(t.maschine) : { gesamtkosten: 0, ruestkosten: 0, verkauf: 0 };
    var montage = (K && t.montage) ? K.montage(t.montage) : { kostenIntern: 0, verkauf: 0 };
    var fremd = (K && t.fremd) ? K.fremd(t.fremd) : { kosten: 0, verkauf: 0 };
    var selbst = r2(num(material.kosten) + num(arbeit.kosten) + num(maschine.gesamtkosten) + num(montage.kostenIntern) + num(fremd.kosten));
    var verkaufBasis = r2(num(material.verkauf) + num(arbeit.verkauf) + num(maschine.verkauf) + num(montage.verkauf) + num(fremd.verkauf));
    var netto = r2(verkaufBasis * (1 + num(nachtrag.gemeinkostenProz) / 100) * (1 + num(nachtrag.gewinnProz) / 100));
    var mwst = r2(netto * num(nachtrag.mwstProz) / 100);
    var brutto = r2(netto + mwst);
    return {
      selbst: selbst, verkaufBasis: verkaufBasis, netto: netto, mwst: mwst, brutto: brutto,
      teile: {
        material: r2(num(material.verkauf)), arbeit: r2(num(arbeit.verkauf)), maschine: r2(num(maschine.verkauf)),
        ruest: r2(num(maschine.ruestkosten)), montage: r2(num(montage.verkauf)), fremd: r2(num(fremd.verkauf))
      }
    };
  }
  // Soll-Snapshot einfrieren + Verlauf. Ändert die Auftragskalkulation nicht.
  function nachtragKalkulieren(nachtrag, jetztISO) {
    var snap = nachtragKalkulation(nachtrag);
    nachtrag.sollSnapshot = snap; nachtrag.sollVersion = (nachtrag.sollVersion || 0) + 1;
    nachtrag.status = "kalkuliert"; nachtrag.geaendert = jetztISO || nowISO();
    (nachtrag.aenderungsverlauf = nachtrag.aenderungsverlauf || []).push({ datum: jetztISO || nowISO(), aktion: "kalkuliert", version: nachtrag.sollVersion, netto: snap.netto });
    return nachtrag;
  }
  function nachtragStatus(nachtrag, status, jetztISO, notiz) {
    if (NACHTRAG_STATUS.indexOf(status) < 0) return { ok: false, grund: "unbekannter Status" };
    nachtrag.status = status; nachtrag.geaendert = jetztISO || nowISO();
    (nachtrag.aenderungsverlauf = nachtrag.aenderungsverlauf || []).push({ datum: jetztISO || nowISO(), aktion: "status:" + status, notiz: notiz || "" });
    return { ok: true };
  }
  // Zusatzleistung aus Zeiterfassung übernehmen (nur Vormerkung; nicht automatisch verrechnet).
  function zusatzUebernehmen(nachtrag, zusatz, jetztISO) {
    (nachtrag.zusatzleistungen = nachtrag.zusatzleistungen || []).push({ id: uid(), quelle: "zeiterfassung", beschreibung: zusatz.beschreibung || "", stunden: num(zusatz.stunden), material: zusatz.material || "", uebernommen: jetztISO || nowISO(), entscheidung: "verrechenbarer Nachtrag" });
    return nachtrag;
  }

  // Ursprünglicher Auftragswert bleibt erhalten; angenommene Nachträge werden
  // GETRENNT addiert -> aktueller Auftragswert.
  function auftragswert(auftragNetto, nachtraege) {
    var angenommen = (nachtraege || []).filter(function (n) { return n.status === "angenommen" || n.status === "abgerechnet"; });
    var nachtragNetto = angenommen.reduce(function (s, n) { return r2(s + num(n.sollSnapshot && n.sollSnapshot.netto)); }, 0);
    return { ursprungNetto: r2(num(auftragNetto)), nachtragNetto: r2(nachtragNetto), aktuellNetto: r2(num(auftragNetto) + nachtragNetto), anzahlNachtraege: angenommen.length };
  }

  // =============================================================
  //  RECHNUNGSKERN
  // =============================================================
  var RECHNUNGSARTEN = ["Rechnungsentwurf", "Akontorechnung", "Abschlagsrechnung", "Teilrechnung", "Schlussrechnung", "Gutschrift", "Stornobeleg"];
  var ZAHLUNGSTATUS = ["offen", "teilweise bezahlt", "bezahlt", "überfällig", "strittig", "gestundet", "storniert", "gutgeschrieben"];
  var ABZUG_ARTEN = ["Haftrücklass", "Deckungsrücklass", "Skonto", "sonstiger Einbehalt", "pauschaler Abzug"];
  var NEGATIVE_ARTEN = ["Gutschrift", "Stornobeleg"];
  // Rechnungsarten, die als Teilverrechnung auf den Auftragswert zählen.
  var TEILARTEN = ["Akontorechnung", "Abschlagsrechnung", "Teilrechnung"];

  function belegNeu(daten, jetztISO) {
    daten = daten || {};
    var neg = NEGATIVE_ARTEN.indexOf(daten.art) >= 0;
    return {
      id: uid(), mandantId: daten.mandantId, kundeId: daten.kundeId || null, projektId: daten.projektId || null, kommission: daten.kommission || "", auftragId: daten.auftragId || null,
      nummer: null, art: RECHNUNGSARTEN.indexOf(daten.art) >= 0 ? daten.art : "Rechnungsentwurf",
      vorzeichen: neg ? -1 : 1, referenzBelegId: daten.referenzBelegId || null,
      rechnungsdatum: daten.rechnungsdatum || (jetztISO || nowISO()),
      leistungszeitraum: daten.leistungszeitraum || { von: null, bis: null },
      zahlungszielTage: daten.zahlungszielTage != null ? num(daten.zahlungszielTage) : 14, skontoProz: num(daten.skontoProz), skontoTage: num(daten.skontoTage),
      faelligkeit: null, mwstProz: daten.mwstProz != null ? num(daten.mwstProz) : 20, rabattProz: num(daten.rabattProz),
      reverseCharge: !!daten.reverseCharge, reverseChargeBestaetigt: !!daten.reverseChargeBestaetigt, reverseChargeHinweis: daten.reverseChargeHinweis || "",
      positionen: (daten.positionen || []).map(function (p, i) {
        return { nummer: p.nummer || String(i + 1), bezeichnung: p.bezeichnung || "", beschreibung: p.beschreibung || "", menge: num(p.menge), einheit: p.einheit || "", einzelpreis: num(p.einzelpreis), rabattProz: num(p.rabattProz), mwstProz: p.mwstProz != null ? num(p.mwstProz) : null, gesamtmenge: p.gesamtmenge != null ? num(p.gesamtmenge) : null, bereitsAbgerechnet: num(p.bereitsAbgerechnet), bezug: p.bezug || null };
      }),
      abzuege: (daten.abzuege || []).map(function (a) { return { art: a.art || "sonstiger Einbehalt", prozent: a.prozent != null ? num(a.prozent) : null, betrag: a.betrag != null ? num(a.betrag) : null, basis: a.basis || "netto", beschreibung: a.beschreibung || "", faelligkeit: a.faelligkeit || null }; }),
      anrechnungen: (daten.anrechnungen || []).map(function (a) { return { belegId: a.belegId || null, bezeichnung: a.bezeichnung || "", netto: num(a.netto), mwst: num(a.mwst), brutto: num(a.brutto) }; }),
      status: "Rechnungsentwurf", zahlungstatus: neg ? "gutgeschrieben" : "offen", zahlungen: [],
      snapshot: null, freigegeben: false, freigegebenVon: null, freigegebenAm: null, appVersion: (w.PSBUILD && w.PSBUILD.version) || "Web",
      ersteller: daten.ersteller || "", erstellt: jetztISO || nowISO(), geaendert: jetztISO || nowISO(), beispiel: !!daten.beispiel
    };
  }

  // Positionssumme (Menge × Einzelpreis, abzüglich Positionsrabatt), Decimal.
  function posNetto(p) { var brutto = r2(num(p.menge) * num(p.einzelpreis)); return r2(brutto * (1 - num(p.rabattProz) / 100)); }

  // Belegsummen: gruppiert je Umsatzsteuersatz, Decimal, mit Rabatt, Abzügen,
  // Anrechnungen. Reverse Charge -> Steuersatz 0 (nur wenn manuell bestätigt).
  function belegSummen(beleg) {
    var vz = beleg.vorzeichen || 1;
    var rc = !!beleg.reverseCharge;
    var proSatz = {};
    (beleg.positionen || []).forEach(function (p) {
      var satz = rc ? 0 : (p.mwstProz != null ? num(p.mwstProz) : num(beleg.mwstProz));
      proSatz[satz] = r2((proSatz[satz] || 0) + posNetto(p));
    });
    var zwischen = Object.keys(proSatz).reduce(function (s, k) { return r2(s + proSatz[k]); }, 0);
    var rabatt = r2(zwischen * num(beleg.rabattProz) / 100);
    var netto = 0, mwst = 0, steuerZeilen = [];
    Object.keys(proSatz).sort(function (a, b) { return a - b; }).forEach(function (satz) {
      var anteil = zwischen > 0 ? proSatz[satz] / zwischen : 0;
      var nettoSatz = r2(proSatz[satz] - rabatt * anteil);
      var st = r2(nettoSatz * num(satz) / 100);
      netto = r2(netto + nettoSatz); mwst = r2(mwst + st);
      steuerZeilen.push({ satz: num(satz), netto: r2(nettoSatz * vz), steuer: r2(st * vz) });
    });
    // Abzüge (Einbehalte/Skonto) – rein informativ berechnet, keine Steuerwertung.
    var abzuege = (beleg.abzuege || []).map(function (a) {
      var basis = a.basis === "brutto" ? r2(netto + mwst) : netto;
      var betrag = a.betrag != null ? num(a.betrag) : r2(basis * num(a.prozent) / 100);
      return { art: a.art, betrag: r2(betrag), basis: a.basis, beschreibung: a.beschreibung };
    });
    var abzugSumme = abzuege.reduce(function (s, a) { return r2(s + a.betrag); }, 0);
    var bruttoRoh = r2(netto + mwst);
    var angerechnetBrutto = (beleg.anrechnungen || []).reduce(function (s, a) { return r2(s + num(a.brutto)); }, 0);
    var angerechnetNetto = (beleg.anrechnungen || []).reduce(function (s, a) { return r2(s + num(a.netto)); }, 0);
    return {
      netto: r2(netto * vz), mwst: r2(mwst * vz), brutto: r2(bruttoRoh * vz), steuerZeilen: steuerZeilen, rabatt: r2(rabatt * vz),
      abzuege: abzuege, abzugSumme: r2(abzugSumme), angerechnetNetto: r2(angerechnetNetto), angerechnetBrutto: r2(angerechnetBrutto),
      restBrutto: r2(bruttoRoh * vz - angerechnetBrutto - abzugSumme), restNetto: r2(netto * vz - angerechnetNetto),
      reverseCharge: rc, reverseChargeGueltig: rc ? !!beleg.reverseChargeBestaetigt : true
    };
  }

  // Reverse-Charge-Hinweis (nur wenn manuell gesetzt UND bestätigt).
  function reverseChargePruefung(beleg) {
    if (!beleg.reverseCharge) return { anwendbar: false };
    if (!beleg.reverseChargeBestaetigt) return { anwendbar: false, warnung: "Reverse Charge markiert, aber nicht bestätigt – Steuerart bitte prüfen." };
    return { anwendbar: true, hinweis: beleg.reverseChargeHinweis || "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge). Keine automatische steuerliche Beurteilung." };
  }

  // Fehlende Begründungen/Bestätigungen melden (keine steuerliche Wertung).
  function belegHinweise(beleg) {
    var h = [];
    if (beleg.reverseCharge && !beleg.reverseChargeBestaetigt) h.push("Reverse Charge nicht bestätigt");
    var saetze = {}; (beleg.positionen || []).forEach(function (p) { saetze[p.mwstProz != null ? p.mwstProz : beleg.mwstProz] = true; });
    if (beleg.reverseCharge && !beleg.reverseChargeHinweis) h.push("Reverse-Charge-Hinweistext fehlt");
    if (!(beleg.positionen || []).length) h.push("keine Positionen");
    return h;
  }

  // =============================================================
  //  NUMMERNKREISE (pro Mandant, transaktionssicher vorbereitet)
  // =============================================================
  function standardKreise() {
    return {
      Rechnung: { praefix: "RE", jahr: null, laufend: 1, mindestlaenge: 4 },
      Gutschrift: { praefix: "GU", jahr: null, laufend: 1, mindestlaenge: 4 },
      Stornobeleg: { praefix: "ST", jahr: null, laufend: 1, mindestlaenge: 4 }
    };
  }
  function kreisFuer(art) { return art === "Gutschrift" ? "Gutschrift" : art === "Stornobeleg" ? "Stornobeleg" : "Rechnung"; }
  function formatNummer(kreis, jahr) { return kreis.praefix + "-" + jahr + "-" + ("0000000000" + kreis.laufend).slice(-(kreis.mindestlaenge || 4)); }
  // Vergibt die NÄCHSTE Nummer und erhöht den Zähler ATOMAR im settings-Objekt.
  // Der Aufrufer speichert settings unmittelbar (transaktionssicher). Eine bereits
  // vergebene (freigegebene) Nummer wird nie erneut vergeben.
  function naechsteNummer(settings, art, jahr) {
    settings.rechnung = settings.rechnung || {}; settings.rechnung.kreise = settings.rechnung.kreise || standardKreise();
    var kreise = settings.rechnung.kreise; var name = kreisFuer(art);
    var k = kreise[name] || (kreise[name] = standardKreise().Rechnung);
    if (k.jahr !== jahr) { k.jahr = jahr; k.laufend = 1; }
    var nummer = formatNummer(k, jahr);
    k.laufend = k.laufend + 1; // Zähler sofort erhöhen -> keine Doppelvergabe
    return nummer;
  }

  // =============================================================
  //  FREIGABE / UNVERÄNDERBARKEIT
  // =============================================================
  function belegBearbeitbar(beleg) { return !beleg.freigegeben; }
  // Freigabe: endgültige Nummer vergeben, vollständigen Snapshot einfrieren.
  // Danach ist der Beleg unveränderbar (Korrektur nur via Gutschrift/Storno).
  function belegFreigeben(beleg, settings, kontext, jetztISO) {
    if (beleg.freigegeben) return { ok: false, grund: "bereits freigegeben" };
    var hinw = belegHinweise(beleg);
    if (hinw.indexOf("keine Positionen") >= 0) return { ok: false, grund: "keine Positionen" };
    if (beleg.reverseCharge && !beleg.reverseChargeBestaetigt) return { ok: false, grund: "Reverse Charge nicht bestätigt" };
    var jahr = new Date(beleg.rechnungsdatum || nowISO(jetztISO)).getFullYear();
    beleg.nummer = naechsteNummer(settings, beleg.art, jahr);
    var s = belegSummen(beleg);
    beleg.faelligkeit = faelligkeit(beleg.rechnungsdatum, beleg.zahlungszielTage, jetztISO).faellig;
    beleg.snapshot = {
      firma: kontext && kontext.firma ? JSON.parse(JSON.stringify(kontext.firma)) : null,
      kunde: kontext && kontext.kunde ? JSON.parse(JSON.stringify(kontext.kunde)) : null,
      positionen: JSON.parse(JSON.stringify(beleg.positionen)), summen: s,
      nummer: beleg.nummer, art: beleg.art, rechnungsdatum: beleg.rechnungsdatum, faelligkeit: beleg.faelligkeit,
      pruefsumme: (Store() ? Store().hashPin(JSON.stringify({ n: beleg.nummer, p: beleg.positionen, s: s }), "beleg-snapshot") : null),
      appVersion: beleg.appVersion, freigegebenAm: jetztISO || nowISO()
    };
    beleg.status = beleg.art; beleg.freigegeben = true; beleg.freigegebenVon = (kontext && kontext.benutzer) || ""; beleg.freigegebenAm = jetztISO || nowISO();
    return { ok: true, nummer: beleg.nummer };
  }

  // Gutschrift/Storno zu einem freigegebenen Beleg (Korrekturweg).
  function gutschriftZu(original, daten, jetztISO) {
    daten = daten || {};
    var pos = (daten.positionen && daten.positionen.length) ? daten.positionen : (original.positionen || []);
    return belegNeu({ mandantId: original.mandantId, kundeId: original.kundeId, projektId: original.projektId, kommission: original.kommission, auftragId: original.auftragId, art: "Gutschrift", referenzBelegId: original.id, mwstProz: original.mwstProz, positionen: pos, grund: daten.grund, ersteller: daten.ersteller }, jetztISO);
  }
  function stornoZu(original, daten, jetztISO) {
    daten = daten || {};
    return belegNeu({ mandantId: original.mandantId, kundeId: original.kundeId, projektId: original.projektId, kommission: original.kommission, auftragId: original.auftragId, art: "Stornobeleg", referenzBelegId: original.id, mwstProz: original.mwstProz, positionen: original.positionen, grund: daten.grund, ersteller: daten.ersteller }, jetztISO);
  }

  // =============================================================
  //  ABRECHNUNGSSTAND / DOPPELVERRECHNUNG / ÜBERRECHNUNG
  // =============================================================
  // Summe der bereits (freigegeben) verrechneten Netto-Beträge auf den Auftrag,
  // vorzeichenrichtig (Gutschrift/Storno reduzieren). Schlussrechnung optional
  // ausgenommen, um bei der Prüfung nicht doppelt zu zählen.
  function verrechnetNetto(belege, opt) {
    opt = opt || {};
    return (belege || []).filter(function (b) {
      if (!b.freigegeben) return false;
      if (opt.ohneSchluss && b.art === "Schlussrechnung") return false;
      return true;
    }).reduce(function (s, b) { return r2(s + belegSummen(b).netto); }, 0);
  }
  function abrechnungsstand(auftragNetto, nachtraege, belege) {
    var aw = auftragswert(auftragNetto, nachtraege);
    var verrechnet = verrechnetNetto(belege);
    return {
      ursprungNetto: aw.ursprungNetto, nachtragNetto: aw.nachtragNetto, gesamtNetto: aw.aktuellNetto,
      verrechnetNetto: r2(verrechnet), offenNetto: r2(aw.aktuellNetto - verrechnet)
    };
  }
  // Prüft, ob ein NEUER Beleg den (aktuellen) Auftragswert überrechnet.
  function pruefeUeberrechnung(gesamtNetto, bereitsVerrechnetNetto, neuerBelegNetto, erlaubtMitBegruendung) {
    var summe = r2(num(bereitsVerrechnetNetto) + num(neuerBelegNetto));
    var ueber = summe - num(gesamtNetto) > 0.005;
    return { ueberrechnet: ueber, ueberschussNetto: r2(Math.max(0, summe - num(gesamtNetto))), zulaessig: !ueber || !!erlaubtMitBegruendung };
  }
  // Vorschlag für die Schlussrechnung: verbleibender Netto-Betrag (ohne Doppel).
  function schlussVorschlagNetto(auftragNetto, nachtraege, belege) {
    var aw = auftragswert(auftragNetto, nachtraege);
    var vor = verrechnetNetto(belege, { ohneSchluss: true });
    return r2(aw.aktuellNetto - vor);
  }

  // =============================================================
  //  ZAHLUNGEN / FÄLLIGKEIT
  // =============================================================
  function faelligkeit(rechnungsdatumISO, zieltage, jetztISO) {
    var basis = new Date(rechnungsdatumISO || nowISO(jetztISO));
    var faellig = new Date(basis.getTime() + num(zieltage) * 86400000);
    return { faellig: faellig.toISOString() };
  }
  function skonto(nettoBrutto, skontoProz, rechnungsdatumISO, skontoTage) {
    var betrag = r2(num(nettoBrutto) * num(skontoProz) / 100);
    var frist = new Date(new Date(rechnungsdatumISO).getTime() + num(skontoTage) * 86400000).toISOString();
    return { skontobetrag: betrag, skontofrist: frist, verbleibend: r2(num(nettoBrutto) - betrag) };
  }
  function zahlungErfassen(beleg, zahlung, jetztISO) {
    (beleg.zahlungen = beleg.zahlungen || []).push({ id: uid(), betrag: r2(num(zahlung.betrag)), datum: zahlung.datum || (jetztISO || nowISO()), referenz: zahlung.referenz || "", art: zahlung.art || "Überweisung", notiz: zahlung.notiz || "", erfasstVon: zahlung.erfasstVon || "" });
    return aktualisiereZahlungstatus(beleg, jetztISO);
  }
  function bezahltBetrag(beleg) { return (beleg.zahlungen || []).reduce(function (s, z) { return r2(s + num(z.betrag)); }, 0); }
  function offenerBetrag(beleg) { return r2(belegSummen(beleg).brutto - bezahltBetrag(beleg)); }
  function aktualisiereZahlungstatus(beleg, jetztISO) {
    if (NEGATIVE_ARTEN.indexOf(beleg.art) >= 0) { beleg.zahlungstatus = "gutgeschrieben"; return beleg.zahlungstatus; }
    if (beleg.zahlungstatus === "storniert" || beleg.zahlungstatus === "strittig" || beleg.zahlungstatus === "gestundet") return beleg.zahlungstatus;
    var brutto = belegSummen(beleg).brutto, bezahlt = bezahltBetrag(beleg);
    if (bezahlt <= 0) beleg.zahlungstatus = ueberfaellig(beleg, jetztISO) ? "überfällig" : "offen";
    else if (bezahlt + 0.005 < brutto) beleg.zahlungstatus = "teilweise bezahlt";
    else beleg.zahlungstatus = "bezahlt";
    return beleg.zahlungstatus;
  }
  function ueberfaellig(beleg, jetztISO) { return beleg.faelligkeit && new Date(beleg.faelligkeit).getTime() < new Date(nowISO(jetztISO)).getTime(); }

  // =============================================================
  //  ROLLEN / BERECHTIGUNGEN
  // =============================================================
  // Werkstatt/Montage dürfen keine Rechnungsdaten sehen/bearbeiten.
  var RECHNUNG_RECHTE = {
    admin: ["entwurf", "bearbeiten", "preise", "steuerart", "pruefen", "freigeben", "stornieren", "gutschrift", "zahlung", "erp_export", "finanzdashboard"],
    buero: ["entwurf", "bearbeiten", "preise", "steuerart", "pruefen", "freigeben", "stornieren", "gutschrift", "zahlung", "finanzdashboard"],
    werkstatt: []
  };
  function darfBeleg(rolle, aktion) { return (RECHNUNG_RECHTE[rolle] || []).indexOf(aktion) >= 0; }

  w.Preisschmiede.Rechnung = {
    // Nachträge
    NACHTRAG_STATUS: NACHTRAG_STATUS, NACHTRAG_URSACHEN: NACHTRAG_URSACHEN,
    nachtragNeu: nachtragNeu, nachtragKalkulation: nachtragKalkulation, nachtragKalkulieren: nachtragKalkulieren,
    nachtragStatus: nachtragStatus, zusatzUebernehmen: zusatzUebernehmen, auftragswert: auftragswert,
    // Rechnungskern
    RECHNUNGSARTEN: RECHNUNGSARTEN, ZAHLUNGSTATUS: ZAHLUNGSTATUS, ABZUG_ARTEN: ABZUG_ARTEN, TEILARTEN: TEILARTEN,
    belegNeu: belegNeu, belegSummen: belegSummen, posNetto: posNetto, belegHinweise: belegHinweise, reverseChargePruefung: reverseChargePruefung,
    // Nummern / Freigabe
    standardKreise: standardKreise, naechsteNummer: naechsteNummer, belegBearbeitbar: belegBearbeitbar, belegFreigeben: belegFreigeben,
    gutschriftZu: gutschriftZu, stornoZu: stornoZu,
    // Stand / Prüfungen
    verrechnetNetto: verrechnetNetto, abrechnungsstand: abrechnungsstand, pruefeUeberrechnung: pruefeUeberrechnung, schlussVorschlagNetto: schlussVorschlagNetto,
    // Zahlungen
    faelligkeit: faelligkeit, skonto: skonto, zahlungErfassen: zahlungErfassen, bezahltBetrag: bezahltBetrag, offenerBetrag: offenerBetrag, aktualisiereZahlungstatus: aktualisiereZahlungstatus, ueberfaellig: ueberfaellig,
    // Rechte
    RECHNUNG_RECHTE: RECHNUNG_RECHTE, darfBeleg: darfBeleg,
    num: num, r2: r2
  };
})(typeof self !== "undefined" ? self : this);
