// main.dart – KickProphet: echte Spiele tippen, Punkte sammeln (kein Echtgeld).
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'engine.dart';
import 'notify.dart';
import 'odds.dart';
import 'store.dart';
import 'update.dart';

void main() => runApp(const FootyApp());

const _green = Color(0xFF0B3D2E);
const _accent = Color(0xFF2BD47E);

class FootyApp extends StatelessWidget {
  const FootyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: _accent,
      brightness: Brightness.dark,
    ).copyWith(surface: _green);
    return MaterialApp(
      title: 'KickProphet',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: _green,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with WidgetsBindingObserver {
  final _store = PredictionStore();
  late final EloModel _elo = EloModel(_store.elo);
  SeasonLearner? _learner;

  int _leagueIdx = 0;
  late String _season;
  int _day = 1;                // Liga-Modus: Spieltag-Nummer
  List<CupStage> _stages = []; // Turnier-Modus: gefundene Runden
  int _stageIdx = 0;

  List<FootyMatch> _matches = [];
  bool _loading = true;
  bool _loadInFlight = false;
  DateTime? _lastAutoLoad;
  String? _error;
  DateTime? _updatedAt;
  String? _learnStatus; // z.B. "lernt … 60 %"
  Timer? _autoTimer;
  UpdateInfo? _update; // gesetzt, wenn eine neuere App-Version verfügbar ist

  // Tor-Erkennung: letzter bekannter Spielstand je Spiel (Tore gesamt).
  final Map<int, int> _prevScores = {};
  bool _scoreSnapshot = false;

  // _leagueIdx == -1 -> „Aktuell" (ligaübergreifend aktuelle/anstehende Spiele).
  bool get _currentMode => _leagueIdx < 0;
  League get _league => kLeagues[_leagueIdx < 0 ? 0 : _leagueIdx];
  bool get _isCup => !_currentMode && _league.isCup;
  int get _roundCode => _isCup ? (_stages.isEmpty ? 0 : _stages[_stageIdx].code) : _day;
  // Turniere zeigen alle Spiele auf einmal -> kein Blättern.
  bool get _canPrev => (_currentMode || _isCup) ? false : _day > 1;
  bool get _canNext => (_currentMode || _isCup) ? false : _day < _league.maxRound;

  String get _stageTitle {
    if (_currentMode) return 'Aktuelle Spiele';
    if (_isCup) return 'Alle Spiele';
    return '$_day. Spieltag';
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _season = Api.seasonFor(_league, DateTime.now());
    // Immer am neuesten Stand, aber ohne den geteilten Gratis-Key zu erschöpfen.
    _autoTimer = Timer.periodic(const Duration(seconds: 60), (_) => _autoRefresh());
    _boot();
    // Im Hintergrund auf eine neuere App-Version prüfen.
    checkForUpdate().then((u) {
      if (mounted && u != null) setState(() => _update = u);
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _autoTimer?.cancel();
    _learner?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Beim Zurückkehren in die App aktualisieren und neue Ergebnisse nachlernen.
    if (state == AppLifecycleState.resumed) {
      _loadDay(silent: true);
      _startLearning();
    }
  }

  Future<void> _boot() async {
    // Jeder Schritt einzeln abgesichert: _boot() wird aus initState gestartet,
    // eine Ausnahme hier käme nirgends an. Ohne diesen Schutz blieb bei
    // beschädigtem lokalem Speicher _loading dauerhaft true - Endlos-Ladekreis,
    // aus dem nur das Löschen der App-Daten herausführte.
    try {
      await _store.load();
    } catch (e) {
      debugPrint('Gespeicherte Daten unlesbar, starte mit leerem Stand: $e');
    }
    try {
      await Notifier.init();
      if (_store.remindersEnabled) await Notifier.requestPermission();
    } catch (e) {
      debugPrint('Benachrichtigungen nicht verfügbar: $e');
    }
    // Dort öffnen, wo der Nutzer zuletzt war.
    final saved = _store.lastLeagueIdx;
    if (saved >= -1 && saved < kLeagues.length) _leagueIdx = saved;
    _season = Api.seasonFor(_league, DateTime.now());
    try {
      await _selectLeague();
    } catch (e) {
      // Letzte Sicherung: der Ladekreis darf nie stehen bleiben. _loadDay
      // fängt eigene Fehler ab, aber alles davor (z. B. Rundenermittlung)
      // käme sonst ungebremst hier heraus.
      if (mounted) setState(() { _loading = false; _error = _msg(e); });
    }
  }

  /// Plant eine Benachrichtigung ~90 Min vor dem ersten anstehenden Spiel.
  void _scheduleReminders(List<FootyMatch> matches) {
    if (_currentMode || !_store.remindersEnabled) return;
    final now = DateTime.now();
    final upcoming = matches
        .where((x) => x.kickoff != null && x.kickoff!.isAfter(now))
        .toList();
    final id = ((_league.id.hashCode ^ (_isCup ? _roundCode : _day)) & 0x7fffffff) % 100000;
    if (upcoming.isEmpty) {
      Notifier.cancel(id);
      return;
    }
    upcoming.sort((a, b) => a.kickoff!.compareTo(b.kickoff!));
    final when = upcoming.first.kickoff!.subtract(const Duration(minutes: 90));
    Notifier.schedule(
      id: id,
      whenLocal: when,
      title: '⚽ ${_league.name}: bald geht\'s los',
      body: '$_stageTitle – ${upcoming.length} Spiele anstehend. Prognosen ansehen!',
    );
  }

  Future<void> _toggleReminders() async {
    final on = !_store.remindersEnabled;
    await _store.setRemindersEnabled(on);
    if (on) {
      await Notifier.requestPermission();
      _scheduleReminders(_matches);
    } else {
      await Notifier.cancelAll();
    }
    if (!mounted) return;
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      backgroundColor: const Color(0xFF114E3B),
      content: Text(on ? '🔔 Erinnerungen aktiviert' : 'Erinnerungen ausgeschaltet'),
      duration: const Duration(seconds: 2),
    ));
  }

  /// Liga/Turnier vorbereiten: Saison setzen, Startrunde bestimmen, laden, lernen.
  Future<void> _selectLeague() async {
    setState(() { _loading = true; _error = null; _stages = []; _matches = []; });
    if (_currentMode) {
      await _loadDay();
      return;
    }
    _season = Api.seasonFor(_league, DateTime.now());
    if (!_isCup) {
      _day = await _resolveStartRound(_league);
    }
    await _loadDay();
    _startLearning();
  }

  /// Aktuellen Spieltag bestimmen: laufende Saison -> nächster Spieltag,
  /// sonst der zuletzt betrachtete.
  Future<int> _resolveStartRound(League league) async {
    final next = await Api.nextRound(league.id);
    if (next != null) return next.clamp(1, league.maxRound);
    return _store.lastRound(league.id).clamp(1, league.maxRound);
  }

  Future<List<FootyMatch>> _fetchMatches() {
    if (_currentMode) return Api.currentMatches(kLeagues, DateTime.now());
    if (_isCup) return Api.allCupMatches(_league.id, _season, _league.cupCandidates);
    return Api.round(_league.id, _season, _day);
  }

  /// Mindestabstand zwischen zwei automatischen Aktualisierungen.
  ///
  /// In der Einzel-Liga-Ansicht kostet ein Durchlauf ein bis zwei Anfragen -
  /// 60 s sind dort unproblematisch. Die Ansicht „Aktuell" fächert dagegen
  /// über alle zehn Ligen aus und kam so auf rund 26 Anfragen pro Minute;
  /// daher dort deutlich seltener.
  Duration get _autoAbstand =>
      _currentMode ? const Duration(minutes: 5) : const Duration(seconds: 60);

  void _autoRefresh() {
    // Läuft noch ein Abruf, keinen zweiten daraufsetzen: ein voller Durchlauf
    // über alle Ligen dauert leicht länger als das Timer-Intervall.
    if (_loadInFlight) return;
    final last = _lastAutoLoad;
    if (last != null && DateTime.now().difference(last) < _autoAbstand) return;
    _lastAutoLoad = DateTime.now();
    _loadDay(silent: true);
  }

  Future<void> _loadDay({bool silent = false}) async {
    if (!silent) setState(() { _loading = true; _error = null; });
    _loadInFlight = true;
    try {
      var m = await _fetchMatches();
      // Leerer Erstabruf ist meist nur Drosselung -> einmal nachfassen.
      if (m.isEmpty && !silent) {
        await Future.delayed(const Duration(milliseconds: 1200));
        m = await _fetchMatches();
      }
      if (!_currentMode && !_isCup) await _store.setLastRound(_league.id, _day);
      // In den Einzel-Liga-Ansichten den Liga-Namen an jede Partie hängen
      // (in „Aktuell" setzt die API-Schicht ihn bereits pro Liga).
      if (!_currentMode) {
        for (final x in m) {
          x.competition = _league.label;
        }
      }
      // Frische Ergebnisse sofort ins Quoten-Modell einarbeiten.
      var learned = false;
      for (final x in m) {
        if (ingestMatch(_store, _elo, x, neutral: _isCup)) learned = true;
      }
      if (learned) await _store.saveLearning();
      if (!mounted) return;
      // Leeres Ergebnis (meist kurze Drosselung) darf eine bestehende Liste
      // nicht löschen – nur den Zeitstempel aktualisieren.
      if (m.isEmpty && _matches.isNotEmpty) {
        setState(() { _loading = false; _updatedAt = DateTime.now(); });
        return;
      }
      final goals = _detectGoals(m);
      setState(() { _matches = m; _loading = false; _updatedAt = DateTime.now(); });
      _scheduleReminders(m);
      for (final g in goals) {
        _goalAlert(g);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() { if (!silent) _error = _msg(e); _loading = false; });
    } finally {
      _loadInFlight = false;
    }
  }

  /// Vergleicht die neuen Spielstände mit dem letzten Stand und meldet Tore.
  List<String> _detectGoals(List<FootyMatch> m) {
    final msgs = <String>[];
    for (final x in m) {
      if (!x.hasResult) continue;
      final total = x.homeGoals! + x.awayGoals!;
      final prev = _prevScores[x.id];
      if (_scoreSnapshot && prev != null && total > prev) {
        msgs.add('⚽ TOR! ${x.home.shortName} ${x.homeGoals}:${x.awayGoals} ${x.away.shortName}');
      }
      _prevScores[x.id] = total;
    }
    _scoreSnapshot = true;
    return msgs;
  }

  void _goalAlert(String msg) {
    HapticFeedback.mediumImpact();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      backgroundColor: _accent,
      duration: const Duration(seconds: 5),
      content: Text(msg,
          style: const TextStyle(color: _green, fontWeight: FontWeight.w800, fontSize: 15)),
    ));
  }

  /// Hintergrund-Lernen: Vorsaison/Turnier-Runden einspeisen, Quoten verfeinern.
  /// Wird auch beim Zurückkehren in die App erneut angestoßen, damit neue
  /// Ergebnisse nachgelernt werden – die App wird so immer besser.
  void _startLearning() {
    if (_currentMode) return; // im Aktuell-Modus kein Liga-spezifisches Lernen
    _learner?.cancel();
    final learner = SeasonLearner(_store, _elo);
    _learner = learner;
    void onProgress(int done, int total) {
      if (!mounted || _learner != learner) return;
      final pct = total == 0 ? 100 : ((done / total) * 100).round();
      setState(() => _learnStatus = done >= total ? null : 'lernt … $pct %');
    }
    final fut = _isCup
        ? learner.learnCup(_league, _season, _league.cupCandidates,
            onProgress: onProgress)
        : learner.learnHistory(_league, _season, onProgress: onProgress);
    fut.then((_) {
      if (mounted && _learner == learner) setState(() => _learnStatus = null);
    });
  }

  String _msg(Object e) =>
      'Spiele konnten nicht geladen werden.\nInternetverbindung prüfen und erneut ziehen.\n($e)';

  void _changeDay(int delta) {
    if (delta < 0 ? !_canPrev : !_canNext) return;
    setState(() {
      _matches = [];
      if (_isCup) {
        _stageIdx = (_stageIdx + delta).clamp(0, _stages.length - 1);
      } else {
        _day = (_day + delta).clamp(1, _league.maxRound);
      }
    });
    _loadDay();
  }

  void _changeLeague(int? idx) {
    if (idx == null || idx == _leagueIdx) return;
    setState(() {
      _leagueIdx = idx;
      _loading = true;
      _matches = [];
    });
    _store.setLastLeagueIdx(idx);
    _selectLeague();
  }

  void _openStats() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0D4634),
      showDragHandle: true,
      builder: (c) => _StatsSheet(store: _store),
    );
  }

  /// „Wer gewinnt die WM?" – Titelchancen aus tausenden Simulationen.
  void _openWinnerOdds() {
    // K.o.-Spiele (Runden ≥ 4; Gruppen sind 1–3); erste K.o.-Runde = meiste Teams.
    final ko = _matches.where((m) => m.round >= 4).toList();
    if (ko.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        backgroundColor: Color(0xFF114E3B),
        content: Text('Titelchancen gibt es ab dem Achtelfinale.'),
      ));
      return;
    }
    final firstNo = ko.map((m) => m.round).reduce((a, b) => a > b ? a : b);
    final games = ko.where((m) => m.round == firstNo).map((m) {
      String? w;
      if (m.finished && m.hasResult && m.homeGoals != m.awayGoals) {
        w = m.homeGoals! > m.awayGoals! ? m.home.name : m.away.name;
      }
      return KoGame(m.home.name, m.away.name, w);
    }).toList();

    final chances = titleChances(games, _elo)
        .entries
        .toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0D4634),
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.92,
        builder: (c, ctrl) => ListView(
          controller: ctrl,
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
          children: [
            const Text('🏆 Wer gewinnt die WM?',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
            const SizedBox(height: 4),
            Text('Aus ${(12000).toString()} Simulationen ab dem ${_koLabel(firstNo)}',
                style: const TextStyle(color: Colors.white54, fontSize: 12)),
            const SizedBox(height: 14),
            for (final e in chances)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  Expanded(
                    child: Text(e.key,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  ),
                  SizedBox(
                    width: 140,
                    child: Stack(alignment: Alignment.centerLeft, children: [
                      Container(height: 18, decoration: BoxDecoration(
                        color: const Color(0xFF0B3D2E), borderRadius: BorderRadius.circular(6))),
                      FractionallySizedBox(
                        widthFactor: e.value.clamp(0.02, 1.0),
                        child: Container(height: 18, decoration: BoxDecoration(
                          color: _accent.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(6))),
                      ),
                    ]),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 46,
                    child: Text('${(e.value * 100).toStringAsFixed(e.value >= 0.1 ? 0 : 1)} %',
                        textAlign: TextAlign.right,
                        style: const TextStyle(color: _accent, fontWeight: FontWeight.w800)),
                  ),
                ]),
              ),
            const SizedBox(height: 10),
            const Text(
              'Schätzung des lernenden Modells. Nach der ersten K.o.-Runde wird die '
              'Auslosung zufällig angenommen (der genaue Turnierbaum liegt nicht vor).',
              style: TextStyle(color: Colors.white38, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  String _koLabel(int round) {
    switch (round) {
      case 32: return 'Sechzehntelfinale';
      case 16: return 'Achtelfinale';
      case 8: return 'Viertelfinale';
      case 4: return 'Halbfinale';
      default: return 'K.o.';
    }
  }

  /// WM-Baum: K.o.-Runden als scrollbare Spalten mit Favoriten-Markierung.
  void _openBracket() {
    final ko = _matches.where((m) => m.round > 3).toList();
    if (ko.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        backgroundColor: Color(0xFF114E3B),
        content: Text('Der Turnierbaum erscheint ab dem Achtelfinale.'),
      ));
      return;
    }
    final byRound = <int, List<FootyMatch>>{};
    for (final m in ko) {
      byRound.putIfAbsent(m.round, () => []).add(m);
    }
    // Runden von vielen Spielen (früh) zu wenigen (Finale) ordnen.
    final rounds = byRound.keys.toList()
      ..sort((a, b) => byRound[b]!.length.compareTo(byRound[a]!.length));
    for (final r in rounds) {
      byRound[r]!.sort((a, b) {
        final ka = a.kickoff, kb = b.kickoff;
        if (ka == null || kb == null) return 0;
        return ka.compareTo(kb);
      });
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0D4634),
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        builder: (c, ctrl) => Column(
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(18, 0, 18, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('🗂️ WM-Baum',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SingleChildScrollView(
                  controller: ctrl,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final r in rounds) _bracketColumn(r, byRound[r]!),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bracketColumn(int round, List<FootyMatch> games) {
    final label = _bracketRoundLabel(round, games.length);
    return Container(
      width: 178,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8, left: 4),
            child: Text(label,
                style: const TextStyle(color: _accent, fontWeight: FontWeight.w800, fontSize: 13)),
          ),
          for (final m in games) _bracketGame(m),
        ],
      ),
    );
  }

  Widget _bracketGame(FootyMatch m) {
    final p = _elo.probs(m.home.name, m.away.name, neutral: true);
    final finished = m.finished && m.hasResult;
    // Sieger/Favorit bestimmen.
    bool homeTop;
    if (finished && m.homeGoals != m.awayGoals) {
      homeTop = m.homeGoals! > m.awayGoals!;
    } else {
      homeTop = p.home >= p.away;
    }

    Widget side(Team t, bool top, int? goals) {
      return Row(children: [
        Expanded(
          child: Text(t.shortName,
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: top ? _accent : Colors.white70,
                fontWeight: top ? FontWeight.w800 : FontWeight.w500,
                fontSize: 12.5,
              )),
        ),
        if (goals != null)
          Text('$goals',
              style: TextStyle(
                color: top ? _accent : Colors.white54, fontWeight: FontWeight.w700, fontSize: 12.5)),
      ]);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF114E3B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF1C6A50)),
      ),
      child: Column(children: [
        side(m.home, homeTop, finished ? m.homeGoals : null),
        const Divider(height: 10, color: Color(0xFF1C6A50)),
        side(m.away, !homeTop, finished ? m.awayGoals : null),
        const SizedBox(height: 2),
        Align(
          alignment: Alignment.centerRight,
          child: Text(finished ? 'Ergebnis' : 'Prognose',
              style: const TextStyle(color: Colors.white30, fontSize: 9)),
        ),
      ]),
    );
  }

  String _bracketRoundLabel(int round, int count) {
    if (round == 160) return 'Spiel um Platz 3';
    if (round == 200) return 'Finale';
    switch (count) {
      case 16: return 'Sechzehntelfinale';
      case 8: return 'Achtelfinale';
      case 4: return 'Viertelfinale';
      case 2: return 'Halbfinale';
      case 1: return 'Finale';
      default: return 'K.o.';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D4634),
        title: const Text('🔮 KickProphet'),
        actions: [
          if (_isCup)
            IconButton(
              tooltip: 'WM-Baum',
              onPressed: _openBracket,
              icon: const Icon(Icons.account_tree_rounded),
            ),
          if (_isCup)
            IconButton(
              tooltip: 'Wer gewinnt die WM?',
              onPressed: _openWinnerOdds,
              icon: const Icon(Icons.emoji_events_rounded),
            ),
          IconButton(
            tooltip: 'Trefferquote',
            onPressed: _openStats,
            icon: const Icon(Icons.insights_rounded),
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'reminders') _toggleReminders();
            },
            itemBuilder: (c) => [
              PopupMenuItem(
                value: 'reminders',
                child: Text(_store.remindersEnabled
                    ? 'Benachrichtigungen: an ✓'
                    : 'Benachrichtigungen: aus'),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (_update != null) _updateBanner(_update!),
          _controls(),
          const _PlayMoneyBanner(),
          _statusBar(),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _updateBanner(UpdateInfo u) {
    return Material(
      color: _accent,
      child: InkWell(
        onTap: () => _downloadUpdate(u),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
          child: Row(
            children: [
              const Icon(Icons.system_update, color: _green, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Update verfügbar: v${u.versionName}',
                        style: const TextStyle(color: _green, fontWeight: FontWeight.w800, fontSize: 13)),
                    if (u.notes.isNotEmpty)
                      Text(u.notes,
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: _green, fontSize: 11)),
                  ],
                ),
              ),
              TextButton(
                onPressed: () => _downloadUpdate(u),
                style: TextButton.styleFrom(
                  backgroundColor: _green,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                ),
                child: const Text('Laden', style: TextStyle(color: _accent, fontWeight: FontWeight.w800)),
              ),
              IconButton(
                onPressed: () => setState(() => _update = null),
                icon: const Icon(Icons.close, color: _green, size: 18),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _downloadUpdate(UpdateInfo u) async {
    final uri = Uri.tryParse(u.url);
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Konnte den Download nicht öffnen.'),
      ));
    }
  }

  Widget _statusBar() {
    String left;
    if (_learnStatus != null) {
      left = '🧠 $_learnStatus';
    } else {
      final acc = _store.modelTotal == 0
          ? ''
          : ' · Modell ${(_store.modelHits / _store.modelTotal * 100).round()} %';
      left = '${_store.teamsLearned} Teams gelernt$acc';
    }
    final u = _updatedAt;
    final right = u == null
        ? ''
        : 'aktualisiert ${u.hour.toString().padLeft(2, '0')}:${u.minute.toString().padLeft(2, '0')}';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
      color: const Color(0xFF0D4634),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(children: [
            if (_learnStatus != null)
              const Padding(
                padding: EdgeInsets.only(right: 6),
                child: SizedBox(
                  width: 10, height: 10,
                  child: CircularProgressIndicator(strokeWidth: 1.6, color: _accent),
                ),
              ),
            Text(left, style: const TextStyle(color: Colors.white60, fontSize: 11)),
          ]),
          Text(right, style: const TextStyle(color: Colors.white38, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _controls() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      color: const Color(0xFF0D4634),
      child: Row(
        children: [
          Flexible(
            child: DropdownButton<int>(
              value: _leagueIdx,
              isExpanded: true,
              dropdownColor: const Color(0xFF114E3B),
              underline: const SizedBox.shrink(),
              iconEnabledColor: _accent,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
              items: [
                const DropdownMenuItem(value: -1, child: Text('🔴 Aktuell', overflow: TextOverflow.ellipsis)),
                for (var i = 0; i < kLeagues.length; i++)
                  DropdownMenuItem(value: i, child: Text(kLeagues[i].label, overflow: TextOverflow.ellipsis)),
              ],
              onChanged: _changeLeague,
            ),
          ),
          IconButton(
            onPressed: _canPrev ? () => _changeDay(-1) : null,
            icon: const Icon(Icons.chevron_left),
            color: _accent,
            visualDensity: VisualDensity.compact,
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 96),
            child: Text(_stageTitle,
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          ),
          IconButton(
            onPressed: _canNext ? () => _changeDay(1) : null,
            icon: const Icon(Icons.chevron_right),
            color: _accent,
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: _accent));
    }
    if (_error != null) {
      return RefreshIndicator(
        color: _accent,
        onRefresh: _loadDay,
        child: ListView(children: [
          const SizedBox(height: 120),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text(_error!, textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70)),
          ),
          Center(child: FilledButton(onPressed: _loadDay, child: const Text('Erneut versuchen'))),
        ]),
      );
    }
    if (_matches.isEmpty) {
      return RefreshIndicator(
        color: _accent,
        onRefresh: _loadDay,
        child: ListView(children: [
          const SizedBox(height: 140),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 30),
              child: Text(
                _currentMode
                    ? 'Gerade keine aktuellen Spiele.\nWähle oben eine Liga (z. B. 🏆 WM 2026).'
                    : 'Keine Spiele für diesen Zeitraum.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70),
              ),
            ),
          ),
        ]),
      );
    }
    final now = DateTime.now();
    return RefreshIndicator(
      color: _accent,
      onRefresh: _loadDay,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
        itemCount: _matches.length,
        itemBuilder: (c, i) => _MatchCard(
          match: _matches[i],
          now: now,
          probs: _elo.probs(_matches[i].home.name, _matches[i].away.name, neutral: _isCup),
        ),
      ),
    );
  }
}

