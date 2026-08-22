// Tests für die eigenen Wetten (lokaler Tipp-Tracker, kein Konto/Login).
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:footy_predict/store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Wette (Abrechnung)', () {
    test('offener Tipp ist weder gewonnen noch verloren', () {
      const w = Wette(matchId: 1, tipp: '1', heim: 'A', gast: 'B');
      expect(w.abgerechnet, isFalse);
      expect(w.gewonnen, isNull);
      expect(w.echterAusgang, isNull);
    });

    test('Heimsieg-Tipp geht bei Heimsieg auf', () {
      const w = Wette(matchId: 1, tipp: '1', heim: 'A', gast: 'B');
      final r = w.abgerechnetMit(2, 0);
      expect(r.abgerechnet, isTrue);
      expect(r.echterAusgang, '1');
      expect(r.gewonnen, isTrue);
    });

    test('Heimsieg-Tipp verliert bei Niederlage', () {
      const w = Wette(matchId: 1, tipp: '1', heim: 'A', gast: 'B');
      expect(w.abgerechnetMit(0, 1).gewonnen, isFalse);
    });

    test('Remis-Tipp geht bei Gleichstand auf', () {
      const w = Wette(matchId: 1, tipp: 'X', heim: 'A', gast: 'B');
      expect(w.abgerechnetMit(1, 1).gewonnen, isTrue);
      expect(w.abgerechnetMit(2, 1).gewonnen, isFalse);
    });

    test('Auswärts-Tipp geht bei Auswärtssieg auf', () {
      const w = Wette(matchId: 1, tipp: '2', heim: 'A', gast: 'B');
      expect(w.abgerechnetMit(0, 3).gewonnen, isTrue);
    });
  });

  group('Store: Wetten setzen, abrechnen, entfernen', () {
    late PredictionStore store;
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      store = PredictionStore();
      await store.load();
    });

    test('Wette setzen und wieder auslesen', () async {
      await store.setzeWette(const Wette(
          matchId: 42, tipp: '1', heim: 'Bayern', gast: 'Augsburg'));
      expect(store.wette(42)?.tipp, '1');
      expect(store.hasWetten, isTrue);
    });

    test('gleicher Tipp erneut = keine Änderung, anderer Tipp überschreibt', () async {
      await store.setzeWette(const Wette(matchId: 42, tipp: '1', heim: 'A', gast: 'B'));
      await store.setzeWette(const Wette(matchId: 42, tipp: '2', heim: 'A', gast: 'B'));
      expect(store.wette(42)?.tipp, '2');
    });

    test('Abrechnen aktualisiert Bilanz, doppeltes Abrechnen ändert nichts', () async {
      await store.setzeWette(const Wette(matchId: 1, tipp: '1', heim: 'A', gast: 'B'));
      await store.setzeWette(const Wette(matchId: 2, tipp: 'X', heim: 'C', gast: 'D'));

      expect(await store.rechneWetteAb(1, 3, 0), isTrue); // gewonnen
      expect(await store.rechneWetteAb(2, 2, 0), isTrue); // verloren
      // Bereits abgerechnet: kein erneutes Speichern.
      expect(await store.rechneWetteAb(1, 0, 5), isFalse);

      final b = store.bilanz;
      expect(b.gesamt, 2);
      expect(b.gewonnen, 1);
      expect(b.verloren, 1);
      expect(b.offen, 0);
      expect((b.quote * 100).round(), 50);
    });

    test('abgerechnete Wette lässt sich nicht mehr umtippen', () async {
      await store.setzeWette(const Wette(matchId: 7, tipp: '1', heim: 'A', gast: 'B'));
      await store.rechneWetteAb(7, 1, 0);
      await store.setzeWette(const Wette(matchId: 7, tipp: '2', heim: 'A', gast: 'B'));
      expect(store.wette(7)?.tipp, '1'); // unverändert
    });

    test('Entfernen löscht die Wette', () async {
      await store.setzeWette(const Wette(matchId: 5, tipp: '1', heim: 'A', gast: 'B'));
      await store.entferneWette(5);
      expect(store.wette(5), isNull);
      expect(store.hasWetten, isFalse);
    });

    test('Wetten überstehen einen Neustart (persistiert)', () async {
      await store.setzeWette(const Wette(
          matchId: 9, tipp: '2', heim: 'Real', gast: 'Barca', wettbewerb: 'LaLiga'));
      await store.rechneWetteAb(9, 0, 1);

      final neu = PredictionStore();
      await neu.load();
      final w = neu.wette(9);
      expect(w?.tipp, '2');
      expect(w?.gewonnen, isTrue);
      expect(w?.wettbewerb, 'LaLiga');
      expect(neu.bilanz.gewonnen, 1);
    });
  });
}
