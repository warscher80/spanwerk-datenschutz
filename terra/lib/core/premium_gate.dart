/// Platzhalter für spätere Freemium-Logik (One-Time-Unlock via in_app_purchase
/// für seltene Spezies / weitere Biome / Ambient-Sounds).
///
/// v1: alles frei. KEIN Payment-Backend – der Store übernimmt später die
/// Transaktion. Diese Klasse existiert nur, damit Aufrufstellen bereits sauber
/// gaten können, ohne dass v1 Monetarisierung enthält.
class PremiumGate {
  const PremiumGate();

  /// In v1 immer true. Später an den tatsächlichen Kaufstatus gebunden.
  bool get isPremiumUnlocked => true;

  /// Ob ein Feature aktuell freigeschaltet ist.
  bool isFeatureUnlocked(PremiumFeature feature) => true;
}

/// Zukünftige, kostenpflichtige Features (nur strukturell vorgesehen).
enum PremiumFeature {
  rareSpecies,
  additionalBiomes,
  ambientSounds,
}
