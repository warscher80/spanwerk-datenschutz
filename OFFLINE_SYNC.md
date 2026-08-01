# Offline-Synchronisationskern (Phase 14A)

Technischer Kern für neustartfeste Offline-Erfassung und exakt-einmalige
Übernahme in die zentrale Datenhaltung. **Keine reine In-Memory-Haltung**: jeder
Datensatz wird sofort dauerhaft gespeichert. **Ehrlich:** kein echter Server –
Zielspeicher der Synchronisation ist die bestehende zentrale `Store`-db des
aktiven Mandanten; Offline-Daten gelten dabei als *nicht vertrauenswürdig* und
werden erneut validiert.

## Bausteine

| Datei | Rolle |
|---|---|
| `assets/js/sync.js` | reine, testbare Logik (Ereignisse, Idempotenz, Queue, Retry, Konflikte, Zeitdrift, Ein-Timer-Garantie) |
| `assets/js/offlinedb.js` | versionierter, dauerhafter Speicher: **IndexedDB** (http/s) mit **localStorage-Fallback** (u. a. `file://`) |
| `assets/js/offline-app.js` | Integration: Service-Worker-Registrierung/Update, Geräte-ID, Zeit, Ereigniserfassung, Synchronisation, Diagnose |
| `sw.js` | Service Worker (App-Shell-Cache, Offline-Start, Cache-Versionierung, Update) |
| `manifest.webmanifest` | PWA-Manifest (Name, Icons/maskable, Standalone, Start-URL, Theme) |

## IndexedDB-Struktur

Datenbank `preisschmiede-offline`, Version = `Sync.DB_VERSION`. Object Stores:

- **`records`** (keyPath `id`): Offline-Ereignisse **und** Warteschlange in einem.
- **`meta`** (keyPath `key`): Geräte-ID, letzte Serverzeit, Zeitdrift.

Migration über `onupgradeneeded` (fehlende Stores werden angelegt, keine
Datenverluste). Fällt IndexedDB aus/ist blockiert, wird transparent auf
`localStorage` (`preisschmiede.offline.*`) umgeschaltet – ebenfalls neustartfest.

**Datensatzfelder:** `id` (lokale UUID), `mandantId`, `benutzer`, `geraet`,
`typ`, `event`, `timerId`, `auftragId`, `posIndex`, `schritt`, `geraetezeit`,
`serverzeitBekannt`, `zeitzone`, `payload`, `dependsOn`, `erstellt`, `geaendert`,
`idempotenzKey`, `status`, `versuch`, `naechsterVersuch`, `serverRef`, `version`,
`fehler`.

## Ereignismodell (Zeiterfassung)

Unveränderbare Ereigniskette (typ `timer`): **TIMER_STARTED, BREAK_STARTED,
BREAK_ENDED, TIMER_STOPPED, ENTRY_CORRECTED, ENTRY_CANCELLED**. Die **Dauer wird
aus den Ereignissen berechnet** (`dauerAusEreignissen`), nie aus einem reinen
JS-Zähler. Ein laufender Timer wird nach App-Neustart aus den gespeicherten
Ereignissen **rekonstruiert** (`aktiverTimer`) und die verstrichene Zeit korrekt
angezeigt.

Weitere Datentypen (gleiche Queue/Idempotenz): `maschinenzeit`, `ruestzeit`,
`stueckzahl`, `ausschuss`, `materialverbrauch`, `montage`.

## Synchronisationslogik

Status: **LOCAL_ONLY → QUEUED → SYNCING → SYNCED** bzw. **RETRY / CONFLICT /
CANCELLED**. Reihenfolge (`faellig`): Sitzung/Mandant, dann Timer → Maschinen-/
Rüstzeiten → Stückzahlen → Materialverbrauch → Montage. Abhängige Einträge
(`dependsOn`) werden erst nach ihren Voraussetzungen (SYNCED) verarbeitet.

## Idempotenzverfahren (exactly-once)

- **Stabiler Idempotenzschlüssel** aus fachlichen Bestandteilen (Typ, Event,
  TimerId, Auftrag, Schritt, Gerätezeit) – nicht aus Zufall.
- **Einreihen** dedupliziert per Schlüssel (kein doppeltes Enqueue).
- **Verarbeitung**: ein bereits `SYNCED` Datensatz gibt seinen vorhandenen
  `serverRef` zurück (kein zweiter Aufruf, kein zweiter Datensatz).
- **Zentrale Seite**: `db.offlineBuchungen` wird je Idempotenzschlüssel nur
  **einmal** geschrieben (doppelte Absicherung).
- Getestet: mehrfaches Tippen, Seitenneuladen, App-Neustart, erneuter Versuch,
  zwei identische Requests → genau eine Buchung.

## Wiederholungsstrategie

