import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/premium_gate.dart';
import '../data/database.dart';
import '../data/habit_repository.dart';
import '../domain/habit.dart';

/// Einzige Drift-Instanz für die App-Lebensdauer.
final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});

final habitRepositoryProvider = Provider<HabitRepository>((ref) {
  return HabitRepository(ref.watch(appDatabaseProvider));
});

/// Aktive Habits als reaktiver Stream.
final habitsProvider = StreamProvider<List<Habit>>((ref) {
  return ref.watch(habitRepositoryProvider).watchHabits();
});

/// Menge der heute (Gerätezeit) bereits erledigten Habit-IDs. Wird nach jedem
/// Abhaken invalidiert.
final completedTodayProvider = FutureProvider<Set<int>>((ref) async {
  final repo = ref.watch(habitRepositoryProvider);
  return repo.completedHabitIdsOn(DateTime.now());
});

/// Aktuelle Streak (aufeinanderfolgende Tage) je Habit-ID.
///
/// Ein Tag zählt, wenn an ihm mindestens eine Erledigung vorliegt. Die Kette
/// endet heute (falls heute erledigt) oder gestern.
final streaksProvider = FutureProvider<Map<int, int>>((ref) async {
  final repo = ref.watch(habitRepositoryProvider);
  final completions = await repo.getCompletions();

  final Map<int, Set<int>> daysByHabit = {};
  int dayIndex(DateTime d) =>
      DateTime(d.year, d.month, d.day).millisecondsSinceEpoch ~/
      Duration.millisecondsPerDay;

  for (final c in completions) {
    (daysByHabit[c.habitId] ??= <int>{}).add(dayIndex(c.completedAt));
  }

  final today = dayIndex(DateTime.now());
  final result = <int, int>{};
  daysByHabit.forEach((habitId, days) {
    // Kette darf heute ODER gestern beginnen.
    var cursor = days.contains(today) ? today : today - 1;
    var streak = 0;
    while (days.contains(cursor)) {
      streak++;
      cursor--;
    }
    result[habitId] = streak;
  });
  return result;
});

/// Platzhalter-Gate für spätere Monetarisierung (v1: alles frei).
final premiumGateProvider = Provider<PremiumGate>((ref) => const PremiumGate());
