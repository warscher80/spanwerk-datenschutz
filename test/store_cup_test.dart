// Tests für das Merken der tatsächlich vorhandenen Turnier-Runden.
//
// Ein Turnier hat viele mögliche Runden-Codes, aber nur wenige existieren.
// Bei der WM sind es elf Kandidaten, von denen meist drei bis vier belegt
// sind – der Rest kostete bei jedem Start eine Anfrage und lieferte nichts.
//
// Die heikle Stelle: Im Verlauf eines Turniers kommen neue K.o.-Runden dazu.
// Würde die App nur noch die bekannten laden, blieben Achtel-, Viertel- und
// Halbfinale für immer unsichtbar.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:footy_predict/store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late PredictionStore store;
  final t0 = DateTime(2026, 6, 20, 12, 0);

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    store = PredictionStore();
    await store.load();
  });

  test('Ohne Wissen ist die vollständige Suche fällig', () {
    expect(store.cupRunden('4429', '2026'), isEmpty);
    expect(store.cupSucheFaellig('4429', '2026', now: t0), isTrue);
  });

  test('Gefundene Runden werden gemerkt', () async {
    await store.merkeCupRunden('4429', '2026', [1, 2, 3, 32],
        warVollstaendig: true, now: t0);
    expect(store.cupRunden('4429', '2026'), [1, 2, 3, 32]);
  });

  test('Nach vollständiger Suche ist die nächste erst später fällig', () async {
    await store.merkeCupRunden('4429', '2026', [1, 2, 3],
        warVollstaendig: true, now: t0);
    expect(store.cupSucheFaellig('4429', '2026', now: t0.add(const Duration(hours: 5))), isFalse);
    expect(store.cupSucheFaellig('4429', '2026', now: t0.add(const Duration(hours: 6))), isTrue);
  });

  // Der Kern: eine schnelle Runde darf den Zeitstempel NICHT verschieben.
  // Sonst schiebt jeder App-Start die nächste vollständige Suche weiter nach
  // hinten, und neue K.o.-Runden werden nie entdeckt.
  test('Schnelle Ladung verschiebt die nächste Suche nicht', () async {
    await store.merkeCupRunden('4429', '2026', [1, 2, 3],
        warVollstaendig: true, now: t0);
    // Fünf Stunden später eine schnelle Ladung ohne vollständige Suche.
    await store.merkeCupRunden('4429', '2026', [1, 2, 3],
        warVollstaendig: false, now: t0.add(const Duration(hours: 5)));
    // Die Frist läuft weiterhin ab t0, nicht ab der schnellen Ladung.
    expect(store.cupSucheFaellig('4429', '2026', now: t0.add(const Duration(hours: 6))), isTrue);
  });

  test('Turniere werden getrennt gehalten', () async {
    await store.merkeCupRunden('4429', '2026', [1, 2], warVollstaendig: true, now: t0);
    await store.merkeCupRunden('4429', '2030', [32, 16], warVollstaendig: true, now: t0);
    expect(store.cupRunden('4429', '2026'), [1, 2]);
    expect(store.cupRunden('4429', '2030'), [32, 16]);
    expect(store.cupRunden('9999', '2026'), isEmpty);
  });

  test('Gemerkte Runden überleben einen Neustart', () async {
    await store.merkeCupRunden('4429', '2026', [1, 2, 3, 32],
        warVollstaendig: true, now: t0);
    final neu = PredictionStore();
    await neu.load();
    expect(neu.cupRunden('4429', '2026'), [1, 2, 3, 32]);
    expect(neu.cupSucheFaellig('4429', '2026', now: t0.add(const Duration(hours: 1))), isFalse);
  });

  test('Leere Fundliste überschreibt bestehendes Wissen nicht', () async {
    await store.merkeCupRunden('4429', '2026', [1, 2, 3], warVollstaendig: true, now: t0);
    await store.merkeCupRunden('4429', '2026', const [], warVollstaendig: false, now: t0);
    expect(store.cupRunden('4429', '2026'), [1, 2, 3],
        reason: 'eine gedrosselte Antwort darf das Wissen nicht löschen');
  });

  test('Unlesbarer Speicherstand führt zu vollständiger Suche statt Absturz', () async {
    SharedPreferences.setMockInitialValues({'footy_cup_runden_v1': '{kaputt'});
    final s = PredictionStore();
    await s.load();
    expect(s.cupRunden('4429', '2026'), isEmpty);
    expect(s.cupSucheFaellig('4429', '2026', now: t0), isTrue);
  });
}
