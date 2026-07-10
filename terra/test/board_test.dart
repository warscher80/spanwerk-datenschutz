import 'package:flutter_test/flutter_test.dart';
import 'package:terra/game/board.dart';

void main() {
  group('Board', () {
    test('drei gleiche verschmelzen zum nächsten Rang', () {
      final b = Board(6);
      b.place(0, 0); // r0c0
      b.place(1, 0); // r0c1  (Gruppe 2 – noch keine Fusion)
      final r = b.place(2, 0); // r0c2 -> Gruppe {0,1,2} = 3 -> Fusion

      expect(b.highestTier(), 1);
      expect(b.cells.where((c) => c != -1).length, 1);
      expect(b.cells[2], 1); // Ergebnis liegt auf der Setz-Zelle
      expect(r!.highestMerged, 1);
    });

    test('weniger als drei verschmelzen nicht', () {
      final b = Board(6);
      b.place(0, 0);
      final r = b.place(1, 0);
      expect(b.highestTier(), 0);
      expect(b.cells.where((c) => c != -1).length, 2);
      expect(r!.highestMerged, -1);
    });

    test('Ketten-Fusion steigt mehrere Ränge auf', () {
      // Zwei Rang-1 links/rechts der Setz-Zelle 7, plus drei Rang-0, die bei
      // 7 zu Rang 1 fusionieren und dann mit den beiden weiter zu Rang 2.
      final cells = List<int>.filled(36, -1);
      cells[1] = 0; // r0c1
      cells[2] = 0; // r0c2
      cells[6] = 1; // r1c0
      cells[8] = 1; // r1c2
      final b = Board.fromCells(6, cells);

      final r = b.place(7, 0); // r1c1

      expect(b.highestTier(), 2);
      expect(b.cells.where((c) => c != -1).length, 1);
      expect(b.cells[7], 2);
      expect(r!.highestMerged, 2);
    });

    test('volles Feld wird erkannt', () {
      // Schachbrett aus zwei Rängen -> keine Fusion, Feld läuft voll.
      final cells = [for (var i = 0; i < 36; i++) (i % 2)];
      final b = Board.fromCells(6, cells);
      expect(b.isFull, isTrue);
      expect(b.emptyCells(), isEmpty);
    });

    test('belegte Zelle liefert null', () {
      final b = Board(6);
      b.place(0, 0);
      expect(b.place(0, 0), isNull);
    });
  });
}
