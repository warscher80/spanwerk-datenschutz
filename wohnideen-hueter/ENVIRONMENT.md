# Umgebungsvariablen — Wohnideen Hueter

Es sind **keine** Umgebungsvariablen zwingend erforderlich – die Website baut und
läuft ohne jede Konfiguration (statischer Export, datenschutzfreundlicher
Formular-Rückfall).

**Grundsatz:** Niemals Secrets im Frontend. Nur mit `NEXT_PUBLIC_`-Präfix
markierte Variablen gelangen in den Client – dort ausschließlich unkritische,
öffentliche Werte (URLs, Pfade). Alle `.env*`-Dateien sind über `.gitignore`
vom Repository ausgeschlossen.

## Öffentlich (Client) — optional

| Variable | Zweck | Beispiel | Default |
|---|---|---|---|
| `NEXT_PUBLIC_BASE_PATH` | Basis-Pfad bei Deployment in einem Unterverzeichnis | `/wohnideen-hueter` | `""` (Root) |
| `NEXT_PUBLIC_CONTACT_ENDPOINT` | Öffentliche URL der Formular-Schnittstelle. Gesetzt ⇒ Formular postet per `fetch`, Erfolg nur bei HTTP 200. Leer ⇒ E-Mail-Programm-Rückfall | `/api/kontakt` | leer |

## Serverseitig (nur bei echtem Formularversand) — geheim

Nur nötig, wenn der Handler aus `docs/contact-endpoint.example.ts` auf einem
Node-Host aktiviert wird. Diese Werte **niemals** committen oder mit
`NEXT_PUBLIC_` versehen.

| Variable | Zweck |
|---|---|
| `SMTP_HOST` | SMTP-Server (E-Mail-Versand) |
| `SMTP_PORT` | Port (z. B. 587 oder 465) |
| `SMTP_USER` | SMTP-Benutzer |
| `SMTP_PASS` | SMTP-Passwort — **geheim** |
| `CONTACT_TO` | Empfängeradresse (z. B. office@wohnideen-hueter.at) |
| `CONTACT_FROM` | Absenderadresse der Website |

Alternativ zu eigenem SMTP: ein datenschutzkonformer Mail-/Formularservice mit
EU-Serverstandort und Auftragsverarbeitungsvertrag.

## Lokale Entwicklung

Eine `.env.local` (nicht versioniert) kann z. B. enthalten:

```
# NEXT_PUBLIC_CONTACT_ENDPOINT=http://localhost:3000/api/kontakt
```

Ohne Angabe ist automatisch der E-Mail-Programm-Rückfall aktiv – so lässt sich
das Formular ohne Backend testen, ohne eine falsche Erfolgsmeldung zu zeigen.
