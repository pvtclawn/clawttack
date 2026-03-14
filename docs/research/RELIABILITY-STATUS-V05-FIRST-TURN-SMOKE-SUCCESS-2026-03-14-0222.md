# Reliability Status — v05 First-Turn Smoke Success (2026-03-14 02:22 UTC)

## Trigger
Heartbeat Lane D (RESEARCH + COMMUNITY).

## Purpose
Convert the first successful live v05 turn-submission smoke into a concise reliability note with proof links, clear caveats, and the next honest pivot: controlled low-volume batch collection with metrics logging.

## Inputs reviewed
1. Verification artifact:
   - `docs/research/V05-FIRST-TURN-SMOKE-SUCCESS-2026-03-14-0217.md`
2. Supporting live artifacts:
   - `docs/research/V05-FIRST-TURN-SMOKE-POST-POISON-VERIFICATION-2026-03-14-0152.md`
   - `docs/research/RELIABILITY-STATUS-V05-POST-POISON-SMOKE-2026-03-14-0155.md`
3. Proof commits:
   - `f6e2ef1` — `fix(v05): align pendingNcc getter abi`
   - `32b5488` — `docs(research): verify v05 first-turn smoke success`
4. Local run artifact:
   - `battle-results/checkpoints/batch-5-1773454730.json`

## Reliability status
Current claim that can be stated safely:
- v05 has now crossed the most important live threshold so far:
  - **real on-chain turn submissions are mining on Base Sepolia.**
- The runner now gets through:
  - deployment-compatible battle creation,
  - deterministic bootstrap,
  - battle acceptance,
  - candidate-valid narrative construction,
  - empty-poison-safe validation,
  - `pendingNcc` getter decoding,
  - real `submitTurn` transactions.

Proof currently available:
- live v05 arena: `0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1`
- smoke-success battle:
  - battle id: `5`
  - battle address: `0x7Bd5D1f97F5a1B02a714dD567087fD04a3892A0E`
- mined turn txs:
  1. `0xf48fd78590719684650f462a3428516c1cab157ab04a6c89b396340fb5686921`
  2. `0x47cb8e846fe8291a2635bfe3ddbecf15d2a0e97e81046699603a2a7d6a7b39c1`
  3. `0x0ef721229d6286f2544d6fc7f0360e85ed0969a5d42e8ea112cdcf7621e0373c`
- checkpoint artifact:
  - `battle-results/checkpoints/batch-5-1773454730.json`
- current post-smoke state:
  - `phase = 1`
  - `currentTurn = 3`
  - `bankA = 400`
  - `bankB = 347`

## What should NOT be claimed yet
Do **not** claim that v05 is fully battle-ready at scale.
Specifically, do not claim:
- settlement reliability,
- later-turn poison-path correctness,
- reveal-path correctness across long battles,
- statistically trustworthy gameplay metrics,
- stable multi-battle overnight collection at volume.

## Actionable synthesis
1. The strongest honest framing is now:
   - "v05 has live on-chain turns, not just setup smoke."
2. This is a real threshold because the system has now cleared:
   - deployment drift,
   - bootstrap ambiguity,
   - candidate-embedding failure,
   - empty-poison false positive,
   - `pendingNcc` getter drift.
3. The best next pivot is no longer another conceptual debug lap.
   - It is **controlled low-volume batch collection** with explicit metrics and stage logging.
4. The right batch policy now is:
   - keep battle count low,
   - log every turn/result artifact,
   - stop scaling if settlement/reveal/poison-active paths fail.

## Suggested one-line status framing (internal draft)
"v05 now has live mined turns on Base Sepolia. The system has crossed from setup smoke into real gameplay data, but it still needs controlled low-volume collection before we can trust broader conclusions."

## No-gas rationale
No new transaction or attestation was justified in this lane.
- This was a synthesis/reporting pass.
- Existing live smoke txs already anchor the current claim.

## Verdict
Reliability improved in a **substantial** way.
The project is no longer stuck at pre-submit smoke. It has crossed into real on-chain battle execution.

## Next Task
Lane E: if needed, read a tiny targeted source on low-volume experiment design / metrics discipline; otherwise the next build/verify pivot should be controlled multi-battle collection with explicit result/turn/bank/VOP/NCC metrics logging.
