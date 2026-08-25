/* daten-pruefung.js — Prüfregeln für alle Punktdaten der App.
   Läuft in node (Tests, Generator) und im Browser (Import-Vorschau).

   Grundsatz dieser Datei: Es wird nichts erfunden und nichts geraten.
   Ein Datensatz, der nicht zweifelsfrei stimmt, wird als UNGEPRÜFT
   gekennzeichnet und aus allen sicherheitskritischen Berechnungen
   herausgehalten — sichtbar bleibt er trotzdem, damit nichts still
   verschwindet. */
var SpiePruefung = (function () {
  'use strict';

  // Wie nah zwei Einträge sein müssen, um als derselbe Ort zu gelten.
  var GLEICHER_ORT_M = 10;
  // Ab diesem Abstand gilt dieselbe Mastnummer als Widerspruch.
  var WIDERSPRUCH_M = 25;

  var ART = { RP: 'rp', MAST: 'mast', KLINIK: 'klinik', LAGER: 'lager', UNBEKANNT: 'unknown' };

  var PROBLEM_TEXT = {
    'koordinaten-ungueltig': 'Koordinaten fehlen oder liegen außerhalb des gültigen Bereichs',
    'name-leer':             'Kein Name vorhanden',
    'mastnummer-fehlt':      'Keine Mastnummer — als Mast nicht verwendbar',
    'name-generisch':        'Automatisch vergebener Name ohne Bedeutung',
    'dublette':              'Doppelter Eintrag am selben Ort',
    'nummer-widerspruch':    'Dieselbe Mastnummer an unterschiedlichen Positionen',
    'art-unbekannt':         'Art des Punktes nicht bestimmbar',
    'rp-nummer-doppelt':     'Rettungspunkt-Nummer kommt mehrfach vor',
    'abseits':               'Liegt weit abseits der übrigen Punkte',
    'medizinisch-ungeprueft':'Eignung für Notfälle nicht bestätigt',
    'nicht-bestaetigt':      'Nicht gegen den Notfallplan bzw. Baustellenaushang bestätigt',
    'art-nicht-zugeordnet':  'Art beim Import nicht zugeordnet'
  };

  /* ---------- Einzelprüfungen ---------- */

  function koordinatenGueltig(lat, lon) {
    return typeof lat === 'number' && typeof lon === 'number' &&
           isFinite(lat) && isFinite(lon) &&
           lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
           !(lat === 0 && lon === 0);          // 0/0 ist praktisch immer ein Fehler
  }

  // Automatisch vergebene Namen von Kartenwerkzeugen, in mehreren Sprachen.
  // „Punkt 75", „Točka 94", „Punct 113", „Point 121", „Ponto 15" …
  var GENERISCH = /^\s*(punkt|pkt\.?|point|punct|ponto|to[čc]ka|punto|tocka)\s*\.?\s*(\d+)\s*$/i;

  function generischerName(name) {
    return GENERISCH.test(String(name || ''));
  }

  function generischeNummer(name) {
    var m = String(name || '').match(GENERISCH);
    return m ? m[2] : null;
  }

  // Echte Mastbezeichnung: Leitungsnummer / Mastnummer, z. B. 4225/0058,
  // 2409/283B, 2409/P001. Nichts anderes gilt als Mastnummer.
  var MASTNUMMER = /^\s*(\d{3,4})\s*\/\s*([A-Za-z]?\d+[A-Za-z]?)\s*$/;

  function istMastnummer(text) {
    return MASTNUMMER.test(String(text || ''));
  }

  // Mastnummer aus Name oder Kartenhinweis ziehen — ohne zu raten.
  function mastNummerVon(punkt) {
    if (istMastnummer(punkt.name)) return String(punkt.name).trim();
    var m = String(punkt.note || '').match(/Mast[_ ]?Nr\.?\s*[:.]?\s*([^·|,;\n]+)/i);
    if (m && istMastnummer(m[1])) return m[1].trim();
    return null;
  }

  // Kartenhinweise der Form „Beschreibung: · Mast_Nr: · geogr_Länge: · …"
  // enthalten keine Information — solche Reste gehören nicht auf den Schirm.
  function hinweisBereinigen(note) {
    var t = String(note || '').trim();
    if (!t) return '';
    var felder = t.split('·').map(function (s) { return s.trim(); }).filter(Boolean);
    var behalten = felder.filter(function (f) {
      var wert = f.split(':').slice(1).join(':').trim();
      if (!wert) return false;                    // „Mast_Nr:" ohne Wert
      if (/^[·\-–—.\s]*$/.test(wert)) return false;
      return true;
    });
    if (!behalten.length) return '';
    return behalten.join(' · ');
  }

  /* ---------- Hauptprüfung ---------- */

  /* Nimmt Rohpunkte entgegen und liefert:
       { punkte:  geprüfte Liste (mit verified/issues/mastNr),
         verworfen: Einträge, die als Dublette entfallen sind,
         bericht:  Zahlen für die Anzeige und die Tests }
     Rohpunkt: { name, lat, lon, kind, note, id?, source? } */
  function pruefen(rohpunkte, optionen) {
    optionen = optionen || {};
    var liste = [];
    var verworfen = [];

    (rohpunkte || []).forEach(function (roh, i) {
      var p = {
        id: roh.id || null,
        source: roh.source || 'package',
        name: String(roh.name == null ? '' : roh.name).trim(),
        kind: roh.kind || ART.UNBEKANNT,
        lat: typeof roh.lat === 'number' ? roh.lat : parseFloat(roh.lat),
        lon: typeof roh.lon === 'number' ? roh.lon : parseFloat(roh.lon),
        note: hinweisBereinigen(roh.note),
        mastNr: null,
        verified: true,
        issues: []
      };
      if (isNaN(p.lat)) p.lat = null;
      if (isNaN(p.lon)) p.lon = null;

      if (!koordinatenGueltig(p.lat, p.lon)) { p.issues.push('koordinaten-ungueltig'); p.verified = false; }
      if (!p.name) { p.issues.push('name-leer'); p.verified = false; }

      if (p.kind === ART.MAST) {
        p.mastNr = mastNummerVon(roh);
        if (!p.mastNr) {
          // Kein Mast ohne Mastnummer. Der Punkt bleibt erhalten, gilt aber
          // nicht mehr als Mast und wird nicht mehr für Notfälle benutzt.
          p.issues.push('mastnummer-fehlt');
          if (generischerName(p.name)) p.issues.push('name-generisch');
          p.kind = ART.UNBEKANNT;
          p.verified = false;
        } else {
          p.name = p.mastNr;                    // einheitliche Schreibweise
        }
      } else if (generischerName(p.name) && p.kind !== ART.RP) {
        p.issues.push('name-generisch');
        p.kind = ART.UNBEKANNT;
        p.verified = false;
      }

      if (p.kind === ART.KLINIK) {
        // Ob eine Einrichtung eine Notaufnahme hat, steht in keiner unserer
        // Quellen. Ohne Bestätigung wird sie nicht als Notfallziel geführt.
        if (!roh.medizinischBestaetigt) {
          p.issues.push('medizinisch-ungeprueft');
          p.verified = false;
        }
      }

      if (p.kind === ART.UNBEKANNT && p.issues.indexOf('name-generisch') < 0 &&
          p.issues.indexOf('mastnummer-fehlt') < 0) {
        p.issues.push('art-unbekannt');
        p.verified = false;
      }

      liste.push(p);
    });

    // ---- Dubletten und Widersprüche ----
    var dublettenEntfernt = 0, widersprueche = 0;

    // 1) Gleiche Mastnummer an verschiedenen Orten = Widerspruch.
    var nachNummer = {};
    liste.forEach(function (p) {
      if (!p.mastNr) return;
      (nachNummer[p.mastNr] = nachNummer[p.mastNr] || []).push(p);
    });
    Object.keys(nachNummer).forEach(function (nr) {
      var gruppe = nachNummer[nr];
      if (gruppe.length < 2) return;
      var weitAuseinander = false;
      for (var a = 0; a < gruppe.length; a++) {
        for (var b = a + 1; b < gruppe.length; b++) {
          if (abstand(gruppe[a], gruppe[b]) > WIDERSPRUCH_M) weitAuseinander = true;
        }
      }
      if (weitAuseinander) {
        gruppe.forEach(function (p) {
          if (p.issues.indexOf('nummer-widerspruch') < 0) p.issues.push('nummer-widerspruch');
          p.verified = false;
        });
        widersprueche += gruppe.length;
      }
    });

    // 2) Einträge am selben Ort zusammenführen.
    //    Verifiziertes schlägt Ungeprüftes; sonst der Eintrag mit mehr Inhalt.
    var behalten = [];
    liste.forEach(function (p) {
      if (!koordinatenGueltig(p.lat, p.lon)) { behalten.push(p); return; }
      for (var i = 0; i < behalten.length; i++) {
        var q = behalten[i];
        if (!koordinatenGueltig(q.lat, q.lon)) continue;
        if (abstand(p, q) > GLEICHER_ORT_M) continue;
        if (!vergleichbar(p, q)) continue;

        var besser = besserer(p, q);
        var schlechter = (besser === p) ? q : p;
        if (schlechter.issues.indexOf('dublette') < 0) schlechter.issues.push('dublette');
        verworfen.push({
          name: schlechter.name, kind: schlechter.kind,
          lat: schlechter.lat, lon: schlechter.lon,
          grund: 'Dublette von „' + besser.name + '"'
        });
        dublettenEntfernt++;
        if (besser !== q) behalten[i] = besser;
        return;                                   // p ist verarbeitet
      }
      behalten.push(p);
    });

    // 3) Rettungspunkt-Nummern dürfen sich nicht doppeln.
    var rpNummern = {};
    behalten.forEach(function (p) {
      if (p.kind !== ART.RP) return;
      var nr = rpNummer(p);
      if (nr == null) return;
      (rpNummern[nr] = rpNummern[nr] || []).push(p);
    });
    Object.keys(rpNummern).forEach(function (nr) {
      if (rpNummern[nr].length < 2) return;
      rpNummern[nr].forEach(function (p) {
        if (p.issues.indexOf('rp-nummer-doppelt') < 0) p.issues.push('rp-nummer-doppelt');
        p.verified = false;
      });
    });

    // 4) Ausreißer melden (nicht entfernen — das entscheidet der Generator).
    if (optionen.ausreisserGrenze) {
      var mLat = median(behalten.map(function (p) { return p.lat; }).filter(isNum));
      var mLon = median(behalten.map(function (p) { return p.lon; }).filter(isNum));
      behalten.forEach(function (p) {
        if (!isNum(p.lat)) return;
        if (Math.abs(p.lat - mLat) > optionen.ausreisserGrenze ||
            Math.abs(p.lon - mLon) > optionen.ausreisserGrenze) {
          if (p.issues.indexOf('abseits') < 0) p.issues.push('abseits');
          // Ein Mast gehört an die Leitung; liegt er weit daneben, stimmt der
          // Datensatz nicht — er fliegt aus den Berechnungen.
          // Ein Rettungspunkt darf dagegen weit entfernt liegen (die Trasse ist
          // 60 km lang). Er bleibt gültig und wird nur zur Prüfung markiert.
          if (p.kind === ART.MAST) p.verified = false;
        }
      });
    }

    var bericht = {
      gesamt: behalten.length,
      geprueft: behalten.filter(function (p) { return p.verified; }).length,
      ungeprueft: behalten.filter(function (p) { return !p.verified; }).length,
      dublettenEntfernt: dublettenEntfernt,
      widersprueche: widersprueche,
      nachArt: {}
    };
    behalten.forEach(function (p) {
      bericht.nachArt[p.kind] = (bericht.nachArt[p.kind] || 0) + 1;
    });

    return { punkte: behalten, verworfen: verworfen, bericht: bericht };
  }

  /* ---------- Helfer ---------- */

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    return s[Math.floor(s.length / 2)];
  }

  function abstand(a, b) {
    var R = 6371008.8, rad = Math.PI / 180;
    var p1 = a.lat * rad, p2 = b.lat * rad;
    var dp = (b.lat - a.lat) * rad, dl = (b.lon - a.lon) * rad;
    var s = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // Nur Einträge derselben Sorte dürfen zusammengeführt werden — ein
  // Rettungspunkt und ein Mast am selben Ort sind zwei verschiedene Dinge.
  function vergleichbar(a, b) {
    if (a.kind === b.kind) return true;
    // Ein ungeprüfter Punkt darf mit einem verifizierten Mast am selben Ort
    // verschmelzen: das ist derselbe Mast, nur ohne Nummer eingetragen.
    var arten = [a.kind, b.kind].sort().join('|');
    return arten === 'mast|unknown';
  }

  function besserer(a, b) {
    if (a.verified !== b.verified) return a.verified ? a : b;
    var ax = (a.mastNr ? 2 : 0) + (a.note ? 1 : 0) + (a.name ? 1 : 0);
    var bx = (b.mastNr ? 2 : 0) + (b.note ? 1 : 0) + (b.name ? 1 : 0);
    return bx > ax ? b : a;
  }

  // Rettungspunkt-Nummer, nur wenn eindeutig ableitbar.
  function rpNummer(p) {
    var n = String((p && p.name) || '');
    var m = n.match(/rettungspunk\w*\D*?(\d+)/i);
    if (m) return m[1];
    m = n.match(GENERISCH);
    if (m && p.kind === ART.RP) return m[2];
    return null;
  }

  // Uneinheitliche Kartennamen vereinheitlichen — nur wo die Bedeutung
  // eindeutig ist (Ordner „Rettungspunkte" bzw. „Rettungspunk 0").
  function nameVereinheitlichen(name, kind) {
    var n = String(name || '').trim();
    if (kind !== ART.RP) return n;
    // Korrekt geschriebene Bezeichnungen bleiben unangetastet — sie sind die
    // amtliche Benennung aus der Karte.
    if (/\bRettungspunkt\b/.test(n)) return n;
    // Nur den Schreibfehler geradeziehen: „Rettungspunk 0" → „Rettungspunkt 0".
    var m = n.match(/^\s*rettungspunk\w*\s*(.*)$/i);
    if (m) return ('Rettungspunkt ' + m[1]).trim();
    // Generische Kartennamen im Ordner „Rettungspunkte" sind eindeutig.
    var g = n.match(GENERISCH);
    if (g) return 'Rettungspunkt ' + g[2];
    return n;
  }

  function problemText(schluessel) {
    return PROBLEM_TEXT[schluessel] || schluessel;
  }

  return {
    ART: ART,
    pruefen: pruefen,
    koordinatenGueltig: koordinatenGueltig,
    generischerName: generischerName,
    generischeNummer: generischeNummer,
    istMastnummer: istMastnummer,
    mastNummerVon: mastNummerVon,
    hinweisBereinigen: hinweisBereinigen,
    nameVereinheitlichen: nameVereinheitlichen,
    rpNummer: rpNummer,
    problemText: problemText,
    GLEICHER_ORT_M: GLEICHER_ORT_M,
    WIDERSPRUCH_M: WIDERSPRUCH_M
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpiePruefung;
