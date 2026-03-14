# Reliability Status — V05 Comparable Gate (2026-03-14 14:15 UTC)

## Scope
Synthesize the new comparison-level `comparable` gate behavior after clean and injected runs, and decide whether markdown non-evaluative policy hardening (`comparable=false`) is next.

## Verified status
1. Comparison artifacts now carry explicit machine-readable comparability fields:
   - `comparable`
   - `comparabilityReasons[]` (deterministic class ordering)
2. Clean→clean comparison path is valid:
   - `comparable=true`
   - `comparabilityReasons=[]`
3. Injected contamination path fails closed:
   - `comparable=false`
   - ordered reasons present:
     1) `strict-violation`
     2) `guardrail-failure`
     3) `runconfig-drift-outside-allowed-variable`
4. Guardrail/strict linkage is effective:
   - non-clean strict run persists diagnostics and marks comparison non-comparable.

## Reliability claim (narrow)
The comparison gate now reliably prevents evaluative comparison under known contaminated conditions and exposes deterministic, machine-readable reasons.

## Remaining gap
Markdown policy still allows evaluative-style comparison text even when `comparable=false`. Highest-value next hardening is a non-evaluative markdown policy gate for non-comparable outputs.

## Proof artifacts
- Comparison artifact:
  - `battle-results/summaries/aggregate/comparison-latest.json`
- Prior verification note:
  - `docs/research/V05-COMPARABLE-GATE-VERIFICATION-2026-03-14-1410.md`

## On-chain classification
Verified no action needed (local reliability synthesis only).
