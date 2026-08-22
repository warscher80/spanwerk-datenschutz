// Tests für die Form-Komponente des Elo-Modells (bewusst begrenzt, leakage-frei).
import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/odds.dart';

void main() {
  test('leeres Modell: keine Form-Anpassung, Prognose wie zuvor', () {
    final m = EloModel({'A': 1500, 'B': 1500});
    expect(m.formAdj('A'), 0);
    final p = m.probs('A', 'B', neutral: true);
    expect(p.home, closeTo(p.away, 1e-9)); // ohne Form exakt symmetrisch
  });

  test('Siege heben die Form, Niederlagen senken sie – begrenzt', () {
    final m = EloModel({});
    for (var i = 0; i < 5; i++) {
      m.learn('Stark', 'Gegner$i', 3, 0);
      m.learn('Schwach', 'Gegner$i', 0, 3);
    }
    expect(m.formAdj('Stark'), greaterThan(0));
    expect(m.formAdj('Schwach'), lessThan(0));
    // Harte Deckelung bei ±40.
    expect(m.formAdj('Stark'), lessThanOrEqualTo(40));
    expect(m.formAdj('Schwach'), greaterThanOrEqualTo(-40));
  });

  test('Form verschiebt die Prognose in die richtige Richtung', () {
    // Zwei exakt gleich starke Teams auf neutralem Platz.
    final m = EloModel({'A': 1500, 'B': 1500});
    final vorher = m.probs('A', 'B', neutral: true);
    expect(vorher.home, closeTo(vorher.away, 1e-9));
    // A gewinnt zuletzt hoch, B verliert hoch (Ratings bleiben dank Gegnern grob
    // gleich, aber die Form von A steigt, die von B fällt).
    m.learn('A', 'X', 4, 0);
    m.learn('B', 'Y', 0, 4);
    final nachher = m.probs('A', 'B', neutral: true);
    expect(nachher.home, greaterThan(nachher.away));
  });

  test('kein Data-Leakage: Form nutzt nur bereits gelernte Spiele', () {
    final m = EloModel({'A': 1500, 'B': 1500});
    // Prognose VOR jedem Lernen: Form ist 0.
    expect(m.formAdj('A'), 0);
    // Genau das ist der Ablauf in ingestMatch: erst probs (bewerten), dann learn.
    final vor = m.probs('A', 'B', neutral: true);
    m.learn('A', 'B', 5, 0); // dieses Spiel darf die eigene Prognose nicht beeinflusst haben
    expect(vor.home, closeTo(vor.away, 1e-9));
    // Nach dem Lernen ist die Form von A gesetzt.
    expect(m.formAdj('A'), greaterThan(0));
  });

  test('Form-Export/Import reproduziert die Anpassung', () {
    final m = EloModel({});
    m.learn('A', 'B', 2, 0);
    m.learn('A', 'C', 1, 0);
    final exportiert = m.formExport();
    final m2 = EloModel(Map.of(m.ratings), form: exportiert);
    expect(m2.formAdj('A'), closeTo(m.formAdj('A'), 1e-9));
  });

  test('gleiche Lernreihenfolge ergibt dieselbe Form (deterministisch)', () {
    List<double> lauf() {
      final m = EloModel({});
      m.learn('A', 'B', 2, 1);
      m.learn('A', 'C', 0, 2);
      m.learn('A', 'D', 3, 3);
      return m.formExport()['A']!;
    }

    expect(lauf(), lauf());
  });
}
