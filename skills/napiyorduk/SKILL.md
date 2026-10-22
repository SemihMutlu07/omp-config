---
name: napiyorduk
description: Restores the point where the conversation stopped, without losing a live branch, and gives one decision or next move. Use when the user asks "napıyorduk?", "nerede kalmıştık?", or for a similar continuation reminder.
---

# Where we left off

1. Scan the conversation backward. Find the active goal, the last verified state, locked decisions and constraints, open options or blockers, and deferred live branches. Continue the scan when the previous turn's answer could change the next move.
2. Build a continuation capsule. Do not narrate the chronology. Compress the wording, not the scope. Do not drop a live branch whose removal would change the next move or the possible options. Do not mix completed, proposed, assumed, and unknown states. Do not decide for the user.
3. Reply only in this format:

**Where we left off:** <One sentence by default. Use 2–3 sentences when a material decision, constraint, blocker, or live branch would otherwise be lost.>

**Decision point:** <Give the one open choice that blocks continuation, in one sentence. If no decision is open, use the heading **Next move:** and give the next concrete reversible action.>

If the context cannot be extracted correctly, do not guess. State the last known point and the missing link in **Where we left off**. Give one action that verifies that link as the **Next move**.
