/* speicher.js — Ablage für Dokumente, Mastdaten und Regulierwerte.

   WARUM NICHT localStorage:
   Punkte, Nummern und Wege liegen weiterhin in localStorage — das sind
   Kilobytes. Ein Gründungsplan ist ein Megabyte, und localStorage ist auf
   wenige Megabyte begrenzt und speichert nur Text. Achtzig Pläne einer
   Baustelle bringen es zum Überlaufen, und zwar leise: Der Schreibfehler
   käme mitten im Import. Dokumente gehören deshalb in IndexedDB, wo sie als
   Datei liegen, nicht als Zeichenkette.

   Alles hier ist auf viele Baustellen mit tausenden Masten und Dokumenten
   ausgelegt: Es wird nie die ganze Ablage gelesen, sondern immer über einen
   Index genau das, was gebraucht wird.

   Im Browser hängt es als window.SpieSpeicher.
*/
var SpieSpeicher = (function () {
  'use strict';

  var DB_NAME = 'spie-baustelle';
  var DB_VERSION = 2;   // 2: Spanntabellen
  var db = null, oeffnend = null;

  function verfuegbar() {
    try { return typeof indexedDB !== 'undefined' && !!indexedDB; }
    catch (e) { return false; }
  }

  function bereit() {
    if (db) return Promise.resolve(db);
    if (oeffnend) return oeffnend;
    if (!verfuegbar()) return Promise.reject(new Error('Dieses Gerät bietet keine Dateiablage (IndexedDB).'));
    oeffnend = new Promise(function (ja, nein) {
      var a = indexedDB.open(DB_NAME, DB_VERSION);
      a.onupgradeneeded = function (e) {
        var d = a.result;
        if (!d.objectStoreNames.contains('dokumente')) {
          var dok = d.createObjectStore('dokumente', { keyPath: 'id' });
          // Über diese Indexe laufen alle Abfragen — nie ein voller Durchlauf.
          dok.createIndex('baustelle', 'baustelle', { unique: false });
          dok.createIndex('mast', ['baustelle', 'mastSchluessel'], { unique: false });
        }
        // Die Dateien liegen getrennt von ihren Angaben: Eine Liste von 500
        // Dokumenten soll nicht 500 Megabyte durch den Speicher ziehen.
        if (!d.objectStoreNames.contains('dateien')) {
          d.createObjectStore('dateien', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('mastdaten')) {
          d.createObjectStore('mastdaten', { keyPath: ['baustelle', 'mastSchluessel'] });
        }
        if (!d.objectStoreNames.contains('werte')) {
          var w = d.createObjectStore('werte', { keyPath: 'id' });
          w.createIndex('mast', ['baustelle', 'mastSchluessel'], { unique: false });
          w.createIndex('baustelle', 'baustelle', { unique: false });
        }
        if (!d.objectStoreNames.contains('einstellungen')) {
          d.createObjectStore('einstellungen', { keyPath: 'schluessel' });
        }
        /* Spanntabellen (Reguliermaße) je Baustelle. Eigener Speicher, weil
           eine Tabelle mehrere hundert Kilobyte hat und nichts davon in die
           Rettung eingeht — sie darf den Start nie aufhalten. */
        if (!d.objectStoreNames.contains('spanntabellen')) {
          var sp = d.createObjectStore('spanntabellen', { keyPath: ['baustelle', 'id'] });
          sp.createIndex('baustelle', 'baustelle', { unique: false });
        }
      };
      a.onsuccess = function () { db = a.result; ja(db); };
      a.onerror = function () { oeffnend = null; nein(a.error || new Error('Ablage nicht zu öffnen')); };
      a.onblocked = function () { nein(new Error('Ablage von einem anderen Fenster blockiert')); };
    });
    return oeffnend;
  }

  function lauf(stores, modus, arbeit) {
    return bereit().then(function (d) {
      return new Promise(function (ja, nein) {
        var t = d.transaction(stores, modus);
        var ergebnis;
        t.oncomplete = function () { ja(ergebnis); };
        t.onerror = function () { nein(t.error || new Error('Ablage-Fehler')); };
        t.onabort = function () { nein(t.error || new Error('Ablage abgebrochen')); };
        try { ergebnis = arbeit(t); } catch (e) { try { t.abort(); } catch (e2) {} nein(e); }
      });
    });
  }

  function anfrage(req) {
    return new Promise(function (ja, nein) {
      req.onsuccess = function () { ja(req.result); };
      req.onerror = function () { nein(req.error); };
    });
  }

  function kennung() {
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- Dokumente ---------- */

  /* Ablegen heißt: Angaben und Datei in EINEM Vorgang. Bricht er ab, ist
     nichts halb da — kein Eintrag ohne Datei, keine Datei ohne Eintrag. */
  /* Dateien werden als rohe Bytes abgelegt, nicht als Blob.

     Grund: Nicht jede Browser-Maschine nimmt einen Blob in der Ablage an —
     in der WebKit-Maschine der Prüfungen scheitert genau das, und zwar mit
     einem leeren Fehler, der die ganze Ablage blockiert. Bytes nimmt jede.
     Der Dateityp steht daneben, statt im Blob zu stecken; damit ist er auch
     dann noch da, wenn er beim Import gefehlt hat — das iPhone zeigt sonst
     „Unknown" statt des Plans.

     Ältere Ablagen enthalten noch Blobs; dateiHolen kommt mit beidem klar. */
  function alsBytes(datei) {
    if (!datei) return Promise.resolve(null);
    if (datei instanceof ArrayBuffer) return Promise.resolve(datei);
    if (datei.buffer && typeof datei.byteLength === 'number') {
      return Promise.resolve(datei.slice().buffer);      // eigene Kopie, kein Ausschnitt
    }
    if (typeof datei.arrayBuffer === 'function') return datei.arrayBuffer();
    return Promise.resolve(null);
  }

  function dokAblegen(dok, datei) {
    var eintrag = {
      id: dok.id || kennung(),
      baustelle: String(dok.baustelle || ''),
      mastSchluessel: String(dok.mastSchluessel || ''),
      kategorie: dok.kategorie || 'sonstiges',
      revision: dok.revision || '',
      datum: dok.datum || '',
      status: dok.status || '',
      bemerkung: dok.bemerkung || '',
      dateiname: dok.dateiname || (datei && datei.name) || '',
      mime: (datei && datei.type) || dok.mime || '',
      groesse: (datei && datei.size) || dok.groesse || 0,
      art: dok.art || '',
      abgelegt: dok.abgelegt || Date.now()
    };
    return alsBytes(datei).then(function (bytes) {
      if (bytes && !eintrag.groesse) eintrag.groesse = bytes.byteLength;
      return lauf(['dokumente', 'dateien'], 'readwrite', function (t) {
        t.objectStore('dokumente').put(eintrag);
        if (bytes) {
          t.objectStore('dateien').put({ id: eintrag.id, bytes: bytes, mime: eintrag.mime });
        }
        return eintrag;
      });
    });
  }

  function dokAendern(id, aenderung) {
    return lauf(['dokumente'], 'readwrite', function (t) {
      var s = t.objectStore('dokumente');
      s.get(id).onsuccess = function (e) {
        var d = e.target.result;
        if (!d) return;
        Object.keys(aenderung).forEach(function (k) { d[k] = aenderung[k]; });
        s.put(d);
      };
    });
  }

  function dokLoeschen(id) {
    return lauf(['dokumente', 'dateien'], 'readwrite', function (t) {
      t.objectStore('dokumente').delete(id);
      t.objectStore('dateien').delete(id);
    });
  }

  function dokVonMast(baustelle, mastSchluessel) {
    return bereit().then(function (d) {
      return anfrage(d.transaction('dokumente').objectStore('dokumente')
        .index('mast').getAll([String(baustelle), String(mastSchluessel)]));
    });
  }

  function dokVonBaustelle(baustelle) {
    return bereit().then(function (d) {
      return anfrage(d.transaction('dokumente').objectStore('dokumente')
        .index('baustelle').getAll(String(baustelle)));
    });
  }

  /* Nur zählen, nicht laden: Für die Übersicht reicht die Zahl, und bei
     tausenden Dokumenten will man sie nicht alle im Speicher haben. */
  function dokZaehlen(baustelle) {
    return bereit().then(function (d) {
      return anfrage(d.transaction('dokumente').objectStore('dokumente')
        .index('baustelle').count(String(baustelle)));
    });
  }

  function dateiHolen(id) {
    return bereit().then(function (d) {
      return anfrage(d.transaction('dateien').objectStore('dateien').get(id));
    }).then(function (e) {
      if (!e) return null;
      if (e.bytes) return new Blob([e.bytes], { type: e.mime || '' });
      return e.datei || null;                 // ältere Ablage: dort steckt ein Blob
    });
  }

  /* ---------- Mastdaten (Typ, Abschnitt, Status, Bemerkung) ---------- */

  function mastdatenHolen(baustelle, mastSchluessel) {
    return bereit().then(function (d) {
      return anfrage(d.transaction('mastdaten').objectStore('mastdaten')
        .get([String(baustelle), String(mastSchluessel)]));
    }).then(function (m) { return m || null; });
  }

  function mastdatenSetzen(baustelle, mastSchluessel, daten) {
    var e = { baustelle: String(baustelle), mastSchluessel: String(mastSchluessel) };
    Object.keys(daten || {}).forEach(function (k) {
      if (k !== 'baustelle' && k !== 'mastSchluessel') e[k] = daten[k];
    });
    e.geaendert = Date.now();
    return lauf(['mastdaten'], 'readwrite', function (t) {
      t.objectStore('mastdaten').put(e);
      return e;
    });
  }

  function mastdatenAlle(baustelle) {
    return bereit().then(function (d) {
      return anfrage(d.transaction('mastdaten').objectStore('mastdaten').getAll());
    }).then(function (liste) {
      return (liste || []).filter(function (m) { return m.baustelle === String(baustelle); });
    });
  }

  /* ---------- Spanntabellen ----------
     Abgelegt wird, was der Auftraggeber berechnet hat — unverändert. Die
     App ergänzt nur, zu welcher Baustelle und wann es importiert wurde. */

  function spannSetzen(baustelle, tabelle) {
    /* Ohne eigene Kennung landen alle Tabellen auf demselben Platz — aus
       fünf wird eine, und niemand merkt es. Lieber laut abbrechen. */
    var id = (tabelle && tabelle.id != null) ? String(tabelle.id) : '';
    if (!id || id === 'undefined' || id === 'null') {
      return Promise.reject(new Error('Spanntabelle ohne Kennung — nicht gespeichert'));
    }
    var satz = { baustelle: String(baustelle), id: id,
                 importiert: new Date().toISOString(), tabelle: tabelle };
    return lauf(['spanntabellen'], 'readwrite', function (t) {
      t.objectStore('spanntabellen').put(satz);
    }).then(function () { return satz; });
  }

  function spannVonBaustelle(baustelle) {
    var id = String(baustelle);
    return bereit().then(function (d) {
      return anfrage(d.transaction('spanntabellen').objectStore('spanntabellen')
        .index('baustelle').getAll(IDBKeyRange.only(id)));
    }).then(function (l) { return l || []; });
  }

  function spannLoeschen(baustelle, id) {
    return lauf(['spanntabellen'], 'readwrite', function (t) {
      t.objectStore('spanntabellen').delete([String(baustelle), String(id)]);
    });
  }

  /* ---------- Regulierwerte ---------- */

  function werteVonMast(baustelle, mastSchluessel) {
    return bereit().then(function (d) {
      return anfrage(d.transaction('werte').objectStore('werte')
        .index('mast').getAll([String(baustelle), String(mastSchluessel)]));
    });
  }

  function werteVonBaustelle(baustelle) {
    return bereit().then(function (d) {
      return anfrage(d.transaction('werte').objectStore('werte')
        .index('baustelle').getAll(String(baustelle)));
    });
  }

  function wertSetzen(wert) {
    var e = {
      id: wert.id || kennung(),
      baustelle: String(wert.baustelle || ''),
      mastSchluessel: String(wert.mastSchluessel || ''),
      bezeichnung: wert.bezeichnung || '',
      soll: wert.soll == null ? '' : wert.soll,
      ist: wert.ist == null ? '' : wert.ist,
      einheit: wert.einheit || '',
      toleranz: wert.toleranz == null ? '' : wert.toleranz,
      messdatum: wert.messdatum || '',
      bearbeiter: wert.bearbeiter || '',
      bemerkung: wert.bemerkung || '',
      status: wert.status || 'offen',
      geaendert: Date.now()
    };
    return lauf(['werte'], 'readwrite', function (t) {
      t.objectStore('werte').put(e);
      return e;
    });
  }

  function wertLoeschen(id) {
    return lauf(['werte'], 'readwrite', function (t) { t.objectStore('werte').delete(id); });
  }

  /* ---------- Einstellungen (z. B. eigene Dokumentkategorien) ---------- */

  function einstellungHolen(schluessel) {
    return bereit().then(function (d) {
      return anfrage(d.transaction('einstellungen').objectStore('einstellungen').get(String(schluessel)));
    }).then(function (e) { return e ? e.wert : null; });
  }

  function einstellungSetzen(schluessel, wert) {
    return lauf(['einstellungen'], 'readwrite', function (t) {
      t.objectStore('einstellungen').put({ schluessel: String(schluessel), wert: wert });
    });
  }

  /* ---------- Baustelle löschen ----------
     Wird eine Baustelle entfernt, müssen ihre Dokumente mitgehen. Sonst
     belegen Pläne einer abgeschlossenen Baustelle den Speicher weiter. */
  function baustelleLeeren(baustelle) {
    var id = String(baustelle);
    return dokVonBaustelle(id).then(function (dokumente) {
      var ids = dokumente.map(function (d) { return d.id; });
      return lauf(['dokumente', 'dateien', 'werte', 'mastdaten', 'spanntabellen'], 'readwrite', function (t) {
        var dok = t.objectStore('dokumente'), dat = t.objectStore('dateien');
        ids.forEach(function (x) { dok.delete(x); dat.delete(x); });
        var w = t.objectStore('werte').index('baustelle').openCursor(IDBKeyRange.only(id));
        w.onsuccess = function (e) { var c = e.target.result; if (c) { c.delete(); c.continue(); } };
        var m = t.objectStore('mastdaten').openCursor();
        m.onsuccess = function (e) {
          var c = e.target.result;
          if (!c) return;
          if (c.value && c.value.baustelle === id) c.delete();
          c.continue();
        };
        var sp = t.objectStore('spanntabellen').index('baustelle').openCursor(IDBKeyRange.only(id));
        sp.onsuccess = function (e) { var c = e.target.result; if (c) { c.delete(); c.continue(); } };
        return ids.length;
      });
    });
  }

  /* ---------- Platz ----------
     Ehrlich bleiben: Auf dem iPhone kann das System die Ablage einer Website
     räumen, wenn der Platz knapp wird. „persist" bittet darum, das nicht zu
     tun — mehr als bitten geht nicht, und die Antwort wird weitergereicht. */
  function platzSichern() {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(null);
    return navigator.storage.persist().then(function (ja) { return !!ja; })
      .catch(function () { return null; });
  }

  function platzInfo() {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
    return navigator.storage.estimate().then(function (e) {
      return { benutzt: e.usage || 0, gesamt: e.quota || 0 };
    }).catch(function () { return null; });
  }

  return {
    verfuegbar: verfuegbar,
    bereit: bereit,
    kennung: kennung,
    dokAblegen: dokAblegen,
    dokAendern: dokAendern,
    dokLoeschen: dokLoeschen,
    dokVonMast: dokVonMast,
    dokVonBaustelle: dokVonBaustelle,
    dokZaehlen: dokZaehlen,
    dateiHolen: dateiHolen,
    mastdatenHolen: mastdatenHolen,
    mastdatenSetzen: mastdatenSetzen,
    mastdatenAlle: mastdatenAlle,
    spannSetzen: spannSetzen,
    spannVonBaustelle: spannVonBaustelle,
    spannLoeschen: spannLoeschen,
    werteVonMast: werteVonMast,
    werteVonBaustelle: werteVonBaustelle,
    wertSetzen: wertSetzen,
    wertLoeschen: wertLoeschen,
    einstellungHolen: einstellungHolen,
    einstellungSetzen: einstellungSetzen,
    baustelleLeeren: baustelleLeeren,
    platzSichern: platzSichern,
    platzInfo: platzInfo
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpieSpeicher;
