import type { NextConfig } from "next";

/**
 * Wohnideen Hueter — Next.js Konfiguration
 *
 * Statischer Export (`output: "export"`): erzeugt beim Build reine HTML/CSS/JS
 * unter `out/`. So bleibt die Seite auf jedem statischen Host (eigene Domain,
 * GitHub Pages, CDN) deploybar – ganz ohne Node-Server.
 *
 * Für ein Deployment in einem Unterverzeichnis (z. B. GitHub Pages Projektpfad)
 * `NEXT_PUBLIC_BASE_PATH` setzen, etwa `/wohnideen-hueter`. Für die eigene
 * Domain (Root) leer lassen.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  images: {
    // Static Export unterstützt keinen serverseitigen Image-Optimizer.
    unoptimized: true,
  },
};

export default nextConfig;
