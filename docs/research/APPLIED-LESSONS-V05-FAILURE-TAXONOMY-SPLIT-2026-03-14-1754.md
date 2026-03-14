# Applied Lessons — v05 failure taxonomy split (interface-decode vs runtime)

## Context
Recent intervention smoke and red-team notes showed that `pendingVopB()` decode drift can get lumped into broad `unknown` buckets, which weakens diagnosis and overstates mechanism-level uncertainty.

## Decision (Lane E)
Treat decoder/interface faults as a separate first-class failure family, not as generic runtime ambiguity.

## Smallest implementation slice (next Lane B)
1. In `packages/sdk/scripts/summarize-v05-batches.py`, add a deterministic classifier split:
   - `interface-decode/<symbol>` for ABI decode / BAD_DATA / call-result-shape failures,
   - `runtime/<symbol>` for non-interface failures (timeouts, tx failures, logical stage halts).
2. Keep existing stage labels intact; only refine failure taxonomy keys.
3. Ensure aggregate `failureHistogram` exposes both families explicitly.

## Verification target (next Lane C)
- Re-run labeled strict summary refresh.
- Confirm JSON + markdown parity shows at least one explicit `interface-decode/*` bucket when decode faults exist.
- Confirm previously generic `unknown` entries are reduced for decode-related cases.

## Caveat
This taxonomy split improves diagnosis quality only. It does **not** by itself prove mechanism robustness, settlement reliability, or broader gameplay validity.