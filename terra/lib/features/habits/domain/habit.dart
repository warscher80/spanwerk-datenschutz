import '../../ecosystem/domain/species.dart';

/// Zielrhythmus eines Habits. In v1 nur `daily`, als Enum für spätere
/// Erweiterung (z. B. weekly) angelegt.
enum HabitTargetType { daily }

/// Reines Domänenmodell eines Habits – unabhängig von Drift/DB.
class Habit {
  const Habit({
    required this.id,
    required this.title,
    required this.speciesType,
    required this.createdAt,
    required this.isActive,
    required this.targetType,
  });

  final int id;
  final String title;
  final SpeciesType speciesType;
  final DateTime createdAt;
  final bool isActive;
  final HabitTargetType targetType;

  SpeciesTraits get species => Species.traits(speciesType);

  Habit copyWith({
    int? id,
    String? title,
    SpeciesType? speciesType,
    DateTime? createdAt,
    bool? isActive,
    HabitTargetType? targetType,
  }) {
    return Habit(
      id: id ?? this.id,
      title: title ?? this.title,
      speciesType: speciesType ?? this.speciesType,
      createdAt: createdAt ?? this.createdAt,
      isActive: isActive ?? this.isActive,
      targetType: targetType ?? this.targetType,
    );
  }
}
