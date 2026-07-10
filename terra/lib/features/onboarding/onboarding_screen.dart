import 'package:flutter/material.dart';

import '../ecosystem/presentation/terrarium_view.dart';

/// Stimmungsvolle Intro: erklärt in wenigen Zeilen, was Terra ist – vor der
/// lebendigen Kulisse des echten Terrariums. Wird beim ersten Start gezeigt
/// und ist später jederzeit über das Info-Symbol erneut aufrufbar.
class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key, this.firstRun = false});

  final bool firstRun;

  @override
  Widget build(BuildContext context) {
    const text = Color(0xFFE7E2D6);
    return Scaffold(
      body: Stack(
        children: [
          // Lebendige Kulisse.
          const Positioned.fill(child: TerrariumView()),
          // Abdunkeln für Lesbarkeit.
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.55),
                    Colors.black.withValues(alpha: 0.78),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(28, 24, 28, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(),
                  const Text(
                    'Terra',
                    style: TextStyle(
                      fontSize: 40,
                      fontWeight: FontWeight.w200,
                      letterSpacing: 8,
                      color: text,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Dein Leben als lebendiges Mikro-Ökosystem im Glas.',
                    style: TextStyle(
                      fontSize: 15,
                      height: 1.4,
                      color: text.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(height: 32),
                  const _Point(
                    icon: Icons.spa_outlined,
                    title: 'Jede Gewohnheit lebt',
                    body:
                        'Was du dir vornimmst, wird zu einem eigenen Lebewesen '
                        'in deinem Glas – eine Pflanze, eine Schnecke, ein '
                        'Glühwürmchen.',
                  ),
                  const _Point(
                    icon: Icons.auto_awesome,
                    title: 'Pflege lässt es gedeihen',
                    body:
                        'Erledigst du eine Gewohnheit, blüht ihr Wesen auf. '
                        'Vernachlässigst du sie, verkümmert es – und die '
                        'Nachbarn spüren es mit.',
                  ),
                  const _Point(
                    icon: Icons.nights_stay_outlined,
                    title: 'Nichts ist wie das andere',
                    body:
                        'Tag & Nacht folgen deiner echten Uhrzeit, und jedes '
                        'Terrarium wächst aus deinen Daten einzigartig heran.',
                  ),
                  const Spacer(),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      onPressed: () => Navigator.of(context).maybePop(),
                      child: Text(
                        firstRun ? 'Los geht’s' : 'Schließen',
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  if (firstRun) ...[
                    const SizedBox(height: 12),
                    Center(
                      child: Text(
                        'Tipp: Unten auf + tippen, um dein erstes Wesen zu pflanzen.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 12.5, color: text.withValues(alpha: 0.5)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Point extends StatelessWidget {
  const _Point({required this.icon, required this.title, required this.body});

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    const text = Color(0xFFE7E2D6);
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFFD9A441).withValues(alpha: 0.16),
            ),
            child: Icon(icon, size: 20, color: const Color(0xFFD9A441)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w600,
                    color: text,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  body,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.4,
                    color: text.withValues(alpha: 0.7),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
