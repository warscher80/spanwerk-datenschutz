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
/// Realistische Start-Stärken für Nationalteams (≈ World-Football-Elo-Niveau).
/// Damit sind WM-Prognosen vom ersten Spiel an sinnvoll, statt bei null zu starten.
const kNationalElo = <String, double>{
  // Weltspitze
  'Argentina': 2110, 'France': 2090, 'Spain': 2080, 'England': 2040, 'Brazil': 2040,
  'Portugal': 2010, 'Netherlands': 2000, 'Belgium': 1980, 'Italy': 1975, 'Germany': 1970,
  // Stark
  'Croatia': 1940, 'Uruguay': 1930, 'Colombia': 1920, 'Morocco': 1915, 'Switzerland': 1905,
  'USA': 1890, 'Mexico': 1890, 'United States': 1890, 'Denmark': 1895, 'Japan': 1885,
  'Senegal': 1880, 'Ecuador': 1860, 'Serbia': 1860, 'Korea Republic': 1855, 'South Korea': 1855,
  'Iran': 1850, 'Ukraine': 1850, 'Austria': 1875, 'Poland': 1845, 'Sweden': 1840,
  'Australia': 1830, 'Wales': 1825, 'Turkey': 1860, 'Norway': 1865, 'Nigeria': 1840,
  'Algeria': 1835, 'Egypt': 1830, 'Ivory Coast': 1825, 'Peru': 1820, 'Chile': 1825,
  'Canada': 1840, 'Scotland': 1835, 'Greece': 1830, 'Hungary': 1830, 'Czech Republic': 1835,
  'Czechia': 1835, 'Romania': 1810, 'Slovakia': 1810, 'Slovenia': 1805,
  // Mittelfeld
  'Tunisia': 1800, 'Ghana': 1800, 'Cameroon': 1800, 'Mali': 1800, 'Paraguay': 1810,
  'Venezuela': 1805, 'Costa Rica': 1790, 'Panama': 1785, 'Qatar': 1780, 'Saudi Arabia': 1775,
  'South Africa': 1780, 'Cape Verde': 1780, 'Burkina Faso': 1785, 'DR Congo': 1790,
  'Jamaica': 1770, 'Uzbekistan': 1775, 'Iraq': 1765, 'Jordan': 1760, 'United Arab Emirates': 1750,
  'Honduras': 1745, 'New Zealand': 1740, 'Bolivia': 1735, 'Bahrain': 1730,
  // Außenseiter
  'Haiti': 1710, 'El Salvador': 1700, 'Guatemala': 1700, 'Curacao': 1715, 'Suriname': 1705,
  'Oman': 1720, 'China': 1715, 'Thailand': 1690, 'India': 1660, 'Kuwait': 1690,
  'Trinidad and Tobago': 1690, 'Indonesia': 1680, 'Vietnam': 1700,
};

class EloModel {
  final Map<String, double> ratings;
  EloModel(this.ratings);

  // Per Walk-Forward-Backtest über 5 Ligen / 2 Saisons getunt
  // (LogLoss 1.066 -> 1.045, Trefferquote 45.9 % -> 47.3 %).
  static const base = 1500.0;
  static const homeAdvantage = 50.0;
  static const k = 16.0;

