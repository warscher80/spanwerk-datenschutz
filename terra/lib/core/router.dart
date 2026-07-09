import 'package:go_router/go_router.dart';

import '../features/habits/domain/habit.dart';
import '../features/habits/presentation/habit_edit_screen.dart';
import '../features/home/presentation/home_screen.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/habit/new',
      builder: (context, state) => const HabitEditScreen(),
    ),
    GoRoute(
      path: '/habit/edit',
      builder: (context, state) =>
          HabitEditScreen(habit: state.extra as Habit?),
    ),
  ],
);
