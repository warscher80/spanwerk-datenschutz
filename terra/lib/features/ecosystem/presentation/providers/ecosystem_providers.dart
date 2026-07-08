import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../habits/presentation/habit_providers.dart';
import '../../domain/day_night.dart';
import '../../domain/ecosystem_state.dart';

/// Hält den aktuellen Ökosystem-Zustand.
///
/// Beim Aufbau (App-Start) wird über `advanceToNow` die Timestamp-Delta-
/// Berechnung ausgeführt: Aus (now - lastUpdatedAt) ergibt sich Wachstum bzw.
/// Verkümmern jedes Lebewesens. Kein Background-Service nötig.
class EcosystemNotifier extends AsyncNotifier<EcosystemState> {
  @override
  Future<EcosystemState> build() async {
    final repo = ref.watch(habitRepositoryProvider);
    return repo.advanceToNow(DateTime.now());
  }

  /// Habit abhaken -> Lebewesen gedeiht sofort sichtbar.
  Future<void> completeHabit(int habitId) async {
    final repo = ref.read(habitRepositoryProvider);
    final now = DateTime.now();
    await repo.completeHabit(habitId, now);
    final next = await repo.advanceToNow(now);
    state = AsyncData(next);
    ref.invalidate(completedTodayProvider);
    ref.invalidate(streaksProvider);
  }

  /// Neu berechnen (z. B. beim App-Resume).
  Future<void> refresh() async {
    final repo = ref.read(habitRepositoryProvider);
    state = AsyncData(await repo.advanceToNow(DateTime.now()));
  }
}

final ecosystemProvider =
    AsyncNotifierProvider<EcosystemNotifier, EcosystemState>(
  EcosystemNotifier.new,
);

/// Tag/Nacht-Zustand für einen konkreten Zeitpunkt. Die UI liest dies pro
/// Frame über die Animationsuhr, daher hier als reine Ableitung bereitgestellt.
DayNight dayNightAt(DateTime time) => DayNight.at(time);
