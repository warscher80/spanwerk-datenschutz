import 'package:flutter/material.dart';

/// Ruhige, natürliche Farbwelt – Moosgrün, Erdbraun, Bernstein, Nachtblau.
/// Bewusst gedämpft statt bunter Gamification.
class TerraColors {
  TerraColors._();

  static const Color moss = Color(0xFF5C7A4A);
  static const Color earth = Color(0xFF3B2F2A);
  static const Color amber = Color(0xFFD9A441);
  static const Color nightBlue = Color(0xFF14202E);
  static const Color glassTint = Color(0xFFBFD8C4);

  // Tag/Nacht-Himmel im Glas (oben -> unten).
  static const Color dayTop = Color(0xFFEAE3C9);
  static const Color dayBottom = Color(0xFF9FB08A);
  static const Color nightTop = Color(0xFF1B2A3A);
  static const Color nightBottom = Color(0xFF0C1620);

  static const Color soil = Color(0xFF2E2620);
}

class TerraTheme {
  TerraTheme._();

  static ThemeData get dark {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: const Color(0xFF0E1512),
      colorScheme: const ColorScheme.dark(
        primary: TerraColors.moss,
        secondary: TerraColors.amber,
        surface: Color(0xFF141B18),
      ),
      textTheme: base.textTheme.apply(
        bodyColor: const Color(0xFFE7E2D6),
        displayColor: const Color(0xFFE7E2D6),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
      ),
    );
  }
}
