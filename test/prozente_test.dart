// Tests: angezeigte Prozente ergeben immer exakt 100 (Largest Remainder).
import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/odds.dart';

void main() {
  test('drei gerundete Prozente ergeben immer exakt 100', () {
    // Viele Verteilungen prüfen, inkl. der kritischen ,5-Fälle.
    for (var h = 2; h <= 96; h++) {
      for (var d = 2; d + h <= 98; d++) {
        final a = 100 - h - d;
        if (a < 2) continue;
        final p = MatchProbs(h / 100, d / 100, a / 100);
        final (ph, pd, pa) = prozente100(p);
        expect(ph + pd + pa, 100, reason: 'bei $h/$d/$a');
        expect(ph, greaterThanOrEqualTo(0));
        expect(pd, greaterThanOrEqualTo(0));
        expect(pa, greaterThanOrEqualTo(0));
      }
    }
  });

  test('Modell-Prognosen ergeben nach Rundung exakt 100', () {
    final m = EloModel({'A': 1720, 'B': 1560});
    for (final neutral in [true, false]) {
      final p = m.probs('A', 'B', neutral: neutral);
      final (ph, pd, pa) = prozente100(p);
      expect(ph + pd + pa, 100);
    }
  });

  test('rohe Summe 1.0 bleibt erhalten – keine groben Verschiebungen', () {
    const p = MatchProbs(0.545, 0.275, 0.180); // würde einzeln 55+28+18=101 ergeben
    final (ph, pd, pa) = prozente100(p);
    expect(ph + pd + pa, 100);
    // Werte bleiben nah an der Rohzahl (±1).
    expect((ph - 55).abs() <= 1, isTrue);
    expect((pd - 28).abs() <= 1, isTrue);
    expect((pa - 18).abs() <= 1, isTrue);
  });
}
