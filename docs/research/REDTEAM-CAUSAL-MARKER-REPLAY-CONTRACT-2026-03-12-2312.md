# Red-Team — Causal-Marker Replay Contract (2026-03-12 23:12 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Scope
Red-team a causal-marker replay contract for dependency-marker abuse, false independence claims, and partial-order loopholes in the freshness-authority replay path.

## Proposed target
Queued/resumed work uses explicit causal markers so dependency-sensitive items can be distinguished from independent ones, allowing partial-order replay instead of one blanket total-order queue.

## Main question
Why might a causal-marker replay contract still fail even if it is more expressive than simple queue order?

## Weakness 1 — False independence claims can bypass necessary ordering
### Failure mode
A work item may declare itself `independent` even though it actually depends on a prior authority transition.

### Exploit path
- item is labeled `independent`,
- replay logic permits release under current-state validation alone,
- hidden dependency was not satisfied,
- stale or invalid work executes ahead of the transition it required.

### Consequence
The system preserves liveness by accident while silently violating causal safety.

### Mitigation
- treat `independent` as a privileged claim that must be justified by item type / schema,
- default ambiguous work to dependency-sensitive handling,
- deny items whose independence cannot be justified by contract semantics.

### Acceptance criteria
1. ambiguous work cannot self-declare independence without validation,
2. unsupported `independent` claims fail closed,
3. only explicitly safe classes may bypass dependency checks.

## Weakness 2 — Dependency markers can be too weak or forgeable
### Failure mode
A dependency marker that is just a loose string or label can be copied, guessed, or reused outside the transition it is supposed to represent.

### Exploit path
- stale item reuses a dependency marker from another context,
- replay logic sees matching marker text,
- item is released even though the referenced prerequisite is not truly the same event/state.

### Consequence
Causal validation collapses into string-matching theater.

### Mitigation
- bind dependency markers to canonical scope + authority epoch/generation + prerequisite identity,
- require markers to be derived from authoritative state rather than free-form labels,
- reject markers lacking enough binding context.

### Acceptance criteria
1. marker reuse across mismatched scope/epoch is rejected,
2. dependency marker must encode/bind to prerequisite identity explicitly,
3. weak/free-form markers are not accepted for protected work.

## Weakness 3 — Partial-order semantics can still hide transitive dependencies
### Failure mode
A work item may appear independent from one blocked item while still depending indirectly on another earlier transition not represented in the simplified marker model.

### Exploit path
- queue item B appears unrelated to stale item A,
- B actually depends on transition C which itself depended on A,
- simplified replay model releases B because it sees no direct edge,
- replay violates transitive causal constraints.

### Consequence
The system is dependency-aware, but only shallowly; non-local causal structure leaks through.

### Mitigation
- make dependency markers represent prerequisite state, not just immediate predecessor labels,
- keep model explicit about what depth of causality is represented,
- fail closed when dependency closure cannot be established for protected work.

### Acceptance criteria
1. transitive prerequisite absence is not mistaken for independence,
2. replay contract states whether markers encode direct or prerequisite-complete dependency,
3. insufficient closure information keeps protected work quarantined.

## Weakness 4 — Marker mismatch reasons can be too coarse for safe recovery
### Failure mode
If all blocked dependency-sensitive work is labeled simply `causally-stale`, operators and code cannot distinguish between missing prerequisite, wrong prerequisite, forged marker, or scope mismatch.

### Exploit path
- multiple causal failure classes collapse into one bucket,
- recovery path replays with the wrong fix or retry strategy,
- stale work oscillates between quarantine and release attempts without resolving the real cause.

### Consequence
The contract is safe-ish but operationally opaque; recovery becomes trial-and-error.

### Mitigation
- preserve richer denial classes beneath the top-level decision,
- persist marker-failure reason (`missing-prerequisite`, `marker-mismatch`, `marker-forgery`, `scope-mismatch`),
- use explicit reason codes in replay diagnostics.

### Acceptance criteria
1. causally blocked items retain machine-readable underlying denial reason,
2. restart preserves the reason class,
3. recovery tooling can distinguish “need more state” from “bad marker”.

## Weakness 5 — Operational pressure may relabel blocked work as independent
### Failure mode
When backlog grows, teams may be tempted to manually override blocked dependency-sensitive items by relabeling them as independent to unblock throughput.

### Exploit path
- stale strict-order item blocks progress,
- operator/code path changes release class or drops dependency marker,
- replay system releases previously blocked work,
- stale authority re-enters under administrative convenience.

### Consequence
The causal model is correct in theory but bypassable in practice.

### Mitigation
- make release-class changes explicit, audited, and non-authoritative by default,
- prevent silent mutation of causal metadata in normal replay paths,
- keep authoritative replay policy immutable at runtime unless a separate audit channel is used.

### Acceptance criteria
1. release-class changes are explicit and auditable,
2. ordinary replay path cannot silently mutate dependency metadata,
3. blocked dependency-sensitive work cannot be force-released by relabeling convenience.

## Bottom line
Causal-marker replay is the right direction, but only if it is also:
1. strict about who may claim independence,
2. strong in how markers bind to prerequisite identity,
3. explicit about transitive dependency coverage,
4. rich in persisted denial reasons,
5. resistant to operational relabeling shortcuts.

## Recommended next build slice
Plan the smallest causal-marker contract with:
- validated independence classes,
- stronger prerequisite-bound dependency markers,
- explicit denial subreasons for causal blocking,
- deterministic tests for fake independence, marker reuse across scope/epoch, and transitive-dependency ambiguity.

## Explicit caveat
This critique narrows the causal-marker design surface but does not prove live dependency inference or end-to-end causal replay correctness. It identifies the cheapest ways a partial-order replay system can still misclassify stale work or be bypassed operationally.
