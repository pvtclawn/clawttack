# 154 — v05 pendingVopB ABI recovery next slices (2026-03-14)

## Trigger
Red-team outcome from intervention run (`REDTEAM-V05-INTERVENTION-OUTCOME-PENDINGVOPB-2026-03-14-1627.md`) identified `pendingVopB()` decode drift as the top blocker for trustworthy intervention evidence.

## Task 1 (P0) — Patch `pendingVopA/B` ABI boundary in runner
**Scope:** `packages/sdk/scripts/v05-battle-loop.ts`

### Implementation
- Align local ABI declarations for `pendingVopA()`/`pendingVopB()` to the live v05 contract getter shape.
- Keep patch boundary-local (do not refactor unrelated battle logic).
- Add stage-labeled logs around VOP pending fetch/decode.

### Acceptance criteria
1. No `BAD_DATA` decode failure for `pendingVopA/B` in a one-battle smoke.
2. Decode stage logs are explicit (`fetch-pending-vop`, `decode-pending-vop`, `submit-turn`).
3. Typecheck passes for touched script.

---

## Task 2 (P0) — Failure taxonomy split in summarizer
**Scope:** `packages/sdk/scripts/summarize-v05-batches.py`

### Implementation
- Split current coarse `unknown` bucket into at least:
  - `interface-decode/*`
  - `runtime/*`
- Classify `pendingVopB` decode failures under `interface-decode/pendingVopB`.

### Acceptance criteria
1. Aggregate failure histogram no longer hides decode drift under plain `unknown`.
2. Per-battle summaries carry the same class label as aggregate.
3. JSON/Markdown parity preserved for new failure class labels.

---

## Task 3 (P1 gate) — Post-patch strict smoke gate before any scale-up
**Scope:** one controlled run + strict summary refresh

### Implementation
- Run exactly one labeled smoke batch after Task 1:
  - `CLAWTTACK_BATCH_BATTLES=1` with strict summarizer refresh.
- Require clean strict guardrails and zero `interface-decode/pendingVopB` failures.

### Acceptance criteria
1. `strictViolationCount=0` and `singleVariableInterventionGuardrail.ok=true`.
2. No `pendingVopB` decode class appears in the sampled batch.
3. If still failing, mark run as non-scalable and keep batch count at 1.

---

## Priority order
1. Task 1 (direct blocker removal)
2. Task 2 (diagnostic clarity)
3. Task 3 (execution gate)

## Non-overclaim caveat
This plan targets ABI-boundary reliability and evidence quality only. It does **not** claim settlement reliability or broad gameplay robustness.