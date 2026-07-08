import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme.dart';
import '../../domain/day_night.dart';
import '../../domain/organism.dart';
import '../../domain/species.dart';
import 'organism_painters.dart';

/// Zeichnet das komplette Terrarium: Glas, Tag/Nacht-Himmel, Lichtstrahl mit
/// schwebenden Partikeln, Boden und alle Lebewesen. Die Komposition wird aus
/// [ambientSeed] + den Organismus-Seeds abgeleitet → jedes Terrarium ist
/// visuell einzigartig.
class TerrariumPainter extends CustomPainter {
  TerrariumPainter({
    required this.organisms,
    required this.overallBalance,
    required this.ambientSeed,
    required this.dayNight,
    required this.t,
  });

  final List<Organism> organisms;
  final double overallBalance;
  final int ambientSeed;
  final DayNight dayNight;

  /// Kontinuierliche Animationsphase 0..1.
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final jar = _jarRect(size);
    final body = _jarPath(jar);

    canvas.save();
    canvas.clipPath(body);

    _paintSky(canvas, jar);
    _paintLightBeam(canvas, jar);
    _paintParticles(canvas, jar);
    _paintSoil(canvas, jar);
    _paintOrganisms(canvas, jar);
    _paintVignette(canvas, jar);

    canvas.restore();

