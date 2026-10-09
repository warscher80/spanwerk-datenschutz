# Sommerfest Kassa – in den App Store / Google Play bringen

Die Kasse ist eine **PWA** (installierbare Web-App) und damit die Grundlage für beide Stores.
Fertig vorbereitet im Repo (von Claude erledigt):

- **Icons:** `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
- **`manifest.json`** mit Name, Icons, Kategorien, Beschreibung, `id`, Sprache
- **Offline-Betrieb** über `sw.js` (Service Worker, Cache `kassa-v6`)
- **Datenschutzerklärung:** `datenschutz.html`
  → Live-URL: `https://warscher80.github.io/spanwerk-datenschutz/datenschutz.html`
- **Store-Screenshots:** Ordner `store/`
- **App-URL:** `https://warscher80.github.io/spanwerk-datenschutz/kassa.html`

Store-Eintrag (für beide gleich):
- **Name:** Sommerfest Kassa
- **Kurzbeschreibung:** Kassiersystem für Vereinsfeste – Speisen, Getränke, Pfand, Auswertung.
- **Kategorie:** Business / Produktivität
- **Datenschutz-URL:** siehe oben
- **Daten-Sicherheit / Datenerfassung:** „Es werden keine Daten erfasst/geteilt" (alles lokal)

---

## A) Google Play (empfohlener Start – schnell)

Weg: PWA als **TWA** (Trusted Web Activity) verpacken mit **PWABuilder**.

1. **PWABuilder:** https://www.pwabuilder.com → App-URL eingeben
   `https://warscher80.github.io/spanwerk-datenschutz/kassa.html` → *Start*.
2. **Package For Stores → Android** → *Download*.
   Das ZIP enthält:
   - `app-release-signed.aab` (zum Hochladen)
   - **Signing-Key** (`signing.keystore` + Passwörter) → **GUT AUFHEBEN!** Ohne diesen Key
     kann man später **keine Updates** mehr veröffentlichen.
   - `assetlinks.json`
3. **Digital Asset Links veröffentlichen** (sonst zeigt die App oben eine Browser-Leiste):
   Die `assetlinks.json` muss erreichbar sein unter
   `https://warscher80.github.io/.well-known/assetlinks.json`.
   Da das eine **Projekt-Seite** ist, liegt die Domain-Wurzel in einem **eigenen Repo**:
   - Neues Repo **`warscher80.github.io`** anlegen (GitHub User-Page),
   - darin Datei `.well-known/assetlinks.json` mit dem Inhalt aus dem ZIP ablegen,
   - GitHub Pages für dieses Repo aktivieren.
   (Alternativ: eigene Domain verwenden.)
4. **Play Console:** App anlegen → **Interner Test** (nur eure Tablets) →
   `.aab` hochladen → Store-Eintrag (Name, Beschreibung, Screenshots aus `store/`,
   Datenschutz-URL), **Daten-Sicherheit** ausfüllen (keine Daten), Inhaltseinstufung →
   zum internen Test freigeben.
5. Auf den Tablets über den **Test-Link** installieren.

> Tipp: „Interner Test"/„Geschlossener Test" hält die App privat – sie taucht nicht
> öffentlich im Play Store auf. Für ein Vereins-Werkzeug ist das meist gewünscht.

---

## B) Apple App Store (danach – braucht einen Mac)

Weg: iOS-Paket mit **PWABuilder → iOS** (erzeugt ein Xcode-Projekt mit WebView-Hülle)
oder mit **Capacitor**.

1. PWABuilder → gleiche URL → **Package For Stores → iOS** → *Download*.
2. Projekt **auf einem Mac in Xcode** öffnen, **Team/Bundle-ID** setzen (Apple-Konto),
   `App Icons` prüfen, Build erstellen.
3. Über **Xcode → Organizer** oder **Transporter** nach **App Store Connect** hochladen.
4. In App Store Connect: App-Eintrag, Screenshots (iPhone **und** iPad!),
   Beschreibung, Datenschutz-URL, Datenschutz-Fragebogen (keine Datenerfassung) → zur
   Prüfung einreichen (oder **TestFlight** für internen Test).

> ⚠️ **Risiko bei Apple:** Apps, die „nur eine Website" sind, werden teils nach
> Richtlinie **4.2 (Minimum Functionality)** abgelehnt. Mildern durch: Betonung des
> **Offline-Betriebs** und des echten Werkzeug-Charakters. Falls die öffentliche
> Freigabe scheitert, Alternativen: **TestFlight** (intern), **Apple Business/Custom
> Apps**, oder schlicht **„Zum Home-Bildschirm"** auf dem iPad (funktioniert bereits
> voll, inkl. Offline).

---

## Was NICHT in den Store muss
Für den reinen Fest-Einsatz auf bekannten Tablets reicht **„Zum Home-Bildschirm
hinzufügen"** – eigenes Icon, Vollbild, offline. Der Store lohnt sich v. a., wenn das
Kassensystem an **viele weitere Vereine** verteilt werden soll.
