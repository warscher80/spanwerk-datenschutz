# Footy Predict ⚽ – Tippspiel mit lernenden Quoten

Eine Android-App (Flutter), in der du **echte Spiele** aus Deutschland, Österreich und
England tippst, **faire Quoten** siehst und **Punkte** sammelst. **Kein Echtgeld, kein
Konto, keine Werbung.** Die App bleibt automatisch am neuesten Stand und ihre Quoten
**lernen aus jedem echten Ergebnis dazu**.

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
- **Lernende 1/X/2-Quoten:** ein Elo-Modell schätzt die Teamstärken aus echten
  Resultaten – je mehr Spiele einfließen, desto genauer die Quoten
- **Immer aktuell:** automatische Aktualisierung alle 60 s, beim App-Start und beim
  Zurückkehren in die App; Sprung auf den nächsten anstehenden Spieltag
- Pro Spiel einen **Ergebnis-Tipp**; **Punkte** wie bei Kicktipp
  (Volltreffer 5 · Tordifferenz 3 · Tendenz 2) mit automatischem Abgleich
- Hintergrund-**Lernfortschritt** sichtbar, Status „aktualisiert HH:MM"
- Alles **nur lokal** gespeichert (kein Server, kein Tracking)

## Wie die Quoten „dazulernen"
1. Beim Öffnen einer Liga lädt die App im Hintergrund die bisherigen Spieltage.
2. Jedes echte Ergebnis aktualisiert die Elo-Ratings der beiden Teams
   (Heimvorteil + Gewichtung nach Tordifferenz).
3. Aus dem Rating-Unterschied werden Sieg-/Remis-/Niederlage-Wahrscheinlichkeiten
   und daraus faire Quoten (inkl. kleiner Marge) berechnet.
4. Ratings und bereits verarbeitete Spiele werden lokal gespeichert – die App
   „vergisst" nicht und wird mit der Zeit treffsicherer.

## Projektaufbau (Flutter)
```
lib/
  main.dart    – Oberfläche (Ligen, Spieltag, Tipps, Quoten, Auto-Update)
  api.dart     – echte Spieldaten (TheSportsDB)
  odds.dart    – lernendes Elo-Quoten-Modell + Hintergrund-Lerner
  engine.dart  – Punkte-Auswertung (reine Logik)
  store.dart   – lokale Speicherung (Tipps + Lerndaten)
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

> Hinweis: Der Release-APK wird mit dem Debug-Schlüssel signiert (ideal zum Sideloaden
> aufs eigene Gerät). Für den Play Store wäre ein eigener Release-Keystore nötig.
>
> Datenquelle: TheSportsDB mit öffentlichem Gratis-Test-Key. Bei sehr starker Nutzung
> kann ein eigener (kostenpflichtiger) Key sinnvoll sein.

---
Die Datei `index.html` im Repo-Root ist die separat gehostete Datenschutzerklärung.