class _PlayMoneyBanner extends StatelessWidget {
  const _PlayMoneyBanner();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: _accent,
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: const Text(
        'Prognosen aus echten Spielen · keine Wetten, kein Echtgeld',
        textAlign: TextAlign.center,
        style: TextStyle(color: _green, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _MatchCard extends StatelessWidget {
  final FootyMatch match;
  final DateTime now;
  final MatchProbs probs;

  const _MatchCard({
    required this.match,
    required this.now,
    required this.probs,
  });

  bool get locked => match.startedBy(now);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF114E3B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF1C6A50)),
      ),
      child: Column(
        children: [
          _topRow(),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _Crest(team: match.home, alignEnd: false)),
              _center(),
              Expanded(child: _Crest(team: match.away, alignEnd: true)),
            ],
          ),
          const SizedBox(height: 10),
          _predictionBanner(),
          const SizedBox(height: 10),
          _probRow(),
        ],
      ),
    );
  }

  /// Mitte der Karte: Endstand (beendet) oder „vs" (anstehend).
  Widget _center() {
    if (match.finished && match.hasResult) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('${match.homeGoals}:${match.awayGoals}',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const Text('Endstand', style: TextStyle(color: Colors.white38, fontSize: 10)),
        ]),
      );
    }
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 14),
      child: Text('vs',
          style: TextStyle(color: Colors.white38, fontWeight: FontWeight.w700, fontSize: 13)),
    );
  }

  /// Vorhergesagter Ausgang (0 = Heim, 1 = Remis, 2 = Gast).
  /// Die Regel liegt in odds.dart, damit Anzeige und Trefferquoten-Statistik
  /// zwingend dieselbe Prognose verwenden.
  int _predictedIdx() {
    switch (predictedTendency(probs)) {
      case Tendency.home:
        return 0;
      case Tendency.draw:
        return 1;
      case Tendency.away:
        return 2;
    }
  }

  /// Klare Ansage: wer gewinnt – plus Sicherheit in %.
  Widget _predictionBanner() {
    final values = [probs.home, probs.draw, probs.away];
    final idx = _predictedIdx();
    final who = idx == 0
        ? '${match.home.shortName} gewinnt'
        : idx == 2
            ? '${match.away.shortName} gewinnt'
            : 'Unentschieden';
    final conf = (values[idx] * 100).round();
    // Einordnung nach echter Treffsicherheit (75%+ ≈ 3 von 4 richtig).
    final qualifier = idx == 1
        ? 'ausgeglichen'
        : conf >= 75
            ? '🔒 sehr sicher'
            : conf >= 65
                ? '⭐ ziemlich sicher'
                : conf >= 50
                    ? 'leichter Favorit'
                    : 'offenes Spiel';
    final sure = idx != 1 && conf >= 65;

    Widget trailing = Text('$conf %',
        style: const TextStyle(color: _accent, fontWeight: FontWeight.w800, fontSize: 16));
    if (match.finished && match.hasResult) {
      final actual = tendencyOf(match.homeGoals!, match.awayGoals!);
      final predicted =
          idx == 0 ? Tendency.home : (idx == 2 ? Tendency.away : Tendency.draw);
      final hit = predicted == actual;
      trailing = Text(hit ? '✓ getroffen' : '✗ daneben',
          style: TextStyle(
            color: hit ? _accent : const Color(0xFFFF6B6B),
            fontWeight: FontWeight.w800, fontSize: 12,
          ));
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: _accent.withValues(alpha: sure ? 0.24 : 0.14),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: _accent.withValues(alpha: sure ? 0.95 : 0.5),
          width: sure ? 1.6 : 1,
        ),
      ),
      child: Row(
        children: [
          Text(sure ? '🎯' : '🔮', style: const TextStyle(fontSize: 20)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(who,
                    style: const TextStyle(
                        color: _accent, fontWeight: FontWeight.w800, fontSize: 18)),
                Text('Prognose · $qualifier',
                    style: const TextStyle(color: Colors.white54, fontSize: 11)),
              ],
            ),
          ),
          trailing,
        ],
      ),
    );
  }

  /// Die drei Wahrscheinlichkeiten (Sieg / Remis / Sieg) in Prozent.
  Widget _probRow() {
    final pick = _predictedIdx(); // hervorgehobener Ausgang (X bei Gleichstand)
    Widget cell(String label, double p, int i) {
      final top = i == pick;
      return Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3),
          padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 4),
          decoration: BoxDecoration(
            color: top ? _accent.withValues(alpha: 0.16) : const Color(0xFF0B3D2E),
            borderRadius: BorderRadius.circular(9),
            border: Border.all(color: top ? _accent : const Color(0xFF1C6A50)),
          ),
          child: Column(
            children: [
              Text(label,
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white54, fontSize: 11)),
              const SizedBox(height: 2),
              Text('${(p * 100).round()} %',
                  style: TextStyle(
                    color: top ? _accent : Colors.white,
                    fontWeight: FontWeight.w800, fontSize: 15,
                  )),
            ],
          ),
        ),
      );
    }

    return Row(children: [
      cell(match.home.shortName, probs.home, 0),
      cell('Unentschieden', probs.draw, 1),
      cell(match.away.shortName, probs.away, 2),
    ]);
  }

  Widget _topRow() {
    String status;
    Color col = Colors.white54;
    if (match.finished) {
      status = 'Beendet';
    } else if (locked) {
      status = 'Läuft / angepfiffen';
      col = Colors.orangeAccent;
    } else if (match.kickoff != null) {
      status = _fmtDate(match.kickoff!);
    } else {
      status = 'Termin offen';
    }
    final league = match.competition;
    final spieltag = (match.round >= 1 && match.round < 100) ? '${match.round}. Spieltag' : '';
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Row(
            children: [
              if (league != null && league.isNotEmpty)
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: _accent.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      league,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: _accent, fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              if (spieltag.isNotEmpty) ...[
                const SizedBox(width: 6),
                Text(spieltag,
                    style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ],
            ],
          ),
        ),
        const SizedBox(width: 6),
        Text(status,
            style: TextStyle(color: col, fontSize: 11, fontWeight: FontWeight.w600)),
      ],
    );
  }

  String _fmtDate(DateTime d) {
    const wd = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    String two(int n) => n < 10 ? '0$n' : '$n';
    return '${wd[d.weekday - 1]} ${two(d.day)}.${two(d.month)}. ${two(d.hour)}:${two(d.minute)}';
  }
}

