# Red-Team — Uncertainty-Triggered Seal Contract (2026-03-12 20:47 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Scope
Red-team an uncertainty-triggered seal contract for stale witness, timeout false-positive, and ambiguous authority evidence failures in the refusal-first freshness-authority path.

## Proposed target
When authority confidence is lost or becomes ambiguous, the runtime seals the scope and refuses authoritative append until fresh authority proof is re-established.

## Main question
Why might an uncertainty-triggered seal contract still fail even if it sounds maximally conservative?

## Weakness 1 — Timeout false-positive can deadlock liveness without actually improving safety
### Failure mode
In a partially synchronous system, timeout does not prove authority loss. If every timeout immediately seals without any distinction between suspicion and confirmed loss, healthy runtimes can repeatedly self-disable.

### Exploit path
- transient delay or GC pause triggers witness timeout,
- runtime seals scope,
- authority was never actually lost,
- repeated false positives create chronic no-service behavior.

### Consequence
The design remains safe-ish in the narrow sense but becomes operationally brittle and trivially griefable through latency spikes.

### Mitigation
- treat timeout as a seal trigger for authoritative append, but classify it explicitly as **suspected uncertainty**,
- require deterministic revalidation path instead of manual operator guesswork,
- track seal cause so false-positive recovery is auditable.

### Acceptance criteria
1. timeout-triggered seal reason is explicit and machine-readable,
2. same scope can deterministically revalidate and recover without ad hoc cleanup,
3. repeated timeout seals are observable and bounded rather than silently flapping.

## Weakness 2 — Ambiguous evidence normalization can hide contradiction
### Failure mode
If conflicting authority evidence is collapsed too early into a single boolean like `witnessMissing=true`, the system loses the ability to distinguish “no witness,” “stale witness,” and “contradictory witness.”

### Exploit path
- runtime sees two inconsistent authority observations,
- normalization compresses them into generic uncertainty,
- unseal/recovery path lacks enough detail to prove which contradiction must be resolved.

### Consequence
The system may oscillate, recover incorrectly, or mask real split-brain indicators as ordinary witness loss.

### Mitigation
- preserve evidence class explicitly: `missing`, `stale`, `conflicting`, `scope-mismatch`, `epoch-regression`,
- seal reason should retain the strongest contradictory signal seen,
- recovery contract should require the contradiction class to be cleared, not just any witness to appear.

### Acceptance criteria
1. contradictory evidence class is distinguishable from missing evidence,
2. scope mismatch / epoch regression are not downgraded to generic timeout,
3. recovery path consumes the correct evidence class before unsealing.

## Weakness 3 — Seal can happen too late relative to append execution
### Failure mode
If uncertainty is detected asynchronously while append requests are already in flight, authoritative writes can land after the system should have stopped serving.

### Exploit path
- append admitted while witness is still considered healthy,
- witness refresh fails moments later,
- scope seals,
- in-flight append still commits because execution path never re-checks seal state.

### Consequence
The system claims fail-stop semantics but still leaks writes across the uncertainty boundary.

### Mitigation
- check seal/uncertainty state at execution boundary, not only admission,
- quarantine queued/in-flight append work on seal transition,
- include uncertainty epoch or seal-generation in execution context so stale admitted work is invalidated.

### Acceptance criteria
1. append re-checks seal state before durable write,
2. seal transition invalidates pre-seal queued work deterministically,
3. uncertainty epoch mismatch denies stale in-flight execution.

## Weakness 4 — Restart can erase uncertainty context while preserving only the seal bit
### Failure mode
Persisting only `sealed=true` without the evidence class / last authority observation makes restart-safe refusal weaker than it appears.

### Exploit path
- runtime seals on conflicting authority evidence,
- restart preserves sealed bit but loses contradiction details,
- operator or code path unseals using a superficially plausible witness,
- the original contradiction is forgotten.

### Consequence
Safety history is truncated; restart becomes a laundering step for unresolved ambiguity.

### Mitigation
- persist seal reason class and relevant last-authority metadata alongside the seal bit,
- require unseal proof to exceed or explicitly resolve the persisted uncertainty state,
- treat restart as continuity of doubt, not a fresh start.

### Acceptance criteria
1. sealed-state persistence includes uncertainty class and epoch metadata,
2. unseal logic evaluates against persisted uncertainty context,
3. restart cannot simplify contradictory evidence into generic absence.

## Weakness 5 — Operational pressure may reintroduce fail-open exceptions
### Failure mode
When availability pain becomes visible, teams often add “temporary override” or “trusted local mode” to bypass seals during outages.

### Exploit path
- authority witness unavailable,
- service pressure mounts,
- implementation adds emergency bypass to keep appends flowing,
- uncertainty-triggered safety boundary collapses exactly when most needed.

### Consequence
The design is correct on paper but not in production culture.

### Mitigation
- make authoritative append override impossible or extremely explicit and separately auditable,
- if degraded mode exists, restrict it to read-only / diagnostic behavior,
- encode no-fail-open behavior in the contract, not just policy prose.

### Acceptance criteria
1. authoritative append has no implicit degraded fallback,
2. any override path is explicit, auditable, and out of normal execution,
3. diagnostic/read-only mode cannot mutate consumed-digest authority history.

## Bottom line
Uncertainty-triggered sealing is the right direction, but only if uncertainty remains **structured, persistent, and execution-enforced**. The cheapest failure modes are:
1. timeout false-positive causing liveness collapse,
2. contradictory evidence normalized away,
3. seal arriving too late for in-flight append work,
4. restart erasing uncertainty context,
5. operational pressure reintroducing fail-open append.

## Recommended next build slice
Plan the smallest uncertainty-state contract with:
- explicit uncertainty classes,
- persisted uncertainty metadata alongside seal state,
- execution-time re-check against seal/uncertainty epoch,
- deterministic tests for conflicting evidence, restart-preserved uncertainty, and stale admitted work after seal transition.

## Explicit caveat
This critique narrows the authority-uncertainty design surface but does not prove live partition safety or failure-detector correctness. It identifies the cheapest ways a “seal on uncertainty” rule can still leak contradictory authority or collapse under operational pressure.
