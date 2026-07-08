// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'database.dart';

// ignore_for_file: type=lint
class $HabitsTable extends Habits with TableInfo<$HabitsTable, HabitRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $HabitsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
      'title', aliasedName, false,
      additionalChecks:
          GeneratedColumn.checkTextLength(minTextLength: 1, maxTextLength: 80),
      type: DriftSqlType.string,
      requiredDuringInsert: true);
  static const VerificationMeta _speciesTypeMeta =
      const VerificationMeta('speciesType');
  @override
  late final GeneratedColumn<int> speciesType = GeneratedColumn<int>(
      'species_type', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _isActiveMeta =
      const VerificationMeta('isActive');
  @override
  late final GeneratedColumn<bool> isActive = GeneratedColumn<bool>(
      'is_active', aliasedName, false,
      type: DriftSqlType.bool,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('CHECK ("is_active" IN (0, 1))'),
      defaultValue: const Constant(true));
  static const VerificationMeta _targetTypeMeta =
      const VerificationMeta('targetType');
  @override
  late final GeneratedColumn<int> targetType = GeneratedColumn<int>(
      'target_type', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  @override
  List<GeneratedColumn> get $columns =>
      [id, title, speciesType, createdAt, isActive, targetType];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'habits';
  @override
  VerificationContext validateIntegrity(Insertable<HabitRow> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('title')) {
      context.handle(
          _titleMeta, title.isAcceptableOrUnknown(data['title']!, _titleMeta));
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('species_type')) {
      context.handle(
          _speciesTypeMeta,
          speciesType.isAcceptableOrUnknown(
              data['species_type']!, _speciesTypeMeta));
    } else if (isInserting) {
      context.missing(_speciesTypeMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('is_active')) {
      context.handle(_isActiveMeta,
          isActive.isAcceptableOrUnknown(data['is_active']!, _isActiveMeta));
    }
    if (data.containsKey('target_type')) {
      context.handle(
          _targetTypeMeta,
          targetType.isAcceptableOrUnknown(
              data['target_type']!, _targetTypeMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  HabitRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return HabitRow(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      title: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}title'])!,
      speciesType: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}species_type'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      isActive: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}is_active'])!,
      targetType: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}target_type'])!,
    );
  }

  @override
  $HabitsTable createAlias(String alias) {
    return $HabitsTable(attachedDatabase, alias);
  }
}

class HabitRow extends DataClass implements Insertable<HabitRow> {
  final int id;
  final String title;

  /// Index in [SpeciesType].
  final int speciesType;
  final DateTime createdAt;
  final bool isActive;

