// main.dart – KickProphet: datenbasierte Fußball-Prognosen (kein Echtgeld).
import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/gestures.dart' show PointerDeviceKind;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'engine.dart';
import 'notify.dart';
import 'odds.dart';
import 'store.dart';
import 'theme.dart';
import 'update.dart';

void main() => runApp(const FootyApp());

// Kurzer Alias auf den Marken-Akzent (viele Stellen nutzen ihn).
const _accent = kAccent;

// Nur für die visuelle Abnahme: mit --dart-define=DEMO=true rendert die App
// Beispielkarten ohne Netz. Im normalen Build (Standard false) unerreichbar.
const _demoMode = bool.fromEnvironment('DEMO');

/// Erlaubt das Ziehen horizontaler Listen mit Maus/Trackpad zusätzlich zu Touch.
/// Ohne das lässt sich die Chip-Leiste am PC nicht durch Ziehen scrollen.
class _DragScrollBehavior extends MaterialScrollBehavior {
  const _DragScrollBehavior();
  @override
  Set<PointerDeviceKind> get dragDevices => {
        PointerDeviceKind.touch,
        PointerDeviceKind.mouse,
        PointerDeviceKind.trackpad,
        PointerDeviceKind.stylus,
      };
}

class FootyApp extends StatelessWidget {
  const FootyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: kAccent,
      brightness: Brightness.dark,
    ).copyWith(surface: kSurface, surfaceContainerHighest: kSurfaceHi);
    return MaterialApp(
      title: 'KickProphet – Fußball-Prognosen',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: kBg,
        splashColor: kAccent.withValues(alpha: 0.08),
        highlightColor: kAccent.withValues(alpha: 0.06),
        fontFamily: 'Roboto',
        textTheme: const TextTheme().apply(bodyColor: kText, displayColor: kText),
      ),
      home: _demoMode ? const _DemoScreen() : const HomePage(),
    );
  }
}

/// Reine Design-Vorschau (nur im DEMO-Build). Zeigt die Spielkarte in mehreren
/// Zuständen ohne Netzabruf – für die visuelle Kontrolle.
class _DemoScreen extends StatelessWidget {
  const _DemoScreen();

