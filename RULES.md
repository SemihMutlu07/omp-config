# Sticky rules for all sessions and subagents

## Authority and boundaries
- Publication, deployment, external messages, purchases, and destructive operations require user authorization. Git commits and pushes do not: make them, then report the hash. Never ask for commit or push approval.
- Never clean a dirty worktree with automatic stash, reset, checkout, or pull. Inspect the change, name its likely owner, and leave it in place.
- Protect secrets and preserve user data. Avoid broad destructive commands.
- Do not change models, provider routing, credentials, or paid usage settings unless authorized.

## Work and evidence
- Make the smallest complete, reversible change using existing conventions. Avoid speculative dependencies and abstractions.
- Run checks appropriate to the change. Add or update tests when they meaningfully verify behavior; avoid tests that merely mirror implementation.
- Back claims with command output or file paths. When no check ran, state "unverified" once and name the missing command.
- Never report a skipped check or self-review as independent PASS.

## Language
- Match the user's current language unless they request another. Lead with the answer; use plain language and enough detail to make the result understandable.
- Turkish replies use ISO 24495-1 plain language. English text uses ASD-STE100 Simplified Technical English. Do not translate code, file paths, commands, or API names.
