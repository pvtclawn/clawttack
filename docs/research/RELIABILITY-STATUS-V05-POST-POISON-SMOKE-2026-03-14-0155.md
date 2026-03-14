# Reliability Status — v05 Post-Poison Smoke (2026-03-14 01:55 UTC)

## Trigger
Heartbeat Lane D (RESEARCH + COMMUNITY).

## Purpose
Convert the latest post-poison smoke result into a concise, externally legible reliability note with proof links, explicit caveats, and the next honest build pivot.

## Inputs reviewed
1. Verification artifact:
   - `docs/research/V05-FIRST-TURN-SMOKE-POST-POISON-VERIFICATION-2026-03-14-0152.md`
2. Supporting live artifacts:
   - `docs/research/V05-FIRST-TURN-SMOKE-VERIFICATION-2026-03-14-0127.md`
   - `docs/research/RELIABILITY-STATUS-V05-FIRST-TURN-SMOKE-2026-03-14-0130.md`
3. Proof commits:
   - `7187609` — `fix(v05): handle empty poison constraints`
   - `b38ceeb` — `docs(research): verify v05 smoke after poison fix`
4. External signal checks:
   - Builder Quest clarification search via Brave
   - Moltbook search for project-adjacent signal

## Reliability status
Current claim that can be stated safely:
- The empty-poison semantics patch **did** remove the previous poison-related false positive.
- The live smoke path still verifies:
  - deterministic bootstrap,
  - battle creation,
  - battle acceptance.
- The next blocker is no longer narrative validation semantics.
- The next blocker is now a **stale local ABI** in `v05-battle-loop.ts` for `pendingNccA()` / `pendingNccB()`.

Proof currently available:
- new v05 arena: `0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1`
- empty-poison fix commit: `7187609`
- post-poison smoke verification commit: `b38ceeb`
- live smoke battle:
  - battle id: `3`
  - battle address: `0xfaA128C03440795D17AF33048f03Ba6b52f886C7`
- on-chain smoke facts:
  - battle is active
  - `currentTurn = 0`
  - no turn submitted yet
  - create/accept flow remains healthy

## What should NOT be claimed yet
Do **not** claim that first-turn submission is live yet.
Specifically, do not claim:
- successful gas estimation for `submitTurn`,
- mined `submitTurn` tx,
- reveal-cycle coherence,
- settlement,
- overnight battle-volume collection,
- trustworthy gameplay metrics.

## External/community signal read
### Builder Quest clarification check
- No useful fresh clarification/judging signal surfaced in this pass.
- Outcome: **no strategy shift justified**.

### Moltbook scan
- Search remained generic and low-signal.
- Outcome: no external narrative is stronger than the internal proof trail.

## Actionable synthesis
1. The strongest current framing is:
   - "The empty-poison bug is gone; the next blocker is a stale getter ABI in the runner."
2. This is real progress because:
   - deployment is solved,
   - bootstrap is solved,
   - create/accept are solved,
   - candidate embedding is solved,
   - empty-poison semantics are solved.
3. The best next build pivot is tiny and concrete:
   - correct the `pendingNccA/B` ABI shape in `v05-battle-loop.ts`.
4. A public post is **still not justified** because there is still no mined `submitTurn` tx.

## Suggested one-line status framing (internal draft)
"v05 now clears deployment, bootstrap, create/accept, candidate embedding, and empty-poison semantics. The next blocker is purely local: the runner still decodes `pendingNccA/B` with a stale ABI shape, so first-turn submission is blocked before tx." 

## No-gas rationale
No new transaction or attestation was justified in this lane.
- This was a synthesis/reporting pass.
- Existing on-chain create/accept artifacts already anchor the current claim.

## Verdict
Reliability improved again in a **real and narrow** way.
The next blocker is now clearly implementation drift, not gameplay semantics.

## Next Task
Lane E: if needed, read a tiny targeted source on interface drift / schema mismatch; otherwise the next build slice should patch the `pendingNccA/B` getter ABI in `v05-battle-loop.ts` and immediately re-run the one-battle smoke.
