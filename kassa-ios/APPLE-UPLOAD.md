# Kassiersystem → App Store, OHNE eigenen Mac

Der Build läuft auf einem **macOS-Server von GitHub** und lädt automatisch zu
**TestFlight** hoch (Workflow `.github/workflows/ios-testflight.yml`).

Das Einzige, was **nur du** liefern kannst, ist deine **Apple-Zugangsberechtigung**
als API-Schlüssel – ohne die kann niemand in dein Apple-Konto hochladen. Du bist bei
Apple angemeldet, also sind das nur ein paar Klicks:

## 1) App-Store-Connect-API-Schlüssel erstellen
1. **appstoreconnect.apple.com** → **Users and Access** → Reiter **Integrations**
   (bzw. **Keys**) → **App Store Connect API**.
2. **Generate API Key** → Name z. B. „GitHub Upload", Rolle **App Manager** (oder Admin).
3. Notiere dir:
   - **Issuer ID** (steht über der Liste) → für Secret `ASC_ISSUER_ID`
   - **Key ID** (in der Zeile des Schlüssels) → für Secret `ASC_KEY_ID`
4. **Download API Key** → die Datei `AuthKey_XXXXXX.p8` (nur **einmal** ladbar!).
   Den **kompletten Text** dieser Datei brauchst du für Secret `ASC_API_KEY_P8`.

## 2) Team ID heraussuchen
**developer.apple.com** → **Account** → **Membership** → **Team ID** (10 Zeichen)
→ für Secret `APPLE_TEAM_ID`.

## 3) Die 4 Werte als GitHub-Secrets hinterlegen
GitHub-Repo **warscher80/spanwerk-datenschutz** →
**Settings → Secrets and variables → Actions → New repository secret**.
Lege diese vier an (exakt diese Namen):

| Secret-Name      | Inhalt                                           |
|------------------|--------------------------------------------------|
| `ASC_KEY_ID`     | Key ID aus Schritt 1                             |
| `ASC_ISSUER_ID`  | Issuer ID aus Schritt 1                          |
| `ASC_API_KEY_P8` | **kompletter Inhalt** der `AuthKey_XXXXXX.p8`    |
| `APPLE_TEAM_ID`  | Team ID aus Schritt 2                            |

(Den `.p8`-Inhalt einfach komplett per Copy&Paste einfügen, mit den
`-----BEGIN PRIVATE KEY-----`-Zeilen.)

## 4) Upload starten
GitHub-Repo → Reiter **Actions** → Workflow **„iOS → TestFlight (Kassiersystem)"**
→ **Run workflow**. Der Server baut, signiert und lädt automatisch hoch.
Nach ~15–25 Min erscheint der Build in **App Store Connect → TestFlight**.

> Danach einmalig in App Store Connect: Export-Compliance beantworten
> („verwendet keine nicht-exempte Verschlüsselung" = Nein), dann an interne Tester
> freigeben. Für die öffentliche Veröffentlichung später: Screenshots (`store/`),
> Beschreibung und Datenschutz-URL ergänzen und zur Prüfung einreichen.

---
**Sicherheitshinweis:** Gib den `.p8`-Schlüssel nur als GitHub-Secret ein – niemals in
Chat, Code oder Commits. Du kannst den Schlüssel in App Store Connect jederzeit widerrufen.
Sobald die 4 Secrets gesetzt sind, kann ich den Upload-Lauf für dich starten und bei
Fehlern anhand der Protokolle nachbessern.
