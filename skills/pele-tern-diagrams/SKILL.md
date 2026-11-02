---
name: pele-tern-diagrams
description: Generate and preview Mermaid diagrams in the default browser using local Pele rendering.
---

# Pele Diagram Workflow

Generate and preview Mermaid diagrams in the default browser using local Pele rendering.

## Constraints & Pitfalls
- **Browser Preview Background**: Ensure diagrams are readable on standard browser themes. Prefer explicit themes or neutral backgrounds.
- **Pele Parser Limitations**: `pele.js` often crashes or fails on non-trivial `sequenceDiagram` syntax. Prefer `flowchart LR` or `graph TD`.
- **Pele Return Value**: `pele.render()` returns a markdown string wrapped in json code fences. You must strip fences and JSON parse to get `{ svg: "..." }`.
- **Preview Cache**: Tern caches previews by file path. Write to timestamped or revision-tagged file paths (e.g. `${PELE_OUT_DIR:-$HOME/.cache/pele}/diagram-v1.svg`), never a fixed `/tmp/<name>` path.
- **Verification**: Always convert the SVG to PNG using `rsvg-convert` or ImageMagick `magick` and inspect the result before reporting completion.
