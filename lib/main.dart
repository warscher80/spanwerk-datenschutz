// main.dart – Footy Predict: echte Spiele tippen, Punkte sammeln (kein Echtgeld).
import 'package:flutter/material.dart';

import 'api.dart';
import 'engine.dart';
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
      title: 'Footy Predict',
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

class _HomePageState extends State<HomePage> {
  final _store = PredictionStore();
  int _leagueIdx = 0;
  late int _season;
  int _day = 1;

  List<FootyMatch> _matches = [];
  bool _loading = true;
  String? _error;

  League get _league => kLeagues[_leagueIdx];

  @override
  void initState() {
    super.initState();
    _season = _currentSeason();
    _boot();
  }

  int _currentSeason() {
    final now = DateTime.now();
    return now.month >= 8 ? now.year : now.year - 1;
  }

  Future<void> _boot() async {
    await _store.load();
    await _loadCurrent();
  }

  /// Aktuellen Spieltag laden und Spieltag-Nummer daraus ableiten.
  Future<void> _loadCurrent() async {
    setState(() { _loading = true; _error = null; });
    try {
      final m = await Api.currentMatchday(_league.shortcut);
      _day = _parseDay(m) ?? _day;
      setState(() { _matches = m; _loading = false; });
    } catch (e) {
      setState(() { _error = _msg(e); _loading = false; });
    }
  }

  Future<void> _loadDay() async {
    setState(() { _loading = true; _error = null; });
    try {
      final m = await Api.matchday(_league.shortcut, _season, _day);
      setState(() { _matches = m; _loading = false; });
    } catch (e) {
      setState(() { _error = _msg(e); _loading = false; });
    }
  }

  int? _parseDay(List<FootyMatch> m) {
    for (final x in m) {
      final match = RegExp(r'(\d+)').firstMatch(x.matchday);
      if (match != null) return int.parse(match.group(1)!);
    }
    return null;
  }

  String _msg(Object e) =>
      'Spiele konnten nicht geladen werden.\nInternetverbindung prüfen und erneut ziehen.\n($e)';

  void _changeDay(int delta) {
    final next = (_day + delta).clamp(1, 38);
    if (next == _day) return;
    setState(() => _day = next);
    _loadDay();
  }

  void _changeLeague(int? idx) {
    if (idx == null || idx == _leagueIdx) return;
    setState(() => _leagueIdx = idx);
    _loadCurrent();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D4634),
        title: const Text('⚽ Footy Predict'),
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
          PopupMenuButton<String>(
            onSelected: (v) { if (v == 'reset') _resetTips(); },
            itemBuilder: (c) => const [
              PopupMenuItem(value: 'reset', child: Text('Tipps zurücksetzen')),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          _controls(),
          const _PlayMoneyBanner(),
          Expanded(child: _body()),
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
                DropdownMenuItem(value: i, child: Text(kLeagues[i].name)),
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
            onPressed: _day < 38 ? () => _changeDay(1) : null,
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
  final Future<void> Function(int home, int away) onChanged;

  const _MatchCard({
    required this.match,
    required this.now,
    required this.prediction,
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
          if (match.finished && match.hasResult) _resultRow(ph, pa),
        ],
      ),
    );
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
        Text(match.matchday,
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
    final url = team.bitmapIcon;
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
