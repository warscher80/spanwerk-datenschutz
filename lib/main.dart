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
import 'stats.dart';
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
  late final EloModel _elo = EloModel(_store.elo, form: _store.eloForm);
  SeasonLearner? _learner;

  int _leagueIdx = 0;
  int _tab = 0; // 0 Heute · 1 Ligen · 2 Bilanz · 3 Mehr
  int _lastRealLeague = 0; // zuletzt gewählte echte Liga (für den Ligen-Tab)
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
    if (_leagueIdx >= 0) _lastRealLeague = _leagueIdx;
    _tab = _leagueIdx < 0 ? 0 : 1; // Aktuell -> Heute, sonst -> Ligen
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
      kind: _league.cupKind,
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
    if (idx >= 0) _lastRealLeague = idx;
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

  /// Rechtliche Hinweise: Haftungsausschluss, Datenschutz, Impressum.
  void _openRechtliches() {
    showModalBottomSheet(
      context: context,
      backgroundColor: kSurfaceTop,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => const _LegalSheet(),
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
          // WM-Extras (Baum + Titelchancen) nur beim WM-Format – für den
          // Europapokal passt die Runden-/Bracket-Logik nicht.
          if (_tab == 1 && _isCup && _league.istWMFormat)
            IconButton(
              tooltip: 'WM-Baum',
              onPressed: _openBracket,
              icon: const Icon(Icons.account_tree_rounded),
            ),
          if (_tab == 1 && _isCup && _league.istWMFormat)
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
        ],
      ),
      body: SafeArea(top: false, child: _tabInhalt()),
      bottomNavigationBar: _bottomNav(),
    );
  }

  /// Inhalt je Tab. Heute/Ligen teilen sich die Spiele-Ansicht (nur der
  /// Wettbewerb bzw. die Chip-Leiste unterscheidet sich), Bilanz und Mehr sind
  /// eigenständige Vollbild-Ansichten. So bleiben alle Funktionen erhalten.
  Widget _tabInhalt() {
    switch (_tab) {
      case 2:
        return _maxW(_StatsSheet(store: _store));
      case 3:
        return _maxW(_mehrView());
      case 1: // Ligen
        return Column(
          children: [
            if (_update != null) _updateBanner(_update!),
            _leagueChips(nurLigen: true),
            if (!_isCup) _dayNav(),
            _statusBar(),
            _nivoxBrand(),
            Expanded(child: _body()),
            _DisclaimerBar(onTap: () => setState(() => _tab = 3)),
          ],
        );
      default: // 0 Heute
        return Column(
          children: [
            if (_update != null) _updateBanner(_update!),
            _statusBar(),
            _nivoxBrand(),
            Expanded(child: _body()),
            _DisclaimerBar(onTap: () => setState(() => _tab = 3)),
          ],
        );
    }
  }

  /// Moderne Bottom-Navigation. Aktiver Tab klar hervorgehoben.
  Widget _bottomNav() {
    return NavigationBarTheme(
      data: NavigationBarThemeData(
        backgroundColor: kSurfaceTop,
        indicatorColor: kAccent.withValues(alpha: 0.18),
        labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: s.contains(WidgetState.selected) ? kAccent : kTextMute,
            )),
        iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
              size: 24,
              color: s.contains(WidgetState.selected) ? kAccent : kTextMute,
            )),
      ),
      child: NavigationBar(
        height: 64,
        backgroundColor: kSurfaceTop,
        surfaceTintColor: Colors.transparent,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        selectedIndex: _tab,
        onDestinationSelected: _selectTab,
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.today_outlined),
              selectedIcon: Icon(Icons.today_rounded),
              label: 'Heute'),
          NavigationDestination(
              icon: Icon(Icons.emoji_events_outlined),
              selectedIcon: Icon(Icons.emoji_events_rounded),
              label: 'Ligen'),
          NavigationDestination(
              icon: Icon(Icons.insights_outlined),
              selectedIcon: Icon(Icons.insights_rounded),
              label: 'Bilanz'),
          NavigationDestination(
              icon: Icon(Icons.more_horiz_rounded),
              selectedIcon: Icon(Icons.more_horiz_rounded),
              label: 'Mehr'),
        ],
      ),
    );
  }

  /// Dezenter „powered by NIVOX"-Credit unter der Statusleiste.
  Widget _nivoxBrand() {
    return Container(
      width: double.infinity,
      color: kBg,
      padding: const EdgeInsets.fromLTRB(0, 6, 0, 7),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('powered by',
              style: TextStyle(
                  color: kTextMute,
                  fontSize: 9,
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 3),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Image.asset(
              'assets/nivox_logo.jpg',
              height: 26,
              filterQuality: FilterQuality.medium,
              // Falls das Asset fehlt: einfach nichts anzeigen, nie die App stören.
              errorBuilder: (c, e, s) => const SizedBox.shrink(),
            ),
          ),
        ],
      ),
    );
  }

  void _selectTab(int t) {
    if (t == _tab) {
      // Erneutes Antippen von „Heute" bringt die aktuellen Spiele frisch.
      if (t == 0) _autoRefresh();
      return;
    }
    setState(() => _tab = t);
    // Heute = Aktuell, Ligen = zuletzt gewählte Liga (kein Doppel-Laden dank
    // Guard in _changeLeague).
    if (t == 0 && !_currentMode) {
      _changeLeague(-1);
    } else if (t == 1 && _currentMode) {
      _changeLeague(_lastRealLeague);
    }
  }

  /// „Mehr"-Tab: Einstellungen, eigene Wetten, Rechtliches, App-Info.
  Widget _mehrView() {
    Widget kachel({
      required IconData icon,
      required String titel,
      String? unterzeile,
      Widget? trailing,
      VoidCallback? onTap,
    }) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Material(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRadius),
          child: InkWell(
            borderRadius: BorderRadius.circular(kRadius),
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(kRadius),
                border: Border.all(color: kBorder),
              ),
              child: Row(
                children: [
                  Icon(icon, size: 20, color: kAccent),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(titel,
                            style: const TextStyle(
                                color: kText,
                                fontSize: 14,
                                fontWeight: FontWeight.w700)),
                        if (unterzeile != null) ...[
                          const SizedBox(height: 2),
                          Text(unterzeile,
                              style: const TextStyle(
                                  color: kTextMute, fontSize: 12)),
                        ],
                      ],
                    ),
                  ),
                  trailing ??
                      const Icon(Icons.chevron_right_rounded, color: kTextMute),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 24),
      children: [
        const Text('Mehr',
            style: TextStyle(
                color: kText, fontSize: 20, fontWeight: FontWeight.w900)),
        const SizedBox(height: 16),
        kachel(
          icon: Icons.notifications_active_rounded,
          titel: 'Benachrichtigungen',
          unterzeile: 'Erinnerung vor Anpfiff',
          trailing: Switch(
            value: _store.remindersEnabled,
            activeThumbColor: kAccentInk,
            activeTrackColor: kAccent,
            onChanged: (_) => _toggleReminders(),
          ),
          onTap: _toggleReminders,
        ),
        kachel(
          icon: Icons.receipt_long_rounded,
          titel: 'Meine Wetten',
          unterzeile: 'Deine eigenen Tipps & Bilanz',
          onTap: _openWetten,
        ),
        kachel(
          icon: Icons.insights_rounded,
          titel: 'Prophet Bilanz',
          unterzeile: 'Treffsicherheit des Modells',
          onTap: () => setState(() => _tab = 2),
        ),
        if (_update != null)
          kachel(
            icon: Icons.system_update_rounded,
            titel: 'App-Update verfügbar',
            unterzeile: 'Neue Version v${_update!.versionName} laden',
            onTap: () => _downloadUpdate(_update!),
          ),
        kachel(
          icon: Icons.gavel_rounded,
          titel: 'Rechtliches',
          unterzeile: 'Datenschutz & Haftungsausschluss',
          onTap: _openRechtliches,
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: kSurfaceTop,
            borderRadius: BorderRadius.circular(kRadius),
            border: Border.all(color: kBorder),
          ),
          child: const Text(
            'KickProphet · Datenbasierte Fußball-Prognosen.\n'
            'Statistische Prognosen zu Informations- und Unterhaltungszwecken – '
            'keine Garantie für echte Ergebnisse. Keine Wetten, kein Echtgeld.',
            style: TextStyle(color: kTextMute, fontSize: 11.5, height: 1.4),
          ),
        ),
      ],
    );
  }

  final ScrollController _chipCtrl = ScrollController();

  /// Wettbewerbs-Auswahl als horizontale Chip-Leiste (mobil daumenfreundlich,
  /// kein sperriges Dropdown). „Aktuell" führt die Liste an. Antippen über
  /// InkWell (mit Feedback), horizontales Wischen per Touch UND Maus/Trackpad.
  Widget _leagueChips({bool nurLigen = false}) {
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
              if (!nurLigen) chip(-1, 'Aktuell', icon: Icons.circle),
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
    String two(int n) => n.toString().padLeft(2, '0');
    final right = u == null
        ? ''
        : 'Stand ${two(u.day)}.${two(u.month)}.${u.year} · ${two(u.hour)}:${two(u.minute)} Uhr';
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
          Flexible(
            child: Text(right,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.end,
                style: const TextStyle(color: kTextMute, fontSize: 11)),
          ),
        ],
      ),
    );
  }

  /// „🔥 Top Prognosen heute" – die sichersten bevorstehenden Prognosen aus den
  /// geladenen Spielen (nur echte Modellwerte, keine Erfindungen). Erscheint nur
  /// bei ausreichend hoher Datensicherheit (≥ 65 %) und genügend Kandidaten.
  Widget _topPrognosen() {
    final cand = <({FootyMatch m, MatchProbs p, int idx, int conf})>[];
    for (final m in _matches) {
      if (m.finished || m.isLive || m.istGestoert) continue; // nur reguläre, bevorstehende
      // Datenbasis: nur Prognosen zeigen, deren beide Teams das Modell
      // wirklich GELERNT hat (nicht bloß der Start-Schätzwert). Sonst stünde
      // eine hohe Prozentzahl auf dünner Datenlage ganz oben.
      if (!_elo.knows(m.home.name) || !_elo.knows(m.away.name)) continue;
      final p = _cardProbs[m.id] ??
          _elo.probs(m.home.name, m.away.name, neutral: m.neutralVenue);
      final t = predictedTendency(p);
      if (t == Tendency.draw) continue;
      final idx = t == Tendency.home ? 0 : 2;
      final (hp, dp, ap) = prozente100(p);
      final conf = [hp, dp, ap][idx];
      if (conf < 65) continue;
      cand.add((m: m, p: p, idx: idx, conf: conf));
    }
    if (cand.length < 2) return const SizedBox.shrink();
    cand.sort((a, b) => b.conf.compareTo(a.conf));
    final top = cand.take(6).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(14, 14, 14, 8),
          child: Text('🔥 Top Prognosen heute',
              style: TextStyle(
                  color: kText, fontSize: 15, fontWeight: FontWeight.w800)),
        ),
        SizedBox(
          height: 96,
          child: ScrollConfiguration(
            behavior: const _DragScrollBehavior(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: top.length,
              separatorBuilder: (context, index) => const SizedBox(width: 10),
              itemBuilder: (c, i) {
                final e = top[i];
                final wer = e.idx == 0
                    ? e.m.home.shortName
                    : e.m.away.shortName;
                final t = tippFromProbs(e.p);
                return _TopPrognoseCard(
                  liga: e.m.competition ?? '',
                  wer: wer,
                  conf: e.conf,
                  onTap: () => _openMatchDetail(e.m, e.p, t),
                );
              },
            ),
          ),
        ),
      ],
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
    final display = _orderedMatches();
    return RefreshIndicator(
      color: _accent,
      backgroundColor: kSurface,
      onRefresh: _loadDay,
      child: _maxW(ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
        itemCount: display.length + 1,
        itemBuilder: (c, i) {
          if (i == 0) {
            return _currentMode
                ? Column(children: [_topPrognosen(), _summaryStrip()])
                : const SizedBox(height: 12);
          }
          final m = display[i - 1];
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
            favHome: _store.istFavorit(m.home.name),
            favAway: _store.istFavorit(m.away.name),
            onTap: () => _openMatchDetail(m, p, t),
          );
        },
      )),
    );
  }

  /// In der Ansicht „Aktuell" Spiele mit einem Lieblingsteam nach oben ziehen
  /// (sonst unverändert, nach Anstoß sortiert) – „schneller auffindbar".
  List<FootyMatch> _orderedMatches() {
    if (!_currentMode || !_store.hatFavoriten) return _matches;
    final fav = <FootyMatch>[];
    final rest = <FootyMatch>[];
    for (final m in _matches) {
      if (_store.istFavorit(m.home.name) || _store.istFavorit(m.away.name)) {
        fav.add(m);
      } else {
        rest.add(m);
      }
    }
    return [...fav, ...rest];
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
/// Garantie. Antippen öffnet die rechtlichen Hinweise.
class _DisclaimerBar extends StatelessWidget {
  final VoidCallback? onTap;
  const _DisclaimerBar({this.onTap});
  @override
  Widget build(BuildContext context) {
    return Material(
      color: kSurfaceTop,
      child: InkWell(
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
          child: const Text.rich(
            TextSpan(children: [
              TextSpan(
                  text:
                      'Statistische Prognosen zu Informations- und Unterhaltungszwecken – keine Garantie für echte Ergebnisse. Keine Wetten, kein Echtgeld.  '),
              TextSpan(
                  text: 'Rechtliches ›',
                  style: TextStyle(color: kAccent, fontWeight: FontWeight.w700)),
            ]),
            textAlign: TextAlign.center,
            style: TextStyle(color: kTextMute, fontSize: 10.5, height: 1.3),
          ),
        ),
      ),
    );
  }
}

