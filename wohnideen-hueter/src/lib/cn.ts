/** Kleiner Klassen-Merger (ohne externe Abhängigkeit). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
