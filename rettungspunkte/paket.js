/* paket.js — eine ganze Baustelle als EINE Datei.

   WARUM:
   Dokumente liegen im Gerät, auf dem sie abgelegt wurden. Der Weg vom Büro
   auf die Baustelle fehlt. Eine gemeinsame Ablage (SPIE-Cloud) ist die
   richtige Lösung, aber sie ist eine Entscheidung anderer Leute und kann
   dauern. Bis dahin — und danach als Inhalt genau dieses Ordners — gibt es
   das Baustellenpaket: Punkte, Nummern, Wege, Mastdaten, Regulierwerte und
   alle Dokumente in einer Datei.

   WARUM ZIP UND NICHT JSON:
   Achtzig Pläne sind achtzig Megabyte. In JSON müssten sie als Base64 stehen
   — ein Drittel mehr, und der Browser müsste die ganze Zeichenkette am Stück
   bauen. Ein ZIP nimmt die Dateien, wie sie sind.

   WARUM OHNE PACKEN:
   PDF und JPG sind bereits gepackt; sie noch einmal zu packen kostet Zeit und
   spart nichts. Die Einträge liegen deshalb „stored". Gelesen wird trotzdem
   auch gepacktes ZIP (Methode 8) — jemand wird das Paket am PC öffnen, etwas
   ändern und neu packen.

   Reine Logik, kein DOM: läuft unter node und lässt sich dort prüfen.
*/
var SpiePaket = (function () {
  'use strict';

  var CRC = (function () {
    var t = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function text2bytes(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128) out.push(c);
      else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
      else out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return new Uint8Array(out);
  }

  function bytes2text(b) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(b);
    var s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return decodeURIComponent(escape(s));
  }

  function zuBytes(x) {
    if (x instanceof Uint8Array) return Promise.resolve(x);
    if (x instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(x));
    if (typeof Blob !== 'undefined' && x instanceof Blob) {
      return x.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    }
    if (typeof x === 'string') return Promise.resolve(text2bytes(x));
    return Promise.reject(new Error('Unbekannte Datenart im Paket'));
  }

  function schreibe32(a, i, v) { a[i] = v & 255; a[i+1] = (v>>>8) & 255; a[i+2] = (v>>>16) & 255; a[i+3] = (v>>>24) & 255; }
  function schreibe16(a, i, v) { a[i] = v & 255; a[i+1] = (v>>>8) & 255; }
  function lies32(a, i) { return (a[i] | (a[i+1]<<8) | (a[i+2]<<16) | (a[i+3]<<24)) >>> 0; }
  function lies16(a, i) { return a[i] | (a[i+1]<<8); }

  /* ---------- ZIP schreiben ---------- */

  function zipBauen(eintraege) {
    return Promise.all(eintraege.map(function (e) {
      return zuBytes(e.daten).then(function (b) {
        return { name: text2bytes(e.name), daten: b, crc: crc32(b) };
      });
    })).then(function (liste) {
      var teile = [], zentral = [], offset = 0;
      liste.forEach(function (e) {
        var kopf = new Uint8Array(30 + e.name.length);
        schreibe32(kopf, 0, 0x04034b50);
        schreibe16(kopf, 4, 20);            // benötigte Fassung
        schreibe16(kopf, 6, 0x0800);        // Bit 11: Namen sind UTF-8
        schreibe16(kopf, 8, 0);             // Methode 0 = ohne Packen
        schreibe16(kopf, 10, 0); schreibe16(kopf, 12, 0);   // Zeit/Datum: nicht erfinden
        schreibe32(kopf, 14, e.crc);
        schreibe32(kopf, 18, e.daten.length);
        schreibe32(kopf, 22, e.daten.length);
        schreibe16(kopf, 26, e.name.length);
        schreibe16(kopf, 28, 0);
        kopf.set(e.name, 30);
        teile.push(kopf, e.daten);

        var z = new Uint8Array(46 + e.name.length);
        schreibe32(z, 0, 0x02014b50);
        schreibe16(z, 4, 20); schreibe16(z, 6, 20);
        schreibe16(z, 8, 0x0800);
        schreibe16(z, 10, 0);
        schreibe16(z, 12, 0); schreibe16(z, 14, 0);
        schreibe32(z, 16, e.crc);
        schreibe32(z, 20, e.daten.length);
        schreibe32(z, 24, e.daten.length);
        schreibe16(z, 28, e.name.length);
        schreibe32(z, 42, offset);
        z.set(e.name, 46);
        zentral.push(z);
        offset += kopf.length + e.daten.length;
      });

      var zLaenge = zentral.reduce(function (a, z) { return a + z.length; }, 0);
      var ende = new Uint8Array(22);
      schreibe32(ende, 0, 0x06054b50);
      schreibe16(ende, 8, liste.length);
      schreibe16(ende, 10, liste.length);
      schreibe32(ende, 12, zLaenge);
      schreibe32(ende, 16, offset);
      return teile.concat(zentral, [ende]);
    });
  }

  /* ---------- ZIP lesen ---------- */

  function entpacken(bytes, methode) {
    if (methode === 0) return Promise.resolve(bytes);
    if (methode === 8 && typeof DecompressionStream !== 'undefined') {
      var s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    }
    return Promise.reject(new Error('Dieses Paket ist gepackt und lässt sich hier nicht öffnen.'));
  }

  function zipLesen(quelle) {
    return zuBytes(quelle).then(function (b) {
      // Das Ende-Verzeichnis steht hinten; davor darf ein Kommentar stehen.
      var e = -1;
      for (var i = b.length - 22; i >= 0 && i > b.length - 22 - 65536; i--) {
        if (lies32(b, i) === 0x06054b50) { e = i; break; }
      }
      if (e < 0) throw new Error('Das ist kein Baustellenpaket (ZIP-Ende fehlt).');
      var anzahl = lies16(b, e + 10);
      var start = lies32(b, e + 16);
      var aus = [], p = start;
      for (var n = 0; n < anzahl; n++) {
        if (lies32(b, p) !== 0x02014b50) throw new Error('Paket beschädigt (Verzeichnis).');
        var methode = lies16(b, p + 10);
        var groesse = lies32(b, p + 24);
        var nLen = lies16(b, p + 28), xLen = lies16(b, p + 30), kLen = lies16(b, p + 32);
        var off = lies32(b, p + 42);
        var name = bytes2text(b.subarray(p + 46, p + 46 + nLen));
        if (lies32(b, off) !== 0x04034b50) throw new Error('Paket beschädigt (' + name + ').');
        var lnLen = lies16(b, off + 26), lxLen = lies16(b, off + 28);
        var d0 = off + 30 + lnLen + lxLen;
        aus.push({ name: name, methode: methode, roh: b.subarray(d0, d0 + groesse) });
        p += 46 + nLen + xLen + kLen;
      }
      return Promise.all(aus.map(function (x) {
        return entpacken(x.roh, x.methode).then(function (d) { return { name: x.name, daten: d }; });
      }));
    });
  }

  /* ---------- Baustellenpaket ---------- */

  var PAKET_VERSION = 1;

  function dateiEndung(name) {
    var m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/);
    return m ? m[1] : 'bin';
  }

  /* daten: { titel, punkte, kontakte, wege, mastdaten, werte, dokumente }
     dateien: { dokumentId: Blob|Uint8Array } */
  function paketBauen(daten, dateien) {
    var kopf = {
      paketart: 'rettungspunkte-baustelle',
      paketVersion: PAKET_VERSION,
      erzeugt: daten.erzeugt || null,
      titel: daten.titel || '',
      punkte: daten.punkte || [],
      kontakte: daten.kontakte || [],
      wege: daten.wege || [],
      mastdaten: daten.mastdaten || [],
      werte: daten.werte || [],
      dokumente: (daten.dokumente || []).map(function (d) {
        var q = {}; for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) q[k] = d[k];
        q.datei = 'dateien/' + d.id + '.' + dateiEndung(d.dateiname);
        return q;
      })
    };
    var eintraege = [{ name: 'baustelle.json', daten: JSON.stringify(kopf, null, 1) }];
    kopf.dokumente.forEach(function (d) {
      var inhalt = dateien && dateien[d.id];
      if (inhalt) eintraege.push({ name: d.datei, daten: inhalt });
    });
    return zipBauen(eintraege);
  }

  function paketLesen(quelle) {
    return zipLesen(quelle).then(function (eintraege) {
      var nach = {};
      eintraege.forEach(function (e) { nach[e.name] = e.daten; });
      if (!nach['baustelle.json']) {
        throw new Error('Das ist kein Baustellenpaket (baustelle.json fehlt).');
      }
      var kopf;
      try { kopf = JSON.parse(bytes2text(nach['baustelle.json'])); }
      catch (e) { throw new Error('Das Paket ist beschädigt (baustelle.json unlesbar).'); }
      if (kopf.paketart !== 'rettungspunkte-baustelle') {
        throw new Error('Das ist kein Baustellenpaket dieser App.');
      }
      /* Neuere Pakete werden NICHT geöffnet: Lieber gar nichts als halb
         verstandene Daten in einer Notfall-App. */
      if ((kopf.paketVersion || 1) > PAKET_VERSION) {
        throw new Error('Dieses Paket stammt aus einer neueren Fassung der App. ' +
          'Bitte die App aktualisieren.');
      }
      var dateien = {}, fehlend = [];
      (kopf.dokumente || []).forEach(function (d) {
        if (d.datei && nach[d.datei]) dateien[d.id] = nach[d.datei];
        else fehlend.push(d.dateiname || d.id);
      });
      return { daten: kopf, dateien: dateien, fehlend: fehlend };
    });
  }

  return {
    PAKET_VERSION: PAKET_VERSION,
    crc32: crc32,
    zipBauen: zipBauen,
    zipLesen: zipLesen,
    paketBauen: paketBauen,
    paketLesen: paketLesen
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpiePaket;
