/* ============================================================
   Preisschmiede – Offline-Datenspeicher (Phase 14A)
   Dünne, versionierte Abstraktion über IndexedDB für dauerhaft
   gespeicherte Offline-Ereignisse und die Synchronisations-
   warteschlange. Läuft NUR im Browser. Fällt – falls IndexedDB
   nicht verfügbar ist – auf einen dauerhaften localStorage-Speicher
   zurück (ebenfalls neustartfest). KEINE reine In-Memory-Haltung.
   Migration erfolgt über onupgradeneeded (Schema Sync.DB_VERSION).
   ============================================================ */
(function (w) {
  "use strict";
  w.Preisschmiede = w.Preisschmiede || {};
  var DBNAME = "preisschmiede-offline";
  var STORES = ["records", "meta"]; // records: Ereignisse+Queue; meta: Geräte-/Zeitinfos
  function version() { return (w.Preisschmiede.Sync && w.Preisschmiede.Sync.DB_VERSION) || 1; }
  // IndexedDB unter file:// ist in Browsern unzuverlässig/blockiert (opaque
  // origin) -> dann dauerhafter localStorage-Speicher. Über http(s) IndexedDB.
  function hasIDB() { try { if (w.location && w.location.protocol === "file:") return false; return !!w.indexedDB; } catch (e) { return false; } }

  // ---- IndexedDB-Implementierung ------------------------------------
  var _dbp = null;
  function openIDB() {
    if (_dbp) return _dbp;
    _dbp = new Promise(function (resolve, reject) {
      var req = w.indexedDB.open(DBNAME, version());
      req.onupgradeneeded = function (ev) {
        var db = req.result;
        // Versionierte Migration: fehlende Stores anlegen (keine Datenverluste).
        STORES.forEach(function (s) { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === "meta" ? "key" : "id" }); });
        void ev;
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { /* anderer Tab hält alte Version – Nutzer informieren (offline-app.js) */ };
    });
    return _dbp;
  }
  function tx(store, mode, fn) {
    return openIDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode); var st = t.objectStore(store); var out = fn(st);
        t.oncomplete = function () { resolve(out && out._res !== undefined ? out._res : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error("tx abgebrochen")); };
      });
    });
  }
  function idbApi() {
    return {
      available: true, treiber: "indexeddb",
      put: function (store, obj) { return tx(store, "readwrite", function (st) { st.put(obj); return { _res: obj }; }); },
      get: function (store, key) { return tx(store, "readonly", function (st) { var r = st.get(key); var box = {}; r.onsuccess = function () { box._res = r.result || null; }; return box; }); },
      getAll: function (store) { return tx(store, "readonly", function (st) { var r = st.getAll(); var box = {}; r.onsuccess = function () { box._res = r.result || []; }; return box; }); },
      del: function (store, key) { return tx(store, "readwrite", function (st) { st.delete(key); return { _res: true }; }); },
      clear: function (store) { return tx(store, "readwrite", function (st) { st.clear(); return { _res: true }; }); }
    };
  }

  // ---- localStorage-Fallback (dauerhaft, neustartfest) --------------
  function lsKey(store) { return "preisschmiede.offline." + store; }
  function lsRead(store) { try { return JSON.parse(w.localStorage.getItem(lsKey(store)) || "[]"); } catch (e) { return []; } }
  function lsWrite(store, arr) { try { w.localStorage.setItem(lsKey(store), JSON.stringify(arr)); } catch (e) {} }
  function lsField(store) { return store === "meta" ? "key" : "id"; }
  function lsApi() {
    return {
      available: true, treiber: "localstorage",
      put: function (store, obj) { var f = lsField(store); var arr = lsRead(store).filter(function (x) { return x[f] !== obj[f]; }); arr.push(obj); lsWrite(store, arr); return Promise.resolve(obj); },
      get: function (store, key) { var f = lsField(store); return Promise.resolve(lsRead(store).filter(function (x) { return x[f] === key; })[0] || null); },
      getAll: function (store) { return Promise.resolve(lsRead(store)); },
      del: function (store, key) { var f = lsField(store); lsWrite(store, lsRead(store).filter(function (x) { return x[f] !== key; })); return Promise.resolve(true); },
      clear: function (store) { lsWrite(store, []); return Promise.resolve(true); }
    };
  }

  var _api = null;
  function api() { if (_api) return _api; _api = hasIDB() ? idbApi() : lsApi(); return _api; }

  w.Preisschmiede.OfflineDB = {
    STORES: STORES, version: version, verfuegbar: function () { return true; }, treiber: function () { return api().treiber; },
    put: function (s, o) { return api().put(s, o); },
    get: function (s, k) { return api().get(s, k); },
    getAll: function (s) { return api().getAll(s); },
    del: function (s, k) { return api().del(s, k); },
    clear: function (s) { return api().clear(s); },
    // Bequemlichkeit
    alleRecords: function () { return api().getAll("records"); },
    speichereRecord: function (r) { return api().put("records", r); },
    metaGet: function (k) { return api().get("meta", k); },
    metaSet: function (k, v) { return api().put("meta", { key: k, wert: v }); }
  };
})(typeof self !== "undefined" ? self : this);
