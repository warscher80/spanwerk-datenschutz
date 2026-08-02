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
  static const _cupKey = 'footy_cup_runden_v1';

  // Welche Runden-Codes es in einem Turnier wirklich gibt, samt Zeitpunkt der
  // letzten vollständigen Suche. Ohne dieses Wissen probiert die App bei jedem
  // Start alle möglichen Codes durch – bei der WM elf Stück, von denen die
  // meisten nichts liefern.
  final Map<String, List<int>> _cupRunden = {};
  final Map<String, DateTime> _cupGeprueft = {};

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
    _loadCup();
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

  // ---- Bekannte Turnier-Runden ----
  //
  // Ein Turnier hat viele mögliche Runden-Codes, aber nur wenige existieren
  // tatsächlich. Sind sie einmal bekannt, genügt es, genau diese zu laden.
  // Weil im Verlauf eines Turniers neue K.o.-Runden dazukommen, wird in
  // Abständen trotzdem wieder vollständig gesucht.
  static String _cupSchluessel(String leagueId, String season) => '$leagueId|$season';

  List<int> cupRunden(String leagueId, String season) =>
      List<int>.from(_cupRunden[_cupSchluessel(leagueId, season)] ?? const []);

  /// Ist eine vollständige Suche nach neuen Runden fällig?
  bool cupSucheFaellig(
    String leagueId,
    String season, {
    Duration abstand = const Duration(hours: 6),
    DateTime? now,
  }) {
    final k = _cupSchluessel(leagueId, season);
    if ((_cupRunden[k] ?? const []).isEmpty) return true; // noch nichts bekannt
    final zuletzt = _cupGeprueft[k];
    if (zuletzt == null) return true;
    return (now ?? DateTime.now()).difference(zuletzt) >= abstand;
  }

  Future<void> merkeCupRunden(
    String leagueId,
    String season,
    List<int> codes, {
    required bool warVollstaendig,
    DateTime? now,
  }) async {
    final k = _cupSchluessel(leagueId, season);
    if (codes.isNotEmpty) _cupRunden[k] = List<int>.from(codes);
    // Nur eine vollständige Suche darf den Zeitstempel setzen – sonst
    // verschiebt jeder schnelle Start die nächste Suche weiter nach hinten
    // und neue K.o.-Runden würden nie gefunden.
    if (warVollstaendig) _cupGeprueft[k] = now ?? DateTime.now();
    await _persistCup();
  }

  Future<void> _persistCup() async {
    final map = <String, dynamic>{};
    _cupRunden.forEach((k, v) => map[k] = {
          'codes': v,
          'geprueft': _cupGeprueft[k]?.toIso8601String(),
        });
    await _prefs?.setString(_cupKey, jsonEncode(map));
  }

  void _loadCup() {
    _cupRunden.clear();
    _cupGeprueft.clear();
    final raw = _prefs?.getString(_cupKey);
    if (raw == null) return;
    try {
      (jsonDecode(raw) as Map).forEach((k, v) {
        final m = (v as Map).cast<String, dynamic>();
        final codes = (m['codes'] as List?)?.cast<int>();
        if (codes != null && codes.isNotEmpty) _cupRunden['$k'] = codes;
        final g = m['geprueft'];
        if (g is String) {
          final d = DateTime.tryParse(g);
          if (d != null) _cupGeprueft['$k'] = d;
        }
      });
    } catch (_) {
      // Unlesbarer Stand: lieber wieder vollständig suchen als abstürzen.
      _cupRunden.clear();
      _cupGeprueft.clear();
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

  /// Zuletzt gewählte Liga (-1 = Aktuell, 0..n = Ligen). Standard: 0 (WM).
  int get lastLeagueIdx => _prefs?.getInt('last_league') ?? 0;
  Future<void> setLastLeagueIdx(int idx) async {
    await _prefs?.setInt('last_league', idx);
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
