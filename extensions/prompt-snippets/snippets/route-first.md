---
name: Route First
description: "Okumadan önce rota seç: direct / primary"
placement: prepend
order: 5
alias: route
---
Before your first tool call, write one line: `Route: direct | primary — <reason>`.
- `direct`: trivial, mechanical, or fully specified edit; explanation; read-only question. Just do it.
- `primary`: strong reasoning is still needed while implementing or validating (races, invariants, unclear cause, high risk). Stay on this model and read the relevant code before editing.
When unsure between the two, choose `primary`.
