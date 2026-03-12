# Red-Team — Monotonic-Timer Lease Contract (2026-03-12 21:42 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Scope
Red-team a monotonic-timer lease contract for clock-step, timer drift, and stale lease replay failures in the freshness-authority path.

## Proposed target
- lease/suspicion timing uses local monotonic clocks only,
- wall-clock timestamps are observational only,
- timeout-based suspicion seals scope,
- stale authority remains fenced by epoch/provenance rules.

## Main question
Why might a monotonic-timer lease contract still fail even if it avoids wall-clock traps?

## Weakness 1 — Monotonic clocks solve backward-time bugs, not timer calibration
### Failure mode
A monotonic clock can still be used with bad timeout values, renewal margins, or grace windows. If thresholds are too aggressive or too lax, the system can flap or tolerate stale authority longer than intended.

### Exploit path
- renewal window too short under normal pauses/load,
- healthy runtime repeatedly suspects authority loss,
- or lease duration too long and stale actor keeps acting long after it should stop.

### Consequence
The contract is technically monotonic but practically unsafe or brittle.

### Mitigation
- make timer parameters explicit and testable,
- separate suspicion threshold from hard stale-authority rejection rules,
- simulate pauses/drift against chosen windows.

### Acceptance criteria
1. timeout/renewal parameters are explicit, not hidden constants,
2. pause/drift tests exist for threshold behavior,
3. timer tuning errors cannot silently change authority semantics.

## Weakness 2 — Monotonic time is only local; leases still need cross-runtime meaning
### Failure mode
Each runtime’s monotonic clock is internally consistent but incomparable across machines/processes. A lease protocol can still fail if it assumes local monotonic durations imply shared lease truth.

### Exploit path
- writer A and writer B each reason from their own monotonic elapsed time,
- both believe their lease state is current,
- no shared authority witness resolves the disagreement,
- split-brain authority persists despite correct local timers.

### Consequence
Monotonic clocks prevent local clock bugs but do not by themselves create distributed authority agreement.

### Mitigation
- keep monotonic timers as local suspicion/expiry inputs only,
- require shared authority witness / epoch progression for cross-runtime authority truth,
- do not treat local monotonic lease expiry as globally dispositive.

### Acceptance criteria
1. local timer expiry alone cannot authorize continued global authority,
2. cross-runtime authority decisions remain witness/epoch-bound,
3. split-brain cannot be “solved” by independent local timers alone.

## Weakness 3 — Stale lease replay can bypass timer discipline if lease artifacts outlive intent
### Failure mode
A previously valid lease/witness object can be replayed after expiry if the system checks format and epoch weakly but fails to tie it to current renewal state.

### Exploit path
- runtime captures previously valid lease artifact,
- local timer state advances, authority should expire,
- stale lease artifact is replayed through a path that ignores renewal freshness,
- actor regains apparent authority.

### Consequence
The system uses monotonic clocks correctly yet still accepts stale authority evidence.

### Mitigation
- bind lease artifacts to renewal epoch / generation,
- require current epoch/provenance checks at execution time,
- invalidate stale lease material once renewal state advances.

### Acceptance criteria
1. stale lease artifact is rejected after renewal epoch advances,
2. execution-time checks validate current renewal generation,
3. lease replay cannot revive fenced authority.

## Weakness 4 — Process pause / resume can create lease illusions
### Failure mode
A runtime paused by GC, suspension, or host starvation may wake up and act on cached local lease assumptions before observing that authority has expired elsewhere.

### Exploit path
- runtime holds plausible local lease state,
- process sleeps/pauses,
- on resume, queued work executes before authority refresh occurs,
- stale authoritative actions leak through.

### Consequence
Monotonic timers keep counting, but the runtime still needs a revalidation barrier on resume/execution.

### Mitigation
- re-check lease/authority state at execution boundary,
- treat long pauses as suspicion triggers requiring revalidation,
- invalidate queued work admitted before pause if current authority proof is stale.

### Acceptance criteria
1. post-pause append revalidates authority before execution,
2. long pause can trigger deterministic seal/revalidation,
3. queued stale work after pause is denied.

## Weakness 5 — Wall-clock data can creep back into safety via “helpful” debugging logic
### Failure mode
Even if the formal contract says wall clock is observational only, implementation shortcuts may quietly use wall-clock timestamps for freshness checks, cache eviction, or fallback recovery logic.

### Exploit path
- debug/recovery helper compares wall-clock timestamps,
- clock step backward/forward changes freshness outcome,
- stale authority regains plausibility or fresh authority gets sealed incorrectly.

### Consequence
The design looks monotonic on paper while real code still smuggles wall-clock truth into safety decisions.

### Mitigation
- isolate wall-clock fields from authority decisions by type/interface,
- add explicit tests where wall-clock timestamps jump but authority outcome must not change,
- audit authoritative paths for elapsed-time source.

### Acceptance criteria
1. authoritative freshness logic has no dependency on wall-clock deltas,
2. clock-step simulation does not change authority outcome,
3. debug/log timestamps cannot influence append or recovery decisions.

## Bottom line
Monotonic timers are necessary, but not sufficient. The cheapest remaining failure modes are:
1. bad timer calibration,
2. treating local timer state as global lease truth,
3. stale lease replay after renewal,
4. process pause/resume leakage,
5. wall-clock data creeping back into safety logic.

## Recommended next build slice
Plan the smallest timer contract with:
- explicit timer parameters,
- lease generation / renewal epoch binding,
- execution-time revalidation after pause or epoch advance,
- clock-step simulation tests proving wall-clock irrelevance,
- no local-timer-only global authority decisions.

## Explicit caveat
This critique narrows the timer/lease design surface but does not prove live lease correctness, timer calibration quality, or network-partition safety. It identifies the cheapest ways a "monotonic-timer" label can still leave stale authority alive.
