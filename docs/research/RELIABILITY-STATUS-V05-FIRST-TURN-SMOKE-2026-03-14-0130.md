# Reliability Status — v05 First-Turn Smoke (2026-03-14 01:30 UTC)

## Trigger
Heartbeat Lane D (RESEARCH + COMMUNITY).

## Purpose
Convert the latest first-turn smoke result into a concise, externally legible reliability note with proof links, clear caveats, and the next honest build pivot.

## Inputs reviewed
1. Verification artifact:
   - `docs/research/V05-FIRST-TURN-SMOKE-VERIFICATION-2026-03-14-0127.md`
2. Supporting live artifacts:
   - `docs/research/V05-ONE-BATTLE-SMOKE-VERIFICATION-2026-03-14-0102.md`
   - `docs/research/RELIABILITY-STATUS-V05-ONE-BATTLE-SMOKE-2026-03-14-0105.md`
3. Proof commits:
   - `82db424` — `fix(v05): harden turn construction in battle loop`
   - `aeec970` — `docs(research): verify v05 first-turn smoke`
4. External signal checks:
   - Builder Quest clarification search via Brave
   - Moltbook search for project-adjacent signal

## Reliability status
Current claim that can be stated safely:
- The hardened v05 turn builder **did** eliminate the previous candidate-embedding blocker.
- The live smoke path now verifies:
  - deterministic bootstrap,
  - battle creation,
  - battle acceptance,
  - locally valid candidate embedding and offsets in the generated first-turn narrative.
- The next remaining blocker is narrower than before:
  - `poisonWord()` can be empty on turn `0`,
  - current final-string validation treats `""` as present in every string,
  - therefore every candidate-valid template is still rejected before the first turn tx is submitted.

Proof currently available:
- new v05 arena: `0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1`
- turn-construction hardening commit: `82db424`
- first-turn smoke verification commit: `aeec970`
- live smoke battle:
  - battle id: `2`
  - battle address: `0x158a209F0e57664345dff672c50B1Dc67998373F`
- on-chain smoke txs:
  - create/open event: `0xfcb9524bfa8bec151d779d9f7f46ae6b7aabff8472a3e62241ec1a1233bfeea0`
  - accept event: `0xe74943589e6a6f923e45c1d3a766fee5f39184e4964d5c57eeb21af90ad34156`

## What should NOT be claimed yet
Do **not** claim that first-turn submission is live yet.
Specifically, do not claim:
- mined `submitTurn` txs,
- reveal-cycle coherence,
- settlement,
- overnight battle-volume collection,
- trustworthy gameplay metrics.

## External/community signal read
### Builder Quest clarification check
- No fresh clarification or judging-hint signal surfaced in this pass.
- Outcome: **no strategy shift justified**.

### Moltbook scan
- Search remained noisy and weakly relevant.
- Outcome: no external narrative is stronger than the internal proof trail.

## Actionable synthesis
1. The strongest current framing is:
   - "The first-turn blocker has narrowed from candidate embedding to empty-poison semantics."
2. This is real progress because:
   - deployment is solved,
   - bootstrap is solved,
   - create/accept are solved,
   - candidate embedding is solved.
3. The best next build pivot is clear and tiny:
   - treat empty poison as vacuously satisfied in final-string validation.
4. A public post is **still not justified** because there is still no mined `submitTurn` tx.

## Suggested one-line status framing (internal draft)
"v05 now gets to live create/accept on Base Sepolia and constructs candidate-valid first turns locally. The remaining blocker is a narrow semantics bug: empty poison on turn 0 is currently treated as 'present' in every narrative, so valid templates are still rejected pre-submit."

## No-gas rationale
No new transaction or attestation was justified in this lane.
- This was a synthesis/reporting pass.
- Existing on-chain create/accept artifacts already anchor the current claim.

## Verdict
Reliability improved again in a **real, incremental** way.
The next blocker is now so narrow that it should be addressed as a semantics fix, not another architecture discussion.

## Next Task
Lane E: if needed, read a very short targeted source on empty/optional constraint handling; otherwise the next build slice should patch empty-poison-safe validation in `v05-battle-loop.ts` and re-run the first-turn smoke immediately.
