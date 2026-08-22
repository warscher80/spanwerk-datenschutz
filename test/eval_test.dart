// Tests für die Güte-Messung des Modells (Trefferquote, Brier, Kalibrierung).
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:footy_predict/store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late PredictionStore store;
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    store = PredictionStore();
    await store.load();
  });

  test('Treffer und Brier für eine sichere, richtige Prognose', () {
    store.addModelEvalDetailed(
        pHome: 0.7, pDraw: 0.2, pAway: 0.1, predicted: 0, actual: 0, liga: 'Bundesliga');
    expect(store.modelHits, 1);
    expect(store.modelTotal, 1);
    // Brier = (0.7-1)^2 + 0.2^2 + 0.1^2 = 0.14
    expect(store.brierScore, closeTo(0.14, 1e-9));
  });

  test('Brier ist der Mittelwert über mehrere Spiele', () {
    store.addModelEvalDetailed(
        pHome: 0.7, pDraw: 0.2, pAway: 0.1, predicted: 0, actual: 0, liga: 'A');
    store.addModelEvalDetailed(
        pHome: 0.4, pDraw: 0.3, pAway: 0.3, predicted: 0, actual: 2, liga: 'A');
    // (0.14 + 0.74) / 2 = 0.44
    expect(store.brierScore, closeTo(0.44, 1e-9));
    expect(store.modelHits, 1);
    expect(store.modelTotal, 2);
  });

  test('Trefferquote wird je Liga getrennt geführt', () {
    store.addModelEvalDetailed(
        pHome: 0.6, pDraw: 0.25, pAway: 0.15, predicted: 0, actual: 0, liga: 'Bundesliga');
    store.addModelEvalDetailed(
        pHome: 0.6, pDraw: 0.25, pAway: 0.15, predicted: 0, actual: 1, liga: 'Bundesliga');
    store.addModelEvalDetailed(
        pHome: 0.5, pDraw: 0.3, pAway: 0.2, predicted: 0, actual: 0, liga: 'Serie A');
    final byLeague = {for (final l in store.ligaBilanz) l.liga: l};
    expect(byLeague['Bundesliga']!.hits, 1);
    expect(byLeague['Bundesliga']!.total, 2);
    expect(byLeague['Serie A']!.hits, 1);
    expect(byLeague['Serie A']!.total, 1);
    // Absteigend nach Anzahl -> Bundesliga zuerst.
    expect(store.ligaBilanz.first.liga, 'Bundesliga');
  });

  test('Kalibrierung ordnet die Sicherheit dem richtigen Korb zu', () {
    // conf 0.70 -> Korb "70–80 %"
    store.addModelEvalDetailed(
        pHome: 0.70, pDraw: 0.2, pAway: 0.1, predicted: 0, actual: 0, liga: 'A');
    // conf 0.55 -> Korb "50–60 %"
    store.addModelEvalDetailed(
        pHome: 0.55, pDraw: 0.25, pAway: 0.2, predicted: 0, actual: 2, liga: 'A');
    final map = {for (final k in store.kalibrierung) k.label: k};
    expect(map['70–80 %']!.hits, 1);
    expect(map['70–80 %']!.total, 1);
    expect(map['50–60 %']!.hits, 0);
    expect(map['50–60 %']!.total, 1);
    // Leere Körbe tauchen nicht auf.
    expect(map.containsKey('80–100 %'), isFalse);
  });

  test('Auswertung übersteht einen Neustart (persistiert)', () async {
    store.addModelEvalDetailed(
        pHome: 0.7, pDraw: 0.2, pAway: 0.1, predicted: 0, actual: 0, liga: 'Bundesliga');
    store.addModelEvalDetailed(
        pHome: 0.4, pDraw: 0.3, pAway: 0.3, predicted: 0, actual: 2, liga: 'Serie A');
    await store.saveLearning();

    final neu = PredictionStore();
    await neu.load();
    expect(neu.modelTotal, 2);
    expect(neu.modelHits, 1);
    expect(neu.brierScore, closeTo(0.44, 1e-9));
    final byLeague = {for (final l in neu.ligaBilanz) l.liga: l};
    expect(byLeague['Bundesliga']!.total, 1);
    expect(byLeague['Serie A']!.total, 1);
  });
}
