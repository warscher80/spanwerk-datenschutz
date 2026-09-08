/* mast-modell.js — die Stammdaten eines Mastes.

   Bis 0.23.0 nahm die Ablage jeden Beutel an, der ihr gereicht wurde: Jedes
   Feld wurde gespeichert, wie es kam. Ein Tippfehler im Feldnamen legte ein
   totes Feld an, das nie wieder jemand sah, und eine Höhe „ca. 60" stand als
   Zahl da, obwohl sie keine ist. Genau diese Offenheit hat schon die
   Spanntabellen gekostet.

   Deshalb hier: eine feste Liste der Felder, eine Prüfung, und ein Bericht
   über das, was nicht durchgeht. Erfunden wird nichts — was niemand
   eingetragen hat, bleibt leer.

   Reines Rechenmodul ohne DOM, damit es unter node geprüft werden kann. */
var SpieMast = (function () {
  'use strict';

  var VERSION = 1;
  var MAX_TEXT = 120, MAX_LANG = 2000;

  /* Die Stammdaten. „mass" heißt: eine Zahl mit Einheit, sonst nichts. */
  var FELDER = [
    { id: 'typ',       name: 'Masttyp',    art: 'text', platzhalter: 'z. B. Tonne, Donau' },
    { id: 'abschnitt', name: 'Abschnitt',  art: 'text', platzhalter: 'z. B. Abschnitt 2' },
    { id: 'projekt',   name: 'Projekt',    art: 'text', platzhalter: 'z. B. Blatzheim' },
    /* NICHT „hoehe": Dieses Feld ist seit der Lkw-Zufahrt vergeben und
       bedeutet die maximale DURCHFAHRTSHÖHE. Eine Masthöhe von 62,5 m stünde
       dort als Beschränkung „max. 62,5 m" — Unsinn, und im Zweifel
       gefährlicher Unsinn. Die Masthöhe heißt deshalb masthoehe. */
    { id: 'masthoehe', name: 'Masthöhe',   art: 'mass', einheit: 'm', platzhalter: 'z. B. 62,5' },
    { id: 'status',    name: 'Status',     art: 'text', platzhalter: 'z. B. Gründung fertig' },
    { id: 'bemerkung', name: 'Bemerkung',  art: 'lang' }
  ];

  /* Die Zufahrtsangaben gehören fachlich zum Mast oder zur Zuwegung und haben
     ihre eigene Auswertung. Sie stehen hier nur, damit die Prüfung sie als
     bekannt durchlässt statt sie zu verwerfen. */
  var ZUFAHRT = ['zufahrt', 'hoehe', 'gewicht', 'breite', 'zufahrtHinweis'];

  /* Felder, die die App selbst setzt. */
  var EIGENE = ['baustelle', 'mastSchluessel', 'geaendert', 'kennung', 'name', 'art'];

  function text(v) { return v == null ? '' : String(v).trim(); }

  function feld(id) {
    for (var i = 0; i < FELDER.length; i++) if (FELDER[i].id === id) return FELDER[i];
    return null;
  }

  /* „62,5" und „62.5" sind dieselbe Zahl. „ca. 60", „—" und "" sind keine —
     und werden auch nicht dazu gemacht. */
  function zahl(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var t = text(v).replace(',', '.');
    if (!t) return null;
    if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
    var n = parseFloat(t);
    return isFinite(n) ? n : null;
  }

  /* Eine Höhe zum Anzeigen: „62,5 m". Ohne Wert kommt nichts zurück, kein
     Nullwert und kein Strich — die Anzeige entscheidet selbst, was sie an
     leerer Stelle schreibt. */
  function masse(v, einheit) {
    var n = zahl(v);
    if (n === null) return '';
    return String(n).replace('.', ',') + (einheit ? ' ' + einheit : '');
  }

  /* Prüft einen Satz Stammdaten.

     Zurück kommen die geprüften Werte UND die Meldungen zu allem, was nicht
     durchging. Nichts wird stillschweigend geschluckt: Ein verworfenes Feld
     ohne Meldung ist derselbe Fehler wie eine verlorene Spanntabelle. */
  function pruefen(daten) {
    var werte = {}, meldungen = [];
    var d = daten || {};

    FELDER.forEach(function (f) {
      var roh = d[f.id];
      if (roh === undefined || roh === null) return;
      if (f.art === 'mass') {
        var t = text(roh);
        if (!t) return;
        var n = zahl(t);
        if (n === null) {
          meldungen.push(f.name + ': „' + t + '" ist keine Zahl — nicht gespeichert');
          return;
        }
        if (n < 0) {
          meldungen.push(f.name + ': ' + t + ' ist negativ — nicht gespeichert');
          return;
        }
        werte[f.id] = n;
        return;
      }
      var s = text(roh);
      if (!s) return;
      var grenze = f.art === 'lang' ? MAX_LANG : MAX_TEXT;
      if (s.length > grenze) {
        meldungen.push(f.name + ': gekürzt auf ' + grenze + ' Zeichen');
        s = s.slice(0, grenze);
      }
      werte[f.id] = s;
    });

    // Zufahrt und eigene Felder unverändert durchreichen.
    ZUFAHRT.concat(EIGENE).forEach(function (id) {
      if (d[id] !== undefined) werte[id] = d[id];
    });

    // Alles, was hier niemand kennt: melden statt speichern.
    Object.keys(d).forEach(function (id) {
      if (feld(id) || ZUFAHRT.indexOf(id) >= 0 || EIGENE.indexOf(id) >= 0) return;
      meldungen.push('Unbekanntes Feld „' + id + '" — nicht gespeichert');
    });

    return { ok: meldungen.length === 0, werte: werte, meldungen: meldungen };
  }

  return {
    VERSION: VERSION,
    FELDER: FELDER,
    feld: feld,
    zahl: zahl,
    masse: masse,
    pruefen: pruefen
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpieMast;
