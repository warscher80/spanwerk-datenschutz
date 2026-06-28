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
  static const _eloKey = 'footy_elo_v1';
  static const _ingestedKey = 'footy_ingested_v1';
  static const _roundsKey = 'footy_learned_rounds_v1';

  static const _resultsKey = 'footy_results_v1';
  static const _evalKey = 'footy_modeleval_v1';

  final Map<int, Prediction> _cache = {};

  // Lerndaten des Quoten-Modells.
  final Map<String, double> elo = {};
  final Set<int> _ingested = {};
  final Set<String> _learnedRounds = {};

  // Echte Ergebnisse getippter Spiele (für die Saison-Statistik).
  final Map<int, List<int>> _results = {};

  // Treffsicherheit des Modells (Vorhersage vor dem Lernen).
  int modelHits = 0;
  int modelTotal = 0;

  SharedPreferences? _prefs;

  Map<int, Prediction> get predictions => _cache;
  List<int>? result(int matchId) => _results[matchId];

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
    _loadLearning();
    // Bei neuer Modell-Version Lerndaten einmalig zurücksetzen, damit die
    // verbesserten Start-Stärken (z. B. Nationalteams) wirken.
    const modelVer = 2;
    if ((_prefs?.getInt('footy_model_ver') ?? 0) != modelVer) {
      elo.clear();
      _ingested.clear();
      _learnedRounds.clear();
      modelHits = 0;
      modelTotal = 0;
      await _prefs?.setInt('footy_model_ver', modelVer);
      await saveLearning();
    }
  }

  void _loadLearning() {
    elo.clear();
    _ingested.clear();
    _learnedRounds.clear();
    _results.clear();
    final e = _prefs?.getString(_eloKey);
    if (e != null) {
      (jsonDecode(e) as Map).forEach((k, v) => elo[k as String] = (v as num).toDouble());
    }
    _ingested.addAll(_prefs?.getStringList(_ingestedKey)?.map(int.parse) ?? const []);
    _learnedRounds.addAll(_prefs?.getStringList(_roundsKey) ?? const []);
    final r = _prefs?.getString(_resultsKey);
    if (r != null) {
      (jsonDecode(r) as Map).forEach(
          (k, v) => _results[int.parse(k as String)] = (v as List).cast<int>());
    }
    final ev = _prefs?.getString(_evalKey);
    if (ev != null) {
      final m = (jsonDecode(ev) as Map).cast<String, dynamic>();
      modelHits = (m['hits'] as num?)?.toInt() ?? 0;
      modelTotal = (m['total'] as num?)?.toInt() ?? 0;
    }
  }

  // ---- Lern-Status ----
  bool isIngested(int matchId) => _ingested.contains(matchId);
  void markIngested(int matchId) => _ingested.add(matchId);
  bool roundLearned(String key) => _learnedRounds.contains(key);
  void markRoundLearned(String key) => _learnedRounds.add(key);
  int get teamsLearned => elo.length;

  void recordResult(int matchId, int home, int away) => _results[matchId] = [home, away];
  void addModelEval(bool hit) {
    modelTotal++;
    if (hit) modelHits++;
  }

  Future<void> saveLearning() async {
    await _prefs?.setString(_eloKey, jsonEncode(elo));
    await _prefs?.setStringList(_ingestedKey, _ingested.map((e) => e.toString()).toList());
    await _prefs?.setStringList(_roundsKey, _learnedRounds.toList());
    await _prefs?.setString(_resultsKey,
        jsonEncode(_results.map((k, v) => MapEntry(k.toString(), v))));
    await _prefs?.setString(_evalKey, jsonEncode({'hits': modelHits, 'total': modelTotal}));
  }

  /// Zuletzt betrachteten Spieltag je Liga merken.
  int lastRound(String leagueId) => _prefs?.getInt('round_$leagueId') ?? 1;
  Future<void> setLastRound(String leagueId, int round) async {
    await _prefs?.setInt('round_$leagueId', round);
  }

  /// Tipp-Erinnerungen (Standard: an).
  bool get remindersEnabled => _prefs?.getBool('reminders') ?? true;
  Future<void> setRemindersEnabled(bool v) async {
    await _prefs?.setBool('reminders', v);
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
