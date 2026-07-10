import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Gespeicherter Zustand: laufende Partie + Bestwert + höchster je erreichter
/// Rang (für die Sammlung).
class SaveData {
  const SaveData({
    required this.cells,
    required this.size,
    required this.score,
    required this.best,
    required this.maxTier,
    required this.next,
  });

  final List<int> cells;
  final int size;
  final int score;
  final int best;
  final int maxTier;
  final int next;

  Map<String, dynamic> toJson() => {
        'cells': cells,
        'size': size,
        'score': score,
        'best': best,
        'maxTier': maxTier,
        'next': next,
      };

  static SaveData fromJson(Map<String, dynamic> j) => SaveData(
        cells: (j['cells'] as List).map((e) => e as int).toList(),
        size: j['size'] as int,
        score: j['score'] as int,
        best: j['best'] as int,
        maxTier: j['maxTier'] as int,
        next: j['next'] as int,
      );
}

Future<File> _file() async {
  final dir = await getApplicationSupportDirectory();
  return File('${dir.path}/nova_save.json');
}

Future<SaveData?> loadGame() async {
  try {
    final f = await _file();
    if (!f.existsSync()) return null;
    return SaveData.fromJson(
        jsonDecode(await f.readAsString()) as Map<String, dynamic>);
  } catch (_) {
    return null;
  }
}

Future<void> saveGame(SaveData data) async {
  try {
    final f = await _file();
    await f.writeAsString(jsonEncode(data.toJson()));
  } catch (_) {
    // Speichern ist best effort – ein Fehler darf das Spiel nicht stören.
  }
}
