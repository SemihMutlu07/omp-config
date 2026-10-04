---
name: clarity
description: |
  Choose how to explain something, and climb only as far as needed. Use when the
  user asks to explain, teach, or clarify a topic ("açıkla", "anlat", "explain",
  "nedir", "bu ne demek", "anlamadım") and does not name a format. Picks the
  lowest rung that removes the confusion: short text, STE100 text, ASCII diagram,
  single-file HTML, video. Prevents explaining a one-line fact as a picture book.
---

# clarity — explain at the lowest rung that works

A wrong register costs more than a missing one. A picture book for a reader who already has
the vocabulary forces them to translate the analogy back. A dense paragraph for a reader who
has none leaves them with nothing. Match the rung to the reader, and climb only on evidence.

## The ladder

| # | Rung | Use when | Tool |
| - | ---- | -------- | ---- |
| 0 | Short plain text | The fact fits in a few lines | none |
| 1 | 80% STE100 text | Dense, procedural, or easy to misread | `ste100` skill |
| 2 | ASCII diagram | 3+ parts, or a flow between them | draw it in the chat |
| 3 | Single-file HTML | The reader has no words for the topic, or needs to step through it | one self-contained file |
| 4 | Explainer video | Explicit request only | — |

Start at 0. Stop at the first rung that answers the question.

## Rung 3 (HTML) shape

- One self-contained file: emoji, CSS, inline SVG only. No external fonts, images, or JS.
- Big pictures, short captions. The visual carries the meaning; the words caption it.
- Mobile-first, one column, generous spacing.
- Save to `~/<kebab-topic>.html`, then open it with `xdg-open`.
- One idea per panel. If a panel needs two sentences, split it.

## Rules

1. **Never climb to look thorough.** The artifact is a cost you charge the reader, not a gift.
2. **Climb only on a signal:** the user says it is still unclear, asks for a picture, or the
   text rung genuinely cannot carry the structure (a flow with 3+ parts is rung 2, not rung 1).
3. **Climbing is additive.** Keep the text answer and add the diagram. Do not replace a clear
   paragraph with a picture book.
4. **Match the reader, not the topic.** A harness or config question from this user is rung 0
   or 1. Rung 3 is for a reader who has no vocabulary at all.
5. **The artifact is disposable; the chat text is the answer.** Diagrams and HTML are aids,
   not evidence, and not a substitute for saying the thing.
6. **Do not announce the rung.** No "I'll explain this in STE100".

## Anti-patterns

- **Rung 3 for a rung 1 question.** Explaining "why does this config load twice" as an 8-panel
  picture book with a shopping-list analogy. The analogy adds a translation layer for a reader
  who already knows the domain.
- **Rung 1 as fragments.** "Two files. Header differs. Dedup breaks." Missing sentence parts
  is not STE; see `ste100`.
- **Climbing unprompted.** After the answer lands, offer the next rung in one line; do not
  produce it unasked.
