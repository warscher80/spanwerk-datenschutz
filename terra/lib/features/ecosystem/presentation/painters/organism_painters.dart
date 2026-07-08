import 'dart:math' as math;
import 'dart:ui';

import '../../domain/organism.dart';
import '../../domain/species.dart';

/// Alle Daten, die ein einzelner Organismus-Painter pro Frame braucht.
/// Bewusst wertbasiert und schlank – die Painter erzeugen keine Zustände.
class OrganismVisual {
  const OrganismVisual({
    required this.species,
    required this.anchor,
    required this.size,
    required this.vitality,
    required this.stage,
    required this.seed,
    required this.t,
    required this.nightGlow,
  });

  final SpeciesType species;

  /// Verankerungspunkt: bei Pflanzen die Wurzel am Boden, bei fliegenden
  /// Wesen der Schwebemittelpunkt.
  final Offset anchor;

  /// Referenzgröße (Höhe eines voll gediehenen Exemplars) in Pixeln.
  final double size;

  final double vitality;
  final GrowthStage stage;
  final int seed;

  /// Kontinuierliche Animationsphase 0..1 (loopt).
  final double t;

  /// 0 = Tag, 1 = Nacht (steuert Leuchten).
  final double nightGlow;
}

/// Deterministischer, leichter PRNG (LCG) aus dem Organismus-Seed –
/// sorgt für reproduzierbare, aber individuelle Variation je Nutzer.
class SeedRandom {
  SeedRandom(int seed) : _s = (seed & 0x7fffffff) | 1;
  int _s;

  double next() {
    _s = (_s * 1103515245 + 12345) & 0x7fffffff;
    return _s / 0x7fffffff;
  }

  double range(double a, double b) => a + (b - a) * next();
}

const Color _deadTint = Color(0xFF5A4E42);

/// Zentraler Dispatcher: zeichnet das passende Lebewesen.
void paintOrganism(Canvas canvas, OrganismVisual v) {
  switch (v.species) {
    case SpeciesType.moss:
      _paintMoss(canvas, v);
    case SpeciesType.fern:
      _paintFern(canvas, v);
    case SpeciesType.glowMushroom:
      _paintMushroom(canvas, v);
    case SpeciesType.waterLens:
      _paintWaterLens(canvas, v);
    case SpeciesType.snail:
      _paintSnail(canvas, v);
    case SpeciesType.beetle:
      _paintBeetle(canvas, v);
    case SpeciesType.firefly:
      _paintFirefly(canvas, v);
  }
}

Color _living(SpeciesType type, double vitality, {bool accent = false}) {
  final t = Species.traits(type);
  final target = accent ? t.accentColor : t.baseColor;
  // Verkümmerte Lebewesen driften Richtung Erdbraun und werden blasser.
  return Color.lerp(_deadTint, target, (0.25 + 0.75 * vitality).clamp(0.0, 1.0))!;
}

double _sway(OrganismVisual v, double amplitude, double phase) {
  return math.sin(v.t * 2 * math.pi + phase) * amplitude * (0.3 + v.vitality);
}

