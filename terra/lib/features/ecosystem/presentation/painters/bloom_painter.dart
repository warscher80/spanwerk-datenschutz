import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Kurzer „Aufblüh"-Effekt genau am erledigten Lebewesen: ein sich weitender
/// Lichtring, ein zentrales Aufleuchten und nach außen fliegende Funken.
/// [progress] läuft einmalig von 0 (Start) bis 1 (verklungen).
class BloomPainter extends CustomPainter {
  BloomPainter({
    required this.center,
    required this.progress,
    required this.color,
  });

  final Offset center;
  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0 || progress >= 1) return;
    final p = progress;
    final fade = 1 - p;

    // Zentrales Aufleuchten.
    canvas.drawCircle(
      center,
      26 * (0.4 + p),
      Paint()
        ..color = color.withValues(alpha: 0.5 * fade)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 16),
    );

    // Sich weitender Ring.
    canvas.drawCircle(
      center,
      12 + 62 * Curves.easeOut.transform(p),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3 * fade
        ..color = color.withValues(alpha: 0.7 * fade),
    );

    // Nach außen fliegende Funken.
    final spark = Paint()
      ..color = Color.lerp(color, const Color(0xFFFFFDF0), 0.5)!
          .withValues(alpha: fade);
    const n = 8;
    final dist = 18 + 52 * Curves.easeOut.transform(p);
    for (var i = 0; i < n; i++) {
      final a = (i / n) * 2 * math.pi + p;
      final o = Offset(
          center.dx + math.cos(a) * dist, center.dy + math.sin(a) * dist);
      canvas.drawCircle(o, 2.4 * fade + 0.6, spark);
    }
  }

  @override
  bool shouldRepaint(covariant BloomPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.center != center;
}
