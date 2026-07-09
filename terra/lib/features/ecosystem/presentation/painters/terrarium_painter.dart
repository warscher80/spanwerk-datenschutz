import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme.dart';
import '../../domain/day_night.dart';
import '../../domain/organism.dart';
import 'organism_painters.dart';
import 'terrarium_layout.dart';

/// Zeichnet das komplette Terrarium: Glas, Tag/Nacht-Himmel (inkl. Sterne,
/// Mondglühen, goldener Dämmerung), Lichtstrahl, Tiefen-Silhouetten,
/// schwebende Partikel, Bodennebel, Kiesel, Boden, alle Lebewesen,
/// Kondenströpfchen und Glasreflexe. Komposition wird aus [ambientSeed] +
/// den Organismus-Seeds abgeleitet → jedes Terrarium ist visuell einzigartig.
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
    final geo = TerrariumGeometry(size);
    final jar = geo.jar;
    final body = geo.buildBody();

    canvas.save();
    canvas.clipPath(body);

    _paintSky(canvas, jar);
    _paintStarsAndMoon(canvas, jar);
    _paintDuskWarmth(canvas, jar, geo.soilY);
    _paintLightBeam(canvas, jar, geo.soilY);
    _paintBackdrop(canvas, jar, geo.soilY);
    _paintParticles(canvas, jar, geo.soilY);
    _paintHaze(canvas, jar, geo.soilY);
    _paintSoil(canvas, jar, geo.soilY);
    _paintPebbles(canvas, jar, geo.soilY);
    _paintOrganisms(canvas, geo);
    _paintVignette(canvas, jar);
    _paintCondensation(canvas, jar);

    canvas.restore();

    _paintGlass(canvas, body, jar);
  }

  // --- Himmel / Tag-Nacht ----------------------------------------------------

  void _paintSky(Canvas canvas, Rect jar) {
    final d = dayNight.daylight;
    final top = Color.lerp(TerraColors.nightTop, TerraColors.dayTop, d)!;
    final bottom = Color.lerp(TerraColors.nightBottom, TerraColors.dayBottom, d)!;
    canvas.drawRect(
      jar,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [top, bottom],
        ).createShader(jar),
    );
  }

  void _paintStarsAndMoon(Canvas canvas, Rect jar) {
    final night = dayNight.nightGlow;
    if (night < 0.15) return;

    // Mondglühen hoch oben.
    final moonC = Offset(
        jar.left + jar.width * 0.72, jar.top + jar.height * 0.14);
    canvas.drawCircle(
      moonC,
      jar.width * 0.16,
      Paint()
        ..color = const Color(0xFFCFE0F0).withValues(alpha: 0.10 * night)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 40),
    );
    canvas.drawCircle(
      moonC,
      jar.width * 0.052,
      Paint()
        ..color = const Color(0xFFDCE6F0).withValues(alpha: 0.16 * night)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );

    // Sterne: seed-stabile Positionen, sanftes Funkeln.
    final rng = SeedRandom(ambientSeed ^ 0x2b17);
    final star = Paint()..color = const Color(0xFFEFF3FA);
    for (var i = 0; i < 26; i++) {
      final sx = rng.range(jar.left + 10, jar.right - 10);
      final sy = rng.range(jar.top + 10, jar.top + jar.height * 0.6);
      final twinkle = 0.5 + 0.5 * math.sin(t * 2 * math.pi + i * 1.7);
      final a = (0.15 + 0.5 * rng.next()) * night * twinkle;
      canvas.drawCircle(Offset(sx, sy), rng.range(0.6, 1.6), star..color = star.color.withValues(alpha: a));
    }
  }

  /// Goldene Stunde: warmes Horizontglühen, wenn die Sonne nahe am Horizont
  /// steht (Dämmerung). Kontinuierlich, kein harter Phasenwechsel.
  void _paintDuskWarmth(Canvas canvas, Rect jar, double soilY) {
    final warmth = (1 - (dayNight.daylight - 0.33).abs() / 0.33).clamp(0.0, 1.0);
    if (warmth < 0.02) return;
    final rect = Rect.fromLTRB(jar.left, jar.top + jar.height * 0.2, jar.right, soilY);
    canvas.drawRect(
      rect,
      Paint()
        ..blendMode = BlendMode.plus
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFFE9A24C).withValues(alpha: 0),
            const Color(0xFFE9A24C).withValues(alpha: 0.18 * warmth),
          ],
        ).createShader(rect),
    );
  }

  // --- Lichtstrahl -----------------------------------------------------------

  void _paintLightBeam(Canvas canvas, Rect jar, double soilY) {
    final intensity = 0.035 + 0.075 * dayNight.daylight;
    final beam = Path()
      ..moveTo(jar.left + jar.width * 0.34, jar.top)
      ..lineTo(jar.left + jar.width * 0.54, jar.top)
      ..lineTo(jar.left + jar.width * 0.72, soilY)
      ..lineTo(jar.left + jar.width * 0.22, soilY)
      ..close();
    canvas.drawPath(
      beam,
      Paint()
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
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18),
    );
  }

  // --- Tiefen-Silhouetten hinter dem Boden -----------------------------------

  void _paintBackdrop(Canvas canvas, Rect jar, double soilY) {
    // Ein paar unscharfe, dunkle Pflanzen-Silhouetten für Tiefe.
    final rng = SeedRandom(ambientSeed ^ 0x77aa);
    final health = organisms.isEmpty ? 0.5 : overallBalance;
    final base = Color.lerp(const Color(0xFF223022), TerraColors.moss,
        0.2 + 0.4 * health)!;
    final paint = Paint()
      ..color = base.withValues(alpha: 0.28 + 0.12 * health * dayNight.daylight)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
    const count = 5;
    for (var i = 0; i < count; i++) {
      final cx = jar.left + jar.width * ((i + 0.5) / count + rng.range(-0.06, 0.06));
      final w = jar.width * rng.range(0.10, 0.20);
      final h = jar.height * rng.range(0.05, 0.11);
      final path = Path()
        ..moveTo(cx - w / 2, soilY + 4)
        ..cubicTo(cx - w * 0.3, soilY - h, cx + w * 0.3, soilY - h, cx + w / 2,
            soilY + 4)
        ..close();
      canvas.drawPath(path, paint);
    }
  }

  // --- Schwebende Partikel (Sporen/Staub) ------------------------------------

  void _paintParticles(Canvas canvas, Rect jar, double soilY) {
    final rng = SeedRandom(ambientSeed ^ 0x51ed);
    const count = 24;
    final visible = 0.22 + 0.6 * dayNight.daylight;
    final paint = Paint()..color = const Color(0xFFFFF3D0);
    for (var i = 0; i < count; i++) {
      final baseX = rng.range(jar.left + 8, jar.right - 8);
      final baseY = rng.range(jar.top + 8, soilY);
      final speed = rng.range(0.4, 1.2);
      final phase = rng.range(0, 2 * math.pi);
      final dy = ((t * speed) % 1.0) * jar.height * 0.5;
      final y = baseY - dy;
      final wrappedY = y < jar.top + 6 ? y + jar.height * 0.5 : y;
      final x = baseX + math.sin(t * 2 * math.pi + phase) * 6;
      final a = (0.12 + 0.4 * rng.next()) * visible;
      canvas.drawCircle(Offset(x, wrappedY), rng.range(0.6, 1.8),
          paint..color = paint.color.withValues(alpha: a));
    }
  }

  // --- Bodennebel ------------------------------------------------------------

  void _paintHaze(Canvas canvas, Rect jar, double soilY) {
    final rect = Rect.fromLTRB(
        jar.left, soilY - jar.height * 0.10, jar.right, soilY + 6);
    final tint = Color.lerp(const Color(0xFF6E8A6A), const Color(0xFFD8E0C8),
        dayNight.daylight)!;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [tint.withValues(alpha: 0), tint.withValues(alpha: 0.16)],
        ).createShader(rect)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
  }

  // --- Boden -----------------------------------------------------------------

  void _paintSoil(Canvas canvas, Rect jar, double soilY) {
    final health = organisms.isEmpty ? 0.55 : overallBalance;
    final soilColor = Color.lerp(
        const Color(0xFF1A140E), TerraColors.soil, (0.3 + 0.7 * health))!;
    final soil = Path()
      ..moveTo(jar.left, soilY + 6)
      ..cubicTo(jar.left + jar.width * 0.25, soilY - 8,
          jar.left + jar.width * 0.55, soilY + 10, jar.right, soilY)
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
        ..color = TerraColors.moss.withValues(alpha: 0.16 * health),
    );
  }

  // --- Kiesel am Bodenrand ---------------------------------------------------

  void _paintPebbles(Canvas canvas, Rect jar, double soilY) {
    final rng = SeedRandom(ambientSeed ^ 0x3c9f);
    for (var i = 0; i < 9; i++) {
      final px = rng.range(jar.left + 12, jar.right - 12);
      final py = soilY + rng.range(-2, 8);
      final r = rng.range(2.5, 6.0);
      final grey = rng.range(0.35, 0.6);
      final c = Color.fromRGBO((70 * grey).round() + 40,
          (66 * grey).round() + 38, (60 * grey).round() + 34, 1);
      canvas.drawOval(
          Rect.fromCenter(center: Offset(px, py), width: r * 2.2, height: r * 1.5),
          Paint()..color = c);
      // Winziges Glanzlicht.
      canvas.drawCircle(Offset(px - r * 0.3, py - r * 0.35), r * 0.35,
          Paint()..color = Colors.white.withValues(alpha: 0.10));
    }
  }

  // --- Lebewesen -------------------------------------------------------------

  void _paintOrganisms(Canvas canvas, TerrariumGeometry geo) {
    final placed = layoutTerrarium(organisms, geo, ambientSeed);
    for (final p in placed) {
      paintOrganism(
        canvas,
        OrganismVisual(
          species: p.organism.speciesType,
          anchor: p.anchor,
          size: p.size,
          vitality: p.organism.vitality,
          stage: p.organism.stage,
          seed: p.organism.seed,
          t: t,
          nightGlow: dayNight.nightGlow,
        ),
      );
    }
  }

  // --- Vignette --------------------------------------------------------------

  void _paintVignette(Canvas canvas, Rect jar) {
    canvas.drawRect(
      jar,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(0, -0.15),
          radius: 0.95,
          colors: [
            Colors.transparent,
            Colors.black.withValues(alpha: 0.06),
            Colors.black.withValues(alpha: 0.28),
          ],
          stops: const [0.55, 0.82, 1.0],
        ).createShader(jar),
    );
  }

  // --- Kondenströpfchen am Glas ----------------------------------------------

  void _paintCondensation(Canvas canvas, Rect jar) {
    final rng = SeedRandom(ambientSeed ^ 0x6d21);
    final tint = Colors.white.withValues(alpha: 0.05 + 0.05 * dayNight.daylight);
    for (var i = 0; i < 20; i++) {
      // Bevorzugt an den Seiten und oben (dort beschlägt Glas am ehesten).
      final side = rng.next() < 0.5 ? 0.0 : 1.0;
      final edge = rng.range(0.02, 0.18);
      final x = jar.left + (side == 0.0 ? edge : 1 - edge) * jar.width;
      final y = jar.top + rng.range(0.04, 0.7) * jar.height;
      final r = rng.range(1.5, 4.5);
      canvas.drawCircle(Offset(x, y), r, Paint()..color = tint);
      canvas.drawCircle(Offset(x - r * 0.3, y - r * 0.3), r * 0.35,
          Paint()..color = Colors.white.withValues(alpha: 0.14));
    }
  }

  // --- Glas: Reflexe + Rand --------------------------------------------------

  void _paintGlass(Canvas canvas, Path body, Rect jar) {
    canvas.drawPath(
      body,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..color = Colors.black.withValues(alpha: 0.25),
    );

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