// ---------------------------------------------------------------------------
// Moos – Polster aus kurzen, wiegenden Halmen.
// ---------------------------------------------------------------------------
void _paintMoss(Canvas canvas, OrganismVisual v) {
  final rng = SeedRandom(v.seed);
  final color = _living(v.species, v.vitality);
  final accent = _living(v.species, v.vitality, accent: true);

  final double w = v.size * 1.5;
  final double h = v.size * (0.45 + 0.55 * v.vitality);

  // Zwei überlagerte Polster-Höcker (dunkel hinten, heller vorne) für Volumen.
  final backColor = Color.lerp(color, const Color(0xFF000000), 0.25)!;
  void mound(double cx, double mw, double mh, Color c) {
    final path = Path()
      ..moveTo(cx - mw / 2, v.anchor.dy)
      ..cubicTo(cx - mw * 0.32, v.anchor.dy - mh, cx + mw * 0.32,
          v.anchor.dy - mh, cx + mw / 2, v.anchor.dy)
      ..close();
    canvas.drawPath(path, Paint()..color = c);
  }

  mound(v.anchor.dx - w * 0.14, w * 0.7, h * 0.78, backColor);
  mound(v.anchor.dx + w * 0.18, w * 0.62, h * 0.72, backColor);
  mound(v.anchor.dx, w, h, color);

  // Kurze, dichte Halme über das Polster verteilt.
  final blades = (10 + v.vitality * 22).round();
  final bladePaint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1.3
    ..strokeCap = StrokeCap.round;

  for (var i = 0; i < blades; i++) {
    final frac = rng.range(-0.5, 0.5);
    final bx = v.anchor.dx + frac * w;
    // Halme folgen der Polster-Kuppe (Mitte höher).
    final domeY = v.anchor.dy - h * (1 - (frac * 2).abs() * 0.7).clamp(0.0, 1.0);
    final bh = v.size * rng.range(0.12, 0.30);
    final phase = rng.range(0, 2 * math.pi);
    final tip = _sway(v, v.size * 0.05, phase);
    bladePaint.color = i.isEven ? accent : color;
    final path = Path()
      ..moveTo(bx, domeY + 2)
      ..quadraticBezierTo(
          bx + tip * 0.5, domeY - bh * 0.6, bx + tip, domeY - bh);
    canvas.drawPath(path, bladePaint);
  }
}

// ---------------------------------------------------------------------------
// Farn – zentraler Stiel mit sich entfaltenden Wedeln.
// ---------------------------------------------------------------------------
void _paintFern(Canvas canvas, OrganismVisual v) {
  final color = _living(v.species, v.vitality);
  final accent = _living(v.species, v.vitality, accent: true);
  final double h = v.size * (0.5 + 0.5 * v.vitality);

  final fronds = (2 + v.vitality * 4).round();
  final stemPaint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2.2
    ..strokeCap = StrokeCap.round
    ..color = color;
  final leafPaint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1.2
    ..strokeCap = StrokeCap.round
    ..color = accent;

  for (var f = 0; f < fronds; f++) {
    final side = f.isEven ? 1.0 : -1.0;
    final spread = (f / fronds) * 0.9 + 0.1;
    final bend = _sway(v, v.size * 0.12, f.toDouble());
    final tipX = v.anchor.dx + side * h * 0.5 * spread + bend;
    final tipY = v.anchor.dy - h * (0.5 + 0.5 * spread);

    final stem = Path()
      ..moveTo(v.anchor.dx, v.anchor.dy)
      ..quadraticBezierTo(
          v.anchor.dx + side * h * 0.15, v.anchor.dy - h * 0.6, tipX, tipY);
    canvas.drawPath(stem, stemPaint);

    // Blättchen entlang des Wedels.
    final leaflets = (3 + v.vitality * 4).round();
    for (var l = 1; l <= leaflets; l++) {
      final tt = l / (leaflets + 1);
      final px = lerpDouble(v.anchor.dx, tipX, tt)!;
      final py = lerpDouble(v.anchor.dy, tipY, tt)!;
      final len = v.size * 0.14 * (1 - tt) + 3;
      canvas.drawLine(Offset(px, py), Offset(px + side * len, py - len * 0.3),
          leafPaint);
      canvas.drawLine(Offset(px, py), Offset(px - side * len * 0.4, py - len * 0.2),
          leafPaint);
    }
  }
}

