# OMP Config & Multi-Machine Setup

Bu depo, **OMP (oh-my-pi)** geliştirici ortamı, model rolleri, retry zincirleri, kurallar (`AGENTS.md`), özel yetenekler (skills) ve eklentileri (extensions) cihazlar arasında (özellikle dizüstü `omarchy` ve masaüstü `omarchy-1`) tutarlı ve güvenli şekilde senkronize etmek için oluşturulmuştur.

## Görünüm ve çalışma takibi

`config.yml` açık/koyu tema seçimini ve `band` composer'ı korur. Özel durum
satırı solda model, mod, klasör, Git ve PR; sağda maliyet ve bağlam gösterir.
Saydam arka plan ve `pipe` ayırıcı kullanılır; Markdown renk çeşitliliği ve
hareket azaltılmıştır. Yanıt süresi, alt ajan canlı önizlemesi ve hata
bildirimi açıktır. Bunlar yerleşik OMP ayarlarıdır; yeni eklenti gerektirmez.
Gerçek görünüm `/settings` → Appearance içinde denetlenebilir. Mevcut
`Alt+S` / `/cockpit` snippet ve skill menüsü değişmemiştir.

### Tek satırlık araç adımları

`extensions/compact-tools.ts`, ana konuşmadaki araç çağrılarını tek satır
gösterir. Hata çağrıları da tek satır kalır. Tern hata simgesini korur.
Tern’de araç başlığına tıklamak tam kartı açar. Yeniden tıklamak kartı katlar.
OMP 18.18.6 ile Tern 0.9.13 denemesinde `Ctrl+O` bu kartları topluca açmadı.

`extensionRenderers.transcriptPresenters: true` bu görünümü etkinleştirir.
`setup.sh`, eklentiyi mevcut extensions dizinine bağlar.
Yeni eklenti yeni OMP süreçlerinde yüklenir. Açık süreçler yeniden başlatılmaz.
Eklenti yalnız görünümü değiştirir. Oturum mesajlarını ve model bağlamını değiştirmez.
Düşünme metni, alt ajan görünümleri ve transcript replay mevcut görünümü korur.
Yerleşik görünüme dönmek için `extensionRenderers.transcriptPresenters` değerini
`false` yapın.

### Oturum maliyet uyarısı

`config.yml` içindeki `session.warnCost: 10`, oturum ağacının API-eşdeğeri
maliyeti $10'a ulaştığında bir kez uyarır. OMP 18.18.6'nın yerleşik
`CostGate` mekanizması kullanılır; yeni süreç veya eklenti yoktur.
Alt ajanlar aynı sayacı paylaşır.

`session.maxCost` **yoktur** (2026-11-10'da kaldırıldı, Semih'in kararı).
Gerekçe: abonelik planlarında liste fiyatı tahmini gerçek fatura değildir.
Bu yüzden sayılan dolar oturumu durdurmamalıdır. O gün sayaç $25.23'e
ulaştı ve çalışan oturumu `Cost cap reached` hatasıyla kesti.
`--max-cost` verilmedikçe sert sınır yoktur; `--warn-cost` uyarı eşiğini
değiştirir.

### Durum çubuğunda maliyet ve kota

`statusLine.rightSegments` üç segment taşır: `usage`, `cost`, `context_pct`.

`cost` segmenti abonelikte dolar göstermez. Ölçülen maliyet sıfırsa `(sub)`
yazar. Alt ajan maliyeti varsa `S0.38 (+1.27)` biçiminde abonelik işaretiyle
yazar. API anahtarıyla ödenen modelde `$0.42` yazar.

`usage` segmenti etkin hesabın kota pencerelerini yüzde ve sıfırlanma süresiyle
gösterir: `⏱ Pro · 5h 32% (1h 11m) · 1d 44% (5h 10m) · 7d 68% (2d 4h)`.
Sayılar `omp usage` ile aynı kaynaktan gelir. Kota penceresi bildirmeyen
sağlayıcıda (ör. DeepSeek API anahtarı) gösterilecek veri yoktur.

Bu iki segment OMP'de yerleşiktir. Eklenti veya kod gerekmez.
Çizimi `omp gallery --segment usage --plain` ve `omp gallery --segment cost --plain`
doğrular.


`compaction.thresholdTokens` ve `compaction.modelThresholds` **sert istek
bağlam sınırı değildir**. Sıkıştırma yapılamadığında veya ertelendiğinde
eşik üstü istek gönderilebilir. Kurulu katmanda yapılandırılabilir sert
bağlam reddi bulunmadığından bu hedef **BLOCKED** kalır.
`settings.json`, mevcut YAML varken etkin ayar kaynağı değildir.

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
* **Google Antigravity:** Gemini 3.8 Flash. OMP 18.18.5 ve sonrası bu sağlayıcıyı durdurur; giriş kaydı durur ama model listelenmez
* **OpenAI Codex:** GPT-6 Astra, GPT-6 Luna, GPT-6.1 Sol
* **xAI SuperGrok:** Grok 4.7 ve Grok 4.6 through `xai-oauth`.


### Model routing (updated 2026-11-10)

OMP is the primary coding harness.
`config.yml` holds the model assignments. Prompts and subagents use role aliases.

