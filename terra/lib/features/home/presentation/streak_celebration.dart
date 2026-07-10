import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme.dart';

/// Streak-Meilensteine, die einen kurzen festlichen Moment auslösen.
const Set<int> _milestones = {3, 7, 14, 30, 50, 100, 200, 365};

bool isStreakMilestone(int streak) => _milestones.contains(streak);

/// Zeigt einen kurzen, selbst-verschwindenden Glückwunsch-Moment.
Future<void> showStreakMilestone(
  BuildContext context, {
  required String species,
  required int streak,
}) {
  HapticFeedback.mediumImpact();
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Meilenstein',
    barrierColor: Colors.black.withValues(alpha: 0.6),
    transitionDuration: const Duration(milliseconds: 320),
    pageBuilder: (_, __, ___) =>
        _MilestoneCard(species: species, streak: streak),
    transitionBuilder: (_, anim, __, child) {
      final curved = CurvedAnimation(parent: anim, curve: Curves.easeOutBack);
      return FadeTransition(
        opacity: anim,
        child: ScaleTransition(scale: Tween(begin: 0.8, end: 1.0).animate(curved), child: child),
      );
    },
  );
}

class _MilestoneCard extends StatefulWidget {
  const _MilestoneCard({required this.species, required this.streak});

  final String species;
  final int streak;

  @override
  State<_MilestoneCard> createState() => _MilestoneCardState();
}

class _MilestoneCardState extends State<_MilestoneCard> {
  @override
  void initState() {
    super.initState();
    // Selbst schließen – ein flüchtiger Moment, kein Klick-Zwang.
    Future.delayed(const Duration(milliseconds: 2200), () {
      if (mounted) Navigator.of(context).maybePop();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 48),
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 26),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            color: const Color(0xFF141B18).withValues(alpha: 0.96),
            border: Border.all(color: TerraColors.amber.withValues(alpha: 0.55)),
            boxShadow: [
              BoxShadow(
                color: TerraColors.amber.withValues(alpha: 0.22),
                blurRadius: 40,
                spreadRadius: 4,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.local_fire_department,
                  size: 44, color: TerraColors.amber),
              const SizedBox(height: 10),
              Text(
                '${widget.streak}',
                style: const TextStyle(
                  fontSize: 52,
                  height: 1.0,
                  fontWeight: FontWeight.w200,
                  color: Color(0xFFE7E2D6),
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Tage in Folge',
                style: TextStyle(
                  fontSize: 14,
                  letterSpacing: 2,
                  color: TerraColors.amber,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Dein ${widget.species} erstrahlt vor Kraft. 🌟',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13.5,
                  height: 1.4,
                  color: const Color(0xFFE7E2D6).withValues(alpha: 0.8),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
