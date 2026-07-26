/**
 * Präfixt absolute Asset-Pfade mit dem Deploy-Basispfad.
 *
 * Beim statischen Export prefixt `next/image` mit `unoptimized: true` den
 * `basePath` NICHT automatisch an die Bild-`src`. Für Unterverzeichnis-Deployments
 * (z. B. GitHub-Pages-Vorschau) würden absolute `/images/…`-Pfade sonst auf den
 * Domain-Root zeigen und 404 liefern. `asset()` stellt den Basispfad sicher voran.
 *
 * `NEXT_PUBLIC_BASE_PATH` wird zur Build-Zeit in den Client-Bundle eingebettet.
 */
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

export function asset(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE}${path}`;
}
