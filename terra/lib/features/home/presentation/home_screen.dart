import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/onboarding/onboarding_service.dart';
import '../../../core/theme.dart';
import '../../ecosystem/domain/day_night.dart';
import '../../ecosystem/presentation/providers/ecosystem_providers.dart';
import '../../ecosystem/presentation/terrarium_view.dart';
import '../../ecosystem/presentation/visitor_layer.dart';
import '../../habits/domain/habit.dart';
import '../../habits/presentation/habit_providers.dart';
import '../../onboarding/onboarding_screen.dart';
import 'streak_celebration.dart';
import 'terrarium_voice.dart';
import 'update_banner.dart';

/// Home: Terrarium groß im Fokus, Habit-Liste als schlanke Leiste unten.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Beim allerersten Start die Intro zeigen.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final seen = await ref.read(onboardingSeenProvider.future);
      if (!seen && mounted) {
        await _openIntro(firstRun: true);
      }
    });
  }

  Future<void> _openIntro({required bool firstRun}) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => OnboardingScreen(firstRun: firstRun),
      ),
    );
    if (firstRun) {
      await markOnboardingSeen();
      if (mounted) ref.invalidate(onboardingSeenProvider);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Beim Zurückkehren in die App: Zustand aus (now - lastUpdatedAt) neu
    // berechnen, ohne Background-Service.
    if (state == AppLifecycleState.resumed) {
      ref.read(ecosystemProvider.notifier).refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    final ecosystem = ref.watch(ecosystemProvider);
    final balance = ecosystem.valueOrNull?.overallBalance ?? 0;
    final habits = ref.watch(habitsProvider).valueOrNull ?? const [];

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            const Positioned.fill(child: TerrariumView()),
            Positioned.fill(child: VisitorLayer(balance: balance)),
            if (habits.isEmpty) const Positioned.fill(child: _EmptyHint()),
            Positioned(
              top: 4,
              left: 16,
              right: 16,
              child: _TopBar(
                balance: balance,
                onInfo: () => _openIntro(firstRun: false),
              ),
            ),
            const Positioned(
              top: 42,
              left: 16,
              right: 16,
              child: TerrariumVoice(),
            ),
            const Positioned(
              top: 78,
              left: 16,
              right: 16,
              child: UpdateBanner(),
            ),
            const Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _HabitStrip(),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sanfter Hinweis im leeren Terrarium – lädt zum ersten Habit ein.
class _EmptyHint extends StatelessWidget {
  const _EmptyHint();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 96),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.spa_outlined,
                size: 40, color: const Color(0xFFE7E2D6).withValues(alpha: 0.5)),
            const SizedBox(height: 16),
            Text(
              'Dein Terrarium ist noch leer.',
              style: TextStyle(
                fontSize: 16,
                color: const Color(0xFFE7E2D6).withValues(alpha: 0.8),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Tippe auf +, um dein erstes\nLebewesen zu pflanzen.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.4,
                color: const Color(0xFFE7E2D6).withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.balance, required this.onInfo});
  final double balance;
  final VoidCallback onInfo;

  @override
  Widget build(BuildContext context) {
    final phase = DayNight.at(DateTime.now()).phase;
    final icon = switch (phase) {
      DayPhase.dawn => Icons.wb_twilight,
      DayPhase.day => Icons.wb_sunny_outlined,
      DayPhase.dusk => Icons.nights_stay_outlined,
      DayPhase.night => Icons.dark_mode_outlined,
    };

    return Row(
      children: [
        Text(
          'Terra',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w300,
            letterSpacing: 4,
            color: const Color(0xFFE7E2D6).withValues(alpha: 0.9),
          ),
        ),
        const Spacer(),
        Icon(icon, size: 18, color: const Color(0xFFE7E2D6).withValues(alpha: 0.7)),
        const SizedBox(width: 10),
        _BalanceDot(balance: balance),
        const SizedBox(width: 4),
        IconButton(
          onPressed: onInfo,
          visualDensity: VisualDensity.compact,
          tooltip: 'Was ist Terra?',
          icon: Icon(Icons.info_outline,
              size: 18, color: const Color(0xFFE7E2D6).withValues(alpha: 0.6)),
        ),
      ],
    );
  }
}

class _BalanceDot extends StatelessWidget {
  const _BalanceDot({required this.balance});
  final double balance;

  @override
  Widget build(BuildContext context) {
    final color = Color.lerp(
        const Color(0xFF7A5A44), TerraColors.moss, balance.clamp(0, 1))!;
    return Row(
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          '${(balance * 100).round()}%',
          style: TextStyle(
            fontSize: 13,
            color: const Color(0xFFE7E2D6).withValues(alpha: 0.75),
          ),
        ),
      ],
    );
  }
}

