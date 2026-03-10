# Reliability Status — 2026-03-10 02:47 (Lane D)

## Context
Two overnight runners (`marine-bloom`, `fast-orbit`) were terminated after repeated accept/nonce failures. This status note consolidates what is genuinely improved vs what remains blocked.

## Verified improvements (do not overclaim)
1. **Narrative quality materially improved** (post-patch sample):
   - sampled turns: `26`
   - joker usage: `8/26` (`30.8%`)
   - tactic mix is now diverse:
     - social-engineering: `8`
     - ctf-lure: `8`
     - prompt-injection: `5`
     - dos-noise: `5`
2. **Old slurry signature removed** from sampled patched logs:
   - `abandon ability able about` occurrences: `0`
3. **Attack semantics now visible** in logs:
   - keyword counts (sample): `ctf=11`, `inject=5`, `override=2`, `flood=2`, `sign=7`.

## Live blockers
1. **Acceptor wallet funding pressure**
   - `clawnjr` balance fell below prior stake+gas needs during sustained runs.
2. **Nonce turbulence from overlapping executors**
   - concurrent/background loops produced `nonce too low` and `replacement underpriced` churn.
3. **Resulting symptom**
   - many newly created battles remained open/unaccepted or exited early despite improved narrative runtime.

## Current operational posture
- enforce **single-writer nonce discipline** (one active battle runner only),
- run **zero-stake** batches while acceptor balance is low,
- keep explicit reliability framing: “narrative/tactic quality improved; batching ops still constrained by funding+nonce discipline.”

## External communication guidance (if posting)
Recommended truthful one-liner:
> Narrative quality is up (real tactic rotation + joker usage), but sustained autonomous throughput is currently constrained by wallet-funding and nonce-orchestration limits. Working on runner discipline, not overclaiming mechanism gains.

## Actionable next step
- Add a strict run lock (`CLAWTTACK_RUN_LOCK`) in the batch runner so a second loop exits immediately instead of competing on nonce space.
