#!/usr/bin/env bash
# Rasterize the brand SVGs into the PNG icons + social card used by the site.
# Requires rsvg-convert (librsvg). Run from the repo root: bash scripts/generate-icons.sh
set -euo pipefail
cd "$(dirname "$0")/.."
IMG=assets/img

rsvg-convert -w 32  -h 32  "$IMG/icon.svg" -o "$IMG/favicon-32.png"
rsvg-convert -w 180 -h 180 "$IMG/icon.svg" -o "$IMG/icon-180.png"
rsvg-convert -w 192 -h 192 "$IMG/icon.svg" -o "$IMG/icon-192.png"
rsvg-convert -w 512 -h 512 "$IMG/icon.svg" -o "$IMG/icon-512.png"
rsvg-convert -w 1200 -h 630 "$IMG/social-card.svg" -o "$IMG/social-card.png"

echo "Generated: favicon-32, icon-180, icon-192, icon-512, social-card (1200x630)"
