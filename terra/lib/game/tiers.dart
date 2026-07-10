import 'package:flutter/material.dart';

/// Ein Rang im kosmischen Aufstieg – Name + Farbe des leuchtenden Objekts.
class TierInfo {
  const TierInfo(this.name, this.color);
  final String name;
  final Color color;
}

const List<TierInfo> kTiers = [
  TierInfo('Sternenstaub', Color(0xFF9AA0B5)),
  TierInfo('Meteor', Color(0xFF8A6E5A)),
  TierInfo('Komet', Color(0xFF5FC8E6)),
  TierInfo('Mond', Color(0xFFCBD3DE)),
  TierInfo('Planet', Color(0xFF4E7FD1)),
  TierInfo('Ringplanet', Color(0xFF46B8A6)),
  TierInfo('Stern', Color(0xFFF2C94C)),
  TierInfo('Roter Riese', Color(0xFFE2683F)),
  TierInfo('Neutronenstern', Color(0xFFF2ECFF)),
  TierInfo('Nebel', Color(0xFFB06CE0)),
  TierInfo('Galaxie', Color(0xFF7A6CF0)),
  TierInfo('Sternhaufen', Color(0xFFEF7DBB)),
  TierInfo('Quasar', Color(0xFF39D98A)),
  TierInfo('Universum', Color(0xFFEFE7D2)),
];

/// Höchster Rang mit eigenem Namen. Alles darüber ist endlos generisch.
int get maxNamedTier => kTiers.length - 1;

TierInfo tierInfo(int tier) {
  if (tier >= 0 && tier < kTiers.length) return kTiers[tier];
  const beyond = ['Multiversum', 'Singularität', 'Ewigkeit'];
  final over = tier - kTiers.length;
  final name = '${beyond[over % beyond.length]} ${over ~/ beyond.length + 2}';
  final hue = (tier * 53) % 360;
  return TierInfo(name, HSLColor.fromAHSL(1, hue.toDouble(), 0.62, 0.62).toColor());
}
