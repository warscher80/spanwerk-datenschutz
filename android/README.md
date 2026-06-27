# Maschinenstundensatz – Android-App

WebView-Wrapper, der `maschinenstundensatz.html` bündelt. Läuft komplett
offline, benötigt keine Berechtigungen (kein Internet, kein Speicherzugriff).

## App-Inhalt aktualisieren

Die HTML-Datei liegt unter `app/src/main/assets/maschinenstundensatz.html`.
Bei Änderungen an der Haupt-`maschinenstundensatz.html` im Projektwurzelverzeichnis
diese Kopie ebenfalls aktualisieren, dann neu bauen.

## Bauen

Voraussetzungen: JDK 17+, Android SDK (Platform 34, Build-Tools 34.0.0).
`local.properties` mit `sdk.dir=/pfad/zum/android-sdk` anlegen.

```bash
cd android
gradle :app:assembleDebug      # Debug-APK (zum Sideloading signiert)
# Ergebnis: app/build/outputs/apk/debug/app-debug.apk
```

Die zum Download bereitgestellte `Maschinenstundensatz-<version>.apk` im
Projektwurzelverzeichnis ist eine Debug-Build dieser App.

## Automatische Updates

Die App prüft beim Start `version.json` (im Projektwurzelverzeichnis, via GitHub
Pages erreichbar) und vergleicht den `versionCode` mit dem der installierten App.
Ist online ein höherer `versionCode` hinterlegt, bietet die App das Update an,
lädt die APK von der dort genannten `apkUrl` und startet die Installation.

### Neue Version veröffentlichen

1. `app/build.gradle`: `versionCode` (Ganzzahl) **erhöhen** und `versionName` anpassen.
2. Falls die HTML geändert wurde: `maschinenstundensatz.html` nach
   `app/src/main/assets/` kopieren.
3. APK bauen (siehe oben) und als `Maschinenstundensatz-<versionName>.apk` ins
   Projektwurzelverzeichnis legen und committen.
4. `version.json` aktualisieren: `versionCode`, `versionName`, `apkUrl` (auf die
   neue Datei), optional `notes`. Committen und nach `main` pushen.

Beim nächsten Start einer älteren installierten App erscheint dann das Update.
Wichtig: Alle Builds müssen mit demselben Signatur-Key signiert sein, sonst
verweigert Android das Update (dann ist vorher Deinstallieren nötig).