Temporärer Fehler → **RETRY** mit kontrolliertem Backoff (1s/5s/15s/60s/300s),
`naechsterVersuch` gesetzt; vor Fälligkeit kein erneuter Versuch (kein
Endlos-Retry). Nach `MAX_VERSUCHE` (5) → **CONFLICT** (Prüfpunkt). Permanenter
Validierungsfehler (`temporaer:false`) → sofort **CONFLICT**. Manueller
erneuter Versuch setzt zurück auf QUEUED.

## Konfliktbehandlung

`pruefeKonflikt` erkennt: Sitzung abgelaufen, Benutzer deaktiviert/entfernt,
Gerät deaktiviert, Mandantenzuordnung geändert, **Cross-Tenant** (fremder
Mandant), Auftrag/Arbeitsgang nicht vorhanden, Auftrag abgeschlossen, Maschine
belegt, Material archiviert, Serverdatensatz geändert, fremder Timer aktiv,
unplausible Gerätezeit. **Konflikte werden nie still gelöscht** – die lokalen
Daten bleiben bis zur kontrollierten Entscheidung erhalten.

## Ein-Timer-Garantie & Zeit

`guardStart/guardStop/guardPause` verhindern: doppeltes Tippen, zwei Timer
desselben Benutzers, Timer in zwei Mandanten, Start während Pause, Stop ohne
Start. **Geräte-/Serverzeit**: lokale Zeit, letzte bekannte Serverzeit, Drift und
Zeitzone werden gespeichert; unplausible Abweichungen werden bei der
Synchronisation als Konflikt markiert.

## Offline-Datenumfang (Sicherheit)

Nur nötige Daten offline: zugewiesene Aufträge, Kommissionen, Arbeitsgänge,
ausgewählte Maschinen/Materialien, ausstehende lokale Buchungen. `auftragOffline`
reduziert einen Auftrag auf Werkstatt-Felder; `offlineDatensatzRein` stellt
sicher, dass **keine** vertraulichen Felder (Gewinn, Deckungsbeitrag,
Selbstkosten, Einkaufspreise, interne Sätze) offline gehalten werden. Der Service
Worker cacht **nur die statische App-Shell** – keine Benutzer-/Mandantendaten.

## PWA / Update

Manifest + Service Worker (App-Shell-Cache mit Versionierung, Offline-Start über
gecachte Shell, Navigation „network-first, dann Cache"). Update-Erkennung über
`updatefound`/`controllerchange`; ein Update wird **nicht** mitten in einer
laufenden Zeiterfassung erzwungen (Hinweisleiste, Bestätigung nötig).

## Minimale Diagnose

System-Seite → „📶 Offline-Synchronisation": online/offline, aktiver Timer,
lokale/wartende/synchronisierte Einträge, Konflikte, letzte Synchronisation,
Speicher-Treiber + DB-/App-Version, ein funktionierender „Jetzt
synchronisieren"-Knopf. Keine unfertigen Aktions-Schaltflächen.

## Testergebnisse

- `tests/referenz.test.js` **277/277** (35 neue Sync-Tests: Dauer/Pause,
  Rekonstruktion, Cancel/Correct, Ein-Timer-Guards, Idempotenz-Enqueue,
  Queue-Reihenfolge + Abhängigkeit, exactly-once-Verarbeitung, Backoff/Retry/
  max-Versuche/permanenter Fehler, Konflikte inkl. Cross-Tenant/Zeit, Offline-
  Datenumfang, Konflikt erhält lokale Daten).
- **Browser-E2E (Chromium):**
  - `file://` (localStorage-Treiber): Timer offline starten → **App-Neustart
    (Reload)** → Timer bleibt aktiv/rekonstruiert → stop → **zweifache
    Synchronisation** ergibt genau eine Buchung (exactly-once); Doppel-Tap
    verhindert; Diagnose sichtbar.
  - `http://` (IndexedDB-Treiber): **Service Worker registriert + steuert**,
    Manifest ladbar (2 Icons), IndexedDB-Daten überstehen Reload.

## Nur simulierte Gerätetests / Browsergrenzen

- Getestet in **headless Chromium** (Playwright), nicht auf echten iOS/Android-
  Geräten – iOS-Safari-PWA-Verhalten (Hintergrund-Timing, Speicherlimits) ist
  daher **nur simuliert**.
- **`file://`** erlaubt keinen Service Worker und (in Chromium) keine
  zuverlässige IndexedDB → dort greift bewusst der localStorage-Fallback.
  Service Worker benötigt einen **sicheren Kontext** (https oder localhost).
- Reload ≈ App-/Browser-Neustart; ein echter Prozess-Kill/Absturz wurde nicht
  auf Geräten reproduziert.

## Nicht enthalten (spätere Phase 14)

Umfangreiche mobile Werkstatt-/Montage-Oberfläche, Foto-Upload-Queue,
Terminalmodus. Dieser Kern ist die Grundlage dafür.
