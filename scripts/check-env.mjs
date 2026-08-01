/* Preisschmiede – Umgebungsvariablen-Validierung (Phase 11)
   Prueft beim Start/CI, ob Pflichtvariablen gesetzt und Formate gueltig sind.
   Gibt NIEMALS Werte aus (keine Secrets in Logs). Single Source of Truth ist
   Infra.ENV_SPEC aus assets/js/infra.js.

   Nutzung:
     node scripts/check-env.mjs                 # prueft process.env (Umgebung "alle")
     node scripts/check-env.mjs .env.prod prod  # prueft Datei + Zielumgebung

   Da die App offline laeuft, sind aktuell KEINE Variablen Pflicht; das Skript
   ist fuer den spaeteren Server-/Backend-Betrieb vorbereitet und faellt sonst
   sauber mit Exit-Code 0 durch. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// infra.js im Sandbox-Kontext laden (Browser-IIFE), um ENV_SPEC zu erhalten.
const G = { console };
G.self = G; G.window = G;
const code = readFileSync(join(root, "assets", "js", "infra.js"), "utf8");
new Function("self", code + "\n//# sourceURL=infra.js")(G);
const Infra = G.Preisschmiede.Infra;

function parseEnvFile(path) {
  const out = {};
  const txt = readFileSync(path, "utf8");
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    let val = line.slice(eq + 1);
    const hash = val.indexOf(" #");
    if (hash >= 0) val = val.slice(0, hash);
    out[name] = val.trim();
  }
  return out;
}

const args = process.argv.slice(2);
const file = args[0];
const umgebung = args[1] || "alle";
const env = file ? parseEnvFile(join(root, file)) : process.env;

const r = Infra.validateEnv(env, umgebung);

if (r.ok) {
  console.log(`ENV-Prüfung (${umgebung}): OK – keine fehlenden Pflichtvariablen, keine Formatfehler.`);
  process.exit(0);
}
// Nur Namen/Gründe ausgeben, niemals Werte.
if (r.fehlend.length) console.error("Fehlende Pflichtvariablen: " + r.fehlend.join(", "));
if (r.ungueltig.length) console.error("Ungültiges Format (Wert nicht angezeigt): " + r.ungueltig.join(", "));
process.exit(1);
