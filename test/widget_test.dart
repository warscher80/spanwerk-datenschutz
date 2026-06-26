// Punkte-Logik des Tippspiels testen (reine Engine, kein Netz/UI nötig).
import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/engine.dart';

void main() {
  test('Volltreffer gibt 5 Punkte', () {
    expect(pointsFor(predHome: 2, predAway: 1, actualHome: 2, actualAway: 1), 5);
  });

  test('Richtige Tordifferenz gibt 3 Punkte', () {
    expect(pointsFor(predHome: 2, predAway: 1, actualHome: 3, actualAway: 2), 3);
  });

  test('Richtige Tendenz gibt 2 Punkte', () {
    expect(pointsFor(predHome: 3, predAway: 0, actualHome: 1, actualAway: 0), 2);
  });

  test('Falsche Tendenz gibt 0 Punkte', () {
    expect(pointsFor(predHome: 0, predAway: 2, actualHome: 1, actualAway: 0), 0);
  });

  test('Remis-Tordifferenz zählt als Tordifferenz', () {
    expect(pointsFor(predHome: 1, predAway: 1, actualHome: 2, actualAway: 2), 3);
  });
}
