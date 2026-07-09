import 'package:flutter_test/flutter_test.dart';
import 'package:terra/features/ecosystem/domain/compute_ecosystem.dart';
import 'package:terra/features/ecosystem/domain/ecosystem_state.dart';
import 'package:terra/features/ecosystem/domain/organism.dart';
import 'package:terra/features/ecosystem/domain/species.dart';
import 'package:terra/features/habits/domain/habit_completion.dart';

/// Fester Referenzzeitpunkt – die Kernlogik ruft nie DateTime.now() auf,
/// daher sind alle Tests deterministisch.
final DateTime t0 = DateTime.utc(2026, 1, 1, 12);

Organism organism({
  required int id,
  required SpeciesType type,
  required double vitality,
  required DateTime updatedAt,
}) {
  return Organism(
    id: id,
    habitId: id,
    speciesType: type,
    vitality: vitality,
    lastUpdatedAt: updatedAt,
    seed: id * 7,
  );
}

EcosystemState stateWith(List<Organism> organisms, DateTime at) {
  return EcosystemState(
    overallBalance: 0,
    ambientSeed: 42,
    lastUpdatedAt: at,
    organisms: organisms,
  );
}

void main() {
  group('computeEcosystem – Decay über Zeit', () {
    test('Vitalität sinkt ohne Erledigung mit der Zeit', () {
      final prev = stateWith(
        [organism(id: 1, type: SpeciesType.moss, vitality: 0.8, updatedAt: t0)],
        t0,
      );

      final next = computeEcosystem(prev, const [], t0.add(const Duration(days: 2)));

      final moss = next.organisms.single;
      // Moos: dailyDecay 0.10 -> nach 2 Tagen 0.8 - 0.20 = 0.60.
      expect(moss.vitality, closeTo(0.60, 1e-9));
      expect(moss.lastUpdatedAt, t0.add(const Duration(days: 2)));
    });

    test('Vitalität wird bei 0 abgeschnitten (kein Negativwert)', () {
      final prev = stateWith(
        [organism(id: 1, type: SpeciesType.fern, vitality: 0.1, updatedAt: t0)],
        t0,
      );

      final next =
          computeEcosystem(prev, const [], t0.add(const Duration(days: 30)));

      expect(next.organisms.single.vitality, 0.0);
    });
  });

  group('computeEcosystem – Wachstum bei Erledigung', () {
    test('Erledigung nach letztem Update erhöht die Vitalität', () {
      final prev = stateWith(
        [organism(id: 1, type: SpeciesType.moss, vitality: 0.3, updatedAt: t0)],
        t0,
      );
      final now = t0.add(const Duration(hours: 6));
      final completions = [
        HabitCompletion(id: 1, habitId: 1, completedAt: t0.add(const Duration(hours: 3))),
      ];

      final next = computeEcosystem(prev, completions, now);

      // Wachstum 0.28, Decay 0.10 * 0.25 Tage = 0.025 -> 0.3 + 0.28 - 0.025.
      expect(next.organisms.single.vitality, closeTo(0.555, 1e-9));
      expect(next.organisms.single.vitality, greaterThan(0.3));
    });

    test('Nur Erledigungen NACH lastUpdatedAt zählen', () {
      final prev = stateWith(
        [organism(id: 1, type: SpeciesType.moss, vitality: 0.5, updatedAt: t0)],
        t0,
      );
      final now = t0.add(const Duration(hours: 1));
      // Erledigung liegt VOR lastUpdatedAt -> darf nicht doppelt zählen.
      final completions = [
        HabitCompletion(id: 1, habitId: 1, completedAt: t0.subtract(const Duration(hours: 5))),
      ];

      final next = computeEcosystem(prev, completions, now);

      // Kein Wachstum, nur minimaler Decay.
      expect(next.organisms.single.vitality, lessThan(0.5));
    });

    test('Vitalität wird bei 1 gedeckelt', () {
      final prev = stateWith(
        [organism(id: 1, type: SpeciesType.waterLens, vitality: 0.95, updatedAt: t0)],
        t0,
      );
      final completions = [
        HabitCompletion(id: 1, habitId: 1, completedAt: t0.add(const Duration(minutes: 10))),
      ];

      final next = computeEcosystem(prev, completions, t0.add(const Duration(minutes: 20)));

      expect(next.organisms.single.vitality, 1.0);
    });
  });

  group('computeEcosystem – Nachbar-Effekt', () {
    test('Kreaturen leiden zusätzlich, wenn die Pflanzen verkümmern', () {
      // Szenario A: Pflanze gesund. Szenario B: Pflanze am Boden.
      // Dieselbe Kreatur mit gleichem Startzustand muss in B stärker verlieren.
      Organism creature() => organism(
            id: 2,
            type: SpeciesType.firefly,
            vitality: 0.7,
            updatedAt: t0,
          );

      final healthyPlants = stateWith(
        [organism(id: 1, type: SpeciesType.moss, vitality: 1.0, updatedAt: t0), creature()],
        t0,
      );
      final deadPlants = stateWith(
        [organism(id: 1, type: SpeciesType.moss, vitality: 0.0, updatedAt: t0), creature()],
        t0,
      );

      final now = t0.add(const Duration(days: 3));
      final a = computeEcosystem(healthyPlants, const [], now);
      final b = computeEcosystem(deadPlants, const [], now);

      final creatureA = a.organisms.firstWhere((o) => o.id == 2).vitality;
      final creatureB = b.organisms.firstWhere((o) => o.id == 2).vitality;

      expect(creatureB, lessThan(creatureA));
    });

    test('overallBalance ist der Mittelwert der Vitalitäten', () {
      final prev = stateWith(
        [
          organism(id: 1, type: SpeciesType.moss, vitality: 0.6, updatedAt: t0),
          organism(id: 2, type: SpeciesType.fern, vitality: 0.4, updatedAt: t0),
        ],
        t0,
      );

      // now == lastUpdatedAt -> kein Decay, Werte bleiben, Balance = 0.5.
      final next = computeEcosystem(prev, const [], t0);

      expect(next.overallBalance, closeTo(0.5, 1e-9));
    });
  });

  test('Leeres Terrarium bleibt stabil', () {
    final prev = stateWith(const [], t0);
    final next = computeEcosystem(prev, const [], t0.add(const Duration(days: 5)));
    expect(next.organisms, isEmpty);
    expect(next.overallBalance, 0);
    expect(next.lastUpdatedAt, t0.add(const Duration(days: 5)));
  });
}
