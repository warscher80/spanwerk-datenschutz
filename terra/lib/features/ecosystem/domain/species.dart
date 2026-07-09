import 'dart:ui' show Color;

/// Grobe Rolle einer Spezies im Ökosystem.
///
/// Pflanzen bilden die Lebensgrundlage; Kreaturen hängen vom Zustand der
/// Pflanzen ab (Nachbar-Effekt). Zersetzer sind ein Sonderfall am Boden.
enum SpeciesKind { plant, creature, decomposer }

/// Alle in v1 verfügbaren Lebewesen. Jedes Habit ist an genau eine Spezies
/// gebunden. Die Reihenfolge ist stabil (wird als Index in der DB gespeichert).
enum SpeciesType {
  moss,
  fern,
  glowMushroom,
  waterLens,
  snail,
  beetle,
  firefly,
}

/// Statische, rein datengetriebene Eigenschaften einer Spezies.
///
/// Bewusst frei von Flutter-Widgets, damit die Ökosystem-Kernlogik ohne
/// UI-Abhängigkeiten getestet werden kann. Farben nutzen nur `dart:ui.Color`.
class SpeciesTraits {
  const SpeciesTraits({
    required this.type,
    required this.kind,
    required this.displayName,
    required this.growthPerCompletion,
    required this.dailyDecay,
    required this.glowsAtNight,
    required this.baseColor,
    required this.accentColor,
  });

  final SpeciesType type;
  final SpeciesKind kind;

  /// Deutscher Anzeigename für die UI.
  final String displayName;

  /// Vitalitätsgewinn (0..1) je erledigtem Habit seit dem letzten Update.
  final double growthPerCompletion;

  /// Natürlicher Vitalitätsverlust pro Tag bei Vernachlässigung.
  final double dailyDecay;

  /// Leuchtet die Spezies nachts? (Pilze, Glühwürmchen.)
  final bool glowsAtNight;

  final Color baseColor;
  final Color accentColor;
}

/// Zentrale, unveränderliche Registry aller Spezies-Eigenschaften.
class Species {
  Species._();

  static const Map<SpeciesType, SpeciesTraits> _all = {
    SpeciesType.moss: SpeciesTraits(
      type: SpeciesType.moss,
      kind: SpeciesKind.plant,
      displayName: 'Moos',
      growthPerCompletion: 0.28,
      dailyDecay: 0.10,
      glowsAtNight: false,
      baseColor: Color(0xFF5C7A4A),
      accentColor: Color(0xFF83A55E),
    ),
    SpeciesType.fern: SpeciesTraits(
      type: SpeciesType.fern,
      kind: SpeciesKind.plant,
      displayName: 'Farn',
      growthPerCompletion: 0.22,
      dailyDecay: 0.14,
      glowsAtNight: false,
      baseColor: Color(0xFF4F7048),
      accentColor: Color(0xFF7BA268),
    ),
    SpeciesType.glowMushroom: SpeciesTraits(
      type: SpeciesType.glowMushroom,
      kind: SpeciesKind.decomposer,
      displayName: 'Leuchtpilz',
      growthPerCompletion: 0.26,
      dailyDecay: 0.16,
      glowsAtNight: true,
      baseColor: Color(0xFF8A7E93),
      accentColor: Color(0xFF86C7B4),
    ),
    SpeciesType.waterLens: SpeciesTraits(
      type: SpeciesType.waterLens,
      kind: SpeciesKind.plant,
      displayName: 'Wasserlinse',
      growthPerCompletion: 0.30,
      dailyDecay: 0.18,
      glowsAtNight: false,
      baseColor: Color(0xFF6E9B5A),
      accentColor: Color(0xFF9FCB7A),
    ),
    SpeciesType.snail: SpeciesTraits(
      type: SpeciesType.snail,
      kind: SpeciesKind.creature,
      displayName: 'Schnecke',
      growthPerCompletion: 0.24,
      dailyDecay: 0.12,
      glowsAtNight: false,
      baseColor: Color(0xFF8A7B6B),
      accentColor: Color(0xFFC7B299),
    ),
    SpeciesType.beetle: SpeciesTraits(
      type: SpeciesType.beetle,
      kind: SpeciesKind.creature,
      displayName: 'Käfer',
      growthPerCompletion: 0.22,
      dailyDecay: 0.14,
      glowsAtNight: false,
      baseColor: Color(0xFF3E3B44),
      accentColor: Color(0xFF7E6B4E),
    ),
    SpeciesType.firefly: SpeciesTraits(
      type: SpeciesType.firefly,
      kind: SpeciesKind.creature,
      displayName: 'Glühwürmchen',
      growthPerCompletion: 0.20,
      dailyDecay: 0.16,
      glowsAtNight: true,
      baseColor: Color(0xFFB9A24C),
      accentColor: Color(0xFFFFF1A8),
    ),
  };

  static SpeciesTraits traits(SpeciesType type) => _all[type]!;

  static List<SpeciesTraits> get all => _all.values.toList(growable: false);
}
