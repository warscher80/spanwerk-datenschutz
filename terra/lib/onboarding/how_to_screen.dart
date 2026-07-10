import 'package:flutter/material.dart';

import '../game/orb.dart';
import '../theme.dart';

/// Kurze Anleitung: erklärt das Verschmelzen. Beim ersten Start und jederzeit
/// über das Info-Symbol aufrufbar.
class HowToScreen extends StatelessWidget {
  const HowToScreen({super.key, this.firstRun = false});

  final bool firstRun;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NovaColors.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 24, 28, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(),
              const Text(
                'Nova',
                style: TextStyle(
                  fontSize: 42,
                  fontWeight: FontWeight.w200,
                  letterSpacing: 8,
                  color: NovaColors.text,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Bau dir aus Sternenstaub ein ganzes Universum.',
                style: TextStyle(
                    fontSize: 15, color: NovaColors.text.withValues(alpha: 0.8)),
              ),
              const SizedBox(height: 34),
              const _Step(
                n: '1',
                title: 'Setzen',
                body: 'Tippe ein freies Feld an, um das nächste Objekt zu platzieren.',
              ),
              const _Step(
                n: '2',
                title: 'Verschmelzen',
                body: 'Drei oder mehr gleiche, die sich berühren, werden zu einem Größeren.',
                demo: true,
              ),
              const _Step(
                n: '3',
                title: 'Aufsteigen',
                body: 'Staub → Komet → Planet → Stern → Galaxie … endlos. Jage Highscore und sammle alle Objekte.',
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: () => Navigator.of(context).maybePop(),
                  child: Text(firstRun ? 'Los geht’s' : 'Schließen',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({
    required this.n,
    required this.title,
    required this.body,
    this.demo = false,
  });

  final String n;
  final String title;
  final String body;
  final bool demo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: NovaColors.accent.withValues(alpha: 0.18),
            ),
            child: Text(n,
                style: const TextStyle(
                    color: NovaColors.accent, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: NovaColors.text)),
                const SizedBox(height: 3),
                Text(body,
                    style: TextStyle(
                        fontSize: 13,
                        height: 1.4,
                        color: NovaColors.text.withValues(alpha: 0.7))),
                if (demo) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Orb(tier: 1, size: 30),
                      const Orb(tier: 1, size: 30),
                      const Orb(tier: 1, size: 30),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Icon(Icons.arrow_forward,
                            size: 18,
                            color: NovaColors.text.withValues(alpha: 0.6)),
                      ),
                      const Orb(tier: 2, size: 38),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