  @override
  Widget build(BuildContext context) {
    final now = DateTime(2026, 8, 22, 15, 0);
    FootyMatch mk(int id, String h, String a, DateTime k, int round,
        {bool finished = false, int? hg, int? ag, String? comp, String? rl,
        String? progress}) {
      return FootyMatch(
        id: id,
        kickoff: k,
        round: round,
        home: Team(h, null),
        away: Team(a, null),
        finished: finished,
        homeGoals: hg,
        awayGoals: ag,
        kickoffExact: true,
        competition: comp,
        roundLabel: rl,
        progress: progress,
      );
    }

    Widget card(FootyMatch m, MatchProbs p, {double top = 0}) {
      final t = tippFromProbs(p);
      return _MatchCard(
        match: m,
        now: now,
        probs: p,
        tip: t,
        topPadding: top,
        onTap: () => showModalBottomSheet(
          context: context,
          backgroundColor: kSurfaceTop,
          showDragHandle: true,
          isScrollControlled: true,
          builder: (_) => _MatchDetailSheet(match: m, probs: p, tip: t),
        ),
      );
    }

    final cards = <Widget>[
      // Live-Beispiel (läuft, Zwischenstand 1:0).
      card(
        mk(0, 'Inter Milan', 'AC Milan', DateTime(2026, 8, 22, 14, 0), 1,
            hg: 1, ag: 0, comp: '🇮🇹 Serie A', progress: '67'),
        const MatchProbs(0.45, 0.27, 0.28),
        top: 12,
      ),
      _MatchCard(
        match: mk(1, 'Bayern Munich', 'VfB Stuttgart',
            DateTime(2026, 8, 28, 18, 30), 1, comp: '🇩🇪 1. Bundesliga'),
        now: now,
        probs: const MatchProbs(0.61, 0.23, 0.16),
        tip: tippFromProbs(const MatchProbs(0.61, 0.23, 0.16)),
      ),
      _MatchCard(
        match: mk(2, 'Borussia Dortmund', 'RB Leipzig',
            DateTime(2026, 8, 29, 15, 30), 1, comp: '🇩🇪 1. Bundesliga'),
        now: now,
        probs: const MatchProbs(0.38, 0.30, 0.32),
        tip: tippFromProbs(const MatchProbs(0.38, 0.30, 0.32)),
      ),
      _MatchCard(
        match: mk(3, 'Arsenal', 'Chelsea', DateTime(2026, 8, 30, 17, 30), 2,
            comp: '🏴 Premier League'),
        now: now,
        probs: const MatchProbs(0.44, 0.28, 0.28),
        tip: tippFromProbs(const MatchProbs(0.44, 0.28, 0.28)),
      ),
      _MatchCard(
        match: mk(4, 'Real Madrid', 'Barcelona', DateTime(2026, 8, 20, 21, 0), 1,
            finished: true, hg: 2, ag: 1, comp: '🇪🇸 La Liga'),
        now: now,
        probs: const MatchProbs(0.47, 0.26, 0.27),
        tip: tippFromProbs(const MatchProbs(0.47, 0.26, 0.27)),
      ),
      _MatchCard(
        match: mk(5, 'Frankreich', 'Argentinien', DateTime(2026, 8, 24, 20, 0),
            8, comp: '🏆 WM 2026', rl: 'Viertelfinale'),
        now: now,
        probs: const MatchProbs(0.34, 0.30, 0.36),
        tip: tippFromProbs(const MatchProbs(0.34, 0.30, 0.36)),
      ),
    ];

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurfaceTop,
        title: const Text('KickProphet · Design-Vorschau',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
            children: cards,
          ),
        ),
      ),
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
  // Prognose je Spiel, festgehalten VOR dem Einlernen der Ergebnisse – sonst
  // verschöbe die frisch gelernte Stärke die Anzeige gegenüber der gewerteten
  // Treffsicherheit (das ✓/✗ wäre geschönt).
  Map<int, MatchProbs> _cardProbs = {};
  bool _loading = true;
  bool _loadInFlight = false;
  DateTime? _lastAutoLoad;
  // Zählt jeden gestarteten Abruf. Wechselt der Nutzer die Liga, während noch
  // eine Antwort unterwegs ist, darf die alte Antwort die neue Ansicht nicht
  // mehr überschreiben.
  int _ladeGeneration = 0;
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
    _starteAutoTimer();
    _boot();
    _pruefeUpdate();
  }

  /// Auto-Aktualisierung nur im Vordergrund. Der Timer weckt regelmäßig, aber
  /// _autoRefresh selbst hält je nach Ansicht Abstand (spart Akku und Anfragen).
  void _starteAutoTimer() {
    _autoTimer?.cancel();
    _autoTimer = Timer.periodic(const Duration(seconds: 60), (_) => _autoRefresh());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _autoTimer?.cancel();
    _learner?.cancel();
    _chipCtrl.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Zurück im Vordergrund: Timer wieder starten, aktualisieren (mit
      // Abstand, kein sofortiges Voll-Laden) und neue Ergebnisse nachlernen.
      _starteAutoTimer();
      _pruefeUpdate();
      _autoRefresh();
      _startLearning();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      // Im Hintergrund nicht pollen – schont Akku und Datenverbrauch.
      _autoTimer?.cancel();
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
    // Vorberechnetes Modell holen, bevor gelernt wird – sonst liefe der
    // Lerner los und würde gleich darauf überschrieben. Schlägt es fehl,
    // lernt die App wie bisher selbst; es ist eine Abkürzung, keine
    // Voraussetzung.
    try {
      final fertig = await ladeFertigmodell();
      if (fertig != null && await _store.spieleModellEin(fertig)) {
        debugPrint('Vorberechnetes Modell übernommen: ${_store.elo.length} Teams');
      }
    } catch (e) {
      debugPrint('Vorberechnetes Modell nicht verfügbar: $e');
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
    // Nur Spiele mit echter Anstoßzeit: bei aus dem Datum abgeleiteten Zeiten
    // wäre die Erinnerung geraten und käme zur falschen Stunde.
    final upcoming = matches
        .where((x) => x.kickoffExact && x.kickoff != null && x.kickoff!.isAfter(now))
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
      backgroundColor: kSurface,
      content: Text(on ? '🔔 Erinnerungen aktiviert' : 'Erinnerungen ausgeschaltet'),
      duration: const Duration(seconds: 2),
    ));
  }

  /// Liga/Turnier vorbereiten: Saison setzen, Startrunde bestimmen, laden, lernen.
  Future<void> _selectLeague() async {
    // Welche Liga dieser Aufruf vorbereitet. Tippt der Nutzer eine andere Liga
    // an, während die Startrunde noch geladen wird, darf die alte (langsamere)
    // Antwort nicht den Spieltag der neuen Ansicht überschreiben.
    final ligaBeimStart = _leagueIdx;
    setState(() { _loading = true; _error = null; _stages = []; _matches = []; });
    if (_currentMode) {
      await _loadDay();
      return;
    }
    _season = Api.seasonFor(_league, DateTime.now());
    if (!_isCup) {
      final r = await _resolveStartRound(_league);
      if (_leagueIdx != ligaBeimStart) return; // inzwischen umgeschaltet
      _day = r;
    }
    if (_leagueIdx != ligaBeimStart) return;
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
    if (_isCup) return _fetchCup();
    return Api.round(_league.id, _season, _day);
  }

  /// Turnier laden und dabei lernen, welche Runden es überhaupt gibt.
  ///
  /// Beim ersten Mal werden alle möglichen Codes durchprobiert (bei der WM
  /// elf). Danach genügen die tatsächlich belegten – meist drei bis vier.
  /// In Abständen wird trotzdem wieder vollständig gesucht, weil im Verlauf
  /// eines Turniers neue K.o.-Runden dazukommen.
  Future<List<FootyMatch>> _fetchCup() async {
    final vollstaendig = _store.cupSucheFaellig(_league.id, _season);
    final bekannt = vollstaendig ? const <int>[] : _store.cupRunden(_league.id, _season);
    final m = await Api.allCupMatches(
      _league.id,
      _season,
      _league.cupCandidates,
      bekannteRunden: bekannt,
    );
    final gefunden = Api.zuletztGefundeneRunden;
    if (gefunden.isNotEmpty) {
      await _store.merkeCupRunden(_league.id, _season, gefunden,
          warVollstaendig: vollstaendig);
    }
    return m;
  }

  DateTime? _letzteUpdatePruefung;

  /// Im Hintergrund auf eine neuere App-Version prüfen.
  ///
  /// Nicht nur beim Start, sondern auch beim Zurückkehren in die App: eine
  /// sideload-installierte App wird oft tagelang nicht neu gestartet und
  /// bekäme sonst nie mit, dass es eine neuere Fassung gibt. Höchstens
  /// einmal pro Stunde, das reicht für eine App ohne Store-Anbindung.
  void _pruefeUpdate() {
    // Im Browser / als Home-Bildschirm-Lesezeichen (PWA) aktualisiert sich die
    // App beim Neuladen von selbst. Ein APK-Update-Banner mit .apk-Download
    // wäre dort sinnlos (und auf dem iPhone gar nicht installierbar).
    if (kIsWeb) return;
    if (_update != null) return; // Hinweis steht schon
    final last = _letzteUpdatePruefung;
    if (last != null && DateTime.now().difference(last) < const Duration(hours: 1)) {
      return;
    }
    _letzteUpdatePruefung = DateTime.now();
    checkForUpdate().then((u) {
      if (mounted && u != null) setState(() => _update = u);
    });
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
    final gen = ++_ladeGeneration;
    // Ist inzwischen ein neuerer Abruf gestartet, gehört diese Antwort zu
    // einer Ansicht, die der Nutzer schon verlassen hat.
    bool veraltet() => gen != _ladeGeneration;
    try {
      var m = await _fetchMatches();
      if (veraltet()) return;
      // Leerer Erstabruf ist meist nur Drosselung -> einmal nachfassen.
      // In „Aktuell" NICHT nachfassen: dort wäre es ein zweiter Schwall über
      // alle zehn Ligen (~26 Anfragen) und träfe die Drosselung nur härter.
      if (m.isEmpty && !silent && !_currentMode) {
        await Future.delayed(const Duration(milliseconds: 1200));
        m = await _fetchMatches();
        if (veraltet()) return;
      }
      if (!_currentMode && !_isCup) await _store.setLastRound(_league.id, _day);
      // In den Einzel-Liga-Ansichten den Liga-Namen an jede Partie hängen
      // (in „Aktuell" setzt die API-Schicht ihn bereits pro Liga).
      if (!_currentMode) {
        for (final x in m) {
          x.competition = _league.label;
        }
      }
      // Prognose je Spiel VOR dem Lernen festhalten (neutraler Platz je Spiel).
      final probsById = <int, MatchProbs>{
        for (final x in m)
          x.id: _elo.probs(x.home.name, x.away.name, neutral: x.neutralVenue),
      };
      // Frische Ergebnisse sofort ins Quoten-Modell einarbeiten.
      var learned = false;
      for (final x in m) {
        if (ingestMatch(_store, _elo, x, neutral: x.neutralVenue)) learned = true;
      }
      if (learned) await _store.saveLearning();
      if (!mounted || veraltet()) return;
      // Leeres Ergebnis (meist kurze Drosselung) darf eine bestehende Liste
      // nicht löschen – nur den Zeitstempel aktualisieren.
      if (m.isEmpty && _matches.isNotEmpty) {
        setState(() { _loading = false; _updatedAt = DateTime.now(); });
        return;
      }
      final goals = _detectGoals(m);
      setState(() {
        _matches = m;
        _cardProbs = probsById;
        _loading = false;
        _updatedAt = DateTime.now();
      });
      _scheduleReminders(m);
      _settleWetten(m);
      _mergeLiveMinutes();
      for (final g in goals) {
        _goalAlert(g);
      }
    } catch (e) {
      if (!mounted || veraltet()) return;
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
          style: const TextStyle(color: kAccentInk, fontWeight: FontWeight.w800, fontSize: 15)),
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
        // clamp(0, -1) würde werfen. Derzeit unerreichbar, weil _canPrev und
        // _canNext im Turnier-Modus beide false sind - aber eine Falle für
        // den, der die Rundennavigation wieder einschaltet.
        if (_stages.isEmpty) return;
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

  /// Detailansicht einer Partie (Tippen auf die Karte). Zeigt Status (auch
  /// live), volle Wahrscheinlichkeiten, Tipp, Sicherheit und – bei beendeten
  /// Spielen – Ergebnis und ob die Prognose stimmte.
  void _openMatchDetail(FootyMatch m, MatchProbs p, List<int> tip) {
    showModalBottomSheet(
      context: context,
      backgroundColor: kSurfaceTop,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => _MatchDetailSheet(
        match: m,
        probs: p,
        tip: tip,
        store: _store,
        onChanged: () { if (mounted) setState(() {}); },
      ),
    );
  }

  void _openStats() {
    showModalBottomSheet(
      context: context,
      backgroundColor: kSurfaceTop,
      showDragHandle: true,
      builder: (c) => _StatsSheet(store: _store),
    );
  }

  /// Eigene Wett-Bilanz (rein lokal, kein Konto).
  void _openWetten() {
    showModalBottomSheet(
      context: context,
      backgroundColor: kSurfaceTop,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => _WettenSheet(
        store: _store,
        onChanged: () { if (mounted) setState(() {}); },
      ),
    );
  }

  /// Echte Spielminute nachladen und den laufenden Spielen zuspielen.
  /// Die normalen Feeds liefern keine Minute – nur der separate livescore-Feed.
  /// Ein Aufruf deckt alle Ligen ab; ohne Live-Spiel gar keine Anfrage.
  Future<void> _mergeLiveMinutes() async {
    if (!_matches.any((m) => m.isLive)) return;
    final map = await Api.liveMinutes();
    if (!mounted || map.isEmpty) return;
    var any = false;
    for (final m in _matches) {
      if (m.isLive && map.containsKey(m.id) && m.progress != map[m.id]) {
        m.progress = map[m.id];
        any = true;
      }
    }
    if (any) setState(() {});
  }

  /// Beendete Spiele mit offener Wette abrechnen (✅/❌) und Bilanz aktualisieren.
  Future<void> _settleWetten(List<FootyMatch> matches) async {
    if (!_store.hasWetten) return;
    var changed = false;
    for (final m in matches) {
      if (m.finished && m.hasResult && m.homeGoals != null && m.awayGoals != null) {
        if (await _store.rechneWetteAb(m.id, m.homeGoals!, m.awayGoals!)) {
          changed = true;
        }
      }
    }
    if (changed && mounted) setState(() {});
  }

  /// „Wer gewinnt die WM?" – Titelchancen aus tausenden Simulationen.
  void _openWinnerOdds() {
    // K.o.-Spiele (Runden ≥ 4; Gruppen sind 1–3); erste K.o.-Runde = meiste Teams.
    final ko = _matches.where((m) => m.round >= 4).toList();
    if (ko.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        backgroundColor: kSurface,
        content: Text('Titelchancen gibt es ab dem Achtelfinale.'),
      ));
      return;
    }
    final firstNo = Api.ersteKoRunde(ko)!;
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
      backgroundColor: kSurfaceTop,
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
                        color: kSurfaceHi, borderRadius: BorderRadius.circular(6))),
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
        backgroundColor: kSurface,
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
      backgroundColor: kSurfaceTop,
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
    final unentschieden = finished && m.homeGoals == m.awayGoals;
    // Bei entschiedenem Spiel den echten Sieger hervorheben, bei offenem den
    // Favoriten. Endete ein K.o.-Spiel unentschieden (per Elfmeter entschieden),
    // steht der Sieger nicht in den Daten – dann wird niemand markiert, statt
    // fälschlich den Favoriten als weiter zu zeigen.
    final bool? homeTop = unentschieden
        ? null
        : finished
            ? m.homeGoals! > m.awayGoals!
            : p.home >= p.away;

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
        color: kSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: kBorderHi),
      ),
      child: Column(children: [
        side(m.home, homeTop == true, finished ? m.homeGoals : null),
        const Divider(height: 10, color: kBorderHi),
        side(m.away, homeTop == false, finished ? m.awayGoals : null),
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
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurfaceTop,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleSpacing: 16,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: kAccent,
                borderRadius: BorderRadius.circular(9),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.auto_graph_rounded, size: 17, color: kAccentInk),
            ),
            const SizedBox(width: 9),
            const Text('KickProphet',
                style: TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 19, letterSpacing: -0.3)),
          ],
        ),
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
            tooltip: 'Meine Wetten',
            onPressed: _openWetten,
            icon: const Icon(Icons.receipt_long_rounded),
          ),
          IconButton(
            tooltip: 'Trefferquote',
            onPressed: _openStats,
            icon: const Icon(Icons.insights_rounded),
          ),
          PopupMenuButton<String>(
            color: kSurfaceHi,
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
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            if (_update != null) _updateBanner(_update!),
            _leagueChips(),
            if (!_currentMode && !_isCup) _dayNav(),
            _statusBar(),
            Expanded(child: _body()),
            const _DisclaimerBar(),
          ],
        ),
      ),
    );
  }

  final ScrollController _chipCtrl = ScrollController();

  /// Wettbewerbs-Auswahl als horizontale Chip-Leiste (mobil daumenfreundlich,
  /// kein sperriges Dropdown). „Aktuell" führt die Liste an. Antippen über
  /// InkWell (mit Feedback), horizontales Wischen per Touch UND Maus/Trackpad.
  Widget _leagueChips() {
    Widget chip(int idx, String label, {IconData? icon}) {
      final selected = _leagueIdx == idx;
      return Padding(
        padding: const EdgeInsets.only(right: 8),
        child: Material(
          color: selected ? kAccent : kSurfaceHi,
          borderRadius: BorderRadius.circular(kRadiusPill),
          child: InkWell(
            borderRadius: BorderRadius.circular(kRadiusPill),
            onTap: () => _changeLeague(idx),
            child: Container(
              // Mindesthöhe ~44 px für sichere Touch-Bedienung.
              constraints: const BoxConstraints(minHeight: 44),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(kRadiusPill),
                border: Border.all(color: selected ? kAccent : kBorder),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 14, color: selected ? kAccentInk : kLive),
                    const SizedBox(width: 6),
                  ],
                  Text(label,
                      style: TextStyle(
                        color: selected ? kAccentInk : kTextDim,
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                      )),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      color: kSurfaceTop,
      padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
      child: ScrollConfiguration(
        // Auch mit Maus/Trackpad ziehbar (Desktop) – nicht nur Touch.
        behavior: const _DragScrollBehavior(),
        child: SingleChildScrollView(
          controller: _chipCtrl,
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: [
              chip(-1, 'Aktuell', icon: Icons.circle),
              for (var i = 0; i < kLeagues.length; i++) chip(i, kLeagues[i].label),
            ],
          ),
        ),
      ),
    );
  }

  /// Spieltag-Navigation (nur im Liga-Modus). Klar erkennbar, große Touch-Flächen.
  Widget _dayNav() {
    return Container(
      color: kSurfaceTop,
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _navButton(Icons.chevron_left, _canPrev ? () => _changeDay(-1) : null),
          Container(
            constraints: const BoxConstraints(minWidth: 130),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            alignment: Alignment.center,
            child: Text('$_day. Spieltag',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          ),
          _navButton(Icons.chevron_right, _canNext ? () => _changeDay(1) : null),
        ],
      ),
    );
  }

  Widget _navButton(IconData icon, VoidCallback? onTap) {
    final enabled = onTap != null;
    return Material(
      color: enabled ? kSurfaceHi : Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, color: enabled ? kAccent : kTextMute),
        ),
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
              const Icon(Icons.system_update, color: kAccentInk, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Update verfügbar: v${u.versionName}',
                        style: const TextStyle(color: kAccentInk, fontWeight: FontWeight.w800, fontSize: 13)),
                    if (u.notes.isNotEmpty)
                      Text(u.notes,
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: kAccentInk, fontSize: 11)),
                  ],
                ),
              ),
              TextButton(
                onPressed: () => _downloadUpdate(u),
                style: TextButton.styleFrom(
                  backgroundColor: kAccentInk,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                ),
                child: const Text('Laden', style: TextStyle(color: _accent, fontWeight: FontWeight.w800)),
              ),
              IconButton(
                onPressed: () => setState(() => _update = null),
                icon: const Icon(Icons.close, color: kAccentInk, size: 18),
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
      decoration: const BoxDecoration(
        color: kSurfaceTop,
        border: Border(bottom: BorderSide(color: kBorder)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Row(children: [
              if (_learnStatus != null)
                const Padding(
                  padding: EdgeInsets.only(right: 6),
                  child: SizedBox(
                    width: 10, height: 10,
                    child: CircularProgressIndicator(strokeWidth: 1.6, color: _accent),
                  ),
                ),
              Flexible(
                child: Text(left,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: kTextMute, fontSize: 11)),
              ),
            ]),
          ),
          const SizedBox(width: 8),
          Text(right, style: const TextStyle(color: kTextMute, fontSize: 11)),
        ],
      ),
    );
  }

  /// Kompakte Tages-Übersicht über der Liste: beantwortet auf einen Blick
  /// „wie viele Spiele, wie viele klare Favoriten, wie viele offene". Alle
  /// Zahlen sind aus den geladenen Spielen berechnet – nichts Erfundenes.
  Widget _summaryStrip() {
    if (_matches.isEmpty) return const SizedBox.shrink();
    var favoriten = 0;
    var offen = 0;
    for (final m in _matches) {
      final p = _elo.probs(m.home.name, m.away.name, neutral: _isCup);
      final maxp = [p.home, p.draw, p.away].reduce((a, b) => a > b ? a : b);
      if (predictedTendency(p) != Tendency.draw && maxp >= 0.55) {
        favoriten++;
      } else {
        offen++;
      }
    }
    Widget item(String value, String label, Color color) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value,
              style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 18)),
          Text(label, style: const TextStyle(color: kTextMute, fontSize: 11)),
        ],
      );
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadius),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          item('${_matches.length}', 'Spiele', kText),
          Container(width: 1, height: 30, color: kBorder),
          item('$favoriten', 'klare Favoriten', kAccent),
          Container(width: 1, height: 30, color: kBorder),
          item('$offen', 'offene Spiele', kTextDim),
        ],
      ),
    );
  }


  /// Inhalt auf großen Bildschirmen zentrieren und in der Breite begrenzen –
  /// eine Fußball-App liest sich in einer Spalte besser als über 1920 px gezogen.
  Widget _maxW(Widget child) => Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: child,
        ),
      );

  Widget _body() {
    if (_loading) {
      // Skeleton statt Spinner: die Karten-Struktur ist schon sichtbar, das
      // wirkt schneller und ruhiger als ein großer drehender Kreis.
      return _maxW(ListView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
        physics: const NeverScrollableScrollPhysics(),
        children: const [
          _SkeletonCard(),
          _SkeletonCard(),
          _SkeletonCard(),
          _SkeletonCard(),
        ],
      ));
    }
    if (_error != null) {
      return _stateView(
        icon: Icons.wifi_off_rounded,
        title: 'Spieldaten konnten gerade nicht geladen werden.',
        subtitle: 'Bitte Internetverbindung prüfen und erneut versuchen.',
        actionLabel: 'Erneut versuchen',
        onAction: _loadDay,
      );
    }
    if (_matches.isEmpty) {
      return _stateView(
        icon: Icons.event_busy_rounded,
        title: _currentMode
            ? 'Gerade stehen keine Spiele an.'
            : 'Keine Spiele für diesen Zeitraum.',
        subtitle: _currentMode
            ? 'Wähle oben einen Wettbewerb, z. B. 🏆 WM 2026.'
            : 'Blättere zu einem anderen Spieltag oder Wettbewerb.',
      );
    }
    final now = DateTime.now();
    return RefreshIndicator(
      color: _accent,
      backgroundColor: kSurface,
      onRefresh: _loadDay,
      child: _maxW(ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
        itemCount: _matches.length + 1,
        itemBuilder: (c, i) {
          if (i == 0) {
            return _currentMode ? _summaryStrip() : const SizedBox(height: 12);
          }
          final m = _matches[i - 1];
          final p = _cardProbs[m.id] ??
              _elo.probs(m.home.name, m.away.name, neutral: m.neutralVenue);
          final t = tippFromProbs(p);
          return _MatchCard(
            match: m,
            now: now,
            probs: p,
            tip: t,
            topPadding: _currentMode ? 12 : 0,
            bet: _store.wette(m.id),
            onTap: () => _openMatchDetail(m, p, t),
          );
        },
      )),
    );
  }

  /// Einheitliche, freundliche Leer-/Fehleransicht (mit optionaler Aktion).
  Widget _stateView({
    required IconData icon,
    required String title,
    String? subtitle,
    String? actionLabel,
    Future<void> Function()? onAction,
  }) {
    return RefreshIndicator(
      color: _accent,
      backgroundColor: kSurface,
      onRefresh: _loadDay,
      child: _maxW(ListView(
        children: [
          const SizedBox(height: 90),
          Icon(icon, size: 52, color: kTextMute),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: kText, fontSize: 16, fontWeight: FontWeight.w700)),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 36),
              child: Text(subtitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: kTextDim, fontSize: 13)),
            ),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 22),
            Center(
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: kAccent,
                  foregroundColor: kAccentInk,
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                ),
                onPressed: onAction,
                child: Text(actionLabel,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ],
      )),
    );
  }
}

