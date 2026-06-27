// main.dart – KickProphet: echte Spiele tippen, Punkte sammeln (kein Echtgeld).
import 'dart:async';
import 'package:flutter/material.dart';
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
  String? _error;
  DateTime? _updatedAt;
  String? _learnStatus; // z.B. "lernt … 60 %"
  Timer? _autoTimer;
  UpdateInfo? _update; // gesetzt, wenn eine neuere App-Version verfügbar ist

  // _leagueIdx == -1 -> „Aktuell" (ligaübergreifend aktuelle/anstehende Spiele).
  bool get _currentMode => _leagueIdx < 0;
  League get _league => kLeagues[_leagueIdx < 0 ? 0 : _leagueIdx];
  bool get _isCup => !_currentMode && _league.isCup;
  int get _roundCode => _isCup ? (_stages.isEmpty ? 0 : _stages[_stageIdx].code) : _day;
  bool get _canPrev => _currentMode ? false : (_isCup ? _stageIdx > 0 : _day > 1);
  bool get _canNext =>
      _currentMode ? false : (_isCup ? _stageIdx < _stages.length - 1 : _day < _league.maxRound);

  String get _stageTitle {
    if (_currentMode) return 'Aktuelle Spiele';
    if (_isCup) {
      if (_stages.isEmpty) return '—';
      final s = _stages[_stageIdx];
      return cupStageLabel(s.code, s.count);
    }
    return '$_day. Spieltag';
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _season = Api.seasonFor(_league, DateTime.now());
    // Immer am neuesten Stand: alle 60 s im Vordergrund stillschweigend aktualisieren.
    _autoTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      _loadDay(silent: true);
    });
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
    await _store.load();
    await Notifier.init();
    if (_store.remindersEnabled) await Notifier.requestPermission();
    await _selectLeague();
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
    setState(() { _loading = true; _error = null; _stages = []; });
    if (_currentMode) {
      await _loadDay();
      return;
    }
    _season = Api.seasonFor(_league, DateTime.now());
    if (_isCup) {
      try {
        _stages = await Api.discoverCupRounds(_league.id, _season, _league.cupCandidates);
      } catch (_) {
        _stages = [];
      }
      _stageIdx = _stages.isEmpty ? 0 : _stages.length - 1; // jüngste Runde zuerst
    } else {
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

  Future<void> _loadDay({bool silent = false}) async {
    if (!silent) setState(() { _loading = true; _error = null; });
    final code = _roundCode;
    if (_isCup && code == 0) {
      setState(() { _matches = []; _loading = false; });
      return;
    }
    try {
      final m = _currentMode
          ? await Api.currentMatches(kLeagues, DateTime.now())
          : await Api.round(_league.id, _season, code);
      if (!_currentMode && !_isCup) await _store.setLastRound(_league.id, _day);
      // Frische Ergebnisse sofort ins Quoten-Modell einarbeiten.
      var learned = false;
      for (final x in m) {
        if (ingestMatch(_store, _elo, x, neutral: _isCup)) learned = true;
      }
      if (learned) await _store.saveLearning();
      if (!mounted) return;
      setState(() { _matches = m; _loading = false; _updatedAt = DateTime.now(); });
      _scheduleReminders(m);
    } catch (e) {
      if (!mounted) return;
      setState(() { if (!silent) _error = _msg(e); _loading = false; });
    }
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
        ? learner.learnCup(_league, _season, _stages.map((s) => s.code).toList(),
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
    });
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D4634),
        title: const Text('🔮 KickProphet'),
        actions: [
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
        child: ListView(children: const [
          SizedBox(height: 160),
          Center(child: Text('Keine Spiele für diesen Spieltag.',
              style: TextStyle(color: Colors.white70))),
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

  /// Klare Ansage: wer gewinnt – plus Sicherheit in %.
  Widget _predictionBanner() {
    final values = [probs.home, probs.draw, probs.away];
    final maxp = values.reduce((a, b) => a > b ? a : b);
    final idx = values.indexOf(maxp); // 0 = Heim, 1 = Remis, 2 = Gast
    final who = idx == 0
        ? '${match.home.shortName} gewinnt'
        : idx == 2
            ? '${match.away.shortName} gewinnt'
            : 'Unentschieden';
    final conf = (maxp * 100).round();
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
          Text(sure ? '🎯' : '🔮', style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(who,
                    style: const TextStyle(
                        color: _accent, fontWeight: FontWeight.w800, fontSize: 15)),
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
    final highest = [probs.home, probs.draw, probs.away].reduce((a, b) => a > b ? a : b);
    Widget cell(String label, double p) {
      final top = p == highest;
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
      cell(match.home.shortName, probs.home),
      cell('Remis', probs.draw),
      cell(match.away.shortName, probs.away),
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
    final left = (match.round >= 1 && match.round < 100) ? '${match.round}. Spieltag' : '';
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(left, style: const TextStyle(color: Colors.white38, fontSize: 11)),
        Text(status, style: TextStyle(color: col, fontSize: 11, fontWeight: FontWeight.w600)),
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

    return Padding(
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
