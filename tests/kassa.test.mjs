/*  Sommerfest-Kassa – automatische Tests (Unit + End-to-End)
 *  Läuft mit dem echten kassa.html im Chromium (Playwright).
 *
 *  Start:   node tests/kassa.test.mjs
 *  Voraussetzung: Playwright + Chromium installiert (siehe tests/README.md).
 *
 *  Es werden KEINE echten Kassendaten verändert – jeder Test nutzt einen
 *  frischen, isolierten Browser-Kontext (eigener localStorage).
 */
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
// Playwright aus lokaler oder globaler Installation laden
let chromium;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
  try { ({ chromium } = require(p)); break; } catch (e) {}
}
if (!chromium) { console.error('Playwright nicht gefunden – siehe tests/README.md'); process.exit(2); }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = pathToFileURL(path.resolve(__dirname, '..', 'kassa.html')).href;

let pass = 0, fail = 0;
const eq = (a, b, msg) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) { pass++; /*console.log('ok  '+msg);*/ }
  else { fail++; console.error(`FAIL: ${msg}\n      erwartet ${B}, war ${A}`); }
};
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('FAIL: ' + msg); } };
const group = m => console.log('\n— ' + m);

// Dialog-Steuerung (prompt/confirm/alert) pro Seite
function attachDialogs(page) {
  const state = { prompt: '', cancel: false, confirm: true, messages: [] };
  page.on('dialog', async d => {
    state.messages.push(d.message());
    if (d.type() === 'prompt') { state.cancel ? await d.dismiss() : await d.accept(state.prompt); }
    else if (d.type() === 'confirm') { state.confirm ? await d.accept() : await d.dismiss(); }
    else await d.accept();
  });
  return state;
}

async function freshPage(browser, club) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const dlg = attachDialogs(page);
  await page.goto(FILE);
  if (club) {
    await page.evaluate(c => localStorage.setItem('kassa_club', c), club);
    await page.reload();
    await page.waitForFunction(() => window.KASSA && window.KASSA.CLUBCFG);
  }
  return { ctx, page, errors, dlg };
}
// internen Zustand zurücksetzen (ohne echte Reset-Buttons)
const resetState = page => page.evaluate(() => {
  const K = window.KASSA;
  K.cart = {}; K.pfandBack = 0; K.day = K.leer(); K.archive = []; K.counter = {}; K.imported = { devices: {} };
  K.render(); K.updateCounter();
});

