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

    test('tryFromJson liefert null statt zu werfen', () {
      expect(FootyMatch.tryFromJson(ev()), isNotNull);
      expect(FootyMatch.tryFromJson({'strStatus': 'FT'}), isNull,
          reason: 'ohne idEvent unbrauchbar');
      expect(FootyMatch.tryFromJson(ev(id: 'keine-zahl')), isNull);
    });
  });
}
