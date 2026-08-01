/* Preisschmiede – einfacher Secret-Scan (Phase 11)
   Bricht mit Exit-Code 1 ab, wenn wahrscheinliche Secrets im Repository
   auftauchen. Bewusst konservativ (wenige, klare Muster), damit keine
   falsche Sicherheit entsteht – ersetzt keinen dedizierten Secret-Scanner.

   Nutzung:  node scripts/secret-scan.mjs */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const IGNORE_DIRS = new Set([".git", "node_modules", "www", "android", "desktop", "dist"]);
const SCAN_EXT = new Set([".js", ".mjs", ".ts", ".json", ".html", ".css", ".yml", ".yaml", ".env", ".sh", ".md"]);

// Hochsichere Provider-Muster gelten UEBERALL (auch in Tests).
const HIGH_CONFIDENCE = [
  { name: "AWS Access Key ID", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private Key Block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Stripe Live Secret Key", re: /\bsk_live_[0-9A-Za-z]{16,}\b/ },
  { name: "Slack Token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: "Google API Key", re: /\bAIza[0-9A-Za-z_\-]{35}\b/ }
];
// Generisches Zuweisungsmuster: rauschanfaellig -> NICHT in Test-Fixtures/Doku
// (dort stehen bewusst Platzhalter-Tokens). Allowlist wie bei echten Scannern.
const GENERIC = { name: "Zuweisung api_key/secret/password/token mit Wert", re: /\b(api[_-]?key|secret|password|passwd|token|client[_-]?secret|webhook[_-]?secret)\b\s*[:=]\s*["'][A-Za-z0-9_\-\/+]{12,}["']/i };
// Offensichtliche Platzhalter/Fixtures nie als Fund werten.
const ALLOW = /(test|geheim|example|beispiel|dummy|placeholder|xxxx|changeme|dein[_-]?|your[_-]?|<|>)/i;
function patternsFor(rel) {
  const istTestOderDoku = rel.startsWith("tests/") || rel.endsWith(".md") || rel === ".env.example";
  return istTestOderDoku ? HIGH_CONFIDENCE : HIGH_CONFIDENCE.concat([GENERIC]);
}

const findings = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const rel = p.slice(root.length + 1);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (!IGNORE_DIRS.has(entry)) walk(p); continue; }
    if (!SCAN_EXT.has(extname(entry)) && entry !== ".env.example") continue;
    let txt; try { txt = readFileSync(p, "utf8"); } catch { continue; }
    const pats = patternsFor(rel);
    txt.split(/\r?\n/).forEach((line, i) => {
      for (const pat of pats) {
        if (pat.re.test(line) && !(pat === GENERIC && ALLOW.test(line))) findings.push({ file: rel, line: i + 1, pattern: pat.name });
      }
    });
  }
}
walk(root);

if (findings.length === 0) {
  console.log("Secret-Scan: keine wahrscheinlichen Secrets gefunden.");
  process.exit(0);
}
console.error("Secret-Scan: mögliche Secrets gefunden (bitte prüfen/entfernen):");
// Nur Ort/Muster ausgeben, NIEMALS den erkannten Wert.
findings.forEach((f) => console.error(`  ${f.file}:${f.line} – ${f.pattern}`));
process.exit(1);
