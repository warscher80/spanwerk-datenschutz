import 'organism.dart';

/// Aggregierter Zustand des gesamten Terrariums zu einem Zeitpunkt.
///
/// `overallBalance` ist die visuell greifbare "Life-Balance": der Mittelwert
/// der Vitalitäten. `ambientSeed` ist über die Lebensdauer des Terrariums
/// stabil und bestimmt Grundkomposition (Bodenkontur, Partikelmuster).
class EcosystemState {
  const EcosystemState({
    required this.overallBalance,
    required this.ambientSeed,
    required this.lastUpdatedAt,
    required this.organisms,
  });

  final double overallBalance;
  final int ambientSeed;
  final DateTime lastUpdatedAt;
  final List<Organism> organisms;

  EcosystemState copyWith({
    double? overallBalance,
    int? ambientSeed,
    DateTime? lastUpdatedAt,
    List<Organism>? organisms,
  }) {
    return EcosystemState(
      overallBalance: overallBalance ?? this.overallBalance,
      ambientSeed: ambientSeed ?? this.ambientSeed,
      lastUpdatedAt: lastUpdatedAt ?? this.lastUpdatedAt,
      organisms: organisms ?? this.organisms,
    );
  }

  static EcosystemState empty(int ambientSeed, DateTime at) => EcosystemState(
        overallBalance: 0,
        ambientSeed: ambientSeed,
        lastUpdatedAt: at,
        organisms: const [],
      );
}
