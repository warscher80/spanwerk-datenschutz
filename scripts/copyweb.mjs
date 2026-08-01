/* Kopiert die statischen Web-Dateien (App-Quelle im Projekt-Root)
   in das Capacitor-Web-Verzeichnis www/. So bleibt der Root die
   einzige Quelle (auch für GitHub Pages) und www/ ist generiert. */
import { cp, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const www = join(root, "www");

const ITEMS = ["index.html", "portal.html", "datenschutz.html", "assets"];

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });

for (const item of ITEMS) {
  const src = join(root, item);
  if (!existsSync(src)) {
    console.warn("übersprungen (fehlt):", item);
    continue;
  }
  await cp(src, join(www, item), { recursive: true });
  console.log("kopiert:", item);
}

console.log("www/ ist aktuell.");
