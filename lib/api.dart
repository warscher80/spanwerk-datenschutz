// api.dart – Echte Fußballdaten von TheSportsDB (gratis Test-Key "123").
// Deckt Deutschland, Österreich, England, Italien, Spanien und die WM ab.
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

/// Eine wählbare Liga oder ein Turnier.
class League {
  final String id; // TheSportsDB idLeague
  final String name;
  final String country;
  final String flag; // Emoji
  final int maxRound;
  final bool isCup; // Turnier mit Gruppen + K.o. statt fortlaufender Spieltage
  final String? seasonOverride; // z. B. WM nutzt "2026" statt "2025-2026"
  final List<int> cupCandidates; // mögliche Runden-Codes (Gruppen + K.o.)
  const League(
    this.id,
    this.name,
    this.country,
    this.flag,
    this.maxRound, {
    this.isCup = false,
    this.seasonOverride,
    this.cupCandidates = const [],
  });

  String get label => '$flag $name';
  String get sub => country;
}

// Runden-Codes für die WM bei TheSportsDB: 1–3 = Gruppen-Spieltage,
// danach „Round of N": 32 = Sechzehntelfinale, 16 = Achtelfinale, 8 = Viertel-,
// 4 = Halbfinale; 125/150/160/200 als Fallback für Halbfinale/Platz 3/Finale.
const _wcCandidates = [1, 2, 3, 32, 16, 8, 4, 125, 150, 160, 200];

const kLeagues = <League>[
  League('4429', 'WM 2026', 'International', '🏆', 0,
      isCup: true, seasonOverride: '2026', cupCandidates: _wcCandidates),
  League('4331', '1. Bundesliga', 'Deutschland', '🇩🇪', 34),
  League('4399', '2. Bundesliga', 'Deutschland', '🇩🇪', 34),
  League('4621', 'Bundesliga', 'Österreich', '🇦🇹', 32),
  League('4796', '2. Liga', 'Österreich', '🇦🇹', 30),
  League('4328', 'Premier League', 'England', '🇬🇧', 38),
  League('4329', 'Championship', 'England', '🇬🇧', 46),
  League('4332', 'Serie A', 'Italien', '🇮🇹', 38),
  League('4335', 'La Liga', 'Spanien', '🇪🇸', 38),
  League('4334', 'Ligue 1', 'Frankreich', '🇫🇷', 34),
];

/// Eine Turnier-Runde mit Anzahl Spiele (für Beschriftung & Navigation).
class CupStage {
  final int code;
  final int count;
  const CupStage(this.code, this.count);
}

/// Beschriftung einer Turnier-Runde (Code bzw. nach Spielanzahl).
String cupStageLabel(int code, int count) {
  switch (code) {
    case 1:
    case 2:
    case 3:
      return 'Gruppe · $code. Spieltag';
    case 125:
      return 'Viertelfinale';
    case 150:
      return 'Halbfinale';
    case 160:
      return 'Spiel um Platz 3';
    case 200:
      return 'Finale';
  }
  switch (count) {
    case 16:
      return 'Sechzehntelfinale';
    case 8:
      return 'Achtelfinale';
    case 4:
      return 'Viertelfinale';
    case 2:
      return 'Halbfinale';
    case 1:
      return 'Finale';
  }
  return 'Runde $code';
}

class Team {
  final String name;
  final String? badge;
  const Team(this.name, this.badge);

