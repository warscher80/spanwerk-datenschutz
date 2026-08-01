/* ============================================================
   Preisschmiede – Qualitätsmanagement-Kern (Phase 16A)
   Reine, testbare QM-Logik (ohne UI, ohne Netzwerk): Qualitäts-
   stammdaten, versionierte Prüfpläne mit unveränderbarem Snapshot,
   Prüfschritte/Merkmaltypen, zentrale Toleranzprüfung, Prüfaufträge,
   Wareneingangsprüfung (über den Lagerkern), Abweichungen, Sperrung
   mit Auswirkungsanalyse, Nacharbeit, Ausschuss, Sonderfreigabe,
   Ursachenanalyse, Korrekturmaßnahmen, Kunden-/Lieferanten-
   reklamationen, Qualitätskosten, Prüfmittel/Kalibrierung, Audit
   und Offline-Übernahme über die Phase-14-Queue.

   EHRLICH / GRENZEN:
   - KEINE Normkonformität und KEINE Zertifizierung wird behauptet.
     Normen/Prüfvorschriften sind ausschließlich konfigurierbare
     Freitext-Referenzen – nichts ist fest im Code hinterlegt.
   - KEINE automatische Schuldzuweisung: Ursachen werden als
     Kandidaten gesammelt; die bestätigte Ursache ist getrennt und
     muss ausdrücklich gesetzt werden (Standard „ungeklärt").
   - KEINE automatische Sonderfreigabe, keine automatische Bewertung
     einer Reklamation als berechtigt/unberechtigt, keine automatische
     Kostenweitergabe.
   - KEINE qualifizierte elektronische Signatur – nur ein einfaches,
     nachvollziehbares Audit-Protokoll.
   - Bestände laufen ausschließlich über den Phase-15A-Lagerkern
     (keine zweite Bestandslogik).
   ============================================================ */
