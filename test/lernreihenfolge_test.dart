// Sichert die Reihenfolge-Invariante des Lerners ab.
//
// Der Lerner holt Spieltage jetzt gleichzeitig, speist sie aber streng nach
// Spieltag sortiert ins Modell. Diese Trennung ist kein Stilfrage, sondern
// notwendig: Elo ist reihenfolgeabhängig.
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/odds.dart';

void main() {
  // Beleg für die Notwendigkeit: dieselben Ergebnisse in anderer Reihenfolge
  // ergeben ein ANDERES Modell. Würde der Lerner die Spieltage so verarbeiten,
  // wie sie vom Netz eintreffen, hinge das Ergebnis von der Netzlaune ab und
  // die gemessene Treffsicherheit wäre nicht reproduzierbar.
  test('Elo ist reihenfolgeabhängig - deshalb muss sortiert gelernt werden', () {
    // A schlägt B deutlich, danach schlägt C das (nun stärkere) A knapp.
    final vorwaerts = EloModel({});
    vorwaerts.learn('A', 'B', 4, 0);
    vorwaerts.learn('C', 'A', 1, 0);

    final rueckwaerts = EloModel({});
    rueckwaerts.learn('C', 'A', 1, 0);
    rueckwaerts.learn('A', 'B', 4, 0);

    expect(
      vorwaerts.rating('C'),
      isNot(closeTo(rueckwaerts.rating('C'), 0.001)),
      reason: 'wäre Elo reihenfolgeunabhängig, wäre das Sortieren überflüssig',
    );
  });

  test('Gleiche Reihenfolge ergibt reproduzierbar dasselbe Modell', () {
    double lauf() {
      final m = EloModel({});
      m.learn('A', 'B', 4, 0);
      m.learn('C', 'A', 1, 0);
      m.learn('B', 'C', 2, 2);
      return m.rating('A');
    }

    expect(lauf(), closeTo(lauf(), 1e-12));
  });

  // Statischer Anker. Er kann nicht beweisen, dass sortiert eingespeist wird –
  // dafür bräuchte es einen Netz-Doppelgänger. Er schlägt aber an, wenn die
  // Sortierung beim Umbauen verlorengeht.
  test('Lerner sortiert die geladenen Spieltage vor dem Einspeisen', () {
    final src = File('lib/odds.dart').readAsStringSync();
    expect(
      RegExp(r'geladen\.sort\(\(a, b\) => a\.runde\.compareTo\(b\.runde\)\)').hasMatch(src),
      isTrue,
      reason: 'ohne Sortierung hängt das gelernte Modell von der Netzlaune ab',
    );
  });
}
