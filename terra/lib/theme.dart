import 'package:flutter/material.dart';

class NovaColors {
  NovaColors._();

  static const bg = Color(0xFF080B14);
  static const bgLift = Color(0xFF10162490);
  static const panel = Color(0xFF161C2C);
  static const cell = Color(0xFF141A28);
  static const text = Color(0xFFE9ECF5);
  static const accent = Color(0xFF7A6CF0);
  static const gold = Color(0xFFF2C94C);
}

ThemeData novaTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: NovaColors.bg,
    colorScheme: const ColorScheme.dark(
      primary: NovaColors.accent,
      secondary: NovaColors.gold,
      surface: NovaColors.panel,
    ),
    textTheme: base.textTheme.apply(
      bodyColor: NovaColors.text,
      displayColor: NovaColors.text,
    ),
  );
}
