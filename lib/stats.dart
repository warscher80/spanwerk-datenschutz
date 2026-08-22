// stats.dart – Team-Form aus echten letzten Spielen (TheSportsDB eventslast).
//
// Bewusst reine, testbare Logik: Der Netz-Abruf liegt in api.dart, hier wird
// nur aus einer Liste vergangener Ergebnisse die Form berechnet. Es werden
// ausschließlich ECHTE, bereits gespielte Partien verwendet – nichts erfunden.

/// Ein vergangenes Spiel aus Sicht eines bestimmten Teams.
class FormGame {
  final bool heim; // war das betrachtete Team Heimteam?
  final int erzielt; // Tore des Teams
  final int kassiert; // Tore des Gegners
  final DateTime? datum;
  const FormGame({
    required this.heim,
    required this.erzielt,
    required this.kassiert,
    this.datum,
  });

  /// 'S' Sieg, 'U' Unentschieden, 'N' Niederlage – aus Sicht des Teams.
  String get ausgang => erzielt > kassiert ? 'S' : (erzielt == kassiert ? 'U' : 'N');
  int get punkte => erzielt > kassiert ? 3 : (erzielt == kassiert ? 1 : 0);
}

/// Verdichtete Form eines Teams über die letzten [spiele] Partien.
class TeamForm {
  final List<FormGame> letzte; // neueste zuerst
  const TeamForm(this.letzte);

  static const TeamForm leer = TeamForm([]);

  int get spiele => letzte.length;
  bool get genugDaten => spiele >= 2;

  /// Ausgänge als Kürzel, neueste zuerst (z. B. ['S','S','N','S','U']).
  List<String> get formKette => [for (final g in letzte) g.ausgang];

  int get siege => letzte.where((g) => g.ausgang == 'S').length;
  int get remis => letzte.where((g) => g.ausgang == 'U').length;
  int get niederlagen => letzte.where((g) => g.ausgang == 'N').length;

  int get tore => letzte.fold(0, (s, g) => s + g.erzielt);
  int get gegentore => letzte.fold(0, (s, g) => s + g.kassiert);

  double? get torProSpiel => spiele == 0 ? null : tore / spiele;
  double? get gegentorProSpiel => spiele == 0 ? null : gegentore / spiele;

  /// Punkte pro Spiel (0–3) über die betrachteten Partien.
  double get punkteProSpiel =>
      spiele == 0 ? 1.5 : letzte.fold(0, (s, g) => s + g.punkte) / spiele;

  /// Heim- bzw. Auswärtsbilanz getrennt (für „Heimstärke/Auswärtsstärke").
  List<FormGame> get heimspiele => letzte.where((g) => g.heim).toList();
  List<FormGame> get auswaertsspiele => letzte.where((g) => !g.heim).toList();

  /// Form-Anpassung in Elo-Punkten (nur Anzeige/Score, bewusst begrenzt).
  /// Ableitung: Abweichung der Punkte pro Spiel vom Mittel (1,4) skaliert,
  /// hart auf ±60 begrenzt, und bei dünner Datenlage abgeschwächt.
  double get eloAnpassung {
    if (!genugDaten) return 0;
    final roh = (punkteProSpiel - 1.4) * 40.0;
    final gedaempft = roh * (spiele.clamp(0, 5) / 5.0);
    return gedaempft.clamp(-60.0, 60.0);
  }
}

/// Baut die Form aus rohen letzten Spielen; nimmt die neuesten [max] Partien.
/// [vor]: nur Spiele vor diesem Zeitpunkt zählen (verhindert Data-Leakage bei
/// rückblickenden Auswertungen). Für Live-Prognosen einfach null lassen.
TeamForm formAus(List<FormGame> spiele, {int max = 5, DateTime? vor}) {
  final gefiltert = [
    for (final g in spiele)
      if (vor == null || (g.datum != null && g.datum!.isBefore(vor))) g,
  ];
  // Neueste zuerst.
  gefiltert.sort((a, b) {
    final da = a.datum, db = b.datum;
    if (da == null || db == null) return 0;
    return db.compareTo(da);
  });
  return TeamForm(gefiltert.take(max).toList());
}
