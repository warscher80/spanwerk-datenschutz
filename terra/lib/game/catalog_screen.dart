import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme.dart';
import 'game_state.dart';
import 'orb.dart';
import 'tiers.dart';

/// Kosmos-Katalog: alles, was du bisher erschaffen hast – plus je ein
/// verborgener Ausblick auf das nächste Ziel.
class CatalogScreen extends ConsumerWidget {
  const CatalogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final maxTier = ref.watch(gameProvider.select((s) => s.maxTier));
    // Zeige alle benannten Ränge, mindestens aber bis knapp über das Erreichte.
    final shown = [maxNamedTier, maxTier + 1].reduce((a, b) => a > b ? a : b);
    final unlocked = maxTier + 1;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kosmos-Katalog'),
        backgroundColor: Colors.transparent,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Row(
              children: [
                Text(
                  '$unlocked von ${shown + 1} entdeckt',
                  style: TextStyle(color: NovaColors.text.withValues(alpha: 0.7)),
                ),
              ],
            ),
          ),
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
                childAspectRatio: 0.82,
              ),
              itemCount: shown + 1,
              itemBuilder: (context, tier) {
                final isUnlocked = tier <= maxTier;
                return _CatalogCard(tier: tier, unlocked: isUnlocked);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _CatalogCard extends StatelessWidget {
  const _CatalogCard({required this.tier, required this.unlocked});

  final int tier;
  final bool unlocked;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: NovaColors.panel.withValues(alpha: 0.6),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (unlocked)
            Orb(tier: tier, size: 52)
          else
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.05),
                border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
              ),
              child: Icon(Icons.lock_outline,
                  size: 20, color: NovaColors.text.withValues(alpha: 0.35)),
            ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Text(
              unlocked ? tierInfo(tier).name : '???',
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                color: NovaColors.text
                    .withValues(alpha: unlocked ? 0.9 : 0.4),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