/// Rechtliche Hinweise. Bewusst nüchtern und korrekt: keine Garantie-Versprechen,
/// ehrliche Datenschutz-Angaben (lokale Speicherung, Drittquelle, GitHub-Hosting).
class _LegalSheet extends StatelessWidget {
  const _LegalSheet();

  @override
  Widget build(BuildContext context) {
    Widget h(String t) => Padding(
          padding: const EdgeInsets.only(top: 18, bottom: 8),
          child: Text(t,
              style: const TextStyle(
                  color: kText, fontSize: 16, fontWeight: FontWeight.w800)),
        );
    Widget p(String t) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(t,
              style: const TextStyle(color: kTextDim, fontSize: 12.5, height: 1.45)),
        );
    Widget bullet(String t) => Padding(
          padding: const EdgeInsets.only(bottom: 6, left: 2),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('•  ', style: TextStyle(color: kAccent, fontSize: 12.5)),
            Expanded(
              child: Text(t,
                  style: const TextStyle(color: kTextDim, fontSize: 12.5, height: 1.45)),
            ),
          ]),
        );

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Rechtliches',
              style: TextStyle(
                  color: kText, fontSize: 20, fontWeight: FontWeight.w900)),
          h('Haftungsausschluss'),
          p('KickProphet stellt statistische Fußball-Prognosen bereit. Prognosen '
              'dienen ausschließlich Informations- und Unterhaltungszwecken und '
              'stellen keine Garantie für tatsächliche Spielergebnisse dar.'),
          p('Es handelt sich um keine Aufforderung zur Teilnahme an Wetten oder '
              'Glücksspielen. KickProphet bietet kein Echtgeld an und wickelt keine '
              'Wetten ab. Für Richtigkeit, Vollständigkeit und Aktualität der '
              'angezeigten Daten wird keine Gewähr übernommen; die Nutzung erfolgt '
              'auf eigene Verantwortung.'),
          h('Datenschutz'),
          bullet('Keine Benutzerkonten, keine Registrierung, kein Login.'),
          bullet('Einstellungen, der Lernstand des Modells und deine eigenen Tipps '
              'werden ausschließlich lokal auf deinem Gerät gespeichert '
              '(Browser-Speicher bzw. App-Speicher). Diese Daten verlassen dein '
              'Gerät nicht und werden nicht an uns übertragen.'),
          bullet('Kein Tracking, keine Analyse-Cookies, keine Werbung.'),
          bullet('Fußballdaten stammen von TheSportsDB (thesportsdb.com). Beim Laden '
              'werden Anfragen an deren Server gestellt; dabei ist technisch bedingt '
              'deine IP-Adresse sichtbar. Es gilt deren Datenschutzerklärung.'),
          bullet('Das Hosting erfolgt über GitHub Pages (GitHub, Inc., ein Unternehmen '
              'von Microsoft). Beim Aufruf verarbeitet GitHub technisch notwendige '
              'Server-Protokolle einschließlich der IP-Adresse. Es gilt die '
              'Datenschutzerklärung von GitHub.'),
          bullet('Rechtsgrundlage ist das berechtigte Interesse an einer sicheren, '
              'funktionsfähigen Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO).'),
          bullet('Lokale Daten kannst du jederzeit selbst löschen – über die '
              'Browser-Einstellungen bzw. durch Entfernen der App.'),
          h('Impressum'),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: kWarn.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(kRadiusSm),
              border: Border.all(color: kWarn.withValues(alpha: 0.4)),
            ),
            child: const Text(
              'Angaben gemäß § 5 TMG / § 5 ECG werden vom Betreiber ergänzt:\n\n'
              '[Name / Verantwortliche Person]\n'
              '[Anschrift]\n'
              '[E-Mail-Adresse]\n\n'
              'Hinweis: Diese Felder muss der Betreiber mit seinen echten Daten '
              'ausfüllen, bevor die App öffentlich beworben wird.',
              style: TextStyle(color: kTextDim, fontSize: 12, height: 1.5),
            ),
          ),
          const SizedBox(height: 6),
        ],
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

