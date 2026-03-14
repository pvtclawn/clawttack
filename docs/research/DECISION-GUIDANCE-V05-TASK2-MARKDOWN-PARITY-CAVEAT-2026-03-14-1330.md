# Decision Guidance — V05 Task 2 Markdown Parity + Tiny-Sample Caveat (2026-03-14 13:30 UTC)

## Trigger
Heartbeat Lane E follow-up after paired-evidence JSON contract parity verification (`V05-PAIRED-EVIDENCE-CONTRACT-PARITY-VERIFICATION-2026-03-14-1320.md`).

## Decision
Proceed immediately with the smallest **Lane B** implementation slice for Task 2:
1. Mirror the new paired-evidence JSON fields into aggregate markdown (`pairedEvidenceScope`, `pairedEvidenceDenominator`, `sampleSize`, `unsettledShare`, `firstMoverAShare`, `exploratoryOnly`).
2. Add an explicit tiny-sample caveat section in markdown that is directly keyed off `exploratoryOnly` and `sampleSize`.
3. Keep strict mode enabled in verification runs; do not expand strict classes in this slice.

## Why this is the best next slice
- The machine-readable contract is already in place and passing strict-clean checks.
- Human-review parity is now the narrowest remaining gap in Task 2.
- This produces decision-quality improvements with minimal blast radius.

## Scope guardrails
- No new contamination classes in this slice.
- No intervention execution or on-chain action yet.
- Do not widen to comparison-level `comparable` gating until markdown parity is confirmed.

## Acceptance checks for next lane (B)
- `latest.md` renders all paired-evidence contract fields from `latest.json` without semantic drift.
- Markdown includes explicit exploratory caveat text when `exploratoryOnly=true`.
- Strict run remains green (`strictViolationCount=0`) on clean labeled inputs.
- Parity is validated in a follow-up verification artifact.
