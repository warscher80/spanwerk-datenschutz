// api.dart – Echte Fußballdaten von TheSportsDB (gratis Test-Key "123").
// Deckt Deutschland, Österreich, England, Italien, Spanien und die WM ab.
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

import 'stats.dart';

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
  final String? id; // TheSportsDB-Team-ID – nötig, um die Form nachzuladen
  const Team(this.name, this.badge, {this.id});

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

  /// Ist die Anstoßzeit echt bekannt oder nur aus dem Datum abgeleitet?
  /// Für abgeleitete Zeiten darf keine Erinnerung geplant werden – sie wäre
  /// schlicht geraten.
  final bool kickoffExact;

  // Anzeige-Name der Liga/des Wettbewerbs (z. B. "🇦🇹 2. Liga"),
  // wird nach dem Laden gesetzt, damit man in der Ansicht "Aktuell" sieht,
  // zu welcher Liga ein Spiel gehört.
  String? competition;

  // Anzeige-Name der Runde bei Turnieren (z. B. "Achtelfinale"). Bei Ligen
  // null – dort zeigt die Karte den Spieltag aus [round]. Nötig, weil in
  // Turnieren [round] ein Runden-Code ist (32/16/8/4) und nicht der Spieltag.
  String? roundLabel;

  // Neutraler Platz (Turnier/WM): kein Heimvorteil – für Anzeige UND Lernen.
  // Pro Spiel gesetzt, damit ein Turnierspiel auch in der gemischten Ansicht
  // „Aktuell" gleich bewertet wird wie im Turnier-Tab.
  bool neutralVenue;

  // Spielfortschritt bei laufenden Spielen, roh von TheSportsDB (strProgress):
  // meist die Minute ("67", "45+2") oder "HT". Die normalen Feeds
  // (eventsnextleague/eventsround) enthalten dieses Feld NICHT – nur der
  // separate livescore.php-Feed führt es. Deshalb wird es nach dem Laden
  // nachträglich zugespielt (Api.liveMinutes) und ist bewusst veränderbar.
  String? progress;

  // Roher Status von TheSportsDB (strStatus), z. B. "NS", "PostP.", "CANC",
  // "SUSP", "HT". Für die klare Kennzeichnung verschoben/abgesagt/unterbrochen.
  final String status;

  FootyMatch({
    required this.id,
    required this.kickoff,
    required this.round,
    required this.home,
    required this.away,
    required this.finished,
    required this.homeGoals,
    required this.awayGoals,
    this.competition,
    this.roundLabel,
    this.neutralVenue = false,
    this.kickoffExact = true,
    this.progress,
    this.status = '',
  });

  // Punkte/Leerzeichen entfernen, damit "PostP.", "Post." usw. sicher greifen.
  String get _statusUp =>
      status.trim().toUpperCase().replaceAll(RegExp(r'[.\s]'), '');
  bool get istAbgesagt =>
      _statusUp == 'CANC' || _statusUp == 'CANCELLED' || _statusUp == 'ABD';
  bool get istVerschoben =>
      _statusUp == 'POSTP' || _statusUp == 'PST' || _statusUp == 'POSTPONED';
  bool get istUnterbrochen =>
      _statusUp == 'SUSP' || _statusUp == 'INT' || _statusUp == 'SUSPENDED';
  bool get istHalbzeit => _statusUp == 'HT';
  /// Nicht regulär spielbar (verschoben/abgesagt/unterbrochen) – dann ist die
  /// angezeigte Anstoßzeit keine verlässliche „kommt gleich"-Aussage mehr.
  bool get istGestoert => istAbgesagt || istVerschoben || istUnterbrochen;

  /// Aufbereitete Spielminute für die Anzeige – nur bei laufenden Spielen.
  /// Gibt z. B. "67'", "45+2'" oder "Halbzeit" zurück, sonst null.
  String? get liveMinute {
    if (!isLive) return null;
    final p = progress?.trim();
    if (p == null || p.isEmpty || p == '0') return null;
    final u = p.toUpperCase();
    if (u == 'HT' || u == 'HALFTIME' || u == 'HALF TIME') return 'Halbzeit';
    if (u == 'ET' || u == 'AET') return 'Verläng.';
    if (u == 'BT' || u == 'BREAK') return 'Pause';
    if (u == 'PEN' || u == 'P') return 'Elfmeter';
    // Reine Minutenangabe (evtl. mit Nachspielzeit wie 45+2) -> Minuten-Zeichen.
    if (RegExp(r'^\d{1,3}(\+\d{1,2})?$').hasMatch(p)) return "$p'";
    return p; // unbekanntes Format unverändert zeigen
  }

  bool get hasResult => homeGoals != null && awayGoals != null;
  bool startedBy(DateTime now) => kickoff != null && !now.isBefore(kickoff!);

  /// Läuft gerade: hat einen (Zwischen-)Stand, ist aber noch nicht beendet.
  bool get isLive => hasResult && !finished;

  // Statuswerte, die ein ENDGUELTIGES Ergebnis bedeuten.
  static const _finishedStates = {
    'FT', 'AET', 'PEN', 'AP', 'MATCH FINISHED', 'AW', 'WO',
  };

  // Statuswerte, die ausdruecklich KEIN Endergebnis bedeuten - allen voran
  // laufende Spiele. Ein Zwischenstand darf niemals als Endstand gelernt
  // werden: ingestMatch merkt sich jedes Spiel per markIngested einmalig,
  // das echte Ergebnis kaeme also nie mehr nach.
  static const _openStates = {
    'NS', 'TBD', 'POSTP', 'PST', 'CANC', 'ABD', 'SUSP', 'INT',
    '1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'IN PLAY', 'PEN LIVE',
  };

  /// Ist das Spiel endgueltig abgeschlossen?
  ///
  /// Bewusst eine Positivliste. Frueher galt "alles ausser leer und NS" als
  /// beendet, sobald Tore vorlagen - ein laufendes Spiel mit Halbzeitstand
  /// wurde dadurch als Endergebnis verbucht und ins Elo-Modell gelernt.
  /// Zusaetzlich fror Api.round die Runde im Sitzungs-Cache ein, womit auch
  /// der Tor-Alarm waehrend des Spiels verstummte.
  ///
  /// Unbekannte Statuswerte gelten nur dann als beendet, wenn ein Ergebnis
  /// vorliegt und der Anpfiff so lange zurueckliegt, dass kein laufendes
  /// Spiel mehr gemeint sein kann.
  static bool matchIsFinished(
    String status, {
    required bool hasScores,
    DateTime? kickoff,
    DateTime? now,
    bool kickoffExact = true,
  }) {
    final s = status.trim().toUpperCase();
    if (_finishedStates.contains(s)) return true;
    if (_openStates.contains(s)) return false;
    if (!hasScores || kickoff == null) return false;
    final jetzt = now ?? DateTime.now();
    if (jetzt.difference(kickoff) >= const Duration(hours: 3, minutes: 30)) {
      return true;
    }
    // Ist nur das Datum bekannt, wurde der Anstoß auf das Tagesende (23:59)
    // geschätzt. Die Zeitregel oben griffe dann für ein Spiel, das heute früher
    // lief, nie – es erschiene den ganzen Tag als "kommt noch". Liegt aber
    // bereits ein Ergebnis vor und ist der Status nicht "läuft", ist es vorbei.
    if (!kickoffExact) return true;
    return false;
  }

  /// Wie [FootyMatch.fromJson], liefert aber null statt zu werfen.
  ///
  /// Fast alle Felder haben einen Rueckfallwert, nur `idEvent` wird hart
  /// geparst. Fehlt oder verunglueckt dieses eine Feld, riss die Ausnahme
  /// bisher den kompletten Spieltag mit - der Aufrufer bekam eine leere
  /// Liste und keinen Hinweis auf die Ursache.
  static FootyMatch? tryFromJson(Map<String, dynamic> j) {
    try {
      return FootyMatch.fromJson(j);
    } catch (_) {
      return null;
    }
  }

  factory FootyMatch.fromJson(Map<String, dynamic> j) {
    int? toInt(dynamic v) => v == null ? null : int.tryParse(v.toString());

    DateTime? kickoff;
    final ts = j['strTimestamp'] as String?;
    if (ts != null && ts.isNotEmpty) {
      // Zeitstempel ist UTC ohne Offset -> als UTC interpretieren, dann lokal.
      kickoff = DateTime.tryParse(ts.endsWith('Z') ? ts : '${ts}Z')?.toLocal();
    }
    // Rückfall ohne strTimestamp. Vorher wurde hier nur das Datum geparst –
    // also lokale Mitternacht. Damit lag der „Anstoß" schon am Vormittag
    // Stunden in der Vergangenheit, und currentMatches (Fenster ab vor 4 h)
    // warf das Spiel aus der Liste. Es verschwand lautlos.
    var zeitGenau = kickoff != null;
    kickoff ??= () {
      final d = (j['dateEvent'] as String?)?.trim();
      if (d == null || d.isEmpty) return null;
      // TheSportsDB liefert die Uhrzeit getrennt mit – ebenfalls UTC.
      final t = (j['strTime'] as String?)?.trim();
      if (t != null && t.isNotEmpty && t != '00:00:00') {
        final k = DateTime.tryParse('${d}T${t}Z');
        if (k != null) {
          zeitGenau = true;
          return k.toLocal();
        }
      }
      // Nur das Datum bekannt: bewusst das Tagesende statt Mitternacht, damit
      // das Spiel den ganzen Tag über als anstehend sichtbar bleibt, statt
      // sofort aus der Ansicht zu fallen. Die Uhrzeit ist eine Annahme –
      // deshalb wird für solche Spiele keine Erinnerung geplant.
      final tag = DateTime.tryParse(d);
      return tag == null
          ? null
          : DateTime(tag.year, tag.month, tag.day, 23, 59);
    }();

    final status = (j['strStatus'] ?? '').toString();
    final hg = toInt(j['intHomeScore']);
    final ag = toInt(j['intAwayScore']);
    final finished = matchIsFinished(
      status,
      hasScores: hg != null && ag != null,
      kickoff: kickoff,
      kickoffExact: zeitGenau,
    );

    // Spielminute: bevorzugt strProgress; manche Feeds tragen die Minute auch
    // in strStatus (z. B. "67", "45+2"). Endstatus wie "FT"/"NS" ist keine
    // Minute – die filtert liveMinute ohnehin über isLive heraus.
    var prog = (j['strProgress'] ?? '').toString().trim();
    if (prog.isEmpty || prog == '0') {
      final st = status.trim();
      if (RegExp(r'^\d{1,3}(\+\d{1,2})?$').hasMatch(st)) prog = st;
    }

    return FootyMatch(
      id: int.parse(j['idEvent'].toString()),
      kickoff: kickoff,
      round: int.tryParse((j['intRound'] ?? '0').toString()) ?? 0,
      home: Team((j['strHomeTeam'] ?? 'Heim').toString(), j['strHomeTeamBadge'] as String?,
          id: j['idHomeTeam']?.toString()),
      away: Team((j['strAwayTeam'] ?? 'Gast').toString(), j['strAwayTeamBadge'] as String?,
          id: j['idAwayTeam']?.toString()),
      finished: finished,
      homeGoals: hg,
      awayGoals: ag,
      kickoffExact: zeitGenau,
      progress: prog.isEmpty ? null : prog,
      status: status,
    );
  }
}

