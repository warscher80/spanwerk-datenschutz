# Lieferordner der Rettungspunkte-App

Hier legt der Projektleiter das ZIP einer Baustelle ab — genau die Datei, die
die App am PC unter **Verwaltung → Baustelle weitergeben → „Als Datei sichern"**
erzeugt. Die App auf jedem Handy schaut bei jedem Start mit Netz hier hinein
und trägt nach, was neu ist. **Der Monteur liest nichts ein.**

## So geht es

1. ZIP hier hochladen (GitHub: „Add file → Upload files", Datei hineinziehen).
   Ein späterer Stand: dieselbe Datei einfach ersetzen — der Server gibt ihr
   einen neuen ETag, die App merkt das.
2. Beim **ersten Mal** die Baustelle in `liste.json` eintragen:

```json
[
  { "id": "blatzheim", "baustelle": "Blatzheim", "leitung": "4236",
    "datei": "Baustelle_Blatzheim.zip", "was": "Karte, Pläne, Spanntabellen — Stand 27.09.2026" }
]
```

- `id` — kurz, ohne Leerzeichen, bleibt für immer gleich.
- `baustelle` — der Name, unter dem die Baustelle in der App steht. Gibt es sie
  schon, wird nachgetragen; sonst wird sie angelegt.
- `leitung` — Bl.-Nr., damit „4236/18" aus den Unterlagen der Mast „18" der
  Karte ist.
- `datei` — Dateiname im selben Ordner, keine Unterordner.
- `stand` (optional, Zahl) — nur nötig, wenn der Server keinen ETag liefert.
  Dann beim Ersetzen um eins erhöhen.

## Was das ist — und was nicht

Ein Briefkasten, kein Abgleich: Es gibt keinen Rückweg von der Baustelle ins
Büro, keine Konflikte, keine Benutzer. Eine Karte, die auf einem Handy schon
liegt, wird von einer Lieferung **nie** überschrieben (die App behält sie und
sagt es). Pläne und Spanntabellen werden ergänzt und ersetzt, nicht gelöscht.
