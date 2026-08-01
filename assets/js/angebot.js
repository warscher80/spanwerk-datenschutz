/* ============================================================
   Preisschmiede – Angebotsgenerator (Phase 4)
   Aus einer freigegebenen Kalkulation entsteht ein Kundenangebot.
   WICHTIG: Interne Kalkulationsdaten (Einkaufspreise, Kostensätze,
   Gemeinkosten, Deckungsbeitrag, Gewinn, interne Notizen) dürfen
   NIEMALS in die Kundenausgabe/PDF gelangen. Die Kundenausgabe wird
   ausschließlich aus erlaubten Feldern neu aufgebaut (Whitelist).
   ============================================================ */
(function (w) {
  "use strict";
  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
  function r2(x) { if (!isFinite(x)) return 0; var s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 100 + 1e-6) / 100; }

  // ---- Positionstypen ---------------------------------------
  var POSTYPEN = {
    normal: { label: "Position", rechnet: true },
    ueberschrift: { label: "Überschrift", struktur: true },
    text: { label: "Textposition", struktur: true },
    zwischensumme: { label: "Zwischensumme", struktur: true },
    pauschal: { label: "Pauschalposition", rechnet: true },
    optional: { label: "Optionale Position", optional: true },
    alternativ: { label: "Alternativposition", alternativ: true },
    bedarf: { label: "Bedarfsposition", optional: true },
    nachlass: { label: "Nachlass", rechnet: true, negativ: true },
    zuschlag: { label: "Zuschlag", rechnet: true }
  };

  function posSumme(p) {
    var s = r2(num(p.menge) * num(p.einzelpreis));
    var t = POSTYPEN[p.typ] || POSTYPEN.normal;
    if (t.negativ) return -Math.abs(s);
    return s;
  }

  // ---- Nummernkreis (konfigurierbar) ------------------------
  function naechsteNummer(nk) {
    nk = nk || {};
    var praefix = nk.praefix != null ? nk.praefix : "AN";
    var jahr = nk.jahr || new Date().getFullYear();
    var lauf = nk.laufend || 1;
    var minLen = nk.mindestlaenge || 4;
    return praefix + "-" + jahr + "-" + ("0000000000" + lauf).slice(-minLen);
  }

  // ---- Angebotssummen ---------------------------------------
  // Optionale/Alternativ-/Bedarfspositionen NUR wenn ausdrücklich aktiviert.
  function summen(angebot) {
    var positionen = angebot.positionen || [];
    var zwischensumme = 0, zuschlaege = 0, optionalSumme = 0;
    var proSteuersatz = {};
    positionen.forEach(function (p) {
      if (p.aktiv === false) return;
      var t = POSTYPEN[p.typ] || POSTYPEN.normal;
      var istOptional = !!(t.optional || t.alternativ);
      var betrag = (t.rechnet || istOptional) ? posSumme(p) : 0;
      // Nicht aktivierte optionale/Alternativpositionen: separat, NICHT in der Summe
      if (istOptional && !p.aktiviert) { optionalSumme += betrag; return; }
      // Reine Strukturpositionen (Überschrift/Text/Zwischensumme) zählen nicht
      if (!t.rechnet && !istOptional) return;
      // Ab hier: normal/pauschal/nachlass/zuschlag ODER aktivierte optional/alternativ
      if (p.typ === "zuschlag") zuschlaege += betrag;
      else zwischensumme += betrag;
      var satz = p.mwstProz != null ? num(p.mwstProz) : num(angebot.mwstProz);
      proSteuersatz[satz] = r2((proSteuersatz[satz] || 0) + betrag);
    });
    zwischensumme = r2(zwischensumme); zuschlaege = r2(zuschlaege);
    var rabattBasis = zwischensumme + zuschlaege;
    var rabatt = r2(rabattBasis * num(angebot.rabattProz) / 100);
    // Rabatt anteilig je Steuersatz
    var netto = 0, mwst = 0, steuerZeilen = [];
    Object.keys(proSteuersatz).sort(function (a, b) { return a - b; }).forEach(function (satz) {
      var anteil = rabattBasis > 0 ? proSteuersatz[satz] / rabattBasis : 0;
      var nettoSatz = r2(proSteuersatz[satz] - rabatt * anteil);
      var st = r2(nettoSatz * num(satz) / 100);
      netto = r2(netto + nettoSatz); mwst = r2(mwst + st);
      steuerZeilen.push({ satz: num(satz), netto: nettoSatz, steuer: st });
    });
    var brutto = r2(netto + mwst);
    return {
      zwischensumme: zwischensumme, zuschlaege: zuschlaege, rabatt: rabatt,
      netto: netto, mwst: mwst, brutto: brutto, steuerZeilen: steuerZeilen,
      optionalSumme: r2(optionalSumme), nettoMitOptionen: r2(netto + optionalSumme)
    };
  }

  // ---- Platzhalter ------------------------------------------
  function platzhalterWerte(angebot, ctx) {
    var s = summen(angebot);
    return {
      kunde: ctx.kundeName || "", ansprechpartner: ctx.ansprechpartner || "",
      projekt: ctx.projekt || "", kommission: angebot.kommission || "",
      angebotsnummer: angebot.nummer || "", angebotsdatum: ctx.datum || "",
      gueltig_bis: ctx.gueltigBis || "", nettosumme: ctx.fmtEUR ? ctx.fmtEUR(s.netto) : String(s.netto),
      bruttosumme: ctx.fmtEUR ? ctx.fmtEUR(s.brutto) : String(s.brutto),
      betreff: angebot.betreff || ""
    };
  }
  function ersetze(text, werte) {
    return String(text || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, function (m, key) {
      var v = werte[key.toLowerCase()];
      return v != null && v !== "" ? v : "";
    });
  }
  function offenePlatzhalter(text, werte) {
    var offen = [];
    String(text || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, function (m, key) {
      var v = werte[key.toLowerCase()];
      if (v == null || v === "") offen.push(key.toLowerCase());
      return m;
    });
    return offen;
  }

  // ---- KUNDENSICHERE AUSGABE (Whitelist) --------------------
  // Enthält ausschließlich erlaubte Felder – niemals interne Kosten/Margen.
  var VERBOTEN = ["einkaufspreis", "kosten", "internerSatz", "internekosten", "deckungsbeitrag",
    "gewinn", "selbst", "herstell", "materialaufschlag", "aufschlagProz", "risiko", "gemeinkosten",
    "internenotiz", "aenderungsgrund", "lieferantId", "einkauf", "ruestkosten"];
  function kundenAusgabe(angebot, ctx) {
    var s = summen(angebot);
    var werte = platzhalterWerte(angebot, ctx);
    function txt(t) { return ersetze(t, werte); }
    var positionen = (angebot.positionen || []).filter(function (p) { return p.aktiv !== false; }).map(function (p) {
      var t = POSTYPEN[p.typ] || POSTYPEN.normal;
      return {
        nummer: p.nummer || "", typ: p.typ, kurz: p.kurz || "", beschreibung: p.beschreibung || "",
        menge: t.rechnet || t.optional || t.alternativ ? num(p.menge) : null,
        einheit: p.einheit || "", einzelpreis: t.rechnet || t.optional || t.alternativ ? r2(num(p.einzelpreis)) : null,
        gesamtpreis: t.rechnet ? posSumme(p) : (t.optional || t.alternativ ? posSumme(p) : null),
        optional: !!(t.optional), alternativ: !!(t.alternativ), aktiviert: !!p.aktiviert,
        seitenumbruch: !!p.seitenumbruch
      };
    });
    // Firma und Kunde als TIEFE KOPIE einfrieren – spätere Stammdaten-
    // änderungen dürfen einen freigegebenen Angebots-Snapshot nicht verändern.
    function kopie(o) { try { return o ? JSON.parse(JSON.stringify(o)) : {}; } catch (e) { return {}; } }
    return {
      firma: kopie(ctx.firma), kunde: kopie(ctx.kunde), ansprechpartner: angebot.ansprechpartner || "",
      lieferadresse: angebot.lieferadresse || "", projekt: werte.projekt, kommission: angebot.kommission || "",
      nummer: angebot.nummer, datum: ctx.datum || "", gueltigBis: ctx.gueltigBis || "",
      betreff: txt(angebot.betreff), einleitung: txt(angebot.einleitung),
      positionen: positionen, summen: s,
      zahlungsbedingungen: txt(angebot.zahlungsbedingungen), lieferbedingungen: txt(angebot.lieferbedingungen),
      ausfuehrungszeitraum: txt(angebot.ausfuehrungszeitraum), voraussetzungen: txt(angebot.voraussetzungen),
      ausschluesse: txt(angebot.ausschluesse), schlusstext: txt(angebot.schlusstext)
    };
  }
  // Prüft ein Ausgabeobjekt rekursiv auf verbotene interne Felder
  function enthaeltInterne(obj) {
    var treffer = [];
    (function scan(o, pfad) {
      if (!o || typeof o !== "object") return;
      Object.keys(o).forEach(function (k) {
        if (VERBOTEN.indexOf(k) >= 0) treffer.push(pfad + k);
        scan(o[k], pfad + k + ".");
      });
    })(obj, "");
    return treffer;
  }

  // ---- Dateiname bereinigen ---------------------------------
  function dateiname(angebot, kommission) {
    var teile = ["Angebot", angebot.nummer || "", kommission || ""].filter(Boolean);
    return teile.join("_").replace(/[^A-Za-z0-9_\-.]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") + ".pdf";
  }

  // ---- Positionen aus Kalkulation übernehmen ----------------
  // detail = 'detail' | 'zusammen' | 'pauschal'
  function ausKalkulation(kalk, Kalkulation, modus) {
    var r = Kalkulation.berechne(kalk, {});
    var pos = [];
    if (modus === "pauschal") {
      pos.push({ nummer: "1", typ: "pauschal", kurz: kalk.bezeichnung || "Leistung", beschreibung: "Pauschalpreis laut Kalkulation " + (kalk.nummer || ""), menge: 1, einheit: "Pausch.", einzelpreis: r.netto, mwstProz: r.mwstProz, aktiv: true, kalkRef: kalk.id });
    } else if (modus === "zusammen") {
      var bloecke = [["Material", r.material.verkauf], ["Fertigung & Bearbeitung", r2(r.arbeit.kosten + r.maschine.kosten)], ["Fremdleistungen", r.fremdKosten], ["Montage & Transport", r2(r.montageKosten + r.transportKosten)]];
      var i = 1;
      bloecke.forEach(function (bl) { if (bl[1] > 0) { pos.push({ nummer: String(i++), typ: "normal", kurz: bl[0], beschreibung: "", menge: 1, einheit: "Pos", einzelpreis: r2(bl[1] / (r.material.kosten + r.arbeit.kosten || 1) * r.netto / bloecke.length) , mwstProz: r.mwstProz, aktiv: true }); } });
      // Fallback: eine Position mit dem Netto
      if (!pos.length) pos.push({ nummer: "1", typ: "normal", kurz: kalk.bezeichnung || "Leistung", menge: 1, einheit: "Pos", einzelpreis: r.netto, mwstProz: r.mwstProz, aktiv: true });
      else { var summe = pos.reduce(function (a, p) { return a + p.einzelpreis; }, 0); var diff = r2(r.netto - summe); if (diff && pos.length) pos[0].einzelpreis = r2(pos[0].einzelpreis + diff); }
    } else { // detail
      var n = 1;
      pos.push({ nummer: String(n++), typ: "normal", kurz: kalk.bezeichnung || "Leistung", beschreibung: "Konstruktion und Fertigung laut Kalkulation", menge: 1, einheit: "Pos", einzelpreis: r2(r.netto - (kalk.montage ? r.montage.verkauf : 0)), mwstProz: r.mwstProz, aktiv: true });
      if (kalk.montage && r.montage.verkauf > 0) pos.push({ nummer: String(n++), typ: "normal", kurz: "Montage", beschreibung: "Montage vor Ort", menge: 1, einheit: "Pos", einzelpreis: r.montage.verkauf, mwstProz: r.mwstProz, aktiv: true });
    }
    return pos;
  }

  // ---- Standard-Textbausteine (mit Platzhaltern) ------------
  var SEED_TEXTBAUSTEINE = [
    { kategorie: "Einleitung", titel: "Standard-Einleitung", standard: true, text: "Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen für {{projekt}} folgendes Angebot:" },
    { kategorie: "Zahlungsbedingungen", titel: "30/70", standard: true, text: "30 % bei Auftragserteilung, Restbetrag nach Lieferung/Montage. Zahlbar innerhalb von 14 Tagen netto ohne Abzug." },
    { kategorie: "Lieferbedingungen", titel: "Frei Baustelle", standard: true, text: "Lieferung frei Baustelle. Liefertermin nach Vereinbarung." },
    { kategorie: "Ausführungszeit", titel: "4–6 Wochen", standard: true, text: "Ausführung ca. 4–6 Wochen nach Auftragserteilung und Freigabe der Fertigungsunterlagen." },
    { kategorie: "Montagebedingungen", titel: "Standard-Montage", standard: false, text: "Die Montage erfolgt an einem zusammenhängenden Termin. Ein ebener, freier Zugang zur Montagestelle wird vorausgesetzt." },
    { kategorie: "Bauseitige Leistungen", titel: "Bauseits", standard: false, text: "Bauseits: tragfähiger Untergrund, Strom- und Wasseranschluss, freier Zugang, Entsorgung von Verpackungsmaterial." },
    { kategorie: "Gewährleistung", titel: "Gesetzlich", standard: true, text: "Es gilt die gesetzliche Gewährleistung. Auf Korrosionsschutz gewähren wir bei bestimmungsgemäßer Nutzung 5 Jahre." },
    { kategorie: "Ausschlüsse", titel: "Nicht enthalten", standard: false, text: "Nicht enthalten: Elektroarbeiten, Mauer- und Stemmarbeiten, behördliche Bewilligungen, statische Nachweise Dritter." },
    { kategorie: "Schlussformel", titel: "Standard-Schluss", standard: true, text: "Wir freuen uns auf Ihren Auftrag und stehen für Rückfragen jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen" },
    { kategorie: "Datenschutz", titel: "DSGVO-Hinweis", standard: false, text: "Ihre Daten werden ausschließlich zur Angebots- und Auftragsabwicklung verwendet (DSGVO)." }
  ];

  var DEFAULT_VORLAGE = {
    id: "vorlage-standard", name: "Standard", akzentfarbe: "#f5a623", schrift: "Helvetica, Arial, sans-serif",
    seitenzahlen: true, seiteXvonY: true, fusszeile: "", zeigeBank: true, zeigeUid: true, standard: true
  };

  // ---- Beispielangebote aus freigegebenen Kalkulationen -----
  function beispielAngebote(ctx) {
    var Kalk = ctx.Kalkulation;
    var std = {};
    SEED_TEXTBAUSTEINE.forEach(function (t) { if (t.standard) std[t.kategorie] = t.text; });
    var kalks = (ctx.kalkulationen || []).filter(function (k) { return k.status === "freigegeben"; });
    var list = [];
    kalks.slice(0, 2).forEach(function (k, i) {
      var pos = ausKalkulation(k, Kalk, i === 0 ? "detail" : "zusammen");
      // Beim Geländer eine optionale Montage-Alternative ergänzen
      if (i === 0) pos.push({ nummer: String(pos.length + 1), typ: "optional", kurz: "Optionale Wartung (jährlich)", beschreibung: "Jährliche Sicht- und Funktionsprüfung inkl. Nachjustierung", menge: 1, einheit: "Pausch.", einzelpreis: 180, mwstProz: 20, aktiv: true, aktiviert: false });
      list.push({
        id: ctx.uid(), nummer: "AN-" + (ctx.jahr || 2026) + "-" + ("000" + (i + 1)).slice(-4),
        bezeichnung: k.bezeichnung, kundeId: k.kundeId, projektId: k.projektId, kommission: k.kommission,
        ansprechpartner: "", lieferadresse: "", kalkId: k.id, kalkVersion: k.version,
        betreff: k.bezeichnung, einleitung: std["Einleitung"] || "", positionen: pos,
        rabattProz: 0, mwstProz: 20, zahlungsbedingungen: std["Zahlungsbedingungen"] || "", lieferbedingungen: std["Lieferbedingungen"] || "",
        ausfuehrungszeitraum: std["Ausführungszeit"] || "", voraussetzungen: "", ausschluesse: "", schlusstext: std["Schlussformel"] || "",
        vorlageId: "vorlage-standard", status: i === 0 ? "freigegeben" : "Entwurf", version: 1, beispiel: true,
        gueltigTage: 30, erstellt: ctx.nowISO(), geaendert: ctx.nowISO(), ersteller: "admin",
        statusVerlauf: [{ datum: ctx.nowISO(), von: "", zu: (i === 0 ? "freigegeben" : "Entwurf"), benutzer: "admin", notiz: "Beispielangebot angelegt" }]
      });
    });
    return list;
  }

  w.Preisschmiede = w.Preisschmiede || {};
  w.Preisschmiede.Angebot = {
    POSTYPEN: POSTYPEN, num: num, r2: r2,
    SEED_TEXTBAUSTEINE: SEED_TEXTBAUSTEINE, DEFAULT_VORLAGE: DEFAULT_VORLAGE, beispielAngebote: beispielAngebote,
    posSumme: posSumme, naechsteNummer: naechsteNummer, summen: summen,
    platzhalterWerte: platzhalterWerte, ersetze: ersetze, offenePlatzhalter: offenePlatzhalter,
    kundenAusgabe: kundenAusgabe, enthaeltInterne: enthaeltInterne, dateiname: dateiname,
    ausKalkulation: ausKalkulation, VERBOTEN: VERBOTEN
  };
})(typeof self !== "undefined" ? self : this);
