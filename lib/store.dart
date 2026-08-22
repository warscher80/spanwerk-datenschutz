// store.dart – Lokale Speicherung der Tipps (shared_preferences).
// Nichts verlässt das Gerät; keine Konten, kein Server.
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class Prediction {
  final int home;
  final int away;
  const Prediction(this.home, this.away);
}

/// Eine eigene Wette des Nutzers auf ein Spiel – rein lokal, ohne Konto.
///
/// Bewusst kein Login bei Wett-Anbietern: dafür müsste man ein fremdes
/// Passwort in der App eingeben, das wäre unsicher. Stattdessen trägt der
/// Nutzer seinen Tipp selbst ein; die App kennt das echte Ergebnis und rechnet
/// selbst ab. `tipp` ist '1' (Heimsieg), 'X' (Unentschieden) oder '2'
/// (Auswärtssieg). Team-Namen und Wettbewerb werden mitgespeichert, damit die
/// Bilanz auch dann lesbar bleibt, wenn das Spiel längst aus der Liste ist.
class Wette {
  final int matchId;
  final String tipp; // '1' | 'X' | '2'
  final String heim;
  final String gast;
  final String? wettbewerb;
  final DateTime? anpfiff;
  final int? ergHeim; // gesetzt sobald abgerechnet
  final int? ergGast;

  const Wette({
    required this.matchId,
    required this.tipp,
    required this.heim,
    required this.gast,
    this.wettbewerb,
    this.anpfiff,
    this.ergHeim,
    this.ergGast,
  });

  bool get abgerechnet => ergHeim != null && ergGast != null;

  /// Tendenz des echten Ergebnisses ('1'/'X'/'2') – null solange offen.
  String? get echterAusgang {
    if (!abgerechnet) return null;
    if (ergHeim! > ergGast!) return '1';
    if (ergHeim! < ergGast!) return '2';
    return 'X';
  }

  /// true = gewonnen, false = verloren, null = noch offen.
  bool? get gewonnen => abgerechnet ? tipp == echterAusgang : null;

  String get tippText => switch (tipp) {
        '1' => 'Heimsieg',
        '2' => 'Auswärtssieg',
        _ => 'Unentschieden',
      };

  Wette abgerechnetMit(int h, int a) => Wette(
        matchId: matchId,
        tipp: tipp,
        heim: heim,
        gast: gast,
        wettbewerb: wettbewerb,
        anpfiff: anpfiff,
        ergHeim: h,
        ergGast: a,
      );

  Map<String, dynamic> toJson() => {
        'tipp': tipp,
        'heim': heim,
        'gast': gast,
        if (wettbewerb != null) 'wb': wettbewerb,
        if (anpfiff != null) 'ts': anpfiff!.toIso8601String(),
        if (ergHeim != null) 'eh': ergHeim,
        if (ergGast != null) 'ea': ergGast,
      };

  static Wette? fromJson(int id, Map<String, dynamic> m) {
    final tipp = m['tipp'];
    if (tipp is! String || !(tipp == '1' || tipp == 'X' || tipp == '2')) {
      return null;
    }
    return Wette(
      matchId: id,
      tipp: tipp,
      heim: '${m['heim'] ?? ''}',
      gast: '${m['gast'] ?? ''}',
      wettbewerb: m['wb'] as String?,
      anpfiff: m['ts'] is String ? DateTime.tryParse(m['ts'] as String) : null,
      ergHeim: (m['eh'] as num?)?.toInt(),
      ergGast: (m['ea'] as num?)?.toInt(),
    );
  }
}

/// Zusammenfassung der eigenen Wett-Bilanz.
class WettBilanz {
  final int gesamt; // abgerechnete Wetten
  final int gewonnen;
  final int offen; // noch nicht abgerechnet
  const WettBilanz(this.gesamt, this.gewonnen, this.offen);

  int get verloren => gesamt - gewonnen;
  double get quote => gesamt == 0 ? 0 : gewonnen / gesamt;
}

