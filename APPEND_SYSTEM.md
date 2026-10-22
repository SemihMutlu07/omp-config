# Instruction delivery

User working agreements belong in the loaded AGENTS.md. This file carries OMP-only routing and adds no separate reply or skill policy.

# OMP-only routing

Loaded by OMP only. OpenCode and other harnesses must not receive this file.

## Harness scope

- These rules apply when OMP is the active harness. They do not select OMP for new work or override another harness.
- Use the active OMP configuration and loaded resources. Keep its sessions, credentials, and memory separate from Pi.
- Use a new OMP session to load instruction changes; do not restart unrelated sessions.

## Orchestration policy

- The planner, reviewer, and execution role map lives in `config.yml`. Read it there; do not restate provider or model IDs in prompts or in this file.
- Free OpenCode models may take bounded read-only or mechanical work; decisions, reviews, and commits stay in the OMP session. Opening OpenCode through OMP failed and is not the default route.
- Check the live usage of whichever role `config.yml` marks as planner before planner work and at checkpoints. When either window is near its limit, checkpoint and stop that role. Resume only after a fresh usage result confirms capacity; opening a session does not reset a provider limit.

## workflowz routing

- When the built-in `workflowz` keyword activates, use the current OMP role map. Do not hardcode provider or model IDs in prompts.
- Scope the task inline first. Use `workpool("scout", ...)` for substantial independent read-only research and `workpool("sonic", ...)` for strictly mechanical work.
- Use the default `workpool()` or `agent()` for implementation. Use `reviewer` for correctness review and `security-reviewer` for security review.
- Use `completion(..., model="smol")` for lightweight tool-free work and `completion(..., model="slow")` for substantial design proposals or difficult tool-free analysis. Use `completion(..., model="default")` for ordinary tool-free work.
- Use `judge_batch()` for bulk classification through the configured `judge` role. For `jevify`, freeze the rubric before loading the items.
- Respect the configured concurrency limit. Choose specialists per phase, verify their evidence, and exercise the changed behavior before completion.
- Role assignments do not automatically switch the main conversation or enable advisor mode. Do not enable advisor mode or change routing settings unless requested.
