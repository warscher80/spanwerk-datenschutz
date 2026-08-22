// Erzeugt das vorberechnete Modell (modell.json), das die App beim ersten
// Start lädt, statt selbst 68 Spieltage je Liga durchzulernen.
//
// Warum das hier als Test liegt und nicht als eigenständiges Skript:
// Der Generator MUSS dieselbe Lernlogik verwenden wie die App, sonst driften
// die Modelle auseinander und "auf jedem Gerät derselbe Stand" wäre eine
// Behauptung statt einer Eigenschaft. Diese Logik hängt an PredictionStore,
// und der importiert shared_preferences – also Flutter. Ein reines
// `dart run` scheitert daran. Im Flutter-Test-Umfeld läuft alles: echtes
// HTTP, Dateizugriff, und PredictionStore ohne load() rein im Speicher.
//
// Aufruf:
//   flutter test test/werkzeuge/modell_erzeugen.dart
// Nur bestimmte Wettbewerbe (für schnelle Proben):
//   MODELL_LIGEN=4331,4399 flutter test test/werkzeuge/modell_erzeugen.dart
//
// Ergebnis: build/modell.json
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/api.dart';
import 'package:footy_predict/odds.dart';
import 'package:footy_predict/store.dart';

void main() {
  test('Modell berechnen und als JSON ablegen', () async {
    final filter = Platform.environment['MODELL_LIGEN']
        ?.split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toSet();
    final ligen = filter == null
        ? kLeagues
        : kLeagues.where((l) => filter.contains(l.id)).toList();

    final store = PredictionStore(); // bewusst ohne load(): reiner Speicher
    final model = EloModel({});
    final jetzt = DateTime.now();
    final protokoll = <String, dynamic>{};

    for (final liga in ligen) {
      final saison = Api.seasonFor(liga, jetzt);
      final vorher = model.ratings.length;
      final lerner = SeasonLearner(store, model);
      try {
        if (liga.isCup) {
          await lerner.learnCup(liga, saison, liga.cupCandidates);
        } else {
          await lerner.learnHistory(liga, saison);
        }
      } catch (e) {
        // Eine Liga darf den Gesamtlauf nicht kippen; sie fehlt dann eben.
        protokoll[liga.id] = 'Fehler: $e';
        continue;
      }
      protokoll[liga.id] = '${liga.name}: ${model.ratings.length - vorher} neue Teams';
      // ignore: avoid_print
      print('${liga.flag} ${liga.name} ($saison) -> ${protokoll[liga.id]}');
    }

    final daten = {
      'format': 1,
      'erstellt': jetzt.toUtc().toIso8601String(),
      'ligen': ligen.map((l) => l.id).toList(),
      'elo': model.ratings,
      'form': model.formExport(),
      'gelernteRunden': store.gelernteRunden,
      'verarbeiteteSpiele': store.verarbeiteteSpiele,
    };

    Directory('build').createSync(recursive: true);
    final datei = File('build/modell.json');
    datei.writeAsStringSync(jsonEncode(daten));

    // ignore: avoid_print
    print('modell.json: ${model.ratings.length} Teams, '
        '${store.gelernteRunden.length} Spieltage, '
        '${store.verarbeiteteSpiele.length} Spiele, '
        '${(datei.lengthSync() / 1024).round()} kB');

    expect(model.ratings, isNotEmpty, reason: 'ohne Teams ist das Modell wertlos');
  }, timeout: const Timeout(Duration(minutes: 30)));
}