  // Bekannte Stärke nutzen, sonst Nationalteam-Startwert, sonst Basis.
  double rating(String team) => ratings[team] ?? kNationalElo[team] ?? base;
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

/// Ein K.o.-Spiel für die Turnier-Simulation (Sieger ggf. schon bekannt).
class KoGame {
  final String a;
  final String b;
  final String? winner; // bei bereits beendetem Spiel
  const KoGame(this.a, this.b, this.winner);
}

/// Monte-Carlo: simuliert das Turnier ab der ersten K.o.-Runde und liefert je
/// Team die Titel-Wahrscheinlichkeit. Beendete Spiele zählen mit echtem Sieger;
/// nach der ersten Runde werden die Paarungen zufällig gezogen (Schätzung, da
/// der genaue Turnierbaum nicht vorliegt).
Map<String, double> titleChances(List<KoGame> firstRound, EloModel model,
    {int sims = 12000}) {
  if (firstRound.isEmpty) return {};
  final rnd = Random();
  final wins = <String, int>{};
  String play(String a, String b) {
    final pa = 1 / (1 + pow(10, -(model.rating(a) - model.rating(b)) / 400));
    return rnd.nextDouble() < pa ? a : b;
  }

  for (var s = 0; s < sims; s++) {
    var teams = <String>[for (final g in firstRound) g.winner ?? play(g.a, g.b)];
    while (teams.length > 1) {
      teams.shuffle(rnd);
      final next = <String>[];
      for (var i = 0; i + 1 < teams.length; i += 2) {
        next.add(play(teams[i], teams[i + 1]));
      }
      if (teams.length.isOdd) next.add(teams.last);
      teams = next;
    }
    wins[teams.first] = (wins[teams.first] ?? 0) + 1;
  }
  return wins.map((k, v) => MapEntry(k, v / sims));
}

/// Welchen Ausgang sagt das Modell voraus?
///
/// Bewusst die EINZIGE Stelle, an der aus Wahrscheinlichkeiten eine Tendenz
/// wird - Anzeige und Bewertung müssen dieselbe Antwort geben. Vorher zeigte
/// die Spielkarte bei gleicher Heim-/Auswärtswahrscheinlichkeit
/// "Unentschieden", während die Trefferquoten-Statistik "Heimsieg" bewertete.
/// Die Kennzahl maß damit eine Prognose, die nie jemand zu sehen bekam.
///
/// Die Regel ist die der Anzeige (eingeführt in v1.7.1): auf ganze Prozent
/// gerundeter Gleichstand zwischen beiden Teams ergibt X, sonst gewinnt der
/// größte Wert, bei Gleichstand in der Reihenfolge Heim, Remis, Gast.
Tendency predictedTendency(MatchProbs p) {
  final rh = (p.home * 100).round();
  final ra = (p.away * 100).round();
  final rd = (p.draw * 100).round();
  if (rh == ra && rh >= rd) return Tendency.draw;
  final values = [p.home, p.draw, p.away];
  final maxp = values.reduce((a, b) => a > b ? a : b);
  final idx = values.indexOf(maxp);
  return idx == 0 ? Tendency.home : (idx == 1 ? Tendency.draw : Tendency.away);
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
    final predicted = predictedTendency(p);
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
    // Bereits vollständig gelernte Spieltage kosten keine Anfrage.
    final offen = <int>[];
    for (var r = 1; r <= league.maxRound; r++) {
      if (store.roundLearned('${league.id}|$season|$r')) {
        onProgress?.call(base + r, total);
      } else {
        offen.add(r);
      }
    }
    if (offen.isEmpty || _cancelled) return;

    // WICHTIG: Laden darf gleichzeitig laufen, LERNEN nicht.
    //
    // Das Elo-Modell ist reihenfolgeabhängig – jedes Ergebnis verschiebt die
    // Ratings, mit denen das nächste bewertet wird. Würden die Spieltage in
    // der Reihenfolge ihres Eintreffens verarbeitet, käme je nach Netzlaune
    // ein anderes Modell heraus, und die gemessene Treffsicherheit wäre
    // nicht mehr reproduzierbar. Deshalb: in Wellen holen, danach streng
    // nach Spieltag sortiert einspeisen.
    //
    // Vorher lief jede Runde einzeln mit 120 ms Pause dazwischen. Beim ersten
    // Öffnen einer Liga sind das zwei Saisons à maxRound Spieltage – bei der
    // Bundesliga 68 Anfragen nacheinander.
    const wellenGroesse = 3;
    for (var i = 0; i < offen.length; i += wellenGroesse) {
      if (_cancelled) return;
      final welle = offen.skip(i).take(wellenGroesse).toList();
      final geladen = await Api.inWellen<({int runde, List<FootyMatch>? spiele})>(
        welle
            .map((r) => () async {
                  try {
                    return (runde: r, spiele: await Api.round(league.id, season, r));
                  } catch (_) {
                    // Einzelne Runde übersprungen – beim nächsten Lauf erneut
                    // versucht. null heißt Fehlschlag, nicht „keine Spiele".
                    return (runde: r, spiele: null);
                  }
                })
            .toList(),
        grenze: wellenGroesse,
      );
      if (_cancelled) return;

      geladen.sort((a, b) => a.runde.compareTo(b.runde));
      for (final g in geladen) {
        final matches = g.spiele;
        if (matches == null) {
          onProgress?.call(base + g.runde, total);
          continue;
        }
        var allFinished = matches.isNotEmpty;
        for (final m in matches) {
          if (ingestMatch(store, model, m, evaluate: evaluate)) _changed = true;
          if (!m.finished) allFinished = false;
        }
        // Nur abgeschlossene Spieltage „fertig" markieren -> später kein Refetch.
        if (allFinished) store.markRoundLearned('${league.id}|$season|${g.runde}');
        onProgress?.call(base + g.runde, total);
      }
    }
  }
}
