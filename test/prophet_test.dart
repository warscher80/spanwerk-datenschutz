// Tests für die Prophet-Bilanz (Track-Record des Modells).
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:footy_predict/store.dart';

PropheStat rec({
  required int predTend,
  required int ph,
  required int pa,
  required int ah,
  required int aa,
  int tageZurueck = 1,
}) {
  final now = DateTime(2026, 8, 22, 12);
  return PropheStat(
    datumMs: now.subtract(Duration(days: tageZurueck)).millisecondsSinceEpoch,
    heim: 'A',
    gast: 'B',
    liga: 'Test',
    predTend: predTend,
    predH: ph,
    predA: pa,
    actH: ah,
    actA: aa,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PropheStat-Auswertung', () {
    test('Tendenz, exaktes Ergebnis, Über/Unter, Beide treffen', () {
      // Prognose Heimsieg 2:1 -> Ergebnis 3:1: Tendenz ✓, exakt ✗,
      // beide über 2,5 (3 vs 4 Tore) ✓, beide BTTS ✓.
      final s = rec(predTend: 0, ph: 2, pa: 1, ah: 3, aa: 1);
      expect(s.tendenzOk, isTrue);
      expect(s.exaktOk, isFalse);
      expect(s.ouOk, isTrue);
      expect(s.bttsOk, isTrue);
    });

    test('exakter Treffer', () {
      final s = rec(predTend: 0, ph: 2, pa: 1, ah: 2, aa: 1);
      expect(s.exaktOk, isTrue);
      expect(s.tendenzOk, isTrue);
    });

    test('Über/Unter daneben', () {
      // Prognose 2:1 (über 2,5) -> Ergebnis 1:0 (unter) => ou ✗.
      final s = rec(predTend: 0, ph: 2, pa: 1, ah: 1, aa: 0);
      expect(s.ouOk, isFalse);
    });

    test('Beide treffen daneben', () {
      // Prognose 1:1 (beide) -> Ergebnis 2:0 (nur einer) => btts ✗.
      final s = rec(predTend: 1, ph: 1, pa: 1, ah: 2, aa: 0);
      expect(s.bttsOk, isFalse);
    });
  });

  group('Store: Prophet-Bilanz über 30 Tage', () {
    late PredictionStore store;
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      store = PredictionStore();
      await store.load();
    });

    test('zählt nur Prognosen innerhalb des Fensters', () {
      store.addProphet(rec(predTend: 0, ph: 2, pa: 1, ah: 2, aa: 1, tageZurueck: 5)); // ✓ alles
      store.addProphet(rec(predTend: 0, ph: 2, pa: 1, ah: 0, aa: 1, tageZurueck: 10)); // Tendenz ✗
      store.addProphet(rec(predTend: 0, ph: 2, pa: 1, ah: 2, aa: 1, tageZurueck: 90)); // zu alt
      final b = store.prophetBilanz(tage: 30, now: DateTime(2026, 8, 22, 12));
      expect(b.total, 2);
      expect(b.tendenz, 1);
      expect(b.tendenzPct, 50);
      expect(b.exakt, 1); // nur der erste ist exakt
    });

    test('Prognosen überstehen einen Neustart', () async {
      store.addProphet(rec(predTend: 0, ph: 2, pa: 1, ah: 3, aa: 1));
      await store.saveLearning();
      final neu = PredictionStore();
      await neu.load();
      expect(neu.hatProphet, isTrue);
      expect(neu.prophetLetzte(5).length, 1);
    });
  });
}
