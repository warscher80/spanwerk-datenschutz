// Tests für das lernende Quoten-Modell (Elo).
import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/odds.dart';

void main() {
  test('Wahrscheinlichkeiten ergeben in Summe 1', () {
    final m = EloModel({'A': 1600, 'B': 1400});
    final p = m.probs('A', 'B');
    expect(p.home + p.draw + p.away, closeTo(1.0, 1e-9));
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

  test('Modell lernt: Heimsieg hebt das Heim-Rating', () {
    final m = EloModel({});
    final before = m.rating('Heim');
    m.learn('Heim', 'Gast', 3, 0);
    expect(m.rating('Heim'), greaterThan(before));
    expect(m.rating('Gast'), lessThan(before));
  });
}
