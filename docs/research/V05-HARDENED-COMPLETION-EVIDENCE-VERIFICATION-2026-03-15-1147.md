# V05 hardened completionEvidence verification — 2026-03-15 11:47 UTC

## Trigger
Heartbeat Lane C after implementing hardened `completionEvidence` reporting in the v05 summarizer.

## Purpose
Verify that the new reporting layer can:
1. surface an **observability gap** explicitly,
2. keep `properBattleSatisfied=false`,
3. and avoid collapsing the case back into a vague unsettled/non-terminal story.

## Verification method
Ran a controlled local artifact-generation probe against `packages/sdk/scripts/summarize-v05-batches.py` using:
- battle created in log,
- multi-turn checkpoint,
- metadata override showing `acceptedOnChain=true` and `terminalOnChain=true`,
- log path intentionally lacking accept/settlement tokens,
- `completionEvidence` override with chain-side observed / log-side absent for `accepted` and `terminalObserved`.

The probe generated both JSON and markdown output from `build_per_battle(...)` and `write_markdown(...)`.

## Observed result
Derived completion evidence fields:
- `classification = observability-gap`
- `divergenceBoundary = accepted`
- `terminalObserved.status = observed`
- `terminalObserved.resolvedBy = on-chain-state`
- `properBattleSatisfied = false`

Markdown rendered:
- `## completion evidence`
- `- classification: \`observability-gap\``
- `- divergence boundary: \`accepted\``
- `- terminal kind: \`timeout\``
- `- proper battle satisfied: \`False\``
- milestone lines showing log=`absent` vs chain=`observed` for both `accepted` and `terminalObserved`

## What this verifies
1. **The hardened schema survives artifact generation end-to-end.**
   - The new `completionEvidence` block is present in per-battle output and markdown.

2. **Observability gaps are now first-class, explicit, and legible.**
   - The artifact no longer forces this case into a pure settlement-gap story.

3. **The slice fails closed on battle-crediting.**
   - Even with chain-side terminal observation, `properBattleSatisfied` remains `false`.
   - That avoids the exact overclaim path identified in the prior red-team lane.

4. **Authority ordering is visible in the artifact itself.**
   - Markdown renders: `receipt-or-event, on-chain-state, runner-log`.
   - The case resolves by `on-chain-state`, not runner-log symmetry.

## Narrow caveat
This verification used a **controlled artifact** rather than a fresh live battle run.
So the claim is about reporting correctness, not mechanism completion.

## Honest conclusion
The hardened reporting slice is now evidence-backed enough to support the next live verification step.

> We can now distinguish an observability gap from a true settlement gap in generated artifacts without accidentally upgrading that distinction into a proper-battle claim.

## Recommended next step
Use the hardened summarizer on the next controlled live battle artifact and classify whichever of these appears first:
- observability gap,
- true settlement gap,
- or actual terminal proper-battle evidence.
