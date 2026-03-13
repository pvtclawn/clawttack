# Replay Dependency-Marker Hardening Verification (2026-03-13 09:04 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify the replay dependency-marker hardening slice introduced in commit `a2c9fe2` (`feat(protocol): harden replay dependency markers`) for protocol/tooling scope.

This verification focuses on four claims only:
1. unsupported work cannot silently claim `independent` replay release,
2. dependency markers are prerequisite-bound to replay-critical authority state,
3. blocked replay work preserves machine-readable denial subreasons across restart,
4. the slice remains deterministic under scoped tests and protocol typecheck.

## Verification actions
1. Scoped replay-hardening test run:
   - `bun test packages/protocol/tests/tactic-output-capability-runtime-freshness-task1.test.ts`
   - Result: **48 pass / 0 fail**.
2. Protocol typecheck gate:
   - `bunx tsc --noEmit -p packages/protocol`
   - Result: pass.
3. Repo-state sanity at verification time:
   - `git rev-parse HEAD`
   - Result: `a2c9fe2e9a78ee481b47b4a83cddf75225a19ea7`
   - `git status --short`
   - Result: clean working tree before this verification artifact write.

## Acceptance mapping

### A. Independence-claim gating
Acceptance target:
- only explicitly safe work classes may claim `releaseClass: 'independent'`.

Observed evidence:
- test: `fails closed when unsupported work claims independent replay`
- result: pass.
- interpretation: unsupported work classes are kept quarantined with subreason `unsupported-independence-claim` instead of being silently released.

### B. Prerequisite-bound marker structure
Acceptance target:
- dependency validity must bind to `scopeKey`, `authoritySource`, `authorityEpoch`, `renewalGeneration`, and `prerequisiteId`.

Observed evidence:
- implementation path uses structured dependency-marker objects rather than loose free-form strings.
- tests exercising bound structure all pass:
  - `rejects dependency-marker reuse across mismatched scope`
  - `rejects dependency-marker reuse across mismatched authority epoch or renewal generation`
  - `rejects weak free-form dependency markers for protected work`
- interpretation: protected replay work now requires canonical prerequisite-bound marker structure to be considered causally releasable.

### C. Stronger replay denial diagnostics
Acceptance target:
- blocked replay work preserves a machine-readable underlying denial reason.

Observed evidence:
- tests pass for denial-subreason coverage including:
  - `mixed-snapshot-stale`
  - `authority-source-mismatch`
  - `insufficient-causal-closure`
  - `marker-mismatch`
  - `unsupported-independence-claim`
  - `marker-forgery`
  - `scope-mismatch`
- test: `persists denial reason for blocked replay work across restart`
  - result: pass.
- interpretation: restart-preserved quarantine state now keeps both top-level denial class and finer causal subreason.

### D. Deterministic replay release behavior
Acceptance target:
- valid independent work can still release,
- stale strict-order work remains blocked deterministically,
- replay release behavior is stable under restart/reload.

Observed evidence:
- tests pass for:
  - `can still release a valid independent second item behind a stale strict-order item`
  - `classifies a stale strict-order first item as causally stale`
  - `releases quarantined work only when the current recovery snapshot matches`
  - `preserves resume quarantine across restart`
- interpretation: the slice narrows false release paths without collapsing legitimate independent replay release.

## Verdict
This slice is **verified at protocol/tooling scope** for the intended hardening claims:
- fake independence is denied,
- prerequisite markers are state-bound and structured,
- weak free-form markers are rejected,
- denial subreasons persist across restart,
- deterministic scoped verification remains green.

## No-gas / no-on-chain rationale
No transaction was initiated in this heartbeat.

Reason:
- this slice modifies replay validation semantics inside protocol logic only,
- the current verification target is deterministic local correctness, not a contract deployment or settlement action,
- spending gas here would not increase confidence in the scoped claim being tested.

Classification:
- **verified no action needed** for on-chain mutation in this heartbeat.

## Explicit non-overclaim caveat
This verification does **not** prove:
- full transitive dependency closure,
- live scheduler fairness,
- production replay queue orchestration correctness,
- end-to-end runtime behavior outside the tested protocol/tooling scope.

It verifies a narrower claim: replay metadata is harder to forge/mislabel and blocked replay decisions are more diagnosable and restart-stable.

## Next Task
Lane D: synthesize concise reliability/community-facing status for replay dependency-marker hardening with explicit proof links, non-overclaim wording, and no-gas rationale.
