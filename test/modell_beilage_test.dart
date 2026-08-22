// Sichert die mitgelieferte Modell-Beilage ab.
//
// Ohne ein Modell bekäme jedes Team denselben Startwert – dann zeigt jedes
// Spiel dieselbe Quote. Genau das war der Fehler, als das Modell nur online
// lag und im Browser (CORS) gar nicht ankam. Die Beilage muss deshalb da und
// differenziert sein.
import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('assets/modell.json ist vorhanden und differenziert', () async {
    final roh = await rootBundle.loadString('assets/modell.json');
    final j = jsonDecode(roh) as Map<String, dynamic>;

    expect(j['format'], 1);
    final elo = (j['elo'] as Map).cast<String, dynamic>();
    expect(elo.length, greaterThan(100),
        reason: 'Modell sollte viele Teams kennen, nicht fast leer sein');

    final werte = elo.values.map((v) => (v as num).toDouble()).toList();
    final min = werte.reduce((a, b) => a < b ? a : b);
    final max = werte.reduce((a, b) => a > b ? a : b);
    // Klar auseinanderliegende Ratings -> keine Einheitsquote.
    expect(max - min, greaterThan(200),
        reason: 'Ratings müssen sich unterscheiden, sonst gleiche Quote');
  });
}
