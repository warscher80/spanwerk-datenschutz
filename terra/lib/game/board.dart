/// Reine Spiel-Logik von Nova – ohne Flutter, damit sie testbar bleibt.
///
/// Das Feld ist ein quadratisches Raster. Jede Zelle hält den 0-basierten
/// Rang eines Objekts (0 = Sternenstaub) oder -1 für leer. Setzt man ein
/// Objekt, verschmelzen orthogonal verbundene Gruppen gleichen Rangs ab drei
/// Stück zum nächsthöheren Rang – mit Ketten-Reaktion an der Setz-Stelle.
class MergeResult {
  const MergeResult({required this.gained, required this.highestMerged});

  /// Punkte aus dieser Platzierung.
  final int gained;

  /// Höchster in dieser Platzierung neu entstandener Rang (-1 = keine Fusion).
  final int highestMerged;
}

class Board {
  Board(this.size) : cells = List<int>.filled(size * size, -1);
  Board.fromCells(this.size, this.cells);

  final int size;
  final List<int> cells;

  bool get isFull => !cells.contains(-1);

  List<int> emptyCells() =>
      [for (var i = 0; i < cells.length; i++) if (cells[i] == -1) i];

  int highestTier() {
    var h = -1;
    for (final c in cells) {
      if (c > h) h = c;
    }
    return h;
  }

  /// Setzt [tier] auf die leere Zelle [i] und löst Ketten-Fusionen aus.
  /// Gibt `null` zurück, wenn die Zelle belegt ist.
  MergeResult? place(int i, int tier) {
    if (cells[i] != -1) return null;
    cells[i] = tier;
    var gained = 0;
    var highest = -1;
    while (true) {
      final t = cells[i];
      final group = _flood(i, t);
      if (group.length < 3) break;
      for (final g in group) {
        cells[g] = -1;
      }
      final nt = t + 1;
      cells[i] = nt;
      gained += (nt + 1) * group.length * 2;
      if (nt > highest) highest = nt;
    }
    return MergeResult(gained: gained, highestMerged: highest);
  }

  List<int> _flood(int start, int tier) {
    final seen = <int>{start};
    final stack = <int>[start];
    while (stack.isNotEmpty) {
      final cur = stack.removeLast();
      for (final n in _neighbors(cur)) {
        if (cells[n] == tier && seen.add(n)) stack.add(n);
      }
    }
    return seen.toList();
  }

  Iterable<int> _neighbors(int i) sync* {
    final r = i ~/ size;
    final c = i % size;
    if (r > 0) yield i - size;
    if (r < size - 1) yield i + size;
    if (c > 0) yield i - 1;
    if (c < size - 1) yield i + 1;
  }

  Board copy() => Board.fromCells(size, List<int>.from(cells));
}
