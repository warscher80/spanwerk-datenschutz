# KickProphet 🔮⚽ – Prognosen mit lernendem Stärke-Modell

Sieh für **echte Spiele**, wer gewinnt – mit einer Sicherheit in Prozent. Das Modell
**lernt aus jedem echten Ergebnis dazu**, und die App bleibt automatisch am neuesten
Stand. **Kein Echtgeld, kein Konto, keine Werbung.**

> ⚠️ **Prognose-App, kein Glücksspiel.** Keine Einzahlungen, keine Geldgewinne, keine
> Wettangebote. Die Wahrscheinlichkeiten stammen aus einem berechneten Stärke-Modell.

> ℹ️ Bis Version 1.5 war KickProphet ein Tippspiel mit Punkten (Volltreffer 5 ·
> Tordifferenz 3 · Tendenz 2). Seit **v1.6.0** ist es eine reine Prognose-App –
> Tippen, Punkte und „Meine Saison" gibt es nicht mehr.

## Wettbewerbe
| Land | Wettbewerbe |
|------|-------------|
| 🏆 International | WM 2026 (Gruppen + K.o.) |
| 🇩🇪 Deutschland | 1. Bundesliga · 2. Bundesliga |
| 🇦🇹 Österreich | Bundesliga · 2. Liga |
| 🇬🇧 England | Premier League · Championship |
| 🇮🇹 Italien | Serie A |
| 🇪🇸 Spanien | La Liga |
| 🇫🇷 Frankreich | Ligue 1 |

## Funktionen
- **Echte Spiele, Wappen, Anstoßzeiten & Ergebnisse** via [TheSportsDB](https://www.thesportsdb.com/)
- **Lernendes 1/X/2-Modell** (Elo): Teamstärke aus echten Resultaten, je mehr
  Spiele, desto genauer; klare Ansage „wer gewinnt" samt Sicherheit in Prozent
- **Ansicht „Aktuell":** alle anstehenden Spiele über sämtliche Wettbewerbe hinweg
- **WM-Titelchancen** per Monte-Carlo-Simulation und **Turnierbaum**
- **Tor-Alarm** während laufender Spiele
- **Erinnerung** vor dem Anpfiff des nächsten Spiels
- **Immer aktuell:** stille Aktualisierung im Vordergrund, beim App-Start und beim
  Zurückkehren; Sprung auf den nächsten anstehenden Spieltag
- **Modell-Treffsicherheit:** wie oft die Prognose der laufenden Saison richtig lag
- Eigenes **App-Icon** (leuchtender Ball) als Adaptive Icon
- Alles **nur lokal** gespeichert (kein Server, kein Tracking)

## Wie die Quoten „dazulernen"
1. Beim Öffnen einer Liga lädt die App im Hintergrund zuerst die **Vorsaison als
   Startwissen**, dann die laufende Saison.
2. Vor dem Lernen sagt das Modell jedes Spiel voraus (für die Treffsicherheit),
   danach aktualisiert das echte Ergebnis die Elo-Ratings beider Teams
   (Heimvorteil + Gewichtung nach Tordifferenz).
3. Aus dem Rating-Unterschied entstehen Sieg-/Remis-/Niederlage-Wahrscheinlichkeiten
   und daraus faire Quoten (inkl. kleiner Marge).
4. Ratings, verarbeitete Spiele und Ergebnisse werden lokal gespeichert. Bei jedem
   Start und bei jeder Rückkehr in die App werden **neue Ergebnisse nachgelernt** –
   abgeschlossene Spieltage werden dabei nicht erneut geladen.

### Genauigkeit (datenbasiert getunt)
Die Modell-Parameter wurden per **Walk-Forward-Backtest** über 5 Ligen und 2 Saisons
(echte Ergebnisse, nur Vergangenheit → Vorhersage → dann lernen) optimiert:

| Modell | Trefferquote (1/X/2) | LogLoss |
|--------|----------------------|---------|
| vorher (ungetunt) | 45,9 % | 1,066 |
| **jetzt (getunt + Vorsaison-Seed)** | **47,3 %** | **1,045** |

**Getestet & verworfen** (kein messbarer Mehrwert bzw. leicht schlechter, daher
bewusst nicht eingebaut): Poisson/Dixon-Coles, Elo-Poisson-Blend, zwei Vorsaisons
als Seed, getrennte Heim-/Auswärts-Ratings, pro-Team-Heimvorteil, Wahrscheinlichkeits-
Kalibrierung (Logistik-Divisor) und Prior-Blend. Das schlanke, getunte Elo-Modell mit
einer Vorsaison bleibt das beste.

Die angezeigte **Modell-Treffsicherheit** in „Meine Saison" misst nur Vorhersagen der
laufenden Saison.

## Projektaufbau (Flutter)
```
lib/
  main.dart    – Oberfläche (Wettbewerbe, Spieltag, Prognosen, Statistik, Auto-Update)
  api.dart     – echte Spieldaten (TheSportsDB) inkl. Kurzzeit-Cache
  odds.dart    – lernendes Elo-Modell, Hintergrund-Lerner, Monte-Carlo-Simulation
  engine.dart  – Ausgang eines Spiels (1/X/2), reine Logik
  store.dart   – lokale Speicherung (Lerndaten, Ergebnisse, Modell-Statistik)
  notify.dart  – Erinnerungen und Tor-Alarm
  update.dart  – Prüfung auf neuere App-Version
assets/icon/   – Quellbilder fürs App-Icon
test/          – Tests für Spieldaten-Auswertung, Cache und Modell-Logik
```

## APK selbst bauen
### Per GitHub Actions
Bei jedem Push baut der Workflow **„APK bauen"** einen Release-APK.
Unter **Actions → APK bauen → Artifacts → `footy-predict-apk`** herunterladen.

### Lokal
Voraussetzungen: [Flutter SDK](https://docs.flutter.dev/get-started/install) (stable),
Android SDK, JDK 17.
```bash
flutter pub get
flutter test
flutter build apk --release
# Ergebnis: build/app/outputs/flutter-apk/app-release.apk
```

> Hinweise: Der Release-APK wird mit dem Debug-Schlüssel signiert (ideal zum Sideloaden
> aufs eigene Gerät; für den Play Store wäre ein eigener Keystore nötig). Datenquelle ist
> TheSportsDB mit öffentlichem Gratis-Test-Key.

---
Die Datei `index.html` im Repo-Root ist die separat gehostete Datenschutzerklärung.