/// Kurzzeit-Zwischenspeicher mit Verfallszeit.
///
/// Der geteilte Gratis-Key ist die knappste Ressource der App. Die Ansicht
/// „Aktuell" fächert über alle Ligen aus und kam so auf ~26 Anfragen pro
/// Minute; der bestehende [Api._finishedCache] half dort nie, weil er nur
/// vollständig beendete Runden behält – die laufende Runde ist das nie.
class TtlCache<T> {
  final Duration ttl;
  final Map<String, ({DateTime at, T wert})> _eintraege = {};

  TtlCache(this.ttl);

  T? get(String key, {DateTime? now}) {
    final e = _eintraege[key];
    if (e == null) return null;
    if ((now ?? DateTime.now()).difference(e.at) >= ttl) {
      _eintraege.remove(key);
      return null;
    }
    return e.wert;
  }

  void set(String key, T wert, {DateTime? now}) =>
      _eintraege[key] = (at: now ?? DateTime.now(), wert: wert);

  void clear() => _eintraege.clear();
  int get length => _eintraege.length;
}

class Api {
  // Öffentlicher Gratis-Test-Key von TheSportsDB.
  static const _base = 'https://www.thesportsdb.com/api/v1/json/123';

  /// Antworten kurz zwischenspeichern. 90 s ist knapp genug, dass Spielstände
  /// zeitnah bleiben, und lang genug, dass ein Durchlauf über alle Ligen nicht
  /// dieselben Runden mehrfach abfragt.
  static final TtlCache<Map<String, dynamic>> _jsonCache =
      TtlCache<Map<String, dynamic>>(const Duration(seconds: 90));

