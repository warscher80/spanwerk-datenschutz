// Tests für Lieblingsteams (lokal, kein Konto).
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

  test('an- und abwählen kippt den Zustand', () async {
    expect(store.istFavorit('Bayern Munich'), isFalse);
    expect(await store.toggleFavorit('Bayern Munich'), isTrue);
    expect(store.istFavorit('Bayern Munich'), isTrue);
    expect(store.hatFavoriten, isTrue);
    expect(await store.toggleFavorit('Bayern Munich'), isFalse);
    expect(store.istFavorit('Bayern Munich'), isFalse);
    expect(store.hatFavoriten, isFalse);
  });

  test('Favoriten überstehen einen Neustart', () async {
    await store.toggleFavorit('Napoli');
    await store.toggleFavorit('Real Madrid');
    final neu = PredictionStore();
    await neu.load();
    expect(neu.istFavorit('Napoli'), isTrue);
    expect(neu.istFavorit('Real Madrid'), isTrue);
    expect(neu.favoriten, containsAll(<String>['Napoli', 'Real Madrid']));
  });
}
