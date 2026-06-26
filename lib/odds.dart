// odds.dart – Lernendes Quoten-Modell (Elo) + Hintergrund-Lerner.
// Das Modell lernt Teamstärken aus echten Ergebnissen; daraus entstehen
// faire 1/X/2-Quoten. Je mehr Ergebnisse einfließen, desto genauer.
import 'dart:async';
import 'dart:math';

import 'api.dart';
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

  static const base = 1500.0;
  static const homeAdvantage = 70.0;
  static const k = 22.0;

  double rating(String team) => ratings[team] ?? base;
  bool knows(String team) => ratings.containsKey(team);

  /// Ein echtes Ergebnis ins Modell einarbeiten (nullsummen-symmetrisch).
  void learn(String home, String away, int homeGoals, int awayGoals) {
    final exp = _expectedHome(rating(home), rating(away));
    final score = homeGoals > awayGoals
        ? 1.0
        : homeGoals == awayGoals
            ? 0.5
            : 0.0;
    // Höhere Siege bewegen das Rating stärker.
    final weight = 1 + log(1 + (homeGoals - awayGoals).abs()) * 0.6;
    final delta = k * weight * (score - exp);
    ratings[home] = rating(home) + delta;
    ratings[away] = rating(away) - delta;
  }

  double _expectedHome(double rh, double ra) =>
      1 / (1 + pow(10, -(rh + homeAdvantage - ra) / 400));

  MatchProbs probs(String home, String away) {
    final dr = rating(home) + homeAdvantage - rating(away);
    final e = 1 / (1 + pow(10, -dr / 400)); // erwarteter Punktanteil Heim
    var pDraw = (0.28 * exp(-pow(dr / 200, 2))).toDouble().clamp(0.06, 0.42);
    var pHome = (e - pDraw / 2).clamp(0.02, 0.97);
    var pAway = (1 - e - pDraw / 2).clamp(0.02, 0.97);
    final sum = pHome + pDraw + pAway;
    return MatchProbs(pHome / sum, pDraw / sum, pAway / sum);
  }

  /// Faire Quoten inkl. kleiner Marge (Standard 6 %).
  MatchOdds odds(String home, String away, {double margin = 1.06}) {
    final p = probs(home, away);
    double o(double prob) => max(1.01, (1 / (prob * margin)));
    return MatchOdds(o(p.home), o(p.draw), o(p.away));
  }
}

/// Lädt im Hintergrund vergangene Spieltage und speist die Ergebnisse ins
/// Elo-Modell, damit die Quoten „dazulernen". Bereits vollständig ausgewertete
/// Spieltage werden gemerkt und nicht erneut geladen.
class SeasonLearner {
  final PredictionStore store;
  final EloModel model;
  bool _cancelled = false;

  SeasonLearner(this.store, this.model);

  void cancel() => _cancelled = true;

  /// Verarbeitet Spieltage 1..bisRunde. onProgress meldet (geladen, gesamt).
  Future<void> learnUpTo(
    League league,
    String season,
    int upToRound, {
    void Function(int done, int total)? onProgress,
  }) async {
    var changed = false;
    final total = upToRound;
    for (var r = 1; r <= upToRound; r++) {
      if (_cancelled) break;
      final key = '${league.id}|$season|$r';
      if (store.roundLearned(key)) {
        onProgress?.call(r, total);
        continue;
      }
      try {
        final matches = await Api.round(league.id, season, r);
        var allFinished = matches.isNotEmpty;
        for (final m in matches) {
          if (m.finished && m.hasResult && !store.isIngested(m.id)) {
            model.learn(m.home.name, m.away.name, m.homeGoals!, m.awayGoals!);
            store.markIngested(m.id);
            changed = true;
          }
          if (!m.finished) allFinished = false;
        }
        // Nur abgeschlossene Spieltage als „fertig" markieren.
        if (allFinished) store.markRoundLearned(key);
      } catch (_) {
        // einzelne Runde übersprungen – beim nächsten Lauf erneut versucht
      }
      onProgress?.call(r, total);
      // Den Gratis-Server schonen.
      await Future.delayed(const Duration(milliseconds: 120));
    }
    if (changed) await store.saveLearning();
  }
}