  /// Alle Zwischenspeicher leeren (für Tests und den manuellen Neuaufbau).
  static void clearCaches() {
    _jsonCache.clear();
    _finishedCache.clear();
  }

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

  // discoverCupRounds ist entfallen: die Erkennung der vorhandenen Runden
  // erledigt jetzt allCupMatches selbst und meldet das Ergebnis über
  // zuletztGefundeneRunden, damit der Aufrufer es dauerhaft merken kann.
  // Die alte Funktion hatte seit dem Umbau auf "alle Runden auf einmal laden"
  // keinen Aufrufer mehr.

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

  /// Spiele zu einem Pfad laden. **null bedeutet Fehlschlag**, eine leere
  /// Liste bedeutet „es gibt dort keine Spiele".
  ///
  /// Früher lieferten beide Fälle `const []`. Der Aufrufer konnte eine
  /// Drosselung nicht von einem leeren Spieltag unterscheiden – deshalb wurde
  /// dieselbe Störung viermal nur im Symptom repariert (v1.9.2 bis v1.10.1).
  static Future<List<FootyMatch>?> _events(String path) async {
    try {
      return _parseEvents(await _getJson(path, retries: 2));
    } catch (_) {
      return null;
    }
  }

  /// „Aktuelle Spiele" über alle Ligen: für jede Liga den aktuellen
  /// Spieltag/die aktuelle Runde komplett laden und auf das Zeitfenster
  /// [-2, +12] Tage filtern, nach Anstoß sortiert.
  static Future<List<FootyMatch>> currentMatches(
      List<League> leagues, DateTime now) async {
    final byId = <int, FootyMatch>{};
    var erfolge = 0;
    for (final l in leagues) {
      final pool = <FootyMatch>[];

      // Turniere: nur die K.o.-Runden laden (Gruppenphase ist gespielt; spart
      // Anfragen und liefert genau die noch offenen Partien).
      if (l.isCup) {
        final ko = l.cupCandidates.where((c) => c > 3).toList();
        try {
          pool.addAll(await allCupMatches(l.id, seasonFor(l, now), ko));
          erfolge++;
        } catch (_) {
          // Turnier übersprungen – zählt nicht als Erfolg.
        }
        for (final m in pool) {
          m.competition = l.label;
          byId[m.id] = m;
        }
        await Future.delayed(const Duration(milliseconds: 200));
        continue;
      }

      // Nächste Spiele dieser Liga (liefert auch die aktuelle Runden-Nummer).
      final next = await _events('eventsnextleague.php?id=${l.id}');
      await Future.delayed(const Duration(milliseconds: 200));
      if (next != null) erfolge++;
      if (next != null && next.isNotEmpty) {
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
          await Future.delayed(const Duration(milliseconds: 200));
        }
      }
      // (Kein eventspast: „Aktuell" zeigt ohnehin nur noch nicht gespielte Spiele.)
      for (final m in pool) {
        m.competition = l.label;
        byId[m.id] = m;
      }
    }

