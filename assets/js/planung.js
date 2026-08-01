/* ============================================================
   Preisschmiede – Fertigungsplanung (Phase 7C)
   Reine, testbare Planungs-Engine: Kapazitäten, Abhängigkeiten,
   Konflikterkennung, automatischer (bestätigungspflichtiger)
   Planungsvorschlag, Rüstoptimierung, Fortschritt, Terminprognose.
   KEINE DOM-Zugriffe. Läuft im Browser (window) und unter Node (self).
   Automatische Vorschläge verändern NIE bestehende Planungen ohne
   ausdrückliche Übernahme durch den Benutzer.
   ============================================================ */
(function (w) {
  "use strict";
  w.Preisschmiede = w.Preisschmiede || {};

  function num(x) { if (typeof x === "number") return isFinite(x) ? x : 0; var v = parseFloat(String(x == null ? "" : x).replace(",", ".")); return isFinite(v) ? v : 0; }
  function r2(n) { n = num(n); return Math.round((n + (n >= 0 ? 1 : -1) * 1e-9) * 100) / 100; }
  var TAG_MS = 86400000;

  // ---- Feiertage (Österreich, konfigurierbar) ----------------------
  // Osterdatum (Anonymer Gregorianischer Algorithmus / Computus).
  function ostern(jahr) {
    var a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100, dd = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(jahr, monat - 1, tag);
  }
  function ymd(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  // Gesetzliche AT-Feiertage; zusätzliche/individuelle über settings.planung.feiertage.
  function feiertage(jahr, settings) {
    var pl = (settings && settings.planung) || {};
    if (pl.feiertageAktiv === false) return {};
    var o = ostern(jahr), set = {};
    function add(d) { set[ymd(d)] = true; }
    function osterPlus(t) { return new Date(o.getTime() + t * TAG_MS); }
    add(new Date(jahr, 0, 1));   // Neujahr
    add(new Date(jahr, 0, 6));   // Heilige Drei Könige
    add(osterPlus(1));           // Ostermontag
    add(new Date(jahr, 4, 1));   // Staatsfeiertag
    add(osterPlus(39));          // Christi Himmelfahrt
    add(osterPlus(50));          // Pfingstmontag
    add(osterPlus(60));          // Fronleichnam
    add(new Date(jahr, 7, 15));  // Mariä Himmelfahrt
    add(new Date(jahr, 9, 26));  // Nationalfeiertag
    add(new Date(jahr, 10, 1));  // Allerheiligen
    add(new Date(jahr, 11, 8));  // Mariä Empfängnis
    add(new Date(jahr, 11, 25)); // Christtag
    add(new Date(jahr, 11, 26)); // Stefanitag
    // individuelle Feiertage/Betriebsurlaub (ISO-Strings) hinzufügen
    (pl.feiertage || []).forEach(function (f) { if (f) set[String(f).slice(0, 10)] = true; });
    return set;
  }
  function istArbeitstag(date, settings) {
    var pl = (settings && settings.planung) || {};
    var arbeitstage = pl.arbeitstage || [1, 2, 3, 4, 5]; // Mo–Fr
    var d = new Date(date);
    if (arbeitstage.indexOf(d.getDay()) < 0) return false;
    var f = feiertage(d.getFullYear(), settings);
    return !f[ymd(d)];
  }
  function schichtStunden(settings) { var pl = (settings && settings.planung) || {}; return num(pl.schichtStunden) || 8; }
  function schichtStart(settings) { var pl = (settings && settings.planung) || {}; return pl.schichtStart != null ? num(pl.schichtStart) : 7; }

  // Nächster Arbeitszeit-Zeitpunkt ab d (überspringt Nacht/Wochenende/Feiertag)
  function naechsteArbeitszeit(d, settings) {
    var start = schichtStart(settings), dauer = schichtStunden(settings);
    var x = new Date(d);
    for (var guard = 0; guard < 3660; guard++) {
      if (istArbeitstag(x, settings)) {
        var tagStart = new Date(x.getFullYear(), x.getMonth(), x.getDate(), start, 0, 0);
        var tagEnde = new Date(tagStart.getTime() + dauer * 3600000);
        if (x < tagStart) return tagStart;
        if (x >= tagStart && x < tagEnde) return x;
      }
      // nächster Tag, Schichtbeginn
      x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1, start, 0, 0);
    }
    return x;
  }
  // Addiert Arbeitsstunden auf einen Startzeitpunkt (arbeitszeitkonform)
  function addArbeitsstunden(startISO, stunden, settings) {
    var start = schichtStart(settings), dauerTag = schichtStunden(settings);
    var cur = naechsteArbeitszeit(new Date(startISO), settings);
    var rest = num(stunden);
    for (var guard = 0; guard < 3660 && rest > 1e-6; guard++) {
      var tagEnde = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), start + dauerTag, 0, 0);
      var verfuegbar = (tagEnde - cur) / 3600000;
      if (verfuegbar >= rest) { cur = new Date(cur.getTime() + rest * 3600000); rest = 0; }
      else { rest -= verfuegbar; cur = naechsteArbeitszeit(new Date(tagEnde.getTime() + 1000), settings); }
    }
    return cur;
  }

  // ---- Kapazität ---------------------------------------------------
  function maschineKapazitaetStunden(m) {
    var tage = num(m.arbeitstage != null ? m.arbeitstage : 220);
    var stdTag = num(m.stundenProTag != null ? m.stundenProTag : 8);
    return r2(Math.max(0, tage * stdTag - num(m.wartungStunden)));
  }
  function mitarbeiterVerfuegbar(ma, vonISO, bisISO) {
    // false, wenn im Zeitraum Abwesenheit (Urlaub/Abwesenheit/Schulung) liegt
    var von = new Date(vonISO).getTime(), bis = new Date(bisISO).getTime();
    return !((ma.abwesenheiten || []).some(function (ab) {
      var av = new Date(ab.von).getTime(), ab2 = new Date(ab.bis || ab.von).getTime() + TAG_MS - 1;
      return von <= ab2 && bis >= av;
    }));
  }
  function hatQualifikation(ma, qualifikation) {
    if (!qualifikation) return true;
    return (ma.qualifikationen || []).indexOf(qualifikation) >= 0;
  }

  // ---- Abhängigkeiten & Zyklusprüfung ------------------------------
  function baueGraph(elemente) { var g = {}; elemente.forEach(function (e) { g[e.id] = (e.vorgaenger || []).slice(); }); return g; }
  // true, wenn das Hinzufügen von vor->nach (nach hängt von vor ab) einen Zyklus erzeugt
  function erzeugtZyklus(elemente, vorId, nachId) {
    if (vorId === nachId) return true;
    var g = baueGraph(elemente);
    (g[nachId] = g[nachId] || []).push(vorId);
    return hatZyklus(g);
  }
  function hatZyklus(graph) {
    var status = {}; // 0=neu,1=inArbeit,2=fertig
    function dfs(n) {
      if (status[n] === 1) return true;
      if (status[n] === 2) return false;
      status[n] = 1;
      var deps = graph[n] || [];
      for (var i = 0; i < deps.length; i++) { if (graph.hasOwnProperty(deps[i]) && dfs(deps[i])) return true; }
      status[n] = 2; return false;
    }
    return Object.keys(graph).some(function (n) { return dfs(n); });
  }
  // Topologische Reihenfolge (null bei Zyklus)
  function topoSort(elemente) {
    var g = baueGraph(elemente), status = {}, out = [], zyklus = false;
    function visit(n) {
      if (status[n] === 2) return; if (status[n] === 1) { zyklus = true; return; }
      status[n] = 1; (g[n] || []).forEach(function (d) { if (g.hasOwnProperty(d)) visit(d); }); status[n] = 2; out.push(n);
    }
    elemente.forEach(function (e) { visit(e.id); });
    if (zyklus) return null;
    return out;
  }

  // ---- Konflikterkennung ------------------------------------------
  function overlaps(a, b) {
    if (!a.start || !a.ende || !b.start || !b.ende) return false;
    return new Date(a.start) < new Date(b.ende) && new Date(b.start) < new Date(a.ende);
  }
  function elementById(elemente, id) { return elemente.filter(function (e) { return e.id === id; })[0]; }

  function konflikte(elemente, db, settings) {
    db = db || {}; settings = settings || (db.settings || {});
    var out = [];
    var maschinen = (settings.maschinen) || (db.settings && db.settings.maschinen) || [];
    var mitarbeiter = db.mitarbeiter || [];
    // Zyklus im Abhängigkeitsgraph
    if (topoSort(elemente) === null) out.push({ typ: "zyklus", schwere: 3, text: "Zirkuläre Abhängigkeit im Ablaufplan erkannt." });
    // Maschinen-Doppelbelegung (überschreitet maxParallel)
    for (var i = 0; i < elemente.length; i++) {
      for (var j = i + 1; j < elemente.length; j++) {
        var a = elemente[i], b = elemente[j];
        if (a.maschineId && a.maschineId === b.maschineId && overlaps(a, b)) {
          var m = maschinen.filter(function (x) { return x.id === a.maschineId; })[0] || {};
          var maxP = num(m.maxParallel) || 1;
          if (maxP < 2) out.push({ typ: "maschine", schwere: 3, elemente: [a.id, b.id], maschineId: a.maschineId, text: "Doppelbelegung Maschine " + (m.name || a.maschineId) + ": „" + (a.bezeichnung || a.arbeitsgang) + '" und „' + (b.bezeichnung || b.arbeitsgang) + '" überlappen.' });
        }
        // Fahrzeug-/Hebegerät-Doppelbelegung (Montageplanung)
        if (a.fahrzeugId && a.fahrzeugId === b.fahrzeugId && overlaps(a, b)) out.push({ typ: "fahrzeug", schwere: 2, elemente: [a.id, b.id], text: "Fahrzeug " + a.fahrzeugId + " ist gleichzeitig zwei Montageeinsätzen zugeteilt." });
        if (a.hebegeraetId && a.hebegeraetId === b.hebegeraetId && overlaps(a, b)) out.push({ typ: "hebegeraet", schwere: 2, elemente: [a.id, b.id], text: "Hebegerät " + a.hebegeraetId + " ist doppelt verplant." });
        // Mitarbeiter-Doppelbelegung
        var gemeinsam = (a.mitarbeiterIds || []).filter(function (x) { return (b.mitarbeiterIds || []).indexOf(x) >= 0; });
        if (gemeinsam.length && overlaps(a, b)) {
          gemeinsam.forEach(function (mid) {
            var ma = mitarbeiter.filter(function (x) { return x.id === mid; })[0] || {};
            out.push({ typ: "mitarbeiter", schwere: 3, elemente: [a.id, b.id], mitarbeiterId: mid, text: "Doppelbelegung: " + (ma.name || mid) + " ist gleichzeitig für zwei Arbeitsgänge eingeplant." });
          });
        }
      }
    }
    // Qualifikation, Abwesenheit, Maschinenberechtigung, Abhängigkeits-Reihenfolge, Material
    elemente.forEach(function (e) {
      (e.mitarbeiterIds || []).forEach(function (mid) {
        var ma = mitarbeiter.filter(function (x) { return x.id === mid; })[0]; if (!ma) return;
        if (e.qualifikation && !hatQualifikation(ma, e.qualifikation)) out.push({ typ: "qualifikation", schwere: 2, elemente: [e.id], mitarbeiterId: mid, text: (ma.name || mid) + " fehlt die Qualifikation „" + e.qualifikation + '" für „' + (e.bezeichnung || e.arbeitsgang) + '".' });
        if (e.start && e.ende && !mitarbeiterVerfuegbar(ma, e.start, e.ende)) out.push({ typ: "abwesenheit", schwere: 2, elemente: [e.id], mitarbeiterId: mid, text: (ma.name || mid) + " ist im geplanten Zeitraum abwesend (Urlaub/Abwesenheit)." });
        if (e.maschineId && (ma.maschinenberechtigungen || []).length && ma.maschinenberechtigungen.indexOf(e.maschineId) < 0) out.push({ typ: "berechtigung", schwere: 1, elemente: [e.id], mitarbeiterId: mid, text: (ma.name || mid) + " hat keine Berechtigung für die zugewiesene Maschine." });
      });
      // Mindestbesetzung
      if (e.mitarbeiterAnzahl && (e.mitarbeiterIds || []).length < e.mitarbeiterAnzahl) out.push({ typ: "besetzung", schwere: 1, elemente: [e.id], text: "„" + (e.bezeichnung || e.arbeitsgang) + '" benötigt ' + e.mitarbeiterAnzahl + " Mitarbeiter, zugewiesen sind " + (e.mitarbeiterIds || []).length + "." });
      // Abhängigkeitsverletzung (Nachfolger startet vor Vorgänger-Ende + Puffer)
      (e.vorgaenger || []).forEach(function (vid) {
        var v = elementById(elemente, vid); if (!v || !v.ende || !e.start) return;
        var puffer = (num(e.puffer) || 0) * 3600000;
        var typ = e.abhTyp || "ES";
        if (typ === "ES" && new Date(e.start).getTime() < new Date(v.ende).getTime() + puffer) out.push({ typ: "abhaengigkeit", schwere: 2, elemente: [e.id, vid], text: "„" + (e.bezeichnung || e.arbeitsgang) + '" startet vor Abschluss des Vorgängers „' + (v.bezeichnung || v.arbeitsgang) + '".' });
        if (typ === "SS" && v.start && new Date(e.start).getTime() < new Date(v.start).getTime() + puffer) out.push({ typ: "abhaengigkeit", schwere: 1, elemente: [e.id, vid], text: "Start-zu-Start-Bedingung verletzt bei „" + (e.bezeichnung || e.arbeitsgang) + '".' });
      });
      // Material
      if (e.material && (e.material.status === "verspätet" || e.material.status === "nicht verfügbar")) out.push({ typ: "material", schwere: 2, elemente: [e.id], text: "Material für „" + (e.bezeichnung || e.arbeitsgang) + '" ist ' + e.material.status + " – Termin gefährdet." });
    });
    // Liefertermin gefährdet: spätestes Ende > Liefertermin des Auftrags
    var proAuftrag = {};
    elemente.forEach(function (e) { if (!e.auftragId) return; (proAuftrag[e.auftragId] = proAuftrag[e.auftragId] || []).push(e); });
    Object.keys(proAuftrag).forEach(function (aid) {
      var auftrag = (db.auftraege || []).filter(function (a) { return a.id === aid; })[0];
      if (!auftrag || !auftrag.liefertermin) return;
      var enden = proAuftrag[aid].map(function (e) { return e.ende ? new Date(e.ende).getTime() : 0; });
      var spaetestes = Math.max.apply(null, enden);
      if (spaetestes > new Date(auftrag.liefertermin).getTime()) out.push({ typ: "liefertermin", schwere: 3, auftragId: aid, text: "Liefertermin für " + (auftrag.titel || auftrag.nummer || aid) + " gefährdet: Planende liegt nach dem Liefertermin." });
    });
    return out.sort(function (x, y) { return y.schwere - x.schwere; });
  }

  // ---- Planung aus (freigegebener) Kalkulation / Auftrag -----------
  // Erzeugt Planungselemente je Arbeitsschritt mit Soll-Zeiten. Die
  // Kalkulation selbst wird NICHT verändert (kalkWert = Original).
  function planAusAuftrag(auftrag, db, settings) {
    var SCHRITTE = (w.Preisschmiede.Products && w.Preisschmiede.Products.SCHRITTE) || [];
    var maschinen = (settings.maschinen) || (db.settings && db.settings.maschinen) || [];
    var uid = (w.Preisschmiede.Store && w.Preisschmiede.Store.uid) || function () { return "pe-" + Math.round(performance.now ? performance.now() * 1000 : 0) + "-" + Object.keys({}).length; };
    var soll = {};
    (auftrag.positionen || []).forEach(function (p) { var z = (p.kalk && p.kalk.zeiten) || {}; Object.keys(z).forEach(function (k) { soll[k] = (soll[k] || 0) + num(z[k]); }); });
    var elemente = [], vorher = null;
    SCHRITTE.forEach(function (s) {
      var std = soll[s.key]; if (!std || std <= 0) return;
      var m = maschinen.filter(function (x) { return x.schritt === s.key; })[0];
      var typ = s.key === "montage" ? "montage" : s.key === "transport" ? "transport" : "arbeitsgang";
      var el = {
        id: uid(), auftragId: auftrag.id, kommission: auftrag.kommission || "", arbeitsgang: s.key,
        bezeichnung: s.label + " – " + (auftrag.titel || auftrag.nummer || ""),
        dauerStd: r2(std), kalkWert: r2(std), planWert: r2(std),
        maschineId: m ? m.id : null, mitarbeiterIds: [], mitarbeiterAnzahl: 1, qualifikation: null,
        vorgaenger: vorher ? [vorher] : [], nachfolger: [], abhTyp: "ES", puffer: 0,
        prioritaet: auftrag.prioritaet || 2, fixtermin: false, verschiebbar: true,
        status: "geplant", start: null, ende: null, typ: typ,
        material: { status: "nicht geprüft" }, notiz: ""
      };
      elemente.push(el);
      if (vorher) { var pv = elementById(elemente, vorher); if (pv) pv.nachfolger.push(el.id); }
      vorher = el.id;
    });
    return elemente;
  }

  // ---- Automatischer Planungsvorschlag (nicht-destruktiv) ----------
  // Vorwärtsterminierung: respektiert Reihenfolge, Kapazität je Maschine,
  // Fixtermine. Gibt Vorschlag inkl. Konflikten und Begründung zurück.
  function autoPlan(elemente, db, settings, startAbISO) {
    settings = settings || db.settings || {};
    var reihenfolge = topoSort(elemente);
    if (!reihenfolge) return { ok: false, grund: "Zirkuläre Abhängigkeit – kein Vorschlag möglich.", elemente: [] };
    var idx = {}; elemente.forEach(function (e) { idx[e.id] = JSON.parse(JSON.stringify(e)); });
    var maschineFrei = {}; // maschineId -> nächster freier Zeitpunkt (ISO)
    var startAb = startAbISO ? new Date(startAbISO) : new Date();
    reihenfolge.forEach(function (id) {
      var e = idx[id]; if (!e) return;
      // frühester Start = max(Vorgänger-Enden + Puffer, Maschine frei, jetzt)
      var fruehest = naechsteArbeitszeit(startAb, settings).getTime();
      (e.vorgaenger || []).forEach(function (vid) { var v = idx[vid]; if (v && v.ende) { var p = (num(e.puffer) || 0) * 3600000; fruehest = Math.max(fruehest, new Date(v.ende).getTime() + p); } });
      if (e.fixtermin && e.start) fruehest = new Date(e.start).getTime();
      if (e.maschineId && maschineFrei[e.maschineId]) fruehest = Math.max(fruehest, new Date(maschineFrei[e.maschineId]).getTime());
      var start = naechsteArbeitszeit(new Date(fruehest), settings);
      var ende = addArbeitsstunden(start.toISOString(), e.planWert || e.dauerStd, settings);
      e.start = start.toISOString(); e.ende = ende.toISOString();
      e.begruendung = "Start nach Vorgänger/Maschinenverfügbarkeit; Dauer " + r2(e.planWert || e.dauerStd) + " h in Schichtzeit.";
      if (e.maschineId) maschineFrei[e.maschineId] = e.ende;
    });
    var vorschlag = reihenfolge.map(function (id) { return idx[id]; });
    var konf = konflikte(vorschlag, db, settings);
    return { ok: true, elemente: vorschlag, konflikte: konf, grund: "Vorwärtsterminierung nach Ablaufreihenfolge und Maschinenkapazität." };
  }

  // ---- Rüstoptimierung (nachvollziehbar) ---------------------------
  // Gruppiert gleichartige Arbeitsgänge (Maschine + Material + Stärke)
  // und schätzt die Rüstzeitersparnis, wenn sie nacheinander gefertigt
  // werden. Keine automatische Umplanung.
  function ruestOptimierung(elemente, db, settings) {
    settings = settings || db.settings || {};
    var maschinen = (settings.maschinen) || (db.settings && db.settings.maschinen) || [];
    var gruppen = {};
    elemente.forEach(function (e) {
      if (!e.maschineId) return;
      var mat = (e.ruestMerkmale && (e.ruestMerkmale.material + "|" + e.ruestMerkmale.staerke)) || (e.material && e.material.werkstoff) || "";
      var key = e.maschineId + "::" + mat;
      (gruppen[key] = gruppen[key] || []).push(e);
    });
    var vorschlaege = [];
    Object.keys(gruppen).forEach(function (key) {
      var grp = gruppen[key]; if (grp.length < 2) return;
      var m = maschinen.filter(function (x) { return x.id === grp[0].maschineId; })[0] || {};
      var ruestH = num(m.ruestzeitStd) || 0.25;
      var ersparnisMin = r2((grp.length - 1) * ruestH * 60);
      if (ersparnisMin <= 0) return;
      vorschlaege.push({
        maschineId: grp[0].maschineId, maschine: m.name || grp[0].maschineId,
        anzahl: grp.length, elemente: grp.map(function (e) { return e.id; }),
        ersparnisMinuten: ersparnisMin,
        text: grp.length + " gleichartige Arbeitsgänge auf " + (m.name || "Maschine") + " könnten nacheinander gefertigt werden. Geschätzte Rüstzeitersparnis: " + ersparnisMin + " Minuten (" + (grp.length - 1) + " × " + r2(ruestH * 60) + " min)."
      });
    });
    return vorschlaege.sort(function (a, b) { return b.ersparnisMinuten - a.ersparnisMinuten; });
  }

  // ---- Fortschritt (gewichtet nach geplanter Dauer) ----------------
  function fortschritt(elemente) {
    var gesamt = 0, erledigt = 0, zeitSoll = 0, zeitIst = 0, anzGesamt = elemente.length, anzFertig = 0;
    elemente.forEach(function (e) {
      var d = num(e.planWert || e.dauerStd); gesamt += d;
      if (e.status === "fertig" || e.status === "abgeschlossen") { erledigt += d; anzFertig++; }
      zeitSoll += d; zeitIst += num(e.istStunden);
    });
    return {
      aufwandProzent: gesamt > 0 ? r2(erledigt / gesamt * 100) : 0,
      arbeitsgangProzent: anzGesamt > 0 ? r2(anzFertig / anzGesamt * 100) : 0,
      zeitSoll: r2(zeitSoll), zeitIst: r2(zeitIst),
      zeitProzent: zeitSoll > 0 ? r2(zeitIst / zeitSoll * 100) : 0
    };
  }

  // ---- Terminprognose (Schätzung, begründet) -----------------------
  function terminprognose(elemente, db, settings, abISO) {
    settings = settings || db.settings || {};
    var offen = elemente.filter(function (e) { return e.status !== "fertig" && e.status !== "abgeschlossen"; });
    var restStunden = offen.reduce(function (s, e) { return s + num(e.planWert || e.dauerStd); }, 0);
    var ab = abISO ? new Date(abISO) : new Date();
    var prognose = addArbeitsstunden(ab.toISOString(), restStunden, settings);
    return {
      restStunden: r2(restStunden), offeneArbeitsgaenge: offen.length,
      prognoseEnde: prognose.toISOString(), schaetzung: true,
      begruendung: "Schätzung: " + r2(restStunden) + " h Restaufwand über " + offen.length + " offene Arbeitsgänge, verteilt auf verfügbare Schichtzeit (ohne Wochenenden/Feiertage)."
    };
  }

  // ---- Plan-Ist-Vergleich ------------------------------------------
  function planIstVergleich(e) {
    return {
      startSoll: e.start || null, startIst: e.startIst || null,
      endeSoll: e.ende || null, endeIst: e.endeIst || null,
      dauerSoll: r2(num(e.planWert || e.dauerStd)), dauerIst: r2(num(e.istStunden)),
      dauerAbwProz: num(e.planWert || e.dauerStd) > 0 ? r2((num(e.istStunden) - num(e.planWert || e.dauerStd)) / num(e.planWert || e.dauerStd) * 100) : 0
    };
  }

  w.Preisschmiede.Planung = {
    num: num, r2: r2, ostern: ostern, feiertage: feiertage, istArbeitstag: istArbeitstag,
    schichtStunden: schichtStunden, naechsteArbeitszeit: naechsteArbeitszeit, addArbeitsstunden: addArbeitsstunden,
    maschineKapazitaetStunden: maschineKapazitaetStunden, mitarbeiterVerfuegbar: mitarbeiterVerfuegbar, hatQualifikation: hatQualifikation,
    erzeugtZyklus: erzeugtZyklus, hatZyklus: hatZyklus, topoSort: topoSort, overlaps: overlaps,
    konflikte: konflikte, planAusAuftrag: planAusAuftrag, autoPlan: autoPlan,
    ruestOptimierung: ruestOptimierung, fortschritt: fortschritt, terminprognose: terminprognose, planIstVergleich: planIstVergleich
  };
})(typeof self !== "undefined" ? self : this);
