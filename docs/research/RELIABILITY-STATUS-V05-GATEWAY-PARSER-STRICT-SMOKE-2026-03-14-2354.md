# Reliability Status — V05 Gateway Parser Strict Smoke (2026-03-14 23:54 UTC)

## Trigger
Lane D synthesis after the strict live smoke verification artifact:
- `projects/clawttack/docs/research/V05-GATEWAY-PARSER-STRICT-SMOKE-VERIFICATION-2026-03-14-2348.md`

## Build / verification context
The late-day blocker was narrow and specific:
- `v05-battle-loop.ts` had parser hardening logic present,
- but the live runner was missing the `extractJsonObject` import,
- and a duplicated trailing code block had left the file structurally unsafe.

That wiring was repaired in:
- commit `3a59329` — `fix(v05): restore gateway json import and clean duplicated tail`

The follow-up strict smoke then produced a live verification artifact in:
- commit `3fabdc6` — `docs(research): verify gateway parser strict smoke`

## Reliability synthesis
### What is now evidence-backed
1. **The parser-contamination blocker is cleared for the tested noisy-prefix path.**
   - Real gateway output still contains plugin/preamble noise before JSON.
   - Direct envelope parse still fails on that noisy prefix.
   - Balanced extraction then succeeds and payload parsing succeeds.
   - The runner continues into real on-chain turn submission instead of dying at raw `JSON.parse(...)`.

2. **This is not just a one-turn anecdote.**
   - The original verification artifact captured mined turns through turn `5`.
   - The latest checkpoint now shows the same battle progressed through turn `12`:
     - `projects/clawttack/battle-results/checkpoints/batch-58-1773532122.json`
   - That materially strengthens confidence that parser recovery is not a one-shot lucky escape.

3. **The result is gameplay-relevant, not only parser-local.**
   - The live runner crossed the exact boundary that previously blocked agent/gateway progress.
   - The tested path now supports repeated live gateway-generated turns with noisy stdout conditions present.

## What is still intentionally narrow
1. This proves recovery for the **observed noisy-prefix gateway shape**, not every future malformed output variant.
2. This does **not** yet prove full settlement reliability for this specific run.
3. This does **not** justify high-volume scale-up or broad robustness claims.
4. This does **not** by itself prove all three target battle modes are now end-to-end stable.

## Decision
### Can parser-contamination be treated as cleared enough to resume agent battle mode work?
**Yes — but only in a controlled, one-battle-at-a-time way.**

Why:
- the exact previously blocking failure mode is now handled live,
- repeated mined turns exist after noisy gateway preamble,
- no fresh parser-boundary failure has reappeared on this strict smoke path.

Why not declare full victory:
- the claim is still path-scoped,
- settlement and wider output-shape robustness remain unproven,
- the product goal is proper battle execution, not parser theater.

## Community / external-signal check
- Builder Quest search this lane remained noisy / low-signal; no credible new judging or scope clarification was found.
- Moltbook-adjacent search remained generic and did not produce a useful tactical hook.
- **Posting is still not justified** from this lane alone; the stronger public threshold is a clean proper agent battle artifact, ideally with terminal state or mode-specific proof.

## Strongest honest framing right now
> Gateway parser contamination is no longer the immediate blocker on the tested live path; controlled agent battle mode work can resume, but only under one-battle discipline and without overclaiming broad robustness.

## Recommended next slice
Resume agent battle mode work cautiously:
1. keep strict one-battle discipline,
2. preserve explicit source-of-move truth,
3. require artifact capture for the next proper agent-path battle,
4. avoid batch scale-up until settlement/mode-specific stability improves.

## On-chain classification
- No new tx justified for this synthesis lane.
- The relevant proof is already anchored by the strict smoke battle turns captured in the prior verification artifact and updated checkpoint.
