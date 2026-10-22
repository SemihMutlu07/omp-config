#!/usr/bin/env bash
set -euo pipefail

NAME="${1:-architecture}"
MMD_FILE="/tmp/${NAME}.mmd"
SVG_FILE="/tmp/${NAME}-$$.svg"
PNG_FILE="/tmp/${NAME}-$$.png"

node skills/pele-tern-diagrams/scripts/render_pele.js "$MMD_FILE" "$SVG_FILE"
rsvg-convert -o "$PNG_FILE" "$SVG_FILE"

echo "Rendered $SVG_FILE and verified PNG $PNG_FILE"
tern open --preview "$SVG_FILE"
