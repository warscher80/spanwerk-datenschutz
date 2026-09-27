/* dok-modell.js — Dokumente, Kategorien und Revisionen.

   Reine Logik, kein DOM: läuft unter node und lässt sich damit prüfen, ohne
   einen Browser zu starten. Im Browser hängt es als window.SpieDok.

   Zwei Regeln bestimmen alles hier:

   1. Was aus einem Dateinamen gelesen wird, ist ein VORSCHLAG, nie eine
      Tatsache. Jeder Fund trägt seine Sicherheit mit sich, und die Oberfläche
      lässt den Menschen entscheiden. Ein Gründungsplan, der am falschen Mast
      landet, weil „127" auch ein Datumsteil sein kann, ist auf einer
      Baustelle kein Schönheitsfehler.

   2. Eine neue Revision LÖSCHT nichts. Sie wird die aktuelle, die alte bleibt
      erreichbar und wird als ersetzt gekennzeichnet.
*/
var SpieDok = (function () {
  'use strict';

  /* ---------- Kategorien ----------
     Nicht fest in der Oberfläche verdrahtet: Diese Liste ist nur die
     Auslieferung. Die Verwaltung kann sie ergänzen; deshalb tragen die
     Einträge stabile Kennungen, an denen gespeicherte Dokumente hängen. */
  var KATEGORIEN = [
    { id: 'gruendungsplan',  name: 'Gründungsplan',      gruppe: 'Gründung' },
    { id: 'fundamentplan',   name: 'Fundamentplan',      gruppe: 'Gründung' },
    { id: 'bewehrungsplan',  name: 'Bewehrungsplan',     gruppe: 'Gründung' },
    { id: 'mastbild',        name: 'Mastbild',           gruppe: 'Mast' },
    { id: 'montageplan',     name: 'Montageplan',        gruppe: 'Montage' },
    /* „Regulierplan = Spanntabelle." Die Reguliermaße stehen in der
       Spanntabelle des Abschnitts; ein eigener „Regulierplan" existiert in
       diesen Unterlagen nicht. Die Kennung bleibt für alte Ablagen, der Name
       sagt, was gemeint ist. */
    { id: 'spanntabelle',    name: 'Spanntabelle',       gruppe: 'Montage' },
    { id: 'regulierplan',    name: 'Regulierplan (alt)', gruppe: 'Montage' },
    { id: 'seilzugplan',     name: 'Seilzugplan',        gruppe: 'Montage' },
    { id: 'abspann',         name: 'Abspannunterlagen',  gruppe: 'Montage' },
    { id: 'pruefprotokoll',  name: 'Prüfprotokoll',      gruppe: 'Prüfung' },
    { id: 'abnahme',         name: 'Abnahme',            gruppe: 'Prüfung' },
    { id: 'foto',            name: 'Foto',               gruppe: 'Fotos' },
    { id: 'sonstiges',       name: 'Sonstiges Dokument', gruppe: 'Sonstiges' }
  ];

  // Reihenfolge der Gruppen in der Mastakte — so denkt der Monteur.
  var GRUPPEN = ['Gründung', 'Mast', 'Montage', 'Prüfung', 'Fotos', 'Sonstiges'];

  function alleKategorien(eigene) {
    if (!eigene || !eigene.length) return KATEGORIEN.slice();
    var out = KATEGORIEN.slice(), gesehen = {};
    out.forEach(function (k) { gesehen[k.id] = true; });
    eigene.forEach(function (k) {
      if (!k || !k.id) return;
      if (gesehen[k.id]) { out = out.map(function (a) { return a.id === k.id ? k : a; }); return; }
      out.push(k); gesehen[k.id] = true;
    });
    return out;
  }

  function kategorie(id, eigene) {
    var liste = alleKategorien(eigene);
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return null;
  }

  /* Eine Kategorie, die es nicht mehr gibt (jemand hat sie in der Verwaltung
     entfernt), wird NICHT stillschweigend zu „Sonstiges" — sonst verschmelzen
     zwei verschiedene Arten unter einem Namen. Der Kenner bleibt sichtbar. */
  function kategorieName(id, eigene) {
    var k = kategorie(id, eigene);
    if (k) return k.name;
    return id ? id + ' (unbekannte Art)' : 'Sonstiges Dokument';
  }

  /* ---------- Mastnummern ----------
     Zwei Schreibweisen sind im Einsatz: „4225/0063" (Leitung/Mast) und die
     baustelleneigene Zählung „127". Beide müssen zu demselben Schlüssel
     führen, egal ob mit Schrägstrich, Bindestrich oder Unterstrich
     geschrieben. Führende Nullen sind Schreibweise, kein Unterschied. */
  function mastSchluessel(nr) {
    var s = String(nr == null ? '' : nr).trim();
    if (!s) return '';
    /* „Mast 18" ist die Schreibweise der Blatzheimer Karte, „18" die der
       Mastliste und „4236/18" die der Unterlagen. Bis 0.29.0 wurde aus
       „Mast 18" der Schlüssel „MAST 18" — und der passte zu keiner der beiden
       anderen. Folge: Die mitgelieferten Gründungspläne hingen an einer
       Nummer, die in keiner Mastakte vorkam. Das Wort ist Beschriftung, nicht
       Nummer; es fällt weg. */
    s = s.replace(/^(?:mast|mst)\.?\s*(?:nr\.?\s*[:.]?\s*)?/i, '');
    if (!s) return '';
    var lang = s.match(/^(\d{3,4})\s*[\/\-_]\s*([A-Za-z]?)0*(\d+)([A-Za-z]?)$/);
    if (lang) {
      return lang[1] + '/' + (lang[2] || '').toUpperCase() + lang[3] + (lang[4] || '').toUpperCase();
    }
    var kurz = s.match(/^0*(\d+)([A-Za-z]?)$/);
    if (kurz) return kurz[1] + (kurz[2] || '').toUpperCase();
    return s.toUpperCase();
  }

  /* ---------- Zwei Schreibweisen für denselben Mast ----------

     In der Karte einer Baustelle heißt der Mast oft nur „18". In den
     Unterlagen des Auftraggebers heißt derselbe Mast „4236/18" — mit der
     Nummer der Leitung davor (Bl. 4236). Beides ist richtig, und ohne die
     Leitungsnummer lässt sich nicht entscheiden, ob „18" und „4236/18"
     derselbe Mast sind: In einer anderen Baustelle könnte „18" ein Mast der
     Leitung 4100 sein.

     Deshalb wird hier NICHT geraten. Die Leitungsnummer trägt jemand für die
     Baustelle ein; erst dann gelten die beiden Schreibweisen als gleich. */
  function mastPasst(a, b, leitung) {
    var ka = mastSchluessel(a), kb = mastSchluessel(b);
    if (!ka || !kb) return false;
    if (ka === kb) return true;
    var l = String(leitung == null ? '' : leitung).trim();
    if (!l) return false;
    var ohne = function (k) {
      var m = String(k).match(/^(\d{3,4})\/(.+)$/);
      return (m && m[1] === l) ? m[2] : k;
    };
    return ohne(ka) === ohne(kb);
  }

  /* Die Nummer, unter der ein Mast in DIESER Baustelle geführt wird —
     „4236/18" wird zu „18", wenn die Baustelle die Leitung 4236 ist. */
  function mastOhneLeitung(nr, leitung) {
    var k = mastSchluessel(nr);
    var l = String(leitung == null ? '' : leitung).trim();
    if (!l) return k;
    var m = k.match(/^(\d{3,4})\/(.+)$/);
    return (m && m[1] === l) ? m[2] : k;
  }

  /* ---------- Revisionen ----------
     Üblich sind Buchstaben (A, B, C …) und Zahlen (1, 2, 3 …). Beides muss
     sich ordnen lassen; gemischt wird nicht gerechnet: Buchstaben gelten als
     die ältere Reihe, damit „Rev 1" nicht vor „Rev C" landet, wenn jemand
     mitten im Projekt die Schreibweise wechselt. */
  function revisionRang(rev) {
    var s = String(rev == null ? '' : rev).trim().toUpperCase();
    if (!s) return -1;
    var buchstabe = s.match(/^([A-Z])$/);
    if (buchstabe) return buchstabe[1].charCodeAt(0) - 65;
    var zahl = s.match(/^(\d+)$/);
    if (zahl) return 1000 + parseInt(zahl[1], 10);
    return -1;
  }

  /* Welche Fassung gilt? Nicht der höchste Buchstabe allein entscheidet,
     sondern zuerst der Zeitpunkt der Ablage: Wer eine Revision zurückzieht,
     legt die gültige Fassung erneut ab. Bei gleichem Zeitpunkt der Rang. */
  function aktuelle(liste) {
    if (!liste || !liste.length) return null;
    var beste = null;
    liste.forEach(function (d) {
      if (!beste) { beste = d; return; }
      var a = d.abgelegt || 0, b = beste.abgelegt || 0;
      if (a > b) { beste = d; return; }
      if (a < b) return;
      if (revisionRang(d.revision) > revisionRang(beste.revision)) beste = d;
    });
    return beste;
  }

  /* Dokumente eines Mastes bündeln: je Kategorie die geltende Fassung und die
     ersetzten dahinter. */
  function nachKategorie(dokumente) {
    var toepfe = {};
    (dokumente || []).forEach(function (d) {
      var k = d.kategorie || 'sonstiges';
      (toepfe[k] || (toepfe[k] = [])).push(d);
    });
    return Object.keys(toepfe).map(function (k) {
      var alle = toepfe[k].slice().sort(function (a, b) {
        return (b.abgelegt || 0) - (a.abgelegt || 0) ||
               revisionRang(b.revision) - revisionRang(a.revision);
      });
      var jetzt = aktuelle(alle);
      return {
        kategorie: k,
        aktuell: jetzt,
        ersetzt: alle.filter(function (d) { return d !== jetzt; }),
        anzahl: alle.length
      };
    });
  }

  function istAktuell(dokument, alleDesMastes) {
    if (!dokument) return false;
    var gleiche = (alleDesMastes || []).filter(function (d) {
      return d.kategorie === dokument.kategorie;
    });
    var jetzt = aktuelle(gleiche);
    return !!jetzt && jetzt.id === dokument.id;
  }

  /* ---------- Dateinamen auswerten ----------
     Der Vorschlag für die Importvorschau. Jeder Fund bekommt eine Sicherheit:
     'sicher'   — die Schreibweise lässt nichts anderes zu (z. B. „M127")
     'vermutet' — plausibel, aber mehrdeutig (eine nackte Zahl kann alles sein)
     Fehlt ein Wert, bleibt er leer; die Vorschau fragt dann nach. */
  var KATEGORIE_WORTE = [
    [/gr(ü|ue)ndung/i,            'gruendungsplan'],
    [/fundament/i,                'fundamentplan'],
    [/bewehrung/i,                'bewehrungsplan'],
    [/mastbild|mastzeichnung/i,   'mastbild'],
    [/montage/i,                  'montageplan'],
    [/spanntabelle|spann_?tab/i,  'spanntabelle'],
    [/regulier/i,                 'spanntabelle'],
    [/seilzug|seilmontage/i,      'seilzugplan'],
    [/abspann/i,                  'abspann'],
    [/pr(ü|ue)f|protokoll/i,      'pruefprotokoll'],
    [/abnahme/i,                  'abnahme'],
    [/foto|img|dsc/i,             'foto']
  ];

  function dateiAuswerten(dateiname) {
    var name = String(dateiname || '');
    var ohneEndung = name.replace(/\.[A-Za-z0-9]{1,5}$/, '');
    var out = { mastNr: '', kategorie: '', revision: '', datum: '',
                sicherheit: { mastNr: '', kategorie: '', revision: '', datum: '' } };

    // 1. Datum zuerst — sonst hält die Mastsuche „2026" für eine Leitungsnummer.
    var rest = ohneEndung;
    var iso = rest.match(/(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])/);
    var deu = rest.match(/(0?[1-9]|[12]\d|3[01])[-_.](0?[1-9]|1[0-2])[-_.](20\d{2})/);
    if (iso) {
      out.datum = iso[1] + '-' + iso[2] + '-' + iso[3];
      out.sicherheit.datum = 'sicher';
      rest = rest.replace(iso[0], ' ');
    } else if (deu) {
      out.datum = deu[3] + '-' + ('0' + deu[2]).slice(-2) + '-' + ('0' + deu[1]).slice(-2);
      out.sicherheit.datum = 'sicher';
      rest = rest.replace(deu[0], ' ');
    }

    // 2. Revision
    var rev = rest.match(/rev(?:ision)?[\s_.\-]*([A-Za-z]|\d{1,2})(?![A-Za-z0-9])/i);
    if (rev) {
      out.revision = rev[1].toUpperCase();
      out.sicherheit.revision = 'sicher';
      rest = rest.replace(rev[0], ' ');
    }

    // 3. Mastnummer. Lange Schreibweise zuerst, sie ist eindeutig.
    /* Auch Mastnummern mit Buchstaben: In den Pillig-Daten heißen Masten
       „2409/P001". Ohne den Buchstaben blieb von „2409-P001_Gruendung_RevA"
       nur „2409" übrig — der Plan wäre an einem Mast gelandet, den es nicht
       gibt. */
    var lang = rest.match(/(^|[^A-Za-z0-9])(\d{3,4})[\/\-_]([A-Za-z]?\d{1,4}[A-Za-z]?)(?![A-Za-z0-9])/);
    var mitWort = rest.match(/(?:mast|mst|m)[\s_.\-]*(\d{1,4})([A-Za-z]?)(?![A-Za-z0-9])/i);
    if (lang) {
      out.mastNr = mastSchluessel(lang[2] + '/' + lang[3]);
      out.sicherheit.mastNr = 'sicher';
      rest = rest.replace(lang[0], ' ');
    } else if (mitWort) {
      out.mastNr = mastSchluessel(mitWort[1] + (mitWort[2] || ''));
      out.sicherheit.mastNr = 'sicher';
      rest = rest.replace(mitWort[0], ' ');
    } else {
      /* Eine nackte Zahl bleibt ein Verdacht. Sie kann eine Blattnummer, eine
         laufende Nummer oder sonst etwas sein — der Mensch entscheidet. */
      var nackt = rest.match(/(?:^|[\s_.\-])(\d{1,4})(?=$|[\s_.\-])/);
      if (nackt) {
        out.mastNr = mastSchluessel(nackt[1]);
        out.sicherheit.mastNr = 'vermutet';
        rest = rest.replace(nackt[0], ' ');
      }
    }

    // 4. Dokumentart aus dem, was übrig ist
    for (var i = 0; i < KATEGORIE_WORTE.length; i++) {
      if (KATEGORIE_WORTE[i][0].test(rest)) {
        out.kategorie = KATEGORIE_WORTE[i][1];
        out.sicherheit.kategorie = 'sicher';
        break;
      }
    }
    // Bilddateien ohne Stichwort sind Fotos — das ist die Endung, kein Raten.
    if (!out.kategorie && /\.(jpe?g|png)$/i.test(name)) {
      out.kategorie = 'foto';
      out.sicherheit.kategorie = 'vermutet';
    }
    return out;
  }

  /* ---------- Das Schriftfeld eines Plans ----------

     „In den ganzen Plänen steht unten der Mast mit Nummer." Stimmt — und die
     Dateien heißen trotzdem „145052.pdf". Der Dateiname ist also die
     schlechtere Quelle. Hier wird gelesen, was im Blatt steht.

     Gelesen werden die Textkästchen, die pdf.js liefert (getTextContent):
     jedes mit Text, Lage und Laufrichtung. Zwei Dinge sind dabei nicht
     verhandelbar:

     1. Die Nummer wird ÜBER DIE LAGE gefunden, nicht über den Fließtext.
        In diesen Zeichnungen steht „Mast Nr. 3 1" — die Ziffern sind einzeln
        gesetzt. Ein Ausdruck über den Text las daraus Mast 3 statt Mast 31:
        ein Gründungsplan am falschen Mast. Deshalb: die Kästchen rechts der
        Beschriftung, in Laufrichtung, Ziffern zusammensetzen, solange sie
        dicht stehen; die erste Lücke oder das erste Nicht-Ziffern-Kästchen
        beendet die Nummer.
     2. Die Laufrichtung kommt aus der Transformationsmatrix jedes Kästchens.
        Die Blatzheimer Blätter liegen um 270° gedreht — „rechts von der
        Beschriftung" ist dort „unten im Koordinatensystem". Wer mit x/y
        rechnet statt mit der Laufrichtung, findet nichts oder das Falsche.

     Ein gescannter Plan hat keine Textebene. Dann kommt hier nichts zurück,
     und die Vorschau sagt es — geraten wird nicht. */
  var SCHRIFTFELD_TITEL = [
    [/spanntabelle/i,                                    'spanntabelle'],
    [/schal-?\s*und\s*bewehrungsplan|bewehrungsplan/i, 'bewehrungsplan'],
    [/plattenfundament|fundamentplan/i,                  'fundamentplan'],
    [/bohrpfahlgr(ü|ue)ndung|gr(ü|ue)ndungsplan/i,       'gruendungsplan'],
    [/montageplan/i,                                     'montageplan']
  ];

  function schriftfeldAusItems(items) {
    var w = [];
    (items || []).forEach(function (i) {
      if (!i || !i.str || !String(i.str).trim() || !i.transform) return;
      var t = i.transform, a = t[0], b = t[1];
      var len = Math.sqrt(a * a + b * b) || 1;
      w.push({ s: String(i.str).trim(), x: t[4], y: t[5], dx: a / len, dy: b / len,
               w: i.width || 0 });
    });
    var out = { mast: '', leitung: '', kategorie: '', text: w.map(function (i) { return i.s; }).join(' '),
                hatText: w.length > 0 };

    /* Kästchen in Laufrichtung hinter einer Beschriftung — nur Ziffern,
       zusammengesetzt, bis eine Lücke (> 14 Einheiten) oder ein anderes
       Zeichen kommt. */
    function ziffernNach(label) {
      var px = -label.dy, py = label.dx;
      var kand = [];
      w.forEach(function (c) {
        if (c === label) return;
        var rx = c.x - label.x, ry = c.y - label.y;
        var quer = rx * px + ry * py, laengs = rx * label.dx + ry * label.dy;
        if (Math.abs(quer) < 6 && laengs > label.w - 1 && laengs < label.w + 260) {
          kand.push({ c: c, p: laengs });
        }
      });
      kand.sort(function (a, b) { return a.p - b.p; });
      var aus = '', ende = null;
      for (var i = 0; i < kand.length; i++) {
        if (!/^\d+$/.test(kand[i].c.s)) break;
        if (ende !== null && kand[i].p - ende > 14) break;
        aus += kand[i].c.s;
        ende = kand[i].p + kand[i].c.w;
      }
      return aus;
    }

    for (var i = 0; i < w.length && !out.mast; i++) {
      var label = null;
      if (/^mast[\s_-]*nr\.?:?$/i.test(w[i].s)) label = w[i];
      else if (/^nr\.?:?$/i.test(w[i].s) && i > 0 && /^mast$/i.test(w[i - 1].s)) label = w[i];
      if (!label) continue;
      var z = ziffernNach(label);
      if (z) out.mast = String(parseInt(z, 10));      // führende Nullen sind Schreibweise
    }
    var bl = out.text.match(/\bBl\.\s*(\d{3,4})\b/);
    if (bl) out.leitung = bl[1];
    /* Eine Spanntabelle hat kein „Mast Nr.", sondern einen Abschnitt „von
       Mast 4236/18 nach Mast 4236/20". Abgelegt wird sie an dem Mast, an dem
       das Feld beginnt — dort zeigt die Mastakte auch die Spannfelder. */
    if (!out.mast) {
      var ab = out.text.match(/Abschnitt:\s*von\s+Mast\s+(\S+)\s+nach\s+Mast\s+(\S+)/i);
      /* Das Deckblatt schreibt den Abschnitt kürzer: „…, 4236/18-4236/20". */
      if (!ab) ab = out.text.match(/Abschnitt:[^\n]*?(\d{3,4}\/\d+)\s*-\s*(\d{3,4}\/\d+)/i);
      if (ab) { out.mast = ab[1]; out.nach = ab[2]; out.mastVoll = true; }
    }
    for (var k = 0; k < SCHRIFTFELD_TITEL.length; k++) {
      if (SCHRIFTFELD_TITEL[k][0].test(out.text)) { out.kategorie = SCHRIFTFELD_TITEL[k][1]; break; }
    }
    return out;
  }

  /* Was muss der Mensch anfassen? Alles, was fehlt oder nur vermutet ist. */
  function pruefbedarf(vorschlag) {
    var offen = [];
    if (!vorschlag.mastNr) offen.push('Mast fehlt');
    else if (vorschlag.sicherheit.mastNr !== 'sicher') offen.push('Mast nur vermutet');
    if (!vorschlag.kategorie) offen.push('Art fehlt');
    else if (vorschlag.sicherheit.kategorie !== 'sicher') offen.push('Art nur vermutet');
    if (!vorschlag.revision) offen.push('Revision fehlt');
    return offen;
  }

  /* ---------- Dateitypen ---------- */
  var ERLAUBT = [
    { endung: 'pdf',  mime: 'application/pdf', art: 'pdf' },
    { endung: 'jpg',  mime: 'image/jpeg',      art: 'bild' },
    { endung: 'jpeg', mime: 'image/jpeg',      art: 'bild' },
    { endung: 'png',  mime: 'image/png',       art: 'bild' }
  ];

  function dateiArt(name, mime) {
    var e = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    var endung = e ? e[1] : '';
    for (var i = 0; i < ERLAUBT.length; i++) {
      if (ERLAUBT[i].endung === endung) return ERLAUBT[i].art;
    }
    if (/^image\//.test(mime || '')) return 'bild';
    if (mime === 'application/pdf') return 'pdf';
    return '';
  }

  function istErlaubt(name, mime) { return !!dateiArt(name, mime); }

  /* Der Dateityp aus der Endung.

     Ohne ihn liefert der Browser eine Datei „ohne Art" aus, und das iPhone
     zeigt statt des Plans „Unknown — Dokument". Genau so ist es passiert:
     Ein Paket aus dem Büro brachte die Pläne ohne Typangabe mit, und am
     Handy war der Plan nicht zu lesen. Die App verlässt sich deshalb nicht
     mehr darauf, dass der Typ mitgeliefert wird. */
  var TYPEN = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                png: 'image/png', gif: 'image/gif', webp: 'image/webp' };

  function mimeFuer(name, mime) {
    if (mime && mime !== 'application/octet-stream') return mime;
    var e = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return (e && TYPEN[e[1]]) || mime || '';
  }

  return {
    KATEGORIEN: KATEGORIEN,
    GRUPPEN: GRUPPEN,
    ERLAUBT: ERLAUBT,
    alleKategorien: alleKategorien,
    kategorie: kategorie,
    kategorieName: kategorieName,
    mastSchluessel: mastSchluessel,
    mastPasst: mastPasst,
    mastOhneLeitung: mastOhneLeitung,
    revisionRang: revisionRang,
    aktuelle: aktuelle,
    nachKategorie: nachKategorie,
    istAktuell: istAktuell,
    dateiAuswerten: dateiAuswerten,
    pruefbedarf: pruefbedarf,
    dateiArt: dateiArt,
    mimeFuer: mimeFuer,
    istErlaubt: istErlaubt,
    schriftfeldAusItems: schriftfeldAusItems
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpieDok;