    // Hat KEIN einziger Wettbewerb geantwortet, ist das eine Störung und kein
    // leerer Spielplan. Der Unterschied ist entscheidend: der Aufrufer darf
    // eine bestehende Liste dann nicht durch eine leere ersetzen.
    if (leagues.isNotEmpty && erfolge == 0) {
      throw Exception('Keine Antwort vom Server');
    }

    // Nur noch nicht gespielte (anstehende/laufende) Partien der nächsten ~2 Wochen.
    final from = now.subtract(const Duration(hours: 4)); // laufende Spiele noch zeigen
    final to = now.add(const Duration(days: 16));
    final list = byId.values.where((m) {
      final k = m.kickoff;
      return k != null && !m.finished && k.isAfter(from) && k.isBefore(to);
    }).toList()
      ..sort((a, b) => a.kickoff!.compareTo(b.kickoff!));
    return list;
  }

  /// Laufende Spielminuten, idEvent -> Fortschritt ("67", "45+2", "HT", …).
  ///
  /// Eigener Endpoint: eventsnextleague/eventsround kennen das Feld strProgress
  /// gar nicht, nur livescore.php führt es – und zwar (anders als befürchtet)
  /// auch mit dem Gratis-Key und für alle Ligen zugleich. Ein einziger Aufruf
  /// deckt damit sämtliche angezeigten Spiele ab. Fehler sind unkritisch:
  /// dann bleibt es bei „live" ohne Minute.
  static Future<Map<int, String>> liveMinutes() async {
    try {
      return parseLiveMinutes(await _getJson('livescore.php?s=Soccer', retries: 2));
    } catch (_) {
      return const {};
    }
  }

  // Form ändert sich langsam -> länger cachen als normale Spieldaten.
  static final TtlCache<TeamForm> _formCache =
      TtlCache<TeamForm>(const Duration(minutes: 20));

  /// Letzte Spiele eines Teams als verdichtete Form (nur echte Ergebnisse).
  /// Liefert bei fehlender ID oder Fehler eine leere Form – nie einen Fehler,
  /// damit die Detailansicht trotzdem funktioniert.
  static Future<TeamForm> teamForm(String? teamId) async {
    if (teamId == null || teamId.isEmpty) return TeamForm.leer;
    final cached = _formCache.get(teamId);
    if (cached != null) return cached;
    try {
      final body = await _getJson('eventslast.php?id=$teamId', retries: 2);
      final raw = body['results'] ?? body['events'];
      final list = raw is List ? raw : const [];
      final games = <FormGame>[];
      for (final e in list) {
        if (e is! Map) continue;
        final hg = int.tryParse('${e['intHomeScore']}');
        final ag = int.tryParse('${e['intAwayScore']}');
        if (hg == null || ag == null) continue; // nur gespielte Partien
        final istHeim = '${e['idHomeTeam']}' == teamId;
        games.add(FormGame(
          heim: istHeim,
          erzielt: istHeim ? hg : ag,
          kassiert: istHeim ? ag : hg,
          datum: _eventDatum(Map<String, dynamic>.from(e)),
        ));
      }
      final form = formAus(games);
      _formCache.set(teamId, form);
      return form;
    } catch (_) {
      return TeamForm.leer;
    }
  }

  /// Datum eines Roh-Events (strTimestamp, sonst dateEvent) als lokale Zeit.
  static DateTime? _eventDatum(Map<String, dynamic> e) {
    final ts = (e['strTimestamp'] as String?)?.trim();
    if (ts != null && ts.isNotEmpty) {
      final d = DateTime.tryParse(ts.endsWith('Z') ? ts : '${ts}Z');
      if (d != null) return d.toLocal();
    }
    final de = (e['dateEvent'] as String?)?.trim();
    return de == null || de.isEmpty ? null : DateTime.tryParse(de);
  }

  /// Reines Auswerten der livescore-Antwort (ohne Netz) – idEvent -> Minute.
  static Map<int, String> parseLiveMinutes(Map<String, dynamic> body) {
    final raw = body['livescore'];
    final list = raw is List ? raw : const [];
    final out = <int, String>{};
    for (final e in list) {
      if (e is! Map) continue;
      final id = int.tryParse('${e['idEvent']}');
      final p = '${e['strProgress'] ?? ''}'.trim();
      if (id != null && p.isNotEmpty && p != '0') out[id] = p;
    }
    return out;
  }

  /// Robuster GET mit Wiederholungen/Backoff. Wichtig am Gratis-Limit (429)
  /// und im mobilen Netz – sonst bleibt die Liste bei einem Aussetzer leer.
  static Future<Map<String, dynamic>> _getJson(String path,
      {int retries = 4}) async {
    final gecacht = _jsonCache.get(path);
    if (gecacht != null) return gecacht;

    final uri = Uri.parse('$_base/$path');
    for (var a = 0; a < retries; a++) {
      try {
        final res = await http.get(uri).timeout(const Duration(seconds: 15));
        if (res.statusCode == 200) {
          final body = jsonDecode(res.body) as Map<String, dynamic>;
          _jsonCache.set(path, body);
          return body;
        }
        if (res.statusCode == 429 || res.statusCode >= 500) {
          await Future.delayed(Duration(milliseconds: 500 * (a + 1)));
          continue;
        }
        throw Exception('Server ${res.statusCode}');
      } on TimeoutException {
        await Future.delayed(Duration(milliseconds: 500 * (a + 1)));
      } on http.ClientException {
        // Verbindungsabbruch im Mobilnetz: genauso behandeln wie eine
        // Zeitüberschreitung. Vorher verliess dieser Fall _getJson sofort,
        // der Wiederholungsversuch lief also nur bei Timeouts.
        await Future.delayed(Duration(milliseconds: 500 * (a + 1)));
      } on FormatException {
        // Kein JSON (z. B. HTML-Fehlerseite bei Drosselung) - erneut versuchen.
        await Future.delayed(Duration(milliseconds: 500 * (a + 1)));
      }
    }
    throw Exception('Keine Antwort vom Server');
  }

  static List<FootyMatch> _parseEvents(Map<String, dynamic> body) {
    final events = (body['events'] as List?) ?? const [];
    // Einzelne unbrauchbare Eintraege ueberspringen, statt den ganzen
    // Spieltag zu verlieren (siehe FootyMatch.tryFromJson).
    final matches = <FootyMatch>[];
    for (final e in events) {
      if (e is! Map) continue;
      final m = FootyMatch.tryFromJson(Map<String, dynamic>.from(e));
      if (m != null) matches.add(m);
    }
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

  /// Führt [aufgaben] in Wellen zu je [grenze] Stück aus.
  ///
  /// Vorher liefen die Runden-Abrufe eines Turniers streng nacheinander, mit
  /// 150 ms Pause dazwischen. Gemessen am PC: 11 Anfragen, zusammen 1,0 s
  /// Netzzeit – aber 2,7 s bis zur letzten Antwort, davon 1,7 s reine
  /// Wartepausen. Am Handy, wo eine Anfrage eher 400–600 ms braucht, wurden
  /// daraus über sieben Sekunden, bevor das erste Spiel sichtbar war.
  ///
  /// Die Gesamtzahl der Anfragen bleibt gleich, nur ihre zeitliche Verteilung
  /// ändert sich. Die Grenze ist bewusst klein: der Gratis-Key ist geteilt,
  /// und ein Schwall gleichzeitiger Anfragen provoziert eine Drosselung.
  static Future<List<T>> inWellen<T>(
    List<Future<T> Function()> aufgaben, {
    int grenze = 3,
  }) async {
    final out = <T>[];
    for (var i = 0; i < aufgaben.length; i += grenze) {
      final welle = aufgaben.skip(i).take(grenze).map((f) => f()).toList();
      out.addAll(await Future.wait(welle));
    }
    return out;
  }

  /// Welche Runde ist die **erste** K.o.-Runde?
  ///
  /// Früher galt „höchste Rundennummer". Das stimmt nur für die Konvention
  /// „Round of N" (32 = Sechzehntel, 16 = Achtel, 8 = Viertel, 4 = Halbfinale).
  /// TheSportsDB verwendet daneben 125/150/160/200 für Viertelfinale,
  /// Halbfinale, Spiel um Platz 3 und Finale – dort ist die höchste Nummer das
  /// **Finale**. Die Titelchancen wurden dann über ein einziges Spiel
  /// simuliert.
  ///
  /// Unabhängig von der Nummerierung gilt: die erste K.o.-Runde hat die
  /// meisten Spiele. Bei Gleichstand entscheidet die höhere Nummer, damit sich
  /// für die bisherige Konvention nichts ändert.
  static int? ersteKoRunde(Iterable<FootyMatch> ko) {
    if (ko.isEmpty) return null;
    final anzahl = <int, int>{};
    for (final m in ko) {
      anzahl[m.round] = (anzahl[m.round] ?? 0) + 1;
    }
    var besterCode = anzahl.keys.first;
    for (final e in anzahl.entries) {
      final best = anzahl[besterCode]!;
      if (e.value > best || (e.value == best && e.key > besterCode)) {
        besterCode = e.key;
      }
    }
    return besterCode;
  }

  /// Alle Spiele eines Turniers: probiert direkt alle möglichen Runden-Codes
  /// und nimmt jede Runde mit Spielen. Robust – ohne separate Erkennungsstufe.
  /// Welche Runden-Codes beim letzten [allCupMatches] Spiele geliefert haben.
  /// Der Aufrufer sichert das lokal, damit der nächste Start nur noch diese
  /// Codes abfragt statt alle möglichen.
  static List<int> zuletztGefundeneRunden = const [];

  static Future<List<FootyMatch>> allCupMatches(
      String leagueId, String season, List<int> candidates,
      {List<int> bekannteRunden = const []}) async {
    // Sind die tatsächlich vorhandenen Runden bekannt, nur diese laden. Bei der
    // WM sind von elf möglichen Codes meist nur drei bis vier belegt - der Rest
    // kostet bei jedem Start eine Anfrage und liefert nichts.
    final zuLaden = bekannteRunden.isNotEmpty
        ? candidates.where(bekannteRunden.contains).toList()
        : candidates;

    final ergebnisse =
        await inWellen<({int code, List<FootyMatch> spiele, bool ok})>(
      zuLaden
          .map((c) => () async {
                try {
                  return (
                    code: c,
                    spiele: await round(leagueId, season, c),
                    ok: true
                  );
                } catch (_) {
                  return (code: c, spiele: const <FootyMatch>[], ok: false);
                }
              })
          .toList(),
    );

    // Antwortete KEINE einzige Runde, ist das eine Störung und kein leeres
    // Turnier. Ohne diese Unterscheidung meldete allCupMatches einen "Erfolg"
    // mit leerer Liste; currentMatches hielt das für "keine Spiele" und konnte
    // eine gute Liste bei Drosselung durch eine leere ersetzen.
    if (zuLaden.isNotEmpty && !ergebnisse.any((e) => e.ok)) {
      throw Exception('Turnier: keine Antwort vom Server');
    }

    // Merken, welche Codes wirklich Spiele hatten – der Aufrufer sichert das.
    zuletztGefundeneRunden = [
      for (final e in ergebnisse)
        if (e.spiele.isNotEmpty) e.code
    ];

    final byId = <int, FootyMatch>{};
    for (final e in ergebnisse) {
      for (final m in e.spiele) {
        byId[m.id] = m;
      }
    }
    final list = byId.values.toList()
      ..sort((a, b) {
        final ka = a.kickoff, kb = b.kickoff;
        if (ka == null || kb == null) return 0;
        return ka.compareTo(kb);
      });

    // Runden-Namen setzen (z. B. "Achtelfinale"). Der Name der K.o.-Runde
    // hängt von der Zahl ihrer Spiele ab – deshalb erst hier, wo alle vorliegen.
    final proRunde = <int, int>{};
    for (final m in list) {
      proRunde[m.round] = (proRunde[m.round] ?? 0) + 1;
    }
    for (final m in list) {
      m.roundLabel = cupStageLabel(m.round, proRunde[m.round] ?? 0);
      m.neutralVenue = true; // Turnierspiele: kein Heimvorteil
    }
    return list;
  }
}