// ---------------------------------------------------------------------------
// Leuchtpilz – Gruppe von Stielen mit Hüten, die nachts glimmen.
// ---------------------------------------------------------------------------
void _paintMushroom(Canvas canvas, OrganismVisual v) {
  final rng = SeedRandom(v.seed);
  final stemColor = _living(v.species, v.vitality);
  final capColor = _living(v.species, v.vitality, accent: true);
  final count = (1 + v.vitality * 3).round();

  for (var i = 0; i < count; i++) {
    final ox = v.anchor.dx + rng.range(-v.size * 0.45, v.size * 0.45);
    final scale = rng.range(0.55, 1.0);
    final hh = v.size * (0.4 + 0.4 * v.vitality) * scale;
    final capR = v.size * 0.24 * scale;
    final sway = _sway(v, v.size * 0.04, i.toDouble());
    final capCenter = Offset(ox + sway, v.anchor.dy - hh);

    // Nächtliches, weiches Glimmen (dezent).
    if (v.nightGlow > 0.05) {
      canvas.drawCircle(
        capCenter,
        capR * 2.2,
        Paint()
          ..color = capColor.withValues(alpha: 0.22 * v.nightGlow * v.vitality)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, capR * 1.6),
      );
    }

    // Stiel (leicht geschwungen, unten dicker).
    final stemPath = Path()
      ..moveTo(ox - capR * 0.22, v.anchor.dy)
      ..quadraticBezierTo(ox + sway * 0.5, v.anchor.dy - hh * 0.5,
          capCenter.dx - capR * 0.14, capCenter.dy)
      ..lineTo(capCenter.dx + capR * 0.14, capCenter.dy)
      ..quadraticBezierTo(ox + sway * 0.5, v.anchor.dy - hh * 0.5,
          ox + capR * 0.22, v.anchor.dy)
      ..close();
    canvas.drawPath(stemPath, Paint()..color = stemColor);

    // Runder Hut (Dome) mit weichem Rand.
    final capRect = Rect.fromCenter(
        center: capCenter, width: capR * 2, height: capR * 1.7);
    canvas.drawArc(capRect, math.pi, math.pi, true, Paint()..color = capColor);
    // Kleiner Glanz oben.
    canvas.drawArc(
      capRect.deflate(capR * 0.35).translate(-capR * 0.12, capR * 0.12),
      math.pi * 1.15,
      math.pi * 0.5,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = capR * 0.16
        ..strokeCap = StrokeCap.round
        ..color = Color.lerp(capColor, const Color(0xFFFFFFFF), 0.4)!
            .withValues(alpha: 0.5),
    );
  }
}

// ---------------------------------------------------------------------------
// Wasserlinse – flache, schwebende Scheiben am Boden.
// ---------------------------------------------------------------------------
void _paintWaterLens(Canvas canvas, OrganismVisual v) {
  final rng = SeedRandom(v.seed);
  final color = _living(v.species, v.vitality);
  final accent = _living(v.species, v.vitality, accent: true);
  final count = (2 + v.vitality * 5).round();

  for (var i = 0; i < count; i++) {
    final ox = v.anchor.dx + rng.range(-v.size * 0.5, v.size * 0.5);
    final oy = v.anchor.dy - rng.range(0, v.size * 0.12);
    final bob = _sway(v, 1.6, i.toDouble());
    final r = v.size * rng.range(0.1, 0.2) * (0.5 + v.vitality);

    final rect = Rect.fromCenter(
        center: Offset(ox, oy + bob), width: r * 2, height: r * 1.1);
    canvas.drawOval(rect, Paint()..color = color.withValues(alpha: 0.92));
    canvas.drawOval(
        rect.deflate(r * 0.55), Paint()..color = accent.withValues(alpha: 0.7));
  }
}

// ---------------------------------------------------------------------------
// Schnecke – Spiralhaus + Körper, kriecht langsam hin und her.
// ---------------------------------------------------------------------------
void _paintSnail(Canvas canvas, OrganismVisual v) {
  final body = _living(v.species, v.vitality);
  final shell = _living(v.species, v.vitality, accent: true);

  final crawl = math.sin(v.t * 2 * math.pi) * v.size * 0.4 * v.vitality;
  final cx = v.anchor.dx + crawl;
  final baseY = v.anchor.dy;
  final s = v.size * (0.4 + 0.35 * v.vitality);

  // Körper.
  final bodyPath = Path()
    ..moveTo(cx - s * 0.9, baseY)
    ..quadraticBezierTo(cx - s * 1.3, baseY - s * 0.4, cx - s * 1.1, baseY - s * 0.7)
    ..quadraticBezierTo(cx - s * 0.9, baseY - s * 0.9, cx - s * 0.6, baseY - s * 0.6)
    ..lineTo(cx + s * 0.5, baseY - s * 0.2)
    ..quadraticBezierTo(cx + s * 0.7, baseY, cx + s * 0.2, baseY)
    ..close();
  canvas.drawPath(bodyPath, Paint()..color = body);

  // Fühler.
  final antenna = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1.2
    ..strokeCap = StrokeCap.round
    ..color = body;
  canvas.drawLine(Offset(cx - s * 1.05, baseY - s * 0.7),
      Offset(cx - s * 1.2, baseY - s * 1.05), antenna);

  // Spiralhaus.
  final shellCenter = Offset(cx, baseY - s * 0.55);
  final shellPaint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = s * 0.28
    ..strokeCap = StrokeCap.round
    ..color = shell;
  final spiral = Path();
  for (var a = 0.0; a < 3.2 * math.pi; a += 0.3) {
    final rr = s * 0.12 + a * s * 0.05;
    final p = Offset(shellCenter.dx + math.cos(a) * rr,
        shellCenter.dy + math.sin(a) * rr);
    if (a == 0.0) {
      spiral.moveTo(p.dx, p.dy);
    } else {
      spiral.lineTo(p.dx, p.dy);
    }
  }
  canvas.drawPath(spiral, shellPaint);
}

