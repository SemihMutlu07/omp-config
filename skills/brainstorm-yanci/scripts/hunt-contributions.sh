#!/usr/bin/env bash
# hunt-contributions.sh — Yancı'nın açık kaynak katkı kuyruğunu canlı durumla raporlar.
# Sıfır mutasyon: hiçbir şeyi chmod/install/push etmez, sadece okur. sudo YOK.
set -uo pipefail

SB="${HOME}/.hermes/hermes-agent/apps/desktop/release/linux-unpacked/chrome-sandbox"

echo "=========================================================="
echo "YANCI — AÇIK KAYNAK KATKI KUYRUĞU (canlı durum, salt-okunur)"
echo "$(date '+%Y-%m-%d %H:%M')"
echo "=========================================================="

echo
echo "[1] Hermes Desktop — chrome-sandbox setuid bug (upstream #58593)"
echo "------------------------------------------------------------"
if [ -f "${SB}" ]; then
  PERMS="$(stat -c '%A %U:%G' "${SB}" 2>/dev/null)"
  echo "  chrome-sandbox: ${PERMS}"
  echo -n "  setuid(4755) gerekli mi? "
  if [ "$(stat -c '%a' "${SB}" 2>/dev/null)" = "4755" ] && [ "$(stat -c '%U' "${SB}")" = "root" ]; then
    echo "HAYIR — doğru (root:root 4755)"
  else
    echo "EVET — bozuk (0755/kullanıcı). Her güncelleme sıfırlıyor."
    echo "  Yancı burayı çözmek için KOD düzeltmesi ister (workaround değil):"
    echo "    - '--no-sandbox' fallback'i SELinux'lu distroda da tetiklensin (Fedora),"
    echo "    - ya da launcher setuid'u TTY olmadan kurabilsin,"
    echo "    - ya da sessiz exit yerine açık diagnostik + tek komut öner."
  fi
else
  echo "  chrome-sandbox YOK (bu kurulumda gerekmiyor) — sorun yok."
fi

# Hermes gateway / desktop build durumunu oku (başlatmadan)
echo
echo -n "  hermes desktop build: "
if [ -f "${HOME}/.hermes/desktop-build-stamp.json" ]; then
  echo "$(cat "${HOME}/.hermes/desktop-build-stamp.json" 2>/dev/null | tr -d '\n')"
else
  echo "stamp yok"
fi

echo
echo "[2] Omarchy — Huawei BOD-WXX9 / Goodix GXTP7863 touchpad"
echo "------------------------------------------------------------"
echo -n "  touchpad cihazı: "
FP="$(/proc/bus/input/devices 2>/dev/null)"
if grep -q "GXTP7863:00 27C6:01E0 Touchpad" /proc/bus/input/devices 2>/dev/null; then
  echo "GXTP7863:00 27C6:01E0 (Goodix I2C) — var"
else
  echo "belirlenemedi (grep boş)"
fi
echo -n "  hypr input config: "
echo "$(ls -1 "${HOME}/.config/hypr"/input.lua* 2>/dev/null | wc -l) dosya (input.lua + .bak*"
echo "  → tekrar tekrar düzenlenmiş; upstream rapor yolu: omarchy skill → contributing.md"

echo
echo "[3] Genel"
echo "------------------------------------------------------------"
echo "  günlük çalışmada takıldığın her şey = aday. push/deploy/spend → Semih onayı."
echo
echo "  Sıradaki: GH issue cross-link kontrolü →"
echo "    gh issue list --repo <hermes_repo>   # #58593 bağlantısı"
echo "    gh search issues 'chrome-sandbox setuid' --limit 10"
echo
