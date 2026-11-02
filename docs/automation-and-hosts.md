# Automation and host operations

Operational rules for host identification, scheduled capture timers, and multi-session work.

## Determining machine role

- Determine which machine is the writer from its active timers plus local commit evidence, not from its hostname, label, or stated intent.
- Record disabled, failed, and missing units explicitly; a retired timer is a decision, an absent one is often an accident.

## Timer audits and capture jobs

- Audit a timer with `list-timers`, the service journal, and its `enabled`/`failed` state together. A schedule entry alone does not prove a recent successful run, and a missing unit file fails silently at the next trigger.
- Verify a scheduled job end to end: run the service once, read its journal, and confirm the artifact it claims to write. A oneshot exit code 0 does not prove the push, commit, or file write happened.
- A capture job that stages one directory still commits anything already staged. Check the index before it commits, and never let a capture widen the scope of someone else's work.
- When capture commits cannot reach the remote, report the exact ahead/behind state and keep the local commit. Do not force-push, reset, or drop it, and do not rebase over another session's uncommitted file.
- When two sessions write the same board or queue, assign task ownership and file ownership explicitly. Parallel sessions are not separate work by default.
