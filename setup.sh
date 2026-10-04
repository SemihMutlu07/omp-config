#!/usr/bin/env bash
# ==============================================================================
# OMP (Oh-My-Pi) Setup & Sync Script
# Multi-machine setup for laptop (omarchy) & desktop (omarchy-1)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_USER="${USER:-$(whoami)}"
HOME_DIR="${HOME:-/home/$TARGET_USER}"

OMP_DIR="$HOME_DIR/.omp/agent"
PI_DIR="$HOME_DIR/.pi/agent"
SKILLS_DIR="$PI_DIR/skills"
PI_EXT_DIR="$PI_DIR/extensions"
OMP_EXT_DIR="$OMP_DIR/extensions"

MODE="link" # default to symlink
BACKUP_SUFFIX="$(date +%Y%m%d_%H%M%S)"

print_step() {
  echo -e "\033[1;34m==>\033[0m \033[1m$1\033[0m"
}

print_success() {
  echo -e "\033[1;32m✓\033[0m $1"
}

print_warn() {
  echo -e "\033[1;33m!\033[0m $1"
}

print_info() {
  echo -e "\033[0;36mℹ\033[0m $1"
}

usage() {
  cat <<EOF
Kullanım: ./setup.sh [SEÇENEKLER]

Seçenekler:
  --link        Dosyaları hedef dizinlere symlink ile bağlar (Varsayılan).
  --copy        Dosyaları symlink yerine kopyalar.
  --help        Bu yardım mesajını gösterir.

EOF
  exit 0
}

# Parse CLI options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --link)
      MODE="link"
      shift
      ;;
    --copy)
      MODE="copy"
      shift
      ;;
    --help|-h)
      usage
      ;;
    *)
      echo "Bilinmeyen seçenek: $1"
      usage
      ;;
  esac
done

print_step "OMP kurulumu başlatılıyor (Kullanıcı: $TARGET_USER, Ev: $HOME_DIR, Mod: $MODE)..."

# 1. Hedef dizinleri oluştur
print_step "Dizinler kontrol ediliyor / oluşturuluyor..."
mkdir -p "$OMP_DIR" "$SKILLS_DIR" "$PI_EXT_DIR" "$OMP_EXT_DIR"
print_success "Dizin yapısı hazır."

# 2. Dosya yerleştirme fonksiyonu
install_file() {
  local src="$1"
  local dest="$2"

  if [ ! -f "$src" ]; then
    print_warn "Kaynak dosya bulunamadı: $src"
    return
  fi

  if [ -e "$dest" ] || [ -L "$dest" ]; then
    # Zaten doğru link ise atla
    if [ -L "$dest" ] && [ "$(readlink -f "$dest")" = "$(readlink -f "$src")" ]; then
      print_info "Zaten bağlı: $dest -> $src"
      return
    fi
    # Yedekle
    cp -P "$dest" "${dest}.bak.${BACKUP_SUFFIX}"
    print_info "Mevcut dosya yedeklendi: ${dest}.bak.${BACKUP_SUFFIX}"
    rm -rf "$dest"
  fi

  if [ "$MODE" = "link" ]; then
    ln -s "$src" "$dest"
    print_success "Sembolik link oluşturuldu: $dest -> $src"
  else
    cp "$src" "$dest"
    print_success "Kopyalandı: $src -> $dest"
  fi
}

install_dir_contents() {
  local src_dir="$1"
  local dest_dir="$2"

  if [ ! -d "$src_dir" ]; then
    print_warn "Kaynak dizin bulunamadı: $src_dir"
    return
  fi

  for item in "$src_dir"/*; do
    [ -e "$item" ] || continue
    local base_name="$(basename "$item")"
    local dest_item="$dest_dir/$base_name"

    if [ -e "$dest_item" ] || [ -L "$dest_item" ]; then
      if [ -L "$dest_item" ] && [ "$(readlink -f "$dest_item")" = "$(readlink -f "$item")" ]; then
        continue
      fi
      rm -rf "$dest_item"
    fi

    if [ "$MODE" = "link" ]; then
      ln -s "$item" "$dest_item"
    else
      cp -r "$item" "$dest_item"
    fi
  done
  print_success "$dest_dir içine $src_dir içeriği bağlandı."
}

# 3. Konfigürasyon dosyalarını bağla
print_step "Konfigürasyon dosyaları yerleştiriliyor..."
install_file "$SCRIPT_DIR/config.yml" "$OMP_DIR/config.yml"
install_file "$SCRIPT_DIR/settings.json" "$OMP_DIR/settings.json"
install_file "$SCRIPT_DIR/AGENTS.md" "$HOME_DIR/AGENTS.md"
install_file "$SCRIPT_DIR/AGENTS.md" "$OMP_DIR/AGENTS.md"

# 4. Skills ve Extensions bağla
print_step "Skills yerleştiriliyor (~/.pi/agent/skills)..."
install_dir_contents "$SCRIPT_DIR/skills" "$SKILLS_DIR"

print_step "Extensions yerleştiriliyor..."
install_dir_contents "$SCRIPT_DIR/extensions" "$OMP_EXT_DIR"
# deepseek-offpeak.ts ~/.pi/agent/extensions altında da bulunsun
if [ -f "$SCRIPT_DIR/extensions/deepseek-offpeak.ts" ]; then
  install_file "$SCRIPT_DIR/extensions/deepseek-offpeak.ts" "$PI_EXT_DIR/deepseek-offpeak.ts"
fi

# 5. Mise & OMP binary kontrolü
print_step "Mise ve OMP binary kontrol ediliyor..."
if command -v omp >/dev/null 2>&1; then
  print_success "omp komutu hazır: $(omp --version 2>/dev/null || echo 'omp yüklü')"
else
  print_warn "omp komutu PATH içinde bulunamadı!"
  if command -v mise >/dev/null 2>&1; then
    print_info "Mise bulundu. OMP yüklemek için şu satırı ~/.config/mise/config.toml içine ekleyin:"
    echo '  oh-my-pi = { version = "18.4.9", rename_exe = "omp" }'
    echo "  Ardından 'mise install' komutunu çalıştırın."
  else
    print_warn "mise de kurulu değil. Lütfen mise ve oh-my-pi kurun."
  fi
fi

# 6. Kimlik doğrulama hatırlatması
echo ""
print_step "Kurulum Tamamlandı!"
print_info "NOT: Güvenlik gereği SQLite veritabanları (*.db) ve auth token'ları (auth.json) Git reposuna DAHİL EDİLMEZ."
print_info "Yeni makinede ilk kez çalıştırırken model sağlayıcılarına giriş yapın:"
print_info "  omp login"
print_info "Veya ortam değişkenlerinizi (.bashrc / .zshrc / env) ayarlayın."
echo ""
EOF