/// Dezenter Disclaimer am unteren Rand: Prognosen sind statistisch, keine
/// Garantie. Bewusst leise – informiert, ohne zu stören.
class _DisclaimerBar extends StatelessWidget {
  const _DisclaimerBar();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: kSurfaceTop,
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
      child: const Text(
        'Prognosen basieren auf statistischen Daten – keine Garantie für echte Ergebnisse. Keine Wetten, kein Echtgeld.',
        textAlign: TextAlign.center,
        style: TextStyle(color: kTextMute, fontSize: 10.5, height: 1.3),
      ),
    );
  }
}

/// Platzhalter-Karte während des Ladens (sanft pulsierend).
class _SkeletonCard extends StatefulWidget {
  const _SkeletonCard();
  @override
  State<_SkeletonCard> createState() => _SkeletonCardState();
}

class _SkeletonCardState extends State<_SkeletonCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Widget box(double w, double h, {double r = 8}) => Container(
          width: w,
          height: h,
          decoration: BoxDecoration(
            color: kSurfaceHi,
            borderRadius: BorderRadius.circular(r),
          ),
        );
    return FadeTransition(
      opacity: Tween(begin: 0.45, end: 0.9).animate(_c),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRadius),
          border: Border.all(color: kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            box(120, 12),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                box(90, 14),
                box(30, 30, r: 15),
                box(90, 14),
              ],
            ),
            const SizedBox(height: 16),
            box(double.infinity, 8, r: 999),
            const SizedBox(height: 14),
            box(double.infinity, 34, r: 10),
          ],
        ),
      ),
    );
  }
}

