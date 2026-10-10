#!/usr/bin/env bash
# Kopiert die aktuelle Kasse + alle referenzierten Assets nach www/
# Danach: npx cap sync ios
set -e
cd "$(dirname "$0")"
REPO=..
cp "$REPO/kassa.html" www/index.html
cp "$REPO/qrcode.js" "$REPO/manifest.json" "$REPO/sommerfest-logo.png" \
   "$REPO/fsgl-logo.svg" "$REPO/scl-logo.png" "$REPO/scl-emblem.png" "$REPO/icon-192.png" www/
echo "www/ aktualisiert. Jetzt: npx cap sync ios"