/// Kleine Karte in „Top Prognosen heute": Favorit + Siegwahrscheinlichkeit.
class _TopPrognoseCard extends StatelessWidget {
  final String liga;
  final String wer;
  final int conf;
  final VoidCallback onTap;
  const _TopPrognoseCard(
      {required this.liga,
      required this.wer,
      required this.conf,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: kSurface,
      borderRadius: BorderRadius.circular(kRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(kRadius),
        child: Container(
          width: 178,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(kRadius),
            border: Border.all(color: kAccent.withValues(alpha: 0.35)),
            gradient: LinearGradient(
              colors: [kAccent.withValues(alpha: 0.12), kSurface],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (liga.isNotEmpty)
                Text(liga,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: kAccent, fontSize: 10.5, fontWeight: FontWeight.w800)),
              const Spacer(),
              Text(wer,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      color: kText, fontSize: 15, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text('$conf %',
                      style: const TextStyle(
                          color: kAccent, fontSize: 22, fontWeight: FontWeight.w900)),
                  const SizedBox(width: 6),
                  const Padding(
                    padding: EdgeInsets.only(bottom: 3),
                    child: Text('Sieg',
                        style: TextStyle(color: kTextMute, fontSize: 12)),
                  ),
                ],
              ),
            ],
          ),
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
  final bool favHome;
  final bool favAway;

  const _MatchCard({
    required this.match,
    required this.now,
    required this.probs,
    required this.tip,
    this.topPadding = 0,
    this.onTap,
    this.bet,
    this.favHome = false,
    this.favAway = false,
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
                    Expanded(child: _Crest(team: match.home, alignEnd: false, fav: favHome)),
                    _center(),
                    Expanded(child: _Crest(team: match.away, alignEnd: true, fav: favAway)),
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
    final idx = _predictedIdx();
    final who = idx == 0
        ? '${match.home.shortName} gewinnt'
        : idx == 2
            ? '${match.away.shortName} gewinnt'
            : 'Unentschieden';
    final (int ph, int pd, int pa) = prozente100(probs);
    final conf = [ph, pd, pa][idx];
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
  /// Ganzzahlige Prozente über prozente100 -> Summe immer exakt 100 %.
  Widget _probRow() {
    final pick = _predictedIdx();
    final (ph, pd, pa) = prozente100(probs);
    Widget cell(String label, int pct, int i, CrossAxisAlignment align) {
      final top = i == pick;
      return Column(
        crossAxisAlignment: align,
        children: [
          Text('$pct %',
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
            child: cell(match.home.shortName, ph, 0, CrossAxisAlignment.start)),
        Expanded(
            child: Center(
                child: cell('Unent.', pd, 1, CrossAxisAlignment.center))),
        Expanded(
            child: Align(
                alignment: Alignment.centerRight,
                child: cell(match.away.shortName, pa, 2, CrossAxisAlignment.end))),
      ],
    );
  }

  Widget _topRow() {
    // Rechts: Status als Pill – gestörte Spiele (verschoben/abgesagt/
    // unterbrochen) zuerst und klar, sonst LIVE/Anpfiff/Beendet/Datum.
    Widget statusPill;
    if (match.istAbgesagt) {
      statusPill = const StatusPill('Abgesagt', color: kDanger, filled: true);
    } else if (match.istVerschoben) {
      statusPill = const StatusPill('Verschoben', color: kWarn, filled: true);
    } else if (match.istUnterbrochen) {
      statusPill = const StatusPill('Unterbrochen', color: kWarn, filled: true);
    } else if (match.finished) {
      statusPill = const StatusPill('Beendet', color: kTextMute);
    } else if (live) {
      statusPill = StatusPill(match.istHalbzeit ? 'HALBZEIT' : 'LIVE',
          color: kLive, filled: true, icon: Icons.circle);
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
  final bool fav;
  const _Crest({required this.team, required this.alignEnd, this.fav = false});

  @override
  Widget build(BuildContext context) {
    final logo = _logo();
    final label = Text(
      team.shortName,
      textAlign: alignEnd ? TextAlign.right : TextAlign.left,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(
          fontWeight: FontWeight.w700, fontSize: 13.5, color: kText, height: 1.15),
    );
    const star = Padding(
      padding: EdgeInsets.symmetric(horizontal: 3),
      child: Icon(Icons.star_rounded, size: 13, color: kWarn),
    );
    final name = Flexible(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment:
            alignEnd ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: alignEnd
            ? [Flexible(child: label), if (fav) star]
            : [if (fav) star, Flexible(child: label)],
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
  TeamForm? _formHeim;
  TeamForm? _formGast;
  bool _formLaedt = true;
  bool _formFehler = false;

  @override
  void initState() {
    super.initState();
    _ladeForm();
  }

  Future<void> _ladeForm() async {
    try {
      final r = await Future.wait([
        Api.teamForm(widget.match.home.id),
        Api.teamForm(widget.match.away.id),
      ]);
      if (!mounted) return;
      setState(() {
        _formHeim = r[0];
        _formGast = r[1];
        _formLaedt = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _formLaedt = false;
        _formFehler = true;
      });
    }
  }

  /// Datengüte (0..1) für den Score: wie belastbar ist die Basis?
  /// Beide Teams tatsächlich gelernt + aktuelle Form vorhanden = 1,0.
  double _datenGuete() {
    var g = 0.0;
    final store = widget.store;
    final h = widget.match.home.name, a = widget.match.away.name;
    if (store != null) {
      final kh = store.elo.containsKey(h), ka = store.elo.containsKey(a);
      g += kh && ka ? 0.6 : (kh || ka ? 0.3 : 0.0);
    }
    final fh = _formHeim, fg = _formGast;
    final bh = fh != null && fh.genugDaten, bg = fg != null && fg.genugDaten;
    g += bh && bg ? 0.4 : (bh || bg ? 0.2 : 0.0);
    return g.clamp(0.0, 1.0);
  }

  /// Zustimmung der jüngsten Form zur Modell-Tendenz (−1..+1) für den Score.
  double _formZustimmung(int idx) {
    final h = _formHeim, g = _formGast;
    if (h == null || g == null || !h.genugDaten || !g.genugDaten) return 0;
    final diff = (h.punkteProSpiel - g.punkteProSpiel) / 3.0; // −1..+1
    if (idx == 0) return diff; // Heim vorhergesagt
    if (idx == 2) return -diff; // Gast vorhergesagt
    return -diff.abs() * 0.5; // Remis: klare Formdifferenz spricht dagegen
  }

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
    // Ganzzahlige Prozente, die exakt 100 ergeben – überall dieselbe Quelle.
    final (int pph, int ppd, int ppa) = prozente100(probs);
    final prozent = [pph, ppd, ppa];
    final conf = prozent[idx];
    final (String sLabel, Color sColor) = idx == 1
        ? ('offen', kTextDim)
        : conf >= 70
            ? ('hoch', kAccent)
            : conf >= 58
                ? ('mittel', kWarn)
                : ('gering', kTextDim);

    final score = kickProphetScore(probs,
        formZustimmung: _formZustimmung(idx), datenGuete: _datenGuete());
    final band = kickProphetBand(score);

    String head;
    Color headColor;
    if (match.istAbgesagt) {
      head = 'Spiel abgesagt';
      headColor = kDanger;
    } else if (match.istVerschoben) {
      head = 'Spiel verschoben';
      headColor = kWarn;
    } else if (match.istUnterbrochen) {
      head = 'Spiel unterbrochen';
      headColor = kWarn;
    } else if (match.isLive) {
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
          if (widget.store != null) ...[
            const SizedBox(height: 14),
            _favRow(),
          ],
          const SizedBox(height: 18),
          _scoreBlock(score, band, who),
          const SizedBox(height: 20),
          const Text('KickProphet-Prognose',
              style: TextStyle(
                  color: kText, fontSize: 15, fontWeight: FontWeight.w800)),
          if (!match.finished &&
              (match.isLive || match.startedBy(DateTime.now()))) ...[
            const SizedBox(height: 4),
            const Text('Prognose von vor dem Anpfiff – das Spiel läuft bereits.',
                style: TextStyle(color: kLive, fontSize: 11.5)),
          ],
          const SizedBox(height: 12),
          ProbBar(
              home: probs.home,
              draw: probs.draw,
              away: probs.away,
              highlight: idx),
          const SizedBox(height: 14),
          row('${match.home.shortName} gewinnt', '$pph %',
              vc: idx == 0 ? kAccent : kText),
          row('Unentschieden', '$ppd %',
              vc: idx == 1 ? kAccent : kText),
          row('${match.away.shortName} gewinnt', '$ppa %',
              vc: idx == 2 ? kAccent : kText),
          const Divider(height: 26, color: kBorder),
          row('Wahrscheinlichster Ausgang', who, vc: kAccent),
          row('KickProphet-Tipp', '${tip[0]}:${tip[1]}'),
          row('Prognosesicherheit', sLabel, vc: sColor),
          const SizedBox(height: 18),
          _analyseSection(idx),
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

  /// Lieblingsteams an-/abwählen (lokal). Favorisierte Teams erscheinen in
  /// „Aktuell" oben und tragen einen Stern auf der Karte.
  Widget _favRow() {
    final store = widget.store!;
    // Schlüssel ist der VOLLE Teamname (wie in den Spieldaten), angezeigt wird
    // der Kurzname – sonst würde der Stern auf der Karte nicht übereinstimmen.
    Widget chip(String key, String label) {
      final on = store.istFavorit(key);
      return Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Material(
            color: on ? kWarn.withValues(alpha: 0.16) : kSurfaceHi,
            borderRadius: BorderRadius.circular(kRadiusSm),
            child: InkWell(
              borderRadius: BorderRadius.circular(kRadiusSm),
              onTap: () async {
                await store.toggleFavorit(key);
                if (mounted) setState(() {});
                widget.onChanged?.call();
              },
              child: Container(
                constraints: const BoxConstraints(minHeight: 44),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(kRadiusSm),
                  border: Border.all(color: on ? kWarn : kBorder),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(on ? Icons.star_rounded : Icons.star_border_rounded,
                        size: 16, color: on ? kWarn : kTextDim),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              color: on ? kText : kTextDim,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Row(children: [
      chip(widget.match.home.name, widget.match.home.shortName),
      chip(widget.match.away.name, widget.match.away.shortName),
    ]);
  }

  /// Prominenter KickProphet-Score mit sanfter Hochzähl-Animation.
  Widget _scoreBlock(
      int score, ({String label, String hinweis}) band, String who) {
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final Color c = score >= 60 ? kAccent : (score >= 40 ? kWarn : kTextDim);
    final emoji = score >= 80 ? '🔥 ' : '';
    Widget zahl(String s) => Text(s,
        style: TextStyle(
            fontSize: 40, fontWeight: FontWeight.w900, color: c, height: 1));
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [c.withValues(alpha: 0.18), kSurfaceHi],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(kRadius),
        border: Border.all(color: c.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 74,
            child: reduce
                ? zahl('$score')
                : TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: score.toDouble()),
                    duration: const Duration(milliseconds: 900),
                    curve: Curves.easeOutCubic,
                    builder: (context, v, child) => zahl('${v.round()}'),
                  ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${emoji}KickProphet Score',
                    style: const TextStyle(
                        color: kTextDim,
                        fontSize: 12,
                        fontWeight: FontWeight.w800)),
                const SizedBox(height: 3),
                Text(band.label,
                    style: TextStyle(
                        color: c, fontSize: 17, fontWeight: FontWeight.w900)),
                const SizedBox(height: 2),
                Text('$who · ${band.hinweis}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: kTextMute, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Analyse-Block: echte Form/Tore + „Warum diese Prognose".
  /// Zeigt nur, was die Datenquelle wirklich liefert – nichts Erfundenes.
  Widget _analyseSection(int idx) {
    final h = _formHeim, g = _formGast;
    const heading = Text('Analyse',
        style:
            TextStyle(color: kText, fontSize: 15, fontWeight: FontWeight.w800));

    Widget inhalt;
    if (_formLaedt) {
      inhalt = _formSkeleton();
    } else if (_formFehler) {
      inhalt = _analyseHinweis('Formdaten konnten momentan nicht geladen werden.');
    } else if ((h == null || !h.genugDaten) && (g == null || !g.genugDaten)) {
      inhalt = _analyseHinweis(
          'Für dieses Spiel stehen aktuell noch nicht genügend Formdaten zur Verfügung.');
    } else {
      inhalt = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _teamFormCard(widget.match.home.shortName, h)),
              const SizedBox(width: 10),
              Expanded(child: _teamFormCard(widget.match.away.shortName, g)),
            ],
          ),
          const SizedBox(height: 14),
          _warumSection(idx, h, g),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [heading, const SizedBox(height: 10), inhalt],
    );
  }

  Widget _analyseHinweis(String text) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRadiusSm),
          border: Border.all(color: kBorder),
        ),
        child: Text(text,
            style: const TextStyle(color: kTextMute, fontSize: 12.5, height: 1.3)),
      );

  Widget _formSkeleton() => Row(
        children: [
          for (var i = 0; i < 2; i++) ...[
            Expanded(
              child: Container(
                height: 96,
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(kRadiusSm),
                  border: Border.all(color: kBorder),
                ),
              ),
            ),
            if (i == 0) const SizedBox(width: 10),
          ],
        ],
      );

  /// Kleine Form-Karte eines Teams: Kürzel, Form-Punkte, Ø Tore/Gegentore.
  Widget _teamFormCard(String name, TeamForm? f) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  color: kText, fontSize: 13, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (f == null || !f.genugDaten)
            const Text('noch wenige Spiele',
                style: TextStyle(color: kTextMute, fontSize: 11))
          else ...[
            _formDots(f),
            const SizedBox(height: 8),
            Text('Ø ${f.torProSpiel!.toStringAsFixed(1)} Tore',
                style: const TextStyle(color: kTextDim, fontSize: 11.5)),
            Text('Ø ${f.gegentorProSpiel!.toStringAsFixed(1)} Gegentore',
                style: const TextStyle(color: kTextMute, fontSize: 11.5)),
            const SizedBox(height: 4),
            Text('${f.siege}S · ${f.remis}U · ${f.niederlagen}N',
                style: const TextStyle(
                    color: kTextDim, fontSize: 11, fontWeight: FontWeight.w700)),
          ],
        ],
      ),
    );
  }

  /// Form als farbige Punkte (neueste zuerst): S grün, U gelb, N rot.
  Widget _formDots(TeamForm f) {
    Color c(String a) =>
        a == 'S' ? kAccent : (a == 'U' ? kWarn : kDanger);
    return Row(
      children: [
        for (final a in f.formKette)
          Container(
            margin: const EdgeInsets.only(right: 5),
            width: 14,
            height: 14,
            decoration: BoxDecoration(color: c(a), shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text(a,
                style: const TextStyle(
                    color: kAccentInk, fontSize: 8, fontWeight: FontWeight.w900)),
          ),
      ],
    );
  }

  /// „Warum diese Prognose?" – Begründungen ausschließlich aus echten Daten.
  Widget _warumSection(int idx, TeamForm? h, TeamForm? g) {
    final gruende = <String>[];
    final probs = widget.probs;
    final fav = idx == 0 ? h : (idx == 2 ? g : null);
    final favName = idx == 0
        ? widget.match.home.shortName
        : (idx == 2 ? widget.match.away.shortName : null);
    final gegner = idx == 0 ? g : (idx == 2 ? h : null);

    if (idx == 1) {
      gruende.add('Modell sieht die Teamstärken nah beieinander.');
      if (h != null && g != null && h.genugDaten && g.genugDaten) {
        gruende.add(
            'Ähnliche Form: ${widget.match.home.shortName} ${h.punkteProSpiel.toStringAsFixed(1)} vs. '
            '${widget.match.away.shortName} ${g.punkteProSpiel.toStringAsFixed(1)} Punkte/Spiel.');
      }
    } else {
      final (ph, _, pa) = prozente100(probs);
      final favPct = idx == 0 ? ph : pa;
      gruende.add(
          '$favName wird favorisiert ($favPct % Siegwahrscheinlichkeit laut Modell).');
      if (idx == 0 && !widget.match.neutralVenue) {
        gruende.add('Heimvorteil für ${widget.match.home.shortName}.');
      }
      if (fav != null && fav.genugDaten && fav.siege >= 3) {
        gruende.add('${fav.siege} Siege aus den letzten ${fav.spiele} Spielen.');
      }
      if (fav != null && fav.genugDaten && (fav.torProSpiel ?? 0) >= 1.8) {
        gruende.add(
            'Ø ${fav.torProSpiel!.toStringAsFixed(1)} erzielte Tore pro Spiel.');
      }
      if (gegner != null &&
          gegner.genugDaten &&
          (gegner.gegentorProSpiel ?? 0) >= 1.6) {
        gruende.add(
            'Gegner kassiert Ø ${gegner.gegentorProSpiel!.toStringAsFixed(1)} Tore pro Spiel.');
      }
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _accent.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(color: _accent.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Warum diese Prognose?',
              style: TextStyle(
                  color: kText, fontSize: 13.5, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          for (final grund in gruende)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(Icons.check_circle_rounded,
                        size: 14, color: _accent),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(grund,
                        style: const TextStyle(
                            color: kTextDim, fontSize: 12, height: 1.35)),
                  ),
                ],
              ),
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
    final pb = store.prophetBilanz(tage: 30);
    final recent = store.prophetLetzte(10);

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
          const Text('Prophet Bilanz',
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
          if (pb.total > 0) ...[
            const SizedBox(height: 20),
            const Text('Letzte 30 Tage',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
            const SizedBox(height: 4),
            Text('${pb.total} ausgewertete Prognosen',
                style: const TextStyle(color: Colors.white54, fontSize: 11.5)),
            const SizedBox(height: 10),
            Row(children: [
              _stat('${pb.tendenzPct} %', 'Tendenz richtig'),
              _stat('${pb.ouPct} %', 'Über/Unter 2,5'),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              _stat('${pb.bttsPct} %', 'Beide treffen'),
              _stat('${pb.exaktPct} %', 'Exaktes Ergebnis'),
            ]),
            const SizedBox(height: 12),
            _tendenzZeitraeume(store),
            const SizedBox(height: 16),
            const Text('Letzte Prognosen',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
            const SizedBox(height: 10),
            for (final s in recent) _prophetRow(s),
          ],
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

  /// Tendenz-Trefferquote über mehrere Zeiträume (7 Tage · 30 Tage · gesamt).
  Widget _tendenzZeitraeume(PredictionStore store) {
    final b7 = store.prophetBilanz(tage: 7);
    final b30 = store.prophetBilanz(tage: 30);
    final ball = store.prophetBilanz(tage: 100000);
    Widget spalte(String label, ProphetBilanz b) => Expanded(
          child: Column(
            children: [
              Text(b.total == 0 ? '–' : '${b.tendenzPct} %',
                  style: const TextStyle(
                      color: _accent, fontSize: 15, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(label,
                  style: const TextStyle(color: Colors.white60, fontSize: 10.5)),
              Text('${b.total} Sp.',
                  style: const TextStyle(color: Colors.white38, fontSize: 10)),
            ],
          ),
        );
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
      ),
      child: Row(children: [
        spalte('7 Tage', b7),
        Container(width: 1, height: 30, color: kBorder),
        spalte('30 Tage', b30),
        Container(width: 1, height: 30, color: kBorder),
        spalte('Gesamt', ball),
      ]),
    );
  }

  /// Eine Zeile der Prophet-Bilanz: Prognose vs. echtes Ergebnis mit ✅/❌.
  Widget _prophetRow(PropheStat s) {
    final ok = s.tendenzOk;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(color: kBorder),
      ),
      child: Row(children: [
        Icon(ok ? Icons.check_circle_rounded : Icons.cancel_rounded,
            color: ok ? _accent : kDanger, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${s.heim} – ${s.gast}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(
                'Prognose ${s.predH}:${s.predA} · Ergebnis ${s.actH}:${s.actA}'
                '${s.liga.isNotEmpty ? ' · ${s.liga}' : ''}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white54, fontSize: 11.5),
              ),
            ],
          ),
        ),
      ]),
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