class _Crest extends StatelessWidget {
  final Team team;
  final bool alignEnd;
  const _Crest({required this.team, required this.alignEnd});

  @override
  Widget build(BuildContext context) {
    final logo = _logo();
    final name = Flexible(
      child: Text(
        team.shortName,
        textAlign: alignEnd ? TextAlign.right : TextAlign.left,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
      ),
    );
    final children = alignEnd ? [name, const SizedBox(width: 8), logo]
                              : [logo, const SizedBox(width: 8), name];
    return Row(
      mainAxisAlignment: alignEnd ? MainAxisAlignment.end : MainAxisAlignment.start,
      children: children,
    );
  }

  Widget _logo() {
    final url = team.badge;
    final fallback = CircleAvatar(
      radius: 16,
      backgroundColor: const Color(0xFF0B3D2E),
      child: Text(team.initials,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: _accent)),
    );
    if (url == null) return fallback;
    return ClipOval(
      child: Image.network(
        url, width: 32, height: 32, fit: BoxFit.contain,
        errorBuilder: (c, e, s) => fallback,
        loadingBuilder: (c, child, p) => p == null ? child : fallback,
      ),
    );
  }
}

class _StatsSheet extends StatelessWidget {
  final PredictionStore store;
  const _StatsSheet({required this.store});

