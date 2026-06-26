# Preisschmiede – Kalkulations-App für Metallbau

Intelligente Kalkulations-App für Metallbaubetriebe. Berechnet aus wenigen
Eingaben Material, Arbeitszeiten und Verkaufspreis, erzeugt fertige Angebote
und lernt aus jeder Nachkalkulation dazu.

**Alles läuft offline. Alle Daten bleiben lokal auf dem Gerät.**

## Die App benutzen (am einfachsten)

Einfach `index.html` im Browser öffnen – fertig. Funktioniert am Computer,
Tablet und Handy, auch ohne Internet.

## Android-App (APK) installieren

Die App gibt es auch als installierbare Android-App. So kommst du an die APK:

1. Auf GitHub oben auf **„Releases“** tippen (oder direkt:
   `https://github.com/warscher80/spanwerk-datenschutz/releases`).
2. Beim Release **„Preisschmiede – aktuelle App“** die Datei **`preisschmiede.apk`**
   auf dem Handy herunterladen.
3. Die heruntergeladene Datei öffnen und auf **Installieren** tippen.
4. Erscheint „Installation blockiert“: einmalig **„Aus dieser Quelle zulassen“**
   für den Browser erlauben, dann nochmal auf Installieren.

> Hinweis: Es ist ein Test-Build (Debug-APK) zum direkten Installieren –
> nicht über den Play Store. Für die Play-Store-Veröffentlichung wird später
> eine signierte Version erstellt.

## Wie die APK gebaut wird

Bei jeder Änderung baut GitHub automatisch eine neue APK (siehe
`.github/workflows/android.yml`) und legt sie als Release ab. Es muss also
nichts manuell gebaut werden.

Technisch: Die statische Web-App im Projekt-Root wird mit
[Capacitor](https://capacitorjs.com/) in eine native Android-App verpackt
(`scripts/copyweb.mjs` → `www/` → `cap sync` → Gradle-Build).

## Funktionen (Kurzüberblick)

- **Stammdaten:** Stundensätze, Maschinenstundensätze, Zuschläge, Gewinn, Firmendaten
- **Materialdatenbank:** Preise, Lieferanten, Preishistorie, Lagerbestand, Verschnitt
- **Produktkonfigurator:** Geländer, Treppe, Balkon, Zaun, Stahlbau, Edelstahlbau,
  Sonderkonstruktion, Serienteil, Reparatur/Wartung
- **Automatische Zeit- & Preiskalkulation** inkl. Maschinenkosten
- **Angebotsgenerator** mit druckbarem PDF-Angebot
- **Nachkalkulation** mit Soll-/Ist-Vergleich
- **Selbstlernende KI** – segmentiert nach Produkt × Werkstoff × Größe
