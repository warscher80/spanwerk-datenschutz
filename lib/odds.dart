// odds.dart – Lernendes Quoten-Modell (Elo) + Hintergrund-Lerner.
// Das Modell lernt Teamstärken aus echten Ergebnissen; daraus entstehen
// faire 1/X/2-Quoten. Je mehr Ergebnisse einfließen, desto genauer.
import 'dart:async';
import 'dart:math';

import 'api.dart';
import 'engine.dart';
import 'store.dart';

class MatchProbs {
  final double home;
  final double draw;
  final double away;
  const MatchProbs(this.home, this.draw, this.away);
}

class MatchOdds {
  final double home;
  final double draw;
  final double away;
  const MatchOdds(this.home, this.draw, this.away);
}

/// Elo-Bewertung mit Heimvorteil und Remis-Modell.
class EloModel {
  final Map<String, double> ratings;
  EloModel(this.ratings);

  // Per Walk-Forward-Backtest über 5 Ligen / 2 Saisons getunt
  // (LogLoss 1.066 -> 1.045, Trefferquote 45.9 % -> 47.3 %).
  static const base = 1500.0;
  static const homeAdvantage = 50.0;
  static const k = 16.0;

  double rating(String team) => ratings[team] ?? base;
  bool knows(String team) => ratings.containsKey(team);

  /// Ein echtes Ergebnis ins Modell einarbeiten (nullsummen-symmetrisch).
  /// Bei [neutral] (z. B. WM/Turnier auf neutralem Platz) zählt kein Heimvorteil.
  void learn(String home, String away, int homeGoals, int awayGoals,
      {bool neutral = false}) {
    final hfa = neutral ? 0.0 : homeAdvantage;
    final exp = 1 / (1 + pow(10, -(rating(home) + hfa - rating(away)) / 400));
    final score = homeGoals > awayGoals
        ? 1.0
        : homeGoals == awayGoals
            ? 0.5
            : 0.0;
    // Höhere Siege bewegen das Rating stärker.
    final weight = 1 + log(1 + (homeGoals - awayGoals).abs()) * 0.8;
    final delta = k * weight * (score - exp);
    ratings[home] = rating(home) + delta;
    ratings[away] = rating(away) - delta;
  }

  MatchProbs probs(String home, String away, {bool neutral = false}) {
    final hfa = neutral ? 0.0 : homeAdvantage;
    final dr = rating(home) + hfa - rating(away);
    final e = 1 / (1 + pow(10, -dr / 400)); // erwarteter Punktanteil Heim
    var pDraw = (0.30 * exp(-pow(dr / 260, 2))).toDouble().clamp(0.06, 0.42);
    var pHome = (e - pDraw / 2).clamp(0.02, 0.97);
    var pAway = (1 - e - pDraw / 2).clamp(0.02, 0.97);
    final sum = pHome + pDraw + pAway;
    return MatchProbs(pHome / sum, pDraw / sum, pAway / sum);
  }

  /// Faire Quoten inkl. kleiner Marge (Standard 6 %).
  MatchOdds odds(String home, String away,
      {double margin = 1.06, bool neutral = false}) {
    final p = probs(home, away, neutral: neutral);
    double o(double prob) => max(1.01, (1 / (prob * margin)));
    return MatchOdds(o(p.home), o(p.draw), o(p.away));
  }

  /// Vom Modell erwartetes Ergebnis (für den Auto-Tipp).
  List<int> expectedScore(String home, String away, {bool neutral = false}) {
    final hfa = neutral ? 0.0 : homeAdvantage;
    final dr = rating(home) + hfa - rating(away);
    final e = 1 / (1 + pow(10, -dr / 400)); // erwarteter Punktanteil Heim
    final gh = (1.35 + (e - 0.5) * 2.4).clamp(0.0, 6.0).round();
    final ga = (1.35 - (e - 0.5) * 2.4).clamp(0.0, 6.0).round();
    return [gh, ga];
  }
}

