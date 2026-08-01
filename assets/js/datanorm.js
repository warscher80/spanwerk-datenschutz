/* ============================================================
   Preisschmiede – DATANORM-Import (Material-/Preisdaten)
   Liest DATANORM-4.0-Dateien (Stahlhandel, z. B. Frankstahl) und
   gibt eine Artikelliste zur Übernahme in die Materialdatenbank zurück.
   Läuft rein im Browser (PC-App & Handy gleichermaßen) – komplett offline.

   Satzarten (Semikolon-getrennt):
     V  Vorlaufsatz   – Datum, Info, Währung
     A  Artikelsatz   – Nummer, Kurztext, Preiskennzeichen, Preiseinheit,
                        Mengeneinheit, Preis, Rabatt-/Warengruppe
     B  Dimensionssatz – Zusatzinfos (Langtext, ggf. Gewicht/EAN)
     P  Preissatz      – kundenspezifischer Preis (überschreibt A-Preis)
   Hinweis: Feldpositionen können je Lieferant minimal abweichen – die
   Vorschau im Import zeigt die erkannten Werte, bevor etwas übernommen wird.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Preisschmiede = root.Preisschmiede || {};
  root.Preisschmiede.Datanorm = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Preiseinheit-Schlüssel → Stückzahl, auf die sich der Preis bezieht.
  // (1 = je 1, 2 = je 10, 3 = je 100, 4 = je 1000)
  function preisEinheitFaktor(kz) {
    switch (String(kz).trim()) {
      case "2": return 10;
      case "3": return 100;
      case "4": return 1000;
      default:  return 1;
    }
  }

  // Mengeneinheit: moderne Dateien liefern Klartext ("m", "Stk", "kg").
  // Bekannte Zahl-Codes werden gemappt, alles andere bleibt unverändert.
  function mengeneinheit(code) {
    var s = String(code == null ? "" : code).trim();
    if (!s) return "Stk";
    var map = { "1": "Stk", "2": "m", "3": "m²", "4": "kg", "5": "l", "6": "m³", "7": "t", "8": "h", "9": "Pak" };
    return map[s] || s;
  }

  // DATANORM-Preise sind i. d. R. ganzzahlig (ohne Trennzeichen); die
  // letzten Stellen sind Nachkommastellen. Enthält das Feld ein Komma/
  // Punkt (CSV-Export), wird es direkt als Dezimalzahl interpretiert.
  function parsePreis(raw, nachkomma) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return 0;
    var neg = /^-/.test(s);
    s = s.replace(/^[-+]/, "");
    if (/[.,]/.test(s)) {
      var hatK = s.indexOf(",") >= 0, hatP = s.indexOf(".") >= 0, v;
      if (hatK && hatP) {
        // letztes Trennzeichen ist der Dezimalpunkt, das andere Tausender
        v = (s.lastIndexOf(",") > s.lastIndexOf("."))
          ? parseFloat(s.replace(/\./g, "").replace(",", "."))
          : parseFloat(s.replace(/,/g, ""));
      } else if (hatK) {
        v = parseFloat(s.replace(",", "."));
      } else {
        v = parseFloat(s);
      }
      v = isFinite(v) ? v : 0;
      return neg ? -v : v;
    }
    var digits = s.replace(/[^0-9]/g, "");
    if (!digits) return 0;
    var n = parseInt(digits, 10) / Math.pow(10, nachkomma);
    return neg ? -n : n;
  }

  function feld(arr, i) { return (arr[i] == null ? "" : String(arr[i])).trim(); }

  // Heuristische Gewichtssuche im B-Satz: ein plausibles kg-Feld
  // (0 < Wert < 100000, mit Nachkommaanteil) – EAN/Mengen werden so
  // weitgehend ausgeschlossen. Im Zweifel bleibt das Gewicht leer.
  function findeGewicht(f) {
    for (var i = 4; i < f.length; i++) {
      var s = feld(f, i);
      if (!/^\d{1,7}([.,]\d{1,3})$/.test(s)) continue; // nur Werte MIT Dezimalstelle
      var v = parseFloat(s.replace(",", "."));
      if (isFinite(v) && v > 0 && v < 100000) return v;
    }
    return null;
  }

  function parse(text, opts) {
    opts = opts || {};
    var nachkomma = opts.nachkomma != null ? opts.nachkomma : 2;
    var lesegewicht = opts.gewicht !== false; // Gewicht aus B-Satz versuchen
    var lines = String(text || "").split(/\r\n|\r|\n/);
    var artikel = {}, reihenfolge = [];
    var info = { waehrung: "EUR", datum: "", text: "", saetze: { V: 0, A: 0, B: 0, P: 0 }, zeilen: lines.length };

    function get(nr) {
      if (!artikel[nr]) { artikel[nr] = { artikelnummer: nr, name: "", einheit: "", preis: 0, kg: null, warengruppe: "", loeschen: false }; reihenfolge.push(nr); }
      return artikel[nr];
    }

    lines.forEach(function (line) {
      if (!line) return;
      var kz = line.charAt(0).toUpperCase();
      if (kz !== "V" && kz !== "A" && kz !== "B" && kz !== "P") return;
      var f = line.split(";");
      info.saetze[kz] = (info.saetze[kz] || 0) + 1;

      if (kz === "V") {
        info.datum = feld(f, 1) || info.datum;
        info.text = feld(f, 2) || info.text;
        var w = feld(f, 3); if (w) info.waehrung = w;
        return;
      }
      var verarb = feld(f, 1).toUpperCase();
      var nr = feld(f, 2);
      if (!nr) return;

      if (kz === "A") {
        var a = get(nr);
        if (verarb === "L") { a.loeschen = true; return; }
        var k1 = feld(f, 4), k2 = feld(f, 5);
        var name = (k1 + " " + k2).replace(/\s+/g, " ").trim();
        if (name) a.name = name;
        var faktor = preisEinheitFaktor(feld(f, 7));
        a.einheit = mengeneinheit(feld(f, 8));
        a.preisKz = feld(f, 6);
        a.preis = parsePreis(feld(f, 9), nachkomma) / faktor;
        a.warengruppe = feld(f, 11) || a.warengruppe;
      } else if (kz === "B") {
        var b = get(nr);
        if (lesegewicht && b.kg == null) { var g = findeGewicht(f); if (g != null) b.kg = g; }
      } else if (kz === "P") {
        // kundenspezifischer Preis – Format: P;KZ;Nr;Preiskennzeichen;Preis;...
        var p = get(nr);
        var pr = parsePreis(feld(f, 4), nachkomma);
        if (pr > 0) p.preis = pr;
      }
    });

    var liste = reihenfolge.map(function (nr) { return artikel[nr]; })
      .filter(function (a) { return !a.loeschen && a.name; });
    return { artikel: liste, info: info };
  }

  return { parse: parse, parsePreis: parsePreis, mengeneinheit: mengeneinheit, preisEinheitFaktor: preisEinheitFaktor };
});
