# Sommerfest Kassa – in die App Stores bringen

Die Kasse gibt es in zwei Formen:
1. **Web-App (PWA)** unter `https://warscher80.github.io/spanwerk-datenschutz/kassa.html`
   – installierbar über „Zum Home-Bildschirm", offline, selbst-aktualisierend.
2. **Native Android-App** (`kassa-android/`) – als **fertige Dateien schon gebaut**:
   - `Kassiersystem-1.0.apk` → direkt auf Android installieren (Sideload)
   - `Kassiersystem-1.0.aab` → in der **Google Play Console** hochladen

Beide liegen im Projektwurzelverzeichnis und sind über GitHub herunterladbar.

Store-Eintrag (für beide Stores):
- **Name:** Kassiersystem
- **Kurzbeschreibung:** Kassiersystem für Vereinsfeste – Speisen, Getränke, Pfand, Auswertung.
- **Kategorie:** Business / Produktivität
- **Datenschutz-URL:** `https://warscher80.github.io/spanwerk-datenschutz/datenschutz.html`
- **Daten-Sicherheit:** „Es werden keine Daten erfasst/geteilt" (alles lokal auf dem Gerät)
- **Screenshots:** Ordner `store/`

---

## A) Google Play (die `.aab` ist fertig – nur noch hochladen)

Die native App ist bereits gebaut und signiert (`at.spanwerk.sommerfestkassa`, v1.0).
Du musst sie nur in deinem Play-Konto hochladen:

1. **Play Console** → *App erstellen* → Name „Kassiersystem", App, kostenlos.
2. **Play App Signing** aktiviert lassen (empfohlen) – Google verwaltet den
   Verteil-Schlüssel, die vorhandene Signatur dient als Upload-Key.
3. **Release → Interner Test** (nur eure Tablets, nicht öffentlich) → *Neues Release* →
   `Kassiersystem-1.0.aab` **hochladen**.
4. Store-Eintrag ausfüllen: Beschreibung (oben), **Screenshots** aus `store/`,
   **Datenschutz-URL** (oben).
5. **Fragebögen:** Inhaltseinstufung + **Daten-Sicherheit** → „keine Datenerfassung".
   (Die App hat keine Internet-Berechtigung.)
6. Zum internen Test **freigeben** → Test-Link an die Tablets schicken, installieren.

> Direkt-Variante ohne Play: `Kassiersystem-1.0.apk` auf dem Tablet öffnen
> (Quelle „Unbekannte Apps" erlauben) → installiert sofort.

Signatur-Fingerprint (SHA-256), falls Play danach fragt:
`58:36:CF:0A:71:B6:B5:69:ED:B0:DB:4C:2B:88:76:BE:B4:83:B0:31:AF:CA:6E:48:48:69:3F:73:09:60:76:D5`

---

## B) Apple App Store (braucht einen Mac)

Für iOS kann ich hier **keinen Build erzeugen** (Apple-Builds gehen nur am Mac mit Xcode).
Weg:

1. **PWABuilder** (https://www.pwabuilder.com) → URL
   `https://warscher80.github.io/spanwerk-datenschutz/kassa.html` → **Package For Stores → iOS**.
2. Projekt **am Mac in Xcode** öffnen, **Team/Bundle-ID** setzen, Build erstellen.
3. Über **Xcode/Transporter** nach **App Store Connect** hochladen; Screenshots
   (iPhone **und** iPad), Datenschutz-URL, Datenschutz-Fragebogen (keine Erfassung).

> ⚠️ Apple lehnt reine „Web-Apps" teils nach Regel 4.2 ab. Mildern über Betonung des
> Offline-Betriebs; Alternativen: **TestFlight** (intern), Apple Business/Custom Apps,
> oder auf iPad schlicht **„Zum Home-Bildschirm"** (funktioniert voll, inkl. offline).

---

## Hinweis Signatur-Key
Der Signatur-Key liegt – wie bei den anderen Apps dieses Repos – im Projekt
(`kassa-android/app/spanwerk-release.jks`). Für Google Play ist **Play App Signing**
empfohlen; der hier enthaltene Key ist dann nur der Upload-Key.
