import 'package:drift/drift.dart';

import '../../ecosystem/domain/compute_ecosystem.dart';
import '../../ecosystem/domain/ecosystem_state.dart';
import '../../ecosystem/domain/organism.dart';
import '../../ecosystem/domain/species.dart';
import '../domain/habit.dart';
import '../domain/habit_completion.dart';
import 'database.dart';

/// Vermittelt zwischen Drift-Tabellen und den reinen Domänenmodellen und
/// kapselt die Terrarium-Fortschreibung. Enthält KEINE UI-Logik.
class HabitRepository {
  HabitRepository(this._db);

  final AppDatabase _db;

  // ---------------------------------------------------------------------------
  // Habits
  // ---------------------------------------------------------------------------

  Stream<List<Habit>> watchHabits() {
    final query = _db.select(_db.habits)
      ..where((h) => h.isActive.equals(true))
      ..orderBy([(h) => OrderingTerm(expression: h.createdAt)]);
    return query.watch().map((rows) => rows.map(_mapHabit).toList());
  }

  Future<List<Habit>> getHabits() async {
    final rows = await (_db.select(_db.habits)
          ..where((h) => h.isActive.equals(true)))
        .get();
    return rows.map(_mapHabit).toList();
  }

  /// Legt ein Habit an und erzeugt den zugehörigen Organismus mit einem
  /// deterministisch aus den Nutzerdaten abgeleiteten Seed.
  Future<int> createHabit({
    required String title,
    required SpeciesType speciesType,
    required DateTime now,
  }) async {
    return _db.transaction(() async {
      final habitId = await _db.into(_db.habits).insert(
            HabitsCompanion.insert(
              title: title,
              speciesType: speciesType.index,
              createdAt: now,
            ),
          );

      final seed = _seedFor('$habitId|$title|${now.microsecondsSinceEpoch}');
      await _db.into(_db.organisms).insert(
            OrganismsCompanion.insert(
              habitId: habitId,
              lastUpdatedAt: now,
              seed: seed,
              vitality: const Value(0.4),
            ),
          );
      return habitId;
    });
  }

  Future<void> updateHabit({
    required int id,
    required String title,
    required SpeciesType speciesType,
  }) async {
    await (_db.update(_db.habits)..where((h) => h.id.equals(id))).write(
      HabitsCompanion(
        title: Value(title),
        speciesType: Value(speciesType.index),
      ),
    );
  }

  /// Soft-Delete: Habit wird deaktiviert (Organismus/Historie bleiben erhalten,
  /// tote Lebewesen können so weiter auf die Nachbarn wirken, falls gewünscht).
  Future<void> deleteHabit(int id) async {
    await _db.transaction(() async {
      await (_db.delete(_db.habitCompletions)
            ..where((c) => c.habitId.equals(id)))
          .go();
      await (_db.delete(_db.organisms)..where((o) => o.habitId.equals(id))).go();
      await (_db.delete(_db.habits)..where((h) => h.id.equals(id))).go();
    });
  }

  // ---------------------------------------------------------------------------
  // Completions
  // ---------------------------------------------------------------------------

  Future<void> completeHabit(int habitId, DateTime now) async {
    await _db.into(_db.habitCompletions).insert(
          HabitCompletionsCompanion.insert(habitId: habitId, completedAt: now),
        );
  }

  Future<List<HabitCompletion>> getCompletions() async {
    final rows = await _db.select(_db.habitCompletions).get();
    return rows
        .map((r) => HabitCompletion(
              id: r.id,
              habitId: r.habitId,
              completedAt: r.completedAt,
            ))
        .toList();
  }

  /// Ob ein Habit im lokalen Tag von [now] bereits erledigt wurde (für Streak /
  /// UI-Zustand des Abhak-Buttons).
  Future<bool> isCompletedOn(int habitId, DateTime day) async {
    final start = DateTime(day.year, day.month, day.day);
    final end = start.add(const Duration(days: 1));
    final row = await (_db.select(_db.habitCompletions)
          ..where((c) =>
              c.habitId.equals(habitId) &
              c.completedAt.isBiggerOrEqualValue(start) &
              c.completedAt.isSmallerThanValue(end)))
        .get();
    return row.isNotEmpty;
  }

  // ---------------------------------------------------------------------------
  // Ökosystem-Zustand
  // ---------------------------------------------------------------------------

  /// Lädt den gespeicherten Zustand ODER initialisiert ihn beim ersten Start.
  Future<EcosystemState> loadState(DateTime now) async {
    final organisms = await _loadOrganisms();

    final stateRow =
        await (_db.select(_db.ecosystemStates)..limit(1)).getSingleOrNull();

    if (stateRow == null) {
      final ambientSeed = _seedFor('ambient|${now.microsecondsSinceEpoch}');
      final state = EcosystemState(
        overallBalance: 0,
        ambientSeed: ambientSeed,
        lastUpdatedAt: now,
        organisms: organisms,
      );
      await _persistState(state);
      return state;
    }

    return EcosystemState(
      overallBalance: stateRow.overallBalance,
      ambientSeed: stateRow.ambientSeed,
      lastUpdatedAt: stateRow.lastUpdatedAt,
      organisms: organisms,
    );
  }

  /// Kern des Offline-First-Modells: aus (now - lastUpdatedAt) und den
  /// Erledigungen den neuen Zustand berechnen und persistieren.
  Future<EcosystemState> advanceToNow(DateTime now) async {
    final previous = await loadState(now);
    final completions = await getCompletions();
    final next = computeEcosystem(previous, completions, now);
    await _persistState(next);
    return next;
  }

  Future<List<Organism>> _loadOrganisms() async {
    final orgRows = await _db.select(_db.organisms).get();
    final habitById = {
      for (final h in await _db.select(_db.habits).get()) h.id: h,
    };

    final result = <Organism>[];
    for (final o in orgRows) {
      final habit = habitById[o.habitId];
      if (habit == null || !habit.isActive) continue;
      result.add(Organism(
        id: o.id,
        habitId: o.habitId,
        speciesType: SpeciesType.values[habit.speciesType],
        vitality: o.vitality,
        lastUpdatedAt: o.lastUpdatedAt,
        seed: o.seed,
      ));
    }
    return result;
  }

  Future<void> _persistState(EcosystemState state) async {
    await _db.transaction(() async {
      await _db.into(_db.ecosystemStates).insertOnConflictUpdate(
            EcosystemStatesCompanion.insert(
              ambientSeed: state.ambientSeed,
              lastUpdatedAt: state.lastUpdatedAt,
              id: const Value(0),
              overallBalance: Value(state.overallBalance),
            ),
          );
      for (final o in state.organisms) {
        await (_db.update(_db.organisms)..where((row) => row.id.equals(o.id)))
            .write(OrganismsCompanion(
          vitality: Value(o.vitality),
          lastUpdatedAt: Value(o.lastUpdatedAt),
        ));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  Habit _mapHabit(HabitRow r) => Habit(
        id: r.id,
        title: r.title,
        speciesType: SpeciesType.values[r.speciesType],
        createdAt: r.createdAt,
        isActive: r.isActive,
        targetType: HabitTargetType.values[r.targetType],
      );

  /// Stabiler, deterministischer 31-Bit-Seed (FNV-1a) aus einem String.
  int _seedFor(String input) {
    var hash = 0x811c9dc5;
    for (final code in input.codeUnits) {
      hash ^= code;
      hash = (hash * 0x01000193) & 0x7fffffff;
    }
    return hash;
  }
}