class PredictionStore {
  static const _key = 'footy_predictions_v1';
  static const _eloKey = 'footy_elo_v1';
  static const _ingestedKey = 'footy_ingested_v1';
  static const _roundsKey = 'footy_learned_rounds_v1';

  static const _resultsKey = 'footy_results_v1';
  static const _evalKey = 'footy_modeleval_v1';
  static const _cupKey = 'footy_cup_runden_v1';
  static const _wettenKey = 'footy_wetten_v1';

  // Welche Runden-Codes es in einem Turnier wirklich gibt, samt Zeitpunkt der
  // letzten vollständigen Suche. Ohne dieses Wissen probiert die App bei jedem
  // Start alle möglichen Codes durch – bei der WM elf Stück, von denen die
  // meisten nichts liefern.
  final Map<String, List<int>> _cupRunden = {};
  final Map<String, DateTime> _cupGeprueft = {};

  final Map<int, Prediction> _cache = {};

  // Lerndaten des Quoten-Modells.
  final Map<String, double> elo = {};
  final Set<int> _ingested = {};
  final Set<String> _learnedRounds = {};

  // Echte Ergebnisse getippter Spiele (für die Saison-Statistik).
  final Map<int, List<int>> _results = {};

  // Eigene Wetten des Nutzers (matchId -> Wette).
  final Map<int, Wette> _wetten = {};

  // Treffsicherheit des Modells (Vorhersage vor dem Lernen).
  int modelHits = 0;
  int modelTotal = 0;

  // Erweiterte Güte-Messung für „Prognose-Vertrauen":
  //  - je Liga getrennt (wo ist das Modell stark/schwach?)
  //  - Brier-Score: misst die QUALITÄT der Wahrscheinlichkeiten, nicht nur
  //    Treffer/daneben. 0 = perfekt, ~0,66 = Raten. Kleiner ist besser.
  //  - Kalibrierung in 5 Sicherheits-Körben: sagt das Modell „70 %", tritt es
  //    dann auch in ~70 % der Fälle ein?
  final Map<String, int> _ligaHits = {};
  final Map<String, int> _ligaTotal = {};
  double _brierSum = 0;
  int _brierN = 0;
  static const _calGrenzen = [0.5, 0.6, 0.7, 0.8]; // ergibt 5 Körbe
  final List<int> _calHit = List<int>.filled(5, 0);
  final List<int> _calTot = List<int>.filled(5, 0);

  SharedPreferences? _prefs;