| Work | Role or agent | Model |
|---|---|---|
| Main chat | `default` | DeepSeek v4 Flash |
| Subagent implementation | `task` role; `task` agent | Grok 4.6 high |
| Small work, commit text, memory | `smol`, `tiny`, `commit`, `memory` | Grok 4.7 |
| Judge calls | `judge` | DeepSeek v4 Flash |
| Read-only research and mechanical work | `scout`; `sonic` | Grok 4.6 high; Grok 4.7 |
| Planning and difficult one-shots | `plan`, `slow`, `prewalk.from` | GPT-6.1 Sol xhigh; GPT-6.1 Sol high |
| Correctness and security review | `reviewer`, `security-reviewer` | `@slow` (GPT-6.1 Sol high) |
| Image analysis | `vision` | Claude Sonnet 5.5 |
| Image generation | `image` | none: role removed 2026-11-10 |
| Passive review, enabled | `advisor` | GPT-6.1 Sol medium |

`google-antigravity` is paused by OMP itself from 18.18.5 on:
`ProviderDisabledError: ... Google may restrict accounts that use Antigravity outside its own apps`.
Gemini models left the allowed list for that reason, not from a config edit.
The 18.18.3 build still serves `gemini-3.8-flash`.
Do not add Gemini roles back without either a provider fix or a downgrade.

Use OMP plan mode for read-only planning; a model role does not restrict tools.

Prewalk is opt-in: `prewalk.enabled` is `false`. Use `/prewalk` or `--prewalk` per session. The session plans on `prewalk.from` (`@plan`, GPT-6.1 Sol xhigh) and hands edits to `prewalk.into` (`@smol`, Grok 4.7) at the first edit. `prewalk.auto` is `suggest`: the `judge` role only suggests prewalk for each new task. Do not set `prewalk.auto` to `on` until a live comparison shows better cost and pass rate. `task.prewalk` stays `false`: the generic `task` agent already targets `smol`, and OMP skips prewalk when the start and target models match.

Before changing a role, run the same edit tasks on the candidate model and record pass rate, cost, and time. `edit.mode` stays `hashline`.

Delegation permits one concurrent child and one nesting level.
Each child receives a soft budget of 25 requests, not a token or subscription limit.
The enabled model list contains Grok 4.7 and Grok 4.6, Claude Sonnet 5.5, Opus 5.5 and Fable 5.2, GPT-6.1 Sol, GPT-6 Astra and GPT-6 Luna, and DeepSeek Flash, v4 Flash and Pro. Claude Haiku 5.5 is not enabled.
GLM 5.3 Flash and the `opencode-free` provider remain removed. DeepSeek is enabled. Grok 4.6 and Grok 4.7 fill the fallback chains.
Do not restore `extensions/opencode-free.ts` or add those model ids back to `enabledModels`.
OMP does not load OpenCode project or user commands.
Model switching is off (`retry.modelFallback: false`, `retry.usageAwareFallback: false`). A usage-limit stops the turn with a visible error and does not change the model. `retry.fallbackOn` stays `usage-limit` but fires nothing while both switches are off. Compaction thresholds are set at 150k (`f150000`).
Idle recaps and cache warming remain disabled. The advisor is enabled with `continueSeverity: blocker`.
API errors permit two retries.

A live CLI smoke returned `GEMINI_ROLE_OK` from `@smol`, `LUNA_ROLE_OK` from `@task`, and `ADVISOR_SMOKE_OK` from `@advisor`, whose JSON stream reported `provider: openai-codex`, `model: gpt-6.1-sol`.
`omp config get modelRoles --json` confirmed the saved role assignments.
The actual OMP TUI also loaded the Workflowz snippet and prepended its instructions on submission.
Start a new session to load changes to the routing rules in `AGENTS.md`.

`WATCHDOG.yml` sets advisor note wording. Notes follow the latest user's
language: ISO 24495-1 plain-language principles for Turkish and ASD-STE100
principles for English. Each note covers one actionable finding in one paragraph,
with at most three short sentences and 60 words. Notes keep decisive evidence
and the next action, but do not include scripts or command chains.
A live `omp -p --advisor` smoke on 2026-10-28 produced Turkish and English
advisor cards of 29 and 37 words; both kept the missing-file evidence and blocker
severity. The roster, models, review cadence, and continuation threshold did not
change. Start a new OMP session to load the updated advisor instructions.

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

## Read-only Kasa reports

Run reports manually; they install no hook, timer, or background writer.

```bash
python3 scripts/kasa-repeats.py --root ~/Kasa --since 2026-11-01 --json
python3 scripts/kasa-yesterday.py --root ~/Kasa --date 2026-11-05
```

`kasa-repeats.py` reads only session-header lines. It reports ISO-week keys
(first 40 normalized characters) repeated at least three times, plus nudge
counts. Keys are text excerpts, not anonymized data; keep reports local.
It does not prove a reduction in repeated requests without comparable weeks.

`kasa-yesterday.py` prints at most 12 Turkish lines: dated commit counts,
up to five non-session commit subjects, latest handoff age, failed user units,
and layer-check FAIL/WARN counts. Unavailable probes print `ölçülemedi`.
It does not create a task ledger or replace the Notion task board.

```bash
python3 -m unittest tests.test_kasa_repeats tests.test_kasa_yesterday
```

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
│   ├── kasa-context/       # Kasa kararları ve son devri oturum başına enjekte eder
│   ├── kasa-handoff/       # Tur kapanışını günlük devir dosyasına yazar
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
