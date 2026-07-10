import 'package:flutter/material.dart';

import 'tiers.dart';

/// Ein leuchtendes kosmisches Objekt eines bestimmten Rangs.
class Orb extends StatelessWidget {
  const Orb({super.key, required this.tier, this.size = 48, this.showLabel = true});

  final int tier;
  final double size;
  final bool showLabel;

  @override
  Widget build(BuildContext context) {
    final c = tierInfo(tier).color;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          center: const Alignment(-0.35, -0.4),
          radius: 0.95,
          colors: [
            Color.lerp(c, Colors.white, 0.55)!,
            c,
            Color.lerp(c, Colors.black, 0.45)!,
          ],
          stops: const [0.0, 0.55, 1.0],
        ),
        boxShadow: [
          BoxShadow(
            color: c.withValues(alpha: 0.55),
            blurRadius: size * 0.36,
            spreadRadius: size * 0.02,
          ),
        ],
      ),
      alignment: Alignment.center,
      child: showLabel
          ? Text(
              '${tier + 1}',
              style: TextStyle(
                fontSize: size * 0.34,
                fontWeight: FontWeight.w700,
                color: _readable(c),
              ),
            )
          : null,
    );
  }

  Color _readable(Color c) =>
      c.computeLuminance() > 0.5 ? const Color(0xFF10131A) : Colors.white;
}
