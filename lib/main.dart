// main.dart – Footy Predict: echte Spiele tippen, Punkte sammeln (kein Echtgeld).
import 'dart:async';
import 'package:flutter/material.dart';

import 'api.dart';
import 'engine.dart';
import 'odds.dart';
import 'store.dart';

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
  int _day = 1;

  List<FootyMatch> _matches = [];
  bool _loading = true;
  String? _error;
  DateTime? _updatedAt;
  String? _learnStatus; // z.B. "lernt … 60 %"
  Timer? _autoTimer;

  League get _league => kLeagues[_leagueIdx];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _season = Api.currentSeason(DateTime.now());
    // Immer am neuesten Stand: alle 60 s im Vordergrund stillschweigend aktualisieren.
    _autoTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      _loadDay(silent: true);
    });
    _boot();
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
    // Beim Zurückkehren in die App sofort aktualisieren.
    if (state == AppLifecycleState.resumed) _loadDay(silent: true);
  }

  Future<void> _boot() async {
    await _store.load();
    _day = await _resolveStartRound(_league);
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
    try {
      final m = await Api.round(_league.id, _season, _day);
      await _store.setLastRound(_league.id, _day);
      // Frische Ergebnisse sofort ins Quoten-Modell einarbeiten.
      var learned = false;
      for (final x in m) {
        if (ingestMatch(_store, _elo, x)) learned = true;
      }
      if (learned) await _store.saveLearning();
      if (!mounted) return;
      setState(() { _matches = m; _loading = false; _updatedAt = DateTime.now(); });
    } catch (e) {
      if (!mounted) return;
      setState(() { if (!silent) _error = _msg(e); _loading = false; });
    }
  }

  /// Hintergrund-Lernen: vergangene Spieltage einspeisen, Quoten verfeinern.
  void _startLearning() {
    _learner?.cancel();
    final learner = SeasonLearner(_store, _elo);
    _learner = learner;
    learner.learnUpTo(
      _league, _season, _league.maxRound,
      onProgress: (done, total) {
        if (!mounted || _learner != learner) return;
        final pct = ((done / total) * 100).round();
        setState(() => _learnStatus = done >= total ? null : 'lernt … $pct %');
      },
    ).then((_) {
      if (mounted && _learner == learner) setState(() => _learnStatus = null);
    });
  }

  String _msg(Object e) =>
      'Spiele konnten nicht geladen werden.\nInternetverbindung prüfen und erneut ziehen.\n($e)';

  void _changeDay(int delta) {
    final next = (_day + delta).clamp(1, _league.maxRound);
    if (next == _day) return;
    setState(() => _day = next);
    _loadDay();
  }

  void _changeLeague(int? idx) {
    if (idx == null || idx == _leagueIdx) return;
    setState(() {
      _leagueIdx = idx;
      _loading = true;
    });
    () async {
      _day = await _resolveStartRound(_league);
      await _loadDay();
      _startLearning();
    }();
  }

  // ----- Punkte -----
  int get _totalPoints {
    var sum = 0;
    for (final m in _matches) {
      final p = _store.get(m.id);
      if (p != null && m.finished && m.hasResult) {
        sum += pointsFor(
          predHome: p.home, predAway: p.away,
          actualHome: m.homeGoals!, actualAway: m.awayGoals!,
        );
      }
    }
    return sum;
  }

  Future<void> _resetTips() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: const Color(0xFF114E3B),
        title: const Text('Alle Tipps löschen?'),
        content: const Text('Deine gespeicherten Tipps werden entfernt.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Abbrechen')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Löschen')),
        ],
      ),
    );
    if (ok == true) {
      await _store.clear();
      setState(() {});
    }
  }

  /// Füllt offene (noch nicht angestoßene) Spiele mit der Modell-Prognose.
  Future<void> _autoTip() async {
    final now = DateTime.now();
    var n = 0;
    for (final m in _matches) {
      if (m.startedBy(now)) continue;
      final s = _elo.expectedScore(m.home.name, m.away.name);
      await _store.save(m.id, s[0], s[1]);
      n++;
    }
    if (!mounted) return;
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      backgroundColor: const Color(0xFF114E3B),
      content: Text(n == 0
          ? 'Keine offenen Spiele zum Auto-Tippen.'
          : '🔮 $n Spiele mit der Prognose getippt.'),
      duration: const Duration(seconds: 2),
    ));
  }

  void _openStats() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0D4634),
      showDragHandle: true,
      builder: (c) => _StatsSheet(store: _store, elo: _elo),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D4634),
        title: const Text('🔮 KickProphet'),
        actions: [
          Center(
            child: Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _accent.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text('$_totalPoints Pkt',
                  style: const TextStyle(color: _accent, fontWeight: FontWeight.w800)),
            ),
          ),
          IconButton(
            tooltip: 'Meine Saison',
            onPressed: _openStats,
            icon: const Icon(Icons.bar_chart_rounded),
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'reset') _resetTips();
              if (v == 'auto') _autoTip();
            },
            itemBuilder: (c) => const [
              PopupMenuItem(value: 'auto', child: Text('Auto-Tipp (Prognose)')),
              PopupMenuItem(value: 'reset', child: Text('Tipps zurücksetzen')),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          _controls(),
          const _PlayMoneyBanner(),
          _statusBar(),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _statusBar() {
    String left;
    if (_learnStatus != null) {
      left = '🧠 $_learnStatus';
    } else {
      left = '${_store.teamsLearned} Teams gelernt';
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
          DropdownButton<int>(
            value: _leagueIdx,
            dropdownColor: const Color(0xFF114E3B),
            underline: const SizedBox.shrink(),
            iconEnabledColor: _accent,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
            items: [
              for (var i = 0; i < kLeagues.length; i++)
                DropdownMenuItem(value: i, child: Text(kLeagues[i].label)),
            ],
            onChanged: _changeLeague,
          ),
          const Spacer(),
          IconButton(
            onPressed: _day > 1 ? () => _changeDay(-1) : null,
            icon: const Icon(Icons.chevron_left),
            color: _accent,
          ),
          Text('$_day. Spieltag',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          IconButton(
            onPressed: _day < _league.maxRound ? () => _changeDay(1) : null,
            icon: const Icon(Icons.chevron_right),
            color: _accent,
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
          prediction: _store.get(_matches[i].id),
          odds: _elo.odds(_matches[i].home.name, _matches[i].away.name),
          onChanged: (h, a) async {
            await _store.save(_matches[i].id, h, a);
            setState(() {});
          },
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
        'Tippspiel um Punkte · echte Spiele · kein Echtgeld',
        textAlign: TextAlign.center,
        style: TextStyle(color: _green, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _MatchCard extends StatelessWidget {
  final FootyMatch match;
  final DateTime now;
  final Prediction? prediction;
  final MatchOdds odds;
  final Future<void> Function(int home, int away) onChanged;

  const _MatchCard({
    required this.match,
    required this.now,
    required this.prediction,
    required this.odds,
    required this.onChanged,
  });

  bool get locked => match.startedBy(now);

  @override
  Widget build(BuildContext context) {
    final ph = prediction?.home ?? 0;
    final pa = prediction?.away ?? 0;

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
              _scoreInput(ph, pa),
              Expanded(child: _Crest(team: match.away, alignEnd: true)),
            ],
          ),
          const SizedBox(height: 10),
          _oddsRow(),
          if (match.finished && match.hasResult) _resultRow(ph, pa),
        ],
      ),
    );
  }

  Widget _oddsRow() {
    // Tipp-Tendenz zur Hervorhebung der „empfohlenen" (niedrigsten) Quote.
    final lowest = [odds.home, odds.draw, odds.away].reduce((a, b) => a < b ? a : b);
    Widget cell(String label, double value) {
      final fav = value == lowest;
      return Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3),
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(
            color: fav ? _accent.withValues(alpha: 0.16) : const Color(0xFF0B3D2E),
            borderRadius: BorderRadius.circular(9),
            border: Border.all(
              color: fav ? _accent : const Color(0xFF1C6A50),
            ),
          ),
          child: Column(
            children: [
              Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
              const SizedBox(height: 2),
              Text(value.toStringAsFixed(2),
                  style: TextStyle(
                    color: fav ? _accent : Colors.white,
                    fontWeight: FontWeight.w800, fontSize: 15,
                  )),
            ],
          ),
        ),
      );
    }

    return Row(children: [
      cell('1', odds.home),
      cell('X', odds.draw),
      cell('2', odds.away),
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
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text('${match.round}. Spieltag',
            style: const TextStyle(color: Colors.white38, fontSize: 11)),
        Text(status, style: TextStyle(color: col, fontSize: 11, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _scoreInput(int ph, int pa) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Stepper(value: ph, enabled: !locked, onChanged: (v) => onChanged(v, pa)),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6),
              child: Text(':', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            ),
            _Stepper(value: pa, enabled: !locked, onChanged: (v) => onChanged(ph, v)),
          ],
        ),
        const SizedBox(height: 2),
        Text(locked ? 'dein Tipp' : 'tippen',
            style: const TextStyle(color: Colors.white38, fontSize: 10)),
      ],
    );
  }

  Widget _resultRow(int ph, int pa) {
    final pts = pointsFor(
      predHome: ph, predAway: pa,
      actualHome: match.homeGoals!, actualAway: match.awayGoals!,
    );
    final hasTip = prediction != null;
    final win = pts > 0;
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.only(top: 8),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Color(0xFF1C6A50))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Endstand ${match.homeGoals}:${match.awayGoals}',
              style: const TextStyle(fontWeight: FontWeight.w700)),
          if (hasTip)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: (win ? _accent : const Color(0xFFFF6B6B)).withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text('${pointsLabel(pts)} · +$pts',
                  style: TextStyle(
                    color: win ? _accent : const Color(0xFFFF6B6B),
                    fontWeight: FontWeight.w800, fontSize: 12,
                  )),
            )
          else
            const Text('kein Tipp', style: TextStyle(color: Colors.white38, fontSize: 12)),
        ],
      ),
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

