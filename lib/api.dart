// api.dart – Echte Fußballdaten von TheSportsDB (gratis Test-Key "123").
// Deckt Deutschland, Österreich und England (jeweils 1. + 2. Liga) ab.
import 'dart:convert';
import 'package:http/http.dart' as http;

/// Eine wählbare Liga inkl. Land und maximaler Spieltagszahl.
class League {
  final String id; // TheSportsDB idLeague
  final String name;
  final String country;
  final String flag; // Emoji
  final int maxRound;
  const League(this.id, this.name, this.country, this.flag, this.maxRound);

  String get label => '$flag $name';
  String get sub => country;
}

const kLeagues = <League>[
  League('4331', '1. Bundesliga', 'Deutschland', '🇩🇪', 34),
  League('4399', '2. Bundesliga', 'Deutschland', '🇩🇪', 34),
  League('4621', 'Bundesliga', 'Österreich', '🇦🇹', 32),
  League('4796', '2. Liga', 'Österreich', '🇦🇹', 30),
  League('4328', 'Premier League', 'England', '🇬🇧', 38),
  League('4329', 'Championship', 'England', '🇬🇧', 46),
];

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

  /// Alle Spiele eines Spieltags einer Liga.
  static Future<List<FootyMatch>> round(String leagueId, String season, int round) async {
    final uri = Uri.parse('$_base/eventsround.php?id=$leagueId&r=$round&s=$season');
    final res = await http.get(uri).timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) {
      throw Exception('Server antwortet mit ${res.statusCode}');
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final events = (body['events'] as List?) ?? const [];
    final matches = events
        .cast<Map<String, dynamic>>()
        .map(FootyMatch.fromJson)
        .toList();
    matches.sort((a, b) {
      final ka = a.kickoff, kb = b.kickoff;
      if (ka == null || kb == null) return 0;
      return ka.compareTo(kb);
    });
    return matches;
  }
}
