#!/usr/bin/env bash
# layers-doctor: one command that checks the shared layers (OMP + Claude Code + OpenCode).
# Each check below is a past failure that cost days. Exit 1 if any FAIL.
# Usage: layers-doctor.sh   (read-only, no network, no writes)
KASA="${KASA_ROOT:-$HOME/Kasa}"; fail=0
ok(){ printf 'ok    %s\n' "$1"; }; warn(){ printf 'WARN  %s\n' "$1"; }; bad(){ printf 'FAIL  %s\n' "$1"; fail=1; }

# 1 shared instructions: every harness reads the same file
S=$(readlink -f "$HOME/dev/omp-config/AGENTS.md")
for l in "$HOME/AGENTS.md" "$HOME/.omp/agent/AGENTS.md" "$HOME/.claude/CLAUDE.md"; do
  [ "$(readlink -f "$l" 2>/dev/null)" = "$S" ] && ok "instructions -> $l" || bad "instructions not shared: $l"; done
# 2 shared skills: one store
for l in "$HOME/.omp/agent/skills" "$HOME/.claude/skills"; do
  [ "$(readlink -f "$l")" = "$(readlink -f "$HOME/.agents/skills")" ] && ok "skills store -> $l" || bad "skills not shared: $l"; done
python3 - <<'PY' && ok "opencode skill list matches store" || bad "opencode skill list drifted from ~/.agents/skills"
import json,sys
from pathlib import Path
s={e.name for e in (Path.home()/'.agents/skills').iterdir() if not e.name.startswith('.') and (e/'SKILL.md').is_file()}
c={Path(x).name for x in json.load(open(Path.home()/'.config/opencode/opencode.json'))['skills']}
sys.exit(0 if s==c else 1)
PY
# 3 context hooks exist in both harnesses and the helper runs
[ -f "$HOME/.omp/agent/extensions/kasa-context/index.ts" ] && ok "OMP kasa-context extension" || bad "OMP kasa-context extension missing"
grep -q claude-kasa-context "$HOME/.claude/settings.json" && ok "Claude hook configured" || bad "Claude kasa hook missing in settings.json"
echo '{"hook_event_name":"SessionStart","cwd":"/tmp"}' | python3 "$HOME/dev/omp-config/scripts/claude-kasa-context.py" | grep -q 'FAILED TO LOAD' && bad "Claude hook cannot load Kasa context" || ok "Claude hook loads Kasa context"
# 4 hook/timer commands point at things that exist (the 127 bug)
for u in $(systemctl --user list-unit-files --no-legend 'claude-*.service' 'kasa-*.service' 'agent-*.service' 2>/dev/null | awk '{print $1}'); do
  e=$(systemctl --user show "$u" -p ExecStart --value | sed -n 's/.*path=\([^ ;]*\).*/\1/p' | head -1)
  [ -z "$e" ] || [ -x "$e" ] || bad "$u runs missing binary: $e"; done
systemctl --user --failed --no-legend | grep -q . && bad "failed user units: $(systemctl --user --failed --no-legend | awk '{print $2}' | tr '\n' ' ')" || ok "no failed user units"
# 5 freshness: stale timers and handoffs are how work slips a week
age(){ echo $(( ( $(date +%s) - $(stat -c %Y "$1") ) / 86400 )); }
h=$(ls -t "$KASA"/handoff/*.md | head -1); a=$(age "$h"); [ "$a" -le 2 ] && ok "latest handoff ${a}d old" || warn "latest handoff is ${a} days old ($(basename "$h")): run the checkpoint skill"
c=$(git -C "$KASA" log -1 --format=%ct); [ $(( $(date +%s) - c )) -lt 7200 ] && ok "Kasa captured in last 2h" || bad "no Kasa commit for >2h: capture timer stuck"
[ "$(git -C "$KASA" rev-parse HEAD)" = "$(git -C "$KASA" rev-parse @{u} 2>/dev/null)" ] && ok "Kasa pushed (HEAD = origin)" || warn "Kasa has unpushed commits"
# 6 write-back is real, not a no-op stub
grep -q 'No-op' "$HOME/.shared/hooks/claude-memory-to-vault-sync.py" 2>/dev/null && warn "Claude memory->vault sync is a no-op stub (Claude memory never reaches Kasa)"
# 7 token + disk
python3 - <<'PY'
import json,time,sys
e=json.load(open(__import__('os').path.expanduser('~/.claude/.credentials.json')))['claudeAiOauth']['expiresAt']
m=(e/1000-time.time())/60
print(('ok    ' if m>10 else 'FAIL  ')+f'claude token {m:.0f} min left')
sys.exit(0 if m>10 else 1)
PY
[ $? -eq 0 ] || fail=1
u=$(df --output=pcent / | tail -1 | tr -dc 0-9); [ "$u" -lt 90 ] && ok "disk ${u}%" || bad "disk ${u}% full"
exit $fail