class _Stepper extends StatelessWidget {
  final int value;
  final bool enabled;
  final ValueChanged<int> onChanged;
  const _Stepper({required this.value, required this.enabled, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _btn(Icons.keyboard_arrow_up, enabled && value < 19, () => onChanged(value + 1)),
        Container(
          width: 30, height: 30, alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF0B3D2E),
            borderRadius: BorderRadius.circular(7),
            border: Border.all(color: const Color(0xFF1C6A50)),
          ),
          child: Text('$value',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
        ),
        _btn(Icons.keyboard_arrow_down, enabled && value > 0, () => onChanged(value - 1)),
      ],
    );
  }

  Widget _btn(IconData icon, bool on, VoidCallback tap) {
    return InkWell(
      onTap: on ? tap : null,
      child: Icon(icon, size: 22, color: on ? _accent : Colors.white24),
    );
  }
}

class _StatsSheet extends StatelessWidget {
  final PredictionStore store;
  final EloModel elo;
  const _StatsSheet({required this.store, required this.elo});

  @override
  Widget build(BuildContext context) {
    var points = 0, tips = 0, exact = 0;
    store.predictions.forEach((id, p) {
      final r = store.result(id);
      if (r == null) return;
      tips++;
      final pts = pointsFor(
          predHome: p.home, predAway: p.away, actualHome: r[0], actualAway: r[1]);
      points += pts;
      if (pts == Scoring.exact) exact++;
    });
    final avg = tips == 0 ? 0.0 : points / tips;
    final exactPct = tips == 0 ? 0 : (exact / tips * 100).round();
    final modelPct =
        store.modelTotal == 0 ? null : (store.modelHits / store.modelTotal * 100).round();

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 26),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Meine Saison',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
          const SizedBox(height: 14),
          Row(children: [
            _stat('$points', 'Punkte'),
            _stat('$tips', 'Tipps gewertet'),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            _stat('$exact', 'Volltreffer'),
            _stat('$exactPct %', 'Volltreffer-Quote'),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            _stat(avg.toStringAsFixed(2), 'Ø Punkte/Tipp'),
            _stat('${store.teamsLearned}', 'Teams gelernt'),
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
              Row(children: [
                const Icon(Icons.psychology_alt_rounded, color: _accent, size: 20),
                const SizedBox(width: 8),
                const Text('Modell-Treffsicherheit',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                const Spacer(),
                Text(modelPct == null ? '–' : '$modelPct %',
                    style: const TextStyle(
                        color: _accent, fontWeight: FontWeight.w800, fontSize: 18)),
              ]),
              const SizedBox(height: 6),
              Text(
                modelPct == null
                    ? 'Sobald Ergebnisse eingelesen sind, zeigt sich hier, wie oft die Prognose richtig lag.'
                    : 'Anteil korrekt vorhergesagter Spiele (1/X/2) über ${store.modelTotal} ausgewertete Partien. Die Quoten lernen weiter dazu.',
                style: const TextStyle(color: Colors.white60, fontSize: 12),
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
