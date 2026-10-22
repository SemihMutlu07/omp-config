# Prompt Cockpit

Unified control center for OMP execution modes (Loops), Magic Keywords, and prompt modifiers (Prepend & Append).

## Usage

- Press **alt+s** or run **/snippets** (or **/cockpit**) to open the cockpit menu.
  - `↑`/`↓` or `1`-`4` navigate across sections (1: Keywords, 2: Loops, 3: Prepend, 4: Append).
  - `Space` toggles items (Execution Modes are mutually exclusive).
  - `c` clears all active selections immediately.
  - `Tab` previews item details, command syntax, or snippet markdown.
  - `Enter` applies the selection.
  - `Esc` cancels.

## Cockpit Sections

### 1. ⚡ Magic Keywords (OMP Yerleşik)
- **orchestrate**: Decomposes, dispatches to parallel subagents, and verifies.
- **workflowz**: Deterministic multi-subagent workflow (`workpool`, specialist roles).
- **ultrathink**: Maximum reasoning effort / thinking budget.
- **jevify**: Bulk classification via eval kernel's `judge_batch()`.

### 2. 🎯 Execution Modes (Döngü Kontrolü)
- **Loop (Test --until)**: Automatically re-submits the prompt after each turn until a test command exits with code 0 (`/loop --until 'npm test'`).
- **Loop (3x count)**: Automatically repeats prompt for 3 iterations (`/loop 3`).

### 3. ↑ Prepend Modifiers
- **Resume & Orient**: Three lines, each with a file path: last verified result, open task, next action.
- **Better**: Focus on professional depth, raw inputs, tools, and verification.

### 4. ↓ Append Modifiers
- **Strict Verification**: Name the smallest disproof command, run it, quote the output.
- **Check Real UI**: Exercise loading, empty, error, and interaction states at the two extreme viewports.

`Ask Questions First` 2026-10-22'de kaldırıldı: gövdesi `AGENTS.md` L9
("Resolve routine, reversible choices yourself. Ask when missing information
changes the outcome…"), L19 ("If Kasa or a file can answer, read it. Do not ask
Semih to restate it.") ve L92 ("Execute authorized, reversible steps without
another confirmation.") ile aynı davranışı emrediyordu. Aynı davranışı iki yerde
tutmak her istekte karakter maliyeti demek.

Kalan üç snippet de aynı kurala göre kırpıldı: `AGENTS.md`'nin zaten söylediği
cümleler çıktı, yalnız kanıtlanmış delta kaldı (ör. `strict-verify` artık
"checkbox değil" demiyor; o cümle AGENTS.md'de var).

### Snippet maliyeti (2026-10-22, gövde karakteri — frontmatter hariç)

Snippet yalnız cockpit'te seçildiğinde prompt'a girer; dördü birlikte seçilirse
istek başına **+730 karakter**. Kırpma öncesi 1.079'du (ask-first 158 dahil).

| Snippet | Yerleşim | Sıra | Gövde karakter | Tek davranış | A/B (açık / kapalı, 6 örnek) |
|---|---|---|---|---|---|
| Strict Verification | append | 10 | 86 | En küçük çürütücü komutu koş, çıktısını alıntıla | somut komut adı: 0/6 → 6/6 |
| Resume & Orient | prepend | 20 | 91 | Üç satır, her satırda dosya yolu | satır başı etiket: 0/6 → 5/6 |
| Check Real UI | append | 30 | 119 | Yükleme/boş/hata/etkileşim × iki uç viewport | durum matrisi (yükle/boş/hata): 1/6 → 6/6 |
| Better | prepend | 40 | 434 | Derin istem: ham girdi, araç, doğrulama | ölçülmedi — AGENTS.md'de karşılığı yok |

Kanıt: `~/dev/analysis/2026-10-22/t6-ab/raw-{notools,after}.json` ve
`02-cockpit.txt` / `13-badge-strict.txt`. Ölçüm `deepseek/deepseek-flash` ile,
system = `AGENTS.md`, "araç yok" kısıtı altında: talimat takibi ölçüldü, araç
kullanımı değil.

Kural: aynı davranış `AGENTS.md`'de de varsa snippet tutulmaz; tek kaynak kalır.

### OpenCode aynı snippet'leri okur

Snippet dosyaları tek kaynaktır: `~/.config/opencode/plugins/prompt-snippets.ts` bu dizindeki
`*.md` dosyalarını doğrudan okur. Her dosyanın frontmatter'ına eklenen `alias` alanı OpenCode'un
token/komut adıdır (`sv`, `resume`, `ui`, `better`). OMP parser'ı bu alanı yok sayar.

- Token: `hatayı düzelt ;sv` → gövde append, `;resume` / `;better` → gövde prepend.
- Komut: `/sv hatayı düzelt` — `/` menüsünde görünür.
- Birden çok token `order` sırasıyla uygulanır; kod bloğu içindeki token'lara dokunulmaz.
- Yeni snippet eklerken `alias` yazmazsan OpenCode dosya adını (`resume-orient`) alias kabul eder.

## Badges & Input Assembly

When active, colored pills appear above the editor:
`[⚡ orchestrate] [🎯 Loop: until test] [↑ Resume & Orient] [↓ Strict Verification]`

When submitted:
1. If an execution mode is selected, the message is prefixed with its command (e.g. `/loop --until 'npm test' `).
2. Enabled magic keywords are placed at the beginning of the prompt text.
3. Prepend snippets are inserted before the user prompt.
4. Append snippets are inserted after the user prompt.
5. Selections reset to off after each submission.
