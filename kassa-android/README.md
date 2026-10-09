# Sommerfest Kassa – Android-App

Native **WebView-Hülle**, die `kassa.html` offline bündelt. Läuft komplett ohne
Internet, **keine Internet-Berechtigung**, kein Tracking – alle Kassendaten bleiben
im App-Speicher auf dem Gerät.

- Paket: `at.spanwerk.sommerfestkassa`
- Signatur: `app/spanwerk-release.jks` (Alias `spanwerk`, wie die anderen Spanwerk-Apps)
- Kein Selbst-Updater (Play-konform; Updates laufen über Play bzw. neue APK)

## Fertige Artefakte (bereits gebaut)

- `Sommerfest-Kassa-1.0.apk` (Projektwurzel) → zum **direkten Installieren** (Sideload)
- `Sommerfest-Kassa-1.0.aab` (Projektwurzel) → zum **Hochladen in die Google Play Console**

## App-Inhalt aktualisieren

Wenn sich die Haupt-`kassa.html` (oder Logos/`qrcode.js`) im Projektwurzelverzeichnis
ändert, die Kopien in `app/src/main/assets/` ebenfalls aktualisieren und neu bauen:

```bash
# alle von kassa.html referenzierten Dateien ins Asset-Verzeichnis spiegeln
cp ../kassa.html ../qrcode.js ../manifest.json ../sommerfest-logo.png \
   ../fsgl-logo.svg ../scl-logo.png ../scl-emblem.png ../icon-192.png \
   app/src/main/assets/
```

## Bauen

Voraussetzungen: JDK 17+, Android SDK (Platform 34, Build-Tools 34.0.0).
`local.properties` mit `sdk.dir=/pfad/zum/android-sdk` anlegen.

```bash
cd kassa-android
gradle :app:assembleRelease     # signierte APK  -> app/build/outputs/apk/release/app-release.apk
gradle :app:bundleRelease       # AAB für Play   -> app/build/outputs/bundle/release/app-release.aab
```

## Neue Version veröffentlichen

1. `app/build.gradle`: `versionCode` **erhöhen** (Play verlangt bei jedem Upload eine
   höhere Zahl) und `versionName` anpassen.
2. Assets aktualisieren (siehe oben), falls die HTML geändert wurde.
3. `assembleRelease` + `bundleRelease` bauen.
4. APK/AAB als `Sommerfest-Kassa-<versionName>.apk/.aab` ablegen und die neue AAB in der
   Play Console hochladen.

> Hinweis: Der Signatur-Key liegt – wie bei den anderen Apps dieses Repos – mit im
> Projekt. Für Google Play wird empfohlen, **Play App Signing** zu aktivieren (Google
> verwaltet dann den Verteil-Schlüssel; die hier enthaltene Signatur ist der Upload-Key).
