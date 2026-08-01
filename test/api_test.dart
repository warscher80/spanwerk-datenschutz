// Tests für das Einlesen der Spieldaten (api.dart).
//
// Schwerpunkt ist die Frage "ist dieses Spiel endgültig vorbei?". Sie ist
// kritisch, weil ingestMatch (odds.dart) jedes Spiel per markIngested nur
// EINMAL lernt: wird ein Zwischenstand als Endstand eingestuft, verbucht das
// Elo-Modell ihn dauerhaft und sieht das echte Ergebnis nie.
import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/api.dart';

Map<String, dynamic> ev({
  String id = '1',
  String status = 'FT',
  Object? home = 2,
  Object? away = 1,
  String? ts = '2026-05-01T18:30:00',
  String round = '5',
}) =>
    {
      'idEvent': id,
      'strStatus': status,
      'intHomeScore': home,
      'intAwayScore': away,
      'strTimestamp': ts,
      'intRound': round,
      'strHomeTeam': 'Heim',
      'strAwayTeam': 'Gast',
    };

void main() {
  group('matchIsFinished', () {
    final anpfiff = DateTime(2026, 5, 1, 18, 30);
    final kurzDanach = DateTime(2026, 5, 1, 19, 15); // Halbzeit
    final langeDanach = DateTime(2026, 5, 1, 23, 0);

    test('Endstatus zählen als beendet', () {
      for (final s in ['FT', 'AET', 'PEN', 'AP', 'Match Finished', 'AW', 'WO']) {
        expect(
          FootyMatch.matchIsFinished(s, hasScores: true, kickoff: anpfiff, now: langeDanach),
          isTrue,
          reason: 'Status "$s" sollte als beendet gelten',
        );
      }
    });

    test('Endstatus ist unabhängig von Groß-/Kleinschreibung', () {
      expect(FootyMatch.matchIsFinished('ft', hasScores: true, kickoff: anpfiff, now: langeDanach), isTrue);
      expect(FootyMatch.matchIsFinished('  Match Finished  ', hasScores: true, kickoff: anpfiff, now: langeDanach), isTrue);
    });

    // Der eigentliche Kern: ein laufendes Spiel MIT Zwischenstand.
    test('Laufendes Spiel mit Zwischenstand gilt nicht als beendet', () {
      for (final s in ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN PLAY']) {
        expect(
          FootyMatch.matchIsFinished(s, hasScores: true, kickoff: anpfiff, now: kurzDanach),
          isFalse,
          reason: 'Status "$s" ist ein laufendes Spiel, kein Endergebnis',
        );
      }
    });

    test('Auch lange nach Anpfiff bleibt ein Live-Status offen', () {
      // Sonst wuerde ein haengengebliebener Live-Status doch noch gelernt.
      expect(
        FootyMatch.matchIsFinished('HT', hasScores: true, kickoff: anpfiff, now: langeDanach),
        isFalse,
      );
    });

    test('Abgesagte und verschobene Spiele gelten nicht als beendet', () {
      for (final s in ['NS', 'PST', 'CANC', 'ABD', 'SUSP', 'INT', 'TBD']) {
        expect(
          FootyMatch.matchIsFinished(s, hasScores: false, kickoff: anpfiff, now: langeDanach),
          isFalse,
          reason: 'Status "$s"',
        );
      }
    });

    test('Unbekannter Status: nur mit Ergebnis und genug Abstand beendet', () {
      expect(
        FootyMatch.matchIsFinished('Irgendwas', hasScores: true, kickoff: anpfiff, now: kurzDanach),
        isFalse,
        reason: '45 Minuten nach Anpfiff kann das Spiel noch laufen',
      );
      expect(
        FootyMatch.matchIsFinished('Irgendwas', hasScores: true, kickoff: anpfiff, now: langeDanach),
        isTrue,
      );
    });

    test('Unbekannter Status ohne Ergebnis oder ohne Anpfiff bleibt offen', () {
      expect(FootyMatch.matchIsFinished('?', hasScores: false, kickoff: anpfiff, now: langeDanach), isFalse);
      expect(FootyMatch.matchIsFinished('?', hasScores: true, kickoff: null, now: langeDanach), isFalse);
    });

    test('Leerer Status verhält sich wie ein unbekannter', () {
      expect(FootyMatch.matchIsFinished('', hasScores: true, kickoff: anpfiff, now: kurzDanach), isFalse);
    });
  });

  // Der Kurzzeit-Cache ist die Bremse gegen die Drosselung: "Aktuell" fächert
  // über alle zehn Ligen aus und kam so auf ~26 Anfragen pro Minute.
  group('TtlCache', () {
    final t0 = DateTime(2026, 5, 1, 12, 0, 0);

    test('Gespeicherter Wert kommt innerhalb der Frist zurück', () {
      final c = TtlCache<int>(const Duration(seconds: 90));
      c.set('a', 1, now: t0);
      expect(c.get('a', now: t0.add(const Duration(seconds: 89))), 1);
    });

    test('Nach Ablauf der Frist ist der Wert weg', () {
      final c = TtlCache<int>(const Duration(seconds: 90));
      c.set('a', 1, now: t0);
      expect(c.get('a', now: t0.add(const Duration(seconds: 90))), isNull);
      expect(c.length, 0, reason: 'abgelaufener Eintrag wird auch entfernt');
    });

    test('Unbekannter Schlüssel ergibt null', () {
      expect(TtlCache<int>(const Duration(seconds: 5)).get('fehlt'), isNull);
    });

    test('clear leert alles', () {
      final c = TtlCache<int>(const Duration(seconds: 90));
      c.set('a', 1, now: t0);
      c.set('b', 2, now: t0);
      expect(c.length, 2);
      c.clear();
      expect(c.length, 0);
    });

    test('Api.clearCaches ist aufrufbar', () {
      Api.clearCaches();
    });
  });

  // Die Rundenabrufe eines Turniers liefen streng nacheinander, mit Pausen
  // dazwischen. Am Handy summierte sich das auf mehrere Sekunden, bevor das
  // erste Spiel sichtbar war.
  group('inWellen', () {
    test('Führt höchstens so viele Aufgaben gleichzeitig aus wie erlaubt', () async {
      var laufend = 0, hoechstwert = 0;
      Future<int> Function() aufgabe(int i) => () async {
            laufend++;
            if (laufend > hoechstwert) hoechstwert = laufend;
            await Future<void>.delayed(const Duration(milliseconds: 5));
            laufend--;
            return i;
          };
      final aufgaben = List.generate(11, aufgabe);
      final erg = await Api.inWellen(aufgaben, grenze: 3);
      expect(hoechstwert, lessThanOrEqualTo(3));
      expect(hoechstwert, greaterThan(1), reason: 'sonst liefe es weiter nacheinander');
      expect(erg, List.generate(11, (i) => i), reason: 'Reihenfolge bleibt erhalten');
    });

    test('Leere Liste ergibt leeres Ergebnis', () async {
      expect(await Api.inWellen<int>(const []), isEmpty);
    });

    test('Weniger Aufgaben als die Grenze läuft trotzdem', () async {
      final erg = await Api.inWellen<int>([() async => 1, () async => 2], grenze: 5);
      expect(erg, [1, 2]);
    });
  });

  // Die Titelchancen simulieren ab der ersten K.o.-Runde. Wird die falsch
  // bestimmt, rechnet die Simulation nur über ein einziges Spiel.
  group('ersteKoRunde', () {
    List<FootyMatch> spiele(Map<int, int> rundeZuAnzahl) {
      final out = <FootyMatch>[];
      var id = 1;
      rundeZuAnzahl.forEach((runde, anzahl) {
        for (var i = 0; i < anzahl; i++) {
          out.add(FootyMatch.fromJson(ev(id: '${id++}', round: '$runde')));
        }
      });
      return out;
    }

    test('Konvention "Round of N": 32 vor 16 vor 8 vor 4', () {
      expect(Api.ersteKoRunde(spiele({32: 16, 16: 8, 8: 4, 4: 2})), 32);
    });

    test('Konvention 125/150/160/200: Viertelfinale, nicht Finale', () {
      // Hier ist die HÖCHSTE Nummer das Finale - die alte Regel hätte 200
      // gewählt und nur ein Spiel simuliert.
      expect(Api.ersteKoRunde(spiele({125: 4, 150: 2, 160: 1, 200: 1})), 125);
    });

    test('Gemischte Nummerierung wählt die Runde mit den meisten Spielen', () {
      expect(Api.ersteKoRunde(spiele({16: 8, 150: 2, 200: 1})), 16);
    });

    test('Bei gleicher Spielzahl entscheidet die höhere Nummer', () {
      expect(Api.ersteKoRunde(spiele({160: 1, 200: 1})), 200);
    });

    test('Ohne Spiele null', () {
      expect(Api.ersteKoRunde(const <FootyMatch>[]), isNull);
    });
  });

  group('FootyMatch.fromJson', () {
    test('Beendetes Spiel wird korrekt gelesen', () {
      final m = FootyMatch.fromJson(ev());
      expect(m.id, 1);
      expect(m.finished, isTrue);
      expect(m.hasResult, isTrue);
      expect(m.homeGoals, 2);
      expect(m.round, 5);
    });

    test('Halbzeitstand wird nicht als Ergebnis verbucht', () {
      final m = FootyMatch.fromJson(ev(status: 'HT', home: 1, away: 0));
      expect(m.finished, isFalse, reason: 'sonst lernt das Elo-Modell den Zwischenstand');
      expect(m.hasResult, isTrue, reason: 'der Zwischenstand ist da, nur eben nicht endgültig');
    });

    test('Zeitstempel ohne Zonenangabe wird als UTC gelesen', () {
      final m = FootyMatch.fromJson(ev(ts: '2026-05-01T18:30:00'));
      expect(m.kickoff, DateTime.utc(2026, 5, 1, 18, 30).toLocal());
    });

    test('Ohne Zeitstempel wird strTime genutzt', () {
      final j = ev(ts: null)
        ..['dateEvent'] = '2026-05-01'
        ..['strTime'] = '18:30:00';
      final m = FootyMatch.fromJson(j);
      expect(m.kickoff, DateTime.utc(2026, 5, 1, 18, 30).toLocal());
      expect(m.kickoffExact, isTrue);
    });

    test('Nur ein Datum ergibt Tagesende, nicht Mitternacht', () {
      // Mitternacht liess das Spiel schon am Vormittag aus der Ansicht
      // "Aktuell" fallen (Fenster ab vor 4 Stunden).
      final j = ev(ts: null)..['dateEvent'] = '2026-05-01';
      final m = FootyMatch.fromJson(j);
      expect(m.kickoff, DateTime(2026, 5, 1, 23, 59));
      expect(m.kickoffExact, isFalse, reason: 'Zeit ist geraten, keine Erinnerung planen');
    });

    test('Echter Zeitstempel gilt als genau', () {
      expect(FootyMatch.fromJson(ev()).kickoffExact, isTrue);
    });

    test('strTime 00:00:00 gilt als "keine Zeit"', () {
      final j = ev(ts: null)
        ..['dateEvent'] = '2026-05-01'
        ..['strTime'] = '00:00:00';
      final m = FootyMatch.fromJson(j);
      expect(m.kickoffExact, isFalse);
      expect(m.kickoff, DateTime(2026, 5, 1, 23, 59));
    });

    test('tryFromJson liefert null statt zu werfen', () {
      expect(FootyMatch.tryFromJson(ev()), isNotNull);
      expect(FootyMatch.tryFromJson({'strStatus': 'FT'}), isNull,
          reason: 'ohne idEvent unbrauchbar');
      expect(FootyMatch.tryFromJson(ev(id: 'keine-zahl')), isNull);
    });
  });
}
