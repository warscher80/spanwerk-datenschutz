import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../ecosystem/domain/day_night.dart';
import '../../ecosystem/presentation/providers/ecosystem_providers.dart';
import '../../habits/presentation/habit_providers.dart';

/// Erzeugt eine kurze, stimmungsvolle Zeile über den Zustand des Terrariums.
/// Deterministisch (kein Zufall): wechselt mit Tag, Tageszeit und Fortschritt,
/// bleibt aber innerhalb eines Moments stabil.
String terrariumWhisper({
  required int habitCount,
  required double balance,
  required int doneToday,
  required DayPhase phase,
  required DateTime now,
}) {
  if (habitCount == 0) {
    return 'Ein stilles, leeres Glas – bereit, zum Leben zu erwachen.';
  }

  if (doneToday >= habitCount) {
    const pool = [
      'Heute hast du jedes Wesen genährt. Dein Terrarium strahlt.',
      'Alles gedeiht – ein seltener, vollkommener Tag im Glas.',
      'Vollzählig gepflegt. Das Ökosystem summt vor Leben.',
    ];
    return _pick(pool, now, phase, doneToday);
  }

  final List<String> pool;
  if (balance >= 0.66) {
    pool = const [
      'Dein Terrarium gedeiht prächtig.',
      'Sattes Grün, ruhiges Leuchten – es geht ihm gut.',
      'Die Wesen sind wohlauf und warten gelassen auf dich.',
    ];
  } else if (balance >= 0.33) {
    pool = const [
      'Es lebt – doch ein paar Wesen könnten mehr Zuwendung vertragen.',
      'Ein zartes Gleichgewicht. Halte es mit deinen Gewohnheiten.',
      'Zwischen Wachsen und Welken – heute entscheidest du.',
    ];
  } else {
    pool = const [
      'Einige Wesen sehnen sich nach deiner Aufmerksamkeit.',
      'Das Glas wirkt müde. Ein erledigtes Habit weckt es auf.',
      'Der Boden verdunkelt sich – Zeit, etwas zu nähren.',
    ];
  }
  return '${_pick(pool, now, phase, doneToday)}${_phaseGlyph(phase)}';
}

String _pick(List<String> pool, DateTime now, DayPhase phase, int done) {
  final i = (now.day + phase.index + done) % pool.length;
  return pool[i];
}

String _phaseGlyph(DayPhase phase) => switch (phase) {
      DayPhase.night => ' 🌙',
      DayPhase.dawn => ' 🌅',
      DayPhase.dusk => ' 🌆',
      DayPhase.day => '',
    };

/// Zeigt die aktuelle Terrarium-Stimme als dezente Zeile.
class TerrariumVoice extends ConsumerWidget {
  const TerrariumVoice({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final habits = ref.watch(habitsProvider).valueOrNull ?? const [];
    final balance = ref.watch(ecosystemProvider).valueOrNull?.overallBalance ?? 0;
    final doneToday = ref.watch(completedTodayProvider).valueOrNull ?? const {};
    final now = DateTime.now();

    final line = terrariumWhisper(
      habitCount: habits.length,
      balance: balance,
      doneToday: doneToday.length,
      phase: DayNight.at(now).phase,
      now: now,
    );

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 500),
      child: Text(
        line,
        key: ValueKey(line),
        style: TextStyle(
          fontSize: 13,
          height: 1.3,
          fontStyle: FontStyle.italic,
          color: const Color(0xFFE7E2D6).withValues(alpha: 0.66),
        ),
      ),
    );
  }
}