class _MatchCard extends StatelessWidget {
  final FootyMatch match;
  final DateTime now;
  final MatchProbs probs;
  final List<int> tip; // KickProphet-Tipp (erwartetes Ergebnis, tendenz-konsistent)
  final double topPadding;
  final VoidCallback? onTap;
  final Wette? bet; // eigene Wette des Nutzers auf dieses Spiel (falls vorhanden)

  const _MatchCard({
    required this.match,
    required this.now,
    required this.probs,
    required this.tip,
    this.topPadding = 0,
    this.onTap,
    this.bet,
  });

  // Läuft gerade (Zwischenstand vorhanden, noch nicht beendet).
  bool get live => match.isLive;
  // Angepfiffen, aber (noch) ohne Stand – nur bei echter Anstoßzeit.
  bool get locked => match.startedBy(now) && match.kickoffExact;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: topPadding),
      child: Material(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadius),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(kRadius),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(kRadius),
              border: Border.all(color: live ? kLive.withValues(alpha: 0.5) : kBorder),
            ),
            child: Column(
              children: [
                _topRow(),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(child: _Crest(team: match.home, alignEnd: false)),
                    _center(),
                    Expanded(child: _Crest(team: match.away, alignEnd: true)),
                  ],
                ),
                const SizedBox(height: 14),
                _predictionBanner(),
                const SizedBox(height: 12),
                _probSection(),
                const SizedBox(height: 10),
                _footerRow(),
                if (bet != null) ...[
                  const SizedBox(height: 10),
                  _betBadge(bet!),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Mitte der Karte: Endstand (beendet), Live-Stand (läuft) oder Anstoßzeit.
  Widget _center() {
    if (live || (match.finished && match.hasResult)) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('${match.homeGoals}:${match.awayGoals}',
              style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                  color: live ? kLive : kText)),
          // Bei laufenden Spielen die echte Spielminute (falls die Datenquelle
          // sie liefert), sonst schlicht „live".
          Text(live ? (match.liveMinute ?? 'live') : 'Endstand',
              style: TextStyle(
                  color: live ? kLive : kTextMute,
                  fontSize: 10,
                  fontWeight: live ? FontWeight.w800 : FontWeight.w400)),
        ]),
      );
    }
    final time = match.kickoff != null && match.kickoffExact
        ? _fmtTime(match.kickoff!)
        : '–';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(time,
            style: const TextStyle(
                fontSize: 17, fontWeight: FontWeight.w800, color: kText)),
        const Text('Anstoß', style: TextStyle(color: kTextMute, fontSize: 10)),
      ]),
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
    final sure = idx != 1 && conf >= 65;

    Widget trailing = Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text('$conf %',
            style: const TextStyle(
                color: _accent, fontWeight: FontWeight.w900, fontSize: 20, letterSpacing: -0.5)),
        const Text('Wahrsch.', style: TextStyle(color: kTextMute, fontSize: 9.5)),
      ],
    );
    if (match.finished && match.hasResult) {
      final actual = tendencyOf(match.homeGoals!, match.awayGoals!);
      final predicted =
          idx == 0 ? Tendency.home : (idx == 2 ? Tendency.away : Tendency.draw);
      final hit = predicted == actual;
      trailing = StatusPill(hit ? 'getroffen' : 'daneben',
          color: hit ? kAccent : kDanger,
          filled: true,
          icon: hit ? Icons.check_rounded : Icons.close_rounded);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: _accent.withValues(alpha: sure ? 0.18 : 0.10),
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(
          color: _accent.withValues(alpha: sure ? 0.85 : 0.35),
          width: sure ? 1.4 : 1,
        ),
      ),
      child: Row(
        children: [
          Icon(idx == 1 ? Icons.balance_rounded : Icons.trending_up_rounded,
              color: _accent, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(who,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: kText, fontWeight: FontWeight.w800, fontSize: 16)),
          ),
          const SizedBox(width: 8),
          trailing,
        ],
      ),
    );
  }

  /// Wahrscheinlichkeits-Bereich: visueller Balken + drei beschriftete Werte.
  Widget _probSection() {
    final pick = _predictedIdx();
    return Column(
      children: [
        ProbBar(
            home: probs.home, draw: probs.draw, away: probs.away, highlight: pick),
        const SizedBox(height: 8),
        _probRow(),
      ],
    );
  }

  /// Zusatzzeile: KickProphet-Tipp (erwartetes Ergebnis) + Prognosesicherheit.
  Widget _footerRow() {
    final idx = _predictedIdx();
    final conf = ([probs.home, probs.draw, probs.away][idx] * 100).round();
    final (String label, Color color) = idx == 1
        ? ('offen', kTextDim)
        : conf >= 70
            ? ('hoch', kAccent)
            : conf >= 58
                ? ('mittel', kWarn)
                : ('gering', kTextDim);
    return Row(
      children: [
        Icon(Icons.sports_soccer_rounded, size: 14, color: kTextDim),
        const SizedBox(width: 6),
        Text('KickProphet-Tipp ', style: TextStyle(color: kTextDim, fontSize: 12)),
        Text('${tip[0]}:${tip[1]}',
            style: const TextStyle(
                color: kText, fontSize: 13, fontWeight: FontWeight.w800)),
        const Spacer(),
        Text('Sicherheit: ', style: TextStyle(color: kTextMute, fontSize: 11.5)),
        Text(label,
            style: TextStyle(color: color, fontSize: 11.5, fontWeight: FontWeight.w700)),
      ],
    );
  }

  /// Kleiner Hinweis auf der Karte, wenn der Nutzer selbst getippt hat.
  /// Offen = neutral, gewonnen = grün ✅, verloren = rot ❌.
  Widget _betBadge(Wette w) {
    final won = w.gewonnen; // null = offen
    final (Color c, IconData ic, String txt) = won == null
        ? (kTextDim, Icons.how_to_vote_rounded, 'Deine Wette: ${w.tippText}')
        : won
            ? (kAccent, Icons.check_circle_rounded, 'Wette aufgegangen · ${w.tippText}')
            : (kDanger, Icons.cancel_rounded, 'Wette daneben · ${w.tippText}');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(color: c.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(ic, size: 15, color: c),
          const SizedBox(width: 7),
          Expanded(
            child: Text(txt,
                style: TextStyle(
                    color: c, fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  /// Die drei Wahrscheinlichkeiten unter dem Balken: Heim / Unentschieden / Gast.
  Widget _probRow() {
    final pick = _predictedIdx();
    Widget cell(String label, double p, int i, CrossAxisAlignment align) {
      final top = i == pick;
      return Column(
        crossAxisAlignment: align,
        children: [
          Text('${(p * 100).round()} %',
              style: TextStyle(
                color: top ? _accent : kText,
                fontWeight: FontWeight.w800,
                fontSize: 15,
              )),
          const SizedBox(height: 1),
          Text(label,
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  color: top ? kTextDim : kTextMute,
                  fontSize: 11,
                  fontWeight: top ? FontWeight.w700 : FontWeight.w400)),
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
            child: cell(match.home.shortName, probs.home, 0, CrossAxisAlignment.start)),
        Expanded(
            child: Center(
                child: cell('Unent.', probs.draw, 1, CrossAxisAlignment.center))),
        Expanded(
            child: Align(
                alignment: Alignment.centerRight,
                child: cell(match.away.shortName, probs.away, 2, CrossAxisAlignment.end))),
      ],
    );
  }

  Widget _topRow() {
    // Rechts: Status als Pill – LIVE, Anpfiff, Beendet oder Datum.
    Widget statusPill;
    if (match.finished) {
      statusPill = const StatusPill('Beendet', color: kTextMute);
    } else if (live) {
      statusPill = const StatusPill('LIVE', color: kLive, filled: true, icon: Icons.circle);
    } else if (locked) {
      statusPill = const StatusPill('Angepfiffen', color: kWarn, filled: true);
    } else if (match.kickoff != null) {
      statusPill = StatusPill(_fmtDate(match.kickoff!), color: kTextDim);
    } else {
      statusPill = const StatusPill('Termin offen', color: kTextMute);
    }

    // Anstoßzeit auch dann zeigen, wenn die Kartenmitte den Spielstand
    // darstellt (live/angepfiffen/beendet) – dort fiele die Uhrzeit sonst ganz
    // weg, obwohl man gerade da gern sieht, wann das Spiel läuft/lief.
    String? spielzeit;
    if (match.kickoff != null &&
        match.kickoffExact &&
        (match.finished || live || locked)) {
      spielzeit = '${_fmtDate(match.kickoff!)} · ${_fmtTime(match.kickoff!)}';
    }

    final league = match.competition;
    // Bei Turnieren steht hier der Runden-Name (z. B. "Achtelfinale"); bei Ligen
    // der Spieltag aus der Runden-Nummer. Ohne das zeigten K.o.-Runden einen
    // sinnlosen "16. Spieltag" (16 ist dort der Runden-Code, kein Spieltag).
    final spieltag = match.roundLabel ??
        ((match.round >= 1 && match.round < 100) ? '${match.round}. Spieltag' : '');
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Row(
            children: [
              if (league != null && league.isNotEmpty)
                Flexible(
                  child: Text(
                    league,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: _accent, fontSize: 12, fontWeight: FontWeight.w800),
                  ),
                ),
              if (spieltag.isNotEmpty) ...[
                const SizedBox(width: 7),
                Text('· $spieltag',
                    style: const TextStyle(color: kTextMute, fontSize: 11.5)),
              ],
            ],
          ),
        ),
        const SizedBox(width: 6),
        if (spielzeit != null) ...[
          Text(spielzeit,
              style: const TextStyle(color: kTextMute, fontSize: 10.5)),
          const SizedBox(width: 8),
        ],
        statusPill,
      ],
    );
  }

  String _fmtTime(DateTime d) {
    String two(int n) => n < 10 ? '0$n' : '$n';
    return '${two(d.hour)}:${two(d.minute)}';
  }

  // Nur das Datum – die Uhrzeit steht groß in der Kartenmitte.
  String _fmtDate(DateTime d) {
    const wd = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    String two(int n) => n < 10 ? '0$n' : '$n';
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);
    final diff = day.difference(today).inDays;
    if (diff == 0) return 'Heute';
    if (diff == 1) return 'Morgen';
    return '${wd[d.weekday - 1]} ${two(d.day)}.${two(d.month)}.';
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
        style: const TextStyle(
            fontWeight: FontWeight.w700, fontSize: 13.5, color: kText, height: 1.15),
      ),
    );
    final children = alignEnd ? [name, const SizedBox(width: 10), logo]
                              : [logo, const SizedBox(width: 10), name];
    return Row(
      mainAxisAlignment: alignEnd ? MainAxisAlignment.end : MainAxisAlignment.start,
      children: children,
    );
  }

  /// Einheitlicher Logo-Container: feste Größe, object-fit contain, damit kein
  /// Wappen verzerrt oder abgeschnitten wird. Fehlt das Logo, ein sauberer
  /// Platzhalter mit den Initialen.
  Widget _logo() {
    final url = team.badge;
    final fallback = Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: kSurfaceHi,
        shape: BoxShape.circle,
        border: Border.all(color: kBorder),
      ),
      alignment: Alignment.center,
      child: Text(team.initials,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: _accent)),
    );
    if (url == null) return fallback;
    return Container(
      width: 36,
      height: 36,
      padding: const EdgeInsets.all(2),
      decoration: const BoxDecoration(color: kSurfaceHi, shape: BoxShape.circle),
      child: ClipOval(
        child: Image.network(
          url, fit: BoxFit.contain,
          errorBuilder: (c, e, s) => fallback,
          loadingBuilder: (c, child, p) => p == null ? child : fallback,
        ),
      ),
    );
  }
}

