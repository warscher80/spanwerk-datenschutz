# Kassiersystem – iOS-App (App Store)

Fertiges **Capacitor/Xcode-Projekt** (WKWebView-Hülle), das `kassa.html` offline
bündelt – wie die Android-App, nur für iPhone/iPad.

- App-Name: **Kassiersystem**
- Bundle-ID: `at.spanwerk.kassiersystem`
- iPhone **und** iPad, Hoch- und Querformat
- JS-Dialoge (PIN-Abfrage, Bestätigungen) und `localStorage` funktionieren in der
  WKWebView (von Capacitor nativ bereitgestellt)

> **Warum nicht schon hochgeladen?** Apple erlaubt das Bauen/Signieren/Hochladen von
> iOS-Apps **nur auf einem Mac mit Xcode** und nur mit deinem Apple-Entwickler-Konto.
> Das ist hier (Linux, ohne deine Apple-Schlüssel) technisch nicht möglich. Alles
> andere ist aber vorbereitet – es bleiben nur die Schritte unten am Mac.

## Schritte am Mac (einmalig)

Voraussetzungen: **Mac**, **Xcode**, **Node.js**, **CocoaPods** (`sudo gem install cocoapods`).

```bash
cd kassa-ios
npm install                 # Capacitor-Pakete holen
npx cap sync ios            # Pods installieren + Web-Assets kopieren
open ios/App/App.xcworkspace
```

In Xcode:
1. Target **App** → **Signing & Capabilities** → dein **Team** auswählen
   (automatische Signatur). Bundle-ID bleibt `at.spanwerk.kassiersystem`.
2. In **App Store Connect** die App anlegen: Name „Kassiersystem", Bundle-ID wie oben.
3. Gerät auf **„Any iOS Device"** stellen → **Product → Archive**.
4. Im Organizer **Distribute App → App Store Connect → Upload** (oder **TestFlight**
   für internen Test).
5. Store-Eintrag ausfüllen: Beschreibung, **Screenshots** (iPhone + iPad, Ordner
   `../store/`), **Datenschutz-URL**
   `https://warscher80.github.io/spanwerk-datenschutz/datenschutz.html`,
   Datenschutz-Fragebogen → **keine Datenerfassung**.

> ⚠️ Apple lehnt reine „Web-Apps" gelegentlich nach Regel 4.2 ab. Falls das passiert:
> über **TestFlight** verteilen (intern, keine Prüfung nötig) oder auf dem iPad
> **„Zum Home-Bildschirm"** nutzen (funktioniert voll, inkl. offline).

## App-Inhalt aktualisieren

Wenn sich die Haupt-`kassa.html` ändert, Assets neu einspielen und syncen:

```bash
cd kassa-ios
./sync-assets.sh            # kopiert kassa.html + Assets nach www/
npx cap sync ios           # überträgt sie ins Xcode-Projekt
```

Danach in Xcode **Version/Build erhöhen** (General → Identity) und neu hochladen.