// ---------------------------------------------------------------------------
// Käfer – gewölbter Panzer mit Beinen, kleines Wandern.
// ---------------------------------------------------------------------------
void _paintBeetle(Canvas canvas, OrganismVisual v) {
  final body = _living(v.species, v.vitality);
  final sheen = _living(v.species, v.vitality, accent: true);
  final wander = math.sin(v.t * 2 * math.pi + v.seed % 6) * v.size * 0.5 * v.vitality;
  final cx = v.anchor.dx + wander;
  final cy = v.anchor.dy - v.size * 0.12;
  final s = v.size * (0.3 + 0.3 * v.vitality);

  // Beine (zappeln).
  final leg = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1.2
    ..strokeCap = StrokeCap.round
    ..color = body;
  for (var i = -1; i <= 1; i++) {
    final wiggle = math.sin(v.t * 6 * math.pi + i) * 1.5;
    canvas.drawLine(Offset(cx + i * s * 0.4, cy + s * 0.3),
        Offset(cx + i * s * 0.7 + wiggle, cy + s * 0.7), leg);
  }

  // Panzer.
  final shell = Rect.fromCenter(center: Offset(cx, cy), width: s * 1.6, height: s * 1.9);
  canvas.drawOval(shell, Paint()..color = body);
  // Glanzstreifen.
  canvas.drawArc(shell.deflate(s * 0.2), -math.pi * 0.9, math.pi * 0.5, false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..color = sheen.withValues(alpha: 0.8));
  // Mittelnaht.
  canvas.drawLine(Offset(cx, cy - s * 0.85), Offset(cx, cy + s * 0.85),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0
        ..color = sheen.withValues(alpha: 0.5));
}

// ---------------------------------------------------------------------------
// Glühwürmchen – schwebt in der Luft, pulst, leuchtet nachts stark.
// ---------------------------------------------------------------------------
void _paintFirefly(Canvas canvas, OrganismVisual v) {
  final glowColor = _living(v.species, v.vitality, accent: true);
  final drift = Offset(
    math.sin(v.t * 2 * math.pi + v.seed % 7) * v.size * 0.8,
    math.cos(v.t * 2 * math.pi * 0.7 + v.seed % 5) * v.size * 0.5,
  );
  final c = v.anchor + drift;

  // Pulsierendes Leuchten: tagsüber schwach, nachts stark.
  final pulse = 0.5 + 0.5 * math.sin(v.t * 4 * math.pi + v.seed % 3);
  final intensity =
      (0.2 + 0.8 * v.nightGlow) * v.vitality * (0.45 + 0.55 * pulse);
  final r = v.size * 0.09;

  // Großer, weicher Lichthof.
  canvas.drawCircle(
    c,
    r * 4.5,
    Paint()
      ..color = glowColor.withValues(alpha: 0.28 * intensity)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, r * 3.5),
  );
  // Warmer Kern.
  canvas.drawCircle(
    c,
    r * 1.6,
    Paint()
      ..color = glowColor.withValues(alpha: 0.5 * intensity)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, r),
  );
  // Heller Funke.
  canvas.drawCircle(
      c, r * 0.7, Paint()..color = Color.lerp(glowColor, const Color(0xFFFFFDF0), 0.6)!
        .withValues(alpha: 0.35 + 0.6 * intensity));
}