/// Ein echtes, abgeschlossenes Spiel verarbeiten: Modell-Vorhersage bewerten,
/// dann lernen, Ergebnis getippter Spiele merken. Gibt true zurück, wenn das
/// Modell verändert wurde.
bool ingestMatch(PredictionStore store, EloModel model, FootyMatch m,
    {bool evaluate = true, bool neutral = false}) {
  if (!(m.finished && m.hasResult)) return false;
  // Ergebnis getippter Spiele immer für die Statistik festhalten.
  if (store.predictions.containsKey(m.id)) {
    store.recordResult(m.id, m.homeGoals!, m.awayGoals!);
  }
  if (store.isIngested(m.id)) return false;

  // Erst vorhersagen (bewerten), dann lernen. Vorsaison-Seeding (evaluate=false)
  // fließt nicht in die angezeigte Treffsicherheit ein.
  if (evaluate) {
    final p = model.probs(m.home.name, m.away.name, neutral: neutral);
    final predicted = p.home >= p.draw && p.home >= p.away
        ? Tendency.home
        : (p.away > p.home && p.away >= p.draw ? Tendency.away : Tendency.draw);
    final actual = tendencyOf(m.homeGoals!, m.awayGoals!);
    store.addModelEval(predicted == actual);
  }

  model.learn(m.home.name, m.away.name, m.homeGoals!, m.awayGoals!, neutral: neutral);
  store.markIngested(m.id);
  return true;
}

/// Lädt im Hintergrund vergangene Spieltage und speist die Ergebnisse ins
/// Elo-Modell, damit die Quoten „dazulernen". Bereits vollständig ausgewertete
/// Spieltage werden gemerkt und nicht erneut geladen.
class SeasonLearner {
  final PredictionStore store;
  final EloModel model;
  bool _cancelled = false;
  bool _changed = false;

  SeasonLearner(this.store, this.model);

  void cancel() => _cancelled = true;

  /// Lernt zuerst die Vorsaison als Startwissen (ohne Bewertung), dann die
  /// laufende Saison (mit Bewertung). Bereits abgeschlossene Spieltage werden
  /// übersprungen – so wird mit jedem Aufruf nur Neues nachgelernt.
  Future<void> learnHistory(
    League league,
    String currentSeason, {
    void Function(int done, int total)? onProgress,
  }) async {
    _changed = false;
    final prev = Api.previousSeason(currentSeason);
    final total = league.maxRound * 2;
    await _learnSeason(league, prev, base: 0, total: total, evaluate: false, onProgress: onProgress);
    await _learnSeason(league, currentSeason, base: league.maxRound, total: total, evaluate: true, onProgress: onProgress);
    if (_changed) await store.saveLearning();
  }

  /// Turnier-Runden (Gruppen + K.o.) ins Modell einarbeiten.
  Future<void> learnCup(
    League league,
    String season,
    List<int> codes, {
    void Function(int done, int total)? onProgress,
  }) async {
    _changed = false;
    for (var i = 0; i < codes.length; i++) {
      if (_cancelled) break;
      final code = codes[i];
      final key = '${league.id}|$season|$code';
      if (store.roundLearned(key)) {
        onProgress?.call(i + 1, codes.length);
        continue;
      }
      try {
        final matches = await Api.round(league.id, season, code);
        var allFinished = matches.isNotEmpty;
        for (final m in matches) {
          if (ingestMatch(store, model, m, neutral: true)) _changed = true;
          if (!m.finished) allFinished = false;
        }
        if (allFinished) store.markRoundLearned(key);
      } catch (_) {
        // Runde übersprungen
      }
      onProgress?.call(i + 1, codes.length);
      await Future.delayed(const Duration(milliseconds: 120));
    }
    if (_changed) await store.saveLearning();
  }

  Future<void> _learnSeason(
    League league,
    String season, {
    required int base,
    required int total,
    required bool evaluate,
    void Function(int done, int total)? onProgress,
  }) async {
    for (var r = 1; r <= league.maxRound; r++) {
      if (_cancelled) return;
      final key = '${league.id}|$season|$r';
      if (store.roundLearned(key)) {
        onProgress?.call(base + r, total);
        continue;
      }
      try {
        final matches = await Api.round(league.id, season, r);
        var allFinished = matches.isNotEmpty;
        for (final m in matches) {
          if (ingestMatch(store, model, m, evaluate: evaluate)) _changed = true;
          if (!m.finished) allFinished = false;
        }
        // Nur abgeschlossene Spieltage „fertig" markieren -> später kein Refetch.
        if (allFinished) store.markRoundLearned(key);
      } catch (_) {
        // einzelne Runde übersprungen – beim nächsten Lauf erneut versucht
      }
      onProgress?.call(base + r, total);
      await Future.delayed(const Duration(milliseconds: 120)); // Server schonen
    }
  }
}
