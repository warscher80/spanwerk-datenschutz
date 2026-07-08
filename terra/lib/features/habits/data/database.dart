import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:sqlite3_flutter_libs/sqlite3_flutter_libs.dart';

part 'database.g.dart';

/// Habits – jedes an eine Spezies gebunden.
@DataClassName('HabitRow')
class Habits extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get title => text().withLength(min: 1, max: 80)();

  /// Index in [SpeciesType].
  IntColumn get speciesType => integer()();
  DateTimeColumn get createdAt => dateTime()();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();

  /// Index in [HabitTargetType] (v1: nur daily = 0).
  IntColumn get targetType => integer().withDefault(const Constant(0))();
}

/// Einzelne Erledigungen eines Habits.
@DataClassName('HabitCompletionRow')
class HabitCompletions extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get habitId =>
      integer().references(Habits, #id, onDelete: KeyAction.cascade)();
  DateTimeColumn get completedAt => dateTime()();
}

/// Der persistierte Lebenszustand je Habit (Vitalität, Seed, letztes Update).
@DataClassName('OrganismRow')
class Organisms extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get habitId =>
      integer().references(Habits, #id, onDelete: KeyAction.cascade)();
  RealColumn get vitality => real().withDefault(const Constant(0.4))();
  DateTimeColumn get lastUpdatedAt => dateTime()();
  IntColumn get seed => integer()();
}

/// Genau eine Zeile: der aggregierte Ökosystem-Zustand.
@DataClassName('EcosystemStateRow')
class EcosystemStates extends Table {
  IntColumn get id => integer().withDefault(const Constant(0))();
  RealColumn get overallBalance => real().withDefault(const Constant(0))();
  IntColumn get ambientSeed => integer()();
  DateTimeColumn get lastUpdatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(
  tables: [Habits, HabitCompletions, Organisms, EcosystemStates],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  /// Test-Konstruktor mit injizierbarem Executor (In-Memory).
  AppDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 1;
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File(p.join(dir.path, 'terra.sqlite'));

    // Bekannter Workaround für ältere Android-Versionen.
    await applyWorkaroundToOpenSqlite3OnOldAndroidVersions();
    // Temp-Verzeichnis für sqlite3 setzen (Android/iOS-Kompatibilität).
    final cachebase = (await getTemporaryDirectory()).path;
    sqlite3.tempDirectory = cachebase;

    return NativeDatabase.createInBackground(file);
  });
}
