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
    final intensity = 0.10 + 0.22 * dayNight.daylight;
    final beam = Path()
      ..moveTo(jar.left + jar.width * 0.30, jar.top)
      ..lineTo(jar.left + jar.width * 0.55, jar.top)
      ..lineTo(jar.left + jar.width * 0.78, _soilYOf(jar))
      ..lineTo(jar.left + jar.width * 0.18, _soilYOf(jar))
      ..close();
    final paint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFFFFF6D8).withValues(alpha: intensity),
          const Color(0xFFFFF6D8).withValues(alpha: 0),
        ],
      ).createShader(jar)
      ..blendMode = BlendMode.plus;
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
    final health = overallBalance;
    final soilColor = Color.lerp(
        const Color(0xFF14100C), TerraColors.soil, (0.3 + 0.7 * health))!;

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

  void _paintOrganisms(Canvas canvas, Rect jar) {
    if (organisms.isEmpty) return;

    // Boden-Bewohner deterministisch anordnen (stabil über Seeds).
    final ground = organisms
        .where((o) => o.speciesType != SpeciesType.firefly)
        .toList()
      ..sort((a, b) => a.seed.compareTo(b.seed));
    final fliers =
        organisms.where((o) => o.speciesType == SpeciesType.firefly).toList()
          ..sort((a, b) => a.seed.compareTo(b.seed));

    final usableLeft = jar.left + jar.width * 0.12;
    final usableWidth = jar.width * 0.76;

    for (var i = 0; i < ground.length; i++) {
      final o = ground[i];
      final rng = SeedRandom(o.seed ^ ambientSeed);
      final slot = ground.length == 1
          ? 0.5
          : (i + 0.5) / ground.length;
      final jitter = rng.range(-0.04, 0.04);
      final x = usableLeft + (slot + jitter).clamp(0.02, 0.98) * usableWidth;
      final orgSize = jar.height * (0.16 + 0.14 * o.vitality);

      paintOrganism(
        canvas,
        OrganismVisual(
          species: o.speciesType,
          anchor: Offset(x, _soilYOf(jar) + 2),
          size: orgSize,
          vitality: o.vitality,
          stage: o.stage,
          seed: o.seed,
          t: t,
          nightGlow: dayNight.nightGlow,
        ),
      );
    }

    // Glühwürmchen schweben im Luftraum über dem Boden.
    for (var i = 0; i < fliers.length; i++) {
      final o = fliers[i];
      final rng = SeedRandom(o.seed ^ (ambientSeed + 7));
      final x = usableLeft + rng.range(0.1, 0.9) * usableWidth;
      final y = jar.top + jar.height * rng.range(0.25, 0.6);
      final orgSize = jar.height * (0.14 + 0.1 * o.vitality);
      paintOrganism(
        canvas,
        OrganismVisual(
          species: o.speciesType,
          anchor: Offset(x, y),
          size: orgSize,
          vitality: o.vitality,
          stage: o.stage,
          seed: o.seed,
          t: t,
          nightGlow: dayNight.nightGlow,
        ),
      );
    }
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

    // Weicher Glanzstreifen links.
    final highlight = Path()
      ..moveTo(jar.left + jar.width * 0.14, jar.top + jar.height * 0.06)
      ..lineTo(jar.left + jar.width * 0.20, jar.top + jar.height * 0.06)
      ..lineTo(jar.left + jar.width * 0.10, jar.bottom - jar.height * 0.12)
      ..lineTo(jar.left + jar.width * 0.05, jar.bottom - jar.height * 0.12)
      ..close();
    canvas.drawPath(
      highlight,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.06)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
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