/// Detailansicht einer Partie – erreichbar durch Antippen der Karte.
class _MatchDetailSheet extends StatefulWidget {
  final FootyMatch match;
  final MatchProbs probs;
  final List<int> tip;
  final PredictionStore? store; // ohne Store (Demo) wird der Wett-Bereich ausgeblendet
  final VoidCallback? onChanged;
  const _MatchDetailSheet(
      {required this.match,
      required this.probs,
      required this.tip,
      this.store,
      this.onChanged});

  @override
  State<_MatchDetailSheet> createState() => _MatchDetailSheetState();
}

class _MatchDetailSheetState extends State<_MatchDetailSheet> {
  @override
  Widget build(BuildContext context) {
    final match = widget.match;
    final probs = widget.probs;
    final tip = widget.tip;
    final idx = switch (predictedTendency(probs)) {
      Tendency.home => 0,
      Tendency.draw => 1,
      Tendency.away => 2,
    };
    final who = idx == 0
        ? '${match.home.shortName} gewinnt'
        : idx == 2
            ? '${match.away.shortName} gewinnt'
            : 'Unentschieden';
    final conf = ([probs.home, probs.draw, probs.away][idx] * 100).round();
    final (String sLabel, Color sColor) = idx == 1
        ? ('offen', kTextDim)
        : conf >= 70
            ? ('hoch', kAccent)
            : conf >= 58
                ? ('mittel', kWarn)
                : ('gering', kTextDim);

    String head;
    Color headColor;
    if (match.isLive) {
      final min = match.liveMinute;
      head = 'LÄUFT · ${match.homeGoals}:${match.awayGoals}'
          '${min != null ? ' · $min' : ''}';
      headColor = kLive;
    } else if (match.finished && match.hasResult) {
      head = 'Endstand · ${match.homeGoals}:${match.awayGoals}';
      headColor = kTextDim;
    } else if (match.kickoff != null && match.kickoffExact) {
      head = 'Anstoß · ${_fmtFull(match.kickoff!)}';
      headColor = kTextDim;
    } else {
      head = 'Termin noch offen';
      headColor = kTextMute;
    }

    Widget row(String label, String value, {Color? vc}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(color: kTextDim, fontSize: 13)),
              Text(value,
                  style: TextStyle(
                      color: vc ?? kText, fontSize: 13, fontWeight: FontWeight.w700)),
            ],
          ),
        );

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (match.competition != null)
            Text(
              '${match.competition}'
              '${match.roundLabel != null ? ' · ${match.roundLabel}' : (match.round >= 1 && match.round < 100 ? ' · ${match.round}. Spieltag' : '')}',
              style: const TextStyle(
                  color: kAccent, fontSize: 12.5, fontWeight: FontWeight.w800),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _Crest(team: match.home, alignEnd: false)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Text(
                    match.hasResult ? '${match.homeGoals}:${match.awayGoals}' : 'vs',
                    style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: match.isLive ? kLive : kText)),
              ),
              Expanded(child: _Crest(team: match.away, alignEnd: true)),
            ],
          ),
          const SizedBox(height: 10),
          Center(
            child: StatusPill(head,
                color: headColor, filled: match.isLive),
          ),
          // Bei laufenden/beendeten Spielen die Anstoßzeit zusätzlich zeigen –
          // der Kopf oben nennt dann den Spielstand, nicht die Uhrzeit.
          if ((match.isLive || (match.finished && match.hasResult)) &&
              match.kickoff != null &&
              match.kickoffExact) ...[
            const SizedBox(height: 6),
            Center(
              child: Text('Anpfiff ${_fmtFull(match.kickoff!)}',
                  style: const TextStyle(color: kTextMute, fontSize: 11.5)),
            ),
          ],
          const SizedBox(height: 20),
          const Text('KickProphet-Prognose',
              style: TextStyle(
                  color: kText, fontSize: 15, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          ProbBar(
              home: probs.home,
              draw: probs.draw,
              away: probs.away,
              highlight: idx),
          const SizedBox(height: 14),
          row('${match.home.shortName} gewinnt', '${(probs.home * 100).round()} %',
              vc: idx == 0 ? kAccent : kText),
          row('Unentschieden', '${(probs.draw * 100).round()} %',
              vc: idx == 1 ? kAccent : kText),
          row('${match.away.shortName} gewinnt', '${(probs.away * 100).round()} %',
              vc: idx == 2 ? kAccent : kText),
          const Divider(height: 26, color: kBorder),
          row('Wahrscheinlichster Ausgang', who, vc: kAccent),
          row('KickProphet-Tipp', '${tip[0]}:${tip[1]}'),
          row('Prognosesicherheit', sLabel, vc: sColor),
          if (match.finished && match.hasResult) ...[
            const SizedBox(height: 8),
            Builder(builder: (_) {
              final actual = tendencyOf(match.homeGoals!, match.awayGoals!);
              final predicted = idx == 0
                  ? Tendency.home
                  : (idx == 2 ? Tendency.away : Tendency.draw);
              final hit = predicted == actual;
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
                decoration: BoxDecoration(
                  color: (hit ? kAccent : kDanger).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(kRadiusSm),
                ),
                child: Row(children: [
                  Icon(hit ? Icons.check_circle_rounded : Icons.cancel_rounded,
                      color: hit ? kAccent : kDanger, size: 18),
                  const SizedBox(width: 8),
                  Text(hit ? 'Prognose war richtig' : 'Prognose lag daneben',
                      style: TextStyle(
                          color: hit ? kAccent : kDanger,
                          fontWeight: FontWeight.w800)),
                ]),
              );
            }),
          ],
          if (widget.store != null) ...[
            const Divider(height: 26, color: kBorder),
            _wettSection(),
          ],
          const SizedBox(height: 16),
          const Text(
            'Prognose aus statistischen Daten (Team-Stärke, Heimvorteil, Form). '
            'Keine Garantie – Fußball bleibt Fußball. 😉',
            style: TextStyle(color: kTextMute, fontSize: 11.5, height: 1.35),
          ),
        ],
      ),
    );
  }

  /// „Meine Wette" – der Nutzer tippt selbst 1/X/2. Rein lokal, kein Konto,
  /// kein Passwort. Nach Abpfiff rechnet die App am echten Ergebnis ab.
  Widget _wettSection() {
    final store = widget.store!;
    final m = widget.match;
    final w = store.wette(m.id);
    final beendet = m.finished && m.hasResult;

    const header = Text('Meine Wette',
        style: TextStyle(color: kText, fontSize: 15, fontWeight: FontWeight.w800));

    if (beendet) {
      // Nach Abpfiff: nur noch Ergebnis anzeigen, nicht mehr tippbar.
      if (w == null) {
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            header,
            SizedBox(height: 8),
            Text('Für dieses Spiel hast du keinen Tipp abgegeben.',
                style: TextStyle(color: kTextMute, fontSize: 12.5)),
          ],
        );
      }
      final won = w.gewonnen == true;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          header,
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
            decoration: BoxDecoration(
              color: (won ? kAccent : kDanger).withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(kRadiusSm),
            ),
            child: Row(children: [
              Icon(won ? Icons.emoji_events_rounded : Icons.cancel_rounded,
                  color: won ? kAccent : kDanger, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(won ? 'Deine Wette ist aufgegangen! 🎉' : 'Deine Wette lag daneben',
                        style: TextStyle(
                            color: won ? kAccent : kDanger,
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5)),
                    const SizedBox(height: 2),
                    Text('Dein Tipp: ${w.tippText} · Endstand ${w.ergHeim}:${w.ergGast}',
                        style: const TextStyle(color: kTextDim, fontSize: 12)),
                  ],
                ),
              ),
            ]),
          ),
        ],
      );
    }

    // Vor/während des Spiels: 1 / X / 2 wählbar.
    Widget opt(String code, String label) {
      final sel = w?.tipp == code;
      return Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Material(
            color: sel ? kAccent : kSurfaceHi,
            borderRadius: BorderRadius.circular(kRadiusSm),
            child: InkWell(
              borderRadius: BorderRadius.circular(kRadiusSm),
              onTap: () => _setzeTipp(code),
              child: Container(
                constraints: const BoxConstraints(minHeight: 48),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(kRadiusSm),
                  border: Border.all(color: sel ? kAccent : kBorder),
                ),
                child: Text(label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: sel ? kAccentInk : kTextDim,
                        fontWeight: FontWeight.w800,
                        fontSize: 12.5)),
              ),
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        header,
        const SizedBox(height: 4),
        Text(
          w == null
              ? 'Tippe selbst – nach Abpfiff siehst du, ob deine Wette aufging.'
              : 'Dein Tipp: ${w.tippText}. Nochmal tippen zum Ändern oder Entfernen.',
          style: const TextStyle(color: kTextMute, fontSize: 12, height: 1.3),
        ),
        const SizedBox(height: 10),
        Row(children: [
          opt('1', m.home.shortName),
          opt('X', 'Remis'),
          opt('2', m.away.shortName),
        ]),
      ],
    );
  }

  Future<void> _setzeTipp(String code) async {
    final store = widget.store;
    if (store == null) return;
    final m = widget.match;
    final existing = store.wette(m.id);
    if (existing != null && existing.tipp == code) {
      await store.entferneWette(m.id); // gleicher Tipp nochmal = abwählen
    } else {
      await store.setzeWette(Wette(
        matchId: m.id,
        tipp: code,
        heim: m.home.shortName,
        gast: m.away.shortName,
        wettbewerb: m.competition,
        anpfiff: m.kickoff,
      ));
    }
    if (mounted) setState(() {});
    widget.onChanged?.call();
  }

  String _fmtFull(DateTime d) {
    const wd = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    String two(int n) => n < 10 ? '0$n' : '$n';
    return '${wd[d.weekday - 1]} ${two(d.day)}.${two(d.month)}. · ${two(d.hour)}:${two(d.minute)} Uhr';
  }
}

