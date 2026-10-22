---
name: tern
description: Use when inspecting, automating, or interacting with Tern terminal sessions, tabs, boards, whiteboards, or plugins.
---

# Tern Terminal & Surface Automation

Tern is a native multiplexing terminal and block environment (Stencil). It exposes a CLI and an embedded Luau plugin system.

## 1. Instant Session & Surface Discovery

NEVER search the disk with `find` to locate open files, task boards, or active tabs. Tern exposes its complete live state via its CLI:

```bash
# Fast JSON dump of all sessions, tabs, and open blocks in one call
tern inspect --json
```

Key fields in `tern inspect --json`:
- `sessions[].tabs[].blocks[]`: Each block shows its kind and path:
  - `board`: Path to open Markdown Kanban board (e.g. `/tmp/TODO.md`).
  - `canvas`: Unique canvas identifier (e.g. `canvas:83d47d8e...`).
  - `program`: Running process (e.g. `/usr/bin/bash`).
  - `focused`: `true` if currently in focus.
  - `omp_session_file`: Path to the active OMP agent transcript file.

To get a human-readable summary of running tabs:
```bash
tern ls
```

## 2. Reading and Interacting with Blocks

```bash
# For board blocks: read the file path reported in `tern inspect --json` under `board`
# For terminal/agent panes: capture scrollback/surfaces
tern capture @focused --scrollback --surfaces

# Open a file beside the active pane
tern open --split right <PATH>

# Open a diagram or file in the tab's preview block
tern open --preview <PATH>
```

## 3. Block Kinds in Tern

Tern distinguishes several distinct visual surfaces:
- **`terminal` / `agent`**: PTY shells and native OMP agent streams.
- **`file`**: Syntax-highlighted text editor with diff view.
- **`board` (`cx.board`)**: Native Markdown Kanban/task board (parsed from markdown lists/lanes).
- **`canvas` (`cx.whiteboard`)**: Infinite 2D vector whiteboard. Supports shapes, arrows, text, and embedded local images (`type = "image", path = ...`). Camera framing uses `op = "show", x = top_left_x, y = top_left_y, w = width, h = height`.
- **UI Canvas (`cx.canvas`)**: Persistent structured UI panels (cards, tables, progress meters). Not an infinite vector canvas.

## 4. Plugins & Types

Plugins live in `~/.config/tern/plugins/<plugin-id>/`:
- Manifest: `plugin.toml` (`schema = 1`, `id`, `name`, `version`, `window = "window.luau"`, `host = "host.luau"`).
- Types generation: `tern plugin types <DIR>` writes `tern.d.luau` for `luau-lsp`.
- Hot-reload: `tern plugin reload` reloads all daemon and window plugin VMs.

Official documentation: `https://docs.stencil.so/tern/`
Local binary docs: `tern --help`, `tern plugin --help`, `tern help dev`
