/// Ein einzelnes Abhaken eines Habits zu einem Zeitpunkt.
class HabitCompletion {
  const HabitCompletion({
    required this.id,
    required this.habitId,
    required this.completedAt,
  });

  final int id;
  final int habitId;
  final DateTime completedAt;
}
