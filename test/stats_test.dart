// Tests für Team-Form (stats.dart) und den KickProphet Score (odds.dart).
import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/stats.dart';
import 'package:footy_predict/odds.dart';

FormGame g(bool heim, int erzielt, int kassiert, DateTime d) =>
    FormGame(heim: heim, erzielt: erzielt, kassiert: kassiert, datum: d);

void main() {
  group('formAus / TeamForm', () {
    final spiele = [
      g(true, 3, 1, DateTime(2026, 8, 1)), // S
      g(false, 0, 2, DateTime(2026, 8, 8)), // N
      g(true, 2, 2, DateTime(2026, 8, 15)), // U
      g(false, 4, 0, DateTime(2026, 8, 22)), // S (neuestes)
    ];

    test('neueste zuerst, Kürzel korrekt', () {
      final f = formAus(spiele);
      expect(f.spiele, 4);
      expect(f.formKette, ['S', 'U', 'N', 'S']); // 22., 15., 8., 1.
    });

    test('Tore, Gegentore und Schnitt stimmen', () {
      final f = formAus(spiele);
      expect(f.tore, 9); // 3+0+2+4
      expect(f.gegentore, 5); // 1+2+2+0
      expect(f.torProSpiel, closeTo(9 / 4, 1e-9));
      expect(f.gegentorProSpiel, closeTo(5 / 4, 1e-9));
      expect(f.siege, 2);
      expect(f.remis, 1);
      expect(f.niederlagen, 1);
    });

    test('max begrenzt auf die neuesten N', () {
      final f = formAus(spiele, max: 2);
      expect(f.spiele, 2);
      expect(f.formKette, ['S', 'U']); // die zwei neuesten
    });

    test('vor-Grenze verhindert Data-Leakage', () {
      // Nur Spiele VOR dem 15.8. zählen -> das Spiel am 15. und 22. fallen weg.
      final f = formAus(spiele, vor: DateTime(2026, 8, 15));
      expect(f.spiele, 2);
      expect(f.formKette, ['N', 'S']); // 8., dann 1.
    });

    test('zu wenige Spiele: genugDaten ist false', () {
      expect(formAus([spiele.first]).genugDaten, isFalse);
      expect(TeamForm.leer.genugDaten, isFalse);
      expect(TeamForm.leer.eloAnpassung, 0);
    });

    test('eloAnpassung ist begrenzt und formgerecht', () {
      // Fünf Siege -> starke Form -> positive, aber gedeckelte Anpassung.
      final stark = formAus([
        for (var i = 0; i < 5; i++) g(true, 2, 0, DateTime(2026, 8, i + 1)),
      ]);
      expect(stark.eloAnpassung, greaterThan(0));
      expect(stark.eloAnpassung, lessThanOrEqualTo(60));
      // Fünf Niederlagen -> negative Anpassung.
      final schwach = formAus([
        for (var i = 0; i < 5; i++) g(true, 0, 2, DateTime(2026, 8, i + 1)),
      ]);
      expect(schwach.eloAnpassung, lessThan(0));
      expect(schwach.eloAnpassung, greaterThanOrEqualTo(-60));
    });
  });

  group('kickProphetScore', () {
    test('steigt mit der Sicherheit des Favoriten', () {
      final knapp = kickProphetScore(const MatchProbs(0.40, 0.33, 0.27));
      final klar = kickProphetScore(const MatchProbs(0.70, 0.20, 0.10));
      final dominant = kickProphetScore(const MatchProbs(0.85, 0.10, 0.05));
      expect(klar, greaterThan(knapp));
      expect(dominant, greaterThanOrEqualTo(klar));
    });

    test('liegt immer in 0..100', () {
      expect(kickProphetScore(const MatchProbs(0.34, 0.33, 0.33)),
          inInclusiveRange(0, 100));
      expect(kickProphetScore(const MatchProbs(0.95, 0.03, 0.02)),
          inInclusiveRange(0, 100));
    });

    test('Formzustimmung verschiebt höchstens ±6 Punkte', () {
      const p = MatchProbs(0.60, 0.25, 0.15);
      final neutral = kickProphetScore(p);
      final proForm = kickProphetScore(p, formZustimmung: 1);
      final contraForm = kickProphetScore(p, formZustimmung: -1);
      expect(proForm - neutral, inInclusiveRange(5, 6));
      expect(neutral - contraForm, inInclusiveRange(5, 6));
    });

    test('Bänder passen zur Vorgabe', () {
      expect(kickProphetBand(20).label, 'sehr unsicher');
      expect(kickProphetBand(50).label, 'ausgeglichen');
      expect(kickProphetBand(70).label, 'gute Tendenz');
      expect(kickProphetBand(88).label, 'starke Tendenz');
    });

    test('dünne Datenlage dämpft den Score', () {
      const klar = MatchProbs(0.82, 0.10, 0.08); // hohe Sicherheit
      final voll = kickProphetScore(klar, datenGuete: 1);
      final duenn = kickProphetScore(klar, datenGuete: 0);
      expect(duenn, lessThan(voll));
      // Bei fehlenden Daten keine „starke Tendenz" allein aus einer hohen Zahl.
      expect(duenn, lessThan(80));
    });

    test('knappe Prognose bleibt unsicher, auch bei voller Datenlage', () {
      // Beispiel aus der Vorgabe: 51/27/22 darf nicht 90 ergeben.
      const knapp = MatchProbs(0.51, 0.27, 0.22);
      final s = kickProphetScore(knapp, datenGuete: 1);
      expect(s, lessThan(50));
    });
  });
}