(async () => {
  const browser = await chromium.launch();

  // ================= 1. Cent-Konvertierung & Euro-Format ==================
  {
    group('Cent-Konvertierung & Euro-Format');
    const { ctx, page } = await freshPage(browser, 'fsgl');
    const r = await page.evaluate(() => {
      const K = window.KASSA;
      const ci = s => { const v = K.centsFromInput(s); return Number.isNaN(v) ? 'NaN' : v; };
      return {
        e0: K.eur(0), e150: K.eur(150), e1234: K.eur(1234), e5: K.eur(5),
        e99: K.eur(99), e100: K.eur(100), eneg: K.eur(-200),
        c1: ci('12,50'), c2: ci('12.5'), c3: ci('0'), c4: ci(''), c5: ci('abc'),
        c6: ci('-5'), c7: ci('3,999'), c8: ci(' 7 '), c9: ci('0,50')
      };
    });
    eq(r.e0, '0,00 €', 'eur(0)');
    eq(r.e150, '1,50 €', 'eur(150)');
    eq(r.e1234, '12,34 €', 'eur(1234)');
    eq(r.e5, '0,05 €', 'eur(5)');
    eq(r.e99, '0,99 €', 'eur(99)');
    eq(r.e100, '1,00 €', 'eur(100)');
    eq(r.eneg, '−2,00 €', 'eur(-200) negativ');
    eq(r.c1, 1250, 'centsFromInput 12,50');
    eq(r.c2, 1250, 'centsFromInput 12.5');
    eq(r.c3, 0, 'centsFromInput 0');
    eq(r.c4, 'NaN', 'centsFromInput leer -> NaN');
    eq(r.c5, 'NaN', 'centsFromInput abc -> NaN');
    eq(r.c6, -500, 'centsFromInput -5');
    eq(r.c7, 400, 'centsFromInput 3,999 rundet');
    eq(r.c8, 700, 'centsFromInput mit Leerzeichen');
    eq(r.c9, 50, 'centsFromInput 0,50');
    await ctx.close();
  }

  // ================= 2. Warenkorb, Pfand, Summen (FSGL) ===================
  {
    group('Warenkorb / Pfand / Summen (FSGL)');
    const { ctx, page } = await freshPage(browser, 'fsgl');
    const t = await page.evaluate(() => {
      const K = window.KASSA, out = {};
      const set = c => { K.cart = c; };
      set({ b50: 2 });               out.zweiBier = K.totals();             // 2×4,50 + 2×2 Pfand
      set({ chilli: 1 });            out.chilliNurWare = K.totals();        // Speise ohne Pfand
      set({ chilli: 1, b50: 1 });    out.gemischt = K.totals();
      set({ b50: 1000 });            out.gross = K.totals();               // sehr große Menge
      set({ b50: 2 }); K.pfandBack = 1; out.mitRetour = K.totals();       // 1 Becher zurück
      K.pfandBack = 0;
      return out;
    });
    eq(t.zweiBier, { wareC: 900, pfandC: 400, totalC: 1300 }, '2× Bier 0,5 = 13,00 €');
    eq(t.chilliNurWare, { wareC: 850, pfandC: 0, totalC: 850 }, 'Chilli ohne Pfand');
    eq(t.gemischt, { wareC: 1300, pfandC: 200, totalC: 1500 }, 'Speise+Getränk');
    eq(t.gross, { wareC: 450000, pfandC: 200000, totalC: 650000 }, '1000× Bier exakt');
    eq(t.mitRetour, { wareC: 900, pfandC: 200, totalC: 1100 }, '2× Bier − 1 Becher retour');
    await ctx.close();
  }

  // ================= 3. SCL-Preise (0,50-Beträge, Schlipfkrapfen 9€) ======
  {
    group('SCL-Artikel & 0,50-Beträge');
    const { ctx, page } = await freshPage(browser, 'scl');
    const t = await page.evaluate(() => {
      const K = window.KASSA, out = {};
      K.cart = { schlipf: 1 };  out.schlipf = K.totals();     // 9,00 ohne Pfand
      K.cart = { soda: 3 };     out.soda = K.totals();        // 0,50 ohne Pfand
      K.cart = { bier50: 1, soda: 1 }; out.mix = K.totals();  // 4,50+2 Pfand + 0,50
      K.cart = { sommerbowl: 2 }; out.bowl = K.totals();      // 4,50 + 2 Pfand je Becher
      K.cart = {};
      return { out, items: K.MENU.length, name: K.CLUBCFG.name, bowl: K.byId('sommerbowl') };
    });
    eq(t.out.schlipf, { wareC: 900, pfandC: 0, totalC: 900 }, 'Schlipfkrapfen 9,00 €');
    eq(t.out.soda, { wareC: 150, pfandC: 0, totalC: 150 }, '3× Soda 0,50 = 1,50 €');
    eq(t.out.mix, { wareC: 500, pfandC: 200, totalC: 700 }, 'Bier + Soda-Aufpreis');
    eq(t.out.bowl, { wareC: 900, pfandC: 400, totalC: 1300 }, '2× SommerBowl 4,50 € + Pfand = 13,00 €');
    ok(t.bowl && t.bowl.name === 'SommerBowl' && t.bowl.c === 450 && t.bowl.pfand === true && t.bowl.cat === 'getraenke',
       'SommerBowl: 4,50 € Getränk mit Pfand vorhanden');
    eq(t.items, 14, 'SCL hat 14 Artikel (inkl. SommerBowl)');
    eq(t.name, 'SCL', 'SCL-Name korrekt');
    await ctx.close();
  }

  // ================= 4. Verkauf buchen + Doppelklick-Schutz ================
  {
    group('Verkauf buchen / Doppelklick-Schutz / zu wenig gegeben');
    const { ctx, page, dlg } = await freshPage(browser, 'fsgl');
    await resetState(page);
    // (a) leere Bestellung bucht nicht
    let s = await page.evaluate(() => { document.getElementById('btnNew').click(); return window.KASSA.day.count; });
    eq(s, 0, 'leere Bestellung wird nicht gebucht');
    // (b) normaler Verkauf bucht genau 1×
    s = await page.evaluate(() => {
      const K = window.KASSA; K.cart = { b50: 2 }; K.render();
      document.getElementById('btnNew').click();
      return { count: K.day.count, ware: K.day.ware, pfandOut: K.day.pfandOut, items: K.day.items, cartLeer: Object.keys(K.cart).length };
    });
    eq(s.count, 1, 'ein Verkauf gebucht');
    eq(s.ware, 900, 'Ware 9,00 € gebucht');
    eq(s.pfandOut, 400, 'Pfand 4,00 € gebucht');
    eq(s.items, { b50: 2 }, 'Artikelmenge gebucht');
    eq(s.cartLeer, 0, 'Warenkorb nach Buchung leer');
    // (c) Doppelklick bucht nur 1×
    s = await page.evaluate(() => {
      const K = window.KASSA; K.cart = { b30: 1 }; K.render();
      const b = document.getElementById('btnNew'); b.click(); b.click(); b.click();
      return K.day.count;
    });
    eq(s, 2, 'Doppel-/Dreifachklick bucht nur einen weiteren Verkauf');
    // (d) zu wenig gegeben -> Warnung, keine Buchung
    dlg.messages.length = 0;
    s = await page.evaluate(async () => {
      const K = window.KASSA; K.cart = { b50: 1 }; K.render();            // 6,50 €
      document.getElementById('given').value = '5';
      document.getElementById('given').dispatchEvent(new Event('input'));
      document.getElementById('btnNew').click();
      return { count: K.day.count, cart: Object.keys(K.cart).length };
    });
    eq(s.count, 2, 'zu wenig gegeben -> kein weiterer Verkauf gebucht');
    eq(s.cart, 1, 'Warenkorb bleibt bei zu wenig Geld erhalten');
    ok(dlg.messages.some(m => /zu wenig/i.test(m)), 'Warnung "zu wenig gegeben" erscheint');
    // (e) leeres Gegeben-Feld erlaubt Buchung
    s = await page.evaluate(() => {
      const K = window.KASSA; document.getElementById('given').value = '';
      document.getElementById('given').dispatchEvent(new Event('input'));
      document.getElementById('btnNew').click();
      return K.day.count;
    });
    eq(s, 3, 'leeres Gegeben-Feld -> Buchung erlaubt');
    await ctx.close();
  }

  // ================= 5. Rückgeld =========================================
  {
    group('Rückgeld / Gegeben');
    const { ctx, page } = await freshPage(browser, 'fsgl');
    await resetState(page);
    const rd = await page.evaluate(() => {
      const K = window.KASSA; K.cart = { b50: 2 }; K.render();  // 13,00
      const g = document.getElementById('given'), out = document.getElementById('retOut');
      const setGiven = v => { g.value = v; g.dispatchEvent(new Event('input')); return out.textContent.replace(/\s+/g, ' ').trim(); };
      return { genug: setGiven('20'), knapp: setGiven('10'), exakt: setGiven('13'), leer: setGiven(''), negativ: setGiven('-5') };
    });
    ok(/Rückgeld/.test(rd.genug) && /7,00/.test(rd.genug), 'Rückgeld 7,00 € bei 20 gegeben');
    ok(/fehlen/.test(rd.knapp) && /3,00/.test(rd.knapp), 'zeigt "fehlen 3,00 €" bei 10 gegeben');
    ok(/Rückgeld/.test(rd.exakt) && /0,00/.test(rd.exakt), 'Rückgeld 0,00 € bei exakt');
    eq(rd.leer, '', 'leeres Feld zeigt kein Rückgeld');
    eq(rd.negativ, '', 'negative Eingabe zeigt kein Rückgeld');
    await ctx.close();
  }

  // ================= 6. Quick-Cash-Tasten (aufaddieren, C) ================
  {
    group('Schnelltasten Gegeben (1,2,5,10,20,50,100 & C)');
    const { ctx, page } = await freshPage(browser, 'fsgl');
    await resetState(page);
    const r = await page.evaluate(() => {
      const K = window.KASSA; K.cart = { b50: 1 }; K.render();
      const g = document.getElementById('given');
      const tap = v => document.querySelector(`.quickcash [data-cash="${v}"]`).click();
      g.value = ''; g.dispatchEvent(new Event('input'));
      tap('20'); tap('10'); tap('2');            // 32 €
      const after = g.value;
      document.querySelector('.quickcash .qc-clear').click();
      return { after, cleared: g.value };
    });
    eq(r.after, '32', 'Schnelltasten addieren 20+10+2 = 32');
    eq(r.cleared, '', 'C löscht das Feld');
    await ctx.close();
  }

  // ================= 7. Tagesstatistik / PIN / Verkäufe-Semantik ==========
  {
    group('Tagesstatistik, PIN & Verkäufe-Bedeutung');
    const { ctx, page, dlg } = await freshPage(browser, 'fsgl');
    await resetState(page);
    // 2 Kassenvorgänge mit zusammen 3 Artikeln
    await page.evaluate(() => {
      const K = window.KASSA;
      K.cart = { b50: 2 }; document.getElementById('btnNew').click();  // 1 Vorgang, 2 Artikel
      K.cart = { chilli: 1 }; document.getElementById('btnNew').click(); // 1 Vorgang, 1 Artikel
    });
    // falscher PIN
    dlg.prompt = '0000'; dlg.messages.length = 0;
    await page.click('#btnTag');
    ok(dlg.messages.some(m => /Falscher PIN/i.test(m)), 'falscher PIN wird abgelehnt');
    ok(!(await page.evaluate(() => document.getElementById('modal').classList.contains('open'))), 'Modal bleibt bei falschem PIN zu');
    // richtiger PIN
    dlg.prompt = '1234';
    await page.click('#btnTag');
    const st = await page.evaluate(() => ({
      open: document.getElementById('modal').classList.contains('open'),
      count: document.getElementById('dCount').textContent,
      ware: document.getElementById('dWare').textContent
    }));
    ok(st.open, 'richtiger PIN öffnet Auswertung');
    eq(st.count, '2', '"Verkäufe" = 2 Vorgänge (nicht 3 Artikel)');
    eq(st.ware.replace(/\s/g, ''), '17,50€', 'Umsatz Ware 17,50 € (2×4,50 + 8,50)');
    await ctx.close();
  }

  // ================= 8. Becher noch draußen darf nicht negativ sein =======
  {
    group('"Becher noch draußen" nicht negativ');
    const { ctx, page, dlg } = await freshPage(browser, 'fsgl');
    await resetState(page);
    dlg.prompt = '1234';
    const cups = await page.evaluate(() => {
      const K = window.KASSA;
      K.day = Object.assign(K.leer(), { ware: 450, pfandOut: 200, pfandBack: 600, count: 1, items: { b50: 1 } });
      K.saveDay(); K.showDay();
      return document.getElementById('dCups').textContent;
    });
    eq(cups.trim(), '0 Becher', 'mehr Becher zurück als raus -> "0 Becher" statt negativ');
    await ctx.close();
  }

  // ================= 9. Tag abschließen ===================================
  {
    group('Tag abschließen');
    const { ctx, page, dlg } = await freshPage(browser, 'fsgl');
    await resetState(page);
    dlg.confirm = true; dlg.prompt = '1234';
    const r = await page.evaluate(() => {
      const K = window.KASSA;
      K.day.startCash = 10000;                                   // 100 € Wechselgeld
      K.cart = { b50: 1 }; document.getElementById('btnNew').click();
      document.getElementById('btnCloseDay').click();            // archivieren
      return { arch: K.archive.length, count: K.day.count, start: K.day.startCash, gesamtCount: K.gesamt().count };
    });
    eq(r.arch, 1, 'genau ein Tag archiviert');
    eq(r.count, 0, 'neuer Tag beginnt bei 0 Verkäufen');
    eq(r.start, 10000, 'Wechselgeld wird auf neuen Tag übernommen');
    eq(r.gesamtCount, 1, 'Gesamtstatistik bleibt erhalten');
    await ctx.close();
  }

  // ================= 10. Vereinstrennung (namespaced localStorage) ========
  {
    group('Datentrennung FSGL / SCL');
    const { ctx, page, dlg } = await freshPage(browser, 'fsgl');
    dlg.confirm = true;
    await resetState(page);
    await page.evaluate(() => { const K = window.KASSA; K.cart = { b50: 3 }; document.getElementById('btnNew').click(); });
    // zu SCL wechseln
    await page.evaluate(() => localStorage.setItem('kassa_club', 'scl'));
    await page.reload(); await page.waitForFunction(() => window.KASSA && window.KASSA.CLUBCFG);
    await resetState(page);
    const scl = await page.evaluate(() => { const K = window.KASSA; K.cart = { bier50: 1 }; document.getElementById('btnNew').click(); return K.gesamt().count; });
    eq(scl, 1, 'SCL hat eigene, getrennte Zahlen');
    // zurück zu FSGL – Daten müssen unverändert sein
    await page.evaluate(() => localStorage.setItem('kassa_club', 'fsgl'));
    await page.reload(); await page.waitForFunction(() => window.KASSA && window.KASSA.CLUBCFG);
    const fsgl = await page.evaluate(() => ({ g: window.KASSA.gesamt(), name: window.KASSA.CLUBCFG.name }));
    eq(fsgl.name, 'FSGL', 'zurück bei FSGL');
    eq(fsgl.g.ware, 1350, 'FSGL-Daten unverändert (3× Bier = 13,50 €)');
    eq(fsgl.g.count, 1, 'FSGL-Verkäufe unverändert');
    await ctx.close();
  }

  // ================= 11. Speichern & Wiederherstellen (Reload) ============
  {
    group('Warenkorb nach Neuladen wiederherstellen');
    const { ctx, page } = await freshPage(browser, 'fsgl');
    await resetState(page);
    await page.evaluate(() => { const K = window.KASSA; K.cart = { b50: 2, chilli: 1 }; K.pfandBack = 1; K.render(); });
    await page.reload(); await page.waitForFunction(() => window.KASSA && window.KASSA.CLUBCFG);
    const r = await page.evaluate(() => ({ cart: window.KASSA.cart, pb: window.KASSA.pfandBack }));
    eq(r.cart, { b50: 2, chilli: 1 }, 'offener Warenkorb nach Reload wiederhergestellt');
    eq(r.pb, 1, 'Becher-Retour nach Reload wiederhergestellt');
    await ctx.close();
  }

  // ================= 12. Beschädigte gespeicherte Daten ===================
  {
    group('Beschädigte localStorage-Daten');
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    attachDialogs(page);
    await page.goto(FILE);
    await page.evaluate(() => {
      localStorage.setItem('kassa_club', 'fsgl');
      localStorage.setItem('kassa2_fsgl', '{ kaputt');
      localStorage.setItem('kassa_tag2_fsgl', '"nicht-objekt"');
      localStorage.setItem('kassa_fest2_fsgl', '{"nicht":"array"}');
      localStorage.setItem('kassa_cnt_fsgl', '[1,2,3]');
    });
    await page.reload();
    await page.waitForFunction(() => window.KASSA && window.KASSA.CLUBCFG);
    const r = await page.evaluate(() => ({ cart: window.KASSA.cart, day: window.KASSA.day, arch: window.KASSA.archive }));
    eq(errors.length, 0, 'keine unbehandelten Fehler trotz kaputter Daten');
    eq(r.cart, {}, 'kaputter Warenkorb -> leer');
    eq(r.day.ware, 0, 'kaputte Tagesdaten -> 0');
    ok(Array.isArray(r.arch) && r.arch.length === 0, 'kaputtes Archiv -> leeres Array');
    await ctx.close();
  }

  // ================= 13. QR Encode/Decode + Bericht-Anzeige ===============
  {
    group('QR Encode/Decode & Bericht');
    const { ctx, page } = await freshPage(browser, 'fsgl');
    const rt = await page.evaluate(() => {
      const K = window.KASSA;
      const obj = { v: 2, club: 'SCL', t: '30.07.2026', w: 12345, po: 200, pb: 0, c: 7, it: [{ n: 'Prosecco Öäü ß €', q: 3 }], days: [{ s: 'x', cash: 12545, n: 7 }] };
      const enc = K.b64urlEncode(JSON.stringify(obj));
      const dec = JSON.parse(K.b64urlDecode(enc));
      return { same: JSON.stringify(obj) === JSON.stringify(dec), enc, umlaut: dec.it[0].n };
    });
    ok(rt.same, 'QR-Payload Encode->Decode identisch');
    eq(rt.umlaut, 'Prosecco Öäü ß €', 'Umlaute/Sonderzeichen bleiben erhalten');
    await ctx.close();
    // Bericht per #r= in FRISCHEM Kontext (ohne Vereinswahl) öffnen
    const rctx = await browser.newContext();
    const rpage = await rctx.newPage();
    attachDialogs(rpage);
    await rpage.goto(FILE + '#r=' + rt.enc);
    await rpage.waitForFunction(() => document.getElementById('report').classList.contains('open'));
    const rep = await rpage.evaluate(() => ({
      open: document.getElementById('report').classList.contains('open'),
      src: (document.getElementById('reportImg').src || '').slice(0, 22),
      pickerOpen: document.getElementById('picker').classList.contains('open')
    }));
    ok(rep.open, 'QR-Bericht öffnet sich ohne Vereinswahl');
    eq(rep.src, 'data:image/png;base64,', 'Bericht als PNG-Bild erzeugt');
    ok(!rep.pickerOpen, 'im Bericht-Modus keine Vereinsauswahl');
    await rctx.close();
  }

  // ================= 14. Kaputte/ leere QR-URL -> kein Blackout ===========
  {
    group('Beschädigte QR-URL blockiert nicht');
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    attachDialogs(page);
    await page.goto(FILE + '#r=####kaputt####');
    await page.waitForFunction(() => window.KASSA || document.getElementById('picker').classList.contains('open'));
    const r = await page.evaluate(() => ({
      picker: document.getElementById('picker').classList.contains('open'),
      report: document.getElementById('report').classList.contains('open')
    }));
    eq(errors.length, 0, 'kaputte QR-URL wirft keinen Fehler');
    ok(r.picker && !r.report, 'kaputte QR-URL -> normale Vereinsauswahl statt leerer Seite');
    await ctx.close();
  }

  // ================= 15. Long-Press = +5, kein Extra +1 ===================
  {
    group('Lange drücken = +5 (kein zusätzliches +1)');
    const { ctx, page } = await freshPage(browser, 'fsgl');
    await resetState(page);
    const btn = await page.$('button.item[data-id="b50"]');
    const box = await btn.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(680);           // > 550 ms -> Langdruck
    await page.mouse.up();
    let five = await page.evaluate(() => window.KASSA.cart.b50 || 0);
    eq(five, 5, 'Langdruck bucht genau +5');
    // schnelles 3× Tippen = +3
    await resetState(page);
    await btn.click(); await btn.click(); await btn.click();
    const three = await page.evaluate(() => window.KASSA.cart.b50 || 0);
    eq(three, 3, 'schnelles 3× Tippen = +3 (kein Doppelzählen)');
    await ctx.close();
  }

  // ================= 16. Artikel im Warenkorb +/- und entfernen ===========
  {
    group('Bestellliste +/- und Entfernen bei 0');
    const { ctx, page } = await freshPage(browser, 'fsgl');
    await resetState(page);
    const r = await page.evaluate(() => {
      const K = window.KASSA; K.cart = { b50: 1 }; K.render();
      document.querySelector('#order [data-a="b50"]').click();  // +1 -> 2
      document.querySelector('#order [data-a="b50"]').click();  // +1 -> 3
      const nach3 = K.cart.b50;
      document.querySelector('#order [data-d="b50"]').click();  // -1 -> 2
      const nach2 = K.cart.b50;
      // bis 0 -> Artikel verschwindet
      document.querySelector('#order [data-d="b50"]').click();
      document.querySelector('#order [data-d="b50"]').click();
      return { nach3, nach2, weg: (K.cart.b50 === undefined), empty: document.querySelector('#order .empty') !== null };
    });
    eq(r.nach3, 3, '+ in der Liste erhöht'); eq(r.nach2, 2, '− in der Liste verringert');
    ok(r.weg, 'Artikel bei Menge 0 entfernt'); ok(r.empty, 'leere Bestellung zeigt Hinweis');
    await ctx.close();
  }

  // ================= 17. Vereinswahl: Code-Prüfung ========================
  {
    group('Vereinswahl mit richtigem/falschem Code');
    // falscher Code -> kein Verein gespeichert
    let { ctx, page, dlg } = await freshPage(browser, null);
    dlg.prompt = '0000';
    await page.click('.pclubs [data-club="fsgl"]');
    let saved = await page.evaluate(() => localStorage.getItem('kassa_club'));
    eq(saved, null, 'falscher Code speichert keinen Verein');
    ok(dlg.messages.some(m => /Falscher Code/i.test(m)), 'Meldung "Falscher Code"');
    // Abbrechen -> nichts
    dlg.cancel = true;
    await page.click('.pclubs [data-club="fsgl"]');
    saved = await page.evaluate(() => localStorage.getItem('kassa_club'));
    eq(saved, null, 'Abbrechen speichert keinen Verein');
    // richtiger Code -> gespeichert (SCL 1610)
    dlg.cancel = false; dlg.prompt = '1610';
    await page.click('.pclubs [data-club="scl"]');
    await page.waitForFunction(() => window.KASSA && window.KASSA.CLUBCFG);
    const cfg = await page.evaluate(() => ({ club: localStorage.getItem('kassa_club'), name: window.KASSA.CLUBCFG.name }));
    eq(cfg.club, 'scl', 'richtiger Code speichert Verein');
    eq(cfg.name, 'SCL', 'SCL geladen');
    await ctx.close();
  }

  // ================= 18. 2-Tablet-Zusammenführung (Merge) =================
  {
    group('SCL 2-Tablet-Zusammenführung');
    // 2. Tablet erzeugt Merge-Payload
    const t2 = await freshPage(browser, 'scl');
    const mergeHash = await t2.page.evaluate(() => {
      const K = window.KASSA; K.cart = { bier50: 1 }; document.getElementById('btnNew').click();
      K.cart = { schlipf: 1 }; document.getElementById('btnNew').click();
      const g = K.gesamt();
      const p = { v: 3, club: 'SCL', dev: K.DEVID, t: '30.07.2026', w: g.ware, po: g.pfandOut, pb: g.pfandBack, c: g.count };
      return '#m=' + K.b64urlEncode(JSON.stringify(p));
    });
    const dev2 = await t2.page.evaluate(() => window.KASSA.DEVID);
    await t2.ctx.close();
    // Haupt-Tablet
    const main = await freshPage(browser, 'scl');
    main.dlg.prompt = '1234';
    const res = await main.page.evaluate(hash => {
      const K = window.KASSA; K.cart = { bier50: 1 }; document.getElementById('btnNew').click(); // 6,50
      location.hash = hash.slice(1);
      K.handleMergeUrl();
      K.showDay();
      return {
        imp: K.impCount(),
        title: document.getElementById('bothTitle').textContent,
        main: document.getElementById('bMain').textContent.replace(/\s/g, ''),
        other: document.getElementById('bOther').textContent.replace(/\s/g, ''),
        total: document.getElementById('bCash').textContent.replace(/\s/g, ''),
        visible: document.getElementById('bothBox').style.display !== 'none'
      };
    }, mergeHash);
    ok(res.visible, 'Gesamt-Box sichtbar nach Merge');
    eq(res.imp, 1, 'ein fremdes Tablet übernommen');
    ok(/SCL gesamt/.test(res.title), 'Titel "SCL gesamt"');
    eq(res.main, '6,50€', 'Haupt-Tablet 6,50 €');
    eq(res.other, '15,50€', '2. Tablet 15,50 €');
    eq(res.total, '22,00€', 'Gesamt beide 22,00 €');
    // Re-Scan zählt nicht doppelt
    const re = await main.page.evaluate(hash => {
      const K = window.KASSA; location.hash = hash.slice(1); K.handleMergeUrl(); K.showDay();
      return { imp: K.impCount(), total: document.getElementById('bCash').textContent.replace(/\s/g, '') };
    }, mergeHash);
    eq(re.imp, 1, 'Re-Scan: kein zweites Tablet');
    eq(re.total, '22,00€', 'Re-Scan: Summe bleibt 22,00 €');
    await main.ctx.close();
  }

  // ================= 19. QR erzeugen + Fallback auf PNG ===================
  {
    group('QR-Statistik erzeugen & Fallback');
    const { ctx, page, dlg } = await freshPage(browser, 'fsgl');
    await resetState(page);
    dlg.prompt = '1234';
    await page.evaluate(() => { const K = window.KASSA; K.cart = { b50: 3 }; document.getElementById('btnNew').click(); });
    // normaler QR
    await page.click('#btnTag');
    await page.click('#btnSend');
    const qr = await page.evaluate(() => ({
      open: document.getElementById('qrmodal').classList.contains('open'),
      svg: !!document.querySelector('#qrbox svg')
    }));
    ok(qr.open, 'QR-Fenster öffnet sich');
    ok(qr.svg, 'QR-Code als SVG erzeugt');
    // Fallback: qrcode-Bibliothek "fehlt" -> Angebot, Bild direkt anzuzeigen
    dlg.confirm = true;
    const fb = await page.evaluate(() => {
      document.getElementById('qrmodal').classList.remove('open');
      window.qrcode = undefined;                       // Bibliothek simuliert fehlend
      window.KASSA.makeTransfer();                      // ruft intern showQr -> false -> Fallback
      return document.getElementById('report').classList.contains('open');
    });
    ok(fb, 'ohne QR-Bibliothek: Statistik wird als Bild (PNG) angeboten – kein Datenverlust');
    await ctx.close();
  }

  // ================= 20. Speicherfehler wird sichtbar gewarnt =============
  {
    group('Speicherfehler -> sichtbare Warnung (nicht still ignoriert)');
    const { ctx, page, dlg } = await freshPage(browser, 'fsgl');
    await resetState(page);
    dlg.messages.length = 0;
    const warned = await page.evaluate(() => {
      // Speichern scheitern lassen (Prototyp-Methode ersetzen -> simuliert vollen Speicher)
      Storage.prototype.setItem = function () { throw new Error('QuotaExceeded'); };
      const K = window.KASSA; K.cart = { b50: 1 }; K.render();  // render -> save -> store -> Fehler
      return true;
    });
    ok(warned, 'Render mit fehlgeschlagenem Speichern stürzt nicht ab');
    ok(dlg.messages.some(m => /nicht.*gespeichert|ACHTUNG/i.test(m)), 'klare Warnung bei fehlgeschlagenem Speichern');
    await ctx.close();
  }

  // ================= Ergebnis =============================================
  await browser.close();
  console.log(`\n==================  ${pass} bestanden · ${fail} fehlgeschlagen  ==================`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgestürzt:', e); process.exit(2); });