  String get shortName {
    var n = name
        .replaceAll(RegExp(r'\bFC\b|\bAFC\b|\bSV\b|\bSC\b|\bSK\b|\bTSV\b', caseSensitive: false), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    return n.isEmpty ? name : n;
  }

  String get initials {
    final parts = shortName.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      final p = parts.first;
      return p.substring(0, p.length.clamp(0, 3)).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}

class FootyMatch {
  final int id;
  final DateTime? kickoff; // lokale Zeit
  final int round;
  final Team home;
  final Team away;
  final bool finished;
  final int? homeGoals;
  final int? awayGoals;

  const FootyMatch({
    required this.id,
    required this.kickoff,
    required this.round,
    required this.home,
    required this.away,
    required this.finished,
    required this.homeGoals,
    required this.awayGoals,
  });

  bool get hasResult => homeGoals != null && awayGoals != null;
  bool startedBy(DateTime now) => kickoff != null && !now.isBefore(kickoff!);

  static const _finishedStates = {'FT', 'AET', 'PEN', 'Match Finished', 'AP'};

  factory FootyMatch.fromJson(Map<String, dynamic> j) {
    int? toInt(dynamic v) => v == null ? null : int.tryParse(v.toString());

    DateTime? kickoff;
    final ts = j['strTimestamp'] as String?;
    if (ts != null && ts.isNotEmpty) {
      // Zeitstempel ist UTC ohne Offset -> als UTC interpretieren, dann lokal.
      kickoff = DateTime.tryParse(ts.endsWith('Z') ? ts : '${ts}Z')?.toLocal();
    }
    kickoff ??= () {
      final d = j['dateEvent'] as String?;
      return d == null ? null : DateTime.tryParse(d);
    }();

    final status = (j['strStatus'] ?? '').toString();
    final hg = toInt(j['intHomeScore']);
    final ag = toInt(j['intAwayScore']);
    final finished = _finishedStates.contains(status) ||
        (hg != null && ag != null && status.isEmpty == false && status != 'NS');

    return FootyMatch(
      id: int.parse(j['idEvent'].toString()),
      kickoff: kickoff,
      round: int.tryParse((j['intRound'] ?? '0').toString()) ?? 0,
      home: Team((j['strHomeTeam'] ?? 'Heim').toString(), j['strHomeTeamBadge'] as String?),
      away: Team((j['strAwayTeam'] ?? 'Gast').toString(), j['strAwayTeamBadge'] as String?),
      finished: finished,
      homeGoals: hg,
      awayGoals: ag,
    );
  }
}

class Api {
  // Öffentlicher Gratis-Test-Key von TheSportsDB.
  static const _base = 'https://www.thesportsdb.com/api/v1/json/123';

  /// Aktuelle Saison im Format "2025-2026" (Spielbetrieb startet im August).
  static String currentSeason(DateTime now) {
    final start = now.month >= 8 ? now.year : now.year - 1;
    return '$start-${start + 1}';
  }

  /// Vorherige Saison, z. B. "2025-2026" -> "2024-2025".
  static String previousSeason(String season) {
    final start = int.tryParse(season.split('-').first) ?? 0;
    return '${start - 1}-$start';
  }

  /// Saison einer Liga (Turniere haben eine feste Saison wie "2026").
  static String seasonFor(League league, DateTime now) =>
      league.seasonOverride ?? currentSeason(now);

  /// Findet die tatsächlich vorhandenen Turnier-Runden (Gruppen + K.o.),
  /// indem die möglichen Codes durchprobiert werden. So erscheinen K.o.-Runden
  /// automatisch, sobald sie eingetragen sind.
  static Future<List<CupStage>> discoverCupRounds(
      String leagueId, String season, List<int> candidates) async {
    final stages = <CupStage>[];
    for (final c in candidates) {
      try {
        final ms = await round(leagueId, season, c);
        if (ms.isNotEmpty) stages.add(CupStage(c, ms.length));
      } catch (_) {
        // Runde übersprungen
      }
      await Future.delayed(const Duration(milliseconds: 150));
    }
    // Fallback: sollte die Erkennung leer bleiben (z. B. Drosselung), die
    // Gruppen-Spieltage 1–3 direkt erzwingen, damit Turniere nie leer wirken.
    if (stages.isEmpty) {
      for (final c in const [1, 2, 3]) {
        try {
          final ms = await round(leagueId, season, c);
          if (ms.isNotEmpty) stages.add(CupStage(c, ms.length));
        } catch (_) {}
        await Future.delayed(const Duration(milliseconds: 200));
      }
    }
    return stages;
  }

  /// Nächster anstehender Spieltag (für „immer aktueller Stand"); null außerhalb der Saison.
  static Future<int?> nextRound(String leagueId) async {
    try {
      final uri = Uri.parse('$_base/eventsnextleague.php?id=$leagueId');
      final res = await http.get(uri).timeout(const Duration(seconds: 12));
      if (res.statusCode != 200) return null;
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final events = (body['events'] as List?) ?? const [];
      int? minRound;
      for (final e in events.cast<Map<String, dynamic>>()) {
        final r = int.tryParse((e['intRound'] ?? '').toString());
        if (r != null && (minRound == null || r < minRound)) minRound = r;
      }
      return minRound;
    } catch (_) {
      return null;
    }
  }

  static Future<List<FootyMatch>> _events(String path) async {
    try {
      return _parseEvents(await _getJson(path, retries: 2));
    } catch (_) {
      return const [];
    }
  }

  /// „Aktuelle Spiele" über alle Ligen: für jede Liga den aktuellen
  /// Spieltag/die aktuelle Runde komplett laden und auf das Zeitfenster
  /// [-2, +12] Tage filtern, nach Anstoß sortiert.
  static Future<List<FootyMatch>> currentMatches(
      List<League> leagues, DateTime now) async {
    final byId = <int, FootyMatch>{};
    for (final l in leagues) {
      // Nächste Spiele dieser Liga (liefert auch die aktuelle Runden-Nummer).
      final next = await _events('eventsnextleague.php?id=${l.id}');
      await Future.delayed(const Duration(milliseconds: 70));

      final pool = <FootyMatch>[];
      if (next.isNotEmpty) {
        pool.addAll(next);
        // kompletten aktuellen Spieltag nachladen (sonst nur 1–2 Spiele)
        var r = 0;
        for (final m in next) {
          if (m.round > 0 && (r == 0 || m.round < r)) r = m.round;
        }
        if (r > 0) {
          try {
            pool.addAll(await round(l.id, seasonFor(l, now), r));
          } catch (_) {}
          await Future.delayed(const Duration(milliseconds: 70));
        }
      } else {
        // Außerhalb der Saison: zuletzt gespielte Partien
        pool.addAll(await _events('eventspastleague.php?id=${l.id}'));
        await Future.delayed(const Duration(milliseconds: 70));
      }
      for (final m in pool) {
        byId[m.id] = m;
      }
    }

    final from = now.subtract(const Duration(days: 2));
    final to = now.add(const Duration(days: 12));
    final list = byId.values.where((m) {
      final k = m.kickoff;
      return k != null && k.isAfter(from) && k.isBefore(to);
    }).toList()
      ..sort((a, b) => a.kickoff!.compareTo(b.kickoff!));
    return list;
  }

  /// Robuster GET mit Wiederholungen/Backoff. Wichtig am Gratis-Limit (429)
  /// und im mobilen Netz – sonst bleibt die Liste bei einem Aussetzer leer.
  static Future<Map<String, dynamic>> _getJson(String path,
      {int retries = 4}) async {
    final uri = Uri.parse('$_base/$path');
    for (var a = 0; a < retries; a++) {
      try {
        final res = await http.get(uri).timeout(const Duration(seconds: 15));
        if (res.statusCode == 200) {
          return jsonDecode(res.body) as Map<String, dynamic>;
        }
        if (res.statusCode == 429 || res.statusCode >= 500) {
          await Future.delayed(Duration(milliseconds: 500 * (a + 1)));
          continue;
        }
        throw Exception('Server ${res.statusCode}');
      } on TimeoutException {
        await Future.delayed(Duration(milliseconds: 500 * (a + 1)));
      }
    }
    throw Exception('Keine Antwort vom Server');
  }

  static List<FootyMatch> _parseEvents(Map<String, dynamic> body) {
    final events = (body['events'] as List?) ?? const [];
    final matches =
        events.cast<Map<String, dynamic>>().map(FootyMatch.fromJson).toList();
    matches.sort((a, b) {
      final ka = a.kickoff, kb = b.kickoff;
      if (ka == null || kb == null) return 0;
      return ka.compareTo(kb);
    });
    return matches;
  }

  // Abgeschlossene Runden (alle Spiele beendet) ändern sich nicht mehr ->
  // einmal pro Sitzung cachen, schont den geteilten Gratis-Key.
  static final Map<String, List<FootyMatch>> _finishedCache = {};

  /// Alle Spiele eines Spieltags einer Liga.
  static Future<List<FootyMatch>> round(String leagueId, String season, int round) async {
    final key = '$leagueId|$season|$round';
    final cached = _finishedCache[key];
    if (cached != null) return cached;
    final m = _parseEvents(await _getJson('eventsround.php?id=$leagueId&r=$round&s=$season'));
    if (m.isNotEmpty && m.every((x) => x.finished)) _finishedCache[key] = m;
    return m;
  }

  /// Alle Spiele eines Turniers: probiert direkt alle möglichen Runden-Codes
  /// und nimmt jede Runde mit Spielen. Robust – ohne separate Erkennungsstufe.
  static Future<List<FootyMatch>> allCupMatches(
      String leagueId, String season, List<int> candidates) async {
    final byId = <int, FootyMatch>{};
    for (final c in candidates) {
      try {
        for (final m in await round(leagueId, season, c)) {
          byId[m.id] = m;
        }
      } catch (_) {
        // einzelne Runde übersprungen
      }
      await Future.delayed(const Duration(milliseconds: 80));
    }
    final list = byId.values.toList()
      ..sort((a, b) {
        final ka = a.kickoff, kb = b.kickoff;
        if (ka == null || kb == null) return 0;
        return ka.compareTo(kb);
      });
    return list;
  }
}