  Map<int, Prediction> get predictions => _cache;
  List<int>? result(int matchId) => _results[matchId];

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    _cache.clear();
    // Jeder Speicherblock einzeln abgesichert: ein einziges beschädigtes Feld
    // darf nicht das ganze Laden abbrechen. Sonst bliebe das Modell im
    // Speicher leer und der erste Ingest würde die noch guten Lerndaten auf der
    // Platte mit Leerem überschreiben – stiller, dauerhafter Verlust.
    try {
      final raw = _prefs!.getString(_key);
      if (raw != null) {
        final map = (jsonDecode(raw) as Map).cast<String, dynamic>();
        map.forEach((id, v) {
          final p = (v as Map).cast<String, dynamic>();
          _cache[int.parse(id)] = Prediction(p['h'] as int, p['a'] as int);
        });
      }
    } catch (_) {
      _cache.clear();
    }
    _loadLearning();
    _loadCup();
    _loadWetten();
    // Bei neuer Modell-Version Lerndaten einmalig zurücksetzen, damit die
    // verbesserten Start-Stärken (z. B. Nationalteams/Vereine) wirken.
    const modelVer = 3;
    if ((_prefs?.getInt('footy_model_ver') ?? 0) != modelVer) {
      elo.clear();
      _ingested.clear();
      _learnedRounds.clear();
      _resetEval();
      // Auch den Stand des vorberechneten Modells vergessen, sonst lehnt
      // spieleModellEin die frische Fassung als "nicht neuer" ab und das Modell
      // bliebe leer (alle Teams beim Basiswert -> Einheitsquoten).
      await _prefs?.remove(_modellStandKey);
      await _prefs?.setInt('footy_model_ver', modelVer);
      await saveLearning();
    }
  }

  void _loadLearning() {
    elo.clear();
    _ingested.clear();
    _learnedRounds.clear();
    _results.clear();
    try {
      final e = _prefs?.getString(_eloKey);
      if (e != null) {
        (jsonDecode(e) as Map)
            .forEach((k, v) => elo[k as String] = (v as num).toDouble());
      }
    } catch (_) {
      elo.clear();
    }
    try {
      _ingested.addAll(_prefs?.getStringList(_ingestedKey)?.map(int.parse) ?? const []);
    } catch (_) {
      _ingested.clear();
    }
    _learnedRounds.addAll(_prefs?.getStringList(_roundsKey) ?? const []);
    try {
      final r = _prefs?.getString(_resultsKey);
      if (r != null) {
        (jsonDecode(r) as Map).forEach(
            (k, v) => _results[int.parse(k as String)] = (v as List).cast<int>());
      }
    } catch (_) {
      _results.clear();
    }
    try {
      final ev = _prefs?.getString(_evalKey);
      if (ev != null) {
        final m = (jsonDecode(ev) as Map).cast<String, dynamic>();
        modelHits = (m['hits'] as num?)?.toInt() ?? 0;
        modelTotal = (m['total'] as num?)?.toInt() ?? 0;
        _brierSum = (m['brierSum'] as num?)?.toDouble() ?? 0;
        _brierN = (m['brierN'] as num?)?.toInt() ?? 0;
        final lh = m['ligaHits'];
        if (lh is Map) {
          lh.forEach((k, v) => _ligaHits['$k'] = (v as num).toInt());
        }
        final lt = m['ligaTotal'];
        if (lt is Map) {
          lt.forEach((k, v) => _ligaTotal['$k'] = (v as num).toInt());
        }
        final ch = m['calHit'];
        final ct = m['calTot'];
        if (ch is List && ct is List && ch.length == 5 && ct.length == 5) {
          for (var i = 0; i < 5; i++) {
            _calHit[i] = (ch[i] as num).toInt();
            _calTot[i] = (ct[i] as num).toInt();
          }
        }
      }
    } catch (_) {
      _resetEval();
    }
  }

  // ---- Bekannte Turnier-Runden ----
  //
  // Ein Turnier hat viele mögliche Runden-Codes, aber nur wenige existieren
  // tatsächlich. Sind sie einmal bekannt, genügt es, genau diese zu laden.
  // Weil im Verlauf eines Turniers neue K.o.-Runden dazukommen, wird in
  // Abständen trotzdem wieder vollständig gesucht.
  static String _cupSchluessel(String leagueId, String season) => '$leagueId|$season';

  List<int> cupRunden(String leagueId, String season) =>
      List<int>.from(_cupRunden[_cupSchluessel(leagueId, season)] ?? const []);

  /// Ist eine vollständige Suche nach neuen Runden fällig?
  bool cupSucheFaellig(
    String leagueId,
    String season, {
    Duration abstand = const Duration(hours: 6),
    DateTime? now,
  }) {
    final k = _cupSchluessel(leagueId, season);
    if ((_cupRunden[k] ?? const []).isEmpty) return true; // noch nichts bekannt
    final zuletzt = _cupGeprueft[k];
    if (zuletzt == null) return true;
    return (now ?? DateTime.now()).difference(zuletzt) >= abstand;
  }

  Future<void> merkeCupRunden(
    String leagueId,
    String season,
    List<int> codes, {
    required bool warVollstaendig,
    DateTime? now,
  }) async {
    final k = _cupSchluessel(leagueId, season);
    if (codes.isNotEmpty) _cupRunden[k] = List<int>.from(codes);
    // Nur eine vollständige Suche darf den Zeitstempel setzen – sonst
    // verschiebt jeder schnelle Start die nächste Suche weiter nach hinten
    // und neue K.o.-Runden würden nie gefunden.
    if (warVollstaendig) _cupGeprueft[k] = now ?? DateTime.now();
    await _persistCup();
  }

  Future<void> _persistCup() async {
    final map = <String, dynamic>{};
    _cupRunden.forEach((k, v) => map[k] = {
          'codes': v,
          'geprueft': _cupGeprueft[k]?.toIso8601String(),
        });
    await _prefs?.setString(_cupKey, jsonEncode(map));
  }

  void _loadCup() {
    _cupRunden.clear();
    _cupGeprueft.clear();
    final raw = _prefs?.getString(_cupKey);
    if (raw == null) return;
    try {
      (jsonDecode(raw) as Map).forEach((k, v) {
        final m = (v as Map).cast<String, dynamic>();
        final codes = (m['codes'] as List?)?.cast<int>();
        if (codes != null && codes.isNotEmpty) _cupRunden['$k'] = codes;
        final g = m['geprueft'];
        if (g is String) {
          final d = DateTime.tryParse(g);
          if (d != null) _cupGeprueft['$k'] = d;
        }
      });
    } catch (_) {
      // Unlesbarer Stand: lieber wieder vollständig suchen als abstürzen.
      _cupRunden.clear();
      _cupGeprueft.clear();
    }
  }

  // ---- Eigene Wetten ----
  void _loadWetten() {
    _wetten.clear();
    try {
      final raw = _prefs?.getString(_wettenKey);
      if (raw == null) return;
      (jsonDecode(raw) as Map).forEach((k, v) {
        final id = int.tryParse('$k');
        if (id == null) return;
        final w = Wette.fromJson(id, (v as Map).cast<String, dynamic>());
        if (w != null) _wetten[id] = w;
      });
    } catch (_) {
      _wetten.clear();
    }
  }

  Future<void> _persistWetten() async {
    final map = _wetten.map((k, v) => MapEntry('$k', v.toJson()));
    await _prefs?.setString(_wettenKey, jsonEncode(map));
  }

  Wette? wette(int matchId) => _wetten[matchId];
  List<Wette> get wetten {
    final list = _wetten.values.toList();
    // Offene zuerst, dann nach Anpfiff (neueste zuerst).
    list.sort((a, b) {
      final ab = a.abgerechnet ? 1 : 0;
      final bb = b.abgerechnet ? 1 : 0;
      if (ab != bb) return ab - bb;
      final at = a.anpfiff?.millisecondsSinceEpoch ?? 0;
      final bt = b.anpfiff?.millisecondsSinceEpoch ?? 0;
      return bt - at;
    });
    return list;
  }

  bool get hasWetten => _wetten.isNotEmpty;

  WettBilanz get bilanz {
    int ges = 0, gew = 0, off = 0;
    for (final w in _wetten.values) {
      if (w.abgerechnet) {
        ges++;
        if (w.gewonnen == true) gew++;
      } else {
        off++;
      }
    }
    return WettBilanz(ges, gew, off);
  }

  /// Wette setzen/ändern. Ein bereits abgerechnetes Spiel bleibt unangetastet.
  Future<void> setzeWette(Wette w) async {
    final vorhanden = _wetten[w.matchId];
    if (vorhanden != null && vorhanden.abgerechnet) return;
    _wetten[w.matchId] = w;
    await _persistWetten();
  }

  Future<void> entferneWette(int matchId) async {
    if (_wetten.remove(matchId) != null) await _persistWetten();
  }

  /// Ein beendetes Spiel abrechnen (nur wenn eine offene Wette existiert).
  /// Gibt true zurück, wenn dadurch etwas Neues gespeichert wurde.
  Future<bool> rechneWetteAb(int matchId, int home, int away) async {
    final w = _wetten[matchId];
    if (w == null || w.abgerechnet) return false;
    _wetten[matchId] = w.abgerechnetMit(home, away);
    await _persistWetten();
    return true;
  }

  // ---- Vorberechnetes Modell ----
  //
  // Ein frisch installiertes Gerät müsste sonst je Liga zwei Saisons
  // nachlernen – bei der Bundesliga 68 Spieltage. Stattdessen lädt es ein
  // von der CI berechnetes Modell und lernt nur noch das Neuere dazu.
  //
  // Das ist möglich, weil das Modell keine persönlichen Daten enthält,
  // sondern eine reine Berechnung aus öffentlichen Ergebnissen ist: dieselben
  // Spiele in derselben Reihenfolge ergeben zwingend dieselben Werte. Genau
  // dafür sortiert der Lerner die Spieltage vor dem Einspeisen.
  static const _modellStandKey = 'footy_modell_stand_v1';

  DateTime? get modellStand {
    final s = _prefs?.getString(_modellStandKey);
    return s == null ? null : DateTime.tryParse(s);
  }

  /// Nur für den Generator: der aktuelle Lernstand als einfache Listen.
  List<String> get gelernteRunden => _learnedRounds.toList()..sort();
  List<int> get verarbeiteteSpiele => _ingested.toList()..sort();

  /// Ein vorberechnetes Modell übernehmen.
  ///
  /// Übernommen wird **vollständig** – Ratings, gelernte Spieltage und
  /// verarbeitete Spiele –, nie teilweise. Ein halb übernommenes Modell wäre
  /// aus zwei Rechenwegen zusammengesetzt und damit weder das eine noch das
  /// andere. Lokal bereits Gelerntes, das der Stand nicht kennt, wird beim
  /// nächsten Lauf ohnehin wieder mitgelernt.
  ///
  /// Die Treffsicherheits-Zähler bleiben unangetastet: sie messen, was dieses
  /// Gerät miterlebt hat, und sind keine Eigenschaft des Modells.
  ///
  /// Gibt true zurück, wenn übernommen wurde.
  Future<bool> spieleModellEin(Map<String, dynamic> daten) async {
    if (daten['format'] != 1) return false;
    final erstellt = DateTime.tryParse('${daten['erstellt']}');
    if (erstellt == null) return false;

    // Nicht erneut einspielen, wenn dieser Stand schon drin ist.
    final bisher = modellStand;
    if (bisher != null && !erstellt.isAfter(bisher)) return false;

    final roh = daten['elo'];
    if (roh is! Map || roh.isEmpty) return false;

    elo
      ..clear()
      ..addAll(roh.map((k, v) => MapEntry('$k', (v as num).toDouble())));
    _learnedRounds
      ..clear()
      ..addAll(((daten['gelernteRunden'] as List?) ?? const []).map((e) => '$e'));
    _ingested
      ..clear()
      ..addAll(((daten['verarbeiteteSpiele'] as List?) ?? const [])
          .map((e) => e is int ? e : int.tryParse('$e') ?? -1)
          .where((e) => e >= 0));

    await saveLearning();
    await _prefs?.setString(_modellStandKey, erstellt.toIso8601String());
    return true;
  }

  // ---- Lern-Status ----
  bool isIngested(int matchId) => _ingested.contains(matchId);
  void markIngested(int matchId) => _ingested.add(matchId);
  bool roundLearned(String key) => _learnedRounds.contains(key);
  void markRoundLearned(String key) => _learnedRounds.add(key);
  int get teamsLearned => elo.length;

  void recordResult(int matchId, int home, int away) => _results[matchId] = [home, away];
  void addModelEval(bool hit) {
    modelTotal++;
    if (hit) modelHits++;
  }

  /// Ausführliche Bewertung einer Prognose gegen das echte Ergebnis.
  /// [predicted]/[actual]: 0 = Heim, 1 = Remis, 2 = Gast.
  void addModelEvalDetailed({
    required double pHome,
    required double pDraw,
    required double pAway,
    required int predicted,
    required int actual,
    required String liga,
  }) {
    final hit = predicted == actual;
    modelTotal++;
    if (hit) modelHits++;

    final key = liga.isEmpty ? 'Gesamt' : liga;
    _ligaTotal[key] = (_ligaTotal[key] ?? 0) + 1;
    if (hit) _ligaHits[key] = (_ligaHits[key] ?? 0) + 1;

    // Brier-Score über die drei möglichen Ausgänge.
    final p = [pHome, pDraw, pAway];
    var b = 0.0;
    for (var i = 0; i < 3; i++) {
      final o = i == actual ? 1.0 : 0.0;
      final d = p[i] - o;
      b += d * d;
    }
    _brierSum += b;
    _brierN++;

    // Kalibrierung: Korb nach der Sicherheit des vorhergesagten Ausgangs.
    final conf = p[predicted];
    var bkt = 0;
    while (bkt < _calGrenzen.length && conf >= _calGrenzen[bkt]) {
      bkt++;
    }
    _calTot[bkt]++;
    if (hit) _calHit[bkt]++;
  }

  /// Brier-Score (0 = perfekt, ~0,66 = Raten); null solange nichts gemessen.
  double? get brierScore => _brierN == 0 ? null : _brierSum / _brierN;

  /// Trefferquote je Liga, absteigend nach Anzahl bewerteter Spiele.
  List<({String liga, int hits, int total})> get ligaBilanz {
    final out = _ligaTotal.entries
        .map((e) => (liga: e.key, hits: _ligaHits[e.key] ?? 0, total: e.value))
        .toList()
      ..sort((a, b) => b.total.compareTo(a.total));
    return out;
  }

  /// Kalibrierungs-Körbe mit Daten: erwartete vs. tatsächliche Trefferquote.
  List<({String label, int hits, int total})> get kalibrierung {
    const labels = ['<50 %', '50–60 %', '60–70 %', '70–80 %', '80–100 %'];
    final out = <({String label, int hits, int total})>[];
    for (var i = 0; i < 5; i++) {
      if (_calTot[i] > 0) {
        out.add((label: labels[i], hits: _calHit[i], total: _calTot[i]));
      }
    }
    return out;
  }

  void _resetEval() {
    modelHits = 0;
    modelTotal = 0;
    _ligaHits.clear();
    _ligaTotal.clear();
    _brierSum = 0;
    _brierN = 0;
    for (var i = 0; i < 5; i++) {
      _calHit[i] = 0;
      _calTot[i] = 0;
    }
  }

  Future<void> saveLearning() async {
    await _prefs?.setString(_eloKey, jsonEncode(elo));
    await _prefs?.setStringList(_ingestedKey, _ingested.map((e) => e.toString()).toList());
    await _prefs?.setStringList(_roundsKey, _learnedRounds.toList());
    await _prefs?.setString(_resultsKey,
        jsonEncode(_results.map((k, v) => MapEntry(k.toString(), v))));
    await _prefs?.setString(
        _evalKey,
        jsonEncode({
          'hits': modelHits,
          'total': modelTotal,
          'brierSum': _brierSum,
          'brierN': _brierN,
          'ligaHits': _ligaHits,
          'ligaTotal': _ligaTotal,
          'calHit': _calHit,
          'calTot': _calTot,
        }));
  }

  /// Zuletzt betrachteten Spieltag je Liga merken.
  int lastRound(String leagueId) => _prefs?.getInt('round_$leagueId') ?? 1;
  Future<void> setLastRound(String leagueId, int round) async {
    await _prefs?.setInt('round_$leagueId', round);
  }

  /// Tipp-Erinnerungen (Standard: an).
  bool get remindersEnabled => _prefs?.getBool('reminders') ?? true;
  Future<void> setRemindersEnabled(bool v) async {
    await _prefs?.setBool('reminders', v);
  }

  /// Zuletzt gewählte Liga (-1 = Aktuell, 0..n = Ligen). Standard: 0 (WM).
  int get lastLeagueIdx => _prefs?.getInt('last_league') ?? 0;
  Future<void> setLastLeagueIdx(int idx) async {
    await _prefs?.setInt('last_league', idx);
  }

  Prediction? get(int matchId) => _cache[matchId];

  Future<void> save(int matchId, int home, int away) async {
    _cache[matchId] = Prediction(home, away);
    await _persist();
  }

  Future<void> clear() async {
    _cache.clear();
    await _persist();
  }

  bool get isEmpty => _cache.isEmpty;

  Future<void> _persist() async {
    final map = _cache.map(
      (id, p) => MapEntry(id.toString(), {'h': p.home, 'a': p.away}),
    );
    await _prefs?.setString(_key, jsonEncode(map));
  }
}
