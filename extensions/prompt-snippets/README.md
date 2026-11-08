# Prompt Cockpit

Unified selector for prompt modifiers (Prepend & Append) and curated skills, mirroring the Pi cockpit.

## Usage

- Press **alt+s** or run **/snippets** (or **/cockpit**) to open the cockpit menu.
  - `↑`/`↓` or `1`-`3` navigate across sections (1: Prepend, 2: Append, 3: Skills).
  - `Space` toggles items.
  - `c` clears active selections (press again when empty to restore sticky defaults).
  - `Tab` previews snippet markdown or skill path.
  - `Enter` assembles prompt around editor text and sends it.
  - `Esc` cancels without sending.

Active selections appear as badge pills above the editor (e.g. `[Kısa ve görsel] [Dil]`).

## Cockpit Sections

### 1. ↑ Prepend Modifiers
- **Route First**: Before the first tool call, one line `Route: direct | primary — <reason>`.

### 2. ↓ Append Modifiers
- **Kanıtla** (`;sv`): Smallest disproving command with quoted output; for UI work also loading/empty/error states at both extreme viewports.
- **Kısa ve görsel** (`;kisa`, sticky): First line the answer, then only the decision-relevant part as a table or diagram.
- **Dil** (`;dil`, sticky): Her cevapta tek okumalı düz dil (ISO 24495-1 / ASD-STE100).

### 3. 🧩 Skills
Curated launcher, not a full skill browser:
- **ask-pocock**: Routes to a loaded workflow; never installs a missing skill.
- **plan → kur → kanıtla**: Loads `ask-pocock`, `grill-for-unknowns`, `gauntlet-loop` together.
- **research-before-build**: "X yapmak istiyorum" → önce mevcut örnekler ve seçenekler, sonra seçileni uyarla.
- **gauntlet-loop**: Spec → implement → independent review → runtime proof.

## Sticky Snippets

Snippets with `sticky: true` in their frontmatter (`short-visual.md`, `dil.md`) remain active across sessions and submissions:
1. Appear in the badge widget above the editor (`[Kısa ve görsel] [Dil]`).
2. Checked (`[x]`) by default in the cockpit menu.
3. Reach every typed user message via `pi.on("input")`.
4. Can be toggled off in the cockpit via `Space` or `c`.

## Development

```bash
NODE_PATH=~/dev/pi-dictate/node_modules bun extensions/prompt-snippets/test-render.ts
```
