/* geo.js — Geo-Mathematik & Parser für die SPIE-Rettungspunkte-App.
   Reines Rechenmodul ohne DOM-Zugriff, damit es in tests/spie-geo.test.js
   unter node getestet werden kann.  Im Browser hängt es als window.SpieGeo. */
var SpieGeo = (function () {
  'use strict';

  var A = 6378137.0;                 // WGS84 große Halbachse
  var F = 1 / 298.257223563;         // Abplattung
  var E2 = F * (2 - F);              // 1. numerische Exzentrizität²
  var K0 = 0.9996;                   // UTM-Maßstabsfaktor
  var R = 6371008.8;                 // mittlerer Erdradius (IUGG)

  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }

  /* ---------- Entfernung & Richtung ---------- */

  // Haversine, Ergebnis in Metern.
  function distance(lat1, lon1, lat2, lon2) {
    var p1 = rad(lat1), p2 = rad(lat2);
    var dp = rad(lat2 - lat1), dl = rad(lon2 - lon1);
    var s = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // Anfangs-Peilung (rechtweisend Nord), 0…360°.
  function bearing(lat1, lon1, lat2, lon2) {
    var p1 = rad(lat1), p2 = rad(lat2), dl = rad(lon2 - lon1);
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }

  var COMPASS = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

  function compass(deg360) {
    var i = Math.round(((deg360 % 360) + 360) % 360 / 22.5) % 16;
    return COMPASS[i];
  }

  /* ---------- Formatierung ---------- */

  function num(n, dec) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function formatDistance(m) {
    if (!isFinite(m)) return '–';
    if (m < 1000) return Math.round(m) + ' m';
    if (m < 10000) return num(m / 1000, 1) + ' km';
    return Math.round(m / 1000) + ' km';
  }

  function formatAccuracy(m) {
    if (m == null || !isFinite(m)) return '–';
    return '±' + Math.round(m) + ' m';
  }

  // Dezimalgrad, das Format für Leitstellen-Eingabe.
  function formatDec(lat, lon) {
    return lat.toFixed(6) + ', ' + lon.toFixed(6);
  }

  // Grad + Dezimalminuten (Funk/Luftrettung):  N 50° 07.408'  E 007° 22.116'
  function formatDDM(lat, lon) {
    return ddmPart(lat, false) + '  ' + ddmPart(lon, true);
  }

  function ddmPart(v, isLon) {
    var hem = isLon ? (v < 0 ? 'W' : 'E') : (v < 0 ? 'S' : 'N');
    var abs = Math.abs(v);
    var d = Math.floor(abs);
    var m = (abs - d) * 60;
    if (m >= 59.9995) { m = 0; d += 1; }          // Rundungsüberlauf abfangen
    var dd = isLon ? pad(d, 3) : pad(d, 2);
    return hem + ' ' + dd + '° ' + (m < 10 ? '0' : '') + m.toFixed(3) + "'";
  }

  // Grad/Minute/Sekunde:  50° 07' 24.5" N
  function formatDMS(lat, lon) {
    return dmsPart(lat, false) + '  ' + dmsPart(lon, true);
  }

  function dmsPart(v, isLon) {
    var hem = isLon ? (v < 0 ? 'W' : 'E') : (v < 0 ? 'S' : 'N');
    var abs = Math.abs(v);
    var d = Math.floor(abs);
    var mf = (abs - d) * 60;
    var m = Math.floor(mf);
    var s = (mf - m) * 60;
    if (s >= 59.95) { s = 0; m += 1; }
    if (m >= 60) { m = 0; d += 1; }
    var dd = isLon ? pad(d, 3) : pad(d, 2);
    return dd + '° ' + pad(m, 2) + "' " + (s < 10 ? '0' : '') + s.toFixed(1) + '" ' + hem;
  }

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }

  /* ---------- UTM (Feuerwehr/Rettungsdienst-Gitter) ---------- */

  var BANDS = 'CDEFGHJKLMNPQRSTUVWX';

  function utmZone(lat, lon) {
    var z = Math.floor((lon + 180) / 6) + 1;
    // Sonderzonen Südnorwegen …
    if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) z = 32;
    // … und Spitzbergen.
    if (lat >= 72 && lat < 84) {
      if (lon >= 0 && lon < 9) z = 31;
      else if (lon >= 9 && lon < 21) z = 33;
      else if (lon >= 21 && lon < 33) z = 35;
      else if (lon >= 33 && lon < 42) z = 37;
    }
    return z;
  }

  function utmBand(lat) {
    if (lat < -80 || lat > 84) return '';
    if (lat >= 72) return 'X';                       // X umfasst 72°–84°
    return BANDS.charAt(Math.floor((lat + 80) / 8));
  }

  // WGS84 → UTM (Snyder-Reihenentwicklung, cm-genau im Gültigkeitsbereich).
  function toUTM(lat, lon) {
    var zone = utmZone(lat, lon);
    var band = utmBand(lat);
    var lon0 = rad((zone - 1) * 6 - 180 + 3);
    var p = rad(lat), l = rad(lon);
    var ep2 = E2 / (1 - E2);
    var N = A / Math.sqrt(1 - E2 * Math.sin(p) * Math.sin(p));
    var T = Math.tan(p) * Math.tan(p);
    var C = ep2 * Math.cos(p) * Math.cos(p);
    var Aa = Math.cos(p) * (l - lon0);
    var M = A * ((1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256) * p
              - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 * E2 * E2 / 1024) * Math.sin(2 * p)
              + (15 * E2 * E2 / 256 + 45 * E2 * E2 * E2 / 1024) * Math.sin(4 * p)
              - (35 * E2 * E2 * E2 / 3072) * Math.sin(6 * p));

    var easting = K0 * N * (Aa + (1 - T + C) * Math.pow(Aa, 3) / 6
                  + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(Aa, 5) / 120) + 500000;
    var northing = K0 * (M + N * Math.tan(p) * (Aa * Aa / 2
                  + (5 - T + 9 * C + 4 * C * C) * Math.pow(Aa, 4) / 24
                  + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(Aa, 6) / 720));
    if (lat < 0) northing += 10000000;

    return {
      zone: zone,
      band: band,
      easting: Math.round(easting),
      northing: Math.round(northing),
      text: zone + band + ' ' + Math.round(easting) + ' ' + Math.round(northing)
    };
  }

  /* ---------- Eingabe-Parser ---------- */

  // Achtung: isFinite(null) ist in JS true — deshalb explizit auf Zahlen prüfen,
  // sonst rutscht ein Eintrag ohne Koordinaten als Punkt bei 0°/0° durch.
  function inRange(lat, lon) {
    return typeof lat === 'number' && typeof lon === 'number' &&
           isFinite(lat) && isFinite(lon) &&
           lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  // Akzeptiert Dezimalgrad, Grad-Dezimalminuten und Grad/Min/Sek,
  // mit Komma oder Punkt als Dezimaltrenner und Himmelsrichtung vor oder nach der Zahl.
  function parseCoords(input) {
    if (!input) return null;
    var s = String(input).trim().replace(/ /g, ' ');

    // 1) Reines Dezimalgrad-Paar:  50.123456, 7.123456   |   50,123456 7,123456
    var dec = s.match(/^\s*([NS])?\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*[,;\/ ]\s*([EWO])?\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*$/i);
    if (dec) {
      var la = f(dec[2]), lo = f(dec[4]);
      if (dec[1] && dec[1].toUpperCase() === 'S') la = -Math.abs(la);
      if (dec[3] && dec[3].toUpperCase() === 'W') lo = -Math.abs(lo);
      return inRange(la, lo) ? { lat: la, lon: lo } : null;
    }

    // 2) DDM / DMS — jede plausible Aufteilung in zwei Hälften durchprobieren.
    var cands = splitCandidates(s);
    for (var i = 0; i < cands.length; i++) {
      var p1 = parseAngle(cands[i][0]), p2 = parseAngle(cands[i][1]);
      if (!p1 || !p2) continue;
      var lat = null, lon = null;
      if (p1.hem === 'N' || p1.hem === 'S') { lat = p1.value; lon = p2.value; }
      else if (p1.hem === 'E' || p1.hem === 'W') { lon = p1.value; lat = p2.value; }
      else if (p2.hem === 'N' || p2.hem === 'S') { lat = p2.value; lon = p1.value; }
      else if (p2.hem === 'E' || p2.hem === 'W') { lon = p2.value; lat = p1.value; }
      else { lat = p1.value; lon = p2.value; }
      if (inRange(lat, lon)) return { lat: lat, lon: lon };
    }
    return null;
  }

  // Liefert alle sinnvollen Zerlegungen "linke Hälfte | rechte Hälfte".
  // Reihenfolge = Priorität: Himmelsrichtungen, dann Trennzeichen, dann Leerzeichen.
  function splitCandidates(s) {
    var out = [];
    var hemIdx = [];
    for (var i = 0; i < s.length; i++) if (/[NSEWOnsewo]/.test(s.charAt(i))) hemIdx.push(i);

    if (hemIdx.length === 2) {
      var firstDigit = s.search(/\d/);
      // Führende Himmelsrichtung ("N 50° … E 007° …") → vor dem zweiten Buchstaben trennen,
      // nachgestellte ("50° … N, 7° … E") → hinter dem ersten.
      var cut = (firstDigit < 0 || hemIdx[0] < firstDigit) ? hemIdx[1] : hemIdx[0] + 1;
      out.push([s.slice(0, cut), s.slice(cut)]);
    }
    ';:/'.split('').forEach(function (sep) {
      var parts = s.split(sep);
      if (parts.length === 2) out.push([parts[0], parts[1]]);
    });
    var re = /\s+/g, m;
    while ((m = re.exec(s)) !== null) {
      out.push([s.slice(0, m.index), s.slice(m.index + m[0].length)]);
    }
    return out.filter(function (c) { return /\d/.test(c[0]) && /\d/.test(c[1]); });
  }

  function parseAngle(part) {
    if (!part) return null;
    var t = part.trim();
    var hem = null;
    var h = t.match(/[NSEWOnsewo]/);
    if (h) { hem = h[0].toUpperCase(); if (hem === 'O') hem = 'E'; }
    var nums = t.replace(/[NSEWOnsewo]/g, ' ').match(/-?\d+(?:[.,]\d+)?/g);
    if (!nums || !nums.length) return null;
    var d = f(nums[0]);
    var sign = d < 0 ? -1 : 1;
    var v = Math.abs(d);
    if (nums[1] != null) v += f(nums[1]) / 60;
    if (nums[2] != null) v += f(nums[2]) / 3600;
    v *= sign;
    if (hem === 'S' || hem === 'W') v = -Math.abs(v);
    return { value: v, hem: hem };
  }

  function f(x) { return parseFloat(String(x).replace(',', '.')); }

  /* ---------- Rettungspunkt-Listen einlesen ---------- */

  /* ---------- KML (Google My Maps) ---------- */

  // Art des Punktes aus Ordner- und Punktnamen ableiten.
  // 'rp' = Rettungspunkt, 'mast' = Mast, 'klinik' = Arzt/Krankenhaus,
  // 'lager' = Baulager, 'sonstiges' = alles andere.
  function classify(name, folder, desc) {
    var n = (name || '').toLowerCase();
    var f = (folder || '').toLowerCase();
    var d = (desc || '').toLowerCase();
    var KLINIK = /krankenhaus|klinik|arzt|ärzt|aerzt|augenzentrum|notaufnahme|dr\. med/;

    // Der eigene Name zählt mehr als der Ordner: im Ordner "Baulager/Ärzte"
    // steht auch das Baulager selbst.
    if (/rettungspunk/.test(n)) return 'rp';
    if (KLINIK.test(n)) return 'klinik';
    if (/baulager|lagerplatz|bauhof/.test(n)) return 'lager';
    if (/^\s*\d{3,4}\/\d+[a-z]?\s*$/i.test(name || '')) return 'mast';
    /* Zweite Schreibweise, die auf Baustellen vorkommt: „Mast 12". Sie zählt
       nur MIT dem Wort „Mast" — eine nackte Zahl oder „Punkt 91" sagt nicht,
       was der Punkt ist, und bleibt deshalb ohne Zuordnung. */
    if (/^\s*mast\s*\.?\s*\d+[a-z]?\s*$/i.test(name || '')) return 'mast';

    if (/rettungspunk/.test(f)) return 'rp';
    if (/mastliste|masten\b/.test(f)) return 'mast';
    if (KLINIK.test(d)) return 'klinik';
    return 'sonstiges';
  }

  // KML ohne XML-Bibliothek lesen — läuft so in node und im WebView.
  // Ausgewertet werden nur <Placemark> mit <Point>; Linien und Flächen
  // (Routen, Trassen) werden übersprungen.
  function parseKml(text) {
    var out = { points: [], lines: [], errors: [], title: '' };
    var titleM = text.match(/<Document>[\s\S]*?<name>([\s\S]*?)<\/name>/);
    if (titleM) out.title = clean(titleM[1]);

    // Jede Placemark bekommt den Namen des Ordners, in dem sie steht.
    var folders = [];
    var re = /<Folder>([\s\S]*?)<\/Folder>/g, m;
    var covered = '';
    while ((m = re.exec(text)) !== null) {
      var body = m[1];
      var fn = body.match(/<name>([\s\S]*?)<\/name>/);
      folders.push({ name: fn ? clean(fn[1]) : '', body: body });
      covered += body;
    }
    // Placemarks außerhalb von Ordnern nicht verlieren
    var loose = text.replace(/<Folder>[\s\S]*?<\/Folder>/g, '');
    folders.push({ name: '', body: loose });

    folders.forEach(function (f) {
      var pre = /<Placemark[\s\S]*?<\/Placemark>/g, pm;
      while ((pm = pre.exec(f.body)) !== null) {
        var block = pm[0];
        var nameEarly = block.match(/<name>([\s\S]*?)<\/name>/);

        /* Linien (Zuwegungen, Trassenzüge) mitnehmen. ALLE, nicht nur die
           erste: In Google My Maps steckt eine gezeichnete Zuwegung als
           MultiGeometry mit vielen LineStrings in EINER Platzmarke. Vorher
           nahm die Suche ohne /g nur das erste Segment — aus einer 2 km langen
           Zuwegung wurde ein 30-Meter-Stummel, der im Lageplan trotzdem wie
           der ganze Weg aussah.

           Jedes Segment wird ein eigener Eintrag: Zusammenhängen darf man sie
           nicht, sonst entstünden Verbindungslinien quer durch die Landschaft,
           die es in Wirklichkeit nicht gibt. */
        var lineRe = /<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g;
        var lm, gefunden = false;
        while ((lm = lineRe.exec(block)) !== null) {
          var punkte = [];
          clean(lm[1]).split(/\s+/).forEach(function (paar) {
            var t = paar.split(',');
            var lo = parseFloat(t[0]), la = parseFloat(t[1]);
            if (inRange(la, lo)) punkte.push([la, lo]);
          });
          if (punkte.length >= 2) {
            out.lines.push({ name: nameEarly ? clean(nameEarly[1]) : 'Weg', punkte: punkte, folder: f.name });
            gefunden = true;
          }
        }
        if (gefunden) continue;

        var coordM = block.match(/<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
        if (!coordM) continue;                       // Fläche → überspringen
        var parts = clean(coordM[1]).split(',');
        var lon = parseFloat(parts[0]), lat = parseFloat(parts[1]);
        if (!inRange(lat, lon)) { out.errors.push('Punkt ohne gültige Koordinaten übersprungen.'); continue; }
        var nameM = block.match(/<name>([\s\S]*?)<\/name>/);
        var descM = block.match(/<description>([\s\S]*?)<\/description>/);
        var name = nameM ? clean(nameM[1]) : '';
        var desc = descM ? stripTags(clean(descM[1])) : '';
        out.points.push({
          id: '', name: name || 'Punkt', lat: lat, lon: lon,
          note: desc.slice(0, 200),
          kind: classify(name, f.name, desc),
          folder: f.name
        });
      }
    });
    if (!out.points.length && !out.errors.length) out.errors.push('Keine Punkte in der KML-Datei gefunden.');
    return out;
  }

  function clean(s) {
    return String(s)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
      .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
      .trim();
  }

  function stripTags(s) {
    return String(s).replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  // Aus einem Google-My-Maps-Link die KML-Adresse bauen.
  // Aus …/maps/d/edit?mid=XYZ wird …/maps/d/kml?mid=XYZ&forcekml=1
  function myMapsKmlUrl(link) {
    if (!link) return null;
    var m = String(link).match(/[?&]mid=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    return 'https://www.google.com/maps/d/kml?mid=' + m[1] + '&forcekml=1';
  }

  // Erkennt JSON-Array, GeoJSON-FeatureCollection und CSV/Semikolon-Listen.
  // Liefert { points: [...], errors: [...] } — nie eine Exception.
  function parsePoints(text) {
    var out = { points: [], lines: [], errors: [] };
    if (!text || !String(text).trim()) { out.errors.push('Datei ist leer.'); return out; }
    var raw = String(text).replace(/^﻿/, '').trim();

    if (/<kml[\s>]/i.test(raw.slice(0, 4000)) || /<Placemark[\s>]/i.test(raw.slice(0, 40000))) {
      return parseKml(raw);
    }

    if (raw.charAt(0) === '{' || raw.charAt(0) === '[') {
      var data;
      try { data = JSON.parse(raw); }
      catch (e) { out.errors.push('JSON ist ungültig: ' + e.message); return out; }
      var list = Array.isArray(data) ? data
               : (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) ? data.features
               : Array.isArray(data && data.points) ? data.points
               : null;
      if (!list) { out.errors.push('Kein Array, kein GeoJSON und kein { points: [] }.'); return out; }
      list.forEach(function (item, i) {
        var p = normalizePoint(item);
        if (p) out.points.push(p);
        else out.errors.push('Eintrag ' + (i + 1) + ': keine gültigen Koordinaten.');
      });
      return out;
    }

    return parseCsv(raw, out);
  }

  function parseCsv(raw, out) {
    var lines = raw.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) { out.errors.push('Datei ist leer.'); return out; }
    var sep = pickSeparator(lines[0]);
    var head = lines[0].split(sep).map(function (c) { return c.trim().toLowerCase().replace(/^"|"$/g, ''); });
    var idx = {
      id:   findCol(head, ['id', 'nr', 'nummer', 'kennung', 'rettungspunkt']),
      name: findCol(head, ['name', 'bezeichnung', 'punkt', 'ort', 'beschreibung']),
      lat:  findCol(head, ['lat', 'latitude', 'breite', 'breitengrad', 'y']),
      lon:  findCol(head, ['lon', 'lng', 'long', 'longitude', 'länge', 'laenge', 'längengrad', 'x']),
      note: findCol(head, ['hinweis', 'note', 'bemerkung', 'info', 'zufahrt'])
    };
    var start = 1;
    if (idx.lat < 0 || idx.lon < 0) {          // Kopfzeile fehlt → feste Spaltenfolge annehmen
      idx = { id: 0, name: 1, lat: 2, lon: 3, note: 4 };
      start = 0;
    }
    for (var i = start; i < lines.length; i++) {
      var c = lines[i].split(sep).map(function (v) { return v.trim().replace(/^"|"$/g, ''); });
      var p = normalizePoint({
        id: at(c, idx.id), name: at(c, idx.name),
        lat: at(c, idx.lat), lon: at(c, idx.lon), note: at(c, idx.note)
      });
      if (p) out.points.push(p);
      else out.errors.push('Zeile ' + (i + 1) + ': keine gültigen Koordinaten.');
    }
    return out;
  }

  function pickSeparator(line) {
    var cands = [';', '\t', ','];
    var best = ';', bestN = -1;
    cands.forEach(function (s) {
      var n = line.split(s).length;
      if (n > bestN) { bestN = n; best = s; }
    });
    return best;
  }

  function findCol(head, names) {
    for (var i = 0; i < head.length; i++) if (names.indexOf(head[i]) >= 0) return i;
    return -1;
  }

  function at(arr, i) { return (i >= 0 && i < arr.length) ? arr[i] : ''; }

  // Vereinheitlicht einen Eintrag (Objekt oder GeoJSON-Feature) auf {id,name,lat,lon,note}.
  function normalizePoint(item) {
    if (!item || typeof item !== 'object') return null;
    var src = item, lat = null, lon = null;

    if (item.type === 'Feature') {
      src = item.properties || {};
      var g = item.geometry;
      if (g && g.type === 'Point' && Array.isArray(g.coordinates)) {
        lon = numOrNull(g.coordinates[0]);
        lat = numOrNull(g.coordinates[1]);
      }
    }
    if (lat == null) lat = numOrNull(pick(src, ['lat', 'latitude', 'breite', 'breitengrad', 'y']));
    if (lon == null) lon = numOrNull(pick(src, ['lon', 'lng', 'long', 'longitude', 'laenge', 'länge', 'längengrad', 'x']));

    if (lat == null || lon == null) {
      var combined = pick(src, ['koordinaten', 'coords', 'coordinates', 'position']);
      if (typeof combined === 'string') {
        var c = parseCoords(combined);
        if (c) { lat = c.lat; lon = c.lon; }
      }
    }
    if (!inRange(lat, lon)) return null;

    var id = str(pick(src, ['id', 'nr', 'nummer', 'kennung', 'rettungspunkt', 'code']));
    var name = str(pick(src, ['name', 'bezeichnung', 'titel', 'punkt', 'ort', 'beschreibung']));
    var note = str(pick(src, ['note', 'hinweis', 'bemerkung', 'info', 'zufahrt']));
    if (!id && !name) name = 'Ohne Namen';
    /* KEIN Vorgabewert „rp" mehr. Eine Zeile ohne Artangabe war bisher
       automatisch ein Rettungspunkt — damit wurde aus „T-1;Testpunkt A;50.2;7.2"
       ein geprüfter Rettungspunkt, den die App im Notfall angefahren hätte.
       Ohne Artangabe gilt jetzt „unknown"; der Import fragt die Art ab. */
    var kind = str(pick(src, ['kind', 'art', 'typ'])) || 'unknown';
    return { id: id, name: name, lat: lat, lon: lon, note: note, kind: kind };
  }

  function pick(o, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (o[k] != null && o[k] !== '') return o[k];
      // Groß-/Kleinschreibung ignorieren
      for (var kk in o) {
        if (Object.prototype.hasOwnProperty.call(o, kk) &&
            kk.toLowerCase() === k && o[kk] != null && o[kk] !== '') return o[kk];
      }
    }
    return null;
  }

  function numOrNull(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function str(v) { return v == null ? '' : String(v).trim(); }

  // Linienzug ausdünnen (Douglas-Peucker). 2099 Stützpunkte einer Route
  // brauchen wir nicht — auf 10 m genau reicht für einen Lageplan völlig.
  function simplify(punkte, toleranzMeter) {
    if (!punkte || punkte.length < 3) return punkte || [];
    var tol = (toleranzMeter || 10);
    var behalten = new Array(punkte.length);
    behalten[0] = behalten[punkte.length - 1] = true;

    function abstandZurLinie(p, a, b) {
      // grob in Meter, reicht für die Ausdünnung
      var mLat = 110540, mLon = 111320 * Math.cos(a[0] * Math.PI / 180);
      var px = (p[1] - a[1]) * mLon, py = (p[0] - a[0]) * mLat;
      var bx = (b[1] - a[1]) * mLon, by = (b[0] - a[0]) * mLat;
      var len2 = bx * bx + by * by;
      if (!len2) return Math.sqrt(px * px + py * py);
      var t = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
      var dx = px - t * bx, dy = py - t * by;
      return Math.sqrt(dx * dx + dy * dy);
    }

    (function teile(i, j) {
      if (j <= i + 1) return;
      var maxD = -1, maxI = -1;
      for (var k = i + 1; k < j; k++) {
        var d = abstandZurLinie(punkte[k], punkte[i], punkte[j]);
        if (d > maxD) { maxD = d; maxI = k; }
      }
      if (maxD > tol) { behalten[maxI] = true; teile(i, maxI); teile(maxI, j); }
    })(0, punkte.length - 1);

    return punkte.filter(function (_, i) { return behalten[i]; });
  }


  /* ---------- Wege aus einer Karte aufbereiten ----------
     Was in einer Google-My-Maps-Karte als „Zuwegung" gezeichnet ist, kommt im
     KML-Export nicht als ein Linienzug an. Bei der Baustelle Blatzheim steckten
     8274 einzelne LineStrings in EINER Platzmarke: eine gestrichelte Linie,
     Strich für Strich — im Schnitt 3,5 m Strich, 6,3 m Lücke. Roh gespeichert
     wären das 174 KB je Baustelle und im Lageplan ein Gewimmel aus Punkten.

     Zusätzlich enthalten solche Karten Ebenen, die gar keine Wege sind:
     „Mastnummern" (308 Linien) sind gezeichnete Ziffern, „Mastmittelpunkte"
     (76 Linien) gezeichnete Kreuze. Die längste davon misst 7 m.

     Deshalb: gleiche Striche zusammenfassen, Striche derselben Linie verketten,
     und alles unter 100 m verwerfen. Die Ziffern und Kreuze fallen dabei über
     ihre Länge heraus, nicht über ihren Namen — eine andere Baustelle darf ihre
     Ebenen nennen, wie sie will.

     Verkettet wird nur innerhalb einer Ebene und nur über Lücken bis 8 m. Bei
     Blatzheim wuchs die Gesamtlänge dadurch von 39,4 km auf 40,6 km (+3 %) —
     die überbrückten Lücken, nichts Erfundenes. Wer eine größere Toleranz
     setzt, verbindet irgendwann Wege, die sich nur nahekommen. */

  var STRICH_MAX     = 25;     // kürzer = Zeichenmuster, kein Wegabschnitt
  var WEG_LUECKE_M   = 8;      // größte Lücke, die als derselbe Strichzug gilt
  var WEG_MIN_M      = 100;    // kürzer ist kein Weg, sondern eine Zeichnung
  var WEG_MAX        = 300;    // Obergrenze, damit der Gerätespeicher reicht
  var WEG_NAHE_M     = 1000;   // weiter weg = gehört nicht zu dieser Baustelle
  var WEG_GENAUIGKEIT_M = 8;   // Ausdünnung für den Lageplan

  // Punkt auf halber Länge eines Strichs.
  function mitte(pts) {
    if (pts.length === 1) return pts[0];
    var ganz = wegLaenge(pts), halb = ganz / 2, l = 0;
    for (var i = 1; i < pts.length; i++) {
      var d = distance(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]);
      if (l + d >= halb && d > 0) {
        var t = (halb - l) / d;
        return [pts[i-1][0] + (pts[i][0] - pts[i-1][0]) * t,
                pts[i-1][1] + (pts[i][1] - pts[i-1][1]) * t];
      }
      l += d;
    }
    return pts[pts.length - 1];
  }

  function wegLaenge(pts) {
    var l = 0;
    for (var i = 1; i < pts.length; i++) l += distance(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]);
    return l;
  }

  /* Nachbarsuche über ein Gitter: ohne das wären es bei 4000 Strichen 16
     Millionen Abstandsrechnungen — auf einem Baustellenhandy zu langsam. */
  function gitter(zellenMeter) {
    var netz = {}, gLat = zellenMeter / 110540;
    var schluessel = function (p) {
      var gLon = zellenMeter / Math.max(1, 111320 * Math.cos(p[0] * Math.PI / 180));
      return Math.floor(p[0] / gLat) + ':' + Math.floor(p[1] / gLon);
    };
    return {
      ablegen: function (p, wert) {
        var k = schluessel(p);
        (netz[k] || (netz[k] = [])).push(wert);
      },
      umkreis: function (p) {
        var gLon = zellenMeter / Math.max(1, 111320 * Math.cos(p[0] * Math.PI / 180));
        var a = Math.floor(p[0] / gLat), b = Math.floor(p[1] / gLon), out = [];
        for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) {
          var z = netz[(a + i) + ':' + (b + j)];
          if (z) out = out.concat(z);
        }
        return out;
      }
    };
  }

  /* Kehrt der Anschlussstrich um mehr als 150° um, gehört er zur
     Gegenrichtung derselben gestrichelten Linie — nicht an diese Kette. */
  function kehrt(kurs, von, nach) {
    if (kurs == null) return false;
    if (von[0] === nach[0] && von[1] === nach[1]) return false;   // keine Richtung
    var neu = bearing(von[0], von[1], nach[0], nach[1]);
    // 0° = geradeaus weiter, 180° = zurueck denselben Weg.
    var d = Math.abs(((neu - kurs + 540) % 360) - 180);
    return d > 150;
  }

  /* „Style12" ist kein Wegname, sondern was Google My Maps hinterlässt, wenn
     beim Zeichnen keiner vergeben wurde. Dann ist der Name der Ebene
     („Zuwegungen") das Ehrlichere. Erfunden wird nichts. */
  function wegName(name, ebene) {
    var n = String(name || '').trim();
    if (!n || /^(style|linie|line|untitled|ohne titel)\s*\d*$/i.test(n)) return ebene || 'Weg';
    return n;
  }

  function wegeAufbereiten(lines, opts) {
    opts = opts || {};
    var luecke = opts.luecke != null ? opts.luecke : WEG_LUECKE_M;
    var minM   = opts.minLaenge != null ? opts.minLaenge : WEG_MIN_M;
    var max    = opts.max != null ? opts.max : WEG_MAX;
    var nahe   = opts.naheBei && opts.naheBei.length ? opts.naheBei : null;
    var naheM  = opts.naheM != null ? opts.naheM : WEG_NAHE_M;
    var genau  = opts.genauigkeit != null ? opts.genauigkeit : WEG_GENAUIGKEIT_M;

    var bericht = { roh: 0, doppelt: 0, verkettet: 0, zuKurz: 0, fremd: 0, beschnitten: 0, uebrig: 0,
                    gekappt: 0, laengeM: 0, luecke: luecke, minLaenge: minM };
    if (!lines || !lines.length) return { wege: [], bericht: bericht };
    bericht.roh = lines.length;

    // Nach Ebene trennen — Ebenen werden nie miteinander verkettet.
    var ebenen = {};
    lines.forEach(function (l) {
      if (!l || !l.punkte || l.punkte.length < 2) return;
      var e = l.folder || '';
      (ebenen[e] || (ebenen[e] = [])).push(l);
    });

    var alle = [];
    Object.keys(ebenen).forEach(function (name) {
      /* 1. Aus jedem Strichlein wird sein Mittelpunkt.

         Die kurzen Stücke sind keine Wegabschnitte, sondern das Muster, mit
         dem die Linie gezeichnet ist: In Blatzheim ist jedes 3,5 m lang, zeigt
         quer zur Fahrtrichtung und das nächste steht 5 m weiter — eine
         schraffierte Linie. Wer diese Striche aneinanderhängt, bekommt einen
         Zickzack und eine um zwei Drittel zu große Länge. Der Mittelpunkt
         jedes Strichs liegt dagegen auf der Wegachse, bei einer schraffierten
         wie bei einer gestrichelten Linie.

         Doppelt exportierte Striche fallen dabei von selbst zusammen. */
      var gesehen = {}, teile = [];
      var kk = function (p) { return p[0].toFixed(5) + ',' + p[1].toFixed(5); };
      ebenen[name].forEach(function (l) {
        var pts = l.punkte;
        if (wegLaenge(pts) < STRICH_MAX) pts = [mitte(pts)];
        var a = kk(pts[0]), b = kk(pts[pts.length - 1]);
        if (gesehen[a + '>' + b] || gesehen[b + '>' + a]) { bericht.doppelt++; return; }
        gesehen[a + '>' + b] = 1;
        teile.push({ name: l.name || 'Weg', punkte: pts });
      });

      // 2. Striche verketten, die aneinander anschließen.
      var netz = gitter(luecke);
      teile.forEach(function (t, i) {
        netz.ablegen(t.punkte[0], i);
        netz.ablegen(t.punkte[t.punkte.length - 1], i);
      });
      var benutzt = new Array(teile.length);

      for (var i = 0; i < teile.length; i++) {
        if (benutzt[i]) continue;
        benutzt[i] = true;
        var kette = teile[i].punkte.slice(), weiter = true;
        while (weiter) {
          weiter = false;
          for (var e = 1; e >= 0; e--) {                 // erst hinten, dann vorn
            var p = e ? kette[kette.length - 1] : kette[0];
            /* Richtung, in der die Kette gerade läuft. Ohne diese Prüfung
               hängt sich die Kette am Ende des Weges an die Striche der
               Gegenrichtung und läuft denselben Weg zurück: Die Länge wäre
               doppelt so groß wie in Wirklichkeit. */
            var her = e ? kette[kette.length - 2] : kette[1];
            var kurs = her ? bearing(her[0], her[1], p[0], p[1]) : null;
            var best = -1, bestD = luecke, umdrehen = false;
            netz.umkreis(p).forEach(function (j) {
              if (benutzt[j]) return;
              var s = teile[j].punkte;
              var d0 = distance(p[0], p[1], s[0][0], s[0][1]);
              var d1 = distance(p[0], p[1], s[s.length-1][0], s[s.length-1][1]);
              /* Richtung IMMER vom Kettenende zum fernen Ende des Anschlusses
                 messen. Ein Strich, der auf seinen Mittelpunkt zusammengefallen
                 ist, hat sonst gar keine eigene Richtung. */
              if (d0 < bestD && !kehrt(kurs, p, s[s.length-1])) { bestD = d0; best = j; umdrehen = false; }
              if (d1 < bestD && !kehrt(kurs, p, s[0])) { bestD = d1; best = j; umdrehen = true; }
            });
            if (best < 0) continue;
            benutzt[best] = true;
            bericht.verkettet++;
            var st = teile[best].punkte.slice();
            if (umdrehen) st.reverse();
            kette = e ? kette.concat(st) : st.reverse().concat(kette);
            weiter = true;
            break;
          }
        }
        alle.push({ name: teile[i].name, folder: name, punkte: kette, laenge: wegLaenge(kette) });
      }
    });

    // 3. Zu kurz = keine Wegstrecke (Ziffern, Kreuze, Reste).
    var lang = alle.filter(function (w) {
      if (w.laenge >= minM) return true;
      bericht.zuKurz++;
      return false;
    });

    /* 4. Auf die Umgebung der Baustelle beschneiden.

       In der Pillig-Karte steckt eine 53 km lange Linie quer durch die Eifel
       und eine gespeicherte Autoroute nach Kaisersesch. Im Lageplan sah beides
       aus wie ein Weg zum Rettungspunkt. Ein einzelner Berührungspunkt reicht
       als Zugehörigkeit nicht — die Linie streift unterwegs auch eine Klinik.
       Deshalb bleibt nur, was wirklich in der Nähe verläuft; der Rest fällt
       gleich danach durch die Mindestlänge heraus.

       Gemessen wird gegen die Punkte der Baustelle, nicht gegen deren Mitte:
       eine Freileitung ist zehn Kilometer lang. */
    if (nahe) {
      var beschnitten = [];
      lang.forEach(function (w) {
        var lauf = [], teile = [];
        w.punkte.forEach(function (q) {
          var dran = nahe.some(function (z) { return distance(q[0], q[1], z[0], z[1]) <= naheM; });
          if (dran) { lauf.push(q); return; }
          if (lauf.length >= 2) teile.push(lauf);
          lauf = [];
        });
        if (lauf.length >= 2) teile.push(lauf);
        if (!teile.length) { bericht.fremd++; return; }
        if (teile.length === 1 && teile[0].length === w.punkte.length) { beschnitten.push(w); return; }
        bericht.beschnitten++;
        teile.forEach(function (t) {
          beschnitten.push({ name: w.name, folder: w.folder, punkte: t, laenge: wegLaenge(t) });
        });
      });
      // Ein Rest unter der Mindestlänge war nie ein Weg dieser Baustelle.
      lang = beschnitten.filter(function (w) {
        if (w.laenge >= minM) return true;
        bericht.zuKurz++;
        return false;
      });
    }

    // 5. Längste zuerst — wenn gekappt werden muss, fällt Unwichtiges weg.
    lang.sort(function (a, b) { return b.laenge - a.laenge; });
    if (lang.length > max) { bericht.gekappt = lang.length - max; lang = lang.slice(0, max); }

    var wege = lang.map(function (w) {
      var pts = simplify(w.punkte, genau);
      return {
        name: wegName(w.name, w.folder),
        folder: w.folder,
        // Viele Stützpunkte = aus einer Routenberechnung, folgt also echten
        // Straßen. Wenige = jemand hat die Linie grob per Hand gezogen.
        art: pts.length >= 20 ? 'strasse' : 'linie',
        laenge: Math.round(w.laenge),
        punkte: pts.map(function (q) {
          return [Math.round(q[0] * 1e6) / 1e6, Math.round(q[1] * 1e6) / 1e6];
        })
      };
    });

    bericht.uebrig = wege.length;
    bericht.laengeM = Math.round(wege.reduce(function (a, w) { return a + w.laenge; }, 0));
    return { wege: wege, bericht: bericht };
  }

  /* ---------- Nächste Punkte ---------- */

  // Punkte um die Position anreichern und nach Entfernung sortieren.
  function nearest(points, lat, lon, limit) {
    var list = (points || []).map(function (p) {
      var d = distance(lat, lon, p.lat, p.lon);
      var b = bearing(lat, lon, p.lat, p.lon);
      return Object.assign({}, p, { dist: d, bearing: b, compass: compass(b) });
    });
    list.sort(function (a, b) { return a.dist - b.dist; });
    return limit ? list.slice(0, limit) : list;
  }

  /* ---------- Notruf-Meldung ---------- */

  // Kompletter Text zum Vorlesen/Weitergeben an die Leitstelle.
  /* Meldung für die Leitstelle. Reihenfolge nach dem, was die Leitstelle
     zuerst braucht: wohin sie fahren soll, dann wo der Verletzte liegt.
     Ungeprüfte Daten kommen hier nie ohne Warnung hinein. */
  function emergencyText(pos, point, opts) {
    opts = opts || {};
    var L = [];
    if (opts.vorschau) {
      L.push('*** VORSCHAU — BEISPIELSTANDORT, NICHT VERWENDEN ***');
      L.push('');
    }
    if (opts.manuell) {
      // Die Leitstelle muss wissen, woher die Koordinaten stammen. Ein von Hand
      // gewählter Punkt ist gut genug zum Anfahren, aber er ist nicht gemessen.
      L.push('*** STANDORT VON HAND ANGEGEBEN — NICHT VOM GPS GEMESSEN ***');
      L.push('');
    } else if (opts.veraltet) {
      // Ein alter Standort ist besser als keiner — aber nur mit Uhrzeit dabei.
      L.push('*** ACHTUNG: LETZTER BEKANNTER STANDORT VON ' + opts.veraltet +
             ' — NICHT AKTUELL ***');
      L.push('');
    }
    L.push('NOTFALL — Standortmeldung');
    if (opts.site) L.push('Baustelle: ' + opts.site);

    if (point) {
      L.push('');
      L.push('ANFAHRT ÜBER: ' + shortLabel(point).toUpperCase());
      if (officialLabel(point)) L.push('  Bezeichnung: ' + officialLabel(point));
      L.push('  Dezimalgrad: ' + formatDec(point.lat, point.lon));
      L.push('  Grad/Min:    ' + formatDDM(point.lat, point.lon));
      L.push('  UTM:         ' + toUTM(point.lat, point.lon).text);
      if (point.dist != null) {
        L.push('  Entfernung:  ' + formatDistance(point.dist) + ' Richtung ' + compass(point.bearing) + ' von uns');
      }
      if (point.note) L.push('  Hinweis:     ' + point.note);
      /* Die Leitstelle fährt diese Koordinaten an. Sie soll wissen, dass sie aus
         einer Karte stammen und nicht eingemessen sind — am Ziel zählt die
         Markierung vor Ort, nicht die letzte Nachkommastelle. */
      L.push('  Herkunft:    aus der Baustellenkarte, geringe Abweichung möglich');
      if (point.verified === false) L.push('  ACHTUNG: Dieser Punkt ist UNGEPRÜFT — vor Ort bestätigen!');
    } else {
      L.push('');
      L.push('ANFAHRT ÜBER: KEIN GEPRÜFTER RETTUNGSPUNKT VERFÜGBAR');
      L.push('  Koordinaten der Unfallstelle durchgeben (siehe unten).');
    }

    L.push('');
    if (pos) {
      L.push(opts.manuell
        ? 'UNFALLSTELLE (von Hand angegeben: ' + opts.manuell + ')'
        : 'UNFALLSTELLE (eigener Standort)');
      L.push('  Dezimalgrad: ' + formatDec(pos.lat, pos.lon));
      L.push('  Grad/Min:    ' + formatDDM(pos.lat, pos.lon));
      L.push('  UTM:         ' + toUTM(pos.lat, pos.lon).text);
      if (opts.manuell) {
        L.push('  Herkunft:    von Hand gewählt (' + opts.manuell + '), GPS war nicht verfügbar');
      } else if (opts.veraltet) {
        L.push('  Herkunft:    letzte GPS-Messung um ' + opts.veraltet + ' — Person kann sich bewegt haben');
        if (pos.accuracy != null) L.push('  Genauigkeit: ' + formatAccuracy(pos.accuracy) + ' (damals)');
      } else if (pos.accuracy != null) {
        L.push('  Genauigkeit: ' + formatAccuracy(pos.accuracy));
      }
      if (opts.gemessen) L.push('  Gemessen:    ' + opts.gemessen);
      if (pos.accuracy != null && pos.accuracy > 50) {
        L.push('  ACHTUNG: Standort nur auf ' + formatAccuracy(pos.accuracy) + ' genau.');
      }
    } else {
      L.push('UNFALLSTELLE: Standort nicht verfügbar (Ortung nicht aktiviert)');
    }

    // Auf Freileitungsbaustellen ist der Mast die verständlichste Ortsangabe —
    // aber nur, wenn er eine echte Mastnummer hat.
    if (opts.mast) {
      L.push('  Nächster Mast: ' + pointLabel(opts.mast) +
             (opts.mast.dist != null ? ' (' + formatDistance(opts.mast.dist) + ' ' + compass(opts.mast.bearing) + ')' : ''));
    }
    if (opts.time) L.push('  Meldung erstellt: ' + opts.time);

    L.push('');
    L.push('FRAGEN DER LEITSTELLE');
    L.push('  1. Wo?              Rettungspunkt nennen, Koordinaten vorlesen');
    L.push('  2. Was ist passiert?');
    L.push('  3. Wie viele Verletzte?');
    L.push('  4. Welche Verletzungen?');
    L.push('  5. Warten — die Leitstelle beendet das Gespräch.');
    return L.join('\n');
  }

  // Kurzname für die Anzeige: „Rettungspunkt Spie 2/4225" → „Rettungspunkt 2".
  // Das ist der Name, den man am Telefon nennt. Die vollständige Bezeichnung
  // aus der Karte geht nie verloren — sie steht daneben und in der Meldung.
  function rpNumber(p) {
    var n = (p && p.name) || '';
    var m = n.match(/rettungspunk\w*\D*?(\d+)/i);
    if (m) return m[1];
    // In der Karte heißen manche Rettungspunkte nur „Punkt 11" oder „Ponto 15".
    if (p && p.kind === 'rp') {
      m = n.match(/^\s*(?:punkt|pkt\.?|ponto|point|to[čc]ka)\s*\.?\s*(\d+)\s*$/i);
      if (m) return m[1];
    }
    return null;
  }

  function shortLabel(p) {
    var nr = rpNumber(p);
    return nr != null ? 'Rettungspunkt ' + nr : pointLabel(p);
  }

  // Zusatzzeile: die amtliche Bezeichnung, aber nur wenn sie etwas hinzufügt.
  function officialLabel(p) {
    var full = pointLabel(p);
    return (full === shortLabel(p)) ? '' : full;
  }

  function pointLabel(p) {
    if (!p) return '';
    if (p.id && p.name) return p.id + ' — ' + p.name;
    return p.id || p.name || 'Rettungspunkt';
  }

  return {
    distance: distance,
    bearing: bearing,
    compass: compass,
    formatDistance: formatDistance,
    formatAccuracy: formatAccuracy,
    formatDec: formatDec,
    formatDDM: formatDDM,
    formatDMS: formatDMS,
    toUTM: toUTM,
    utmZone: utmZone,
    utmBand: utmBand,
    parseCoords: parseCoords,
    parsePoints: parsePoints,
    parseKml: parseKml,
    simplify: simplify,
    wegeAufbereiten: wegeAufbereiten,
    classify: classify,
    myMapsKmlUrl: myMapsKmlUrl,
    normalizePoint: normalizePoint,
    nearest: nearest,
    emergencyText: emergencyText,
    pointLabel: pointLabel,
    shortLabel: shortLabel,
    officialLabel: officialLabel,
    rpNumber: rpNumber
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpieGeo;
