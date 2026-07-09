import 'species.dart';

/// Wachstumsstufe eines Lebewesens, abgeleitet aus der Vitalität.
/// Steuert Detailgrad und Größe im Rendering.
enum GrowthStage {
  withering, // verkümmert
  sprouting, // jung / austreibend
  thriving, // gedeiht
  flourishing, // blühend
}

/// Der lebende Zustand eines Habits im Terrarium.
///
/// Ein Organism ist 1:1 an ein Habit gebunden. `vitality` (0..1) ist der
/// zentrale, über die Zeit berechnete Zustand. `seed` ist stabil und leitet
/// die visuelle Anordnung/Variation ab (Einzigartigkeit pro Nutzer).
class Organism {
  const Organism({
    required this.id,
    required this.habitId,
    required this.speciesType,
    required this.vitality,
    required this.lastUpdatedAt,
    required this.seed,
  });

  final int id;
  final int habitId;
  final SpeciesType speciesType;

  /// 0 = tot/verkümmert, 1 = voll gediehen.
  final double vitality;

  final DateTime lastUpdatedAt;

  /// Stabiler Seed für deterministische visuelle Variation.
  final int seed;

  SpeciesTraits get species => Species.traits(speciesType);

  /// Diskrete Wachstumsstufe aus der kontinuierlichen Vitalität.
  GrowthStage get stage {
    if (vitality < 0.2) return GrowthStage.withering;
    if (vitality < 0.5) return GrowthStage.sprouting;
    if (vitality < 0.8) return GrowthStage.thriving;
    return GrowthStage.flourishing;
  }

  Organism copyWith({
    int? id,
    int? habitId,
    SpeciesType? speciesType,
    double? vitality,
    DateTime? lastUpdatedAt,
    int? seed,
  }) {
    return Organism(
      id: id ?? this.id,
      habitId: habitId ?? this.habitId,
      speciesType: speciesType ?? this.speciesType,
      vitality: vitality ?? this.vitality,
      lastUpdatedAt: lastUpdatedAt ?? this.lastUpdatedAt,
      seed: seed ?? this.seed,
    );
  }
}
