# Kickbet ⚽ – Fußball-Wett-App (Spielgeld)

Eine kleine Android-App zum Tippen auf Fußballspiele – **komplett mit Spielgeld**,
ohne echte Einsätze, ohne Konto, ohne Internet. Alles läuft offline; der Spielstand
bleibt lokal auf dem Gerät.

> ⚠️ **Nur zur Unterhaltung, ab 18.** Es werden keine echten Gewinne ausgezahlt und
> keine echten Einzahlungen verarbeitet. Eine echte Geld-Wett-App benötigt eine
> Glücksspiel-Lizenz, Alters-/Identitätsprüfung und ist ohne diese im Play Store nicht zulässig.

## Funktionen
- Startguthaben **1.000 Coins**
- Spiele mit Quoten für **Heim / Remis / Gast** (1 / X / 2)
- **Tippschein**: mehrere Tipps zu einer Kombiwette bündeln, Gesamtquote & möglicher Gewinn
- Schnell-Einsätze (10 / 50 / 100 / Max)
- Realistische Simulation des Spielausgangs anhand der Quoten
- **Verlauf** der letzten Wetten mit Ergebnissen
- Konto jederzeit zurücksetzbar
- Speicherung nur **lokal** (WebView-Storage) – keine Server, kein Tracking, keine Werbung

## Aufbau
- Native Android-Hülle (Kotlin, `MainActivity`) mit einem WebView
- Die gesamte Spiel-Logik liegt offline in `app/src/main/assets/` (`index.html`, `style.css`, `app.js`)

## APK selbst bauen

### Per GitHub Actions (einfachster Weg)
Bei jedem Push auf diesen Branch baut der Workflow **„APK bauen"** automatisch einen
Debug-APK. Unter **Actions → APK bauen → Artifacts → `kickbet-debug-apk`** herunterladen.
Lässt sich auch manuell über *Run workflow* starten.

### Lokal
Voraussetzungen: JDK 17, Android SDK (Platform 35, Build-Tools 35).

```bash
./gradlew assembleDebug
# Ergebnis: app/build/outputs/apk/debug/app-debug.apk
```

APK auf ein Gerät bringen (USB-Debugging aktiv):

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

Oder die `.apk` direkt aufs Handy kopieren und „aus unbekannter Quelle" installieren.

---
Die Datei `index.html` im Repo-Root ist die separat gehostete Datenschutzerklärung.
