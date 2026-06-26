# KickProphet 🔮⚽ – Tippspiel mit lernenden Quoten

Tippe **echte Spiele** aus Deutschland, Österreich und England, sieh **faire Quoten**
und sammle **Punkte**. Die Quoten **lernen aus jedem echten Ergebnis dazu**, und die App
bleibt automatisch am neuesten Stand. **Kein Echtgeld, kein Konto, keine Werbung.**

> ⚠️ **Tippspiel um Punkte, kein Glücksspiel.** Keine Einzahlungen, keine Geldgewinne.
> Die Quoten sind ein berechnetes Stärke-Modell, keine Buchmacher-Wettangebote.

## Ligen (1. + 2. Liga je Land)
| Land | 1. Liga | 2. Liga |
|------|---------|---------|
| 🇩🇪 Deutschland | 1. Bundesliga | 2. Bundesliga |
| 🇦🇹 Österreich | Bundesliga | 2. Liga |
| 🇬🇧 England | Premier League | Championship |

## Funktionen
- **Echte Spiele, Wappen, Anstoßzeiten & Ergebnisse** via [TheSportsDB](https://www.thesportsdb.com/)
- **Lernende 1/X/2-Quoten** (Elo-Modell): Teamstärke aus echten Resultaten, je mehr
  Spiele, desto genauer; Favorit pro Spiel hervorgehoben
- **Immer aktuell:** Auto-Refresh alle 60 s, beim App-Start und beim Zurückkehren;
  Sprung auf den nächsten anstehenden Spieltag
- **Ergebnis-Tipps** mit Punkte-System (Volltreffer 5 · Tordifferenz 3 · Tendenz 2)
- **🔮 Auto-Tipp:** offene Spiele mit einem Tipp aus der Modell-Prognose füllen
- **„Meine Saison":** Gesamtpunkte, Volltreffer-Quote, Ø Punkte/Tipp und
  **Modell-Treffsicherheit** (wie oft die Prognose richtig lag)
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

Poisson-/Dixon-Coles- und Blend-Modelle wurden gegengetestet, brachten aber keinen
Mehrwert gegenüber dem getunten Elo-Modell. Die angezeigte **Modell-Treffsicherheit**
in „Meine Saison" misst nur Vorhersagen der laufenden Saison.

## Projektaufbau (Flutter)
```
lib/
  main.dart    – Oberfläche (Ligen, Spieltag, Tipps, Quoten, Statistik, Auto-Update)
  api.dart     – echte Spieldaten (TheSportsDB)
  odds.dart    – lernendes Elo-Quoten-Modell + Hintergrund-Lerner + Auto-Tipp
  engine.dart  – Punkte-Auswertung (reine Logik)
  store.dart   – lokale Speicherung (Tipps, Lerndaten, Ergebnisse, Modell-Statistik)
assets/icon/   – Quellbilder fürs App-Icon
test/          – Tests für Punkte- und Quoten-Logik
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