/// „Meine Wetten" – lokale Bilanz aller selbst getippten Spiele.
/// Kein Konto, kein Passwort, kein Anbieter-Login: nur eigene Tipps, die die
/// App am echten Ergebnis abrechnet.
class _WettenSheet extends StatefulWidget {
  final PredictionStore store;
  final VoidCallback? onChanged;
  const _WettenSheet({required this.store, this.onChanged});

  @override
  State<_WettenSheet> createState() => _WettenSheetState();
}

class _WettenSheetState extends State<_WettenSheet> {
  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final b = store.bilanz;
    final list = store.wetten;

    Widget stat(String label, String value, Color c) => Column(
          children: [
            Text(value,
                style: TextStyle(
                    color: c, fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: kTextMute, fontSize: 11.5)),
          ],
        );

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 26),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Meine Wetten',
              style: TextStyle(
                  color: kText, fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          const Text(
            'Deine eigenen Tipps – gespeichert nur auf diesem Gerät. '
            'Kein Konto, kein Login, keine Verbindung zu Wett-Anbietern.',
            style: TextStyle(color: kTextMute, fontSize: 12, height: 1.35),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(kRadius),
              border: Border.all(color: kBorder),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                stat('Gewonnen', '${b.gewonnen}', kAccent),
                stat('Verloren', '${b.verloren}', kDanger),
                stat('Offen', '${b.offen}', kTextDim),
                stat('Trefferquote',
                    b.gesamt == 0 ? '–' : '${(b.quote * 100).round()} %', kText),
              ],
            ),
          ),
          const SizedBox(height: 18),
          if (list.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 22),
              child: Center(
                child: Column(
                  children: const [
                    Icon(Icons.receipt_long_rounded, size: 40, color: kTextMute),
                    SizedBox(height: 10),
                    Text('Noch keine Wette abgegeben.',
                        style: TextStyle(color: kTextDim, fontSize: 13.5,
                            fontWeight: FontWeight.w700)),
                    SizedBox(height: 4),
                    Text('Öffne ein Spiel und tippe unter „Meine Wette".',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: kTextMute, fontSize: 12)),
                  ],
                ),
              ),
            )
          else
            ...list.map(_wetteRow),
        ],
      ),
    );
  }

  Widget _wetteRow(Wette w) {
    final won = w.gewonnen; // null = offen
    final (Color c, IconData ic, String status) = won == null
        ? (kTextDim, Icons.schedule_rounded, 'offen')
        : won
            ? (kAccent, Icons.check_circle_rounded, 'gewonnen')
            : (kDanger, Icons.cancel_rounded, 'verloren');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          Icon(ic, color: c, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${w.heim} – ${w.gast}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: kText, fontSize: 13.5, fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(
                  'Tipp: ${w.tippText}'
                  '${w.abgerechnet ? ' · Endstand ${w.ergHeim}:${w.ergGast}' : ''}'
                  '${w.wettbewerb != null ? ' · ${w.wettbewerb}' : ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: kTextMute, fontSize: 11.5),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(status,
              style: TextStyle(color: c, fontSize: 11.5, fontWeight: FontWeight.w800)),
          IconButton(
            tooltip: 'Wette entfernen',
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.close_rounded, size: 16, color: kTextMute),
            onPressed: () async {
              await widget.store.entferneWette(w.matchId);
              if (mounted) setState(() {});
              widget.onChanged?.call();
            },
          ),
        ],
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

    // Brier-Score misst die Güte der Wahrscheinlichkeiten (0 = perfekt,
    // ~0,67 = Raten). Als Note relativ zum Raten-Nullpunkt.
    final brier = store.brierScore;
    final (String brierLabel, Color brierColor) = brier == null
        ? ('–', kTextDim)
        : brier <= 0.58
            ? ('sehr gut', kAccent)
            : brier <= 0.62
                ? ('gut', kAccent)
                : brier <= 0.66
                    ? ('solide', kWarn)
                    : ('noch dünn', kTextDim);

    final ligaB = store.ligaBilanz;
    final kal = store.kalibrierung;

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
            _stat(brier == null ? '–' : brier.toStringAsFixed(2), 'Brier-Score',
                sub: brierLabel, subColor: brierColor),
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
                'Der Brier-Score misst, wie gut die Wahrscheinlichkeiten sind '
                '(0 = perfekt, ~0,67 = blindes Raten – kleiner ist besser). Die '
                'Kalibrierung zeigt: sagt das Modell „70 %", tritt es dann auch in '
                'rund 70 % der Fälle ein? Es lernt aus jedem Ergebnis weiter. '
                'Garantien gibt es im Fußball nie. 😉',
                style: TextStyle(color: Colors.white60, fontSize: 12),
              ),
            ]),
          ),
          if (kal.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text('Kalibrierung (Prognose vs. Realität)',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
            const SizedBox(height: 4),
            const Text('Wie oft trifft ein, was das Modell mit dieser Sicherheit ansagt.',
                style: TextStyle(color: Colors.white54, fontSize: 11.5)),
            const SizedBox(height: 10),
            for (final k in kal) _kalRow(k.label, k.hits, k.total),
          ],
          if (ligaB.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text('Treffsicherheit je Liga',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
            const SizedBox(height: 10),
            for (final l in ligaB) _ligaRow(l.liga, l.hits, l.total),
          ],
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

  /// Eine Kalibrierungszeile: Sicherheits-Korb + tatsächliche Trefferquote,
  /// mit Balken. Bei genügend Spielen zeigt der Balken, wie nah Prognose und
  /// Realität beieinander liegen.
  Widget _kalRow(String label, int hits, int total) {
    final observed = total == 0 ? 0.0 : hits / total;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            SizedBox(
              width: 84,
              child: Text('Sagt $label',
                  style: const TextStyle(color: Colors.white70, fontSize: 12.5)),
            ),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: observed.clamp(0.0, 1.0),
                  minHeight: 8,
                  backgroundColor: kSurfaceHi,
                  valueColor: const AlwaysStoppedAnimation(_accent),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 64,
              child: Text('${(observed * 100).round()} % · $total×',
                  textAlign: TextAlign.end,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800)),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _ligaRow(String liga, int hits, int total) {
    final pct = total == 0 ? 0 : (hits / total * 100).round();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Expanded(
          child: Text(liga,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ),
        Text('$pct %',
            style: const TextStyle(color: _accent, fontWeight: FontWeight.w800)),
        const SizedBox(width: 6),
        Text('($total)', style: const TextStyle(color: Colors.white38, fontSize: 12)),
      ]),
    );
  }

  Widget _stat(String value, String label, {String? sub, Color? subColor}) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: kBorderHi),
        ),
        child: Column(children: [
          Text(value,
              style: const TextStyle(
                  color: _accent, fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white60, fontSize: 11)),
          if (sub != null) ...[
            const SizedBox(height: 3),
            Text(sub,
                style: TextStyle(
                    color: subColor ?? Colors.white60,
                    fontSize: 11,
                    fontWeight: FontWeight.w800)),
          ],
        ]),
      ),
    );
  }
}
