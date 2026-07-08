import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:terra/features/ecosystem/domain/organism.dart';
import 'package:terra/features/ecosystem/domain/species.dart';
import 'package:terra/features/habits/data/database.dart';
import 'package:terra/features/habits/data/habit_repository.dart';

/// Integrationstest der Data-Schicht mit einer echten In-Memory-Drift-DB.
/// Verifiziert das Zusammenspiel von Repository, Persistenz, Seed-Erzeugung
/// und der Ökosystem-Fortschreibung (advanceToNow) zur Laufzeit.
void main() {
  late AppDatabase db;
  late HabitRepository repo;

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repo = HabitRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  final t0 = DateTime(2026, 1, 1, 8);

  test('createHabit erzeugt einen Organismus mit stabilem Seed', () async {
    await repo.createHabit(
        title: 'Lesen', speciesType: SpeciesType.moss, now: t0);

    final state = await repo.loadState(t0);
    expect(state.organisms, hasLength(1));
    final org = state.organisms.single;
    expect(org.speciesType, SpeciesType.moss);
    expect(org.vitality, closeTo(0.4, 1e-9));
    expect(org.seed, isNonZero);
  });

  test('Erledigen lässt das Lebewesen gedeihen (Vitalität steigt)', () async {
    await repo.createHabit(
        title: 'Meditieren', speciesType: SpeciesType.fern, now: t0);

    final before = (await repo.loadState(t0)).organisms.single.vitality;

    await repo.completeHabit(1, t0.add(const Duration(hours: 1)));
    final state = await repo.advanceToNow(t0.add(const Duration(hours: 2)));

    expect(state.organisms.single.vitality, greaterThan(before));
    // isCompletedOn erkennt die heutige Erledigung.
    expect(await repo.isCompletedOn(1, t0), isTrue);
  });

  test('Vernachlässigung über Tage verkümmert das Lebewesen', () async {
    await repo.createHabit(
        title: 'Sport', speciesType: SpeciesType.waterLens, now: t0);

    final state = await repo.advanceToNow(t0.add(const Duration(days: 4)));

    expect(state.organisms.single.vitality, lessThan(0.4));
    expect(state.organisms.single.stage, GrowthStage.withering);
  });

  test('overallBalance wird persistiert und bei Reload wiederhergestellt',
      () async {
    await repo.createHabit(
        title: 'A', speciesType: SpeciesType.moss, now: t0);
    await repo.completeHabit(1, t0.add(const Duration(minutes: 30)));
    final advanced = await repo.advanceToNow(t0.add(const Duration(hours: 1)));

    final reloaded = await repo.loadState(t0.add(const Duration(hours: 1)));
    expect(reloaded.overallBalance, closeTo(advanced.overallBalance, 1e-9));
    expect(reloaded.ambientSeed, advanced.ambientSeed);
  });

  test('deleteHabit entfernt Habit und Organismus', () async {
    await repo.createHabit(
        title: 'Weg damit', speciesType: SpeciesType.beetle, now: t0);
    expect((await repo.getHabits()), hasLength(1));

    await repo.deleteHabit(1);

    expect((await repo.getHabits()), isEmpty);
    expect((await repo.loadState(t0)).organisms, isEmpty);
  });
}
