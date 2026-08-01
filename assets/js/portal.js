/* ============================================================
   Preisschmiede – Kundenportal-Engine (Phase 12)
   Reine, testbare Logik für sicheren Kundenzugriff, digitale
   Angebotsannahme/-ablehnung, optionale/Alternativpositionen,
   Nachrichten, Dokumentfreigabe. Arbeitet AUSSCHLIESSLICH auf
   der db des aktiven Mandanten (Isolation durch Namespace, s.
   store.js) und gibt an Kunden NUR die kundensichere Ausgabe
   (Whitelist aus angebot.js) heraus – niemals interne Kosten,
   Margen, Stundensätze, Notizen oder Fremdkundendaten.

   EHRLICH: Server-seitige Erzwingung/echter E-Mail-Versand/
   qualifizierte E-Signatur erfordern ein Backend und werden NICHT
   vorgetäuscht. Die „server-seitige" Neuberechnung ist hier die
   maßgebliche, aus der freigegebenen Angebotsversion abgeleitete
   Berechnung (Client-Werte sind nie verbindlich).
   ============================================================ */
(function (w) {
  "use strict";
  w.Preisschmiede = w.Preisschmiede || {};
  function Store() { return w.Preisschmiede.Store; }
  function Angebot() { return w.Preisschmiede.Angebot; }
  function Infra() { return w.Preisschmiede.Infra; }
  function nowISO(j) { return j || (Store() && Store().nowISO()); }
  function num(x) { var v = parseFloat(x); return isFinite(v) ? v : 0; }
  function digest(secret, data) {
    var I = Infra(); if (I && I.digest) return I.digest(secret, data);
    var S = Store(); return S ? S.hashPin(String(data), String(secret)) : String(data);
  }
  function konstant(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

  // ---- Rollen im Kundenkonto ---------------------------------------
  var ROLLEN = ["kundenadmin", "entscheider", "technik", "leser"];
  var ROLLE_LABEL = { kundenadmin: "Kundenadministrator", entscheider: "Entscheider", technik: "technischer Ansprechpartner", leser: "nur lesen" };
  function darfAnnehmen(rolle) { return rolle === "kundenadmin" || rolle === "entscheider"; }

  // ---- Portalbenutzer ----------------------------------------------
  function portalUserNeu(daten, jetztISO) {
    var S = Store();
    return {
      id: S ? S.uid() : "pu-" + Math.random().toString(36).slice(2, 9),
      kundeId: daten.kundeId, ansprechpartnerId: daten.ansprechpartnerId || null,
      name: (daten.name || "").trim(), email: (daten.email || "").trim().toLowerCase(),
      telefon: daten.telefon || "", rolle: ROLLEN.indexOf(daten.rolle) >= 0 ? daten.rolle : "leser",
      status: daten.status || "eingeladen", einladungsdatum: jetztISO || nowISO(),
      letzterLogin: null, emailBestaetigt: false,
      erlaubteProjekte: daten.erlaubteProjekte || [], erlaubteAktionen: daten.erlaubteAktionen || [],
      passwortSalt: null, passwortHash: null, beispiel: !!daten.beispiel
    };
  }
  function passwortSetzen(user, passwort) {
    var S = Store(); var salt = S.makeSalt();
    user.passwortSalt = salt; user.passwortHash = S.hashPin(String(passwort), salt);
    return user;
  }
  function passwortPruefen(user, passwort) {
    if (!user || !user.passwortHash) return false;
    return konstant(Store().hashPin(String(passwort), user.passwortSalt), user.passwortHash);
  }

  // ---- Sicherer Angebotslink (Token gehasht, befristet, widerrufbar) ----
  // Scope: genau EIN Angebot + EIN Mandant. Optional einmalig verwendbar.
  function linkNeu(daten, token, jetztISO, gueltigTage) {
    var S = Store(); var salt = S.makeSalt();
    var ablauf = new Date(new Date(jetztISO || nowISO()).getTime() + (gueltigTage || 30) * 86400000).toISOString();
    return {
      id: S.uid(), mandantId: daten.mandantId, angebotId: daten.angebotId, kundeId: daten.kundeId,
      ansprechpartner: daten.ansprechpartner || "", email: (daten.email || "").trim().toLowerCase(),
      tokenSalt: salt, tokenHash: S.hashPin(String(token), salt), ablauf: ablauf,
      einmalig: !!daten.einmalig, verwendet: false, widerrufen: null,
      emailBestaetigungNoetig: !!daten.emailBestaetigungNoetig, emailBestaetigt: false,
      erstellt: jetztISO || nowISO(), beispiel: !!daten.beispiel
    };
  }
  // Prüft Token + Scope. ctx = {mandantId, angebotId}. Kein Zugriff auf andere
  // Kunden/Angebote/Mandanten. Ablauf/Widerruf/Einmaligkeit werden erzwungen.
  function linkPruefen(link, token, ctx, jetztISO) {
    ctx = ctx || {};
    if (!link) return { ok: false, grund: "unbekannt" };
    if (link.widerrufen) return { ok: false, grund: "widerrufen" };
    if (ctx.mandantId != null && link.mandantId !== ctx.mandantId) return { ok: false, grund: "fremder Mandant" };
    if (ctx.angebotId != null && link.angebotId !== ctx.angebotId) return { ok: false, grund: "fremdes Angebot" };
    if (new Date(link.ablauf).getTime() < new Date(jetztISO || nowISO()).getTime()) return { ok: false, grund: "abgelaufen" };
    if (link.einmalig && link.verwendet) return { ok: false, grund: "bereits verwendet" };
    if (!konstant(Store().hashPin(String(token), link.tokenSalt), link.tokenHash)) return { ok: false, grund: "token ungültig" };
    if (link.emailBestaetigungNoetig && !link.emailBestaetigt) return { ok: false, grund: "e-mail-bestätigung offen" };
    return { ok: true };
  }
  function linkVerwenden(link, jetztISO) { if (link && link.einmalig) link.verwendet = true; if (link) link.letzterZugriff = jetztISO || nowISO(); return link; }
  function linkWiderrufen(link, jetztISO) { if (link) link.widerrufen = jetztISO || nowISO(); return link; }

  // ---- Kundensichere Angebotsansicht (nur freigegebene Version) --------
  function istFreigegeben(angebot) { return !!angebot && (angebot.status === "freigegeben" || angebot.status === "versendet" || angebot.status === "angenommen"); }
  function istErsetzt(angebot) { return !!angebot && (angebot.ersetztDurch || angebot.status === "ersetzt"); }
  // Liefert die kundensichere Ausgabe (Whitelist) ODER null, wenn nicht erlaubt.
  function kundenAngebot(angebot, ctx) {
    if (!istFreigegeben(angebot)) return null;
    var A = Angebot();
    var ausgabe = A.kundenAusgabe(angebot, ctx || {});
    // Sicherheitsnetz: enthält die Ausgabe versehentlich interne Felder -> leeren.
    var leck = A.enthaeltInterne(ausgabe);
    if (leck.length) { return { fehler: "interne Daten erkannt – Ausgabe blockiert", felder: leck }; }
    ausgabe.version = angebot.version; ausgabe.status = angebot.status;
    ausgabe.abgelaufen = abgelaufen(angebot, (ctx || {}).jetztISO);
    ausgabe.ersetzt = istErsetzt(angebot);
    return ausgabe;
  }
  function abgelaufen(angebot, jetztISO) {
    if (!angebot || !angebot.gueltigBisISO) return false;
    return new Date(angebot.gueltigBisISO).getTime() < new Date(jetztISO || nowISO()).getTime();
  }

  // ---- Optionale / Alternativpositionen: Auswahl anwenden --------------
  // auswahl = { optionen: [posNummer,...], alternativen: { gruppe: posNummer } }
  // Alternativpositionen sind über p.gruppe gruppiert; genau eine je Gruppe.
  function auswahlAnwenden(angebot, auswahl) {
    auswahl = auswahl || {}; var opt = auswahl.optionen || []; var alt = auswahl.alternativen || {};
    var kopie = JSON.parse(JSON.stringify(angebot));
    (kopie.positionen || []).forEach(function (p) {
      if (p.typ === "optional" || p.typ === "bedarf") {
        p.aktiviert = opt.indexOf(p.nummer) >= 0;
      } else if (p.typ === "alternativ") {
        var g = p.gruppe || "_";
        p.aktiviert = (alt[g] === p.nummer);
      }
    });
    return kopie;
  }
  // Prüft, ob eine Alternativ-Auswahl gültig ist (höchstens eine je Gruppe,
  // und nur existierende Positionen). Ungültige Kombinationen -> false.
  function auswahlGueltig(angebot, auswahl) {
    auswahl = auswahl || {}; var alt = auswahl.alternativen || {};
    var gruppen = {};
    (angebot.positionen || []).forEach(function (p) { if (p.typ === "alternativ") { (gruppen[p.gruppe || "_"] = gruppen[p.gruppe || "_"] || []).push(p.nummer); } });
    var ok = true;
    Object.keys(alt).forEach(function (g) {
      if (!gruppen[g] || gruppen[g].indexOf(alt[g]) < 0) ok = false;
    });
    // optionale müssen existieren und optional sein
    (auswahl.optionen || []).forEach(function (nr) {
      var p = (angebot.positionen || []).filter(function (x) { return x.nummer === nr; })[0];
      if (!p || (p.typ !== "optional" && p.typ !== "bedarf")) ok = false;
    });
    return ok;
  }
  // MASSGEBLICHE Neuberechnung aus der freigegebenen Version (Client-Preise
  // werden ignoriert – nur Auswahl-IDs zählen; Preise stammen aus dem Angebot).
  function neuberechnung(angebot, auswahl) {
    var mitAuswahl = auswahlAnwenden(angebot, auswahl);
    return Angebot().summen(mitAuswahl);
  }

  // ---- PDF-Prüfsumme (aus kundensicherer Ausgabe) ----------------------
  function pdfPruefsumme(ausgabe) { return digest("angebot-pdf", JSON.stringify(ausgabe || {})); }

  // ---- Digitale Angebotsannahme ----------------------------------------
  // Erzeugt ein manipulationsgeschütztes Annahmeprotokoll. Guards:
  // abgelaufen / ersetzt / bereits angenommen / ungültige Auswahl / Rolle.
  function annahmePruefen(angebot, portalUser, auswahl, jetztISO) {
    if (!istFreigegeben(angebot)) return { ok: false, grund: "nicht freigegeben" };
    if (istErsetzt(angebot)) return { ok: false, grund: "ersetzt" };
    if (angebot.status === "angenommen") return { ok: false, grund: "bereits angenommen" };
    if (abgelaufen(angebot, jetztISO)) return { ok: false, grund: "abgelaufen" };
    if (!auswahlGueltig(angebot, auswahl)) return { ok: false, grund: "ungültige auswahl" };
    if (portalUser && !darfAnnehmen(portalUser.rolle)) return { ok: false, grund: "keine berechtigung" };
    return { ok: true };
  }
  function annahmeProtokoll(angebot, ctx, auswahl, erklaerung, jetztISO) {
    var pruef = annahmePruefen(angebot, ctx.portalUser, auswahl, jetztISO);
    if (!pruef.ok) return { ok: false, grund: pruef.grund };
    var summe = neuberechnung(angebot, auswahl);
    var ausgabe = kundenAngebot(auswahlAnwenden(angebot, auswahl), ctx);
    var S = Store();
    var protokoll = {
      id: S ? S.uid() : "an-" + Math.random().toString(36).slice(2, 9),
      typ: "annahme",
      mandantId: ctx.mandantId, kundeId: angebot.kundeId, ansprechpartner: ctx.name || "",
      angebotId: angebot.id, angebotNr: angebot.nummer, angebotVersion: angebot.version,
      pdfPruefsumme: pdfPruefsumme(ausgabe),
      auswahl: JSON.parse(JSON.stringify(auswahl || {})),
      netto: summe.netto, mwst: summe.mwst, brutto: summe.brutto,
      zeitpunkt: jetztISO || nowISO(), zeitzone: ctx.zeitzone || "Europe/Vienna",
      zugang: ctx.linkId ? { art: "link", id: ctx.linkId } : { art: "konto", id: (ctx.portalUser || {}).id || null },
      annehmenderName: ctx.name || "", annehmenderEmail: (ctx.email || "").toLowerCase(),
      funktion: ctx.funktion || "", bestellnummer: ctx.bestellnummer || "", kommentar: ctx.kommentar || "",
      erklaerung: erklaerung || "", transaktionsId: digest("annahme", (angebot.id || "") + "|" + (angebot.version || "") + "|" + (jetztISO || nowISO())),
      appVersion: (w.PSBUILD && w.PSBUILD.version) || "Web",
      erstellt: jetztISO || nowISO()
    };
    // Integritäts-Siegel über die relevanten Felder (Offline-Digest).
    protokoll.siegel = digest("annahme-siegel", JSON.stringify({
      m: protokoll.mandantId, a: protokoll.angebotId, v: protokoll.angebotVersion,
      p: protokoll.pdfPruefsumme, b: protokoll.brutto, t: protokoll.zeitpunkt, n: protokoll.annehmenderName
    }));
    return { ok: true, protokoll: protokoll };
  }
  function siegelPruefen(protokoll) {
    if (!protokoll || !protokoll.siegel) return false;
    var erwartet = digest("annahme-siegel", JSON.stringify({
      m: protokoll.mandantId, a: protokoll.angebotId, v: protokoll.angebotVersion,
      p: protokoll.pdfPruefsumme, b: protokoll.brutto, t: protokoll.zeitpunkt, n: protokoll.annehmenderName
    }));
    return konstant(erwartet, protokoll.siegel);
  }

  // ---- Angebotsablehnung (Grund optional) ------------------------------
  var ABLEHNGRUENDE = ["Preis", "Leistungsumfang", "Termin", "anderes Angebot gewählt", "Projekt verschoben", "Projekt abgesagt", "keine Angabe", "sonstiger Grund"];
  function ablehnung(angebot, ctx, grund, kommentar, jetztISO) {
    if (!istFreigegeben(angebot)) return { ok: false, grund: "nicht freigegeben" };
    if (angebot.status === "angenommen") return { ok: false, grund: "bereits angenommen" };
    var S = Store();
    return {
      ok: true, protokoll: {
        id: S ? S.uid() : "ab-" + Math.random().toString(36).slice(2, 9), typ: "ablehnung",
        mandantId: ctx.mandantId, kundeId: angebot.kundeId, angebotId: angebot.id, angebotVersion: angebot.version,
        person: ctx.name || "", grund: grund || "keine Angabe", kommentar: kommentar || "", zeitpunkt: jetztISO || nowISO()
      }
    };
  }

  // ---- Bestätigungsdokument (Daten für PDF) ----------------------------
  function bestaetigungsDokument(protokoll, mandant, jetztISO) {
    return {
      dokumentkennung: "BEST-" + (protokoll.angebotNr || "") + "-v" + (protokoll.angebotVersion || "") + "-" + (protokoll.transaktionsId || "").slice(0, 8),
      firmenname: (mandant || {}).name || "", kunde: protokoll.annehmenderName,
      angebotNr: protokoll.angebotNr, angebotVersion: protokoll.angebotVersion,
      auswahl: protokoll.auswahl, brutto: protokoll.brutto, netto: protokoll.netto, mwst: protokoll.mwst,
      bestaetigtVon: protokoll.annehmenderName, zeitpunkt: protokoll.zeitpunkt,
      erklaerung: protokoll.erklaerung, erstellt: jetztISO || nowISO(), unveraenderlich: true
    };
  }

  // ---- Nachrichten (kundensichtbar vs. intern strikt getrennt) ---------
  var NACHRICHT_STATUS = ["offen", "beantwortet", "erledigt"];
  function nachrichtNeu(daten, jetztISO) {
    var S = Store();
    return {
      id: S ? S.uid() : "msg-" + Math.random().toString(36).slice(2, 9),
      angebotId: daten.angebotId, positionNr: daten.positionNr || null, mandantId: daten.mandantId, kundeId: daten.kundeId,
      absender: daten.absender || "", empfaenger: daten.empfaenger || "", text: daten.text || "",
      zeitpunkt: jetztISO || nowISO(), status: "offen",
      kundeSichtbar: daten.kundeSichtbar !== false, intern: !!daten.intern, anhaenge: daten.anhaenge || []
    };
  }
  // Nur für den Kunden sichtbare, nicht-interne Nachrichten des eigenen Angebots.
  function nachrichtenFuerKunde(alle, angebotId, kundeId) {
    return (alle || []).filter(function (m) { return m.angebotId === angebotId && m.kundeId === kundeId && m.kundeSichtbar && !m.intern; });
  }

  // ---- Dokumentfreigabe fürs Portal ------------------------------------
  function dokumentSichtbar(freigabe, ansprechpartnerId, jetztISO) {
    if (!freigabe || freigabe.sichtbar !== true) return false;
    var jetzt = new Date(jetztISO || nowISO()).getTime();
    if (freigabe.sichtbarAb && new Date(freigabe.sichtbarAb).getTime() > jetzt) return false;
    if (freigabe.sichtbarBis && new Date(freigabe.sichtbarBis).getTime() < jetzt) return false;
    if (Array.isArray(freigabe.erlaubteAnsprechpartner) && freigabe.erlaubteAnsprechpartner.length && ansprechpartnerId != null && freigabe.erlaubteAnsprechpartner.indexOf(ansprechpartnerId) < 0) return false;
    return true;
  }

  // ---- Kundenupload: Validierung + Anlage ------------------------------
  // Nur ausdrücklich erlaubte, ungefährliche Dateitypen. Größenlimit.
  var UPLOAD_DOKTYPEN = ["Bestellunterlage", "freigegebene Zeichnung", "Foto", "Baustelleninformation", "sonstiges Projektdokument"];
  var UPLOAD_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
  var ERLAUBTE_EXT = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "dxf", "dwg", "csv", "xlsx", "docx", "txt"];
  var ERLAUBTE_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "image/vnd.dxf", "application/dxf", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "application/octet-stream", "image/x-dwg", "application/acad", ""];
  // Gefährliche/aktive Formate immer ablehnen (Doppelendungen berücksichtigt).
  var GEFAEHRLICHE_EXT = ["exe", "bat", "cmd", "com", "msi", "sh", "js", "mjs", "vbs", "ps1", "jar", "scr", "html", "htm", "svg", "php", "app", "apk", "dll", "lnk"];
  function extVon(name) { var m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : ""; }
  function hatGefaehrlicheEndung(name) {
    var teile = String(name || "").toLowerCase().split(".");
    for (var i = 1; i < teile.length; i++) { if (GEFAEHRLICHE_EXT.indexOf(teile[i]) >= 0) return true; }
    return false;
  }
  // Serverseitig-äquivalente Prüfung (Typ/MIME/Größe/Name). {ok, grund}.
  function uploadPruefen(datei) {
    datei = datei || {};
    var name = String(datei.dateiname || "").trim();
    if (!name) return { ok: false, grund: "kein Dateiname" };
    if (/[\/\\\0]/.test(name)) return { ok: false, grund: "ungültiger Dateiname" };
    if (hatGefaehrlicheEndung(name)) return { ok: false, grund: "Dateityp nicht erlaubt (ausführbar/aktiv)" };
    var ext = extVon(name);
    if (ERLAUBTE_EXT.indexOf(ext) < 0) return { ok: false, grund: "Dateityp nicht erlaubt: ." + (ext || "?") };
    var mime = String(datei.mime || "").toLowerCase();
    if (mime && ERLAUBTE_MIME.indexOf(mime) < 0) return { ok: false, grund: "MIME-Typ nicht erlaubt: " + mime };
    var groesse = num(datei.groesse);
    if (groesse <= 0) return { ok: false, grund: "leere Datei" };
    if (groesse > UPLOAD_MAX_BYTES) return { ok: false, grund: "Datei zu groß (max " + Math.round(UPLOAD_MAX_BYTES / 1024 / 1024) + " MB)" };
    return { ok: true };
  }
  // Kundenupload (nie automatisch technisch freigegeben). Prüft vor Anlage.
  function uploadNeu(daten, jetztISO) {
    var pruef = uploadPruefen(daten);
    if (!pruef.ok) return { ok: false, grund: pruef.grund };
    var S = Store();
    var up = {
      id: S ? S.uid() : "up-" + Math.random().toString(36).slice(2, 9),
      mandantId: daten.mandantId, kundeId: daten.kundeId, angebotId: daten.angebotId || null,
      dateiname: daten.dateiname || "", typ: daten.typ || "sonstiges Projektdokument", mime: daten.mime || "", beschreibung: daten.beschreibung || "",
      projekt: daten.projekt || "", kommission: daten.kommission || "", version: daten.version || 1,
      groesse: num(daten.groesse), inhalt: daten.inhalt || null,
      pruefStatus: "ungeprüft", technischFreigegeben: false, sichtbarIntern: true,
      hochgeladen: jetztISO || nowISO(), beispiel: !!daten.beispiel
    };
    return { ok: true, upload: up };
  }

  // ---- Zeichnungsfreigabe im Portal ------------------------------------
  var ZEICHNUNG_STATUS = ["zur Prüfung", "geöffnet", "freigegeben", "Änderung verlangt", "ersetzt"];
  var ZEICHNUNG_ENTSCHEIDUNGEN = ["freigegeben", "Änderung verlangt"];
  function zeichnungFreigabeNeu(daten, jetztISO) {
    var S = Store();
    return {
      id: S ? S.uid() : "zf-" + Math.random().toString(36).slice(2, 9),
      mandantId: daten.mandantId, kundeId: daten.kundeId, dokumentId: daten.dokumentId || null,
      zeichnungsnummer: daten.zeichnungsnummer || "", revision: daten.revision || "", datum: daten.datum || (jetztISO || nowISO()),
      titel: daten.titel || "", sichtbar: daten.sichtbar !== false, sichtbarAb: daten.sichtbarAb || null, sichtbarBis: daten.sichtbarBis || null,
      erlaubteAnsprechpartner: daten.erlaubteAnsprechpartner || [],
      status: "zur Prüfung", aktuell: daten.aktuell !== false, vorgaengerId: daten.vorgaengerId || null,
      entscheidungen: [], erstellt: jetztISO || nowISO(), beispiel: !!daten.beispiel
    };
  }
  function zeichnungSichtbar(freigabe, ansprechpartnerId, jetztISO) { return dokumentSichtbar(freigabe, ansprechpartnerId, jetztISO); }
  // Kunde entscheidet: „freigegeben" oder „Änderung verlangt". Guards:
  // nur sichtbare, aktuelle, nicht ersetzte Revision; keine Doppelfreigabe.
  function zeichnungEntscheidung(freigabe, entscheidung, ctx, kommentar, jetztISO) {
    ctx = ctx || {};
    if (!freigabe) return { ok: false, grund: "unbekannt" };
    if (ctx.mandantId != null && freigabe.mandantId != null && freigabe.mandantId !== ctx.mandantId) return { ok: false, grund: "fremder Mandant" };
    if (ctx.kundeId != null && freigabe.kundeId !== ctx.kundeId) return { ok: false, grund: "fremder Kunde" };
    if (!zeichnungSichtbar(freigabe, ctx.ansprechpartnerId, jetztISO)) return { ok: false, grund: "nicht sichtbar" };
    if (freigabe.status === "ersetzt" || freigabe.aktuell === false) return { ok: false, grund: "ersetzte Revision" };
    if (ZEICHNUNG_ENTSCHEIDUNGEN.indexOf(entscheidung) < 0) return { ok: false, grund: "ungültige Entscheidung" };
    if (freigabe.status === "freigegeben") return { ok: false, grund: "bereits freigegeben" };
    if (entscheidung === "Änderung verlangt" && !(kommentar && String(kommentar).trim())) return { ok: false, grund: "kommentar erforderlich" };
    var eintrag = {
      entscheidung: entscheidung, kunde: freigabe.kundeId, person: ctx.name || "", revision: freigabe.revision,
      kommentar: kommentar || "", zeitpunkt: jetztISO || nowISO(),
      zugang: ctx.linkId ? { art: "link", id: ctx.linkId } : { art: "konto", id: (ctx.portalUser || {}).id || null }
    };
    (freigabe.entscheidungen = freigabe.entscheidungen || []).push(eintrag);
    freigabe.status = entscheidung;
    return { ok: true, eintrag: eintrag };
  }
  // Neue Revision: alte Freigabe eindeutig als „ersetzt" kennzeichnen.
  function zeichnungErsetzen(alteFreigabe) { if (alteFreigabe) { alteFreigabe.status = "ersetzt"; alteFreigabe.aktuell = false; } return alteFreigabe; }

  // ---- Auftragsstatus intern -> kundenfreundlich -----------------------
  var STATUS_MAPPING = {
    "Beauftragt": "Auftrag bestätigt", "In Vorbereitung": "in Vorbereitung", "Materialbeschaffung": "Materialbeschaffung",
    "In Fertigung": "in Fertigung", "Fertig": "bereit zur Montage", "Montage geplant": "Montage geplant",
    "Montage": "Montage geplant", "Abgeschlossen": "abgeschlossen"
  };
  function kundenStatus(internStatus) { return STATUS_MAPPING[internStatus] || "in Bearbeitung"; }

  // ---- Branding je Mandant ---------------------------------------------
  function branding(mandant) {
    mandant = mandant || {};
    return {
      name: mandant.name || "", logo: mandant.logo || "", farbe: mandant.farbe || "#3d7bd6",
      kontakt: mandant.kontakt || "", support: mandant.support || "", fuss: mandant.fuss || "",
      datenschutz: mandant.datenschutz || "", impressum: mandant.impressum || ""
    };
  }

  // ---- Portal-Benachrichtigungen (intern) ------------------------------
  var EVENTS = ["angebot_geoeffnet", "frage_gestellt", "option_gewaehlt", "angebot_angenommen", "angebot_abgelehnt", "verlaengerung_angefragt", "dokument_hochgeladen", "zeichnung_freigegeben", "zeichnung_aenderung"];
  function ereignis(daten, jetztISO) {
    var S = Store();
    return { id: S ? S.uid() : "ev-" + Math.random().toString(36).slice(2, 9), typ: daten.typ, mandantId: daten.mandantId, kundeId: daten.kundeId, angebotId: daten.angebotId || null, text: daten.text || "", gelesen: false, zeitpunkt: jetztISO || nowISO() };
  }

  w.Preisschmiede.Portal = {
    ROLLEN: ROLLEN, ROLLE_LABEL: ROLLE_LABEL, darfAnnehmen: darfAnnehmen,
    portalUserNeu: portalUserNeu, passwortSetzen: passwortSetzen, passwortPruefen: passwortPruefen,
    linkNeu: linkNeu, linkPruefen: linkPruefen, linkVerwenden: linkVerwenden, linkWiderrufen: linkWiderrufen,
    istFreigegeben: istFreigegeben, istErsetzt: istErsetzt, abgelaufen: abgelaufen, kundenAngebot: kundenAngebot,
    auswahlAnwenden: auswahlAnwenden, auswahlGueltig: auswahlGueltig, neuberechnung: neuberechnung, pdfPruefsumme: pdfPruefsumme,
    ABLEHNGRUENDE: ABLEHNGRUENDE, annahmePruefen: annahmePruefen, annahmeProtokoll: annahmeProtokoll, siegelPruefen: siegelPruefen, ablehnung: ablehnung,
    bestaetigungsDokument: bestaetigungsDokument,
    NACHRICHT_STATUS: NACHRICHT_STATUS, nachrichtNeu: nachrichtNeu, nachrichtenFuerKunde: nachrichtenFuerKunde,
    dokumentSichtbar: dokumentSichtbar,
    UPLOAD_DOKTYPEN: UPLOAD_DOKTYPEN, UPLOAD_MAX_BYTES: UPLOAD_MAX_BYTES, ERLAUBTE_EXT: ERLAUBTE_EXT, uploadPruefen: uploadPruefen, uploadNeu: uploadNeu,
    ZEICHNUNG_STATUS: ZEICHNUNG_STATUS, ZEICHNUNG_ENTSCHEIDUNGEN: ZEICHNUNG_ENTSCHEIDUNGEN, zeichnungFreigabeNeu: zeichnungFreigabeNeu, zeichnungSichtbar: zeichnungSichtbar, zeichnungEntscheidung: zeichnungEntscheidung, zeichnungErsetzen: zeichnungErsetzen,
    STATUS_MAPPING: STATUS_MAPPING, kundenStatus: kundenStatus, branding: branding,
    EVENTS: EVENTS, ereignis: ereignis
  };
})(typeof self !== "undefined" ? self : this);
