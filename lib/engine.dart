// engine.dart – Ausgang eines Spiels (1/X/2). Reine Logik, keine UI.
//
// Bis v1.5 lag hier zusätzlich die Punkte-Auswertung des Tippspiels
// (pointsFor/Scoring/pointsLabel). Commit 858df1c hat die App zur reinen
// Prognose-App gemacht; die Punkte-Logik hatte danach keinen Aufrufer mehr
// und ist entfernt. Tendency und tendencyOf bleiben – sie tragen die
// Prognose-Anzeige (main.dart) und die Modellbewertung (odds.dart).

enum Tendency { home, draw, away }

Tendency tendencyOf(int homeGoals, int awayGoals) {
  if (homeGoals > awayGoals) return Tendency.home;
  if (homeGoals < awayGoals) return Tendency.away;
  return Tendency.draw;
}
