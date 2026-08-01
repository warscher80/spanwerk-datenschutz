# =============================================================
#  Preisschmiede – reproduzierbares Hosting der STATISCHEN App
#  Diese App ist reines HTML/CSS/JS (localStorage), ohne Server-
#  Laufzeit, ohne Datenbank, ohne Secrets. Das Image serviert nur
#  die statischen Dateien über nginx (unprivilegiert, Port 8080).
#  Es enthält KEINE Secrets, KEINE Entwicklungswerkzeuge im
#  Laufzeit-Image und lädt KEINE Beispieldaten automatisch.
# =============================================================

# ---- Stufe 1: Statisches Bundle deterministisch zusammenstellen ----
FROM node:20-alpine AS build
WORKDIR /src
# Nur die für den Build nötigen Quellen kopieren (siehe .dockerignore)
COPY scripts/copyweb.mjs scripts/copyweb.mjs
COPY index.html datenschutz.html ./
COPY assets ./assets
# copyweb.mjs hat keine Abhängigkeiten (reines Node fs) -> kein npm install
RUN node scripts/copyweb.mjs

# ---- Stufe 2: Auslieferung über unprivilegiertes nginx ----
# nginx-unprivileged läuft als Nutzer 101 (nicht root) und hört auf 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
# Server-/Sicherheitskonfiguration (Header, Healthcheck, kein Listing)
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
# Nur das generierte statische Bundle ins Image
COPY --from=build /src/www /usr/share/nginx/html
EXPOSE 8080
# Healthcheck gegen den dedizierten Endpunkt (busybox wget im Alpine-Image)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
# Standard-CMD des Basisimages (nginx im Vordergrund) wird übernommen.
