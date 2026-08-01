/* ============================================================
   Preisschmiede – Benutzeranmeldung & Rollen (lokal, offline)
   Speichert nie Klartext-PINs. Die Rolle steuert, welche Bereiche
   sichtbar/nutzbar sind. Läuft rein lokal auf dem Gerät.
   ============================================================ */
(function (w) {
  "use strict";
  var Store = w.Preisschmiede.Store;
  var SESSION_KEY = "ps.auth.currentUserId";

  // Rollen und ihre Klartext-Bezeichnung
  var ROLLEN = {
    admin: "Administrator",
    buero: "Büro / Kalkulation",
    werkstatt: "Werkstatt / Montage"
  };

  // Welche Navigationsbereiche darf welche Rolle sehen?
  // (dashboard = Start, auftraege = Aufträge/Zeiterfassung)
  var RECHTE = {
    admin:     ["dashboard", "kalkulation", "konfigurator", "kalkulationen", "angebote", "auftraege", "rechnungen", "planung", "dokumente", "kundenprojekte", "material", "lager", "qualitaet", "lernen", "stammdaten", "system", "benutzer", "produktgruppen", "textbausteine"],
    buero:     ["dashboard", "kalkulation", "konfigurator", "kalkulationen", "angebote", "auftraege", "rechnungen", "planung", "dokumente", "kundenprojekte", "material", "lager", "qualitaet", "lernen", "stammdaten", "textbausteine"],
    werkstatt: ["dashboard", "auftraege", "planung"]
  };

  var _current = null;

  function users() { var db = Store.load(); return db.users || []; }

  function findByName(benutzername) {
    var bn = String(benutzername || "").trim().toLowerCase();
    return users().filter(function (u) { return (u.benutzername || "").toLowerCase() === bn; })[0] || null;
  }
  function findById(id) { return users().filter(function (u) { return u.id === id; })[0] || null; }

  // Anmelden: prüft PIN gegen den gesalzenen Hash. Gibt den User oder null.
  function login(benutzername, pin) {
    var u = findByName(benutzername);
    if (!u || u.aktiv === false) return null;
    if (Store.hashPin(String(pin || ""), u.salt) !== u.hash) return null;
    _current = u;
    try { w.localStorage.setItem(SESSION_KEY, u.id); } catch (e) {}
    return u;
  }

  function logout() {
    _current = null;
    try { w.localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // Beim App-Start: gemerkte Sitzung wiederherstellen (bleibt angemeldet).
  function restore() {
    var id = null;
    try { id = w.localStorage.getItem(SESSION_KEY); } catch (e) {}
    if (!id) return null;
    var u = findById(id);
    if (u && u.aktiv !== false) { _current = u; return u; }
    logout();
    return null;
  }

  function current() { return _current; }
  function istAngemeldet() { return !!_current; }
  function rolle() { return _current ? _current.rolle : null; }
  function rolleLabel(r) { return ROLLEN[r || rolle()] || (r || "—"); }

  // Darf die aktuelle Rolle diesen Bereich sehen/nutzen?
  function darf(bereich) {
    if (!_current) return false;
    var liste = RECHTE[_current.rolle] || [];
    return liste.indexOf(bereich) >= 0;
  }
  function istAdmin() { return rolle() === "admin"; }
  // Darf die aktuelle Rolle vertrauliche betriebswirtschaftliche Kennzahlen
  // (Gewinn, Deckungsbeitrag, Margen, Selbst-/Einkaufskosten) sehen?
  // Geschäftsführung (admin) und Kalkulation/Büro (buero): ja.
  // Fertigung/Montage (werkstatt): nein – nur operative Informationen.
  function darfFinanzen() { var r = rolle(); return r === "admin" || r === "buero"; }

  // Benutzer anlegen/aktualisieren (nur sinnvoll für Admin – UI erzwingt das).
  function speichereUser(daten, pin) {
    var db = Store.load();
    var u = daten.id ? findById(daten.id) : null;
    if (u) {
      u.name = daten.name; u.benutzername = daten.benutzername;
      u.rolle = daten.rolle; u.aktiv = daten.aktiv !== false;
      if (pin) { u.salt = Store.makeSalt(); u.hash = Store.hashPin(String(pin), u.salt); }
    } else {
      var salt = Store.makeSalt();
      u = {
        id: Store.uid(), name: daten.name, benutzername: daten.benutzername,
        rolle: daten.rolle, aktiv: daten.aktiv !== false,
        salt: salt, hash: Store.hashPin(String(pin || "1234"), salt), erstellt: Store.nowISO()
      };
      db.users.push(u);
    }
    Store.save();
    // Wenn der eigene Datensatz geändert wurde, Session aktualisieren
    if (_current && u.id === _current.id) _current = u;
    return u;
  }

  function loescheUser(id) {
    var db = Store.load();
    // Mindestens ein aktiver Admin muss bestehen bleiben
    var rest = db.users.filter(function (u) { return u.id !== id; });
    if (!rest.some(function (u) { return u.rolle === "admin" && u.aktiv !== false; })) return false;
    db.users = rest;
    Store.save();
    return true;
  }

  w.Preisschmiede.Auth = {
    ROLLEN: ROLLEN, RECHTE: RECHTE,
    login: login, logout: logout, restore: restore,
    current: current, istAngemeldet: istAngemeldet,
    rolle: rolle, rolleLabel: rolleLabel, darf: darf, istAdmin: istAdmin, darfFinanzen: darfFinanzen,
    speichereUser: speichereUser, loescheUser: loescheUser,
    findByName: findByName
  };
})(window);
