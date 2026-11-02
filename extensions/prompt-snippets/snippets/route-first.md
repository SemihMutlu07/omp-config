---
name: Route First
description: Okumadan önce rota seç: direct / prewalk / primary / scout
placement: prepend
order: 5
alias: route
---
Before your first tool call, write one line: `Route: direct | prewalk | primary | scout-first — <reason>`.
- `direct`: trivial, mechanical, or fully specified edit; explanation; read-only question. Just do it.
- `prewalk`: the hard thinking comes first (trace an unfamiliar subsystem, diagnose down to a concrete fix), then the implementation is bounded. Ask me to run `/prewalk` before your first edit. You cannot start it.
- `primary`: strong reasoning is still needed while implementing or validating (races, invariants, unclear cause, high risk). Stay on this model. Do not suggest prewalk.
- `scout-first`: you only need to locate code and would read more than 3 files. Send the reads to a scout and work from its summary.
Task size alone never makes a task `prewalk`. When unsure between `prewalk` and `primary`, choose `primary`.
