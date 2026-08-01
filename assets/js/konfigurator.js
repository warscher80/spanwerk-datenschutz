/* ============================================================
   Preisschmiede – Produktkonfigurator (Engine + Vorlagen)
   Dynamische, datenbankbasierte Konfiguratorfelder je Produktgruppe.
   Keine fest im Frontend programmierten Fragen – alles aus Daten.
   ============================================================ */
(function (w) {
  "use strict";

  // ---- Feldtypen (17) ---------------------------------------
  // input=true → speichert eine Antwort; berechnet → aus Formel; struktur → Layout
  var FELDTYPEN = {
    text:        { label: "Kurzer Text", input: true },
    textarea:    { label: "Längerer Text", input: true },
    zahl:        { label: "Zahl", input: true, numerisch: true },
    geld:        { label: "Geldbetrag", input: true, numerisch: true, einheit: "€" },
    prozent:     { label: "Prozent", input: true, numerisch: true, einheit: "%" },
    datum:       { label: "Datum", input: true },
    janein:      { label: "Ja/Nein", input: true, bool: true },
    einfach:     { label: "Einfachauswahl", input: true, optionen: true },
    mehrfach:    { label: "Mehrfachauswahl", input: true, optionen: true, multi: true },
    material:    { label: "Materialauswahl", input: true, quelle: "material" },
    maschine:    { label: "Maschinenwahl", input: true, quelle: "maschine" },
    taetigkeit:  { label: "Mitarbeitertätigkeit", input: true, quelle: "taetigkeit" },
    mass:        { label: "Maßangabe", input: true, numerisch: true },
    stueckzahl:  { label: "Stückzahl", input: true, numerisch: true },
    berechnet:   { label: "Berechnetes Feld", berechnet: true, numerisch: true },
    hinweis:     { label: "Hinweistext", struktur: true },
    ueberschrift:{ label: "Abschnittsüberschrift", struktur: true }
  };

  // Arbeitsschritte für Tätigkeit/Bearbeitung (mit calc.js abgestimmt)
  var TAETIGKEITEN = [
    "cad", "projektleitung", "arbeitsvorbereitung", "zuschnitt", "saegen", "lasern", "plasma",
    "bohren", "stanzen", "kanten", "schweissen", "schleifen", "entgraten",
    "oberflaeche", "qualitaet", "verpackung", "beladung", "montage", "fahrtzeit", "dokumentation"
  ];

  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }

  // ---- Sicherer Formel-Evaluator (nur + - * / ( ) und Feld-Keys) ----
  // Verhindert beliebige Codeausführung; nur Arithmetik über Antwortwerte.
  function evalFormel(formel, scope) {
    if (!formel) return 0;
    var s = String(formel), i = 0;
    function skip() { while (i < s.length && s[i] === " ") i++; }
    function peek() { skip(); return s[i]; }
    function parseExpr() {
      var v = parseTerm();
      while (true) { var c = peek(); if (c === "+") { i++; v += parseTerm(); } else if (c === "-") { i++; v -= parseTerm(); } else break; }
      return v;
    }
    function parseTerm() {
      var v = parseFactor();
      while (true) { var c = peek(); if (c === "*") { i++; v *= parseFactor(); } else if (c === "/") { i++; var d = parseFactor(); v = d ? v / d : 0; } else break; }
      return v;
    }
    function parseFactor() {
      skip();
      var c = s[i];
      if (c === "(") { i++; var v = parseExpr(); skip(); if (s[i] === ")") i++; return v; }
      if (c === "-") { i++; return -parseFactor(); }
      if (c === "+") { i++; return parseFactor(); }
      if (/[0-9.]/.test(c)) { var st = i; while (i < s.length && /[0-9.]/.test(s[i])) i++; return num(s.slice(st, i)); }
      if (/[a-zA-Z_]/.test(c)) { var si = i; while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) i++; var name = s.slice(si, i); return num(scope[name]); }
      i++; return 0;
    }
    try { var r = parseExpr(); return isFinite(r) ? r : 0; } catch (e) { return 0; }
  }

  // Alle Eingabefelder (rekursiv nicht nötig – flache Liste)
  function inputFelder(vorlage) {
    return (vorlage.felder || []).filter(function (f) { var t = FELDTYPEN[f.typ]; return t && (t.input || t.berechnet); });
  }

  // Sichtbarkeit eines Feldes anhand seiner Abhängigkeit (datenbankbasiert)
  function feldSichtbar(feld, antworten) {
    if (feld.aktiv === false) return false;
    var a = feld.abh;
    if (!a || !a.feld) return true;
    var wert = antworten[a.feld];
    var op = a.op || "=";
    var soll = a.wert;
    if (op === "wahr" || op === "ja") return wert === true || wert === "ja" || wert === "true" || wert === 1;
    if (op === "gesetzt") return wert != null && wert !== "" && wert !== false;
    if (op === "enthaelt") return Array.isArray(wert) ? wert.indexOf(soll) >= 0 : String(wert) === String(soll);
    if (op === "in") { var arr = Array.isArray(soll) ? soll : [soll]; return arr.map(String).indexOf(String(wert)) >= 0; }
    if (op === "!=") return String(wert) !== String(soll);
    if (op === ">") return num(wert) > num(soll);
    if (op === "<") return num(wert) < num(soll);
    return String(wert) === String(soll); // "="
  }

  // Berechnete Felder auswerten (nur sichtbare). scope enthält alle Antworten
  // plus Werkstoffdichte des gewählten Werkstoffs (dichte).
  function berechne(vorlage, antworten, settings) {
    var erg = {};
    var dichten = (settings && settings.dichten) || { Stahl: 7.85, Edelstahl: 7.90, Aluminium: 2.70 };
    var werkstoff = antworten.werkstoff || antworten.material_typ || "Stahl";
    var scope = {};
    inputFelder(vorlage).forEach(function (f) {
      var t = FELDTYPEN[f.typ];
      if (t.numerisch) scope[f.key] = num(antworten[f.key]);
    });
    scope.dichte = num(dichten[werkstoff]) || 7.85;
    // Mehrere Durchläufe, damit berechnete Felder aufeinander aufbauen können
    var berechnete = (vorlage.felder || []).filter(function (f) { return FELDTYPEN[f.typ] && FELDTYPEN[f.typ].berechnet; });
    for (var runde = 0; runde < 3; runde++) {
      berechnete.forEach(function (f) {
        if (!feldSichtbar(f, antworten)) return;
        var v = evalFormel(f.formel, scope);
        v = Math.round(v * 1000) / 1000;
        erg[f.key] = v; scope[f.key] = v;
      });
    }
    return erg;
  }

  // Pflichtfeld- und Bereichsprüfung; gibt Liste von Fehlern zurück
  function validiere(vorlage, antworten) {
    var fehler = [];
    inputFelder(vorlage).forEach(function (f) {
      if (FELDTYPEN[f.typ].berechnet) return;
      if (!feldSichtbar(f, antworten)) return;
      var v = antworten[f.key];
      var leer = v == null || v === "" || (Array.isArray(v) && !v.length);
      if (f.pflicht && leer) { fehler.push({ feld: f.key, frage: f.frage, text: '„' + f.frage + '" ist ein Pflichtfeld.' }); return; }
      if (!leer && FELDTYPEN[f.typ].numerisch) {
        var n = num(v);
        if (f.min != null && f.min !== "" && n < num(f.min)) fehler.push({ feld: f.key, frage: f.frage, text: '„' + f.frage + '" muss ≥ ' + f.min + " sein." });
        if (f.max != null && f.max !== "" && n > num(f.max)) fehler.push({ feld: f.key, frage: f.frage, text: '„' + f.frage + '" muss ≤ ' + f.max + " sein." });
      }
    });
    return fehler;
  }

  // Felder nach Abschnitten (ueberschrift) gruppieren – für Assistent-Schritte
  function abschnitte(vorlage) {
    var out = [], akt = null;
    (vorlage.felder || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }).forEach(function (f) {
      if (f.typ === "ueberschrift") { akt = { titel: f.frage, felder: [] }; out.push(akt); }
      else { if (!akt) { akt = { titel: "Allgemein", felder: [] }; out.push(akt); } akt.felder.push(f); }
    });
    return out;
  }

  // Einfrieren der Vorlage beim Speichern (Snapshot) – schützt bestehende
  // Konfigurationen vor späteren Vorlagenänderungen.
  function snapshot(vorlage) { return JSON.parse(JSON.stringify(vorlage.felder || [])); }

  w.Preisschmiede = w.Preisschmiede || {};
  w.Preisschmiede.Konfigurator = {
    FELDTYPEN: FELDTYPEN, TAETIGKEITEN: TAETIGKEITEN,
    evalFormel: evalFormel, inputFelder: inputFelder, feldSichtbar: feldSichtbar,
    berechne: berechne, validiere: validiere, abschnitte: abschnitte, snapshot: snapshot,
    num: num
  };
})(typeof self !== "undefined" ? self : this);
