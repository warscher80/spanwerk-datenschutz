import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../onboarding/how_to_screen.dart';
import '../onboarding/onboarding_service.dart';
import '../theme.dart';
import '../update/update_banner.dart';
import 'catalog_screen.dart';
import 'game_state.dart';
import 'orb.dart';
import 'tiers.dart';

class GameScreen extends ConsumerStatefulWidget {
  const GameScreen({super.key});

  @override
  ConsumerState<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends ConsumerState<GameScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final seen = await ref.read(introSeenProvider.future);
      if (!seen && mounted) {
        await _openHowTo(firstRun: true);
      }
    });
  }

  Future<void> _openHowTo({required bool firstRun}) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(
      fullscreenDialog: true,
      builder: (_) => HowToScreen(firstRun: firstRun),
    ));
    if (firstRun) await markIntroSeen();
  }

  void _openCatalog() {
    Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const CatalogScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(gameProvider);

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 8, 4),
                  child: _Header(
                    score: st.score,
                    best: st.best,
                    onCatalog: _openCatalog,
                    onInfo: () => _openHowTo(firstRun: false),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: UpdateBanner(),
                ),
                Expanded(
                  child: st.ready
                      ? Padding(
                          padding: const EdgeInsets.all(14),
                          child: LayoutBuilder(
                            builder: (context, c) {
                              final side = min(c.maxWidth, c.maxHeight);
                              return Center(
                                child: SizedBox.square(
                                  dimension: side,
                                  child: _BoardView(
                                    state: st,
                                    onTap: (i) => ref
                                        .read(gameProvider.notifier)
                                        .place(i),
                                  ),
                                ),
                              );
                            },
                          ),
                        )
                      : const Center(child: CircularProgressIndicator()),
                ),
                _NextBar(next: st.next),
              ],
            ),
            if (st.gameOver)
              _GameOver(
                score: st.score,
                best: st.best,
                onRestart: () => ref.read(gameProvider.notifier).restart(),
                onCatalog: _openCatalog,
              ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.score,
    required this.best,
    required this.onCatalog,
    required this.onInfo,
  });

  final int score;
  final int best;
  final VoidCallback onCatalog;
  final VoidCallback onInfo;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Text(
          'NOVA',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w300,
            letterSpacing: 5,
            color: NovaColors.text,
          ),
        ),
        const Spacer(),
        _Stat(label: 'Punkte', value: score),
        const SizedBox(width: 14),
        _Stat(label: 'Best', value: best),
        IconButton(
          onPressed: onCatalog,
          tooltip: 'Sammlung',
          icon: Icon(Icons.auto_awesome_mosaic_outlined,
              size: 20, color: NovaColors.text.withValues(alpha: 0.7)),
        ),
        IconButton(
          onPressed: onInfo,
          tooltip: 'So geht’s',
          icon: Icon(Icons.info_outline,
              size: 20, color: NovaColors.text.withValues(alpha: 0.6)),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('$value',
            style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: NovaColors.text)),
        Text(label.toUpperCase(),
            style: TextStyle(
                fontSize: 9,
                letterSpacing: 1.5,
                color: NovaColors.text.withValues(alpha: 0.5))),
      ],
    );
  }
}

class _BoardView extends StatelessWidget {
  const _BoardView({required this.state, required this.onTap});

  final GameState state;
  final void Function(int) onTap;

  @override
  Widget build(BuildContext context) {
    final cells = state.board.cells;
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: kBoardSize,
        mainAxisSpacing: 7,
        crossAxisSpacing: 7,
      ),
      itemCount: cells.length,
      itemBuilder: (context, i) => _Cell(
        tier: cells[i],
        onTap: () => onTap(i),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.tier, required this.onTap});

  final int tier;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: LayoutBuilder(
        builder: (context, c) {
          final s = c.maxWidth;
          if (tier < 0) {
            return Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(s * 0.24),
                color: NovaColors.cell,
                border:
                    Border.all(color: Colors.white.withValues(alpha: 0.05)),
              ),
            );
          }
          return Center(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              switchInCurve: Curves.easeOutBack,
              transitionBuilder: (child, anim) =>
                  ScaleTransition(scale: anim, child: child),
              child: Orb(key: ValueKey(tier), tier: tier, size: s * 0.94),
            ),
          );
        },
      ),
    );
  }
}

class _NextBar extends StatelessWidget {
  const _NextBar({required this.next});

  final int next;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 6, 24, 18),
      child: Row(
        children: [
          Orb(tier: next, size: 46),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('ALS NÄCHSTES',
                  style: TextStyle(
                      fontSize: 9,
                      letterSpacing: 1.5,
                      color: NovaColors.text.withValues(alpha: 0.5))),
              const SizedBox(height: 2),
              Text(tierInfo(next).name,
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: NovaColors.text)),
            ],
          ),
          const Spacer(),
          Text('Tippe ein Feld',
              style: TextStyle(
                  fontSize: 12.5,
                  color: NovaColors.text.withValues(alpha: 0.45))),
        ],
      ),
    );
  }
}

class _GameOver extends StatelessWidget {
  const _GameOver({
    required this.score,
    required this.best,
    required this.onRestart,
    required this.onCatalog,
  });

  final int score;
  final int best;
  final VoidCallback onRestart;
  final VoidCallback onCatalog;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.72),
        child: Center(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 40),
            padding: const EdgeInsets.fromLTRB(28, 30, 28, 24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              color: NovaColors.panel,
              border: Border.all(color: NovaColors.accent.withValues(alpha: 0.4)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Alles voll!',
                    style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w300,
                        letterSpacing: 1,
                        color: NovaColors.text)),
                const SizedBox(height: 4),
                Text('Kein Platz mehr im Kosmos.',
                    style: TextStyle(
                        fontSize: 13,
                        color: NovaColors.text.withValues(alpha: 0.6))),
                const SizedBox(height: 22),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _Big(label: 'Punkte', value: score),
                    _Big(label: 'Bestwert', value: best),
                  ],
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: onRestart,
                    child: const Text('Neu starten',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600)),
                  ),
                ),
                TextButton(
                  onPressed: onCatalog,
                  child: const Text('Sammlung ansehen'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Big extends StatelessWidget {
  const _Big({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('$value',
            style: const TextStyle(
                fontSize: 30,
                fontWeight: FontWeight.w200,
                color: NovaColors.text)),
        Text(label.toUpperCase(),
            style: TextStyle(
                fontSize: 9,
                letterSpacing: 1.5,
                color: NovaColors.text.withValues(alpha: 0.5))),
      ],
    );
  }
}
