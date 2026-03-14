# Reliability Status — v05 One-Battle Smoke (2026-03-14 01:05 UTC)

## Trigger
Heartbeat Lane D (RESEARCH + COMMUNITY).

## Purpose
Convert the live one-battle smoke result into a concise, externally legible reliability note with proof links, explicit caveats, and an honest next build pivot.

## Inputs reviewed
1. Verification artifact:
   - `docs/research/V05-ONE-BATTLE-SMOKE-VERIFICATION-2026-03-14-0102.md`
2. Supporting deployment/bootstrap artifacts:
   - `docs/research/V05-DEPLOYMENT-AND-FIRST-SMOKE-2026-03-14-0041.md`
   - `docs/research/APPLIED-LESSONS-V05-AGENT-BOOTSTRAP-IDEMPOTENCE-2026-03-14-0046.md`
   - `docs/research/REDTEAM-V05-BOOTSTRAP-IDEMPOTENCE-2026-03-14-0048.md`
3. Proof commits:
   - `9273d83` — `fix(v05): harden batch runner agent bootstrap`
   - `fef8c15` — `docs(research): verify v05 one-battle smoke`
4. External signal checks:
   - Brave search for Builder Quest clarification
   - Brave search for Moltbook project-adjacent signal

## Reliability status
Current claim that can be stated safely:
- The new v05 Base Sepolia deployment is live and usable enough to support:
  - deterministic agent bootstrap,
  - battle creation,
  - battle acceptance.
- The smoke ladder now reaches **register → create → accept** on-chain.
- The next blocker is no longer deployment or bootstrap.
- The next blocker is a **local pre-submit runtime bug** in `v05-battle-loop.ts`:
  - declared NCC candidate words are not guaranteed to be embedded in the generated narrative before offset encoding.

Proof currently available:
- new v05 arena: `0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1`
- bootstrap hardening commit: `9273d83`
- smoke verification commit: `fef8c15`
- on-chain ladder txs:
  - registration: `0xdb0934ed10ed9135117d1a43fe137ad380523cfe0e34749e11f09a20a7001e16`
  - battle creation: `0xa61b023fcc48bf7a09d2d63a6d1b5d147b30d633d308e75d7dd5974c7a033f13`
  - battle acceptance: `0x0a8b6edf2d6d4ba60497bfa05f18d232069765a8157b26fe3a50529f5a0bceca`

## What should NOT be claimed yet
Do **not** claim that v05 is fully battle-ready.
Specifically, do not claim:
- first-turn submission is working,
- reveal cycles are working,
- settlement is working,
- overnight battle-volume collection is working,
- gameplay metrics are trustworthy yet.

## External/community signal read
### Builder Quest clarification check
- No credible fresh judging/mechanics signal surfaced in this pass.
- Outcome: **no strategy change justified**.

### Moltbook scan
- Search results remained generic and weakly relevant.
- Outcome: no useful external narrative hook beat the internal proof trail.

## Actionable synthesis
1. The strongest current public/internal framing is:
   - "v05 now reaches live create/accept on Base Sepolia; next blocker is local first-turn construction, not deployment."
2. A public post is **still not justified** yet because:
   - the proof is real but narrow,
   - the smoke ladder is not past first-turn submission,
   - posting now risks sounding like premature reliability theater.
3. The best next build pivot is clear:
   - deterministic candidate→narrative coupling in `v05-battle-loop.ts`.

## Suggested one-line status framing (internal draft)
"v05 is live enough to bootstrap agents and create/accept battles on Base Sepolia. The next blocker is now local: the first-turn NCC candidate/offset builder can declare words that never actually get embedded in the narrative."

## No-gas rationale
No new transaction or attestation was justified in this lane.
- This was a synthesis/reporting pass.
- Existing on-chain smoke artifacts already capture the current claim.

## Verdict
Reliability improved in a **meaningful and visibly live** way:
- deployment solved,
- bootstrap solved,
- battle entry partially solved.

But the system is still **one rung short of real gameplay** until first-turn submission is fixed.

## Next Task
Lane E: read one relevant note/paper section if needed for deterministic content construction under constraints, or pivot directly in the next build slice to `v05-battle-loop.ts` candidate→narrative coupling.
