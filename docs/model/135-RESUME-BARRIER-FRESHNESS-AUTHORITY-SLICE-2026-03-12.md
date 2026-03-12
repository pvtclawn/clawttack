# 135 — Resume Barrier Freshness Authority Slice (2026-03-12)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Verification boundary: `docs/research/TIMER-BOUND-FRESHNESS-LEASE-VERIFICATION-2026-03-12-2157.md`
- Learning note: `docs/research/SAFE-RESUMPTION-LEARNING-FRESHNESS-AUTHORITY-2026-03-12-2207.md`
- Red-team report: `docs/research/REDTEAM-RESUME-REVALIDATION-CONTRACT-2026-03-12-2212.md`

## Goal
Turn the resume-revalidation idea into the **smallest buildable resume barrier contract** that preserves quarantine context across restart, prevents mixed-snapshot stale work from slipping through, and requires provenance-aware re-entry before authoritative append resumes.

## Why this slice next
The timer-bound lease slice already models pause-triggered stale-work denial in simulation. The next cheap failure class is stale queued work or partially recovered runtime state bypassing those protections during resume/restart.

## Smallest buildable milestone
Ship a protocol/runtime simulation slice with:
1. a persisted **resume quarantine state** per canonical scope,
2. work items carrying observed authority source + epoch/generation,
3. a **single current recovery snapshot** check for resume release,
4. deterministic tests for **mixed-snapshot denial**, **restart-preserved quarantine**, and **provenance-mismatch denial**.

No live queue runner, no real pause detector, no distributed recovery protocol in this slice.

## Task A — Resume quarantine contract
### Scope
Define the minimal persisted state required to keep pre-pause work quarantined until it is revalidated.

### Minimum state
- `scopeKey`
- `quarantined: boolean`
- `quarantineReason`
- `quarantineEpoch`
- `quarantineGeneration`
- `authoritySource`
- `quarantinedAt`

### Rules
- quarantine state survives restart,
- restart does not turn quarantined work into fresh work,
- quarantine uses the same canonical scope key as authority and append state.

### Acceptance criteria
1. restart preserves quarantine status,
2. quarantined work cannot execute before release,
3. scope alias mismatch cannot bypass quarantine.

## Task B — Provenance-aware resume revalidation
### Scope
Release from quarantine only when observed work state matches one current recovery snapshot with valid provenance.

### Required checks
- current scope matches canonical `scopeKey`,
- observed authority source matches current trusted source,
- observed epoch/generation are current enough for the protected path,
- resume decision is based on one current recovery snapshot, not mixed local leftovers.

### Acceptance criteria
1. provenance mismatch keeps work quarantined or denies it,
2. mixed-snapshot stale work is denied deterministically,
3. valid current snapshot can release matching work.

## Task C — Execution-boundary resume barrier
### Scope
Ensure no secondary/direct path can run quarantined work before resume checks complete.

### Required behavior
- authoritative append path rejects quarantined work unless explicitly released,
- release is centralized and auditable,
- missing revalidation context fails closed.

### Acceptance criteria
1. direct append path cannot bypass quarantine,
2. missing resume context yields deterministic denial,
3. release-from-quarantine logic is separate from ordinary append logic.

## Task D — Deterministic test plan
### Required tests
1. **Restart-preserved quarantine**
   - quarantine scope/work,
   - restart store,
   - work still blocked.
2. **Mixed-snapshot denial**
   - work observed under older epoch/generation/source,
   - current recovery snapshot differs,
   - release denied.
3. **Provenance mismatch denial**
   - freshness numbers plausible but authority source differs,
   - release denied.
4. **Valid current snapshot releases work**
   - matching scope/source/epoch/generation,
   - release succeeds,
   - work can proceed.
5. **No implicit backlog drain**
   - quarantined work without explicit release remains blocked.

## Out of scope
- live queue orchestration,
- process pause detection,
- distributed recovery protocol,
- real multi-process resume races,
- executor side-effect atomicity,
- power-loss proof.

## Definition of done
This slice is done when resumed work must pass a provenance-aware release barrier against one current authority snapshot, and restart can no longer launder quarantined stale work into fresh work.

## Next Task
Lane B: implement Task A + Task B together as the smallest executable slice — persisted resume quarantine state + provenance-aware release checks + deterministic mixed-snapshot / provenance-mismatch tests.

## Non-overclaim caveat
Even after this lands, the system will still not have proven live pause detection or end-to-end recovery correctness. This milestone should be framed as **resume barrier hardening**, not production-ready recovery coordination.
