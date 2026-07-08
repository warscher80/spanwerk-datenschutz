import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../ecosystem/domain/organism.dart';
import '../../ecosystem/domain/species.dart';
import '../../ecosystem/presentation/painters/organism_painters.dart';
import '../../ecosystem/presentation/providers/ecosystem_providers.dart';
import '../domain/habit.dart';
import 'habit_providers.dart';

/// Anlegen oder Bearbeiten eines Habits inkl. Spezies-Auswahl.
class HabitEditScreen extends ConsumerStatefulWidget {
  const HabitEditScreen({super.key, this.habit});

  /// Wenn null: Neuanlage. Sonst Bearbeitung.
  final Habit? habit;

  @override
  ConsumerState<HabitEditScreen> createState() => _HabitEditScreenState();
}

class _HabitEditScreenState extends ConsumerState<HabitEditScreen> {
  late final TextEditingController _title;
  late SpeciesType _species;

  bool get _isEditing => widget.habit != null;

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.habit?.title ?? '');
    _species = widget.habit?.speciesType ?? SpeciesType.moss;
  }

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bitte einen Titel eingeben.')),
      );
      return;
    }
    final repo = ref.read(habitRepositoryProvider);
    if (_isEditing) {
      await repo.updateHabit(
          id: widget.habit!.id, title: title, speciesType: _species);
    } else {
      await repo.createHabit(
          title: title, speciesType: _species, now: DateTime.now());
    }
    ref.invalidate(ecosystemProvider);
    ref.invalidate(completedTodayProvider);
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Habit bearbeiten' : 'Neues Habit'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(
            controller: _title,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Titel',
              hintText: 'z. B. 10 Minuten lesen',
              border: OutlineInputBorder(),
            ),
            onSubmitted: (_) => _save(),
          ),
          const SizedBox(height: 28),
          Text('Spezies',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            'Jedes Habit lebt als eigenes Wesen im Terrarium.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          _SpeciesPreview(species: _species),
          const SizedBox(height: 20),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final t in Species.all)
                _SpeciesChip(
                  traits: t,
                  selected: t.type == _species,
                  onTap: () => setState(() => _species = t.type),
                ),
            ],
          ),
          const SizedBox(height: 32),
          FilledButton(
            onPressed: _save,
            child: Text(_isEditing ? 'Speichern' : 'Anlegen'),
          ),
        ],
      ),
    );
  }
}

class _SpeciesChip extends StatelessWidget {
  const _SpeciesChip({
    required this.traits,
    required this.selected,
    required this.onTap,
  });

  final SpeciesTraits traits;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: selected
              ? traits.baseColor.withValues(alpha: 0.28)
              : Colors.white.withValues(alpha: 0.05),
          border: Border.all(
            color: selected
                ? traits.accentColor
                : Colors.white.withValues(alpha: 0.12),
            width: selected ? 1.6 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                  color: traits.baseColor, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Text(traits.displayName),
          ],
        ),
      ),
    );
  }
}

/// Kleine, statische Vorschau des gewählten Lebewesens (voll gediehen).
class _SpeciesPreview extends StatelessWidget {
  const _SpeciesPreview({required this.species});
  final SpeciesType species;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 140,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1B2A24), Color(0xFF10160F)],
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: CustomPaint(
        painter: _PreviewPainter(species),
        size: Size.infinite,
      ),
    );
  }
}

class _PreviewPainter extends CustomPainter {
  _PreviewPainter(this.species);
  final SpeciesType species;

  @override
  void paint(Canvas canvas, Size size) {
    final anchor = species == SpeciesType.firefly
        ? Offset(size.width / 2, size.height * 0.45)
        : Offset(size.width / 2, size.height * 0.9);
    paintOrganism(
      canvas,
      OrganismVisual(
        species: species,
        anchor: anchor,
        size: size.height * 0.6,
        vitality: 0.95,
        stage: GrowthStage.flourishing,
        seed: species.index * 131 + 7,
        t: 0.2,
        nightGlow: species == SpeciesType.firefly ||
                species == SpeciesType.glowMushroom
            ? 0.9
            : 0.0,
      ),
    );
  }

  @override
  bool shouldRepaint(covariant _PreviewPainter old) => old.species != species;
}
