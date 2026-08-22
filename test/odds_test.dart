// Tests für das lernende Quoten-Modell (Elo).
import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/odds.dart';
import 'package:footy_predict/engine.dart';

void main() {
  test('Wahrscheinlichkeiten ergeben in Summe 1', () {
    final m = EloModel({'A': 1600, 'B': 1400});
    final p = m.probs('A', 'B');
    expect(p.home + p.draw + p.away, closeTo(1.0, 1e-9));
  });

  test('tippFromProbs: Sieger führt, Höhe steigt mit dem Favoriten', () {
    // Heimfavorit -> Heim führt.
    final heim = tippFromProbs(const MatchProbs(0.55, 0.25, 0.20));
    expect(heim[0], greaterThan(heim[1]));
    // Auswärtsfavorit -> Gast führt.
    final gast = tippFromProbs(const MatchProbs(0.20, 0.25, 0.55));
    expect(gast[1], greaterThan(gast[0]));
    // Unentschieden -> gleicher Stand.
    final remis = tippFromProbs(const MatchProbs(0.30, 0.40, 0.30));
    expect(remis[0], equals(remis[1]));
  });

  test('tippFromProbs ist nicht immer 2:1 – Höhe variiert mit der Stärke', () {
    final knapp = tippFromProbs(const MatchProbs(0.42, 0.33, 0.25)); // 1:0
    final klar = tippFromProbs(const MatchProbs(0.62, 0.23, 0.15)); // 2:0/3:1
    final dominant = tippFromProbs(const MatchProbs(0.80, 0.13, 0.07)); // 3:0
    // Der Sieger schießt bei einem klaren Favoriten mehr als bei einem knappen.
    expect(klar[0], greaterThan(knapp[0]));
    expect(dominant[0], greaterThanOrEqualTo(klar[0]));
    // Und eben nicht überall dasselbe Ergebnis.
    final ergebnisse = {knapp.join(':'), klar.join(':'), dominant.join(':')};
    expect(ergebnisse.length, greaterThan(1));
  });

  test('Stärkeres Heimteam hat niedrigere Quote', () {
    final m = EloModel({'Stark': 1750, 'Schwach': 1350});
    final o = m.odds('Stark', 'Schwach');
    expect(o.home, lessThan(o.away));
    expect(o.home, greaterThan(1.0));
  });

  test('Quoten enthalten Marge (Summe der Kehrwerte > 1)', () {
    final m = EloModel({'A': 1500, 'B': 1500});
    final o = m.odds('A', 'B');
    final overround = 1 / o.home + 1 / o.draw + 1 / o.away;
    expect(overround, greaterThan(1.0));
  });

  // Anzeige und Trefferquoten-Statistik müssen dieselbe Prognose verwenden.
  // Früher lagen zwei Regeln getrennt in main.dart und odds.dart: bei
  // gleicher Heim-/Auswärtswahrscheinlichkeit zeigte die App "Unentschieden",
  // bewertet wurde aber "Heimsieg".
  group('predictedTendency', () {
    test('Gleichstand zwischen Heim und Gast ergibt Unentschieden', () {
      expect(predictedTendency(const MatchProbs(0.40, 0.20, 0.40)), Tendency.draw);
    });

    test('Gleichstand gilt auch bei auf Prozent gerundeten Werten', () {
      // 0,4002 und 0,3998 werden beide als 40 % angezeigt.
      expect(predictedTendency(const MatchProbs(0.4002, 0.1996, 0.3998)), Tendency.draw);
    });

    test('Ist Remis wahrscheinlicher als der Gleichstand, gewinnt Remis', () {
      expect(predictedTendency(const MatchProbs(0.30, 0.40, 0.30)), Tendency.draw);
    });

    test('Klarer Favorit wird als solcher erkannt', () {
      expect(predictedTendency(const MatchProbs(0.60, 0.25, 0.15)), Tendency.home);
      expect(predictedTendency(const MatchProbs(0.15, 0.25, 0.60)), Tendency.away);
    });

    test('Modellbewertung nutzt dieselbe Regel wie die Anzeige', () {
      // Ein Modell mit exakt gleich starken Teams auf neutralem Platz ergibt
      // Heim == Gast -> die Prognose muss Unentschieden lauten, nicht Heim.
      final m = EloModel({'A': 1500, 'B': 1500});
      final p = m.probs('A', 'B', neutral: true);
      expect(p.home, closeTo(p.away, 1e-9));
      expect(predictedTendency(p), Tendency.draw);
    });
  });

  test('Modell lernt: Heimsieg hebt das Heim-Rating', () {
    final m = EloModel({});
    final before = m.rating('Heim');
    m.learn('Heim', 'Gast', 3, 0);
    expect(m.rating('Heim'), greaterThan(before));
    expect(m.rating('Gast'), lessThan(before));
  });
}
