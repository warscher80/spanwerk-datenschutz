import localFont from "next/font/local";

/**
 * Selbst gehostete Schriften (DSGVO-konform, kein externer Request).
 * Display: Cormorant Garamond · Text/UI: Inter.
 * next/font stellt sie beim Build optimiert bereit und setzt CSS-Variablen,
 * die im Designsystem (globals.css → @theme) verwendet werden.
 */

export const cormorant = localFont({
  src: [
    { path: "../fonts/cormorant-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/cormorant-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-cormorant",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const inter = localFont({
  src: [
    { path: "../fonts/inter-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/inter-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});
