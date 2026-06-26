// store.dart – Lokale Speicherung der Tipps (shared_preferences).
// Nichts verlässt das Gerät; keine Konten, kein Server.
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class Prediction {
  final int home;
  final int away;
  const Prediction(this.home, this.away);
}

class PredictionStore {
  static const _key = 'footy_predictions_v1';
  final Map<int, Prediction> _cache = {};
  SharedPreferences? _prefs;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    final raw = _prefs!.getString(_key);
    _cache.clear();
    if (raw != null) {
      final map = (jsonDecode(raw) as Map).cast<String, dynamic>();
      map.forEach((id, v) {
        final p = (v as Map).cast<String, dynamic>();
        _cache[int.parse(id)] = Prediction(p['h'] as int, p['a'] as int);
      });
    }
  }

  Prediction? get(int matchId) => _cache[matchId];

  Future<void> save(int matchId, int home, int away) async {
    _cache[matchId] = Prediction(home, away);
    await _persist();
  }

  Future<void> clear() async {
    _cache.clear();
    await _persist();
  }

  bool get isEmpty => _cache.isEmpty;

  Future<void> _persist() async {
    final map = _cache.map(
      (id, p) => MapEntry(id.toString(), {'h': p.home, 'a': p.away}),
    );
    await _prefs?.setString(_key, jsonEncode(map));
  }
}