  /// Index in [HabitTargetType] (v1: nur daily = 0).
  final int targetType;
  const HabitRow(
      {required this.id,
      required this.title,
      required this.speciesType,
      required this.createdAt,
      required this.isActive,
      required this.targetType});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['title'] = Variable<String>(title);
    map['species_type'] = Variable<int>(speciesType);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['is_active'] = Variable<bool>(isActive);
    map['target_type'] = Variable<int>(targetType);
    return map;
  }

  HabitsCompanion toCompanion(bool nullToAbsent) {
    return HabitsCompanion(
      id: Value(id),
      title: Value(title),
      speciesType: Value(speciesType),
      createdAt: Value(createdAt),
      isActive: Value(isActive),
      targetType: Value(targetType),
    );
  }

  factory HabitRow.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return HabitRow(
      id: serializer.fromJson<int>(json['id']),
      title: serializer.fromJson<String>(json['title']),
      speciesType: serializer.fromJson<int>(json['speciesType']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      isActive: serializer.fromJson<bool>(json['isActive']),
      targetType: serializer.fromJson<int>(json['targetType']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'title': serializer.toJson<String>(title),
      'speciesType': serializer.toJson<int>(speciesType),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'isActive': serializer.toJson<bool>(isActive),
      'targetType': serializer.toJson<int>(targetType),
    };
  }

  HabitRow copyWith(
          {int? id,
          String? title,
          int? speciesType,
          DateTime? createdAt,
          bool? isActive,
          int? targetType}) =>
      HabitRow(
        id: id ?? this.id,
        title: title ?? this.title,
        speciesType: speciesType ?? this.speciesType,
        createdAt: createdAt ?? this.createdAt,
        isActive: isActive ?? this.isActive,
        targetType: targetType ?? this.targetType,
      );
  HabitRow copyWithCompanion(HabitsCompanion data) {
    return HabitRow(
      id: data.id.present ? data.id.value : this.id,
      title: data.title.present ? data.title.value : this.title,
      speciesType:
          data.speciesType.present ? data.speciesType.value : this.speciesType,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      isActive: data.isActive.present ? data.isActive.value : this.isActive,
      targetType:
          data.targetType.present ? data.targetType.value : this.targetType,
    );
  }

  @override
  String toString() {
    return (StringBuffer('HabitRow(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('speciesType: $speciesType, ')
          ..write('createdAt: $createdAt, ')
          ..write('isActive: $isActive, ')
          ..write('targetType: $targetType')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, title, speciesType, createdAt, isActive, targetType);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is HabitRow &&
          other.id == this.id &&
          other.title == this.title &&
          other.speciesType == this.speciesType &&
          other.createdAt == this.createdAt &&
          other.isActive == this.isActive &&
          other.targetType == this.targetType);
}

class HabitsCompanion extends UpdateCompanion<HabitRow> {
  final Value<int> id;
  final Value<String> title;
  final Value<int> speciesType;
  final Value<DateTime> createdAt;
  final Value<bool> isActive;
  final Value<int> targetType;
  const HabitsCompanion({
    this.id = const Value.absent(),
    this.title = const Value.absent(),
    this.speciesType = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.isActive = const Value.absent(),
    this.targetType = const Value.absent(),
  });
  HabitsCompanion.insert({
    this.id = const Value.absent(),
    required String title,
    required int speciesType,
    required DateTime createdAt,
    this.isActive = const Value.absent(),
    this.targetType = const Value.absent(),
  })  : title = Value(title),
        speciesType = Value(speciesType),
        createdAt = Value(createdAt);
  static Insertable<HabitRow> custom({
    Expression<int>? id,
    Expression<String>? title,
    Expression<int>? speciesType,
    Expression<DateTime>? createdAt,
    Expression<bool>? isActive,
    Expression<int>? targetType,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (title != null) 'title': title,
      if (speciesType != null) 'species_type': speciesType,
      if (createdAt != null) 'created_at': createdAt,
      if (isActive != null) 'is_active': isActive,
      if (targetType != null) 'target_type': targetType,
    });
  }

  HabitsCompanion copyWith(
      {Value<int>? id,
      Value<String>? title,
      Value<int>? speciesType,
      Value<DateTime>? createdAt,
      Value<bool>? isActive,
      Value<int>? targetType}) {
    return HabitsCompanion(
      id: id ?? this.id,
      title: title ?? this.title,
      speciesType: speciesType ?? this.speciesType,
      createdAt: createdAt ?? this.createdAt,
      isActive: isActive ?? this.isActive,
      targetType: targetType ?? this.targetType,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (speciesType.present) {
      map['species_type'] = Variable<int>(speciesType.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (isActive.present) {
      map['is_active'] = Variable<bool>(isActive.value);
    }
    if (targetType.present) {
      map['target_type'] = Variable<int>(targetType.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('HabitsCompanion(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('speciesType: $speciesType, ')
          ..write('createdAt: $createdAt, ')
          ..write('isActive: $isActive, ')
          ..write('targetType: $targetType')
          ..write(')'))
        .toString();
  }
}

class $HabitCompletionsTable extends HabitCompletions
    with TableInfo<$HabitCompletionsTable, HabitCompletionRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $HabitCompletionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _habitIdMeta =
      const VerificationMeta('habitId');
  @override
  late final GeneratedColumn<int> habitId = GeneratedColumn<int>(
      'habit_id', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: true,
      defaultConstraints: GeneratedColumn.constraintIsAlways(
          'REFERENCES habits (id) ON DELETE CASCADE'));
  static const VerificationMeta _completedAtMeta =
      const VerificationMeta('completedAt');
  @override
  late final GeneratedColumn<DateTime> completedAt = GeneratedColumn<DateTime>(
      'completed_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [id, habitId, completedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'habit_completions';
  @override
  VerificationContext validateIntegrity(Insertable<HabitCompletionRow> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('habit_id')) {
      context.handle(_habitIdMeta,
          habitId.isAcceptableOrUnknown(data['habit_id']!, _habitIdMeta));
    } else if (isInserting) {
      context.missing(_habitIdMeta);
    }
    if (data.containsKey('completed_at')) {
      context.handle(
          _completedAtMeta,
          completedAt.isAcceptableOrUnknown(
              data['completed_at']!, _completedAtMeta));
    } else if (isInserting) {
      context.missing(_completedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  HabitCompletionRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return HabitCompletionRow(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      habitId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}habit_id'])!,
      completedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}completed_at'])!,
    );
  }

  @override
  $HabitCompletionsTable createAlias(String alias) {
    return $HabitCompletionsTable(attachedDatabase, alias);
  }
}

class HabitCompletionRow extends DataClass
    implements Insertable<HabitCompletionRow> {
  final int id;
  final int habitId;
  final DateTime completedAt;
  const HabitCompletionRow(
      {required this.id, required this.habitId, required this.completedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['habit_id'] = Variable<int>(habitId);
    map['completed_at'] = Variable<DateTime>(completedAt);
    return map;
  }

  HabitCompletionsCompanion toCompanion(bool nullToAbsent) {
    return HabitCompletionsCompanion(
      id: Value(id),
      habitId: Value(habitId),
      completedAt: Value(completedAt),
    );
  }

  factory HabitCompletionRow.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return HabitCompletionRow(
      id: serializer.fromJson<int>(json['id']),
      habitId: serializer.fromJson<int>(json['habitId']),
      completedAt: serializer.fromJson<DateTime>(json['completedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'habitId': serializer.toJson<int>(habitId),
      'completedAt': serializer.toJson<DateTime>(completedAt),
    };
  }

  HabitCompletionRow copyWith({int? id, int? habitId, DateTime? completedAt}) =>
      HabitCompletionRow(
        id: id ?? this.id,
        habitId: habitId ?? this.habitId,
        completedAt: completedAt ?? this.completedAt,
      );
  HabitCompletionRow copyWithCompanion(HabitCompletionsCompanion data) {
    return HabitCompletionRow(
      id: data.id.present ? data.id.value : this.id,
      habitId: data.habitId.present ? data.habitId.value : this.habitId,
      completedAt:
          data.completedAt.present ? data.completedAt.value : this.completedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('HabitCompletionRow(')
          ..write('id: $id, ')
          ..write('habitId: $habitId, ')
          ..write('completedAt: $completedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, habitId, completedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is HabitCompletionRow &&
          other.id == this.id &&
          other.habitId == this.habitId &&
          other.completedAt == this.completedAt);
}

class HabitCompletionsCompanion extends UpdateCompanion<HabitCompletionRow> {
  final Value<int> id;
  final Value<int> habitId;
  final Value<DateTime> completedAt;
  const HabitCompletionsCompanion({
    this.id = const Value.absent(),
    this.habitId = const Value.absent(),
    this.completedAt = const Value.absent(),
  });
  HabitCompletionsCompanion.insert({
    this.id = const Value.absent(),
    required int habitId,
    required DateTime completedAt,
  })  : habitId = Value(habitId),
        completedAt = Value(completedAt);
  static Insertable<HabitCompletionRow> custom({
    Expression<int>? id,
    Expression<int>? habitId,
    Expression<DateTime>? completedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (habitId != null) 'habit_id': habitId,
      if (completedAt != null) 'completed_at': completedAt,
    });
  }

  HabitCompletionsCompanion copyWith(
      {Value<int>? id, Value<int>? habitId, Value<DateTime>? completedAt}) {
    return HabitCompletionsCompanion(
      id: id ?? this.id,
      habitId: habitId ?? this.habitId,
      completedAt: completedAt ?? this.completedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (habitId.present) {
      map['habit_id'] = Variable<int>(habitId.value);
    }
    if (completedAt.present) {
      map['completed_at'] = Variable<DateTime>(completedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('HabitCompletionsCompanion(')
          ..write('id: $id, ')
          ..write('habitId: $habitId, ')
          ..write('completedAt: $completedAt')
          ..write(')'))
        .toString();
  }
}

class $OrganismsTable extends Organisms
    with TableInfo<$OrganismsTable, OrganismRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OrganismsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _habitIdMeta =
      const VerificationMeta('habitId');
  @override
  late final GeneratedColumn<int> habitId = GeneratedColumn<int>(
      'habit_id', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: true,
      defaultConstraints: GeneratedColumn.constraintIsAlways(
          'REFERENCES habits (id) ON DELETE CASCADE'));
  static const VerificationMeta _vitalityMeta =
      const VerificationMeta('vitality');
  @override
  late final GeneratedColumn<double> vitality = GeneratedColumn<double>(
      'vitality', aliasedName, false,
      type: DriftSqlType.double,
      requiredDuringInsert: false,
      defaultValue: const Constant(0.4));
  static const VerificationMeta _lastUpdatedAtMeta =
      const VerificationMeta('lastUpdatedAt');
  @override
  late final GeneratedColumn<DateTime> lastUpdatedAt =
      GeneratedColumn<DateTime>('last_updated_at', aliasedName, false,
          type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _seedMeta = const VerificationMeta('seed');
  @override
  late final GeneratedColumn<int> seed = GeneratedColumn<int>(
      'seed', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [id, habitId, vitality, lastUpdatedAt, seed];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'organisms';
  @override
  VerificationContext validateIntegrity(Insertable<OrganismRow> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('habit_id')) {
      context.handle(_habitIdMeta,
          habitId.isAcceptableOrUnknown(data['habit_id']!, _habitIdMeta));
    } else if (isInserting) {
      context.missing(_habitIdMeta);
    }
    if (data.containsKey('vitality')) {
      context.handle(_vitalityMeta,
          vitality.isAcceptableOrUnknown(data['vitality']!, _vitalityMeta));
    }
    if (data.containsKey('last_updated_at')) {
      context.handle(
          _lastUpdatedAtMeta,
          lastUpdatedAt.isAcceptableOrUnknown(
              data['last_updated_at']!, _lastUpdatedAtMeta));
    } else if (isInserting) {
      context.missing(_lastUpdatedAtMeta);
    }
    if (data.containsKey('seed')) {
      context.handle(
          _seedMeta, seed.isAcceptableOrUnknown(data['seed']!, _seedMeta));
    } else if (isInserting) {
      context.missing(_seedMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  OrganismRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OrganismRow(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      habitId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}habit_id'])!,
      vitality: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}vitality'])!,
      lastUpdatedAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}last_updated_at'])!,
      seed: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}seed'])!,
    );
  }

  @override
  $OrganismsTable createAlias(String alias) {
    return $OrganismsTable(attachedDatabase, alias);
  }
}

class OrganismRow extends DataClass implements Insertable<OrganismRow> {
  final int id;
  final int habitId;
  final double vitality;
  final DateTime lastUpdatedAt;
  final int seed;
  const OrganismRow(
      {required this.id,
      required this.habitId,
      required this.vitality,
      required this.lastUpdatedAt,
      required this.seed});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['habit_id'] = Variable<int>(habitId);
    map['vitality'] = Variable<double>(vitality);
    map['last_updated_at'] = Variable<DateTime>(lastUpdatedAt);
    map['seed'] = Variable<int>(seed);
    return map;
  }

  OrganismsCompanion toCompanion(bool nullToAbsent) {
    return OrganismsCompanion(
      id: Value(id),
      habitId: Value(habitId),
      vitality: Value(vitality),
      lastUpdatedAt: Value(lastUpdatedAt),
      seed: Value(seed),
    );
  }

  factory OrganismRow.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OrganismRow(
      id: serializer.fromJson<int>(json['id']),
      habitId: serializer.fromJson<int>(json['habitId']),
      vitality: serializer.fromJson<double>(json['vitality']),
      lastUpdatedAt: serializer.fromJson<DateTime>(json['lastUpdatedAt']),
      seed: serializer.fromJson<int>(json['seed']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'habitId': serializer.toJson<int>(habitId),
      'vitality': serializer.toJson<double>(vitality),
      'lastUpdatedAt': serializer.toJson<DateTime>(lastUpdatedAt),
      'seed': serializer.toJson<int>(seed),
    };
  }

  OrganismRow copyWith(
          {int? id,
          int? habitId,
          double? vitality,
          DateTime? lastUpdatedAt,
          int? seed}) =>
      OrganismRow(
        id: id ?? this.id,
        habitId: habitId ?? this.habitId,
        vitality: vitality ?? this.vitality,
        lastUpdatedAt: lastUpdatedAt ?? this.lastUpdatedAt,
        seed: seed ?? this.seed,
      );
  OrganismRow copyWithCompanion(OrganismsCompanion data) {
    return OrganismRow(
      id: data.id.present ? data.id.value : this.id,
      habitId: data.habitId.present ? data.habitId.value : this.habitId,
      vitality: data.vitality.present ? data.vitality.value : this.vitality,
      lastUpdatedAt: data.lastUpdatedAt.present
          ? data.lastUpdatedAt.value
          : this.lastUpdatedAt,
      seed: data.seed.present ? data.seed.value : this.seed,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OrganismRow(')
          ..write('id: $id, ')
          ..write('habitId: $habitId, ')
          ..write('vitality: $vitality, ')
          ..write('lastUpdatedAt: $lastUpdatedAt, ')
          ..write('seed: $seed')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, habitId, vitality, lastUpdatedAt, seed);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OrganismRow &&
          other.id == this.id &&
          other.habitId == this.habitId &&
          other.vitality == this.vitality &&
          other.lastUpdatedAt == this.lastUpdatedAt &&
          other.seed == this.seed);
}

class OrganismsCompanion extends UpdateCompanion<OrganismRow> {
  final Value<int> id;
  final Value<int> habitId;
  final Value<double> vitality;
  final Value<DateTime> lastUpdatedAt;
  final Value<int> seed;
  const OrganismsCompanion({
    this.id = const Value.absent(),
    this.habitId = const Value.absent(),
    this.vitality = const Value.absent(),
    this.lastUpdatedAt = const Value.absent(),
    this.seed = const Value.absent(),
  });
  OrganismsCompanion.insert({
    this.id = const Value.absent(),
    required int habitId,
    this.vitality = const Value.absent(),
    required DateTime lastUpdatedAt,
    required int seed,
  })  : habitId = Value(habitId),
        lastUpdatedAt = Value(lastUpdatedAt),
        seed = Value(seed);
  static Insertable<OrganismRow> custom({
    Expression<int>? id,
    Expression<int>? habitId,
    Expression<double>? vitality,
    Expression<DateTime>? lastUpdatedAt,
    Expression<int>? seed,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (habitId != null) 'habit_id': habitId,
      if (vitality != null) 'vitality': vitality,
      if (lastUpdatedAt != null) 'last_updated_at': lastUpdatedAt,
      if (seed != null) 'seed': seed,
    });
  }

  OrganismsCompanion copyWith(
      {Value<int>? id,
      Value<int>? habitId,
      Value<double>? vitality,
      Value<DateTime>? lastUpdatedAt,
      Value<int>? seed}) {
    return OrganismsCompanion(
      id: id ?? this.id,
      habitId: habitId ?? this.habitId,
      vitality: vitality ?? this.vitality,
      lastUpdatedAt: lastUpdatedAt ?? this.lastUpdatedAt,
      seed: seed ?? this.seed,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (habitId.present) {
      map['habit_id'] = Variable<int>(habitId.value);
    }
    if (vitality.present) {
      map['vitality'] = Variable<double>(vitality.value);
    }
    if (lastUpdatedAt.present) {
      map['last_updated_at'] = Variable<DateTime>(lastUpdatedAt.value);
    }
    if (seed.present) {
      map['seed'] = Variable<int>(seed.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OrganismsCompanion(')
          ..write('id: $id, ')
          ..write('habitId: $habitId, ')
          ..write('vitality: $vitality, ')
          ..write('lastUpdatedAt: $lastUpdatedAt, ')
          ..write('seed: $seed')
          ..write(')'))
        .toString();
  }
}

class $EcosystemStatesTable extends EcosystemStates
    with TableInfo<$EcosystemStatesTable, EcosystemStateRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $EcosystemStatesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _overallBalanceMeta =
      const VerificationMeta('overallBalance');
  @override
  late final GeneratedColumn<double> overallBalance = GeneratedColumn<double>(
      'overall_balance', aliasedName, false,
      type: DriftSqlType.double,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _ambientSeedMeta =
      const VerificationMeta('ambientSeed');
  @override
  late final GeneratedColumn<int> ambientSeed = GeneratedColumn<int>(
      'ambient_seed', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _lastUpdatedAtMeta =
      const VerificationMeta('lastUpdatedAt');
  @override
  late final GeneratedColumn<DateTime> lastUpdatedAt =
      GeneratedColumn<DateTime>('last_updated_at', aliasedName, false,
          type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [id, overallBalance, ambientSeed, lastUpdatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'ecosystem_states';
  @override
  VerificationContext validateIntegrity(Insertable<EcosystemStateRow> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('overall_balance')) {
      context.handle(
          _overallBalanceMeta,
          overallBalance.isAcceptableOrUnknown(
              data['overall_balance']!, _overallBalanceMeta));
    }
    if (data.containsKey('ambient_seed')) {
      context.handle(
          _ambientSeedMeta,
          ambientSeed.isAcceptableOrUnknown(
              data['ambient_seed']!, _ambientSeedMeta));
    } else if (isInserting) {
      context.missing(_ambientSeedMeta);
    }
    if (data.containsKey('last_updated_at')) {
      context.handle(
          _lastUpdatedAtMeta,
          lastUpdatedAt.isAcceptableOrUnknown(
              data['last_updated_at']!, _lastUpdatedAtMeta));
    } else if (isInserting) {
      context.missing(_lastUpdatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  EcosystemStateRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return EcosystemStateRow(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      overallBalance: attachedDatabase.typeMapping.read(
          DriftSqlType.double, data['${effectivePrefix}overall_balance'])!,
      ambientSeed: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}ambient_seed'])!,
      lastUpdatedAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}last_updated_at'])!,
    );
  }

  @override
  $EcosystemStatesTable createAlias(String alias) {
    return $EcosystemStatesTable(attachedDatabase, alias);
  }
}

class EcosystemStateRow extends DataClass
    implements Insertable<EcosystemStateRow> {
  final int id;
  final double overallBalance;
  final int ambientSeed;
  final DateTime lastUpdatedAt;
  const EcosystemStateRow(
      {required this.id,
      required this.overallBalance,
      required this.ambientSeed,
      required this.lastUpdatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['overall_balance'] = Variable<double>(overallBalance);
    map['ambient_seed'] = Variable<int>(ambientSeed);
    map['last_updated_at'] = Variable<DateTime>(lastUpdatedAt);
    return map;
  }

  EcosystemStatesCompanion toCompanion(bool nullToAbsent) {
    return EcosystemStatesCompanion(
      id: Value(id),
      overallBalance: Value(overallBalance),
      ambientSeed: Value(ambientSeed),
      lastUpdatedAt: Value(lastUpdatedAt),
    );
  }

  factory EcosystemStateRow.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return EcosystemStateRow(
      id: serializer.fromJson<int>(json['id']),
      overallBalance: serializer.fromJson<double>(json['overallBalance']),
      ambientSeed: serializer.fromJson<int>(json['ambientSeed']),
      lastUpdatedAt: serializer.fromJson<DateTime>(json['lastUpdatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'overallBalance': serializer.toJson<double>(overallBalance),
      'ambientSeed': serializer.toJson<int>(ambientSeed),
      'lastUpdatedAt': serializer.toJson<DateTime>(lastUpdatedAt),
    };
  }

  EcosystemStateRow copyWith(
          {int? id,
          double? overallBalance,
          int? ambientSeed,
          DateTime? lastUpdatedAt}) =>
      EcosystemStateRow(
        id: id ?? this.id,
        overallBalance: overallBalance ?? this.overallBalance,
        ambientSeed: ambientSeed ?? this.ambientSeed,
        lastUpdatedAt: lastUpdatedAt ?? this.lastUpdatedAt,
      );
  EcosystemStateRow copyWithCompanion(EcosystemStatesCompanion data) {
    return EcosystemStateRow(
      id: data.id.present ? data.id.value : this.id,
      overallBalance: data.overallBalance.present
          ? data.overallBalance.value
          : this.overallBalance,
      ambientSeed:
          data.ambientSeed.present ? data.ambientSeed.value : this.ambientSeed,
      lastUpdatedAt: data.lastUpdatedAt.present
          ? data.lastUpdatedAt.value
          : this.lastUpdatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('EcosystemStateRow(')
          ..write('id: $id, ')
          ..write('overallBalance: $overallBalance, ')
          ..write('ambientSeed: $ambientSeed, ')
          ..write('lastUpdatedAt: $lastUpdatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, overallBalance, ambientSeed, lastUpdatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is EcosystemStateRow &&
          other.id == this.id &&
          other.overallBalance == this.overallBalance &&
          other.ambientSeed == this.ambientSeed &&
          other.lastUpdatedAt == this.lastUpdatedAt);
}

class EcosystemStatesCompanion extends UpdateCompanion<EcosystemStateRow> {
  final Value<int> id;
  final Value<double> overallBalance;
  final Value<int> ambientSeed;
  final Value<DateTime> lastUpdatedAt;
  const EcosystemStatesCompanion({
    this.id = const Value.absent(),
    this.overallBalance = const Value.absent(),
    this.ambientSeed = const Value.absent(),
    this.lastUpdatedAt = const Value.absent(),
  });
  EcosystemStatesCompanion.insert({
    this.id = const Value.absent(),
    this.overallBalance = const Value.absent(),
    required int ambientSeed,
    required DateTime lastUpdatedAt,
  })  : ambientSeed = Value(ambientSeed),
        lastUpdatedAt = Value(lastUpdatedAt);
  static Insertable<EcosystemStateRow> custom({
    Expression<int>? id,
    Expression<double>? overallBalance,
    Expression<int>? ambientSeed,
    Expression<DateTime>? lastUpdatedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (overallBalance != null) 'overall_balance': overallBalance,
      if (ambientSeed != null) 'ambient_seed': ambientSeed,
      if (lastUpdatedAt != null) 'last_updated_at': lastUpdatedAt,
    });
  }

  EcosystemStatesCompanion copyWith(
      {Value<int>? id,
      Value<double>? overallBalance,
      Value<int>? ambientSeed,
      Value<DateTime>? lastUpdatedAt}) {
    return EcosystemStatesCompanion(
      id: id ?? this.id,
      overallBalance: overallBalance ?? this.overallBalance,
      ambientSeed: ambientSeed ?? this.ambientSeed,
      lastUpdatedAt: lastUpdatedAt ?? this.lastUpdatedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (overallBalance.present) {
      map['overall_balance'] = Variable<double>(overallBalance.value);
    }
    if (ambientSeed.present) {
      map['ambient_seed'] = Variable<int>(ambientSeed.value);
    }
    if (lastUpdatedAt.present) {
      map['last_updated_at'] = Variable<DateTime>(lastUpdatedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('EcosystemStatesCompanion(')
          ..write('id: $id, ')
          ..write('overallBalance: $overallBalance, ')
          ..write('ambientSeed: $ambientSeed, ')
          ..write('lastUpdatedAt: $lastUpdatedAt')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $HabitsTable habits = $HabitsTable(this);
  late final $HabitCompletionsTable habitCompletions =
      $HabitCompletionsTable(this);
  late final $OrganismsTable organisms = $OrganismsTable(this);
  late final $EcosystemStatesTable ecosystemStates =
      $EcosystemStatesTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities =>
      [habits, habitCompletions, organisms, ecosystemStates];
  @override
  StreamQueryUpdateRules get streamUpdateRules => const StreamQueryUpdateRules(
        [
          WritePropagation(
            on: TableUpdateQuery.onTableName('habits',
                limitUpdateKind: UpdateKind.delete),
            result: [
              TableUpdate('habit_completions', kind: UpdateKind.delete),
            ],
          ),
          WritePropagation(
            on: TableUpdateQuery.onTableName('habits',
                limitUpdateKind: UpdateKind.delete),
            result: [
              TableUpdate('organisms', kind: UpdateKind.delete),
            ],
          ),
        ],
      );
}

typedef $$HabitsTableCreateCompanionBuilder = HabitsCompanion Function({
  Value<int> id,
  required String title,
  required int speciesType,
  required DateTime createdAt,
  Value<bool> isActive,
  Value<int> targetType,
});
typedef $$HabitsTableUpdateCompanionBuilder = HabitsCompanion Function({
  Value<int> id,
  Value<String> title,
  Value<int> speciesType,
  Value<DateTime> createdAt,
  Value<bool> isActive,
  Value<int> targetType,
});

final class $$HabitsTableReferences
    extends BaseReferences<_$AppDatabase, $HabitsTable, HabitRow> {
  $$HabitsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$HabitCompletionsTable, List<HabitCompletionRow>>
      _habitCompletionsRefsTable(_$AppDatabase db) =>
          MultiTypedResultKey.fromTable(db.habitCompletions,
              aliasName: 'habits__id__habit_completions__habit_id');

  $$HabitCompletionsTableProcessedTableManager get habitCompletionsRefs {
    final manager =
        $$HabitCompletionsTableTableManager($_db, $_db.habitCompletions)
            .filter((f) => f.habitId.id.sqlEquals($_itemColumn<int>('id')!));

    final cache =
        $_typedResult.readTableOrNull(_habitCompletionsRefsTable($_db));
    return ProcessedTableManager(
        manager.$state.copyWith(prefetchedData: cache));
  }

  static MultiTypedResultKey<$OrganismsTable, List<OrganismRow>>
      _organismsRefsTable(_$AppDatabase db) =>
          MultiTypedResultKey.fromTable(db.organisms,
              aliasName: 'habits__id__organisms__habit_id');

  $$OrganismsTableProcessedTableManager get organismsRefs {
    final manager = $$OrganismsTableTableManager($_db, $_db.organisms)
        .filter((f) => f.habitId.id.sqlEquals($_itemColumn<int>('id')!));

    final cache = $_typedResult.readTableOrNull(_organismsRefsTable($_db));
    return ProcessedTableManager(
        manager.$state.copyWith(prefetchedData: cache));
  }
}

class $$HabitsTableFilterComposer
    extends Composer<_$AppDatabase, $HabitsTable> {
  $$HabitsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get title => $composableBuilder(
      column: $table.title, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get speciesType => $composableBuilder(
      column: $table.speciesType, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get isActive => $composableBuilder(
      column: $table.isActive, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get targetType => $composableBuilder(
      column: $table.targetType, builder: (column) => ColumnFilters(column));

  Expression<bool> habitCompletionsRefs(
      Expression<bool> Function($$HabitCompletionsTableFilterComposer f) f) {
    final $$HabitCompletionsTableFilterComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.id,
        referencedTable: $db.habitCompletions,
        getReferencedColumn: (t) => t.habitId,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$HabitCompletionsTableFilterComposer(
              $db: $db,
              $table: $db.habitCompletions,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return f(composer);
  }

  Expression<bool> organismsRefs(
      Expression<bool> Function($$OrganismsTableFilterComposer f) f) {
    final $$OrganismsTableFilterComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.id,
        referencedTable: $db.organisms,
        getReferencedColumn: (t) => t.habitId,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$OrganismsTableFilterComposer(
              $db: $db,
              $table: $db.organisms,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return f(composer);
  }
}

class $$HabitsTableOrderingComposer
    extends Composer<_$AppDatabase, $HabitsTable> {
  $$HabitsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get title => $composableBuilder(
      column: $table.title, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get speciesType => $composableBuilder(
      column: $table.speciesType, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get isActive => $composableBuilder(
      column: $table.isActive, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get targetType => $composableBuilder(
      column: $table.targetType, builder: (column) => ColumnOrderings(column));
}

class $$HabitsTableAnnotationComposer
    extends Composer<_$AppDatabase, $HabitsTable> {
  $$HabitsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<int> get speciesType => $composableBuilder(
      column: $table.speciesType, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<bool> get isActive =>
      $composableBuilder(column: $table.isActive, builder: (column) => column);

  GeneratedColumn<int> get targetType => $composableBuilder(
      column: $table.targetType, builder: (column) => column);

  Expression<T> habitCompletionsRefs<T extends Object>(
      Expression<T> Function($$HabitCompletionsTableAnnotationComposer a) f) {
    final $$HabitCompletionsTableAnnotationComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.id,
        referencedTable: $db.habitCompletions,
        getReferencedColumn: (t) => t.habitId,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$HabitCompletionsTableAnnotationComposer(
              $db: $db,
              $table: $db.habitCompletions,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return f(composer);
  }

  Expression<T> organismsRefs<T extends Object>(
      Expression<T> Function($$OrganismsTableAnnotationComposer a) f) {
    final $$OrganismsTableAnnotationComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.id,
        referencedTable: $db.organisms,
        getReferencedColumn: (t) => t.habitId,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$OrganismsTableAnnotationComposer(
              $db: $db,
              $table: $db.organisms,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return f(composer);
  }
}

class $$HabitsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $HabitsTable,
    HabitRow,
    $$HabitsTableFilterComposer,
    $$HabitsTableOrderingComposer,
    $$HabitsTableAnnotationComposer,
    $$HabitsTableCreateCompanionBuilder,
    $$HabitsTableUpdateCompanionBuilder,
    (HabitRow, $$HabitsTableReferences),
    HabitRow,
    PrefetchHooks Function({bool habitCompletionsRefs, bool organismsRefs})> {
  $$HabitsTableTableManager(_$AppDatabase db, $HabitsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$HabitsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$HabitsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$HabitsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<String> title = const Value.absent(),
            Value<int> speciesType = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<bool> isActive = const Value.absent(),
            Value<int> targetType = const Value.absent(),
          }) =>
              HabitsCompanion(
            id: id,
            title: title,
            speciesType: speciesType,
            createdAt: createdAt,
            isActive: isActive,
            targetType: targetType,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required String title,
            required int speciesType,
            required DateTime createdAt,
            Value<bool> isActive = const Value.absent(),
            Value<int> targetType = const Value.absent(),
          }) =>
              HabitsCompanion.insert(
            id: id,
            title: title,
            speciesType: speciesType,
            createdAt: createdAt,
            isActive: isActive,
            targetType: targetType,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) =>
                  (e.readTable(table), $$HabitsTableReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: (
              {habitCompletionsRefs = false, organismsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [
                if (habitCompletionsRefs) db.habitCompletions,
                if (organismsRefs) db.organisms
              ],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (habitCompletionsRefs)
                    await $_getPrefetchedData<HabitRow, $HabitsTable,
                            HabitCompletionRow>(
                        currentTable: table,
                        referencedTable: $$HabitsTableReferences
                            ._habitCompletionsRefsTable(db),
                        managerFromTypedResult: (p0) =>
                            $$HabitsTableReferences(db, table, p0)
                                .habitCompletionsRefs,
                        referencedItemsForCurrentItem: (item,
                                referencedItems) =>
                            referencedItems.where((e) => e.habitId == item.id),
                        typedResults: items),
                  if (organismsRefs)
                    await $_getPrefetchedData<HabitRow, $HabitsTable,
                            OrganismRow>(
                        currentTable: table,
                        referencedTable:
                            $$HabitsTableReferences._organismsRefsTable(db),
                        managerFromTypedResult: (p0) =>
                            $$HabitsTableReferences(db, table, p0)
                                .organismsRefs,
                        referencedItemsForCurrentItem: (item,
                                referencedItems) =>
                            referencedItems.where((e) => e.habitId == item.id),
                        typedResults: items)
                ];
              },
            );
          },
        ));
}

typedef $$HabitsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $HabitsTable,
    HabitRow,
    $$HabitsTableFilterComposer,
    $$HabitsTableOrderingComposer,
    $$HabitsTableAnnotationComposer,
    $$HabitsTableCreateCompanionBuilder,
    $$HabitsTableUpdateCompanionBuilder,
    (HabitRow, $$HabitsTableReferences),
    HabitRow,
    PrefetchHooks Function({bool habitCompletionsRefs, bool organismsRefs})>;
typedef $$HabitCompletionsTableCreateCompanionBuilder
    = HabitCompletionsCompanion Function({
  Value<int> id,
  required int habitId,
  required DateTime completedAt,
});
typedef $$HabitCompletionsTableUpdateCompanionBuilder
    = HabitCompletionsCompanion Function({
  Value<int> id,
  Value<int> habitId,
  Value<DateTime> completedAt,
});

final class $$HabitCompletionsTableReferences extends BaseReferences<
    _$AppDatabase, $HabitCompletionsTable, HabitCompletionRow> {
  $$HabitCompletionsTableReferences(
      super.$_db, super.$_table, super.$_typedResult);

  static $HabitsTable _habitIdTable(_$AppDatabase db) =>
      db.habits.createAlias('habit_completions__habit_id__habits__id');

  $$HabitsTableProcessedTableManager get habitId {
    final $_column = $_itemColumn<int>('habit_id')!;

    final manager = $$HabitsTableTableManager($_db, $_db.habits)
        .filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_habitIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
        manager.$state.copyWith(prefetchedData: [item]));
  }
}

class $$HabitCompletionsTableFilterComposer
    extends Composer<_$AppDatabase, $HabitCompletionsTable> {
  $$HabitCompletionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get completedAt => $composableBuilder(
      column: $table.completedAt, builder: (column) => ColumnFilters(column));

  $$HabitsTableFilterComposer get habitId {
    final $$HabitsTableFilterComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.habitId,
        referencedTable: $db.habits,
        getReferencedColumn: (t) => t.id,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$HabitsTableFilterComposer(
              $db: $db,
              $table: $db.habits,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return composer;
  }
}

class $$HabitCompletionsTableOrderingComposer
    extends Composer<_$AppDatabase, $HabitCompletionsTable> {
  $$HabitCompletionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get completedAt => $composableBuilder(
      column: $table.completedAt, builder: (column) => ColumnOrderings(column));

  $$HabitsTableOrderingComposer get habitId {
    final $$HabitsTableOrderingComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.habitId,
        referencedTable: $db.habits,
        getReferencedColumn: (t) => t.id,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$HabitsTableOrderingComposer(
              $db: $db,
              $table: $db.habits,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return composer;
  }
}

class $$HabitCompletionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $HabitCompletionsTable> {
  $$HabitCompletionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<DateTime> get completedAt => $composableBuilder(
      column: $table.completedAt, builder: (column) => column);

  $$HabitsTableAnnotationComposer get habitId {
    final $$HabitsTableAnnotationComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.habitId,
        referencedTable: $db.habits,
        getReferencedColumn: (t) => t.id,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$HabitsTableAnnotationComposer(
              $db: $db,
              $table: $db.habits,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return composer;
  }
}

class $$HabitCompletionsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $HabitCompletionsTable,
    HabitCompletionRow,
    $$HabitCompletionsTableFilterComposer,
    $$HabitCompletionsTableOrderingComposer,
    $$HabitCompletionsTableAnnotationComposer,
    $$HabitCompletionsTableCreateCompanionBuilder,
    $$HabitCompletionsTableUpdateCompanionBuilder,
    (HabitCompletionRow, $$HabitCompletionsTableReferences),
    HabitCompletionRow,
    PrefetchHooks Function({bool habitId})> {
  $$HabitCompletionsTableTableManager(
      _$AppDatabase db, $HabitCompletionsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$HabitCompletionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$HabitCompletionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$HabitCompletionsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int> habitId = const Value.absent(),
            Value<DateTime> completedAt = const Value.absent(),
          }) =>
              HabitCompletionsCompanion(
            id: id,
            habitId: habitId,
            completedAt: completedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required int habitId,
            required DateTime completedAt,
          }) =>
              HabitCompletionsCompanion.insert(
            id: id,
            habitId: habitId,
            completedAt: completedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable(table),
                    $$HabitCompletionsTableReferences(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: ({habitId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins: <
                  T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic>>(state) {
                if (habitId) {
                  state = state.withJoin(
                    currentTable: table,
                    currentColumn: table.habitId,
                    referencedTable:
                        $$HabitCompletionsTableReferences._habitIdTable(db),
                    referencedColumn:
                        $$HabitCompletionsTableReferences._habitIdTable(db).id,
                  ) as T;
                }

                return state;
              },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ));
}

typedef $$HabitCompletionsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $HabitCompletionsTable,
    HabitCompletionRow,
    $$HabitCompletionsTableFilterComposer,
    $$HabitCompletionsTableOrderingComposer,
    $$HabitCompletionsTableAnnotationComposer,
    $$HabitCompletionsTableCreateCompanionBuilder,
    $$HabitCompletionsTableUpdateCompanionBuilder,
    (HabitCompletionRow, $$HabitCompletionsTableReferences),
    HabitCompletionRow,
    PrefetchHooks Function({bool habitId})>;
typedef $$OrganismsTableCreateCompanionBuilder = OrganismsCompanion Function({
  Value<int> id,
  required int habitId,
  Value<double> vitality,
  required DateTime lastUpdatedAt,
  required int seed,
});
typedef $$OrganismsTableUpdateCompanionBuilder = OrganismsCompanion Function({
  Value<int> id,
  Value<int> habitId,
  Value<double> vitality,
  Value<DateTime> lastUpdatedAt,
  Value<int> seed,
});

final class $$OrganismsTableReferences
    extends BaseReferences<_$AppDatabase, $OrganismsTable, OrganismRow> {
  $$OrganismsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $HabitsTable _habitIdTable(_$AppDatabase db) =>
      db.habits.createAlias('organisms__habit_id__habits__id');

  $$HabitsTableProcessedTableManager get habitId {
    final $_column = $_itemColumn<int>('habit_id')!;

    final manager = $$HabitsTableTableManager($_db, $_db.habits)
        .filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_habitIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
        manager.$state.copyWith(prefetchedData: [item]));
  }
}

class $$OrganismsTableFilterComposer
    extends Composer<_$AppDatabase, $OrganismsTable> {
  $$OrganismsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get vitality => $composableBuilder(
      column: $table.vitality, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lastUpdatedAt => $composableBuilder(
      column: $table.lastUpdatedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get seed => $composableBuilder(
      column: $table.seed, builder: (column) => ColumnFilters(column));

  $$HabitsTableFilterComposer get habitId {
    final $$HabitsTableFilterComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.habitId,
        referencedTable: $db.habits,
        getReferencedColumn: (t) => t.id,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$HabitsTableFilterComposer(
              $db: $db,
              $table: $db.habits,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return composer;
  }
}

class $$OrganismsTableOrderingComposer
    extends Composer<_$AppDatabase, $OrganismsTable> {
  $$OrganismsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get vitality => $composableBuilder(
      column: $table.vitality, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lastUpdatedAt => $composableBuilder(
      column: $table.lastUpdatedAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get seed => $composableBuilder(
      column: $table.seed, builder: (column) => ColumnOrderings(column));

  $$HabitsTableOrderingComposer get habitId {
    final $$HabitsTableOrderingComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.habitId,
        referencedTable: $db.habits,
        getReferencedColumn: (t) => t.id,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$HabitsTableOrderingComposer(
              $db: $db,
              $table: $db.habits,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return composer;
  }
}

class $$OrganismsTableAnnotationComposer
    extends Composer<_$AppDatabase, $OrganismsTable> {
  $$OrganismsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<double> get vitality =>
      $composableBuilder(column: $table.vitality, builder: (column) => column);

  GeneratedColumn<DateTime> get lastUpdatedAt => $composableBuilder(
      column: $table.lastUpdatedAt, builder: (column) => column);

  GeneratedColumn<int> get seed =>
      $composableBuilder(column: $table.seed, builder: (column) => column);

  $$HabitsTableAnnotationComposer get habitId {
    final $$HabitsTableAnnotationComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.habitId,
        referencedTable: $db.habits,
        getReferencedColumn: (t) => t.id,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$HabitsTableAnnotationComposer(
              $db: $db,
              $table: $db.habits,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return composer;
  }
}

class $$OrganismsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $OrganismsTable,
    OrganismRow,
    $$OrganismsTableFilterComposer,
    $$OrganismsTableOrderingComposer,
    $$OrganismsTableAnnotationComposer,
    $$OrganismsTableCreateCompanionBuilder,
    $$OrganismsTableUpdateCompanionBuilder,
    (OrganismRow, $$OrganismsTableReferences),
    OrganismRow,
    PrefetchHooks Function({bool habitId})> {
  $$OrganismsTableTableManager(_$AppDatabase db, $OrganismsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OrganismsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OrganismsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OrganismsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int> habitId = const Value.absent(),
            Value<double> vitality = const Value.absent(),
            Value<DateTime> lastUpdatedAt = const Value.absent(),
            Value<int> seed = const Value.absent(),
          }) =>
              OrganismsCompanion(
            id: id,
            habitId: habitId,
            vitality: vitality,
            lastUpdatedAt: lastUpdatedAt,
            seed: seed,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required int habitId,
            Value<double> vitality = const Value.absent(),
            required DateTime lastUpdatedAt,
            required int seed,
          }) =>
              OrganismsCompanion.insert(
            id: id,
            habitId: habitId,
            vitality: vitality,
            lastUpdatedAt: lastUpdatedAt,
            seed: seed,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable(table),
                    $$OrganismsTableReferences(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: ({habitId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins: <
                  T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic>>(state) {
                if (habitId) {
                  state = state.withJoin(
                    currentTable: table,
                    currentColumn: table.habitId,
                    referencedTable:
                        $$OrganismsTableReferences._habitIdTable(db),
                    referencedColumn:
                        $$OrganismsTableReferences._habitIdTable(db).id,
                  ) as T;
                }

                return state;
              },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ));
}

typedef $$OrganismsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $OrganismsTable,
    OrganismRow,
    $$OrganismsTableFilterComposer,
    $$OrganismsTableOrderingComposer,
    $$OrganismsTableAnnotationComposer,
    $$OrganismsTableCreateCompanionBuilder,
    $$OrganismsTableUpdateCompanionBuilder,
    (OrganismRow, $$OrganismsTableReferences),
    OrganismRow,
    PrefetchHooks Function({bool habitId})>;
typedef $$EcosystemStatesTableCreateCompanionBuilder = EcosystemStatesCompanion
    Function({
  Value<int> id,
  Value<double> overallBalance,
  required int ambientSeed,
  required DateTime lastUpdatedAt,
});
typedef $$EcosystemStatesTableUpdateCompanionBuilder = EcosystemStatesCompanion
    Function({
  Value<int> id,
  Value<double> overallBalance,
  Value<int> ambientSeed,
  Value<DateTime> lastUpdatedAt,
});

class $$EcosystemStatesTableFilterComposer
    extends Composer<_$AppDatabase, $EcosystemStatesTable> {
  $$EcosystemStatesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get overallBalance => $composableBuilder(
      column: $table.overallBalance,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get ambientSeed => $composableBuilder(
      column: $table.ambientSeed, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lastUpdatedAt => $composableBuilder(
      column: $table.lastUpdatedAt, builder: (column) => ColumnFilters(column));
}

class $$EcosystemStatesTableOrderingComposer
    extends Composer<_$AppDatabase, $EcosystemStatesTable> {
  $$EcosystemStatesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get overallBalance => $composableBuilder(
      column: $table.overallBalance,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get ambientSeed => $composableBuilder(
      column: $table.ambientSeed, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lastUpdatedAt => $composableBuilder(
      column: $table.lastUpdatedAt,
      builder: (column) => ColumnOrderings(column));
}

class $$EcosystemStatesTableAnnotationComposer
    extends Composer<_$AppDatabase, $EcosystemStatesTable> {
  $$EcosystemStatesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<double> get overallBalance => $composableBuilder(
      column: $table.overallBalance, builder: (column) => column);

  GeneratedColumn<int> get ambientSeed => $composableBuilder(
      column: $table.ambientSeed, builder: (column) => column);

  GeneratedColumn<DateTime> get lastUpdatedAt => $composableBuilder(
      column: $table.lastUpdatedAt, builder: (column) => column);
}

class $$EcosystemStatesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $EcosystemStatesTable,
    EcosystemStateRow,
    $$EcosystemStatesTableFilterComposer,
    $$EcosystemStatesTableOrderingComposer,
    $$EcosystemStatesTableAnnotationComposer,
    $$EcosystemStatesTableCreateCompanionBuilder,
    $$EcosystemStatesTableUpdateCompanionBuilder,
    (
      EcosystemStateRow,
      BaseReferences<_$AppDatabase, $EcosystemStatesTable, EcosystemStateRow>
    ),
    EcosystemStateRow,
    PrefetchHooks Function()> {
  $$EcosystemStatesTableTableManager(
      _$AppDatabase db, $EcosystemStatesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$EcosystemStatesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$EcosystemStatesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$EcosystemStatesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<double> overallBalance = const Value.absent(),
            Value<int> ambientSeed = const Value.absent(),
            Value<DateTime> lastUpdatedAt = const Value.absent(),
          }) =>
              EcosystemStatesCompanion(
            id: id,
            overallBalance: overallBalance,
            ambientSeed: ambientSeed,
            lastUpdatedAt: lastUpdatedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<double> overallBalance = const Value.absent(),
            required int ambientSeed,
            required DateTime lastUpdatedAt,
          }) =>
              EcosystemStatesCompanion.insert(
            id: id,
            overallBalance: overallBalance,
            ambientSeed: ambientSeed,
            lastUpdatedAt: lastUpdatedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$EcosystemStatesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $EcosystemStatesTable,
    EcosystemStateRow,
    $$EcosystemStatesTableFilterComposer,
    $$EcosystemStatesTableOrderingComposer,
    $$EcosystemStatesTableAnnotationComposer,
    $$EcosystemStatesTableCreateCompanionBuilder,
    $$EcosystemStatesTableUpdateCompanionBuilder,
    (
      EcosystemStateRow,
      BaseReferences<_$AppDatabase, $EcosystemStatesTable, EcosystemStateRow>
    ),
    EcosystemStateRow,
    PrefetchHooks Function()>;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$HabitsTableTableManager get habits =>
      $$HabitsTableTableManager(_db, _db.habits);
  $$HabitCompletionsTableTableManager get habitCompletions =>
      $$HabitCompletionsTableTableManager(_db, _db.habitCompletions);
  $$OrganismsTableTableManager get organisms =>
      $$OrganismsTableTableManager(_db, _db.organisms);
  $$EcosystemStatesTableTableManager get ecosystemStates =>
      $$EcosystemStatesTableTableManager(_db, _db.ecosystemStates);
}
