/* spann.js — Spanntabellen (Reguliermaße) für die Rettungspunkte-App.

   Eine Spanntabelle sagt, wie weit ein Seil bei einer bestimmten Temperatur
   durchhängen MUSS. Sie kommt aus der Berechnung des Auftraggebers
   (EUROPTEN/Amprion), wird als PDF geliefert und mit
   tools/spanntabelle-zu-json.py in diese Form gebracht.

   Zwei Regeln, die dieses Modul streng einhält:

   1. Es wird nichts gerechnet. Kein Umrechnen, kein Runden und vor allem
      KEIN Interpolieren zwischen den Temperaturspalten. Die Tabelle nennt
      -20, -10, 0, 10, 20, 30 und 40 °C; was bei 17 °C gilt, steht nicht
      darin und wird hier auch nicht erfunden.
   2. Ein Wert wird nur angezeigt, wenn er zweifelsfrei zu diesem Mast
      gehört. Die Zuordnung läuft über die vereinheitlichte Mastnummer;
      passt keine, sagt die App das, statt irgendeinen Nachbarwert zu zeigen.

   Reines Rechenmodul ohne DOM, damit es unter node geprüft werden kann. */
var SpieSpann = (function () {
  'use strict';

  var VERSION = 1;

  function text(v) { return v == null ? '' : String(v).trim(); }

  /* Dieselbe Vereinheitlichung wie bei Dokumenten und Mastdaten:
     „4236/018" und „4236-18" sind derselbe Mast. */
  function schluessel(nr) {
    if (typeof SpieDok !== 'undefined' && SpieDok.mastSchluessel) return SpieDok.mastSchluessel(nr);
    return text(nr).toUpperCase();
  }

  function zahlenReihe(a, laenge) {
    if (!a || a.length !== laenge) return null;
    for (var i = 0; i < a.length; i++) if (typeof a[i] !== 'number' || !isFinite(a[i])) return null;
    return a;
  }

  /* ---------- Prüfen, was da importiert werden soll ----------
     Eine Spanntabelle mit einer kaputten Zeile ist gefährlicher als keine.
     Deshalb wird jede Zeile geprüft; was nicht vollständig ist, fliegt
     raus UND wird im Bericht genannt. Stillschweigend verworfen wird
     nichts. */
  function pruefen(roh) {
    var bericht = { tabellen: 0, seile: 0, felder: 0, verworfen: [], masten: [] };
    if (!roh || roh.art !== 'spanntabellen' || !Array.isArray(roh.tabellen)) {
      return { ok: false, fehler: 'Das ist keine Spanntabellen-Datei.', bericht: bericht, tabellen: [] };
    }
    if (roh.version > VERSION) {
      return { ok: false, fehler: 'Die Datei ist neuer als diese App (Fassung ' +
        roh.version + '). Bitte die App aktualisieren.', bericht: bericht, tabellen: [] };
    }

    var masten = {};
    var gut = roh.tabellen.map(function (t, ti) {
      var temps = t.temperaturen || [];
      var seile = (t.seile || []).map(function (s) {
        var felder = (s.felder || []).filter(function (f) {
          var mast = schluessel(f.mast);
          if (!mast) { bericht.verworfen.push('Tabelle ' + (ti + 1) + ': Feld ohne Mastnummer'); return false; }
          // Der letzte Mast eines Abschnitts hat kein Spannfeld — das ist
          // kein Fehler, er trägt nur keine Werte.
          if (!f.durchhang) return false;
          if (!zahlenReihe(f.durchhang, temps.length) || !zahlenReihe(f.zug, temps.length)) {
            bericht.verworfen.push('Mast ' + f.mast + ', Seil ' + s.seil +
              ': Werte passen nicht zu ' + temps.length + ' Temperaturspalten');
            return false;
          }
          masten[mast] = true;
          return true;
        });
        bericht.felder += felder.length;
        return { seil: text(s.seil), seiltyp: text(s.seiltyp),
                 grenzzugspannung: s.grenzzugspannung, mittelzugspannung: s.mittelzugspannung,
                 felder: felder };
      }).filter(function (s) { return s.felder.length > 0; });
      bericht.seile += seile.length;
      return {
        id: kennung(t, ti),
        quelle: text(t.quelle), leitung: text(t.leitung), abschnitt: text(t.abschnitt),
        zustand: text(t.zustand), von: text(t.von), nach: text(t.nach),
        ausgabedatum: text(t.ausgabedatum), bearbeiter: text(t.bearbeiter),
        berechnungsgrundlage: text(t.berechnungsgrundlage),
        ueberziehungsfaktor: text(t.ueberziehungsfaktor),
        temperaturreduktion: text(t.temperaturreduktion),
        temperaturen: temps, seile: seile
      };
    }).filter(function (t) { return t.seile.length > 0; });

    bericht.tabellen = gut.length;
    bericht.masten = Object.keys(masten).sort();
    if (!gut.length) {
      return { ok: false, fehler: 'Keine verwertbare Spanntabelle in der Datei.',
               bericht: bericht, tabellen: [] };
    }
    return { ok: true, fehler: '', bericht: bericht, tabellen: gut };
  }

  /* ---------- Kennung einer Tabelle ----------

     Jede Tabelle braucht eine eigene Kennung, sonst legen sich mehrere im
     Speicher auf denselben Platz und nur die letzte bleibt übrig. Genau das
     ist mit dem Blatzheim-Paket passiert: fünf Tabellen hinein, eine heraus.

     Erfunden wird dabei nichts — die Kennung kommt aus dem, was in der Datei
     steht: Dateiname der Quelle, sonst Leitung mit Abschnitt und Zustand,
     und erst wenn nicht einmal das dasteht, eine laufende Nummer. */
  function kennung(t, i) {
    if (!t) return 'tabelle-' + ((i || 0) + 1);
    var eigen = text(t.id) || text(t.quelle);
    if (eigen) return eigen;
    var teile = [text(t.leitung), text(t.von), text(t.nach), text(t.zustand)]
      .filter(function (x) { return !!x; });
    if (teile.length) return teile.join(' · ');
    return 'tabelle-' + ((i || 0) + 1);
  }

  /* ---------- Was gilt an DIESEM Mast? ----------
     Geliefert werden die Spannfelder, die an diesem Mast BEGINNEN — die
     Werte in der Zeile gehören zur Spannweite bis zum nächsten Mast. */
  function felderAmMast(tabellen, mastNr, leitung) {
    var key = schluessel(mastNr);
    if (!key) return [];
    var passt = function (a) {
      if (schluessel(a) === key) return true;
      return (typeof SpieDok !== 'undefined' && SpieDok.mastPasst)
        ? SpieDok.mastPasst(a, key, leitung) : false;
    };
    var raus = [];
    (tabellen || []).forEach(function (t) {
      (t.seile || []).forEach(function (s) {
        (s.felder || []).forEach(function (f, i) {
          if (!passt(f.mast)) return;
          var naechster = null;
          for (var j = i + 1; j < s.felder.length; j++) { naechster = s.felder[j]; break; }
          raus.push({ tabelle: t, seil: s, feld: f, nachMast: naechster ? naechster.mast : t.nach });
        });
      });
    });
    return raus;
  }

  function mastenInTabellen(tabellen) {
    var m = {};
    (tabellen || []).forEach(function (t) {
      (t.seile || []).forEach(function (s) {
        (s.felder || []).forEach(function (f) { m[schluessel(f.mast)] = f.mast; });
      });
    });
    return m;
  }

  /* Die Werte einer Temperaturspalte. Gibt es die Spalte nicht, kommt null
     zurück — nicht der nächstgelegene Wert und schon gar kein gemittelter. */
  function beiTemperatur(eintrag, tempC) {
    var i = (eintrag.tabelle.temperaturen || []).indexOf(tempC);
    if (i < 0) return null;
    var f = eintrag.feld;
    var w = { temperatur: tempC, durchhang: f.durchhang[i], zug: f.zug[i] };
    if (f.durchhangRed) w.durchhangRed = f.durchhangRed[i];
    if (f.zugRed) w.zugRed = f.zugRed[i];
    if (f.versatz) w.versatz = f.versatz[i];
    if (f.versatzRed) w.versatzRed = f.versatzRed[i];
    return w;
  }

  /* Alle Temperaturen, die in den Tabellen dieses Mastes vorkommen. */
  function temperaturen(eintraege) {
    var alle = {};
    (eintraege || []).forEach(function (e) {
      (e.tabelle.temperaturen || []).forEach(function (t) { alle[t] = true; });
    });
    return Object.keys(alle).map(Number).sort(function (a, b) { return a - b; });
  }

  /* ---------- Die Spanntabelle aus dem PDF-Text ----------

     Bis 0.34.2 las die Werte nur tools/spanntabelle-zu-json.py (Python,
     pdfplumber). Das hier ist derselbe Leser, Zeile für Zeile, für den
     Text, den pdf.js aus dem Blatt liefert. Derselbe Grundsatz: Es wird NUR
     abgeschrieben, was im PDF steht. Nichts wird gerundet, umgerechnet,
     interpoliert oder ergänzt. Was nicht sauber gelesen werden kann, bricht
     mit Klartext ab — eine halb gelesene Spanntabelle wäre schlimmer als
     keine.

     Eingabe: ein Feld von Seitentexten (Zeilen mit \n), wie sie
     pdfSeitenTexte() in der App aus den Textkästchen zusammensetzt. */
  var ZAHL = '-?\\d+(?:[.,]\\d+)?';
  var PAAR = new RegExp('(' + ZAHL + ')\\s*/\\s*(' + ZAHL + ')', 'g');

  function zahl(t) { return parseFloat(String(t).replace(',', '.')); }

  function paare(rest, wieviele) {
    var a = [], b = [], m;
    PAAR.lastIndex = 0;
    while ((m = PAAR.exec(rest)) !== null) { a.push(zahl(m[1])); b.push(zahl(m[2])); }
    if (a.length !== wieviele) {
      throw new Error(wieviele + ' Wertepaare erwartet, ' + a.length + ' gelesen in: ' + String(rest).trim().slice(0, 120));
    }
    return [a, b];
  }

  function kopf(text, muster) {
    var m = text.match(muster);
    return m ? String(m[1]).trim() : '';
  }

  function seiteLesen(text) {
    var zeilen = String(text || '').split('\n').map(function (z) { return z.replace(/\s+/g, ' ').trim(); })
      .filter(Boolean);
    var ganz = zeilen.join('\n');
    var m = ganz.match(/Abschnitt:\s*von Mast\s+(\S+)\s+nach Mast\s+(\S+)\s+Seil:\s*([^:]+):\s*(.+)/);
    if (!m) return null;                                  // Deckblatt ohne Tabelle
    var temps = [];
    var re = /TEMP\s*(-?\d+)\s*°C/g, t;
    while ((t = re.exec(ganz)) !== null) temps.push(parseInt(t[1], 10));
    if (!temps.length) throw new Error('Keine Temperaturspalten auf der Seite');
    var n = temps.length;
    var seite = { von: m[1], nach: m[2], seil: m[3].trim(), seiltyp: m[4].trim(),
                  zustand: kopf(ganz, /Zustand:\s*(.+)/), temperaturen: temps, felder: [] };
    [['sollquerschnitt', new RegExp('Sollquerschnitt:\\s*(' + ZAHL + ')\\s*mm')],
     ['durchmesser', new RegExp('Durchmesser:\\s*(' + ZAHL + ')\\s*mm')],
     ['seilgewicht', new RegExp('Gewicht:\\s*(' + ZAHL + ')\\s*kg/m')],
     ['bruchkraft', new RegExp('Rechn\\. Bruchkraft:\\s*(' + ZAHL + ')\\s*kN')],
     ['grenzzugspannung', new RegExp('Grenzzugspannung:\\s*(' + ZAHL + ')')],
     ['mittelzugspannung', new RegExp('Mittelzugspannung:\\s*(' + ZAHL + ')')]
    ].forEach(function (e) { var w = kopf(ganz, e[1]); if (w) seite[e[0]] = zahl(w); });

    var aktuell = null;
    var reMast = new RegExp('^Mast:\\s*(\\S+)\\s+Kettenlänge:\\s*(' + ZAHL + ')\\s*m\\s+Kettengewicht:\\s*(' + ZAHL + ')\\s*kg');
    var reV = /^V\/V red\.\s*\(m\)(.*)/;
    var reD = new RegExp('^Höhendifferenz:\\s*(' + ZAHL + ')\\s*m\\s+D/D red\\.\\s*\\(m\\)(.*)');
    var reZ = new RegExp('^Spannweite:\\s*(' + ZAHL + ')\\s*m\\s+Z/Z red\\.\\s*\\(N/mm²\\)(.*)');
    zeilen.forEach(function (z) {
      var x;
      if ((x = z.match(reMast))) {
        aktuell = { mast: x[1], kettenlaenge: zahl(x[2]), kettengewicht: zahl(x[3]) };
        seite.felder.push(aktuell); return;
      }
      if (!aktuell) return;
      if ((x = z.match(reV))) { var v = paare(x[1], n); aktuell.versatz = v[0]; aktuell.versatzRed = v[1]; return; }
      if ((x = z.match(reD))) { aktuell.hoehendifferenz = zahl(x[1]); var d = paare(x[2], n); aktuell.durchhang = d[0]; aktuell.durchhangRed = d[1]; return; }
      if ((x = z.match(reZ))) { aktuell.spannweite = zahl(x[1]); var g = paare(x[2], n); aktuell.zug = g[0]; aktuell.zugRed = g[1]; return; }
    });
    return seite;
  }

  /* seiten: [Text je Seite]. Liefert { ok, tabelle, fehler }. */
  function ausSeiten(seiten, quelle) {
    try {
      if (!seiten || !seiten.length) throw new Error('Keine Textebene im PDF (gescannt?)');
      var erste = seiten[0] || '';
      var tab = { art: 'spanntabelle', quelle: text(quelle) || 'Spanntabelle.pdf', id: text(quelle) || '',
        ausgabedatum: kopf(erste, /Ausgabedatum:\s*(.+)/), bearbeiter: kopf(erste, /Bearbeiter:\s*(.+)/),
        firma: kopf(erste, /Firma:\s*(.+)/), betreiber: kopf(erste, /Betreiber:\s*(.+)/),
        leitung: kopf(erste, /Leitungsname:\s*(.+)/), abschnitt: kopf(erste, /Abschnitt:\s*(.+)/),
        berechnungsgrundlage: kopf(erste, /Berechnungsgrundlage:\s*(.+)/),
        ueberziehungsfaktor: kopf(erste, /Überziehungsfaktor:\s*(\S+\s*%)/),
        temperaturreduktion: kopf(erste, /Temperaturreduktion:\s*(\S+\s*K)/),
        rollengewicht: kopf(erste, new RegExp('Rollengewicht:\\s*(' + ZAHL + ')')),
        seile: [] };
      var offen = {};
      seiten.forEach(function (st, i) {
        var s;
        try { s = seiteLesen(st); }
        catch (e) { throw new Error('Seite ' + (i + 1) + ': ' + e.message); }
        if (!s) return;
        if (tab.zustand === undefined) tab.zustand = s.zustand;
        if (tab.temperaturen === undefined) tab.temperaturen = s.temperaturen;
        if (tab.von === undefined) tab.von = s.von;
        if (tab.nach === undefined) tab.nach = s.nach;
        if (s.temperaturen.join(',') !== tab.temperaturen.join(',')) throw new Error('Seite ' + (i + 1) + ': andere Temperaturspalten');
        if (offen[s.seil]) { offen[s.seil].felder = offen[s.seil].felder.concat(s.felder); return; }
        var seil = {};
        Object.keys(s).forEach(function (k) { if (['von', 'nach', 'zustand', 'temperaturen'].indexOf(k) < 0) seil[k] = s[k]; });
        offen[s.seil] = seil; tab.seile.push(seil);
      });
      if (!tab.seile.length) throw new Error('Keine Spanntabelle gefunden (kein „Abschnitt: von Mast … nach Mast … Seil:")');
      return { ok: true, tabelle: tab, fehler: '' };
    } catch (e) {
      return { ok: false, tabelle: null, fehler: String(e && e.message || e) };
    }
  }

  return {
    VERSION: VERSION,
    pruefen: pruefen,
    ausSeiten: ausSeiten,
    kennung: kennung,
    felderAmMast: felderAmMast,
    mastenInTabellen: mastenInTabellen,
    beiTemperatur: beiTemperatur,
    temperaturen: temperaturen,
    mastSchluessel: schluessel
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpieSpann;
