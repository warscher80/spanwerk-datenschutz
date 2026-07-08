# Terra 🌿

Ein Habit-Tracker als lebendiges, sich selbst erhaltendes Mikro-Ökosystem im Glas.

Statt einer einzelnen Pflanze oder eines Haustiers kultivierst du ein **geschlossenes
Ökosystem**, in dem **jedes Habit ein eigenes Lebewesen** ist. Erledigst du ein Habit
konsequent, gedeiht sein Wesen; vernachlässigst du es, verkümmert es sichtbar – und
weil es ein Ökosystem ist, wirkt sich anhaltende Vernachlässigung auf die Nachbarn aus.
So wird Life-Balance visuell greifbar.

## Kernidee

- **Spezies pro Habit:** Moos, Farn, Leuchtpilz, Wasserlinse, Schnecke, Käfer, Glühwürmchen.
- **Wachstum & Verkümmern:** kontinuierliche Vitalität (0–1) pro Lebewesen.
- **Nachbar-Effekt:** Kreaturen sind an den Zustand der Pflanzen gekoppelt; ein
  verkümmerter Boden verdunkelt sich.
- **Einzigartigkeit:** Komposition aus einem aus Nutzerdaten abgeleiteten Seed →
  jedes Terrarium ist visuell einmalig.
- **Tag/Nacht-Zyklus** nach Gerätezeit: Licht, Farbstimmung und Aktivität ändern sich;
  nachts leuchten Pilze und Glühwürmchen, es erscheinen Mond und funkelnde Sterne,
  zur Dämmerung ein warmes Horizontglühen.
- **Atmosphäre:** diffuser Lichtschacht, schwebende Sporen, Bodennebel, Kiesel,
  Tiefen-Silhouetten, Kondenströpfchen und Glasreflexe – „screensaver-schön".
- **Antippbar:** Tippt man ein Lebewesen an, zeigt ein Schildchen, zu welchem
  Habit es gehört (Spezies, Vitalität, Streak).

## Architektur

Feature-first, klare Trennung `data` / `domain` / `presentation`:

```
lib/
  core/                     Theme, Router, PremiumGate (Platzhalter)
  features/
    ecosystem/
      domain/               Organism, EcosystemState, Species,
                            computeEcosystem() (REINE Funktion), DayNight
      presentation/         TerrariumView + CustomPainter (Glas, Boden,
                            Partikel, animierte Lebewesen), Provider
    habits/
      data/                 Drift-DB + Repository
      domain/               Habit, HabitCompletion
      presentation/         Habit-Edit-Screen, Provider
    home/
      presentation/         Home-Screen (Terrarium groß + Habit-Leiste)
```

### Offline-first & Zustandsberechnung

- Kein Server, keine Cloud, keine laufenden Kosten – alles lokal (Drift/SQLite).
- Der Ökosystem-Zustand wird beim App-Start (und bei App-Resume) per
  **Timestamp-Delta** neu berechnet: aus `(now - lastUpdatedAt)` ergibt sich
  Wachstum bzw. Verkümmern. Kein Background-Service.
- Der Kern ist eine **reine, deterministische** Funktion:
  `computeEcosystem(previousState, completions, now) -> newState`
  (siehe `lib/features/ecosystem/domain/compute_ecosystem.dart`).

## Tech-Stack

Riverpod · Drift (SQLite) · go_router · CustomPainter + AnimationController.

## Entwicklung

```bash
flutter pub get
dart run build_runner build      # Drift-Codegen (database.g.dart)
flutter test                     # inkl. Kernlogik- und Smoke-Test
flutter run                      # Android (Ziel) / iOS-kompatibel
```

## Tests

- `test/compute_ecosystem_test.dart` – reine Kernlogik: Decay über Zeit,
  Wachstum bei Erledigung, Nachbar-Effekt, 0/1-Deckelung.
- `test/habit_repository_test.dart` – Integration der Data-Schicht mit echter
  In-Memory-Drift-DB: Habit/Organismus anlegen, gedeihen, verkümmern,
  Persistenz, Löschen.
- `test/terrarium_layout_test.dart` – deterministische Komposition und
  Tap-Trefferlogik des Terrariums.

Die UI-Schicht (Screens, `CustomPainter`, Provider) ist über `flutter analyze`
vollständig typgeprüft.

## Roadmap (nicht in v1)

Nur strukturell vorgesehen über `PremiumGate` (kein Payment-Backend, Store
übernimmt): seltene Spezies, weitere Biome (Wüste, Regenwald, Alpin),
Ambient-Sounds, Notifications, Statistiken.
