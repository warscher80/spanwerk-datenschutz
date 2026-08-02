// Tests für das Übernehmen eines vorberechneten Modells.
//
// Ein frisch installiertes Gerät lädt statt hunderter Einzelabrufe eine
// fertige Datei. Damit alle Geräte denselben Stand haben, muss die Übernahme
// vollständig sein – ein halb übernommenes Modell wäre aus zwei Rechenwegen
// zusammengesetzt und damit weder das eine noch das andere.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:footy_predict/store.dart';

Map<String, dynamic> stand({
  String erstellt = '2026-08-01T10:00:00.000Z',
  Map<String, double> elo = const {'Bayern': 1700, 'Wolfsburg': 1450},
  List<String> runden = const ['4331|2025-2026|1'],
  List<int> spiele = const [111, 222],
  int format = 1,
}) =>
    {
      'format': format,
      'erstellt': erstellt,
      'elo': elo,
      'gelernteRunden': runden,
      'verarbeiteteSpiele': spiele,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late PredictionStore store;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    store = PredictionStore();
    await store.load();
  });

  test('Frisches Gerät übernimmt den Stand', () async {
    expect(await store.spieleModellEin(stand()), isTrue);
    expect(store.elo['Bayern'], 1700);
    expect(store.roundLearned('4331|2025-2026|1'), isTrue);
    expect(store.isIngested(111), isTrue);
    expect(store.modellStand, DateTime.parse('2026-08-01T10:00:00.000Z'));
  });

  test('Derselbe Stand wird nicht zweimal übernommen', () async {
    expect(await store.spieleModellEin(stand()), isTrue);
    expect(await store.spieleModellEin(stand()), isFalse);
  });

  test('Älterer Stand wird abgelehnt', () async {
    await store.spieleModellEin(stand(erstellt: '2026-08-01T10:00:00.000Z'));
    expect(
      await store.spieleModellEin(stand(erstellt: '2026-07-01T10:00:00.000Z')),
      isFalse,
    );
    expect(store.modellStand, DateTime.parse('2026-08-01T10:00:00.000Z'));
  });

  test('Neuerer Stand ersetzt vollständig, nicht teilweise', () async {
    await store.spieleModellEin(stand());
    expect(store.elo.containsKey('Wolfsburg'), isTrue);

    final ok = await store.spieleModellEin(stand(
      erstellt: '2026-08-02T10:00:00.000Z',
      elo: {'Bayern': 1800},
      runden: ['4331|2026-2027|1'],
      spiele: [999],
    ));

    expect(ok, isTrue);
    expect(store.elo['Bayern'], 1800);
    expect(store.elo.containsKey('Wolfsburg'), isFalse,
        reason: 'kein Mischmasch aus zwei Rechenwegen');
    expect(store.roundLearned('4331|2025-2026|1'), isFalse);
    expect(store.isIngested(111), isFalse);
    expect(store.isIngested(999), isTrue);
  });

  test('Treffsicherheit bleibt unangetastet', () async {
    store.addModelEval(true);
    store.addModelEval(false);
    await store.spieleModellEin(stand());
    expect(store.modelTotal, 2, reason: 'misst, was DIESES Gerät miterlebt hat');
    expect(store.modelHits, 1);
  });

  test('Unbrauchbare Stände werden abgelehnt', () async {
    expect(await store.spieleModellEin(stand(format: 2)), isFalse);
    expect(await store.spieleModellEin(stand(elo: const {})), isFalse);
    expect(await store.spieleModellEin(stand(erstellt: 'kein Datum')), isFalse);
    expect(await store.spieleModellEin(const {}), isFalse);
    expect(store.elo, isEmpty, reason: 'nichts davon darf etwas verändert haben');
  });

  test('Übernommener Stand überlebt einen Neustart', () async {
    await store.spieleModellEin(stand());
    final neu = PredictionStore();
    await neu.load();
    expect(neu.elo['Bayern'], 1700);
    expect(neu.roundLearned('4331|2025-2026|1'), isTrue);
    expect(await neu.spieleModellEin(stand()), isFalse,
        reason: 'nach dem Neustart nicht erneut einspielen');
  });
}
