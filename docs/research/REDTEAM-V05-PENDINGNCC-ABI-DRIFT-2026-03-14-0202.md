# Red-Team — v05 pendingNcc ABI Drift (2026-03-14 02:02 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus
Stress-test the planned `pendingNccA/B` ABI-shape correction before applying it to `v05-battle-loop.ts` and re-running the live one-battle smoke.

Reference artifact:
- `docs/research/APPLIED-LESSONS-V05-INTERFACE-DRIFT-2026-03-14-0157.md`

## Core question
**Why might a correct-looking `pendingNccA/B` tuple patch still fail to produce a mined first-turn tx or still leave the runner haunted by interface drift?**

## Weaknesses and failure paths

### 1) Neighboring getter drift may still be waiting one rung later
Fixing `pendingNccA/B` may just expose the next stale getter boundary.

**Failure path:**
- `pendingNcc` decode succeeds,
- runner then fails on `pendingVop`, `getBattleState`, or another tuple boundary,
- progress is real but the fix is over-credited.

**Mitigation:**
- after patching, keep the smoke artifact stage-specific,
- consider a quick tuple-getter audit once the immediate blocker is gone.

### 2) Correct tuple length does not guarantee correct semantic handling
Even with the right shape, default zero values can still be misread as active data.

**Failure path:**
- decode succeeds,
- runner uses `defenderGuessIdx` without respecting `hasDefenderGuess`,
- later logic behaves incorrectly even though the boundary decode is fixed.

**Mitigation:**
- treat presence flags as authoritative,
- gate downstream semantics on them explicitly.

### 3) Decode success can create false confidence before gas estimation / tx send
The patch may move the smoke one rung without actually proving first-turn submission.

**Failure path:**
- decode works,
- payload assembly works,
- gas estimation or tx send fails,
- team mistakenly treats the boundary fix as a gameplay unblock.

**Mitigation:**
- require the next smoke note to distinguish:
  1. decode success,
  2. payload assembly,
  3. gas estimation,
  4. mined `submitTurn` tx.

### 4) Literal ABI duplication invites recurring drift
Even a correct patch tonight leaves the underlying maintenance risk intact.

**Failure path:**
- future contract change happens,
- copied ABI fragments drift again,
- same bug returns in another surface.

**Mitigation:**
- note the live source-of-truth struct near the runner ABI,
- later centralize or generate ABI fragments from shared sources.

### 5) Weak logging can still make the next failure look mysterious
If the next rung fails without explicit stage logs, overnight progress remains hard to interpret.

**Failure path:**
- exception occurs after decode,
- logs do not clearly say whether failure was in VOP solve, estimateGas, or tx submission,
- the run still feels haunted even though the blocker moved.

**Mitigation:**
- keep or add stage-labeled logs around pending-state fetch, payload assembly, gas estimation, and tx send.

### 6) Other repo surfaces may keep the stale getter contract
The runner may be fixed while SDK/web/tests still reference the old tuple shape.

**Failure path:**
- overnight runner succeeds,
- another tool or UI later fails with the same stale ABI,
- the repo becomes internally inconsistent.

**Mitigation:**
- once the live smoke advances, grep for other `pendingNccA/B` literal declarations and unify them.

## Best next actions
1. Patch `pendingNccA/B` ABI to the exact live 4-field shape.
2. Keep the next smoke artifact stage-labeled through decode → payload assembly → gas estimation → tx send.
3. If the smoke advances, audit neighboring getter boundaries before scaling battle count.

## Verdict
The `pendingNcc` ABI correction is directionally right, but it is still exposed to:
- neighboring getter drift,
- semantic misuse of decoded fields,
- overclaim after decode success,
- recurring literal-ABI drift,
- weak stage logging,
- stale copies elsewhere in the repo.

## Explicit caveat
This critique does **not** mean the ABI fix is wrong. It means the patch should be **tiny, exact, and stage-instrumented**, so the next smoke run tells us precisely how far the ladder moved.
