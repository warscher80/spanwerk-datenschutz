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
  'Australia': 1830, 'Wales': 1825, 'Turkey': 1860, 'Türkiye': 1860, 'Turkiye': 1860,
  'Norway': 1865, 'Nigeria': 1840,
  'Algeria': 1835, 'Egypt': 1830, 'Ivory Coast': 1825, 'Cote d\'Ivoire': 1825,
  'Côte d\'Ivoire': 1825, 'Peru': 1820, 'Chile': 1825,
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

// Start-Stärken für Vereinsmannschaften (grobe, aber realistische Tiers je
// Liga). Damit sind Prognosen ab dem ersten Spiel plausibel, auch bevor das
// Modell ein Team gelernt hat - sonst landeten unbekannte Vereine alle beim
// Basiswert und der Heimvorteil kuerte faelschlich den Schwaecheren zum
// Favoriten (z. B. Genoa vor Napoli). Das Modell verfeinert diese Werte mit
// jedem echten Ergebnis. Namen exakt wie bei TheSportsDB.
const kClubElo = <String, double>{
  'Bayern Munich': 1930, 'Manchester City': 1900, 'Paris Saint-Germain': 1900,
  'Real Madrid': 1900, 'Barcelona': 1880, 'Liverpool': 1870,
  'Arsenal': 1860, 'Inter Milan': 1860, 'Napoli': 1830,
  'Atlético Madrid': 1800, 'Bayer Leverkusen': 1800, 'Atalanta': 1780,
  'Juventus': 1780, 'AC Milan': 1770, 'Borussia Dortmund': 1760,
  'Chelsea': 1740, 'Red Bull Salzburg': 1740, 'Newcastle United': 1730,
  'RB Leipzig': 1730, 'Aston Villa': 1720, 'Marseille': 1720,
  'Roma': 1720, 'Manchester United': 1710, 'Monaco': 1710,
  'Tottenham Hotspur': 1710, 'Athletic Bilbao': 1700, 'Lazio': 1700,
  'Bologna': 1680, 'Eintracht Frankfurt': 1680, 'Fiorentina': 1680,
  'Lille': 1680, 'Real Sociedad': 1680, 'Villarreal': 1680,
  'Stuttgart': 1670, 'Brighton and Hove Albion': 1660, 'Lyon': 1660,
  'Nice': 1660, 'Real Betis': 1660, 'Sturm Graz': 1650,
  'Crystal Palace': 1640, 'Lens': 1640, 'Nottingham Forest': 1640,
  'Rennes': 1640, 'Sevilla': 1640, 'West Ham United': 1630,
  'Bournemouth': 1620, 'Brentford': 1620, 'Freiburg': 1620,
  'Fulham': 1620, 'Wolfsburg': 1620, 'Everton': 1600,
  'Rapid Vienna': 1600, 'Torino': 1600, 'Wolverhampton Wanderers': 1600,
  'Austria Vienna': 1580, 'Borussia Mönchengladbach': 1580, 'Brest': 1580,
  'Celta Vigo': 1580, 'Como': 1580, 'LASK': 1580,
  'Mainz': 1580, 'Strasbourg': 1580, 'Udinese': 1580,
  'Valencia': 1580, 'Werder Bremen': 1580, 'Genoa': 1560,
  'Getafe': 1560, 'Hoffenheim': 1560, 'Leeds United': 1560,
  'Leicester City': 1560, 'Osasuna': 1560, 'Rayo Vallecano': 1560,
  'Southampton': 1560, 'Toulouse': 1560, 'Union Berlin': 1560,
  'Augsburg': 1540, 'Burnley': 1540, 'Ipswich Town': 1540,
  'Monza': 1540, 'Wolfsberger AC': 1540, 'Auxerre': 1520,
  'Cagliari': 1520, 'Deportivo Alavés': 1520, 'Espanyol': 1520,
  'Heidenheim': 1520, 'Hertha': 1520, 'Köln': 1520,
  'Lecce': 1520, 'Middlesbrough': 1520, 'Parma': 1520,
  'Sassuolo': 1520, 'Sheffield United': 1520, 'St Pauli': 1520,
  'Sunderland': 1520, 'West Bromwich Albion': 1520, 'Bochum': 1510,
  'Norwich City': 1510, 'Angers': 1500, 'Coventry City': 1500,
  'Hamburg': 1500, 'Hannover 96': 1500, 'Le Havre': 1500,
  'Lorient': 1500, 'TSV Hartberg': 1500, 'Watford': 1500,
  'Elche': 1490, 'Frosinone': 1490, 'Hull City': 1490,
  'Kaiserslautern': 1490, 'Levante': 1490, 'Nürnberg': 1490,
  'Paris FC': 1490, 'SCR Altach': 1490, 'Venezia': 1490,
  'Birmingham City': 1480, 'Holstein Kiel': 1480, 'SV Ried': 1480,
  'WSG Tirol': 1480, 'Blackburn Rovers': 1470, 'Bristol City': 1470,
  'Darmstadt': 1470, 'Deportivo de A Coruña': 1470, 'Grazer AK': 1470,
  'Karlsruhe': 1470, 'Racing de Santander': 1470, 'Schalke 04': 1470,
  'Stoke City': 1470, 'Swansea City': 1470, 'Austria Lustenau': 1460,
  'Magdeburg': 1460, 'Millwall': 1460, 'Preston North End': 1460,
  'Cardiff City': 1450, 'Derby County': 1450, 'Greuther Fürth': 1450,
  'Le Mans': 1450, 'Málaga': 1450, 'Queens Park Rangers': 1450,
  'Troyes': 1450, 'Arminia Bielefeld': 1440, 'Blau-Weiß Linz': 1440,
  'Elversberg': 1440, 'Paderborn': 1440, 'Portsmouth': 1440,
  'Bolton Wanderers': 1430, 'Charlton Athletic': 1430, 'FC Liefering': 1430,
  'Wrexham': 1430, 'Admira Wacker': 1420, 'Dynamo Dresden': 1420,
  'Eintracht Braunschweig': 1420, 'SKN St. Polten': 1420, 'Osnabrück': 1410,
  'Wacker Innsbruck': 1410, 'Energie Cottbus': 1400, 'First Vienna': 1400,
  'Lincoln City': 1400, 'Austria Salzburg': 1390, 'Kapfenberger SV': 1390,
  'Floridsdorfer AC': 1380, 'Rapid Wien II': 1380, 'Sturm Graz II': 1380,
  'SKU Amstetten': 1370, 'Schwarz-Weiß Bregenz': 1370, 'Young Violets Austria Wien': 1370,
  'Hertha Wels': 1360, 'Voitsberg': 1360,
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
  double rating(String team) =>
      ratings[team] ?? kNationalElo[team] ?? kClubElo[team] ?? base;
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

}

