# Verification-Claim Trace State-Machine Gate — Red-Team Report (2026-03-10)

## Scope
Review target:
- `docs/model/052-VERIFICATION-CLAIM-TRACE-STATE-MACHINE-PLAN-2026-03-10.md`

Goal: identify how a malicious or rushed workflow could satisfy trace shape checks while still overclaiming or bypassing real gate execution.

## Findings

### 1) Forged intermediate steps
**Vector:** fabricate caveat/triangulation steps with plausible reason codes and hashes.

**Failure mode:** trace passes if validator checks shape but not execution provenance.

**Mitigation:** require deterministic execution markers per step (`step-provenance-invalid` on mismatch).

---

### 2) Historical trace replay
**Vector:** replay old valid trace with edited envelope metadata.

**Failure mode:** stale decision path accepted as current claim.

**Mitigation:** bind every step to claim-id + input-root + timestamp/freshness policy; fail `trace-replay-detected`.

---

### 3) Selective-step omission
**Vector:** skip required phase and synthesize aggregate from partial chain.

**Failure mode:** mandatory checks bypassed while retaining contiguous indexes.

**Mitigation:** required phase set hard-fail with `claim-gate-trace-missing-step`; aggregate must reference exact predecessor phase set.

---

### 4) Step-order shadowing / ambiguity
**Vector:** duplicate phase/index records and exploit parser precedence.

**Failure mode:** validator and auditor reconstruct different traces.

**Mitigation:** uniqueness constraints for `(claimId, stepIndex)` and `(claimId, phase)`; fail `trace-ambiguity-detected`.

---

### 5) Cross-claim hash grafting
**Vector:** splice hash-chain fragments from different claim executions.

**Failure mode:** local chain checks pass but provenance is cross-contaminated.

**Mitigation:** domain-separated chaining input includes `claimId|phase|stepIndex|inputRoot|prevHash`; fail `trace-domain-separation-fail`.

## Proposed hardening tasks
1. Add step provenance + replay resistance binding (`claimId`, `inputRoot`, freshness).
2. Add strict phase/index uniqueness + required-phase completeness enforcement.
3. Add domain-separated hash-chain contract for trace-step linkage.

## Acceptance criteria for next lane
- Forged-step fixture fails deterministically.
- Replay fixture with stale/foreign claim binding fails deterministically.
- Missing-phase fixture fails deterministically.
- Duplicate-step ambiguity fixture fails deterministically.
- Cross-claim graft fixture fails deterministically.
