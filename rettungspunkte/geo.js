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

        // Linien (gespeicherte Routen, Trassenzüge) mitnehmen — das sind die
        // einzigen echten Wege, die die Karte hergibt.
        var lineM = block.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
        if (lineM) {
          var punkte = [];
          clean(lineM[1]).split(/\s+/).forEach(function (paar) {
            var t = paar.split(',');
            var lo = parseFloat(t[0]), la = parseFloat(t[1]);
            if (inRange(la, lo)) punkte.push([la, lo]);
          });
          if (punkte.length >= 2) {
            out.lines.push({ name: nameEarly ? clean(nameEarly[1]) : 'Weg', punkte: punkte, folder: f.name });
          }
          continue;
        }

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
