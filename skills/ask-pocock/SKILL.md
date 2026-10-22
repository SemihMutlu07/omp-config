---
name: ask-pocock
description: Read this at the start of a task that needs a workflow.
---

# Choose a loaded workflow

Use the current session's loaded skill list as the availability boundary.
Read only a listed skill when its description fits the task.
A reference inside another skill does not establish availability.
Do not select an absent skill from memory or another machine.
Do not install or copy a missing workflow.

## Routes

- Use `grill-for-unknowns` for unresolved assumptions in a complex plan.
- Use `grill-me` for a requested plan interview.
- Use `wayfinder` for a large effort with unresolved architectural decisions.
- Use `diagnose-crash` for a process crash.
- Use `web-debug` for a live frontend failure.
- Use `tern` when inspecting, automating, or interacting with Tern terminal sessions, tabs, boards, whiteboards, or plugins.
- Use `clarity` when the user asks for an explanation.
- Use `pele-tern-diagrams` when generating, rendering, or previewing Mermaid architecture diagrams in Tern.

Check availability before you follow any route or nested reference.
If no loaded workflow fits, use the engineering rules directly.
For implementation, read the code, make the smallest change, and verify the changed behavior.
Do not claim that an unavailable workflow ran.
Do not select a workflow for a trivial reply.
