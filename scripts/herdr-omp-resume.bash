#!/usr/bin/env bash
# herdr-omp-resume.bash: Herdr terminalinde önceki OMP oturumunu önerir ve 'r' kısayolu tanımlar.

# Sadece interaktif kabuklarda çalışır
[[ $- == *i* ]] || return 0 2>/dev/null || exit 0

# Sadece herdr terminalinde ve OMP alt sürecinde değilken çalışır
[ -n "$HC_TERMINAL_ID" ] || return 0 2>/dev/null || exit 0
[ "$OMPCODE" != "1" ] || return 0 2>/dev/null || exit 0

_state_file="$HOME/.omp/agent/herdr-terminals/${HC_TERMINAL_ID}.json"
[ -f "$_state_file" ] || return 0 2>/dev/null || exit 0

# OMP süreci halen bu terminalde çalışıyorsa sessiz kal
_pid=$(jq -r '.pid // empty' "$_state_file" 2>/dev/null)
if [ -n "$_pid" ] && kill -0 "$_pid" 2>/dev/null && grep -qa "omp" "/proc/$_pid/cmdline" 2>/dev/null; then
  unset _pid _state_file
  return 0 2>/dev/null || exit 0
fi

_sid=$(jq -r '.sessionId // empty' "$_state_file" 2>/dev/null)
_short_id=$(jq -r '.shortId // empty' "$_state_file" 2>/dev/null)
_cwd=$(jq -r '.cwd // empty' "$_state_file" 2>/dev/null)
_title=$(jq -r '.title // empty' "$_state_file" 2>/dev/null)
_file_boot=$(jq -r '.bootId // empty' "$_state_file" 2>/dev/null)
_updated_ms=$(jq -r '.updatedAt // 0' "$_state_file" 2>/dev/null)
[ -z "$_short_id" ] && [ -n "$_sid" ] && _short_id="${_sid:0:8}"

_script="$HOME/dev/omp-config/scripts/herdr-reopen-journal.py"
_marker="$HOME/.omp/agent/herdr-terminals/${HC_TERMINAL_ID}.want-resume"
_stamp="$HOME/.omp/agent/herdr-terminals/${HC_TERMINAL_ID}.boot"
_boot=$(tr -d '[:space:]' < /proc/sys/kernel/random/boot_id 2>/dev/null || true)
_btime=$(awk '/^btime / {print $2}' /proc/stat 2>/dev/null || echo 0)
_stamped=$(tr -d '[:space:]' < "$_stamp" 2>/dev/null || true)
_should_exec=0
if [ -f "$_marker" ]; then
  _should_exec=1
elif [ -n "$_boot" ] && [ "$_stamped" != "$_boot" ]; then
  if [ -n "$_file_boot" ] && [ "$_file_boot" != "$_boot" ]; then
    _should_exec=1
  elif [ -z "$_file_boot" ] && [ "${_updated_ms:-0}" -gt 0 ] 2>/dev/null; then
    _updated_s=$((_updated_ms / 1000))
    if [ "$_updated_s" -lt "${_btime:-0}" ]; then
      _should_exec=1
    fi
  fi
fi
if [ "$_should_exec" = 1 ] && [ -n "$_sid" ] && [ -f "$_script" ]; then
  if python3 "$_script" live --session-id "$_sid" >/dev/null 2>&1; then
    rm -f "$_marker"
    _should_exec=0
  fi
fi
if [ "$_should_exec" = 1 ] && [ -n "$_sid" ]; then
  rm -f "$_marker"
  printf '%s\n' "$_boot" > "$_stamp" 2>/dev/null || true
  if [ -n "$_cwd" ]; then cd "$_cwd" 2>/dev/null || true; fi
  if [ "${HERDR_OMP_RESUME_DRY:-}" = 1 ]; then
    echo "EXEC omp -r $_sid"
    unset _pid _state_file _sid _short_id _cwd _title _file_boot _updated_ms _script _marker _stamp _boot _btime _stamped _should_exec _updated_s
    return 0 2>/dev/null || exit 0
  fi
  exec command omp -r "$_sid"
fi

if [ -n "$_short_id" ]; then
  echo -e "\033[1;36m[herdr:$HC_TERMINAL_ID]\033[0m Önceki OMP oturumu: \033[1;33m$_short_id\033[0m${_title:+ ($_title)}"
  if [ -n "$_cwd" ] && [ "$_cwd" != "$PWD" ]; then
    echo -e "  Dizin: \033[0;35m$_cwd\033[0m (şu an: $PWD)"
    echo -e "  Devam etmek için: \033[1;32mcd '$_cwd' && omp -r $_short_id\033[0m  (kısayol: \033[1;32mr\033[0m)"
    alias r="cd '$_cwd' && omp -r '$_short_id'"
    alias r-restore="cd '$_cwd' && omp --restore '$_short_id'"
    alias resume="cd '$_cwd' && omp -r '$_short_id'"
  else
    echo -e "  Devam etmek için: \033[1;32momp -r $_short_id\033[0m  (kısayol: \033[1;32mr\033[0m / \033[1;32momp --restore $_short_id\033[0m)"
    alias r="omp -r '$_short_id'"
    alias r-restore="omp --restore '$_short_id'"
    alias resume="omp -r '$_short_id'"
  fi
fi

unset _pid _state_file _sid _short_id _cwd _title