/// KickProphet Score (0–100): Wie klar ist die Tendenz der Prognose?
///
/// Vollständig aus Daten abgeleitet, nie zufällig oder dekorativ:
///  1. Basis = Sicherheit des wahrscheinlichsten Ausgangs (aus dem Modell),
///     linear abgebildet: 34 % (Zufall bei drei Ausgängen) → 0, 85 %+ → 100.
///  2. [formZustimmung] (−1..+1) verschiebt den Wert um höchstens ±6 Punkte,
///     je nachdem ob die jüngste Form die Tendenz stützt (+) oder ihr
///     widerspricht (−). Ohne belastbare Formdaten ist sie 0.
///
/// Bänder (Vorgabe): 0–39 sehr unsicher · 40–59 ausgeglichen ·
/// 60–79 gute Tendenz · 80–100 starke Tendenz.
int kickProphetScore(MatchProbs p, {double formZustimmung = 0}) {
  final conf = [p.home, p.draw, p.away].reduce((a, b) => a > b ? a : b);
  final basis = ((conf - 0.34) / (0.85 - 0.34)).clamp(0.0, 1.0) * 100;
  final score = basis + formZustimmung.clamp(-1.0, 1.0) * 6;
  return score.clamp(0.0, 100.0).round();
}

/// Textband + Kurzhinweis zum Score.
({String label, String hinweis}) kickProphetBand(int score) {
  if (score < 40) return (label: 'sehr unsicher', hinweis: 'kaum Tendenz');
  if (score < 60) return (label: 'ausgeglichen', hinweis: 'leichte Tendenz');
  if (score < 80) return (label: 'gute Tendenz', hinweis: 'klarer Favorit');
  return (label: 'starke Tendenz', hinweis: 'sehr klarer Favorit');
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

/// Plausibles Tipp-Ergebnis aus den Wahrscheinlichkeiten – bewusst variabel,
/// nicht immer „2:1". Der prognostizierte Sieger bekommt das höhere Ergebnis;
/// je klarer der Favorit, desto deutlicher (1:0 → 2:1 → 2:0 → 3:1 → 3:0).
/// Unentschieden ergibt je nach erwartetem Torreichtum 0:0, 1:1 oder 2:2.
List<int> tippFromProbs(MatchProbs p) {
  final t = predictedTendency(p);
  if (t == Tendency.draw) {
    // Wie torreich? Grobe Schätzung aus der Remis-Wahrscheinlichkeit: ein sehr
    // hoher Remis-Wert spricht für ein zähes, torarmes Spiel.
    if (p.draw >= 0.34) return [0, 0];
    if (p.draw >= 0.28) return [1, 1];
    return [2, 2];
  }
  // Siegwahrscheinlichkeit des Favoriten bestimmt die Höhe des Sieges.
  final pw = t == Tendency.home ? p.home : p.away;
  final List<int> wl; // [Tore Sieger, Tore Verlierer]
  if (pw < 0.45) {
    wl = [1, 0];
  } else if (pw < 0.55) {
    wl = [2, 1];
  } else if (pw < 0.65) {
    wl = [2, 0];
  } else if (pw < 0.75) {
    wl = [3, 1];
  } else {
    wl = [3, 0];
  }
  return t == Tendency.home ? wl : [wl[1], wl[0]];
}

/// Ein echtes, abgeschlossenes Spiel verarbeiten: Modell-Vorhersage bewerten,
/// dann lernen, Ergebnis getippter Spiele merken. Gibt true zurück, wenn das
/// Modell verändert wurde.
bool ingestMatch(PredictionStore store, EloModel model, FootyMatch m,
    {bool evaluate = true, bool neutral = false, String liga = ''}) {
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
    int idx(Tendency t) =>
        t == Tendency.home ? 0 : (t == Tendency.draw ? 1 : 2);
    store.addModelEvalDetailed(
      pHome: p.home,
      pDraw: p.draw,
      pAway: p.away,
      predicted: idx(predicted),
      actual: idx(actual),
      liga: liga.isEmpty ? (m.competition ?? '') : liga,
    );
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
          if (ingestMatch(store, model, m, neutral: true, liga: league.label)) {
            _changed = true;
          }
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
          if (ingestMatch(store, model, m, evaluate: evaluate, liga: league.label)) {
            _changed = true;
          }
          if (!m.finished) allFinished = false;
        }
        // Nur abgeschlossene Spieltage „fertig" markieren -> später kein Refetch.
        if (allFinished) store.markRoundLearned('${league.id}|$season|${g.runde}');
        onProgress?.call(base + g.runde, total);
      }
    }
  }
}
