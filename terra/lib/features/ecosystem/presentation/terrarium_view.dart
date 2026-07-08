import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../habits/domain/habit.dart';
import '../../habits/presentation/habit_providers.dart';
import '../domain/day_night.dart';
import '../domain/ecosystem_state.dart';
import 'painters/terrarium_layout.dart';
import 'painters/terrarium_painter.dart';
import 'providers/ecosystem_providers.dart';

/// Das große, lebendige Terrarium im Fokus des Home-Screens.
///
/// Eine einzige, sanft loopende [AnimationController]-Uhr treibt alle
/// Bewegungen. Der Tag/Nacht-Zustand wird pro Frame aus der Gerätezeit
/// abgeleitet. Tippt man ein Lebewesen an, zeigt ein kleines Schild, zu
/// welchem Habit es gehört. RepaintBoundary isoliert das Neuzeichnen.
class TerrariumView extends ConsumerStatefulWidget {
  const TerrariumView({super.key});

  @override
  ConsumerState<TerrariumView> createState() => _TerrariumViewState();
}

class _TerrariumViewState extends ConsumerState<TerrariumView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _clock;
  PlacedOrganism? _selected;

  @override
  void initState() {
    super.initState();
    _clock = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 24),
    )..repeat();
  }

  @override
  void dispose() {
    _clock.dispose();
    super.dispose();
  }

  void _handleTap(Offset pos, Size size, EcosystemState state) {
    final geo = TerrariumGeometry(size);
    final placed = layoutTerrarium(state.organisms, geo, state.ambientSeed);
    setState(() => _selected = hitTestOrganism(placed, pos));
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(ecosystemProvider);

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (e, _) => Center(
        child: Text('Ökosystem konnte nicht geladen werden.\n$e',
            textAlign: TextAlign.center),
      ),
      data: (state) => LayoutBuilder(
        builder: (context, constraints) {
          final size = constraints.biggest;
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapUp: (d) => _handleTap(d.localPosition, size, state),
            child: Stack(
              children: [
                RepaintBoundary(
                  child: AnimatedBuilder(
                    animation: _clock,
                    builder: (context, _) => CustomPaint(
                      size: Size.infinite,
                      isComplex: true,
                      willChange: true,
                      painter: TerrariumPainter(
                        organisms: state.organisms,
                        overallBalance: state.overallBalance,
                        ambientSeed: state.ambientSeed,
                        dayNight: DayNight.at(DateTime.now()),
                        t: _clock.value,
                      ),
                    ),
                  ),
                ),
                if (_selected != null)
                  _OrganismLabel(
                    placed: _selected!,
                    canvasSize: size,
                    onDismiss: () => setState(() => _selected = null),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Schwebendes Schildchen, das zeigt, welches Habit ein angetipptes Lebewesen
/// ist – inklusive Spezies und Streak.
class _OrganismLabel extends ConsumerWidget {
  const _OrganismLabel({
    required this.placed,
    required this.canvasSize,
    required this.onDismiss,
  });

  final PlacedOrganism placed;
  final Size canvasSize;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final habits = ref.watch(habitsProvider).valueOrNull ?? const <Habit>[];
    final streaks = ref.watch(streaksProvider).valueOrNull ?? const {};
    Habit? habit;
    for (final h in habits) {
      if (h.id == placed.organism.habitId) {
        habit = h;
        break;
      }
    }
    if (habit == null) return const SizedBox.shrink();

    final streak = streaks[habit.id] ?? 0;
    final vitalityPct = (placed.organism.vitality * 100).round();

    const labelWidth = 176.0;
    final left = (placed.anchor.dx - labelWidth / 2)
        .clamp(8.0, canvasSize.width - labelWidth - 8);
    final top = (placed.anchor.dy - placed.size - 74).clamp(8.0, canvasSize.height - 120);

    return Positioned(
      left: left,
      top: top,
      width: labelWidth,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.8, end: 1),
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutBack,
        builder: (context, scale, child) =>
            Transform.scale(scale: scale, alignment: Alignment.bottomCenter, child: child),
        child: GestureDetector(
          onTap: onDismiss,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: const Color(0xFF10160F).withValues(alpha: 0.92),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: placed.organism.species.accentColor
                      .withValues(alpha: 0.8)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  habit.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFFE7E2D6),
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: placed.organism.species.baseColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      placed.organism.species.displayName,
                      style: TextStyle(
                        color: const Color(0xFFE7E2D6).withValues(alpha: 0.65),
                        fontSize: 11.5,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '$vitalityPct%',
                      style: TextStyle(
                        color: const Color(0xFFE7E2D6).withValues(alpha: 0.65),
                        fontSize: 11.5,
                      ),
                    ),
                    if (streak > 0) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.local_fire_department,
                          size: 12, color: Color(0xFFD9A441)),
                      Text(
                        '$streak',
                        style: const TextStyle(
                            color: Color(0xFFD9A441), fontSize: 11.5),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
