# Zeiterfassung – Android-App

Eigenständige App (kein Spanwerk-Branding) zur **Zeiterfassung für die
Nachkalkulation**. WebView-Wrapper um `zeiterfassung.html`. Läuft komplett
offline; alle erfassten Zeiten bleiben lokal auf dem Gerät.

- Package / App-ID: `at.nachkalkulation.zeiterfassung`
- App-Name: **Zeiterfassung**
- minSdk 26 (Android 8+), targetSdk 34

## App-Inhalt aktualisieren

Die Oberfläche liegt in `app/src/main/assets/zeiterfassung.html`. Sie ist eine
Kopie der `zeiterfassung.html` im Projektwurzelverzeichnis. Nach Änderungen an
der Wurzel-Datei diese Kopie ebenfalls aktualisieren, dann neu bauen.

## Bauen ohne lokales SDK (empfohlen): GitHub Actions

Die APK wird automatisch in der Cloud gebaut – du brauchst kein Android-SDK.

**Variante A – einfach testen:** Auf GitHub unter *Actions* den Workflow
„Zeiterfassung APK bauen" öffnen → *Run workflow*. Nach ein paar Minuten liegt
die fertige APK unter dem Lauf als *Artifact* zum Download bereit.

**Variante B – Version veröffentlichen (mit Auto-Update):**

1. In `app/build.gradle` `versionCode` **erhöhen** und `versionName` anpassen
   (z. B. `versionCode 2`, `versionName "1.1"`).
2. Falls die HTML geändert wurde: Wurzel-`zeiterfassung.html` nach
   `app/src/main/assets/` kopieren.
3. Einen passenden Tag pushen, z. B.:
   ```bash
   git tag zeiterfassung-v1.1
   git push origin zeiterfassung-v1.1
   ```
4. Der Workflow baut die signierte APK, erstellt ein **GitHub-Release** mit der
   Datei `Zeiterfassung-<versionName>.apk` und aktualisiert automatisch
   `zeiterfassung-version.json` im Projektwurzelverzeichnis.

Beim nächsten Start einer älteren installierten App erscheint dann das Update.

## Automatische Updates

Die App prüft beim Start `zeiterfassung-version.json` (im
Projektwurzelverzeichnis, über GitHub Pages erreichbar) und vergleicht den
`versionCode` mit dem der installierten App. Ist online ein höherer
`versionCode` hinterlegt, bietet die App das Update an, lädt die APK von der
dort genannten `apkUrl` und startet die Installation.

**Wichtig:** Alle Builds werden mit demselben Schlüssel
(`app/zeiterfassung-release.jks`) signiert, sonst verweigert Android das
Drüber-Installieren. Der Build in GitHub Actions nutzt genau diesen Schlüssel.

## Lokal bauen (optional, falls SDK vorhanden)

Voraussetzungen: JDK 17+, Android SDK (Platform 34, Build-Tools 34.0.0),
Gradle 8.9+. `local.properties` mit `sdk.dir=/pfad/zum/android-sdk` anlegen.

```bash
cd zeiterfassung-android
gradle assembleRelease
# Ergebnis: app/build/outputs/apk/release/app-release.apk
```
