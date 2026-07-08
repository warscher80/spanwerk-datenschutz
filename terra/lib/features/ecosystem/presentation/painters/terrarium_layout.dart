import 'dart:ui';

import '../../domain/organism.dart';
import '../../domain/species.dart';
import 'organism_painters.dart' show SeedRandom;

/// Geometrie des Glasgefäßes für eine gegebene Canvas-Größe. Rein & stabil,
/// damit Painter und Tap-Erkennung exakt dieselben Koordinaten verwenden.
class TerrariumGeometry {
  TerrariumGeometry(this.size)
      : jar = _computeJar(size),
        soilY = _computeSoilY(size);

  final Size size;
  final Rect jar;
  final double soilY;

  static Rect _computeJar(Size size) {
    final w = size.width * 0.82;
    final h = size.height * 0.92;
    return Rect.fromLTWH((size.width - w) / 2, (size.height - h) / 2, w, h);
  }

  static double _computeSoilY(Size size) {
    final jar = _computeJar(size);
    return jar.bottom - jar.height * 0.16;
  }

  /// Weiche Glasform: schmaler Hals oben, bauchiger Körper.
  Path buildBody() {
    final neckInset = jar.width * 0.14;
    return Path()
      ..moveTo(jar.left + neckInset, jar.top)
      ..lineTo(jar.right - neckInset, jar.top)
      ..quadraticBezierTo(
          jar.right, jar.top, jar.right, jar.top + jar.height * 0.16)
      ..lineTo(jar.right, jar.bottom - jar.width * 0.22)
      ..quadraticBezierTo(
          jar.right, jar.bottom, jar.right - jar.width * 0.22, jar.bottom)
      ..lineTo(jar.left + jar.width * 0.22, jar.bottom)
      ..quadraticBezierTo(
          jar.left, jar.bottom, jar.left, jar.bottom - jar.width * 0.22)
      ..lineTo(jar.left, jar.top + jar.height * 0.16)
      ..quadraticBezierTo(jar.left, jar.top, jar.left + neckInset, jar.top)
      ..close();
  }
}

/// Ein platziertes Lebewesen: Basisposition + Referenzgröße. Die Animation
/// (Wiegen/Drift) wird erst im Painter aufaddiert; für Layout & Tap zählt der
/// ruhende Ankerpunkt.
class PlacedOrganism {
  const PlacedOrganism({
    required this.organism,
    required this.anchor,
    required this.size,
  });

  final Organism organism;
  final Offset anchor;
  final double size;
}

/// Referenzgröße je Spezies als Anteil der Glashöhe. Bewusst klein gehalten,
/// damit das Terrarium lebendig-dicht statt clipart-blockig wirkt.
double speciesSize(SpeciesType s, double v, double jarH) {
  final f = switch (s) {
    SpeciesType.moss => 0.070 + 0.045 * v,
    SpeciesType.fern => 0.115 + 0.085 * v,
    SpeciesType.glowMushroom => 0.080 + 0.055 * v,
    SpeciesType.waterLens => 0.060 + 0.040 * v,
    SpeciesType.snail => 0.048 + 0.028 * v,
    SpeciesType.beetle => 0.042 + 0.024 * v,
    SpeciesType.firefly => 0.045 + 0.020 * v,
  };
  return jarH * f;
}

bool _isCreature(SpeciesType s) =>
    s == SpeciesType.snail || s == SpeciesType.beetle;

/// Deterministische Komposition aller Lebewesen aus [ambientSeed] + Seeds.
/// Reihenfolge = Zeichenreihenfolge (hinten -> vorne): Pflanzen, Kreaturen,
/// Glühwürmchen.
List<PlacedOrganism> layoutTerrarium(
  List<Organism> organisms,
  TerrariumGeometry geo,
  int ambientSeed,
) {
  if (organisms.isEmpty) return const [];

  final plants = organisms
      .where((o) =>
          o.speciesType != SpeciesType.firefly && !_isCreature(o.speciesType))
      .toList()
    ..sort((a, b) => a.seed.compareTo(b.seed));
  final creatures = organisms.where((o) => _isCreature(o.speciesType)).toList()
    ..sort((a, b) => a.seed.compareTo(b.seed));
  final fliers =
      organisms.where((o) => o.speciesType == SpeciesType.firefly).toList()
        ..sort((a, b) => a.seed.compareTo(b.seed));

  final jar = geo.jar;
  final soilY = geo.soilY;
  final usableLeft = jar.left + jar.width * 0.10;
  final usableWidth = jar.width * 0.80;
  final result = <PlacedOrganism>[];

  // Alle Boden-Bewohner teilen sich EINEN Satz horizontaler Slots (kein
  // Übereinanderstapeln); die Slot-Zuordnung folgt der seed-Reihenfolge, wodurch
  // Pflanzen & Kreaturen natürlich durchmischt stehen.
  final ground = [...plants, ...creatures]
    ..sort((a, b) => a.seed.compareTo(b.seed));
  final slotOf = <int, double>{};
  for (var i = 0; i < ground.length; i++) {
    slotOf[ground[i].id] = ground.length == 1 ? 0.5 : (i + 0.5) / ground.length;
  }

  void place(Organism o, double baseline) {
    final rng = SeedRandom(o.seed ^ ambientSeed);
    final jitter = rng.range(-0.03, 0.03);
    final x = usableLeft + (slotOf[o.id]! + jitter).clamp(0.02, 0.98) * usableWidth;
    final depth = rng.range(-4, 8);
    result.add(PlacedOrganism(
      organism: o,
      anchor: Offset(x, baseline + depth),
      size: speciesSize(o.speciesType, o.vitality, jar.height),
    ));
  }

  // Pflanzen zuerst (hinten), Kreaturen danach (vorne) – Tiefe.
  for (final o in plants) {
    place(o, soilY + 2);
  }
  for (final o in creatures) {
    place(o, soilY + 6);
  }

  for (final o in fliers) {
    final rng = SeedRandom(o.seed ^ (ambientSeed + 7));
    final x = usableLeft + rng.range(0.1, 0.9) * usableWidth;
    final y = jar.top + jar.height * rng.range(0.28, 0.62);
    result.add(PlacedOrganism(
      organism: o,
      anchor: Offset(x, y),
      size: speciesSize(o.speciesType, o.vitality, jar.height),
    ));
  }

  return result;
}

/// Findet das dem Tipppunkt [pos] am nächsten liegende Lebewesen innerhalb
/// seiner Trefferzone – oder null. Rein & testbar; von der TerrariumView beim
/// Antippen genutzt.
PlacedOrganism? hitTestOrganism(List<PlacedOrganism> placed, Offset pos) {
  PlacedOrganism? hit;
  var best = double.infinity;
  for (final p in placed) {
    final radius = (p.size * 0.55).clamp(28.0, 120.0);
    // Anker liegt bei Pflanzen am Boden – Trefferzone nach oben verschieben.
    final center = Offset(p.anchor.dx, p.anchor.dy - p.size * 0.35);
    final d = (center - pos).distance;
    if (d < radius && d < best) {
      best = d;
      hit = p;
    }
  }
  return hit;
}
