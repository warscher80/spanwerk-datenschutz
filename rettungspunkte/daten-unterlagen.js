/* daten-unterlagen.js — Unterlagen, die MIT der App kommen.
   ERZEUGT von tools/lieferung.js — von Hand nur ändern, wenn man weiß, warum.

   Bis 0.24.0 mussten Pläne und Spanntabellen als Paket eingelesen werden. Auf
   der Baustelle macht das niemand, und wer es vergisst, steht ohne
   Gründungsplan am Mast. Was fest zu einer Baustelle gehört, wird deshalb
   mitgeliefert und beim ersten Start selbst übernommen — ohne einen einzigen
   Knopfdruck.

   `stand` ist die Fassung dieser Lieferung. Wird sie erhöht, trägt die App
   die Unterlagen erneut nach; bleibt sie gleich, passiert nichts. So wird aus
   einer Aktualisierung kein zweiter Satz Pläne.

   Diese Liste lesen drei: die App (Nachtragen), der Service Worker
   (Offline-Speicher) und tools/pages-deploy.js (Ausliefern). Deshalb steht
   eine Lieferung nur HIER und nirgends sonst.

   Erfunden wird nichts: Jede Zeile verweist auf eine Datei, die aus den
   Unterlagen des Auftraggebers ausgelesen wurde. */
var SPIE_UNTERLAGEN = [
  {
    id: "blatzheim-2022",
    stand: 1,
    baustelle: "Blatzheim",
    leitung: "4236",
    datei: "./unterlagen-blatzheim.zip",
    was: "5 Gründungspläne · 5 Spanntabellen (EUROPTEN, 09.11.2022)"
  }
];

if (typeof module !== 'undefined' && module.exports) module.exports = SPIE_UNTERLAGEN;
