# Footy Predict ⚽ – Tippspiel auf echte Fußballspiele

Eine Android-App (Flutter), in der du **echte Begegnungen** der Bundesliga & Co. tippst
und **Punkte** sammelst – wie bei Kicktipp. **Kein Echtgeld, kein Konto, keine Werbung.**

> ⚠️ **Tippspiel um Punkte, kein Glücksspiel.** Es gibt keine Einzahlungen und keine
> Geldgewinne. Eine echte Geld-Wett-App bräuchte eine Glücksspiel-/Buchmacher-Lizenz,
> Alters-/Identitätsprüfung und Zahlungsabwicklung und ist ohne diese nicht zulässig.

## Funktionen
- **Echte Spiele** live von [OpenLigaDB](https://www.openligadb.de/) (gratis, ohne API-Key)
- Ligen: **1. Bundesliga, 2. Bundesliga, 3. Liga**, Spieltag-für-Spieltag durchblättern
- Pro Spiel einen **Ergebnis-Tipp** abgeben (Heim:Auswärts)
- **Punkte-System** (Kicktipp-Stil): Volltreffer 5 · Tordifferenz 3 · Tendenz 2
- Nach Spielende automatischer **Abgleich mit dem echten Endstand** + Punkte
- Tipps werden **nur lokal** gespeichert (kein Server, kein Tracking)
- Vereinslogos, Anstoßzeiten, „Zum Aktualisieren ziehen"

## Projektaufbau (Flutter)
```
lib/
  main.dart      – Oberfläche (Spieltag, Tipp-Eingabe, Punkte)
  api.dart       – echte Spieldaten von OpenLigaDB
  engine.dart    – Punkte-Auswertung (reine Logik)
  store.dart     – lokale Speicherung der Tipps
test/
  widget_test.dart – Tests der Punkte-Logik
```

## APK selbst bauen

### Per GitHub Actions (einfachster Weg)
Bei jedem Push baut der Workflow **„APK bauen"** automatisch einen Release-APK.
Unter **Actions → APK bauen → Artifacts → `footy-predict-apk`** herunterladen.
Kann auch manuell über *Run workflow* gestartet werden.

### Lokal
Voraussetzungen: [Flutter SDK](https://docs.flutter.dev/get-started/install) (stable),
Android SDK, JDK 17.

```bash
flutter pub get
flutter test            # Punkte-Logik prüfen
flutter build apk --release
# Ergebnis: build/app/outputs/flutter-apk/app-release.apk
```

Auf ein Gerät bringen:

```bash
flutter install            # bei angeschlossenem Gerät
# oder die .apk aufs Handy kopieren und „aus unbekannter Quelle" installieren
```

> Hinweis: Der Release-APK wird standardmäßig mit dem **Debug-Schlüssel** signiert –
> ideal zum Sideloaden auf dein eigenes Gerät. Für den Play Store müsste ein eigener
> Release-Keystore eingerichtet werden.

---
Die Datei `index.html` im Repo-Root ist die separat gehostete Datenschutzerklärung.
