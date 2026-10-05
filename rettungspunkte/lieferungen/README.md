# Lieferordner der LinePoint-App

Hier legt der Projektleiter das ZIP einer Baustelle ab — genau die Datei, die
die App am PC unter **Verwaltung → Baustelle weitergeben → „Als Datei sichern"**
erzeugt. Die App auf jedem Handy schaut bei jedem Start mit Netz hier hinein
und trägt nach, was neu ist. **Der Monteur liest nichts ein.**

## So geht es — kinderleicht

In der App am PC (Büro-Modus): **Verwaltung → Baustelle weitergeben → „An die
Handys senden"**. Ein Knopf. Die App packt die Baustelle, legt das ZIP hier
ab und führt die Liste nach. Jedes Handy holt es beim nächsten Start mit Netz
(sobald GitHub Pages die Datei ausliefert, meist nach ein bis zwei Minuten).

**Einmalig einrichten** (nur auf dem PC, der senden soll): GitHub → Settings →
Developer settings → Fine-grained tokens → „Generate new token" → nur dieses
Repository, Berechtigung **Contents: Read and write** → Schlüssel kopieren →
in der App unter „Versand einrichten" einfügen. Er bleibt auf diesem PC, geht
nie ins Paket und nie in eine Datei.

## So geht es von Hand (wenn der Knopf nicht geht)

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
