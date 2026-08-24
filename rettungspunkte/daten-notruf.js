/* daten-notruf.js — Notrufnummern vom Notfall-Aushang der Baustelle.
   Von Hand gepflegt (im Gegensatz zu daten-baustelle.js, das erzeugt wird).
   Quelle: Aushang „Anmerkung zum Notruf", Abschnitt 3).
   ⚠ Vor dem Einsatz gegen den aktuellen Aushang prüfen — Nummern ändern sich. */
var BAUSTELLE_NOTRUF = {
  quelle: 'Notfall-Aushang der Baustelle, Abschnitt 3)',
  stand: '2026-08-24',
  hinweis: 'Ein Notruf vom Mobiltelefon landet bei der nächstgelegenen ' +
           'Rettungsleitstelle — die ist nicht unbedingt für die Unfallstelle ' +
           'zuständig. Der Notruf wird aber in jedem Fall weitergeleitet.',
  nummern: [
    { name: 'GSL Süd',                      role: 'Festnetz',                  number: '02234 - 85 55301' },
    { name: 'GSL Süd',                      role: 'Mobil',                     number: '0162 - 25 32 03 1' },
    { name: 'Bereitschaft Betrieb Amprion', role: 'Leitungen Waldlaubersheim', number: '02234 - 85880 650' },
    { name: 'Schaltleitung Drittnetz',      role: 'Westnetz',                  number: '0201 - 1864674' },
    { name: 'Bereitschaft Drittnetz',       role: 'Westnetz',                  number: '02191 - 102816 647' }
  ]
};

if (typeof module !== 'undefined' && module.exports) module.exports = BAUSTELLE_NOTRUF;