  @override
  Widget build(BuildContext context) {
    final modelPct =
        store.modelTotal == 0 ? null : (store.modelHits / store.modelTotal * 100).round();

    // Stärkste Teams laut Modell (gelernte Ratings).
    final ranking = store.elo.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final top = ranking.take(10).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 26),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Trefferquote',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
          const SizedBox(height: 14),
          Row(children: [
            _stat(modelPct == null ? '–' : '$modelPct %', 'Prognosen richtig'),
            _stat('${store.modelTotal}', 'Spiele ausgewertet'),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            _stat('${store.teamsLearned}', 'Teams gelernt'),
            _stat('${store.modelHits}', 'Treffer'),
          ]),
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _accent.withValues(alpha: 0.4)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: const [
                Icon(Icons.psychology_alt_rounded, color: _accent, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text('So liest du die Prognose',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
              ]),
              const SizedBox(height: 6),
              const Text(
                'Je höher die Sicherheit, desto öfter stimmt die Prognose: bei "75 %+" '
                'liegt das Modell rund 3 von 4 Mal richtig. Es lernt aus jedem echten '
                'Ergebnis weiter dazu. Garantien gibt es im Fußball aber nie. 😉',
                style: TextStyle(color: Colors.white60, fontSize: 12),
              ),
            ]),
          ),
          if (top.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text('Stärkste Teams (laut Modell)',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
            const SizedBox(height: 10),
            for (var i = 0; i < top.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  SizedBox(
                    width: 26,
                    child: Text('${i + 1}.',
                        style: const TextStyle(color: Colors.white38, fontWeight: FontWeight.w700)),
                  ),
                  Expanded(
                    child: Text(top[i].key,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  ),
                  Text('${top[i].value.round()}',
                      style: const TextStyle(color: _accent, fontWeight: FontWeight.w800)),
                ]),
              ),
          ],
        ],
      ),
    );
  }

  Widget _stat(String value, String label) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFF114E3B),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF1C6A50)),
        ),
        child: Column(children: [
          Text(value,
              style: const TextStyle(
                  color: _accent, fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white60, fontSize: 11)),
        ]),
      ),
    );
  }
}
