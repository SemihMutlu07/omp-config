# Prompt Cockpit

Unified control center for OMP execution modes (Loops), Magic Keywords, and prompt modifiers (Prepend & Append).

## Usage

- Press **alt+s** or run **/snippets** (or **/cockpit**) to open the cockpit menu.
  - `↑`/`↓` or `1`-`5` navigate across sections (1: Keywords, 2: Loops, 3: Prepend, 4: Append, 5: Skills).
  - `Space` toggles items (Execution Modes are mutually exclusive).
  - `c` clears all active selections immediately.
  - `Tab` previews item details, command syntax, or snippet markdown.
  - `Enter` applies the selection.
  - `Esc` cancels.

## Cockpit Sections

### 1. ⚡ Magic Keywords (OMP Yerleşik)
- **orchestrate**: Decomposes, dispatches to parallel subagents, and verifies.
- **workflowz**: Deterministic multi-subagent workflow (`workpool`, specialist roles).
- **jevify**: Bulk classification via eval kernel's `judge_batch()`. Model = the `modelRoles.judge` role in `config.yml` (verified: changing the role changes `judge_batch().status().model`).

### 2. 🎯 Execution Modes (Döngü Kontrolü)
- **Loop (Test --until)**: Automatically re-submits the prompt after each turn until a test command exits with code 0 (`/loop --until 'npm test'`).
- **Loop (3x count)**: Automatically repeats prompt for 3 iterations (`/loop 3`).

### 3. ↑ Prepend Modifiers
- **Route First**: Before the first tool call, one line `Route: direct | prewalk | primary | scout-first — <reason>`.


### 4. ↓ Append Modifiers
- **Kanıtla** (`;sv`): smallest disproving command with quoted output; for UI work also loading/empty/error states at both extreme viewports.
- **Kısa ve görsel** (`;kisa`): first line the answer, then only the decision-relevant part as a table or diagram.


### 5. 🧩 Skills
- Curated launcher, not a full skill browser. Selecting one injects
  `Read skill://<name>/SKILL.md and follow it for this task.` before the prompt.
- **ask-pocock**: routes to a loaded workflow; never installs a missing skill.
- **plan → kur → kanıtla**: loads `ask-pocock`, `grill-for-unknowns`, `gauntlet-loop` together (25 identical hand-picked combos, 17 sessions, 23 Oct–6 Nov).
- **grill-for-unknowns**: interrogates a plan against docs before building.
- **research**: cited Markdown from primary sources.
- **research-before-build**: "X yapmak istiyorum" → önce mevcut örnekler ve seçenekler, sonra seçileni uyarla.

- **gauntlet-loop**: spec → implement → independent review → runtime proof.

- Skills are pointers, not copied prose: the skill file stays the single source.


`Ask Questions First` 2026-10-22'de kaldırıldı: gövdesi `AGENTS.md` L9
("Resolve routine, reversible choices yourself. Ask when missing information
changes the outcome…"), L19 ("If Kasa or a file can answer, read it. Do not ask
Semih to restate it.") ve L92 ("Execute authorized, reversible steps without
another confirmation.") ile aynı davranışı emrediyordu. Aynı davranışı iki yerde
tutmak her istekte karakter maliyeti demek.

Bugünkü set üç snippet'tir. Eski üç snippet kaldırıldı: `strict-verify` ve
`check-real-ui` tek `prove` davranışında birleşti; `resume-orient` yerine işe
başlamadan rota seçen `route-first` geldi.

### Snippet maliyeti (gövde karakteri — frontmatter hariç)

Snippet yalnız cockpit'te seçildiğinde prompt'a girer; üçü birlikte seçilirse
istek başına **+1.282 karakter**.

| Snippet | Yerleşim | Sıra | Alias | Gövde karakter |
|---|---|---|---|---|
| Route First | prepend | 5 | `route` | 839 |
| Kanıtla | append | 10 | `sv` | 308 |
| Kısa ve görsel | append | 20 | `kisa` | 135 |

Kaldırılan sürümlerin A/B sayıları (2026-10-22 ölçümü) bu sete taşınmadı; yeni
gövdelere ait ölçüm yok.

Kural: aynı davranış `AGENTS.md`'de de varsa snippet tutulmaz; tek kaynak kalır.

### OpenCode aynı snippet'leri okur

Snippet dosyaları tek kaynaktır: `~/.config/opencode/plugins/prompt-snippets.ts` bu dizindeki
`*.md` dosyalarını doğrudan okur. Her dosyanın frontmatter'ına eklenen `alias` alanı OpenCode'un
token/komut adıdır (`route`, `sv`, `kisa`). OMP parser'ı bu alanı yok sayar.

- Token: `hatayı düzelt ;sv` → gövde append, `;route` → gövde prepend.
- Komut: `/sv hatayı düzelt` — `/` menüsünde görünür.
- Birden çok token `order` sırasıyla uygulanır; kod bloğu içindeki token'lara dokunulmaz.
- Yeni snippet eklerken `alias` yazmazsan OpenCode dosya adını (`route-first`) alias kabul eder.

## Development

Extension code loads once per OMP process. After editing `index.ts` or a snippet,
start a new OMP session (or restart) to see the change; this session keeps the
old module in memory.

## Badges & Input Assembly

When active, colored pills appear above the editor:
`[⚡ orchestrate] [🎯 Loop: until test] [↑ Route First] [↓ Kanıtla]`

When submitted:
1. If an execution mode is selected, the message is prefixed with its command (e.g. `/loop --until 'npm test' `).
2. Enabled magic keywords are placed at the beginning of the prompt text.
3. Prepend snippets are inserted before the user prompt.
4. Append snippets are inserted after the user prompt.
5. Selections reset to off after each submission.
