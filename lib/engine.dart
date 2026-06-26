// engine.dart – Tipp-Auswertung (Kicktipp-Stil). Reine Logik, keine UI.

enum Tendency { home, draw, away }

Tendency tendencyOf(int homeGoals, int awayGoals) {
  if (homeGoals > awayGoals) return Tendency.home;
  if (homeGoals < awayGoals) return Tendency.away;
  return Tendency.draw;
}

class Scoring {
  static const exact = 5;       // Volltreffer: exaktes Ergebnis
  static const goalDiff = 3;    // richtige Tordifferenz (nicht exakt)
  static const tendency = 2;    // richtige Tendenz (1/X/2)
  static const wrong = 0;
}

/// Punkte für einen Tipp gegen das tatsächliche Ergebnis.
int pointsFor({
  required int predHome,
  required int predAway,
  required int actualHome,
  required int actualAway,
}) {
  if (predHome == actualHome && predAway == actualAway) return Scoring.exact;

  final predTd = predHome - predAway;
  final actualTd = actualHome - actualAway;
  // Gleiche Tordifferenz (schließt korrektes Remis mit anderem Ergebnis ein).
  if (predTd == actualTd) return Scoring.goalDiff;

  if (tendencyOf(predHome, predAway) == tendencyOf(actualHome, actualAway)) {
    return Scoring.tendency;
  }
  return Scoring.wrong;
}

String pointsLabel(int p) {
  switch (p) {
    case Scoring.exact:
      return 'Volltreffer';
    case Scoring.goalDiff:
      return 'Tordifferenz';
    case Scoring.tendency:
      return 'Tendenz';
    default:
      return 'Daneben';
  }
}
