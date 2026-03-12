# Red-Team — Resume-Revalidation Contract (2026-03-12 22:12 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Scope
Red-team a resume-revalidation contract for stale queue replay, partial recovery, and restart-laundering failures in the freshness-authority path.

## Proposed target
When a runtime resumes after pause, suspension, or restart:
1. authoritative append service revalidates current authority state,
2. pre-pause admitted work is quarantined,
3. only work that still matches current epoch/generation/seal state may execute.

## Main question
Why might a resume-revalidation contract still fail even if it sounds conservative?

## Weakness 1 — Quarantine list exists, but execution paths can bypass it
### Failure mode
A system may define a "quarantine on resume" rule while still allowing direct or secondary execution paths to process old work items without passing through the quarantine check.

### Exploit path
- runtime resumes and marks queue as quarantined,
- secondary worker / retry loop / direct append path consumes pre-pause work anyway,
- stale work executes before full revalidation.

### Consequence
Resume-revalidation becomes policy theater; stale work still slips through the fastest path.

### Mitigation
- make quarantine enforcement part of the execution boundary, not just queue bookkeeping,
- require every authoritative mutation path to validate current resume/revalidation state,
- centralize release-from-quarantine logic.

### Acceptance criteria
1. pre-pause work cannot execute through any path before revalidation,
2. release from quarantine is centralized and auditable,
3. direct/secondary paths cannot bypass resume checks.

## Weakness 2 — Partial recovery can mix old queue state with new authority state
### Failure mode
Recovery may restore only part of the runtime: some queues/work descriptors from before the pause, some authority state from after it. That mixed snapshot can make old work look locally plausible.

### Exploit path
- queue restored from checkpoint A,
- authority state restored from checkpoint B,
- compatibility assumptions are not re-proven,
- old work executes against a mismatched authority view.

### Consequence
Resume appears successful while actually composing states that never coexisted safely.

### Mitigation
- bind queued work to explicit observed epoch/generation/seal state,
- require revalidation against a single current authority snapshot,
- reject work whose observed state cannot be reconciled with current state.

### Acceptance criteria
1. mixed-snapshot work is denied deterministically,
2. work items carry enough observed state to validate safely,
3. current recovery snapshot is treated as the sole authority source for resume decisions.

## Weakness 3 — Restart can launder stale assumptions into a clean slate
### Failure mode
A restart may clear volatile suspicion flags or queue metadata, making old work appear unproblematic simply because the process forgot why it was dangerous.

### Exploit path
- runtime seals / quarantines due to uncertainty,
- process restarts,
- volatile quarantine context disappears,
- pre-pause work is reintroduced as ordinary fresh work.

### Consequence
Restart becomes a laundering step for stale authority and unresolved ambiguity.

### Mitigation
- persist quarantine/revalidation context for pre-pause work,
- restart must restore the fact that work was admitted under older authority assumptions,
- restart alone must never convert quarantined work into trusted work.

### Acceptance criteria
1. restart preserves quarantine/revalidation status,
2. pre-restart stale work remains quarantined after reboot,
3. restart cannot clear suspicion/uncertainty context implicitly.

## Weakness 4 — Revalidation may check only freshness, not provenance
### Failure mode
A resume check that validates only current epoch/generation may still accept work whose original authority source/provenance is now untrusted or mismatched.

### Exploit path
- work item carries plausible epoch/generation,
- authority source or witness provenance changed across recovery,
- revalidation checks only number freshness,
- work resumes under mismatched provenance.

### Consequence
Stale or forged authority can re-enter through a superficially current queue item.

### Mitigation
- resume revalidation must include provenance/source binding,
- queue items should carry observed authority source as well as epoch/generation,
- mismatched provenance keeps work quarantined or denies it.

### Acceptance criteria
1. freshness without provenance is insufficient for resume,
2. source/provenance mismatch is a deterministic denial or continued quarantine,
3. resumed authoritative work must match current trusted authority source.

## Weakness 5 — Operational pressure can short-circuit revalidation after outages
### Failure mode
After a long outage, operators or code paths may prioritize draining backlog quickly and add a shortcut that resumes queued work before full checks complete.

### Exploit path
- outage creates backlog,
- service comes back,
- system chooses speed over correctness,
- quarantined work is released optimistically,
- stale authority mutates history.

### Consequence
The contract is correct in principle but collapses under the first serious backlog event.

### Mitigation
- make incomplete revalidation a hard stop for authoritative append,
- backlog draining may proceed only for work that passes current checks,
- any override must be explicit, auditable, and non-authoritative.

### Acceptance criteria
1. backlog pressure cannot bypass resume revalidation,
2. incomplete checks keep work quarantined,
3. override paths cannot mutate authoritative history silently.

## Bottom line
Resume-revalidation is the right direction, but only if it is treated as a **real re-entry barrier** rather than a best-effort queue hygiene feature. The cheapest failure modes are:
1. quarantine bypass through alternate execution paths,
2. mixed-snapshot partial recovery,
3. restart laundering stale assumptions,
4. freshness-only revalidation without provenance,
5. outage pressure short-circuiting checks.

## Recommended next build slice
Plan the smallest resume barrier contract with:
- persisted quarantine context,
- observed authority source + epoch/generation on queued work,
- single current recovery snapshot for revalidation,
- deterministic tests for restart-preserved quarantine, mixed-snapshot denial, and provenance-mismatch denial.

## Explicit caveat
This critique narrows the resume/recovery design surface but does not prove real pause detection or end-to-end runtime recovery correctness. It identifies the cheapest ways a “revalidate on resume” rule can still leak stale authority or wash away unresolved doubt.
