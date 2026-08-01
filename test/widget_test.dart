// Tests für die Ausgangs-Logik (engine.dart).
//
// Vorher standen hier fünf Tests für pointsFor() – die Punkte-Auswertung des
// Tippspiels. Seit Commit 858df1c ("Reine Prognose-App", v1.6.0) hatte diese
// Funktion keinen Aufrufer mehr in lib/; die Tests prüften also Code, den die
// App nie ausführte. Sie ist entfernt, und die Tests decken jetzt das ab, was
// tatsächlich läuft.
import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/engine.dart';

void main() {
  test('Mehr Heimtore ergeben Heimsieg', () {
    expect(tendencyOf(2, 1), Tendency.home);
    expect(tendencyOf(5, 0), Tendency.home);
  });

  test('Mehr Auswärtstore ergeben Auswärtssieg', () {
    expect(tendencyOf(0, 1), Tendency.away);
    expect(tendencyOf(1, 4), Tendency.away);
  });

  test('Gleicher Torstand ergibt Unentschieden', () {
    expect(tendencyOf(0, 0), Tendency.draw);
    expect(tendencyOf(3, 3), Tendency.draw);
  });
}
