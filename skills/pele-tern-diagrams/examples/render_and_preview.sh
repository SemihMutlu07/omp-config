#!/usr/bin/env bash
set -euo pipefail

# Kullanım: render_and_preview.sh <dosya.mmd>
# Çıktı: ${PELE_OUT_DIR:-$HOME/.cache/pele}/ altına yazılır; sabit /tmp adı kullanılmaz.
# Render `pele` CLI ile yapılır (bun runtime); `~/.local/share/pele/pele.js` modülü bu
# makinede yok, bu yüzden node modülü yoluna bağlanmıyoruz.
# PELE_NO_PREVIEW=1 → Tern önizlemesini açmadan yalnız render eder.

MMD_FILE="${1:?kullanım: render_and_preview.sh <dosya.mmd>}"
[[ -f "$MMD_FILE" ]] || { echo "girdi yok: $MMD_FILE" >&2; exit 2; }

NAME="$(basename "${MMD_FILE%.mmd}")"
OUT_DIR="${PELE_OUT_DIR:-$HOME/.cache/pele}"
mkdir -p "$OUT_DIR"

SVG_FILE="${OUT_DIR}/${NAME}-$$.svg"
PNG_FILE="${OUT_DIR}/${NAME}-$$.png"

pele "$MMD_FILE" -o "$SVG_FILE"
rsvg-convert -o "$PNG_FILE" "$SVG_FILE"

echo "Rendered $SVG_FILE and verified PNG $PNG_FILE"

if [[ "${PELE_NO_PREVIEW:-0}" == "1" ]]; then
  exit 0
fi
tern open --preview "$SVG_FILE"
