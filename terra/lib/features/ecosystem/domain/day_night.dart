import 'dart:math' as math;

/// Grobe Tagesphase für Ambient-Effekte (Partikeldichte, Tieraktivität).
enum DayPhase { dawn, day, dusk, night }

/// Beschreibt den Licht-/Stimmungszustand für einen Zeitpunkt, abgeleitet aus
/// der Gerätezeit. Rein & deterministisch – nimmt die Zeit als Parameter.
class DayNight {
  const DayNight({
    required this.phase,
    required this.daylight,
    required this.nightGlow,
  });

  final DayPhase phase;

  /// 0 = tiefe Nacht, 1 = heller Mittag. Steuert Helligkeit/Farbtemperatur.
  final double daylight;

  /// 0 = kein Leuchten, 1 = maximales nächtliches Leuchten (Pilze, Glühwürmchen).
  final double nightGlow;

  /// Berechnet die Phase aus der lokalen Uhrzeit.
  ///
  /// Sanfte Sinus-Kurve über den Tag: Sonnenaufgang ~6h, Mittag 12h,
  /// Sonnenuntergang ~18h, Mitternacht dunkelste Phase.
  factory DayNight.at(DateTime localTime) {
    final double hour =
        localTime.hour + localTime.minute / 60.0 + localTime.second / 3600.0;

    // Tageslicht als weiche Kurve: Peak um 13h, Null in der Nacht.
    // cos-basiert, verschoben, dann geglättet auf 0..1.
    final double raw = math.cos((hour - 13.0) / 24.0 * 2 * math.pi);
    final double daylight = _smoothstep(0.0, 1.0, (raw + 0.15).clamp(0.0, 1.0));

    final double nightGlow = (1.0 - daylight).clamp(0.0, 1.0);

    final DayPhase phase;
    if (hour >= 5 && hour < 8) {
      phase = DayPhase.dawn;
    } else if (hour >= 8 && hour < 17) {
      phase = DayPhase.day;
    } else if (hour >= 17 && hour < 20) {
      phase = DayPhase.dusk;
    } else {
      phase = DayPhase.night;
    }

    return DayNight(phase: phase, daylight: daylight, nightGlow: nightGlow);
  }

  bool get isNight => phase == DayPhase.night;
}

double _smoothstep(double edge0, double edge1, double x) {
  final double t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
  return t * t * (3 - 2 * t);
}
