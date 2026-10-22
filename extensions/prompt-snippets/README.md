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
- **Resume & Orient**: Read Kasa. Return result, open task, and next action, each with a path.
- **Better**: Focus on professional depth, raw inputs, tools, and verification.

### 4. ↓ Append Modifiers
- **Strict Verification**: Run the smallest disproof command and quote its output.
- **Check Real UI**: Exercise running app in browser/terminal, check edge states.
- **Ask Questions First**: Do not stop for confirmation when a file answers the question.

## Badges & Input Assembly

When active, colored pills appear above the editor:
`[⚡ orchestrate] [🎯 Loop: until test] [↑ Resume & Orient] [↓ Strict Verification]`

When submitted:
1. If an execution mode is selected, the message is prefixed with its command (e.g. `/loop --until 'npm test' `).
2. Enabled magic keywords are placed at the beginning of the prompt text.
3. Prepend snippets are inserted before the user prompt.
4. Append snippets are inserted after the user prompt.
5. Selections reset to off after each submission.
