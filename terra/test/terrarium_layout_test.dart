import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:terra/features/ecosystem/domain/organism.dart';
import 'package:terra/features/ecosystem/domain/species.dart';
import 'package:terra/features/ecosystem/presentation/painters/terrarium_layout.dart';

Organism org(int id, SpeciesType t) => Organism(
      id: id,
      habitId: id,
      speciesType: t,
      vitality: 0.7,
      lastUpdatedAt: DateTime(2026),
      seed: id * 2654435761 & 0x7fffffff,
    );

void main() {
  final geo = TerrariumGeometry(const Size(400, 800));
  final organisms = [
    org(1, SpeciesType.moss),
    org(2, SpeciesType.fern),
    org(3, SpeciesType.snail),
    org(4, SpeciesType.firefly),
  ];

  test('Layout ist deterministisch (gleiche Eingabe -> gleiche Positionen)', () {
    final a = layoutTerrarium(organisms, geo, 1337);
    final b = layoutTerrarium(organisms, geo, 1337);
    expect(a.length, b.length);
    for (var i = 0; i < a.length; i++) {
      expect(a[i].anchor, b[i].anchor);
      expect(a[i].size, b[i].size);
    }
  });

  test('Anderer ambientSeed ergibt andere Komposition', () {
    final a = layoutTerrarium(organisms, geo, 1);
    final b = layoutTerrarium(organisms, geo, 2);
    final same = List.generate(a.length, (i) => a[i].anchor == b[i].anchor)
        .every((x) => x);
    expect(same, isFalse);
  });

  test('Boden-Bewohner stehen an unterschiedlichen X-Positionen', () {
    final placed = layoutTerrarium(organisms, geo, 1337);
    final ground = placed
        .where((p) => p.organism.speciesType != SpeciesType.firefly)
        .map((p) => p.anchor.dx)
        .toList();
    for (var i = 0; i < ground.length; i++) {
      for (var j = i + 1; j < ground.length; j++) {
        expect((ground[i] - ground[j]).abs(), greaterThan(1.0));
      }
    }
  });

  test('Glühwürmchen schweben über dem Boden', () {
    final placed = layoutTerrarium(organisms, geo, 1337);
    final fly = placed.firstWhere(
        (p) => p.organism.speciesType == SpeciesType.firefly);
    expect(fly.anchor.dy, lessThan(geo.soilY));
  });

  test('Leeres Terrarium ergibt leeres Layout', () {
    expect(layoutTerrarium(const [], geo, 1337), isEmpty);
  });

  test('Tippen auf ein Lebewesen trifft genau dieses', () {
    final placed = layoutTerrarium(organisms, geo, 1337);
    final target = placed.first;
    // Tipp knapp oberhalb des Ankers (Trefferzone ist nach oben verschoben).
    final tap = Offset(target.anchor.dx, target.anchor.dy - target.size * 0.35);
    final hit = hitTestOrganism(placed, tap);
    expect(hit?.organism.id, target.organism.id);
  });

  test('Tippen ins Leere trifft nichts', () {
    final placed = layoutTerrarium(organisms, geo, 1337);
    expect(hitTestOrganism(placed, const Offset(5, 5)), isNull);
  });
}
