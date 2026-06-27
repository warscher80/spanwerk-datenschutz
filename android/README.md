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

Die zum Download bereitgestellte `Maschinenstundensatz-1.0.apk` im
Projektwurzelverzeichnis ist eine Debug-Build dieser App.
