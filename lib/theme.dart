// theme.dart – KickProphet Design-Tokens.
//
// Ein dunkles, technisches Grün-Schema mit klarem Mint-Akzent: sportlich und
// hochwertig, bewusst ohne Neon-, Casino- oder KI-Landingpage-Optik. Alle
// Farben, Radien und Abstände laufen über diese Konstanten, damit die App
// überall gleich aussieht und sich zentral nachjustieren lässt.
import 'package:flutter/material.dart';

// --- Flächen & Ränder ---
const kBg = Color(0xFF0A1512); // App-Hintergrund (sehr dunkel, leicht grün)
const kSurface = Color(0xFF11201B); // Karten
const kSurfaceHi = Color(0xFF172A23); // hervorgehobene Fläche (Chips, Zellen)
const kSurfaceTop = Color(0xFF102019); // Kopf-/Leistenflächen
const kBorder = Color(0xFF203A32); // dezente Ränder
const kBorderHi = Color(0xFF2E5749); // betonte Ränder

// --- Text ---
const kText = Color(0xFFF1F6F3); // Haupttext
const kTextDim = Color(0xFF9FB4AC); // Sekundärtext
const kTextMute = Color(0xFF6C817A); // leise Zusatzinfo

// --- Akzent & Status ---
const kAccent = Color(0xFF2BD47E); // Marken-Mint
const kAccentInk = Color(0xFF04241A); // Text/Icon auf Akzentflächen
const kLive = Color(0xFFFF5A5F); // Live / Tor-Alarm
const kWarn = Color(0xFFFFC24B); // Hinweis
const kDanger = Color(0xFFFF6B6B); // Fehler / „daneben"

// --- Form ---
const kRadius = 16.0;
const kRadiusSm = 10.0;
const kRadiusPill = 999.0;

// --- Abstände ---
const kGap = 12.0;

/// Segmentierter Wahrscheinlichkeits-Balken (Heim | Unentschieden | Gast).
/// Der prognostizierte Ausgang ist im Akzent hervorgehoben, die anderen ruhig –
/// so ist der wahrscheinlichste Ausgang sofort erkennbar, ganz ohne Chart.
class ProbBar extends StatelessWidget {
  final double home;
  final double draw;
  final double away;
  final int highlight; // 0 = Heim, 1 = Unentschieden, 2 = Gast
  const ProbBar({
    super.key,
    required this.home,
    required this.draw,
    required this.away,
    required this.highlight,
  });

  @override
  Widget build(BuildContext context) {
    // Mindestanteile, damit auch kleine Werte als Segment sichtbar bleiben.
    final vals = [home, draw, away];
    final flex = vals.map((v) => (v * 1000).round().clamp(28, 1000)).toList();
    Color colorFor(int i) {
      if (i == highlight) return kAccent;
      return i == 1 ? const Color(0xFF3A5C51) : const Color(0xFF2A4B41);
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(kRadiusPill),
      child: SizedBox(
        height: 8,
        child: Row(
          children: [
            for (var i = 0; i < 3; i++)
              Expanded(
                flex: flex[i],
                child: Container(
                  margin: EdgeInsets.only(right: i < 2 ? 2 : 0),
                  color: colorFor(i),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Kleiner Status-/Kategorie-Chip (z. B. „LIVE 67'", „Beendet", Uhrzeit).
class StatusPill extends StatelessWidget {
  final String text;
  final Color color;
  final bool filled;
  final IconData? icon;
  const StatusPill(this.text,
      {super.key, this.color = kTextDim, this.filled = false, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: icon != null ? 8 : 9, vertical: 3),
      decoration: BoxDecoration(
        color: filled ? color.withValues(alpha: 0.16) : Colors.transparent,
        borderRadius: BorderRadius.circular(kRadiusPill),
        border: Border.all(color: color.withValues(alpha: filled ? 0.0 : 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
          ],
          Text(text,
              style: TextStyle(
                  color: color, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
        ],
      ),
    );
  }
}
