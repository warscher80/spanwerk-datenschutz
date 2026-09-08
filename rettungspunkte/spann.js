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
        id: text(t.quelle) || ('tabelle-' + (ti + 1)),
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

  /* ---------- Was gilt an DIESEM Mast? ----------
     Geliefert werden die Spannfelder, die an diesem Mast BEGINNEN — die
     Werte in der Zeile gehören zur Spannweite bis zum nächsten Mast. */
  function felderAmMast(tabellen, mastNr) {
    var key = schluessel(mastNr);
    if (!key) return [];
    var raus = [];
    (tabellen || []).forEach(function (t) {
      (t.seile || []).forEach(function (s) {
        (s.felder || []).forEach(function (f, i) {
          if (schluessel(f.mast) !== key) return;
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

  return {
    VERSION: VERSION,
    pruefen: pruefen,
    felderAmMast: felderAmMast,
    mastenInTabellen: mastenInTabellen,
    beiTemperatur: beiTemperatur,
    temperaturen: temperaturen,
    mastSchluessel: schluessel
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpieSpann;
