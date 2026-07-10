import 'package:flutter/material.dart';

import 'game/game_screen.dart';
import 'theme.dart';

class NovaApp extends StatelessWidget {
  const NovaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Nova',
      debugShowCheckedModeBanner: false,
      theme: novaTheme(),
      home: const GameScreen(),
    );
  }
}
