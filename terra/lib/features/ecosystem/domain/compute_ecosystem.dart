import '../../habits/domain/habit_completion.dart';
import 'ecosystem_state.dart';
import 'organism.dart';
import 'species.dart';

/// Reine, deterministische Kernlogik des Terrariums.
///
/// [computeEcosystem] leitet aus dem vorherigen Zustand, den bekannten
/// Erledigungen und der aktuellen Zeit den neuen Zustand ab. Die Funktion
/// hat KEINE Seiteneffekte, ruft NICHT `DateTime.now()` auf und ist damit
/// vollständig testbar (Decay über Zeit, Wachstum bei Erledigung,
/// Nachbar-Effekt).
///
/// Prinzip:
///  1. Für jeden Organismus wird aus (now - lastUpdatedAt) ein natürlicher
///     Verfall berechnet.
///  2. Erledigungen seit dem letzten Update erhöhen die Vitalität.
///  3. Kreaturen sind an den Zustand der Pflanzen gekoppelt (Nachbar-Effekt):
///     verkümmert die Pflanzenwelt, leiden die Tiere zusätzlich.
class EcosystemTuning {
  const EcosystemTuning();

  /// Wie stark schlechte Pflanzen-Balance zusätzlich auf Kreaturen wirkt
  /// (pro Tag, skaliert mit dem Pflanzen-Defizit).
  static const double neighborCoupling = 0.08;
}

EcosystemState computeEcosystem(
  EcosystemState previous,
  List<HabitCompletion> completions,
  DateTime now,
) {
  if (previous.organisms.isEmpty) {
    return previous.copyWith(
      overallBalance: 0,
      lastUpdatedAt: now,
      organisms: const [],
    );
  }

  // Erledigungen nach habitId gruppieren – einmalig, O(n).
  final Map<int, List<DateTime>> byHabit = {};
  for (final c in completions) {
    (byHabit[c.habitId] ??= <DateTime>[]).add(c.completedAt);
  }

  // --- Pass 1: intrinsische Vitalität je Organismus ---
  final Map<int, double> intrinsic = {}; // organismId -> vitality
  final Map<int, double> elapsedDaysById = {};

  for (final o in previous.organisms) {
    final double elapsedDays = _daysBetween(o.lastUpdatedAt, now);
    elapsedDaysById[o.id] = elapsedDays;

    final traits = o.species;

    // Verfall über die Zeit.
    final double decay = traits.dailyDecay * elapsedDays;

    // Wachstum: jede Erledigung STRIKT nach dem letzten Update zählt einmal.
    final habitCompletions = byHabit[o.habitId] ?? const <DateTime>[];
    int fresh = 0;
    for (final t in habitCompletions) {
      if (t.isAfter(o.lastUpdatedAt) && !t.isAfter(now)) fresh++;
    }
    final double growth = fresh * traits.growthPerCompletion;

    intrinsic[o.id] = _clamp01(o.vitality - decay + growth);
  }

  // Pflanzen-Balance (Pflanzen + Zersetzer bilden die Lebensgrundlage).
  final plantVitalities = <double>[];
  for (final o in previous.organisms) {
    if (o.species.kind != SpeciesKind.creature) {
      plantVitalities.add(intrinsic[o.id]!);
    }
  }
  final double plantBalance =
      plantVitalities.isEmpty ? 1.0 : _mean(plantVitalities);

  // --- Pass 2: Nachbar-Kopplung für Kreaturen ---
  final List<Organism> updated = [];
  for (final o in previous.organisms) {
    double v = intrinsic[o.id]!;

    if (o.species.kind == SpeciesKind.creature) {
      final double deficit = 1.0 - plantBalance;
      final double penalty = EcosystemTuning.neighborCoupling *
          deficit *
          elapsedDaysById[o.id]!;
      v = _clamp01(v - penalty);
    }

    updated.add(o.copyWith(vitality: v, lastUpdatedAt: now));
  }

  final double overall = _mean(updated.map((o) => o.vitality).toList());

  return previous.copyWith(
    overallBalance: overall,
    lastUpdatedAt: now,
    organisms: updated,
  );
}

/// Fraktionale Tage zwischen zwei Zeitpunkten, nie negativ (Uhr-Rücksprung).
double _daysBetween(DateTime from, DateTime to) {
  final micros = to.difference(from).inMicroseconds;
  if (micros <= 0) return 0;
  return micros / Duration.microsecondsPerDay;
}

double _clamp01(double v) => v < 0
    ? 0
    : v > 1
        ? 1
        : v;

double _mean(List<double> xs) {
  if (xs.isEmpty) return 0;
  double s = 0;
  for (final x in xs) {
    s += x;
  }
  return s / xs.length;
}
