import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/day_night.dart';
import '../domain/ecosystem_state.dart';
import 'painters/terrarium_painter.dart';
import 'providers/ecosystem_providers.dart';

/// Das große, lebendige Terrarium im Fokus des Home-Screens.
///
/// Eine einzige, sanft loopende [AnimationController]-Uhr treibt alle
/// Bewegungen (Wiegen, Atmen, Partikel). Der Tag/Nacht-Zustand wird pro Frame
/// aus der Gerätezeit abgeleitet. Kein setState in Schleifen; RepaintBoundary
/// isoliert das Neuzeichnen.
class TerrariumView extends ConsumerStatefulWidget {
  const TerrariumView({super.key});

  @override
  ConsumerState<TerrariumView> createState() => _TerrariumViewState();
}

class _TerrariumViewState extends ConsumerState<TerrariumView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _clock;

  @override
  void initState() {
    super.initState();
    // Ruhiger 24s-Loop – bewusst langsam, "screensaver-schön".
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

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(ecosystemProvider);

    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
      error: (e, _) => Center(
        child: Text('Ökosystem konnte nicht geladen werden.\n$e',
            textAlign: TextAlign.center),
      ),
      data: (state) => _TerrariumCanvas(clock: _clock, state: state),
    );
  }
}

class _TerrariumCanvas extends StatelessWidget {
  const _TerrariumCanvas({required this.clock, required this.state});

  final AnimationController clock;
  final EcosystemState state;

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: clock,
        builder: (context, _) {
          final dayNight = DayNight.at(DateTime.now());
          return CustomPaint(
            size: Size.infinite,
            isComplex: true,
            willChange: true,
            painter: TerrariumPainter(
              organisms: state.organisms,
              overallBalance: state.overallBalance,
              ambientSeed: state.ambientSeed,
              dayNight: dayNight,
              t: clock.value,
            ),
          );
        },
      ),
    );
  }
}