/// Schlanke, horizontal scrollende Leiste aller Habits.
class _HabitStrip extends ConsumerWidget {
  const _HabitStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final habits = ref.watch(habitsProvider);
    final doneToday = ref.watch(completedTodayProvider).valueOrNull ?? const {};
    final streaks = ref.watch(streaksProvider).valueOrNull ?? const {};

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            Colors.black.withValues(alpha: 0.55),
            Colors.transparent,
          ],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(12, 24, 12, 12),
      child: habits.when(
        loading: () => const SizedBox(height: 84),
        error: (e, _) => SizedBox(
          height: 84,
          child: Center(child: Text('Fehler: $e')),
        ),
        data: (list) => SizedBox(
          height: 88,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: list.length + 1,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (context, i) {
              if (i == list.length) return const _AddHabitButton();
              final habit = list[i];
              return _HabitPill(
                habit: habit,
                doneToday: doneToday.contains(habit.id),
                streak: streaks[habit.id] ?? 0,
              );
            },
          ),
        ),
      ),
    );
  }
}

class _AddHabitButton extends StatelessWidget {
  const _AddHabitButton();

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/habit/new'),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: 74,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
              color: const Color(0xFFE7E2D6).withValues(alpha: 0.25)),
        ),
        child: const Center(
          child: Icon(Icons.add, color: Color(0xFFE7E2D6)),
        ),
      ),
    );
  }
}

/// Einzelnes Habit als Pille. Tippen = Erledigen (befriedigende Micro-
/// Interaktion mit kurzem Aufblühen). Langdrücken = Bearbeiten/Löschen.
class _HabitPill extends ConsumerStatefulWidget {
  const _HabitPill({
    required this.habit,
    required this.doneToday,
    required this.streak,
  });

  final Habit habit;
  final bool doneToday;
  final int streak;

  @override
  ConsumerState<_HabitPill> createState() => _HabitPillState();
}

class _HabitPillState extends ConsumerState<_HabitPill>
    with SingleTickerProviderStateMixin {
  late final AnimationController _bounce;

  @override
  void initState() {
    super.initState();
    _bounce = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
      lowerBound: 0,
      upperBound: 1,
      value: 1,
    );
  }

  @override
  void dispose() {
    _bounce.dispose();
    super.dispose();
  }

  Future<void> _complete() async {
    if (widget.doneToday) return;
    HapticFeedback.lightImpact();
    // Kurzes Aufblühen: einschrumpfen und elastisch zurück.
    _bounce
      ..value = 0.0
      ..animateTo(1.0, curve: Curves.elasticOut);
    await ref.read(ecosystemProvider.notifier).completeHabit(widget.habit.id);

    // Erledigen von heute macht aus dem bisherigen Streak einen um 1 höheren.
    final newStreak = widget.streak + 1;
    if (isStreakMilestone(newStreak) && mounted) {
      await showStreakMilestone(
        context,
        species: widget.habit.species.displayName,
        streak: newStreak,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final traits = widget.habit.species;
    final base = traits.baseColor;

    return GestureDetector(
      onTap: _complete,
      onLongPress: () => _showActions(context),
      child: ScaleTransition(
        scale: Tween(begin: 0.86, end: 1.0).animate(_bounce),
        child: Container(
          width: 128,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            color: Colors.black.withValues(alpha: 0.35),
            border: Border.all(
              color: widget.doneToday
                  ? traits.accentColor.withValues(alpha: 0.9)
                  : Colors.white.withValues(alpha: 0.12),
              width: widget.doneToday ? 1.6 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration:
                        BoxDecoration(color: base, shape: BoxShape.circle),
                  ),
                  const Spacer(),
                  if (widget.doneToday)
                    Icon(Icons.check_circle,
                        size: 16, color: traits.accentColor)
                  else
                    Icon(Icons.eco_outlined,
                        size: 16,
                        color: Colors.white.withValues(alpha: 0.4)),
                ],
              ),
              Text(
                widget.habit.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFFE7E2D6),
                ),
              ),
              Row(
                children: [
                  Text(
                    traits.displayName,
                    style: TextStyle(
                      fontSize: 11,
                      color: const Color(0xFFE7E2D6).withValues(alpha: 0.55),
                    ),
                  ),
                  const Spacer(),
                  if (widget.streak > 0) ...[
                    const Icon(Icons.local_fire_department,
                        size: 12, color: TerraColors.amber),
                    const SizedBox(width: 2),
                    Text(
                      '${widget.streak}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: TerraColors.amber,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showActions(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF141B18),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text('Bearbeiten'),
              onTap: () {
                Navigator.pop(ctx);
                context.push('/habit/edit', extra: widget.habit);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
              title: const Text('Löschen',
                  style: TextStyle(color: Colors.redAccent)),
              onTap: () async {
                Navigator.pop(ctx);
                await ref
                    .read(habitRepositoryProvider)
                    .deleteHabit(widget.habit.id);
                ref.invalidate(ecosystemProvider);
                ref.invalidate(completedTodayProvider);
                ref.invalidate(streaksProvider);
              },
            ),
          ],
        ),
      ),
    );
  }
}
