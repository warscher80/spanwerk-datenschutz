import localFont from "next/font/local";

/**
 * Selbst gehostete Schriften (DSGVO-konform, kein externer Request).
 * Display: Space Grotesk (markante Grotesk) · Text: Inter · Labels/Daten: Space Mono.
 */

export const display = localFont({
  src: [
    { path: "../fonts/space-grotesk-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/space-grotesk-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-grotesk",
  display: "swap",
  fallback: ["system-ui", "Arial", "sans-serif"],
});

export const sans = localFont({
  src: [
    { path: "../fonts/inter-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/inter-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

export const mono = localFont({
  src: [
    { path: "../fonts/space-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/space-mono-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-spacemono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});
