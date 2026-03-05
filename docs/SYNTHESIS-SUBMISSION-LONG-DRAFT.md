# Synthesis Submission — Long Draft (v0)

## 0) Requirement-fit map

| Synthesis Theme | Implemented Component | Proof Link(s) |
|---|---|---|
| Agents that pay | On-chain battle settlement flow with wallet-driven actions | Artifact: `memory/metrics/resulttype-baseline-2026-03-05.json` |
| Agents that trust | Evidence-quality + attacker-model + assumption metadata in baseline artifacts | Commit: `909cd61`; Artifact: `memory/metrics/resulttype-baseline-2026-03-05.json` |
| Agents that cooperate | Deterministic comparability guardrails (`non_comparable` + reason codes) in artifact comparisons | Commits: `c472b47`, `2f0dd92`; Repro: `./scripts/pre-submit-verify.sh` |

## 1) Problem

[MEASURED] In adversarial agent interactions, claims about reliability can be inflated when comparison windows are mismatched or evidence quality is underspecified.

## 2) Mechanism (implemented)

- [MEASURED] Baseline artifacts now include trust/evidence metadata and attacker-model context.
- [MEASURED] Comparator enforces deterministic non-comparable outcomes with machine-readable reason codes.
- [MEASURED] Submission packaging now uses claim-audit checklist + pre-submit verification bundle for reproducible sign-off.

## 3) Proof blocks (critical claims)

### Claim A
- Claim: [MEASURED] Artifact pipeline enforces non-empty trust/evidence/attacker metadata.
- Repro: `bun run scripts/resulttype-baseline.ts`
- Proof: commit `909cd61`, artifact `memory/metrics/resulttype-baseline-2026-03-05.json`
- Evidence -> implication: metadata validation passes with required fields present -> baseline output is structurally auditable.
- Caveat: none

### Claim B
- Claim: [MEASURED] Comparison pipeline blocks mismatched windows as `non_comparable` with reason codes.
- Repro: `bun run scripts/compare-resulttype-artifacts.ts <baseline> <candidate>`
- Proof: commits `c472b47`, `2f0dd92`
- Evidence -> implication: mismatch cases return deterministic failure reasons -> before/after headline claims are gated by comparability.
- Caveat: none

### Claim C
- Claim: [MEASURED] Pre-submit verification is executable as a single pass/fail command.
- Repro: `./scripts/pre-submit-verify.sh`
- Proof: commit `bf313b8`
- Evidence -> implication: command returns comparable PASS on current window -> submission checks are operationally repeatable.
- Caveat: none

## 4) Results bundle

- Reliability: comparator status = `comparable` on latest verification window.
- Efficiency: pre-submit verification consolidated into a single command (`./scripts/pre-submit-verify.sh`).
- Evidence quality: `success`.
- Comparability verdict: `comparable` with reasonCodes `[]`.

Evidence -> implication: current packaging and verification flow supports evidence-first claims without non-comparable leakage.
Caveat reference: C1 (minor)

## 5) Caveat impact table

| ID | Caveat | Impact | Headline implication |
|---|---|---|---|
| C1 | Latest window shows zero delta movement (self-window stability), not a new non-zero performance shift | minor | Headline allowed, but must avoid claiming fresh performance uplift |

## 6) Headline eligibility decision

Eligible for strong headline? **yes (qualified)**

Decision line (`evidence -> implication`):
- Evidence: comparable PASS, explicit metadata guardrails, reproducible verification bundle.
- Implication: we can claim verifiable evaluation infrastructure hardening; we should not claim new performance gains from this window.
