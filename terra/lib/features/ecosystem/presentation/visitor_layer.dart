import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Seltener Besucher: ein leuchtender Schmetterling, der bei gutem Zustand
/// des Terrariums gelegentlich hindurchschwebt. Bewusst als eigenständige
/// Overlay-Ebene über der Terrarium-Ansicht – rührt die bestehenden Painter
/// nicht an. Nicht interaktiv.
class VisitorLayer extends StatefulWidget {
  const VisitorLayer({super.key, required this.balance});

  /// Gesamtbalance des Ökosystems (0..1). Erst ab „gesund“ kommt Besuch.
  final double balance;

  @override
  State<VisitorLayer> createState() => _VisitorLayerState();
}

class _VisitorLayerState extends State<VisitorLayer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  // Ein ganzer Zyklus; der Flug füllt nur den vorderen Teil, der Rest ist Pause.
  static const _flightPortion = 0.32;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 26),
    )..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Kein Besuch, wenn das Terrarium nicht in gutem Zustand ist.
    if (widget.balance < 0.6) return const SizedBox.shrink();

    return IgnorePointer(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final h = constraints.maxHeight;
          return AnimatedBuilder(
            animation: _c,
            builder: (context, _) {
              final t = _c.value;
              if (t > _flightPortion) return const SizedBox.shrink();

              final p = t / _flightPortion; // 0..1 über den Flug
              // Sanftes Ein-/Ausblenden an den Rändern des Flugs.
              final fade = math.sin(p * math.pi).clamp(0.0, 1.0);

              // Geschwungener Pfad quer über die obere Terrariumhälfte.
              final x = _lerp(-40, w + 40, p);
              final baseY = h * 0.30;
              final y = baseY +
                  math.sin(p * math.pi * 2.2) * h * 0.12 -
                  math.sin(p * math.pi) * h * 0.05;

              // Schneller Flügelschlag, unabhängig vom Bahnfortschritt.
              final flap = (math.sin(t * math.pi * 2 * 44) * 0.5 + 0.5);

              return Transform.translate(
                offset: Offset(x - 15, y - 12),
                child: Opacity(
                  opacity: fade * 0.9,
                  child: CustomPaint(
                    size: const Size(30, 24),
                    painter: _ButterflyPainter(flap: flap),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  double _lerp(double a, double b, double t) => a + (b - a) * t;
}

class _ButterflyPainter extends CustomPainter {
  _ButterflyPainter({required this.flap});

  /// 0 = Flügel fast geschlossen, 1 = weit offen.
  final double flap;

  static const _wing = Color(0xFFF2E4B8);
  static const _wingDeep = Color(0xFFE0B968);

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final open = 0.35 + 0.65 * flap;
    final ww = size.width * 0.40 * open;

    final glow = Paint()
      ..color = _wing.withValues(alpha: 0.35)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5);
    canvas.drawCircle(c, size.width * 0.34, glow);

    void wing(double dx, double dy, double rx, double ry, Color col) {
      final paint = Paint()..color = col;
      canvas.save();
      canvas.translate(c.dx + dx, c.dy + dy);
      canvas.drawOval(Rect.fromCenter(
          center: Offset.zero, width: rx * 2, height: ry * 2), paint);
      canvas.restore();
    }

    // Obere Flügel (größer), untere Flügel (kleiner), je links/rechts.
    wing(-ww * 0.55, -size.height * 0.16, ww * 0.7, size.height * 0.26, _wing);
    wing(ww * 0.55, -size.height * 0.16, ww * 0.7, size.height * 0.26, _wing);
    wing(-ww * 0.42, size.height * 0.20, ww * 0.5, size.height * 0.18, _wingDeep);
    wing(ww * 0.42, size.height * 0.20, ww * 0.5, size.height * 0.18, _wingDeep);

    // Körper.
    final body = Paint()..color = const Color(0xFF3A2E22);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
            center: c, width: size.width * 0.08, height: size.height * 0.6),
        Radius.circular(size.width * 0.05),
      ),
      body,
    );
  }

  @override
  bool shouldRepaint(covariant _ButterflyPainter oldDelegate) =>
      oldDelegate.flap != flap;
}
