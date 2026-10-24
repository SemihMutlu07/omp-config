# OMP Config & Multi-Machine Setup

Bu depo, **OMP (oh-my-pi)** geliştirici ortamı, model rolleri, retry zincirleri, kurallar (`AGENTS.md`), özel yetenekler (skills) ve eklentileri (extensions) cihazlar arasında (özellikle dizüstü `omarchy` ve masaüstü `omarchy-1`) tutarlı ve güvenli şekilde senkronize etmek için oluşturulmuştur.

---

## 🏗 Mimari ve Durum Ayrımı (State Separation)

Çok makineli mimaride SQLite kilitlenmelerini (`SQLITE_CORRUPT`) ve kimlik sızıntılarını engellemek için **katı bir durum ayrımı** uygulanır:

| Kategori | Yönetim Yolu | Git Takibi |
|---|---|---|
| **Konfigürasyon (`config.yml`, `settings.json`)** | Bu Git reposu + Sembolik Link | **Evet** |
| **Kurallar (`AGENTS.md`)** | Bu Git reposu + Sembolik Link | **Evet** |
| **Yetenekler (`skills/*`)** | Paylaşılan depo `~/.agents/skills/`; bu repo yalnız OMP'ye özel skill'lerin kaynağı | **Evet** |
| **Eklentiler (`extensions/*`)** | `~/.omp/agent/extensions/` | **Evet** |
| **Model Kimlik Bilgileri (`auth.json`, Token'lar)** | Host-yerel (`omp login` / env) | ❌ **ASLA (Gitignore)** |
| **SQLite Veritabanları (`*.db`, `*.db-wal`)** | Host-yerel çalışma kayıtları | ❌ **ASLA (Gitignore)** |
| **Oturum Geçmişleri (`sessions/`, `logs/`)** | Cihaz-yerel loglar | ❌ **ASLA (Gitignore)** |

> **UYARI:** `~/.omp/agent/*.db` veritabanları Syncthing veya Git ile cihazlar arasında senkronize edilmemelidir. Eşzamanlı yazma durumunda veritabanı bozulması meydana gelir.

## Spec-driven shared execution

The current working contract is in `AGENTS.md`, under **Spec-driven work and shared execution**.
Notion holds accepted decisions, task specs, ownership, verified progress, and handoffs.
AgentMemory remains the historical/local archive; raw sessions and secrets stay local.
OpenCode's global `~/.config/opencode/AGENTS.md` loads this same working agreement.
Start a new session to exercise changed startup instructions.

- Shared guide: https://app.notion.com/p/3fc4b6f58b3b819b81e6ea25a7a3709b
- Existing handoff/acceptance task: https://app.notion.com/p/3fc4b6f58b3b818faed0e59776871869
- Each task carries outcome, sources, scope, acceptance, owner, dependencies, evidence, and next action.
- A worker must exercise the real surface and fetch its Notion checkpoint again before reporting success.
- Client integration is proved separately; a working OMP connection does not prove another client works.

### Explicit overnight quota guardian

`usage-guard.py` is an opt-in, deadline-bounded process, not a service or a change to provider routing.
It reads fresh Codex five-hour and weekly usage every 30 seconds.
At 95% in either window it sends Escape only to the explicitly named OMP session.
Unknown/stale usage fails closed. It never spends saved resets or changes accounts.
After the exhausted window advances and both limits are below 95%, it prompts the same idle session
with the existing Notion handoff URL. All input targets a unique owned Herdr agent name,
which Herdr clears when its occupant exits or is replaced, rather than a reusable pane ID.
The guard also checks the recorded session and pane before delivery.
Herdr has no atomic session compare-and-send API; do not reuse the guard's agent name or switch
its live OMP process to a different session while the guardian is active.
Unsafe snapshots reconcile the live state on every tick, even after a recorded pause.
Exhausted windows observed during an unknown-usage pause retain their reset requirements.
Wake intent is persisted before delivery; an uncertain delivery is not replayed automatically.
The deadline is checked again immediately before submitting a wake prompt.
Polling is not a provider-enforced hard cap: an in-flight request can cross the threshold between samples.
Keep checkpoints current before long GPT calls; use free OpenCode sessions for execution.

```bash
python3 usage-guard.py --self-test
python3 usage-guard.py --once
python3 usage-guard.py --pane <owned-pane> --agent <unique-owned-agent-name> \
  --session <owned-session-id> \
  --task-url <existing-Notion-task-URL> --state <private-state-path> \
  --until <timezone-aware-ISO-deadline>
```

The state file contains quota percentages, reset times, target identity, and control events, not credentials.
The guardian does not restart closed sessions, operate unrelated panes, or prove unattended task completion.

---

## 🚀 Yeni Cihazda (Masaüstü) Hızlı Kurulum

### 1. Repoyu Klonlayın
```bash
git clone git@github.com:SemihMutlu07/omp-config.git ~/dev/omp-config
cd ~/dev/omp-config
```

### 2. Kurulum Script'ini Çalıştırın
```bash
./setup.sh
```
Varsayılan olarak sembolik link (`symlink`) oluşturur. Bu sayede repoda çekilen (`git pull`) veya düzenlenen değişiklikler doğrudan OMP tarafından anında algılanır.

### 3. OMP Binary Kontrolü (Mise ile)
Eğer masaüstünde `omp` yüklü değilse, `~/.config/mise/config.toml` dosyasına şu satırı ekleyin:
```toml
[tools]
oh-my-pi = { version = "18.4.9", rename_exe = "omp" }
```
Ardından:
```bash
mise install
```

### 4. Sağlayıcı Girişleri (Authentication)
Yeni cihazda model sağlayıcılarını bağlayın:
```bash
omp login
```
* **Google Antigravity:** Gemini 3.8 Flash
* **OpenAI Codex:** GPT-6 Astra, GPT-6 Luna, GPT-6.1 Sol
* **xAI SuperGrok:** Grok 4.7 through `xai-oauth`.


### Model routing (2026-10-19)

OMP is the primary coding harness.
`config.yml` holds the model assignments. Prompts and subagents use role aliases.

| Work | Role or agent | Model |
|---|---|---|
| Main chat and implementation | `default`, `task` | GPT-6 Luna high |
| Small work, commit text, memory | `smol`, `tiny`, `commit`, `memory` | Gemini 3.8 Flash |
| Read-only research and mechanical work | `scout`, `sonic` → `@smol` | Gemini 3.8 Flash |
| Bulk classification | `judge` | Luna medium |
| Planning and difficult one-shots | `plan`, `slow` | Sol 6.1 xhigh |
| Correctness and security review | `reviewer`, `security-reviewer` → `@slow` | Sol 6.1 xhigh |
| Image analysis and image role | `vision`, `image` | Gemini 3.8 Flash medium / low |
| Passive review, enabled | `advisor` | Sol 6.1 medium |

Use OMP plan mode for read-only planning; a model role does not restrict tools.

Delegation permits one concurrent child and one nesting level.
Each child receives a soft budget of 25 requests, not a token or subscription limit.
The enabled model list contains Gemini 3.8 Flash, GPT-6.1 Sol, GPT-6 Luna, GPT-6 Astra, Grok 4.7 (`:high`, `:xhigh`), and the `deepseek/*` wildcard. Claude models are not enabled: they were only reachable through the Gemini subscription.
GLM 5.3 Flash and the `opencode-free` provider remain removed. DeepSeek is enabled again, but only as a paid, quota-free fallback rung.
Do not restore `extensions/opencode-free.ts` or add those model ids back to `enabledModels`.
OMP does not load OpenCode project or user commands.
Model switching on request failure is enabled (`retry.modelFallback: true`, `usageAwareFallback: true`, `maxRetries: 2`, trigger `usage-limit`). Each chain in `retry.fallbackChains` holds only the DeepSeek rung: `deepseek-v4-pro` for `plan`/`slow`/`advisor`/`task`/`judge`, `deepseek-flash` for `smol`/`tiny`/`memory`/`commit`. `default` falls to Sol medium; `vision` falls to `deepseek-v4-flash-vision-exp`; `image` has an empty chain because no substitute is configured.
Idle recaps and cache warming remain disabled. The advisor is enabled with `continueSeverity: blocker`.
API errors permit two retries.

A live CLI smoke returned `GEMINI_ROLE_OK` from `@smol` and `LUNA_ROLE_OK` from `@task`.
`omp config get modelRoles --json` confirmed the saved role assignments.
The actual OMP TUI also loaded the Workflowz snippet and prepended its instructions on submission.
Start a new session to load changes to the routing rules in `AGENTS.md`.

#### Workflowz usage and role activation

- Type the exact lowercase word `workflowz` in ordinary prompt text, outside code spans and paths.
- Alternatively, open `/snippets` or press `Alt+S`, select **Workflowz**, and submit your request.
- `AGENTS.md` directs each workflow phase to its specialist. Model IDs remain in `config.yml`.
- `completion(..., model="smol"|"default"|"slow")` uses the corresponding role for tool-free calls.
- `workpool()` defaults to the implementation agent. Research and review pools must select their specialist.
- The concurrency limit remains one. Workflow phases queue rather than running multiple children simultaneously.
- Assigning a role does not execute it. Plan mode selects `plan`; `todo` alone does not.
- `design` and `verify` are not built-in roles and are not configured here. A label alone starts no work.
- Use `/advisor on` for passive review and `/advisor off` to stop it. Typing `@advisor` is not that command.
- `omp --model @smol` starts a chat using the small model. It does not change the saved role map.
- This change does not switch an already-running chat's model or restart other sessions.

Cloudflare MCP authentication remains machine-local.
HTTP 401 requires the user to complete `/mcp reauth <server-name>` in OMP.
The affected names are `cloudflare`, `cloudflare-observability`,
`cloudflare-ai-gateway`, and `cloudflare-bindings`.
No Cloudflare credentials or server definitions were changed.
---

## 📁 Dosya ve Dizin Haritası

```
omp-config/
├── .gitignore              # Gizli anahtarlar, veritabanları ve oturum loglarını engeller
├── setup.sh                # Otomatik sembolik link ve dizin kurulum script'i
├── README.md               # Bu dokümantasyon
├── config.yml              # Ana OMP konfigürasyonu (model rolleri, retry zincirleri, tui vb.)
├── settings.json           # Ek eklenti ve alt sistem ayarları
├── AGENTS.md               # OMP global sözleşmesi ve kullanıcı kuralları
├── APPEND_SYSTEM.md        # Aynı cevap sözleşmesi; OMP bunu sistem promptunun sonuna ekler
├── extensions/             # OMP eklentileri
│   ├── herdr-omp-agent-state.ts # Herdr orkestrasyon entegrasyonu
│   ├── bash-guard/         # Bash komut güvenlik filtresi
│   └── prompt-snippets/    # Hızlı komut ve snippet kütüphanesi
└── skills/                 # Yalnız OMP'ye özel skill kaynakları; paylaşılan depo bunlara link verir
    ├── ask-pocock/
    ├── brainstorm-yanci/
    ├── clarity/
    ├── cloudflare-whats-new/
    ├── delegate-wave/
    ├── gauntlet-loop/
    ├── graphify/
    ├── herdr/
    ├── humanizer/
    ├── napiyorduk/
    ├── pele-tern-diagrams/
    ├── ste100/
    ├── steve/
    └── tern/
```

---

## 🔄 Cihazlar Arasında Güncelleme Akışı

1. **Laptop'ta yeni bir skill veya config ayarı yaptığınızda:**
   ```bash
   cd ~/dev/omp-config
   git add -A
   git commit -m "feat(skills): add new-skill"
   git push
   ```
2. **Desktop'a geçtiğinizde:**
   ```bash
   cd ~/dev/omp-config
   git pull
   python3 scripts/sync-skills.py     # depo skill'lerini paylaşılan depoya bağlar, Codex/OpenCode'u eşitler
   ```
   Sembolik linkler kurulu olduğu için OMP hiçbir dosya kopyalama gerektirmeden güncel konfigürasyonu kullanır.

## OMP session and skill contract

Each machine keeps a separate checkout.
Each machine keeps its own model settings and OMP version.
Session histories, databases, and credentials remain machine-local.

OMP loads `~/.omp/agent/AGENTS.md` and `~/.omp/agent/APPEND_SYSTEM.md`.
Do not create `~/AGENTS.md`.
The setup script removes that path only when it links to this checkout's rule file.
The setup script preserves unrelated files and links at that path.

## Skill discovery contract

Skill content lives once in `~/.agents/skills`.
`~/.omp/agent/skills`, `~/.claude/skills` and `~/.cursor/skills` are links to that store.
OMP reads it through `skills.enableAgentsUser: true`; `skills.customDirectories` stays empty.
A skill in this checkout is linked into the store, so one copy serves every harness.
Codex keeps its own `.system` skills inside `~/.codex/skills`, and OpenCode lists skill paths in `~/.config/opencode/opencode.json`.
`scripts/sync-skills.py` links checkout skills into the store and mirrors the store into those two places.
Run `scripts/sync-skills.py --check` after a skill change; it exits non-zero on drift.
The router selects only names from the current loaded list.
If no loaded workflow fits, the agent uses the engineering rules directly.

Start a new OMP session after a rule or discovery change.
Existing sessions can retain earlier instructions.
Do not restart another session without permission.