    _paintGlass(canvas, body, jar);
  }

  // --- Geometrie -------------------------------------------------------------

  Rect _jarRect(Size size) {
    final w = size.width * 0.82;
    final h = size.height * 0.92;
    final left = (size.width - w) / 2;
    final top = (size.height - h) / 2;
    return Rect.fromLTWH(left, top, w, h);
  }

  Path _jarPath(Rect jar) {
    // Weiche Glasform: schmaler Hals oben, bauchiger Körper.
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

  double _soilYOf(Rect jar) => jar.bottom - jar.height * 0.16;

  // --- Himmel / Tag-Nacht ----------------------------------------------------

  void _paintSky(Canvas canvas, Rect jar) {
    final d = dayNight.daylight;
    final top = Color.lerp(TerraColors.nightTop, TerraColors.dayTop, d)!;
    final bottom = Color.lerp(TerraColors.nightBottom, TerraColors.dayBottom, d)!;

    final paint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [top, bottom],
      ).createShader(jar);
    canvas.drawRect(jar, paint);
  }

  // --- Lichtstrahl von oben --------------------------------------------------

  void _paintLightBeam(Canvas canvas, Rect jar) {
    // Weicher, diffuser Sonnenschacht – bewusst zurückhaltend, kein Scheinwerfer.
    final intensity = 0.035 + 0.075 * dayNight.daylight;
    final soilY = _soilYOf(jar);
    final beam = Path()
      ..moveTo(jar.left + jar.width * 0.34, jar.top)
      ..lineTo(jar.left + jar.width * 0.54, jar.top)
      ..lineTo(jar.left + jar.width * 0.72, soilY)
      ..lineTo(jar.left + jar.width * 0.22, soilY)
      ..close();
    final paint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFFFFF6D8).withValues(alpha: intensity),
          const Color(0xFFFFF6D8).withValues(alpha: intensity * 0.35),
          const Color(0xFFFFF6D8).withValues(alpha: 0),
        ],
        stops: const [0.0, 0.55, 1.0],
      ).createShader(jar)
      ..blendMode = BlendMode.plus
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18);
    canvas.drawPath(beam, paint);
  }

  // --- Schwebende Partikel (Sporen/Staub) ------------------------------------

  void _paintParticles(Canvas canvas, Rect jar) {
    final rng = SeedRandom(ambientSeed ^ 0x51ed);
    const count = 22;
    final visible = 0.25 + 0.65 * dayNight.daylight;
    final paint = Paint()..color = const Color(0xFFFFF3D0);

    for (var i = 0; i < count; i++) {
      final baseX = rng.range(jar.left + 8, jar.right - 8);
      final baseY = rng.range(jar.top + 8, _soilYOf(jar));
      final speed = rng.range(0.4, 1.2);
      final phase = rng.range(0, 2 * math.pi);
      // Langsames Aufsteigen + seitliches Wiegen.
      final dy = ((t * speed) % 1.0) * jar.height * 0.5;
      final y = baseY - dy;
      final wrappedY = y < jar.top + 6 ? y + jar.height * 0.5 : y;
      final x = baseX + math.sin(t * 2 * math.pi + phase) * 6;
      final r = rng.range(0.6, 1.8);
      final a = (0.15 + 0.45 * rng.next()) * visible;
      canvas.drawCircle(Offset(x, wrappedY), r, paint..color = paint.color.withValues(alpha: a));
    }
  }

  // --- Boden -----------------------------------------------------------------

  void _paintSoil(Canvas canvas, Rect jar) {
    // Vernachlässigung verdunkelt den Boden (Nachbar-/Balance-Effekt).
    // Ein leeres Terrarium ist "frische Erde", nicht toter Boden.
    final health = organisms.isEmpty ? 0.55 : overallBalance;
    final soilColor = Color.lerp(
        const Color(0xFF1A140E), TerraColors.soil, (0.3 + 0.7 * health))!;

    final soil = Path()
      ..moveTo(jar.left, _soilYOf(jar) + 6)
      ..cubicTo(
        jar.left + jar.width * 0.25, _soilYOf(jar) - 8,
        jar.left + jar.width * 0.55, _soilYOf(jar) + 10,
        jar.right, _soilYOf(jar),
      )
      ..lineTo(jar.right, jar.bottom)
      ..lineTo(jar.left, jar.bottom)
      ..close();
    canvas.drawPath(soil, Paint()..color = soilColor);

    // Feuchter Glanz am Bodenrand.
    canvas.drawPath(
      soil,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = TerraColors.moss.withValues(alpha: 0.15 * health),
    );
  }

  // --- Lebewesen -------------------------------------------------------------

  /// Referenzgröße je Spezies als Anteil der Glashöhe. Bewusst klein gehalten,
  /// damit das Terrarium lebendig-dicht statt clipart-blockig wirkt. Kreaturen
  /// sind deutlich kleiner als Pflanzen.
  double _speciesSize(SpeciesType s, double v, double jarH) {
    final f = switch (s) {
      SpeciesType.moss => 0.070 + 0.045 * v,
      SpeciesType.fern => 0.110 + 0.075 * v,
      SpeciesType.glowMushroom => 0.080 + 0.050 * v,
      SpeciesType.waterLens => 0.060 + 0.040 * v,
      SpeciesType.snail => 0.048 + 0.028 * v,
      SpeciesType.beetle => 0.040 + 0.022 * v,
      SpeciesType.firefly => 0.045 + 0.020 * v,
    };
    return jarH * f;
  }

  void _paintOrganisms(Canvas canvas, Rect jar) {
    if (organisms.isEmpty) return;

    bool isCreature(SpeciesType s) =>
        s == SpeciesType.snail || s == SpeciesType.beetle;

    // Pflanzen hinten, Kreaturen davor, Glühwürmchen im Luftraum – ergibt Tiefe.
    final plants = organisms
        .where((o) =>
            o.speciesType != SpeciesType.firefly && !isCreature(o.speciesType))
        .toList()
      ..sort((a, b) => a.seed.compareTo(b.seed));
    final creatures = organisms
        .where((o) => isCreature(o.speciesType))
        .toList()
      ..sort((a, b) => a.seed.compareTo(b.seed));
    final fliers =
        organisms.where((o) => o.speciesType == SpeciesType.firefly).toList()
          ..sort((a, b) => a.seed.compareTo(b.seed));

    final soilY = _soilYOf(jar);
    final usableLeft = jar.left + jar.width * 0.10;
    final usableWidth = jar.width * 0.80;

    void placeGround(List<Organism> list, {required double baseline}) {
      for (var i = 0; i < list.length; i++) {
        final o = list[i];
        final rng = SeedRandom(o.seed ^ ambientSeed);
        final slot = list.length == 1 ? 0.5 : (i + 0.5) / list.length;
        final jitter = rng.range(-0.05, 0.05);
        final x =
            usableLeft + (slot + jitter).clamp(0.02, 0.98) * usableWidth;
        // Leichter Tiefenversatz: manche etwas tiefer eingebettet.
        final depth = rng.range(-4, 8);
        paintOrganism(
          canvas,
          OrganismVisual(
            species: o.speciesType,
            anchor: Offset(x, baseline + depth),
            size: _speciesSize(o.speciesType, o.vitality, jar.height),
            vitality: o.vitality,
            stage: o.stage,
            seed: o.seed,
            t: t,
            nightGlow: dayNight.nightGlow,
          ),
        );
      }
    }

    placeGround(plants, baseline: soilY + 2);
    placeGround(creatures, baseline: soilY + 6);

    // Glühwürmchen schweben im Luftraum über dem Boden.
    for (var i = 0; i < fliers.length; i++) {
      final o = fliers[i];
      final rng = SeedRandom(o.seed ^ (ambientSeed + 7));
      final x = usableLeft + rng.range(0.1, 0.9) * usableWidth;
      final y = jar.top + jar.height * rng.range(0.28, 0.62);
      paintOrganism(
        canvas,
        OrganismVisual(
          species: o.speciesType,
          anchor: Offset(x, y),
          size: _speciesSize(o.speciesType, o.vitality, jar.height),
          vitality: o.vitality,
          stage: o.stage,
          seed: o.seed,
          t: t,
          nightGlow: dayNight.nightGlow,
        ),
      );
    }
  }

  // --- Vignette: sanfte Tiefe zu den Rändern ---------------------------------

  void _paintVignette(Canvas canvas, Rect jar) {
    final paint = Paint()
      ..shader = RadialGradient(
        center: const Alignment(0, -0.15),
        radius: 0.95,
        colors: [
          Colors.transparent,
          Colors.black.withValues(alpha: 0.06),
          Colors.black.withValues(alpha: 0.28),
        ],
        stops: const [0.55, 0.82, 1.0],
      ).createShader(jar);
    canvas.drawRect(jar, paint);
  }

  // --- Glas: Reflexe + Rand --------------------------------------------------

  void _paintGlass(Canvas canvas, Path body, Rect jar) {
    // Zarter Innenschatten am Rand.
    canvas.drawPath(
      body,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..color = Colors.black.withValues(alpha: 0.25),
    );

    // Sehr zarter, breiter Glanzstreifen links (Glasreflexion).
    final highlight = Path()
      ..moveTo(jar.left + jar.width * 0.13, jar.top + jar.height * 0.05)
      ..lineTo(jar.left + jar.width * 0.19, jar.top + jar.height * 0.05)
      ..lineTo(jar.left + jar.width * 0.11, jar.bottom - jar.height * 0.18)
      ..lineTo(jar.left + jar.width * 0.06, jar.bottom - jar.height * 0.18)
      ..close();
    canvas.drawPath(
      highlight,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.03)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14),
    );

    // Heller Randlicht-Kontur.
    canvas.drawPath(
      body,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..color = TerraColors.glassTint.withValues(alpha: 0.18),
    );
  }

  @override
  bool shouldRepaint(covariant TerrariumPainter old) {
    return old.t != t ||
        old.overallBalance != overallBalance ||
        old.organisms != organisms ||
        old.dayNight.daylight != dayNight.daylight;
  }
}
