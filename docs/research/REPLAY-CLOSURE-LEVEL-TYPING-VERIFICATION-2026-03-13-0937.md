# Replay Closure-Level Typing Verification (2026-03-13 09:37 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify Task 1 from `docs/model/138-REPLAY-CAUSAL-RELEASE-NEXT-SLICES-2026-03-13.md` after commit `8b7abb6` (`feat(protocol): add replay closure-level typing`).

This verification is intentionally narrow. It checks only whether the new replay marker closure-level boundary is enforced deterministically in protocol logic.

## Claims under test
1. replay markers without explicit `closureLevel` fail closed,
2. `direct-prerequisite` markers cannot satisfy replay paths that explicitly require transitive closure,
3. `transitive-verified` remains structurally distinct and can satisfy the first transitive-only path,
4. the closure-level hardening did not break the surrounding replay-hardening test scope.

## Verification actions
1. Scoped replay-freshness test run:
   - `bun test packages/protocol/tests/tactic-output-capability-runtime-freshness-task1.test.ts`
   - Result: **51 pass / 0 fail**.
2. Protocol typecheck gate:
   - `bunx tsc --noEmit -p packages/protocol`
   - Result: pass.
3. Repo pointer / cleanliness check:
   - `git rev-parse HEAD` => `8b7abb6564deb1553830ed95412baf264243c0cd`
   - `git status --short` => clean working tree before writing this artifact.

## Acceptance mapping

### A. Missing closure level fails closed
Acceptance target:
- replay markers without an explicit closure level are rejected or normalized fail-closed.

Observed evidence:
- test: `fails closed when dependency markers omit an explicit closure level`
- result: pass.
- interpretation: markers missing `closureLevel` do not get silently treated as valid direct-prerequisite evidence.

### B. Direct prerequisite cannot impersonate transitive proof
Acceptance target:
- `direct-prerequisite` markers cannot satisfy any path requiring transitive closure.

Observed evidence:
- test: `does not let direct-prerequisite markers satisfy authority-transition replay`
- result: pass.
- interpretation: the first replay work class that requires stronger closure (`authority-transition`) remains blocked when only direct prerequisite evidence is available.

### C. Transitive-verified is structurally distinct and usable
Acceptance target:
- `transitive-verified` is distinguishable from `direct-prerequisite` in both types and persisted artifacts.

Observed evidence:
- marker structure now includes explicit `closureLevel`.
- test: `releases authority-transition replay only with transitive-verified markers`
- result: pass.
- interpretation: the stronger marker level is not decorative; it controls a real release boundary.

### D. Surrounding replay scope still behaves deterministically
Acceptance target:
- adding closure-level typing should not regress the earlier replay-hardening guarantees in the same test scope.

Observed evidence:
- full targeted file remains green at **51/51** after the closure-level change.
- previously added replay-hardening tests still pass in the same suite, including:
  - unsupported independence denial,
  - scope/epoch/generation marker mismatch denial,
  - restart-stable denial subreasons,
  - valid independent release path.
- interpretation: the closure-level slice tightened semantics without obviously regressing adjacent replay logic in this scoped protocol test file.

## Verdict
Task 1 is **verified at protocol/tooling scope** for its intended narrow claim:
- closure level is explicit,
- missing closure level fails closed,
- direct prerequisite evidence cannot silently upgrade into transitive proof,
- transitive-verified markers can satisfy the first explicit transitive-only replay path.

## No-gas / no-on-chain rationale
No transaction or attestation was initiated in this heartbeat.

Reason:
- this slice changes deterministic protocol semantics only,
- the confidence gain comes from test/typecheck evidence, not from a chain write,
- spending gas here would not strengthen the scoped claim being verified.

Classification:
- **verified no action needed** for on-chain mutation in this heartbeat.

## Explicit non-overclaim caveat
This verification does **not** prove:
- full transitive dependency proof,
- multi-hop closure derivation,
- apply-time idempotence binding,
- concurrent recovery-frontier freshness,
- production replay-orchestration correctness.

It verifies a narrower boundary: direct prerequisite evidence cannot be silently consumed as transitive closure in the current protocol logic.

## Next Task
Lane D: synthesize a concise reliability/community-facing status for closure-level typing with proof links, explicit non-overclaim wording, and no-gas rationale.