(function (w) {
  "use strict";
  w.Preisschmiede = w.Preisschmiede || {};

  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
  function istZahl(x) { if (x === null || x === undefined || x === "") return false; return isFinite(parseFloat(x)); }
  function r2(x) { if (!isFinite(x)) return 0; var s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 100 + 1e-6) / 100; }
  function r3(x) { if (!isFinite(x)) return 0; var s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 1000 + 1e-6) / 1000; }
  var EPS = 1e-9;

  var _c = 0;
  function hashStr(s) { var h = 0x811c9dc5 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  function uid(seed) { _c = (_c + 1) % 1e6; return "qm-" + (seed != null ? String(seed) + "-" : "") + Math.abs(hashStr(String(seed) + "|" + _c)).toString(36); }
  function idempotenzKey() { return Array.prototype.slice.call(arguments).map(function (x) { return String(x == null ? "" : x); }).join("::"); }
  function jetzt(iso) { return iso || (w.Preisschmiede.Store ? w.Preisschmiede.Store.nowISO() : new Date().toISOString()); }
  function kopie(o) { return JSON.parse(JSON.stringify(o)); }

  // ============================================================
  //  KONSTANTEN (Statuswerte – KEINE Normen, keine Prüfvorschriften)
  // ============================================================
  var PRUEFZEITPUNKT = ["Wareneingang", "vor Fertigungsbeginn", "nach Zuschnitt", "nach Bohren", "nach Kanten", "nach Schweißen", "nach Schleifen", "nach Oberflächenbehandlung", "vor Verpackung", "vor Lieferung", "auf Baustelle", "nach Montage", "Endabnahme"];
  var MERKMAL_TYP = ["jaNein", "bestanden", "zahl", "mass", "winkel", "gewicht", "stueckzahl", "sicht", "text", "auswahl", "foto", "dokument", "bestaetigung", "seriennummer", "chargennummer"];
  var TOLERANZ_ERGEBNIS = { INNERHALB: "innerhalb Toleranz", AUSSERHALB: "außerhalb Toleranz", NACHPRUEFUNG: "Nachprüfung erforderlich", NICHT_BEWERTBAR: "nicht bewertbar" };
  var PA_STATUS = { GEPLANT: "geplant", BEREIT: "bereit", IN_PRUEFUNG: "in Prüfung", BESTANDEN: "bestanden", MIT_ABWEICHUNG: "mit Abweichung bestanden", NICHT_BESTANDEN: "nicht bestanden", GESPERRT: "gesperrt", NACHPRUEFUNG: "Nachprüfung", ABGESCHLOSSEN: "abgeschlossen" };
  var ABW_STATUS = { NEU: "neu", GESPERRT: "gesperrt", IN_PRUEFUNG: "in Prüfung", NACHARBEIT: "Nacharbeit", SF_BEANTRAGT: "Sonderfreigabe beantragt", SF_ERTEILT: "Sonderfreigabe erteilt", AUSSCHUSS: "Ausschuss", LIEF_REKLAMATION: "Lieferantenreklamation", ABGESCHLOSSEN: "abgeschlossen" };
  var SPERR_OBJEKT = ["Bauteil", "Materialcharge", "Arbeitsgang", "Auftragsteil", "Lieferung", "Montagefreigabe"];
  var URSACHE_HERKUNFT = ["intern", "Lieferant", "Kunde", "konstruktive Änderung", "ungeklärt"];
  var URSACHE_KATEGORIE = ["Mensch", "Maschine", "Material", "Methode", "Umgebung", "Messung"];
  var MASSNAHME_STATUS = { GEPLANT: "geplant", FREIGEGEBEN: "freigegeben", UMSETZUNG: "in Umsetzung", UMGESETZT: "umgesetzt", WIRKSAMKEIT: "Wirksamkeit prüfen", WIRKSAM: "wirksam", NICHT_WIRKSAM: "nicht wirksam", ABGESCHLOSSEN: "abgeschlossen" };
  var REKL_STATUS = { NEU: "neu", BESTAETIGT: "bestätigt", IN_PRUEFUNG: "in Prüfung", RUECKFRAGE: "Rückfrage", NACHARBEIT: "Nacharbeit", ERSATZ: "Ersatzlieferung", GUTSCHRIFT: "Gutschrift vorgesehen", ABGELEHNT: "abgelehnt", ABGESCHLOSSEN: "abgeschlossen" };
  var LREKL_STATUS = { NEU: "neu", GEMELDET: "gemeldet", ANTWORT_OFFEN: "Antwort offen", ERSATZ: "Ersatzlieferung", GUTSCHRIFT: "Gutschrift", ABGESCHLOSSEN: "abgeschlossen" };
  var PM_STATUS = { VERFUEGBAR: "verfügbar", IN_VERWENDUNG: "in Verwendung", KALIBRIERUNG_FAELLIG: "Kalibrierung fällig", GESPERRT: "gesperrt", DEFEKT: "defekt", AUSSER_BETRIEB: "außer Betrieb" };
  var KOSTENART = ["Material", "Arbeitszeit", "Maschinenzeit", "Nacharbeit", "Montage", "Fahrt", "Fremdleistung", "Ersatzlieferung", "Entsorgung", "Gutschrift", "sonstige"];
  var FREIGABE_STATUS = { ENTWURF: "Entwurf", ZUR_FREIGABE: "zur Freigabe", FREIGEGEBEN: "freigegeben", GESPERRT: "gesperrt", ARCHIVIERT: "archiviert" };

  // Rechtematrix Qualität (zentral geprüft)
  var QM_RECHTE = {
    admin: ["pruefplanErstellen", "pruefplanFreigeben", "pruefungDurchfuehren", "pruefungFreigeben", "abweichungAnlegen", "chargeSperren", "sperrungAufheben", "sonderfreigabe", "nacharbeitFreigeben", "reklamationBearbeiten", "qualitaetskostenSehen", "pruefmittelVerwalten", "qualitaetsberichteExportieren"],
    buero: ["pruefplanErstellen", "pruefungDurchfuehren", "pruefungFreigeben", "abweichungAnlegen", "chargeSperren", "reklamationBearbeiten", "qualitaetskostenSehen", "pruefmittelVerwalten", "qualitaetsberichteExportieren"],
    werkstatt: ["pruefungDurchfuehren", "abweichungAnlegen"]
  };
  function darf(rolle, recht) { return (QM_RECHTE[rolle] || []).indexOf(recht) >= 0; }

  // ============================================================
  //  1) QUALITÄTSSTAMMDATEN (mandantenbezogen, konfigurierbar)
  //     Alle Listen sind Vorschläge – Normen/Prüfvorschriften sind
  //     ausschließlich Freitext-Referenzen, nichts ist verbindlich.
  // ============================================================
  function standardStammdaten() {
    return {
      pruefarten: ["Wareneingangsprüfung", "Zwischenprüfung", "Endprüfung", "Erstmusterprüfung", "Abnahmeprüfung", "Wiederholprüfung"],
      pruefmerkmale: ["Maß", "Winkel", "Oberfläche", "Schweißnaht (Sicht)", "Beschichtungsdicke", "Vollständigkeit", "Kennzeichnung", "Werkstoff", "Gewicht"],
      pruefmethoden: ["Sichtprüfung", "Messschieber", "Bandmaß", "Winkelmesser", "Schichtdickenmessung", "Waage", "Lehre", "Dokumentenprüfung"],
      toleranzen: [{ key: "fein", name: "fein", ober: 0.5, unter: 0.5 }, { key: "mittel", name: "mittel", ober: 1, unter: 1 }, { key: "grob", name: "grob", ober: 2, unter: 2 }],
      fehlerarten: ["Maßabweichung", "Oberflächenfehler", "Schweißfehler (Sicht)", "Materialfehler", "Beschichtungsfehler", "Beschädigung", "Fehlteil", "Kennzeichnung fehlt", "Dokument fehlt"],
      fehlerklassen: [{ key: "kritisch", name: "kritisch", sperrt: true }, { key: "hauptfehler", name: "Hauptfehler", sperrt: true }, { key: "nebenfehler", name: "Nebenfehler", sperrt: false }],
      risikostufen: [{ key: "niedrig", name: "niedrig" }, { key: "mittel", name: "mittel" }, { key: "hoch", name: "hoch" }],
      abweichungsgruende: ["Bedienfehler", "Maschineneinstellung", "Werkzeugverschleiß", "Materialqualität", "Zeichnungsfehler", "Handhabung/Transport", "ungeklärt"],
      korrekturmassnahmen: ["Nacharbeit", "Prozessanpassung", "Schulung", "Werkzeugwechsel", "Lieferantengespräch", "Zeichnungskorrektur", "Prüfumfang erhöhen"],
      zertifikatsarten: ["Werkszeugnis 2.2", "Abnahmeprüfzeugnis 3.1", "Abnahmeprüfzeugnis 3.2", "Konformitätserklärung", "Schweißerzertifikat", "Beschichtungsnachweis"],
      reklamationsarten: ["Maßabweichung", "Oberfläche", "Beschädigung Transport", "Fehlmenge", "Falschlieferung", "Terminverzug", "Dokumentation"],
      freigabestufen: [{ key: "pruefer", name: "Prüfer", stufe: 1 }, { key: "qm", name: "Qualitätsverantwortung", stufe: 2 }, { key: "leitung", name: "Betriebsleitung", stufe: 3 }],
      // Frei konfigurierbare Referenzen (KEINE Konformitätsaussage!)
      normReferenzen: [],
      hinweis: "Normen und Prüfvorschriften sind frei konfigurierbare Referenzen. Es wird keine Normkonformität oder Zertifizierung behauptet."
    };
  }
  function stammdaten(state) { return (state && state.stammdaten) || standardStammdaten(); }

  // ============================================================
  //  19) AUDIT (jede Qualitätsaktion nachvollziehbar)
  // ============================================================
  function audit(state, daten, jetztISO) {
    var e = {
      id: uid("aud"), mandantId: daten.mandantId || null, benutzer: daten.benutzer || null,
      aktion: daten.aktion, referenzTyp: daten.referenzTyp || null, referenzId: daten.referenzId || null,
      vorher: daten.vorher !== undefined ? daten.vorher : null, nachher: daten.nachher !== undefined ? daten.nachher : null,
      grund: daten.grund || null, zeitpunkt: jetzt(jetztISO)
    };
    (state.audit || (state.audit = [])).push(e);
    return e;
  }

  // ============================================================
  //  2)+3) PRÜFPLÄNE (versioniert) UND PRÜFSCHRITTE
  // ============================================================
  function schrittNeu(daten) {
    daten = daten || {};
    return {
      nummer: daten.nummer != null ? daten.nummer : 1, bezeichnung: daten.bezeichnung || "", beschreibung: daten.beschreibung || "",
      pruefzeitpunkt: daten.pruefzeitpunkt || PRUEFZEITPUNKT[0], merkmal: daten.merkmal || null, merkmalTyp: daten.merkmalTyp || "mass",
      sollwert: daten.sollwert != null ? daten.sollwert : null, einheit: daten.einheit || null,
      obereToleranz: daten.obereToleranz != null ? num(daten.obereToleranz) : null,
      untereToleranz: daten.untereToleranz != null ? num(daten.untereToleranz) : null,
      methode: daten.methode || null, pruefmittelId: daten.pruefmittelId || null, stichprobe: daten.stichprobe != null ? num(daten.stichprobe) : 1,
      pflicht: daten.pflicht !== false, fotoErforderlich: !!daten.fotoErforderlich, dokumentErforderlich: !!daten.dokumentErforderlich,
      freigabeErforderlich: !!daten.freigabeErforderlich, rolle: daten.rolle || null, beiFehlerSperren: !!daten.beiFehlerSperren,
      auswahl: daten.auswahl || null
    };
  }
  function pruefplanNeu(state, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var pp = {
      id: uid("pp"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("PP-" + uid("n").slice(-6)),
      bezeichnung: daten.bezeichnung || "", produktgruppeKey: daten.produktgruppeKey || null, produktKey: daten.produktKey || null,
      materialId: daten.materialId || null, arbeitsgang: daten.arbeitsgang || null, maschineId: daten.maschineId || null,
      kundeId: daten.kundeId || null, version: daten.version != null ? num(daten.version) : 1,
      gueltigAb: daten.gueltigAb || jz, gueltigBis: daten.gueltigBis || null, beschreibung: daten.beschreibung || "",
      verantwortlicheRolle: daten.verantwortlicheRolle || null, freigabestatus: FREIGABE_STATUS.ENTWURF,
      // Freitext-Referenz; KEINE Konformitätsaussage
      referenz: daten.referenz || "", referenzHinweis: "Freitext-Referenz – keine Konformitätsaussage.",
      aktiv: daten.aktiv !== false, vorgaengerId: daten.vorgaengerId || null,
      schritte: (daten.schritte || []).map(schrittNeu), erstellt: jz, geaendert: jz
    };
    (state.pruefplaene || (state.pruefplaene = [])).push(pp);
    audit(state, { mandantId: pp.mandantId, benutzer: daten.benutzer, aktion: "pruefplan.neu", referenzTyp: "pruefplan", referenzId: pp.id, nachher: pp.nummer + " v" + pp.version }, jz);
    return pp;
  }
  function pruefplanById(state, id) { return (state.pruefplaene || []).filter(function (p) { return p.id === id; })[0] || null; }
  // Neue Version anlegen: Vorgänger bleibt unverändert erhalten (Historie).
  function pruefplanNeueVersion(state, planId, aenderungen, jetztISO) {
    var jz = jetzt(jetztISO);
    var alt = pruefplanById(state, planId); if (!alt) return { ok: false, grund: "Prüfplan nicht vorhanden" };
    var neu = kopie(alt);
    neu.id = uid("pp"); neu.version = num(alt.version) + 1; neu.vorgaengerId = alt.id;
    neu.freigabestatus = FREIGABE_STATUS.ENTWURF; neu.erstellt = jz; neu.geaendert = jz; neu.gueltigAb = jz;
    Object.keys(aenderungen || {}).forEach(function (k) { if (k === "schritte") neu.schritte = (aenderungen.schritte || []).map(schrittNeu); else if (["id", "version", "vorgaengerId"].indexOf(k) < 0) neu[k] = aenderungen[k]; });
    alt.gueltigBis = jz; alt.aktiv = false;
    (state.pruefplaene || (state.pruefplaene = [])).push(neu);
    audit(state, { mandantId: neu.mandantId, benutzer: (aenderungen || {}).benutzer, aktion: "pruefplan.version", referenzTyp: "pruefplan", referenzId: neu.id, vorher: "v" + alt.version, nachher: "v" + neu.version }, jz);
    return { ok: true, pruefplan: neu, vorgaenger: alt };
  }
  function pruefplanFreigeben(state, planId, benutzer, rolle, jetztISO) {
    var jz = jetzt(jetztISO);
    if (rolle && !darf(rolle, "pruefplanFreigeben")) return { ok: false, grund: "Keine Berechtigung zur Prüfplanfreigabe" };
    var pp = pruefplanById(state, planId); if (!pp) return { ok: false, grund: "Prüfplan nicht vorhanden" };
    if (!pp.schritte.length) return { ok: false, grund: "Prüfplan ohne Prüfschritte" };
    var vorher = pp.freigabestatus;
    pp.freigabestatus = FREIGABE_STATUS.FREIGEGEBEN; pp.freigegebenVon = benutzer || null; pp.freigegebenAm = jz; pp.geaendert = jz;
    audit(state, { mandantId: pp.mandantId, benutzer: benutzer, aktion: "pruefplan.freigabe", referenzTyp: "pruefplan", referenzId: pp.id, vorher: vorher, nachher: pp.freigabestatus }, jz);
    return { ok: true, pruefplan: pp };
  }
  // Unveränderbarer Snapshot für einen Auftrag – spätere Vorlagenänderungen
  // dürfen laufende/abgeschlossene Aufträge NICHT verändern (tiefe Kopie).
  function pruefplanSnapshot(state, planId, jetztISO) {
    var pp = pruefplanById(state, planId); if (!pp) return null;
    var snap = kopie(pp);
    snap.snapshotVon = pp.id; snap.snapshotAm = jetzt(jetztISO); snap.istSnapshot = true;
    delete snap.geaendert;
    return snap;
  }
  // Passenden freigegebenen Prüfplan für einen Auftrag/Arbeitsgang finden.
  function passenderPruefplan(state, kriterien) {
    kriterien = kriterien || {};
    var kand = (state.pruefplaene || []).filter(function (p) {
      if (p.freigabestatus !== FREIGABE_STATUS.FREIGEGEBEN || p.aktiv === false) return false;
      if (kriterien.mandantId != null && p.mandantId !== kriterien.mandantId) return false;
      if (p.produktgruppeKey && kriterien.produktgruppeKey && p.produktgruppeKey !== kriterien.produktgruppeKey) return false;
      if (p.arbeitsgang && kriterien.arbeitsgang && p.arbeitsgang !== kriterien.arbeitsgang) return false;
      if (p.kundeId && kriterien.kundeId && p.kundeId !== kriterien.kundeId) return false;
      return true;
    });
    // Spezifischster zuerst (Kunde > Arbeitsgang > Produktgruppe), dann höchste Version
    kand.sort(function (a, b) {
      var sa = (a.kundeId ? 4 : 0) + (a.arbeitsgang ? 2 : 0) + (a.produktgruppeKey ? 1 : 0);
      var sb = (b.kundeId ? 4 : 0) + (b.arbeitsgang ? 2 : 0) + (b.produktgruppeKey ? 1 : 0);
      return sb - sa || num(b.version) - num(a.version);
    });
    return kand[0] || null;
  }

  // ============================================================
  //  5) ZENTRALE TOLERANZPRÜFUNG (Grenzwerte eingeschlossen)
  // ============================================================
  function toleranzGrenzen(sollwert, obereToleranz, untereToleranz) {
    var soll = num(sollwert);
    var og = soll + num(obereToleranz);
    var ut = num(untereToleranz);
    var ug = soll + (ut > 0 ? -ut : ut);
    if (ug > og) { var t = ug; ug = og; og = t; }
    return { soll: soll, unten: r3(ug), oben: r3(og) };
  }
  // opts: { pruefmittelUngueltig, nachpruefungNoetig }
  function pruefeToleranz(sollwert, istwert, obereToleranz, untereToleranz, opts) {
    opts = opts || {};
    if (!istZahl(istwert) || !istZahl(sollwert)) return { ergebnis: TOLERANZ_ERGEBNIS.NICHT_BEWERTBAR, abweichung: null, grund: "Soll- oder Istwert nicht numerisch" };
    if (obereToleranz == null && untereToleranz == null) return { ergebnis: TOLERANZ_ERGEBNIS.NICHT_BEWERTBAR, abweichung: r3(num(istwert) - num(sollwert)), grund: "Keine Toleranz hinterlegt" };
    var g = toleranzGrenzen(sollwert, obereToleranz, untereToleranz);
    var ist = num(istwert);
    var abw = r3(ist - g.soll);
    // Ungültiges/abgelaufenes Prüfmittel: Messwert nicht verwertbar -> Nachprüfung
    if (opts.pruefmittelUngueltig) return { ergebnis: TOLERANZ_ERGEBNIS.NACHPRUEFUNG, abweichung: abw, grenzen: g, grund: "Prüfmittel ungültig/Kalibrierung abgelaufen" };
    if (opts.nachpruefungNoetig) return { ergebnis: TOLERANZ_ERGEBNIS.NACHPRUEFUNG, abweichung: abw, grenzen: g, grund: "Nachprüfung angefordert" };
    // Grenzwerte sind eingeschlossen (>= / <=)
    var drin = ist >= g.unten - EPS && ist <= g.oben + EPS;
    return { ergebnis: drin ? TOLERANZ_ERGEBNIS.INNERHALB : TOLERANZ_ERGEBNIS.AUSSERHALB, abweichung: abw, grenzen: g, aufGrenze: Math.abs(ist - g.unten) < EPS || Math.abs(ist - g.oben) < EPS };
  }
  // Bewertet ein einzelnes Prüfergebnis abhängig vom Merkmaltyp (zentral!).
  function bewerteSchritt(schritt, wert, opts) {
    opts = opts || {};
    var typ = schritt.merkmalTyp || "mass";
    if (["mass", "zahl", "winkel", "gewicht", "stueckzahl"].indexOf(typ) >= 0) return pruefeToleranz(schritt.sollwert, wert, schritt.obereToleranz, schritt.untereToleranz, opts);
    if (opts.pruefmittelUngueltig) return { ergebnis: TOLERANZ_ERGEBNIS.NACHPRUEFUNG, abweichung: null, grund: "Prüfmittel ungültig/Kalibrierung abgelaufen" };
    if (["jaNein", "bestanden", "sicht", "bestaetigung"].indexOf(typ) >= 0) {
      if (wert === true || wert === "ja" || wert === "bestanden" || wert === "io") return { ergebnis: TOLERANZ_ERGEBNIS.INNERHALB, abweichung: null };
      if (wert === false || wert === "nein" || wert === "nicht bestanden" || wert === "nio") return { ergebnis: TOLERANZ_ERGEBNIS.AUSSERHALB, abweichung: null };
      return { ergebnis: TOLERANZ_ERGEBNIS.NICHT_BEWERTBAR, abweichung: null, grund: "Kein eindeutiges Ergebnis" };
    }
    if (["text", "auswahl", "seriennummer", "chargennummer"].indexOf(typ) >= 0) {
      if (wert === null || wert === undefined || String(wert).trim() === "") return { ergebnis: TOLERANZ_ERGEBNIS.NICHT_BEWERTBAR, abweichung: null, grund: "Kein Wert erfasst" };
      if (typ === "auswahl" && schritt.auswahl && schritt.auswahl.length && schritt.auswahl.indexOf(wert) < 0) return { ergebnis: TOLERANZ_ERGEBNIS.AUSSERHALB, abweichung: null, grund: "Wert nicht in Auswahl" };
      return { ergebnis: TOLERANZ_ERGEBNIS.INNERHALB, abweichung: null };
    }
    if (["foto", "dokument"].indexOf(typ) >= 0) {
      return wert ? { ergebnis: TOLERANZ_ERGEBNIS.INNERHALB, abweichung: null } : { ergebnis: TOLERANZ_ERGEBNIS.NICHT_BEWERTBAR, abweichung: null, grund: "Nachweis fehlt" };
    }
    return { ergebnis: TOLERANZ_ERGEBNIS.NICHT_BEWERTBAR, abweichung: null, grund: "Unbekannter Merkmaltyp" };
  }

  // ============================================================
  //  18) PRÜFMITTEL / KALIBRIERUNG
  // ============================================================
  function pruefmittelNeu(state, daten, jetztISO) {
    var pm = {
      id: uid("pm"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("PM-" + uid("n").slice(-5)),
      bezeichnung: daten.bezeichnung || "", hersteller: daten.hersteller || null, modell: daten.modell || null,
      seriennummer: daten.seriennummer || null, messbereich: daten.messbereich || null, genauigkeit: daten.genauigkeit || null,
      standort: daten.standort || null, verantwortlicher: daten.verantwortlicher || null,
      kalibrierintervallTage: daten.kalibrierintervallTage != null ? num(daten.kalibrierintervallTage) : 365,
      letzteKalibrierung: daten.letzteKalibrierung || null, naechsteKalibrierung: daten.naechsteKalibrierung || null,
      status: daten.status || PM_STATUS.VERFUEGBAR, zertifikat: daten.zertifikat || null, erstellt: jetzt(jetztISO)
    };
    if (!pm.naechsteKalibrierung && pm.letzteKalibrierung) pm.naechsteKalibrierung = new Date(new Date(pm.letzteKalibrierung).getTime() + pm.kalibrierintervallTage * 86400000).toISOString();
    (state.pruefmittel || (state.pruefmittel = [])).push(pm);
    return pm;
  }
  function pruefmittelById(state, id) { return (state.pruefmittel || []).filter(function (p) { return p.id === id; })[0] || null; }
  // Gültigkeit zum Zeitpunkt: abgelaufene Kalibrierung -> ungültig (Warnung/Sperre).
  function pruefmittelGueltig(pm, jetztISO) {
    if (!pm) return { gueltig: false, grund: "Prüfmittel nicht vorhanden" };
    if ([PM_STATUS.GESPERRT, PM_STATUS.DEFEKT, PM_STATUS.AUSSER_BETRIEB].indexOf(pm.status) >= 0) return { gueltig: false, grund: "Prüfmittel " + pm.status };
    if (!pm.naechsteKalibrierung) return { gueltig: false, grund: "Keine Kalibrierung hinterlegt" };
    var faellig = new Date(pm.naechsteKalibrierung).getTime() < new Date(jetzt(jetztISO)).getTime();
    if (faellig) return { gueltig: false, grund: "Kalibrierung abgelaufen (" + pm.naechsteKalibrierung + ")", kalibrierungFaellig: true };
    return { gueltig: true };
  }
  // Statusfortschreibung (z. B. beim Laden): fällige Kalibrierung markieren.
  function pruefmittelStatusAktualisieren(state, jetztISO) {
    var n = 0;
    (state.pruefmittel || []).forEach(function (pm) {
      var g = pruefmittelGueltig(pm, jetztISO);
      if (g.kalibrierungFaellig && pm.status !== PM_STATUS.GESPERRT && pm.status !== PM_STATUS.DEFEKT && pm.status !== PM_STATUS.AUSSER_BETRIEB) { pm.status = PM_STATUS.KALIBRIERUNG_FAELLIG; n++; }
    });
    return n;
  }
  // Welche bereits erfassten Prüfungen wurden mit diesem Prüfmittel gemacht?
  // (Für Rückwirkung bei defektem/abgelaufenem Prüfmittel – KEINE automatische
  //  Bewertung, nur Ermittlung der betroffenen Prüfungen.)
  function betroffenePruefungen(state, pruefmittelId, abISO) {
    var ab = abISO ? new Date(abISO).getTime() : null;
    var treffer = [];
    (state.pruefauftraege || []).forEach(function (pa) {
      (pa.ergebnisse || []).forEach(function (e) {
        if (e.pruefmittelId !== pruefmittelId) return;
        if (ab && new Date(e.zeitpunkt).getTime() < ab) return;
        treffer.push({ pruefauftragId: pa.id, nummer: pa.nummer, auftragId: pa.auftragId, schrittNummer: e.schrittNummer, zeitpunkt: e.zeitpunkt, ergebnis: e.ergebnis });
      });
    });
    return treffer;
  }

  // ============================================================
  //  6) PRÜFAUFTRÄGE
  // ============================================================
  function pruefauftragNeu(state, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var snap = daten.pruefplanSnapshot || (daten.pruefplanId ? pruefplanSnapshot(state, daten.pruefplanId, jz) : null);
    if (!snap) return { ok: false, grund: "Kein Prüfplan zugeordnet" };
    if (snap.freigabestatus !== FREIGABE_STATUS.FREIGEGEBEN) return { ok: false, grund: "Prüfplan nicht freigegeben" };
    var pa = {
      id: uid("pa"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("PA-" + uid("n").slice(-6)),
      auftragId: daten.auftragId || null, kommission: daten.kommission || null, bauteil: daten.bauteil || null,
      arbeitsgang: daten.arbeitsgang || snap.arbeitsgang || null, pruefplanId: snap.snapshotVon || null,
      pruefplanVersion: snap.version, pruefplanSnapshot: snap, status: PA_STATUS.GEPLANT,
      pruefer: daten.pruefer || null, geplantesDatum: daten.geplantesDatum || null, tatsaechlichesDatum: null,
      ergebnis: null, ergebnisse: [], abweichungIds: [], dokumentIds: (daten.dokumentIds || []).slice(),
      erstellt: jz, geaendert: jz
    };
    (state.pruefauftraege || (state.pruefauftraege = [])).push(pa);
    audit(state, { mandantId: pa.mandantId, benutzer: daten.benutzer, aktion: "pruefauftrag.neu", referenzTyp: "pruefauftrag", referenzId: pa.id, nachher: pa.nummer }, jz);
    return { ok: true, pruefauftrag: pa };
  }
  // Automatisch aus einem Auftrag erzeugen, wenn ein passender Prüfplan existiert.
  function pruefauftraegeAusAuftrag(state, auftrag, kriterien, jetztISO) {
    var erzeugt = [];
    var pp = passenderPruefplan(state, Object.assign({ mandantId: (kriterien || {}).mandantId }, kriterien || {}));
    if (!pp) return erzeugt;
    var r = pruefauftragNeu(state, { mandantId: pp.mandantId, auftragId: auftrag.id, kommission: auftrag.kommission, pruefplanId: pp.id, geplantesDatum: (kriterien || {}).geplantesDatum || null, benutzer: (kriterien || {}).benutzer }, jetztISO);
    if (r.ok) erzeugt.push(r.pruefauftrag);
    return erzeugt;
  }
  function pruefauftragById(state, id) { return (state.pruefauftraege || []).filter(function (p) { return p.id === id; })[0] || null; }

  // Ein Prüfergebnis erfassen – Bewertung IMMER zentral über bewerteSchritt().
  function ergebnisErfassen(state, paId, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var pa = pruefauftragById(state, paId); if (!pa) return { ok: false, grund: "Prüfauftrag nicht vorhanden" };
    if (pa.status === PA_STATUS.ABGESCHLOSSEN) return { ok: false, grund: "Prüfauftrag abgeschlossen" };
    var schritt = (pa.pruefplanSnapshot.schritte || []).filter(function (s) { return s.nummer === daten.schrittNummer; })[0];
    if (!schritt) return { ok: false, grund: "Prüfschritt nicht im Snapshot" };
    // Prüfmittelgültigkeit zentral berücksichtigen
    var pmId = daten.pruefmittelId || schritt.pruefmittelId || null;
    var pmPruef = pmId ? pruefmittelGueltig(pruefmittelById(state, pmId), jz) : { gueltig: true };
    var bew = bewerteSchritt(schritt, daten.wert, { pruefmittelUngueltig: pmId ? !pmPruef.gueltig : false, nachpruefungNoetig: daten.nachpruefungNoetig });
    // Pflichtnachweise
    var fehlend = [];
    if (schritt.fotoErforderlich && !daten.fotoRef) fehlend.push("Foto");
    if (schritt.dokumentErforderlich && !daten.dokumentId) fehlend.push("Dokument");
    var key = daten.idempotenzKey || idempotenzKey("qm-erg", pa.id, schritt.nummer, daten.stichprobeIndex != null ? daten.stichprobeIndex : 0);
    var vorhanden = (pa.ergebnisse || []).filter(function (e) { return e.idempotenzKey === key; })[0];
    if (vorhanden) return { ok: true, ergebnisEintrag: vorhanden, neu: false, bewertung: { ergebnis: vorhanden.ergebnis } };
    var eintrag = {
      id: uid("erg"), schrittNummer: schritt.nummer, merkmalTyp: schritt.merkmalTyp, wert: daten.wert,
      sollwert: schritt.sollwert, einheit: schritt.einheit, abweichung: bew.abweichung, ergebnis: bew.ergebnis,
      grenzen: bew.grenzen || null, grund: bew.grund || null, pruefmittelId: pmId, pruefmittelGueltig: pmPruef.gueltig,
      pruefer: daten.pruefer || null, zeitpunkt: daten.zeitpunkt || jz, fotoRef: daten.fotoRef || null,
      dokumentId: daten.dokumentId || null, fehlendeNachweise: fehlend, stichprobeIndex: daten.stichprobeIndex != null ? daten.stichprobeIndex : 0,
      idempotenzKey: key, offline: !!daten.offline
    };
    (pa.ergebnisse || (pa.ergebnisse = [])).push(eintrag);
    if (pa.status === PA_STATUS.GEPLANT || pa.status === PA_STATUS.BEREIT) pa.status = PA_STATUS.IN_PRUEFUNG;
    pa.tatsaechlichesDatum = pa.tatsaechlichesDatum || eintrag.zeitpunkt;
    pa.geaendert = jz;
    audit(state, { mandantId: pa.mandantId, benutzer: daten.pruefer, aktion: "pruefung.ergebnis", referenzTyp: "pruefauftrag", referenzId: pa.id, nachher: "Schritt " + schritt.nummer + ": " + bew.ergebnis }, jz);
    return { ok: true, ergebnisEintrag: eintrag, neu: true, bewertung: bew, schritt: schritt, fehlendeNachweise: fehlend };
  }
  // Gesamtstatus aus den Einzelergebnissen ableiten (zentral, keine UI-Logik).
  function pruefauftragAuswerten(state, paId) {
    var pa = pruefauftragById(state, paId); if (!pa) return null;
    var schritte = pa.pruefplanSnapshot.schritte || [];
    var pflicht = schritte.filter(function (s) { return s.pflicht !== false; });
    var erfasst = {}; (pa.ergebnisse || []).forEach(function (e) { (erfasst[e.schrittNummer] = erfasst[e.schrittNummer] || []).push(e); });
    var offenePflicht = pflicht.filter(function (s) { return !erfasst[s.nummer] || !erfasst[s.nummer].length; });
    var alle = pa.ergebnisse || [];
    var ausserhalb = alle.filter(function (e) { return e.ergebnis === TOLERANZ_ERGEBNIS.AUSSERHALB; });
    var nachpruef = alle.filter(function (e) { return e.ergebnis === TOLERANZ_ERGEBNIS.NACHPRUEFUNG; });
    var nichtBewertbar = alle.filter(function (e) { return e.ergebnis === TOLERANZ_ERGEBNIS.NICHT_BEWERTBAR; });
    var fehlendeNachweise = alle.filter(function (e) { return (e.fehlendeNachweise || []).length; });
    var sperrend = ausserhalb.filter(function (e) { var s = schritte.filter(function (x) { return x.nummer === e.schrittNummer; })[0]; return s && s.beiFehlerSperren; });
    return {
      pruefauftragId: pa.id, offenePflichtschritte: offenePflicht.map(function (s) { return s.nummer; }),
      vollstaendig: offenePflicht.length === 0, ausserhalb: ausserhalb.length, nachpruefung: nachpruef.length,
      nichtBewertbar: nichtBewertbar.length, fehlendeNachweise: fehlendeNachweise.length, sperrend: sperrend.length,
      sperrendeSchritte: sperrend.map(function (e) { return e.schrittNummer; })
    };
  }
  // Prüfauftrag abschließen – nur mit Recht; Bewertung zentral, kein Automatismus
  // bei Sperrbedarf (dann bleibt der Auftrag „nicht bestanden"/„gesperrt").
  function pruefauftragAbschliessen(state, paId, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var pa = pruefauftragById(state, paId); if (!pa) return { ok: false, grund: "Prüfauftrag nicht vorhanden" };
    if (daten.rolle && !darf(daten.rolle, "pruefungFreigeben")) return { ok: false, grund: "Keine Berechtigung zur Prüffreigabe" };
    var a = pruefauftragAuswerten(state, paId);
    if (!a.vollstaendig) return { ok: false, grund: "Pflichtprüfung(en) offen: " + a.offenePflichtschritte.join(", "), auswertung: a };
    var vorher = pa.status;
    if (a.sperrend > 0) pa.status = PA_STATUS.GESPERRT;
    else if (a.nachpruefung > 0) pa.status = PA_STATUS.NACHPRUEFUNG;
    else if (a.ausserhalb > 0) pa.status = daten.mitAbweichungBestanden ? PA_STATUS.MIT_ABWEICHUNG : PA_STATUS.NICHT_BESTANDEN;
    else if (a.nichtBewertbar > 0 || a.fehlendeNachweise > 0) pa.status = PA_STATUS.NACHPRUEFUNG;
    else pa.status = PA_STATUS.BESTANDEN;
    pa.ergebnis = pa.status; pa.pruefer = daten.pruefer || pa.pruefer; pa.geaendert = jz;
    audit(state, { mandantId: pa.mandantId, benutzer: daten.pruefer, aktion: "pruefauftrag.abschluss", referenzTyp: "pruefauftrag", referenzId: pa.id, vorher: vorher, nachher: pa.status, grund: daten.grund || null }, jz);
    return { ok: true, pruefauftrag: pa, auswertung: a, status: pa.status };
  }

  // ============================================================
  //  7) WARENEINGANGSPRÜFUNG (über den Lagerkern – keine 2. Bestandslogik)
  // ============================================================
  // lagerState: Zustandsadapter des Phase-15A-Lagerkerns.
  // Freigabe = Entsperrung der freigegebenen Teilmenge; der Rest bleibt gesperrt.
  function wareneingangsPruefung(state, lagerState, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var Lager = w.Preisschmiede.Lager;
    if (!Lager) return { ok: false, grund: "Lagerkern nicht geladen" };
    var geliefert = num(daten.gelieferteMenge);
    var freigegeben = num(daten.freigegebeneMenge);
    var beschaedigt = num(daten.beschaedigteMenge);
    if (freigegeben < 0 || freigegeben > geliefert + EPS) return { ok: false, grund: "Freigegebene Menge unplausibel" };
    var gesperrt = r3(geliefert - freigegeben);
    var ergebnis = freigegeben >= geliefert - EPS ? "vollständig freigegeben" : (freigegeben > 0 ? "teilweise freigegeben" : "gesperrt");
    var reklamationNoetig = beschaedigt > 0 || (gesperrt > 0 && daten.lieferantenfehler === true);
    var pruefung = {
      id: uid("wep"), mandantId: daten.mandantId || null, wareneingangId: daten.wareneingangId || null,
      artikelId: daten.artikelId || null, chargeId: daten.chargeId || null, lieferantId: daten.lieferantId || null,
      gelieferteMenge: geliefert, freigegebeneMenge: freigegeben, gesperrteMenge: gesperrt, beschaedigteMenge: beschaedigt,
      pruefpunkte: {
        menge: daten.mengeOk !== false, material: daten.materialOk !== false, werkstoff: daten.werkstoffOk !== false,
        abmessung: daten.abmessungOk !== false, charge: daten.chargeOk !== false, zertifikat: daten.zertifikatOk !== false
      },
      schaeden: daten.schaeden || null, ergebnis: ergebnis, reklamationErforderlich: reklamationNoetig,
      pruefer: daten.pruefer || null, zeitpunkt: jz, bewegungIds: []
    };
    // Freigegebene Teilmenge im Lager entsperren (QS-Bestand -> verfügbar).
    if (freigegeben > 0 && daten.artikelId) {
      var bew = Lager.bewegungNeu({
        mandantId: pruefung.mandantId, typ: Lager.BEWEGUNG.ENTSPERRUNG, artikelId: daten.artikelId, menge: freigegeben,
        chargeId: daten.chargeId || null, zielLagerplatzId: daten.lagerplatzId || null, benutzer: daten.pruefer,
        zeitpunkt: jz, grund: "Wareneingangsprüfung: " + ergebnis,
        idempotenzKey: idempotenzKey("qm-wep-frei", daten.wareneingangId || "", daten.artikelId, daten.chargeId || "", freigegeben)
      }, jz);
      var p = Lager.journalPush(lagerState.bewegungen, bew);
      if (p.neu) pruefung.bewegungIds.push(p.record.id);
    }
    (state.wareneingangspruefungen || (state.wareneingangspruefungen = [])).push(pruefung);
    audit(state, { mandantId: pruefung.mandantId, benutzer: daten.pruefer, aktion: "wareneingangspruefung", referenzTyp: "wareneingang", referenzId: daten.wareneingangId, nachher: ergebnis + " (" + freigegeben + "/" + geliefert + ")" }, jz);
    return { ok: true, pruefung: pruefung, ergebnis: ergebnis, gesperrteMenge: gesperrt, reklamationErforderlich: reklamationNoetig };
  }

  // ============================================================
  //  8) ABWEICHUNGEN
  // ============================================================
  function abweichungNeu(state, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    if (daten.rolle && !darf(daten.rolle, "abweichungAnlegen")) return { ok: false, grund: "Keine Berechtigung" };
    // Doppelte Abweichung verhindern (Idempotenz, z. B. bei Offline-Sync).
    var key = daten.idempotenzKey || idempotenzKey("qm-abw", daten.mandantId, daten.auftragId || "", daten.pruefauftragId || "", daten.arbeitsgang || "", daten.fehlerart || "", daten.erkanntAm || jz);
    var vorhanden = (state.abweichungen || []).filter(function (a) { return a.idempotenzKey === key; })[0];
    if (vorhanden) return { ok: true, abweichung: vorhanden, neu: false };
    var abw = {
      id: uid("abw"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("ABW-" + uid("n").slice(-6)),
      auftragId: daten.auftragId || null, kommission: daten.kommission || null, bauteil: daten.bauteil || null,
      arbeitsgang: daten.arbeitsgang || null, artikelId: daten.artikelId || null, chargeId: daten.chargeId || null,
      maschineId: daten.maschineId || null, pruefauftragId: daten.pruefauftragId || null,
      beschreibung: daten.beschreibung || "", fehlerart: daten.fehlerart || null, fehlerklasse: daten.fehlerklasse || null,
      menge: num(daten.menge), ersteller: daten.ersteller || null, erkanntAm: daten.erkanntAm || jz,
      risikostufe: daten.risikostufe || null, sofortmassnahme: daten.sofortmassnahme || null,
      status: ABW_STATUS.NEU, dokumentIds: (daten.dokumentIds || []).slice(), fotoRefs: (daten.fotoRefs || []).slice(),
      // Ursachen: Kandidaten und bestätigte Ursache STRIKT getrennt.
      ursachenKandidaten: [], bestaetigteUrsache: null, herkunft: "ungeklärt",
      sperrIds: [], nacharbeitIds: [], massnahmeIds: [], kosten: [],
      idempotenzKey: key, erstellt: jz, geaendert: jz, historie: [{ status: ABW_STATUS.NEU, zeitpunkt: jz, benutzer: daten.ersteller || null }]
    };
    (state.abweichungen || (state.abweichungen = [])).push(abw);
    if (daten.pruefauftragId) { var pa = pruefauftragById(state, daten.pruefauftragId); if (pa && pa.abweichungIds.indexOf(abw.id) < 0) pa.abweichungIds.push(abw.id); }
    audit(state, { mandantId: abw.mandantId, benutzer: daten.ersteller, aktion: "abweichung.neu", referenzTyp: "abweichung", referenzId: abw.id, nachher: abw.nummer }, jz);
    return { ok: true, abweichung: abw, neu: true };
  }
  function abweichungById(state, id) { return (state.abweichungen || []).filter(function (a) { return a.id === id; })[0] || null; }
  // Statuswechsel IMMER mit Benutzer/Grund/Zeitpunkt – keine stillen Änderungen.
  function abweichungStatus(state, abwId, status, daten, jetztISO) {
    var jz = jetzt(jetztISO); daten = daten || {};
    var abw = abweichungById(state, abwId); if (!abw) return { ok: false, grund: "Abweichung nicht vorhanden" };
    var gueltig = false; Object.keys(ABW_STATUS).forEach(function (k) { if (ABW_STATUS[k] === status) gueltig = true; });
    if (!gueltig) return { ok: false, grund: "Unbekannter Status" };
    if (!daten.benutzer) return { ok: false, grund: "Benutzer erforderlich" };
    var vorher = abw.status;
    abw.status = status; abw.geaendert = jz;
    abw.historie.push({ status: status, zeitpunkt: jz, benutzer: daten.benutzer, grund: daten.grund || null });
    audit(state, { mandantId: abw.mandantId, benutzer: daten.benutzer, aktion: "abweichung.status", referenzTyp: "abweichung", referenzId: abw.id, vorher: vorher, nachher: status, grund: daten.grund || null }, jz);
    return { ok: true, abweichung: abw };
  }

  // ============================================================
  //  9) SPERRUNG + AUSWIRKUNGSANALYSE
  // ============================================================
  function sperreNeu(state, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    if (daten.rolle && !darf(daten.rolle, "chargeSperren")) return { ok: false, grund: "Keine Berechtigung zum Sperren" };
    if (!daten.grund) return { ok: false, grund: "Grund erforderlich" };
    if (!daten.benutzer) return { ok: false, grund: "Benutzer erforderlich" };
    if (SPERR_OBJEKT.indexOf(daten.objektTyp) < 0) return { ok: false, grund: "Unbekannter Sperrgegenstand" };
    var sp = {
      id: uid("sp"), mandantId: daten.mandantId || null, objektTyp: daten.objektTyp, objektId: daten.objektId || null,
      abweichungId: daten.abweichungId || null, grund: daten.grund, benutzer: daten.benutzer, zeitpunkt: jz,
      aktiv: true, aufgehoben: null, historie: [{ aktion: "gesperrt", benutzer: daten.benutzer, grund: daten.grund, zeitpunkt: jz }]
    };
    (state.sperren || (state.sperren = [])).push(sp);
    if (daten.abweichungId) { var abw = abweichungById(state, daten.abweichungId); if (abw) { abw.sperrIds.push(sp.id); abweichungStatus(state, abw.id, ABW_STATUS.GESPERRT, { benutzer: daten.benutzer, grund: daten.grund }, jz); } }
    audit(state, { mandantId: sp.mandantId, benutzer: daten.benutzer, aktion: "sperre.neu", referenzTyp: sp.objektTyp, referenzId: sp.objektId, nachher: "gesperrt", grund: daten.grund }, jz);
    return { ok: true, sperre: sp };
  }
  function sperreAufheben(state, sperrId, daten, jetztISO) {
    var jz = jetzt(jetztISO); daten = daten || {};
    if (daten.rolle && !darf(daten.rolle, "sperrungAufheben")) return { ok: false, grund: "Keine Berechtigung zum Aufheben" };
    if (!daten.grund) return { ok: false, grund: "Grund erforderlich" };
    if (!daten.benutzer) return { ok: false, grund: "Benutzer erforderlich" };
    var sp = (state.sperren || []).filter(function (x) { return x.id === sperrId; })[0];
    if (!sp) return { ok: false, grund: "Sperre nicht vorhanden" };
    if (!sp.aktiv) return { ok: false, grund: "Sperre bereits aufgehoben" };
    sp.aktiv = false; sp.aufgehoben = { benutzer: daten.benutzer, grund: daten.grund, zeitpunkt: jz };
    sp.historie.push({ aktion: "entsperrt", benutzer: daten.benutzer, grund: daten.grund, zeitpunkt: jz });
    audit(state, { mandantId: sp.mandantId, benutzer: daten.benutzer, aktion: "sperre.aufheben", referenzTyp: sp.objektTyp, referenzId: sp.objektId, vorher: "gesperrt", nachher: "frei", grund: daten.grund }, jz);
    return { ok: true, sperre: sp };
  }
  function istGesperrt(state, objektTyp, objektId) {
    return (state.sperren || []).some(function (s) { return s.aktiv && s.objektTyp === objektTyp && s.objektId === objektId; });
  }
  // Betroffene Reservierungen/Entnahmen/Aufträge/Kommissionen ermitteln
  // (aus dem Lagerkern – reine Ermittlung, keine automatische Bewertung).
  function betroffeneVorgaenge(state, lagerState, sperre) {
    var Lager = w.Preisschmiede.Lager;
    var res = { reservierungen: [], entnahmen: [], auftraege: [], kommissionen: [], pruefauftraege: [] };
    if (!sperre) return res;
    if (sperre.objektTyp === "Materialcharge" && lagerState && Lager) {
      res.reservierungen = (lagerState.reservierungen || []).filter(function (r) { return r.chargeId === sperre.objektId; });
      res.entnahmen = (lagerState.bewegungen || []).filter(function (b) { return b.chargeId === sperre.objektId && b.typ === Lager.BEWEGUNG.ENTNAHME; });
    } else if (sperre.objektTyp === "Auftragsteil" || sperre.objektTyp === "Bauteil") {
      res.entnahmen = ((lagerState || {}).bewegungen || []).filter(function (b) { return b.auftragId === sperre.objektId; });
    }
    var auf = {}, kom = {};
    res.reservierungen.concat(res.entnahmen).forEach(function (x) { if (x.auftragId) auf[x.auftragId] = true; if (x.kommission) kom[x.kommission] = true; });
    if (sperre.objektTyp === "Auftragsteil" || sperre.objektTyp === "Bauteil") { if (sperre.objektId) auf[sperre.objektId] = true; }
    res.auftraege = Object.keys(auf); res.kommissionen = Object.keys(kom);
    res.pruefauftraege = (state.pruefauftraege || []).filter(function (pa) { return res.auftraege.indexOf(pa.auftragId) >= 0; }).map(function (pa) { return pa.id; });
    return res;
  }

  // ============================================================
  //  10) NACHARBEIT  (Ursache nie automatisch zugewiesen)
  // ============================================================
  function nacharbeitNeu(state, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    if (daten.rolle && !darf(daten.rolle, "nacharbeitFreigeben") && daten.freigeben) return { ok: false, grund: "Keine Berechtigung zur Nacharbeitsfreigabe" };
    var herkunft = URSACHE_HERKUNFT.indexOf(daten.herkunft) >= 0 ? daten.herkunft : "ungeklärt";
    var na = {
      id: uid("na"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("NA-" + uid("n").slice(-6)),
      abweichungId: daten.abweichungId || null, ursacheText: daten.ursacheText || null, herkunft: herkunft,
      taetigkeit: daten.taetigkeit || "", mitarbeitergruppe: daten.mitarbeitergruppe || null, maschineId: daten.maschineId || null,
      materialId: daten.materialId || null, geplanteZeitStd: num(daten.geplanteZeitStd), tatsaechlicheZeitStd: num(daten.tatsaechlicheZeitStd),
      termin: daten.termin || null, ergebnis: null, nachpruefungErforderlich: daten.nachpruefungErforderlich !== false,
      nachpruefungPruefauftragId: null, freigegeben: !!daten.freigeben, freigegebenVon: daten.freigeben ? daten.benutzer : null,
      kosten: [], erstellt: jz, geaendert: jz
    };
    (state.nacharbeiten || (state.nacharbeiten = [])).push(na);
    if (daten.abweichungId) { var abw = abweichungById(state, daten.abweichungId); if (abw) { abw.nacharbeitIds.push(na.id); if (daten.benutzer) abweichungStatus(state, abw.id, ABW_STATUS.NACHARBEIT, { benutzer: daten.benutzer, grund: "Nacharbeit angelegt" }, jz); } }
    audit(state, { mandantId: na.mandantId, benutzer: daten.benutzer, aktion: "nacharbeit.neu", referenzTyp: "nacharbeit", referenzId: na.id, nachher: na.nummer + " (Herkunft " + herkunft + ")" }, jz);
    return { ok: true, nacharbeit: na };
  }
  // Nachprüfung anlegen: erzeugt einen neuen Prüfauftrag aus demselben Snapshot.
  function nachpruefungAnlegen(state, nacharbeitId, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var na = (state.nacharbeiten || []).filter(function (x) { return x.id === nacharbeitId; })[0];
    if (!na) return { ok: false, grund: "Nacharbeit nicht vorhanden" };
    var abw = na.abweichungId ? abweichungById(state, na.abweichungId) : null;
    var ursprung = abw && abw.pruefauftragId ? pruefauftragById(state, abw.pruefauftragId) : null;
    if (!ursprung) return { ok: false, grund: "Ursprünglicher Prüfauftrag nicht vorhanden" };
    var r = pruefauftragNeu(state, {
      mandantId: ursprung.mandantId, auftragId: ursprung.auftragId, kommission: ursprung.kommission,
      bauteil: ursprung.bauteil, arbeitsgang: ursprung.arbeitsgang, pruefplanSnapshot: ursprung.pruefplanSnapshot,
      pruefer: (daten || {}).pruefer, benutzer: (daten || {}).benutzer, nummer: ursprung.nummer + "-NP"
    }, jz);
    if (!r.ok) return r;
    r.pruefauftrag.status = PA_STATUS.NACHPRUEFUNG;
    r.pruefauftrag.nachpruefungVon = ursprung.id;
    na.nachpruefungPruefauftragId = r.pruefauftrag.id; na.geaendert = jz;
    audit(state, { mandantId: na.mandantId, benutzer: (daten || {}).benutzer, aktion: "nachpruefung.neu", referenzTyp: "pruefauftrag", referenzId: r.pruefauftrag.id, nachher: "Nachprüfung zu " + ursprung.nummer }, jz);
    return { ok: true, pruefauftrag: r.pruefauftrag, nacharbeit: na };
  }

  // ============================================================
  //  11) AUSSCHUSS  (wirkt über den Lagerkern auf den Bestand)
  // ============================================================
  function ausschussNeu(state, lagerState, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var Lager = w.Preisschmiede.Lager;
    var menge = num(daten.menge);
    if (menge <= 0) return { ok: false, grund: "Menge muss > 0 sein" };
    var au = {
      id: uid("aus"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("AS-" + uid("n").slice(-6)),
      abweichungId: daten.abweichungId || null, auftragId: daten.auftragId || null, bauteil: daten.bauteil || null,
      artikelId: daten.artikelId || null, chargeId: daten.chargeId || null, menge: menge,
      bearbeitungskosten: num(daten.bearbeitungskosten), maschinenkosten: num(daten.maschinenkosten), materialkosten: num(daten.materialkosten),
      grund: daten.grund || null, freigegebenVon: daten.freigegebenVon || null, entsorgung: daten.entsorgung || null,
      ersatzfertigung: !!daten.ersatzfertigung, bewegungId: null, erstellt: jz
    };
    // Bestandswirkung ausschließlich über den Lagerkern
    if (daten.artikelId && lagerState && Lager) {
      var bew = Lager.bewegungNeu({
        mandantId: au.mandantId, typ: Lager.BEWEGUNG.AUSSCHUSS, artikelId: daten.artikelId, menge: menge,
        chargeId: daten.chargeId || null, quelleLagerplatzId: daten.lagerplatzId || null, auftragId: daten.auftragId || null,
        kommission: daten.kommission || null, benutzer: daten.benutzer, zeitpunkt: jz, grund: "Ausschuss: " + (daten.grund || ""),
        idempotenzKey: idempotenzKey("qm-ausschuss", au.id)
      }, jz);
      var p = Lager.journalPush(lagerState.bewegungen, bew);
      if (p.neu) au.bewegungId = p.record.id;
    }
    (state.ausschuss || (state.ausschuss = [])).push(au);
    // Qualitätskosten getrennt erfassen
    if (au.materialkosten) kostenErfassen(state, { mandantId: au.mandantId, abweichungId: au.abweichungId, auftragId: au.auftragId, art: "Material", betrag: au.materialkosten, herkunft: "Ausschuss", benutzer: daten.benutzer }, jz);
    if (au.bearbeitungskosten) kostenErfassen(state, { mandantId: au.mandantId, abweichungId: au.abweichungId, auftragId: au.auftragId, art: "Arbeitszeit", betrag: au.bearbeitungskosten, herkunft: "Ausschuss", benutzer: daten.benutzer }, jz);
    if (au.maschinenkosten) kostenErfassen(state, { mandantId: au.mandantId, abweichungId: au.abweichungId, auftragId: au.auftragId, art: "Maschinenzeit", betrag: au.maschinenkosten, herkunft: "Ausschuss", benutzer: daten.benutzer }, jz);
    if (daten.abweichungId && daten.benutzer) abweichungStatus(state, daten.abweichungId, ABW_STATUS.AUSSCHUSS, { benutzer: daten.benutzer, grund: daten.grund || "Ausschuss gebucht" }, jz);
    audit(state, { mandantId: au.mandantId, benutzer: daten.benutzer, aktion: "ausschuss.neu", referenzTyp: "ausschuss", referenzId: au.id, nachher: au.nummer + " " + menge }, jz);
    return { ok: true, ausschuss: au };
  }

  // ============================================================
  //  12) SONDERFREIGABE  (niemals automatisch)
  // ============================================================
  function sonderfreigabeNeu(state, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    if (daten.rolle && !darf(daten.rolle, "sonderfreigabe")) return { ok: false, grund: "Keine Berechtigung für Sonderfreigaben" };
    if (!daten.freigebender) return { ok: false, grund: "Freigebende Person erforderlich" };
    if (!daten.beurteilung) return { ok: false, grund: "Technische Beurteilung erforderlich" };
    var sf = {
      id: uid("sf"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("SF-" + uid("n").slice(-6)),
      abweichungId: daten.abweichungId || null, beurteilung: daten.beurteilung, risikostufe: daten.risikostufe || null,
      freigebender: daten.freigebender, datum: daten.datum || jz, einschraenkungen: daten.einschraenkungen || null,
      kundenbestaetigungErforderlich: !!daten.kundenbestaetigungErforderlich, kundenbestaetigungAm: null,
      dokumentIds: (daten.dokumentIds || []).slice(), erstellt: jz
    };
    (state.sonderfreigaben || (state.sonderfreigaben = [])).push(sf);
    if (daten.abweichungId) abweichungStatus(state, daten.abweichungId, ABW_STATUS.SF_ERTEILT, { benutzer: daten.freigebender, grund: "Sonderfreigabe " + sf.nummer }, jz);
    audit(state, { mandantId: sf.mandantId, benutzer: daten.freigebender, aktion: "sonderfreigabe.erteilt", referenzTyp: "sonderfreigabe", referenzId: sf.id, nachher: sf.nummer, grund: daten.beurteilung }, jz);
    return { ok: true, sonderfreigabe: sf };
  }

  // ============================================================
  //  13) URSACHENANALYSE  (Kandidaten ≠ bestätigte Ursache)
  // ============================================================
  function ursacheKandidatHinzufuegen(state, abwId, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var abw = abweichungById(state, abwId); if (!abw) return { ok: false, grund: "Abweichung nicht vorhanden" };
    var k = {
      id: uid("urs"), text: daten.text || "", kategorie: URSACHE_KATEGORIE.indexOf(daten.kategorie) >= 0 ? daten.kategorie : null,
      fuenfWhy: (daten.fuenfWhy || []).slice(0, 5), benutzer: daten.benutzer || null, zeitpunkt: jz,
      bestaetigt: false, sicherheit: "Vermutung"
    };
    abw.ursachenKandidaten.push(k); abw.geaendert = jz;
    audit(state, { mandantId: abw.mandantId, benutzer: daten.benutzer, aktion: "ursache.kandidat", referenzTyp: "abweichung", referenzId: abw.id, nachher: k.text }, jz);
    return { ok: true, kandidat: k, abweichung: abw };
  }
  // Bestätigung ist immer eine ausdrückliche menschliche Entscheidung.
  function ursacheBestaetigen(state, abwId, kandidatId, daten, jetztISO) {
    var jz = jetzt(jetztISO); daten = daten || {};
    var abw = abweichungById(state, abwId); if (!abw) return { ok: false, grund: "Abweichung nicht vorhanden" };
    if (!daten.benutzer) return { ok: false, grund: "Benutzer erforderlich" };
    var k = abw.ursachenKandidaten.filter(function (x) { return x.id === kandidatId; })[0];
    if (!k) return { ok: false, grund: "Ursachenkandidat nicht vorhanden" };
    abw.ursachenKandidaten.forEach(function (x) { x.bestaetigt = false; });
    k.bestaetigt = true; k.sicherheit = "bestätigt";
    abw.bestaetigteUrsache = { kandidatId: k.id, text: k.text, kategorie: k.kategorie, bestaetigtVon: daten.benutzer, bestaetigtAm: jz };
    // Herkunft nur setzen, wenn ausdrücklich angegeben – KEINE automatische Zuweisung.
    if (URSACHE_HERKUNFT.indexOf(daten.herkunft) >= 0) abw.herkunft = daten.herkunft;
    abw.geaendert = jz;
    audit(state, { mandantId: abw.mandantId, benutzer: daten.benutzer, aktion: "ursache.bestaetigt", referenzTyp: "abweichung", referenzId: abw.id, nachher: k.text, grund: daten.grund || null }, jz);
    return { ok: true, abweichung: abw, ursache: abw.bestaetigteUrsache };
  }

  // ============================================================
  //  14) KORREKTURMASSNAHMEN
  // ============================================================
  function massnahmeNeu(state, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var m = {
      id: uid("ma"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("KM-" + uid("n").slice(-6)),
      abweichungId: daten.abweichungId || null, reklamationId: daten.reklamationId || null,
      beschreibung: daten.beschreibung || "", verantwortlicher: daten.verantwortlicher || null, frist: daten.frist || null,
      status: MASSNAHME_STATUS.GEPLANT, wirksamkeitspruefung: null, ergebnis: null,
      dokumentIds: (daten.dokumentIds || []).slice(), erstellt: jz, historie: [{ status: MASSNAHME_STATUS.GEPLANT, zeitpunkt: jz, benutzer: daten.benutzer || null }]
    };
    (state.massnahmen || (state.massnahmen = [])).push(m);
    if (daten.abweichungId) { var abw = abweichungById(state, daten.abweichungId); if (abw) abw.massnahmeIds.push(m.id); }
    audit(state, { mandantId: m.mandantId, benutzer: daten.benutzer, aktion: "massnahme.neu", referenzTyp: "massnahme", referenzId: m.id, nachher: m.nummer }, jz);
    return { ok: true, massnahme: m };
  }
  function massnahmeStatus(state, maId, status, daten, jetztISO) {
    var jz = jetzt(jetztISO); daten = daten || {};
    var m = (state.massnahmen || []).filter(function (x) { return x.id === maId; })[0];
    if (!m) return { ok: false, grund: "Maßnahme nicht vorhanden" };
    var gueltig = false; Object.keys(MASSNAHME_STATUS).forEach(function (k) { if (MASSNAHME_STATUS[k] === status) gueltig = true; });
    if (!gueltig) return { ok: false, grund: "Unbekannter Status" };
    if (!daten.benutzer) return { ok: false, grund: "Benutzer erforderlich" };
    var vorher = m.status; m.status = status;
    if (status === MASSNAHME_STATUS.WIRKSAM || status === MASSNAHME_STATUS.NICHT_WIRKSAM) {
      m.wirksamkeitspruefung = { ergebnis: status, geprueftVon: daten.benutzer, zeitpunkt: jz, bemerkung: daten.bemerkung || null };
    }
    m.historie.push({ status: status, zeitpunkt: jz, benutzer: daten.benutzer, grund: daten.grund || null });
    audit(state, { mandantId: m.mandantId, benutzer: daten.benutzer, aktion: "massnahme.status", referenzTyp: "massnahme", referenzId: m.id, vorher: vorher, nachher: status, grund: daten.grund || null }, jz);
    return { ok: true, massnahme: m };
  }

  // ============================================================
  //  15)+16) REKLAMATIONEN  (keine automatische Bewertung)
  // ============================================================
  function reklamationNeu(state, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    if (daten.rolle && !darf(daten.rolle, "reklamationBearbeiten")) return { ok: false, grund: "Keine Berechtigung" };
    var rk = {
      id: uid("rk"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("RK-" + uid("n").slice(-6)),
      kundeId: daten.kundeId || null, projektId: daten.projektId || null, kommission: daten.kommission || null,
      auftragId: daten.auftragId || null, produkt: daten.produkt || null, lieferdatum: daten.lieferdatum || null,
      meldedatum: daten.meldedatum || jz, ansprechpartner: daten.ansprechpartner || null, beschreibung: daten.beschreibung || "",
      menge: num(daten.menge), prioritaet: daten.prioritaet || "mittel", status: REKL_STATUS.NEU,
      verantwortlicher: daten.verantwortlicher || null, ursacheId: null, massnahmeIds: [], kosten: [],
      dokumentIds: (daten.dokumentIds || []).slice(),
      // Bewertung berechtigt/unberechtigt wird NIE automatisch gesetzt.
      berechtigung: "nicht bewertet", bewertetVon: null, bewertetAm: null,
      erstellt: jz, historie: [{ status: REKL_STATUS.NEU, zeitpunkt: jz, benutzer: daten.benutzer || null }]
    };
    (state.reklamationen || (state.reklamationen = [])).push(rk);
    audit(state, { mandantId: rk.mandantId, benutzer: daten.benutzer, aktion: "reklamation.neu", referenzTyp: "reklamation", referenzId: rk.id, nachher: rk.nummer }, jz);
    return { ok: true, reklamation: rk };
  }
  function reklamationStatus(state, rkId, status, daten, jetztISO) {
    var jz = jetzt(jetztISO); daten = daten || {};
    var rk = (state.reklamationen || []).filter(function (x) { return x.id === rkId; })[0];
    if (!rk) return { ok: false, grund: "Reklamation nicht vorhanden" };
    var gueltig = false; Object.keys(REKL_STATUS).forEach(function (k) { if (REKL_STATUS[k] === status) gueltig = true; });
    if (!gueltig) return { ok: false, grund: "Unbekannter Status" };
    if (!daten.benutzer) return { ok: false, grund: "Benutzer erforderlich" };
    var vorher = rk.status; rk.status = status;
    rk.historie.push({ status: status, zeitpunkt: jz, benutzer: daten.benutzer, grund: daten.grund || null });
    audit(state, { mandantId: rk.mandantId, benutzer: daten.benutzer, aktion: "reklamation.status", referenzTyp: "reklamation", referenzId: rk.id, vorher: vorher, nachher: status, grund: daten.grund || null }, jz);
    return { ok: true, reklamation: rk };
  }
  // Berechtigung ausdrücklich (menschlich) bewerten – nie automatisch.
  function reklamationBewerten(state, rkId, berechtigung, daten, jetztISO) {
    var jz = jetzt(jetztISO); daten = daten || {};
    var rk = (state.reklamationen || []).filter(function (x) { return x.id === rkId; })[0];
    if (!rk) return { ok: false, grund: "Reklamation nicht vorhanden" };
    if (["berechtigt", "teilweise berechtigt", "unberechtigt", "nicht bewertet"].indexOf(berechtigung) < 0) return { ok: false, grund: "Unbekannte Bewertung" };
    if (!daten.benutzer) return { ok: false, grund: "Benutzer erforderlich" };
    if (!daten.begruendung) return { ok: false, grund: "Begründung erforderlich" };
    var vorher = rk.berechtigung;
    rk.berechtigung = berechtigung; rk.bewertetVon = daten.benutzer; rk.bewertetAm = jz; rk.bewertungBegruendung = daten.begruendung;
    audit(state, { mandantId: rk.mandantId, benutzer: daten.benutzer, aktion: "reklamation.bewertung", referenzTyp: "reklamation", referenzId: rk.id, vorher: vorher, nachher: berechtigung, grund: daten.begruendung }, jz);
    return { ok: true, reklamation: rk };
  }
  function lieferantenReklamationNeu(state, lagerState, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    if (daten.rolle && !darf(daten.rolle, "reklamationBearbeiten")) return { ok: false, grund: "Keine Berechtigung" };
    var lr = {
      id: uid("lr"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("LR-" + uid("n").slice(-6)),
      lieferantId: daten.lieferantId || null, bestellungId: daten.bestellungId || null, wareneingangId: daten.wareneingangId || null,
      artikelId: daten.artikelId || null, chargeId: daten.chargeId || null, lieferschein: daten.lieferschein || null,
      menge: num(daten.menge), fehler: daten.fehler || null, zertifikat: daten.zertifikat || null,
      geforderteMassnahme: daten.geforderteMassnahme || null, antwort: null, ersatzlieferung: false, gutschrift: null,
      status: LREKL_STATUS.NEU, kosten: [], sperrId: null, erstellt: jz,
      historie: [{ status: LREKL_STATUS.NEU, zeitpunkt: jz, benutzer: daten.benutzer || null }]
    };
    // Betroffene Charge direkt sperrbar (mit Grund + Benutzer + Audit).
    if (daten.chargeSperren && daten.chargeId && daten.benutzer) {
      var sp = sperreNeu(state, { mandantId: lr.mandantId, objektTyp: "Materialcharge", objektId: daten.chargeId, grund: "Lieferantenreklamation " + lr.nummer + ": " + (daten.fehler || ""), benutzer: daten.benutzer, rolle: daten.rolle }, jz);
      if (sp.ok) {
        lr.sperrId = sp.sperre.id;
        var Lager = w.Preisschmiede.Lager;
        if (Lager && lagerState) { try { Lager.chargeSperren(lagerState, daten.chargeId, "QM: " + lr.nummer, jz); } catch (e) {} }
      }
    }
    (state.lieferantenReklamationen || (state.lieferantenReklamationen = [])).push(lr);
    audit(state, { mandantId: lr.mandantId, benutzer: daten.benutzer, aktion: "lieferantenreklamation.neu", referenzTyp: "lieferantenreklamation", referenzId: lr.id, nachher: lr.nummer }, jz);
    return { ok: true, lieferantenReklamation: lr };
  }

  // ============================================================
  //  17) QUALITÄTSKOSTEN  (getrennt, keine automatische Weitergabe)
  // ============================================================
  function kostenErfassen(state, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var art = KOSTENART.indexOf(daten.art) >= 0 ? daten.art : "sonstige";
    var k = {
      id: uid("qk"), mandantId: daten.mandantId || null, art: art, betrag: r2(num(daten.betrag)),
      abweichungId: daten.abweichungId || null, nacharbeitId: daten.nacharbeitId || null, reklamationId: daten.reklamationId || null,
      auftragId: daten.auftragId || null, kommission: daten.kommission || null, herkunft: daten.herkunft || null,
      // Kostenträger wird NIE automatisch zugewiesen.
      kostentraeger: daten.kostentraeger || "nicht zugewiesen", benutzer: daten.benutzer || null, zeitpunkt: jz, notiz: daten.notiz || null
    };
    (state.qualitaetskosten || (state.qualitaetskosten = [])).push(k);
    return k;
  }
  function kostenSumme(state, filter) {
    filter = filter || {};
    var proArt = {}, gesamt = 0;
    (state.qualitaetskosten || []).forEach(function (k) {
      if (filter.mandantId != null && k.mandantId !== filter.mandantId) return;
      if (filter.auftragId && k.auftragId !== filter.auftragId) return;
      if (filter.abweichungId && k.abweichungId !== filter.abweichungId) return;
      proArt[k.art] = r2(num(proArt[k.art]) + num(k.betrag)); gesamt += num(k.betrag);
    });
    return { proArt: proArt, gesamt: r2(gesamt) };
  }

  // ============================================================
  //  20) OFFLINE-ÜBERNAHME  (Phase-14-Queue; keine Auto-Freigabe)
  // ============================================================
  // Übernimmt einen offline erfassten QM-Datensatz. Bewertung erfolgt IMMER
  // zentral; offline wird nie automatisch freigegeben; doppelte Abweichungen
  // werden über den Idempotenzschlüssel verhindert; bei Konflikt bleiben die
  // lokalen Daten erhalten (Konflikt wird gespeichert, nichts gelöscht).
  function uebernehmeOffline(state, daten, jetztISO) {
    var jz = jetzt(jetztISO); daten = daten || {};
    var key = daten.idempotenzKey;
    function konflikt(grund) {
      var kf = { id: uid("qkf"), mandantId: daten.mandantId || null, grund: grund, daten: daten, status: "offen", erstellt: jz };
      (state.konflikte || (state.konflikte = [])).push(kf);
      return { ok: false, konflikt: kf, grund: grund };
    }
    if (daten.aktion === "pruefergebnis") {
      var pa = pruefauftragById(state, daten.pruefauftragId);
      if (!pa) return konflikt("Prüfauftrag nicht vorhanden");
      if (pa.status === PA_STATUS.ABGESCHLOSSEN) return konflikt("Prüfauftrag bereits abgeschlossen");
      // Prüfplan-Version muss zum Offline-Stand passen (sonst Konflikt statt still)
      if (daten.pruefplanVersion != null && num(daten.pruefplanVersion) !== num(pa.pruefplanVersion)) return konflikt("Prüfplanversion abweichend – erneute Prüfung erforderlich");
      var r = ergebnisErfassen(state, pa.id, Object.assign({}, daten, { idempotenzKey: key, offline: true }), jz);
      if (!r.ok) return konflikt(r.grund);
      return { ok: true, ergebnisEintrag: r.ergebnisEintrag, neu: r.neu, bewertung: r.bewertung };
    }
    if (daten.aktion === "abweichung") {
      var a = abweichungNeu(state, Object.assign({}, daten, { idempotenzKey: key }), jz);
      if (!a.ok) return konflikt(a.grund);
      return { ok: true, abweichung: a.abweichung, neu: a.neu };
    }
    if (daten.aktion === "freigabe") {
      // Offline darf NIEMALS automatisch freigeben.
      return konflikt("Freigabe offline nicht zulässig – Prüfung muss online bestätigt werden");
    }
    return konflikt("Unbekannte QM-Aktion");
  }

  // ============================================================
  //  16B-ERWEITERUNGEN – Aggregation, Abnahme, Berichte, Hinweise.
  //  KEINE zweite Prüf-/Toleranz-/Sperr-/Reklamationslogik: alles
  //  liest die oben definierten Kernfunktionen/Datensätze.
  // ============================================================

  // ---- Kalibrierung eintragen (fortschreibend, mit Audit) ----
  function kalibrierungNeu(state, pmId, daten, jetztISO) {
    var jz = jetzt(jetztISO); daten = daten || {};
    if (daten.rolle && !darf(daten.rolle, "pruefmittelVerwalten")) return { ok: false, grund: "Keine Berechtigung" };
    var pm = pruefmittelById(state, pmId); if (!pm) return { ok: false, grund: "Prüfmittel nicht vorhanden" };
    var vorher = pm.naechsteKalibrierung;
    pm.letzteKalibrierung = daten.datum || jz;
    pm.kalibrierintervallTage = daten.intervallTage != null ? num(daten.intervallTage) : pm.kalibrierintervallTage;
    pm.naechsteKalibrierung = new Date(new Date(pm.letzteKalibrierung).getTime() + pm.kalibrierintervallTage * 86400000).toISOString();
    if (daten.zertifikat) pm.zertifikat = daten.zertifikat;
    if (pm.status === PM_STATUS.KALIBRIERUNG_FAELLIG) pm.status = PM_STATUS.VERFUEGBAR;
    if (!Array.isArray(pm.kalibrierhistorie)) pm.kalibrierhistorie = [];
    pm.kalibrierhistorie.push({ datum: pm.letzteKalibrierung, naechste: pm.naechsteKalibrierung, zertifikat: pm.zertifikat || null, benutzer: daten.benutzer || null });
    audit(state, { mandantId: pm.mandantId, benutzer: daten.benutzer, aktion: "pruefmittel.kalibrierung", referenzTyp: "pruefmittel", referenzId: pm.id, vorher: vorher, nachher: pm.naechsteKalibrierung }, jz);
    return { ok: true, pruefmittel: pm };
  }
  // Kalibrierung läuft bald ab (Vorwarnung, Standard 30 Tage)
  function kalibrierungBaldFaellig(pm, tage, jetztISO) {
    if (!pm || !pm.naechsteKalibrierung) return false;
    var grenze = new Date(jetzt(jetztISO)).getTime() + num(tage || 30) * 86400000;
    var n = new Date(pm.naechsteKalibrierung).getTime();
    return n >= new Date(jetzt(jetztISO)).getTime() && n <= grenze;
  }

  // ---- Überfällige Prüfungen (geplantes Datum überschritten, nicht fertig) ----
  function ueberfaelligePruefungen(state, mandantId, jetztISO) {
    var jz = new Date(jetzt(jetztISO)).getTime();
    var offen = [PA_STATUS.GEPLANT, PA_STATUS.BEREIT, PA_STATUS.IN_PRUEFUNG, PA_STATUS.NACHPRUEFUNG];
    return (state.pruefauftraege || []).filter(function (pa) {
      if (mandantId != null && pa.mandantId !== mandantId) return false;
      if (offen.indexOf(pa.status) < 0) return false;
      return pa.geplantesDatum && new Date(pa.geplantesDatum).getTime() < jz;
    });
  }

  // ---- 1) QUALITÄTSDASHBOARD (aus echten Daten) ----
  // filter: {von,bis,kundeId,projektId,kommission,produktgruppeKey,maschineId,
  //          artikelId,chargeId,pruefstatus,fehlerart,verantwortlicher}
  function imZeitraum(iso, filter) {
    if (!filter || (!filter.von && !filter.bis)) return true;
    if (!iso) return false;
    var t = new Date(iso).getTime();
    if (filter.von && t < new Date(filter.von).getTime()) return false;
    if (filter.bis && t > new Date(filter.bis).getTime() + 86399999) return false;
    return true;
  }
  function paPasst(pa, filter) {
    filter = filter || {};
    if (filter.mandantId != null && pa.mandantId !== filter.mandantId) return false;
    if (filter.kommission && pa.kommission !== filter.kommission) return false;
    if (filter.auftragId && pa.auftragId !== filter.auftragId) return false;
    if (filter.pruefstatus && pa.status !== filter.pruefstatus) return false;
    if (filter.verantwortlicher && pa.pruefer !== filter.verantwortlicher) return false;
    if (filter.produktgruppeKey && (pa.pruefplanSnapshot || {}).produktgruppeKey !== filter.produktgruppeKey) return false;
    if (!imZeitraum(pa.tatsaechlichesDatum || pa.erstellt, filter)) return false;
    return true;
  }
  function abwPasst(a, filter) {
    filter = filter || {};
    if (filter.mandantId != null && a.mandantId !== filter.mandantId) return false;
    if (filter.kommission && a.kommission !== filter.kommission) return false;
    if (filter.auftragId && a.auftragId !== filter.auftragId) return false;
    if (filter.maschineId && a.maschineId !== filter.maschineId) return false;
    if (filter.artikelId && a.artikelId !== filter.artikelId) return false;
    if (filter.chargeId && a.chargeId !== filter.chargeId) return false;
    if (filter.fehlerart && a.fehlerart !== filter.fehlerart) return false;
    if (!imZeitraum(a.erkanntAm || a.erstellt, filter)) return false;
    return true;
  }
  function dashboard(state, filter, jetztISO) {
    filter = filter || {};
    var pas = (state.pruefauftraege || []).filter(function (pa) { return paPasst(pa, filter); });
    var abw = (state.abweichungen || []).filter(function (a) { return abwPasst(a, filter); });
    var offeneStatus = [PA_STATUS.GEPLANT, PA_STATUS.BEREIT, PA_STATUS.IN_PRUEFUNG];
    var bestanden = pas.filter(function (p) { return p.status === PA_STATUS.BESTANDEN || p.status === PA_STATUS.MIT_ABWEICHUNG; }).length;
    var nichtBestanden = pas.filter(function (p) { return p.status === PA_STATUS.NICHT_BESTANDEN || p.status === PA_STATUS.GESPERRT; }).length;
    var sperren = (state.sperren || []).filter(function (s) { return s.aktiv && (filter.mandantId == null || s.mandantId === filter.mandantId); });
    var nacharbeiten = (state.nacharbeiten || []).filter(function (n) { return filter.mandantId == null || n.mandantId === filter.mandantId; });
    var offeneNacharbeiten = nacharbeiten.filter(function (n) { return !n.ergebnis; });
    var nacharbeitStd = 0; nacharbeiten.forEach(function (n) { nacharbeitStd += num(n.tatsaechlicheZeitStd) || num(n.geplanteZeitStd); });
    var ausschuss = (state.ausschuss || []).filter(function (a) { return (filter.mandantId == null || a.mandantId === filter.mandantId) && imZeitraum(a.erstellt, filter); });
    var ausschussMenge = 0; ausschuss.forEach(function (a) { ausschussMenge += num(a.menge); });
    var geprueftMenge = 0; abw.forEach(function (a) { geprueftMenge += num(a.menge); });
    var basis = ausschussMenge + Math.max(geprueftMenge, pas.length);
    var pm = (state.pruefmittel || []).filter(function (p) { return filter.mandantId == null || p.mandantId === filter.mandantId; });
    var pmFaellig = pm.filter(function (p) { return !pruefmittelGueltig(p, jetztISO).gueltig; });
    var massnahmen = (state.massnahmen || []).filter(function (m) { return filter.mandantId == null || m.mandantId === filter.mandantId; });
    var offeneMassnahmen = massnahmen.filter(function (m) { return [MASSNAHME_STATUS.WIRKSAM, MASSNAHME_STATUS.ABGESCHLOSSEN].indexOf(m.status) < 0; });
    var jzT = new Date(jetzt(jetztISO)).getTime();
    return {
      offenePruefauftraege: pas.filter(function (p) { return offeneStatus.indexOf(p.status) >= 0; }).length,
      ueberfaelligePruefungen: ueberfaelligePruefungen(state, filter.mandantId, jetztISO).filter(function (p) { return paPasst(p, filter); }).length,
      bestanden: bestanden, nichtBestanden: nichtBestanden,
      offeneAbweichungen: abw.filter(function (a) { return a.status !== ABW_STATUS.ABGESCHLOSSEN; }).length,
      gesperrteBauteile: sperren.filter(function (s) { return ["Bauteil", "Auftragsteil"].indexOf(s.objektTyp) >= 0; }).length,
      gesperrteChargen: sperren.filter(function (s) { return s.objektTyp === "Materialcharge"; }).length,
      offeneNacharbeiten: offeneNacharbeiten.length,
      offeneNachpruefungen: pas.filter(function (p) { return p.status === PA_STATUS.NACHPRUEFUNG; }).length,
      ausschussMenge: r3(ausschussMenge), ausschussquoteProz: basis > 0 ? r2(ausschussMenge / basis * 100) : 0,
      nacharbeitsstunden: r2(nacharbeitStd),
      qualitaetskosten: kostenSumme(state, { mandantId: filter.mandantId, auftragId: filter.auftragId }).gesamt,
      kundenreklamationen: (state.reklamationen || []).filter(function (r) { return (filter.mandantId == null || r.mandantId === filter.mandantId) && r.status !== REKL_STATUS.ABGESCHLOSSEN && imZeitraum(r.meldedatum, filter); }).length,
      lieferantenreklamationen: (state.lieferantenReklamationen || []).filter(function (r) { return (filter.mandantId == null || r.mandantId === filter.mandantId) && r.status !== LREKL_STATUS.ABGESCHLOSSEN; }).length,
      faelligePruefmittel: pmFaellig.length,
      offeneKorrekturmassnahmen: offeneMassnahmen.length,
      ueberfaelligeMassnahmen: offeneMassnahmen.filter(function (m) { return m.frist && new Date(m.frist).getTime() < jzT; }).length,
      pruefauftraegeGesamt: pas.length
    };
  }

  // ---- 17) MONTAGE-/KUNDENABNAHME (keine qualifizierte Signatur!) ----
  function abnahmeNeu(state, daten, jetztISO) {
    var jz = jetzt(jetztISO);
    var ab = {
      id: uid("ab"), mandantId: daten.mandantId || null, nummer: daten.nummer || ("ABN-" + uid("n").slice(-6)),
      auftragId: daten.auftragId || null, kommission: daten.kommission || null, kundeId: daten.kundeId || null,
      baustelle: daten.baustelle || null, datum: daten.datum || jz,
      anwesende: (daten.anwesende || []).slice(), ausgefuehrteLeistungen: daten.ausgefuehrteLeistungen || "",
      offenePunkte: (daten.offenePunkte || []).slice(), maengel: (daten.maengel || []).slice(),
      restarbeiten: (daten.restarbeiten || []).slice(), fotoRefs: (daten.fotoRefs || []).slice(),
      nachtermin: daten.nachtermin || null, kundenkommentar: daten.kundenkommentar || "",
      // Ausdrücklich KEINE qualifizierte elektronische Signatur.
      kenntnisnahme: !!daten.kenntnisnahme, kenntnisnahmeName: daten.kenntnisnahmeName || null,
      kenntnisnahmeAm: daten.kenntnisnahme ? jz : null,
      signaturHinweis: "Bestätigung der Kenntnisnahme – KEINE qualifizierte elektronische Signatur.",
      abweichungIds: (daten.abweichungIds || []).slice(), erstellt: jz, ersteller: daten.benutzer || null,
      portalFreigegeben: false, idempotenzKey: daten.idempotenzKey || idempotenzKey("qm-abn", daten.mandantId, daten.auftragId || "", daten.datum || jz)
    };
    var vorhanden = (state.abnahmen || []).filter(function (x) { return x.idempotenzKey === ab.idempotenzKey; })[0];
    if (vorhanden) return { ok: true, abnahme: vorhanden, neu: false };
    (state.abnahmen || (state.abnahmen = [])).push(ab);
    audit(state, { mandantId: ab.mandantId, benutzer: daten.benutzer, aktion: "abnahme.neu", referenzTyp: "abnahme", referenzId: ab.id, nachher: ab.nummer }, jz);
    return { ok: true, abnahme: ab, neu: true };
  }
  // Abnahmeprotokoll-Daten (kundensicher: keine internen Kosten/Ursachen).
  function abnahmeProtokoll(state, abId) {
    var ab = (state.abnahmen || []).filter(function (x) { return x.id === abId; })[0]; if (!ab) return null;
    return {
      nummer: ab.nummer, datum: ab.datum, auftragId: ab.auftragId, kommission: ab.kommission, baustelle: ab.baustelle,
      anwesende: ab.anwesende, ausgefuehrteLeistungen: ab.ausgefuehrteLeistungen, offenePunkte: ab.offenePunkte,
      maengel: ab.maengel, restarbeiten: ab.restarbeiten, nachtermin: ab.nachtermin, kundenkommentar: ab.kundenkommentar,
      kenntnisnahme: ab.kenntnisnahme, kenntnisnahmeName: ab.kenntnisnahmeName, kenntnisnahmeAm: ab.kenntnisnahmeAm,
      signaturHinweis: ab.signaturHinweis, fotos: ab.fotoRefs.length,
      dokumentkennung: "ABN-" + String(ab.id).slice(-8).toUpperCase()
    };
  }

  // ---- 19) KUNDENPORTAL-FREIGABE (nur ausdrücklich freigegebene Belege) ----
  var PORTAL_TYPEN = ["abnahme", "pruefbericht", "materialzertifikat", "reklamationsstatus"];
  function portalFreigabe(state, daten, jetztISO) {
    var jz = jetzt(jetztISO); daten = daten || {};
    if (daten.rolle && !darf(daten.rolle, "qualitaetsberichteExportieren")) return { ok: false, grund: "Keine Berechtigung zur Portalfreigabe" };
    if (PORTAL_TYPEN.indexOf(daten.typ) < 0) return { ok: false, grund: "Unbekannter Belegtyp" };
    if (!daten.benutzer) return { ok: false, grund: "Benutzer erforderlich" };
    var f = {
      id: uid("pf"), mandantId: daten.mandantId || null, typ: daten.typ, referenzId: daten.referenzId || null,
      kundeId: daten.kundeId || null, sichtbar: daten.sichtbar !== false, freigegebenVon: daten.benutzer,
      freigegebenAm: jz, titel: daten.titel || null
    };
    (state.portalFreigaben || (state.portalFreigaben = [])).push(f);
    if (daten.typ === "abnahme") { var ab = (state.abnahmen || []).filter(function (x) { return x.id === daten.referenzId; })[0]; if (ab) ab.portalFreigegeben = f.sichtbar; }
    audit(state, { mandantId: f.mandantId, benutzer: daten.benutzer, aktion: "portal.freigabe", referenzTyp: daten.typ, referenzId: daten.referenzId, nachher: f.sichtbar ? "sichtbar" : "verborgen" }, jz);
    return { ok: true, freigabe: f };
  }
  // Kundensichtbare QM-Belege – interne Daten werden hier NIE ausgegeben.
  function portalBelege(state, kundeId) {
    return (state.portalFreigaben || []).filter(function (f) { return f.sichtbar && (kundeId == null || f.kundeId == null || f.kundeId === kundeId); }).map(function (f) {
      var titel = f.titel;
      if (!titel && f.typ === "abnahme") { var ab = (state.abnahmen || []).filter(function (x) { return x.id === f.referenzId; })[0]; titel = ab ? "Abnahmeprotokoll " + ab.nummer : "Abnahmeprotokoll"; }
      if (!titel && f.typ === "pruefbericht") { var pa = pruefauftragById(state, f.referenzId); titel = pa ? "Prüfbericht " + pa.nummer : "Prüfbericht"; }
      return { id: f.id, typ: f.typ, referenzId: f.referenzId, titel: titel || f.typ, freigegebenAm: f.freigegebenAm };
    });
  }
  // Kundensichere Ausgabe eines Prüfberichts: KEINE internen Ursachen/Kosten/
  // Mitarbeiterbewertungen, keine Lieferanteninformationen.
  function pruefberichtKundensicher(state, paId) {
    var pa = pruefauftragById(state, paId); if (!pa) return null;
    return {
      nummer: pa.nummer, auftragId: pa.auftragId, kommission: pa.kommission, bauteil: pa.bauteil,
      pruefplan: (pa.pruefplanSnapshot || {}).nummer, pruefplanVersion: pa.pruefplanVersion,
      datum: pa.tatsaechlichesDatum, status: pa.status,
      ergebnisse: (pa.ergebnisse || []).map(function (e) {
        return { schritt: e.schrittNummer, merkmal: e.merkmalTyp, sollwert: e.sollwert, istwert: e.wert, einheit: e.einheit, ergebnis: e.ergebnis };
      }),
      hinweis: "Prüfbericht ohne interne Kalkulations-, Kosten- oder Ursachendaten."
    };
  }

  // ---- 20) QUALITÄTSBERICHTE / CSV ----
  function csvEscape(v) { var s = String(v == null ? "" : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function zuCSV(headers, rows) { return [headers.join(";")].concat(rows.map(function (r) { return r.map(csvEscape).join(";"); })).join("\n"); }
  function bericht(state, art, filter) {
    filter = filter || {};
    var head, rows;
    if (art === "pruefstatus") {
      head = ["Prüfauftrag", "Auftrag", "Kommission", "Bauteil", "Arbeitsgang", "Planversion", "Prüfer", "Termin", "Status", "Abweichungen"];
      rows = (state.pruefauftraege || []).filter(function (p) { return paPasst(p, filter); }).map(function (p) {
        return [p.nummer, p.auftragId, p.kommission, p.bauteil, p.arbeitsgang, p.pruefplanVersion, p.pruefer, p.geplantesDatum, p.status, (p.abweichungIds || []).length];
      });
    } else if (art === "abweichungen") {
      head = ["Nummer", "Auftrag", "Kommission", "Bauteil", "Arbeitsgang", "Fehlerart", "Fehlerklasse", "Menge", "Risiko", "Status", "Herkunft", "erkannt"];
      rows = (state.abweichungen || []).filter(function (a) { return abwPasst(a, filter); }).map(function (a) {
        return [a.nummer, a.auftragId, a.kommission, a.bauteil, a.arbeitsgang, a.fehlerart, a.fehlerklasse, a.menge, a.risikostufe, a.status, a.herkunft, a.erkanntAm];
      });
    } else if (art === "nacharbeit") {
      head = ["Nummer", "Abweichung", "Tätigkeit", "Herkunft", "geplant (h)", "tatsächlich (h)", "Termin", "Nachprüfung", "freigegeben"];
      rows = (state.nacharbeiten || []).filter(function (n) { return filter.mandantId == null || n.mandantId === filter.mandantId; }).map(function (n) {
        return [n.nummer, n.abweichungId, n.taetigkeit, n.herkunft, n.geplanteZeitStd, n.tatsaechlicheZeitStd, n.termin, n.nachpruefungPruefauftragId ? "ja" : "nein", n.freigegeben ? "ja" : "nein"];
      });
    } else if (art === "ausschuss") {
      head = ["Nummer", "Auftrag", "Bauteil", "Menge", "Materialkosten", "Bearbeitung", "Maschine", "Grund", "Ersatzfertigung"];
      rows = (state.ausschuss || []).filter(function (a) { return filter.mandantId == null || a.mandantId === filter.mandantId; }).map(function (a) {
        return [a.nummer, a.auftragId, a.bauteil, a.menge, a.materialkosten, a.bearbeitungskosten, a.maschinenkosten, a.grund, a.ersatzfertigung ? "ja" : "nein"];
      });
    } else if (art === "reklamationen") {
      head = ["Nummer", "Kunde", "Auftrag", "Kommission", "Produkt", "Menge", "Priorität", "Status", "Bewertung", "gemeldet"];
      rows = (state.reklamationen || []).filter(function (r) { return filter.mandantId == null || r.mandantId === filter.mandantId; }).map(function (r) {
        return [r.nummer, r.kundeId, r.auftragId, r.kommission, r.produkt, r.menge, r.prioritaet, r.status, r.berechtigung, r.meldedatum];
      });
    } else if (art === "lieferantenqualitaet") {
      head = ["Nummer", "Lieferant", "Wareneingang", "Charge", "Menge", "Fehler", "geforderte Maßnahme", "Status", "Charge gesperrt"];
      rows = (state.lieferantenReklamationen || []).filter(function (r) { return filter.mandantId == null || r.mandantId === filter.mandantId; }).map(function (r) {
        return [r.nummer, r.lieferantId, r.wareneingangId, r.chargeId, r.menge, r.fehler, r.geforderteMassnahme, r.status, r.sperrId ? "ja" : "nein"];
      });
    } else if (art === "pruefmittel") {
      head = ["Nummer", "Bezeichnung", "Seriennummer", "Messbereich", "letzte Kalibrierung", "nächste Kalibrierung", "Status", "gültig"];
      rows = (state.pruefmittel || []).filter(function (p) { return filter.mandantId == null || p.mandantId === filter.mandantId; }).map(function (p) {
        return [p.nummer, p.bezeichnung, p.seriennummer, p.messbereich, p.letzteKalibrierung, p.naechsteKalibrierung, p.status, pruefmittelGueltig(p, filter.jetztISO).gueltig ? "ja" : "nein"];
      });
    } else if (art === "qualitaetskosten") {
      head = ["Kostenart", "Betrag", "Auftrag", "Abweichung", "Herkunft", "Kostenträger", "Zeitpunkt"];
      rows = (state.qualitaetskosten || []).filter(function (k) { return (filter.mandantId == null || k.mandantId === filter.mandantId) && (!filter.auftragId || k.auftragId === filter.auftragId); }).map(function (k) {
        return [k.art, k.betrag, k.auftragId, k.abweichungId, k.herkunft, k.kostentraeger, k.zeitpunkt];
      });
    } else return null;
    return { art: art, headers: head, rows: rows, csv: zuCSV(head, rows) };
  }

  // ---- 21) LERNHINWEISE (Korrelation, KEINE sichere Ursache, keine Personen) ----
  function lernhinweise(state, filter) {
    filter = filter || {};
    var abw = (state.abweichungen || []).filter(function (a) { return abwPasst(a, filter); });
    var hinweise = [];
    function vertrauen(n) { return n >= 12 ? "hoch" : n >= 6 ? "mittel" : "niedrig"; }
    function zeitraum(liste) {
      var ts = liste.map(function (x) { return new Date(x.erkanntAm || x.erstellt).getTime(); }).filter(isFinite);
      if (!ts.length) return null;
      return { von: new Date(Math.min.apply(null, ts)).toISOString(), bis: new Date(Math.max.apply(null, ts)).toISOString() };
    }
    function gruppiere(liste, keyFn) { var g = {}; liste.forEach(function (x) { var k = keyFn(x); if (k == null || k === "") return; (g[k] = g[k] || []).push(x); }); return g; }
    // Häufigste Fehlerart je Produktgruppe (über den Prüfplan-Snapshot des Prüfauftrags)
    var proGruppe = {};
    abw.forEach(function (a) {
      var pa = a.pruefauftragId ? pruefauftragById(state, a.pruefauftragId) : null;
      var g = pa && pa.pruefplanSnapshot ? pa.pruefplanSnapshot.produktgruppeKey : null;
      if (!g || !a.fehlerart) return;
      proGruppe[g] = proGruppe[g] || {}; (proGruppe[g][a.fehlerart] = proGruppe[g][a.fehlerart] || []).push(a);
    });
    Object.keys(proGruppe).forEach(function (g) {
      var arten = proGruppe[g]; var top = Object.keys(arten).sort(function (x, y) { return arten[y].length - arten[x].length; })[0];
      if (!top) return; var liste = arten[top];
      hinweise.push({ typ: "fehlerart_produktgruppe", text: "In der Produktgruppe „" + g + "\" tritt die Fehlerart „" + top + "\" am häufigsten auf.", datenmenge: liste.length, zeitraum: zeitraum(liste), vertrauen: vertrauen(liste.length), grundlage: "Abweichungen mit Prüfauftrag und Produktgruppe im Prüfplan-Snapshot", hinweis: "Korrelation, keine gesicherte Ursache." });
    });
    // Erhöhte Nacharbeit bei einer Maschine
    var proMaschine = gruppiere(abw.filter(function (a) { return (a.nacharbeitIds || []).length; }), function (a) { return a.maschineId; });
    Object.keys(proMaschine).forEach(function (m) {
      var liste = proMaschine[m];
      hinweise.push({ typ: "nacharbeit_maschine", text: "An Maschine „" + m + "\" führten " + liste.length + " Abweichung(en) zu Nacharbeit.", datenmenge: liste.length, zeitraum: zeitraum(liste), vertrauen: vertrauen(liste.length), grundlage: "Abweichungen mit verknüpfter Nacharbeit", hinweis: "Korrelation, keine gesicherte Ursache." });
    });
    // Wiederkehrende Abweichung bei einem Material/Artikel
    var proArtikel = gruppiere(abw, function (a) { return a.artikelId; });
    Object.keys(proArtikel).forEach(function (art) {
      var liste = proArtikel[art]; if (liste.length < 2) return;
      hinweise.push({ typ: "abweichung_material", text: "Beim Material „" + art + "\" wurden " + liste.length + " Abweichungen erfasst.", datenmenge: liste.length, zeitraum: zeitraum(liste), vertrauen: vertrauen(liste.length), grundlage: "Abweichungen mit Artikelbezug", hinweis: "Korrelation, keine gesicherte Ursache." });
    });
    // Häufig unterschätzte Qualitätszeit (Nacharbeit dauert länger als geplant)
    var nas = (state.nacharbeiten || []).filter(function (n) { return (filter.mandantId == null || n.mandantId === filter.mandantId) && num(n.geplanteZeitStd) > 0 && num(n.tatsaechlicheZeitStd) > 0; });
    var ueber = nas.filter(function (n) { return num(n.tatsaechlicheZeitStd) > num(n.geplanteZeitStd); });
    if (nas.length) {
      hinweise.push({ typ: "qualitaetszeit_unterschaetzt", text: ueber.length + " von " + nas.length + " Nacharbeiten dauerten länger als geplant.", datenmenge: nas.length, zeitraum: zeitraum(nas.map(function (n) { return { erstellt: n.erstellt }; })), vertrauen: vertrauen(nas.length), grundlage: "Vergleich geplanter und tatsächlicher Nacharbeitszeit", hinweis: "Korrelation, keine gesicherte Ursache." });
    }
    // Bewusst KEINE personenbezogene Auswertung / keine Mitarbeiter-Rangliste.
    return hinweise;
  }

  w.Preisschmiede.Qualitaet = {
    PRUEFZEITPUNKT: PRUEFZEITPUNKT, MERKMAL_TYP: MERKMAL_TYP, TOLERANZ_ERGEBNIS: TOLERANZ_ERGEBNIS,
    PORTAL_TYPEN: PORTAL_TYPEN,
    kalibrierungNeu: kalibrierungNeu, kalibrierungBaldFaellig: kalibrierungBaldFaellig,
    ueberfaelligePruefungen: ueberfaelligePruefungen, dashboard: dashboard,
    abnahmeNeu: abnahmeNeu, abnahmeProtokoll: abnahmeProtokoll,
    portalFreigabe: portalFreigabe, portalBelege: portalBelege, pruefberichtKundensicher: pruefberichtKundensicher,
    zuCSV: zuCSV, bericht: bericht, lernhinweise: lernhinweise,
    PA_STATUS: PA_STATUS, ABW_STATUS: ABW_STATUS, SPERR_OBJEKT: SPERR_OBJEKT,
    URSACHE_HERKUNFT: URSACHE_HERKUNFT, URSACHE_KATEGORIE: URSACHE_KATEGORIE,
    MASSNAHME_STATUS: MASSNAHME_STATUS, REKL_STATUS: REKL_STATUS, LREKL_STATUS: LREKL_STATUS,
    PM_STATUS: PM_STATUS, KOSTENART: KOSTENART, FREIGABE_STATUS: FREIGABE_STATUS, QM_RECHTE: QM_RECHTE,
    darf: darf, uid: uid, idempotenzKey: idempotenzKey, num: num, r2: r2, r3: r3,
    standardStammdaten: standardStammdaten, stammdaten: stammdaten, audit: audit,
    schrittNeu: schrittNeu, pruefplanNeu: pruefplanNeu, pruefplanById: pruefplanById,
    pruefplanNeueVersion: pruefplanNeueVersion, pruefplanFreigeben: pruefplanFreigeben,
    pruefplanSnapshot: pruefplanSnapshot, passenderPruefplan: passenderPruefplan,
    toleranzGrenzen: toleranzGrenzen, pruefeToleranz: pruefeToleranz, bewerteSchritt: bewerteSchritt,
    pruefmittelNeu: pruefmittelNeu, pruefmittelById: pruefmittelById, pruefmittelGueltig: pruefmittelGueltig,
    pruefmittelStatusAktualisieren: pruefmittelStatusAktualisieren, betroffenePruefungen: betroffenePruefungen,
    pruefauftragNeu: pruefauftragNeu, pruefauftraegeAusAuftrag: pruefauftraegeAusAuftrag, pruefauftragById: pruefauftragById,
    ergebnisErfassen: ergebnisErfassen, pruefauftragAuswerten: pruefauftragAuswerten, pruefauftragAbschliessen: pruefauftragAbschliessen,
    wareneingangsPruefung: wareneingangsPruefung,
    abweichungNeu: abweichungNeu, abweichungById: abweichungById, abweichungStatus: abweichungStatus,
    sperreNeu: sperreNeu, sperreAufheben: sperreAufheben, istGesperrt: istGesperrt, betroffeneVorgaenge: betroffeneVorgaenge,
    nacharbeitNeu: nacharbeitNeu, nachpruefungAnlegen: nachpruefungAnlegen, ausschussNeu: ausschussNeu,
    sonderfreigabeNeu: sonderfreigabeNeu,
    ursacheKandidatHinzufuegen: ursacheKandidatHinzufuegen, ursacheBestaetigen: ursacheBestaetigen,
    massnahmeNeu: massnahmeNeu, massnahmeStatus: massnahmeStatus,
    reklamationNeu: reklamationNeu, reklamationStatus: reklamationStatus, reklamationBewerten: reklamationBewerten,
    lieferantenReklamationNeu: lieferantenReklamationNeu,
    kostenErfassen: kostenErfassen, kostenSumme: kostenSumme,
    uebernehmeOffline: uebernehmeOffline
  };
})(typeof window !== "undefined" ? window : this);
