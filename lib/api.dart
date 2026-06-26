// api.dart – Echte Fußballdaten von OpenLigaDB (gratis, ohne API-Key).
// Liefert Spieltage mit Begegnungen, Anstoßzeiten, Wappen und Endergebnissen.
import 'dart:convert';
import 'package:http/http.dart' as http;

/// Eine wählbare Liga.
class League {
  final String shortcut; // z.B. "bl1"
  final String name;
  const League(this.shortcut, this.name);
}

const kLeagues = <League>[
  League('bl1', '1. Bundesliga'),
  League('bl2', '2. Bundesliga'),
  League('bl3', '3. Liga'),
];

class Team {
  final String name;
  final String? iconUrl;
  const Team(this.name, this.iconUrl);

  String get shortName {
    var n = name
        .replaceAll(RegExp(r'^(1\.|FC|SV|SC|VfB|VfL|TSG|BV|Borussia)\s+', caseSensitive: false), '')
        .trim();
    return n.isEmpty ? name : n;
  }

  /// Kürzel für den Fallback-Kreis, wenn kein (Bitmap-)Logo geladen werden kann.
  String get initials {
    final parts = shortName.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, parts.first.length.clamp(0, 3)).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  /// OpenLigaDB liefert oft SVG-Wappen – die kann Image.network nicht rendern.
  /// Nur direkt anzeigbare Rasterformate zurückgeben.
  String? get bitmapIcon {
    final u = iconUrl;
    if (u == null) return null;
    final lower = u.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif')) {
      return u;
    }
    return null;
  }
}

class FootyMatch {
  final int id;
  final DateTime? kickoff;
  final String matchday; // "12. Spieltag"
  final Team home;
  final Team away;
  final bool finished;
  final int? homeGoals; // Endergebnis, null wenn noch nicht gespielt
  final int? awayGoals;

  const FootyMatch({
    required this.id,
    required this.kickoff,
    required this.matchday,
    required this.home,
    required this.away,
    required this.finished,
    required this.homeGoals,
    required this.awayGoals,
  });

  bool get hasResult => homeGoals != null && awayGoals != null;

  /// Spiel hat (laut Anstoßzeit) bereits begonnen.
  bool startedBy(DateTime now) => kickoff != null && !now.isBefore(kickoff!);

  factory FootyMatch.fromJson(Map<String, dynamic> j) {
    Team team(String key) {
      final t = j[key] as Map<String, dynamic>?;
      return Team(
        (t?['teamName'] ?? 'Team') as String,
        t?['teamIconUrl'] as String?,
      );
    }

    int? hg, ag;
    final results = (j['matchResults'] as List?) ?? const [];
    // "Endergebnis" hat die höchste resultOrderID.
    Map<String, dynamic>? endResult;
    for (final r in results.cast<Map<String, dynamic>>()) {
      if (endResult == null ||
          (r['resultOrderID'] ?? 0) > (endResult['resultOrderID'] ?? 0)) {
        endResult = r;
      }
    }
    if (endResult != null) {
      hg = endResult['pointsTeam1'] as int?;
      ag = endResult['pointsTeam2'] as int?;
    }

    DateTime? kickoff;
    final dt = j['matchDateTime'] as String?;
    if (dt != null) kickoff = DateTime.tryParse(dt);

    return FootyMatch(
      id: j['matchID'] as int,
      kickoff: kickoff,
      matchday: (j['group']?['groupName'] ?? '') as String,
      home: team('team1'),
      away: team('team2'),
      finished: (j['matchIsFinished'] ?? false) as bool,
      homeGoals: hg,
      awayGoals: ag,
    );
  }
}

class Api {
  static const _base = 'https://api.openligadb.de';

  static Future<List<FootyMatch>> _get(String path) async {
    final res = await http
        .get(Uri.parse('$_base/$path'))
        .timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) {
      throw Exception('Server antwortet mit ${res.statusCode}');
    }
    final data = jsonDecode(res.body) as List;
    final matches = data
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

  /// Aktueller/nächster Spieltag der laufenden Saison.
  static Future<List<FootyMatch>> currentMatchday(String league) =>
      _get('getmatchdata/$league');

  /// Konkreter Spieltag einer Saison (Saison als Startjahr, z.B. 2025 = 2025/26).
  static Future<List<FootyMatch>> matchday(String league, int season, int day) =>
      _get('getmatchdata/$league/$season/$day');
}
